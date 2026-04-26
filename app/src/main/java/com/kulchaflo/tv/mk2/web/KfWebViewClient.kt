package com.kulchaflo.tv.mk2.web

import android.graphics.Bitmap
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import com.kulchaflo.tv.mk2.input.FocusRecoveryController
import com.kulchaflo.tv.mk2.util.Logger

class KfWebViewClient(
    private val compatRegistry: WebCompatRegistry,
    private val focusRecoveryController: FocusRecoveryController,
    private val callbacks: Callbacks,
) : WebViewClient() {

    interface Callbacks {
        fun onPageStarted(url: String?)
        fun onPageFinished(url: String?)
        fun onUrlChanged(url: String?)
        fun onPopupProxyNavigation(view: WebView?, url: String): Boolean
    }

    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
        compatRegistry.onBeforePageLoad(url.orEmpty())
        logYouTubeRoute("page-started", url)
        callbacks.onPageStarted(url)
    }

    override fun onPageFinished(view: WebView?, url: String?) {
        logYouTubeRoute("page-finished", url)
        callbacks.onPageFinished(url)
        callbacks.onUrlChanged(url)
        focusRecoveryController.onPageFinished(view as? KfWebView)
    }

    override fun doUpdateVisitedHistory(view: WebView?, url: String?, isReload: Boolean) {
        logYouTubeRoute("visited-history", url)
        callbacks.onUrlChanged(url)
    }

    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        val url = request?.url?.toString() ?: return false
        val uri = request.url

        if (callbacks.onPopupProxyNavigation(view, url)) {
            return true
        }

        if (uri.scheme == "fb") {
            val currentUrl = view?.url ?: ""
            if (isFacebookRelated(currentUrl)) {
                view?.let {
                    val handler = FacebookMediaHandoffHandler(it)
                    if (handler.handleFacebookScheme(url)) {
                        return true
                    }
                }
            } else {
                // Even if not strictly on facebook.com, block fb:// to avoid error pages
                Logger.w("KfWebViewClient", "blocking fb scheme on non-facebook page currentUrl=$currentUrl targetUrl=$url")
                return true
            }
        }

        return false
    }

    private fun isFacebookRelated(url: String): Boolean {
        return url.contains("facebook.com", ignoreCase = true) || url.contains("fb.com", ignoreCase = true)
    }

    private fun logYouTubeRoute(phase: String, url: String?) {
        if (url.isNullOrBlank()) return
        val host = runCatching { Uri.parse(url).host.orEmpty() }.getOrDefault("")
        when {
            host.equals("consent.youtube.com", ignoreCase = true) -> {
                Logger.i("KfYouTubeRoute", "phase=$phase page=consent url=$url")
            }
            host.contains("youtube.com", ignoreCase = true) || host.equals("youtu.be", ignoreCase = true) -> {
                Logger.i("KfYouTubeRoute", "phase=$phase page=youtube url=$url")
            }
        }
    }
}
