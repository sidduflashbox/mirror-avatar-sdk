/**
 * Root-mean-square level of one mic frame, ~0..0.3 for speech.
 *
 * Raw per-frame RMS, no smoothing (the waveform owns the attack/release). We already decode
 * every mic frame to an ArrayBuffer to put it on the wire, so this costs one pass over 320
 * int16 samples, ~50x/sec. No native change is needed for the meter.
 */
export function rmsFromPcm16(buffer: ArrayBuffer): number {
  const samples = new Int16Array(buffer);
  const n = samples.length;
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const s = samples[i]! / 32768;
    sum += s * s;
  }
  return Math.sqrt(sum / n);
}
