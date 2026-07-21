import type {
  MirrorLiveTransport,
  MirrorConnectionProvider,
  MirrorConnectionResult,
} from './MirrorLiveTransport';
import type { MirrorLiveEvent, LiveBlendshapeFrame } from './protocol';
import type { MirrorAvatarState, MirrorAvatarError } from '../types';

const COUPLE_DROP_TIMEOUT_MS = 12000;

// Sequential drained playback. The server streams a reply's chunks FASTER than real time. The
// native lip-sync start-clock (a playhead poll that reports each chunk the instant its audio
// begins) only reports a chunk RELIABLY when it is handed to a DRAINED player and pinned to
// "now": when chunks are queued back-to-back (gapless, pinned to a future frame), it reports
// them late / several-at-once, so setBlendshapes fires in bursts and skips chunks' lip-sync —
// the mouth freezes while the audio keeps playing. Device-verified: gapless (0s) and 2-ahead
// both freeze; strictly one-at-a-time with a real silent gap does not. So we release exactly one
// chunk, wait for its audio to finish plus LIVE_CHUNK_GAP_SEC of silence (which drains the
// player), then release the next. The gap is the cost of the native start-clock's drained-only
// reliability; a gapless fix has to happen natively (fire onChunkStarted from the schedule, not
// a playhead poll).
const LIVE_CHUNK_GAP_SEC = 1;

interface PendingChunk {
  seq: number;
  pcmBase64: string;
  frames?: LiveBlendshapeFrame[];
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Turn whatever `getToken` threw into a short line fit for the screen.
 *
 * One message for every cause, deliberately. React Native's fetch reports "Network request
 * failed" identically whether the device is offline, the token server is down, or its address is
 * wrong — so claiming "No internet connection" would be a guess, and wrong whenever the user's
 * connection is fine. "Cannot connect to Mirror" is true in all three cases. The original text
 * survives in `detail` for logs and support.
 */
function tokenFetchError(e: unknown): MirrorAvatarError {
  return {
    code: 'socket_connection_failed',
    message: 'Cannot connect to Mirror',
    recoverable: true,
    detail:
      e instanceof Error ? `${e.name}: ${e.message}` : String(e ?? 'unknown error'),
  };
}

export interface MirrorLiveSessionDeps {
  enqueueAudioChunk: (pcmBase64: string, seq: number) => void;
  stopPlayback: () => void;
  // Latch the morph clock to a chunk's audio-start (the face begins lip-syncing).
  setBlendshapes: (frames: LiveBlendshapeFrame[]) => void;
  // Freeze/neutralize the face. MUST accompany stopPlayback so the mouth doesn't
  // keep animating after audio is cut (barge-in / stop / natural end).
  stopFace: () => void;
  onState: (s: MirrorAvatarState) => void;
  onCaption: (c: { text: string; final: boolean }) => void;
  onError: (e: MirrorAvatarError) => void;
  connectionProvider: MirrorConnectionProvider;
}

// The orchestrator: wires a MirrorLiveTransport to the existing native player +
// Filament AvatarEngine. Owns the audio↔blendshape seq-coupling, barge-in, and
// MirrorAvatarState mapping. Pure — no audio/socket I/O of its own.
export class MirrorLiveSession {
  private pending: PendingChunk[] = [];
  private framesBySeq = new Map<number, LiveBlendshapeFrame[]>();
  private earlyFrames = new Map<number, LiveBlendshapeFrame[]>();
  private unsub: () => void;
  private reconnectAttempts = 0;
  private closed = false;
  // True from the moment a drop is detected until the socket is live again, so the
  // transport's own 'connecting' status maps to the distinct 'reconnecting' state (which
  // raises the veil) rather than the initial-connect 'connecting'.
  private reconnecting = false;
  // Pre-expiry token refresh. Keeps the NEXT reconnect's token valid without churning the
  // live socket. Rescheduled on every successful mint from its expiresInMs.
  private proactiveTimer: ReturnType<typeof setTimeout> | null = null;
  // Holds the scheduled release of the next chunk while the current one plays out + its gap.
  private gapTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private transport: MirrorLiveTransport,
    private deps: MirrorLiveSessionDeps,
  ) {
    this.unsub = transport.onEvent((e) => this.handle(e));
  }

