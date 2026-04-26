package com.kulchaflo.tv.mk2.util

import android.util.Log
import com.kulchaflo.tv.mk2.BuildConfig

object Logger {
    private const val APP_TAG = "KfMkII"

    fun d(tag: String, message: String) {
        if (!BuildConfig.DEBUG) return
        Log.d("$APP_TAG:$tag", message)
    }

    fun i(tag: String, message: String) {
        Log.i("$APP_TAG:$tag", message)
    }

    fun w(tag: String, message: String, throwable: Throwable? = null) {
        Log.w("$APP_TAG:$tag", message, throwable)
    }

    fun e(tag: String, message: String, throwable: Throwable? = null) {
        Log.e("$APP_TAG:$tag", message, throwable)
    }
}
