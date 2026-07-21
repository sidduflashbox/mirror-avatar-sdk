import AVFoundation
import Foundation
import QuartzCore // CACurrentMediaTime

protocol MirrorAudioEngineDelegate: AnyObject {
  func audioEngineDidStartListening()
  func audioEngineDidStartPlayback()
  func audioEngineDidStopPlayback(reason: String) // "finished" | "bargeIn"
  func audioEngineDidError(code: String)
  // Live streaming (WS voice), additive:
  func audioEngineDidCaptureFrame(base64: String) // mic PCM up (16k mono int16, base64)
  func audioEngineDidStartChunk(seq: Int)         // a queued playback chunk began
}

/// One AVAudioEngine that captures the mic (for VAD) AND plays the response, with
/// voice-processing AEC so the avatar's own audio is removed from the mic input.
/// Drives the listen → (speak, then 3s silence) → play → barge-in → listen loop.
final class MirrorAudioEngine {
  weak var delegate: MirrorAudioEngineDelegate?

  /// All engine + VAD-state work runs here, OFF the main thread. Configuring an
  /// AVAudioEngine with voice processing on the main thread stalls the first-ever
  /// setup (the audio-server XPC handshake) and freezes the UI; a serial queue
  /// fixes both and keeps `state` access single-threaded.
  private let engineQueue = DispatchQueue(label: "com.mirror.audio.engine")

  private let engine = AVAudioEngine()
  private let player = AVAudioPlayerNode()
  private var detector = UtteranceDetector(silenceMs: 3000)
  private var responseBuffer: AVAudioPCMBuffer?
  private var startTime: Double = 0
  private var lastLogTime: Double = -1
  // Cold-start recovery: the first-ever voice-processing engine.start() can yield a
  // dead session (no mic buffers arrive). If none come shortly after starting, we
  // restart once — replicating the manual "stop then start" that reliably works.
  private var micReceived = false
  private var didColdRetry = false

  private enum State { case idle, listening, playing }
  private var state: State = .idle

  private func log(_ msg: String) { NSLog("%@", "[MirrorAudio] \(msg)") }

  // MARK: - Public API

  func start(base64: String, silenceMs: Double) {
    log("start() engine=\(ObjectIdentifier(self)) silenceMs=\(silenceMs) base64Len=\(base64.count)")
    guard let data = Data(base64Encoded: base64) else {
      log("bad base64")
      delegate?.audioEngineDidError(code: "bad_audio")
      return
    }
    AVAudioSession.sharedInstance().requestRecordPermission { [weak self] granted in
      guard let self = self else { return }
      self.engineQueue.async {
        self.log("mic permission granted=\(granted)")
        guard granted else {
          self.delegate?.audioEngineDidError(code: "mic_permission_denied")
          return
        }
        guard self.state == .idle else {
          self.log("start ignored — already active")
          return
        }
        self.detector = UtteranceDetector(silenceMs: silenceMs)
        self.responseBuffer = Self.decodeWavToBuffer(data: data)
        guard let buf = self.responseBuffer else {
          self.log("decode FAILED")
          self.delegate?.audioEngineDidError(code: "bad_audio")
          return
        }
        self.log("decoded WAV frames=\(buf.frameLength) sr=\(buf.format.sampleRate) ch=\(buf.format.channelCount)")
        self.didColdRetry = false
        self.configureAndStart()
      }
    }
  }

  func stop() {
    engineQueue.async { [weak self] in
      guard let self = self else { return }
      self.player.stop()
      self.engine.inputNode.removeTap(onBus: 0)
      self.engine.stop()
      self.state = .idle
    }
  }

  /// Play the loaded response on demand (the Play button), through the SAME running
  /// engine + session. A standalone AVAudioPlayer can't share the active voice-
  /// processing session, so it stays silent while we're listening — routing the tap
  /// here reuses the playback path that already works. No-op unless we're idle-
  /// listening (a tap mid-playback is ignored).
  func playNow() {
    engineQueue.async { [weak self] in
      guard let self = self else { return }
      guard self.state == .listening else {
        self.log("playNow ignored — state=\(self.state)")
        return
      }
      self.playResponse()
    }
  }

