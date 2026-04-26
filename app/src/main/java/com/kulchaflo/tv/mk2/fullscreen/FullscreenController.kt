package com.kulchaflo.tv.mk2.fullscreen

import android.view.SurfaceView
import android.view.TextureView
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.view.WindowManager
import android.webkit.WebChromeClient
import androidx.core.view.isVisible
import com.kulchaflo.tv.mk2.util.Logger

class FullscreenController(
    private val hostView: ViewGroup,
) {
    enum class FullscreenMode {
        VIDEO_FULLSCREEN,
        PAGE_FULLSCREEN,
    }

    data class ViewClassification(
        val kind: String,
        val stats: ViewTreeStats,
    )

    interface Listener {
        fun onFullscreenEntered(mode: FullscreenMode)
        fun onFullscreenExited()
    }

    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private var listener: Listener? = null
    private var fullscreenMode: FullscreenMode? = null
    private var lastClassification: ViewClassification? = null

    fun setListener(listener: Listener) {
        this.listener = listener
    }

    fun enterFullscreen(view: View?, callback: WebChromeClient.CustomViewCallback?): ViewClassification? {
        if (view == null) {
            Logger.w(DEBUG_TAG, "enter aborted reason=null-view")
            return null
        }
        exitFullscreen()
        customView = view
        customViewCallback = callback
        hostView.removeAllViews()
        hostView.addView(
            view,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            ),
        )
        hostView.setBackgroundColor(android.graphics.Color.BLACK)
        hostView.isVisible = true
        hostView.keepScreenOn = true
        hostView.bringToFront()
        hostView.addFlagsForWindow()
        hostView.requestLayout()
        view.requestFocus()
        Logger.i(
            DEBUG_TAG,
            "enter view=${view.javaClass.simpleName} hostChildren=${hostView.childCount} hostWidth=${hostView.width} hostHeight=${hostView.height}"
        )
        val initialClassification = logCustomViewTree("enter", view)
        lastClassification = initialClassification
        fullscreenMode = initialClassification.toFullscreenMode()
        view.post {
            logCustomViewTree("post-layout", view)
        }
        view.postDelayed({
            logCustomViewTree("post-delay-150ms", view)
        }, 150L)
        view.postDelayed({
            logCustomViewTree("post-delay-500ms", view)
        }, 500L)
        Logger.i(DEBUG_TAG, "mode=${fullscreenMode?.logName ?: "unknown"}")
        listener?.onFullscreenEntered(fullscreenMode ?: FullscreenMode.PAGE_FULLSCREEN)
        return initialClassification
    }

    fun exitFullscreen(): Boolean {
        val activeView = customView ?: return false
        hostView.removeView(activeView)
        hostView.isVisible = false
        hostView.keepScreenOn = false
        hostView.clearFlagsForWindow()
        customView = null
        val exitedMode = fullscreenMode
        fullscreenMode = null
        lastClassification = null
        customViewCallback?.onCustomViewHidden()
        customViewCallback = null
        Logger.i(DEBUG_TAG, "exit mode=${exitedMode?.logName ?: "unknown"} hostChildren=${hostView.childCount}")
        listener?.onFullscreenExited()
        return true
    }

    fun isFullscreen(): Boolean = customView != null
    fun currentMode(): FullscreenMode? = fullscreenMode
    fun isVideoFullscreen(): Boolean = fullscreenMode == FullscreenMode.VIDEO_FULLSCREEN
    fun isPageFullscreen(): Boolean = fullscreenMode == FullscreenMode.PAGE_FULLSCREEN
    fun currentCustomView(): View? = customView
    fun currentClassification(): ViewClassification? = lastClassification
    fun currentPageFullscreenInputTarget(): View? = if (isPageFullscreen()) customView else null
    fun currentPageFullscreenFallbackTarget(): View? = if (isPageFullscreen()) hostView else null

    private fun ViewGroup.addFlagsForWindow() {
        (rootView?.context as? android.app.Activity)?.window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    private fun ViewGroup.clearFlagsForWindow() {
        (rootView?.context as? android.app.Activity)?.window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    private fun logCustomViewTree(phase: String, root: View): ViewClassification {
        val summary = mutableListOf<String>()
        val stats = ViewTreeStats()
        appendViewNode(
            view = root,
            depth = 0,
            maxDepth = 4,
            maxChildrenPerNode = 6,
            lines = summary,
            stats = stats,
        )
        val classification = classify(stats)
        Logger.i(
            DEBUG_TAG,
            "custom-view phase=$phase classification=${classification.kind} stats=viewGroups=${stats.viewGroups} surfaceViews=${stats.surfaceViews} textureViews=${stats.textureViews} webViews=${stats.webViews} leafViews=${stats.leafViews}"
        )
        summary.forEach { line ->
            Logger.i(DEBUG_TAG, "custom-view phase=$phase $line")
        }
        return classification
    }

    private fun appendViewNode(
        view: View,
        depth: Int,
        maxDepth: Int,
        maxChildrenPerNode: Int,
        lines: MutableList<String>,
        stats: ViewTreeStats,
    ) {
        val indent = "  ".repeat(depth)
        val className = view.javaClass.name
        val width = view.width
        val height = view.height
        val measuredWidth = view.measuredWidth
        val measuredHeight = view.measuredHeight
        val visibility = when (view.visibility) {
            View.VISIBLE -> "VISIBLE"
            View.INVISIBLE -> "INVISIBLE"
            View.GONE -> "GONE"
            else -> view.visibility.toString()
        }
        val childCount = (view as? ViewGroup)?.childCount ?: 0
        lines += "${indent}node=$className visibility=$visibility width=$width height=$height measured=${measuredWidth}x$measuredHeight children=$childCount"

        when (view) {
            is SurfaceView -> stats.surfaceViews += 1
            is TextureView -> stats.textureViews += 1
            is android.webkit.WebView -> stats.webViews += 1
            is ViewGroup -> stats.viewGroups += 1
            else -> stats.leafViews += 1
        }

        if (depth >= maxDepth) return
        val group = view as? ViewGroup ?: return
        val limit = minOf(group.childCount, maxChildrenPerNode)
        repeat(limit) { index ->
            appendViewNode(
                view = group.getChildAt(index),
                depth = depth + 1,
                maxDepth = maxDepth,
                maxChildrenPerNode = maxChildrenPerNode,
                lines = summarySafe(lines),
                stats = stats,
            )
        }
        if (group.childCount > limit) {
            lines += "${indent}  ... truncatedChildren=${group.childCount - limit}"
        }
    }

    private fun summarySafe(lines: MutableList<String>): MutableList<String> = lines

    private fun classify(stats: ViewTreeStats): ViewClassification {
        val kind = if (stats.surfaceViews > 0 || stats.textureViews > 0) {
            "real_surface"
        } else {
            "web_wrapper"
        }
        return ViewClassification(kind = kind, stats = stats)
    }

    data class ViewTreeStats(
        var viewGroups: Int = 0,
        var surfaceViews: Int = 0,
        var textureViews: Int = 0,
        var webViews: Int = 0,
        var leafViews: Int = 0,
    )

    private fun ViewClassification.toFullscreenMode(): FullscreenMode {
        return if (kind == "real_surface") {
            FullscreenMode.VIDEO_FULLSCREEN
        } else {
            FullscreenMode.PAGE_FULLSCREEN
        }
    }

    private val FullscreenMode.logName: String
        get() = when (this) {
            FullscreenMode.VIDEO_FULLSCREEN -> "video_fullscreen"
            FullscreenMode.PAGE_FULLSCREEN -> "page_fullscreen"
        }

    private companion object {
        private const val DEBUG_TAG = "KfFullscreenDebug"
    }
}
