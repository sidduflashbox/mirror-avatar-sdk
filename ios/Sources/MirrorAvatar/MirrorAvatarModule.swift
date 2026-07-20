import AVFoundation
import Foundation
import React
import UIKit

/// Native module exposing audio (playback, and the listen / barge-in loop) to
/// JavaScript. An RCTEventEmitter so the loop can push events
/// (onListeningStarted / onPlaybackStarted / onPlaybackStopped / onError) to JS.
///
/// The exported surface must stay in lockstep with the Android module
/// (`android/src/main/java/com/mirror/avatar/MirrorAvatarModule.kt`).
@objc(MirrorAvatarModule)
final class MirrorAvatarModule: RCTEventEmitter {
  override func supportedEvents() -> [String]! {
    ["onListeningStarted", "onPlaybackStarted", "onPlaybackStopped", "onError",
     "onAudioFrame", "onChunkStarted"]
  }

  override static func requiresMainQueueSetup() -> Bool {
    false
  }

  // MARK: - Native audio playback

  /// Held strongly so playback isn't cut short by deallocation.
  private var audioPlayer: AVAudioPlayer?

  /// Play a clip from a base64-encoded WAV on a native AVAudioPlayer — fully offline.
  /// Keeping audio in one native session is the foundation for echo-cancelled barge-in.
  /// Fire-and-forget: JS latches the morph clock the instant it asks us to play, so lips
  /// and audio start together.
  @objc func playAudio(_ base64: NSString) {
    // The listen engine, while running, owns the voice-processing audio session; a
    // standalone AVAudioPlayer can't share it and would play silently. Route the
    // Play button through the engine so it plays the same loaded response aloud.
    if isListening {
      listenEngine.playNow()
      return
    }
    guard let data = Data(base64Encoded: base64 as String) else {
      NSLog("[MirrorAvatarModule] invalid base64 audio")
      return
    }
    DispatchQueue.main.async { [weak self] in
      do {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .default)
        try session.setActive(true)
        let player = try AVAudioPlayer(data: data)
        player.prepareToPlay()
        self?.audioPlayer = player
        player.play()
      } catch {
        NSLog("[MirrorAvatarModule] audio playback failed: \(error.localizedDescription)")
      }
    }
  }

  /// Stop any in-flight playback (barge-in or screen teardown).
  @objc func stopAudio() {
    DispatchQueue.main.async { [weak self] in
      self?.audioPlayer?.stop()
      self?.audioPlayer = nil
    }
  }

  // MARK: - Listen / barge-in loop

  private lazy var listenEngine: MirrorAudioEngine = {
    let engine = MirrorAudioEngine()
    engine.delegate = self
    return engine
  }()

  /// Guards rapid double-invocation: a fast double-tap fires startListening twice
  /// before React updates `listening`, stacking a second engine/mic-tap. Set
  /// synchronously on the bridge queue so the second call is dropped immediately.
  private var isListening = false

  @objc func startListening(_ base64: NSString, silenceMs: NSNumber) {
    if isListening {
      NSLog("%@", "[MirrorAudio] module: startListening ignored — already listening")
      return
    }
    isListening = true
    listenEngine.start(base64: base64 as String, silenceMs: silenceMs.doubleValue)
  }

  @objc func stopListening() {
    isListening = false
    listenEngine.stop()
  }

  // MARK: - Live streaming (WS voice)

  @objc func startLiveCapture() {
    listenEngine.startLiveCapture()
  }

  @objc func stopLiveCapture() {
    listenEngine.stopLiveCapture()
  }

  @objc func enqueueAudioChunk(_ base64: NSString, seq: NSNumber) {
    listenEngine.enqueueLiveChunk(base64: base64 as String, seq: seq.intValue)
  }

  @objc func stopPlayback() {
    listenEngine.stopLivePlayback()
  }

  // MARK: - Screen sleep

  /// Hold the display awake while the avatar is on screen. A call is watched rather than
  /// touched, so the idle timer would otherwise sleep the screen mid-conversation. The SDK
  /// owns this so the host app needs no keep-awake dependency of its own.
  ///
  /// No app-state bookkeeping is needed: iOS applies the idle timer only to the foreground
  /// app, so backgrounding lapses it and returning re-applies it.
  @objc func setKeepAwake(_ enabled: Bool) {
    DispatchQueue.main.async {
      UIApplication.shared.isIdleTimerDisabled = enabled
    }
  }

  /// A JS reload or bridge teardown skips the view's unmount, which would otherwise leave the
  /// screen pinned awake for the rest of the process.
  override func invalidate() {
    DispatchQueue.main.async {
      UIApplication.shared.isIdleTimerDisabled = false
    }
    super.invalidate()
  }
}

extension MirrorAvatarModule: MirrorAudioEngineDelegate {
  func audioEngineDidStartListening() {
    sendEvent(withName: "onListeningStarted", body: nil)
  }

  func audioEngineDidStartPlayback() {
    NSLog("%@", "[MirrorAudio] module->JS sendEvent onPlaybackStarted")
    sendEvent(withName: "onPlaybackStarted", body: nil)
  }

  func audioEngineDidStopPlayback(reason: String) {
    sendEvent(withName: "onPlaybackStopped", body: ["reason": reason])
  }

  func audioEngineDidError(code: String) {
    isListening = false
    sendEvent(withName: "onError", body: ["code": code])
  }

  func audioEngineDidCaptureFrame(base64: String) {
    sendEvent(withName: "onAudioFrame", body: ["base64": base64])
  }

  func audioEngineDidStartChunk(seq: Int) {
    sendEvent(withName: "onChunkStarted", body: ["seq": seq])
  }
}
