package com.androidircx

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.MotionEvent
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  companion object {
    private const val TAG = "MainActivity"
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "AndroidIRCX"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   *
   * When MainApplication could not load React Native's native libraries, the delegate skips
   * onCreate/onDestroy: both reach the ReactHost, which cannot be built without them.
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
        override fun onCreate(savedInstanceState: Bundle?) {
          if (MainApplication.nativeLoadFailed) return
          super.onCreate(savedInstanceState)
        }

        override fun onDestroy() {
          if (MainApplication.nativeLoadFailed) return
          super.onDestroy()
        }
      }

    override fun onCreate(savedInstanceState: Bundle?) {
        if (MainApplication.nativeLoadFailed) {
            // Show the "reinstall from Google Play" screen instead of crashing.
            // finish() inside onCreate goes straight to onDestroy, so no other
            // lifecycle callback touches React Native.
            super.onCreate(null)
            startActivity(Intent(this, NativeLoadErrorActivity::class.java))
            finish()
            return
        }

        super.onCreate(savedInstanceState)

        // Edge-to-edge is enabled (edgeToEdgeEnabled=true); content is laid out
        // under the system bars and safe-area insets handle spacing in JS.
        // Keep app content hidden from screenshots and Android recents/task snapshots.
        // This avoids lock-screen content leaking in recent-app previews.
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )
    }

    /**
     * Android's OverScroller can index its spline table with Integer.MIN_VALUE when a fling has
     * a zero duration, and ScrollView.onInterceptTouchEvent hits it through ReactScrollView
     * (which only catches IllegalArgumentException). Dropping that one touch event is better
     * than crashing; anything else is rethrown untouched.
     */
    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        return try {
            super.dispatchTouchEvent(ev)
        } catch (e: ArrayIndexOutOfBoundsException) {
            if (e.stackTrace.none { it.className.startsWith("android.widget.OverScroller") }) {
                throw e
            }
            Log.w(TAG, "Dropped a touch event after the framework OverScroller bug", e)
            try {
                com.google.firebase.crashlytics.FirebaseCrashlytics.getInstance().recordException(e)
            } catch (ignored: Throwable) {
            }
            true
        }
    }
}
