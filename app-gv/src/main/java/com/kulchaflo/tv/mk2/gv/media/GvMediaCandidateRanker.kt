package com.kulchaflo.tv.mk2.gv.media

import java.net.URI

object GvMediaCandidateRanker {
    enum class DecisionState(val wireName: String) {
        PROMOTE_DIRECT_CANDIDATE("promote-direct-candidate"),
        SUPPRESS_DECORATIVE_CANDIDATE("suppress-decorative-candidate"),
        WAIT_FOR_CANDIDATE_SETTLEMENT("wait-for-candidate-settlement"),
        NO_ELIGIBLE_DIRECT_CANDIDATE("no-eligible-direct-candidate"),
        RETAIN_WEB_PLAYER("retain-web-player"),
    }

    data class Candidate(
        val candidateId: String,
        val frameId: String,
        val frameLocalOrder: Int,
        val sourceKind: String,
        val sourceUrl: String,
        val mimeType: String?,
        val tagName: String,
        val visible: Boolean,
        val renderedWidth: Int,
        val renderedHeight: Int,
        val visibleArea: Int,
        val viewportIntersection: Double,
        val mediaError: Int,
        val readyState: Int,
        val paused: Boolean,
        val ended: Boolean,
        val muted: Boolean,
        val autoplay: Boolean,
        val loop: Boolean,
        val controls: Boolean,
        val durationCategory: String,
        val backgroundAncestry: Boolean,
        val playerManagedAncestry: Boolean,
        val hiddenSupportElement: Boolean,
        val managedMediaSource: Boolean,
    )

    data class CandidateAssessment(
        val candidateId: String,
        val eligibleDirect: Boolean,
        val eligibleManagedPlayer: Boolean,
        val decorativeScore: Int,
        val reasonCodes: List<String>,
    )

    data class Decision(
        val state: DecisionState,
        val reasonCodes: List<String>,
        val selectedCandidate: Candidate?,
        val assessments: List<CandidateAssessment>,
    )

    fun decide(
        candidates: List<Candidate>,
        stableObservationCount: Int,
        requiredStableObservations: Int,
    ): Decision {
        val assessments = candidates.map(::assess)
        val managedIds = assessments.filter { it.eligibleManagedPlayer }.mapTo(LinkedHashSet()) { it.candidateId }
        val eligibleDirect = candidates
            .filter { candidate -> assessments.first { it.candidateId == candidate.candidateId }.eligibleDirect }
            .sortedWith(
                compareByDescending<Candidate> { directRank(it) }
                    .thenBy { it.frameLocalOrder }
                    .thenBy { it.candidateId },
            )
        val selected = eligibleDirect.firstOrNull()

        if (selected == null) {
            return if (managedIds.isNotEmpty()) {
                Decision(
                    state = DecisionState.RETAIN_WEB_PLAYER,
                    reasonCodes = listOf("visible-managed-player-without-direct-candidate"),
                    selectedCandidate = null,
                    assessments = assessments,
                )
            } else {
                Decision(
                    state = DecisionState.NO_ELIGIBLE_DIRECT_CANDIDATE,
                    reasonCodes = listOf("no-hard-eligible-direct-candidate"),
                    selectedCandidate = null,
                    assessments = assessments,
                )
            }
        }

        if (stableObservationCount < requiredStableObservations.coerceAtLeast(2)) {
            return Decision(
                state = DecisionState.WAIT_FOR_CANDIDATE_SETTLEMENT,
                reasonCodes = listOf("candidate-set-not-stable"),
                selectedCandidate = null,
                assessments = assessments,
            )
        }

        val selectedAssessment = assessments.first { it.candidateId == selected.candidateId }
        val sameFrameManagedCompetitor = candidates.any { candidate ->
            candidate.frameId == selected.frameId &&
                candidate.candidateId != selected.candidateId &&
                managedIds.contains(candidate.candidateId)
        }
        if (sameFrameManagedCompetitor && selectedAssessment.decorativeScore >= DECORATIVE_SUPPRESSION_THRESHOLD) {
            return Decision(
                state = DecisionState.RETAIN_WEB_PLAYER,
                reasonCodes = listOf(
                    "decorative-direct-candidate-suppressed",
                    "same-frame-managed-player-present",
                ),
                selectedCandidate = null,
                assessments = assessments,
            )
        }

        return Decision(
            state = DecisionState.PROMOTE_DIRECT_CANDIDATE,
            reasonCodes = listOf("stable-eligible-direct-candidate"),
            selectedCandidate = selected,
            assessments = assessments,
        )
    }

