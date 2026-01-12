package com.androidircx

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.modules.core.DeviceEventManagerModule

class IRCForegroundServiceModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var isReceiverRegistered = false
    private val disconnectReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != IRCForegroundService.ACTION_DISCONNECT_QUIT_BROADCAST) {
                return
            }
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("IRCForegroundServiceDisconnectQuit", null)
        }
    }

    override fun getName(): String = "IRCForegroundService"

    override fun initialize() {
        super.initialize()
        registerDisconnectReceiver()
    }

    override fun invalidate() {
        unregisterDisconnectReceiver()
        super.invalidate()
    }

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

    private fun registerDisconnectReceiver() {
        if (isReceiverRegistered) return
        val filter = IntentFilter(IRCForegroundService.ACTION_DISCONNECT_QUIT_BROADCAST)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reactApplicationContext.registerReceiver(
                disconnectReceiver,
                filter,
                Context.RECEIVER_NOT_EXPORTED
            )
        } else {
            reactApplicationContext.registerReceiver(disconnectReceiver, filter)
        }
        isReceiverRegistered = true
    }

    private fun unregisterDisconnectReceiver() {
        if (!isReceiverRegistered) return
        try {
            reactApplicationContext.unregisterReceiver(disconnectReceiver)
        } catch (e: Exception) {
            // Ignore unregister errors
        } finally {
            isReceiverRegistered = false
        }
    }
}
