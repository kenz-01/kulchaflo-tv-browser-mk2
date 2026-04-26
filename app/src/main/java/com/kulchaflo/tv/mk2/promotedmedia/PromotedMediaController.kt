package com.kulchaflo.tv.mk2.promotedmedia

import com.kulchaflo.tv.mk2.util.Logger

class PromotedMediaController(
    private val hostView: PromotedMediaHostView,
    private val adapters: List<PromotedMediaSiteAdapter>,
    private val player: PromotedMediaPlayer,
    private val resolutionContextProvider: () -> PromotedMediaSiteAdapter.ResolutionContext?,
) {
    private var state: PromotedMediaState = PromotedMediaState.BROWSER
    private var eligibleProbe: PromotedMediaSiteAdapter.ProbeResult? = null
    private var eligibleSession: PromotedMediaSession? = null
    private var activeSession: PromotedMediaSession? = null
    private var activeRenderView: android.view.View? = null
    private var resolutionToken: Long = 0L
    private var lastAutoEnterPageUrl: String? = null

    fun enterBrowserMode(reason: String) {
        transitionTo(PromotedMediaState.BROWSER, "browser mode reason=$reason")
        hostView.visibility = android.view.View.GONE
        Logger.i(TAG, "mode=browser reason=$reason activeSession=${activeSession?.pageUrl ?: "none"}")
    }

    fun evaluatePage(
        pageUrl: String?,
        pageTitle: String?,
    ) {
        if (pageUrl.isNullOrBlank()) {
            eligibleProbe = null
            eligibleSession = null
            lastAutoEnterPageUrl = null
            transitionTo(PromotedMediaState.BROWSER, "eligibility missing no-url")
            Logger.i(TAG, "eligibility=false reason=no-url")
            return
        }

        val match = adapters.asSequence()
            .mapNotNull { adapter -> adapter.probe(pageUrl, pageTitle) }
            .firstOrNull()

        eligibleProbe = match
        eligibleSession = match?.session
        if (lastAutoEnterPageUrl != pageUrl) {
            lastAutoEnterPageUrl = null
        }
        if (match == null) {
            transitionTo(PromotedMediaState.BROWSER, "eligibility no-adapter-match")
            Logger.i(TAG, "eligibility=false url=$pageUrl reason=no-adapter-match")
            return
        }

        val eligible = match.eligibility == PromotedMediaSiteAdapter.Eligibility.ELIGIBLE
        transitionTo(
            if (eligible) PromotedMediaState.ELIGIBLE else PromotedMediaState.BROWSER,
            "page-evaluated platform=${match.session.platformId} pageKind=${match.session.pageKind}",
        )
        when {
            !eligible -> Logger.i(
                TAG,
                "page not eligible: no media evidence platform=${match.session.platformId} pageKind=${match.session.pageKind} url=$pageUrl reason=${match.reason}"
            )
            match.sourceCandidate?.kind == PromotedMediaSource.Kind.EXTRACTED_STREAM -> Logger.i(
                TAG,
                "page eligible: playable source candidate detected platform=${match.session.platformId} pageKind=${match.session.pageKind} url=$pageUrl reason=${match.reason}"
            )
            else -> Logger.i(
                TAG,
                "page eligible: media evidence detected platform=${match.session.platformId} pageKind=${match.session.pageKind} url=$pageUrl reason=${match.reason}"
            )
        }
        Logger.i(TAG, "metadata available=${match.session.metadata.isNotEmpty()} source available=${match.sourceCandidate != null} sourceKind=${match.sourceCandidate?.kind ?: "none"}")
    }

    fun requestEnterEligibleMedia(reason: String) {
        requestEnterEligibleMediaInternal(reason, triggerMode = "explicit")
    }

    fun maybeAutoEnterEligibleMedia(reason: String): Boolean {
        val probe = eligibleProbe ?: return false
        val session = eligibleSession ?: return false
        if (probe.eligibility != PromotedMediaSiteAdapter.Eligibility.ELIGIBLE) {
            return false
        }
        if (lastAutoEnterPageUrl == session.pageUrl) {
            Logger.i(TAG, "auto-promote skipped reason=already-attempted pageUrl=${session.pageUrl}")
            return false
        }
        val autoPromoteDecision = autoPromoteDecision(session, probe)
        if (!autoPromoteDecision.allowed) {
            Logger.i(
                TAG,
                "auto-promote skipped reason=${autoPromoteDecision.reason} platform=${session.platformId} pageKind=${session.pageKind} sourceKind=${probe.sourceCandidate?.kind ?: "none"}"
            )
            return false
        }
        lastAutoEnterPageUrl = session.pageUrl
        Logger.i(
            TAG,
            "auto-promote trigger accepted reason=${autoPromoteDecision.reason} platform=${session.platformId} pageKind=${session.pageKind} sourceKind=${probe.sourceCandidate?.kind ?: "none"} trigger=$reason"
        )
        requestEnterEligibleMediaInternal(reason, triggerMode = "auto")
        return true
    }

    private fun requestEnterEligibleMediaInternal(reason: String, triggerMode: String) {
        if (state == PromotedMediaState.PROMOTED || state == PromotedMediaState.PREPARING) {
            Logger.i(TAG, "enter ignored reason=already-active state=${state.name.lowercase()} triggerMode=$triggerMode")
            return
        }
        val probe = eligibleProbe
        val session = eligibleSession
        if (probe == null || session == null) {
            transitionTo(PromotedMediaState.FAILED, "enter requested without eligible session")
            Logger.w(TAG, "player failed reason=no-eligible-session triggerMode=$triggerMode")
            return
        }
        if (probe.eligibility != PromotedMediaSiteAdapter.Eligibility.ELIGIBLE) {
            transitionTo(PromotedMediaState.FAILED, "enter requested on navigation-only page")
            Logger.w(TAG, "player failed reason=navigation-only-page triggerMode=$triggerMode")
            return
        }
        val adapter = adapters.firstOrNull { it.platformId == session.platformId }
        if (adapter == null) {
            transitionTo(PromotedMediaState.FAILED, "adapter missing platform=${session.platformId}")
            Logger.w(TAG, "player failed reason=missing-adapter platform=${session.platformId} triggerMode=$triggerMode")
            return
        }
        val context = resolutionContextProvider()
        if (context == null) {
            transitionTo(PromotedMediaState.FAILED, "resolution context unavailable")
            Logger.w(TAG, "source resolution failed reason=no-resolution-context platform=${session.platformId} triggerMode=$triggerMode")
            return
        }
        val currentToken = ++resolutionToken
        logCandidateState(session, probe, triggerMode)
        val directCandidate = probe.sourceCandidate
        if (isAcceptablePromotedSource(directCandidate)) {
            val acceptedDirectSource = directCandidate!!
            Logger.i(
                TAG,
                "promote accepted sourceKind=EXTRACTED_STREAM reason=${promoteReasonForSource(acceptedDirectSource)} platform=${session.platformId} pageKind=${session.pageKind} uri=${acceptedDirectSource.uri} triggerMode=$triggerMode"
            )
            transitionTo(PromotedMediaState.PREPARING, "preparing platform=${session.platformId} reason=$reason")
            Logger.i(TAG, "preparing promoted media platform=${session.platformId} pageKind=${session.pageKind} url=${session.pageUrl} triggerMode=$triggerMode")
            enterPromotedMedia(session, acceptedDirectSource, "$reason-probe-direct-source-$triggerMode")
            return
        }
        adapter.resolveSource(session, context) { sourceResult ->
            if (currentToken != resolutionToken) {
                Logger.i(TAG, "source resolution ignored reason=stale-result platform=${session.platformId}")
                return@resolveSource
            }
            Logger.i(
                TAG,
                "metadata/source status metadataAvailable=${session.metadata.isNotEmpty()} sourceAvailable=${sourceResult.source != null} reason=${sourceResult.reason}"
            )
            val source = sourceResult.source
            if (!isAcceptablePromotedSource(source)) {
                handleBlockedPromotion(session, sourceResult, triggerMode)
                return@resolveSource
            }
            val acceptedResolvedSource = source!!
            Logger.i(
                TAG,
                "promote accepted sourceKind=EXTRACTED_STREAM reason=${promoteReasonForSource(acceptedResolvedSource)} platform=${session.platformId} pageKind=${session.pageKind} uri=${acceptedResolvedSource.uri} mimeType=${acceptedResolvedSource.mimeType ?: "unknown"} triggerMode=$triggerMode"
            )
            transitionTo(PromotedMediaState.PREPARING, "preparing platform=${session.platformId} reason=$reason")
            Logger.i(TAG, "preparing promoted media platform=${session.platformId} pageKind=${session.pageKind} url=${session.pageUrl} triggerMode=$triggerMode")
            enterPromotedMedia(session, acceptedResolvedSource, "$reason-$triggerMode")
        }
    }

    private fun enterPromotedMedia(
        session: PromotedMediaSession,
        source: PromotedMediaSource,
        reason: String,
    ) {
        activeSession = session
        val renderView = player.createRenderView(hostView.context)
        activeRenderView = renderView
        hostView.attachRenderView(renderView)
        player.onAttach(session, source)
        hostView.visibility = android.view.View.VISIBLE
        transitionTo(PromotedMediaState.PROMOTED, "entered platform=${session.platformId} reason=$reason")
        Logger.i(
            TAG,
            "promoted media entered platform=${session.platformId} pageKind=${session.pageKind} pageUrl=${session.pageUrl} sourceKind=${source.kind} reason=$reason"
        )
        Logger.i(
            TAG,
            "source resolved and promoted platform=${session.platformId} pageKind=${session.pageKind} sourceKind=${source.kind} mimeType=${source.mimeType ?: "unknown"}"
        )
    }

    fun exitPromotedMedia(reason: String) {
        if (state != PromotedMediaState.PROMOTED && state != PromotedMediaState.PREPARING) {
            Logger.i(TAG, "exit ignored reason=no-active-promoted-media state=${state.name.lowercase()}")
            return
        }
        resolutionToken++
        transitionTo(PromotedMediaState.EXITING, "exit reason=$reason")
        val exiting = activeSession
        player.onDetach()
        activeRenderView = null
        hostView.detachRenderView()
        activeSession = null
        hostView.visibility = android.view.View.GONE
        transitionTo(PromotedMediaState.BROWSER, "exit completed")
        Logger.i(
            TAG,
            "promoted media exited previous=${exiting?.pageUrl ?: "none"} reason=$reason"
        )
    }

    fun getEligibleSession(): PromotedMediaSession? = eligibleSession

    fun getState(): PromotedMediaState = state

    fun hasEligibleSession(): Boolean = eligibleProbe?.eligibility == PromotedMediaSiteAdapter.Eligibility.ELIGIBLE

    fun isPromotedActive(): Boolean = state == PromotedMediaState.PROMOTED || state == PromotedMediaState.PREPARING

    private fun logCandidateState(
        session: PromotedMediaSession,
        probe: PromotedMediaSiteAdapter.ProbeResult,
        triggerMode: String,
    ) {
        val candidate = probe.sourceCandidate
        when {
            candidate == null -> Logger.i(
                TAG,
                "candidate-only page sourceKind=none staying-in-browser platform=${session.platformId} pageKind=${session.pageKind} triggerMode=$triggerMode"
            )
            candidate.kind == PromotedMediaSource.Kind.PAGE_VIDEO -> Logger.i(
                TAG,
                "candidate-only page sourceKind=PAGE_VIDEO staying-in-browser platform=${session.platformId} pageKind=${session.pageKind} triggerMode=$triggerMode"
            )
            candidate.kind == PromotedMediaSource.Kind.EXTRACTED_STREAM && !candidate.uri.isNullOrBlank() -> Logger.i(
                TAG,
                "source candidate detected platform=${session.platformId} pageKind=${session.pageKind} candidate=${candidate.kind} triggerMode=$triggerMode"
            )
            else -> Logger.i(
                TAG,
                "candidate-only page sourceKind=${candidate.kind} staying-in-browser platform=${session.platformId} pageKind=${session.pageKind} triggerMode=$triggerMode"
            )
        }
    }

    private fun isAcceptablePromotedSource(source: PromotedMediaSource?): Boolean {
        return source?.kind == PromotedMediaSource.Kind.EXTRACTED_STREAM && !source.uri.isNullOrBlank()
    }

    private fun promoteReasonForSource(source: PromotedMediaSource?): String {
        val sourceId = source?.sourceId.orEmpty()
        val mimeType = source?.mimeType.orEmpty()
        return when {
            sourceId == "youtube-streaming-data" && mimeType == "application/x-mpegURL" -> "hls-manifest"
            sourceId == "youtube-streaming-data" -> "muxed-direct-format"
            sourceId == "html5-direct-url" -> "direct-media-url"
            sourceId == "dom-video-extracted-stream" -> "dom-direct-stream"
            sourceId == "mse-resource-candidate" -> "generic-mse-candidate"
            else -> "extracted-stream"
        }
    }

    private fun handleBlockedPromotion(
        session: PromotedMediaSession,
        sourceResult: PromotedMediaSiteAdapter.SourceResult,
        triggerMode: String,
    ) {
        transitionTo(PromotedMediaState.BROWSER, "promotion blocked platform=${session.platformId}")
        when {
            sourceResult.reason.contains("player-limited") -> Logger.w(
                TAG,
                "promote blocked reason=player-limited kind=dash-or-split-streams platform=${session.platformId} pageKind=${session.pageKind} triggerMode=$triggerMode detail=${sourceResult.reason}"
            )
            else -> Logger.w(
                TAG,
                "promote blocked reason=no-playable-source platform=${session.platformId} pageKind=${session.pageKind} triggerMode=$triggerMode detail=${sourceResult.reason}"
            )
        }
        Logger.i(
            TAG,
            "wrapper path disabled/ignored for this route platform=${session.platformId} pageKind=${session.pageKind} triggerMode=$triggerMode"
        )
        Logger.i(
            TAG,
            "staying in browser reason=wrapper-disabled platform=${session.platformId} pageKind=${session.pageKind} triggerMode=$triggerMode"
        )
    }

    private fun autoPromoteDecision(
        session: PromotedMediaSession,
        probe: PromotedMediaSiteAdapter.ProbeResult,
    ): AutoPromoteDecision {
        val candidate = probe.sourceCandidate
        if (candidate?.kind == PromotedMediaSource.Kind.EXTRACTED_STREAM &&
            !candidate.uri.isNullOrBlank()
        ) {
            return AutoPromoteDecision(
                allowed = true,
                reason = if (session.pageKind == "direct-media-url") "probe-direct-media-url" else "probe-direct-source",
            )
        }
        if (session.pageKind in PLAYBACK_PAGE_KINDS) {
            return AutoPromoteDecision(
                allowed = false,
                reason = "page-kind-only-insufficient",
            )
        }
        return AutoPromoteDecision(
            allowed = false,
            reason = "no-high-confidence-source",
        )
    }

    private fun transitionTo(next: PromotedMediaState, reason: String) {
        if (state == next) return
        Logger.i(TAG, "state=${state.name.lowercase()} -> ${next.name.lowercase()} reason=$reason")
        state = next
    }

    private companion object {
        private const val TAG = "KfPromotedMedia"
        private val PLAYBACK_PAGE_KINDS = setOf("watch", "shorts", "live", "embed", "youtu-be")
    }

    private data class AutoPromoteDecision(
        val allowed: Boolean,
        val reason: String,
    )
}
