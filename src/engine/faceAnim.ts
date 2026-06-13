// Single source of tunables + pure helpers for procedural idle animation. Every
// helper carries the 'worklet' directive so the Filament render callback can call
// it on the render thread; in Jest the directive is a no-op string literal, so
// these are plain, unit-testable functions.
import { buildBaseNameIndex } from './bakeClip';

export type FaceAnimConfig = {
  blinkDurationSec: number;
  blinkMinIntervalSec: number;
  blinkMaxIntervalSec: number;
  breathRate: number;
  breathAmp: number;
  restingSmile: number;
  headPitchRange: number;
  headYawRange: number;
  headRollRange: number;
  headSwayMinIntervalSec: number;
  headSwayMaxIntervalSec: number;
  headEaseBase: number;
  visemeTailSec: number;
  /**
   * Seconds to start a chunk's viseme clip AHEAD of its latch, to cancel the fixed latency
   * between a chunk's audio actually starting and the face latching it (native start-clock poll
   * → JS bridge → bakeClip → next render frame). Positive = advance the mouth (fixes a mouth that
   * TRAILS the voice); negative = delay it (mouth that LEADS). Tune on device to taste.
   */
  lipsyncLeadSec: number;
  mouthGain: Record<string, number>;
};

export const DEFAULT_FACE_ANIM_CONFIG: FaceAnimConfig = {
  blinkDurationSec: 0.28,
  blinkMinIntervalSec: 2.5,
  blinkMaxIntervalSec: 6.0,
  breathRate: 0.8,
  breathAmp: 0.06,
  restingSmile: 0.2,
  headPitchRange: 0.12,
  headYawRange: 0.1,
  headRollRange: 0.04,
  headSwayMinIntervalSec: 1.0,
  headSwayMaxIntervalSec: 3.0,
  headEaseBase: 0.02,
  visemeTailSec: 0.15,
  lipsyncLeadSec: 0.08, // ~one render frame + bridge; advance the mouth to meet the voice
  mouthGain: { mouthClose: 0.3, jawOpen: 1.6 },
};

// Idle-state array layout — FIXED indices. NEVER read `.length` in a worklet
// (worklets-core strips it); use IDLE_LEN.
export const IDLE_LAST_PASSED = 0;
export const IDLE_BLINK_START = 1; // -1 = not currently blinking
export const IDLE_NEXT_BLINK_AT = 2;
export const IDLE_NEXT_SHIFT_AT = 3;
export const IDLE_TGT_PITCH = 4;
export const IDLE_TGT_YAW = 5;
export const IDLE_TGT_ROLL = 6;
export const IDLE_CUR_PITCH = 7;
export const IDLE_CUR_YAW = 8;
export const IDLE_CUR_ROLL = 9;
export const IDLE_SEED = 10;
export const IDLE_LEN = 11;

export function initIdleState(seed: number): number[] {
  const s = new Array(IDLE_LEN).fill(0) as number[];
  s[IDLE_BLINK_START] = -1;
  s[IDLE_NEXT_BLINK_AT] = 2; // first blink ~2s after start
  s[IDLE_NEXT_SHIFT_AT] = 1;
  s[IDLE_SEED] = (seed >>> 0) || 1;
  return s;
}

// LCG PRNG — deterministic, worklet-safe (no Math.random / Math.imul).
export function prngNext(seed: number): { rand: number; seed: number } {
  'worklet';
  const next = (seed * 1664525 + 1013904223) >>> 0;
  return { rand: next / 4294967296, seed: next };
}

// Eyelid weight for a blink that began `tSince` seconds ago (sinusoidal close+open).
export function blinkEnvelope(tSince: number, durationSec: number): number {
  'worklet';
  if (tSince < 0 || tSince >= durationSec) return 0;
  return Math.sin((tSince / durationSec) * Math.PI);
}

// Idle breathing signal; feed the positive half into jawOpen.
export function breath(t: number, rate: number, amp: number): number {
  'worklet';
  return Math.sin(t * rate) * amp;
}

// Frame-rate-independent ease of `current` toward `target`.
export function easeToward(
  current: number,
  target: number,
  easeBase: number,
  delta: number,
): number {
  'worklet';
  const lerp = 1 - Math.pow(easeBase, delta);
  return current + (target - current) * lerp;
}

export type IdleMorphs = {
  blinkL: number;
  blinkR: number;
  jawOpen: number;
  smileL: number;
  smileR: number;
};

// Resolve the morph indices the idle layer drives, using the same digit-strip
// name matching as bakeClip. -1 means the avatar lacks that morph.
export function resolveIdleMorphs(morphTargetNames: string[]): IdleMorphs {
  const idx = buildBaseNameIndex(morphTargetNames);
  const g = (n: string): number => idx[n] ?? -1;
  return {
    blinkL: g('eyeBlinkLeft'),
    blinkR: g('eyeBlinkRight'),
    jawOpen: g('jawOpen'),
    smileL: g('mouthSmileLeft'),
    smileR: g('mouthSmileRight'),
  };
}
