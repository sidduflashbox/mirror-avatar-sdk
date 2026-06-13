// Pure frame-selection math for a baked clip. Carries the 'worklet' directive so the
// Filament render worklet can call it on the render thread; in Jest the directive is
// just a string literal (no-op). Keeping it here (not inlined in the worklet) lets us
// unit-test the timing — the swap logic that decides which chunk-frame to show.
export type ClipSample = { kind: 'end' } | { kind: 'frame'; index: number };

// `holdSeconds` keeps the clip on its LAST frame for a moment after it ends, instead
// of neutralizing immediately. For 1s streamed chunks this bridges the gap to the next
// chunk's latch so the face doesn't flash to rest between chunks; it only settles to
// neutral ('end') once idle past the hold window (e.g. a reply finished).
export function sampleClip(
  frameCount: number,
  fps: number,
  elapsedSeconds: number,
  holdSeconds: number = 0,
): ClipSample {
  'worklet';
  if (frameCount <= 1 || fps <= 0) return { kind: 'end' };
  const dt = 1 / fps;
  const duration = (frameCount - 1) / fps;
  if (elapsedSeconds >= duration + holdSeconds) return { kind: 'end' };
  let f = Math.floor(elapsedSeconds / dt);
  if (f < 0) f = 0;
  else if (f >= frameCount) f = frameCount - 1; // clamp = hold last frame during the hold window
  return { kind: 'frame', index: f };
}
