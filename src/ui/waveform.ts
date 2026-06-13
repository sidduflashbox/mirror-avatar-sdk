// The mic-level equalizer, as pure math.
// Kept out of the component so the feel — attack, release, edge taper, wobble — is
// unit-tested rather than eyeballed.

/** RMS (~0..0.3 for speech) → 0..1. `Math.min(1, level * 7.5)`. */
export function normalizeLevel(rms: number): number {
  return Math.min(1, Math.max(0, rms * 7.5));
}

/** Fast attack, slow release: `target > s ? target*0.65 + s*0.35 : s*0.88`. */
export function smoothLevel(previous: number, target: number): number {
  return target > previous ? target * 0.65 + previous * 0.35 : previous * 0.88;
}

/** Smoothstep over the outer 40% of each side, so bars fade well into the row. */
export function edgeFade(x: number): number {
  const u = Math.min(1, Math.max(0, x / 0.4));
  return u * u * (3 - 2 * u);
}

/** Combined taper for a bar at normalized position `nx` ∈ [0,1]. */
export function edgeAt(nx: number): number {
  return edgeFade(nx) * edgeFade(1 - nx);
}

/** Flowing per-bar height so the row reads as an organic envelope. */
export function wobble(nx: number, t: number): number {
  return (
    0.45 +
    0.3 * Math.sin(nx * 7 * Math.PI + t * 1.1) +
    0.25 * Math.sin(nx * 13 * Math.PI - t * 0.75)
  );
}

/** Bar height in px. `amp = 5 + level*(H-6)`; `h = max(1, edge*amp*max(0.08, wob))`. */
export function barHeight(
  nx: number,
  smoothed: number,
  t: number,
  waveHeight: number,
): number {
  const amp = 5 + smoothed * (waveHeight - 6);
  const edge = edgeAt(nx);
  if (edge <= 0.01) return 0; // skip these bars entirely
  return Math.max(1, edge * amp * Math.max(0.08, wobble(nx, t)));
}
