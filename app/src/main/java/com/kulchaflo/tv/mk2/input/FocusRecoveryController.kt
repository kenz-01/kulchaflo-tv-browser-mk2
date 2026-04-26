package com.kulchaflo.tv.mk2.input

import android.os.Handler
import android.os.Looper
import android.view.View
import com.kulchaflo.tv.mk2.util.Logger
import com.kulchaflo.tv.mk2.web.KfWebView

class FocusRecoveryController(
    private val handler: Handler = Handler(Looper.getMainLooper())
) {
    private var pendingFocusRunnable: Runnable? = null
    private var pendingTarget: KfWebView? = null

    fun onPageFinished(webView: KfWebView?) {
        Logger.d(DEBUG_TAG, "schedule reason=page-finished delayMs=160 hasTarget=${webView != null}")
        schedulePrimaryFocus(webView, 160L)
    }

    fun onTabActivated(webView: KfWebView?) {
        Logger.d(DEBUG_TAG, "schedule reason=tab-activated delayMs=90 hasTarget=${webView != null}")
        schedulePrimaryFocus(webView, 90L)
    }

    fun onFullscreenExited(webView: KfWebView?) {
        Logger.d(DEBUG_TAG, "schedule reason=fullscreen-exited delayMs=100 hasTarget=${webView != null}")
        schedulePrimaryFocus(webView, 100L)
    }

    fun onImeDismissed(webView: KfWebView?) {
        Logger.d(DEBUG_TAG, "schedule reason=ime-dismissed delayMs=140 hasTarget=${webView != null}")
        schedulePrimaryFocus(webView, 140L)
    }

    private fun schedulePrimaryFocus(webView: KfWebView?, delayMs: Long) {
        if (webView == null) return
        pendingFocusRunnable?.let(handler::removeCallbacks)
        pendingTarget = webView
        val runnable = Runnable {
            val target = pendingTarget ?: return@Runnable
            if (target.isAttachedToWindow && target.visibility == View.VISIBLE) {
                Logger.d(DEBUG_TAG, "execute attached=true visible=true")
                target.requestPrimaryFocus()
            } else {
                Logger.d(
                    DEBUG_TAG,
                    "skip attached=${target.isAttachedToWindow} visible=${target.visibility == View.VISIBLE}",
                )
            }
            pendingTarget = null
            pendingFocusRunnable = null
        }
        pendingFocusRunnable = runnable
        handler.postDelayed(runnable, delayMs)
    }

    private companion object {
        private const val DEBUG_TAG = "KfFocusDebug"
    }
}
