package com.androidircx

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Shown by MainActivity instead of a crash when MainApplication could not load React Native's
 * native libraries: an install missing this device's ABI split (a sideloaded base APK), or
 * libraries built for another CPU (an arm64 split inside an x86_64 emulator or app cloner).
 * Nothing on device can repair that, so the screen points the user at Google Play. It uses no
 * React Native code, and its strings are translated in res/values-* for every app language.
 */
class NativeLoadErrorActivity : Activity() {

    companion object {
        private const val TAG = "NativeLoadErrorActivity"
        private const val PLAY_PACKAGE = "com.androidircx"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val padding = dp(24)
        val title = TextView(this).apply {
            setText(R.string.native_load_error_title)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
            gravity = Gravity.CENTER
        }
        val message = TextView(this).apply {
            setText(R.string.native_load_error_message)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            gravity = Gravity.CENTER
            setPadding(0, dp(16), 0, dp(24))
        }
        val openPlay = Button(this).apply {
            setText(R.string.native_load_error_open_play)
            setOnClickListener { openPlayStore() }
        }

        setContentView(
            LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                // Edge-to-edge (targetSdk 36): keep the text clear of the system bars.
                fitsSystemWindows = true
                setPadding(padding, padding, padding, padding)
                addView(title)
                addView(message)
                addView(openPlay)
            }
        )
    }

    private fun openPlayStore() {
        val targets = listOf(
            "market://details?id=$PLAY_PACKAGE",
            "https://play.google.com/store/apps/details?id=$PLAY_PACKAGE",
        )
        for (target in targets) {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(target)))
                finish()
                return
            } catch (e: ActivityNotFoundException) {
                Log.w(TAG, "No app can open $target", e)
            }
        }
    }

    private fun dp(value: Int): Int =
        TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value.toFloat(),
            resources.displayMetrics,
        ).toInt()
}
