import { NativeEventEmitter, NativeModules } from 'react-native';
import { WebSocketLiveTransport } from './WebSocketLiveTransport';
import { MirrorLiveSession } from './MirrorLiveSession';
import { base64ToArrayBuffer } from './base64';
import { rmsFromPcm16 } from './micLevel';
import type { MirrorLiveTransport } from './MirrorLiveTransport';
import type {
  MirrorAvatarError,
  MirrorCaption,
  MirrorSessionOptions,
  MirrorSessionState,
  MirrorViewBinding,
} from '../types';

// Baked into the SDK — hidden from consumers. PRODUCTION ONLY, and deliberately not selected by
// environment: inside a published package `__DEV__` is the CONSUMER's build flag, so branching on
// it would send their Debug builds to our backend-of-the-day. Non-production endpoints are never
// shipped; to point at one, inject a transport via `createSession(opts, { transport })`.
const LIVE_WS_URL = 'wss://platform.mirrorr.ai/api/v1/ws/session';

// Applied when the consumer doesn't pass `language`, so getToken always receives a concrete
// language. Override per session with MirrorSessionOptions.language.
const DEFAULT_LANGUAGE = 'en';

// `getToken` is the consumer's own code, so its network timeout is unknown — and a device's TCP
// connect to an unreachable host is not refused, it hangs until the OS gives up (a minute or
// more on iOS). Cap it so the user learns the call failed while they are still watching the
// screen, rather than staring at an avatar that will never speak.
const TOKEN_TIMEOUT_MS = 10000;

/** Rejects with `reason` if `p` has not settled within `ms`. Never leaves the timer running. */
function withTimeout<T>(p: Promise<T>, ms: number, reason: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(reason)), ms);
    p.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

interface Emitter {
  addListener: (
    name: string,
    cb: (e: any) => void,
  ) => { remove: () => void };
}

/**
 * Native audio codes → the public error surface. Without this every native fault arrived as
 * `unknown`, so a consumer could not tell "another app is holding the mic" (expected, and the
 * user can act on it) from a genuine engine fault.
 *
 * `recoverable` is honest: only the cases the SDK actually resumes from on its own are true —
 * contention clears when the other app releases the mic, and an interruption ends. A denied
 * permission or a broken engine does not fix itself.
 */
const NATIVE_ERRORS: Record<
  string,
  { code: MirrorAvatarError['code']; recoverable: boolean; message: string }
> = {
  mic_permission_denied: {
    code: 'permission_denied',
    recoverable: false,
    message: 'Microphone permission denied',
  },
  mic_unavailable: {
    code: 'audio_capture_failed',
    recoverable: true,
    message: 'Microphone in use by another app',
  },
  mic_interrupted: {
    code: 'audio_capture_failed',
    recoverable: true,
    message: 'Microphone taken by another app',
  },
  engine_failed: {
    code: 'audio_capture_failed',
    recoverable: false,
    message: 'Audio unavailable',
  },
  bad_audio: {
    code: 'audio_playback_failed',
    recoverable: true,
    message: 'Audio playback failed',
  },
};

/** Maps a native code to a typed error, falling back to `unknown` for anything unrecognised. */
function nativeError(nativeCode?: string): MirrorAvatarError {
  const known = nativeCode ? NATIVE_ERRORS[nativeCode] : undefined;
  return {
    code: known?.code ?? 'unknown',
    message: known?.message ?? nativeCode ?? 'native audio error',
    recoverable: known?.recoverable ?? true,
    nativeCode,
  };
}

/** Injectable seams — production uses the real RN native module + WebSocket. */
export interface MirrorSessionEnv {
  transport?: MirrorLiveTransport;
  nativeModule?: any;
  emitter?: Emitter;
  /** Injectable clock so the usage timer is testable. */
  now?: () => number;
}

/** What the packaged chrome (timer, captions, controls) subscribes to. */
export interface MirrorSessionListener {
  onState?: (state: MirrorSessionState) => void;
  onCaption?: (caption: MirrorCaption) => void;
  onError?: (error: MirrorAvatarError) => void;
}

/**
 * The public "call" object. Owns the WebSocket transport, the live-session state
 * machine, and the native audio module wiring. The consumer only ever touches
 * setToken / start / stop / mute / dispose / bindView + the option callbacks.
 */
