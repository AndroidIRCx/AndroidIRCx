package com.androidircx

import android.util.Base64
import com.facebook.react.bridge.*
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.IntegrityServiceException
import com.google.android.play.core.integrity.IntegrityTokenRequest
import java.util.concurrent.ThreadLocalRandom

/**
 * React Native module for Google Play Integrity API
 */
class PlayIntegrityModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "PlayIntegrityModule"

    /**
     * Request an integrity token from Google Play Integrity API
     *
     * @param nonce Base64 encoded nonce (optional)
     * @param promise Promise resolved with token or rejected with error
     */
    @ReactMethod
    fun requestIntegrityToken(nonce: String?, promise: Promise) {
        try {
            val integrityManager =
                IntegrityManagerFactory.create(reactApplicationContext)

            val requestNonce = nonce ?: generateNonce()

            val request = IntegrityTokenRequest.builder()
                // ⛔ OVO MORA BITI TVOJ PRAVI PROJECT NUMBER
                .setCloudProjectNumber(1060587657852L)
                .setNonce(requestNonce)
                .build()

            integrityManager.requestIntegrityToken(request)
                .addOnSuccessListener { response ->
                    val result = Arguments.createMap()
                    result.putString("token", response.token())
                    promise.resolve(result)
                }
                .addOnFailureListener { e ->
                    val message = if (e is IntegrityServiceException) {
                        when (e.errorCode) {
                            1 -> "Play Integrity API not available"
                            2 -> "Network error"
                            3 -> "App not installed from Play Store"
                            5 -> "Google Play Services not found"
                            6 -> "Google Play Services outdated"
                            7 -> "Google Play Services disabled"
                            9 -> "Nonce too short"
                            10 -> "Nonce too long"
                            11 -> "Nonce is not valid base64"
                            12 -> "Invalid Cloud Project Number"
                            else -> "Integrity error code ${e.errorCode}"
                        }
                    } else {
                        e.message ?: "Unknown error"
                    }

                    promise.reject("INTEGRITY_ERROR", message, e)
                }

        } catch (e: Exception) {
            promise.reject(
                "INTEGRITY_ERROR",
                "Failed to request integrity token: ${e.message}",
                e
            )
        }
    }

    /**
     * Generate secure random nonce (16 bytes, base64)
     */
    private fun generateNonce(): String {
        val bytes = ByteArray(16)
        ThreadLocalRandom.current().nextBytes(bytes)
        return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
    }

    /**
     * Check if Play Integrity API is available
     */
    @ReactMethod
    fun isAvailable(promise: Promise) {
        try {
            IntegrityManagerFactory.create(reactApplicationContext)
            promise.resolve(true)
        } catch (_: Exception) {
            promise.resolve(false)
        }
    }
}
