package com.kulchaflo.tv.mk2.tabs

import com.kulchaflo.tv.mk2.web.KfWebView
import com.kulchaflo.tv.mk2.web.WebSessionState

data class BrowserTab(
    val id: String,
    val initialUrl: String,
    val webView: KfWebView,
    val sessionState: WebSessionState = WebSessionState(),
    var title: String? = null,
    val openerTabId: String? = null,
)
