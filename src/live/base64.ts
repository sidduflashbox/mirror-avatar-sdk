/* eslint-disable no-bitwise */
// Decode base64 → ArrayBuffer for streaming mic PCM up to the server (no atob dependency).
const B64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const clean = b64.replace(/=+$/, '');
  const bytes = new Uint8Array((clean.length * 6) >> 3);
  let bits = 0;
  let nbits = 0;
  let p = 0;
  for (let i = 0; i < clean.length; i++) {
    const v = B64_CHARS.indexOf(clean.charAt(i));
    if (v < 0) continue;
    bits = (bits << 6) | v;
    nbits += 6;
    if (nbits >= 8) {
      nbits -= 8;
      bytes[p++] = (bits >> nbits) & 0xff;
    }
  }
  return bytes.buffer;
}