  // MARK: - Live streaming (WS voice) — additive; the local-story path above is untouched.

  /// Second player node for gapless streamed chunks (the local-story `player` stays
  /// dedicated to the story path). Attached to the SAME voice-processing engine so
  /// AEC still removes the avatar from the mic during full-duplex.
  private let liveNode = AVAudioPlayerNode()
  private var liveConverter: AVAudioConverter? // mic hardware format → 16k mono int16
  // Playback buffers are float32 (what the mixer wants); the wire is int16.
  private let livePlayFormat = AVAudioFormat(
    commonFormat: .pcmFormatFloat32, sampleRate: 16000, channels: 1, interleaved: false)!
  private let liveWireFormat = AVAudioFormat(
    commonFormat: .pcmFormatInt16, sampleRate: 16000, channels: 1, interleaved: true)!
  private var liveMode = false

  // MARK: chunk-start tracking
  //
  // onChunkStarted(seq) must fire when a chunk's audio actually begins: JS latches that
  // chunk's blendshapes on it and acks the server with {"type":"playback",seq}, which is what
  // truncates a barged-in turn to what the user really heard.
  //
  // The previous scheme fired it from a wall clock (`liveStartHost + cumulative duration`,
  // via asyncAfter). That assumes playback never stops. The server sends one chunk per
  // sentence, so the node starves between them; real audio slides later, the schedule does
  // not, and the face drifts progressively ahead of the voice.
  //
  // Note that iOS cannot use Android's fix directly. `AVAudioPlayerNode.playerTime` is a
  // LINEAR clock — it keeps advancing while the node starves — unlike Android's
  // `playbackHeadPosition`, which counts rendered frames and stalls. So instead of reading
  // the clock, we PIN each chunk to it: every buffer is scheduled at an explicit frame, and
  // after a starve that frame is rebased to "now". Audio and event then share one timeline.
  // This is the Web Audio idiom `startAt = max(ctx.currentTime, nextStartTime)`.
  private struct PendingChunkStart {
    let seq: Int
    let startFrame: AVAudioFramePosition
    let gen: Int
  }
  /// Frame at which the next chunk is scheduled, on the player's timeline. Reset by barge-in.
  private var liveNextStartFrame: AVAudioFramePosition = 0
  private var livePendingStarts: [PendingChunkStart] = []
  /// Bumped on barge-in so a chunk queued before it cannot report a start after it.
  private var liveGen = 0
  private var liveClock: DispatchSourceTimer?
  /// Poll cadence. Blendshapes are 60 fps (16.7 ms), so 5 ms is ample.
  private let liveClockIntervalMs = 5

  /// Settled exactly once, by the first `configureAndStartLive` outcome: `nil` on success, a
  /// native error code on failure. Held so the caller can await the real result — the cold-start
  /// retry re-enters `configureAndStartLive`, and a failure there must not settle it twice.
  private var liveStartCompletion: ((String?) -> Void)?

  /// Begin continuous capture for a live session: stream mic PCM up (16k mono int16,
  /// base64) via the delegate; do NOT run the local VAD/playback (the server owns
  /// turn-taking + barge-in). Reuses the exact voice-processing + AEC config.
  ///
  /// `completion` reports whether the mic actually opened, so the caller can refuse to start a
  /// session it cannot be heard in. It fires on the engine queue.
  func startLiveCapture(completion: @escaping (String?) -> Void) {
    // Mirror the local start() path: this is often the first mic access, so request
    // permission; and configure with a cold-start retry — the first-ever voice-
    // processing engine.start() can yield a dead session with no mic buffers.
    AVAudioSession.sharedInstance().requestRecordPermission { [weak self] granted in
      guard let self = self else { return }
      self.engineQueue.async {
        self.log("live mic permission granted=\(granted)")
        guard granted else {
          completion("mic_permission_denied")
          return
        }
        guard self.state == .idle else { completion(nil); return } // already capturing
        self.didColdRetry = false
        self.liveStartCompletion = completion
        self.observeInterruptions()
        self.configureAndStartLive()
      }
    }
  }

