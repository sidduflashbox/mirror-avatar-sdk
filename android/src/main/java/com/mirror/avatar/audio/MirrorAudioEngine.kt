package com.mirror.avatar.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioTimestamp
import android.media.AudioTrack
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.os.Build
import android.util.Base64
import android.util.Log
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.sqrt

private const val LIVE_SAMPLE_RATE = 16000L
/** Poll cadence of the playback clock. Blendshapes are 60 fps (16.7 ms), so 5 ms is ample. */
private const val LIVE_CLOCK_POLL_MS = 5L
/** Beyond this age an AudioTimestamp means playback stalled — do not extrapolate from it. */
private const val TIMESTAMP_FRESH_NS = 100_000_000L

/**
 * Android counterpart of the iOS MirrorAudioEngine. One voice-communication
 * session captures the mic (for VAD) AND plays the response, with platform AEC
 * (AcousticEchoCanceler + VOICE_COMMUNICATION capture + comm-path AudioTrack) so
 * the avatar's own audio is removed from the mic. Drives the
 * listen -> (speak, then 3s silence) -> play -> barge-in -> listen loop.
 *
 * All state transitions run on the single capture thread (state is confined),
 * mirroring iOS's serial engineQueue; the bridge signals via volatile flags
 * (playNow -> playRequested, stop -> state=IDLE) and the playback thread signals
 * completion via playbackFinished.
 *
 * No React Native types here on purpose: the module owns the bridge, this owns the
 * audio. [Listener] is the seam.
 */
class MirrorAudioEngine(private val context: Context) {

  interface Listener {
    fun onListeningStarted()
    fun onPlaybackStarted()
    fun onPlaybackStopped(reason: String) // "finished" | "bargeIn"
    fun onError(code: String)             // "mic_permission_denied" | "engine_failed" | "bad_audio"
    // Live streaming (WS voice), additive:
    fun onAudioFrame(base64: String)      // mic PCM up (16k mono int16, base64)
    fun onChunkStarted(seq: Int)          // a queued playback chunk began
  }

  var listener: Listener? = null

  private enum class State { IDLE, LISTENING, PLAYING }
  @Volatile private var state: State = State.IDLE
  @Volatile private var playbackFinished = false
  @Volatile private var playRequested = false

  // Barge-in relies on the comm-mode hardware AEC removing the avatar's own audio
  // from the mic, so during playback only the user's voice is heard and can cut in.
  private val bargeInEnabled = true

  private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private var record: AudioRecord? = null
  private var aec: AcousticEchoCanceler? = null
  @Volatile private var track: AudioTrack? = null

  private var captureThread: Thread? = null
  @Volatile private var playbackThread: Thread? = null

  private var detector = UtteranceDetector(silenceMs = 3000.0)

  private var pcm: ShortArray = ShortArray(0)
  private var pcmSampleRate = 16000
  private var pcmChannels = 1

  private val captureSampleRate = 16000
  private var startTimeNanos = 0L
  private var lastLogSec = -1.0

  private fun log(msg: String) { Log.i("MirrorAudio", msg) }

  // ----- public API (called on the RN bridge thread) -----

  fun start(base64: String, silenceMs: Double) {
    if (state != State.IDLE) { log("start ignored — state=$state"); return }
    val data = try { Base64.decode(base64, Base64.DEFAULT) } catch (e: Exception) { null }
    val decoded = data?.let { decodeWav(it) }
    if (decoded == null) { listener?.onError("bad_audio"); return }
    pcm = decoded.samples; pcmSampleRate = decoded.sampleRate; pcmChannels = decoded.channels
    detector = UtteranceDetector(silenceMs = silenceMs)
    try {
      configureSession()
    } catch (e: Exception) {
      log("engine_failed: ${e.message}"); teardown(); listener?.onError("engine_failed"); return
    }
    state = State.LISTENING
    playRequested = false; playbackFinished = false
    listener?.onListeningStarted()
    startCaptureLoop()
  }

  fun stop() {
    if (state == State.IDLE) return
    teardown()
  }

  /** Play the loaded response on demand (the Play button). No-op unless listening. */
  fun playNow() {
    if (state == State.LISTENING) playRequested = true else log("playNow ignored — state=$state")
  }

