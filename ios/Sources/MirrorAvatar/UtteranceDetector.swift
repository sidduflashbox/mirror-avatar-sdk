import Foundation

/// Pure voice-activity / end-of-utterance logic. Feed it per-buffer RMS energy +
/// a monotonic timestamp (seconds); it reports speech start and end-of-utterance.
/// No audio I/O — easy to reason about, tune, and unit-test.
///
/// Speech onset requires *sustained* energy (tolerant of brief syllable gaps), so a
/// single transient buffer — the click at playback onset, or a blip of AEC residual —
/// never counts as speech. That is what stops the avatar barging in on its own voice.
///
/// End-of-utterance only fires AFTER speech has been heard: pure silence never
/// triggers it (the avatar does not respond until you speak).
final class UtteranceDetector {
  enum Event { case none, speechStarted, endOfUtterance }

  /// RMS energy above this counts as (instantaneous) speech. Tune on device.
  var threshold: Float
  private let silenceSec: Double
  /// Energy must stay above threshold this long before we declare speech started.
  private let onsetSec: Double
  /// Dips below threshold shorter than this don't break an onset run (speech is
  /// bursty — syllable gaps must not reset onset detection).
  private let gapSec: Double

  private var hasSpoken = false       // an utterance is in progress
  private var lastSpeechTime: Double = 0
  private var onsetStart: Double?     // when the current above-threshold run began
  private var lastAboveTime: Double = 0

  // Debug introspection for on-device VAD calibration.
  var debugHasSpoken: Bool { hasSpoken }
  var debugLastSpeechTime: Double { lastSpeechTime }

  init(silenceMs: Double, threshold: Float = 0.02, onsetMs: Double = 200, gapMs: Double = 120) {
    self.silenceSec = silenceMs / 1000.0
    self.threshold = threshold
    self.onsetSec = onsetMs / 1000.0
    self.gapSec = gapMs / 1000.0
  }

  func process(energy: Float, time: Double) -> Event {
    let above = energy > threshold
    if above { lastAboveTime = time }

    if hasSpoken {
      // Utterance in progress: wait for sustained silence.
      if above { lastSpeechTime = time }
      if (time - lastSpeechTime) >= silenceSec {
        return .endOfUtterance
      }
      return .none
    }

    // Looking for a sustained speech onset (tolerant of brief syllable gaps).
    if above {
      lastSpeechTime = time
      if onsetStart == nil { onsetStart = time }
      if let start = onsetStart, time - start >= onsetSec {
        hasSpoken = true
        onsetStart = nil
        return .speechStarted
      }
    } else if onsetStart != nil, time - lastAboveTime >= gapSec {
      onsetStart = nil // gap too long — not speech, reset the run
    }
    return .none
  }

  func reset() {
    hasSpoken = false
    lastSpeechTime = 0
    onsetStart = nil
  }
}