  /// Fires the pending start completion once, if there is one. Returns true when it consumed the
  /// outcome, so the caller knows whether to fall back to the error event instead.
  @discardableResult
  private func settleLiveStart(_ code: String?) -> Bool {
    guard let completion = liveStartCompletion else { return false }
    liveStartCompletion = nil
    completion(code)
    return true
  }

  /// Separate "the mic is held by something else" from a genuine engine fault. The first is
  /// expected (a call, a meeting app) and worth saying plainly; the second is a bug.
  private static func errorCode(for error: Error) -> String {
    let ns = error as NSError
    // Matched on the code alone: AVAudioSession and AudioUnit failures are OSStatus four-char
    // codes, distinctive enough that the domain adds nothing — and Swift does not expose a
    // constant for the AVAudioSession error domain. `Int(...)` because ErrorCode's raw type
    // differs across SDK versions.
    let busy: Set<Int> = [
      Int(AVAudioSession.ErrorCode.isBusy.rawValue),
      Int(AVAudioSession.ErrorCode.cannotStartRecording.rawValue),
      Int(AVAudioSession.ErrorCode.cannotInterruptOthers.rawValue),
      // kAudioUnitErr_CannotDoInCurrentContext — what setVoiceProcessingEnabled returns when
      // another process already owns the voice-processing unit.
      -66637,
    ]
    return busy.contains(ns.code) ? "mic_unavailable" : "engine_failed"
  }

  // MARK: - Interruptions

  /// Block-based rather than selector-based: this is a plain Swift class, not an NSObject
  /// subclass, so it has no @objc members to point a #selector at.
  private var interruptionObserver: NSObjectProtocol?