  /** True while the engine owns the voice-comm session (listen or live capture). */
  val isListening: Boolean
    get() = state != State.IDLE

  // ----- Live streaming (WS voice) — additive; the local-story path above is untouched. -----

  @Volatile private var liveMode = false
  @Volatile private var liveTrack: AudioTrack? = null
  private val liveWriteExec = java.util.concurrent.Executors.newSingleThreadExecutor()
  // Bumped on barge-in to invalidate any chunk still queued in liveWriteExec (the
  // AudioTrack.flush() alone leaves the executor backlog, which would resume playing).
  @Volatile private var liveGen = 0

  // onChunkStarted is driven by the track's own playback clock, NOT a wall-clock schedule:
  // the server sends one chunk per sentence, so the track starves between them and any
  // wall-clock timeline drifts ahead of the real audio by the accumulated underrun. Frame
  // counts can't drift — the playback head simply stops while starved.
  private val chunkStarts = ChunkStartTracker()
  @Volatile private var liveClockThread: Thread? = null
  @Volatile private var liveFlushNanos = 0L
  private val liveTimestamp = AudioTimestamp()

  /** Begin continuous capture: stream mic PCM up (16k mono int16, base64); NO local
   *  VAD/playback (the server owns turn-taking + barge-in). Reuses the comm-mode + AEC. */
  fun startLiveCapture() {
    if (state != State.IDLE) { log("startLiveCapture ignored — state=$state"); return }
    try {
      configureSession()
    } catch (e: Exception) {
      log("live engine_failed: ${e.message}"); teardown(); listener?.onError("engine_failed"); return
    }
    ensureLiveTrack()
    liveMode = true
    liveGen = chunkStarts.reset()
    liveFlushNanos = System.nanoTime()
    state = State.LISTENING
    listener?.onListeningStarted()
    startLiveCaptureLoop()
    startLiveClock()
  }

  fun stopLiveCapture() {
    liveMode = false
    teardown()
  }

  /** Enqueue one streamed PCM chunk (base64 int16 16k mono) into the gapless MODE_STREAM
   *  track. onChunkStarted(seq) fires later, from the playback clock, when this chunk's
   *  first frame is actually rendered — see [startLiveClock].
   *
   *  onChunkStarted MUST NOT fire from the capture loop: JS latches the chunk's blendshapes
   *  on it and acks the server with {"type":"playback",seq}, which is what truncates a
   *  barged-in turn to what the user actually heard. */
  fun enqueueLiveChunk(base64: String, seq: Int) {
    val tr = liveTrack ?: return
    val bytes = try { Base64.decode(base64, Base64.DEFAULT) } catch (e: Exception) { return }
    val gen = liveGen // captured now; a barge-in before this chunk plays bumps liveGen → drop it
    liveWriteExec.execute {
      if (gen != liveGen) return@execute // barged-in since enqueue → don't write stale audio
      // Claim this chunk's slice of the stream BEFORE writing. The write below blocks until
      // the track's ~256 ms buffer drains, by which point the chunk's leading frames are
      // already audible — registering afterwards would report the start far too late.
      // A stale gen loses the race inside the tracker's lock and writes nothing.
      if (!chunkStarts.onChunkQueued(seq, bytes.size / 2, gen)) return@execute
      var off = 0
      while (off < bytes.size) {
        if (gen != liveGen) return@execute // barged-in mid-write → abandon the rest
        val n = try {
          tr.write(bytes, off, bytes.size - off, AudioTrack.WRITE_NON_BLOCKING)
        } catch (_: Exception) { -1 }
        if (n < 0) return@execute
        if (n == 0) { try { Thread.sleep(2) } catch (_: InterruptedException) { return@execute }; continue }
        off += n
      }
    }
  }

