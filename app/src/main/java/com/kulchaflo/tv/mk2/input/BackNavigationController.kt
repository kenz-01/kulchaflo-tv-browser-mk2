package com.kulchaflo.tv.mk2.input

import androidx.activity.ComponentActivity
import com.kulchaflo.tv.mk2.fullscreen.FullscreenController
import com.kulchaflo.tv.mk2.tabs.TabController
import com.kulchaflo.tv.mk2.ui.tabs.TabsOverlayController
import com.kulchaflo.tv.mk2.util.Logger
import com.kulchaflo.tv.mk2.web.KfWebView

class BackNavigationController(
    private val activity: ComponentActivity,
    private val fullscreenController: FullscreenController,
    private val tabsOverlayController: TabsOverlayController,
    private val imeHandoffController: ImeHandoffController,
    private val tabController: TabController,
    private val onPromotedMediaExitRequested: () -> Boolean = { false },
    private val onFullscreenExited: (KfWebView?) -> Unit = {},
    private val onImeDismissed: (KfWebView?) -> Unit = {},
) {
    fun handleBack(): Boolean {
        val activeTab = tabController.getActiveTab()
        val webView = activeTab?.webView

        if (onPromotedMediaExitRequested()) {
            Logger.d(DEBUG_TAG, "back consumed reason=exit-promoted-media")
            return true
        }

        if (fullscreenController.exitFullscreen()) {
            Logger.d(DEBUG_TAG, "back consumed reason=exit-fullscreen")
            onFullscreenExited(webView)
            return true
        }

        if (tabsOverlayController.hide()) {
            Logger.d(DEBUG_TAG, "back consumed reason=close-tabs-overlay")
            webView?.requestPrimaryFocus()
            return true
        }

        if (imeHandoffController.onBackPressed(webView)) {
            Logger.d(DEBUG_TAG, "back consumed reason=ime-handoff")
            onImeDismissed(webView)
            return true
        }

        // Logic for popup/external tabs
        if (activeTab != null && activeTab.openerTabId != null) {
            if (webView?.canGoBackSafe() == true) {
                Logger.d(DEBUG_TAG, "popup-back decision=go-back id=${activeTab.id}")
                webView.goBack()
                return true
            } else {
                Logger.d(DEBUG_TAG, "popup-back decision=close-tab id=${activeTab.id} opener=${activeTab.openerTabId}")
                tabController.closeTab(activeTab.id)
                return true
            }
        }

        // Default logic for primary tabs
        if (webView?.canGoBack() == true) {
            Logger.d(DEBUG_TAG, "back consumed reason=webview-goBack")
            webView.goBack()
            return true
        }

        // Final exit logic
        if (tabController.getTabs().size <= 1) {
            Logger.d(DEBUG_TAG, "back consumed reason=finish-activity")
            activity.finish()
            return true
        }

        // Fallback for multi-tab state if no specific opener but user wants "out" of current tab
        Logger.d(DEBUG_TAG, "back consumed reason=fallback-close-tab id=${activeTab?.id}")
        activeTab?.id?.let { tabController.closeTab(it) }
        return true
    }

    private companion object {
        private const val DEBUG_TAG = "KfInputDebug"
    }
}
