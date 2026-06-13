export type MirrorLiveStatus =
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'ended'
  | 'error';

// One frame of avatar animation — timestamp (seconds, relative to the chunk's
// audio start) + morph-target name → influence. This is the server's wire frame
// AND exactly what the Filament AvatarEngine / bakeClip consume (StoryFrame).
export interface LiveBlendshapeFrame {
  timestamp: number;
  blendshapes: Record<string, number>;
}

export type MirrorLiveEvent =
  | { type: 'audio'; seq: number; pcmBase64: string }
  | { type: 'blendshapes'; seq: number; frames: LiveBlendshapeFrame[] }
  | { type: 'caption'; text: string; final: boolean }
  | { type: 'control'; kind: 'stop_playback' | 'ended' | 'idle_prompt' }
  | { type: 'status'; status: MirrorLiveStatus; error?: unknown };

export type ClientControl = { type: 'stop' } | { type: 'playback'; seq: number };

export function encodeClientControl(msg: ClientControl): string {
  return JSON.stringify(msg);
}

const KNOWN_CONTROL = new Set(['stop_playback', 'ended', 'idle_prompt']);

// Parse a text WS frame into a MirrorLiveEvent (audio/blendshapes/caption/control),
// or null if unrecognized. Tolerant: never throws.
export function parseServerMessage(data: string): MirrorLiveEvent | null {
  let obj: any;
  try {
    obj = JSON.parse(data);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  switch (obj.type) {
    case 'audio':
      if (typeof obj.seq === 'number' && typeof obj.audio_b64 === 'string') {
        return { type: 'audio', seq: obj.seq, pcmBase64: obj.audio_b64 };
      }
      return null;
    case 'blendshapes':
      if (typeof obj.seq === 'number' && Array.isArray(obj.frames)) {
        return { type: 'blendshapes', seq: obj.seq, frames: obj.frames };
      }
      return null;
    case 'caption':
      if (typeof obj.text === 'string' && typeof obj.final === 'boolean') {
        return { type: 'caption', text: obj.text, final: obj.final };
      }
      return null;
    case 'control':
      if (typeof obj.kind === 'string' && KNOWN_CONTROL.has(obj.kind)) {
        return { type: 'control', kind: obj.kind };
      }
      return null;
    default:
      return null;
  }
}
