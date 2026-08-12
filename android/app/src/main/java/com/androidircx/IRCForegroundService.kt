package com.androidircx

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat

class IRCForegroundService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null
    private var isServiceStarted = false
    private var lastTitle: String = "IRC Connected"
    private var lastText: String = "Maintaining connection"

    companion object {
        const val CHANNEL_ID = "irc_connection_channel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_START = "com.androidircx.action.START_FOREGROUND_SERVICE"
        const val ACTION_STOP = "com.androidircx.action.STOP_FOREGROUND_SERVICE"
        const val ACTION_UPDATE = "com.androidircx.action.UPDATE_FOREGROUND_SERVICE"
        const val ACTION_DISCONNECT_QUIT = "com.androidircx.action.DISCONNECT_QUIT"
        const val ACTION_DISCONNECT_QUIT_BROADCAST =
            "com.androidircx.action.DISCONNECT_QUIT_BROADCAST"
        const val EXTRA_NETWORK_NAME = "network_name"
        const val EXTRA_NOTIFICATION_TITLE = "notification_title"
        const val EXTRA_NOTIFICATION_TEXT = "notification_text"
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()

        // Acquire wake lock to prevent CPU from sleeping
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "AndroidIRCX::IRCConnectionWakeLock"
        ).apply {
            setReferenceCounted(false)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action

        // Resolve the notification content for this command up front. This is cheap
        // (reading intent extras) and must run before entering foreground so the
        // very first startForeground() carries the correct title/text.
        when (action) {
            ACTION_START -> {
                val networkName = intent.getStringExtra(EXTRA_NETWORK_NAME) ?: "IRC"
                lastTitle = intent.getStringExtra(EXTRA_NOTIFICATION_TITLE) ?: "IRC Connected"
                lastText = intent.getStringExtra(EXTRA_NOTIFICATION_TEXT)
                    ?: "Maintaining connection to $networkName"
            }

            ACTION_UPDATE -> {
                lastTitle = intent.getStringExtra(EXTRA_NOTIFICATION_TITLE) ?: lastTitle
                lastText = intent.getStringExtra(EXTRA_NOTIFICATION_TEXT) ?: lastText
            }
        }

        // CRITICAL: satisfy the platform's startForeground() deadline immediately for
        // EVERY delivered command - including ACTION_STOP, ACTION_DISCONNECT_QUIT and
        // system restarts with a null/unknown intent. startForegroundService() gives
        // us ~5s to call startForeground(); Crashlytics (v1.9.34, again v1.9.41)
        // showed ForegroundServiceDidNotStartInTimeException whenever onStartCommand
        // returned without having entered foreground - e.g. a stop/update racing the
        // start, or a system-recreated instance. startForeground() is idempotent, so
        // calling it unconditionally here closes every one of those windows.
        val inForeground = enterForeground(lastTitle, lastText)

        when (action) {
            ACTION_STOP -> {
                stopForegroundService()
            }

            ACTION_DISCONNECT_QUIT -> {
                sendDisconnectQuitBroadcast()
                stopForegroundService()
            }

            else -> {
                // ACTION_START, ACTION_UPDATE, or a null/unknown restart intent.
                // We are already in foreground (or were blocked and stopped); just
                // acquire the wake lock once on the first successful start.
                if (inForeground && !isServiceStarted) {
                    wakeLock?.acquire()
                    isServiceStarted = true
                }
            }
        }

        // If service is killed by system, restart it
        return START_STICKY
    }

    /**
     * Enters the foreground synchronously and idempotently. Safe to call on every
     * onStartCommand: repeated calls with the same NOTIFICATION_ID simply refresh
     * the ongoing notification. Returns true when the service is in the foreground
     * afterwards, false when the platform blocked the start (service was stopped).
     */
    private fun enterForeground(title: String, text: String): Boolean {
        val notification = createNotification(title, text)

        return try {
            // Enter foreground with the stable two-argument API first. Satisfying the
            // platform deadline before resolving/applying optional service-type
            // metadata prevents a later typed-start failure from leaving Android
            // waiting for startForeground().
            startForeground(NOTIFICATION_ID, notification)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val manifestType = resolveManifestForegroundServiceType()
                android.util.Log.d(
                    "IRCForegroundService",
                    "Resolved manifest foregroundServiceType=0x${manifestType.toString(16)}"
                )
                try {
                    startForeground(
                        NOTIFICATION_ID,
                        notification,
                        manifestType
                    )
                } catch (typedStartError: Exception) {
                    android.util.Log.w(
                        "IRCForegroundService",
                        "Foreground service already started; continuing without typed update: ${typedStartError.message}",
                        typedStartError
                    )
                }
            }
            true
        } catch (e: android.app.ForegroundServiceStartNotAllowedException) {
            // Android 12+ blocks foreground service start from background
            // Log and fail gracefully - the service will be stopped
            android.util.Log.w(
                "IRCForegroundService",
                "Cannot start foreground service from background (Android 12+ restriction): ${e.message}"
            )
            // Stop the service since we can't go foreground
            stopSelf()
            false
        } catch (e: Exception) {
            android.util.Log.e(
                "IRCForegroundService",
                "Failed to start foreground service: ${e.message}",
                e
            )
            stopSelf()
            false
        }
    }

    private fun resolveManifestForegroundServiceType(): Int {
        return try {
            val component = ComponentName(this, IRCForegroundService::class.java)
            val serviceInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                packageManager.getServiceInfo(
                    component,
                    PackageManager.ComponentInfoFlags.of(0)
                )
            } else {
                @Suppress("DEPRECATION")
                packageManager.getServiceInfo(component, 0)
            }
            val fgsType = serviceInfo.foregroundServiceType
            if (fgsType == 0) {
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING
            } else {
                fgsType
            }
        } catch (e: Exception) {
            android.util.Log.w(
                "IRCForegroundService",
                "Unable to resolve manifest foregroundServiceType, falling back to REMOTE_MESSAGING: ${e.message}"
            )
            android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING
        }
    }

    private fun createNotification(title: String, text: String): Notification {
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val disconnectIntent = Intent(this, IRCForegroundService::class.java).apply {
            action = ACTION_DISCONNECT_QUIT
        }
        val disconnectPendingIntent = PendingIntent.getService(
            this,
            1,
            disconnectIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(pendingIntent)
            .addAction(R.drawable.ic_notification, "Disconnect & Quit", disconnectPendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "IRC Connection Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps IRC connection alive in background"
                setShowBadge(false)
            }

            val notificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    fun updateNotification(title: String, text: String) {
        val notification = createNotification(title, text)
        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    private fun sendDisconnectQuitBroadcast() {
        val intent = Intent(ACTION_DISCONNECT_QUIT_BROADCAST).apply {
            setPackage(packageName)
        }
        try {
            sendBroadcast(intent)
        } catch (e: Exception) {
            android.util.Log.w(
                "IRCForegroundService",
                "Unable to send disconnect broadcast: ${e.message}",
                e
            )
        }
    }

    private fun stopForegroundService() {
        try {
            // Release wake lock first to allow CPU to sleep
            wakeLock?.let {
                if (it.isHeld) {
                    it.release()
                }
            }
            wakeLock = null

            // Stop foreground service immediately
            stopForeground(STOP_FOREGROUND_REMOVE)

            // Stop self - this should complete quickly
            stopSelf()
        } catch (e: Exception) {
            android.util.Log.e("IRCForegroundService", "Error stopping service: ${e.message}", e)
        } finally {
            isServiceStarted = false
        }
    }

    /**
     * Called by Android 14+ when a dataSync foreground service reaches its time limit.
     * The app has a few seconds to stop the service cleanly, otherwise the system
     * will throw ForegroundServiceDidNotStopInTimeException.
     *
     * The remoteMessaging type is used for chat-style persistent connectivity.
     */
    override fun onTimeout(startId: Int, fgsType: Int) {
        android.util.Log.w(
            "IRCForegroundService",
            "Service timeout reached (startId=$startId, fgsType=$fgsType). Stopping service gracefully."
        )

        // Send a broadcast to notify the React Native side about the timeout
        // so it can handle reconnection or notify the user
        val intent = Intent("com.androidircx.action.SERVICE_TIMEOUT").apply {
            setPackage(packageName)
        }
        try {
            sendBroadcast(intent)
        } catch (e: Exception) {
            android.util.Log.w(
                "IRCForegroundService",
                "Unable to send disconnect broadcast: ${e.message}",
                e
            )
        }

        // Stop the service gracefully
        stopForegroundService()
    }

    override fun onDestroy() {
        android.util.Log.d("IRCForegroundService", "onDestroy called")
        try {
            // Release wake lock first
            wakeLock?.let {
                if (it.isHeld) {
                    it.release()
                }
            }
            wakeLock = null

            // CRITICAL: Call stopForeground immediately in onDestroy to prevent
            // ForegroundServiceDidNotStopInTimeException
            stopForeground(STOP_FOREGROUND_REMOVE)
            isServiceStarted = false
        } catch (e: Exception) {
            android.util.Log.e("IRCForegroundService", "Error in onDestroy: ${e.message}", e)
        }
        super.onDestroy()
    }
}
