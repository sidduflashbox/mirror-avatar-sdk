package com.mirror.avatar

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.util.Base64
import android.util.Log
import android.view.WindowManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener
import com.mirror.avatar.audio.MirrorAudioEngine
import java.io.File

private const val TAG = "MirrorAvatarModule"

/**
 * Android MirrorAvatarModule — the single native audio surface for the SDK.
 *
 * `playAudio`/`stopAudio` are the manual Play button (MediaPlayer);
 * `startListening`/`stopListening` drive the local VAD loop; `startLiveCapture` /
 * `enqueueAudioChunk` / `stopPlayback` drive the live WS voice path. All of it runs
 * through [MirrorAudioEngine], which owns the voice-communication session (AEC +
 * comm-path playback) — see that file for why the routing matters.
 *
 * The exported surface must stay in lockstep with the iOS bridge
 * (`ios/Sources/MirrorAvatar/MirrorAvatarModuleBridge.m`).
 */
class MirrorAvatarModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), MirrorAudioEngine.Listener {

  private var player: MediaPlayer? = null
  private val engine = MirrorAudioEngine(reactContext).also { it.listener = this }

  override fun getName() = "MirrorAvatarModule"

  // ----- manual Play button -----

  @ReactMethod
  fun playAudio(base64: String) {
    // While the engine owns the voice-comm session, route the Play button through it
    // (its onPlaybackStarted drives the face). Otherwise use the standalone MediaPlayer.
    if (engine.isListening) { engine.playNow(); return }
    Thread {
      try {
        val bytes = Base64.decode(base64, Base64.DEFAULT)
        val file = File.createTempFile("mirror_audio", ".wav", reactApplicationContext.cacheDir)
        file.writeBytes(bytes); file.deleteOnExit()
        reactApplicationContext.runOnUiQueueThread {
          try {
            player?.release()
            val mp = MediaPlayer()
            mp.setAudioAttributes(
              AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
            )
            mp.setDataSource(file.absolutePath)
            var notified = false
            mp.setOnPreparedListener {
              it.start()
              if (!notified) { notified = true; onPlaybackStarted() }
            }
            mp.setOnErrorListener { _, what, extra ->
              Log.e(TAG, "audio error what=$what extra=$extra"); true
            }
            mp.prepareAsync(); player = mp
          } catch (e: Exception) { Log.e(TAG, "audio playback failed", e) }
        }
      } catch (e: Exception) { Log.e(TAG, "audio decode failed", e) }
    }.start()
  }

  @ReactMethod
  fun stopAudio() {
    reactApplicationContext.runOnUiQueueThread {
      try { player?.stop() } catch (_: Exception) {}
      player?.release(); player = null
    }
  }

  // ----- local listen loop (VAD + barge-in) -----

  @ReactMethod
  fun startListening(base64: String, silenceMs: Double) {
    withMicPermission(REQ_MIC) { engine.start(base64, silenceMs) }
  }

  @ReactMethod
  fun stopListening() { engine.stop() }

  // ----- live streaming (WS voice) -----

  /**
   * Resolves once the mic is actually capturing, and rejects with the native error code when it
   * is not — so JS can decline to open a session the user cannot be heard in.
   */
  @ReactMethod
  fun startLiveCapture(promise: Promise) {
    withMicPermission(
      REQ_MIC_LIVE,
      granted = {
        val err = engine.startLiveCapture()
        if (err == null) promise.resolve(null)
        else promise.reject(err, "live audio capture failed: $err")
      },
      denied = { promise.reject("mic_permission_denied", "microphone permission denied") },
    )
  }

  @ReactMethod
  fun stopLiveCapture() { engine.stopLiveCapture() }

  @ReactMethod
  fun enqueueAudioChunk(base64: String, seq: Double) { engine.enqueueLiveChunk(base64, seq.toInt()) }

  @ReactMethod
  fun stopPlayback() { engine.stopLivePlayback() }

  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Double) {}

  // ----- MirrorAudioEngine.Listener -> JS events -----

  override fun onListeningStarted() { emit("onListeningStarted", Arguments.createMap()) }
  override fun onPlaybackStarted() { emit("onPlaybackStarted", Arguments.createMap()) }

  override fun onPlaybackStopped(reason: String) {
    emit("onPlaybackStopped", Arguments.createMap().apply { putString("reason", reason) })
  }

  override fun onError(code: String) { emit("onError", err(code)) }

  override fun onAudioFrame(base64: String) {
    emit("onAudioFrame", Arguments.createMap().apply { putString("base64", base64) })
  }

  override fun onChunkStarted(seq: Int) {
    emit("onChunkStarted", Arguments.createMap().apply { putInt("seq", seq) })
  }

  // ----- screen sleep -----

  /**
   * Hold the display awake while the avatar is on screen. A call is watched rather than
   * touched, so the display timeout would otherwise sleep the screen mid-conversation. The SDK
   * owns this so the host app needs no keep-awake dependency of its own, and it stays in
   * lockstep with the iOS `setKeepAwake`.
   *
   * No app-state bookkeeping is needed: FLAG_KEEP_SCREEN_ON is scoped to a visible window, so
   * it lapses while the host is backgrounded and applies again when it returns.
   */
  @ReactMethod
  fun setKeepAwake(enabled: Boolean) {
    val activity = getCurrentActivity() ?: return
    activity.runOnUiThread {
      if (enabled) {
        activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      } else {
        activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      }
    }
  }

  // ----- helpers -----

  /**
   * Runs [granted] once RECORD_AUDIO is held, requesting it first if needed.
   *
   * [denied] lets a promise-based caller reject instead of only raising the error event; when it
   * is omitted the event is the sole report, which is what the fire-and-forget callers want.
   */
  private fun withMicPermission(
    requestCode: Int,
    denied: (() -> Unit)? = null,
    granted: () -> Unit,
  ) {
    val onDenied = denied ?: { emit("onError", err("mic_permission_denied")) }
    val ctx = reactApplicationContext
    if (ctx.checkSelfPermission(Manifest.permission.RECORD_AUDIO)
        == PackageManager.PERMISSION_GRANTED) {
      granted(); return
    }
    val activity = getCurrentActivity() as? PermissionAwareActivity
    if (activity == null) { onDenied(); return }
    activity.requestPermissions(
      arrayOf(Manifest.permission.RECORD_AUDIO), requestCode,
      PermissionListener { req, _, results ->
        if (req != requestCode) return@PermissionListener false
        if (results.isNotEmpty() && results[0] == PackageManager.PERMISSION_GRANTED) {
          granted()
        } else {
          onDenied()
        }
        true
      }
    )
  }

  private fun err(code: String): WritableMap = Arguments.createMap().apply { putString("code", code) }

  private fun emit(name: String, body: WritableMap) {
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(name, body)
  }

  // ----- lifecycle -----

  override fun invalidate() {
    // A JS reload or bridge teardown skips the view's unmount, which would otherwise leave the
    // window flag set for the rest of the activity's life.
    setKeepAwake(false)
    stopAudio()
    engine.release()
    super.invalidate()
  }

  companion object {
    private const val REQ_MIC = 4001
    private const val REQ_MIC_LIVE = 4002
  }
}