  /** Barge-in / stop: drop ALL queued audio, keep capturing. Mirrors iOS's
   *  liveNode.stop()+reset() (which discards every scheduled buffer). Bumping liveGen
   *  invalidates chunk-writes still sitting in liveWriteExec AND pending onChunkStarted
   *  callbacks; flushing only the AudioTrack (as before) left that backlog to resume,
   *  so the avatar kept talking through the interruption.
   *
   *  Safe as a no-op: the server emits stop_playback on essentially every user turn. */
  fun stopLivePlayback() {
    // reset() bumps the generation under the tracker's lock: in-flight writes abandon, and
    // a chunk that already passed the gen check cannot register against the new stream.
    liveGen = chunkStarts.reset()
    liveTrack?.let {
      try { it.pause(); it.flush() } catch (_: Exception) {} // flush() zeroes the playback head
      try { it.play() } catch (_: Exception) {}
    }
    liveFlushNanos = System.nanoTime()
    log("stopLivePlayback: barge-in — dropped backlog (gen=$liveGen)")
  }

  /** One long-lived MODE_STREAM track for the whole call: chunks are written into it
   *  back-to-back, so there is no per-chunk AudioTrack teardown/rebuild (which would
   *  put an audible seam between every chunk). */
  private fun ensureLiveTrack() {
    if (liveTrack != null) return
    val minBuf = AudioTrack.getMinBufferSize(
      16000, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT)
    liveTrack = AudioTrack(
      AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build(),
      AudioFormat.Builder()
        .setSampleRate(16000).setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
        .setEncoding(AudioFormat.ENCODING_PCM_16BIT).build(),
      maxOf(minBuf, 8192),
      AudioTrack.MODE_STREAM,
      AudioManager.AUDIO_SESSION_ID_GENERATE
    ).also { it.play() }
  }

  private fun startLiveCaptureLoop() {
    val rec = record ?: return
    rec.startRecording()
    val buf = ShortArray(1024)
    val t = Thread {
      while (state != State.IDLE && liveMode) {
        val n = rec.read(buf, 0, buf.size)
        if (n <= 0) continue
        val bytes = ByteArray(n * 2)
        val bb = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
        for (i in 0 until n) bb.putShort(buf[i])
        listener?.onAudioFrame(Base64.encodeToString(bytes, Base64.NO_WRAP))
      }
    }
    t.name = "MirrorLiveCapture"; captureThread = t; t.start()
  }

  /** Watches the track's playback position and reports each chunk the instant its first
   *  frame is audible. This is the lip-sync clock — JS latches the chunk's blendshapes here. */
  private fun startLiveClock() {
    val t = Thread {
      while (state != State.IDLE && liveMode) {
        val tr = liveTrack
        if (tr != null) {
          val started = chunkStarts.drain(renderedFrames(tr, chunkStarts.framesWritten()))
          for (seq in started) listener?.onChunkStarted(seq)
        }
        try { Thread.sleep(LIVE_CLOCK_POLL_MS) } catch (_: InterruptedException) { break }
      }
    }
    t.name = "MirrorLiveClock"; liveClockThread = t; t.start()
  }

  /** Frames audible right now, never more than were written.
   *
   *  getTimestamp() reports a frame that was *presented* at a nanoTime, so extrapolating to
   *  now cancels the device's output latency (which playbackHeadPosition still includes).
   *  But only extrapolate from a FRESH timestamp: a stale one means playback stalled, and
   *  pretending it kept flowing is exactly the drift this replaced. The framesWritten clamp
   *  is the backstop — audio that was never written cannot be audible. */
  private fun renderedFrames(tr: AudioTrack, framesWritten: Long): Long {
    try {
      if (tr.getTimestamp(liveTimestamp) && liveTimestamp.nanoTime >= liveFlushNanos) {
        val ageNs = System.nanoTime() - liveTimestamp.nanoTime
        val extra =
          if (ageNs in 1 until TIMESTAMP_FRESH_NS) ageNs * LIVE_SAMPLE_RATE / 1_000_000_000L
          else 0L
        return minOf(liveTimestamp.framePosition + extra, framesWritten)
      }
    } catch (_: Exception) {
      // fall through to the coarser counter
    }
    return minOf(tr.playbackHeadPosition.toLong() and 0xFFFFFFFFL, framesWritten)
  }

  // ----- session setup -----

