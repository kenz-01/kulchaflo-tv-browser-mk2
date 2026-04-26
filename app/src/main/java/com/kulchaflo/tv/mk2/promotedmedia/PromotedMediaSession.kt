package com.kulchaflo.tv.mk2.promotedmedia

data class PromotedMediaSession(
    val platformId: String,
    val pageUrl: String,
    val pageTitle: String?,
    val pageKind: String,
    val contentId: String?,
    val mediaTitle: String?,
    val metadata: Map<String, String> = emptyMap(),
)
