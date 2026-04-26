package com.kulchaflo.tv.mk2.web

data class WebSessionState(
    val currentUrl: String? = null,
    val pageTitle: String? = null,
    val isLoading: Boolean = false,
)
