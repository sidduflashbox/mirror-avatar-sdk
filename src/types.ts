export type MirrorAvatarState =
  | 'idle'
  | 'connecting'
  | 'reconnecting'
  | 'ready'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'stopped'
  | 'error';

export type MirrorAudioFormat = 'pcm16' | 'aac' | 'opus';

export type MirrorBlendshapeName =
  | 'browDown_L'
  | 'browDown_R'
  | 'browInnerUp'
  | 'browOuterUp_L'
  | 'browOuterUp_R'
  | 'cheekPuff'
  | 'cheekSquint_L'
  | 'cheekSquint_R'
  | 'eyeBlink_L'
  | 'eyeBlink_R'
  | 'eyeLookDown_L'
  | 'eyeLookDown_R'
  | 'eyeLookIn_L'
  | 'eyeLookIn_R'
  | 'eyeLookOut_L'
  | 'eyeLookOut_R'
  | 'eyeLookUp_L'
  | 'eyeLookUp_R'
  | 'eyeSquint_L'
  | 'eyeSquint_R'
  | 'eyeWide_L'
  | 'eyeWide_R'
  | 'jawForward'
  | 'jawLeft'
  | 'jawOpen'
  | 'jawRight'
  | 'mouthClose'
  | 'mouthDimple_L'
  | 'mouthDimple_R'
  | 'mouthFrown_L'
  | 'mouthFrown_R'
  | 'mouthFunnel'
  | 'mouthLeft'
  | 'mouthLowerDown_L'
  | 'mouthLowerDown_R'
  | 'mouthPress_L'
  | 'mouthPress_R'
  | 'mouthPucker'
  | 'mouthRight'
  | 'mouthRollLower'
  | 'mouthRollUpper'
  | 'mouthShrugLower'
  | 'mouthShrugUpper'
  | 'mouthSmile_L'
  | 'mouthSmile_R'
  | 'mouthStretch_L'
  | 'mouthStretch_R'
  | 'mouthUpperUp_L'
  | 'mouthUpperUp_R'
  | 'noseSneer_L'
  | 'noseSneer_R'
  | 'tongueOut';

export type MirrorBlendshapeFrame = {
  responseId: string;
  audioTimeMs: number;
  sequence: number;
  blendshapes: Partial<Record<MirrorBlendshapeName, number>>;
};

// Session configuration. The wire format is fixed at int16 / 16 kHz mono in both directions.
export type MirrorSessionConfig = {
  protocolVersion?: number;
  assistantId?: string;
  userId?: string;
  locale?: string;
  audioInputFormat?: MirrorAudioFormat;
  audioOutputFormat?: MirrorAudioFormat;
  inputSampleRate?: number;
  outputSampleRate?: number;
  metadata?: Record<string, string>;
};

export type MirrorAvatarErrorCode =
  | 'permission_denied'
  | 'invalid_config'
  | 'model_load_failed'
  | 'socket_connection_failed'
  | 'socket_protocol_error'
  | 'audio_capture_failed'
  | 'audio_playback_failed'
  | 'renderer_failed'
  | 'unknown';

export type MirrorAvatarError = {
  code: MirrorAvatarErrorCode;
  /** Human-readable and safe to show a user. Never empty. */
  message: string;
  recoverable: boolean;
  nativeCode?: string;
  /**
   * The underlying cause, for logs and support — e.g. the thrown `getToken` error. Never shown
   * by the SDK's own UI, which renders `message`.
   */
  detail?: string;
};

// ── Live session facade (mirror-avatar-sdk public API) ──────────────────────
export type MirrorSessionState = MirrorAvatarState;

export interface MirrorCaption {
  text: string;
  final: boolean;
}

/** The view supplies its shared-value writers so the session can drive lip-sync. */
export interface MirrorViewBinding {
  setBlendshapes: (
    frames: import('./live/protocol').LiveBlendshapeFrame[],
  ) => void;
  stopFace: () => void;
}

/** Why the SDK is asking the consumer to mint a token. */
export type MirrorTokenReason = 'start' | 'reconnect' | 'proactive';

/** Passed to {@link MirrorSessionOptions.getToken} so the consumer's backend can mint the
 *  right session token. `agentId` / `language` are the values given to `createSession`;
 *  `sessionId` is the server session captured from a prior token result, echoed back on
 *  `reconnect` / `proactive` so the backend can RESUME the same session (the agent keeps its
 *  conversation) instead of minting a fresh one. */
export interface MirrorTokenContext {
  reason: MirrorTokenReason;
  agentId?: string;
  language?: string;
  sessionId?: string;
}

/** A richer `getToken` return. Returning a bare string is still supported (token only, no
 *  resume, no proactive refresh). */
export interface MirrorTokenResult {
  token: string;
  /** Server session id. The SDK stores it and echoes it back on reconnect for resume. */
  sessionId?: string;
  /** Token lifetime in ms. Drives a proactive re-mint at ~half-TTL so a reconnect never
   *  presents an expired token. Omit to disable proactive refresh. */
  expiresInMs?: number;
}

export interface MirrorSessionOptions {
  /** Which agent to talk to. Forwarded to `getToken` so YOUR backend selects it at session
   *  init. The SDK is one-agent-per-session; change it by creating a new session. */
  agentId?: string;
  /** Language for the session (server code / BCP-47), forwarded to `getToken` for init.
   *  Defaults to `'en'` when omitted, so `getToken` always receives a concrete language. */
  language?: string;
  /** Mint a short-lived session token against YOUR backend (which holds the API key). Called
   *  on start, on every reconnect (with `sessionId` set, for resume), and proactively before
   *  the token expires. Return the token string, or a {@link MirrorTokenResult} to enable
   *  session resume + proactive refresh. */
  getToken?: (ctx: MirrorTokenContext) => Promise<string | MirrorTokenResult>;
  onStateChange?: (state: MirrorSessionState) => void;
  onError?: (error: MirrorAvatarError) => void;
  onCaption?: (caption: MirrorCaption) => void;
}
