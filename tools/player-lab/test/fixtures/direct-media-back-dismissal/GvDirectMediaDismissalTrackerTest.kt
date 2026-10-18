import com.kulchaflo.tv.mk2.gv.media.GvDirectMediaDismissalTracker

private const val CBC_PAGE = "https://cbc.example/live"
private const val CBC_SOURCE = "https://media.example/live/index.m3u8?ephemeral=redacted"
private const val KULCHAFLO_PAGE = "https://kulchaflo.example/channels"
private const val OTHER_PAGE = "https://other.example/watch"
private const val OTHER_SOURCE = "https://media.example/other/index.m3u8"

private fun assertTrue(value: Boolean, message: String) {
    check(value) { message }
}

private fun assertEquals(expected: Any?, actual: Any?, message: String) {
    check(expected == actual) { "$message expected=$expected actual=$actual" }
}

private fun cbcBackDismissalSuppressesRepeatedEvidence() {
    val tracker = GvDirectMediaDismissalTracker<String>()
    tracker.onLocationChanged("cbc-tab", CBC_PAGE)
    assertTrue(tracker.recordPromotion("cbc-tab", CBC_SOURCE), "CBC should promote")
    val dismissal = tracker.dismissActivePromotion("cbc-tab")
    assertEquals("user-back", dismissal?.reason, "Back should record bounded reason")
    assertEquals(
        GvDirectMediaDismissalTracker.DecisionState.SUPPRESS_USER_DISMISSED_DOCUMENT,
        tracker.promotionDecision("cbc-tab").state,
        "same document should remain suppressed",
    )
    assertTrue(
        !tracker.recordPromotion("cbc-tab", CBC_SOURCE),
        "identical evidence must not re-promote",
    )
}

private fun explicitReopenCreatesNewGeneration() {
    val tracker = GvDirectMediaDismissalTracker<String>()
    val first = tracker.onLocationChanged("tab", CBC_PAGE)
    tracker.recordPromotion("tab", CBC_SOURCE)
    tracker.dismissActivePromotion("tab")
    tracker.onLocationChanged("tab", KULCHAFLO_PAGE)
    val reopened = tracker.onLocationChanged("tab", CBC_PAGE)
    assertTrue(reopened.documentGeneration > first.documentGeneration, "reopen needs new generation")
    assertEquals(
        GvDirectMediaDismissalTracker.DecisionState.ALLOW_PROMOTION,
        tracker.promotionDecision("tab").state,
        "deliberate reopen should clear stale dismissal",
    )
    assertTrue(tracker.recordPromotion("tab", CBC_SOURCE), "reopened CBC should promote")
}

private fun anotherProviderIsUnaffected() {
    val tracker = GvDirectMediaDismissalTracker<String>()
    tracker.onLocationChanged("cbc", CBC_PAGE)
    tracker.recordPromotion("cbc", CBC_SOURCE)
    tracker.dismissActivePromotion("cbc")
    tracker.onLocationChanged("cbc", OTHER_PAGE)
    assertTrue(tracker.recordPromotion("cbc", OTHER_SOURCE), "other provider in the tab should promote")

    tracker.onLocationChanged("other-tab", OTHER_PAGE)
    assertTrue(
        tracker.recordPromotion("other-tab", "$OTHER_SOURCE?tab=other"),
        "another provider session should promote",
    )
}

private fun duplicateBackIsIdempotent() {
    val tracker = GvDirectMediaDismissalTracker<String>()
    tracker.onLocationChanged("tab", CBC_PAGE)
    tracker.recordPromotion("tab", CBC_SOURCE)
    assertTrue(tracker.dismissActivePromotion("tab") != null, "first Back should dismiss")
    assertEquals(null, tracker.dismissActivePromotion("tab"), "second Back should be a no-op")
}