export class MirrorSession {
  /**
   * Mic RMS of the most recent frame, 0 while muted. A mutable ref, not state — the
   * waveform samples it on the animation clock. Falls to 0 on teardown rather than freezing.
   */
  readonly micLevel: { current: number } = { current: 0 };

  private native: any;
  private transport: MirrorLiveTransport;
  private emitter: Emitter;
  private session: MirrorLiveSession;
  private subs: Array<{ remove: () => void }> = [];
  private view: MirrorViewBinding | null = null;
  private token: string | null = null;
  private started = false;
  private now: () => number;
  // Server session id captured from the last token result. Echoed back into getToken on
  // reconnect / proactive refresh so the consumer's backend can RESUME the same session
  // (the agent keeps its conversation) rather than mint a new one.
  private _sessionId: string | undefined;

  private listeners = new Set<MirrorSessionListener>();
  /**
   * The last error raised, replayed to anything that subscribes afterwards. The host mounts the
   * view AFTER calling start(), so a fast failure — a wrong token-server address refuses the
   * connection in milliseconds — is raised before the view's chrome has subscribed. Without a
   * retained copy that error is emitted into an empty room and the call fails silently.
   */
  private lastError: MirrorAvatarError | null = null;
  private _state: MirrorSessionState = 'idle';
  private _muted = false;

  // Usage clock: banked connected time only. Freezes the instant the socket drops and
  // resumes without resetting.
  private usageMs = 0;
  private segStart: number | null = null;
  private _startedAt: number | null = null;

  constructor(private opts: MirrorSessionOptions, env: MirrorSessionEnv = {}) {
    this.native = env.nativeModule ?? NativeModules.MirrorAvatarModule;
    this.transport = env.transport ?? new WebSocketLiveTransport(LIVE_WS_URL);
    this.emitter = env.emitter ?? new NativeEventEmitter(this.native);
    this.now = env.now ?? Date.now;
    this.session = new MirrorLiveSession(this.transport, {
      enqueueAudioChunk: (b64, seq) => this.native?.enqueueAudioChunk?.(b64, seq),
      stopPlayback: () => this.native?.stopPlayback?.(),
      setBlendshapes: (frames) => this.view?.setBlendshapes(frames),
      stopFace: () => this.view?.stopFace(),
      onState: (state) => this.handleState(state),
      onCaption: (caption) => this.emit((l) => l.onCaption?.(caption)),
      onError: (error) => this.raise(error),
      connectionProvider: async (ctx) => {
        if (!this.opts.getToken) {
          return this.token ? { token: this.token } : null;
        }
        const raw = await withTimeout(
          Promise.resolve(
            this.opts.getToken({
              reason: ctx.reason,
              agentId: this.opts.agentId,
              language: this.opts.language ?? DEFAULT_LANGUAGE,
              sessionId: this._sessionId,
            }),
          ),
          TOKEN_TIMEOUT_MS,
          `getToken timed out after ${TOKEN_TIMEOUT_MS}ms`,
        );
        const result = typeof raw === 'string' ? { token: raw } : raw;
        if (!result || !result.token) return null;
        // Capture the session id for the next resume; keep the prior one if this mint
        // didn't return one (a token-only backend still reconnects, just without resume).
        if (result.sessionId) this._sessionId = result.sessionId;
        return { token: result.token, expiresInMs: result.expiresInMs };
      },
    });
    if (opts.onStateChange || opts.onCaption || opts.onError) {
      this.listeners.add({
        onState: opts.onStateChange,
        onCaption: opts.onCaption,
        onError: opts.onError,
      });
    }
  }

  // ----- observable state -----

  get state(): MirrorSessionState {
    return this._state;
  }

  get muted(): boolean {
    return this._muted;
  }

  /** Epoch ms of the first connect, preserved across reconnects. Null until connected. */
  get startedAt(): number | null {
    return this._startedAt;
  }

  /** Connected time only. Poll it — it does not notify. */
  getUsageMs(): number {
    return (
      this.usageMs + (this.segStart !== null ? this.now() - this.segStart : 0)
    );
  }

