/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * NfcHceModule - JS bridge for phone-to-phone NFC key sharing via Host Card
 * Emulation. Arms NdefHostApduService with a payload, then emits
 * "NfcHceReadComplete" once the peer device has read the NDEF message.
 */
package com.androidircx

import android.content.pm.PackageManager
import android.nfc.NfcAdapter
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class NfcHceModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "NfcHceModule"
        private const val EVENT_READ_COMPLETE = "NfcHceReadComplete"
    }

    override fun getName(): String = "NfcHce"

    /** Required by NativeEventEmitter on the JS side (no-op bookkeeping). */
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    /** True only when the device supports NFC Host Card Emulation. */
    @ReactMethod
    fun isSupported(promise: Promise) {
        try {
            val adapter = NfcAdapter.getDefaultAdapter(reactApplicationContext)
            val hasHce = reactApplicationContext.packageManager
                .hasSystemFeature(PackageManager.FEATURE_NFC_HOST_CARD_EMULATION)
            promise.resolve(adapter != null && hasHce)
        } catch (e: Throwable) {
            Log.e(TAG, "isSupported failed: ${e.message}", e)
            promise.resolve(false)
        }
    }

    /** Arm the emulated tag with [text] and start emitting read events. */
    @ReactMethod
    fun startSharing(text: String, promise: Promise) {
        try {
            NdefHostApduService.onNdefRead = {
                emitReadComplete()
            }
            NdefHostApduService.setPayload(text)
            promise.resolve(true)
        } catch (e: Throwable) {
            Log.e(TAG, "startSharing failed: ${e.message}", e)
            NdefHostApduService.clearPayload()
            promise.reject("HCE_START_FAILED", e.message ?: "Failed to start NFC sharing", e)
        }
    }

    /** Stop sharing and disarm the emulated tag. */
    @ReactMethod
    fun stopSharing(promise: Promise) {
        try {
            NdefHostApduService.clearPayload()
            promise.resolve(true)
        } catch (e: Throwable) {
            Log.e(TAG, "stopSharing failed: ${e.message}", e)
            promise.resolve(false)
        }
    }

    private fun emitReadComplete() {
        try {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(EVENT_READ_COMPLETE, null)
        } catch (e: Throwable) {
            Log.w(TAG, "Failed to emit read event: ${e.message}")
        }
    }
}
