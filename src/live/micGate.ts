/**
 * The PCM frame to send upstream this tick.
 *
 * While muted this is a **silent** (zero-filled) frame of the same size — not nothing.
 * The server's turn detector is frame-driven: its VAD only advances on audio it actually
 * receives, and it has to see the trailing silence to fire end-of-turn. Withholding frames
 * entirely strands an open turn, so muting straight after speaking leaves the endpointer
 * waiting forever and the agent never replies until the mic is unmuted and real audio flows
 * again. Sending silence closes the turn without putting a single sample of the user's real
 * post-mute audio on the wire.
 */
export function outboundMicFrame(muted: boolean, frame: ArrayBuffer): ArrayBuffer {
  // A fresh ArrayBuffer is zero-filled per spec, which is exactly a silent PCM frame.
  return muted ? new ArrayBuffer(frame.byteLength) : frame;
}
