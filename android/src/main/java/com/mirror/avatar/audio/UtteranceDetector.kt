package com.mirror.avatar.audio

import kotlin.math.max

/**
 * Pure voice-activity / end-of-utterance logic — a Kotlin port of the iOS
 * UtteranceDetector, with an ADAPTIVE threshold so it works across devices without
 * per-device tuning. Captured mic gain varies enormously (e.g. voice-communication
 * capture on some phones is ~10x quieter than iOS voice-processing), so a fixed
 * energy threshold can't be right everywhere. Instead this tracks the background
 * noise floor and treats speech as energy a few times above it.
 *
 * Feed it per-buffer RMS energy + a monotonic timestamp (seconds); it reports
 * speech start and end-of-utterance. No audio I/O.
 *
 * Speech onset requires *sustained* energy (tolerant of brief syllable gaps), so a
 * single transient buffer (the click at playback onset, or AEC residual) never
 * counts as speech — that is what stops the avatar barging in on its own voice.
 *
 * End-of-utterance only fires AFTER speech has been heard: pure silence never
 * triggers it (the avatar does not respond until you speak).
 */
class UtteranceDetector(
  silenceMs: Double,
  /** Speech = energy at least this many times the tracked noise floor. */
  private val speechFactor: Float = 2.5f,
  /** Absolute minimum so digital/near silence + tiny blips never trigger. */
  private val minThreshold: Float = 0.0008f,
  onsetMs: Double = 200.0,
  gapMs: Double = 120.0,
) {
  enum class Event { NONE, SPEECH_STARTED, END_OF_UTTERANCE }

  private val silenceSec = silenceMs / 1000.0
  private val onsetSec = onsetMs / 1000.0
  private val gapSec = gapMs / 1000.0

  // Noise-floor follower: falls quickly toward quiet, rises very slowly (so speech
  // doesn't drag it up). Starts high and converges to the real ambient within ~1s.
  private var noiseFloor = 0.01f
  private val fallAlpha = 0.2f   // track down to a quieter floor fast (~hundreds of ms)
  private val riseAlpha = 0.001f // rise very slowly — speech barely moves the floor

  /** The current effective trigger level (adaptive); exposed for logging. */
  val threshold: Float
    get() = max(minThreshold, noiseFloor * speechFactor)

  private var hasSpoken = false
  private var lastSpeechTime = 0.0
  private var onsetStart: Double? = null
  private var lastAboveTime = 0.0

  fun process(energy: Float, time: Double): Event {
    // Update the noise-floor estimate from the quiet background (asymmetric: fall
    // fast to follow silence, rise slowly so an utterance can't pull it up).
    noiseFloor += (energy - noiseFloor) * (if (energy < noiseFloor) fallAlpha else riseAlpha)

    val above = energy > max(minThreshold, noiseFloor * speechFactor)
    if (above) lastAboveTime = time

    if (hasSpoken) {
      // Utterance in progress: wait for sustained silence.
      if (above) lastSpeechTime = time
      if (time - lastSpeechTime >= silenceSec) return Event.END_OF_UTTERANCE
      return Event.NONE
    }

    // Looking for a sustained speech onset (tolerant of brief syllable gaps).
    if (above) {
      lastSpeechTime = time
      if (onsetStart == null) onsetStart = time
      val start = onsetStart
      if (start != null && time - start >= onsetSec) {
        hasSpoken = true
        onsetStart = null
        return Event.SPEECH_STARTED
      }
    } else {
      val start = onsetStart
      if (start != null && time - lastAboveTime >= gapSec) {
        onsetStart = null // gap too long — not speech, reset the run
      }
    }
    return Event.NONE
  }

  /** Resets the utterance state (not the noise floor — the environment is unchanged). */
  fun reset() {
    hasSpoken = false
    lastSpeechTime = 0.0
    onsetStart = null
  }
}
