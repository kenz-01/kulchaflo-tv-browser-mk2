package com.kulchaflo.tv.mk2.tabs

import com.kulchaflo.tv.mk2.input.FocusRecoveryController
import com.kulchaflo.tv.mk2.util.Logger
import com.kulchaflo.tv.mk2.util.UrlRouter
import com.kulchaflo.tv.mk2.web.KfWebViewFactory
import java.util.UUID

class TabController(
    private val repository: TabRepository,
    private val webViewFactory: KfWebViewFactory,
    private val focusRecoveryController: FocusRecoveryController,
    private val listener: Listener,
) {
    interface Listener {
        fun onTabCreated(tab: BrowserTab, activate: Boolean)
        fun onTabClosed(tab: BrowserTab)
        fun onTabActivated(tab: BrowserTab)
    }

    fun createTab(url: String, activate: Boolean): BrowserTab {
        val tab = BrowserTab(
            id = UUID.randomUUID().toString(),
            initialUrl = UrlRouter.normalize(url),
            webView = webViewFactory.create(),
        )
        repository.put(tab)
        Logger.d(DEBUG_TAG, "create id=${tab.id} activate=$activate url=${tab.initialUrl}")
        listener.onTabCreated(tab, activate)
        if (activate) {
            activateTab(tab.id)
        } else {
            tab.webView.loadUrl(tab.initialUrl)
        }
        return tab
    }

    fun createPopupTab(activate: Boolean): BrowserTab {
        val openerId = repository.getActiveTab()?.id
        val tab = BrowserTab(
            id = UUID.randomUUID().toString(),
            initialUrl = ABOUT_BLANK_URL,
            webView = webViewFactory.create(),
            openerTabId = openerId,
        )
        repository.put(tab)
        Logger.d(DEBUG_TAG, "create-popup id=${tab.id} activate=$activate opener=$openerId")
        listener.onTabCreated(tab, activate)
        if (activate) {
            activateTab(tab.id)
        }
        return tab
    }

    fun closeTab(tabId: String): Boolean {
        val tab = repository.get(tabId) ?: return false
        val wasActive = repository.getActiveTab()?.id == tabId
        Logger.d(DEBUG_TAG, "close-tab id=$tabId wasActive=$wasActive")

        if (wasActive) {
            val fallback = if (tab.openerTabId != null) {
                val opener = repository.get(tab.openerTabId)
                if (opener != null) {
                    Logger.d(DEBUG_TAG, "close-tab activate-opener id=${opener.id}")
                    opener
                } else {
                    findBestFallbackTab(tabId)
                }
            } else {
                findBestFallbackTab(tabId)
            }

            repository.setActiveTab(fallback?.id)
            fallback?.let {
                it.webView.notifyBecameActiveTab()
                focusRecoveryController.onTabActivated(it.webView)
                listener.onTabActivated(it)
            }
            Logger.d(DEBUG_TAG, "close-tab final-active id=${repository.getActiveTab()?.id}")
        }

        repository.remove(tabId)
        tab.webView.notifyLostActiveTab()
        tab.webView.destroy()
        listener.onTabClosed(tab)
        return true
    }

    private fun findBestFallbackTab(closingTabId: String): BrowserTab? {
        val allTabs = repository.getAll()
        // Prefer first non-popup tab that isn't the one closing
        val primaryFallback = allTabs.firstOrNull { it.id != closingTabId && it.openerTabId == null }
        if (primaryFallback != null) {
            Logger.d(DEBUG_TAG, "close-tab fallback-primary id=${primaryFallback.id}")
            return primaryFallback
        }
        // Otherwise just last remaining tab
        val lastFallback = allTabs.lastOrNull { it.id != closingTabId }
        Logger.d(DEBUG_TAG, "close-tab fallback-last id=${lastFallback?.id}")
        return lastFallback
    }

    fun activateTab(tabId: String): Boolean {
        val target = repository.get(tabId) ?: return false
        if (repository.getActiveTab()?.id == tabId) {
            Logger.d(DEBUG_TAG, "activate id=$tabId alreadyActive=true")
            focusRecoveryController.onTabActivated(target.webView)
            return true
        }
        Logger.d(DEBUG_TAG, "activate id=$tabId alreadyActive=false")
        repository.getActiveTab()?.webView?.notifyLostActiveTab()
        repository.setActiveTab(tabId)
        target.webView.notifyBecameActiveTab()
        if (target.webView.url.isNullOrBlank() && target.initialUrl != ABOUT_BLANK_URL) {
            target.webView.loadUrl(target.initialUrl)
        }
        focusRecoveryController.onTabActivated(target.webView)
        listener.onTabActivated(target)
        return true
    }

    fun getActiveTab(): BrowserTab? = repository.getActiveTab()

    fun getTabs(): List<BrowserTab> = repository.getAll()

    fun updateActiveTabTitle(title: String?) {
        val active = repository.getActiveTab() ?: return
        val normalized = title?.takeIf { it.isNotBlank() }
        if (active.title == normalized) {
            return
        }
        active.title = normalized
        Logger.d(DEBUG_TAG, "title-update id=${active.id} title=${normalized ?: "<blank>"}")
    }

    private companion object {
        private const val ABOUT_BLANK_URL = "about:blank"
        private const val DEBUG_TAG = "KfTabDebug"
    }
}
