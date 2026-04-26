package com.kulchaflo.tv.mk2.web

import android.graphics.Bitmap
import android.os.Message
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import com.kulchaflo.tv.mk2.fullscreen.FullscreenController
import com.kulchaflo.tv.mk2.util.Logger

class KfWebChromeClient(
    private val fullscreenController: FullscreenController,
    private val permissionController: WebPermissionController,
    private val callbacks: Callbacks,
) : WebChromeClient() {

    interface Callbacks {
        fun onTitleReceived(title: String?)
        fun onProgressChanged(progress: Int)
        fun onCreateWindowRequested(
            sourceView: WebView?,
            isDialog: Boolean,
            isUserGesture: Boolean,
            resultMsg: Message?,
        ): Boolean
        fun onIconReceived(icon: Bitmap?)
    }

    override fun onReceivedTitle(view: WebView?, title: String?) {
        callbacks.onTitleReceived(title)
    }

    override fun onProgressChanged(view: WebView?, newProgress: Int) {
        callbacks.onProgressChanged(newProgress)
    }

    override fun onReceivedIcon(view: WebView?, icon: Bitmap?) {
        callbacks.onIconReceived(icon)
    }

    override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
        val viewType = view?.javaClass?.name ?: "null"
        val width = view?.width ?: -1
        val height = view?.height ?: -1
        Logger.i(TAG, "!!! onShowCustomView ENTERED !!! type=$viewType width=$width height=$height hasCallback=${callback != null}")
        val classification = fullscreenController.enterFullscreen(view, callback)
        if (classification != null) {
            val mode = if (classification.kind == "real_surface") "video_fullscreen" else "page_fullscreen"
            Logger.i(
                TAG,
                "onShowCustomView mode=$mode classification=${classification.kind} surfaceViews=${classification.stats.surfaceViews} textureViews=${classification.stats.textureViews} webViews=${classification.stats.webViews} viewGroups=${classification.stats.viewGroups}"
            )
        }
    }

    override fun onHideCustomView() {
        val mode = when {
            fullscreenController.isVideoFullscreen() -> "video_fullscreen"
            fullscreenController.isPageFullscreen() -> "page_fullscreen"
            else -> "none"
        }
        Logger.i(TAG, "!!! onHideCustomView ENTERED !!! active=${fullscreenController.isFullscreen()} mode=$mode")
        fullscreenController.exitFullscreen()
    }

    override fun onPermissionRequest(request: PermissionRequest?) {
        permissionController.handle(request)
    }

    override fun onCreateWindow(
        view: WebView?,
        isDialog: Boolean,
        isUserGesture: Boolean,
        resultMsg: Message?,
    ): Boolean {
        // New windows are routed into a new tab instead of relying on the default popup behavior.
        return callbacks.onCreateWindowRequested(view, isDialog, isUserGesture, resultMsg)
    }

    override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
        consoleMessage?.let {
            when {
                it.message().startsWith("KF_FB_HANDOFF") -> {
                    Logger.d("FacebookJsDebug", "[JS] ${it.message()}")
                }
                it.message().startsWith("KF_YT_FULLSCREEN") -> {
                    Logger.d("YouTubeJsDebug", "[JS] ${it.message()}")
                }
                it.message().startsWith("KF_MEDIA_FS") -> {
                    Logger.d("KfDomFullscreenDebug", "[JS] ${it.message()}")
                }
            }
        }
        return super.onConsoleMessage(consoleMessage)
    }

    private companion object {
        private const val TAG = "KfWebChromeClient"
    }
}