  private handle(e: MirrorLiveEvent): void {
    switch (e.type) {
      case 'audio': {
        // Audio may arrive before OR after its blendshapes; pick up early frames.
        const frames = this.earlyFrames.get(e.seq);
        this.earlyFrames.delete(e.seq);
        const chunk: PendingChunk = {
          seq: e.seq,
          pcmBase64: e.pcmBase64,
          frames,
          timer: setTimeout(() => this.drop(e.seq), COUPLE_DROP_TIMEOUT_MS),
        };
        this.pending.push(chunk);
        this.pump();
        break;
      }
      case 'blendshapes': {
        const chunk = this.pending.find(
          (c) => c.seq === e.seq && c.frames === undefined,
        );
        if (chunk) chunk.frames = e.frames;
        else this.earlyFrames.set(e.seq, e.frames); // frames beat their audio
        this.pump();
        break;
      }
      case 'caption':
        this.deps.onCaption({ text: e.text, final: e.final });
        break;
      case 'control':
        if (e.kind === 'stop_playback') this.bargeIn();
        else if (e.kind === 'ended') {
          this.deps.stopFace();
          this.deps.onState('stopped');
          this.close();
        }
        // 'idle_prompt' is a no-op for parity (the server speaks the nudge)
        break;
      case 'status':
        if (e.status === 'live') {
          this.reconnectAttempts = 0;
          this.reconnecting = false;
          this.deps.onState('listening');
        } else if (e.status === 'connecting' || e.status === 'reconnecting') {
          this.deps.onState(this.reconnecting ? 'reconnecting' : 'connecting');
        } else if (e.status === 'ended') {
          this.deps.onState('stopped');
        } else if (e.status === 'error') {
          void this.scheduleReconnect(e.error);
        }
        break;
    }
  }

  // Release exactly ONE coupled chunk, then schedule the next release after this chunk's audio
  // finishes + LIVE_CHUNK_GAP_SEC of silence (which drains the player so the native start-clock
  // reports the next chunk reliably). Called on every audio/blendshape arrival; if a release is
  // already scheduled it no-ops (the timer chain drains the queue in order).
  private pump(): void {
    if (this.gapTimer) return;
    this.releaseHead();
  }

  private releaseHead(): void {
    const head = this.pending[0];
    if (!head || head.frames === undefined) return; // coupling: wait for this chunk's frames
    this.pending.shift();
    clearTimeout(head.timer);
    this.framesBySeq.set(head.seq, head.frames);
    const dur = head.frames[head.frames.length - 1]?.timestamp ?? 0;
    this.deps.enqueueAudioChunk(head.pcmBase64, head.seq);
    this.gapTimer = setTimeout(
      () => {
        this.gapTimer = null;
        this.releaseHead();
      },
      (dur + LIVE_CHUNK_GAP_SEC) * 1000,
    );
  }

  private drop(seq: number): void {
    const i = this.pending.findIndex(
      (c) => c.seq === seq && c.frames === undefined,
    );
    const stale = i >= 0 ? this.pending[i] : undefined;
    if (stale) {
      clearTimeout(stale.timer);
      this.pending.splice(i, 1); // frames never arrived → drop, never play bare
    }
  }

  // Native player reports a queued chunk actually began playing. Latch its blendshapes so the
  // face begins lip-syncing exactly when the audio does, and ack the server (a barge later
  // truncates the assistant turn to what was actually heard).
  onChunkStarted(seq: number): void {
    const frames = this.framesBySeq.get(seq);
    if (frames && frames.length > 0) {
      this.deps.setBlendshapes(frames);
      this.framesBySeq.delete(seq); // done with this chunk; don't let the map grow
    } else if (frames) {
      this.framesBySeq.delete(seq); // empty frame set → nothing to latch; drop it
    }
    this.transport.sendControl({ type: 'playback', seq });
    this.deps.onState('speaking');
  }

  private bargeIn(): void {
    this.deps.onState('interrupted');
    this.deps.stopPlayback();
    this.deps.stopFace(); // else the face keeps lip-syncing with no audio
    this.clearPending();
    this.deps.onState('listening');
  }

  private clearPending(): void {
    for (const c of this.pending) clearTimeout(c.timer);
    this.pending = [];
    this.framesBySeq.clear();
    this.earlyFrames.clear();
    // Cancel any scheduled next-chunk release: a barge-in / reconnect flushes the player too.
    if (this.gapTimer) {
      clearTimeout(this.gapTimer);
      this.gapTimer = null;
    }
  }

