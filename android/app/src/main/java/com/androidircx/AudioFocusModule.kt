package com.androidircx

import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import com.facebook.react.bridge.*

/**
 * AudioFocusModule - Manages audio focus for notification sounds
 * Uses transient audio focus with ducking to avoid interrupting music/radio
 */
class AudioFocusModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val audioManager: AudioManager = reactContext.getSystemService(AudioManager::class.java)
    private var focusRequest: AudioFocusRequest? = null

    override fun getName(): String = "AudioFocusModule"

    /**
     * Request transient audio focus with ducking
     * Other apps (music, radio) will be ducked (lowered) but not stopped
     */
    @ReactMethod
    fun requestTransientFocus(promise: Promise) {
        try {
            val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val focusRequest =
                    AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                        .setAudioAttributes(
                            AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                .build()
                        )
                        .setOnAudioFocusChangeListener { }
                        .build()
                        .also { this.focusRequest = it }
                audioManager.requestAudioFocus(focusRequest)
            } else {
                @Suppress("DEPRECATION")
                audioManager.requestAudioFocus(
                    null,
                    AudioManager.STREAM_NOTIFICATION,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
                )
            }
            promise.resolve(result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED)
        } catch (e: Exception) {
            promise.reject("AUDIO_FOCUS_ERROR", e.message, e)
        }
    }

    /**
     * Release audio focus immediately
     * This allows other apps (music, radio) to resume normal volume
     */
    @ReactMethod
    fun releaseFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
            focusRequest = null
        } else {
            @Suppress("DEPRECATION")
            audioManager.abandonAudioFocus(null)
        }
    }
}
