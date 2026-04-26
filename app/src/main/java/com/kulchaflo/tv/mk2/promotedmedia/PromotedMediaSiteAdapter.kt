package com.kulchaflo.tv.mk2.promotedmedia

interface PromotedMediaSiteAdapter {
    val platformId: String

    fun probe(
        pageUrl: String,
        pageTitle: String?,
    ): ProbeResult?

    fun resolveSource(
        session: PromotedMediaSession,
        context: ResolutionContext,
        callback: (SourceResult) -> Unit,
    )

    data class ProbeResult(
        val session: PromotedMediaSession,
        val eligibility: Eligibility,
        val sourceCandidate: PromotedMediaSource?,
        val reason: String,
    )

    data class SourceResult(
        val source: PromotedMediaSource?,
        val reason: String,
    )

    interface ResolutionContext {
        val pageUrl: String?
        val userAgent: String?

        fun cookiesFor(url: String): String?

        fun evaluateJavascript(
            script: String,
            callback: (String?) -> Unit,
        )
    }

    enum class Eligibility {
        ELIGIBLE,
        NAVIGATION_ONLY,
    }
}