  async start(): Promise<void> {
    this.reconnecting = false;
    this.deps.onState('connecting');
    let token: MirrorConnectionResult | null;
    try {
      token = await this.deps.connectionProvider({ reason: 'start' });
    } catch (e) {
      this.deps.onState('error');
      this.deps.onError(tokenFetchError(e));
      return;
    }
    if (!token) {
      this.deps.onState('error');
      this.deps.onError({
        code: 'socket_connection_failed',
        message: 'Cannot connect to Mirror',
        recoverable: false,
        detail: 'getToken returned no token',
      });
      return;
    }
    // Minting a token is a network round trip the user can hang up inside.
    if (this.closed) return;
    this.transport.setUrlToken?.(token.token);
    this.scheduleProactive(token.expiresInMs);
    this.transport.connect();
  }

  stop(): void {
    this.reconnecting = false;
    this.transport.sendControl({ type: 'stop' });
    this.deps.stopFace();
    this.deps.onState('stopped');
    this.close();
  }

  private async scheduleReconnect(error: unknown): Promise<void> {
    if (this.closed) return;
    // A dropped socket resumes by presenting a fresh (same-session, when the backend
    // supports it) token — the SDK re-invokes getToken with reason:'reconnect' and the
    // stored sessionId. Drop the old socket's half-coupled chunks + native audio backlog
    // + face first, or a stale seq head-of-line-stalls pump() or mis-couples with the
    // resumed stream's frames. Idempotent across retries.
    this.reconnecting = true;
    this.clearProactive(); // the live token is moot; the reconnect mints its own
    this.clearPending();
    this.deps.stopPlayback();
    this.deps.stopFace();
    if ((error as { code?: number } | null)?.code === 4001) {
      this.reconnecting = false;
      this.deps.onState('error');
      this.deps.onError({
        code: 'socket_connection_failed',
        message: 'Session not authorised',
        recoverable: false,
        detail: 'socket closed 4001 — token rejected',
      });
      return;
    }
    const attempt = ++this.reconnectAttempts;
    if (attempt > 10) {
      this.reconnecting = false;
      this.deps.onState('error');
      this.deps.onError({
        code: 'socket_connection_failed',
        message: 'Connection lost',
        recoverable: false,
        detail: `reconnect gave up after ${attempt - 1} attempts`,
      });
      return;
    }
    this.deps.onState('reconnecting');
    const delay = Math.min(8000, 500 * 2 ** (attempt - 1));
    await new Promise((r) => setTimeout(r, delay));
    if (this.closed) return;
    let token: MirrorConnectionResult | null;
    try {
      token = await this.deps.connectionProvider({ reason: 'reconnect' });
    } catch {
      return this.scheduleReconnect(error); // transient — retry the cycle
    }
    if (!token) {
      this.reconnecting = false;
      this.deps.onState('stopped'); // session gone past the window
      return;
    }
    // As in start(): the mint is awaited, and a stop() during it must not reconnect.
    if (this.closed) return;
    this.transport.setUrlToken?.(token.token);
    this.scheduleProactive(token.expiresInMs);
    this.transport.connect();
  }

  // ----- proactive token refresh -----

  private scheduleProactive(expiresInMs?: number): void {
    this.clearProactive();
    if (!expiresInMs || expiresInMs <= 0) return;
    // Half the TTL, floored at 15s so a very short TTL doesn't hammer the backend.
    const delay = Math.max(15000, Math.floor(expiresInMs / 2));
    this.proactiveTimer = setTimeout(() => void this.proactiveRefresh(), delay);
  }

  private clearProactive(): void {
    if (this.proactiveTimer) {
      clearTimeout(this.proactiveTimer);
      this.proactiveTimer = null;
    }
  }

  private async proactiveRefresh(): Promise<void> {
    this.proactiveTimer = null;
    if (this.closed || this.reconnecting) return;
    let token: MirrorConnectionResult | null;
    try {
      token = await this.deps.connectionProvider({ reason: 'proactive' });
    } catch {
      this.scheduleProactive(30000); // transient — try again shortly
      return;
    }
    if (this.closed || this.reconnecting || !token) return;
    // Stage the fresh token for the NEXT reconnect; don't disturb the live socket.
    this.transport.setUrlToken?.(token.token);
    this.scheduleProactive(token.expiresInMs);
  }

  close(): void {
    this.closed = true;
    this.reconnecting = false;
    this.clearProactive();
    // Cut native audio on every teardown (server 'ended' or user stop()) — else a
    // chunk mid-playout keeps talking after the session is gone. clearPending only
    // drops the JS queue; the native backlog needs its own stop.
    this.deps.stopPlayback();
    this.clearPending();
    this.unsub();
    this.transport.close();
  }
}
