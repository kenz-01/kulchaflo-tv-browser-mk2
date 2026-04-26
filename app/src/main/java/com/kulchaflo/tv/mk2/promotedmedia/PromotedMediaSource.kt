package com.kulchaflo.tv.mk2.promotedmedia

data class PromotedMediaSource(
    val sourceId: String,
    val kind: Kind,
    val uri: String?,
    val mimeType: String? = null,
    val headers: Map<String, String> = emptyMap(),
    val drmScheme: String? = null,
) {
    enum class Kind {
        EXTRACTED_STREAM,
        PAGE_VIDEO,
        EMBEDDED_WEB_SURFACE,
        UNKNOWN,
    }
}