  /// Watch for the system handing the audio session to something else — an incoming call, a
  /// meeting app taking the mic. Without this the capture dies silently mid-session and the UI
  /// keeps showing a live call nobody can be heard in.
  private func observeInterruptions() {
    guard interruptionObserver == nil else { return }
    interruptionObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.interruptionNotification,
      object: AVAudioSession.sharedInstance(),
      queue: nil
    ) { [weak self] note in
      self?.handleInterruption(note)
    }
  }

  deinit {
    if let observer = interruptionObserver {
      NotificationCenter.default.removeObserver(observer)
    }
  }

  private func handleInterruption(_ note: Notification) {
    guard let info = note.userInfo,
          let raw = info[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }

    switch type {
    case .began:
      engineQueue.async { [weak self] in
        guard let self = self, self.liveMode, self.state != .idle else { return }
        self.log("interruption began — releasing the session")
        self.liveNode.stop()
        self.engine.inputNode.removeTap(onBus: 0)
        self.engine.stop()
        self.state = .idle
        self.delegate?.audioEngineDidError(code: "mic_interrupted")
      }
    case .ended:
      let optsRaw = info[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
      guard AVAudioSession.InterruptionOptions(rawValue: optsRaw).contains(.shouldResume) else {
        return
      }
      engineQueue.async { [weak self] in
        guard let self = self, self.liveMode, self.state == .idle else { return }
        self.log("interruption ended — resuming capture")
        self.didColdRetry = false
        // Success re-fires audioEngineDidStartListening, which is the JS layer's resume signal.
        self.configureAndStartLive()
      }
    @unknown default:
      break
    }
  }

  private func configureAndStartLive() {
    do {
      micReceived = false
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker])
      try session.setActive(true)
      let input = engine.inputNode
      try input.setVoiceProcessingEnabled(true)
      engine.attach(liveNode)
      engine.connect(liveNode, to: engine.mainMixerNode, format: livePlayFormat)
      let micFormat = input.outputFormat(forBus: 0)
      // DEVICE-TUNE: mic is the hardware format (often 48k float); resample → 16k int16.
      liveConverter = AVAudioConverter(from: micFormat, to: liveWireFormat)
      log("live cfg installTap micFmt sr=\(micFormat.sampleRate) ch=\(micFormat.channelCount)")
      input.installTap(onBus: 0, bufferSize: 1024, format: micFormat) { [weak self] buffer, _ in
        self?.emitMicFrame(buffer)
      }
      engine.prepare()
      try engine.start()
      liveNode.play()
      liveMode = true
      liveGen += 1
      livePendingStarts.removeAll()
      liveNextStartFrame = 0
      startLiveClock()
      state = .listening
      settleLiveStart(nil)
      delegate?.audioEngineDidStartListening()
      scheduleLiveColdStartCheck()
    } catch {
      let code = Self.errorCode(for: error)
      log("live \(code): \(error.localizedDescription)")
      // A first attempt reports through the pending completion so the caller can abort the whole
      // session; a later one (cold-start retry, interruption resume) has no completion left and
      // falls back to the error event.
      if !settleLiveStart(code) {
        delegate?.audioEngineDidError(code: code)
      }
    }
  }

  /// Live counterpart of scheduleColdStartCheck: if no mic frames arrive within 2.5s
  /// of starting, the first voice-processing init produced a dead session — restart once.
  private func scheduleLiveColdStartCheck() {
    engineQueue.asyncAfter(deadline: .now() + 2.5) { [weak self] in
      guard let self = self else { return }
      guard self.liveMode, !self.micReceived, !self.didColdRetry else { return }
      self.didColdRetry = true
      self.log("live: no mic buffers in 2.5s — cold-start recovery: restarting engine")
      self.stopLiveClock() // configureAndStartLive() starts a fresh one
      self.liveNode.stop()
      self.engine.inputNode.removeTap(onBus: 0)
      self.engine.stop()
      self.configureAndStartLive()
    }
  }

  func stopLiveCapture() {
    engineQueue.async { [weak self] in
      guard let self = self else { return }
      self.liveMode = false
      self.stopLiveClock()
      self.livePendingStarts.removeAll()
      self.liveNode.stop()
      self.engine.inputNode.removeTap(onBus: 0)
      self.engine.stop()
      self.state = .idle
    }
  }

  /// Enqueue one streamed PCM chunk (base64 int16 16k mono) for gapless playback. Its
  /// `onChunkStarted(seq)` fires later, from the playback clock — see `startLiveClock`.
  func enqueueLiveChunk(base64: String, seq: Int) {
    engineQueue.async { [weak self] in
      guard let self = self, self.liveMode,
            let data = Data(base64Encoded: base64),
            let buffer = self.pcm16ToFloatBuffer(data) else { return }

      // Rebase to "now" if the node starved: a start frame already in the past would play
      // late while its event fired on time — the very drift this replaced.
      // Clamped at 0: immediately after a barge-in's stop/reset/play, `lastRenderTime` can
      // still predate the restart and yield a negative playhead.
      let now = max(0, self.liveRenderedFrames() ?? 0)
      let startFrame = max(now, self.liveNextStartFrame)
      self.liveNextStartFrame = startFrame + AVAudioFramePosition(buffer.frameLength)
      self.livePendingStarts.append(
        PendingChunkStart(seq: seq, startFrame: startFrame, gen: self.liveGen))

      let at = AVAudioTime(sampleTime: startFrame, atRate: self.livePlayFormat.sampleRate)
      self.liveNode.scheduleBuffer(buffer, at: at, options: [], completionHandler: nil)
    }
  }

  /// The player's playhead, in frames since `play()`. Nil while the node is stopped or the
  /// engine has not rendered yet.
  private func liveRenderedFrames() -> AVAudioFramePosition? {
    guard liveNode.isPlaying,
          let nodeTime = liveNode.lastRenderTime,
          let playerTime = liveNode.playerTime(forNodeTime: nodeTime) else { return nil }
    return playerTime.sampleTime
  }

  /// Reports each chunk the instant the playhead reaches the frame it was pinned to. This is
  /// the lip-sync clock: JS latches that chunk's blendshapes here.
  private func startLiveClock() {
    stopLiveClock()
    let timer = DispatchSource.makeTimerSource(queue: engineQueue)
    timer.schedule(deadline: .now(),
                   repeating: .milliseconds(liveClockIntervalMs),
                   leeway: .milliseconds(1))
    timer.setEventHandler { [weak self] in
      guard let self = self, self.liveMode, !self.livePendingStarts.isEmpty,
            let rendered = self.liveRenderedFrames() else { return }

      var started: [Int] = []
      while let head = self.livePendingStarts.first {
        if head.gen != self.liveGen {
          self.livePendingStarts.removeFirst() // barged-in since it was queued
          continue
        }
        guard head.startFrame <= rendered else { break } // still in the future — stop here
        started.append(head.seq)
        self.livePendingStarts.removeFirst()
      }
      for seq in started { self.delegate?.audioEngineDidStartChunk(seq: seq) }
    }
    timer.resume()
    liveClock = timer
  }

  private func stopLiveClock() {
    liveClock?.cancel()
    liveClock = nil
  }

  /// Barge-in / stop: drop queued audio, keep capturing.
  ///
  /// Bumping `liveGen` and clearing the queue is what stops a dropped chunk from latching its
  /// blendshapes onto the face — the old `asyncAfter` callbacks could not be cancelled and
  /// fired regardless. Safe as a no-op: the server emits `stop_playback` on nearly every user
  /// turn, including when nothing is playing.
  func stopLivePlayback() {
    engineQueue.async { [weak self] in
      guard let self = self else { return }
      self.liveGen += 1
      self.livePendingStarts.removeAll()
      self.liveNode.stop()
      self.liveNode.reset()
      self.liveNode.play() // playerTime restarts at 0
      self.liveNextStartFrame = 0
    }
  }

  private func emitMicFrame(_ buffer: AVAudioPCMBuffer) {
    guard liveMode, let converter = liveConverter else { return }
    micReceived = true // tells scheduleLiveColdStartCheck the voice-processing session is alive
    let ratio = liveWireFormat.sampleRate / buffer.format.sampleRate
    let cap = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 16
    guard let out = AVAudioPCMBuffer(pcmFormat: liveWireFormat, frameCapacity: cap) else { return }
    var err: NSError?
    var fed = false
    converter.convert(to: out, error: &err) { _, status in
      if fed { status.pointee = .noDataNow; return nil }
      fed = true
      status.pointee = .haveData
      return buffer
    }
    guard err == nil, out.frameLength > 0, let ch = out.int16ChannelData else { return }
    let data = Data(bytes: ch[0], count: Int(out.frameLength) * 2)
    delegate?.audioEngineDidCaptureFrame(base64: data.base64EncodedString())
  }

  /// int16 LE bytes → a float32 mono buffer at 16k for the live player node.
  private func pcm16ToFloatBuffer(_ data: Data) -> AVAudioPCMBuffer? {
    let frames = AVAudioFrameCount(data.count / 2)
    guard frames > 0,
          let buf = AVAudioPCMBuffer(pcmFormat: livePlayFormat, frameCapacity: frames),
          let out = buf.floatChannelData else { return nil }
    buf.frameLength = frames
    data.withUnsafeBytes { raw in
      let src = raw.bindMemory(to: Int16.self)
      for i in 0..<Int(frames) { out[0][i] = Float(src[i]) / 32768.0 }
    }
    return buf
  }

  // MARK: - Engine setup

  private func configureAndStart() {
    do {
      micReceived = false
      let session = AVAudioSession.sharedInstance()
      log("cfg setCategory")
      try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker])
      log("cfg setActive")
      try session.setActive(true)

      let input = engine.inputNode
      log("cfg setVoiceProcessingEnabled")
      // Apple hardware AEC: removes the engine's output (the avatar) from the mic.
      try input.setVoiceProcessingEnabled(true)

      log("cfg attach")
      engine.attach(player)
      let respFmt = responseBuffer?.format
      log("cfg connect player->mixer respFmt sr=\(respFmt?.sampleRate ?? 0) ch=\(respFmt?.channelCount ?? 0)")
      engine.connect(player, to: engine.mainMixerNode, format: respFmt)

      let format = input.outputFormat(forBus: 0)
      log("cfg installTap micFmt sr=\(format.sampleRate) ch=\(format.channelCount)")
      startTime = CACurrentMediaTime()
      input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
        self?.handleMic(buffer: buffer)
      }

      log("cfg prepare")
      engine.prepare()
      log("cfg start")
      try engine.start()
      state = .listening
      log("LISTENING micFormat sr=\(format.sampleRate) ch=\(format.channelCount)")
      delegate?.audioEngineDidStartListening()
      scheduleColdStartCheck()
    } catch {
      log("engine_failed: \(error.localizedDescription)")
      delegate?.audioEngineDidError(code: "engine_failed")
    }
  }

  /// If no mic buffers arrive within a couple seconds of starting, the first-ever
  /// voice-processing init produced a dead session — restart once (the warm retry
  /// then succeeds, mirroring a manual stop/start).
  private func scheduleColdStartCheck() {
    engineQueue.asyncAfter(deadline: .now() + 2.5) { [weak self] in
      guard let self = self else { return }
      guard self.state == .listening, !self.micReceived, !self.didColdRetry else { return }
      self.didColdRetry = true
      self.log("no mic buffers in 2.5s — cold-start recovery: restarting engine")
      self.player.stop()
      self.engine.inputNode.removeTap(onBus: 0)
      self.engine.stop()
      self.configureAndStart()
    }
  }

  // MARK: - Mic → VAD

  private func handleMic(buffer: AVAudioPCMBuffer) {
    micReceived = true
    guard let channel = buffer.floatChannelData?[0] else { return }
    let n = Int(buffer.frameLength)
    guard n > 0 else { return }
    var sum: Float = 0
    for i in 0..<n {
      let s = channel[i]
      sum += s * s
    }
    let rms = sqrtf(sum / Float(n))
    let now = CACurrentMediaTime() - startTime
    let event = detector.process(energy: rms, time: now)

    if now - lastLogTime >= 0.3 {
      lastLogTime = now
      let rmsStr = String(format: "%.4f", rms)
      let thrStr = String(format: "%.4f", detector.threshold)
      let since = detector.debugHasSpoken
        ? String(format: "%.2f", now - detector.debugLastSpeechTime) : "-"
      log("rms=\(rmsStr) thr=\(thrStr) spoke=\(detector.debugHasSpoken ? "Y" : "N") since=\(since)s state=\(state)")
    }
    if event != .none { log("VAD \(event)") }

    engineQueue.async { [weak self] in
      guard let self = self else { return }
      switch (self.state, event) {
      case (.listening, .endOfUtterance):
        self.playResponse()
      case (.playing, .speechStarted):
        self.bargeIn()
      default:
        break
      }
    }
  }

  // MARK: - Playback

  private func playResponse() {
    guard let buffer = responseBuffer else { return }
    log("playResponse scheduling \(buffer.frameLength) frames")
    state = .playing
    detector.reset() // so the first user speech during playback registers as barge-in
    player.scheduleBuffer(buffer, at: nil, options: []) { [weak self] in
      self?.engineQueue.async {
        guard let self = self, self.state == .playing else { return }
        self.state = .listening
        self.detector.reset()
        self.log("playback finished")
        self.delegate?.audioEngineDidStopPlayback(reason: "finished")
        self.delegate?.audioEngineDidStartListening()
      }
    }
    player.play()
    delegate?.audioEngineDidStartPlayback()
  }

  private func bargeIn() {
    log("bargeIn")
    player.stop()
    state = .listening
    // Keep the detector's "spoken" state: the barge-in speech IS the user's new
    // utterance, so 3s of silence after they finish replays the response.
    delegate?.audioEngineDidStopPlayback(reason: "bargeIn")
    delegate?.audioEngineDidStartListening()
  }

  // MARK: - WAV → PCM buffer

  private static func decodeWavToBuffer(data: Data) -> AVAudioPCMBuffer? {
    let tmp = FileManager.default.temporaryDirectory.appendingPathComponent("mirror_resp.wav")
    do {
      try data.write(to: tmp)
      let file = try AVAudioFile(forReading: tmp)
      guard let buffer = AVAudioPCMBuffer(
        pcmFormat: file.processingFormat,
        frameCapacity: AVAudioFrameCount(file.length)
      ) else { return nil }
      try file.read(into: buffer)
      return buffer
    } catch {
      return nil
    }
  }
}
