# Android Implementation

The SDK's Android native module. It owns **audio only** — the avatar is rendered by Filament from
JavaScript (`src/engine/filament`), on both platforms, so there is no native view here.

| File | Role |
|---|---|
| `MirrorAvatarModule.kt` | The React Native bridge. Its exported surface matches the iOS bridge. |
| `MirrorAvatarPackage.kt` | Registers the module. No view managers. |
| `audio/MirrorAudioEngine.kt` | The voice-communication session: mic capture, streamed playback, barge-in. |
| `audio/UtteranceDetector.kt` | Adaptive-threshold VAD (pure logic, no audio I/O). |
| `audio/ChunkStartTracker.kt` | Maps streamed chunks to the frame at which they become audible (pure logic, unit-tested). |

## Why the audio session looks the way it does

Three things are load-bearing and must not be "simplified":

- **`MODE_IN_COMMUNICATION` + `VOICE_COMMUNICATION` capture + a `USAGE_VOICE_COMMUNICATION`
  `AudioTrack`.** Comm mode puts playback on the path the hardware `AcousticEchoCanceler`
  references. Switch playback to `USAGE_MEDIA` and the canceller stops seeing it, the mic hears the
  avatar, and the agent barges in on its own voice.
- **Comm playback is quiet on the media-volume slider**, so `forceSpeakerAndVolume()` routes it to
  the loudspeaker and maxes `STREAM_VOICE_CALL`.
- **The detector's threshold is adaptive.** Comm-mode capture is ~10× quieter than iOS
  voice-processing on some phones; a fixed energy threshold cannot work across devices.

## Lip-sync timing

`onChunkStarted(seq)` fires from the **playback clock** (`ChunkStartTracker` against the
`AudioTrack`'s rendered-frame position) — never from the capture loop, never from a wall clock.

JS latches a chunk's blendshapes on that event and acks the server with `{"type":"playback",seq}`,
which is what truncates a barged-in turn to what the user actually heard. A wall-clock schedule
assumes continuous playback; the server sends one chunk per sentence, so the track starves between
them and the face drifts progressively ahead of the voice.

## Building

The module is consumed by **autolinking** (`react-native.config.js` →
`dependency.platforms.android.sourceDir`). A consuming React Native app picks it up automatically;
ensure `minSdkVersion >= 24` and grant `RECORD_AUDIO`. There is nothing to build here directly — it
compiles as part of the host app's Gradle build.
