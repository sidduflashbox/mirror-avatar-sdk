import type { MirrorLiveTransport } from './MirrorLiveTransport';
import type { MirrorLiveEvent, ClientControl } from './protocol';
import { encodeClientControl, parseServerMessage } from './protocol';

// The real socket. Matches the Mirror server wire format:
// binary int16 PCM up + JSON control up; JSON events down.
export class WebSocketLiveTransport implements MirrorLiveTransport {
  // RN provides `WebSocket` at runtime; typed loosely so tsc doesn't clash the DOM
  // vs @types/node (undici) WebSocket declarations.
  private ws: any = null;
  private token: string | null = null;
  private listeners = new Set<(e: MirrorLiveEvent) => void>();

  constructor(private baseUrl: string) {} // e.g. wss://host/v1/ws/session

  setUrlToken(token: string): void {
    this.token = token;
  }

  connect(): void {
    const url = `${this.baseUrl}?token=${encodeURIComponent(this.token ?? '')}`;
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    this.dispatch({ type: 'status', status: 'connecting' });
    ws.onopen = () => this.dispatch({ type: 'status', status: 'live' });
    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return; // inbound binary not expected
      const e = parseServerMessage(ev.data);
      if (e) this.dispatch(e);
    };
    ws.onerror = () => {}; // onclose decides retry
    ws.onclose = (ev) =>
      this.dispatch({ type: 'status', status: 'error', error: { code: ev.code } });
  }

  sendAudioFrame(pcm: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(pcm);
  }

  sendControl(msg: ClientControl): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(encodeClientControl(msg));
    }
  }

  close(): void {
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null as any;
      try {
        ws.close();
      } catch {
        /* already closing */
      }
    }
  }

  onEvent(listener: (e: MirrorLiveEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private dispatch(e: MirrorLiveEvent): void {
    for (const l of [...this.listeners]) l(e);
  }
}