  private fun configureSession() {
    // Voice-communication session for real hardware AEC: comm mode puts playback on
    // the path the canceller references, and VOICE_COMMUNICATION capture engages it.
    // This yields low mic gain, but the detector's ADAPTIVE threshold handles that
    // (a fixed threshold couldn't — which is why this path looked broken before).
    // AEC removing the avatar is what lets barge-in work without self-triggering.
    audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
    forceSpeakerAndVolume()

    val minBuf = AudioRecord.getMinBufferSize(
      captureSampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT
    )
    val rec = AudioRecord(
      MediaRecorder.AudioSource.VOICE_COMMUNICATION,
      captureSampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT,
      maxOf(minBuf, 4096)
    )
    if (rec.state != AudioRecord.STATE_INITIALIZED) throw IllegalStateException("AudioRecord init failed")
    record = rec
    if (AcousticEchoCanceler.isAvailable()) {
      aec = AcousticEchoCanceler.create(rec.audioSessionId)?.apply { enabled = true }
      log("AEC enabled=${aec?.enabled}")
    } else {
      log("AEC unavailable — relying on sustained-onset VAD")
    }
  }

  /** Comm playback uses the voice-call route/stream (not media), so route it to the
   *  loudspeaker and max its volume — otherwise it's barely audible regardless of the
   *  media-volume slider. */
  private fun forceSpeakerAndVolume() {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        audioManager.availableCommunicationDevices
          .firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
          ?.let { audioManager.setCommunicationDevice(it) }
      } else {
        @Suppress("DEPRECATION") run { audioManager.isSpeakerphoneOn = true }
      }
      val maxVoice = audioManager.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL)
      audioManager.setStreamVolume(AudioManager.STREAM_VOICE_CALL, maxVoice, 0)
    } catch (e: Exception) {
      log("speaker/volume setup failed: ${e.message}")
    }
  }

  // ----- capture thread: mic -> RMS -> VAD -> transitions (all state here) -----

  private fun startCaptureLoop() {
    val rec = record ?: return
    rec.startRecording()
    startTimeNanos = System.nanoTime()
    val buf = ShortArray(1024)
    val t = Thread {
      while (state != State.IDLE) {
        val n = rec.read(buf, 0, buf.size)
        if (n <= 0) continue
        var sum = 0.0
        for (i in 0 until n) { val s = buf[i] / 32768f; sum += (s * s).toDouble() }
        val rms = sqrt(sum / n).toFloat()
        val now = (System.nanoTime() - startTimeNanos) / 1_000_000_000.0
        val event = detector.process(rms, now)

        if (now - lastLogSec >= 0.3) {
          lastLogSec = now
          log("rms=%.4f thr=%.4f state=%s".format(rms, detector.threshold, state.name))
        }

        if (playRequested) { playRequested = false; if (state == State.LISTENING) startPlayback() }
        if (state == State.PLAYING && playbackFinished) finishPlayback()
        when {
          state == State.LISTENING && event == UtteranceDetector.Event.END_OF_UTTERANCE -> startPlayback()
          bargeInEnabled && state == State.PLAYING && event == UtteranceDetector.Event.SPEECH_STARTED -> bargeIn()
        }
      }
    }
    t.name = "MirrorAudioCapture"; captureThread = t; t.start()
  }

  // ----- playback (these run on the capture thread; audio I/O on the playback thread) -----

  private fun startPlayback() {
    state = State.PLAYING
    playbackFinished = false
    detector.reset() // so the first user speech during playback registers as barge-in
    val data = pcm
    val totalFrames = data.size / pcmChannels
    val channelOut = if (pcmChannels == 2) AudioFormat.CHANNEL_OUT_STEREO else AudioFormat.CHANNEL_OUT_MONO
    val pt = Thread {
      val tr = try {
        AudioTrack(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build(),
          AudioFormat.Builder()
            .setSampleRate(pcmSampleRate).setChannelMask(channelOut)
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT).build(),
          maxOf(data.size * 2, 4096),
          AudioTrack.MODE_STATIC,
          AudioManager.AUDIO_SESSION_ID_GENERATE
        )
      } catch (e: Exception) { log("AudioTrack failed: ${e.message}"); playbackFinished = true; return@Thread }
      track = tr
      try {
        tr.write(data, 0, data.size)
        tr.play()
        listener?.onPlaybackStarted() // audio is now starting → JS latches the face
        val clipMs = totalFrames.toLong() * 1000L / pcmSampleRate
        val deadline = System.currentTimeMillis() + clipMs + 500
        while (state == State.PLAYING && tr.playbackHeadPosition < totalFrames &&
               System.currentTimeMillis() < deadline) {
          Thread.sleep(10)
        }
      } catch (_: Exception) {
      } finally {
        try { tr.pause(); tr.flush(); tr.stop() } catch (_: Exception) {}
        tr.release()
        if (track === tr) track = null
        playbackFinished = true // capture thread turns this into finishPlayback() (unless barged-in)
      }
    }
    pt.name = "MirrorAudioPlayback"; playbackThread = pt; pt.start()
  }

  private fun bargeIn() {
    state = State.LISTENING
    try { track?.pause(); track?.flush() } catch (_: Exception) {} // playback thread releases the track
    // Keep the detector's "spoken" state: the barge-in speech IS the user's new
    // utterance, so 3s of silence after they finish replays the response.
    listener?.onPlaybackStopped("bargeIn")
    listener?.onListeningStarted()
  }

  private fun finishPlayback() {
    state = State.LISTENING
    detector.reset()
    listener?.onPlaybackStopped("finished")
    listener?.onListeningStarted()
  }

  // ----- teardown -----

  private fun teardown() {
    state = State.IDLE // signals the threads to exit
    liveClockThread?.interrupt()
    try { captureThread?.join(500) } catch (_: InterruptedException) {}
    try { playbackThread?.join(500) } catch (_: InterruptedException) {}
    try { liveClockThread?.join(500) } catch (_: InterruptedException) {}
    captureThread = null; playbackThread = null; liveClockThread = null
    try { record?.stop() } catch (_: Exception) {}
    record?.release(); record = null
    aec?.release(); aec = null
    track?.let { tr -> try { tr.pause(); tr.flush(); tr.stop() } catch (_: Exception) {}; tr.release() }
    track = null
    liveGen = chunkStarts.reset()
    liveTrack?.let { tr -> try { tr.pause(); tr.flush(); tr.stop() } catch (_: Exception) {}; tr.release() }
    liveTrack = null
    audioManager.mode = AudioManager.MODE_NORMAL
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      audioManager.clearCommunicationDevice()
    } else {
      @Suppress("DEPRECATION") run { audioManager.isSpeakerphoneOn = false }
    }
  }

  /** Final teardown for module destruction — after this the engine is not reusable. */
  fun release() {
    liveMode = false
    teardown()
    liveWriteExec.shutdownNow()
    listener = null
  }

  // ----- WAV decode (PCM16 LE) -----

  private data class DecodedWav(val samples: ShortArray, val sampleRate: Int, val channels: Int)

  private fun decodeWav(bytes: ByteArray): DecodedWav? {
    return try {
      if (bytes.size < 44) return null
      val bb = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
      bb.position(8)
      val wave = ByteArray(4); bb.get(wave)
      if (String(wave) != "WAVE") return null
      var sampleRate = 16000; var channels = 1; var bits = 16
      var dataOffset = -1; var dataLen = 0
      var pos = 12
      while (pos + 8 <= bytes.size) {
        bb.position(pos)
        val id = ByteArray(4); bb.get(id)
        val size = bb.int
        when (String(id)) {
          "fmt " -> {
            val p = pos + 8
            bb.position(p + 2); channels = bb.short.toInt()
            sampleRate = bb.int
            bb.position(p + 14); bits = bb.short.toInt()
          }
          "data" -> { dataOffset = pos + 8; dataLen = size }
        }
        pos += 8 + size + (size and 1) // chunks are word-aligned
      }
      if (bits != 16 || dataOffset < 0) return null
      val count = minOf(dataLen, bytes.size - dataOffset) / 2
      val samples = ShortArray(count)
      bb.position(dataOffset)
      for (i in 0 until count) samples[i] = bb.short
      DecodedWav(samples, sampleRate, channels)
    } catch (e: Exception) {
      null
    }
  }
}
