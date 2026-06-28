package com.mirror.avatar.audio

/**
 * Maps streamed audio chunks to the frame offset at which they become audible, so the
 * face can be latched to a chunk's REAL playback start rather than a wall-clock guess.
 *
 * Why this exists: the server emits one `audio` chunk per sentence, and TTS latency means
 * the AudioTrack routinely starves between sentences. A wall-clock schedule
 * (`firstEnqueueMs + sum(chunkDurations)`) silently assumes continuous playback, so every
 * underrun pushes the real audio later while the schedule stays put — the face then runs
 * progressively AHEAD of the voice. Frame counts don't have that problem: the playback
 * head simply stops advancing while starved.
 *
 * Feed it [onChunkQueued] in stream order and poll [drain] with the number of frames the
 * track has actually rendered. Pure — no Android types, unit-tested.
 *
 * All methods are safe to call from the write executor and the clock thread concurrently.
 */
class ChunkStartTracker {

  private data class Pending(val seq: Int, val startFrame: Long)

  private val pending = ArrayDeque<Pending>()
  private var framesWritten = 0L
  private var generation = 0

  /** The generation a caller must present to [onChunkQueued]; bumped by [reset]. */
  @Synchronized
  fun generation(): Int = generation

  /**
   * Reserve [frameCount] frames for chunk [seq] at the current end of the stream.
   * Returns false (and records nothing) if [gen] is stale — i.e. a barge-in reset the
   * stream after the caller captured its generation.
   */
  @Synchronized
  fun onChunkQueued(seq: Int, frameCount: Int, gen: Int): Boolean {
    if (gen != generation) return false
    pending.addLast(Pending(seq, framesWritten))
    framesWritten += frameCount
    return true
  }

  /**
   * Chunks whose first frame has been rendered by the time [renderedFrames] frames have
   * played, in stream order. Strictly greater-than: a chunk starting at frame N has begun
   * only once frame N itself is out, so chunk 0 does not "start" before any audio exists.
   */
  @Synchronized
  fun drain(renderedFrames: Long): List<Int> {
    if (pending.isEmpty()) return emptyList()
    var started: MutableList<Int>? = null
    while (pending.isNotEmpty() && pending.first().startFrame < renderedFrames) {
      (started ?: mutableListOf<Int>().also { started = it }).add(pending.removeFirst().seq)
    }
    return started ?: emptyList()
  }

  /**
   * Barge-in / teardown: drop every pending chunk and rebase the stream to frame 0,
   * matching `AudioTrack.flush()` resetting the playback head. Returns the new generation,
   * which invalidates in-flight writes and any chunk they were about to register.
   */
  @Synchronized
  fun reset(): Int {
    pending.clear()
    framesWritten = 0L
    return ++generation
  }

  /** Total frames handed to the track since the last [reset]. Test/diagnostics only. */
  @Synchronized
  fun framesWritten(): Long = framesWritten

  @Synchronized
  fun pendingCount(): Int = pending.size
}
