import type { MirrorLiveEvent, ClientControl } from './protocol';

// What the connection provider hands back. `expiresInMs` (when known) lets the session
// schedule a proactive re-mint before the token expires. `sessionId` capture lives one
// layer up (MirrorSession injects it into the consumer's getToken ctx for resume), so it
// is not carried here.
export interface MirrorConnectionResult {
  token: string;
  expiresInMs?: number;
}

// Consumer implements this against THEIR backend (which holds the API key and
// calls /v1/sessions/init + /auth/refresh). The SDK never sees the API key.
// `proactive` is a pre-expiry refresh: rotate the token for the NEXT reconnect without
// tearing down the live socket.
export type MirrorConnectionProvider = (
  ctx: { reason: 'start' | 'reconnect' | 'proactive' },
) => Promise<MirrorConnectionResult | null>;

export interface MirrorLiveTransport {
  connect(): void;
  sendAudioFrame(pcm: ArrayBuffer): void;
  sendControl(msg: ClientControl): void;
  close(): void;
  onEvent(listener: (e: MirrorLiveEvent) => void): () => void; // returns unsubscribe
  // The real socket builds its URL from this token; an injected transport may ignore it.
  setUrlToken?(token: string): void;
}
