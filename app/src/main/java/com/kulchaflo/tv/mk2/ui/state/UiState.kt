package com.kulchaflo.tv.mk2.ui.state

data class UiState(
    val isTabsOverlayVisible: Boolean = false,
    val isFullscreen: Boolean = false,
    val activeTabId: String? = null
)