    private fun assess(candidate: Candidate): CandidateAssessment {
        val reasons = mutableListOf<String>()
        val rendered = candidate.visible &&
            candidate.renderedWidth > 2 &&
            candidate.renderedHeight > 2 &&
            candidate.visibleArea > 0 &&
            candidate.viewportIntersection > 0.0
        if (!rendered) reasons += "hard-hidden-or-zero-visible-area"
        if (candidate.mediaError != 0) reasons += "hard-media-error"
        if (candidate.hiddenSupportElement) reasons += "hard-hidden-support-element"
        if (candidate.tagName != "video") reasons += "hard-non-video-media"
        if (candidate.sourceKind == "managed-media-source") reasons += "hard-managed-source-not-native"
        if (candidate.sourceKind == "direct-audio") reasons += "hard-audio-only"
        if (!isSafeDirectSource(candidate)) reasons += "hard-no-safe-direct-source"

        val hardEligible = rendered &&
            candidate.mediaError == 0 &&
            !candidate.hiddenSupportElement &&
            candidate.tagName == "video"
        val eligibleDirect = hardEligible && isSafeDirectSource(candidate)
        val primaryGeometry = candidate.renderedWidth >= 480 &&
            candidate.renderedHeight >= 270 &&
            candidate.visibleArea >= 100_000
        val eligibleManaged = hardEligible &&
            (
                candidate.managedMediaSource ||
                    (
                        candidate.playerManagedAncestry &&
                            candidate.readyState >= 2 &&
                            primaryGeometry
                        )
                )

        val decorativeReasons = mutableListOf<String>()
        if (candidate.durationCategory == "finite-short") decorativeReasons += "decorative-finite-short"
        if (candidate.muted && candidate.autoplay) decorativeReasons += "decorative-muted-autoplay"
        if (!candidate.controls) decorativeReasons += "decorative-no-controls"
        if (candidate.backgroundAncestry) decorativeReasons += "decorative-background-ancestry"
        if (candidate.loop) decorativeReasons += "decorative-loop"
        if (candidate.ended && candidate.durationCategory == "finite-short") decorativeReasons += "decorative-ended-short"
        if (candidate.renderedHeight > 0 && candidate.renderedWidth.toDouble() / candidate.renderedHeight >= 3.0) {
            decorativeReasons += "decorative-wide-shallow"
        }
        reasons += decorativeReasons
        if (eligibleDirect) reasons += "eligible-direct"
        if (eligibleManaged) reasons += "eligible-managed-player"
        return CandidateAssessment(
            candidateId = candidate.candidateId,
            eligibleDirect = eligibleDirect,
            eligibleManagedPlayer = eligibleManaged,
            decorativeScore = decorativeReasons.size,
            reasonCodes = reasons.distinct(),
        )
    }

    private fun directRank(candidate: Candidate): Long {
        var score = candidate.visibleArea.toLong().coerceAtMost(10_000_000L)
        if (candidate.controls) score += 2_000_000L
        if (candidate.readyState >= 3) score += 1_000_000L
        if (!candidate.paused) score += 500_000L
        if (candidate.sourceKind == "direct-hls") score += 3_000_000L
        return score
    }

    private fun isSafeDirectSource(candidate: Candidate): Boolean {
        if (candidate.sourceKind !in SUPPORTED_DIRECT_KINDS || candidate.sourceUrl.isBlank()) return false
        val uri = runCatching { URI(candidate.sourceUrl) }.getOrNull() ?: return false
        return uri.scheme?.lowercase() in setOf("http", "https") &&
            !uri.host.isNullOrBlank() &&
            uri.userInfo == null &&
            uri.rawQuery == null &&
            uri.rawFragment == null
    }

    private const val DECORATIVE_SUPPRESSION_THRESHOLD = 3
    private val SUPPORTED_DIRECT_KINDS = setOf("direct-hls", "direct-mp4", "direct-webm")
}