  /**
   * The packaged chrome subscribes here; returns an unsubscribe.
   *
   * Current state and any outstanding error are delivered immediately, so a listener that
   * arrives late still sees them — see [lastError].
   */
  subscribe(listener: MirrorSessionListener): () => void {
    this.listeners.add(listener);
    listener.onState?.(this._state);
    if (this.lastError) listener.onError?.(this.lastError);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Client-side only — there is no server mute control. The mic stays open (so unmute is
   * instant) and frames are simply not sent.
   */
  mute(muted: boolean): void {
    this._muted = muted;
    if (muted) this.micLevel.current = 0;
  }

  // ----- lifecycle -----

  /** Manual token (alternative to the `getToken` provider) for simple/static use. */
  setToken(token: string): void {
    this.token = token;
  }

  /** The view registers its shared-value writers so the session can drive lip-sync. */
  bindView(view: MirrorViewBinding): () => void {
    this.view = view;
    return () => {
      if (this.view === view) this.view = null;
    };
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    // Fresh call → new session. Clear any id left from a prior run so `reason:'start'`
    // never carries a stale sessionId.
    this._sessionId = undefined;
    // A retry must not replay the previous attempt's failure to the new view.
    this.lastError = null;
    this.subs = [
      this.emitter.addListener('onAudioFrame', (e: { base64: string }) => {
        const frame = base64ToArrayBuffer(e.base64);
        // Gate before the wire, and zero the meter while muted — never send silence.
        if (this._muted) {
          this.micLevel.current = 0;
          return;
        }
        this.micLevel.current = rmsFromPcm16(frame);
        this.transport.sendAudioFrame(frame);
      }),
      this.emitter.addListener('onChunkStarted', (e: { seq: number }) =>
        this.session.onChunkStarted(e.seq),
      ),
      this.emitter.addListener('onError', (e: { code?: string }) =>
        this.raise(nativeError(e?.code)),
      ),
    ];

    // The mic must be open BEFORE the socket is. Starting them in parallel produced a connected,
    // billing session the user could not be heard in — the avatar greeted an audience of nobody.
    // Optional-chained so an older native build (no promise, returns undefined) still starts.
    try {
      await this.native?.startLiveCapture?.();
    } catch (e) {
      this.teardownSubs();
      this.started = false;
      const error = nativeError((e as { code?: string } | undefined)?.code);
      this.handleState('error');
      this.raise(error);
      return;
    }

    await this.session.start();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.session.stop();
    this.native?.stopLiveCapture?.();
    this.teardownSubs();
    this.micLevel.current = 0;
  }

  private teardownSubs(): void {
    this.subs.forEach((sub) => sub.remove());
    this.subs = [];
  }

  dispose(): void {
    this.stop();
    this.listeners.clear();
  }

  // ----- internals -----

  private handleState(state: MirrorSessionState): void {
    this._state = state;
    if (state === 'listening' || state === 'speaking') {
      // The call is live, so whatever failed before no longer applies — drop it rather than
      // replaying a stale failure into the next listener that subscribes.
      this.lastError = null;
      if (this.segStart === null) this.segStart = this.now();
      if (this._startedAt === null) this._startedAt = this.now();
    } else if (
      state === 'connecting' ||
      state === 'reconnecting' ||
      state === 'stopped' ||
      state === 'error'
    ) {
      this.pauseUsage();
      if (state !== 'connecting' && state !== 'reconnecting') {
        this.micLevel.current = 0;
      }
    }
    this.emit((l) => l.onState?.(state));
  }

  /** Bank the live segment. Idempotent. */
  private pauseUsage(): void {
    if (this.segStart !== null) {
      this.usageMs += this.now() - this.segStart;
      this.segStart = null;
    }
  }

  /** Raise an error: retained for late subscribers, then delivered to current ones. */
  private raise(error: MirrorAvatarError): void {
    this.lastError = error;
    this.emit((l) => l.onError?.(error));
  }

  private emit(fn: (listener: MirrorSessionListener) => void): void {
    this.listeners.forEach(fn);
  }
}

export const MirrorSDK = {
  createSession: (opts: MirrorSessionOptions, env?: MirrorSessionEnv) =>
    new MirrorSession(opts, env),
};
