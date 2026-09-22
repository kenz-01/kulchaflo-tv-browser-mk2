package com.kulchaflo.tv.mk2.gv.media

object GvMediaCandidateRankerTest {
    @JvmStatic
    fun main(args: Array<String>) {
        mtmRetainsWebPlayer()
        singleLegitimateMp4Promotes()
        legitimateShortClipPromotes()
        backgroundOnlyUsesSafeStandaloneBehavior()
        hiddenFailedSupportIsIgnored()
        directHlsPromotes()
        delayedManagedPlayerChangesWaitToRetain()
        crossFrameCandidateDoesNotSuppress()
        duplicateSettledDecisionIsStable()
        weakSignalsDoNotSuppressAlone()
        println("GvMediaCandidateRankerTest: 10 passed")
    }

    private fun mtmRetainsWebPlayer() {
        val decision = decide(listOf(background(), hiddenSupport(), managedLive()))
        check(decision.state == GvMediaCandidateRanker.DecisionState.RETAIN_WEB_PLAYER)
        check(decision.selectedCandidate == null)
        check(decision.reasonCodes == listOf("decorative-direct-candidate-suppressed", "same-frame-managed-player-present"))
        check(decision.assessments.first { it.candidateId == "support" }.eligibleManagedPlayer.not())
        check(decision.assessments.first { it.candidateId == "live" }.eligibleManagedPlayer)
    }

    private fun singleLegitimateMp4Promotes() {
        val decision = decide(listOf(direct()))
        check(decision.state == GvMediaCandidateRanker.DecisionState.PROMOTE_DIRECT_CANDIDATE)
        check(decision.selectedCandidate?.candidateId == "direct")
    }

    private fun legitimateShortClipPromotes() {
        val decision = decide(listOf(direct().copy(durationCategory = "finite-short")))
        check(decision.state == GvMediaCandidateRanker.DecisionState.PROMOTE_DIRECT_CANDIDATE)
    }

    private fun backgroundOnlyUsesSafeStandaloneBehavior() {
        val decision = decide(listOf(background()))
        check(decision.state == GvMediaCandidateRanker.DecisionState.PROMOTE_DIRECT_CANDIDATE)
    }

    private fun hiddenFailedSupportIsIgnored() {
        val decision = decide(listOf(hiddenSupport()))
        check(decision.state == GvMediaCandidateRanker.DecisionState.NO_ELIGIBLE_DIRECT_CANDIDATE)
        check(decision.assessments.single().reasonCodes.contains("hard-hidden-support-element"))
    }

    private fun directHlsPromotes() {
        val decision = decide(
            listOf(
                direct().copy(
                    sourceKind = "direct-hls",
                    sourceUrl = "https://media.example.test/live/index.m3u8",
                    mimeType = "application/x-mpegURL",
                    durationCategory = "infinite-live",
                ),
            ),
        )
        check(decision.state == GvMediaCandidateRanker.DecisionState.PROMOTE_DIRECT_CANDIDATE)
    }

    private fun delayedManagedPlayerChangesWaitToRetain() {
        val waiting = GvMediaCandidateRanker.decide(listOf(background()), 1, 3)
        check(waiting.state == GvMediaCandidateRanker.DecisionState.WAIT_FOR_CANDIDATE_SETTLEMENT)
        val retained = decide(listOf(background(), managedLive()))
        check(retained.state == GvMediaCandidateRanker.DecisionState.RETAIN_WEB_PLAYER)
    }

    private fun crossFrameCandidateDoesNotSuppress() {
        val decision = decide(listOf(background(), managedLive().copy(frameId = "child-frame")))
        check(decision.state == GvMediaCandidateRanker.DecisionState.PROMOTE_DIRECT_CANDIDATE)
    }

    private fun duplicateSettledDecisionIsStable() {
        val first = decide(listOf(direct()))
        val replay = decide(listOf(direct()))
        check(first.state == GvMediaCandidateRanker.DecisionState.PROMOTE_DIRECT_CANDIDATE)
        check(first == replay)
    }

    private fun weakSignalsDoNotSuppressAlone() {
        val managed = managedLive()
        for (candidate in listOf(
            direct().copy(muted = true),
            direct().copy(autoplay = true),
            direct().copy(durationCategory = "finite-short"),
            direct().copy(controls = false),
        )) {
            check(decide(listOf(candidate, managed)).state == GvMediaCandidateRanker.DecisionState.PROMOTE_DIRECT_CANDIDATE)
        }
    }

    private fun decide(candidates: List<GvMediaCandidateRanker.Candidate>) =
        GvMediaCandidateRanker.decide(candidates, stableObservationCount = 3, requiredStableObservations = 3)

    private fun direct() = GvMediaCandidateRanker.Candidate(
        candidateId = "direct",
        frameId = "top-frame",
        frameLocalOrder = 1,
        sourceKind = "direct-mp4",
        sourceUrl = "https://media.example.test/video/main.mp4",
        mimeType = "video/mp4",
        tagName = "video",
        visible = true,
        renderedWidth = 1280,
        renderedHeight = 720,
        visibleArea = 921_600,
        viewportIntersection = 1.0,
        mediaError = 0,
        readyState = 4,
        paused = false,
        ended = false,
        muted = false,
        autoplay = false,
        loop = false,
        controls = true,
        durationCategory = "finite-long",
        backgroundAncestry = false,
        playerManagedAncestry = false,
        hiddenSupportElement = false,
        managedMediaSource = false,
    )

    private fun background() = direct().copy(
        candidateId = "background",
        renderedWidth = 1920,
        renderedHeight = 326,
        visibleArea = 625_920,
        muted = true,
        autoplay = true,
        controls = false,
        durationCategory = "finite-short",
        backgroundAncestry = true,
    )

    private fun hiddenSupport() = direct().copy(
        candidateId = "support",
        frameLocalOrder = 2,
        sourceKind = "unavailable",
        sourceUrl = "",
        renderedWidth = 0,
        renderedHeight = 0,
        visibleArea = 0,
        viewportIntersection = 0.0,
        visible = false,
        mediaError = 4,
        readyState = 0,
        paused = true,
        controls = false,
        playerManagedAncestry = true,
        hiddenSupportElement = true,
    )

    private fun managedLive() = direct().copy(
        candidateId = "live",
        frameLocalOrder = 3,
        sourceKind = "managed-media-source",
        sourceUrl = "",
        mimeType = null,
        renderedWidth = 1080,
        renderedHeight = 608,
        visibleArea = 656_640,
        controls = false,
        playerManagedAncestry = true,
        managedMediaSource = true,
    )
}
