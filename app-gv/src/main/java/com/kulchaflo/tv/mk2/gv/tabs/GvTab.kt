package com.kulchaflo.tv.mk2.gv.tabs

import org.mozilla.geckoview.GeckoSession
import java.util.UUID

data class GvTab(
    val id: String = UUID.randomUUID().toString(),
    val session: GeckoSession,
    var url: String,
    var title: String = url,
    var canGoBack: Boolean = false,
    var isLoading: Boolean = false,
)
