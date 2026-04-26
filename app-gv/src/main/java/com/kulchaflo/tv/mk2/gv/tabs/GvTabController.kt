package com.kulchaflo.tv.mk2.gv.tabs

import org.mozilla.geckoview.GeckoRuntime
import org.mozilla.geckoview.GeckoSession

class GvTabController(
    private val runtime: GeckoRuntime,
    private val sessionInitializer: (GvTab) -> Unit,
    private val listener: Listener,
) {
    private val tabs = mutableListOf<GvTab>()
    private var activeTabId: String? = null

    interface Listener {
        fun onTabCreated(tab: GvTab)
        fun onTabActivated(tab: GvTab)
        fun onTabClosed(tab: GvTab)
        fun onTabsChanged(tabs: List<GvTab>, activeTabId: String?)
    }

    fun createTab(initialUrl: String, activate: Boolean = true): GvTab {
        val session = GeckoSession()
        session.open(runtime)
        val tab = GvTab(session = session, url = initialUrl)
        sessionInitializer(tab)
        tabs += tab
        listener.onTabCreated(tab)
        if (activate || activeTabId == null) {
            activateTab(tab.id)
        } else {
            notifyTabsChanged()
        }
        session.loadUri(initialUrl)
        return tab
    }

    fun createUnopenedTab(initialUrl: String, activate: Boolean = true): GvTab {
        val session = GeckoSession()
        val tab = GvTab(session = session, url = initialUrl)
        sessionInitializer(tab)
        tabs += tab
        listener.onTabCreated(tab)
        if (activate || activeTabId == null) {
            activateTab(tab.id)
        } else {
            notifyTabsChanged()
        }
        return tab
    }

    fun activateTab(tabId: String): Boolean {
        val tab = tabs.firstOrNull { it.id == tabId } ?: return false
        activeTabId = tabId
        listener.onTabActivated(tab)
        notifyTabsChanged()
        return true
    }

    fun closeTab(tabId: String): Boolean {
        val index = tabs.indexOfFirst { it.id == tabId }
        if (index == -1) return false
        val removed = tabs.removeAt(index)
        runCatching { removed.session.close() }
        listener.onTabClosed(removed)
        if (removed.id == activeTabId) {
            activeTabId = tabs.getOrNull(index.coerceAtMost(tabs.lastIndex))?.id
                ?: tabs.lastOrNull()?.id
            activeTabId?.let { newActive ->
                tabs.firstOrNull { it.id == newActive }?.let(listener::onTabActivated)
            }
        }
        notifyTabsChanged()
        return true
    }

    fun updateTitle(session: GeckoSession, title: String?) {
        findTab(session)?.let {
            it.title = title?.ifBlank { it.url } ?: it.url
            notifyTabsChanged()
        }
    }

    fun updateLocation(session: GeckoSession, url: String?) {
        val newUrl = url?.ifBlank { null } ?: return
        findTab(session)?.let {
            it.url = newUrl
            if (it.title.isBlank() || it.title == it.id) {
                it.title = newUrl
            }
            notifyTabsChanged()
        }
    }

    fun updateCanGoBack(session: GeckoSession, canGoBack: Boolean) {
        findTab(session)?.let {
            it.canGoBack = canGoBack
            notifyTabsChanged()
        }
    }

    fun updateLoading(session: GeckoSession, isLoading: Boolean) {
        findTab(session)?.let {
            it.isLoading = isLoading
            notifyTabsChanged()
        }
    }

    fun findTabBySession(session: GeckoSession): GvTab? = findTab(session)

    fun getActiveTab(): GvTab? = activeTabId?.let { id -> tabs.firstOrNull { it.id == id } }

    fun getTabs(): List<GvTab> = tabs.toList()

    fun closeAll() {
        val closing = tabs.toList()
        tabs.clear()
        activeTabId = null
        closing.forEach {
            runCatching { it.session.close() }
            listener.onTabClosed(it)
        }
        notifyTabsChanged()
    }

    private fun findTab(session: GeckoSession): GvTab? = tabs.firstOrNull { it.session == session }

    private fun notifyTabsChanged() {
        listener.onTabsChanged(tabs.toList(), activeTabId)
    }
}
