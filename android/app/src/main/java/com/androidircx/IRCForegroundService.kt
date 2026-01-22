package com.androidircx

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat

class IRCForegroundService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null
    private var isServiceStarted = false

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
        when (intent?.action) {
            ACTION_START -> {
                if (!isServiceStarted) {
                    val networkName = intent.getStringExtra(EXTRA_NETWORK_NAME) ?: "IRC"
                    val title = intent.getStringExtra(EXTRA_NOTIFICATION_TITLE) ?: "IRC Connected"
                    val text = intent.getStringExtra(EXTRA_NOTIFICATION_TEXT)
                        ?: "Maintaining connection to $networkName"

                    startForegroundService(title, text)
                    wakeLock?.acquire()
                    isServiceStarted = true
                }
            }

            ACTION_UPDATE -> {
                if (isServiceStarted) {
                    val title = intent.getStringExtra(EXTRA_NOTIFICATION_TITLE) ?: "IRC Connected"
                    val text = intent.getStringExtra(EXTRA_NOTIFICATION_TEXT) ?: "Connected"
                    updateNotification(title, text)
                }
            }

            ACTION_STOP -> {
                stopForegroundService()
            }

            ACTION_DISCONNECT_QUIT -> {
                sendDisconnectQuitBroadcast()
                stopForegroundService()
            }
        }

        // If service is killed by system, restart it
        return START_STICKY
    }

    private fun startForegroundService(title: String, text: String) {
        val notification = createNotification(title, text)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            // Use DATA_SYNC type for persistent IRC connections
            startForeground(
                NOTIFICATION_ID,
                notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
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
        sendBroadcast(intent)
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
     * The dataSync type has a 6-hour limit per 24-hour period on Android 14+.
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
        sendBroadcast(intent)

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