private fun locationChangeClearsAtLegitimateBoundary() {
    val tracker = GvDirectMediaDismissalTracker<String>()
    tracker.onLocationChanged("tab", "$CBC_PAGE?first=ignored")
    tracker.recordPromotion("tab", CBC_SOURCE)
    tracker.dismissActivePromotion("tab")
    val sameDocument = tracker.ensureDocument("tab", "$CBC_PAGE?first=ignored#fragment")
    assertTrue(!sameDocument.documentChanged, "repeated evidence must not create a document boundary")
    assertEquals(
        GvDirectMediaDismissalTracker.DecisionState.SUPPRESS_USER_DISMISSED_DOCUMENT,
        tracker.promotionDecision("tab").state,
        "same normalized document must stay suppressed",
    )
    val changed = tracker.onLocationChanged("tab", "$CBC_PAGE?second=ignored")
    assertTrue(changed.documentChanged, "different query navigation should create a boundary")
    assertEquals(
        GvDirectMediaDismissalTracker.DecisionState.ALLOW_PROMOTION,
        tracker.promotionDecision("tab").state,
        "new document should allow promotion",
    )

    tracker.recordPromotion("tab", CBC_SOURCE)
    tracker.dismissActivePromotion("tab")
    val reload = tracker.onLocationChanged("tab", "$CBC_PAGE?second=ignored")
    assertTrue(reload.documentChanged, "same-identity reload should create a new generation")
    assertEquals(
        GvDirectMediaDismissalTracker.DecisionState.ALLOW_PROMOTION,
        tracker.promotionDecision("tab").state,
        "a genuine same-URL navigation should clear dismissal",
    )
}

private fun sessionClosureRemovesState() {
    val tracker = GvDirectMediaDismissalTracker<String>()
    tracker.onLocationChanged("tab", CBC_PAGE)
    tracker.recordPromotion("tab", CBC_SOURCE)
    tracker.dismissActivePromotion("tab")
    tracker.closeSession("tab")
    assertEquals(null, tracker.promotionDecision("tab").documentGeneration, "closed state removed")
    assertEquals(
        GvDirectMediaDismissalTracker.DecisionState.ALLOW_PROMOTION,
        tracker.promotionDecision("tab").state,
        "closed session cannot retain dismissal",
    )
}

private fun crossFrameEvidenceSharesDocumentSuppression() {
    val tracker = GvDirectMediaDismissalTracker<String>()
    tracker.onLocationChanged("top-level-session", CBC_PAGE)
    tracker.recordPromotion("top-level-session", CBC_SOURCE)
    tracker.dismissActivePromotion("top-level-session")
    repeat(3) {
        assertTrue(
            !tracker.recordPromotion("top-level-session", "$OTHER_SOURCE?frame=$it"),
            "any frame evidence in the dismissed document must be suppressed",
        )
    }
}

private fun appRestartDoesNotPersistDismissal() {
    val firstProcess = GvDirectMediaDismissalTracker<String>()
    firstProcess.onLocationChanged("tab", CBC_PAGE)
    firstProcess.recordPromotion("tab", CBC_SOURCE)
    firstProcess.dismissActivePromotion("tab")

    val restartedProcess = GvDirectMediaDismissalTracker<String>()
    restartedProcess.onLocationChanged("tab", CBC_PAGE)
    assertTrue(
        restartedProcess.recordPromotion("tab", CBC_SOURCE),
        "fresh process must not inherit dismissal",
    )
}

private fun dismissalDiagnosticsDoNotExposeLocations() {
    val tracker = GvDirectMediaDismissalTracker<String>()
    tracker.onLocationChanged("tab", "$CBC_PAGE?secret=value")
    tracker.recordPromotion("tab", "$CBC_SOURCE&token=secret")
    val dismissal = checkNotNull(tracker.dismissActivePromotion("tab"))
    val rendered = dismissal.toString()
    assertTrue(!rendered.contains("https://"), "state must not retain a URL")
    assertTrue(!rendered.contains("secret"), "state must not retain query data")
    assertTrue(
        Regex("^[0-9a-f]{64}$").matches(dismissal.normalizedPageIdentitySha256),
        "document identity should be a SHA-256",
    )
    assertTrue(
        Regex("^[0-9a-f]{64}$").matches(dismissal.promotedSourceSha256),
        "source identity should be a SHA-256",
    )
}

fun main() {
    val tests = listOf(
        ::cbcBackDismissalSuppressesRepeatedEvidence,
        ::explicitReopenCreatesNewGeneration,
        ::anotherProviderIsUnaffected,
        ::duplicateBackIsIdempotent,
        ::locationChangeClearsAtLegitimateBoundary,
        ::sessionClosureRemovesState,
        ::crossFrameEvidenceSharesDocumentSuppression,
        ::appRestartDoesNotPersistDismissal,
        ::dismissalDiagnosticsDoNotExposeLocations,
    )
    tests.forEach { it() }
    println("GvDirectMediaDismissalTrackerTest: ${tests.size} passed")
}
