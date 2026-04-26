package com.kulchaflo.tv.mk2.web

import android.content.Context
import android.webkit.CookieManager
import android.util.AttributeSet
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.core.content.ContextCompat
import com.kulchaflo.tv.mk2.R

class KfWebView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : WebView(context, attrs) {

    companion object {
        const val INITIAL_SCALE_PERCENT = 86
        private const val ABOUT_BLANK = "about:blank"
    }

    init {
        isFocusable = true
        isFocusableInTouchMode = true
        setBackgroundColor(ContextCompat.getColor(context, R.color.kf_background))
        overScrollMode = OVER_SCROLL_NEVER
        setInitialScale(INITIAL_SCALE_PERCENT)
    }

    fun applyTvDefaults() {
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(this, true)
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.loadsImagesAutomatically = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.allowContentAccess = true
        settings.allowFileAccess = false
        settings.setSupportMultipleWindows(true)
        settings.javaScriptCanOpenWindowsAutomatically = true
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.setSupportZoom(false)
        settings.textZoom = 100
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        isHorizontalScrollBarEnabled = false
        isVerticalScrollBarEnabled = false
        scrollBarStyle = SCROLLBARS_OUTSIDE_OVERLAY
    }

    fun describeSettingsSnapshot(): String {
        val s = settings
        return buildString {
            append("ua=").append(s.userAgentString)
            append(" useWideViewPort=").append(s.useWideViewPort)
            append(" loadWithOverviewMode=").append(s.loadWithOverviewMode)
            append(" textZoom=").append(s.textZoom)
            append(" mediaPlaybackRequiresUserGesture=").append(s.mediaPlaybackRequiresUserGesture)
            append(" javaScriptEnabled=").append(s.javaScriptEnabled)
            append(" domStorageEnabled=").append(s.domStorageEnabled)
            append(" supportMultipleWindows=").append(s.supportMultipleWindows())
            append(" javaScriptCanOpenWindowsAutomatically=").append(s.javaScriptCanOpenWindowsAutomatically)
            append(" mixedContentMode=").append(s.mixedContentMode)
            append(" initialScale=").append(INITIAL_SCALE_PERCENT)
        }
    }

    fun requestPrimaryFocus(): Boolean {
        requestFocus()
        requestFocusFromTouch()
        return true
    }

    fun notifyBecameActiveTab() {
        onResume()
        resumeTimers()
        requestPrimaryFocus()
    }

    fun notifyLostActiveTab() {
        onPause()
    }

    /**
     * Popup tabs often start with about:blank in their history.
     * We want to avoid Back button landing on a black/blank screen.
     */
    fun canGoBackSafe(): Boolean {
        if (!canGoBack()) return false
        
        val list = copyBackForwardList()
        val currentIndex = list.currentIndex
        if (currentIndex <= 0) return false
        
        val backItem = list.getItemAtIndex(currentIndex - 1)
        val backUrl = backItem?.url ?: ""
        
        // If going back leads to about:blank, treat it as "cannot go back safe"
        return backUrl != ABOUT_BLANK && backUrl.isNotBlank()
    }
}
