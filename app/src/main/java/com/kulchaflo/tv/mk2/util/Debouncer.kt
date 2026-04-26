package com.kulchaflo.tv.mk2.util

import android.os.Handler
import android.os.Looper

class Debouncer(
    private val handler: Handler = Handler(Looper.getMainLooper())
) {
    private var pending: Runnable? = null

    fun submit(delayMs: Long, block: () -> Unit) {
        pending?.let(handler::removeCallbacks)
        pending = Runnable(block).also { handler.postDelayed(it, delayMs) }
    }

    fun cancel() {
        pending?.let(handler::removeCallbacks)
        pending = null
    }
}
