package com.androidircx

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class IRCForegroundServiceModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "IRCForegroundService"

    @ReactMethod
    fun startService(networkName: String, title: String, text: String, promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, IRCForegroundService::class.java).apply {
                action = IRCForegroundService.ACTION_START
                putExtra(IRCForegroundService.EXTRA_NETWORK_NAME, networkName)
                putExtra(IRCForegroundService.EXTRA_NOTIFICATION_TITLE, title)
                putExtra(IRCForegroundService.EXTRA_NOTIFICATION_TEXT, text)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject(
                "START_SERVICE_ERROR",
                "Failed to start foreground service: ${e.message}",
                e
            )
        }
    }

    @ReactMethod
    fun stopService(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, IRCForegroundService::class.java).apply {
                action = IRCForegroundService.ACTION_STOP
            }
            reactApplicationContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject(
                "STOP_SERVICE_ERROR",
                "Failed to stop foreground service: ${e.message}",
                e
            )
        }
    }

    @ReactMethod
    fun updateNotification(title: String, text: String, promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, IRCForegroundService::class.java).apply {
                action = IRCForegroundService.ACTION_UPDATE
                putExtra(IRCForegroundService.EXTRA_NOTIFICATION_TITLE, title)
                putExtra(IRCForegroundService.EXTRA_NOTIFICATION_TEXT, text)
            }
            reactApplicationContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject(
                "UPDATE_NOTIFICATION_ERROR",
                "Failed to update notification: ${e.message}",
                e
            )
        }
    }
}
