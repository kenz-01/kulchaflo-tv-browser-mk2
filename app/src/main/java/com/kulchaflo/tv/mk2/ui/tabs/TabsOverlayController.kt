package com.kulchaflo.tv.mk2.ui.tabs

import android.view.ViewGroup
import androidx.core.view.isVisible
import com.kulchaflo.tv.mk2.tabs.BrowserTab
import com.kulchaflo.tv.mk2.util.Logger

class TabsOverlayController(
    private val container: ViewGroup,
    private val tabStripView: TabStripView,
) {
    interface Listener {
        fun onTabActivatedFromOverlay(tabId: String)
        fun onTabCloseRequestedFromOverlay(tabId: String)
    }

    private var listener: Listener? = null

    init {
        container.addView(tabStripView)
        tabStripView.setListener(
            object : TabStripView.Listener {
                override fun onTabActivated(tabId: String) {
                    listener?.onTabActivatedFromOverlay(tabId)
                }

                override fun onTabCloseRequested(tabId: String) {
                    listener?.onTabCloseRequestedFromOverlay(tabId)
                }
            },
        )
    }

    fun setListener(listener: Listener) {
        this.listener = listener
    }

    fun show(tabs: List<BrowserTab>, activeTabId: String?) {
        tabStripView.renderTabs(tabs, activeTabId)
        container.isVisible = true
        Logger.d(DEBUG_TAG, "show tabs=${tabs.size} activeTabId=$activeTabId")
        tabStripView.requestFocus()
    }

    fun refresh(tabs: List<BrowserTab>, activeTabId: String?) {
        if (!container.isVisible) return
        Logger.d(DEBUG_TAG, "refresh tabs=${tabs.size} activeTabId=$activeTabId")
        tabStripView.renderTabs(tabs, activeTabId)
        tabStripView.requestPrimaryFocus()
    }

    fun hide(): Boolean {
        if (!container.isVisible) return false
        container.isVisible = false
        Logger.d(DEBUG_TAG, "hide")
        return true
    }

    fun isVisible(): Boolean = container.isVisible

    fun requestPrimaryFocus(): Boolean = tabStripView.requestPrimaryFocus()

    fun hasFocusWithin(): Boolean = tabStripView.hasFocus()

    private companion object {
        private const val DEBUG_TAG = "KfTabDebug"
    }
}
