package com.kulchaflo.tv.mk2.tabs

class TabRepository {
    private val tabs = linkedMapOf<String, BrowserTab>()
    private var activeTabId: String? = null

    fun put(tab: BrowserTab) {
        tabs[tab.id] = tab
    }

    fun remove(tabId: String): BrowserTab? = tabs.remove(tabId)

    fun get(tabId: String): BrowserTab? = tabs[tabId]

    fun getAll(): List<BrowserTab> = tabs.values.toList()

    fun setActiveTab(tabId: String?) {
        activeTabId = tabId
    }

    fun getActiveTab(): BrowserTab? = activeTabId?.let(tabs::get)
}
