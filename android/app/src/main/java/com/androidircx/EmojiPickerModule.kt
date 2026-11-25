package com.androidircx

import android.app.Dialog
import android.view.Gravity
import android.view.ViewGroup
import androidx.emoji2.emojipicker.EmojiPickerView
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * EmojiPickerModule - shows the AndroidX emoji picker and resolves with the
 * emoji the user picks, or null when they close it.
 *
 * Android has no system call that opens an emoji picker; emoji normally come
 * from the keyboard. androidx.emoji2:emoji2-emojipicker is Google's picker
 * view: every emoji, categories, recently used and skin tones, drawn with the
 * system font. It is shown in a dialog anchored to the bottom of the screen.
 */
class EmojiPickerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var dialog: Dialog? = null

    override fun getName(): String = "EmojiPickerModule"

    @ReactMethod
    fun pick(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null || activity.isFinishing) {
            promise.resolve(null)
            return
        }
        activity.runOnUiThread {
            try {
                dialog?.dismiss()
                var settled = false
                val picker = EmojiPickerView(activity)
                val shown = Dialog(activity)
                picker.setOnEmojiPickedListener { item ->
                    if (!settled) {
                        settled = true
                        promise.resolve(item.emoji)
                    }
                    shown.dismiss()
                }
                shown.setContentView(
                    picker,
                    ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT,
                    ),
                )
                shown.setOnDismissListener {
                    if (!settled) {
                        settled = true
                        promise.resolve(null)
                    }
                    if (dialog === shown) dialog = null
                }
                shown.window?.let { window ->
                    window.setGravity(Gravity.BOTTOM)
                    val height = (activity.resources.displayMetrics.heightPixels * 0.55f).toInt()
                    window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, height)
                }
                dialog = shown
                shown.show()
            } catch (e: Exception) {
                promise.reject("EMOJI_PICKER_ERROR", e.message, e)
            }
        }
    }

    override fun invalidate() {
        dialog?.dismiss()
        dialog = null
        super.invalidate()
    }
}
