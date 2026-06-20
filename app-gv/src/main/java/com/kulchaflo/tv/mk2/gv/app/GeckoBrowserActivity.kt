package com.kulchaflo.tv.mk2.gv.app

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.kulchaflo.tv.mk2.gv.BuildConfig
import com.kulchaflo.tv.mk2.gv.R
import com.kulchaflo.tv.mk2.gv.media.GvBrowserMediaController
import com.kulchaflo.tv.mk2.gv.media.GvMediaPathController
import com.kulchaflo.tv.mk2.gv.media.GvPromotedMediaPlayer
import com.kulchaflo.tv.mk2.gv.tabs.GvTab
import com.kulchaflo.tv.mk2.gv.tabs.GvTabController
import com.kulchaflo.tv.mk2.gv.ui.pointer.PointerOverlayView
import com.kulchaflo.tv.mk2.gv.youtube.YouTubeJsSnippets
import com.kulchaflo.tv.mk2.gv.youtube.YouTubePolicyConstants
import com.kulchaflo.tv.mk2.gv.youtube.YouTubeUrlPolicy
import com.kulchaflo.tv.mk2.gv.util.GvLogger
import org.json.JSONArray
import org.json.JSONObject
import org.mozilla.geckoview.AllowOrDeny
import org.mozilla.geckoview.GeckoResult
import org.mozilla.geckoview.GeckoSession
import org.mozilla.geckoview.GeckoSessionSettings
import org.mozilla.geckoview.GeckoView
import java.util.Collections
import java.util.WeakHashMap

class GeckoBrowserActivity : AppCompatActivity(), GvTabController.Listener {
    private data class LiveLoadTimingState(
        val surface: String,
        val rootUrl: String,
        val startedAtMs: Long,
        var pageStopLogged: Boolean = false,
        var tegoIframeLogged: Boolean = false,
        var mediaEvidenceLogged: Boolean = false,
        var tegoQualityLogged: Boolean = false,
        var playableVideoLogged: Boolean = false,
    )

    private data class AbsTegoStartupReprobeState(
        val rootUrl: String,
        val startedAtMs: Long,
        var generation: Int = 0,
        var completed: Boolean = false,
        var completionReason: String = "",
        var latestApplied: Boolean = false,
        var latestPlayable: Boolean = false,
        var latestPlaybackProgressed: Boolean = false,
        var latestMissingHlsLevels: Boolean = true,
        var latestReadyZeroPaused: Boolean = true,
        var latestPageUrl: String = "",
        var nativeFDispatched: Boolean = false,
        var nativeFullscreenTapDispatched: Boolean = false,
    )

    private data class TttTegoPlayAssistState(
        var active: Boolean = false,
        var requiresUserAction: Boolean = false,
        var centerX: Float = -1f,
        var centerY: Float = -1f,
        var targetKind: String = "",
        var readyState: Int = 0,
        var paused: Boolean = true,
        var playClickConsumed: Boolean = false,
        var reason: String = "",
    )

    private data class TttTransportRevealTarget(
        val x: Float,
        val y: Float,
        val restoredStoredPointer: Boolean,
    )

    private data class TttTransportRevealResult(
        val x: Float,
        val y: Float,
        val handled: Boolean,
        val restoredStoredPointer: Boolean,
    )

    private data class NovusTelearubaPlayAssistState(
        var active: Boolean = false,
        var requiresUserAction: Boolean = false,
        var desiredChannel: String = "",
        var returnUrl: String = "",
        var centerX: Float = -1f,
        var centerY: Float = -1f,
        var reason: String = "",
    )

    private data class NovusTelearubaProfileState(
        val desiredChannel: String,
        val returnUrl: String,
    )

    private data class CgtvPlayAssistState(
        var active: Boolean = false,
        var requiresUserAction: Boolean = false,
        var centerX: Float = -1f,
        var centerY: Float = -1f,
        var xRatio: Float = -1f,
        var yRatio: Float = -1f,
        var reason: String = "",
        var targetKind: String = "",
        var pageUrl: String = "",
        var viewportWidth: Float = 0f,
        var viewportHeight: Float = 0f,
        var hasVideo: Boolean = false,
        var paused: Boolean = true,
        var readyState: Int = 0,
        var currentTime: Double = 0.0,
        var videoWidth: Int = 0,
        var videoHeight: Int = 0,
    )

    private data class ChtvPlayAssistState(
        var active: Boolean = false,
        var requiresUserAction: Boolean = false,
        var centerX: Float = -1f,
        var centerY: Float = -1f,
        var xRatio: Float = -1f,
        var yRatio: Float = -1f,
        var reason: String = "",
        var targetKind: String = "",
        var pageUrl: String = "",
        var viewportWidth: Float = 0f,
        var viewportHeight: Float = 0f,
        var hasVideo: Boolean = false,
        var paused: Boolean = true,
        var readyState: Int = 0,
        var currentTime: Double = 0.0,
    )

    private data class ChtvFullscreenAssistState(
        var active: Boolean = false,
        var centerX: Float = -1f,
        var centerY: Float = -1f,
        var xRatio: Float = -1f,
        var yRatio: Float = -1f,
        var reason: String = "",
        var targetKind: String = "",
        var pageUrl: String = "",
        var viewportWidth: Float = 0f,
        var viewportHeight: Float = 0f,
        var clicked: Boolean = false,
    )

    private data class CaribvisionSessionState(
        var loginRequired: Boolean = false,
        var playerVisible: Boolean = false,
        var pageUrl: String = "",
        var reason: String = "",
    )

    private data class CaribvisionPlayAssistState(
        var active: Boolean = false,
        var requiresUserAction: Boolean = false,
        var centerX: Float = -1f,
        var centerY: Float = -1f,
        var xRatio: Float = -1f,
        var yRatio: Float = -1f,
        var reason: String = "",
        var targetKind: String = "",
        var targetLabel: String = "",
        var pageUrl: String = "",
        var viewportWidth: Float = 0f,
        var viewportHeight: Float = 0f,
        var hasVideo: Boolean = false,
        var paused: Boolean = true,
        var muted: Boolean = false,
        var volume: Float = 1f,
        var readyState: Int = 0,
        var currentTime: Double = 0.0,
        var videoWidth: Int = 0,
        var videoHeight: Int = 0,
    )

    private data class CaribvisionFullscreenAssistState(
        var active: Boolean = false,
        var centerX: Float = -1f,
        var centerY: Float = -1f,
        var xRatio: Float = -1f,
        var yRatio: Float = -1f,
        var audioCenterX: Float = -1f,
        var audioCenterY: Float = -1f,
        var audioXRatio: Float = -1f,
        var audioYRatio: Float = -1f,
        var reason: String = "",
        var targetKind: String = "",
        var targetLabel: String = "",
        var audioTargetKind: String = "",
        var audioTargetLabel: String = "",
        var pageUrl: String = "",
        var viewportWidth: Float = 0f,
        var viewportHeight: Float = 0f,
        var fullscreenActive: Boolean = false,
    )

    private data class CgtvCandidateSelection(
        val sourceUrl: String,
        val mimeType: String?,
        val reason: String,
    )

    private lateinit var geckoView: GeckoView
    private lateinit var pointerOverlay: PointerOverlayView
    private lateinit var loadingOverlay: View
    private lateinit var progressBar: ProgressBar
    private lateinit var titleView: TextView
    private lateinit var tabsOverlay: View
    private lateinit var tabsContainer: LinearLayout
    private lateinit var promotedMediaHost: View
    private lateinit var tabController: GvTabController
    private lateinit var mediaPathController: GvMediaPathController
    private lateinit var promotedMediaPlayer: GvPromotedMediaPlayer
    private lateinit var browserMediaController: GvBrowserMediaController

    private var canGoBack = false
    private var currentUrl: String = BuildConfig.DEFAULT_START_URL
    private var selectedOverlayIndex: Int = 0
    private val lastProbeUrlBySession = LinkedHashMap<GeckoSession, String>()
    private val loadRetryAttemptsBySession = LinkedHashMap<GeckoSession, LinkedHashMap<String, Int>>()
    private val facebookCompatLastDispatchMsBySession = LinkedHashMap<GeckoSession, Long>()
    private val facebookPlaybackDiagLastDispatchMsBySession = LinkedHashMap<GeckoSession, Long>()
    private val facebookPlaybackDiagBaselineCurrentTimeBySession = LinkedHashMap<GeckoSession, LinkedHashMap<String, Double>>()
    private val facebookPlaybackDiagBaselineMediaStateBySession = LinkedHashMap<GeckoSession, String>()
    private val facebookPlaybackDiagRetryCountBySession = LinkedHashMap<GeckoSession, Int>()
    private val facebookPlaybackWaitRetryCountBySession = LinkedHashMap<GeckoSession, Int>()
    private val facebookPassiveReentryObservedUrlBySession = LinkedHashMap<GeckoSession, String>()
    private val facebookPassiveAttemptCountBySession = LinkedHashMap<GeckoSession, Int>()
    private val facebookPassiveAttachedUrlBySession = LinkedHashMap<GeckoSession, String>()
    private val facebookPassiveGenerationBySession = LinkedHashMap<GeckoSession, Int>()
    private val facebookVideoHelperTrackedUrlBySession = LinkedHashMap<GeckoSession, String>()
    private val facebookVideoHelperAttemptCountBySession = LinkedHashMap<GeckoSession, Int>()
    private val facebookVideoHelperLastAttemptAtBySession = LinkedHashMap<GeckoSession, Long>()
    private val facebookVideoHelperPendingRunnableBySession = LinkedHashMap<GeckoSession, Runnable>()
    private val facebookVideoHelperMuteTapCountBySession = LinkedHashMap<GeckoSession, Int>()
    private val facebookVideoHelperVolumeBoostCountBySession = LinkedHashMap<GeckoSession, Int>()
    private val facebookVideoHelperFullscreenTapCountBySession = LinkedHashMap<GeckoSession, Int>()
    private val facebookVideoHelperControlsHoverCountBySession = LinkedHashMap<GeckoSession, Int>()
    private val facebookVideoHelperFullscreenCheckCountBySession = LinkedHashMap<GeckoSession, Int>()
    private val facebookVideoHelperStageBySession = LinkedHashMap<GeckoSession, String>()
    private val facebookVideoHelperLastFullscreenTargetXBySession = LinkedHashMap<GeckoSession, Float>()
    private val facebookVideoHelperLastFullscreenTargetYBySession = LinkedHashMap<GeckoSession, Float>()
    private val amazonConsentLastDispatchMsBySession = LinkedHashMap<GeckoSession, Long>()
    private val tttConsentLastDispatchMsBySession = LinkedHashMap<GeckoSession, Long>()
    private val cvc9ConsentLastDispatchMsBySession = LinkedHashMap<GeckoSession, Long>()
    private val cvc9ConsentWakeSentMsBySession = LinkedHashMap<GeckoSession, Long>()
    private val cvc9ConsentFrameBurstGenerationBySession = LinkedHashMap<GeckoSession, Int>()
    private val cvc9ConsentFrameNativeTapHandledMsBySession = LinkedHashMap<GeckoSession, Long>()
    private val cvc9ConsentFrameSafety3500UsedBySession = LinkedHashMap<GeckoSession, Boolean>()
    private val cvc9ConsentFrameSafety7000UsedBySession = LinkedHashMap<GeckoSession, Boolean>()
    private val kulchaFloCookieConsentLastDispatchMsBySession = LinkedHashMap<GeckoSession, Long>()
    private val liveLoadTimingBySession = LinkedHashMap<GeckoSession, LiveLoadTimingState>()
    private val absTegoStartupReprobeBySession = LinkedHashMap<GeckoSession, AbsTegoStartupReprobeState>()
    private val absTegoPlayerFirstReturnUrlBySession = LinkedHashMap<GeckoSession, String>()
    private val tttTegoPlayerFirstReturnUrlBySession = LinkedHashMap<GeckoSession, String>()
    private val tttTegoPlayAssistBySession = LinkedHashMap<GeckoSession, TttTegoPlayAssistState>()
    private val tttTegoStartupNativeTapCountBySession = LinkedHashMap<GeckoSession, Int>()
    private val tttTegoLastControlInteractionAtBySession = LinkedHashMap<GeckoSession, Long>()
    private val novusTelearubaProfileBySession = LinkedHashMap<GeckoSession, NovusTelearubaProfileState>()
    private val novusTelearubaPlayerFirstReturnUrlBySession = LinkedHashMap<GeckoSession, String>()
    private val novusTelearubaPlayAssistBySession = LinkedHashMap<GeckoSession, NovusTelearubaPlayAssistState>()
    private val cgtvPlayAssistBySession = LinkedHashMap<GeckoSession, CgtvPlayAssistState>()
    private val cgtvPlayAssistNativeTapCountBySession = LinkedHashMap<GeckoSession, Int>()
    private val cgtvPlayAssistNativeTapLastMsBySession = LinkedHashMap<GeckoSession, Long>()
    private val chtvPlayAssistBySession = LinkedHashMap<GeckoSession, ChtvPlayAssistState>()
    private val chtvPlayAssistNativeTapCountBySession = LinkedHashMap<GeckoSession, Int>()
    private val chtvPlayAssistNativeTapLastMsBySession = LinkedHashMap<GeckoSession, Long>()
    private val chtvFullscreenAssistBySession = LinkedHashMap<GeckoSession, ChtvFullscreenAssistState>()
    private val chtvFullscreenAssistNativeTapCountBySession = LinkedHashMap<GeckoSession, Int>()
    private val chtvFullscreenAssistNativeTapLastMsBySession = LinkedHashMap<GeckoSession, Long>()
    private val caribvisionSessionStateBySession = LinkedHashMap<GeckoSession, CaribvisionSessionState>()
    private val caribvisionPlayAssistBySession = LinkedHashMap<GeckoSession, CaribvisionPlayAssistState>()
    private val caribvisionPlayAssistNativeTapCountBySession = LinkedHashMap<GeckoSession, Int>()
    private val caribvisionPlayAssistNativeTapLastMsBySession = LinkedHashMap<GeckoSession, Long>()
    private val caribvisionFullscreenAssistBySession = LinkedHashMap<GeckoSession, CaribvisionFullscreenAssistState>()
    private val caribvisionFullscreenAssistNativeTapCountBySession = LinkedHashMap<GeckoSession, Int>()
    private val caribvisionFullscreenAssistNativeTapLastMsBySession = LinkedHashMap<GeckoSession, Long>()
    private val caribvisionFullscreenCheckRunnableBySession = LinkedHashMap<GeckoSession, Runnable>()
    private val caribvisionFullscreenStageBySession = LinkedHashMap<GeckoSession, String>()
    private val caribvisionFullscreenAssistSuppressedUrlBySession = LinkedHashMap<GeckoSession, String>()
    private val cgtvBrowserPlaybackActiveBySession = LinkedHashSet<GeckoSession>()
    // Fallback release runnables scheduled after the first assisted native tap to ensure
    // play-assist state does not permanently suppress user interaction when page-side
    // playing=true does not arrive in time.
    private val cgtvPlayAssistFallbackReleaseRunnableBySession = LinkedHashMap<GeckoSession, Runnable>()
    private val directMediaPromotionSuppressedUntilByUrl = LinkedHashMap<String, Long>()
    private val youtubeConsentNativeTapLastMsBySession = LinkedHashMap<GeckoSession, Long>()
    // Smart auto-fullscreen state (media-ready policy)
    private val youtubeAutoFsArmedUrlBySession = LinkedHashMap<GeckoSession, String>()
    private val youtubeAutoFsAttemptCountBySession = LinkedHashMap<GeckoSession, Int>()
    private val youtubeAutoFsMediaReadyBySession = LinkedHashSet<GeckoSession>()
    private val youtubeAutoFsPendingRunnableBySession = LinkedHashMap<GeckoSession, Runnable>()
    private val youtubeAutoFsFallbackRunnableBySession = LinkedHashMap<GeckoSession, Runnable>()
    private val youtubeAutoFsCallbackCheckRunnableBySession = LinkedHashMap<GeckoSession, Runnable>()
    private val youtubeAutoFsTargetProbeTokenBySession = LinkedHashMap<GeckoSession, String>()
    private val youtubeAutoFsTargetProbeFallbackRunnableBySession = LinkedHashMap<GeckoSession, Runnable>()
    private val youtubeAutoFsTargetProbeRetryRunnableBySession = LinkedHashMap<GeckoSession, Runnable>()
    private val youtubeAutoFsTargetProbePassBySession = LinkedHashMap<GeckoSession, Int>()
    private val youtubeAutoFsOverlayDeferralCountBySession = LinkedHashMap<GeckoSession, Int>()
    private val youtubeAutoFsSuppressedUrlBySession = LinkedHashMap<GeckoSession, String>()
    private val youtubeAutoFsSuppressedUntilBySession = LinkedHashMap<GeckoSession, Long>()
    private val chtvFullscreenAssistSuppressedUrlBySession = LinkedHashMap<GeckoSession, String>()
    private val youtubeFullscreenChatCollapseLastDispatchMsBySession = LinkedHashMap<GeckoSession, Long>()
    private val youtubeQualityTrackedUrlBySession = LinkedHashMap<GeckoSession, String>()
    private val youtubeQualityAttemptCountBySession = LinkedHashMap<GeckoSession, Int>()
    private val youtubeQualityLastAttemptAtBySession = LinkedHashMap<GeckoSession, Long>()
    private val youtubeQualityPendingRunnableBySession = LinkedHashMap<GeckoSession, Runnable>()
    private val youtubeQualityFollowUpQueuedUrlBySession = LinkedHashMap<GeckoSession, String>()
    private val youtubePremiumPopupTrackedUrlBySession = LinkedHashMap<GeckoSession, String>()
    private val youtubePremiumPopupCheckCountBySessionWindow = LinkedHashMap<GeckoSession, LinkedHashMap<String, Int>>()
    private val youtubePremiumPopupPendingRunnablesBySession = LinkedHashMap<GeckoSession, MutableList<Runnable>>()
    private val youtubePremiumPopupPendingWindowBySession = LinkedHashMap<GeckoSession, String>()
    private val youtubePremiumPopupLastDismissMsByUrl = LinkedHashMap<String, Long>()
    private val youtubePremiumPopupLastInteractionBurstMsBySession = LinkedHashMap<GeckoSession, Long>()
    private val youtubeFullscreenStateBySession = LinkedHashMap<GeckoSession, Boolean>()
    private val browserFullscreenStateBySession = LinkedHashMap<GeckoSession, Boolean>()
    private val cvmVimeoDiagnosticLastDispatchMsBySession = LinkedHashMap<GeckoSession, Long>()
    private val cbnVirginIslandsAutostartTapRunnableBySession = LinkedHashMap<GeckoSession, Runnable>()
    private val cbnVirginIslandsAutostartTapCountBySession = LinkedHashMap<GeckoSession, Int>()
    private val cnc3AutostartTapRunnableBySession = LinkedHashMap<GeckoSession, Runnable>()
    private val cnc3AutostartAttemptedBySession =
        Collections.newSetFromMap(WeakHashMap<GeckoSession, Boolean>())
    private val facebookCompatResolvedBySession =
        Collections.newSetFromMap(WeakHashMap<GeckoSession, Boolean>())
    private val pointerDirectionKeys = LinkedHashSet<Int>()
    private val pointerHandler = Handler(Looper.getMainLooper())
    private var pointerVisible = false
    private var pointerX = 0f
    private var pointerY = 0f
    private var pointerDownTime = 0L
    private var pointerRepeatTicks = 0
    private var pointerAssistModeActive = false
    private var promotedPointerModeActive = false
    private var browserFullscreenPointerSleepActive = false
    private var browserFullscreenWakeOnlyPendingKeyUp = false
    private var lastBackToExitAtMs = 0L
    private var lastBackToHomeAtMs = 0L
    private var lastInteractionWakePulseMs = 0L
    private var lastDpadDocumentScrollFallbackMs = 0L
    private var lastKulchaFloRailHoverScrollMs = 0L

    private val pointerIdleRunnable = Runnable {
        if (!pointerDirectionKeys.isEmpty()) {
            schedulePointerIdleTimeout()
            return@Runnable
        }
        val activeTab = tabController.getActiveTab()
        val activeUrl = activeTab?.url ?: currentUrl
        val pointerIdleSleepAllowed = shouldPointerAssistIdleSleep(activeUrl)
        val cvmPlayer = isCvmLiveStreamUrl(activeUrl) || isCvmVimeoPlayerUrl(activeUrl)
        if (cvmPlayer && !browserFullscreenPointerSleepActive) {
            browserFullscreenPointerSleepActive = true
        }
        if (browserFullscreenPointerSleepActive) {
            if (!pointerVisible || !pointerOverlay.isPointerVisible()) {
                return@Runnable
            }
            pointerVisible = false
            pointerOverlay.setPointerPressed(false)
            pointerOverlay.hidePointer()
            GvLogger.i("GvInput", "browser fullscreen pointer slept reason=idle")
            return@Runnable
        }
        if (pointerAssistModeActive && !promotedMediaPlayer.isPromoted() && !pointerIdleSleepAllowed) {
            cancelPointerIdleTimeout()
            GvLogger.i("GvInput", "pointer idle suppressed reason=focus-navigation-mode")
            return@Runnable
        }
        if (!pointerVisible || !pointerOverlay.isPointerVisible()) {
            return@Runnable
        }
        pointerVisible = false
        pointerOverlay.hidePointer()
        if (isYouTubePageUrl(activeUrl)) {
            GvLogger.i("GvInput", "youtube pointer slept reason=idle")
        } else if (pointerIdleSleepAllowed) {
            GvLogger.i("GvInput", "pointer slept reason=idle url=$activeUrl")
        } else {
            GvLogger.i("GvInput", "pointer auto-hidden reason=idle-timeout")
        }
    }

    private val pointerRepeatRunnable = object : Runnable {
        override fun run() {
            if (pointerDirectionKeys.isEmpty() || tabsOverlay.visibility == View.VISIBLE) {
                return
            }
            val delta = currentPointerDelta() ?: return
            pointerRepeatTicks += 1
            val multiplier = holdSpeedMultiplier()
            val move = movePointerBy(
                deltaX = delta.first * POINTER_MOVE_STEP_PX * multiplier,
                deltaY = delta.second * POINTER_MOVE_STEP_PX * multiplier,
            )
            val activeUrl = tabController.getActiveTab()?.url ?: currentUrl
            if (isNovusTelearubaContextUrl(activeUrl)) {
                pointerHandler.postDelayed(this, POINTER_REPEAT_FRAME_MS)
                return
            }
            if (maybeDispatchKulchaFloHomepageRailHoverScroll(currentHorizontalDpadKey(), move.overshootX, reason = "repeat")) {
                pointerHandler.postDelayed(this, POINTER_REPEAT_FRAME_MS)
                return
            }
            maybeScrollContent(move.overshootX, move.overshootY, "repeat")
            maybeDispatchDpadDocumentScrollFallback(
                keyCode = currentVerticalDpadKey(),
                reason = "repeat",
                scrollY = (move.overshootY * EDGE_SCROLL_MULTIPLIER).toInt(),
            )
            pointerHandler.postDelayed(this, POINTER_REPEAT_FRAME_MS)
        }
    }

    private val promotedPointerRepeatRunnable = object : Runnable {
        override fun run() {
            if (!promotedPointerModeActive || pointerDirectionKeys.isEmpty()) {
                return
            }
            val delta = currentPointerDelta() ?: return
            pointerRepeatTicks += 1
            val multiplier = holdSpeedMultiplier()
            movePromotedPointerBy(
                deltaX = delta.first * POINTER_MOVE_STEP_PX * multiplier,
                deltaY = delta.second * POINTER_MOVE_STEP_PX * multiplier,
            )
            pointerHandler.postDelayed(this, POINTER_REPEAT_FRAME_MS)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_gecko_browser)
        configureWindowForTv()

        geckoView = findViewById(R.id.gecko_view)
        geckoView.importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
        window.decorView.importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
        pointerOverlay = findViewById(R.id.pointer_overlay)
        loadingOverlay = findViewById(R.id.loading_overlay)
        progressBar = findViewById(R.id.loading_progress)
        titleView = findViewById(R.id.loading_title)
        tabsOverlay = findViewById(R.id.tabs_overlay)
        tabsContainer = findViewById(R.id.tabs_container)
        promotedMediaHost = findViewById(R.id.promoted_media_host)

        mediaPathController = GvMediaPathController()
        tabController = GvTabController(
            runtime = (application as GvApplication).geckoRuntime,
            sessionInitializer = ::configureSession,
            listener = this,
        )
        browserMediaController = GvBrowserMediaController(tabController)
        browserMediaController.youtubeMediaReadyListener = { session ->
            onYouTubeMediaReady(session)
        }
        promotedMediaPlayer = GvPromotedMediaPlayer(this, promotedMediaHost as ViewGroup)
        promotedMediaPlayer.listener = object : GvPromotedMediaPlayer.Listener {
            override fun onPromotedPlayerError(
                source: GvMediaPathController.Observation,
                error: androidx.media3.common.PlaybackException,
            ) {
                val caribVisionSource = isExactCaribVisionLiveHlsUrl(source.url)
                val cbcSource = isExactCbcLiveHlsUrl(source.url)
                if (!caribVisionSource && !cbcSource) {
                    return
                }
                runOnUiThread {
                    if (cbcSource) {
                        disablePromotedPointerMode(reason = "native-error", keepPointerVisible = false)
                    }
                    promotedMediaPlayer.stop(reason = if (caribVisionSource) "caribvision-native-error" else "cbc-native-error")
                    geckoView.visibility = View.VISIBLE
                    try {
                        pointerOverlay.visibility = View.VISIBLE
                    } catch (_: Throwable) {
                    }
                    if (caribVisionSource) {
                        GvLogger.i(
                            "GvMedia",
                            "caribvision native failed fallback-to-browser errorType=${error.errorCodeName} url=${source.url}"
                        )
                    } else {
                        GvLogger.i(
                            "GvMedia",
                            "cbc native failed fallback-to-browser errorType=${error.errorCodeName} url=${source.url}"
                        )
                    }
                }
            }
        }

        restoreTabs(savedInstanceState)

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (tabsOverlay.visibility == View.VISIBLE) {
                        hideTabsOverlay()
                        return
                    }
                    if (maybeHandleBrowserFullscreenBackPolicy()) {
                        return
                    }
                    if (maybeHandleYouTubeBackPolicy()) {
                        return
                    }
                    if (promotedMediaPlayer.isPromoted()) {
                        val promotedSourceUrl = promotedMediaPlayer.currentSourceUrl().orEmpty()
                        promotedMediaPlayer.currentSourceUrl()?.let { sourceUrl ->
                            suppressDirectMediaPromotion(sourceUrl, reason = "back-pressed")
                        }
                        promotedMediaPlayer.stop(reason = "back-pressed")
                        geckoView.visibility = View.VISIBLE
                        if (isExactCbcLiveHlsUrl(promotedSourceUrl)) {
                            disablePromotedPointerMode(reason = "back", keepPointerVisible = true)
                            GvLogger.i("GvInput", "cbc pointer assist restored mode=page reason=back sourceUrl=$promotedSourceUrl")
                        }
                        restoreCgtvPointerIfHidden(reason = "back")
                        return
                    }
                    val activeTab = tabController.getActiveTab()
                    val activeSession = activeTab?.session
                    val activeUrl = activeTab?.url.orEmpty()
                    if (maybeHandleAbsBackExit(activeTab, activeSession, activeUrl)) {
                        return
                    }
                    if (maybeHandleTttBackExit(activeTab, activeSession, activeUrl)) {
                        return
                    }
                    if (maybeHandleNovusTelearubaBackExit(activeTab, activeSession, activeUrl)) {
                        return
                    }
                    if (maybeHandleCbnVirginIslandsBackExit(activeTab, activeSession, activeUrl)) {
                        return
                    }
                    if (maybeHandleCvc9BackExit(activeTab, activeSession, activeUrl)) {
                        return
                    }
                    if (isCvmLiveStreamUrl(activeUrl) || isCvmVimeoPlayerUrl(activeUrl)) {
                        if (canGoBack) {
                            activeTab?.session?.goBack()
                            GvLogger.i("GvNav", "cvm back consumed reason=history url=$activeUrl")
                            return
                        }
                        activeTab?.session?.loadUri("https://kulchaflo.com/channels/cvm-tv/")
                        GvLogger.i("GvNav", "cvm back consumed reason=watch-page url=$activeUrl")
                        return
                    }
                    if (!promotedMediaPlayer.isPromoted() &&
                        pointerAssistModeActive &&
                        !isYouTubePageUrl(activeUrl) &&
                        !isFacebookUrl(activeUrl) &&
                        !isAbsTegoGestureFullscreenContextUrl(activeUrl) &&
                        !isTttOrTegoLivePlayerUrl(activeUrl) &&
                        !isNovusTelearubaContextUrl(activeUrl) &&
                        !isCvmLiveStreamUrl(activeUrl) &&
                        !isCvmVimeoPlayerUrl(activeUrl)
                    ) {
                        disablePointerAssistMode(reason = "back-to-focus-mode")
                        return
                    }
                    val tabs = tabController.getTabs()
                    val activeHost = runCatching { android.net.Uri.parse(activeTab?.url ?: "").host?.lowercase().orEmpty() }.getOrDefault("")
                    val externalHost = activeHost.isNotBlank() && !activeHost.contains("kulchaflo.com")
                    if (canGoBack) {
                        activeTab?.session?.goBack()
                        return
                    }
                    if (activeTab != null && tabs.size > 1 && externalHost) {
                        tabController.closeTab(activeTab.id)
                        return
                    }
                    if (activeTab != null && tabs.size > 1) {
                        tabController.closeTab(activeTab.id)
                        return
                    }
                    if (activeTab != null && !isKulchaFloHomepage(activeTab.url)) {
                        val shouldConfirmReturnHome =
                            activeHost.isNotBlank() &&
                                !activeHost.contains("kulchaflo.com") &&
                                !isCvmLiveStreamUrl(activeUrl) &&
                                !isCvmVimeoPlayerUrl(activeUrl)
                        if (shouldConfirmReturnHome) {
                            val now = SystemClock.elapsedRealtime()
                            if (now - lastBackToHomeAtMs > BACK_RETURN_HOME_CONFIRM_WINDOW_MS) {
                                lastBackToHomeAtMs = now
                                Toast.makeText(
                                    this@GeckoBrowserActivity,
                                    R.string.back_again_to_home,
                                    Toast.LENGTH_SHORT,
                                ).show()
                                GvLogger.i("GvNav", "back return-home confirmation armed host=$activeHost")
                                return
                            }
                            lastBackToHomeAtMs = 0L
                        }
                        lastBackToExitAtMs = 0L
                        activeTab.session.loadUri(BuildConfig.DEFAULT_START_URL)
                        return
                    }
                    val now = SystemClock.elapsedRealtime()
                    if (now - lastBackToExitAtMs > BACK_EXIT_CONFIRM_WINDOW_MS) {
                        lastBackToExitAtMs = now
                        Toast.makeText(
                            this@GeckoBrowserActivity,
                            R.string.back_again_to_exit,
                            Toast.LENGTH_SHORT,
                        ).show()
                        GvLogger.i("GvNav", "back exit confirmation armed")
                        return
                    }
                    finish()
                }
            },
        )
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val launchUrl = resolveLaunchUrl(intent) ?: return
        loadLaunchUrl(launchUrl, reason = "new-intent")
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putString(STATE_URL, currentUrl)
        outState.putStringArrayList(
            STATE_TAB_URLS,
            ArrayList(tabController.getTabs().map { it.url })
        )
        outState.putInt(
            STATE_ACTIVE_TAB_INDEX,
            tabController.getTabs().indexOfFirst { it.id == tabController.getActiveTab()?.id }.coerceAtLeast(0)
        )
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        maybeScheduleCvmVimeoDiagnosticAfterKeyAttempt(event)
        if (maybeHandleCaribVisionPlayAssistOk(event)) {
            return true
        }
        if (maybeHandleChtvPlayAssistOk(event)) {
            return true
        }
        if (maybeHandleCgtvPlayAssistOk(event)) {
            return true
        }
        if (maybeHandleNovusTelearubaPlayAssistOk(event)) {
            return true
        }
        if (maybeHandleTttTegoPlayAssistOk(event)) {
            return true
        }
        if (handleTabsOverlayInput(event)) {
            return true
        }
        if (promotedPointerModeActive && handlePromotedPointerInput(event)) {
            return true
        }
        if (handleCnc3PromotedDpadInput(event)) {
            return true
        }
        if (!promotedMediaPlayer.isPromoted() && maybeHandlePointerAssistManualSummon(event)) {
            return true
        }
        if (!promotedMediaPlayer.isPromoted() && browserMediaController.handleMediaKey(event)) {
            return true
        }
        if (!promotedMediaPlayer.isPromoted() && maybeHandleBrowserFullscreenPointerInput(event)) {
            return true
        }
        if (!promotedMediaPlayer.isPromoted() && maybeRecoverYouTubePointerAssistForDpad(event)) {
            return true
        }
        if (!promotedMediaPlayer.isPromoted() && !pointerAssistModeActive && handleKulchaFloSiteFocusInput(event)) {
            return true
        }
        if (!promotedMediaPlayer.isPromoted() && pointerAssistModeActive && handlePointerInput(event)) {
            return true
        }
        if (event.action == KeyEvent.ACTION_DOWN && event.keyCode == KeyEvent.KEYCODE_MENU) {
            toggleTabsOverlay()
            return true
        }
        return super.dispatchKeyEvent(event)
    }

    private fun maybeHandleTttTegoPlayAssistOk(event: KeyEvent): Boolean {
        if (event.keyCode != KeyEvent.KEYCODE_DPAD_CENTER && event.keyCode != KeyEvent.KEYCODE_ENTER) {
            return false
        }
        val activeTab = tabController.getActiveTab() ?: return false
        if (!isTttOrTegoLivePlayerUrl(activeTab.url)) return false
        val session = activeTab.session
        val state = tttTegoPlayAssistBySession[session]
        val pointerShown = pointerVisible && pointerOverlay.isPointerVisible()
        val allowTransportClickPassthrough = pointerShown &&
            state?.requiresUserAction != true &&
            isTttSafePointerControlZone()
        val allowMenuClickPassthrough = pointerShown &&
            state?.requiresUserAction != true &&
            hasRecentTttControlInteraction(session) &&
            isTttCenteredMenuPointerZone()
        if (event.action == KeyEvent.ACTION_UP) {
            return !(allowTransportClickPassthrough || allowMenuClickPassthrough)
        }
        if (event.action != KeyEvent.ACTION_DOWN) return false
        if (allowTransportClickPassthrough || allowMenuClickPassthrough) {
            tttTegoLastControlInteractionAtBySession[session] = SystemClock.uptimeMillis()
            GvLogger.i(
                "GvMedia",
                "ttt transport click passthrough reason=${if (allowMenuClickPassthrough) "centered-menu-zone" else "visible-transport-zone"} x=${pointerX.toInt()} y=${pointerY.toInt()} pageUrl=${activeTab.url}"
            )
            return false
        }
        val pausedConfirmed = state?.active == true &&
            state.requiresUserAction &&
            state.paused &&
            state.readyState >= 1 &&
            state.centerX >= 0f &&
            state.centerY >= 0f
        if (pausedConfirmed) {
            val playState = state ?: return true
            if (playState.playClickConsumed) {
                GvLogger.i(
                    "GvMedia",
                    "ttt play assist skipped reason=paused-confirmed-already-clicked pageUrl=${activeTab.url}"
                )
                val reveal = revealTttTransportBar(
                    reason = "ok-playing-no-click",
                    preferStoredPointer = true,
                )
                GvLogger.i(
                    "GvMedia",
                    "ttt transport reveal hover reason=ok-playing-no-click x=${reveal.x.toInt()} y=${reveal.y.toInt()} handled=${reveal.handled} pageUrl=${activeTab.url}"
                )
                return true
            }
            val x = playState.centerX
            val y = playState.centerY
            showPointerAt(x, y, reason = "ttt-play-assist")
            val handled = dispatchNativeMouseTapAt(x, y, reason = "ttt-play-assist-ok")
            playState.playClickConsumed = true
            GvLogger.i(
                "GvMedia",
                "ttt play assist click reason=paused-confirmed handled=$handled targetKind=${playState.targetKind} x=${x.toInt()} y=${y.toInt()} ready=${playState.readyState} pageUrl=${activeTab.url}"
            )
            return true
        }
        val revealReason = if (pointerShown) "ok-playing-no-click" else "ok-no-click"
        val reveal = revealTttTransportBar(
            reason = revealReason,
            preferStoredPointer = true,
        )
        if (!pointerShown) {
            GvLogger.i(
                "GvMedia",
                "ttt pointer restored reason=ok-no-click x=${reveal.x.toInt()} y=${reveal.y.toInt()} reusedStored=${reveal.restoredStoredPointer} pageUrl=${activeTab.url}"
            )
        }
        GvLogger.i(
            "GvMedia",
            "ttt play assist skipped reason=${state?.reason?.ifBlank { "already-playing" } ?: "already-playing"} pageUrl=${activeTab.url}"
        )
        GvLogger.i(
            "GvMedia",
            "ttt transport reveal hover reason=$revealReason x=${reveal.x.toInt()} y=${reveal.y.toInt()} handled=${reveal.handled} pageUrl=${activeTab.url}"
        )
        return true
    }

    private fun revealTttTransportBar(
        reason: String,
        preferStoredPointer: Boolean,
    ): TttTransportRevealResult {
        val target = resolveTttTransportRevealTarget(preferStoredPointer = preferStoredPointer)
        val activeSession = tabController.getActiveTab()?.session
        positionTttPointerForReveal(target.x, target.y)
        val bridgeHandled = activeSession?.let { dispatchTttTegoTransportRevealBridge(it, reason) } ?: false
        val hoverHandled = dispatchNativeMouseHoverAt(target.x, target.y, "ttt-transport-reveal-$reason")
        val handled = bridgeHandled || hoverHandled
        return TttTransportRevealResult(
            x = target.x,
            y = target.y,
            handled = handled,
            restoredStoredPointer = target.restoredStoredPointer,
        )
    }

    private fun dispatchTttTegoTransportRevealBridge(session: GeckoSession, reason: String): Boolean {
        val script = """
            javascript:(function(){
              try{
                var message={type:"kf-tego-transport-reveal",reason:${JSONObject.quote(reason)}};
                try{window.postMessage(message,"*");}catch(_){}
                try{
                  var frames=window.frames||[];
                  for(var i=0;i<frames.length;i+=1){
                    try{frames[i].postMessage(message,"*");}catch(_){}
                  }
                }catch(_){}
              }catch(_){}
            })();
        """.trimIndent()
        return runCatching {
            session.loadUri(script)
            true
        }.getOrElse { error ->
            GvLogger.w(
                "GvMedia",
                "ttt tego transport reveal bridge failed reason=$reason error=${error.message}"
            )
            false
        }
    }

    private fun positionTttPointerForReveal(x: Float, y: Float) {
        val pointerShown = pointerVisible && pointerOverlay.isPointerVisible()
        if (!pointerShown) {
            showPointerAt(x, y, reason = "ttt-transport-reveal")
            return
        }
        pointerX = x
        pointerY = y
        pointerOverlay.updatePosition(pointerX, pointerY)
        schedulePointerIdleTimeout()
    }

    private fun resolveTttTransportRevealTarget(preferStoredPointer: Boolean): TttTransportRevealTarget {
        val maxWidth = (geckoView.width.takeIf { it > 0 } ?: resources.displayMetrics.widthPixels).toFloat()
        val maxHeight = (geckoView.height.takeIf { it > 0 } ?: resources.displayMetrics.heightPixels).toFloat()
        val inset = pointerBoundsInsetPx()
        val minX = inset
        val maxX = maxWidth - inset
        val minY = inset
        val maxY = maxHeight - inset
        val hasStoredPosition = pointerX in minX..maxX && pointerY in minY..maxY
        if (preferStoredPointer && hasStoredPosition) {
            return TttTransportRevealTarget(
                x = pointerX.coerceIn(minX, maxX),
                y = pointerY.coerceIn(minY, maxY),
                restoredStoredPointer = true,
            )
        }
        return TttTransportRevealTarget(
            x = (maxWidth * 0.5f).coerceIn(minX, maxX),
            y = (maxHeight * 0.84f).coerceIn(minY, maxY),
            restoredStoredPointer = false,
        )
    }

    private fun isTttSafePointerControlZone(): Boolean {
        val maxWidth = (geckoView.width.takeIf { it > 0 } ?: resources.displayMetrics.widthPixels).toFloat()
        val maxHeight = (geckoView.height.takeIf { it > 0 } ?: resources.displayMetrics.heightPixels).toFloat()
        val inset = pointerBoundsInsetPx()
        val minX = inset
        val maxX = maxWidth - inset
        if (pointerX !in minX..maxX) return false
        val topControlMaxY = (maxHeight * 0.18f).coerceIn(inset, maxHeight - inset)
        val bottomControlMinY = (maxHeight * 0.68f).coerceIn(inset, maxHeight - inset)
        val bottomControlMaxY = maxHeight - inset
        val edgeBandWidth = (maxWidth * 0.15f).coerceAtLeast(inset)
        val leftEdgeMaxX = (inset + edgeBandWidth).coerceAtMost(maxX)
        val rightEdgeMinX = (maxWidth - edgeBandWidth).coerceAtLeast(minX)
        return pointerY <= topControlMaxY ||
            pointerY in bottomControlMinY..bottomControlMaxY ||
            pointerX <= leftEdgeMaxX ||
            pointerX >= rightEdgeMinX
    }

    private fun isTttCenteredMenuPointerZone(): Boolean {
        val maxWidth = (geckoView.width.takeIf { it > 0 } ?: resources.displayMetrics.widthPixels).toFloat()
        val maxHeight = (geckoView.height.takeIf { it > 0 } ?: resources.displayMetrics.heightPixels).toFloat()
        val inset = pointerBoundsInsetPx()
        val minX = (maxWidth * 0.32f).coerceIn(inset, maxWidth - inset)
        val maxX = (maxWidth * 0.68f).coerceIn(inset, maxWidth - inset)
        val minY = (maxHeight * 0.06f).coerceIn(inset, maxHeight - inset)
        val maxY = (maxHeight * 0.58f).coerceIn(inset, maxHeight - inset)
        return pointerX in minX..maxX && pointerY in minY..maxY
    }

    private fun hasRecentTttControlInteraction(session: GeckoSession): Boolean {
        val lastInteractionAt = tttTegoLastControlInteractionAtBySession[session] ?: return false
        return SystemClock.uptimeMillis() - lastInteractionAt <= 15_000L
    }

    private fun maybeHandleNovusTelearubaPlayAssistOk(event: KeyEvent): Boolean {
        if (event.keyCode != KeyEvent.KEYCODE_DPAD_CENTER && event.keyCode != KeyEvent.KEYCODE_ENTER) {
            return false
        }
        val activeTab = tabController.getActiveTab() ?: return false
        val session = activeTab.session
        val state = novusTelearubaPlayAssistBySession[session] ?: return false
        if (!state.active) return false
        if (!state.requiresUserAction) return false
        val activeUrl = activeTab.url
        val activeUri = runCatching { android.net.Uri.parse(activeUrl) }.getOrNull()
        if (!isNovusTelearubaHost(activeUri?.host)) return false
        if (event.action == KeyEvent.ACTION_UP) {
            return true
        }
        if (event.action != KeyEvent.ACTION_DOWN) return false
        val x = state.centerX.takeIf { it >= 0f } ?: (geckoView.width * 0.5f)
        val y = state.centerY.takeIf { it >= 0f } ?: (geckoView.height * 0.5f)
        showPointerAt(x, y, reason = "novus-play-assist")
        val handled = dispatchNativeMouseTapAt(x, y, reason = "novus-play-assist-ok")
        GvLogger.i(
            "GvMedia",
            "novus telearuba play assist ok dispatched handled=$handled x=${x.toInt()} y=${y.toInt()} reason=${state.reason} desiredChannel=${state.desiredChannel} pageUrl=$activeUrl"
        )
        return true
    }

    private fun maybeHandleCgtvPlayAssistOk(event: KeyEvent): Boolean {
        if (event.keyCode != KeyEvent.KEYCODE_DPAD_CENTER && event.keyCode != KeyEvent.KEYCODE_ENTER) {
            return false
        }
        val activeTab = tabController.getActiveTab() ?: return false
        if (!isCgtvContextUrl(activeTab.url)) {
            return false
        }
        if (cgtvBrowserPlaybackActiveBySession.contains(activeTab.session)) {
            // Treat browser-playback-active as evidence that playback started successfully
            // and should not permanently suppress OK/Enter. Allow the event to be handled
            // normally so the user can interact with the player after startup.
            if (event.action == KeyEvent.ACTION_DOWN) {
                GvLogger.i(
                    "GvMedia",
                    "cgtv click suppression inactive reason=browser-playback-active keyCode=${event.keyCode} pageUrl=${activeTab.url}"
                )
            }
            // Do not consume the key; let normal processing occur so player/site can receive it.
            return false
        }
        val state = cgtvPlayAssistBySession[activeTab.session] ?: return false
        if (!state.active || !state.requiresUserAction) {
            return false
        }
        if (event.action == KeyEvent.ACTION_UP) {
            return true
        }
        if (event.action != KeyEvent.ACTION_DOWN) {
            return false
        }
        dispatchCgtvPlayAssistNativeTap(activeTab.session, state, trigger = "ok")
        return true
    }

    private fun maybeHandleChtvPlayAssistOk(event: KeyEvent): Boolean {
        if (event.keyCode != KeyEvent.KEYCODE_DPAD_CENTER && event.keyCode != KeyEvent.KEYCODE_ENTER) {
            return false
        }
        val activeTab = tabController.getActiveTab() ?: return false
        if (!isChtvContextUrl(activeTab.url)) {
            return false
        }
        val state = chtvPlayAssistBySession[activeTab.session] ?: return false
        if (!state.active || !state.requiresUserAction) {
            return false
        }
        if (event.action == KeyEvent.ACTION_UP) {
            return true
        }
        if (event.action != KeyEvent.ACTION_DOWN) {
            return false
        }
        dispatchChtvPlayAssistNativeTap(activeTab.session, state, trigger = "ok")
        return true
    }

    private fun maybeHandleCaribVisionPlayAssistOk(event: KeyEvent): Boolean {
        if (event.keyCode != KeyEvent.KEYCODE_DPAD_CENTER && event.keyCode != KeyEvent.KEYCODE_ENTER) {
            return false
        }
        val activeTab = tabController.getActiveTab() ?: return false
        if (!isCaribvisionPlayerActive(activeTab.session, activeTab.url)) {
            return false
        }
        val state = caribvisionPlayAssistBySession[activeTab.session] ?: return false
        if (!state.active || !state.requiresUserAction) {
            return false
        }
        if (event.action == KeyEvent.ACTION_UP) {
            return true
        }
        if (event.action != KeyEvent.ACTION_DOWN) {
            return false
        }
        dispatchCaribvisionPlayAssistNativeTap(activeTab.session, state, trigger = "ok")
        return true
    }

    override fun onDestroy() {
        stopPointerRepeater()
        pointerHandler.removeCallbacksAndMessages(null)
        cvc9ConsentFrameNativeTapHandledMsBySession.clear()
        cvc9ConsentFrameSafety3500UsedBySession.clear()
        cvc9ConsentFrameSafety7000UsedBySession.clear()
        cvc9ConsentFrameBurstGenerationBySession.clear()
        browserMediaController.clear()
        promotedMediaPlayer.release()
        tabController.closeAll()
        super.onDestroy()
    }

    override fun onStart() {
        super.onStart()
        promotedMediaPlayer.onStart()
    }

    override fun onStop() {
        promotedMediaPlayer.onStop()
        super.onStop()
    }

    private fun configureSession(tab: GvTab) {
        tab.session.setContentDelegate(contentDelegate)
        tab.session.setNavigationDelegate(navigationDelegate)
        tab.session.setProgressDelegate(progressDelegate)
        tab.session.setPermissionDelegate(permissionDelegate)
        applyMediaSessionDelegateForUrl(tab.session, tab.url, reason = "session-config")
        tab.session.setPromptDelegate(promptDelegate)

        applyUserAgentPolicyForUrl(tab.session, tab.url, reason = "session-config")
        tab.session.settings.viewportMode = GeckoSessionSettings.VIEWPORT_MODE_DESKTOP

        GvLogger.i("GvTabs", "session configured tabId=${tab.id} url=${tab.url}")
    }

    private val progressDelegate = object : GeckoSession.ProgressDelegate {
        override fun onPageStart(session: GeckoSession, url: String) {
            val tab = tabController.findTabBySession(session)
            currentUrl = url
            loadingOverlay.visibility = View.VISIBLE
            progressBar.visibility = View.VISIBLE
            tabController.updateLoading(session, true)
            maybeStartLiveLoadTiming(session, url, event = "page-start")
            if (isCvc9DailymotionWatchPageUrl(url)) {
                resetCvc9ConsentFrameNativeTapState(session)
            }
            if (isCnc3LiveStreamPageUrl(url)) {
                cnc3AutostartTapRunnableBySession.remove(session)?.let(pointerHandler::removeCallbacks)
                cnc3AutostartAttemptedBySession.remove(session)
            }
            GvLogger.i("GvNav", "page start tabId=${tab?.id ?: "unknown"} url=$url")
        }

        override fun onPageStop(session: GeckoSession, success: Boolean) {
            val tab = tabController.findTabBySession(session)
            val pageUrl = tab?.url ?: currentUrl
            progressBar.visibility = View.GONE
            // Don't stay stuck on the loading overlay even if success is false,
            // unless it's a critical error.
            loadingOverlay.visibility = View.GONE
            tabController.updateLoading(session, false)
            GvLogger.i("GvNav", "page stop tabId=${tab?.id ?: "unknown"} success=$success url=$pageUrl")
            logLiveLoadTimingPageStop(session, pageUrl, success)
            maybeDispatchCvmVimeoDiagnostic(session, pageUrl, reason = "page-stop")
            if (success) {
                maybeScheduleCnc3AutostartTap(session, pageUrl)
            }
            if (isFacebookUrl(pageUrl)) {
                GvLogger.i(
                    "GvMedia",
                    "facebook transport snapshot url=$pageUrl ${browserMediaController.describeSessionState(session)}"
                )
            }
            if (success) {
                loadRetryAttemptsBySession.remove(session)
                maybeDispatchViewportDiagnostic(session, pageUrl, reason = "page-stop")
                maybeDispatchRailDiagnostic(session, pageUrl, reason = "page-stop")
            }
            handleMediaObservation(mediaPathController.onPageObserved(pageUrl, titleView.text?.toString()))
            if (success) {
                if (isFacebookUrl(pageUrl)) {
                    maybeDispatchFacebookCompat(session, pageUrl, reason = "page-stop")
                } else {
                    maybeDispatchKulchaFloCookieConsentCompat(session, pageUrl, reason = "page-stop")
                    maybeDispatchAmazonConsentCompat(session, pageUrl, reason = "page-stop")
                    maybeDispatchTttConsentCompat(session, pageUrl, reason = "page-stop")
                    maybeDispatchCvc9ConsentCompat(session, pageUrl, reason = "page-stop")
                    maybeDispatchYouTubeConsentCompat(session, pageUrl, reason = "page-stop")
                    armYouTubeAutoFullscreen(session, pageUrl)
                    maybeScheduleYouTubePremiumPopupChecks(session, pageUrl, reason = "page-stop")
                    if (shouldPromoteDirectMedia(pageUrl)) {
                        triggerDirectMediaProbe(session, pageUrl)
                    } else {
                        GvLogger.i(
                            "GvExt",
                            "direct media probe skipped tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} url=$pageUrl reason=live-media-surface"
                        )
                    }
                    if (shouldApplyUnifiedCompat(pageUrl)) {
                        triggerUnifiedPageCompat(session, pageUrl)
                    } else {
                        GvLogger.i(
                            "GvExt",
                            "unified compat skipped tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} url=$pageUrl reason=${unifiedCompatSkipReason(pageUrl) ?: "unknown"}"
                        )
                    }
                }
            }
        }

        override fun onProgressChange(session: GeckoSession, progress: Int) {
            progressBar.progress = progress
            GvLogger.d("GvNav", "progress=$progress tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} url=$currentUrl")
        }
    }

    private val navigationDelegate = object : GeckoSession.NavigationDelegate {
        override fun onLocationChange(
            session: GeckoSession,
            url: String?,
            perms: MutableList<GeckoSession.PermissionDelegate.ContentPermission>,
            hasUserGesture: Boolean,
        ) {
            val tab = tabController.findTabBySession(session)
            currentUrl = url ?: currentUrl
            tabController.updateLocation(session, url)
            applyPageInputModePolicy(url.orEmpty(), reason = "location-change")
            handleLiveLoadTimingLocationChange(session, url.orEmpty())
            if (isWebHttpUrl(url.orEmpty())) {
                applyUserAgentPolicyForUrl(session, url.orEmpty(), reason = "location-change")
            }
            captureNovusTelearubaProfileForSession(session, url.orEmpty(), reason = "location-change")
            updateFacebookPassiveReentryUrlState(session, url.orEmpty())
            maybeDispatchKulchaFloCookieConsentCompat(session, url.orEmpty(), reason = "location-change")
            maybeDispatchAmazonConsentCompat(session, url.orEmpty(), reason = "location-change")
            maybeDispatchTttConsentCompat(session, url.orEmpty(), reason = "location-change")
            maybeDispatchCvc9ConsentCompat(session, url.orEmpty(), reason = "location-change")
            maybeDispatchCvmVimeoDiagnostic(session, url.orEmpty(), reason = "location-change")
            maybeDispatchFacebookCompat(session, url.orEmpty(), reason = "location-change")
            maybeDispatchYouTubeConsentCompat(session, url.orEmpty(), reason = "location-change")
            armYouTubeAutoFullscreen(session, url.orEmpty())
            maybeScheduleYouTubePremiumPopupChecks(session, url.orEmpty(), reason = "location-change")
            if (!isAbsTegoChannel10ContextUrl(url.orEmpty())) {
                absTegoPlayerFirstReturnUrlBySession.remove(session)
                tttTegoPlayerFirstReturnUrlBySession.remove(session)
            }
            if (!isNovusTelearubaContextUrl(url.orEmpty())) {
                novusTelearubaPlayerFirstReturnUrlBySession.remove(session)
                novusTelearubaProfileBySession.remove(session)
                novusTelearubaPlayAssistBySession.remove(session)
            }
            if (isCgtvWatchPageUrl(url.orEmpty())) {
                resetCgtvPlayAssistAttempt(session, reason = "watch-page", pageUrl = url.orEmpty(), logWhenEmpty = true)
            } else if (!isCgtvContextUrl(url.orEmpty())) {
                resetCgtvPlayAssistAttempt(session, reason = "leave-context", pageUrl = url.orEmpty())
            }
            if (isChtvContextUrl(url.orEmpty())) {
                resetChtvPlayAssistAttempt(session, reason = "page", pageUrl = url.orEmpty(), logWhenEmpty = true)
            } else {
                resetChtvPlayAssistAttempt(session, reason = "leave-context", pageUrl = url.orEmpty())
            }
            if (isCaribVisionAppUrl(url.orEmpty())) {
                resetCaribvisionHelperAttempt(session, reason = "page", pageUrl = url.orEmpty(), logWhenEmpty = true)
            } else {
                resetCaribvisionHelperAttempt(session, reason = "leave-context", pageUrl = url.orEmpty())
            }
            if (!isCnc3LiveStreamPageUrl(url.orEmpty()) && !isCnc3DailymotionPlayerUrl(url.orEmpty())) {
                cnc3AutostartTapRunnableBySession.remove(session)?.let(pointerHandler::removeCallbacks)
                cnc3AutostartAttemptedBySession.remove(session)
            }
            if (isCvc9DailymotionWatchPageUrl(url.orEmpty())) {
                enterBrowserFullscreenPointerSleep(reason = "cvc9-dailymotion-watch-page")
            } else if (!isCvc9DailymotionConsentPageUrl(url.orEmpty())) {
                cvc9ConsentLastDispatchMsBySession.remove(session)
                cvc9ConsentWakeSentMsBySession.remove(session)
                cvc9ConsentFrameBurstGenerationBySession.remove(session)
                resetCvc9ConsentFrameNativeTapState(session)
            }
            if (isGbnContextUrl(url.orEmpty())) {
                enterBrowserFullscreenPointerSleep(reason = "gbn-dailymotion-embed-page")
            }
            applyMediaSessionDelegateForUrl(session, url, reason = "location-change")
            GvLogger.i("GvNav", "location change tabId=${tab?.id ?: "unknown"} url=${url ?: "none"} userGesture=$hasUserGesture")
        }

        override fun onCanGoBack(session: GeckoSession, canGoBack: Boolean) {
            this@GeckoBrowserActivity.canGoBack = canGoBack
            tabController.updateCanGoBack(session, canGoBack)
            GvLogger.d("GvNav", "canGoBack=$canGoBack tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} url=$currentUrl")
        }

        override fun onLoadRequest(
            session: GeckoSession,
            request: GeckoSession.NavigationDelegate.LoadRequest,
        ): GeckoResult<AllowOrDeny>? {
            val requestUri = request.uri.orEmpty()
            val triggerUri = request.triggerUri.orEmpty()
            val activeTabUrl = tabController.findTabBySession(session)?.url.orEmpty()
            val inFacebookFlow =
                isFacebookUrl(triggerUri) ||
                    isFacebookUrl(activeTabUrl) ||
                    isFacebookUrl(currentUrl)
            if (requestUri.startsWith("fb://fullscreen_video/", ignoreCase = true)) {
                val alreadyOnFacebookWatch =
                    triggerUri.contains("facebook.com/watch", ignoreCase = true) ||
                    activeTabUrl.contains("facebook.com/watch", ignoreCase = true) ||
                    currentUrl.contains("facebook.com/watch", ignoreCase = true)
                if (alreadyOnFacebookWatch) {
                    GvLogger.i(
                        "GvNav",
                        "blocked facebook fullscreen deeplink tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} uri=$requestUri action=deny-no-fallback"
                    )
                    return GeckoResult.fromValue(AllowOrDeny.DENY)
                }
                val videoId = requestUri
                    .substringAfter("fb://fullscreen_video/", "")
                    .substringBefore('?')
                    .trim()
                val fallbackWatchUrl = if (videoId.isNotBlank()) {
                    "https://www.facebook.com/watch/?v=$videoId"
                } else {
                    request.triggerUri
                }
                if (!fallbackWatchUrl.isNullOrBlank()) {
                    GvLogger.i(
                        "GvNav",
                        "blocked facebook fullscreen deeplink tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} uri=$requestUri fallback=$fallbackWatchUrl"
                    )
                    session.loadUri(fallbackWatchUrl)
                    return GeckoResult.fromValue(AllowOrDeny.DENY)
                }
            }
            if (inFacebookFlow && isFacebookNativeScheme(requestUri)) {
                GvLogger.i(
                    "GvNav",
                    "blocked facebook native scheme tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} uri=$requestUri trigger=${request.triggerUri ?: "none"} action=deny"
                )
                return GeckoResult.fromValue(AllowOrDeny.DENY)
            }
            if (inFacebookFlow && isFacebookRegDialogUrl(requestUri)) {
                val nextUrl = extractFacebookDialogNextUrl(requestUri)
                if (!nextUrl.isNullOrBlank() && !isFacebookRegDialogUrl(nextUrl)) {
                    GvLogger.i(
                        "GvNav",
                        "blocked facebook reg dialog tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} uri=$requestUri reroute=$nextUrl"
                    )
                    session.loadUri(nextUrl)
                    return GeckoResult.fromValue(AllowOrDeny.DENY)
                }
            }
            val normalizedDesktopFacebookUrl = normalizeToDesktopFacebookUrl(requestUri)
            if (inFacebookFlow && !normalizedDesktopFacebookUrl.isNullOrBlank() && normalizedDesktopFacebookUrl != requestUri) {
                GvLogger.i(
                    "GvNav",
                    "normalized facebook host to desktop tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} from=$requestUri to=$normalizedDesktopFacebookUrl trigger=${request.triggerUri ?: "none"}"
                )
                session.loadUri(normalizedDesktopFacebookUrl)
                return GeckoResult.fromValue(AllowOrDeny.DENY)
            }
            if (requestUri.startsWith("javascript:", ignoreCase = true)) {
                GvLogger.d(
                    "GvNav",
                    "load request javascript tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} trigger=${request.triggerUri ?: "none"}"
                )
                return GeckoResult.fromValue(AllowOrDeny.ALLOW)
            }
            if (isCvc9LivePageUrl(requestUri)) {
                GvLogger.i(
                    "GvNav",
                    "cvc9 request rewrite uri=$requestUri to=$CVC9_DAILYMOTION_WATCH_PAGE_URL trigger=${request.triggerUri ?: "none"}"
                )
                session.loadUri(CVC9_DAILYMOTION_WATCH_PAGE_URL)
                return GeckoResult.fromValue(AllowOrDeny.DENY)
            }
            val inCvc9Flow =
                isCvc9DailymotionConsentContextUrl(triggerUri) ||
                    isCvc9DailymotionConsentContextUrl(activeTabUrl) ||
                    isCvc9DailymotionConsentContextUrl(currentUrl) ||
                    isCvc9LivePageUrl(triggerUri) ||
                    isCvc9LivePageUrl(activeTabUrl) ||
                    isCvc9LivePageUrl(currentUrl)
            if (inCvc9Flow && isCvc9AdclickUrl(requestUri)) {
                GvLogger.i(
                    "GvNav",
                    "cvc9 adclick request denied uri=$requestUri"
                )
                return GeckoResult.fromValue(AllowOrDeny.DENY)
            }
            val inGbnFlow =
                isGbnContextUrl(triggerUri) ||
                    isGbnContextUrl(activeTabUrl) ||
                    isGbnContextUrl(currentUrl) ||
                    isGbnDailymotionConsentPageUrl(triggerUri) ||
                    isGbnDailymotionConsentPageUrl(activeTabUrl) ||
                    isGbnDailymotionConsentPageUrl(currentUrl) ||
                    isGbnLivePageUrl(triggerUri) ||
                    isGbnLivePageUrl(activeTabUrl) ||
                    isGbnLivePageUrl(currentUrl)
            if (inGbnFlow && isGbnDailymotionAdNavigationUrl(requestUri)) {
                GvLogger.i(
                    "GvNav",
                    "gbn ad navigation request denied uri=$requestUri"
                )
                return GeckoResult.fromValue(AllowOrDeny.DENY)
            }
            captureNovusTelearubaProfileForSession(session, triggerUri, reason = "load-request-trigger")
            captureNovusTelearubaProfileForSession(session, activeTabUrl, reason = "load-request-active-tab")
            captureNovusTelearubaProfileForSession(session, currentUrl, reason = "load-request-current-url")
            maybeRewriteNovusTelearubaRequestUrl(session, requestUri)?.let { rewrittenUrl ->
                GvLogger.i(
                    "GvNav",
                    "novus telearuba request rewrite uri=$requestUri rewritten=$rewrittenUrl tabId=${tabController.findTabBySession(session)?.id ?: "unknown"}"
                )
                session.loadUri(rewrittenUrl)
                return GeckoResult.fromValue(AllowOrDeny.DENY)
            }
            if (isWebHttpUrl(requestUri)) {
                applyUserAgentPolicyForUrl(session, requestUri, reason = "load-request")
            }
            GvLogger.i(
                "GvNav",
                "load request tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} uri=${request.uri} trigger=${request.triggerUri ?: "none"}"
            )
            return GeckoResult.fromValue(AllowOrDeny.ALLOW)
        }

        override fun onNewSession(
            session: GeckoSession,
            uri: String,
        ): GeckoResult<GeckoSession>? {
            val sourceTabId = tabController.findTabBySession(session)?.id ?: "unknown"
            val sourceTabUrl = tabController.findTabBySession(session)?.url.orEmpty()
            val inCvc9Flow =
                isCvc9DailymotionConsentContextUrl(sourceTabUrl) ||
                    isCvc9DailymotionConsentContextUrl(currentUrl) ||
                    isCvc9LivePageUrl(sourceTabUrl) ||
                    isCvc9LivePageUrl(currentUrl)
            if (inCvc9Flow && isCvc9AdclickUrl(uri)) {
                GvLogger.i(
                    "GvNav",
                    "cvc9 new session denied reason=dailymotion-adclick-popup sourceTabId=$sourceTabId"
                )
                return null
            }
            val inGbnFlow =
                isGbnContextUrl(sourceTabUrl) ||
                    isGbnContextUrl(currentUrl) ||
                    isGbnDailymotionConsentPageUrl(sourceTabUrl) ||
                    isGbnDailymotionConsentPageUrl(currentUrl) ||
                    isGbnLivePageUrl(sourceTabUrl) ||
                    isGbnLivePageUrl(currentUrl)
            if (inGbnFlow && isGbnDailymotionAdNavigationUrl(uri)) {
                GvLogger.i(
                    "GvNav",
                    "gbn new session denied reason=dailymotion-ad-popup sourceTabId=$sourceTabId"
                )
                return null
            }
            if (isFacebookUrl(uri)) {
                val staleFacebookTabs = tabController.getTabs().filter { tab ->
                    tab.id != sourceTabId && isFacebookUrl(tab.url)
                }
                if (staleFacebookTabs.isNotEmpty()) {
                    staleFacebookTabs.forEach { tabController.closeTab(it.id) }
                    browserMediaController.clear()
                    GvLogger.i(
                        "GvNav",
                        "facebook stale tabs closed sourceTabId=$sourceTabId closedCount=${staleFacebookTabs.size}"
                    )
                }
            }
            val newTab = tabController.createUnopenedTab(uri, activate = true)
            val novusProfile = novusTelearubaProfileBySession[session]
            if (novusProfile != null && isNovusTelearubaHost(runCatching { android.net.Uri.parse(uri) }.getOrNull()?.host)) {
                novusTelearubaProfileBySession[newTab.session] = novusProfile
                GvLogger.i(
                    "GvNav",
                    "novus telearuba profile active desiredChannel=${novusProfile.desiredChannel} returnUrl=${novusProfile.returnUrl} reason=new-session"
                )
            }
            GvLogger.i(
                "GvNav",
                "new session sourceTabId=$sourceTabId uri=$uri newTabId=${newTab.id}"
            )
            return GeckoResult.fromValue(newTab.session)
        }

        override fun onLoadError(
            session: GeckoSession,
            uri: String?,
            error: org.mozilla.geckoview.WebRequestError,
        ): GeckoResult<String>? {
            GvLogger.e(
                "GvNav",
                "load error tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} uri=${uri ?: "unknown"} category=${error.category} code=${error.code}"
            )
            scheduleTransientLoadRetry(session, uri, error)
            return null
        }
    }

    private val contentDelegate = object : GeckoSession.ContentDelegate {
        override fun onTitleChange(session: GeckoSession, title: String?) {
            val resolvedTitle = title?.ifBlank { getString(R.string.app_name_gv) } ?: getString(R.string.app_name_gv)
            titleView.text = resolvedTitle
            tabController.updateTitle(session, resolvedTitle)
            GvLogger.i("GvContent", "title change tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} title=$resolvedTitle")
        }

        override fun onFullScreen(session: GeckoSession, fullScreen: Boolean) {
            youtubeFullscreenStateBySession[session] = fullScreen
            browserFullscreenStateBySession[session] = fullScreen
            val pageUrl = tabController.findTabBySession(session)?.url.orEmpty()
            if (fullScreen) {
                if (youtubeAutoFsArmedUrlBySession[session] != null && isYouTubeWatchOrLivePageUrl(pageUrl)) {
                    GvLogger.i("GvInput", "youtube-native-fullscreen-success reason=fullscreen-callback url=$pageUrl")
                }
                stopYouTubeAutoFullscreen(session, reason = "fullscreen-enter")
                maybeScheduleYouTubeQualityHelper(session, pageUrl, reason = "fullscreen-success", delayMs = 700L)
                maybeDispatchYouTubeFullscreenChatGuard(session, pageUrl, reason = "fullscreen-enter", delayMs = 100L)
                maybeDispatchYouTubeChatCollapseForFullscreen(session, pageUrl, reason = "fullscreen-enter", delayMs = 260L)
                maybeScheduleYouTubePremiumPopupChecks(session, pageUrl, reason = "fullscreen-enter")
                if (isFacebookUrl(pageUrl)) {
                    val fullscreenCheckAttempt =
                        ((facebookVideoHelperFullscreenCheckCountBySession[session] ?: 0) + 1)
                            .coerceAtMost(FACEBOOK_VIDEO_HELPER_MAX_FULLSCREEN_CALLBACK_CHECKS_PER_URL)
                    facebookVideoHelperFullscreenCheckCountBySession[session] = fullscreenCheckAttempt
                    markFacebookVideoHelperSequenceComplete(session, pageUrl)
                    GvLogger.i(
                        "GvInput",
                        "facebook-video-helper fullscreen-check result=entered attempt=$fullscreenCheckAttempt pageUrl=$pageUrl"
                    )
                    GvLogger.i("GvInput", "facebook-video-helper skipped reason=sequence-complete pageUrl=$pageUrl")
                }
                if (isCaribvisionPlayerActive(session, pageUrl)) {
                    cancelCaribvisionFullscreenCheck(session)
                    caribvisionFullscreenStageBySession[session] = CARIBVISION_FULLSCREEN_STAGE_ENTERED
                    val attempt = caribvisionFullscreenAssistNativeTapCountBySession[session] ?: 0
                    caribvisionFullscreenAssistNativeTapCountBySession.remove(session)
                    caribvisionFullscreenAssistNativeTapLastMsBySession.remove(session)
                    GvLogger.i(
                        "GvMedia",
                        "caribvision fullscreen check result=entered attempt=$attempt pageUrl=$pageUrl"
                    )
                    GvLogger.i("GvMedia", "caribvision fullscreen complete pageUrl=$pageUrl")
                }
                enterBrowserFullscreenPointerSleep(reason = "fullscreen-enter")
            } else {
                maybeDispatchYouTubeFullscreenChatGuardRemove(session, pageUrl, reason = "fullscreen-exit")
                if (tabController.getActiveTab()?.session == session) {
                browserFullscreenPointerSleepActive = false
                browserFullscreenWakeOnlyPendingKeyUp = false
                GvLogger.i("GvInput", "browser fullscreen pointer sleep exit reason=fullscreen-exit")
                }
            }
            val liveMediaSurface = isLiveMediaSurfaceUrl(tabController.findTabBySession(session)?.url.orEmpty())
            val controller = WindowInsetsControllerCompat(window, window.decorView)
            if (fullScreen && !liveMediaSurface) {
                controller.hide(WindowInsetsCompat.Type.systemBars())
            } else {
                controller.show(WindowInsetsCompat.Type.systemBars())
            }
            GvLogger.i(
                "GvContent",
                "fullscreen tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} enabled=$fullScreen liveMediaSurface=$liveMediaSurface"
            )
        }
    }

    override fun onTabCreated(tab: GvTab) {
        GvLogger.i("GvTabs", "tab created id=${tab.id} url=${tab.url}")
    }

    override fun onTabActivated(tab: GvTab) {
        geckoView.setSession(tab.session)
        applyMediaSessionDelegateForUrl(tab.session, tab.url, reason = "tab-activated")
        currentUrl = tab.url
        canGoBack = tab.canGoBack
        titleView.text = tab.title.ifBlank { getString(R.string.app_name_gv) }
        if (tab.isLoading) {
            loadingOverlay.visibility = View.VISIBLE
        }
        applyPageInputModePolicy(tab.url, reason = "tab-activated")
        val observation = mediaPathController.onPageObserved(tab.url, tab.title)
        handleMediaObservation(observation)
        GvLogger.i("GvTabs", "tab activated id=${tab.id} url=${tab.url} loading=${tab.isLoading}")
    }

    override fun onTabClosed(tab: GvTab) {
        loadRetryAttemptsBySession.remove(tab.session)
        absTegoPlayerFirstReturnUrlBySession.remove(tab.session)
        tttTegoPlayerFirstReturnUrlBySession.remove(tab.session)
        tttTegoPlayAssistBySession.remove(tab.session)
        novusTelearubaProfileBySession.remove(tab.session)
        novusTelearubaPlayerFirstReturnUrlBySession.remove(tab.session)
        novusTelearubaPlayAssistBySession.remove(tab.session)
        cgtvPlayAssistBySession.remove(tab.session)
        cgtvPlayAssistNativeTapCountBySession.remove(tab.session)
        cgtvPlayAssistNativeTapLastMsBySession.remove(tab.session)
        chtvPlayAssistBySession.remove(tab.session)
        chtvPlayAssistNativeTapCountBySession.remove(tab.session)
        chtvPlayAssistNativeTapLastMsBySession.remove(tab.session)
        chtvFullscreenAssistBySession.remove(tab.session)
        chtvFullscreenAssistNativeTapCountBySession.remove(tab.session)
        chtvFullscreenAssistNativeTapLastMsBySession.remove(tab.session)
        chtvFullscreenAssistSuppressedUrlBySession.remove(tab.session)
        caribvisionSessionStateBySession.remove(tab.session)
        caribvisionPlayAssistBySession.remove(tab.session)
        caribvisionPlayAssistNativeTapCountBySession.remove(tab.session)
        caribvisionPlayAssistNativeTapLastMsBySession.remove(tab.session)
        caribvisionFullscreenAssistBySession.remove(tab.session)
        caribvisionFullscreenAssistNativeTapCountBySession.remove(tab.session)
        caribvisionFullscreenAssistNativeTapLastMsBySession.remove(tab.session)
        caribvisionFullscreenAssistSuppressedUrlBySession.remove(tab.session)
        cancelCaribvisionFullscreenCheck(tab.session)
        caribvisionFullscreenStageBySession.remove(tab.session)
        cgtvBrowserPlaybackActiveBySession.remove(tab.session)
        clearFacebookVideoHelperTracking(tab.session)
        stopYouTubeAutoFullscreen(tab.session, reason = "tab-closed")
        clearYouTubeQualityHelperTracking(tab.session)
        clearYouTubePremiumPopupTracking(tab.session)
        youtubeFullscreenChatCollapseLastDispatchMsBySession.remove(tab.session)
        youtubeFullscreenStateBySession.remove(tab.session)
        browserFullscreenStateBySession.remove(tab.session)
        clearCgtvPlayAssistFallback(tab.session)
        resetCvc9ConsentFrameNativeTapState(tab.session)
        browserMediaController.clearForTab(tab.id)
        GvLogger.i("GvTabs", "tab closed id=${tab.id} url=${tab.url}")
        applyPageInputModePolicy(tabController.getActiveTab()?.url.orEmpty(), reason = "tab-closed")
    }

    private fun scheduleTransientLoadRetry(
        session: GeckoSession,
        uri: String?,
        error: org.mozilla.geckoview.WebRequestError,
    ) {
        if (error.category != TRANSIENT_LOAD_ERROR_CATEGORY || error.code != TRANSIENT_LOAD_ERROR_CODE) {
            return
        }
        val tab = tabController.findTabBySession(session) ?: return
        val retryUriRaw = uri ?: tab.url
        val retryUri = normalizedRetryUri(retryUriRaw) ?: return
        val attempts = loadRetryAttemptsBySession.getOrPut(session) { LinkedHashMap() }
        val currentAttempt = attempts[retryUri] ?: 0
        if (currentAttempt >= MAX_TRANSIENT_LOAD_RETRIES) {
            GvLogger.w(
                "GvNav",
                "retry limit reached tabId=${tab.id} uri=$retryUri attempts=$currentAttempt"
            )
            return
        }
        val nextAttempt = currentAttempt + 1
        attempts[retryUri] = nextAttempt
        val retryDelayMs = RETRY_DELAY_BASE_MS * nextAttempt
        GvLogger.w(
            "GvNav",
            "retrying transient load tabId=${tab.id} uri=$retryUri attempt=$nextAttempt/$MAX_TRANSIENT_LOAD_RETRIES delayMs=$retryDelayMs"
        )
        pointerHandler.postDelayed(
            {
                if (isFinishing || isDestroyed) {
                    return@postDelayed
                }
                val pendingAttempt = loadRetryAttemptsBySession[session]?.get(retryUri) ?: return@postDelayed
                if (pendingAttempt != nextAttempt) {
                    return@postDelayed
                }
                if (tabController.findTabBySession(session) == null) {
                    return@postDelayed
                }
                GvLogger.i(
                    "GvNav",
                    "retry dispatch tabId=${tab.id} uri=$retryUri attempt=$nextAttempt"
                )
                session.loadUri(retryUri)
            },
            retryDelayMs,
        )
    }

    private fun normalizedRetryUri(uri: String?): String? {
        val value = uri?.trim().orEmpty()
        if (value.isBlank() || value == "about:blank") {
            return null
        }
        if (!(value.startsWith("http://") || value.startsWith("https://"))) {
            return null
        }
        return value
    }

    override fun onTabsChanged(tabs: List<GvTab>, activeTabId: String?) {
        renderTabsOverlay(tabs, activeTabId)
    }

    private fun configureWindowForTv() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun renderTabsOverlay(tabs: List<GvTab>, activeTabId: String?) {
        tabsContainer.removeAllViews()
        if (tabs.isEmpty()) return
        selectedOverlayIndex = selectedOverlayIndex.coerceIn(0, tabs.lastIndex)
        tabs.forEachIndexed { index, tab ->
            val chip = TextView(this).apply {
                text = buildString {
                    if (tab.isLoading) append("* ")
                    append(tab.title.ifBlank { tab.url })
                }
                maxLines = 1
                setPadding(24, 14, 24, 14)
                textSize = 15f
                isAllCaps = false
                val isSelected = index == selectedOverlayIndex
                val isActive = tab.id == activeTabId
                alpha = if (isSelected || isActive) 1f else 0.72f
                background = getDrawable(R.drawable.tab_chip_background)
                setTextColor(getColor(android.R.color.white))
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply { marginEnd = 16 }
            }
            tabsContainer.addView(chip)
        }
    }

    private fun toggleTabsOverlay() {
        if (tabsOverlay.visibility == View.VISIBLE) {
            hideTabsOverlay()
        } else {
            tabsOverlay.visibility = View.VISIBLE
            selectedOverlayIndex = tabController.getTabs().indexOfFirst { it.id == tabController.getActiveTab()?.id }.coerceAtLeast(0)
            renderTabsOverlay(tabController.getTabs(), tabController.getActiveTab()?.id)
            GvLogger.i("GvTabs", "tabs overlay shown count=${tabController.getTabs().size}")
        }
    }

    private fun hideTabsOverlay() {
        tabsOverlay.visibility = View.GONE
        GvLogger.i("GvTabs", "tabs overlay hidden")
    }

    private fun handleTabsOverlayInput(event: KeyEvent): Boolean {
        if (tabsOverlay.visibility != View.VISIBLE || event.action != KeyEvent.ACTION_DOWN) {
            return false
        }
        val tabs = tabController.getTabs()
        if (tabs.isEmpty()) return false
        when (event.keyCode) {
            KeyEvent.KEYCODE_DPAD_LEFT -> {
                selectedOverlayIndex = (selectedOverlayIndex - 1).coerceAtLeast(0)
                renderTabsOverlay(tabs, tabController.getActiveTab()?.id)
                return true
            }

            KeyEvent.KEYCODE_DPAD_RIGHT -> {
                selectedOverlayIndex = (selectedOverlayIndex + 1).coerceAtMost(tabs.lastIndex)
                renderTabsOverlay(tabs, tabController.getActiveTab()?.id)
                return true
            }

            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> {
                tabController.activateTab(tabs[selectedOverlayIndex].id)
                hideTabsOverlay()
                return true
            }

            KeyEvent.KEYCODE_DEL, KeyEvent.KEYCODE_FORWARD_DEL -> {
                if (tabs.size > 1) {
                    tabController.closeTab(tabs[selectedOverlayIndex].id)
                    selectedOverlayIndex = selectedOverlayIndex.coerceAtMost((tabController.getTabs().size - 1).coerceAtLeast(0))
                }
                return true
            }

            KeyEvent.KEYCODE_BACK, KeyEvent.KEYCODE_MENU -> {
                hideTabsOverlay()
                return true
            }
        }
        return false
    }

    private fun restoreTabs(savedInstanceState: Bundle?) {
        val restoredUrls = savedInstanceState?.getStringArrayList(STATE_TAB_URLS).orEmpty()
        if (restoredUrls.isEmpty()) {
            currentUrl = resolveLaunchUrl(intent) ?: BuildConfig.DEFAULT_START_URL
            loadingOverlay.visibility = View.VISIBLE
            tabController.createTab(currentUrl, activate = true)
            GvLogger.i("GvTabs", "restore default url=$currentUrl")
            return
        }
        loadingOverlay.visibility = View.VISIBLE
        val restoredActiveIndex = savedInstanceState?.getInt(STATE_ACTIVE_TAB_INDEX, 0) ?: 0
        val restoredTabs = restoredUrls.mapIndexed { index, url ->
            val activate = index == 0
            tabController.createTab(url, activate = activate)
        }
        val targetId = restoredTabs.getOrNull(restoredActiveIndex.coerceIn(0, restoredTabs.lastIndex))?.id ?: restoredTabs.first().id
        tabController.activateTab(targetId)
        GvLogger.i("GvTabs", "restore tabs count=${restoredTabs.size} activeIndex=$restoredActiveIndex activeId=$targetId")
    }

    private fun resolveLaunchUrl(intent: Intent?): String? {
        val rawUrl =
            intent?.getStringExtra(EXTRA_URL)
                ?: intent?.dataString
                ?: return null
        val url = rawUrl.trim()
        if (!isWebHttpUrl(url)) {
            GvLogger.w("GvNav", "ignored launch url=$rawUrl reason=non-http")
            return null
        }
        return url
    }

    private fun loadLaunchUrl(url: String, reason: String) {
        val launchUrl = if (isCvc9LivePageUrl(url)) CVC9_DAILYMOTION_WATCH_PAGE_URL else url
        val activeTab = tabController.getActiveTab()
        if (activeTab == null) {
            currentUrl = launchUrl
            loadingOverlay.visibility = View.VISIBLE
            tabController.createTab(launchUrl, activate = true)
            GvLogger.i("GvNav", "launch url created tab reason=$reason url=$launchUrl")
            return
        }
        currentUrl = launchUrl
        loadingOverlay.visibility = View.VISIBLE
        applyUserAgentPolicyForUrl(activeTab.session, launchUrl, reason = "launch-$reason")
        applyMediaSessionDelegateForUrl(activeTab.session, launchUrl, reason = "launch-$reason")
        activeTab.session.loadUri(launchUrl)
        GvLogger.i("GvNav", "launch url loaded tabId=${activeTab.id} reason=$reason url=$launchUrl")
    }

    private fun handleMediaObservation(observation: GvMediaPathController.Observation?) {
        when {
            observation == null -> {
                val activePromotedUrl = promotedMediaPlayer.currentSourceUrl().orEmpty()
                if (
                    isCaribVisionAppUrl(currentUrl) &&
                    isExactCaribVisionLiveHlsUrl(activePromotedUrl)
                ) {
                    GvLogger.i(
                        "GvMedia",
                        "caribvision native keep-alive reason=page-not-eligible currentUrl=$currentUrl sourceUrl=$activePromotedUrl"
                    )
                    return
                }
                if (
                    isCbcLivePageUrl(currentUrl) &&
                    isExactCbcLiveHlsUrl(activePromotedUrl)
                ) {
                    GvLogger.i(
                        "GvMedia",
                        "cbc native keep-alive reason=page-not-eligible currentUrl=$currentUrl sourceUrl=$activePromotedUrl"
                    )
                    return
                }
                promotedMediaPlayer.stop(reason = "page-not-eligible")
                geckoView.visibility = View.VISIBLE
                restoreCgtvPointerIfHidden(reason = "page-not-eligible")
                try {
                    pointerOverlay.visibility = View.VISIBLE
                } catch (_: Throwable) {
                }
            }

            observation.kind == GvMediaPathController.ObservationKind.DIRECT_MEDIA_READY -> {
                if (isCvc9DailymotionWatchPageUrl(currentUrl) || isCvc9DailymotionBrowserPlayerContextUrl(observation.url)) {
                    GvLogger.i(
                        "GvMedia",
                        "cvc9 native promote skipped reason=dailymotion-browser-player pageUrl=${observation.url} currentUrl=$currentUrl"
                    )
                    promotedMediaPlayer.stop(reason = "cvc9-dailymotion-browser-player")
                    geckoView.visibility = View.VISIBLE
                    return
                }
                if (isGbnDailymotionBrowserPlayerContextUrl(observation.url) || (isGbnContextUrl(currentUrl) && isGbnDailymotionAdAssetUrl(observation.url))) {
                    GvLogger.i(
                        "GvMedia",
                        "gbn native promote skipped reason=dailymotion-browser-player pageUrl=${observation.url} currentUrl=$currentUrl"
                    )
                    promotedMediaPlayer.stop(reason = "gbn-dailymotion-browser-player")
                    geckoView.visibility = View.VISIBLE
                    return
                }
                if (!shouldPromoteDirectMedia(observation.url)) {
                    GvLogger.i(
                        "GvMedia",
                        "promote skipped sourceKind=EXTRACTED_STREAM url=${observation.url} reason=live-media-surface"
                    )
                    promotedMediaPlayer.stop(reason = "live-media-surface")
                    geckoView.visibility = View.VISIBLE
                    return
                }
                if (isDirectMediaPromotionSuppressed(observation.url)) {
                    GvLogger.i(
                        "GvMedia",
                        "promote deferred sourceKind=EXTRACTED_STREAM url=${observation.url} reason=suppressed-after-back"
                    )
                    geckoView.visibility = View.VISIBLE
                    restoreCgtvPointerIfHidden(reason = "deferred")
                    try {
                        pointerOverlay.visibility = View.VISIBLE
                    } catch (_: Throwable) {
                    }
                    return
                }
                val activePageUrl = tabController.getActiveTab()?.url.orEmpty()
                val cgtvContext = isCgtvContextUrl(activePageUrl) || isCgtvContextUrl(observation.url)
                if (cgtvContext && !isLikelyCgtvLiveSourceUrl(observation.url, observation.mimeHint)) {
                    GvLogger.i(
                        "GvMedia",
                        "cgtv promoted player-first skipped reason=wrong-layer url=${observation.url}"
                    )
                    promotedMediaPlayer.stop(reason = "cgtv-wrong-layer")
                    geckoView.visibility = View.VISIBLE
                    restoreCgtvPointerIfHidden(reason = "wrong-layer")
                    return
                }
                if (cgtvContext) {
                    GvLogger.i(
                        "GvMedia",
                        "cgtv promoted player-first skipped reason=native-player-disabled url=${observation.url}"
                    )
                    promotedMediaPlayer.stop(reason = "cgtv-native-disabled")
                    geckoView.visibility = View.VISIBLE
                    restoreCgtvPointerIfHidden(reason = "native-player-disabled")
                    return
                }
                GvLogger.i(
                    "GvMedia",
                    "promote accepted sourceKind=EXTRACTED_STREAM pageKind=${observation.pageKind} url=${observation.url} reason=${observation.reason}"
                )
                geckoView.visibility = View.GONE
                promotedMediaPlayer.play(observation)
            }

            else -> {
                promotedMediaPlayer.stop(reason = "candidate-only-page")
                geckoView.visibility = View.VISIBLE
                restoreCgtvPointerIfHidden(reason = "candidate-only")
                try {
                    pointerOverlay.visibility = View.VISIBLE
                } catch (_: Throwable) {
                }
            }
        }
    }

    private val promptDelegate = object : GeckoSession.PromptDelegate {
        override fun onTextPrompt(
            session: GeckoSession,
            prompt: GeckoSession.PromptDelegate.TextPrompt,
        ): GeckoResult<GeckoSession.PromptDelegate.PromptResponse> {
            val message = prompt.message ?: ""
            GvLogger.i(
                "GvExt",
                "text prompt received tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} title=${prompt.title ?: ""} messagePrefix=${message.take(48)}"
            )
            if (!message.startsWith(PROMPT_PREFIX)) {
                return GeckoResult.fromValue(prompt.confirm(prompt.defaultValue ?: ""))
            }
            val raw = message.removePrefix(PROMPT_PREFIX)
            val payload = runCatching { JSONObject(raw) }.getOrElse {
                GvLogger.w("GvExt", "media observer prompt parse failed tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} raw=$raw")
                return GeckoResult.fromValue(prompt.confirm(""))
            }
            handleExtensionPayload(session, payload, source = "text-prompt")
            return GeckoResult.fromValue(prompt.confirm(""))
        }
    }

    private fun triggerDirectMediaProbe(session: GeckoSession, pageUrl: String) {
        val normalizedUrl = pageUrl.ifBlank { return }
        if (normalizedUrl == "about:blank") {
            return
        }
        if (lastProbeUrlBySession[session] == normalizedUrl) {
            return
        }
        lastProbeUrlBySession[session] = normalizedUrl
        val script = buildString {
            append("javascript:(function(){")
            append("try{")
            append("var media=Array.from(document.querySelectorAll('video,audio'));")
            append("var directCandidates=[];")
            append("var isVisible=function(el){")
            append("if(!el)return false;")
            append("var style=window.getComputedStyle(el);")
            append("var rect=el.getBoundingClientRect();")
            append("return style&&style.display!=='none'&&style.visibility!=='hidden'&&rect.width>2&&rect.height>2;")
            append("};")
            append("media.forEach(function(element){")
            append("var currentSrc=element.currentSrc||element.src||'';")
            append("var sourceChildren=Array.from(element.querySelectorAll('source[src]')).map(function(source){return source.src||'';});")
            append("var allSources=[currentSrc].concat(sourceChildren).filter(Boolean);")
            append("allSources.forEach(function(src){")
            append("directCandidates.push({")
            append("src:src,")
            append("tagName:(element.tagName||'').toLowerCase(),")
            append("visible:isVisible(element),")
            append("isBlob:src.startsWith('blob:'),")
            append("mimeType:element.getAttribute('type')||'',")
            append("currentTime:(typeof element.currentTime==='number'?element.currentTime:0),")
            append("duration:(typeof element.duration==='number'?element.duration:0)")
            append("});")
            append("});")
            append("});")
            append("window.prompt(")
            append(JSONObject.quote(PROMPT_PREFIX))
            append("+JSON.stringify({")
            append("type:'media-evidence',")
            append("phase:'activity-js-probe',")
            append("pageUrl:window.location.href,")
            append("title:document.title||'',")
            append("candidateCount:directCandidates.length,")
            append("directCandidates:directCandidates")
            append("}), '');")
            append("}catch(_){}")
            append("})();")
        }
        GvLogger.i("GvExt", "direct media probe dispatched tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} url=$normalizedUrl")
        session.loadUri(script)
    }

    private fun triggerUnifiedPageCompat(session: GeckoSession, pageUrl: String) {
        val normalizedUrl = pageUrl.ifBlank { return }
        if (normalizedUrl == "about:blank") {
            return
        }
        val skipReason = unifiedCompatSkipReason(normalizedUrl)
        if (skipReason != null) {
            GvLogger.i(
                "GvExt",
                "unified compat skipped tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} url=$normalizedUrl reason=$skipReason"
            )
            return
        }
        val denyLabelsJs = CONSENT_DENY_LABELS.joinToString(",") { JSONObject.quote(it) }
        val allowLabelsJs = CONSENT_ALLOW_LABELS.joinToString(",") { JSONObject.quote(it) }
        val contextKeywordsJs = CONSENT_CONTEXT_KEYWORDS.joinToString(",") { JSONObject.quote(it) }
        val script = """
            javascript:(function(){
              try{
                if(window.__kfUnifiedCompatInstalled){
                  if(window.__kfUnifiedCompatPoke){window.__kfUnifiedCompatPoke();}
                  return;
                }
                window.__kfUnifiedCompatInstalled=true;
                var promptPrefix=${JSONObject.quote(PROMPT_PREFIX)};
                var decision=${JSONObject.quote(CONSENT_DEFAULT_DECISION)};
                var pageScale=${GLOBAL_SITE_SCALE};
                var widthCompensation=${GLOBAL_WIDTH_COMPENSATION};
                var denyLabels=[$denyLabelsJs];
                var allowLabels=[$allowLabelsJs];
                var contextKeywords=[$contextKeywordsJs];
                var lower=function(v){return ((v||'')+'').trim().toLowerCase();};
                var textOf=function(node){return lower(node&&(node.innerText||node.textContent||node.value||''));};
                var collectDocuments=function(){
                  var docs=[document];
                  try{
                    Array.from(document.querySelectorAll('iframe')).forEach(function(frame){
                      try{
                        var d=frame.contentDocument;
                        if(d){docs.push(d);}
                      }catch(_){}
                    });
                  }catch(_){}
                  return docs;
                };
                var attrBlob=function(node){
                  if(!node||!node.getAttribute){return '';}
                  return lower(
                    (node.getAttribute('aria-label')||'')+' '+
                    (node.getAttribute('name')||'')+' '+
                    (node.getAttribute('id')||'')+' '+
                    (node.getAttribute('value')||'')+' '+
                    (node.getAttribute('data-action')||'')+' '+
                    (node.getAttribute('data-testid')||'')+' '+
                    (node.className||'')
                  );
                };
                var inConsentContext=function(node){
                  var cursor=node;
                  for(var depth=0; depth<6 && cursor; depth++){
                    var role=lower(cursor.getAttribute&&cursor.getAttribute('role'));
                    var contextBlob=lower((cursor.id||'')+' '+(cursor.className||'')+' '+(cursor.getAttribute&&cursor.getAttribute('aria-label')||'')+' '+textOf(cursor).slice(0,320));
                    if(role==='dialog' || role==='alertdialog'){return true;}
                    for(var k=0; k<contextKeywords.length; k++){
                      if(contextBlob.indexOf(contextKeywords[k])>=0){return true;}
                    }
                    cursor=cursor.parentElement;
                  }
                  return false;
                };
                var isVisibleButton=function(node){
                  try{
                    if(!node){return false;}
                    var rect=node.getBoundingClientRect();
                    return rect.width>4&&rect.height>4;
                  }catch(_){return false;}
                };
                var isLoginAction=function(node){
                  var blob=(textOf(node)+' '+attrBlob(node));
                  return (
                    blob.indexOf('sign in')>=0 ||
                    blob.indexOf('signin')>=0 ||
                    blob.indexOf('log in')>=0 ||
                    blob.indexOf('login')>=0 ||
                    blob.indexOf('create account')>=0 ||
                    blob.indexOf('use account')>=0 ||
                    blob.indexOf('google account')>=0
                  );
                };
                var findConsentButton=function(labels){
                  var docs=collectDocuments();
                  for(var d=0; d<docs.length; d++){
                    var nodes=Array.from((docs[d]||document).querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"],a[role="button"],a[href]'));
                    for(var i=0;i<nodes.length;i++){
                      var node=nodes[i];
                      var text=textOf(node);
                      var attrs=attrBlob(node);
                      if(!text && !attrs){continue;}
                      if(!isVisibleButton(node)){continue;}
                      if(isLoginAction(node)){continue;}
                      for(var j=0;j<labels.length;j++){
                        var token=labels[j];
                        var inScope=isConsentHost ? true : inConsentContext(node);
                        if((text.indexOf(token)>=0 || attrs.indexOf(token)>=0) && inScope){return node;}
                      }
                    }
                  }
                  return null;
                };
                var findContextFallback=function(){
                  var docs=collectDocuments();
                  for(var d=0; d<docs.length; d++){
                    var nodes=Array.from((docs[d]||document).querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"],a[role="button"],a[href]'));
                    for(var i=0;i<nodes.length;i++){
                      var node=nodes[i];
                      if(!isVisibleButton(node)){continue;}
                      if(isLoginAction(node)){continue;}
                      if(inConsentContext(node)){return node;}
                    }
                  }
                  return null;
                };
                var formSubmitFallback=function(){
                  var docs=collectDocuments();
                  for(var d=0; d<docs.length; d++){
                    var submits=Array.from((docs[d]||document).querySelectorAll('form button[type="submit"],form input[type="submit"],button[type="submit"],input[type="submit"]'));
                    for(var i=0;i<submits.length;i++){
                      var node=submits[i];
                      if(isLoginAction(node)){continue;}
                      if(isVisibleButton(node)){return node;}
                    }
                  }
                  return null;
                };
                var consentPath=lower(window.location.pathname||'');
                var consentHost=lower(window.location.host||'');
                var isConsentHost=(
                  consentHost==='consent.youtube.com' ||
                  consentHost.indexOf('.consent.youtube.com')>=0 ||
                  consentHost.indexOf('consent.google.')>=0
                );
                var isYouTubeHost=(
                  consentHost==='youtube.com' ||
                  consentHost==='www.youtube.com' ||
                  consentHost==='m.youtube.com' ||
                  consentHost.indexOf('.youtube.com')>=0 ||
                  consentHost==='youtu.be' ||
                  consentHost.indexOf('.youtu.be')>=0
                );
                var isYouTubeContentPage=isYouTubeHost && !isConsentHost && consentPath.indexOf('consent')<0;
                var resolved=false;
                var lastMatched='';
                var noCandidatePasses=0;
                var redirectedByFallback=false;
                var lastReportAt=0;
                var lastReportKey='';
                var isLikelyConsentSurface=function(){
                  try{
                    if(
                      isConsentHost ||
                      consentPath.indexOf('consent')>=0 ||
                      consentPath.indexOf('cookie')>=0 ||
                      consentPath.indexOf('privacy')>=0
                    ){
                      return true;
                    }
                    var markers=document.querySelectorAll('[id*="cookie"],[class*="cookie"],[id*="consent"],[class*="consent"],[id*="gdpr"],[class*="gdpr"],[aria-modal="true"],[role="dialog"]');
                    for(var i=0;i<markers.length;i++){
                      var node=markers[i];
                      if(!isVisibleButton(node) && !(node.scrollHeight>node.clientHeight+10)){continue;}
                      var blob=lower((node.id||'')+' '+(node.className||'')+' '+textOf(node).slice(0,400));
                      if(
                        blob.indexOf('cookie')>=0 ||
                        blob.indexOf('consent')>=0 ||
                        blob.indexOf('privacy')>=0 ||
                        blob.indexOf('gdpr')>=0
                      ){
                        return true;
                      }
                    }
                  }catch(_){}
                  return false;
                };
                var readRedirectTarget=function(){
                  try{
                    var params=new URLSearchParams(window.location.search||'');
                    var keys=['continue','continue_url','redirect','redirect_url','next','dest','destination','return','return_url'];
                    for(var i=0;i<keys.length;i++){
                      var value=params.get(keys[i]);
                      if(!value){continue;}
                      var decoded=value;
                      try{decoded=decodeURIComponent(value);}catch(_){}
                      if(!decoded){continue;}
                      if(decoded.indexOf('//')===0){decoded='https:'+decoded;}
                      if(decoded.indexOf('/')===0){
                        decoded=(isConsentHost ? 'https://www.youtube.com' : window.location.origin)+decoded;
                      }
                      var test=lower(decoded);
                      if(!(test.indexOf('http://')===0 || test.indexOf('https://')===0)){continue;}
                      if(test.indexOf('consent.youtube.com')>=0){continue;}
                      try{
                        var parsed=new URL(decoded);
                        var host=lower(parsed.host||'');
                        if(isConsentHost){
                          var isYouTubeHost=(
                            host==='youtube.com' ||
                            host==='www.youtube.com' ||
                            host==='m.youtube.com' ||
                            host.endsWith('.youtube.com') ||
                            host==='youtu.be' ||
                            host.endsWith('.youtu.be')
                          );
                          if(!isYouTubeHost){continue;}
                          var path=lower(parsed.pathname||'');
                          if(path.indexOf('/signin')===0 || path.indexOf('/accounts')===0){continue;}
                        }
                        return parsed.toString();
                      }catch(_){
                        continue;
                      }
                    }
                  }catch(_){}
                  return '';
                };
                var redirectFromConsentIfStuck=function(){
                  if(!(isConsentHost || consentPath.indexOf('consent')>=0)){return false;}
                  if(redirectedByFallback){return false;}
                  var target=readRedirectTarget();
                  if(!target){return false;}
                  redirectedByFallback=true;
                  resolved=true;
                  try{
                    window.location.replace(target);
                    return true;
                  }catch(_){}
                  try{
                    window.location.href=target;
                    return true;
                  }catch(_){}
                  return false;
                };
                var applyConsentPolicy=function(){
                  if(resolved){return false;}
                  if(isYouTubeContentPage){return false;}
                  if(!isLikelyConsentSurface()){return false;}
                  var candidate=null;
                  if(decision==='allow'){
                    candidate=findConsentButton(allowLabels)||findConsentButton(denyLabels);
                  }else{
                    candidate=findConsentButton(denyLabels)||findConsentButton(allowLabels);
                  }
                  if(!candidate && (isConsentHost || consentPath.indexOf('consent')>=0)){
                    candidate=findContextFallback();
                  }
                  if(!candidate && (isConsentHost || consentPath.indexOf('consent')>=0)){
                    candidate=formSubmitFallback();
                  }
                  if(!candidate){
                    noCandidatePasses+=1;
                    if(noCandidatePasses>=3){
                      return redirectFromConsentIfStuck();
                    }
                    return false;
                  }
                  noCandidatePasses=0;
                  try{
                    lastMatched=textOf(candidate)||attrBlob(candidate)||candidate.tagName||'candidate';
                    try{
                      candidate.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,cancelable:true,view:window}));
                      candidate.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,view:window}));
                      candidate.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true,view:window}));
                    }catch(_){}
                    candidate.click();
                    resolved=true;
                    return true;
                  }catch(_){return false;}
                };
                var applyGlobalScale=function(){
                  try{
                    if(isYouTubeContentPage){return;}
                    var root=document.documentElement;
                    var body=document.body||root;
                    var isConsentPage=consentPath.indexOf('consent')>=0;
                    var safeScale=Math.max(0.55, Math.min(1.0, Number(pageScale)||1.0));
                    var safeWidth=Math.max(1.0, Number(widthCompensation)||1.0);
                    var fillWidth=Math.max(safeWidth, 1.0/safeScale);
                    var scaledWidthPct=(fillWidth*safeScale*100.0);
                    var offsetPct=(100.0-scaledWidthPct)/2.0;
                    root.style.setProperty('overflow-x','hidden','important');
                    root.style.setProperty('overflow-y','auto','important');
                    root.style.setProperty('max-width','100%','important');
                    body.style.setProperty('margin','0','important');
                    body.style.setProperty('max-width','none','important');
                    body.style.setProperty('width',(fillWidth*100).toFixed(2)+'%','important');
                    body.style.setProperty('zoom', '1', 'important');
                    body.style.setProperty('transform','scale('+safeScale+')','important');
                    body.style.setProperty('transform-origin','top left','important');
                    body.style.setProperty('position','relative','important');
                    body.style.setProperty('left',offsetPct.toFixed(2)+'%','important');
                    body.style.setProperty('right','auto','important');
                    body.style.setProperty('min-height',(100/safeScale).toFixed(2)+'%','important');
                    body.style.setProperty('overflow-x','hidden','important');
                    body.style.setProperty('overflow-y','auto','important');
                    var heroCopy=document.querySelector('.kf-hero-copy,.hero-copy,[class*="hero"][class*="copy"],[class*="hero"][class*="text"]');
                    if(heroCopy){
                      heroCopy.style.setProperty('max-width','500px','important');
                      heroCopy.style.setProperty('width','min(44vw, 500px)','important');
                    }
                    if(isConsentPage){
                      [root, body, document.scrollingElement].forEach(function(el){
                        if(!el||!el.style){return;}
                        el.style.setProperty('overflow-y','auto','important');
                        el.style.setProperty('height','auto','important');
                        el.style.setProperty('max-height','none','important');
                      });
                      Array.from(document.querySelectorAll('[role="dialog"],[aria-modal="true"],form,main,section,div')).slice(0,120).forEach(function(node){
                        try{
                          var st=window.getComputedStyle(node);
                          if(!st){return;}
                          var canScroll=node.scrollHeight>node.clientHeight+8;
                          if(canScroll || lower(st.overflowY)==='hidden' || lower(st.overflow)==='hidden'){
                            node.style.setProperty('overflow-y','auto','important');
                            node.style.setProperty('max-height','none','important');
                          }
                        }catch(_){}
                      });
                    }
                  }catch(_){}
                };
                var pokeInteraction=function(){
                  try{
                    Array.from(document.querySelectorAll('video')).forEach(function(video){
                      try{
                        video.setAttribute('playsinline','');
                        video.controls=true;
                      }catch(_){}
                    });
                  }catch(_){}
                };
                var report=function(reason, clicked){
                  try{
                    if(
                      reason==='mutation' &&
                      !clicked &&
                      !redirectedByFallback &&
                      noCandidatePasses===0
                    ){
                      return;
                    }
                    var now=Date.now();
                    var reportKey=(window.location.href||'')+'|'+reason+'|'+(clicked?'1':'0')+'|'+(redirectedByFallback?'1':'0')+'|'+noCandidatePasses+'|'+lastMatched;
                    if(!clicked && !redirectedByFallback){
                      if(reportKey===lastReportKey && (now-lastReportAt)<1200){return;}
                    }
                    lastReportAt=now;
                    lastReportKey=reportKey;
                    window.prompt(promptPrefix+JSON.stringify({
                      type:'compat-policy',
                      phase:'activity-unified-compat',
                      pageUrl:window.location.href,
                      title:document.title||'',
                      reason:reason||'unknown',
                      clicked:!!clicked,
                      matched:lastMatched,
                      noCandidatePasses:noCandidatePasses,
                      redirectedByFallback:redirectedByFallback,
                      decision:decision,
                      scale:pageScale,
                      videoCount:document.querySelectorAll('video').length
                    }), '');
                  }catch(_){}
                };
                var scheduled=false;
                var sweep=function(reason){
                  if(resolved){return;}
                  if(scheduled){return;}
                  scheduled=true;
                  setTimeout(function(){
                    scheduled=false;
                    applyGlobalScale();
                    var clicked=applyConsentPolicy();
                    pokeInteraction();
                    report(reason, clicked);
                  }, 60);
                };
                window.__kfUnifiedCompatPoke=function(){sweep('native-poke');};
                if(!isYouTubeContentPage){
                  window.addEventListener('mousemove', function(){sweep('mousemove');}, true);
                  window.addEventListener('pointermove', function(){sweep('pointermove');}, true);
                  window.addEventListener('resize', function(){sweep('resize');}, true);
                  window.addEventListener('keydown', function(evt){
                    var key=lower(evt&&evt.key);
                    if(key==='arrowleft'||key==='arrowright'||key==='arrowup'||key==='arrowdown'||key==='enter'||key===' '){
                      sweep('keydown');
                    }
                  }, true);
                  if(window.__kfUnifiedCompatObserver){window.__kfUnifiedCompatObserver.disconnect();}
                  window.__kfUnifiedCompatObserver=new MutationObserver(function(){sweep('mutation');});
                  window.__kfUnifiedCompatObserver.observe(document.documentElement,{childList:true,subtree:true});
                }
                sweep('init');
              }catch(_){}
            })();
        """.trimIndent()
        GvLogger.i("GvExt", "unified compat dispatched tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} url=$normalizedUrl")
        session.loadUri(script)
    }

    private fun maybeDispatchViewportDiagnostic(session: GeckoSession, pageUrl: String, reason: String) {
        val normalizedUrl = pageUrl.ifBlank { return }
        if (!isWebHttpUrl(normalizedUrl)) {
            return
        }
        val script = """
            javascript:(function(){
              try{
                var root=document.documentElement;
                var body=document.body;
                var vv=window.visualViewport;
                var bodyStyle=body?window.getComputedStyle(body):null;
                var meta=document.querySelector('meta[name="viewport"]');
                var clip=function(value,maxLen){
                  value=(value==null?'':String(value));
                  maxLen=maxLen||180;
                  return value.length>maxLen?value.slice(0,maxLen):value;
                };
                window.prompt(${JSONObject.quote(PROMPT_PREFIX)}+JSON.stringify({
                  type:'viewport-diagnostic',
                  phase:'activity-viewport-diagnostic',
                  reason:${JSONObject.quote(reason)},
                  pageUrl:window.location.href,
                  path:(function(){try{return new URL(window.location.href).pathname||'/';}catch(_){return ''}})(),
                  windowInnerWidth:window.innerWidth||0,
                  windowInnerHeight:window.innerHeight||0,
                  windowOuterWidth:window.outerWidth||0,
                  windowOuterHeight:window.outerHeight||0,
                  visualViewportWidth:vv?(vv.width||0):0,
                  visualViewportHeight:vv?(vv.height||0):0,
                  visualViewportScale:vv?(vv.scale||0):0,
                  devicePixelRatio:window.devicePixelRatio||0,
                  screenWidth:window.screen?(window.screen.width||0):0,
                  screenHeight:window.screen?(window.screen.height||0):0,
                  documentClientWidth:root?(root.clientWidth||0):0,
                  documentScrollWidth:root?(root.scrollWidth||0):0,
                  bodyClientWidth:body?(body.clientWidth||0):0,
                  bodyScrollWidth:body?(body.scrollWidth||0):0,
                  metaViewport:clip(meta?(meta.getAttribute('content')||''):'',180),
                  cssCompatActive:!!(body&&body.style&&String(body.style.transform||'').indexOf('scale(')>=0),
                  bodyComputedTransform:clip(bodyStyle?(bodyStyle.transform||''):'',120),
                  tvViewportPolicyEnabled:${GvRuntimeExperimentConfig.ENABLE_TV_VIEWPORT_POLICY},
                  tvViewportPolicyDensity:${GvRuntimeExperimentConfig.TV_VIEWPORT_POLICY_DENSITY},
                  cssCompatDuringTvViewportPolicy:${GvRuntimeExperimentConfig.ENABLE_CSS_VISUAL_SCALE_COMPAT_DURING_TV_VIEWPORT_POLICY}
                }), '');
              }catch(_){}
            })();
        """.trimIndent()
        GvLogger.i(
            "GvExt",
            "viewport diagnostic dispatched tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} reason=$reason url=$normalizedUrl"
        )
        session.loadUri(script)
    }

    private fun maybeDispatchRailDiagnostic(session: GeckoSession, pageUrl: String, reason: String) {
        val normalizedUrl = pageUrl.ifBlank { return }
        if (!isKulchaFloPage(normalizedUrl)) {
            return
        }
        val script = """
            javascript:(function(){
              try{
                var clip=function(value,maxLen){
                  value=(value==null?'':String(value));
                  maxLen=maxLen||160;
                  return value.length>maxLen?value.slice(0,maxLen):value;
                };
                var rectSummary=function(rect){
                  if(!rect){return '';}
                  return Math.round(rect.left)+','+Math.round(rect.top)+' '+Math.round(rect.width)+'x'+Math.round(rect.height);
                };
                var visibleItemEstimate=function(rail){
                  try{
                    var railRect=rail.getBoundingClientRect();
                    var items=Array.from(rail.querySelectorAll('.kf-card,.kf-mini,.kf-chipbtn,.kf-search-card,a')).slice(0,80);
                    var first=-1,last=-1;
                    for(var i=0;i<items.length;i++){
                      var r=items[i].getBoundingClientRect();
                      var visible=r.width>1&&r.height>1&&r.right>railRect.left+1&&r.left<railRect.right-1&&r.bottom>railRect.top+1&&r.top<railRect.bottom-1;
                      if(visible){
                        if(first<0){first=i;}
                        last=i;
                      }
                    }
                    return {total:items.length,first:first,last:last};
                  }catch(_){return {total:0,first:-1,last:-1};}
                };
                var rails=Array.from(document.querySelectorAll('.kf-rail,.kf-chiprail,.kf-search-rail')).slice(0,40).map(function(rail,index){
                  var style=window.getComputedStyle(rail);
                  var rect=rail.getBoundingClientRect();
                  var estimate=visibleItemEstimate(rail);
                  return {
                    index:index,
                    className:clip(rail.className||'',140),
                    rect:rectSummary(rect),
                    overflowX:style?(style.overflowX||''):'',
                    overflowY:style?(style.overflowY||''):'',
                    scrollWidth:rail.scrollWidth||0,
                    clientWidth:rail.clientWidth||0,
                    scrollLeft:rail.scrollLeft||0,
                    hasHorizontalOverflow:(rail.scrollWidth||0)>(rail.clientWidth||0)+1,
                    scrollbarWidth:style?(style.scrollbarWidth||''):'',
                    scrollbarColor:style?(style.scrollbarColor||''):'',
                    visibleItemCount:estimate.total,
                    firstVisibleIndex:estimate.first,
                    lastVisibleIndex:estimate.last
                  };
                });
                window.prompt(${JSONObject.quote(PROMPT_PREFIX)}+JSON.stringify({
                  type:'rail-diagnostic',
                  phase:'activity-rail-diagnostic',
                  reason:${JSONObject.quote(reason)},
                  pageUrl:window.location.href,
                  path:(function(){try{return new URL(window.location.href).pathname||'/';}catch(_){return ''}})(),
                  railCount:rails.length,
                  rails:rails
                }), '');
              }catch(_){}
            })();
        """.trimIndent()
        GvLogger.i(
            "GvExt",
            "rail diagnostic dispatched tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} reason=$reason url=$normalizedUrl"
        )
        session.loadUri(script)
    }

    private fun triggerFacebookCookieConsentCompat(session: GeckoSession, pageUrl: String) {
        val normalizedUrl = pageUrl.ifBlank { return }
        if (!isFacebookUrl(normalizedUrl)) {
            return
        }
        val script = """
            javascript:(function(){
              try{
                var lower=function(v){return ((v||'')+'').trim().toLowerCase();};
                var compact=function(value,maxLen){
                  try{
                    return lower(((value||'')+'').replace(/\s+/g,' ').trim().slice(0,maxLen||220));
                  }catch(_){return '';}
                };
                var isEditableNode=function(node){
                  var cur=node;
                  for(var depth=0; depth<4 && cur; depth++){
                    try{
                      var tag=(cur.tagName||'').toLowerCase();
                      var role=lower(cur.getAttribute&&cur.getAttribute('role'));
                      if(tag==='textarea'||cur.isContentEditable||role==='textbox'){return true;}
                      if(tag==='input'){
                        var type=((cur.getAttribute('type')||'text')+'').toLowerCase();
                        if(type!=='button'&&type!=='submit'&&type!=='checkbox'&&type!=='radio'&&type!=='range'&&type!=='file'&&type!=='hidden'){
                          return true;
                        }
                      }
                    }catch(_){}
                    cur=cur.parentElement;
                  }
                  return false;
                };
                var path=lower((window.location&&window.location.pathname)||'');
                if(path==='/reg' || path==='/login'){
                  return;
                }
                var textOf=function(node){return lower(node&&(node.innerText||node.textContent||node.value||''));};
                var attrBlob=function(node){
                  if(!node||!node.getAttribute){return '';}
                  return lower(
                    (node.getAttribute('aria-label')||'')+' '+
                    (node.getAttribute('name')||'')+' '+
                    (node.getAttribute('id')||'')+' '+
                    (node.getAttribute('data-testid')||'')+' '+
                    (node.className||'')
                  );
                };
                var visible=function(node){
                  try{
                    if(!node){return false;}
                    var rect=node.getBoundingClientRect();
                    return rect.width>6&&rect.height>6&&rect.bottom>0&&rect.right>0;
                  }catch(_){return false;}
                };
                var styleValue=function(style,name){
                  try{
                    return compact(style&&style[name],120);
                  }catch(_){return '';}
                };
                var rectSummary=function(node){
                  try{
                    if(!node||!node.getBoundingClientRect){return '';}
                    var rect=node.getBoundingClientRect();
                    return [
                      Math.round(rect.left),
                      Math.round(rect.top),
                      Math.round(rect.width),
                      Math.round(rect.height)
                    ].join(',');
                  }catch(_){return '';}
                };
                var nodeSummary=function(node){
                  try{
                    if(!node){return null;}
                    var style=window.getComputedStyle?window.getComputedStyle(node):null;
                    return {
                      tag:lower(node.tagName),
                      role:lower(node.getAttribute&&node.getAttribute('role')),
                      id:compact(node.getAttribute&&node.getAttribute('id'),80),
                      className:compact(typeof node.className==='string'?node.className:'',120),
                      name:compact(node.getAttribute&&node.getAttribute('name'),80),
                      testid:compact(node.getAttribute&&node.getAttribute('data-testid'),80),
                      text:textOf(node),
                      editable:!!isEditableNode(node),
                      rect:rectSummary(node),
                      z:styleValue(style,'zIndex'),
                      position:styleValue(style,'position'),
                      pointer:styleValue(style,'pointerEvents'),
                      opacity:styleValue(style,'opacity'),
                      visibility:styleValue(style,'visibility'),
                      bg:styleValue(style,'backgroundColor')
                    };
                  }catch(_){return null;}
                };
                var ancestrySummary=function(node,maxDepth){
                  var out=[];
                  var cur=node;
                  for(var depth=0; depth<(maxDepth||5) && cur; depth++){
                    var info=nodeSummary(cur);
                    if(info){out.push(info);}
                    cur=cur.parentElement;
                  }
                  return out;
                };
                var centerStackSummary=function(){
                  try{
                    var x=Math.round(window.innerWidth/2);
                    var y=Math.round(window.innerHeight/2);
                    var node=document.elementFromPoint?document.elementFromPoint(x,y):null;
                    return ancestrySummary(node,6);
                  }catch(_){return [];}
                };
                var overlayCandidatesSummary=function(){
                  try{
                    var selectors='[role="dialog"],[aria-modal="true"],[data-testid*="dialog"],[data-testid*="overlay"],div[class*="overlay"],div[class*="backdrop"],div[class*="dialog"],header,footer,form';
                    var nodes=Array.from(document.querySelectorAll(selectors)).slice(0,72);
                    var out=[];
                    for(var i=0;i<nodes.length;i++){
                      var node=nodes[i];
                      if(!visible(node)){continue;}
                      var info=nodeSummary(node);
                      if(!info){continue;}
                      out.push(info);
                      if(out.length>=8){break;}
                    }
                    return out;
                  }catch(_){return [];}
                };
                var hideNode=function(node){
                  try{
                    if(!node||node===document.body||node===document.documentElement){return false;}
                    node.style.setProperty('display','none','important');
                    node.style.setProperty('visibility','hidden','important');
                    node.style.setProperty('pointer-events','none','important');
                    node.setAttribute('aria-hidden','true');
                    return true;
                  }catch(_){return false;}
                };
                var rgbaAlpha=function(value){
                  try{
                    var match=((value||'')+'').match(/rgba?\(([^)]+)\)/i);
                    if(!match){return 0;}
                    var parts=match[1].split(',').map(function(part){return parseFloat(part.trim());});
                    if(parts.length<4){return 1;}
                    return isNaN(parts[3])?0:parts[3];
                  }catch(_){return 0;}
                };
                var containsPlayerSurface=function(node){
                  try{
                    if(!node||!node.querySelector){return false;}
                    if(node.querySelector('video')){return true;}
                    var blob=(textOf(node)+' '+attrBlob(node)).slice(0,900);
                    return (
                      blob.indexOf('play video')>=0 ||
                      blob.indexOf('pause')>=0 ||
                      blob.indexOf('volume')>=0 ||
                      blob.indexOf('full screen')>=0 ||
                      blob.indexOf('fullscreen')>=0
                    );
                  }catch(_){return false;}
                };
                var climbClickable=function(node){
                  var cur=node;
                  for(var depth=0; depth<8 && cur && cur!==document.body && cur!==document.documentElement; depth++){
                    try{
                      var tag=(cur.tagName||'').toLowerCase();
                      var role=lower(cur.getAttribute&&cur.getAttribute('role'));
                      var style=window.getComputedStyle(cur);
                      if(
                        tag==='button' ||
                        tag==='a' ||
                        tag==='input' ||
                        role==='button' ||
                        (typeof cur.tabIndex==='number' && cur.tabIndex>=0) ||
                        (style&&style.cursor==='pointer') ||
                        cur.onclick
                      ){
                        return cur;
                      }
                    }catch(_){}
                    cur=cur.parentElement;
                  }
                  return node;
                };
                var labels=[
                  'allow all cookies',
                  'accept all cookies',
                  'accept all',
                  'allow all',
                  'allow essential and optional cookies',
                  'allow optional cookies',
                  'only allow essential cookies',
                  'allow essential cookies'
                ];
                var rejectTokens=[
                  'more',
                  'learn',
                  'info',
                  'information',
                  'details',
                  'manage',
                  'settings',
                  'preferences',
                  'customise',
                  'customize',
                  'policy',
                  'privacy policy',
                  'cookie policy',
                  'data policy',
                  'about cookies'
                ];
                var contextWords=['cookie','consent','privacy','gdpr','data policy'];
                var looksLikeLoginAction=function(blob){
                  return (
                    blob.indexOf('log in')>=0 ||
                    blob.indexOf('login')>=0 ||
                    blob.indexOf('sign in')>=0 ||
                    blob.indexOf('sign up')>=0 ||
                    blob.indexOf('create new account')>=0
                  );
                };
                var looksLikeInfoAction=function(blob){
                  for(var i=0;i<rejectTokens.length;i++){
                    if(blob.indexOf(rejectTokens[i])>=0){return true;}
                  }
                  return false;
                };
                var inConsentContext=function(node){
                  var cur=node;
                  for(var depth=0; depth<7 && cur; depth++){
                    var blob=(textOf(cur)+' '+attrBlob(cur)).slice(0,420);
                    for(var k=0;k<contextWords.length;k++){
                      if(blob.indexOf(contextWords[k])>=0){return true;}
                    }
                    var role=lower(cur.getAttribute&&cur.getAttribute('role'));
                    if(role==='dialog' || role==='alertdialog'){return true;}
                    cur=cur.parentElement;
                  }
                  return false;
                };
                var attempt=function(reason){
                  var clicked=false;
                  var sampleCandidates=[];
                  var pushSample=function(node,blob){
                    try{
                      if(sampleCandidates.length>=10){return;}
                      var compact=((blob||'')+'').replace(/\s+/g,' ').trim().slice(0,140);
                      var sample={
                        tag:((node&&node.tagName)||'').toLowerCase(),
                        text:compact,
                        aria:((node&&node.getAttribute&&node.getAttribute('aria-label'))||'').slice(0,80),
                        testid:((node&&node.getAttribute&&node.getAttribute('data-testid'))||'').slice(0,80),
                        visible:!!visible(node)
                      };
                      sampleCandidates.push(sample);
                    }catch(_){}
                  };
                  var clickNode=function(node){
                    if(!node){return false;}
                    try{
                      if(!visible(node)){
                        try{node.scrollIntoView({block:'center',inline:'center'});}catch(_){}
                      }
                      try{
                        node.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,cancelable:true,view:window}));
                        node.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,view:window}));
                        node.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true,view:window}));
                      }catch(_){}
                      node.click();
                      return true;
                    }catch(_){}
                    return false;
                  };
                  try{
                    var preferredSelectors=[
                      'button[data-cookiebanner*=\"accept\"]',
                      '[role=\"button\"][data-cookiebanner*=\"accept\"]',
                      'button[data-testid*=\"cookie\"][data-testid*=\"accept\"]',
                      '[role=\"button\"][data-testid*=\"cookie\"][data-testid*=\"accept\"]',
                      'button[aria-label*=\"Allow all cookies\" i]',
                      'button[aria-label*=\"Accept all cookies\" i]',
                      '[role=\"button\"][aria-label*=\"Allow all cookies\" i]',
                      '[role=\"button\"][aria-label*=\"Accept all cookies\" i]'
                    ];
                    for(var p=0;p<preferredSelectors.length && !clicked;p++){
                      var prefNodes=Array.from(document.querySelectorAll(preferredSelectors[p])).slice(0,8);
                      for(var q=0;q<prefNodes.length;q++){
                        var prefNode=prefNodes[q];
                        var prefBlob=textOf(prefNode)+' '+attrBlob(prefNode);
                        pushSample(prefNode,prefBlob);
                        if(looksLikeLoginAction(prefBlob) || looksLikeInfoAction(prefBlob)){continue;}
                        if(clickNode(prefNode)){clicked=true;break;}
                      }
                    }
                    if(clicked){
                      return true;
                    }
                    var nodes=Array.from(document.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"],a[role="button"]')).slice(0,140);
                    for(var i=0;i<nodes.length;i++){
                      var node=nodes[i];
                      var blob=textOf(node)+' '+attrBlob(node);
                      pushSample(node,blob);
                      if(looksLikeLoginAction(blob)){continue;}
                      if(looksLikeInfoAction(blob)){continue;}
                      var strongCookieLabel=false;
                      for(var j=0;j<labels.length;j++){
                        if(blob.indexOf(labels[j])>=0){
                          strongCookieLabel=true;
                          break;
                        }
                      }
                      var contextualAllow=
                        inConsentContext(node) &&
                        (blob.indexOf('accept')>=0 || blob.indexOf('allow')>=0) &&
                        (
                          blob.indexOf('cookie')>=0 ||
                          blob.indexOf('consent')>=0 ||
                          blob.indexOf('optional')>=0 ||
                          blob.indexOf('essential')>=0
                        );
                      if(!strongCookieLabel && !contextualAllow){continue;}
                      if(clickNode(node)){clicked=true;break;}
                    }
                  }catch(_){}
                  try{
                    window.prompt("__GV_MEDIA__"+JSON.stringify({
                      type:'facebook-compat',
                      phase:'activity-facebook-cookie-only',
                      pageUrl:window.location.href,
                      title:document.title||'',
                      cookieClicked:!!clicked,
                      reason:reason||'unknown',
                      sampleCandidates:sampleCandidates
                    }), '');
                  }catch(_){}
                  return clicked;
                };
                var finished=false;
                var attempts=0;
                var maxAttempts=14;
                var timer=null;
                var observer=null;
                var cleanup=function(){
                  try{if(timer){clearInterval(timer);}}catch(_){}
                  timer=null;
                  try{if(observer){observer.disconnect();}}catch(_){}
                  observer=null;
                };
                var runAttempt=function(reason){
                  if(finished){return;}
                  attempts+=1;
                  var clicked=attempt(reason+'#'+attempts);
                  if(clicked){
                    finished=true;
                    cleanup();
                    return;
                  }
                  if(attempts>=maxAttempts){
                    finished=true;
                    cleanup();
                  }
                };
                runAttempt('initial');
                try{
                  timer=setInterval(function(){runAttempt('interval-600ms');},600);
                }catch(_){}
                try{
                  observer=new MutationObserver(function(){runAttempt('mutation');});
                  observer.observe(document.documentElement,{childList:true,subtree:true});
                }catch(_){}
                setTimeout(function(){
                  if(!finished){
                    runAttempt('final-timeout');
                  }
                  finished=true;
                  cleanup();
                },9000);
              }catch(_){}
            })();
        """.trimIndent()
        GvLogger.i(
            "GvExt",
            "facebook cookie compat dispatched tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} url=$normalizedUrl"
        )
        session.loadUri(script)
    }

    private fun triggerFacebookPageCompat(session: GeckoSession, pageUrl: String) {
        val normalizedUrl = pageUrl.ifBlank { return }
        if (!isFacebookUrl(normalizedUrl)) {
            return
        }
        val script = """
            javascript:(function(){
              try{
                var path=((window.location&&window.location.pathname)||'').toLowerCase();
                if(path==='/reg' || path==='/login'){
                  return;
                }
                if(!window.__kfFbCompatState){
                  window.__kfFbCompatState={lastUserGestureAt:0,lastEditableGestureAt:0,autoBlurCount:0,cookieClickCount:0,bottomBarHideCount:0,topLoginHideCount:0,blockingOverlayHideCount:0,whiteVeilHideCount:0,dimRestoreCount:0,persistentSweepInstalled:false};
                  var isEditableNode=function(node){
                    var cur=node;
                    for(var depth=0; depth<4 && cur; depth++){
                      try{
                        var tag=(cur.tagName||'').toLowerCase();
                        var role=((cur.getAttribute&&cur.getAttribute('role'))||'').toLowerCase();
                        if(
                          tag==='textarea' ||
                          cur.isContentEditable ||
                          role==='textbox'
                        ){
                          return true;
                        }
                        if(tag==='input'){
                          var type=((cur.getAttribute('type')||'text')+'').toLowerCase();
                          if(type!=='button' && type!=='submit' && type!=='checkbox' && type!=='radio' && type!=='range' && type!=='file' && type!=='hidden'){
                            return true;
                          }
                        }
                      }catch(_){}
                      cur=cur.parentElement;
                    }
                    return false;
                  };
                  var markGesture=function(evt){
                    var now=Date.now();
                    window.__kfFbCompatState.lastUserGestureAt=now;
                    try{
                      if(isEditableNode(evt&&evt.target)){
                        window.__kfFbCompatState.lastEditableGestureAt=now;
                      }
                    }catch(_){}
                  };
                  window.addEventListener('pointerdown',markGesture,true);
                  window.addEventListener('touchstart',markGesture,true);
                  window.addEventListener('keydown',markGesture,true);
                  var blurUnexpectedEditable=function(target){
                    try{
                      var node=target||document.activeElement;
                      if(!isEditableNode(node)){return false;}
                      var gap=Date.now()-(window.__kfFbCompatState.lastEditableGestureAt||0);
                      if(gap<=1200){return false;}
                      if(node&&node.blur){node.blur();}
                      window.__kfFbCompatState.autoBlurCount=(window.__kfFbCompatState.autoBlurCount||0)+1;
                      return true;
                    }catch(_){return false;}
                  };
                  document.addEventListener('focusin',function(evt){
                    try{
                      var target=evt&&evt.target;
                      if(!target){return;}
                      blurUnexpectedEditable(target);
                    }catch(_){}
                  },true);
                  try{setTimeout(function(){blurUnexpectedEditable();},120);}catch(_){}
                  try{setTimeout(function(){blurUnexpectedEditable();},650);}catch(_){}
                }
                var lower=function(v){return ((v||'')+'').trim().toLowerCase();};
                var compact=function(value,maxLen){
                  try{
                    return lower(((value||'')+'').replace(/\s+/g,' ').trim().slice(0,maxLen||220));
                  }catch(_){return '';}
                };
                var textOf=function(node){
                  try{
                    if(!node){return '';}
                    var text='';
                    if(node.value){text+=node.value+' ';}
                    if(node.getAttribute){text+=(node.getAttribute('aria-label')||'')+' ';}
                    text+=(node.textContent||'');
                    return compact(text,220);
                  }catch(_){return '';}
                };
                var shallowTextOf=function(node){
                  try{
                    if(!node){return '';}
                    var text='';
                    if(node.value){text+=node.value+' ';}
                    if(node.getAttribute){text+=(node.getAttribute('aria-label')||'')+' ';}
                    var children=node.childNodes||[];
                    for(var i=0;i<children.length&&i<12;i++){
                      var child=children[i];
                      if(child&&child.nodeType===3){text+=(child.nodeValue||'')+' ';}
                    }
                    return compact(text,180);
                  }catch(_){return '';}
                };
                var attrBlob=function(node){
                  try{
                    if(!node||!node.getAttribute){return '';}
                    var cls=(typeof node.className==='string')?node.className:'';
                    return compact(
                      (node.getAttribute('aria-label')||'')+' '+
                      (node.getAttribute('name')||'')+' '+
                      (node.getAttribute('id')||'')+' '+
                      (node.getAttribute('data-testid')||'')+' '+
                      cls,
                      220
                    );
                  }catch(_){return '';}
                };
                var visible=function(node){
                  try{
                    if(!node){return false;}
                    var rect=node.getBoundingClientRect();
                    return rect.width>6&&rect.height>6&&rect.bottom>0&&rect.right>0;
                  }catch(_){return false;}
                };
                var hideNode=function(node){
                  try{
                    if(!node||node===document.body||node===document.documentElement){return false;}
                    node.style.setProperty('display','none','important');
                    node.style.setProperty('visibility','hidden','important');
                    node.style.setProperty('pointer-events','none','important');
                    node.setAttribute('aria-hidden','true');
                    return true;
                  }catch(_){return false;}
                };
                var rgbaParts=function(value){
                  try{
                    var match=((value||'')+'').match(/rgba?\(([^)]+)\)/i);
                    if(!match){return null;}
                    var parts=match[1].split(',').map(function(part){return parseFloat(part.trim());});
                    if(parts.length<3){return null;}
                    return {
                      r:parts[0]||0,
                      g:parts[1]||0,
                      b:parts[2]||0,
                      a:parts.length>=4 && !isNaN(parts[3]) ? parts[3] : 1
                    };
                  }catch(_){return null;}
                };
                var isWhitePaint=function(value){
                  var parts=rgbaParts(value);
                  return !!(parts && parts.r>=235 && parts.g>=235 && parts.b>=235 && parts.a>=0.55);
                };
                var climbClickable=function(node){
                  var cur=node;
                  for(var depth=0; depth<8 && cur && cur!==document.body && cur!==document.documentElement; depth++){
                    try{
                      var tag=(cur.tagName||'').toLowerCase();
                      var role=lower(cur.getAttribute&&cur.getAttribute('role'));
                      var style=window.getComputedStyle(cur);
                      if(
                        tag==='button' ||
                        tag==='a' ||
                        tag==='input' ||
                        role==='button' ||
                        (typeof cur.tabIndex==='number' && cur.tabIndex>=0) ||
                        (style&&style.cursor==='pointer') ||
                        cur.onclick
                      ){
                        return cur;
                      }
                    }catch(_){}
                    cur=cur.parentElement;
                  }
                  return node;
                };
                var clickCookieConsent=function(){
                  var labels=[
                    'allow all cookies',
                    'accept all cookies',
                    'accept all',
                    'allow all',
                    'allow essential and optional cookies',
                    'allow optional cookies',
                    'only allow essential cookies',
                    'allow essential cookies'
                  ];
                  var rejectTokens=['more','learn','info','information','details','manage','settings','preferences','customise','customize','policy','privacy policy','cookie policy','data policy','about cookies'];
                  var contextWords=['cookie','consent','privacy','gdpr','data policy'];
                  var inConsentContext=function(node){
                    var cur=node;
                    for(var depth=0; depth<4 && cur; depth++){
                      var blob=compact(textOf(cur)+' '+attrBlob(cur),220);
                      for(var k=0;k<contextWords.length;k++){
                        if(blob.indexOf(contextWords[k])>=0){return true;}
                      }
                      var role=lower(cur.getAttribute&&cur.getAttribute('role'));
                      if(role==='dialog' || role==='alertdialog'){return true;}
                      cur=cur.parentElement;
                    }
                    return false;
                  };
                  var loginBlob=function(blob){
                    return (
                      blob.indexOf('log in')>=0 ||
                      blob.indexOf('login')>=0 ||
                      blob.indexOf('sign in')>=0 ||
                      blob.indexOf('sign up')>=0 ||
                      blob.indexOf('create new account')>=0
                    );
                  };
                  var infoBlob=function(blob){
                    for(var x=0;x<rejectTokens.length;x++){
                      if(blob.indexOf(rejectTokens[x])>=0){return true;}
                    }
                    return false;
                  };
                  var clickNode=function(node){
                    var target=climbClickable(node);
                    try{
                      if(!visible(target)){return false;}
                      try{
                        target.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,cancelable:true,view:window}));
                        target.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,view:window}));
                        target.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true,view:window}));
                      }catch(_){}
                      target.click();
                      window.__kfFbCompatState.cookieClickCount=(window.__kfFbCompatState.cookieClickCount||0)+1;
                      return true;
                    }catch(_){return false;}
                  };
                  var pointTargets=[
                    [0.68,0.80],
                    [0.66,0.74],
                    [0.74,0.80],
                    [0.50,0.80],
                    [0.50,0.70]
                  ];
                  for(var pt=0;pt<pointTargets.length;pt++){
                    try{
                      var node=document.elementFromPoint(
                        Math.round(window.innerWidth*pointTargets[pt][0]),
                        Math.round(window.innerHeight*pointTargets[pt][1])
                      );
                      var cur=node;
                      for(var depth=0;depth<8&&cur&&cur!==document.body&&cur!==document.documentElement;depth++){
                        var pointBlob=compact(shallowTextOf(cur)+' '+textOf(cur)+' '+attrBlob(cur),260);
                        if(
                          pointBlob.indexOf('allow all cookies')>=0 ||
                          pointBlob.indexOf('accept all cookies')>=0 ||
                          (
                            pointBlob.indexOf('allow')>=0 &&
                            pointBlob.indexOf('cookie')>=0 &&
                            pointBlob.indexOf('learn more')<0
                          )
                        ){
                          if(clickNode(cur)){return true;}
                        }
                        cur=cur.parentElement;
                      }
                    }catch(_){}
                  }
                  try{
                    var xpath="//*[contains(translate(normalize-space(string(.)), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'allow all cookies') or contains(translate(normalize-space(string(.)), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'accept all cookies')]";
                    var result=document.evaluate(xpath,document,null,XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,null);
                    var best=null;
                    var bestArea=Number.MAX_VALUE;
                    var count=Math.min(result.snapshotLength||0,60);
                    for(var xp=0;xp<count;xp++){
                      var candidate=result.snapshotItem(xp);
                      if(!visible(candidate)){continue;}
                      var rect=candidate.getBoundingClientRect();
                      var area=rect.width*rect.height;
                      if(area<20||area>bestArea){continue;}
                      var candidateBlob=compact(shallowTextOf(candidate)+' '+attrBlob(candidate),240);
                      if(candidateBlob.indexOf('learn more')>=0){continue;}
                      best=candidate;
                      bestArea=area;
                    }
                    if(best&&clickNode(best)){return true;}
                  }catch(_){}
                  var nodes=Array.from(document.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"],a[role="button"]')).slice(0,80);
                  for(var i=0;i<nodes.length;i++){
                    var node=nodes[i];
                    if(!visible(node)){continue;}
                    var blob=compact(textOf(node)+' '+attrBlob(node),220);
                    if(loginBlob(blob)||infoBlob(blob)){continue;}
                    if(!inConsentContext(node) && blob.indexOf('cookie')<0 && blob.indexOf('consent')<0){continue;}
                    for(var j=0;j<labels.length;j++){
                      if(blob.indexOf(labels[j])>=0){
                        if(clickNode(node)){return true;}
                      }
                    }
                    if(inConsentContext(node) && (blob.indexOf('accept')>=0 || blob.indexOf('allow')>=0)){
                      if(clickNode(node)){return true;}
                    }
                  }
                  return false;
                };
                var hideTopLoginHeader=function(){
                  var changed=0;
                  var nodes=Array.from(document.querySelectorAll('header,[role="banner"],form')).slice(0,36);
                  for(var i=0;i<nodes.length;i++){
                    var node=nodes[i];
                    try{
                      if(!visible(node)){continue;}
                      var rect=node.getBoundingClientRect();
                      if(rect.top>180 || rect.height<36 || rect.height>220 || rect.width<(window.innerWidth*0.3)){continue;}
                      var blob=compact(textOf(node)+' '+attrBlob(node),260);
                      var loginHeader=(blob.indexOf('email or phone')>=0 || blob.indexOf('password')>=0 || blob.indexOf('forgotten account')>=0) && (blob.indexOf('log in')>=0 || blob.indexOf('login')>=0);
                      if(!loginHeader){continue;}
                      if(hideNode(node)){changed+=1;}
                    }catch(_){}
                  }
                  if(changed>0){
                    window.__kfFbCompatState.topLoginHideCount=(window.__kfFbCompatState.topLoginHideCount||0)+changed;
                    return true;
                  }
                  return false;
                };
                var hideBlockingOverlay=function(){
                  var changed=0;
                  var selectors='[role="dialog"],[aria-modal="true"],[data-testid*="dialog"],[data-testid*="overlay"],div[class*="overlay"],div[class*="backdrop"],div[class*="dialog"]';
                  var nodes=Array.from(document.querySelectorAll(selectors)).slice(0,64);
                  for(var i=0;i<nodes.length;i++){
                    var node=nodes[i];
                    try{
                      if(!visible(node)){continue;}
                      if(node.querySelector&&node.querySelector('video')){continue;}
                      var rect=node.getBoundingClientRect();
                      if(rect.width<(window.innerWidth*0.55) || rect.height<(window.innerHeight*0.35)){continue;}
                      var style=window.getComputedStyle(node);
                      if(style && style.pointerEvents==='none'){continue;}
                      var blob=compact(textOf(node)+' '+attrBlob(node),260);
                      var looksLikeAuth=(
                        blob.indexOf('log in')>=0 ||
                        blob.indexOf('login')>=0 ||
                        blob.indexOf('password')>=0 ||
                        blob.indexOf('email or phone')>=0 ||
                        blob.indexOf('create new account')>=0 ||
                        blob.indexOf('not now')>=0 ||
                        blob.indexOf('continue')>=0
                      );
                      var largeFixedSurface=(
                        style &&
                        (style.position==='fixed' || style.position==='sticky') &&
                        rect.width>(window.innerWidth*0.72) &&
                        rect.height>(window.innerHeight*0.48)
                      );
                      var whiteBackdrop=(
                        blob.length<12 &&
                        style &&
                        (style.backgroundColor==='rgb(255, 255, 255)' || style.backgroundColor==='rgba(255, 255, 255, 1)')
                      );
                      if(!looksLikeAuth && !largeFixedSurface && !whiteBackdrop){continue;}
                      if(hideNode(node)){changed+=1;}
                    }catch(_){}
                  }
                  if(changed>0){
                    window.__kfFbCompatState.blockingOverlayHideCount=(window.__kfFbCompatState.blockingOverlayHideCount||0)+changed;
                    return true;
                  }
                  return false;
                };
                var restoreDimmedVideoSurfaces=function(){
                  var changed=0;
                  var videos=Array.from(document.querySelectorAll('video')).slice(0,6);
                  var candidates=[document.documentElement,document.body];
                  for(var i=0;i<videos.length;i++){
                    var cur=videos[i];
                    for(var depth=0; depth<12 && cur; depth++){
                      candidates.push(cur);
                      cur=cur.parentElement;
                    }
                  }
                  try{
                    Array.from(document.querySelectorAll('main,[role="main"],div[role="main"],div[class*="video"],div[class*="watch"],div[class*="player"]')).slice(0,80).forEach(function(node){
                      candidates.push(node);
                    });
                  }catch(_){}
                  for(var c=0;c<candidates.length;c++){
                    var cur=candidates[c];
                    if(!cur||!cur.style){continue;}
                      try{
                        var style=window.getComputedStyle(cur);
                        if(style){
                          var opacity=parseFloat(style.opacity||'1');
                          var filtered=style.filter&&style.filter!=='none';
                          if(opacity<0.96 || filtered){
                            cur.style.setProperty('opacity','1','important');
                            cur.style.setProperty('filter','none','important');
                            changed+=1;
                          }
                        }
                      }catch(_){}
                  }
                  if(changed>0){
                    window.__kfFbCompatState.dimRestoreCount=(window.__kfFbCompatState.dimRestoreCount||0)+changed;
                    return true;
                  }
                  return false;
                };
                var hideWhiteVeils=function(){
                  var changed=0;
                  var nodes=[];
                  var centerX=window.innerWidth/2;
                  var centerY=window.innerHeight/2;
                  var seen=[];
                  var addNode=function(node){
                    try{
                      if(!node||seen.indexOf(node)>=0){return;}
                      seen.push(node);
                      nodes.push(node);
                    }catch(_){}
                  };
                  try{
                    Array.from(document.elementsFromPoint(centerX,centerY)||[]).forEach(addNode);
                    Array.from(document.elementsFromPoint(centerX,Math.round(window.innerHeight*0.82))||[]).forEach(addNode);
                  }catch(_){}
                  try{
                    Array.from(document.querySelectorAll('[role="dialog"],[aria-modal="true"],[data-testid*="dialog"],[data-testid*="overlay"],div[class*="overlay"],div[class*="backdrop"],div[class*="dialog"],div[style*="position: fixed"],div[style*="position:fixed"]')).slice(0,80).forEach(addNode);
                  }catch(_){}
                  for(var i=0;i<nodes.length;i++){
                    var node=nodes[i];
                    try{
                      if(!visible(node)){continue;}
                      if(node.querySelector&&node.querySelector('video')){continue;}
                      var rect=node.getBoundingClientRect();
                      if(rect.width<(window.innerWidth*0.55) || rect.height<(window.innerHeight*0.45)){continue;}
                      var coversCenter=rect.left<=centerX&&rect.right>=centerX&&rect.top<=centerY&&rect.bottom>=centerY;
                      var coversViewport=rect.width>(window.innerWidth*0.82)&&rect.height>(window.innerHeight*0.62);
                      if(!coversCenter && !coversViewport){continue;}
                      var style=window.getComputedStyle(node);
                      if(!style || style.pointerEvents==='none'){continue;}
                      var fixedLike=style.position==='fixed'||style.position==='sticky'||style.position==='absolute';
                      var opacity=parseFloat(style.opacity||'1');
                      var filtered=style.filter&&style.filter!=='none';
                      var whitePaint=isWhitePaint(style.backgroundColor);
                      var blob=compact(shallowTextOf(node)+' '+attrBlob(node),220);
                      var authOrConsent=(
                        blob.indexOf('cookie')>=0 ||
                        blob.indexOf('consent')>=0 ||
                        blob.indexOf('log in')>=0 ||
                        blob.indexOf('login')>=0 ||
                        blob.indexOf('sign up')>=0 ||
                        blob.indexOf('create new account')>=0 ||
                        blob.indexOf('not now')>=0 ||
                        blob.indexOf('continue')>=0
                      );
                      var sparseVeil=blob.length<90;
                      if(!(fixedLike||coversViewport)){continue;}
                      if(!(whitePaint||opacity<0.94||filtered)){continue;}
                      if(!(sparseVeil||authOrConsent)){continue;}
                      if(hideNode(node)){changed+=1;}
                    }catch(_){}
                  }
                  if(changed>0){
                    window.__kfFbCompatState.whiteVeilHideCount=(window.__kfFbCompatState.whiteVeilHideCount||0)+changed;
                    return true;
                  }
                  return false;
                };
                var hideBottomLoginRail=function(){
                  var changed=0;
                  var nodes=Array.from(document.querySelectorAll('footer,[role=\"dialog\"],[role=\"complementary\"],[aria-modal=\"true\"]')).slice(0,48);
                  for(var i=0;i<nodes.length;i++){
                    var node=nodes[i];
                    try{
                      if(!visible(node)){continue;}
                      var rect=node.getBoundingClientRect();
                      var isBottomBand=(rect.width>(window.innerWidth*0.45) && rect.bottom>(window.innerHeight-160) && rect.top>(window.innerHeight*0.35));
                      if(!isBottomBand){continue;}
                      var blob=compact(textOf(node)+' '+attrBlob(node),260);
                      var hasLoginAction=(blob.indexOf('log in')>=0 || blob.indexOf('login')>=0 || blob.indexOf('sign up')>=0 || blob.indexOf('create new account')>=0);
                      var hasAuthContext=(blob.indexOf('facebook')>=0 || blob.indexOf('account')>=0 || blob.indexOf('not now')>=0 || blob.indexOf('continue')>=0);
                      var loginPrompt=hasLoginAction && hasAuthContext;
                      if(!loginPrompt){continue;}
                      if(hideNode(node)){changed+=1;}
                    }catch(_){}
                  }
                  if(changed>0){
                    window.__kfFbCompatState.bottomBarHideCount=(window.__kfFbCompatState.bottomBarHideCount||0)+changed;
                    return true;
                  }
                  return false;
                };
                var hideLoginDialogs=function(){
                  var changed=0;
                  var nodes=Array.from(document.querySelectorAll('[role=\"dialog\"],[aria-modal=\"true\"],[data-testid*=\"dialog\"]')).slice(0,40);
                  for(var i=0;i<nodes.length;i++){
                    var node=nodes[i];
                    try{
                      if(!visible(node)){continue;}
                      var rect=node.getBoundingClientRect();
                      if(rect.width<(window.innerWidth*0.45) || rect.height<(window.innerHeight*0.2)){continue;}
                      var blob=compact(textOf(node)+' '+attrBlob(node),260);
                      var looksLikeLogin=(blob.indexOf('log in')>=0 || blob.indexOf('create new account')>=0 || blob.indexOf('sign up')>=0) && (blob.indexOf('facebook')>=0 || blob.indexOf('account')>=0);
                      if(!looksLikeLogin){continue;}
                      if(hideNode(node)){changed+=1;}
                    }catch(_){}
                  }
return changed>0;
                };
                if (activeHelpersEnabled) {
                var clickedCookie=clickCookieConsent();
                var hidTopLogin=hideTopLoginHeader();
                var hidOverlay=hideBlockingOverlay();
                var hidWhiteVeil=false;
                var restoredDim=restoreDimmedVideoSurfaces();
                var hidBar=hideBottomLoginRail();
                var hidDialog=hideLoginDialogs();
                var lightSweep=function(reason){
                  try{clickCookieConsent();}catch(_){}
                  try{hideTopLoginHeader();}catch(_){}
                  try{hideBlockingOverlay();}catch(_){}
                  try{restoreDimmedVideoSurfaces();}catch(_){}
                  try{hideBottomLoginRail();}catch(_){}
                  try{hideLoginDialogs();}catch(_){}
                };
                window.__kfFbCompatLightSweep=lightSweep;
                  try{setTimeout(function(){lightSweep('timeout-650');},650);}catch(_){}
                  try{setTimeout(function(){lightSweep('timeout-1600');},1600);}catch(_){}
                  try{setTimeout(function(){lightSweep('timeout-4200');},4200);}catch(_){}
                  try{
                  if(!window.__kfFbCompatState.persistentSweepInstalled){
                    window.__kfFbCompatState.persistentSweepInstalled=true;
                    window.__kfFbCompatObserver=new MutationObserver(function(){lightSweep('mutation');});
                    window.__kfFbCompatObserver.observe(document.documentElement,{childList:true,subtree:true});
                    window.__kfFbCompatTimer=setInterval(function(){lightSweep('interval');},1800);
                    window.addEventListener('pointerdown',function(){setTimeout(function(){lightSweep('pointerdown');},260);},true);
                    window.addEventListener('keydown',function(){setTimeout(function(){lightSweep('keydown');},260);},true);
                  }
                }catch(_){}
                }
                window.prompt("__GV_MEDIA__"+JSON.stringify({
                  type:'facebook-compat',
                  phase:'activity-facebook-compat',
                  pageUrl:window.location.href,
                  title:document.title||'',
                  cookieClicked:!!clickedCookie,
                  bottomLoginBarHidden:!!hidBar,
                  loginDialogHidden:!!hidDialog,
                  topLoginHeaderHidden:!!hidTopLogin,
                  blockingOverlayHidden:!!hidOverlay,
                  whiteVeilHidden:!!hidWhiteVeil,
                  dimRestored:!!restoredDim,
                  autoBlurCount:window.__kfFbCompatState.autoBlurCount||0,
                  cookieClickCount:window.__kfFbCompatState.cookieClickCount||0,
                  bottomBarHideCount:window.__kfFbCompatState.bottomBarHideCount||0,
                  topLoginHideCount:window.__kfFbCompatState.topLoginHideCount||0,
                  blockingOverlayHideCount:window.__kfFbCompatState.blockingOverlayHideCount||0,
                  whiteVeilHideCount:window.__kfFbCompatState.whiteVeilHideCount||0,
                  dimRestoreCount:window.__kfFbCompatState.dimRestoreCount||0
                }), '');
              }catch(_){}
            })();
        """.trimIndent()
        GvLogger.i(
            "GvExt",
            "facebook compat dispatched tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} url=$normalizedUrl"
        )
        session.loadUri(script)
    }

    private fun triggerSimpleFacebookCompat(session: GeckoSession, pageUrl: String) {
        val normalizedUrl = pageUrl.ifBlank { return }
        if (!isFacebookUrl(normalizedUrl)) {
            return
        }
        if (FACEBOOK_PASSIVE_DIAGNOSTIC_MODE) {
            updateFacebookPassiveReentryUrlState(session, normalizedUrl)
            val passiveGeneration = facebookPassiveGenerationBySession[session] ?: 0
            val passiveAttempt = facebookPassiveAttemptCountBySession[session] ?: 1
            val passiveScript = """
                javascript:(function(){
                  try{
                    var passiveGeneration=$passiveGeneration;
                    var passiveAttempt=$passiveAttempt;
                    var passiveMaxAttempts=$FACEBOOK_PASSIVE_MAX_ATTEMPTS;
                    var activeHelpersEnabled=$FACEBOOK_ACTIVE_HELPERS_ENABLED==1;
                    var cookieAllowAllAutoclickEnabled=$FACEBOOK_COOKIE_CONSENT_ALLOW_ALL_AUTOCLICK_ENABLED==1;
                    var loginModalCloseEnabled=$FACEBOOK_LOGIN_MODAL_CLOSE_AFTER_ATTACH_ENABLED==1;
                    var bottomLoginBarCosmeticHideEnabled=$FACEBOOK_BOTTOM_LOGIN_BAR_COSMETIC_HIDE_ENABLED==1;
                    var overlayDiagState=window.__kfFbOverlayDiagState||(window.__kfFbOverlayDiagState={early:false,attached:false,attachedDelay:false,visible:false});
                    var cookieAllowAllState=window.__kfFbCookieAllowAllAutoclickState||(window.__kfFbCookieAllowAllAutoclickState={generation:-1,clicked:false});
                    var loginModalCloseState=window.__kfFbLoginModalCloseState||(window.__kfFbLoginModalCloseState={generation:-1,scheduled:false,clicked:false});
                    var bottomLoginBarHideState=window.__kfFbBottomLoginBarHideState||(window.__kfFbBottomLoginBarHideState={generation:-1,scheduled:false,hidden:false});
                    if(cookieAllowAllState.generation!==passiveGeneration){
                      cookieAllowAllState.generation=passiveGeneration;
                      cookieAllowAllState.clicked=false;
                    }
                    if(loginModalCloseState.generation!==passiveGeneration){
                      loginModalCloseState.generation=passiveGeneration;
                      loginModalCloseState.scheduled=false;
                      loginModalCloseState.clicked=false;
                    }
                    if(bottomLoginBarHideState.generation!==passiveGeneration){
                      bottomLoginBarHideState.generation=passiveGeneration;
                      bottomLoginBarHideState.scheduled=false;
                      bottomLoginBarHideState.hidden=false;
                    }
                    var clipText=function(v,n){
                      try{return ((v||'')+'').replace(/\s+/g,' ').trim().slice(0,n||96);}catch(_){return '';}
                    };
                    var lowerText=function(v,n){
                      return clipText(v,n).toLowerCase();
                    };
                    var rectOf=function(node){
                      try{
                        if(!node){return null;}
                        var r=node.getBoundingClientRect();
                        return {left:Math.round(r.left),top:Math.round(r.top),right:Math.round(r.right),bottom:Math.round(r.bottom),width:Math.round(r.width),height:Math.round(r.height)};
                      }catch(_){return null;}
                    };
                    var rectIntersects=function(a,b){
                      try{
                        return !!(a&&b&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top);
                      }catch(_){return false;}
                    };
                    var rectString=function(rect){
                      try{
                        if(!rect){return 'none';}
                        return rect.left+','+rect.top+' '+rect.width+'x'+rect.height;
                      }catch(_){return 'none';}
                    };
                    var visibleNode=function(node){
                      try{
                        if(!node){return false;}
                        var style=window.getComputedStyle(node);
                        if(style&&(style.display==='none'||style.visibility==='hidden'||style.opacity==='0')){return false;}
                        var r=node.getBoundingClientRect();
                        return r.width>4&&r.height>4&&r.bottom>0&&r.right>0&&r.top<window.innerHeight&&r.left<window.innerWidth;
                      }catch(_){return false;}
                    };
                    var compactNodeForOverlay=function(node){
                      try{
                        if(!node){return null;}
                        var style=null;
                        try{style=window.getComputedStyle(node);}catch(_){}
                        var rect=rectOf(node);
                        var cls=(typeof node.className==='string')?node.className:'';
                        var text=clipText((node.innerText||node.textContent||''),80);
                        var bg=style?(style.backgroundColor||''):'';
                        var opacity=style?(style.opacity||''):'';
                        return {
                          tag:lowerText(node.tagName,16),
                          role:clipText((node.getAttribute&&node.getAttribute('role'))||'',24),
                          ariaModal:clipText((node.getAttribute&&node.getAttribute('aria-modal'))||'',12),
                          ariaLabel:clipText((node.getAttribute&&node.getAttribute('aria-label'))||'',48),
                          id:clipText(node.id||'',36),
                          cls:clipText(cls.replace(/\s+/g,'.'),64),
                          text:text,
                          rect:rect,
                          z:style?(style.zIndex||''):'',
                          position:style?(style.position||''):'',
                          opacity:opacity,
                          pointer:style?(style.pointerEvents||''):'',
                          visibility:style?(style.visibility||''):'',
                          display:style?(style.display||''):'',
                          bg:clipText(bg,48),
                          bgAlpha:(function(value){
                            try{
                              var m=((value||'')+'').match(/rgba?\(([^)]+)\)/i);
                              if(!m){return value?1:0;}
                              var parts=m[1].split(',').map(function(p){return parseFloat(p.trim());});
                              return parts.length>=4&&!isNaN(parts[3])?parts[3]:1;
                            }catch(_){return 0;}
                          })(bg)
                        };
                      }catch(_){return null;}
                    };
                    var nodeChainSummary=function(node){
                      var out=[];
                      try{
                        var cur=node;
                        for(var depth=0;depth<5&&cur;depth++){
                          var tag=lowerText(cur.tagName,12);
                          var role=clipText((cur.getAttribute&&cur.getAttribute('role'))||'',16);
                          var id=clipText(cur.id||'',20);
                          var cls=clipText(((typeof cur.className==='string')?cur.className:'').replace(/\s+/g,'.'),36);
                          out.push(tag+(id?('#'+id):'')+(role?('@'+role):'')+(cls?('.'+cls):''));
                          cur=cur.parentElement;
                        }
                      }catch(_){}
                      return out;
                    };
                    var pushUnique=function(list,node,kind,limit){
                      try{
                        if(!node||!visibleNode(node)){return;}
                        for(var i=0;i<list.length;i++){if(list[i].node===node){return;}}
                        if(list.length>=limit){return;}
                        var summary=compactNodeForOverlay(node);
                        if(!summary){return;}
                        summary.kind=kind;
                        summary.overlapsVideo=false;
                        summary.parentChain=nodeChainSummary(node);
                        summary.siblingChain=[
                          compactNodeForOverlay(node.previousElementSibling),
                          compactNodeForOverlay(node.nextElementSibling)
                        ].filter(function(item){return !!item;});
                        list.push({node:node,summary:summary});
                      }catch(_){}
                    };
                    var emitOverlayDiagnostics=function(trigger){
                      try{
                        var videos=Array.from(document.querySelectorAll('video')).slice(0,6);
                        var primaryVideo=null;
                        for(var v=0;v<videos.length;v++){
                          if(visibleNode(videos[v])){primaryVideo=videos[v];break;}
                        }
                        var videoRect=rectOf(primaryVideo);
                        var centerX=Math.round((window.innerWidth||0)/2);
                        var centerY=Math.round((window.innerHeight||0)/2);
                        var videoCenterX=videoRect?Math.round((videoRect.left+videoRect.right)/2):centerX;
                        var videoCenterY=videoRect?Math.round((videoRect.top+videoRect.bottom)/2):centerY;
                        var centerStack=[];
                        var videoCenterStack=[];
                        try{
                          Array.from(document.elementsFromPoint(centerX,centerY)||[]).slice(0,8).forEach(function(node){
                            var summary=compactNodeForOverlay(node);
                            if(summary){centerStack.push(summary);}
                          });
                        }catch(_){}
                        try{
                          Array.from(document.elementsFromPoint(videoCenterX,videoCenterY)||[]).slice(0,8).forEach(function(node){
                            var summary=compactNodeForOverlay(node);
                            if(summary){videoCenterStack.push(summary);}
                          });
                        }catch(_){}
                        var dialogCandidates=[];
                        var backdropCandidates=[];
                        var bottomBarCandidates=[];
                        var cookieButtonCandidates=[];
                        var loginButtonCandidates=[];
                        var allOverlayNodes=[];
                        try{
                          Array.from(document.querySelectorAll('[role="dialog"],[role="alertdialog"],[aria-modal="true"],[data-testid*="dialog"],[data-testid*="modal"],div[class*="dialog"],div[class*="modal"],div[class*="overlay"],div[class*="backdrop"],div[style*="position: fixed"],div[style*="position:fixed"]')).slice(0,120).forEach(function(node){
                            if(!visibleNode(node)){return;}
                            var style=window.getComputedStyle(node);
                            var r=rectOf(node);
                            if(!r){return;}
                            var blob=lowerText((node.innerText||node.textContent||'')+' '+((node.getAttribute&&node.getAttribute('aria-label'))||'')+' '+((node.getAttribute&&node.getAttribute('data-testid'))||'')+' '+((typeof node.className==='string')?node.className:''),220);
                            var role=lowerText((node.getAttribute&&node.getAttribute('role'))||'',24);
                            var ariaModal=lowerText((node.getAttribute&&node.getAttribute('aria-modal'))||'',12);
                            var large=r.width>(window.innerWidth*0.55)&&r.height>(window.innerHeight*0.30);
                            var sparse=blob.length<100;
                            var fixedLike=style&&(style.position==='fixed'||style.position==='sticky'||style.position==='absolute');
                            var isDialog=role==='dialog'||role==='alertdialog'||ariaModal==='true'||blob.indexOf('log in')>=0||blob.indexOf('sign up')>=0||blob.indexOf('cookie')>=0||blob.indexOf('consent')>=0;
                            var isBackdrop=large&&fixedLike&&(sparse||blob.indexOf('backdrop')>=0||blob.indexOf('overlay')>=0||style.pointerEvents!=='none');
                            if(isDialog){pushUnique(dialogCandidates,node,'dialog',8);}
                            if(isBackdrop){pushUnique(backdropCandidates,node,'backdrop',8);}
                            pushUnique(allOverlayNodes,node,'overlay',16);
                          });
                        }catch(_){}
                        try{
                          Array.from(document.querySelectorAll('footer,[role="dialog"],[role="complementary"],[aria-modal="true"],div[style*="position: fixed"],div[style*="position:fixed"]')).slice(0,80).forEach(function(node){
                            if(!visibleNode(node)){return;}
                            var r=rectOf(node);
                            if(!r){return;}
                            var blob=lowerText((node.innerText||node.textContent||'')+' '+((node.getAttribute&&node.getAttribute('aria-label'))||'')+' '+((typeof node.className==='string')?node.className:''),180);
                            var bottomBand=r.width>(window.innerWidth*0.45)&&r.bottom>(window.innerHeight-160)&&r.top>(window.innerHeight*0.35);
                            var loginLike=blob.indexOf('log in')>=0||blob.indexOf('sign up')>=0||blob.indexOf('create new account')>=0||blob.indexOf('connect with friends')>=0;
                            if(bottomBand&&loginLike){pushUnique(bottomBarCandidates,node,'bottom-bar',6);}
                          });
                        }catch(_){}
                        try{
                          Array.from(document.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"],a[role="button"],[aria-label]')).slice(0,180).forEach(function(node){
                            if(!visibleNode(node)){return;}
                            var blob=lowerText((node.value||'')+' '+((node.getAttribute&&node.getAttribute('aria-label'))||'')+' '+((node.getAttribute&&node.getAttribute('title'))||'')+' '+(node.innerText||node.textContent||'')+' '+((node.getAttribute&&node.getAttribute('data-testid'))||''),180);
                            var cookieLike=blob.indexOf('allow all cookies')>=0||blob.indexOf('accept all cookies')>=0||blob.indexOf('accept all')>=0||blob.indexOf('allow essential')>=0||blob.indexOf('cookie')>=0||blob.indexOf('consent')>=0;
                            var loginLike=blob.indexOf('not now')>=0||blob.indexOf('close')>=0||blob.indexOf('log in')>=0||blob.indexOf('sign up')>=0||blob.indexOf('continue watching')>=0;
                            if(cookieLike){pushUnique(cookieButtonCandidates,node,'cookie-button',8);}
                            if(loginLike){pushUnique(loginButtonCandidates,node,'login-button',8);}
                          });
                        }catch(_){}
                        var markOverlap=function(list){
                          for(var i=0;i<list.length;i++){
                            try{list[i].summary.overlapsVideo=rectIntersects(list[i].summary.rect,videoRect);}catch(_){}
                          }
                        };
                        markOverlap(dialogCandidates);
                        markOverlap(backdropCandidates);
                        markOverlap(bottomBarCandidates);
                        markOverlap(cookieButtonCandidates);
                        markOverlap(loginButtonCandidates);
                        var pairCandidates=[];
                        for(var d=0;d<dialogCandidates.length&&pairCandidates.length<8;d++){
                          for(var b=0;b<backdropCandidates.length&&pairCandidates.length<8;b++){
                            var dialog=dialogCandidates[d].node;
                            var backdrop=backdropCandidates[b].node;
                            if(dialog===backdrop){continue;}
                            var sharesParent=!!(dialog.parentElement&&dialog.parentElement===backdrop.parentElement);
                            var adjacentSibling=!!(dialog.previousElementSibling===backdrop||dialog.nextElementSibling===backdrop);
                            var contains=!!(backdrop.contains&&backdrop.contains(dialog));
                            var containedBy=!!(dialog.contains&&dialog.contains(backdrop));
                            var overlaps=rectIntersects(dialogCandidates[d].summary.rect,backdropCandidates[b].summary.rect);
                            var likelyPair=sharesParent||adjacentSibling||contains||containedBy||overlaps;
                            if(!likelyPair){continue;}
                            pairCandidates.push({
                              dialogIndex:d+1,
                              backdropIndex:b+1,
                              sharesParent:sharesParent,
                              adjacentSibling:adjacentSibling,
                              backdropContainsDialog:contains,
                              dialogContainsBackdrop:containedBy,
                              rectsOverlap:overlaps,
                              dialogOverlapsVideo:!!dialogCandidates[d].summary.overlapsVideo,
                              backdropOverlapsVideo:!!backdropCandidates[b].summary.overlapsVideo
                            });
                          }
                        }
                        var htmlStyle=window.getComputedStyle(document.documentElement);
                        var bodyStyle=window.getComputedStyle(document.body);
                        window.prompt(${JSONObject.quote(PROMPT_PREFIX)}+JSON.stringify({
                          type:'facebook-overlay-diagnostics',
                          phase:'facebook-overlay-'+trigger,
                          passiveGeneration:passiveGeneration,
                          passiveAttempt:passiveAttempt,
                          pageHost:window.location.host||'',
                          pagePath:window.location.pathname||'',
                          documentReadyState:document.readyState||'',
                          documentVisibilityState:document.visibilityState||'',
                          documentHasFocus:!!document.hasFocus(),
                          viewport:{width:window.innerWidth||0,height:window.innerHeight||0,scrollX:window.scrollX||0,scrollY:window.scrollY||0},
                          htmlState:{overflow:htmlStyle.overflow||'',overflowX:htmlStyle.overflowX||'',overflowY:htmlStyle.overflowY||'',cls:clipText(document.documentElement.className||'',80),style:clipText(document.documentElement.getAttribute('style')||'',96)},
                          bodyState:{overflow:bodyStyle.overflow||'',overflowX:bodyStyle.overflowX||'',overflowY:bodyStyle.overflowY||'',cls:clipText(document.body.className||'',80),style:clipText(document.body.getAttribute('style')||'',96)},
                          primaryVideoRect:videoRect,
                          centerStack:centerStack,
                          videoCenterStack:videoCenterStack,
                          dialogCandidates:dialogCandidates.map(function(item){return item.summary;}),
                          backdropCandidates:backdropCandidates.map(function(item){return item.summary;}),
                          bottomBarCandidates:bottomBarCandidates.map(function(item){return item.summary;}),
                          cookieButtonCandidates:cookieButtonCandidates.map(function(item){return item.summary;}),
                          loginButtonCandidates:loginButtonCandidates.map(function(item){return item.summary;}),
                          pairCandidates:pairCandidates
                        }), '');
                      }catch(_){}
                    };
                    var emitLoginModalClose=function(phase, clicked, reason, modal, closeButton, buttonSummary, primaryAttached, modalVariant){
                      try{
                        window.prompt(${JSONObject.quote(PROMPT_PREFIX)}+JSON.stringify({
                          type:'facebook-login-modal-close',
                          phase:phase,
                          passiveGeneration:passiveGeneration,
                          passiveAttempt:passiveAttempt,
                          passiveMaxAttempts:passiveMaxAttempts,
                          pageUrl:window.location.href,
                          clicked:!!clicked,
                          reason:reason||'',
                          modalRect:rectString(rectOf(modal)),
                          closeButtonRect:rectString(rectOf(closeButton)),
                          buttonText:clipText(buttonSummary||'',64),
                          primaryVideoAttached:!!primaryAttached,
                          modalVariant:modalVariant||'unknown'
                        }), '');
                      }catch(_){}
                    };
                    var primaryAttachedVideoForLoginClose=function(){
                      try{
                        var videos=Array.from(document.querySelectorAll('video')).slice(0,6);
                        for(var i=0;i<videos.length;i++){
                          var video=videos[i];
                          if(!visibleNode(video)){continue;}
                          var currentSrc=(video.currentSrc||video.src||'');
                          if(currentSrc&&video.readyState>=1&&video.videoWidth>0&&video.videoHeight>0){
                            return {node:video,rect:rectOf(video)};
                          }
                        }
                      }catch(_){}
                      return null;
                    };
                    var loginModalText=function(node){
                      try{
                        return lowerText((node.innerText||node.textContent||'')+' '+((node.getAttribute&&node.getAttribute('aria-label'))||''),1200);
                      }catch(_){return '';}
                    };
                    var hasVisibleCookieDialogForBottomHide=function(){
                      try{
                        var dialogs=Array.from(document.querySelectorAll('[role="dialog"],[role="alertdialog"],[aria-modal="true"]')).slice(0,30);
                        for(var d=0;d<dialogs.length;d++){
                          var node=dialogs[d];
                          if(!visibleNode(node)){continue;}
                          var text=loginModalText(node);
                          if(text.indexOf('cookie')>=0||text.indexOf('cookies')>=0||text.indexOf('optional cookies')>=0||text.indexOf('essential cookies')>=0||text.indexOf('allow all cookies')>=0||text.indexOf('allow the use of cookies')>=0){return true;}
                        }
                      }catch(_){}
                      return false;
                    };
                    var classifyLoginModal=function(node){
                      try{
                        if(!visibleNode(node)){return '';}
                        var role=lowerText((node.getAttribute&&node.getAttribute('role'))||'',32);
                        var ariaModal=lowerText((node.getAttribute&&node.getAttribute('aria-modal'))||'',16);
                        var r=rectOf(node);
                        var centeredLarge=!!r&&
                          r.width>=Math.max(360,(window.innerWidth||0)*0.36)&&
                          r.height>=260&&
                          r.left>=(window.innerWidth||0)*0.08&&
                          r.right<=(window.innerWidth||0)*0.94&&
                          r.top>=(window.innerHeight||0)*0.05&&
                          r.bottom<=(window.innerHeight||0)*0.96;
                        if(role!=='dialog'&&role!=='alertdialog'&&ariaModal!=='true'&&!centeredLarge){return '';}
                        if(node.querySelector&&node.querySelector('video,source,iframe')){return '';}
                        var text=loginModalText(node);
                        if(text.indexOf('cookie')>=0||text.indexOf('cookies')>=0||text.indexOf('optional cookies')>=0||text.indexOf('essential cookies')>=0||text.indexOf('allow the use of cookies')>=0){return '';}
                        var portrait=text.indexOf('see more on facebook')>=0&&
                          text.indexOf('email address or phone number')>=0&&
                          text.indexOf('password')>=0&&
                          text.indexOf('log in')>=0;
                        if(portrait){return 'portrait';}
                        var qrLike=text.indexOf('log in with qr code')>=0||text.indexOf('qr code')>=0||text.indexOf('scan this code')>=0;
                        if(!qrLike){return '';}
                        var signals=0;
                        if(text.indexOf('email address or phone number')>=0){signals+=1;}
                        if(text.indexOf('password')>=0){signals+=1;}
                        if(text.indexOf('log in')>=0){signals+=1;}
                        if(text.indexOf('see more on facebook')>=0){signals+=1;}
                        return signals>=2?'qr':'';
                      }catch(_){return '';}
                    };
                    var addUniqueNode=function(list,node){
                      try{
                        if(!node||list.indexOf(node)>=0){return;}
                        list.push(node);
                      }catch(_){}
                    };
                    var facebookLoginModalCandidates=function(){
                      var out=[];
                      try{
                        Array.from(document.querySelectorAll('[role="dialog"],[role="alertdialog"],[aria-modal="true"]')).slice(0,40).forEach(function(node){addUniqueNode(out,node);});
                      }catch(_){}
                      try{
                        var points=[
                          [Math.round((window.innerWidth||0)*0.50),Math.round((window.innerHeight||0)*0.50)],
                          [Math.round((window.innerWidth||0)*0.50),Math.round((window.innerHeight||0)*0.34)],
                          [Math.round((window.innerWidth||0)*0.74),Math.round((window.innerHeight||0)*0.50)]
                        ];
                        for(var p=0;p<points.length;p++){
                          var stack=Array.from(document.elementsFromPoint(points[p][0],points[p][1])||[]).slice(0,12);
                          for(var s=0;s<stack.length;s++){
                            var cur=stack[s];
                            for(var depth=0;depth<8&&cur&&cur!==document.documentElement;depth++){
                              addUniqueNode(out,cur);
                              cur=cur.parentElement;
                            }
                          }
                        }
                      }catch(_){}
                      try{
                        Array.from(document.querySelectorAll('div,section,form')).slice(0,260).forEach(function(node){
                          try{
                            if(!visibleNode(node)){return;}
                            var text=loginModalText(node);
                            if(text.indexOf('see more on facebook')>=0&&(text.indexOf('password')>=0||text.indexOf('qr code')>=0||text.indexOf('scan the qr')>=0)){
                              addUniqueNode(out,node);
                            }
                          }catch(_){}
                        });
                      }catch(_){}
                      return out.slice(0,90);
                    };
                    var closeButtonSummary=function(node){
                      try{
                        return clipText(((node.getAttribute&&node.getAttribute('aria-label'))||'')+' '+(node.value||'')+' '+((node.getAttribute&&node.getAttribute('title'))||'')+' '+(node.innerText||node.textContent||''),96);
                      }catch(_){return '';}
                    };
                    var isSafeLoginModalCloseButton=function(node,modalRect){
                      try{
                        if(!visibleNode(node)){return false;}
                        if(node.querySelector&&node.querySelector('video,source,canvas,iframe')){return true;}
                        var summary=lowerText(closeButtonSummary(node),96).replace(/\s+/g,' ').trim();
                        if(!summary){return false;}
                        if(summary!=='close'&&summary.indexOf('close')<0){return false;}
                        var forbidden=['log in','login','sign up','signup','continue','watch','play','video','comment','share','create account','qr code','scan this code'];
                        for(var f=0;f<forbidden.length;f++){
                          if(summary.indexOf(forbidden[f])>=0){return false;}
                        }
                        var r=rectOf(node);
                        if(!r||!modalRect){return false;}
                        var squareish=Math.abs(r.width-r.height)<=18&&r.width>=20&&r.height>=20&&r.width<=64&&r.height<=64;
                        var topRight=r.top>=modalRect.top-8&&r.top<=modalRect.top+90&&r.right>=modalRect.right-110&&r.right<=modalRect.right+12;
                        return squareish&&topRight;
                      }catch(_){return false;}
                    };
                    var runLoginModalClose=function(phase){
                      try{
                        if(!loginModalCloseEnabled){return;}
                        if(loginModalCloseState.clicked){
                          emitLoginModalClose(phase,false,'already-clicked',null,null,'',false,'unknown');
                          return;
                        }
                        var primary=primaryAttachedVideoForLoginClose();
                        if(!primary){
                          emitLoginModalClose(phase,false,'no-primary-attached-video',null,null,'',false,'unknown');
                          return;
                        }
                        var dialogs=facebookLoginModalCandidates();
                        var modal=null;
                        var modalVariant='unknown';
                        for(var d=0;d<dialogs.length;d++){
                          var variant=classifyLoginModal(dialogs[d]);
                          if(variant){modal=dialogs[d];modalVariant=variant;break;}
                        }
                        if(!modal){
                          scheduleBottomLoginBarHide('after-no-login-modal-2000',2000);
                          emitLoginModalClose(phase,false,'no-login-modal-match',null,null,'',true,'unknown');
                          return;
                        }
                        var modalRect=rectOf(modal);
                        var buttons=Array.from(modal.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"],a[role="button"],[aria-label]')).slice(0,80);
                        var best=null;
                        for(var b=0;b<buttons.length;b++){
                          if(isSafeLoginModalCloseButton(buttons[b],modalRect)){best=buttons[b];break;}
                        }
                        if(!best){
                          emitLoginModalClose(phase,false,'no-safe-close-button',modal,null,'',true,modalVariant);
                          return;
                        }
                        var summary=closeButtonSummary(best);
                        try{
                          best.click();
                          loginModalCloseState.clicked=true;
                          emitLoginModalClose(phase,true,'clicked',modal,best,summary,true,modalVariant);
                          scheduleBottomLoginBarHide('after-login-modal-close-2000',2000);
                        }catch(clickError){
                          emitLoginModalClose(phase,false,'click-error',modal,best,summary,true,modalVariant);
                        }
                      }catch(error){
                        emitLoginModalClose(phase,false,'scan-error',null,null,'',false,'unknown');
                      }
                    };
                    var scheduleLoginModalClose=function(trigger,delayMs){
                      try{
                        if(!loginModalCloseEnabled){return;}
                        if(loginModalCloseState.scheduled||loginModalCloseState.clicked){return;}
                        loginModalCloseState.scheduled=true;
                        var primary=primaryAttachedVideoForLoginClose();
                        emitLoginModalClose('facebook-login-modal-close-scheduled',false,'scheduled',null,null,'',!!primary,'unknown');
                        setTimeout(function(){runLoginModalClose('facebook-login-modal-close-'+trigger);},delayMs);
                      }catch(_){}
                    };
                    var emitBottomLoginBarHide=function(phase, hidden, reason, bar, barTextSummary, primaryAttached, overlapsVideo, anchor, anchorTextSummary, climbDepth){
                      try{
                        window.prompt(${JSONObject.quote(PROMPT_PREFIX)}+JSON.stringify({
                          type:'facebook-bottom-login-bar-cosmetic-hide',
                          phase:phase,
                          passiveGeneration:passiveGeneration,
                          passiveAttempt:passiveAttempt,
                          passiveMaxAttempts:passiveMaxAttempts,
                          pageUrl:window.location.href,
                          hidden:!!hidden,
                          reason:reason||'',
                          barRect:rectString(rectOf(bar)),
                          barTextSummary:clipText(barTextSummary||'',96),
                          anchorRect:rectString(rectOf(anchor)),
                          anchorText:clipText(anchorTextSummary||'',64),
                          climbDepth:typeof climbDepth==='number'?climbDepth:-1,
                          primaryVideoAttached:!!primaryAttached,
                          overlapsVideo:!!overlapsVideo
                        }), '');
                      }catch(_){}
                    };
                    var bottomLoginText=function(node,limit){
                      try{
                        return lowerText((node.innerText||node.textContent||'')+' '+((node.getAttribute&&node.getAttribute('aria-label'))||'')+' '+((node.getAttribute&&node.getAttribute('title'))||''),limit||800);
                      }catch(_){return '';}
                    };
                    var isInsideBlockedBottomLoginContext=function(node){
                      try{
                        if(!visibleNode(node)){return false;}
                        if(node.querySelector&&node.querySelector('video,source,canvas,iframe')){return false;}
                        var cur=node;
                        for(var depth=0;depth<8&&cur;depth++){
                          if(cur.tagName&&['VIDEO','SOURCE','CANVAS','IFRAME'].indexOf(cur.tagName)>=0){return true;}
                          var role=lowerText((cur.getAttribute&&cur.getAttribute('role'))||'',32);
                          var ariaModal=lowerText((cur.getAttribute&&cur.getAttribute('aria-modal'))||'',16);
                          if(role==='dialog'||role==='alertdialog'||ariaModal==='true'){return true;}
                          var text=bottomLoginText(cur,500);
                          if(text.indexOf('cookie')>=0||text.indexOf('cookies')>=0||text.indexOf('essential')>=0||text.indexOf('optional')>=0||text.indexOf('allow all cookies')>=0){return true;}
                          cur=cur.parentElement;
                        }
                      }catch(_){return true;}
                      return false;
                    };
                    var isBottomLoginAnchor=function(node){
                      try{
                        if(!visibleNode(node)){return false;}
                        var r=rectOf(node);
                        if(!r){return false;}
                        var vw=window.innerWidth||0;
                        var vh=window.innerHeight||0;
                        if(r.bottom<vh-120){return false;}
                        if(r.top<vh*0.50){return false;}
                        if(r.top<90){return false;}
                        var text=bottomLoginText(node,240);
                        if(text.indexOf('cookie')>=0||text.indexOf('cookies')>=0||text.indexOf('essential')>=0||text.indexOf('optional')>=0||text.indexOf('allow all cookies')>=0){return false;}
                        var loginLike=text.indexOf('log in')>=0||text.indexOf('create new account')>=0||text.indexOf('sign up')>=0||text.indexOf('see more on facebook')>=0;
                        if(!loginLike){return false;}
                        if(isInsideBlockedBottomLoginContext(node)){return false;}
                        return true;
                      }catch(_){return false;}
                    };
                    var playerControlText=function(text){
                      var words=['pause','play','mute','volume','fullscreen','timeline','progress','duration','captions','settings'];
                      for(var p=0;p<words.length;p++){
                        if(text.indexOf(words[p])>=0){return true;}
                      }
                      return false;
                    };
                    var findBottomLoginRailFromAnchor=function(anchor,videoRect){
                      try{
                        var anchorRect=rectOf(anchor);
                        if(!anchorRect){return null;}
                        var vw=window.innerWidth||0;
                        var vh=window.innerHeight||0;
                        var cur=anchor;
                        for(var depth=0;depth<=8&&cur&&cur!==document.body&&cur!==document.documentElement;depth++){
                          if(!visibleNode(cur)){cur=cur.parentElement;continue;}
                          if(cur.querySelector&&cur.querySelector('video,source,canvas,iframe')){break;}
                          var role=lowerText((cur.getAttribute&&cur.getAttribute('role'))||'',32);
                          var ariaModal=lowerText((cur.getAttribute&&cur.getAttribute('aria-modal'))||'',16);
                          if(role==='dialog'||role==='alertdialog'||ariaModal==='true'){break;}
                          var r=rectOf(cur);
                          if(!r){cur=cur.parentElement;continue;}
                          var text=bottomLoginText(cur,900);
                          if(text.indexOf('cookie')>=0||text.indexOf('cookies')>=0||text.indexOf('essential')>=0||text.indexOf('optional')>=0||text.indexOf('allow all cookies')>=0){break;}
                          var loginLike=text.indexOf('log in')>=0||text.indexOf('create new account')>=0||text.indexOf('sign up')>=0||text.indexOf('see more on facebook')>=0;
                          var nearBottom=r.bottom>=vh-120&&r.top>=vh*0.40&&r.top>=90;
                          var wide=r.width>=Math.max(anchorRect.width*1.8,vw*0.55);
                          var shallow=r.height>=35&&r.height<=Math.max(190,vh*0.35);
                          var overlaps=rectIntersects(r,videoRect);
                          if(loginLike&&nearBottom&&wide&&shallow&&!playerControlText(text)){
                            if(overlaps&&videoRect){
                              var ix=Math.max(0,Math.min(r.right,videoRect.right)-Math.max(r.left,videoRect.left));
                              var iy=Math.max(0,Math.min(r.bottom,videoRect.bottom)-Math.max(r.top,videoRect.top));
                              var overlapArea=ix*iy;
                              var area=Math.max(1,r.width*r.height);
                              if((overlapArea/area)>0.35){cur=cur.parentElement;continue;}
                            }
                            return {node:cur,depth:depth,text:text,anchor:anchor,anchorText:bottomLoginText(anchor,240)};
                          }
                          cur=cur.parentElement;
                        }
                      }catch(_){}
                      return null;
                    };
                    var findBottomLoginBar=function(videoRect){
                      try{
                        var anchors=Array.from(document.querySelectorAll('a,button,[role="button"],[role="link"],input[type="button"],input[type="submit"]')).slice(0,220);
                        var best=null;
                        for(var i=0;i<anchors.length;i++){
                          var anchor=anchors[i];
                          if(!isBottomLoginAnchor(anchor)){continue;}
                          var found=findBottomLoginRailFromAnchor(anchor,videoRect);
                          if(!found){continue;}
                          if(!best||found.node.getBoundingClientRect().width<best.node.getBoundingClientRect().width){best=found;}
                        }
                        return best;
                      }catch(_){return false;}
                    };
                    var runBottomLoginBarHide=function(phase){
                      try{
                        if(!bottomLoginBarCosmeticHideEnabled){return;}
                        if(bottomLoginBarHideState.hidden){
                          emitBottomLoginBarHide(phase,false,'already-hidden',null,'',false,false,null,'',-1);
                          return;
                        }
                        var primary=primaryAttachedVideoForLoginClose();
                        if(!primary){
                          emitBottomLoginBarHide(phase,false,'no-primary-attached-video',null,'',false,false,null,'',-1);
                          return;
                        }
                        if(!cookieAllowAllState.clicked&&hasVisibleCookieDialogForBottomHide()){
                          emitBottomLoginBarHide(phase,false,'cookie-dialog-visible',null,'',true,false,null,'',-1);
                          return;
                        }
                        var visibleLoginModal=false;
                        var dialogs=Array.from(document.querySelectorAll('[role="dialog"],[role="alertdialog"],[aria-modal="true"]')).slice(0,40);
                        for(var d=0;d<dialogs.length;d++){
                          if(classifyLoginModal(dialogs[d])){visibleLoginModal=true;break;}
                        }
                        if(visibleLoginModal){
                          emitBottomLoginBarHide(phase,false,'login-modal-visible',null,'',true,false,null,'',-1);
                          return;
                        }
                        var best=findBottomLoginBar(primary.rect);
                        if(!best){
                          emitBottomLoginBarHide(phase,false,'no-bottom-login-bar-match',null,'',true,false,null,'',-1);
                          return;
                        }
                        var rail=best.node;
                        var summary=clipText((rail.innerText||rail.textContent||''),96);
                        var overlaps=rectIntersects(rectOf(rail),primary.rect);
                        try{
                          rail.setAttribute('data-kf-fb-bottom-login-hidden','1');
                          rail.style.display='none';
                          bottomLoginBarHideState.hidden=true;
                          emitBottomLoginBarHide(phase,true,'hidden',rail,summary,true,overlaps,best.anchor,best.anchorText,best.depth);
                        }catch(hideError){
                          emitBottomLoginBarHide(phase,false,'hide-error',rail,summary,true,overlaps,best.anchor,best.anchorText,best.depth);
                        }
                      }catch(error){
                        emitBottomLoginBarHide(phase,false,'scan-error',null,'',false,false,null,'',-1);
                      }
                    };
                    var scheduleBottomLoginBarHide=function(trigger,delayMs){
                      try{
                        if(!bottomLoginBarCosmeticHideEnabled){return;}
                        if(bottomLoginBarHideState.scheduled||bottomLoginBarHideState.hidden){return;}
                        bottomLoginBarHideState.scheduled=true;
                        var primary=primaryAttachedVideoForLoginClose();
                        emitBottomLoginBarHide('facebook-bottom-login-bar-hide-scheduled',false,'scheduled',null,'',!!primary,false,null,'',-1);
                        setTimeout(function(){runBottomLoginBarHide('facebook-bottom-login-bar-hide-'+trigger);},delayMs);
                      }catch(_){}
                    };
                    var emitCookieAllowAllAutoclick=function(phase, clicked, reason, buttonText, dialogRect, buttonRect){
                      try{
                        window.prompt(${JSONObject.quote(PROMPT_PREFIX)}+JSON.stringify({
                          type:'facebook-cookie-allow-all-autoclick',
                          phase:phase,
                          passiveGeneration:passiveGeneration,
                          passiveAttempt:passiveAttempt,
                          passiveMaxAttempts:passiveMaxAttempts,
                          pageUrl:window.location.href,
                          clicked:!!clicked,
                          reason:reason||'',
                          buttonText:clipText(buttonText||'',64),
                          dialogRect:rectString(dialogRect),
                          buttonRect:rectString(buttonRect)
                        }), '');
                      }catch(_){}
                    };
                    var maybeRunCookieAllowAllAutoclick=function(phase){
                      try{
                        if(!cookieAllowAllAutoclickEnabled){return;}
                        if(cookieAllowAllState.clicked){return;}
                        emitCookieAllowAllAutoclick(phase,false,'scan','','',null);
                        var videoAncestorTags=['VIDEO','SOURCE','CANVAS','IFRAME'];
                        var isNearPlayer=function(node){
                          try{
                            var cur=node;
                            var depth=0;
                            while(cur&&depth<8){
                              if(videoAncestorTags.indexOf(cur.tagName)>=0){return true;}
                              var role=lowerText((cur.getAttribute&&cur.getAttribute('role'))||'',32);
                              var aria=lowerText((cur.getAttribute&&cur.getAttribute('aria-label'))||'',64);
                              var cls=lowerText((typeof cur.className==='string')?cur.className:'',96);
                              var testid=lowerText((cur.getAttribute&&cur.getAttribute('data-testid'))||'',64);
                              var id=lowerText(cur.id||'',64);
                              var blob=role+' '+aria+' '+cls+' '+testid+' '+id;
                              if(blob.indexOf('video')>=0||blob.indexOf('player')>=0||blob.indexOf('watch')>=0||blob.indexOf('reel')>=0){return true;}
                              cur=cur.parentElement;
                              depth+=1;
                            }
                          }catch(_){}
                          return false;
                        };
                        var visibleSized=function(node){
                          try{
                            if(!visibleNode(node)){return false;}
                            var r=node.getBoundingClientRect();
                            return r.width>=36&&r.height>=24&&r.width<=window.innerWidth&&r.height<=window.innerHeight;
                          }catch(_){return false;}
                        };
                        var cookieDialogText=function(node){
                          try{
                            return lowerText((node.innerText||node.textContent||'')+' '+((node.getAttribute&&node.getAttribute('aria-label'))||''),1200);
                          }catch(_){return '';}
                        };
                        var isCookieDialog=function(node){
                          try{
                            if(!visibleNode(node)){return false;}
                            var role=lowerText((node.getAttribute&&node.getAttribute('role'))||'',32);
                            var ariaModal=lowerText((node.getAttribute&&node.getAttribute('aria-modal'))||'',16);
                            if(role!=='dialog'&&role!=='alertdialog'&&ariaModal!=='true'){return false;}
                            var text=cookieDialogText(node);
                            return text.indexOf('cookie')>=0||
                              text.indexOf('cookies')>=0||
                              text.indexOf('optional cookies')>=0||
                              text.indexOf('essential cookies')>=0||
                              text.indexOf('allow the use of cookies')>=0||
                              text.indexOf('facebook cookies')>=0;
                          }catch(_){return false;}
                        };
                        var buttonText=function(node){
                          try{
                            return clipText(((node.getAttribute&&node.getAttribute('aria-label'))||'')+' '+(node.value||'')+' '+((node.getAttribute&&node.getAttribute('title'))||'')+' '+(node.innerText||node.textContent||''),96);
                          }catch(_){return '';}
                        };
                        var priorityFor=function(text){
                          var normalized=lowerText(text,96).replace(/\s+/g,' ').trim();
                          var forbidden=['decline','essential cookies','only allow','login','log in','sign up','signup','create account','watch','play','video','comment','share','continue'];
                          for(var f=0;f<forbidden.length;f++){
                            if(normalized.indexOf(forbidden[f])>=0){return -1;}
                          }
                          if(normalized==='allow all cookies'){return 0;}
                          if(normalized==='accept all cookies'){return 1;}
                          if(normalized==='allow all'){return 2;}
                          if(normalized==='accept all'){return 3;}
                          if(normalized.indexOf('allow all cookies')>=0){return 4;}
                          if(normalized.indexOf('accept all cookies')>=0){return 5;}
                          return -1;
                        };
                        var dialogs=Array.from(document.querySelectorAll('[role="dialog"],[role="alertdialog"],[aria-modal="true"]')).slice(0,20).filter(isCookieDialog);
                        if(dialogs.length===0){
                          emitCookieAllowAllAutoclick(phase,false,'no-cookie-dialog','','',null);
                          return;
                        }
                        var best=null;
                        for(var d=0;d<dialogs.length;d++){
                          var dialog=dialogs[d];
                          var candidates=Array.from(dialog.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"],a[role="button"]')).slice(0,80);
                          for(var c=0;c<candidates.length;c++){
                            var candidate=candidates[c];
                            if(!visibleSized(candidate)){continue;}
                            if(isNearPlayer(candidate)){continue;}
                            var text=buttonText(candidate);
                            var priority=priorityFor(text);
                            if(priority<0){continue;}
                            var item={dialog:dialog,button:candidate,text:text,priority:priority};
                            if(!best||item.priority<best.priority){best=item;}
                          }
                        }
                        if(!best){
                          emitCookieAllowAllAutoclick(phase,false,'no-allow-all-button','',rectOf(dialogs[0]),null);
                          return;
                        }
                        var dialogRect=rectOf(best.dialog);
                        var buttonRect=rectOf(best.button);
                        try{
                          best.button.click();
                          cookieAllowAllState.clicked=true;
                          emitCookieAllowAllAutoclick(phase,true,'clicked',best.text,dialogRect,buttonRect);
                        }catch(clickError){
                          emitCookieAllowAllAutoclick(phase,false,'click-error',best.text,dialogRect,buttonRect);
                        }
                      }catch(error){
                        emitCookieAllowAllAutoclick(phase,false,'scan-error','','',null);
                      }
                    };
                    var emit=function(phase){
                      try{
                        var clip=function(v,n){
                          try{return ((v||'')+'').slice(0,n);}catch(_){return '';}
                        };
                        var compactNode=function(node){
                          try{
                            if(!node){return 'none';}
                            var tag=((node.tagName||'')+'').toLowerCase();
                            var id=clip(node.id||'',24);
                            var testid=clip((node.getAttribute&&node.getAttribute('data-testid'))||'',24);
                            var role=clip((node.getAttribute&&node.getAttribute('role'))||'',18);
                            var aria=clip((node.getAttribute&&node.getAttribute('aria-label'))||'',28);
                            var cls=clip(((typeof node.className==='string')?node.className:''),28).replace(/\s+/g,'.');
                            return [tag,id?('#'+id):'',role?('@'+role):'',testid?('[t='+testid+']'):''.replace(/\s+/g,''),aria?('[a='+aria+']'):''.replace(/\s+/g,''),cls?('.'+cls):''].join('');
                          }catch(_){return 'node-error';}
                        };
                        var compactParents=function(node){
                          var out=[];
                          try{
                            var cur=node;
                            var depth=0;
                            while(cur&&depth<5){
                              out.push(compactNode(cur));
                              cur=cur.parentElement;
                              depth+=1;
                            }
                          }catch(_){ }
                          return out;
                        };
                        var rectOf=function(node){
                          try{
                            if(!node){return null;}
                            var r=node.getBoundingClientRect();
                            return {x:Math.round(r.x),y:Math.round(r.y),left:Math.round(r.left),top:Math.round(r.top),right:Math.round(r.right),bottom:Math.round(r.bottom),width:Math.round(r.width),height:Math.round(r.height)};
                          }catch(_){return null;}
                        };
                        var patternSummary=function(urls){
                          var patterns=['fbcdn','video','blob:','.mp4','.m3u8','dash','bytestart'];
                          var result={};
                          for(var p=0;p<patterns.length;p++){
                            result[patterns[p]]={count:0,snippets:[]};
                          }
                          for(var i=0;i<urls.length;i++){
                            var url=((urls[i]||'')+'');
                            var lower=url.toLowerCase();
                            for(var j=0;j<patterns.length;j++){
                              var key=patterns[j];
                              if(lower.indexOf(key)>=0){
                                result[key].count+=1;
                                if(result[key].snippets.length<3){
                                  result[key].snippets.push(clip(url,96));
                                }
                              }
                            }
                          }
                          return result;
                        };
                        var videos=Array.from(document.querySelectorAll('video')).slice(0,6);
                        var visibleVideoCount=0;
                        var readyVideoCount=0;
                        var videoStates=[];
                        var urls=[];
                        Array.from(document.querySelectorAll('video,source,script,link,a')).slice(0,300).forEach(function(node){
                          try{
                            var src=(node.currentSrc||node.src||node.href||'');
                            if(src){urls.push(src);}
                          }catch(_){ }
                        });
                        var activeElement=document.activeElement;
                        var userActivation={isActive:false,hasBeenActive:false};
                        try{
                          if(navigator.userActivation){
                            userActivation.isActive=!!navigator.userActivation.isActive;
                            userActivation.hasBeenActive=!!navigator.userActivation.hasBeenActive;
                          }
                        }catch(_){ }
                        var firstVisibleVideo=null;
                        var firstVisibleVideoInViewport=false;
                        for(var i=0;i<videos.length;i++){
                          var video=videos[i];
                          var visibleNow=false;
                          try{
                            var style=window.getComputedStyle(video);
                            var rect=video.getBoundingClientRect();
                            visibleNow=!!video&&(!style||!(style.display==='none'||style.visibility==='hidden'||style.opacity==='0'))&&rect.width>8&&rect.height>8&&rect.bottom>0&&rect.right>0&&rect.top<window.innerHeight&&rect.left<window.innerWidth;
                          }catch(_){ }
                          var currentSrc=(video.currentSrc||video.src||'');
                          var state={
                            visible:visibleNow,
                            paused:!!video.paused,
                            readyState:video.readyState||0,
                            networkState:video.networkState||0,
                            currentTime:(typeof video.currentTime==='number'?video.currentTime:0),
                            duration:(typeof video.duration==='number'?video.duration:0),
                            videoWidth:video.videoWidth||0,
                            videoHeight:video.videoHeight||0,
                            currentSrc:currentSrc,
                            currentSrcHost:(function(src){try{return (new URL(src, window.location.href)).host || '';}catch(_){return '';}})(currentSrc)
                          };
                          videoStates.push(state);
                          if(visibleNow){
                            visibleVideoCount+=1;
                            if(!firstVisibleVideo){firstVisibleVideo=video; firstVisibleVideoInViewport=!!visibleNow;}
                            if(state.readyState>=1 || state.currentSrc || state.videoWidth>0 || state.videoHeight>0){
                              readyVideoCount+=1;
                            }
                          }
                        }
                        var cookieOverlayVisible=false;
                        var loginOverlayVisible=false;
                        var nodes=Array.from(document.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"],a[role="button"],[aria-label]')).slice(0,160);
                        for(var n=0;n<nodes.length;n++){
                          var node=nodes[n];
                          try{
                            var style=window.getComputedStyle(node);
                            if(style&&(style.display==='none'||style.visibility==='hidden'||style.opacity==='0')){continue;}
                            var blob=((node.value||'')+' '+((node.getAttribute&&node.getAttribute('aria-label'))||'')+' '+((node.getAttribute&&node.getAttribute('title'))||'')+' '+(node.innerText||node.textContent||'')+' '+((node.getAttribute&&node.getAttribute('id'))||'')+' '+((node.getAttribute&&node.getAttribute('name'))||'')+' '+((node.getAttribute&&node.getAttribute('data-testid'))||'')+' '+((typeof node.className==='string')?node.className:'')).toLowerCase();
                            if(blob.indexOf('cookie')>=0 || blob.indexOf('consent')>=0 || blob.indexOf('privacy')>=0 || blob.indexOf('gdpr')>=0 || blob.indexOf('tracking')>=0){cookieOverlayVisible=true;}
                            if(blob.indexOf('login')>=0 || blob.indexOf('log in')>=0 || blob.indexOf('sign up')>=0 || blob.indexOf('password')>=0 || blob.indexOf('create new account')>=0){loginOverlayVisible=true;}
                          }catch(_){ }
                        }
                        window.prompt(${JSONObject.quote(PROMPT_PREFIX)}+JSON.stringify({
                          type:'facebook-compat',
                          phase:phase,
                          passiveGeneration:passiveGeneration,
                          passiveAttempt:passiveAttempt,
                          passiveMaxAttempts:passiveMaxAttempts,
                          pageUrl:window.location.href,
                          documentReadyState:document.readyState||'',
                          documentUrl:document.URL||'',
                          documentVisibilityState:document.visibilityState||'',
                          documentHasFocus:!!document.hasFocus(),
                          documentHidden:!!document.hidden,
                          locationHref:window.location.href,
                          title:document.title||'',
                          historyLength:(window.history&&window.history.length)||0,
                          windowInnerWidth:window.innerWidth||0,
                          windowInnerHeight:window.innerHeight||0,
                          windowScrollX:window.scrollX||0,
                          windowScrollY:window.scrollY||0,
                          scrollingElementScrollTop:(document.scrollingElement&&document.scrollingElement.scrollTop)||0,
                          scrollingElementScrollHeight:(document.scrollingElement&&document.scrollingElement.scrollHeight)||0,
                          scrollingElementClientHeight:(document.scrollingElement&&document.scrollingElement.clientHeight)||0,
                          videoCount:videoStates.length,
                          visibleVideoCount:visibleVideoCount,
                          readyVideoCount:readyVideoCount,
                          videoStates:videoStates,
                          visibleVideoRect:rectOf(firstVisibleVideo),
                          visibleVideoInViewport:!!firstVisibleVideoInViewport,
                          activeElementSummary:compactNode(activeElement),
                          activeElementParents:compactParents(activeElement),
                          visibleVideoParents:compactParents(firstVisibleVideo),
                          resourceHintCounts:patternSummary(urls),
                          watchParam:clip((function(){
                            try{var u=new URL(window.location.href); return u.searchParams.get('v')||u.searchParams.get('video_id')||'';}catch(_){ return ''; }
                          })(),64),
                          cookieOverlayVisible:cookieOverlayVisible,
                          loginOverlayVisible:loginOverlayVisible,
                          userActivation:userActivation,
                          playbackWaiting:false,
                          passiveMode:true
                        }), '');
                        var firstState=videoStates.length>0?(function(){
                          for(var fs=0;fs<videoStates.length;fs++){if(videoStates[fs].visible){return videoStates[fs];}}
                          return null;
                        })():null;
                        var readyEnough=!!(firstState&&firstState.currentSrc&&firstState.readyState>=1&&firstState.videoWidth>0&&firstState.videoHeight>0);
                        var currentTimeAdvanced=!!(firstState&&firstState.currentTime>0.25);
                        if(phase==='facebook-passive-sample-0'&&!overlayDiagState.early){
                          overlayDiagState.early=true;
                          emitOverlayDiagnostics('entry');
                        }
                        if((cookieOverlayVisible||loginOverlayVisible)&&!overlayDiagState.visible){
                          overlayDiagState.visible=true;
                          emitOverlayDiagnostics('visible-overlay');
                        }
                        if((readyEnough||currentTimeAdvanced)&&!overlayDiagState.attached){
                          overlayDiagState.attached=true;
                          emitOverlayDiagnostics('after-attach');
                          scheduleLoginModalClose('after-attach-2500',2500);
                          setTimeout(function(){
                            if(!overlayDiagState.attachedDelay){
                              overlayDiagState.attachedDelay=true;
                              emitOverlayDiagnostics('after-attach-2500');
                            }
                          },2500);
                        }
                        maybeRunCookieAllowAllAutoclick(phase);
                      }catch(_){ }
                    };
                    emit('facebook-passive-sample-0');
                    setTimeout(function(){ emit('facebook-passive-sample-1200'); }, 1200);
                    setTimeout(function(){ emit('facebook-passive-sample-3000'); }, 3000);
                    setTimeout(function(){ emit('facebook-passive-sample-6000'); }, 6000);
                    setTimeout(function(){ emit('facebook-passive-evaluate-10000'); }, 10000);
                  }catch(_){ }
                })();
            """.trimIndent()
            GvLogger.i(
                "GvExt",
                "facebook passive compat dispatched tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} url=$normalizedUrl generation=$passiveGeneration attempt=$passiveAttempt/$FACEBOOK_PASSIVE_MAX_ATTEMPTS"
            )
            session.loadUri(passiveScript)
            return
        }
        val script = """
            javascript:(function(){
              try{
                var path=((window.location&&window.location.pathname)||'').toLowerCase();
                if(path==='/reg' || path==='/login'){return;}
                var state=window.__kfFbSimpleCompatState||(window.__kfFbSimpleCompatState={cookieClickCount:0,loginDismissCount:0,loginHideCount:0});
                var lower=function(v){return ((v||'')+'').replace(/\s+/g,' ').trim().toLowerCase();};
                var visible=function(node){
                  try{
                    if(!node){return false;}
                    var style=window.getComputedStyle(node);
                    if(style&&(style.display==='none'||style.visibility==='hidden'||style.opacity==='0')){return false;}
                    var rect=node.getBoundingClientRect();
                    return rect.width>8&&rect.height>8&&rect.bottom>0&&rect.right>0&&rect.top<window.innerHeight&&rect.left<window.innerWidth;
                  }catch(_){return false;}
                };
                var textOf=function(node){
                  try{
                    return lower(
                      (node.value||'')+' '+
                      ((node.getAttribute&&node.getAttribute('aria-label'))||'')+' '+
                      ((node.getAttribute&&node.getAttribute('title'))||'')+' '+
                      (node.innerText||node.textContent||'')
                    );
                  }catch(_){return '';}
                };
                var attrOf=function(node){
                  try{
                    return lower(
                      ((node.getAttribute&&node.getAttribute('id'))||'')+' '+
                      ((node.getAttribute&&node.getAttribute('name'))||'')+' '+
                      ((node.getAttribute&&node.getAttribute('data-testid'))||'')+' '+
                      ((typeof node.className==='string')?node.className:'')
                    );
                  }catch(_){return '';}
                };
                var clickNode=function(node){
                  try{
                    if(!node||!visible(node)){return false;}
                    try{node.scrollIntoView({block:'center',inline:'center'});}catch(_){}
                    try{
                      node.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,cancelable:true,view:window}));
                      node.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,view:window}));
                      node.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true,view:window}));
                    }catch(_){}
                    node.click();
                    return true;
                  }catch(_){return false;}
                };
                var controls=function(){
                  return Array.from(document.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"],a[role="button"],[aria-label]')).slice(0,160);
                };
                var samples=[];
                var sample=function(node,blob){
                  try{
                    if(samples.length>=8){return;}
                    samples.push({
                      tag:lower(node&&node.tagName),
                      text:((blob||'')+'').slice(0,120),
                      aria:((node&&node.getAttribute&&node.getAttribute('aria-label'))||'').slice(0,80),
                      testid:((node&&node.getAttribute&&node.getAttribute('data-testid'))||'').slice(0,80),
                      visible:!!visible(node)
                    });
                  }catch(_){}
                };
                var isCookieAction=function(blob){
                  return (
                    blob.indexOf('allow all cookies')>=0 ||
                    blob.indexOf('accept all cookies')>=0 ||
                    blob.indexOf('accept all')>=0 ||
                    blob.indexOf('allow all')>=0 ||
                    blob.indexOf('allow essential cookies')>=0 ||
                    blob.indexOf('only allow essential cookies')>=0 ||
                    blob.indexOf('decline optional cookies')>=0
                  );
                };
                var clickCookie=function(){
                  var nodes=controls();
                  for(var i=0;i<nodes.length;i++){
                    var node=nodes[i];
                    if(!visible(node)){continue;}
                    var blob=textOf(node)+' '+attrOf(node);
                    if(blob.indexOf('login')>=0||blob.indexOf('log in')>=0||blob.indexOf('sign up')>=0){continue;}
                    sample(node,blob);
                    if(isCookieAction(blob)&&clickNode(node)){
                      state.cookieClickCount+=1;
                      return true;
                    }
                  }
                  return false;
                };
                var clickLoginDismiss=function(){
                  var nodes=controls();
                  for(var i=0;i<nodes.length;i++){
                    var node=nodes[i];
                    if(!visible(node)){continue;}
                    var blob=textOf(node)+' '+attrOf(node);
                    if(
                      blob==='not now' ||
                      blob.indexOf('not now')>=0 ||
                      blob==='close' ||
                      blob.indexOf('close')>=0 ||
                      blob.indexOf('continue watching')>=0
                    ){
                      sample(node,blob);
                      if(clickNode(node)){
                        state.loginDismissCount+=1;
                        return true;
                      }
                    }
                  }
                  return false;
                };
                var hideLoginDialog=function(){
                  var nodes=Array.from(document.querySelectorAll('[role="dialog"],[aria-modal="true"]')).slice(0,40);
                  for(var i=0;i<nodes.length;i++){
                    var node=nodes[i];
                    if(!visible(node)){continue;}
                    var blob=textOf(node)+' '+attrOf(node);
                    if(blob.indexOf('cookie')>=0||blob.indexOf('consent')>=0){continue;}
                    var loginLike=(
                      blob.indexOf('log in')>=0 ||
                      blob.indexOf('login')>=0 ||
                      blob.indexOf('sign up')>=0 ||
                      blob.indexOf('create new account')>=0
                    );
                    if(!loginLike){continue;}
                    try{
                      node.style.setProperty('display','none','important');
                      node.style.setProperty('visibility','hidden','important');
                      node.style.setProperty('pointer-events','none','important');
                      document.documentElement.style.setProperty('overflow','auto','important');
                      document.body.style.setProperty('overflow','auto','important');
                      state.loginHideCount+=1;
                      return true;
                    }catch(_){}
                  }
                  return false;
                };
                var hideBottomLoginRail=function(){
                  try{
                    var points=[
                      [Math.round(window.innerWidth*0.50),Math.round(window.innerHeight*0.92)],
                      [Math.round(window.innerWidth*0.35),Math.round(window.innerHeight*0.92)],
                      [Math.round(window.innerWidth*0.65),Math.round(window.innerHeight*0.92)]
                    ];
                    for(var p=0;p<points.length;p++){
                      var node=document.elementFromPoint(points[p][0],points[p][1]);
                      var cur=node;
                      for(var depth=0;depth<8&&cur&&cur!==document.documentElement;depth++){
                        if(cur!==document.body&&visible(cur)){
                          var rect=cur.getBoundingClientRect();
                          var blob=textOf(cur)+' '+attrOf(cur);
                          var bottomRail=rect.width>(window.innerWidth*0.55)&&rect.bottom>(window.innerHeight-8)&&rect.height>=80&&rect.height<260;
                          var loginRail=(
                            blob.indexOf('log in or sign up')>=0 ||
                            (
                              blob.indexOf('create new account')>=0 &&
                              blob.indexOf('connect with friends')>=0
                            )
                          );
                          if(bottomRail&&loginRail){
                            cur.style.setProperty('display','none','important');
                            cur.style.setProperty('visibility','hidden','important');
                            cur.style.setProperty('pointer-events','none','important');
                            state.loginHideCount+=1;
                            return true;
                          }
                        }
                        cur=cur.parentElement;
                      }
                    }
                  }catch(_){}
                  return false;
                };
                var collectFacebookPlaybackSnapshot=function(){
                  var videos=Array.from(document.querySelectorAll('video')).slice(0,6);
                  var visibleVideoCount=0;
                  var readyVideoCount=0;
                  var states=[];
                  for(var i=0;i<videos.length;i++){
                    var video=videos[i];
                    var currentSrc=(video.currentSrc||video.src||'').slice(0,80);
                    var visibleNow=visible(video);
                    var state={
                      visible:visibleNow,
                      paused:!!video.paused,
                      ended:!!video.ended,
                      readyState:video.readyState||0,
                      networkState:video.networkState||0,
                      currentTime:(typeof video.currentTime==='number'?video.currentTime:0),
                      duration:(typeof video.duration==='number'?video.duration:0),
                      muted:!!video.muted,
                      volume:(typeof video.volume==='number'?video.volume:0),
                      videoWidth:video.videoWidth||0,
                      videoHeight:video.videoHeight||0,
                      currentSrc:currentSrc,
                      currentSrcHost:(function(src){try{return (new URL(src, window.location.href)).host || '';}catch(_){return '';}})(currentSrc),
                      error:video.error?video.error.code:0
                    };
                    states.push(state);
                    if(visibleNow){
                      visibleVideoCount+=1;
                      if(state.readyState>=1 || state.currentSrc || state.videoWidth>0 || state.videoHeight>0){
                        readyVideoCount+=1;
                      }
                    }
                  }
                  var cookieOverlayVisible=false;
                  var loginOverlayVisible=false;
                  var nodes=controls();
                  for(var n=0;n<nodes.length;n++){
                    var node=nodes[n];
                    if(!visible(node)){continue;}
                    var blob=textOf(node)+' '+attrOf(node);
                    if(blob.indexOf('cookie')>=0 || blob.indexOf('consent')>=0 || blob.indexOf('privacy')>=0 || blob.indexOf('gdpr')>=0 || blob.indexOf('tracking')>=0){
                      cookieOverlayVisible=true;
                    }
                    if(blob.indexOf('login')>=0 || blob.indexOf('log in')>=0 || blob.indexOf('sign up')>=0 || blob.indexOf('password')>=0 || blob.indexOf('create new account')>=0){
                      loginOverlayVisible=true;
                    }
                  }
                  return {
                    videoCount:videos.length,
                    visibleVideoCount:visibleVideoCount,
                    readyVideoCount:readyVideoCount,
                    videoStates:states,
                    cookieOverlayVisible:cookieOverlayVisible,
                    loginOverlayVisible:loginOverlayVisible,
                  };
                };
                var emitFacebookPlaybackPhase=function(phase, extra){
                  try{
                    var snapshot=collectFacebookPlaybackSnapshot();
                    var payload={
                      type:'facebook-compat',
                      phase:phase,
                      pageUrl:window.location.href,
                      title:document.title||'',
                      videoCount:snapshot.videoCount,
                      visibleVideoCount:snapshot.visibleVideoCount,
                      readyVideoCount:snapshot.readyVideoCount,
                      videoStates:snapshot.videoStates,
                      cookieOverlayVisible:!!snapshot.cookieOverlayVisible,
                      loginOverlayVisible:!!snapshot.loginOverlayVisible,
                    };
                    if(extra){
                      for(var key in extra){
                        if(Object.prototype.hasOwnProperty.call(extra,key)){
                          payload[key]=extra[key];
                        }
                      }
                    }
                    window.prompt("__GV_MEDIA__"+JSON.stringify(payload), '');
                  }catch(_){ }
                };
                var wakeFacebookVideo=function(){
                  var result={videoCount:0,playAttempted:false,playButtonClicked:false,playButtonFound:false,playbackDeferred:false,playbackDeferredReason:'',readyVideoCount:0,wakeAllowed:false,states:[]};
                  var retryScheduled=false;
                  var tapPoint=function(x,y){
                    try{
                      var target=document.elementFromPoint(x,y);
                      if(!target){return false;}
                      if(!visible(target)){return false;}
                      try{target.scrollIntoView({block:'center',inline:'center'});}catch(_){}
                      try{
                        target.dispatchEvent(new MouseEvent('pointermove',{bubbles:true,cancelable:true,clientX:x,clientY:y,view:window}));
                        target.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,cancelable:true,clientX:x,clientY:y,view:window}));
                        target.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,clientX:x,clientY:y,view:window}));
                        target.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true,clientX:x,clientY:y,view:window}));
                        target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:x,clientY:y,view:window}));
                      }catch(_){}
                      try{
                        var clickable=target;
                        for(var depth=0; depth<6 && clickable; depth++){
                          var tag=(clickable.tagName||'').toLowerCase();
                          var role=((clickable.getAttribute&&clickable.getAttribute('role'))||'').toLowerCase();
                          if(tag==='button' || tag==='a' || tag==='input' || role==='button' || clickable.onclick){break;}
                          clickable=clickable.parentElement;
                        }
                        if(clickable&&clickable.click){clickable.click();}
                      }catch(_){}
                      return true;
                    }catch(_){return false;}
                  };
                  var findPlayButtonNode=function(){
                    var playWords=['play video','play','watch now'];
                    var nodes=controls();
                    for(var i=0;i<nodes.length;i++){
                      var node=nodes[i];
                      if(!visible(node)){continue;}
                      var blob=textOf(node)+' '+attrOf(node);
                      for(var w=0;w<playWords.length;w++){
                        if(blob.indexOf(playWords[w])>=0){return node;}
                      }
                    }
                    return null;
                  };
                  try{
                    var videos=Array.from(document.querySelectorAll('video')).slice(0,6);
                    result.videoCount=videos.length;
                    for(var i=0;i<videos.length;i++){
                      var video=videos[i];
                      var currentSrc=(video.currentSrc||video.src||'').slice(0,80);
                      var state={
                        visible:visible(video),
                        paused:!!video.paused,
                        ended:!!video.ended,
                        readyState:video.readyState||0,
                        networkState:video.networkState||0,
                        currentTime:(typeof video.currentTime==='number'?video.currentTime:0),
                        duration:(typeof video.duration==='number'?video.duration:0),
                        muted:!!video.muted,
                        volume:(typeof video.volume==='number'?video.volume:0),
                        videoWidth:video.videoWidth||0,
                        videoHeight:video.videoHeight||0,
                        currentSrc:currentSrc,
                        currentSrcHost:(function(src){try{return (new URL(src, window.location.href)).host || '';}catch(_){return '';}})(currentSrc),
                        error:video.error?video.error.code:0
                      };
                      result.states.push(state);
                      if(!state.visible){continue;}
                      if(state.readyState>=1 || state.currentSrc || state.videoWidth>0 || state.videoHeight>0){
                        result.readyVideoCount+=1;
                      }
                      try{video.setAttribute('playsinline','');}catch(_){}
                      try{video.setAttribute('webkit-playsinline','');}catch(_){}
                      try{video.controls=true;}catch(_){}
                      if(video.paused && (state.readyState>=1 || state.currentSrc || state.videoWidth>0 || state.videoHeight>0)){
                        try{
                          var playResult=video.play&&video.play();
                          result.playAttempted=true;
                          if(playResult&&playResult.catch){playResult.catch(function(){});}
                        }catch(_){}
                      }
                      if(!result.playButtonClicked){
                        try{
                          var rect=video.getBoundingClientRect();
                          var centers=[
                            [Math.round((rect.left+rect.right)/2),Math.round((rect.top+rect.bottom)/2)],
                            [Math.round((rect.left+rect.right)/2),Math.round((rect.top+rect.bottom)/2)-18],
                            [Math.round((rect.left+rect.right)/2),Math.round((rect.top+rect.bottom)/2)+18]
                          ];
                          for(var c=0;c<centers.length;c++){
                            if(tapPoint(centers[c][0],centers[c][1])){
                              result.playButtonClicked=true;
                              break;
                            }
                          }
                        }catch(_){}
                        if(!result.playButtonClicked && tapPoint(Math.round((video.getBoundingClientRect().left+video.getBoundingClientRect().right)/2),Math.round((video.getBoundingClientRect().top+video.getBoundingClientRect().bottom)/2))){
                            result.playButtonClicked=true;
                        }
                      }
                    }
                    var playButtonNode=findPlayButtonNode();
                    result.playButtonFound=!!playButtonNode;
                    result.wakeAllowed=result.readyVideoCount>0 || result.playButtonFound;
                    if(!result.wakeAllowed){
                      result.playbackDeferred=true;
                      result.playbackDeferredReason='video-not-ready';
                      return result;
                    }
                    if(playButtonNode){
                      try{
                        if(clickNode(playButtonNode)){
                          result.playButtonClicked=true;
                        }
                      }catch(_){ }
                    }
                    if(!retryScheduled && result.videoCount>0){
                      retryScheduled=true;
                      var retryWake=function(){
                        try{
                          var retryVideos=Array.from(document.querySelectorAll('video')).slice(0,6);
                          for(var r=0;r<retryVideos.length;r++){
                            var retryVideo=retryVideos[r];
                            if(!visible(retryVideo)){continue;}
                            try{
                              var retryRect=retryVideo.getBoundingClientRect();
                              var retryX=Math.round((retryRect.left+retryRect.right)/2);
                              var retryY=Math.round((retryRect.top+retryRect.bottom)/2);
                              tapPoint(retryX,retryY);
                              if(retryVideo.paused && retryVideo.play){
                                var retryPlay=retryVideo.play();
                                if(retryPlay&&retryPlay.catch){retryPlay.catch(function(){});}
                              }
                              break;
                            }catch(_){}
                          }
                        }catch(_){}
                      };
                      setTimeout(retryWake,1200);
                      setTimeout(retryWake,4200);
                    }
                    if(!result.playAttempted && !result.playButtonClicked){
                      var playWords=['play video','play','watch now'];
                      var nodes=controls();
                      for(var p=0;p<nodes.length;p++){
                        var node=nodes[p];
                        if(!visible(node)){continue;}
                        var blob=textOf(node)+' '+attrOf(node);
                        var isPlay=false;
                        for(var w=0;w<playWords.length;w++){
                          if(blob.indexOf(playWords[w])>=0){isPlay=true;break;}
                        }
                        if(isPlay&&clickNode(node)){
                          result.playButtonClicked=true;
                          break;
                        }
                      }
                    }
                  }catch(_){}
                  return result;
                };
                var preflightSnapshot=collectFacebookPlaybackSnapshot();
                emitFacebookPlaybackPhase('facebook-before-cookie-cleanup', {
                  cleanupHiddenAny:false,
                  wakeAttempted:false,
                  playbackWaiting:false
                });
                var cookieClicked=clickCookie();
                emitFacebookPlaybackPhase('facebook-after-cookie-cleanup', {
                  cookieClicked:!!cookieClicked,
                  cleanupHiddenAny:!!cookieClicked,
                  wakeAttempted:false,
                  playbackWaiting:false
                });
                if (activeHelpersEnabled) {
                var postCookieSnapshot=collectFacebookPlaybackSnapshot();
                if((postCookieSnapshot.readyVideoCount||0)<=0){
                  emitFacebookPlaybackPhase('facebook-after-cookie-cleanup', {
                    cookieClicked:!!cookieClicked,
                    cleanupHiddenAny:!!cookieClicked,
                    wakeAttempted:false,
                    playbackWaiting:true,
                    playbackWaitingReason:'source-not-attached-after-cookie'
                  });
                  return;
                }
                var loginDismissed=clickLoginDismiss();
                var loginHidden=loginDismissed?false:hideLoginDialog();
                var bottomLoginHidden=hideBottomLoginRail();
                emitFacebookPlaybackPhase('facebook-after-login-cleanup', {
                  cookieClicked:!!cookieClicked,
                  loginDismissed:!!loginDismissed,
                  loginDialogHidden:!!loginHidden,
                  bottomLoginBarHidden:!!bottomLoginHidden,
                  cleanupHiddenAny:!!(cookieClicked||loginDismissed||loginHidden||bottomLoginHidden),
                  wakeAttempted:false
                });
                emitFacebookPlaybackPhase('facebook-before-wake', {
                  cookieClicked:!!cookieClicked,
                  loginDismissed:!!loginDismissed,
                  loginDialogHidden:!!loginHidden,
                  bottomLoginBarHidden:!!bottomLoginHidden,
                  cleanupHiddenAny:!!(cookieClicked||loginDismissed||loginHidden||bottomLoginHidden),
                  wakeAttempted:false
                });
                var videoWake=wakeFacebookVideo();
                emitFacebookPlaybackPhase('facebook-after-wake', {
                  cookieClicked:!!cookieClicked,
                  loginDismissed:!!loginDismissed,
                  loginDialogHidden:!!loginHidden,
                  bottomLoginBarHidden:!!bottomLoginHidden,
                  cleanupHiddenAny:!!(cookieClicked||loginDismissed||loginHidden||bottomLoginHidden),
                  wakeAttempted:true,
                  playButtonFound:!!videoWake.playButtonFound,
                  playButtonClicked:!!videoWake.playButtonClicked,
                  videoPlayAttempted:!!videoWake.playAttempted,
                  wakeAllowed:!!videoWake.wakeAllowed,
                  playbackDeferred:!!videoWake.playbackDeferred,
                  playbackDeferredReason:videoWake.playbackDeferredReason||''
                });
                setTimeout(function(){
                  emitFacebookPlaybackPhase('facebook-delayed-sample-1200', {
                    cookieClicked:!!cookieClicked,
                    loginDismissed:!!loginDismissed,
                    loginDialogHidden:!!loginHidden,
                    bottomLoginBarHidden:!!bottomLoginHidden,
                    cleanupHiddenAny:!!(cookieClicked||loginDismissed||loginHidden||bottomLoginHidden),
                    wakeAttempted:false,
                    playButtonFound:!!videoWake.playButtonFound,
                    playButtonClicked:!!videoWake.playButtonClicked,
                    videoPlayAttempted:!!videoWake.playAttempted,
                    wakeAllowed:!!videoWake.wakeAllowed,
                    playbackDeferred:!!videoWake.playbackDeferred,
                    playbackDeferredReason:videoWake.playbackDeferredReason||''
                  });
},1200);
                }
                window.prompt("__GV_MEDIA__"+JSON.stringify({
                  type:'facebook-compat',
                  phase:'activity-facebook-simple',
                  pageUrl:window.location.href,
                  title:document.title||'',
                  cookieClicked:!!cookieClicked,
                  bottomLoginBarHidden:!!bottomLoginHidden,
                  loginDialogHidden:!!loginHidden,
                  loginDismissed:!!loginDismissed,
                  cookieClickCount:state.cookieClickCount||0,
                  loginDismissCount:state.loginDismissCount||0,
                  loginHideCount:state.loginHideCount||0,
                  videoCount:videoWake.videoCount||0,
                  videoPlayAttempted:!!videoWake.playAttempted,
                  playButtonClicked:!!videoWake.playButtonClicked,
                  videoStates:videoWake.states||[],
                  sampleCandidates:samples
                }), '');
              }catch(_){}
            })();
        """.trimIndent()
        GvLogger.i(
            "GvExt",
            "facebook simple compat dispatched tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} url=$normalizedUrl"
        )
        session.loadUri(script)
    }

    private fun scheduleFacebookCompatFollowUp(session: GeckoSession, delayMs: Long) {
        pointerHandler.postDelayed(
            {
                if (isFinishing || isDestroyed) {
                    return@postDelayed
                }
                val tab = tabController.findTabBySession(session) ?: return@postDelayed
                val currentTabUrl = tab.url
                if (!isFacebookUrl(currentTabUrl)) {
                    return@postDelayed
                }
                maybeDispatchFacebookCompat(session, currentTabUrl, reason = "follow-up-$delayMs")
                GvLogger.i(
                    "GvExt",
                    "facebook compat follow-up dispatched tabId=${tab.id} delayMs=$delayMs url=$currentTabUrl"
                )
            },
            delayMs,
        )
    }

    private fun maybeDispatchFacebookCompat(
        session: GeckoSession,
        pageUrl: String,
        reason: String,
    ) {
        if (!isFacebookUrl(pageUrl) || isFacebookRegDialogUrl(pageUrl)) {
            return
        }
        if (facebookCompatResolvedBySession.contains(session)) {
            return
        }
        val now = SystemClock.uptimeMillis()
        val lastDispatch = facebookCompatLastDispatchMsBySession[session] ?: 0L
        if (now - lastDispatch < FACEBOOK_COMPAT_DISPATCH_MIN_INTERVAL_MS) {
            return
        }
        facebookCompatLastDispatchMsBySession[session] = now
        triggerSimpleFacebookCompat(session, pageUrl)
        if (reason == "location-change") {
            scheduleFacebookCompatFollowUp(session, 1200L)
            scheduleFacebookCompatFollowUp(session, 4500L)
            scheduleFacebookCompatFollowUp(session, 10000L)
            scheduleFacebookCompatFollowUp(session, 17000L)
        }
        GvLogger.i(
            "GvExt",
            "facebook compat dispatch tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} reason=$reason url=$pageUrl"
        )
    }

    private fun maybeDispatchFacebookPlaybackDiagnostics(
        session: GeckoSession,
        pageUrl: String,
        reason: String,
        videoCount: Int,
        playButtonClicked: Boolean,
        videoPlayAttempted: Boolean,
    ) {
        if (!isFacebookUrl(pageUrl)) {
            return
        }
        if (videoCount <= 0 && !playButtonClicked && !videoPlayAttempted) {
            return
        }
        val now = SystemClock.uptimeMillis()
        val lastDispatch = facebookPlaybackDiagLastDispatchMsBySession[session] ?: 0L
        if (now - lastDispatch < 2500L) {
            return
        }
        facebookPlaybackDiagLastDispatchMsBySession[session] = now
        facebookPlaybackDiagBaselineCurrentTimeBySession.remove(session)
        facebookPlaybackDiagBaselineMediaStateBySession.remove(session)
        val script = """
            javascript:(function(){
              try{
                var visible=function(node){
                  try{
                    if(!node){return false;}
                    var style=window.getComputedStyle(node);
                    if(style&&(style.display==='none'||style.visibility==='hidden'||style.opacity==='0')){return false;}
                    var rect=node.getBoundingClientRect();
                    return rect.width>8&&rect.height>8&&rect.bottom>0&&rect.right>0&&rect.top<window.innerHeight&&rect.left<window.innerWidth;
                  }catch(_){return false;}
                };
                var srcHost=function(src){
                  try{return (new URL(src, window.location.href)).host || '';}
                  catch(_){return '';}
                };
                var collect=function(){
                  var videos=Array.from(document.querySelectorAll('video')).slice(0,8);
                  var visibleVideos=[];
                  for(var i=0;i<videos.length;i++){
                    var video=videos[i];
                    if(!visible(video)){continue;}
                    var currentSrc=video.currentSrc||video.src||'';
                    visibleVideos.push({
                      index:i,
                      paused:!!video.paused,
                      ended:!!video.ended,
                      currentTime:(typeof video.currentTime==='number'?video.currentTime:0),
                      duration:(typeof video.duration==='number'?video.duration:0),
                      readyState:video.readyState||0,
                      networkState:video.networkState||0,
                      muted:!!video.muted,
                      volume:(typeof video.volume==='number'?video.volume:0),
                      videoWidth:video.videoWidth||0,
                      videoHeight:video.videoHeight||0,
                      currentSrc:currentSrc,
                      currentSrcHost:srcHost(currentSrc)
                    });
                  }
                  window.prompt(${JSONObject.quote(PROMPT_PREFIX)}+JSON.stringify({
                    type:'facebook-playback-diagnostics',
                    phase:'activity-facebook-playback-sample',
                    pageUrl:window.location.href,
                    reason:${JSONObject.quote(reason)},
                    sampleIndex:sampleIndex,
                    videos:visibleVideos
                  }), '');
                };
                var sampleIndex=0;
                collect();
                setTimeout(function(){sampleIndex=1;collect();},1200);
              }catch(_){ }
            })();
        """.trimIndent()
        GvLogger.i(
            "GvExt",
            "facebook playback diagnostics dispatched tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} reason=$reason url=$pageUrl videoCount=$videoCount playButtonClicked=$playButtonClicked videoPlayAttempted=$videoPlayAttempted"
        )
        session.loadUri(script)
    }

    private fun cancelFacebookVideoHelperPending(session: GeckoSession) {
        facebookVideoHelperPendingRunnableBySession.remove(session)?.also { pointerHandler.removeCallbacks(it) }
    }

    private fun currentFacebookVideoHelperStage(session: GeckoSession): String {
        return facebookVideoHelperStageBySession[session] ?: FACEBOOK_VIDEO_HELPER_STAGE_SOUND
    }

    private fun postFacebookVideoHelperPending(
        session: GeckoSession,
        delayMs: Long,
        runnable: Runnable,
    ) {
        cancelFacebookVideoHelperPending(session)
        facebookVideoHelperPendingRunnableBySession[session] = runnable
        pointerHandler.postDelayed(runnable, delayMs.coerceAtLeast(0L))
    }

    private fun markFacebookVideoHelperSequenceComplete(session: GeckoSession, pageUrl: String) {
        facebookVideoHelperStageBySession[session] = FACEBOOK_VIDEO_HELPER_STAGE_SEQUENCE_COMPLETE
        cancelFacebookVideoHelperPending(session)
        logFacebookVideoHelperSequenceState(session, pageUrl)
    }

    private fun logFacebookVideoHelperSequenceState(session: GeckoSession, pageUrl: String) {
        val normalizedUrl = normalizeFacebookPassiveReentryUrl(pageUrl).ifBlank { pageUrl }
        GvLogger.i(
            "GvInput",
            "facebook-video-helper sequence-state url=$normalizedUrl stage=${currentFacebookVideoHelperStage(session)} muteTaps=${facebookVideoHelperMuteTapCountBySession[session] ?: 0} volumeBoosts=${facebookVideoHelperVolumeBoostCountBySession[session] ?: 0} fullscreenTaps=${facebookVideoHelperFullscreenTapCountBySession[session] ?: 0} hoverCount=${facebookVideoHelperControlsHoverCountBySession[session] ?: 0} callbackChecks=${facebookVideoHelperFullscreenCheckCountBySession[session] ?: 0}"
        )
    }

    private fun clearFacebookVideoHelperTracking(session: GeckoSession) {
        cancelFacebookVideoHelperPending(session)
        facebookVideoHelperTrackedUrlBySession.remove(session)
        facebookVideoHelperAttemptCountBySession.remove(session)
        facebookVideoHelperLastAttemptAtBySession.remove(session)
        facebookVideoHelperMuteTapCountBySession.remove(session)
        facebookVideoHelperVolumeBoostCountBySession.remove(session)
        facebookVideoHelperFullscreenTapCountBySession.remove(session)
        facebookVideoHelperControlsHoverCountBySession.remove(session)
        facebookVideoHelperFullscreenCheckCountBySession.remove(session)
        facebookVideoHelperStageBySession.remove(session)
        facebookVideoHelperLastFullscreenTargetXBySession.remove(session)
        facebookVideoHelperLastFullscreenTargetYBySession.remove(session)
    }

    private fun scheduleFacebookVideoHelperFullscreenCheck(
        session: GeckoSession,
        pageUrl: String,
    ) {
        val normalizedUrl = normalizeFacebookPassiveReentryUrl(pageUrl)
        val runnable = Runnable {
            if (isFinishing || isDestroyed) return@Runnable
            facebookVideoHelperPendingRunnableBySession.remove(session)
            val tab = tabController.findTabBySession(session) ?: return@Runnable
            val activeUrl = tab.url
            if (normalizeFacebookPassiveReentryUrl(activeUrl) != normalizedUrl) {
                return@Runnable
            }
            val nextCheckAttempt = (facebookVideoHelperFullscreenCheckCountBySession[session] ?: 0) + 1
            facebookVideoHelperFullscreenCheckCountBySession[session] = nextCheckAttempt
            if (browserFullscreenStateBySession[session] == true) {
                markFacebookVideoHelperSequenceComplete(session, activeUrl)
                GvLogger.i(
                    "GvInput",
                    "facebook-video-helper fullscreen-check result=entered attempt=$nextCheckAttempt pageUrl=$activeUrl"
                )
                GvLogger.i("GvInput", "facebook-video-helper skipped reason=sequence-complete pageUrl=$activeUrl")
                return@Runnable
            }
            GvLogger.i(
                "GvInput",
                "facebook-video-helper fullscreen-check result=not-entered attempt=$nextCheckAttempt pageUrl=$activeUrl"
            )
            val retryX = facebookVideoHelperLastFullscreenTargetXBySession[session]
            val retryY = facebookVideoHelperLastFullscreenTargetYBySession[session]
            val retryAvailable =
                (facebookVideoHelperFullscreenTapCountBySession[session] ?: 0) < FACEBOOK_VIDEO_HELPER_MAX_FULLSCREEN_TAPS_PER_URL &&
                    nextCheckAttempt < FACEBOOK_VIDEO_HELPER_MAX_FULLSCREEN_CALLBACK_CHECKS_PER_URL &&
                    retryX != null &&
                    retryY != null
            if (!retryAvailable) {
                markFacebookVideoHelperSequenceComplete(session, activeUrl)
                GvLogger.i("GvInput", "facebook-video-helper skipped reason=fullscreen-retry-budget pageUrl=$activeUrl")
                return@Runnable
            }
            GvLogger.i(
                "GvInput",
                "facebook-video-helper fullscreen-retry reason=no-callback pageUrl=$activeUrl attempt=${(facebookVideoHelperFullscreenTapCountBySession[session] ?: 0) + 1}"
            )
            scheduleFacebookVideoHelperFullscreenAttempt(
                session = session,
                pageUrl = activeUrl,
                mappedX = retryX,
                mappedY = retryY,
                source = "coordinate-controlbar-fullscreen",
                label = "stored-controlbar-coordinate",
                rect = "stored-controlbar-coordinate",
                viewportWidth = 0,
                viewportHeight = 0,
                attempt = (facebookVideoHelperAttemptCountBySession[session] ?: 0).coerceAtLeast(1),
            )
        }
        postFacebookVideoHelperPending(session, FACEBOOK_VIDEO_HELPER_FULLSCREEN_CHECK_DELAY_MS, runnable)
    }

    private fun scheduleFacebookVideoHelperFullscreenAttempt(
        session: GeckoSession,
        pageUrl: String,
        mappedX: Float,
        mappedY: Float,
        source: String,
        label: String,
        rect: String,
        viewportWidth: Int,
        viewportHeight: Int,
        attempt: Int,
    ) {
        val normalizedUrl = normalizeFacebookPassiveReentryUrl(pageUrl)
        facebookVideoHelperStageBySession[session] = FACEBOOK_VIDEO_HELPER_STAGE_FULLSCREEN_PENDING
        GvLogger.i(
            "GvInput",
            "facebook-video-helper fullscreen-target measured source=$source x=${mappedX.toInt()} y=${mappedY.toInt()} label=$label rect=$rect viewport=${viewportWidth}x${viewportHeight} attempt=$attempt"
        )
        val currentHoverCount = facebookVideoHelperControlsHoverCountBySession[session] ?: 0
        if (currentHoverCount >= FACEBOOK_VIDEO_HELPER_MAX_CONTROLS_HOVER_ATTEMPTS_PER_URL) {
            markFacebookVideoHelperSequenceComplete(session, pageUrl)
            GvLogger.i("GvInput", "facebook-video-helper skipped reason=hover-budget pageUrl=$pageUrl attempt=$attempt")
            return
        }
        facebookVideoHelperControlsHoverCountBySession[session] = currentHoverCount + 1
        logFacebookVideoHelperSequenceState(session, pageUrl)
        val hoverHandled = dispatchNativeMouseHoverAt(mappedX, mappedY, "facebook-video-helper-fullscreen-reveal")
        GvLogger.i(
            "GvInput",
            "facebook-video-helper controls-hover x=${mappedX.toInt()} y=${mappedY.toInt()} handled=$hoverHandled pageUrl=$pageUrl attempt=$attempt"
        )
        val runnable = Runnable {
            if (isFinishing || isDestroyed) return@Runnable
            facebookVideoHelperPendingRunnableBySession.remove(session)
            val tab = tabController.findTabBySession(session) ?: return@Runnable
            val activeUrl = tab.url
            if (normalizeFacebookPassiveReentryUrl(activeUrl) != normalizedUrl) {
                return@Runnable
            }
            if (browserFullscreenStateBySession[session] == true) {
                markFacebookVideoHelperSequenceComplete(session, activeUrl)
                GvLogger.i("GvInput", "facebook-video-helper skipped reason=sequence-complete pageUrl=$activeUrl")
                return@Runnable
            }
            val nextTapCount = (facebookVideoHelperFullscreenTapCountBySession[session] ?: 0) + 1
            if (nextTapCount > FACEBOOK_VIDEO_HELPER_MAX_FULLSCREEN_TAPS_PER_URL) {
                markFacebookVideoHelperSequenceComplete(session, activeUrl)
                GvLogger.i("GvInput", "facebook-video-helper skipped reason=fullscreen-retry-budget pageUrl=$activeUrl")
                return@Runnable
            }
            facebookVideoHelperFullscreenTapCountBySession[session] = nextTapCount
            logFacebookVideoHelperSequenceState(session, activeUrl)
            val handled = dispatchNativeMouseTapAt(mappedX, mappedY, "facebook-video-helper-fullscreen")
            GvLogger.i(
                "GvInput",
                "facebook-video-helper fullscreen-tap x=${mappedX.toInt()} y=${mappedY.toInt()} handled=$handled pageUrl=$activeUrl attempt=$attempt"
            )
            scheduleFacebookVideoHelperFullscreenCheck(session, activeUrl)
        }
        postFacebookVideoHelperPending(session, FACEBOOK_VIDEO_HELPER_FULLSCREEN_HOVER_SETTLE_DELAY_MS, runnable)
    }

    private fun maybeScheduleFacebookVideoHelperFromPayload(
        session: GeckoSession,
        pageUrl: String,
        payload: JSONObject,
        reason: String,
        delayMs: Long = 0L,
        bypassCooldown: Boolean = false,
    ) {
        if (!isFacebookUrl(pageUrl) || !isFacebookWatchOrVideoPageUrl(pageUrl)) {
            return
        }
        val states = payload.optJSONArray("videoStates")
        var firstVisible: JSONObject? = null
        var visibleCount = 0
        for (index in 0 until (states?.length() ?: 0)) {
            val state = states?.optJSONObject(index) ?: continue
            if (!state.optBoolean("visible")) continue
            visibleCount += 1
            if (firstVisible == null) {
                firstVisible = state
            }
        }
        if (visibleCount <= 0) {
            return
        }
        val currentSrc = firstVisible?.optString("currentSrc").orEmpty()
        val readyState = firstVisible?.optInt("readyState") ?: 0
        val width = firstVisible?.optInt("videoWidth") ?: 0
        val height = firstVisible?.optInt("videoHeight") ?: 0
        val currentTime = firstVisible?.optDouble("currentTime") ?: 0.0
        val ready = currentSrc.isNotBlank() || readyState >= 1 || width > 0 || height > 0 || currentTime > 0.15
        if (!ready) {
            return
        }
        maybeScheduleFacebookVideoHelper(
            session = session,
            pageUrl = pageUrl,
            reason = reason,
            delayMs = delayMs,
            bypassCooldown = bypassCooldown,
        )
    }

    private fun maybeScheduleFacebookVideoHelper(
        session: GeckoSession,
        pageUrl: String,
        reason: String,
        delayMs: Long = 0L,
        bypassCooldown: Boolean = false,
    ) {
        if (!isFacebookUrl(pageUrl) || !isFacebookWatchOrVideoPageUrl(pageUrl)) {
            return
        }
        if (promotedMediaPlayer.isPromoted()) {
            return
        }
        val normalizedUrl = normalizeFacebookPassiveReentryUrl(pageUrl)
        val trackedUrl = facebookVideoHelperTrackedUrlBySession[session]
        if (trackedUrl != normalizedUrl) {
            facebookVideoHelperTrackedUrlBySession[session] = normalizedUrl
            facebookVideoHelperAttemptCountBySession[session] = 0
            facebookVideoHelperLastAttemptAtBySession.remove(session)
            facebookVideoHelperMuteTapCountBySession[session] = 0
            facebookVideoHelperVolumeBoostCountBySession[session] = 0
            facebookVideoHelperFullscreenTapCountBySession[session] = 0
            facebookVideoHelperControlsHoverCountBySession[session] = 0
            facebookVideoHelperFullscreenCheckCountBySession[session] = 0
            facebookVideoHelperStageBySession[session] = FACEBOOK_VIDEO_HELPER_STAGE_SOUND
            facebookVideoHelperLastFullscreenTargetXBySession.remove(session)
            facebookVideoHelperLastFullscreenTargetYBySession.remove(session)
        }
        logFacebookVideoHelperSequenceState(session, normalizedUrl)
        if (browserFullscreenStateBySession[session] == true || currentFacebookVideoHelperStage(session) == FACEBOOK_VIDEO_HELPER_STAGE_SEQUENCE_COMPLETE) {
            markFacebookVideoHelperSequenceComplete(session, normalizedUrl)
            GvLogger.i("GvInput", "facebook-video-helper skipped reason=sequence-complete pageUrl=$normalizedUrl")
            return
        }
        if (currentFacebookVideoHelperStage(session) == FACEBOOK_VIDEO_HELPER_STAGE_FULLSCREEN_PENDING) {
            GvLogger.i("GvInput", "facebook-video-helper skipped reason=fullscreen-pending pageUrl=$normalizedUrl")
            return
        }
        val fullscreenTapCount = facebookVideoHelperFullscreenTapCountBySession[session] ?: 0
        if (fullscreenTapCount >= FACEBOOK_VIDEO_HELPER_MAX_FULLSCREEN_TAPS_PER_URL) {
            markFacebookVideoHelperSequenceComplete(session, normalizedUrl)
            GvLogger.i("GvInput", "facebook-video-helper skipped reason=fullscreen-retry-budget pageUrl=$normalizedUrl")
            return
        }
        val attemptCount = facebookVideoHelperAttemptCountBySession[session] ?: 0
        if (attemptCount >= FACEBOOK_VIDEO_HELPER_MAX_ATTEMPTS_PER_URL) {
            GvLogger.i(
                "GvInput",
                "facebook-video-helper skipped reason=attempt-budget pageUrl=$pageUrl attempts=$attemptCount/$FACEBOOK_VIDEO_HELPER_MAX_ATTEMPTS_PER_URL"
            )
            return
        }
        val now = SystemClock.uptimeMillis()
        val lastAttemptAt = facebookVideoHelperLastAttemptAtBySession[session] ?: 0L
        if (!bypassCooldown && now - lastAttemptAt < FACEBOOK_VIDEO_HELPER_COOLDOWN_MS) {
            return
        }
        if (!bypassCooldown && facebookVideoHelperPendingRunnableBySession.containsKey(session)) {
            return
        }
        val runnable = Runnable {
            if (isFinishing || isDestroyed) return@Runnable
            facebookVideoHelperPendingRunnableBySession.remove(session)
            val tab = tabController.findTabBySession(session) ?: return@Runnable
            val activeUrl = tab.url
            if (normalizeFacebookPassiveReentryUrl(activeUrl) != normalizedUrl) {
                return@Runnable
            }
            if (!isFacebookUrl(activeUrl) || !isFacebookWatchOrVideoPageUrl(activeUrl) || promotedMediaPlayer.isPromoted()) {
                return@Runnable
            }
            if (browserFullscreenStateBySession[session] == true || currentFacebookVideoHelperStage(session) == FACEBOOK_VIDEO_HELPER_STAGE_SEQUENCE_COMPLETE) {
                markFacebookVideoHelperSequenceComplete(session, activeUrl)
                GvLogger.i("GvInput", "facebook-video-helper skipped reason=sequence-complete pageUrl=$activeUrl")
                return@Runnable
            }
            if (currentFacebookVideoHelperStage(session) == FACEBOOK_VIDEO_HELPER_STAGE_FULLSCREEN_PENDING) {
                logFacebookVideoHelperSequenceState(session, activeUrl)
                GvLogger.i("GvInput", "facebook-video-helper skipped reason=fullscreen-pending pageUrl=$activeUrl")
                return@Runnable
            }
            if ((facebookVideoHelperFullscreenTapCountBySession[session] ?: 0) >= FACEBOOK_VIDEO_HELPER_MAX_FULLSCREEN_TAPS_PER_URL) {
                markFacebookVideoHelperSequenceComplete(session, activeUrl)
                GvLogger.i("GvInput", "facebook-video-helper skipped reason=fullscreen-retry-budget pageUrl=$activeUrl")
                return@Runnable
            }
            val nextAttempt = (facebookVideoHelperAttemptCountBySession[session] ?: 0) + 1
            facebookVideoHelperAttemptCountBySession[session] = nextAttempt
            facebookVideoHelperLastAttemptAtBySession[session] = SystemClock.uptimeMillis()
            dispatchFacebookVideoHelperProbe(
                session = session,
                pageUrl = activeUrl,
                reason = reason,
                attempt = nextAttempt,
            )
        }
        postFacebookVideoHelperPending(session, delayMs, runnable)
        GvLogger.i(
            "GvInput",
            "facebook-video-helper scheduled reason=$reason delayMs=${delayMs.coerceAtLeast(0L)} pageUrl=$pageUrl attempt=${attemptCount + 1}/$FACEBOOK_VIDEO_HELPER_MAX_ATTEMPTS_PER_URL"
        )
    }

    private fun dispatchFacebookVideoHelperProbe(
        session: GeckoSession,
        pageUrl: String,
        reason: String,
        attempt: Int,
    ) {
        val script = """
            javascript:(function(){
              try{
                var visible=function(node){
                  try{
                    if(!node){return false;}
                    var style=window.getComputedStyle(node);
                    if(style&&(style.display==='none'||style.visibility==='hidden'||style.opacity==='0')){return false;}
                    var rect=node.getBoundingClientRect();
                    return rect.width>12&&rect.height>12&&rect.bottom>0&&rect.right>0&&rect.top<window.innerHeight&&rect.left<window.innerWidth;
                  }catch(_){return false;}
                };
                var visibleSized=function(node,minW,minH){
                  try{
                    if(!node){return false;}
                    var style=window.getComputedStyle(node);
                    if(style&&(style.display==='none'||style.visibility==='hidden'||style.opacity==='0')){return false;}
                    var rect=node.getBoundingClientRect();
                    return rect.width>(minW||8)&&rect.height>(minH||8)&&rect.bottom>0&&rect.right>0&&rect.top<window.innerHeight&&rect.left<window.innerWidth;
                  }catch(_){return false;}
                };
                var rectOf=function(node){
                  try{
                    if(!node){return null;}
                    var r=node.getBoundingClientRect();
                    return {left:Math.round(r.left),top:Math.round(r.top),right:Math.round(r.right),bottom:Math.round(r.bottom),width:Math.round(r.width),height:Math.round(r.height)};
                  }catch(_){return null;}
                };
                var textBlob=function(node){
                  try{
                    if(!node){return '';}
                    return (((node.innerText||node.textContent||'')+' '+((node.getAttribute&&node.getAttribute('aria-label'))||'')+' '+((node.getAttribute&&node.getAttribute('title'))||'')+' '+((node.getAttribute&&node.getAttribute('data-testid'))||'')+' '+((typeof node.className==='string')?node.className:''))).replace(/\s+/g,' ').trim();
                  }catch(_){return '';}
                };
                var lowerBlob=function(node){return textBlob(node).toLowerCase();};
                var clip=function(v,n){
                  try{
                    var s=((v||'')+'').replace(/\s+/g,' ').trim();
                    return s.length>(n||96)?s.slice(0,n||96):s;
                  }catch(_){return '';}
                };
                var summarizeNode=function(node){
                  try{
                    if(!node){return 'none';}
                    var tag=((node.tagName||'')+'').toLowerCase();
                    var role=clip((node.getAttribute&&node.getAttribute('role'))||'',20);
                    var aria=clip((node.getAttribute&&node.getAttribute('aria-label'))||'',48);
                    var title=clip((node.getAttribute&&node.getAttribute('title'))||'',48);
                    var testid=clip((node.getAttribute&&node.getAttribute('data-testid'))||'',36);
                    var cls=clip(((typeof node.className==='string')?node.className:''),48).replace(/\s+/g,'.');
                    var rect=rectOf(node);
                    var rectSummary=rect?([rect.left,rect.top,rect.width,rect.height].join(',')):'none';
                    return tag+
                      (role?('@'+role):'')+
                      (aria?('[a='+aria+']'):'')+
                      (title?('[t='+title+']'):'')+
                      (testid?('[id='+testid+']'):'')+
                      (cls?('.'+cls):'')+
                      '@'+rectSummary;
                  }catch(_){return 'node-error';}
                };
                var elementsSummaryAt=function(x,y){
                  try{
                    var list=Array.from(document.elementsFromPoint(x,y)||[]).slice(0,5);
                    var out=[];
                    for(var i=0;i<list.length;i++){out.push(summarizeNode(list[i]));}
                    return out;
                  }catch(_){return [];}
                };
                var hardRejectTerms=['create new account','create account','log in','login','sign up','signup','join facebook','unmute','mute','volume','change volume','audio','sound','speaker','share','comment','reaction','like','menu','more','close','follow','save','report'];
                var criticalRejectTerms=['create new account','create account','log in','login','sign up','signup','join facebook','share','comment','reaction','like','menu','more','close','follow','save','report'];
                var hasRejectTerm=function(blob){
                  if(!blob){return '';}
                  for(var i=0;i<hardRejectTerms.length;i++){
                    if(blob.indexOf(hardRejectTerms[i])>=0){return hardRejectTerms[i];}
                  }
                  return '';
                };
                var hasCriticalRejectTerm=function(blob){
                  if(!blob){return '';}
                  for(var i=0;i<criticalRejectTerms.length;i++){
                    if(blob.indexOf(criticalRejectTerms[i])>=0){return criticalRejectTerms[i];}
                  }
                  return '';
                };
                var isRejectedBlob=function(blob){
                  return hasRejectTerm(blob)!=='';
                };
                var isStrongUnmuteBlob=function(blob){
                  if(!blob){return false;}
                  return blob.indexOf('unmute')>=0||
                    blob.indexOf('turn on sound')>=0||
                    blob.indexOf('sound on')>=0||
                    blob.indexOf('audio on')>=0||
                    blob.indexOf('muted')>=0||
                    blob.indexOf('speaker off')>=0;
                };
                var zoneMatch=function(cx,cy,videoRect,zone){
                  if(!videoRect){return false;}
                  var inBounds=(cx>=videoRect.left-100&&cx<=videoRect.right+120&&cy>=videoRect.top-90&&cy<=videoRect.bottom+120);
                  if(!inBounds){return false;}
                  if(zone==='lower-right'){
                    return cx>=videoRect.left+(videoRect.width*0.62)&&cy>=videoRect.top+(videoRect.height*0.58);
                  }
                  if(zone==='lower-left'){
                    return cx<=videoRect.left+(videoRect.width*0.42)&&cy>=videoRect.top+(videoRect.height*0.58);
                  }
                  if(zone==='controlbar'){
                    return cy>=videoRect.top+(videoRect.height*0.70);
                  }
                  return true;
                };
                var zoneName=function(cx,videoRect){
                  if(cx>=videoRect.left+(videoRect.width*0.92)){return 'far-right';}
                  if(cx>=videoRect.left+(videoRect.width*0.72)){return 'lower-right';}
                  if(cx<=videoRect.left+(videoRect.width*0.28)){return 'lower-left';}
                  return 'lower-center';
                };
                var asCandidate=function(node,zone,videoRect,preferAudio){
                  try{
                    if(!node){return null;}
                    var climb=node;
                    var depth=0;
                    while(climb&&depth<7){
                      if(visibleSized(climb,8,8)){
                        var rr=climb.getBoundingClientRect();
                        var cx=(rr.left+rr.right)/2;
                        var cy=(rr.top+rr.bottom)/2;
                        if(zoneMatch(cx,cy,videoRect,zone)){
                          var tag=((climb.tagName||'')+'').toLowerCase();
                          var role=((climb.getAttribute&&climb.getAttribute('role'))||'').toLowerCase();
                           var aria=((climb.getAttribute&&climb.getAttribute('aria-label'))||'');
                           var title=((climb.getAttribute&&climb.getAttribute('title'))||'');
                           var testid=((climb.getAttribute&&climb.getAttribute('data-testid'))||'');
                           var tabindex=((climb.getAttribute&&climb.getAttribute('tabindex'))||'');
                           var cls=((typeof climb.className==='string')?climb.className:'');
                           var blob=(lowerBlob(climb)+' '+(aria||'').toLowerCase()+' '+(title||'').toLowerCase()+' '+(testid||'').toLowerCase()+' '+(cls||'').toLowerCase()).replace(/\s+/g,' ').trim();
                           var audioIntent=isStrongUnmuteBlob(blob);
                           if(preferAudio){
                             if(!audioIntent){depth++;climb=climb.parentElement;continue;}
                             if(hasCriticalRejectTerm(blob)){depth++;climb=climb.parentElement;continue;}
                           }else if(isRejectedBlob(blob)){depth++;climb=climb.parentElement;continue;}
                           var fullscreenIntent=(blob.indexOf('full screen')>=0||blob.indexOf('fullscreen')>=0||blob.indexOf('expand')>=0||blob.indexOf('maximize')>=0);
                           if(zone==='lower-right'&&!fullscreenIntent&&!preferAudio){depth++;climb=climb.parentElement;continue;}
                           var clickable=(tag==='button'||role==='button'||role==='link'||(tag==='a'&&!!(climb.getAttribute&&climb.getAttribute('href')))||
                             (!!tabindex&&tabindex!=='-1')||(aria||'').length>0||(title||'').length>0||(testid||'').length>0||
                             ((window.getComputedStyle(climb).cursor||'').toLowerCase().indexOf('pointer')>=0));
                          if(!clickable){depth++;climb=climb.parentElement;continue;}
                          if(rr.width<10||rr.height<10||rr.width>260||rr.height>180){depth++;climb=climb.parentElement;continue;}
                           var score=0;
                           if(zone==='lower-right'){score+=120;}
                           if(zone==='lower-left'){score+=115;}
                           if(fullscreenIntent){score+=220;}
                           if(audioIntent){score+=260;}
                           if(blob.indexOf('skip')>=0&&blob.indexOf('ad')>=0){score-=260;}
                           if(blob.indexOf('theater')>=0||blob.indexOf('mini')>=0||blob.indexOf('picture')>=0||blob.indexOf('pip')>=0){score-=150;}
                           if(zone==='lower-right'&&cx>=videoRect.left+(videoRect.width*0.80)){score+=60;}
                           if(zone==='lower-left'&&cx<=videoRect.left+(videoRect.width*0.18)){score+=60;}
                           if(cy>=videoRect.top+(videoRect.height*0.78)){score+=40;}
                           if(!fullscreenIntent&&zone==='lower-right'){
                             if(rr.width<=96&&rr.height<=96){score+=55;}
                           }
                          if((blob.indexOf('mute')<0&&blob.indexOf('unmute')<0&&blob.indexOf('volume')<0&&blob.indexOf('audio')<0&&blob.indexOf('sound')<0&&blob.indexOf('speaker')<0)&&zone==='lower-left'){
                            if(preferAudio&&rr.width<=96&&rr.height<=96){score+=45;}else{score-=120;}
                          }
                          var label=clip(textBlob(climb),80);
                          return {
                            node:climb,
                            score:score,
                            cx:Math.round(cx),
                            cy:Math.round(cy),
                            rect:[Math.round(rr.left),Math.round(rr.top),Math.round(rr.width),Math.round(rr.height)].join(','),
                            label:label,
                            summary:summarizeNode(climb)
                          };
                        }
                      }
                      depth++;
                      climb=climb.parentElement;
                    }
                    return null;
                  }catch(_){return null;}
                };
                var findClickableFromPoint=function(x,y,zone,videoRect,preferAudio){
                  var out={best:null,summaries:[]};
                  try{
                    var nodes=Array.from(document.elementsFromPoint(x,y)||[]).slice(0,8);
                    var seen=new Set();
                    for(var i=0;i<nodes.length;i++){
                      var cand=asCandidate(nodes[i],zone,videoRect,preferAudio);
                      if(!cand){continue;}
                      var key=(cand.rect||'')+'|'+(cand.label||'');
                      if(!seen.has(key)){
                        seen.add(key);
                        if(out.summaries.length<5){out.summaries.push(cand.summary);}
                      }
                      if(!out.best||cand.score>out.best.score){out.best=cand;}
                    }
                  }catch(_){}
                  return out;
                };
                var buildControlbarCandidates=function(videoRect){
                  var out=[];
                  try{
                    var fx=[0.10,0.18,0.26,0.34,0.42,0.50,0.58,0.66,0.74,0.82,0.90,0.96];
                    var fy=[0.74,0.82,0.90];
                    var seen=new Set();
                    for(var xi=0;xi<fx.length;xi++){
                      for(var yi=0;yi<fy.length;yi++){
                        var px=Math.round(videoRect.left+Math.max(12,Math.min(videoRect.width-12,videoRect.width*fx[xi])));
                        var py=Math.round(videoRect.top+Math.max(12,Math.min(videoRect.height-12,videoRect.height*fy[yi])));
                        var stack=Array.from(document.elementsFromPoint(px,py)||[]).slice(0,6);
                        for(var si=0;si<stack.length;si++){
                          var cand=asCandidate(stack[si],'controlbar',videoRect,false);
                          if(!cand){continue;}
                          var blob=(cand.label||'').toLowerCase();
                          var reject=hasRejectTerm(blob);
                          var key=(cand.rect||'')+'|'+(cand.label||'');
                          if(seen.has(key)){continue;}
                          seen.add(key);
                          var rectParts=(cand.rect||'0,0,0,0').split(',');
                          var cw=Number(rectParts[2]||0);
                          var ch=Number(rectParts[3]||0);
                          var zone=zoneName(cand.cx,videoRect);
                          var summary='x='+cand.cx+' y='+cand.cy+' rect='+cand.rect+' zone='+zone+' label='+clip(cand.label,54)+' reject='+(reject||'none');
                          out.push({
                            x:cand.cx,y:cand.cy,rect:cand.rect,label:cand.label,blob:blob,zone:zone,width:cw,height:ch,reject:reject,summary:summary
                          });
                        }
                      }
                    }
                  }catch(_){}
                  return out;
                };
                var videos=Array.from(document.querySelectorAll('video')).filter(visible);
                var primaryVideo=null;
                var primaryArea=0;
                for(var i=0;i<videos.length;i++){
                  var vr=videos[i].getBoundingClientRect();
                  var area=Math.max(0,vr.width*vr.height);
                  if(area>primaryArea){primaryArea=area;primaryVideo=videos[i];}
                }
                var result={
                  type:'facebook-video-helper',
                  action:'probe',
                  reason:${JSONObject.quote(reason)},
                  attempt:$attempt,
                  pageUrl:window.location.href,
                  viewportWidth:Math.round(window.innerWidth||0),
                  viewportHeight:Math.round(window.innerHeight||0),
                  visualViewportWidth:Math.round((window.visualViewport&&window.visualViewport.width)||0),
                  visualViewportHeight:Math.round((window.visualViewport&&window.visualViewport.height)||0),
                  visualViewportScale:Number((window.visualViewport&&window.visualViewport.scale)||0),
                  devicePixelRatio:Number(window.devicePixelRatio||0),
                  videoFound:!!primaryVideo,
                  videoReady:false,
                  pausedBefore:true,
                  pausedAfter:true,
                  readyStateBefore:0,
                  currentTimeBefore:0,
                  videoWidthBefore:0,
                  videoHeightBefore:0,
                  mutedBefore:false,
                  defaultMutedBefore:false,
                  volumeBefore:1,
                  mutedAfter:false,
                  defaultMutedAfter:false,
                  volumeAfter:1,
                  fullscreenActive:!!(document.fullscreenElement||document.webkitFullscreenElement||document.mozFullScreenElement||document.msFullscreenElement),
                  fullscreenTargetFound:false,
                  fullscreenTargetX:-1,
                  fullscreenTargetY:-1,
                  fullscreenTargetRect:'none',
                  fullscreenTargetLabel:'',
                  fullscreenTargetReason:'no-visible-fullscreen-target',
                  muteTargetFound:false,
                  muteTargetX:-1,
                  muteTargetY:-1,
                  muteTargetRect:'none',
                  muteTargetLabel:'',
                  muteTargetReason:'no-visible-mute-target',
                  controlsRevealSuggested:false,
                  controlsRevealX:-1,
                  controlsRevealY:-1,
                  videoRect:'none',
                  controlsRevealStack:[],
                  lowerRightStack:[],
                  lowerLeftStack:[],
                  lowerRightCandidates:[],
                  lowerLeftCandidates:[],
                  controlbarCandidates:[]
                };
                if(primaryVideo){
                  result.pausedBefore=!!primaryVideo.paused;
                  result.readyStateBefore=primaryVideo.readyState||0;
                  result.currentTimeBefore=(typeof primaryVideo.currentTime==='number')?Number(primaryVideo.currentTime):0;
                  result.videoWidthBefore=primaryVideo.videoWidth||0;
                  result.videoHeightBefore=primaryVideo.videoHeight||0;
                  result.mutedBefore=!!primaryVideo.muted;
                  result.defaultMutedBefore=!!primaryVideo.defaultMuted;
                  result.volumeBefore=(typeof primaryVideo.volume==='number')?Number(primaryVideo.volume):1;
                  result.videoReady=!!(result.readyStateBefore>=1||result.videoWidthBefore>0||result.videoHeightBefore>0||result.currentTimeBefore>0.15||(primaryVideo.currentSrc||'').length>0);
                  try{primaryVideo.muted=false;}catch(_){}
                  try{primaryVideo.defaultMuted=false;}catch(_){}
                  try{if(typeof primaryVideo.volume==='number'){primaryVideo.volume=1;}}catch(_){}
                  result.mutedAfter=!!primaryVideo.muted;
                  result.defaultMutedAfter=!!primaryVideo.defaultMuted;
                  result.volumeAfter=(typeof primaryVideo.volume==='number')?Number(primaryVideo.volume):result.volumeBefore;
                  result.pausedAfter=!!primaryVideo.paused;
                  if(!result.fullscreenActive&&result.videoReady){
                    var videoRect=primaryVideo.getBoundingClientRect();
                    result.videoRect=[Math.round(videoRect.left),Math.round(videoRect.top),Math.round(videoRect.width),Math.round(videoRect.height)].join(',');
                    result.controlsRevealSuggested=true;
                    result.controlsRevealX=Math.round(videoRect.left+Math.max(20,Math.min(videoRect.width-20,videoRect.width*0.70)));
                    result.controlsRevealY=Math.round(videoRect.top+Math.max(20,Math.min(videoRect.height-20,videoRect.height*0.86)));
                    var lowerRightX=Math.round(videoRect.left+Math.max(20,Math.min(videoRect.width-20,videoRect.width*0.94)));
                    var lowerRightY=Math.round(videoRect.top+Math.max(20,Math.min(videoRect.height-20,videoRect.height*0.90)));
                    var lowerLeftX=Math.round(videoRect.left+Math.max(20,Math.min(videoRect.width-20,videoRect.width*0.08)));
                    var lowerLeftY=Math.round(videoRect.top+Math.max(20,Math.min(videoRect.height-20,videoRect.height*0.90)));
                    result.controlsRevealStack=elementsSummaryAt(result.controlsRevealX,result.controlsRevealY);
                    result.lowerRightStack=elementsSummaryAt(lowerRightX,lowerRightY);
                    result.lowerLeftStack=elementsSummaryAt(lowerLeftX,lowerLeftY);
                    var controlbarCandidates=buildControlbarCandidates(videoRect);
                    var controlbarSummaries=[];
                    for(var cb=0;cb<controlbarCandidates.length&&cb<12;cb++){controlbarSummaries.push(controlbarCandidates[cb].summary);}
                    result.controlbarCandidates=controlbarSummaries;
                    if(!result.pausedAfter&&controlbarCandidates.length>0){
                      result.fullscreenTargetFound=true;
                      result.fullscreenTargetX=Math.round(videoRect.left+(videoRect.width*0.918));
                      result.fullscreenTargetY=Math.round(videoRect.top+(videoRect.height*0.950));
                      result.fullscreenTargetRect='video-rect:'+result.videoRect;
                      result.fullscreenTargetLabel='video-rect-controlbar-coordinate';
                      result.fullscreenTargetReason='coordinate-controlbar-fullscreen';
                    }
                    var audioPointsX=[0.04,0.08,0.12,0.18,0.26,0.34,0.50,0.66,0.78,0.88,0.94,0.97];
                    var audioPointsY=[0.74,0.82,0.88,0.94];
                    var bestAudio=null;
                    var audioSummaries=[];
                    for(var ax=0;ax<audioPointsX.length;ax++){
                      for(var ay=0;ay<audioPointsY.length;ay++){
                        var apx=Math.round(videoRect.left+Math.max(12,Math.min(videoRect.width-12,videoRect.width*audioPointsX[ax])));
                        var apy=Math.round(videoRect.top+Math.max(12,Math.min(videoRect.height-12,videoRect.height*audioPointsY[ay])));
                        var ahit=findClickableFromPoint(apx,apy,'controlbar',videoRect,true);
                        for(var as=0;as<ahit.summaries.length&&audioSummaries.length<7;as++){
                          if(audioSummaries.indexOf(ahit.summaries[as])<0){audioSummaries.push(ahit.summaries[as]);}
                        }
                        if(ahit.best&&(!bestAudio||ahit.best.score>bestAudio.score)){bestAudio=ahit.best;}
                      }
                    }
                    result.lowerLeftCandidates=audioSummaries;
                    if(bestAudio){
                        result.muteTargetFound=true;
                        result.muteTargetX=bestAudio.cx;
                        result.muteTargetY=bestAudio.cy;
                        result.muteTargetRect=bestAudio.rect;
                        result.muteTargetLabel=(bestAudio.label||'').slice(0,120);
                        result.muteTargetReason='semantic-unmute-control';
                    }
                  }
                }
                window.prompt(${JSONObject.quote(PROMPT_PREFIX)}+JSON.stringify(result),'');
              }catch(error){
                try{
                  window.prompt(${JSONObject.quote(PROMPT_PREFIX)}+JSON.stringify({
                    type:'facebook-video-helper',
                    action:'error',
                    reason:String(error&&error.message||error),
                    attempt:$attempt,
                    pageUrl:window.location.href
                  }),'');
                }catch(_){}
              }
            })();
        """.trimIndent()
        session.loadUri(script)
    }

    private fun handleFacebookPlaybackDiagnostics(session: GeckoSession, payload: JSONObject) {
        val pageUrl = payload.optString("pageUrl")
        val reason = payload.optString("reason")
        val sampleIndex = payload.optInt("sampleIndex", 0)
        val videos = payload.optJSONArray("videos") ?: JSONArray()
        val mediaState = browserMediaController.describeSessionState(session)
        GvLogger.i(
            "GvLayout",
            "facebook playback sample pageUrl=$pageUrl sample=$sampleIndex reason=$reason videoCount=${videos.length()} mediaSession=$mediaState"
        )
        val baselineTimes = facebookPlaybackDiagBaselineCurrentTimeBySession.getOrPut(session) { LinkedHashMap() }
        val baselineMediaState = facebookPlaybackDiagBaselineMediaStateBySession[session]
        for (index in 0 until videos.length()) {
            val video = videos.optJSONObject(index) ?: continue
            val currentSrc = video.optString("currentSrc")
            val srcHost = video.optString("currentSrcHost")
            val key = if (currentSrc.isNotBlank()) currentSrc else "video#$index"
            val currentTime = video.optDouble("currentTime", 0.0)
            val duration = video.optDouble("duration", 0.0)
            val baselineTime = baselineTimes[key]
            val advancedLabel = if (sampleIndex == 1 && baselineTime != null) {
                val delta = currentTime - baselineTime
                " advancedFromT0=${delta > 0.05} deltaCurrentTime=${String.format(java.util.Locale.US, "%.3f", delta)}"
            } else {
                ""
            }
            GvLogger.i(
                "GvLayout",
                "facebook playback video sample=$sampleIndex index=${index + 1} paused=${video.optBoolean("paused")} ended=${video.optBoolean("ended")} currentTime=${String.format(java.util.Locale.US, "%.3f", currentTime)} duration=${String.format(java.util.Locale.US, "%.3f", duration)} readyState=${video.optInt("readyState")} networkState=${video.optInt("networkState")} muted=${video.optBoolean("muted")} volume=${String.format(java.util.Locale.US, "%.3f", video.optDouble("volume", 0.0))} videoWidth=${video.optInt("videoWidth")} videoHeight=${video.optInt("videoHeight")} currentSrcHost=${srcHost.ifBlank { "blank" }} currentSrc=${currentSrc.ifBlank { "blank" }}$advancedLabel"
            )
            if (sampleIndex == 0) {
                baselineTimes[key] = currentTime
            }
        }
        if (sampleIndex == 0) {
            facebookPlaybackDiagBaselineMediaStateBySession[session] = mediaState
            val visibleVideoCount = videos.length()
            if (visibleVideoCount > 0) {
                maybeScheduleFacebookVideoHelper(
                    session = session,
                    pageUrl = pageUrl,
                    reason = "playback-sample-0",
                    delayMs = 250L,
                )
            }
        } else if (sampleIndex == 1) {
            val changed = baselineMediaState != null && baselineMediaState != mediaState
            GvLogger.i(
                "GvMedia",
                "facebook playback media session sample pageUrl=$pageUrl reason=$reason changed=$changed before=${baselineMediaState ?: "none"} after=$mediaState"
            )
            facebookPlaybackDiagBaselineCurrentTimeBySession.remove(session)
            facebookPlaybackDiagBaselineMediaStateBySession.remove(session)
        }
    }

    private fun handleFacebookPlaybackDeferred(
        session: GeckoSession,
        pageUrl: String,
        payload: JSONObject,
    ) {
        val retryCount = facebookPlaybackDiagRetryCountBySession[session] ?: 0
        val delayMs = when (retryCount) {
            0 -> 1200L
            1 -> 4200L
            else -> null
        }
        if (delayMs == null) {
            GvLogger.i(
                "GvLayout",
                "facebook playback deferred reason=video-not-ready retryLimitReached=true pageUrl=$pageUrl"
            )
            return
        }
        facebookPlaybackDiagRetryCountBySession[session] = retryCount + 1
        GvLogger.i(
            "GvLayout",
            "facebook playback deferred reason=video-not-ready pageUrl=$pageUrl retryAttempt=${retryCount + 1}/2 delayMs=$delayMs videoStates=${payload.optJSONArray("videoStates")?.length() ?: 0}"
        )
        scheduleFacebookCompatFollowUp(session, delayMs)
    }

    private fun handleFacebookPlaybackWaiting(
        session: GeckoSession,
        pageUrl: String,
        payload: JSONObject,
    ) {
        val retryCount = facebookPlaybackWaitRetryCountBySession[session] ?: 0
        val delayMs = when (retryCount) {
            0 -> 1200L
            1 -> 4200L
            else -> null
        }
        val states = payload.optJSONArray("videoStates") ?: JSONArray()
        var visibleVideoCount = 0
        var readyVideoCount = 0
        var firstVisible: JSONObject? = null
        for (index in 0 until states.length()) {
            val state = states.optJSONObject(index) ?: continue
            if (!state.optBoolean("visible")) continue
            visibleVideoCount += 1
            if (
                state.optInt("readyState") >= 1 ||
                state.optString("currentSrc").isNotBlank() ||
                state.optInt("videoWidth") > 0 ||
                state.optInt("videoHeight") > 0
            ) {
                readyVideoCount += 1
            }
            if (firstVisible == null) {
                firstVisible = state
            }
        }
        val message = buildString {
            append("facebook playback waiting reason=")
            append(payload.optString("playbackWaitingReason", "source-not-attached"))
            append(" pageUrl=").append(pageUrl)
            append(" retryAttempt=").append(retryCount + 1).append("/2")
            append(" videoCount=").append(payload.optInt("videoCount"))
            append(" visibleVideoCount=").append(visibleVideoCount)
            append(" readyVideoCount=").append(readyVideoCount)
            append(" currentSrc=").append(firstVisible?.optString("currentSrc").orEmpty().ifBlank { "blank" })
            append(" readyState=").append(firstVisible?.optInt("readyState") ?: 0)
            append(" networkState=").append(firstVisible?.optInt("networkState") ?: 0)
            append(" currentTime=").append(String.format(java.util.Locale.US, "%.3f", firstVisible?.optDouble("currentTime") ?: 0.0))
            append(" videoWidth=").append(firstVisible?.optInt("videoWidth") ?: 0)
            append(" videoHeight=").append(firstVisible?.optInt("videoHeight") ?: 0)
            append(" mediaSession=").append(browserMediaController.describeSessionState(session))
            append(" playbackWaiting=").append(true)
        }
        GvLogger.i("GvLayout", message)
        if (delayMs == null) {
            GvLogger.i(
                "GvLayout",
                "facebook playback waiting retryLimitReached=true pageUrl=$pageUrl"
            )
            return
        }
        facebookPlaybackWaitRetryCountBySession[session] = retryCount + 1
        scheduleFacebookCompatFollowUp(session, delayMs)
    }

    private fun updateFacebookPassiveReentryUrlState(session: GeckoSession, pageUrl: String) {
        val normalizedUrl = normalizeFacebookPassiveReentryUrl(pageUrl)
        if (normalizedUrl.isBlank()) {
            clearFacebookVideoHelperTracking(session)
            val previousUrl = facebookPassiveReentryObservedUrlBySession.remove(session)
            val hadAttempt = facebookPassiveAttemptCountBySession.remove(session) != null
            val hadAttach = facebookPassiveAttachedUrlBySession.remove(session) != null
            if (previousUrl != null || hadAttempt || hadAttach) {
                val generation = incrementFacebookPassiveGeneration(session)
                GvLogger.i(
                    "GvLayout",
                    "facebook passive reentry state reset url=blank reason=facebook-exit generation=$generation"
                )
            }
            return
        }
        val previousUrl = facebookPassiveReentryObservedUrlBySession[session]
        if (previousUrl != normalizedUrl) {
            val generation = incrementFacebookPassiveGeneration(session)
            facebookPassiveReentryObservedUrlBySession[session] = normalizedUrl
            facebookPassiveAttemptCountBySession[session] = 1
            facebookPassiveAttachedUrlBySession.remove(session)
            GvLogger.i(
                "GvLayout",
                "facebook passive reentry state reset url=$normalizedUrl reason=${if (previousUrl == null) "facebook-enter" else "facebook-url-change"} generation=$generation"
            )
            GvLogger.i(
                "GvLayout",
                "facebook passive attempt start attempt=1/$FACEBOOK_PASSIVE_MAX_ATTEMPTS generation=$generation url=$normalizedUrl"
            )
        }
    }

    private fun incrementFacebookPassiveGeneration(session: GeckoSession): Int {
        val nextGeneration = (facebookPassiveGenerationBySession[session] ?: 0) + 1
        facebookPassiveGenerationBySession[session] = nextGeneration
        return nextGeneration
    }

    private fun isCurrentFacebookPassiveGeneration(
        session: GeckoSession,
        payload: JSONObject,
    ): Boolean {
        val phase = payload.optString("phase")
        if (!phase.startsWith("facebook-passive-") && !phase.startsWith("facebook-overlay-") && !phase.startsWith("facebook-login-modal-close-") && !phase.startsWith("facebook-bottom-login-bar-hide-")) {
            return true
        }
        if (!payload.has("passiveGeneration")) {
            GvLogger.i(
                "GvLayout",
                "facebook passive sample ignored reason=missing-generation phase=$phase"
            )
            return false
        }
        val payloadGeneration = payload.optInt("passiveGeneration", -1)
        val currentGeneration = facebookPassiveGenerationBySession[session] ?: -1
        if (payloadGeneration != currentGeneration) {
            GvLogger.i(
                "GvLayout",
                "facebook passive sample ignored reason=stale-generation phase=$phase payloadGeneration=$payloadGeneration currentGeneration=$currentGeneration"
            )
            return false
        }
        return true
    }

    private fun normalizeFacebookPassiveReentryUrl(pageUrl: String): String {
        if (!isFacebookUrl(pageUrl)) {
            return ""
        }
        return runCatching {
            android.net.Uri.parse(pageUrl).buildUpon().fragment(null).build().toString()
        }.getOrDefault(pageUrl)
    }

    private fun firstVisibleFacebookVideoState(payload: JSONObject): JSONObject? {
        val states = payload.optJSONArray("videoStates") ?: return null
        for (index in 0 until states.length()) {
            val state = states.optJSONObject(index) ?: continue
            if (state.optBoolean("visible")) {
                return state
            }
        }
        return null
    }

    private fun facebookPassiveAttachSignal(state: JSONObject?): Boolean {
        if (state == null) return false
        return state.optString("currentSrc").isNotBlank() ||
            state.optInt("readyState") >= 1 ||
            state.optInt("videoWidth") > 0 ||
            state.optInt("videoHeight") > 0
    }

    private fun facebookPassiveReadyEnough(state: JSONObject?): Boolean {
        if (state == null) return false
        return state.optString("currentSrc").isNotBlank() &&
            state.optInt("readyState") >= 1 &&
            state.optInt("videoWidth") > 0 &&
            state.optInt("videoHeight") > 0
    }

    private fun facebookPassiveFailureReason(payload: JSONObject): String {
        val firstVisible = firstVisibleFacebookVideoState(payload)
        if (!facebookPassiveAttachSignal(firstVisible)) {
            return "source-not-attached"
        }
        val currentTime = firstVisible?.optDouble("currentTime", 0.0) ?: 0.0
        if (currentTime <= FACEBOOK_PASSIVE_REENTRY_MIN_ADVANCED_TIME_SECONDS) {
            return "playback-stalled"
        }
        return ""
    }

    private fun maybeHandleFacebookPassiveAttempt(
        session: GeckoSession,
        payload: JSONObject,
    ): Boolean {
        if (!FACEBOOK_PASSIVE_DIAGNOSTIC_MODE) {
            return false
        }
        val phase = payload.optString("phase")
        if (!phase.startsWith("facebook-passive-")) {
            return false
        }
        val passiveUrl = normalizeFacebookPassiveReentryUrl(payload.optString("locationHref").ifBlank { payload.optString("pageUrl") })
        if (passiveUrl.isBlank()) {
            return false
        }
        if (facebookPassiveAttachedUrlBySession[session] == passiveUrl) {
            return false
        }
        val firstVisible = firstVisibleFacebookVideoState(payload)
        val attachSignal = facebookPassiveAttachSignal(firstVisible)
        val currentTime = firstVisible?.optDouble("currentTime", 0.0) ?: 0.0
        val readyEnough = facebookPassiveReadyEnough(firstVisible)
        if (currentTime > FACEBOOK_PASSIVE_REENTRY_MIN_ADVANCED_TIME_SECONDS || readyEnough) {
            val attempt = facebookPassiveAttemptCountBySession[session] ?: payload.optInt("passiveAttempt", 1).coerceAtLeast(1)
            facebookPassiveAttachedUrlBySession[session] = passiveUrl
            GvLogger.i(
                "GvLayout",
                "facebook passive attach success attempt=$attempt/$FACEBOOK_PASSIVE_MAX_ATTEMPTS generation=${facebookPassiveGenerationBySession[session] ?: -1} phase=$phase url=$passiveUrl currentTime=${String.format(java.util.Locale.US, "%.3f", currentTime)}"
            )
            return true
        }
        if (attachSignal) {
            val attempt = facebookPassiveAttemptCountBySession[session] ?: payload.optInt("passiveAttempt", 1).coerceAtLeast(1)
            GvLogger.i(
                "GvLayout",
                "facebook passive attach warming attempt=$attempt/$FACEBOOK_PASSIVE_MAX_ATTEMPTS generation=${facebookPassiveGenerationBySession[session] ?: -1} phase=$phase url=$passiveUrl currentTime=${String.format(java.util.Locale.US, "%.3f", currentTime)} readyState=${firstVisible?.optInt("readyState") ?: 0} currentSrcPresent=${firstVisible?.optString("currentSrc").orEmpty().isNotBlank()}"
            )
        }
        if (phase != "facebook-passive-evaluate-10000") {
            return false
        }
        val reentryReason = facebookPassiveFailureReason(payload)
        if (reentryReason.isBlank()) {
            val attempt = facebookPassiveAttemptCountBySession[session] ?: payload.optInt("passiveAttempt", 1).coerceAtLeast(1)
            facebookPassiveAttachedUrlBySession[session] = passiveUrl
            GvLogger.i(
                "GvLayout",
                "facebook passive attach success attempt=$attempt/$FACEBOOK_PASSIVE_MAX_ATTEMPTS generation=${facebookPassiveGenerationBySession[session] ?: -1} phase=$phase url=$passiveUrl currentTime=${String.format(java.util.Locale.US, "%.3f", currentTime)}"
            )
            return true
        }
        val currentAttempt = facebookPassiveAttemptCountBySession[session] ?: payload.optInt("passiveAttempt", 1).coerceAtLeast(1)
        if (currentAttempt >= FACEBOOK_PASSIVE_MAX_ATTEMPTS) {
            GvLogger.i(
                "GvLayout",
                "facebook passive reentry exhausted attempts=$FACEBOOK_PASSIVE_MAX_ATTEMPTS reason=$reentryReason url=$passiveUrl phase=$phase generation=${facebookPassiveGenerationBySession[session] ?: -1}"
            )
            return true
        }
        val nextAttempt = currentAttempt + 1
        facebookPassiveAttemptCountBySession[session] = nextAttempt
        val nextGeneration = incrementFacebookPassiveGeneration(session)
        GvLogger.i(
            "GvLayout",
            "facebook passive reentry reason=$reentryReason attempt=$nextAttempt/$FACEBOOK_PASSIVE_MAX_ATTEMPTS url=$passiveUrl phase=$phase generation=$nextGeneration"
        )
        GvLogger.i(
            "GvLayout",
            "facebook passive attempt start attempt=$nextAttempt/$FACEBOOK_PASSIVE_MAX_ATTEMPTS generation=$nextGeneration url=$passiveUrl"
        )
        pointerHandler.post {
            if (isFinishing || isDestroyed) {
                return@post
            }
            val tab = tabController.findTabBySession(session) ?: return@post
            val activeUrl = normalizeFacebookPassiveReentryUrl(tab.url)
            if (activeUrl != passiveUrl) {
                GvLogger.i(
                    "GvLayout",
                    "facebook passive reentry skipped reason=url-changed expected=$passiveUrl actual=${tab.url}"
                )
                return@post
            }
            session.loadUri(passiveUrl)
        }
        return true
    }

    private fun logFacebookCompatPhaseSnapshot(session: GeckoSession, payload: JSONObject) {
        val phase = payload.optString("phase")
        val pageUrl = payload.optString("pageUrl")
        val states = payload.optJSONArray("videoStates") ?: JSONArray()
        fun compact(value: String, maxLength: Int): String {
            val normalized = value.replace(Regex("\\s+"), " ").trim()
            return if (normalized.length <= maxLength) {
                normalized
            } else {
                normalized.take(maxLength) + "..."
            }
        }
        fun appendIfPresent(builder: StringBuilder, label: String, value: String, maxLength: Int = 120) {
            if (value.isBlank()) return
            builder.append(" ").append(label).append("=").append(compact(value, maxLength))
        }
        fun rectSummary(rect: JSONObject?): String {
            if (rect == null) return ""
            return buildString {
                append(rect.optInt("left"))
                append(",")
                append(rect.optInt("top"))
                append(" ")
                append(rect.optInt("width"))
                append("x")
                append(rect.optInt("height"))
            }
        }
        fun userActivationSummary(userActivation: JSONObject?): String {
            if (userActivation == null) return ""
            return "active=${userActivation.optBoolean("isActive")},been=${userActivation.optBoolean("hasBeenActive")}"
        }
        fun resourceHintSummary(resourceHintCounts: JSONObject?): String {
            if (resourceHintCounts == null) return ""
            val keys = listOf("fbcdn", "video", "blob:", ".mp4", ".m3u8", "dash", "bytestart")
            return keys.joinToString(",") { key ->
                val count = resourceHintCounts.optJSONObject(key)?.optInt("count") ?: 0
                "$key=$count"
            }
        }
        fun stringArraySummary(array: JSONArray?): String {
            if (array == null || array.length() == 0) return ""
            return buildString {
                val end = minOf(array.length(), 5)
                for (index in 0 until end) {
                    val value = array.optString(index)
                    if (value.isBlank()) continue
                    if (isNotEmpty()) append(">")
                    append(value)
                }
            }
        }
        var visibleVideoCount = 0
        var readyVideoCount = 0
        var firstVisible: JSONObject? = null
        for (index in 0 until states.length()) {
            val state = states.optJSONObject(index) ?: continue
            if (!state.optBoolean("visible")) continue
            visibleVideoCount += 1
            if (
                state.optInt("readyState") >= 1 ||
                state.optString("currentSrc").isNotBlank() ||
                state.optInt("videoWidth") > 0 ||
                state.optInt("videoHeight") > 0
            ) {
                readyVideoCount += 1
            }
            if (firstVisible == null) {
                firstVisible = state
            }
        }
        val currentSrc = firstVisible?.optString("currentSrc").orEmpty()
        val currentSrcLabel = if (currentSrc.isBlank()) "blank" else currentSrc
        val currentSrcHost = firstVisible?.optString("currentSrcHost").orEmpty().ifBlank { "blank" }
        val phaseSnapshotMessage = buildString {
            append("facebook phase snapshot phase=$phase pageUrl=$pageUrl")
            append(" videoCount=").append(payload.optInt("videoCount"))
            append(" visibleVideoCount=").append(visibleVideoCount)
            append(" readyVideoCount=").append(readyVideoCount)
            append(" currentSrc=").append(currentSrcLabel)
            append(" currentSrcHost=").append(currentSrcHost)
            append(" readyState=").append(firstVisible?.optInt("readyState") ?: 0)
            append(" networkState=").append(firstVisible?.optInt("networkState") ?: 0)
            append(" paused=").append(firstVisible?.optBoolean("paused") ?: false)
            append(" currentTime=").append(String.format(java.util.Locale.US, "%.3f", firstVisible?.optDouble("currentTime") ?: 0.0))
            append(" videoWidth=").append(firstVisible?.optInt("videoWidth") ?: 0)
            append(" videoHeight=").append(firstVisible?.optInt("videoHeight") ?: 0)
            append(" mediaSession=").append(browserMediaController.describeSessionState(session))
            append(" cookieOverlayVisible=").append(payload.optBoolean("cookieOverlayVisible"))
            append(" loginOverlayVisible=").append(payload.optBoolean("loginOverlayVisible"))
            append(" cleanupHiddenAny=").append(payload.optBoolean("cleanupHiddenAny"))
            append(" wakeAttempted=").append(payload.optBoolean("wakeAttempted"))
            append(" playButtonFound=").append(payload.optBoolean("playButtonFound"))
            append(" playButtonClicked=").append(payload.optBoolean("playButtonClicked"))
            append(" videoPlayAttempted=").append(payload.optBoolean("videoPlayAttempted"))
            append(" playbackDeferred=").append(payload.optBoolean("playbackDeferred"))
            append(" playbackDeferredReason=").append(payload.optString("playbackDeferredReason"))
            appendIfPresent(this, "locationHref", payload.optString("locationHref"), maxLength = 140)
            appendIfPresent(this, "documentUrl", payload.optString("documentUrl"), maxLength = 140)
            appendIfPresent(this, "documentReadyState", payload.optString("documentReadyState"), maxLength = 32)
            appendIfPresent(this, "documentVisibilityState", payload.optString("documentVisibilityState"), maxLength = 32)
            append(" documentHasFocus=").append(payload.optBoolean("documentHasFocus"))
            append(" documentHidden=").append(payload.optBoolean("documentHidden"))
            append(" historyLength=").append(payload.optInt("historyLength"))
            append(" window=").append(payload.optInt("windowInnerWidth")).append("x").append(payload.optInt("windowInnerHeight"))
            append(" scroll=").append(payload.optInt("windowScrollX")).append(",").append(payload.optInt("windowScrollY"))
            append(" scrollingElement=").append(payload.optInt("scrollingElementScrollTop"))
                .append("/").append(payload.optInt("scrollingElementScrollHeight"))
                .append("/").append(payload.optInt("scrollingElementClientHeight"))
            appendIfPresent(this, "visibleVideoRect", rectSummary(payload.optJSONObject("visibleVideoRect")), maxLength = 64)
            append(" visibleVideoInViewport=").append(payload.optBoolean("visibleVideoInViewport"))
            appendIfPresent(this, "activeElement", payload.optString("activeElementSummary"), maxLength = 120)
            appendIfPresent(this, "userActivation", userActivationSummary(payload.optJSONObject("userActivation")), maxLength = 64)
            appendIfPresent(this, "resourceHints", resourceHintSummary(payload.optJSONObject("resourceHintCounts")), maxLength = 120)
            appendIfPresent(this, "watchParam", payload.optString("watchParam"), maxLength = 80)
            appendIfPresent(this, "visibleVideoParents", stringArraySummary(payload.optJSONArray("visibleVideoParents")), maxLength = 220)
        }
        GvLogger.i("GvLayout", phaseSnapshotMessage)
    }

    private fun logFacebookOverlayDiagnostics(payload: JSONObject) {
        fun compact(value: String, maxLength: Int): String {
            val normalized = value.replace(Regex("\\s+"), " ").trim()
            return if (normalized.length <= maxLength) normalized else normalized.take(maxLength) + "..."
        }
        fun rectSummary(rect: JSONObject?): String {
            if (rect == null) return "none"
            return "${rect.optInt("left")},${rect.optInt("top")} ${rect.optInt("width")}x${rect.optInt("height")}"
        }
        fun stateSummary(state: JSONObject?): String {
            if (state == null) return "none"
            return "overflow=${compact(state.optString("overflow"), 24)} overflowY=${compact(state.optString("overflowY"), 24)} cls=${compact(state.optString("cls"), 80)} style=${compact(state.optString("style"), 96)}"
        }
        fun candidateSummary(candidate: JSONObject): String {
            val chain = candidate.optJSONArray("parentChain")?.let { array ->
                buildString {
                    val end = minOf(array.length(), 4)
                    for (index in 0 until end) {
                        val item = array.optString(index)
                        if (item.isBlank()) continue
                        if (isNotEmpty()) append(">")
                        append(compact(item, 52))
                    }
                }
            }.orEmpty()
            val siblings = candidate.optJSONArray("siblingChain")?.let { array ->
                buildString {
                    val end = minOf(array.length(), 2)
                    for (index in 0 until end) {
                        val item = array.optJSONObject(index) ?: continue
                        val tag = item.optString("tag")
                        if (tag.isBlank()) continue
                        if (isNotEmpty()) append("<>")
                        append(tag)
                        item.optString("role").takeIf { it.isNotBlank() }?.let { append("@").append(compact(it, 16)) }
                        item.optString("id").takeIf { it.isNotBlank() }?.let { append("#").append(compact(it, 20)) }
                        item.optString("cls").takeIf { it.isNotBlank() }?.let { append(".").append(compact(it, 36)) }
                    }
                }
            }.orEmpty()
            return buildString {
                append("kind=").append(candidate.optString("kind"))
                append(" tag=").append(candidate.optString("tag"))
                candidate.optString("role").takeIf { it.isNotBlank() }?.let { append(" role=").append(compact(it, 24)) }
                candidate.optString("ariaModal").takeIf { it.isNotBlank() }?.let { append(" ariaModal=").append(compact(it, 12)) }
                candidate.optString("ariaLabel").takeIf { it.isNotBlank() }?.let { append(" ariaLabel=").append(compact(it, 48)) }
                candidate.optString("id").takeIf { it.isNotBlank() }?.let { append(" id=").append(compact(it, 36)) }
                candidate.optString("cls").takeIf { it.isNotBlank() }?.let { append(" cls=").append(compact(it, 64)) }
                candidate.optString("text").takeIf { it.isNotBlank() }?.let { append(" text=").append(compact(it, 80)) }
                append(" rect=").append(rectSummary(candidate.optJSONObject("rect")))
                append(" z=").append(compact(candidate.optString("z"), 24))
                append(" pos=").append(compact(candidate.optString("position"), 16))
                append(" opacity=").append(compact(candidate.optString("opacity"), 16))
                append(" pointer=").append(compact(candidate.optString("pointer"), 24))
                append(" visibility=").append(compact(candidate.optString("visibility"), 16))
                append(" display=").append(compact(candidate.optString("display"), 16))
                append(" bg=").append(compact(candidate.optString("bg"), 48))
                append(" bgAlpha=").append(String.format(java.util.Locale.US, "%.2f", candidate.optDouble("bgAlpha", 0.0)))
                append(" overlapsVideo=").append(candidate.optBoolean("overlapsVideo"))
                if (chain.isNotBlank()) append(" chain=").append(compact(chain, 220))
                if (siblings.isNotBlank()) append(" siblings=").append(compact(siblings, 140))
            }
        }
        fun logCandidateArray(marker: String, array: JSONArray?) {
            if (array == null || array.length() == 0) {
                GvLogger.i("GvLayout", "$marker count=0")
                return
            }
            val end = minOf(array.length(), 8)
            for (index in 0 until end) {
                val candidate = array.optJSONObject(index) ?: continue
                GvLogger.i("GvLayout", "$marker index=${index + 1}/$end ${candidateSummary(candidate)}")
            }
        }
        fun logStack(marker: String, array: JSONArray?) {
            if (array == null || array.length() == 0) {
                GvLogger.i("GvLayout", "$marker count=0")
                return
            }
            val summary = buildString {
                val end = minOf(array.length(), 8)
                for (index in 0 until end) {
                    val item = array.optJSONObject(index) ?: continue
                    if (isNotEmpty()) append(" | ")
                    append("#").append(index + 1).append(":")
                    append(candidateSummary(item))
                }
            }
            GvLogger.i("GvLayout", "$marker count=${array.length()} $summary")
        }

        val viewport = payload.optJSONObject("viewport")
        GvLogger.i(
            "GvLayout",
            "facebook overlay diagnostics phase=${payload.optString("phase")} generation=${payload.optInt("passiveGeneration")} attempt=${payload.optInt("passiveAttempt")}/${payload.optInt("passiveMaxAttempts")} page=${payload.optString("pageHost")}${payload.optString("pagePath")} ready=${payload.optString("documentReadyState")} visibility=${payload.optString("documentVisibilityState")} focus=${payload.optBoolean("documentHasFocus")} viewport=${viewport?.optInt("width") ?: 0}x${viewport?.optInt("height") ?: 0} scroll=${viewport?.optInt("scrollX") ?: 0},${viewport?.optInt("scrollY") ?: 0} primaryVideoRect=${rectSummary(payload.optJSONObject("primaryVideoRect"))} html=${stateSummary(payload.optJSONObject("htmlState"))} body=${stateSummary(payload.optJSONObject("bodyState"))}"
        )
        logCandidateArray("facebook overlay dialog candidate", payload.optJSONArray("dialogCandidates"))
        logCandidateArray("facebook overlay backdrop candidate", payload.optJSONArray("backdropCandidates"))
        logCandidateArray("facebook overlay bottom-bar candidate", payload.optJSONArray("bottomBarCandidates"))
        logCandidateArray("facebook overlay cookie-button candidate", payload.optJSONArray("cookieButtonCandidates"))
        logCandidateArray("facebook overlay login-button candidate", payload.optJSONArray("loginButtonCandidates"))
        logStack("facebook overlay center-stack", payload.optJSONArray("centerStack"))
        logStack("facebook overlay video-center-stack", payload.optJSONArray("videoCenterStack"))
        val pairs = payload.optJSONArray("pairCandidates")
        if (pairs == null || pairs.length() == 0) {
            GvLogger.i("GvLayout", "facebook overlay pair candidate count=0")
        } else {
            val end = minOf(pairs.length(), 8)
            for (index in 0 until end) {
                val pair = pairs.optJSONObject(index) ?: continue
                GvLogger.i(
                    "GvLayout",
                    "facebook overlay pair candidate index=${index + 1}/$end dialogIndex=${pair.optInt("dialogIndex")} backdropIndex=${pair.optInt("backdropIndex")} sharesParent=${pair.optBoolean("sharesParent")} adjacentSibling=${pair.optBoolean("adjacentSibling")} backdropContainsDialog=${pair.optBoolean("backdropContainsDialog")} dialogContainsBackdrop=${pair.optBoolean("dialogContainsBackdrop")} rectsOverlap=${pair.optBoolean("rectsOverlap")} dialogOverlapsVideo=${pair.optBoolean("dialogOverlapsVideo")} backdropOverlapsVideo=${pair.optBoolean("backdropOverlapsVideo")}"
                )
            }
        }
    }

    private fun maybeDispatchAmazonConsentCompat(
        session: GeckoSession,
        pageUrl: String,
        reason: String,
    ) {
        if (!isAmazonSurfaceUrl(pageUrl)) {
            return
        }
        val now = SystemClock.uptimeMillis()
        val lastDispatch = amazonConsentLastDispatchMsBySession[session] ?: 0L
        if (now - lastDispatch < 2000L) {
            return
        }
        amazonConsentLastDispatchMsBySession[session] = now
        triggerAmazonConsentCompat(session, pageUrl, reason)
        if (reason == "location-change") {
            scheduleAmazonConsentFollowUp(session, 1400L)
            scheduleAmazonConsentFollowUp(session, 5200L)
            scheduleAmazonConsentFollowUp(session, 14000L)
        }
    }

    private fun scheduleAmazonConsentFollowUp(session: GeckoSession, delayMs: Long) {
        pointerHandler.postDelayed(
            {
                if (isFinishing || isDestroyed) {
                    return@postDelayed
                }
                val tab = tabController.findTabBySession(session) ?: return@postDelayed
                val currentTabUrl = tab.url
                if (!isAmazonSurfaceUrl(currentTabUrl)) {
                    return@postDelayed
                }
                triggerAmazonConsentCompat(session, currentTabUrl, reason = "follow-up-$delayMs")
            },
            delayMs,
        )
    }

    private fun triggerAmazonConsentCompat(
        session: GeckoSession,
        pageUrl: String,
        reason: String,
    ) {
        val normalizedUrl = pageUrl.ifBlank { return }
        if (!isAmazonSurfaceUrl(normalizedUrl)) {
            return
        }
        val script = """
            javascript:(function(){
              try{
                var lower=function(v){return ((v||'')+'').replace(/\s+/g,' ').trim().toLowerCase();};
                var visible=function(node){
                  try{
                    if(!node){return false;}
                    var style=window.getComputedStyle(node);
                    if(style&&(style.display==='none'||style.visibility==='hidden'||style.opacity==='0')){return false;}
                    var rect=node.getBoundingClientRect();
                    return rect.width>8&&rect.height>8&&rect.bottom>0&&rect.right>0&&rect.top<window.innerHeight&&rect.left<window.innerWidth;
                  }catch(_){return false;}
                };
                var textOf=function(node){
                  try{
                    return lower(
                      (node.value||'')+' '+
                      ((node.getAttribute&&node.getAttribute('aria-label'))||'')+' '+
                      ((node.getAttribute&&node.getAttribute('title'))||'')+' '+
                      (node.innerText||node.textContent||'')
                    );
                  }catch(_){return ''; }
                };
                var clickNode=function(node){
                  try{
                    if(!node||!visible(node)){return false;}
                    try{node.scrollIntoView({block:'center',inline:'center'});}catch(_){}
                    try{
                      node.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,cancelable:true,view:window}));
                      node.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,view:window}));
                      node.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true,view:window}));
                      node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
                    }catch(_){}
                    try{node.click();}catch(_){}
                    return true;
                  }catch(_){return false;}
                };
                var labels=['accept all','accept','agree','allow all'];
                var nodes=Array.from(document.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"],input[type="checkbox"],a[role="button"],a,div[role="button"]')).slice(0,220);
                for(var i=0;i<nodes.length;i++){
                  var node=nodes[i];
                  if(!visible(node)){continue;}
                  var blob=textOf(node);
                  if(blob.indexOf('decline')>=0 || blob.indexOf('customise')>=0 || blob.indexOf('customize')>=0){continue;}
                  for(var j=0;j<labels.length;j++){
                    if(blob.indexOf(labels[j])>=0){
                      if(clickNode(node)){return;}
                    }
                  }
                }
                setTimeout(function(){
                  try{
                    var delayedNodes=Array.from(document.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"],input[type="checkbox"],a[role="button"],a,div[role="button"]')).slice(0,220);
                    for(var k=0;k<delayedNodes.length;k++){
                      var delayed=delayedNodes[k];
                      if(!visible(delayed)){continue;}
                      var delayedBlob=textOf(delayed);
                      if(delayedBlob.indexOf('decline')>=0 || delayedBlob.indexOf('customise')>=0 || delayedBlob.indexOf('customize')>=0){continue;}
                      for(var m=0;m<labels.length;m++){
                        if(delayedBlob.indexOf(labels[m])>=0){
                          if(clickNode(delayed)){return;}
                        }
                      }
                    }
                  }catch(_){}
                },350);
              }catch(_){}
            })();
        """.trimIndent()
        GvLogger.i(
            "GvExt",
            "amazon consent compat dispatched tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} reason=$reason url=$normalizedUrl"
        )
        session.loadUri(script)
    }

    private fun maybeDispatchTttConsentCompat(
        session: GeckoSession,
        pageUrl: String,
        reason: String,
    ) {
        if (!isTttLiveSurfaceUrl(pageUrl)) {
            return
        }
        val now = SystemClock.uptimeMillis()
        val lastDispatch = tttConsentLastDispatchMsBySession[session] ?: 0L
        if (now - lastDispatch < 1800L) {
            return
        }
        tttConsentLastDispatchMsBySession[session] = now
        triggerTttConsentCompat(session, pageUrl, reason)
        if (reason == "location-change") {
            scheduleTttConsentFollowUp(session, 1200L)
            scheduleTttConsentFollowUp(session, 3500L)
            scheduleTttConsentFollowUp(session, 8000L)
            scheduleTttConsentFollowUp(session, 12000L)
            scheduleTttConsentFollowUp(session, 18000L)
        }
    }

    private fun maybeDispatchCvc9ConsentCompat(
        session: GeckoSession,
        pageUrl: String,
        reason: String,
    ) {
        if (!isCvc9DailymotionWatchPageUrl(pageUrl) && !isCvc9DailymotionConsentPageUrl(pageUrl)) {
            return
        }
        val now = SystemClock.uptimeMillis()
        val lastDispatch = cvc9ConsentLastDispatchMsBySession[session] ?: 0L
        if (now - lastDispatch < 1800L) {
            return
        }
        cvc9ConsentLastDispatchMsBySession[session] = now
        GvLogger.i(
            "GvExt",
            "cvc9 consent compat dispatched tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} reason=$reason url=$pageUrl"
        )
        triggerUnifiedPageCompat(session, pageUrl)
        if ((isCvc9DailymotionWatchPageUrl(pageUrl) || isCvc9DailymotionConsentPageUrl(pageUrl)) && (reason == "location-change" || reason == "page-stop")) {
            scheduleCvc9ConsentFollowUp(session, 3500L)
            scheduleCvc9ConsentFollowUp(session, 7000L)
            scheduleCvc9ConsentFollowUp(session, 14000L)
        }
    }

    private fun scheduleCvc9ConsentFollowUp(session: GeckoSession, delayMs: Long) {
        pointerHandler.postDelayed(
            {
                if (isFinishing || isDestroyed) {
                    return@postDelayed
                }
                val tab = tabController.findTabBySession(session) ?: return@postDelayed
                val currentTabUrl = tab.url
                if (!isCvc9DailymotionConsentContextUrl(currentTabUrl)) {
                    return@postDelayed
                }
                GvLogger.i(
                    "GvExt",
                    "cvc9 consent compat follow-up tabId=${tab.id} reason=follow-up-$delayMs url=$currentTabUrl"
                )
                triggerUnifiedPageCompat(session, currentTabUrl)
                val frameNativeHandled = cvc9ConsentFrameNativeTapHandledMsBySession.containsKey(session)
                if (frameNativeHandled) {
                    if (delayMs == 3500L && cvc9ConsentFrameSafety3500UsedBySession[session] != true) {
                        cvc9ConsentFrameSafety3500UsedBySession[session] = true
                        GvLogger.i(
                            "GvExt",
                            "cvc9 consent follow-up allowed reason=frame-native-safety-3500 delayMs=$delayMs tabId=${tab.id} url=$currentTabUrl"
                        )
                    } else if (delayMs == 7000L && cvc9ConsentFrameSafety7000UsedBySession[session] != true) {
                        cvc9ConsentFrameSafety7000UsedBySession[session] = true
                        GvLogger.i(
                            "GvExt",
                            "cvc9 consent follow-up allowed reason=frame-native-safety-7000 delayMs=$delayMs tabId=${tab.id} url=$currentTabUrl"
                        )
                    } else {
                        GvLogger.i(
                            "GvExt",
                            "cvc9 consent follow-up skipped reason=frame-native-already-handled delayMs=$delayMs tabId=${tab.id} url=$currentTabUrl"
                        )
                        return@postDelayed
                    }
                }
                dispatchCvc9ConsentNativeAcceptTap(reason = "follow-up-$delayMs")
                scheduleCvc9PlayerWakeTapOnce(session, reason = "post-accept-$delayMs")
            },
            delayMs,
        )
    }

    private fun resetCvc9ConsentFrameNativeTapState(session: GeckoSession) {
        cvc9ConsentFrameNativeTapHandledMsBySession.remove(session)
        cvc9ConsentFrameSafety3500UsedBySession.remove(session)
        cvc9ConsentFrameSafety7000UsedBySession.remove(session)
        cvc9ConsentFrameBurstGenerationBySession.remove(session)
    }

    private fun scheduleCvc9ConsentFrameNativeTapBurst(session: GeckoSession) {
        val tab = tabController.findTabBySession(session) ?: return
        val currentUrl = tab.url
        if (!isCvc9DailymotionConsentContextUrl(currentUrl) || isCvc9AdclickUrl(currentUrl)) {
            return
        }
        cvc9ConsentFrameNativeTapHandledMsBySession.remove(session)
        cvc9ConsentFrameSafety3500UsedBySession.remove(session)
        val generation = (cvc9ConsentFrameBurstGenerationBySession[session] ?: 0) + 1
        cvc9ConsentFrameBurstGenerationBySession[session] = generation
        val tabId = tab.id
        GvLogger.i(
            "GvExt",
            "cvc9 consent frame native tap burst scheduled tabId=$tabId url=$currentUrl"
        )
        CVC9_CONSENT_FRAME_NATIVE_TAP_BURST_DELAYS_MS.forEach { delayMs ->
            pointerHandler.postDelayed(
                {
                    if (isFinishing || isDestroyed) {
                        GvLogger.i(
                            "GvExt",
                            "cvc9 consent frame native tap skipped reason=activity-ending delayMs=$delayMs"
                        )
                        return@postDelayed
                    }
                    if (cvc9ConsentFrameBurstGenerationBySession[session] != generation) {
                        GvLogger.i(
                            "GvExt",
                            "cvc9 consent frame native tap skipped reason=superseded delayMs=$delayMs"
                        )
                        return@postDelayed
                    }
                    val burstTab = tabController.findTabBySession(session)
                    if (burstTab == null) {
                        GvLogger.i(
                            "GvExt",
                            "cvc9 consent frame native tap skipped reason=missing-tab delayMs=$delayMs"
                        )
                        return@postDelayed
                    }
                    val burstUrl = burstTab.url
                    if (!isCvc9DailymotionConsentContextUrl(burstUrl)) {
                        GvLogger.i(
                            "GvExt",
                            "cvc9 consent frame native tap skipped reason=left-cvc9-consent-context delayMs=$delayMs tabId=${burstTab.id} url=$burstUrl"
                        )
                        return@postDelayed
                    }
                    if (isCvc9AdclickUrl(burstUrl)) {
                        GvLogger.i(
                            "GvExt",
                            "cvc9 consent frame native tap skipped reason=adclick delayMs=$delayMs tabId=${burstTab.id} url=$burstUrl"
                        )
                        return@postDelayed
                    }
                    GvLogger.i(
                        "GvExt",
                        "cvc9 consent frame native tap attempt delayMs=$delayMs tabId=${burstTab.id} url=$burstUrl"
                    )
                    val handled = dispatchCvc9ConsentNativeAcceptTap(reason = "frame-detected-$delayMs")
                    if (!handled) {
                        return@postDelayed
                    }
                    cvc9ConsentFrameNativeTapHandledMsBySession[session] = SystemClock.uptimeMillis()
                    cvc9ConsentFrameBurstGenerationBySession.remove(session)
                    GvLogger.i(
                        "GvExt",
                        "cvc9 consent frame native tap detected delayMs=$delayMs tabId=${burstTab.id} url=$burstUrl"
                    )
                    scheduleCvc9PlayerWakeTapOnce(session, reason = "post-accept-frame-detected-$delayMs")
                },
                delayMs,
            )
        }
    }

    private fun scheduleCvc9PlayerWakeTapOnce(session: GeckoSession, reason: String) {
        if (cvc9ConsentWakeSentMsBySession.containsKey(session)) {
            return
        }
        cvc9ConsentWakeSentMsBySession[session] = SystemClock.uptimeMillis()
        pointerHandler.postDelayed(
            {
                if (isFinishing || isDestroyed) {
                    return@postDelayed
                }
                val wakeTab = tabController.findTabBySession(session) ?: return@postDelayed
                val wakeUrl = wakeTab.url
                if (!isCvc9DailymotionWatchPageUrl(wakeUrl) && !isCvc9DailymotionConsentPageUrl(wakeUrl)) {
                    return@postDelayed
                }
                dispatchCvc9PlayerWakeTap(reason = reason)
            },
            900L,
        )
    }

    private fun dispatchCvc9ConsentNativeAcceptTap(reason: String): Boolean {
        val tapX = geckoView.width * 0.5f
        val tapY = geckoView.height * 0.66f
        val handled = dispatchNativeMouseTapAt(tapX, tapY, reason = "cvc9-consent-$reason")
        GvLogger.i(
            "GvInput",
            "cvc9 consent native tap reason=$reason x=${tapX.toInt()} y=${tapY.toInt()} handled=$handled"
        )
        return handled
    }

    private fun dispatchCvc9PlayerWakeTap(reason: String): Boolean {
        val tapX = geckoView.width * 0.5f
        val tapY = geckoView.height * 0.5f
        val handled = dispatchNativeMouseTapAt(tapX, tapY, reason = "cvc9-player-$reason")
        GvLogger.i(
            "GvInput",
            "cvc9 player wake tap reason=$reason x=${tapX.toInt()} y=${tapY.toInt()} handled=$handled"
        )
        return handled
    }

    private fun scheduleTttConsentFollowUp(session: GeckoSession, delayMs: Long) {
        pointerHandler.postDelayed(
            {
                if (isFinishing || isDestroyed) {
                    return@postDelayed
                }
                val tab = tabController.findTabBySession(session) ?: return@postDelayed
                val currentTabUrl = tab.url
                if (!isTttLiveSurfaceUrl(currentTabUrl)) {
                    return@postDelayed
                }
                triggerTttConsentCompat(session, currentTabUrl, reason = "follow-up-$delayMs")
            },
            delayMs,
        )
    }

    private fun triggerTttConsentCompat(
        session: GeckoSession,
        pageUrl: String,
        reason: String,
    ) {
        if (!TTT_CONSENT_AUTOCLICK_ENABLED) {
            return
        }
        val normalizedUrl = pageUrl.ifBlank { return }
        if (!isTttLiveSurfaceUrl(normalizedUrl)) {
            return
        }
        val pageUrlJson = JSONObject.quote(normalizedUrl)
        val reasonJson = JSONObject.quote(reason)
        val script = """
            javascript:(function(){
              try{
                var promptPrefix=${JSONObject.quote(PROMPT_PREFIX)};
                var pageUrl=$pageUrlJson;
                var phase=$reasonJson;
                var lower=function(v){return ((v||'')+'').replace(/\s+/g,' ').trim().toLowerCase();};
                var clean=function(v){return ((v||'')+'').replace(/\s+/g,' ').trim().slice(0,140);};
                var rect=function(node){
                  try{
                    var r=node.getBoundingClientRect();
                    return Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'x'+Math.round(r.height);
                  }catch(_){return '';}
                };
                var visible=function(node){
                  try{
                    if(!node){return false;}
                    var style=window.getComputedStyle(node);
                    if(style&&(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)){return false;}
                    var r=node.getBoundingClientRect();
                    return r.width>20&&r.height>16&&r.bottom>0&&r.right>0&&r.top<window.innerHeight&&r.left<window.innerWidth;
                  }catch(_){return false;}
                };
                var textOf=function(node){
                  try{
                    return lower(
                      (node.value||'')+' '+
                      ((node.getAttribute&&node.getAttribute('aria-label'))||'')+' '+
                      ((node.getAttribute&&node.getAttribute('title'))||'')+' '+
                      (node.innerText||node.textContent||'')
                    );
                  }catch(_){return '';}
                };
                var buttonLabel=function(node){
                  try{
                    return clean(
                      (node.value||'')+' '+
                      ((node.getAttribute&&node.getAttribute('aria-label'))||'')+' '+
                      ((node.getAttribute&&node.getAttribute('title'))||'')+' '+
                      (node.innerText||node.textContent||'')
                    );
                  }catch(_){return '';}
                };
                var isForbiddenConsentControl=function(label){
                  return label.indexOf('manage')>=0 ||
                    label.indexOf('option')>=0 ||
                    label.indexOf('reject')>=0 ||
                    label.indexOf('decline')>=0 ||
                    label.indexOf('disagree')>=0 ||
                    label.indexOf('learn more')>=0;
                };
                var isPositiveConsentLabel=function(label){
                  return label==='consent' ||
                    label==='accept' ||
                    label==='accept all' ||
                    label==='agree' ||
                    label==='i agree' ||
                    label.indexOf('consent')===0 ||
                    label.indexOf('accept all')>=0;
                };
                var clickableFor=function(node){
                  var cur=node;
                  var limit=0;
                  while(cur&&cur!==bestDialog&&limit<5){
                    try{
                      if(!visible(cur)){return null;}
                      var tag=(cur.tagName||'').toLowerCase();
                      var role=((cur.getAttribute&&cur.getAttribute('role'))||'').toLowerCase();
                      var style=window.getComputedStyle(cur);
                      var cursor=(style&&style.cursor||'').toLowerCase();
                      var onclick=!!(cur.onclick||(cur.getAttribute&&cur.getAttribute('onclick')));
                      var tabbable=!!(cur.getAttribute&&cur.getAttribute('tabindex')!==null);
                      if(tag==='button'||tag==='a'||tag==='input'||role==='button'||onclick||cursor==='pointer'||tabbable){
                        return cur;
                      }
                    }catch(_){}
                    cur=cur.parentElement;
                    limit++;
                  }
                  return node;
                };
                var emit=function(clicked, resultReason, dialog, button){
                  try{
                    window.prompt(promptPrefix+JSON.stringify({
                      type:'ttt-consent-autoclick',
                      phase:phase,
                      pageUrl:pageUrl,
                      clicked:!!clicked,
                      reason:resultReason||'',
                      dialogRect:dialog?rect(dialog):'',
                      buttonRect:button?rect(button):'',
                      buttonText:button?buttonLabel(button):'',
                      dialogText:dialog?clean(dialog.innerText||dialog.textContent||''):''
                    }),'');
                  }catch(_){}
                };
                var dialogCandidates=Array.from(document.querySelectorAll('[role="dialog"],[aria-modal="true"],div,section')).slice(0,700);
                var bestDialog=null;
                for(var i=0;i<dialogCandidates.length;i++){
                  var dialog=dialogCandidates[i];
                  if(!visible(dialog)){continue;}
                  if(dialog.querySelector&&dialog.querySelector('video,source,canvas,iframe')){continue;}
                  var blob=textOf(dialog);
                  var tttSignal=blob.indexOf('ttt news asks for your consent')>=0 || (
                    blob.indexOf('personal data')>=0 &&
                    blob.indexOf('store and/or access information on a device')>=0 &&
                    blob.indexOf('manage options')>=0 &&
                    blob.indexOf('consent')>=0
                  );
                  if(!tttSignal){continue;}
                  bestDialog=dialog;
                  break;
                }
                if(!bestDialog){
                  emit(false,'no-consent-dialog-match',null,null);
                  return;
                }
                emit(false,'scan',bestDialog,null);
                var buttons=Array.from(bestDialog.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"],a[role="button"],a,div,span')).slice(0,220);
                var bestButton=null;
                var bestScore=-1;
                for(var j=0;j<buttons.length;j++){
                  var candidate=buttons[j];
                  if(!visible(candidate)){continue;}
                  var label=textOf(candidate);
                  if(!label||label.length>80){continue;}
                  if(isForbiddenConsentControl(label)){continue;}
                  if(!isPositiveConsentLabel(label)){continue;}
                  var button=clickableFor(candidate);
                  if(!button||!visible(button)){continue;}
                  var buttonLabelText=textOf(button);
                  if(isForbiddenConsentControl(buttonLabelText)){continue;}
                  var score=0;
                  if(label==='consent'){score+=100;}
                  if(label==='accept all'){score+=90;}
                  if(label==='accept'){score+=80;}
                  if(label==='agree'||label==='i agree'){score+=70;}
                  if((button.tagName||'').toLowerCase()==='button'){score+=20;}
                  if(((button.getAttribute&&button.getAttribute('role'))||'').toLowerCase()==='button'){score+=15;}
                  var r=button.getBoundingClientRect();
                  score+=Math.min(40,Math.max(0,r.width/12));
                  if(score>bestScore){
                    bestButton=button;
                    bestScore=score;
                  }
                }
                if(!bestButton){
                  emit(false,'no-consent-button-match',bestDialog,null);
                  return;
                }
                try{bestButton.click();}catch(_){}
                emit(true,'clicked',bestDialog,bestButton);
              }catch(error){
                try{
                  window.prompt(${JSONObject.quote(PROMPT_PREFIX)}+JSON.stringify({
                    type:'ttt-consent-autoclick',
                    phase:${JSONObject.quote(reason)},
                    pageUrl:${JSONObject.quote(normalizedUrl)},
                    clicked:false,
                    reason:'exception'
                  }),'');
                }catch(_){}
              }
            })();
        """.trimIndent()
        GvLogger.i(
            "GvExt",
            "ttt consent autoclick dispatched tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} reason=$reason url=$normalizedUrl"
        )
        session.loadUri(script)
    }

    private fun maybeScheduleCvmVimeoDiagnosticAfterKeyAttempt(event: KeyEvent) {
        if (!ENABLE_CVM_VIMEO_DIAGNOSTIC) {
            return
        }
        if (event.action != KeyEvent.ACTION_DOWN) {
            return
        }
        if (event.keyCode != KeyEvent.KEYCODE_DPAD_CENTER && event.keyCode != KeyEvent.KEYCODE_ENTER) {
            return
        }
        val activeTab = tabController.getActiveTab() ?: return
        if (!isCvmVimeoDiagnosticUrl(activeTab.url)) {
            return
        }
        val session = activeTab.session
        scheduleCvmVimeoDiagnosticFollowUp(session, 250L, "key-attempt-250")
        scheduleCvmVimeoDiagnosticFollowUp(session, 1200L, "key-attempt-1200")
    }

    private fun scheduleCvmVimeoDiagnosticFollowUp(session: GeckoSession, delayMs: Long, reason: String) {
        pointerHandler.postDelayed(
            {
                if (isFinishing || isDestroyed) {
                    return@postDelayed
                }
                val tab = tabController.findTabBySession(session) ?: return@postDelayed
                maybeDispatchCvmVimeoDiagnostic(session, tab.url, reason = reason)
            },
            delayMs,
        )
    }

    private fun maybeDispatchCvmVimeoDiagnostic(
        session: GeckoSession,
        pageUrl: String,
        reason: String,
    ) {
        if (!ENABLE_CVM_VIMEO_DIAGNOSTIC) {
            return
        }
        if (!isCvmVimeoDiagnosticUrl(pageUrl)) {
            return
        }
        val now = SystemClock.uptimeMillis()
        val lastDispatch = cvmVimeoDiagnosticLastDispatchMsBySession[session] ?: 0L
        if (now - lastDispatch < CVM_VIMEO_DIAGNOSTIC_MIN_INTERVAL_MS) {
            return
        }
        cvmVimeoDiagnosticLastDispatchMsBySession[session] = now
        triggerCvmVimeoDiagnostic(session, pageUrl, reason)
    }

    private fun triggerCvmVimeoDiagnostic(
        session: GeckoSession,
        pageUrl: String,
        reason: String,
    ) {
        val normalizedUrl = pageUrl.ifBlank { return }
        if (!isCvmVimeoDiagnosticUrl(normalizedUrl)) {
            return
        }
        val pointerXValue = pointerX.toInt().coerceAtLeast(0)
        val pointerYValue = pointerY.toInt().coerceAtLeast(0)
        val script = """
            javascript:(function(){
              try{
                var promptPrefix=${JSONObject.quote(PROMPT_PREFIX)};
                var pageUrl=${JSONObject.quote(normalizedUrl)};
                var reason=${JSONObject.quote(reason)};
                var px=$pointerXValue;
                var py=$pointerYValue;
                var truncate=function(v,n){
                  var s=((v||'')+'').replace(/\s+/g,' ').trim();
                  return s.length>n?s.slice(0,n):s;
                };
                var rect=function(node){
                  try{
                    var r=node.getBoundingClientRect();
                    return Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'x'+Math.round(r.height);
                  }catch(_){return '';}
                };
                var visible=function(node){
                  try{
                    if(!node){return false;}
                    var style=window.getComputedStyle(node);
                    if(style&&(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)){return false;}
                    var r=node.getBoundingClientRect();
                    return r.width>2&&r.height>2&&r.right>0&&r.bottom>0&&r.left<window.innerWidth&&r.top<window.innerHeight;
                  }catch(_){return false;}
                };
                var nodeSummary=function(node){
                  try{
                    if(!node){return 'none';}
                    var tag=(node.tagName||'').toLowerCase();
                    var role=((node.getAttribute&&node.getAttribute('role'))||'').toLowerCase();
                    var id=(node.id||'');
                    var cls=((typeof node.className==='string')?node.className:'');
                    return truncate(tag+(role?('[role='+role+']'):'')+(id?('#'+id):'')+(cls?('.'+cls.replace(/\s+/g,'.')):''),180);
                  }catch(_){return 'unknown';}
                };
                var w=Math.max(1,window.innerWidth||0);
                var h=Math.max(1,window.innerHeight||0);
                var pointElement=null;
                try{
                  pointElement=document.elementFromPoint(Math.min(Math.max(0,px),w-1),Math.min(Math.max(0,py),h-1));
                }catch(_){}
                var iframes=Array.from(document.querySelectorAll('iframe')).slice(0,12).map(function(frame){
                  var src='';
                  var sameOrigin=false;
                  try{src=frame.src||frame.getAttribute('src')||'';}catch(_){}
                  try{sameOrigin=!!frame.contentDocument;}catch(_){sameOrigin=false;}
                  return {
                    src:truncate(src,220),
                    rect:rect(frame),
                    visible:visible(frame),
                    sameOriginAccessible:sameOrigin
                  };
                });
                var vimeoFrame=(function(){
                  for(var i=0;i<iframes.length;i++){
                    var src=(iframes[i].src||'').toLowerCase();
                    if(src.indexOf('vimeo.com/event/')>=0||src.indexOf('player.vimeo.com')>=0){return iframes[i];}
                  }
                  return null;
                })();
                var videos=Array.from(document.querySelectorAll('video')).slice(0,6).map(function(video){
                  return {
                    paused:!!video.paused,
                    readyState:Number(video.readyState||0),
                    currentTime:Number(video.currentTime||0),
                    videoWidth:Number(video.videoWidth||0),
                    videoHeight:Number(video.videoHeight||0),
                    muted:!!video.muted,
                    controls:!!video.controls
                  };
                });
                var playCandidates=Array.from(document.querySelectorAll('button,[role="button"],a[role="button"],input[type="button"],input[type="submit"]')).slice(0,220).map(function(node){
                  var text=truncate((node.innerText||node.textContent||node.value||node.getAttribute('aria-label')||node.getAttribute('title')||''),120);
                  return {text:text,node:node};
                }).filter(function(item){
                  var t=(item.text||'').toLowerCase();
                  if(!t){return false;}
                  if(t.indexOf('play')<0&&t.indexOf('watch')<0&&t.indexOf('live')<0){return false;}
                  return visible(item.node);
                }).slice(0,8).map(function(item){
                  return {text:item.text,rect:rect(item.node)};
                });
                var userActivation={
                  isActive:false,
                  hasBeenActive:false
                };
                try{
                  if(navigator&&navigator.userActivation){
                    userActivation.isActive=!!navigator.userActivation.isActive;
                    userActivation.hasBeenActive=!!navigator.userActivation.hasBeenActive;
                  }
                }catch(_){}
                var activeElement=document.activeElement;
                window.prompt(promptPrefix+JSON.stringify({
                  type:'cvm-vimeo-diagnostic',
                  phase:reason,
                  pageUrl:pageUrl,
                  documentHasFocus:!!document.hasFocus(),
                  activeElement:nodeSummary(activeElement),
                  userActivation:userActivation,
                  pointerX:px,
                  pointerY:py,
                  elementFromPoint:nodeSummary(pointElement),
                  elementFromPointIsIframe:!!(pointElement&&String(pointElement.tagName||'').toLowerCase()==='iframe'),
                  iframeCount:iframes.length,
                  iframes:iframes,
                  vimeoIframeRect:vimeoFrame?vimeoFrame.rect:'',
                  vimeoIframeVisible:!!(vimeoFrame&&vimeoFrame.visible),
                  videoCount:videos.length,
                  videos:videos,
                  playButtonCandidates:playCandidates
                }),'');
              }catch(error){
                try{
                  window.prompt(${JSONObject.quote(PROMPT_PREFIX)}+JSON.stringify({
                    type:'cvm-vimeo-diagnostic',
                    phase:${JSONObject.quote(reason)},
                    pageUrl:${JSONObject.quote(normalizedUrl)},
                    error:String(error&&error.message||error||'unknown')
                  }),'');
                }catch(_){}
              }
            })();
        """.trimIndent()
        GvLogger.i(
            "GvMedia",
            "cvm vimeo diagnostic dispatched reason=$reason pageUrl=$normalizedUrl pointer=${pointerXValue},${pointerYValue}"
        )
        session.loadUri(script)
    }

    private fun maybeDispatchKulchaFloCookieConsentCompat(
        session: GeckoSession,
        pageUrl: String,
        reason: String,
    ) {
        if (!KULCHAFLO_COOKIE_CONSENT_ACCEPT_ALL_AUTOCLICK_ENABLED || !isKulchaFloPage(pageUrl)) {
            return
        }
        val uri = runCatching { android.net.Uri.parse(pageUrl) }.getOrNull() ?: return
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty().lowercase().ifBlank { "/" }
        if (path == "/watch" || path.startsWith("/watch/") || isAdminOrBackendRoute(host, path)) {
            return
        }
        val now = SystemClock.uptimeMillis()
        val lastDispatch = kulchaFloCookieConsentLastDispatchMsBySession[session] ?: 0L
        if (now - lastDispatch < 1800L) {
            return
        }
        kulchaFloCookieConsentLastDispatchMsBySession[session] = now
        triggerKulchaFloCookieConsentCompat(session, pageUrl, reason)
        if (reason == "location-change") {
            scheduleKulchaFloCookieConsentFollowUp(session, 1200L)
            scheduleKulchaFloCookieConsentFollowUp(session, 3200L)
            scheduleKulchaFloCookieConsentFollowUp(session, 6500L)
        }
    }

    private fun scheduleKulchaFloCookieConsentFollowUp(session: GeckoSession, delayMs: Long) {
        pointerHandler.postDelayed(
            {
                if (isFinishing || isDestroyed) {
                    return@postDelayed
                }
                val tab = tabController.findTabBySession(session) ?: return@postDelayed
                val currentTabUrl = tab.url
                if (!isKulchaFloPage(currentTabUrl)) {
                    return@postDelayed
                }
                triggerKulchaFloCookieConsentCompat(session, currentTabUrl, reason = "follow-up-$delayMs")
            },
            delayMs,
        )
    }

    private fun triggerKulchaFloCookieConsentCompat(
        session: GeckoSession,
        pageUrl: String,
        reason: String,
    ) {
        if (!KULCHAFLO_COOKIE_CONSENT_ACCEPT_ALL_AUTOCLICK_ENABLED) {
            return
        }
        val normalizedUrl = pageUrl.ifBlank { return }
        if (!isKulchaFloPage(normalizedUrl)) {
            return
        }
        val uri = runCatching { android.net.Uri.parse(normalizedUrl) }.getOrNull() ?: return
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty().lowercase().ifBlank { "/" }
        if (path == "/watch" || path.startsWith("/watch/") || isAdminOrBackendRoute(host, path)) {
            return
        }
        val pageUrlJson = JSONObject.quote(normalizedUrl)
        val reasonJson = JSONObject.quote(reason)
        val script = """
            javascript:(function(){
              try{
                var promptPrefix=${JSONObject.quote(PROMPT_PREFIX)};
                var pageUrl=$pageUrlJson;
                var phase=$reasonJson;
                var lower=function(v){return ((v||'')+'').replace(/\s+/g,' ').trim().toLowerCase();};
                var clean=function(v){return ((v||'')+'').replace(/\s+/g,' ').trim().slice(0,160);};
                var rect=function(node){
                  try{
                    var r=node.getBoundingClientRect();
                    return Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'x'+Math.round(r.height);
                  }catch(_){return '';}
                };
                var visible=function(node){
                  try{
                    if(!node){return false;}
                    var style=window.getComputedStyle(node);
                    if(style&&(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)){return false;}
                    var r=node.getBoundingClientRect();
                    return r.width>24&&r.height>18&&r.bottom>0&&r.right>0&&r.top<window.innerHeight&&r.left<window.innerWidth;
                  }catch(_){return false;}
                };
                var textOf=function(node){
                  try{
                    return lower(
                      (node.value||'')+' '+
                      ((node.getAttribute&&node.getAttribute('aria-label'))||'')+' '+
                      ((node.getAttribute&&node.getAttribute('title'))||'')+' '+
                      (node.innerText||node.textContent||'')
                    );
                  }catch(_){return '';}
                };
                var labelOf=function(node){
                  try{
                    return clean(
                      (node.value||'')+' '+
                      ((node.getAttribute&&node.getAttribute('aria-label'))||'')+' '+
                      ((node.getAttribute&&node.getAttribute('title'))||'')+' '+
                      (node.innerText||node.textContent||'')
                    );
                  }catch(_){return '';}
                };
                var emit=function(clicked,resultReason,panel,button){
                  try{
                    window.prompt(promptPrefix+JSON.stringify({
                      type:'kulchaflo-cookie-consent-autoclick',
                      phase:phase,
                      pageUrl:pageUrl,
                      clicked:!!clicked,
                      reason:resultReason||'',
                      panelRect:panel?rect(panel):'',
                      buttonRect:button?rect(button):'',
                      buttonText:button?labelOf(button):'',
                      panelText:panel?clean(panel.innerText||panel.textContent||''):''
                    }),'');
                  }catch(_){}
                };
                var collectNodes=function(selector,limit){
                  var out=[];
                  var seen=new Set();
                  var add=function(node){
                    try{
                      if(!node||seen.has(node)){return;}
                      seen.add(node);
                      if(!selector||node.matches&&node.matches(selector)){out.push(node);}
                    }catch(_){}
                  };
                  var walk=function(root){
                    if(!root||out.length>=limit){return;}
                    var nodes=[];
                    try{nodes=Array.from(root.querySelectorAll('*')).slice(0,1400);}catch(_){nodes=[];}
                    for(var i=0;i<nodes.length&&out.length<limit;i++){
                      var node=nodes[i];
                      add(node);
                      try{if(node.shadowRoot){walk(node.shadowRoot);}}catch(_){}
                    }
                  };
                  walk(document);
                  return out.slice(0,limit);
                };
                var parentOf=function(node){
                  try{
                    var parent=node&&node.parentElement;
                    if(parent){return parent;}
                    var raw=node&&node.parentNode;
                    if(raw&&raw.host){return raw.host;}
                  }catch(_){}
                  return null;
                };
                var classIdOf=function(node){
                  try{
                    return lower(((node.id||'')+' '+(node.className||'')+' '+((node.getAttribute&&node.getAttribute('data-cookiebanner'))||'')));
                  }catch(_){return '';}
                };
                var hasCookieContext=function(blob){
                  return blob.indexOf('cookieadmin')>=0 ||
                    blob.indexOf('cookie admin')>=0 ||
                    blob.indexOf('powered by cookieadmin')>=0 ||
                    blob.indexOf('cookie consent')>=0 ||
                    blob.indexOf('cookie notice')>=0 ||
                    blob.indexOf('cookie policy')>=0 ||
                    blob.indexOf('privacy policy')>=0 ||
                    blob.indexOf('we value your privacy')>=0 ||
                    blob.indexOf('we respect your privacy')>=0 ||
                    blob.indexOf('cookies help us')>=0 ||
                    blob.indexOf('uses cookies')>=0 ||
                    blob.indexOf('use cookies')>=0 ||
                    blob.indexOf('our cookies')>=0 ||
                    blob.indexOf('cookies on this')>=0 ||
                    (blob.indexOf('accept')>=0&&blob.indexOf('cookie')>=0) ||
                    (blob.indexOf('consent')>=0&&blob.indexOf('privacy')>=0);
                };
                var isBadAction=function(label){
                  return label.indexOf('reject')>=0 ||
                    label.indexOf('decline')>=0 ||
                    label.indexOf('deny')>=0 ||
                    label.indexOf('customize')>=0 ||
                    label.indexOf('customise')>=0 ||
                    label.indexOf('manage')>=0 ||
                    label.indexOf('settings')>=0 ||
                    label.indexOf('preference')>=0 ||
                    label.indexOf('essential')>=0 ||
                    label.indexOf('necessary')>=0 ||
                    label.indexOf('login')>=0 ||
                    label.indexOf('log in')>=0 ||
                    label.indexOf('sign up')>=0;
                };
                var actionScore=function(button){
                  var label=textOf(button);
                  if(!label||isBadAction(label)){return -1;}
                  if(label==='accept all cookies'||label==='allow all cookies'){return 100;}
                  if(label==='accept all'||label==='allow all'){return 95;}
                  if(label.indexOf('accept all')>=0||label.indexOf('allow all')>=0){return 90;}
                  if(label==='i agree'||label==='agree'){return 82;}
                  if(label==='consent'||label.indexOf('give consent')>=0){return 80;}
                  if(label==='accept'||label.indexOf('accept cookies')>=0){return 78;}
                  if(label==='got it'||label==='ok'||label==='okay'){return 60;}
                  if(label.indexOf('continue')>=0&&label.indexOf('cookie')>=0){return 45;}
                  return -1;
                };
                var buttonSelector='button,[role="button"],input[type="button"],input[type="submit"],a[href],[tabindex]';
                var findBestButtonInside=function(panel){
                  var best=null;
                  var bestScore=-1;
                  var nodes=[];
                  try{nodes=Array.from(panel.querySelectorAll(buttonSelector)).slice(0,160);}catch(_){nodes=[];}
                  for(var i=0;i<nodes.length;i++){
                    var node=nodes[i];
                    if(!visible(node)){continue;}
                    var score=actionScore(node);
                    if(score>bestScore){
                      best=node;
                      bestScore=score;
                    }
                  }
                  return bestScore>=0?best:null;
                };
                var panelScore=function(node){
                  if(!visible(node)){return -1;}
                  if(node.querySelector&&node.querySelector('video,source,canvas,iframe')){return -1;}
                  var blob=textOf(node);
                  var meta=classIdOf(node);
                  var context=hasCookieContext(blob)||hasCookieContext(meta)||meta.indexOf('cookie')>=0||meta.indexOf('consent')>=0||meta.indexOf('privacy')>=0||meta.indexOf('gdpr')>=0;
                  if(!context){return -1;}
                  var button=findBestButtonInside(node);
                  if(!button){return -1;}
                  var r=node.getBoundingClientRect();
                  var style=window.getComputedStyle(node);
                  var score=actionScore(button);
                  if(style&&(style.position==='fixed'||style.position==='sticky')){score+=20;}
                  if(r.width>Math.min(420,window.innerWidth*0.35)&&r.height>80){score+=8;}
                  if(r.bottom>window.innerHeight*0.45){score+=4;}
                  if(meta.indexOf('cookieadmin')>=0||meta.indexOf('cookie')>=0||meta.indexOf('consent')>=0){score+=10;}
                  return score;
                };
                var panels=collectNodes('[role="dialog"],[aria-modal="true"],section,aside,form,div,[class*="cookie"],[id*="cookie"],[class*="consent"],[id*="consent"],[class*="privacy"],[id*="privacy"],[class*="gdpr"],[id*="gdpr"],[class*="notice"],[id*="notice"],[class*="banner"],[id*="banner"]',1200);
                var bestButton=null;
                var bestPanel=null;
                var bestScore=-1;
                for(var p=0;p<panels.length;p++){
                  var panel=panels[p];
                  var score=panelScore(panel);
                  if(score>bestScore){
                    bestScore=score;
                    bestPanel=panel;
                    bestButton=findBestButtonInside(panel);
                  }
                }
                if(!bestPanel){
                  var buttons=collectNodes(buttonSelector,1200);
                  for(var j=0;j<buttons.length;j++){
                    var button=buttons[j];
                    if(!visible(button)||actionScore(button)<0){continue;}
                    var cur=button;
                    for(var depth=0;cur&&depth<12;depth++){
                      if(visible(cur)&&!(cur.querySelector&&cur.querySelector('video,source,canvas,iframe'))){
                        var blob=textOf(cur)+' '+classIdOf(cur);
                        if(hasCookieContext(blob)||blob.indexOf('cookie')>=0||blob.indexOf('consent')>=0||blob.indexOf('privacy')>=0||blob.indexOf('gdpr')>=0){
                          bestButton=button;
                          bestPanel=cur;
                          break;
                        }
                      }
                      cur=parentOf(cur);
                    }
                    if(bestPanel){break;}
                  }
                }
                if(!bestPanel){
                  var pageCookieBlob=textOf(document.body||document.documentElement);
                  var pageLooksLikeCookieAdmin=hasCookieContext(pageCookieBlob)&&
                    pageCookieBlob.indexOf('customize')>=0&&
                    pageCookieBlob.indexOf('reject all')>=0&&
                    pageCookieBlob.indexOf('accept all')>=0;
                  if(pageLooksLikeCookieAdmin){
                    var fallbackButtons=collectNodes(buttonSelector,1600);
                    var fallbackButton=null;
                    for(var f=0;f<fallbackButtons.length;f++){
                      var candidate=fallbackButtons[f];
                      if(!visible(candidate)){continue;}
                      var candidateLabel=textOf(candidate);
                      if(candidateLabel==='accept all'||candidateLabel==='accept all cookies'||candidateLabel==='allow all'||candidateLabel==='allow all cookies'){
                        fallbackButton=candidate;
                        break;
                      }
                    }
                    if(fallbackButton){
                      var fallbackPanel=fallbackButton;
                      for(var fd=0;fallbackPanel&&fd<10;fd++){
                        if(visible(fallbackPanel)){
                          var fpText=textOf(fallbackPanel);
                          if((fpText.indexOf('we respect your privacy')>=0||fpText.indexOf('cookies help us')>=0||fpText.indexOf('powered by cookieadmin')>=0)&&
                              fpText.indexOf('reject all')>=0&&fpText.indexOf('customize')>=0){
                            break;
                          }
                        }
                        fallbackPanel=parentOf(fallbackPanel);
                      }
                      bestButton=fallbackButton;
                      bestPanel=fallbackPanel||fallbackButton;
                    }
                  }
                }
                if(!bestPanel){
                  var pointX=Math.round((window.innerWidth||1280)*0.162);
                  var pointY=Math.round((window.innerHeight||720)*0.885);
                  var pointNode=null;
                  try{pointNode=document.elementFromPoint(pointX,pointY);}catch(_){pointNode=null;}
                  var pointButton=pointNode;
                  for(var pd=0;pointButton&&pd<6;pd++){
                    try{
                      if(pointButton.matches&&pointButton.matches(buttonSelector)){break;}
                    }catch(_){}
                    pointButton=parentOf(pointButton);
                  }
                  if(pointButton&&visible(pointButton)){
                    var pointLabel=textOf(pointButton);
                    var pointPage=textOf(document.body||document.documentElement);
                    if((pointLabel==='accept all'||pointLabel==='accept all cookies'||pointLabel==='allow all'||pointLabel==='allow all cookies')&&
                        pointPage.indexOf('we respect your privacy')>=0&&
                        pointPage.indexOf('reject all')>=0&&
                        pointPage.indexOf('customize')>=0){
                      bestButton=pointButton;
                      bestPanel=pointButton;
                      for(var pp=0;bestPanel&&pp<10;pp++){
                        var pText=textOf(bestPanel);
                        if(pText.indexOf('we respect your privacy')>=0&&pText.indexOf('reject all')>=0&&pText.indexOf('customize')>=0){break;}
                        bestPanel=parentOf(bestPanel);
                      }
                      bestPanel=bestPanel||pointButton;
                    }
                  }
                }
                if(!bestPanel){
                  emit(false,'no-cookie-panel-match',null,bestButton);
                  return;
                }
                emit(false,'scan',bestPanel,bestButton);
                if(!bestButton){
                  emit(false,'no-accept-all-button-match',bestPanel,null);
                  return;
                }
                try{bestButton.click();}catch(_){}
                emit(true,'clicked',bestPanel,bestButton);
              }catch(error){
                try{
                  window.prompt(${JSONObject.quote(PROMPT_PREFIX)}+JSON.stringify({
                    type:'kulchaflo-cookie-consent-autoclick',
                    phase:${JSONObject.quote(reason)},
                    pageUrl:${JSONObject.quote(normalizedUrl)},
                    clicked:false,
                    reason:'exception'
                  }),'');
                }catch(_){}
              }
            })();
        """.trimIndent()
        GvLogger.i(
            "GvExt",
            "kulchaflo cookie consent autoclick dispatched tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} reason=$reason url=$normalizedUrl"
        )
        session.loadUri(script)
    }

    private fun triggerYouTubeConsentCompat(session: GeckoSession, pageUrl: String, reason: String) {
        val normalizedUrl = pageUrl.ifBlank { return }
        if (!isGoogleVideoSurfaceUrl(normalizedUrl)) {
            return
        }
        val script = """
            javascript:(function(){
              try{
                var lower=function(v){return ((v||'')+'').replace(/\s+/g,' ').trim().toLowerCase();};
                var textOf=function(node){
                  try{return lower((node&&((node.innerText||node.textContent||node.value||'')+' '+((node.getAttribute&&node.getAttribute('aria-label'))||'')))||'');}
                  catch(_){return '';}
                };
                var visible=function(node){
                  try{
                    if(!node){return false;}
                    var style=window.getComputedStyle(node);
                    if(style&&(style.display==='none'||style.visibility==='hidden'||style.opacity==='0')){return false;}
                    var r=node.getBoundingClientRect();
                    return r.width>8&&r.height>8&&r.bottom>0&&r.right>0&&r.top<window.innerHeight&&r.left<window.innerWidth;
                  }catch(_){return false;}
                };
                var clickNode=function(node){
                  try{
                    if(!node){return false;}
                    try{node.scrollIntoView({block:'center',inline:'center'});}catch(_){}
                    if(!visible(node)){return false;}
                    try{
                      node.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,cancelable:true,view:window}));
                      node.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,view:window}));
                      node.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true,view:window}));
                    }catch(_){}
                    node.click();
                    return true;
                  }catch(_){return false;}
                };
                var centerOf=function(node){
                  try{
                    if(!node){return null;}
                    var r=node.getBoundingClientRect();
                    return {x:Math.round((r.left+r.right)/2),y:Math.round((r.top+r.bottom)/2)};
                  }catch(_){return null;}
                };
                var isConsentPage=function(){
                  var blob=lower((document.body&&document.body.innerText)||'');
                  return blob.indexOf('before you continue to youtube')>=0||
                    (blob.indexOf('we use cookies')>=0&&blob.indexOf('youtube')>=0)||
                    blob.indexOf('accept all')>=0||
                    blob.indexOf('reject all')>=0;
                };
                var controls=function(){
                  return Array.from(document.querySelectorAll('button,[role="button"],tp-yt-paper-button,ytd-button-renderer,a[role="button"],input[type="button"],input[type="submit"]')).slice(0,220);
                };
                var findAction=function(){
                  var preferred=['accept all','reject all','i agree','agree'];
                  var nodes=controls();
                  for(var p=0;p<preferred.length;p++){
                    for(var i=0;i<nodes.length;i++){
                      var node=nodes[i];
                      var blob=textOf(node);
                      if(blob.indexOf(preferred[p])>=0){return node;}
                    }
                  }
                  return null;
                };
                var scrollConsentContainers=function(){
                  var changed=false;
                  try{
                    var roots=Array.from(document.querySelectorAll('[role="dialog"],[aria-modal="true"],tp-yt-paper-dialog,yt-confirm-dialog-renderer,ytd-popup-container,form,main,body')).slice(0,80);
                    roots.unshift(document.body,document.documentElement);
                    roots.forEach(function(root){
                      try{
                        if(!root){return;}
                        var blob=textOf(root);
                        if(blob.indexOf('before you continue')<0&&blob.indexOf('we use cookies')<0&&blob.indexOf('accept all')<0&&blob.indexOf('reject all')<0){return;}
                        var nodes=[root].concat(root.querySelectorAll?Array.from(root.querySelectorAll('*')).slice(0,260):[]);
                        nodes.forEach(function(node){
                          try{
                            if(node.scrollHeight>node.clientHeight+2){
                              var before=node.scrollTop;
                              node.scrollTop=node.scrollHeight;
                              if(node.scrollTop!==before){changed=true;}
                            }
                          }catch(_){}
                        });
                      }catch(_){}
                    });
                  }catch(_){}
                  return changed;
                };
                if(!isConsentPage()){return;}
                var clicked=false;
                var action=findAction();
                if(action){clicked=clickNode(action);}
                if(!clicked){
                  scrollConsentContainers();
                  setTimeout(function(){
                    try{
                      var delayed=findAction();
                      var delayedCenter=delayed?centerOf(delayed):null;
                      var delayedClicked=delayed?clickNode(delayed):false;
                      window.prompt("__GV_MEDIA__"+JSON.stringify({
                        type:'youtube-consent',
                        phase:'activity-youtube-consent',
                        pageUrl:window.location.href,
                        reason:${JSONObject.quote(reason)},
                        clicked:!!delayedClicked,
                        scrolled:true,
                        matched:delayed?textOf(delayed).slice(0,80):'',
                        actionX:delayedCenter?delayedCenter.x:-1,
                        actionY:delayedCenter?delayedCenter.y:-1
                      }), '');
                    }catch(_){}
                  },280);
                }
                var center=action?centerOf(action):null;
                window.prompt("__GV_MEDIA__"+JSON.stringify({
                  type:'youtube-consent',
                  phase:'activity-youtube-consent',
                  pageUrl:window.location.href,
                  reason:${JSONObject.quote(reason)},
                  clicked:!!clicked,
                  scrolled:false,
                  matched:action?textOf(action).slice(0,80):'',
                  actionX:center?center.x:-1,
                  actionY:center?center.y:-1
                }), '');
              }catch(_){}
            })();
        """.trimIndent()
        session.loadUri(script)
        GvLogger.i(
            "GvExt",
            "youtube consent compat dispatched tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} reason=$reason url=$normalizedUrl"
        )
    }

    private fun maybeDispatchYouTubeConsentCompat(
        session: GeckoSession,
        pageUrl: String,
        reason: String,
    ) {
        if (!isYouTubeConsentPageUrl(pageUrl)) {
            return
        }
        triggerYouTubeConsentCompat(session, pageUrl, reason)
    }

    private fun maybeDispatchYouTubeConsentNativeTap(
        session: GeckoSession,
        actionX: Float,
        actionY: Float,
        matched: String,
        reason: String,
    ) {
        if (actionX < 0f || actionY < 0f) {
            return
        }
        val activeUrl = tabController.findTabBySession(session)?.url.orEmpty()
        if (!isGoogleVideoSurfaceUrl(activeUrl)) {
            return
        }
        val normalizedMatch = matched.lowercase()
        val isConsentAction = normalizedMatch.contains("accept all") ||
            normalizedMatch.contains("reject all") ||
            normalizedMatch.contains("i agree") ||
            normalizedMatch == "agree"
        if (!isConsentAction) {
            return
        }
        val now = SystemClock.uptimeMillis()
        val lastTap = youtubeConsentNativeTapLastMsBySession[session] ?: 0L
        if (now - lastTap < 1400L) {
            return
        }
        youtubeConsentNativeTapLastMsBySession[session] = now
        val clampedX = actionX.coerceIn(1f, (geckoView.width - 1).coerceAtLeast(1).toFloat())
        val clampedY = actionY.coerceIn(1f, (geckoView.height - 1).coerceAtLeast(1).toFloat())
        pointerHandler.postDelayed(
            {
                if (isFinishing || isDestroyed) {
                    return@postDelayed
                }
                val tab = tabController.findTabBySession(session) ?: return@postDelayed
                if (!isGoogleVideoSurfaceUrl(tab.url)) {
                    return@postDelayed
                }
                val handled = dispatchNativeMouseTapAt(clampedX, clampedY, "youtube-consent-$reason")
                GvLogger.i(
                    "GvInput",
                    "youtube consent native tap reason=$reason matched=$matched x=${clampedX.toInt()} y=${clampedY.toInt()} handled=$handled"
                )
            },
            160L,
        )
    }

    // ─── YouTube native coordinate fullscreen (media-ready policy) ────────────

    private fun armYouTubeAutoFullscreen(session: GeckoSession, pageUrl: String) {
        val currentArmed = youtubeAutoFsArmedUrlBySession[session]
        if (!isYouTubePageUrl(pageUrl)) {
            if (currentArmed != null) {
                stopYouTubeAutoFullscreen(session, reason = "not-youtube", oldUrl = currentArmed)
            }
            GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=not-youtube url=$pageUrl")
            return
        }
        if (!isYouTubeWatchOrLivePageUrl(pageUrl)) {
            if (currentArmed != null) {
                stopYouTubeAutoFullscreen(session, reason = "not-watch-live", oldUrl = currentArmed)
            }
            GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=not-watch-live url=$pageUrl")
            return
        }
        if (isYouTubeAutoFullscreenSuppressed(session, pageUrl)) {
            if (currentArmed != null) {
                stopYouTubeAutoFullscreen(session, reason = "suppressed-after-back", oldUrl = currentArmed)
            }
            GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=suppressed-after-back url=$pageUrl")
            return
        }
        if (youtubeFullscreenStateBySession[session] == true) {
            stopYouTubeAutoFullscreen(session, reason = "already-fullscreen", oldUrl = currentArmed)
            GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=already-fullscreen url=$pageUrl")
            return
        }
        if (currentArmed == pageUrl) {
            return
        }
        if (currentArmed != null) {
            stopYouTubeAutoFullscreen(session, reason = "url-changed", oldUrl = currentArmed, newUrl = pageUrl)
        }
        youtubeAutoFsArmedUrlBySession[session] = pageUrl
        youtubeAutoFsAttemptCountBySession[session] = 0
        youtubeAutoFsMediaReadyBySession.remove(session)
        youtubeAutoFsTargetProbePassBySession.remove(session)
        youtubeAutoFsTargetProbeRetryRunnableBySession.remove(session)?.also { pointerHandler.removeCallbacks(it) }
        youtubeAutoFsOverlayDeferralCountBySession.remove(session)
        GvLogger.i("GvInput", "youtube-native-fullscreen-arm url=$pageUrl reason=watch-live-ready attempt=1")
        val fallback = Runnable {
            if (isFinishing || isDestroyed) return@Runnable
            if (youtubeAutoFsArmedUrlBySession[session] != pageUrl) return@Runnable
            if (youtubeFullscreenStateBySession[session] == true) return@Runnable
            if (youtubeAutoFsMediaReadyBySession.contains(session)) return@Runnable
            val attempts = youtubeAutoFsAttemptCountBySession[session] ?: 0
            if (attempts >= YOUTUBE_AUTO_FULLSCREEN_MAX_ATTEMPTS) {
                GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=max-attempts url=$pageUrl")
                return@Runnable
            }
            val nextAttempt = attempts + 1
            youtubeAutoFsPendingRunnableBySession.remove(session)?.also { pointerHandler.removeCallbacks(it) }
            scheduleYouTubeAutoFullscreenAttempt(session, pageUrl, nextAttempt, 0L, reason = "absolute-fallback")
        }
        youtubeAutoFsFallbackRunnableBySession[session] = fallback
        pointerHandler.postDelayed(fallback, YOUTUBE_AUTO_FULLSCREEN_ABSOLUTE_FALLBACK_MS)
    }

    private fun isYouTubeAutoFullscreenSuppressed(session: GeckoSession, pageUrl: String): Boolean {
        val suppressedUrl = youtubeAutoFsSuppressedUrlBySession[session] ?: return false
        val suppressedUntil = youtubeAutoFsSuppressedUntilBySession[session] ?: return false
        val now = SystemClock.uptimeMillis()
        if (suppressedUntil <= now) {
            youtubeAutoFsSuppressedUrlBySession.remove(session)
            youtubeAutoFsSuppressedUntilBySession.remove(session)
            return false
        }
        if (suppressedUrl != pageUrl) {
            return false
        }
        return true
    }

    private fun suppressYouTubeAutoFullscreenAfterBack(
        session: GeckoSession,
        pageUrl: String,
        reason: String,
        durationMs: Long = YOUTUBE_AUTO_FULLSCREEN_SUPPRESS_AFTER_BACK_MS,
    ) {
        if (!isYouTubeWatchOrLivePageUrl(pageUrl)) {
            return
        }
        val untilMs = SystemClock.uptimeMillis() + durationMs
        youtubeAutoFsSuppressedUrlBySession[session] = pageUrl
        youtubeAutoFsSuppressedUntilBySession[session] = untilMs
        GvLogger.i(
            "GvInput",
            "youtube-back-suppress-autofullscreen reason=$reason url=$pageUrl durationMs=$durationMs"
        )
    }

    private fun isChtvFullscreenAssistSuppressed(session: GeckoSession, pageUrl: String): Boolean {
        return chtvFullscreenAssistSuppressedUrlBySession[session] == pageUrl
    }

    private fun isCaribvisionFullscreenAssistSuppressed(session: GeckoSession, pageUrl: String): Boolean {
        return caribvisionFullscreenAssistSuppressedUrlBySession[session] == pageUrl
    }

    private fun suppressChtvFullscreenAssistAfterBack(
        session: GeckoSession,
        pageUrl: String,
        reason: String,
    ) {
        if (!isChtvContextUrl(pageUrl)) {
            return
        }
        chtvFullscreenAssistSuppressedUrlBySession[session] = pageUrl
        session.loadUri(
            "javascript:(function(){try{window.__kfChtvFullscreenAssistSuppressedUrl=window.location.href;}catch(_){}})();"
        )
        GvLogger.i(
            "GvInput",
            "chtv-back-suppress-autofullscreen reason=$reason url=$pageUrl"
        )
    }

    private fun suppressCaribvisionFullscreenAssistAfterBack(
        session: GeckoSession,
        pageUrl: String,
        reason: String,
    ) {
        if (!isCaribVisionAppUrl(pageUrl)) {
            return
        }
        caribvisionFullscreenAssistSuppressedUrlBySession[session] = pageUrl
        session.loadUri(
            "javascript:(function(){try{window.__kfCaribvisionFullscreenAssistSuppressedUrl=window.location.href;}catch(_){}})();"
        )
        GvLogger.i(
            "GvInput",
            "caribvision-back-suppress-autofullscreen reason=$reason url=$pageUrl"
        )
    }

    private fun cancelPendingYouTubeHelpersForBack(session: GeckoSession, pageUrl: String): String {
        val cancelled = mutableListOf<String>()
        fun cancelRunnable(name: String, runnable: Runnable?) {
            if (runnable != null) {
                pointerHandler.removeCallbacks(runnable)
                cancelled.add(name)
            }
        }

        cancelRunnable("auto-pending", youtubeAutoFsPendingRunnableBySession.remove(session))
        cancelRunnable("auto-fallback", youtubeAutoFsFallbackRunnableBySession.remove(session))
        cancelRunnable("auto-callback-check", youtubeAutoFsCallbackCheckRunnableBySession.remove(session))
        cancelRunnable("auto-target-fallback", youtubeAutoFsTargetProbeFallbackRunnableBySession.remove(session))
        cancelRunnable("auto-target-retry", youtubeAutoFsTargetProbeRetryRunnableBySession.remove(session))
        if (youtubeAutoFsTargetProbeTokenBySession.remove(session) != null) cancelled.add("auto-target-token")
        if (youtubeAutoFsTargetProbePassBySession.remove(session) != null) cancelled.add("auto-target-pass")
        if (youtubeAutoFsOverlayDeferralCountBySession.remove(session) != null) cancelled.add("auto-overlay-deferrals")
        if (youtubeAutoFsArmedUrlBySession.remove(session) != null) cancelled.add("auto-armed-url")
        if (youtubeAutoFsAttemptCountBySession.remove(session) != null) cancelled.add("auto-attempt-count")
        if (youtubeAutoFsMediaReadyBySession.remove(session)) cancelled.add("auto-media-ready")

        cancelRunnable("quality-pending", youtubeQualityPendingRunnableBySession.remove(session))
        if (youtubeQualityFollowUpQueuedUrlBySession.remove(session) != null) cancelled.add("quality-followup")

        val premiumPending = youtubePremiumPopupPendingRunnablesBySession.remove(session)
        if (!premiumPending.isNullOrEmpty()) {
            premiumPending.forEach { pointerHandler.removeCallbacks(it) }
            cancelled.add("premium-pending-${premiumPending.size}")
        }
        if (youtubePremiumPopupPendingWindowBySession.remove(session) != null) cancelled.add("premium-window")
        if (youtubePremiumPopupCheckCountBySessionWindow.remove(session) != null) cancelled.add("premium-window-counts")
        if (youtubePremiumPopupLastInteractionBurstMsBySession.remove(session) != null) cancelled.add("premium-burst")

        if (cancelled.isEmpty()) {
            cancelled.add("none")
        }
        val cancelledValue = cancelled.joinToString(",")
        GvLogger.i("GvInput", "youtube-back-cancel helpers reason=back-pressed url=$pageUrl cancelled=$cancelledValue")
        return cancelledValue
    }

    private fun stopYouTubeAutoFullscreen(
        session: GeckoSession,
        reason: String,
        oldUrl: String? = null,
        newUrl: String? = null,
    ) {
        val armed = youtubeAutoFsArmedUrlBySession.remove(session) ?: oldUrl ?: return
        youtubeAutoFsAttemptCountBySession.remove(session)
        youtubeAutoFsMediaReadyBySession.remove(session)
        youtubeAutoFsPendingRunnableBySession.remove(session)?.also { pointerHandler.removeCallbacks(it) }
        youtubeAutoFsFallbackRunnableBySession.remove(session)?.also { pointerHandler.removeCallbacks(it) }
        youtubeAutoFsCallbackCheckRunnableBySession.remove(session)?.also { pointerHandler.removeCallbacks(it) }
        youtubeAutoFsTargetProbeTokenBySession.remove(session)
        youtubeAutoFsTargetProbeFallbackRunnableBySession.remove(session)?.also { pointerHandler.removeCallbacks(it) }
        youtubeAutoFsTargetProbeRetryRunnableBySession.remove(session)?.also { pointerHandler.removeCallbacks(it) }
        youtubeAutoFsTargetProbePassBySession.remove(session)
        youtubeAutoFsOverlayDeferralCountBySession.remove(session)
        val msg = buildString {
            append("youtube-native-fullscreen-stop reason=$reason url=$armed")
            if (newUrl != null) append(" newUrl=$newUrl")
        }
        GvLogger.i("GvInput", msg)
    }

    private fun onYouTubeMediaReady(session: GeckoSession) {
        val pageUrl = youtubeAutoFsArmedUrlBySession[session] ?: return
        maybeScheduleYouTubeQualityHelper(session, pageUrl, reason = "media-play", delayMs = 1200L)
        if (youtubeFullscreenStateBySession[session] == true) {
            GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=already-fullscreen url=$pageUrl")
            stopYouTubeAutoFullscreen(session, reason = "already-fullscreen")
            return
        }
        if (youtubeAutoFsMediaReadyBySession.contains(session)) return
        youtubeAutoFsMediaReadyBySession.add(session)
        val attempt = (youtubeAutoFsAttemptCountBySession[session] ?: 0) + 1
        if (attempt > YOUTUBE_AUTO_FULLSCREEN_MAX_ATTEMPTS) {
            GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=max-attempts url=$pageUrl")
            stopYouTubeAutoFullscreen(session, reason = "max-attempts")
            return
        }
        scheduleYouTubeAutoFullscreenAttempt(
            session = session,
            pageUrl = pageUrl,
            attempt = attempt,
            delayMs = YOUTUBE_AUTO_FULLSCREEN_AFTER_MEDIA_READY_MS,
            reason = "media-ready",
        )
    }

    private fun scheduleYouTubeAutoFullscreenAttempt(
        session: GeckoSession,
        pageUrl: String,
        attempt: Int,
        delayMs: Long,
        reason: String,
    ) {
        youtubeAutoFsPendingRunnableBySession.remove(session)?.also { pointerHandler.removeCallbacks(it) }
        val r = Runnable {
            if (isFinishing || isDestroyed) return@Runnable
            val armed = youtubeAutoFsArmedUrlBySession[session]
            if (armed != pageUrl) {
                GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=url-changed expected=$pageUrl actual=${armed.orEmpty()}")
                return@Runnable
            }
            if (youtubeFullscreenStateBySession[session] == true) {
                GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=already-fullscreen url=$pageUrl")
                stopYouTubeAutoFullscreen(session, reason = "already-fullscreen")
                return@Runnable
            }
            youtubeAutoFsPendingRunnableBySession.remove(session)
            runYouTubeAutoFullscreenAttempt(session, pageUrl, attempt, reason)
        }
        youtubeAutoFsPendingRunnableBySession[session] = r
        pointerHandler.postDelayed(r, delayMs)
    }

    private fun resolveYouTubeNativeTapPoint(xRatio: Float, yRatio: Float, fallbackX: Float, fallbackY: Float): Pair<Float, Float> {
        val width = geckoView.width.takeIf { it > 0 } ?: 1920
        val height = geckoView.height.takeIf { it > 0 } ?: 1080
        val x = (width * xRatio).takeIf { it.isFinite() && it > 0f } ?: fallbackX
        val y = (height * yRatio).takeIf { it.isFinite() && it > 0f } ?: fallbackY
        return x.coerceIn(1f, (width - 1).coerceAtLeast(1).toFloat()) to
            y.coerceIn(1f, (height - 1).coerceAtLeast(1).toFloat())
    }

    private fun runYouTubeAutoFullscreenAttempt(
        session: GeckoSession,
        pageUrl: String,
        attempt: Int,
        reason: String,
    ) {
        val tab = tabController.findTabBySession(session)
        if (tab == null) {
            GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=url-changed expected=$pageUrl actual=tab-missing")
            stopYouTubeAutoFullscreen(session, reason = "url-changed", oldUrl = pageUrl)
            return
        }
        val activeUrl = tab.url
        if (activeUrl != pageUrl) {
            GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=url-changed expected=$pageUrl actual=$activeUrl")
            stopYouTubeAutoFullscreen(session, reason = "url-changed", oldUrl = pageUrl, newUrl = activeUrl)
            return
        }
        if (!isYouTubeWatchOrLivePageUrl(activeUrl)) {
            GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=not-watch-live url=$activeUrl")
            stopYouTubeAutoFullscreen(session, reason = "not-watch-live", oldUrl = activeUrl)
            return
        }
        if (promotedMediaPlayer.isPromoted()) {
            GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=promoted-native-active url=$activeUrl")
            return
        }
        if (youtubeFullscreenStateBySession[session] == true || isBrowserFullscreenLikeState(tab)) {
            GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=already-fullscreen url=$activeUrl")
            stopYouTubeAutoFullscreen(session, reason = "already-fullscreen")
            return
        }
        if (attempt > YOUTUBE_AUTO_FULLSCREEN_MAX_ATTEMPTS) {
            GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=max-attempts url=$activeUrl")
            stopYouTubeAutoFullscreen(session, reason = "max-attempts", oldUrl = activeUrl)
            return
        }
        youtubeAutoFsAttemptCountBySession[session] = attempt
        val (controlsX, controlsY) = resolveYouTubeNativeTapPoint(
            xRatio = YOUTUBE_FULLSCREEN_CONTROLS_REVEAL_X_RATIO,
            yRatio = YOUTUBE_FULLSCREEN_CONTROLS_REVEAL_Y_RATIO,
            fallbackX = YOUTUBE_FULLSCREEN_CONTROLS_REVEAL_X_FALLBACK,
            fallbackY = YOUTUBE_FULLSCREEN_CONTROLS_REVEAL_Y_FALLBACK,
        )
        val (buttonX, buttonY) = resolveYouTubeNativeTapPoint(
            xRatio = YOUTUBE_FULLSCREEN_BUTTON_X_RATIO,
            yRatio = YOUTUBE_FULLSCREEN_BUTTON_Y_RATIO,
            fallbackX = YOUTUBE_FULLSCREEN_BUTTON_X_FALLBACK,
            fallbackY = YOUTUBE_FULLSCREEN_BUTTON_Y_FALLBACK,
        )
        val revealHandled = dispatchNativeMouseHoverAt(controlsX, controlsY, "youtube-native-fullscreen-controls-reveal")
        GvLogger.i(
            "GvInput",
            "youtube-native-fullscreen-controls-hover x=${controlsX.toInt()} y=${controlsY.toInt()} attempt=$attempt reason=$reason handled=$revealHandled"
        )
        pointerHandler.postDelayed(
            {
                if (isFinishing || isDestroyed) {
                    return@postDelayed
                }
                val currentArmed = youtubeAutoFsArmedUrlBySession[session]
                val currentTab = tabController.findTabBySession(session)
                val currentUrl = currentTab?.url.orEmpty()
                if (currentArmed != pageUrl || currentUrl != pageUrl) {
                    GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=url-changed expected=$pageUrl actual=$currentUrl")
                    return@postDelayed
                }
                if (youtubeFullscreenStateBySession[session] == true || (currentTab != null && isBrowserFullscreenLikeState(currentTab))) {
                    GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=already-fullscreen url=$currentUrl")
                    stopYouTubeAutoFullscreen(session, reason = "already-fullscreen")
                    return@postDelayed
                }
                dispatchYouTubeNativeFullscreenTargetProbe(
                    session = session,
                    pageUrl = pageUrl,
                    attempt = attempt,
                    probePass = 1,
                    reason = reason,
                    fallbackX = buttonX,
                    fallbackY = buttonY,
                )
            },
            YOUTUBE_AUTO_FULLSCREEN_CONTROLS_REVEAL_TO_BUTTON_DELAY_MS,
        )
    }

    private fun dispatchYouTubeNativeFullscreenTargetProbe(
        session: GeckoSession,
        pageUrl: String,
        attempt: Int,
        probePass: Int,
        reason: String,
        fallbackX: Float,
        fallbackY: Float,
    ) {
        youtubeAutoFsTargetProbeRetryRunnableBySession.remove(session)?.also { pointerHandler.removeCallbacks(it) }
        youtubeAutoFsTargetProbeFallbackRunnableBySession.remove(session)?.also { pointerHandler.removeCallbacks(it) }
        val probeToken = "fs-$attempt-${SystemClock.uptimeMillis()}"
        youtubeAutoFsTargetProbeTokenBySession[session] = probeToken
        youtubeAutoFsTargetProbePassBySession[session] = probePass
        val fallbackRunnable = Runnable {
            if (isFinishing || isDestroyed) return@Runnable
            val activeToken = youtubeAutoFsTargetProbeTokenBySession[session] ?: return@Runnable
            if (activeToken != probeToken) return@Runnable
            handleYouTubeNativeFullscreenTargetProbeMiss(
                session = session,
                pageUrl = pageUrl,
                attempt = attempt,
                probePass = probePass,
                reason = "target-timeout",
                token = probeToken,
                fallbackX = fallbackX,
                fallbackY = fallbackY,
            )
        }
        youtubeAutoFsTargetProbeFallbackRunnableBySession[session] = fallbackRunnable
        pointerHandler.postDelayed(fallbackRunnable, YOUTUBE_AUTO_FULLSCREEN_TARGET_PROBE_TIMEOUT_MS)
        GvLogger.i(
            "GvInput",
            "youtube-native-fullscreen-target probe-dispatched attempt=$attempt probePass=$probePass timeoutMs=$YOUTUBE_AUTO_FULLSCREEN_TARGET_PROBE_TIMEOUT_MS reason=$reason"
        )

        val script = """
            javascript:(function(){
              try{
                var promptPrefix=${JSONObject.quote(PROMPT_PREFIX)};
                var probeToken=${JSONObject.quote(probeToken)};
                var attempt=${attempt};
                var probePass=${probePass};
                var visible=function(node){
                  try{
                    if(!node||node.disabled){return false;}
                    var style=getComputedStyle(node);
                    if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity||1)<0.05){return false;}
                    var r=node.getBoundingClientRect();
                    if(r.width<12||r.height<12){return false;}
                    if(r.right<0||r.bottom<0||r.left>window.innerWidth||r.top>window.innerHeight){return false;}
                    return true;
                  }catch(_){return false;}
                };
                var selectors=[
                  '.ytp-fullscreen-button',
                  'button.ytp-fullscreen-button',
                  'button[aria-label*="Full screen" i]',
                  'button[title*="Full screen" i]',
                  'button[aria-label*="fullscreen" i]',
                  'button[title*="fullscreen" i]'
                ];
                var firstNode=function(selList){
                  for(var si=0;si<selList.length;si++){
                    var node=document.querySelector(selList[si]);
                    if(node){return node;}
                  }
                  return null;
                };
                var controlsBar=document.querySelector('.ytp-chrome-bottom');
                var controlsVisible=visible(controlsBar);
                var skipAdVisible=(
                  visible(document.querySelector('.ytp-ad-skip-button'))||
                  visible(document.querySelector('.ytp-ad-skip-button-modern'))||
                  visible(document.querySelector('button[aria-label*="skip" i]'))||
                  visible(document.querySelector('[title*="skip" i]'))
                );
                var adVisible=(
                  visible(document.querySelector('.ytp-ad-player-overlay'))||
                  skipAdVisible||
                  visible(document.querySelector('.video-ads'))||
                  visible(document.querySelector('.ytp-ad-module'))
                );
                var normalizeLabel=function(value){
                  return String(value||'').replace(/\\s+/g,' ').trim().toLowerCase();
                };
                var collectLabel=function(node){
                  if(!node){return '';}
                  var primary='';
                  var attrs=[node.getAttribute&&node.getAttribute('aria-label'),node.getAttribute&&node.getAttribute('title'),node.getAttribute&&node.getAttribute('value')];
                  for(var ai=0;ai<attrs.length;ai++){
                    if(attrs[ai]&&String(attrs[ai]).trim()){
                      primary=String(attrs[ai]);
                      break;
                    }
                  }
                  if(!primary){
                    primary=String(node.innerText||node.textContent||'');
                  }
                  if(!primary){
                    var closest=node.closest&&node.closest('button,[role="button"],tp-yt-paper-button,yt-button-shape,a[role="button"]');
                    if(closest&&closest!==node){
                      primary=String(closest.innerText||closest.textContent||closest.getAttribute&&closest.getAttribute('aria-label')||'');
                    }
                  }
                  return primary;
                };
                var collectContextText=function(node){
                  var cursor=node;
                  for(var depth=0;cursor&&depth<8;depth++){
                    if(visible(cursor)){
                      var txt=String(cursor.innerText||cursor.textContent||'').replace(/\\s+/g,' ').trim();
                      if(txt.length>0){return txt.slice(0,320);}
                    }
                    cursor=cursor.parentElement;
                  }
                  return '';
                };
                var premiumVisible=(function(){
                  var premiumSelectors=[
                    'ytd-mealbar-promo-renderer',
                    'tp-yt-paper-dialog',
                    'ytd-popup-container',
                    '.ytp-paid-content-overlay'
                  ];
                  for(var pi=0;pi<premiumSelectors.length;pi++){
                    var pn=document.querySelector(premiumSelectors[pi]);
                    if(!visible(pn)){continue;}
                    var txt=((pn.innerText||pn.textContent||'').replace(/\\s+/g,' ').trim()).toLowerCase();
                    if(txt.indexOf('youtube premium')>=0||txt.indexOf('without the ads')>=0||txt.indexOf('get premium')>=0){
                      return true;
                    }
                  }
                  return false;
                })();
                var premiumNegativeButtonFound=false;
                var premiumNegativeButtonCenterX=-1;
                var premiumNegativeButtonCenterY=-1;
                var premiumNegativeButtonLabel='';
                var premiumNegativeButtonReason='';
                var premiumContextText='';
                var negativeMatchers=['no thanks','not now','maybe later','dismiss'];
                var positiveMatchers=['1 month free','try it free','start trial','subscribe','premium','get premium','buy','join','skip','skip ads'];
                var premiumContextRe=/(youtube premium|get youtube without the ads|without the ads|premium)/i;
                var clickableSelector='button,[role="button"],tp-yt-paper-button,yt-button-shape button,yt-button-shape,a[role="button"],.yt-spec-button-shape-next,.yt-spec-button-shape-next__button-text-content';
                var rawButtons=Array.from(document.querySelectorAll(clickableSelector));
                for(var bi=0;bi<rawButtons.length;bi++){
                  var raw=rawButtons[bi];
                  var btn=(raw.closest&&raw.closest('button,[role="button"],tp-yt-paper-button,yt-button-shape,a[role="button"]'))||raw;
                  if(!visible(btn)){continue;}
                  var labelRaw=collectLabel(btn);
                  var label=normalizeLabel(labelRaw);
                  if(!label){continue;}
                  var negative=false;
                  for(var ni=0;ni<negativeMatchers.length;ni++){
                    if(label===negativeMatchers[ni]||label.indexOf(negativeMatchers[ni])>=0){
                      negative=true;
                      break;
                    }
                  }
                  if(!negative){continue;}
                  var positive=false;
                  for(var pi=0;pi<positiveMatchers.length;pi++){
                    if(label===positiveMatchers[pi]||label.indexOf(positiveMatchers[pi])>=0){
                      positive=true;
                      break;
                    }
                  }
                  if(positive){continue;}
                  var br=btn.getBoundingClientRect();
                  if(!br||br.width<12||br.height<12){continue;}
                  var bx=Math.round((br.left+br.right)/2);
                  var by=Math.round((br.top+br.bottom)/2);
                  var contextText=collectContextText(btn);
                  var contextMatch=premiumContextRe.test(contextText||'');
                  var zoneMatch=(label==='no thanks'&&bx<Math.round((window.innerWidth||0)*0.45)&&by>Math.round((window.innerHeight||0)*0.50));
                  if(!contextMatch&&!zoneMatch){continue;}
                  premiumNegativeButtonFound=true;
                  premiumNegativeButtonCenterX=bx;
                  premiumNegativeButtonCenterY=by;
                  premiumNegativeButtonLabel=labelRaw||label;
                  premiumNegativeButtonReason=contextMatch?'context-match':'zone-match';
                  premiumContextText=(contextText||'').slice(0,200);
                  break;
                }
                if(premiumNegativeButtonFound){premiumVisible=true;}
                var buttonExists=!!firstNode(selectors);
                var target=null;
                for(var s=0;s<selectors.length;s++){
                  var nodes=Array.from(document.querySelectorAll(selectors[s]));
                  for(var i=0;i<nodes.length;i++){
                    var node=nodes[i];
                    if(visible(node)){target=node;break;}
                  }
                  if(target){break;}
                }
                var buttonVisible=!!target;
                var debugButton=target||firstNode(selectors);
                var debugRect=debugButton?debugButton.getBoundingClientRect():null;
                if(!target){
                  window.prompt(promptPrefix+JSON.stringify({
                    type:'youtube-native-fullscreen-target',
                    action:'skipped',
                    reason:'no-visible-button',
                    probeToken:probeToken,
                    attempt:attempt,
                    probePass:probePass,
                    pageUrl:window.location.href,
                    centerX:-1,centerY:-1,
                    left:debugRect?Math.round(debugRect.left):-1,
                    top:debugRect?Math.round(debugRect.top):-1,
                    right:debugRect?Math.round(debugRect.right):-1,
                    bottom:debugRect?Math.round(debugRect.bottom):-1,
                    width:debugRect?Math.round(debugRect.width):-1,
                    height:debugRect?Math.round(debugRect.height):-1,
                    buttonExists:buttonExists,
                    buttonVisible:buttonVisible,
                    controlsVisible:controlsVisible,
                    adVisible:adVisible,
                    skipAdVisible:skipAdVisible,
                    premiumVisible:premiumVisible,
                    premiumNegativeButtonFound:premiumNegativeButtonFound,
                    premiumNegativeButtonCenterX:premiumNegativeButtonCenterX,
                    premiumNegativeButtonCenterY:premiumNegativeButtonCenterY,
                    premiumNegativeButtonLabel:premiumNegativeButtonLabel,
                    premiumNegativeButtonReason:premiumNegativeButtonReason,
                    premiumContextText:premiumContextText,
                    viewportWidth:Math.round(window.innerWidth||0),
                    viewportHeight:Math.round(window.innerHeight||0),
                    devicePixelRatio:Number(window.devicePixelRatio||1)
                  }),'');
                  return;
                }
                var r=target.getBoundingClientRect();
                var cx=Math.round((r.left+r.right)/2);
                var cy=Math.round((r.top+r.bottom)/2);
                window.prompt(promptPrefix+JSON.stringify({
                  type:'youtube-native-fullscreen-target',
                  action:'measured',
                  reason:${JSONObject.quote(reason)},
                  probeToken:probeToken,
                  attempt:attempt,
                  probePass:probePass,
                  pageUrl:window.location.href,
                  centerX:cx,centerY:cy,
                  left:Math.round(r.left),top:Math.round(r.top),right:Math.round(r.right),bottom:Math.round(r.bottom),
                  width:Math.round(r.width),height:Math.round(r.height),
                  buttonExists:true,
                  buttonVisible:true,
                  controlsVisible:controlsVisible,
                  adVisible:adVisible,
                  skipAdVisible:skipAdVisible,
                  premiumVisible:premiumVisible,
                  premiumNegativeButtonFound:premiumNegativeButtonFound,
                  premiumNegativeButtonCenterX:premiumNegativeButtonCenterX,
                  premiumNegativeButtonCenterY:premiumNegativeButtonCenterY,
                  premiumNegativeButtonLabel:premiumNegativeButtonLabel,
                  premiumNegativeButtonReason:premiumNegativeButtonReason,
                  premiumContextText:premiumContextText,
                  viewportWidth:Math.round(window.innerWidth||0),
                  viewportHeight:Math.round(window.innerHeight||0),
                  devicePixelRatio:Number(window.devicePixelRatio||1)
                }),'');
              }catch(error){
                try{
                  window.prompt(${JSONObject.quote(PROMPT_PREFIX)}+JSON.stringify({
                    type:'youtube-native-fullscreen-target',
                    action:'error',
                    reason:String(error&&error.message||error),
                    probeToken:${JSONObject.quote(probeToken)},
                    attempt:${attempt},
                    probePass:${probePass},
                    pageUrl:window.location.href,
                    centerX:-1,centerY:-1,
                    left:-1,top:-1,right:-1,bottom:-1,width:-1,height:-1,
                    buttonExists:false,
                    buttonVisible:false,
                    controlsVisible:false,
                    adVisible:false,
                    skipAdVisible:false,
                    premiumVisible:false,
                    premiumNegativeButtonFound:false,
                    premiumNegativeButtonCenterX:-1,
                    premiumNegativeButtonCenterY:-1,
                    premiumNegativeButtonLabel:'',
                    premiumNegativeButtonReason:'',
                    premiumContextText:'',
                    viewportWidth:Math.round(window.innerWidth||0),
                    viewportHeight:Math.round(window.innerHeight||0),
                    devicePixelRatio:Number(window.devicePixelRatio||1)
                  }),'');
                }catch(_){}
              }
            })();
        """.trimIndent()
        session.loadUri(script)
    }

    private fun scheduleYouTubeNativeFullscreenTargetReprobe(
        session: GeckoSession,
        pageUrl: String,
        attempt: Int,
        nextProbePass: Int,
        reason: String,
        fallbackX: Float,
        fallbackY: Float,
        delayMs: Long = YOUTUBE_AUTO_FULLSCREEN_TARGET_PROBE_RETRY_DELAY_MS,
    ) {
        youtubeAutoFsTargetProbeRetryRunnableBySession.remove(session)?.also { pointerHandler.removeCallbacks(it) }
        val r = Runnable {
            youtubeAutoFsTargetProbeRetryRunnableBySession.remove(session)
            if (isFinishing || isDestroyed) return@Runnable
            val tab = tabController.findTabBySession(session) ?: return@Runnable
            val activeUrl = tab.url
            if (youtubeAutoFsArmedUrlBySession[session] != pageUrl || activeUrl != pageUrl) {
                GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=url-changed expected=$pageUrl actual=$activeUrl")
                return@Runnable
            }
            if (!isYouTubeWatchOrLivePageUrl(activeUrl)) {
                GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=not-watch-live url=$activeUrl")
                return@Runnable
            }
            if (youtubeFullscreenStateBySession[session] == true || isBrowserFullscreenLikeState(tab)) {
                GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=already-fullscreen url=$activeUrl")
                stopYouTubeAutoFullscreen(session, reason = "already-fullscreen")
                return@Runnable
            }
            val (controlsX, controlsY) = resolveYouTubeNativeTapPoint(
                xRatio = YOUTUBE_FULLSCREEN_CONTROLS_REVEAL_X_RATIO,
                yRatio = YOUTUBE_FULLSCREEN_CONTROLS_REVEAL_Y_RATIO,
                fallbackX = YOUTUBE_FULLSCREEN_CONTROLS_REVEAL_X_FALLBACK,
                fallbackY = YOUTUBE_FULLSCREEN_CONTROLS_REVEAL_Y_FALLBACK,
            )
            val revealHandled = dispatchNativeMouseHoverAt(controlsX, controlsY, "youtube-native-fullscreen-controls-reveal")
            GvLogger.i(
                "GvInput",
                "youtube-native-fullscreen-controls-hover x=${controlsX.toInt()} y=${controlsY.toInt()} attempt=$attempt reason=$reason handled=$revealHandled"
            )
            dispatchYouTubeNativeFullscreenTargetProbe(
                session = session,
                pageUrl = pageUrl,
                attempt = attempt,
                probePass = nextProbePass,
                reason = reason,
                fallbackX = fallbackX,
                fallbackY = fallbackY,
            )
        }
        youtubeAutoFsTargetProbeRetryRunnableBySession[session] = r
        pointerHandler.postDelayed(r, delayMs)
    }

    private fun handleYouTubeNativeFullscreenTargetProbeMiss(
        session: GeckoSession,
        pageUrl: String,
        attempt: Int,
        probePass: Int,
        reason: String,
        token: String,
        fallbackX: Float,
        fallbackY: Float,
    ) {
        val activeToken = youtubeAutoFsTargetProbeTokenBySession[session] ?: return
        if (activeToken != token) {
            return
        }
        val maxProbePasses = YOUTUBE_AUTO_FULLSCREEN_TARGET_PROBE_MAX_PASSES_PER_ATTEMPT.coerceAtLeast(1)
        val normalizedPass = probePass.coerceAtLeast(1)
        if (normalizedPass < maxProbePasses) {
            val nextProbePass = normalizedPass + 1
            youtubeAutoFsTargetProbeTokenBySession.remove(session)
            youtubeAutoFsTargetProbeFallbackRunnableBySession.remove(session)?.also { pointerHandler.removeCallbacks(it) }
            youtubeAutoFsTargetProbePassBySession[session] = nextProbePass
            GvLogger.i(
                "GvInput",
                "youtube-native-fullscreen-target retry-probe reason=$reason attempt=$attempt nextProbePass=$nextProbePass"
            )
            scheduleYouTubeNativeFullscreenTargetReprobe(
                session = session,
                pageUrl = pageUrl,
                attempt = attempt,
                nextProbePass = nextProbePass,
                reason = "retry-after-$reason",
                fallbackX = fallbackX,
                fallbackY = fallbackY,
                delayMs = YOUTUBE_AUTO_FULLSCREEN_TARGET_PROBE_RETRY_DELAY_MS,
            )
            return
        }
        if (attempt == 1) {
            youtubeAutoFsTargetProbeTokenBySession.remove(session)
            youtubeAutoFsTargetProbeFallbackRunnableBySession.remove(session)?.also { pointerHandler.removeCallbacks(it) }
            youtubeAutoFsTargetProbePassBySession.remove(session)
            GvLogger.i("GvInput", "youtube-native-fullscreen-target-timeout-retry-no-fallback attempt=$attempt")
            scheduleYouTubeAutoFullscreenAttempt(
                session = session,
                pageUrl = pageUrl,
                attempt = attempt + 1,
                delayMs = 0L,
                reason = "retry-after-target-probe-exhausted",
            )
            return
        }
        GvLogger.i("GvInput", "youtube-native-fullscreen-target-timeout-fallback attempt=$attempt probePass=$normalizedPass")
        performYouTubeNativeFullscreenButtonTap(
            session = session,
            pageUrl = pageUrl,
            attempt = attempt,
            x = fallbackX,
            y = fallbackY,
            source = "fallback",
            token = token,
            fallbackReason = "probe-exhausted",
        )
    }

    private fun clearYouTubeNativeFullscreenTargetProbeState(session: GeckoSession, token: String? = null): Boolean {
        val activeToken = youtubeAutoFsTargetProbeTokenBySession[session] ?: return false
        if (!token.isNullOrBlank() && activeToken != token) {
            return false
        }
        youtubeAutoFsTargetProbeTokenBySession.remove(session)
        youtubeAutoFsTargetProbeRetryRunnableBySession.remove(session)?.also { pointerHandler.removeCallbacks(it) }
        youtubeAutoFsTargetProbeFallbackRunnableBySession.remove(session)?.also { pointerHandler.removeCallbacks(it) }
        youtubeAutoFsTargetProbePassBySession.remove(session)
        return true
    }

    private fun maybeHandleYouTubeFullscreenOverlayBlocker(
        session: GeckoSession,
        pageUrl: String,
        attempt: Int,
        probePass: Int,
        probeToken: String,
        viewportWidth: Int,
        viewportHeight: Int,
        premiumVisible: Boolean,
        premiumNegativeButtonFound: Boolean,
        premiumNegativeButtonCenterX: Float,
        premiumNegativeButtonCenterY: Float,
        premiumNegativeButtonLabel: String,
        premiumNegativeButtonReason: String,
        adVisible: Boolean,
        skipAdVisible: Boolean,
        fallbackX: Float,
        fallbackY: Float,
    ): Boolean {
        GvLogger.i(
            "GvInput",
            "youtube-overlay-blocker check reason=fullscreen-gate attempt=$attempt probePass=$probePass premiumVisible=$premiumVisible adVisible=$adVisible skipAdVisible=$skipAdVisible"
        )
        val currentDeferrals = youtubeAutoFsOverlayDeferralCountBySession[session] ?: 0
        if (currentDeferrals >= YOUTUBE_AUTO_FULLSCREEN_MAX_OVERLAY_DEFERRALS) {
            GvLogger.i("GvInput", "youtube-overlay-blocker skipped reason=max-deferrals attempt=$attempt deferrals=$currentDeferrals")
            clearYouTubeNativeFullscreenTargetProbeState(session, probeToken)
            stopYouTubeAutoFullscreen(session, reason = "overlay-max-deferrals", oldUrl = pageUrl)
            return true
        }
        val nextProbePass = (probePass + 1).coerceAtLeast(1)

        if (premiumNegativeButtonFound && premiumNegativeButtonCenterX >= 0f && premiumNegativeButtonCenterY >= 0f) {
            val widthScale = if (viewportWidth > 0 && geckoView.width > 0) geckoView.width.toFloat() / viewportWidth.toFloat() else 1f
            val heightScale = if (viewportHeight > 0 && geckoView.height > 0) geckoView.height.toFloat() / viewportHeight.toFloat() else 1f
            val tapX = premiumNegativeButtonCenterX * widthScale
            val tapY = premiumNegativeButtonCenterY * heightScale
            val viewWidth = geckoView.width.takeIf { it > 0 } ?: 1920
            val viewHeight = geckoView.height.takeIf { it > 0 } ?: 1080
            val clampedX = tapX.coerceIn(1f, (viewWidth - 1).coerceAtLeast(1).toFloat())
            val clampedY = tapY.coerceIn(1f, (viewHeight - 1).coerceAtLeast(1).toFloat())
            GvLogger.i(
                "GvInput",
                "youtube-overlay-blocker premium-negative-found reason=${premiumNegativeButtonReason.ifBlank { "context-match" }} button=\"$premiumNegativeButtonLabel\" x=${clampedX.toInt()} y=${clampedY.toInt()}"
            )
            if (!clearYouTubeNativeFullscreenTargetProbeState(session, probeToken)) {
                return true
            }
            val handled = dispatchNativeMouseTapAt(clampedX, clampedY, "youtube-premium-popup-negative")
            GvLogger.i("GvInput", "youtube-overlay-blocker premium-dismiss-tap x=${clampedX.toInt()} y=${clampedY.toInt()} handled=$handled")
            val nextDeferrals = currentDeferrals + 1
            youtubeAutoFsOverlayDeferralCountBySession[session] = nextDeferrals
            GvLogger.i(
                "GvInput",
                "youtube-overlay-blocker defer-fullscreen reason=premium-dismissed delayMs=$YOUTUBE_AUTO_FULLSCREEN_OVERLAY_RETRY_DELAY_MS deferrals=$nextDeferrals"
            )
            scheduleYouTubeNativeFullscreenTargetReprobe(
                session = session,
                pageUrl = pageUrl,
                attempt = attempt,
                nextProbePass = nextProbePass,
                reason = "overlay-premium-dismissed",
                fallbackX = fallbackX,
                fallbackY = fallbackY,
                delayMs = YOUTUBE_AUTO_FULLSCREEN_OVERLAY_RETRY_DELAY_MS,
            )
            return true
        }

        if (adVisible || skipAdVisible) {
            if (!clearYouTubeNativeFullscreenTargetProbeState(session, probeToken)) {
                return true
            }
            val nextDeferrals = currentDeferrals + 1
            youtubeAutoFsOverlayDeferralCountBySession[session] = nextDeferrals
            GvLogger.i(
                "GvInput",
                "youtube-overlay-blocker defer-fullscreen reason=ad-visible skipAdVisible=$skipAdVisible delayMs=$YOUTUBE_AUTO_FULLSCREEN_AD_DEFER_DELAY_MS deferrals=$nextDeferrals"
            )
            scheduleYouTubeNativeFullscreenTargetReprobe(
                session = session,
                pageUrl = pageUrl,
                attempt = attempt,
                nextProbePass = nextProbePass,
                reason = "overlay-ad-visible",
                fallbackX = fallbackX,
                fallbackY = fallbackY,
                delayMs = YOUTUBE_AUTO_FULLSCREEN_AD_DEFER_DELAY_MS,
            )
            return true
        }

        youtubeAutoFsOverlayDeferralCountBySession.remove(session)
        GvLogger.i("GvInput", "youtube-overlay-blocker skipped reason=no-blocker")
        return false
    }

    private fun performYouTubeNativeFullscreenButtonTap(
        session: GeckoSession,
        pageUrl: String,
        attempt: Int,
        x: Float,
        y: Float,
        source: String,
        token: String,
        fallbackReason: String? = null,
    ) {
        val activeToken = youtubeAutoFsTargetProbeTokenBySession[session] ?: return
        if (activeToken != token) {
            return
        }
        youtubeAutoFsTargetProbeTokenBySession.remove(session)
        youtubeAutoFsTargetProbeRetryRunnableBySession.remove(session)?.also { pointerHandler.removeCallbacks(it) }
        youtubeAutoFsTargetProbeFallbackRunnableBySession.remove(session)?.also { pointerHandler.removeCallbacks(it) }
        youtubeAutoFsTargetProbePassBySession.remove(session)
        youtubeAutoFsOverlayDeferralCountBySession.remove(session)

        val tab = tabController.findTabBySession(session) ?: return
        val activeUrl = tab.url
        if (activeUrl != pageUrl) {
            GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=url-changed expected=$pageUrl actual=$activeUrl")
            return
        }
        if (!isYouTubeWatchOrLivePageUrl(activeUrl)) {
            GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=not-watch-live url=$activeUrl")
            return
        }
        if (youtubeFullscreenStateBySession[session] == true || isBrowserFullscreenLikeState(tab)) {
            GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=already-fullscreen url=$activeUrl")
            stopYouTubeAutoFullscreen(session, reason = "already-fullscreen")
            return
        }
        val width = geckoView.width.takeIf { it > 0 } ?: 1920
        val height = geckoView.height.takeIf { it > 0 } ?: 1080
        val clampedX = x.coerceIn(1f, (width - 1).coerceAtLeast(1).toFloat())
        val clampedY = y.coerceIn(1f, (height - 1).coerceAtLeast(1).toFloat())
        val tapReason = if (source == "measured") "youtube-native-fullscreen-button-measured" else "youtube-native-fullscreen-button"
        val handled = dispatchNativeMouseTapAt(clampedX, clampedY, tapReason)
        if (source == "measured") {
            GvLogger.i(
                "GvInput",
                "youtube-native-fullscreen-button-tap source=measured x=${clampedX.toInt()} y=${clampedY.toInt()} attempt=$attempt handled=$handled"
            )
        } else {
            val reasonSuffix = fallbackReason?.takeIf { it.isNotBlank() }?.let { " reason=$it" }.orEmpty()
            GvLogger.i(
                "GvInput",
                "youtube-native-fullscreen-button-tap source=fallback x=${clampedX.toInt()} y=${clampedY.toInt()} attempt=$attempt handled=$handled$reasonSuffix"
            )
        }
        GvLogger.i("GvInput", "youtube-native-fullscreen-waiting-for-callback attempt=$attempt url=$pageUrl")
        scheduleYouTubeNativeFullscreenCallbackCheck(session, pageUrl, attempt)
    }

    private fun scheduleYouTubeNativeFullscreenCallbackCheck(
        session: GeckoSession,
        pageUrl: String,
        attempt: Int,
    ) {
        youtubeAutoFsCallbackCheckRunnableBySession.remove(session)?.also { pointerHandler.removeCallbacks(it) }
        val callbackCheck = Runnable {
            youtubeAutoFsCallbackCheckRunnableBySession.remove(session)
            if (isFinishing || isDestroyed) {
                return@Runnable
            }
            val currentArmed = youtubeAutoFsArmedUrlBySession[session]
            if (currentArmed != pageUrl) {
                val activeUrl = tabController.findTabBySession(session)?.url.orEmpty()
                GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=url-changed expected=$pageUrl actual=$activeUrl")
                return@Runnable
            }
            if (youtubeFullscreenStateBySession[session] == true) {
                GvLogger.i("GvInput", "youtube-native-fullscreen-success reason=fullscreen-callback url=$pageUrl")
                stopYouTubeAutoFullscreen(session, reason = "fullscreen-callback")
                return@Runnable
            }
            GvLogger.i("GvInput", "youtube-native-fullscreen-failed reason=no-fullscreen-callback attempt=$attempt url=$pageUrl")
            if (attempt >= YOUTUBE_AUTO_FULLSCREEN_MAX_ATTEMPTS) {
                GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=max-attempts url=$pageUrl")
                stopYouTubeAutoFullscreen(session, reason = "max-attempts")
                return@Runnable
            }
            val nextAttempt = attempt + 1
            if (nextAttempt > 2 && !youtubeAutoFsMediaReadyBySession.contains(session)) {
                GvLogger.i("GvInput", "youtube-native-fullscreen-skipped reason=no-media-evidence-late-retry url=$pageUrl")
                stopYouTubeAutoFullscreen(session, reason = "no-media-evidence-late-retry")
                return@Runnable
            }
            scheduleYouTubeAutoFullscreenAttempt(
                session = session,
                pageUrl = pageUrl,
                attempt = nextAttempt,
                delayMs = if (nextAttempt > 2) YOUTUBE_AUTO_FULLSCREEN_RETRY_2_MS else YOUTUBE_AUTO_FULLSCREEN_RETRY_1_MS,
                reason = "retry-after-callback-miss",
            )
        }
        youtubeAutoFsCallbackCheckRunnableBySession[session] = callbackCheck
        pointerHandler.postDelayed(callbackCheck, YOUTUBE_AUTO_FULLSCREEN_CALLBACK_WAIT_MS)
    }

    // ─── YouTube quality helper (bounded, verify-first logging) ───────────────

    private fun clearYouTubeQualityHelperTracking(session: GeckoSession) {
        youtubeQualityTrackedUrlBySession.remove(session)
        youtubeQualityAttemptCountBySession.remove(session)
        youtubeQualityLastAttemptAtBySession.remove(session)
        youtubeQualityFollowUpQueuedUrlBySession.remove(session)
        youtubeQualityPendingRunnableBySession.remove(session)?.also { pointerHandler.removeCallbacks(it) }
    }

    private fun maybeScheduleYouTubeQualityHelper(
        session: GeckoSession,
        pageUrl: String,
        reason: String,
        delayMs: Long = 0L,
        bypassCooldown: Boolean = false,
    ) {
        if (!isYouTubePageUrl(pageUrl)) {
            clearYouTubeQualityHelperTracking(session)
            GvLogger.i("GvInput", "youtube-quality-helper skipped reason=not-youtube")
            return
        }
        if (isYouTubeConsentPageUrl(pageUrl)) {
            GvLogger.i("GvInput", "youtube-quality-helper skipped reason=consent-page")
            return
        }
        if (!isYouTubeWatchOrLivePageUrl(pageUrl)) {
            clearYouTubeQualityHelperTracking(session)
            GvLogger.i("GvInput", "youtube-quality-helper skipped reason=not-watch-live")
            return
        }
        val tracked = youtubeQualityTrackedUrlBySession[session]
        if (tracked != pageUrl) {
            clearYouTubeQualityHelperTracking(session)
            youtubeQualityTrackedUrlBySession[session] = pageUrl
        }
        val attempts = youtubeQualityAttemptCountBySession[session] ?: 0
        if (attempts >= YOUTUBE_QUALITY_HELPER_MAX_ATTEMPTS_PER_URL) {
            GvLogger.i("GvInput", "youtube-quality-helper skipped reason=budget-exhausted")
            return
        }
        val now = SystemClock.uptimeMillis()
        val lastAttemptAt = youtubeQualityLastAttemptAtBySession[session] ?: 0L
        if (!bypassCooldown && lastAttemptAt > 0L && now - lastAttemptAt < YOUTUBE_QUALITY_HELPER_COOLDOWN_MS) {
            GvLogger.i("GvInput", "youtube-quality-helper skipped reason=budget-exhausted")
            return
        }
        if (youtubeQualityPendingRunnableBySession.containsKey(session)) {
            return
        }
        youtubeQualityPendingRunnableBySession.remove(session)?.also { pointerHandler.removeCallbacks(it) }
        val runnable = Runnable {
            youtubeQualityPendingRunnableBySession.remove(session)
            if (isFinishing || isDestroyed) return@Runnable
            val tab = tabController.findTabBySession(session) ?: return@Runnable
            val activeUrl = tab.url
            if (activeUrl != pageUrl) {
                return@Runnable
            }
            if (!isYouTubeWatchOrLivePageUrl(activeUrl) || isYouTubeConsentPageUrl(activeUrl)) {
                return@Runnable
            }
            val nextAttempt = (youtubeQualityAttemptCountBySession[session] ?: 0) + 1
            if (nextAttempt > YOUTUBE_QUALITY_HELPER_MAX_ATTEMPTS_PER_URL) {
                GvLogger.i("GvInput", "youtube-quality-helper skipped reason=budget-exhausted")
                return@Runnable
            }
            youtubeQualityAttemptCountBySession[session] = nextAttempt
            youtubeQualityLastAttemptAtBySession[session] = SystemClock.uptimeMillis()
            dispatchYouTubeQualityHelperProbe(session, activeUrl, reason, nextAttempt)
        }
        youtubeQualityPendingRunnableBySession[session] = runnable
        pointerHandler.postDelayed(runnable, delayMs)
        GvLogger.i("GvInput", "youtube-quality-helper scheduled reason=$reason url=$pageUrl")
    }

    private fun dispatchYouTubeQualityHelperProbe(
        session: GeckoSession,
        pageUrl: String,
        reason: String,
        attempt: Int,
    ) {
        val script = YouTubeJsSnippets.buildQualityHelperProbeScript(
            promptPrefix = PROMPT_PREFIX,
            reason = reason,
            attempt = attempt,
        )
        session.loadUri(script)
    }

    // ─── end YouTube native coordinate fullscreen ──────────────────────────────

    private fun maybeDispatchYouTubeFullscreenChatGuard(
        session: GeckoSession,
        pageUrl: String,
        reason: String,
        delayMs: Long,
    ) {
        if (!isYouTubeWatchOrLivePageUrl(pageUrl)) {
            return
        }
        pointerHandler.postDelayed(
            {
                if (isFinishing || isDestroyed) return@postDelayed
                val tab = tabController.findTabBySession(session) ?: return@postDelayed
                val activeUrl = tab.url
                if (!isYouTubeWatchOrLivePageUrl(activeUrl)) return@postDelayed
                if (youtubeFullscreenStateBySession[session] != true) return@postDelayed
                val script = """
                    javascript:(function(){
                      try{
                        var promptPrefix=${JSONObject.quote(PROMPT_PREFIX)};
                        var guardKey='__kfYoutubeFullscreenChatGuard';
                        var styleId='kf-youtube-fullscreen-chat-guard-style';
                        var now=function(){return Date.now();};
                        var visibleRect=function(node){
                          try{
                            if(!node){return null;}
                            var s=getComputedStyle(node);
                            if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity||1)<0.05){return null;}
                            var r=node.getBoundingClientRect();
                            if(r.width<=0||r.height<=0){return null;}
                            return r;
                          }catch(_){return null;}
                        };
                        var chatSelectors=[
                          'ytd-live-chat-frame',
                          '#chat',
                          '#chat-container',
                          '#chatframe',
                          '#chat-messages',
                          '#panels',
                          '#secondary',
                          '#secondary-inner',
                          'ytd-watch-flexy #secondary',
                          'ytd-watch-flexy #secondary-inner',
                          'ytd-watch-flexy #panels',
                          'ytd-engagement-panel-section-list-renderer',
                          'ytd-engagement-panel-section-list-renderer[target-id*="chat" i]',
                          'ytd-engagement-panel-section-list-renderer[panel-id*="chat" i]',
                          'ytd-engagement-panel-section-list-renderer[visibility*="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED" i]',
                          'iframe[src*="live_chat"]',
                          'iframe[src*="live_chat_replay"]',
                          'iframe[src*="youtube.com/live_chat"]',
                          'iframe[src*="youtube.com/live_chat_replay"]'
                        ];
                        var chatSelectorText=chatSelectors.join(',');
                        var metrics=function(){
                          var m={
                            visibleChatCount:0,
                            maxChatWidth:0,
                            maxChatHeight:0,
                            liveChatIframeVisible:false,
                            secondaryWidth:0,
                            panelsWidth:0,
                            viewportWidth:Math.max(0,Math.round(window.innerWidth||0)),
                            primaryWidth:0,
                            playerWidth:0
                          };
                          try{
                            Array.from(document.querySelectorAll(chatSelectorText)).forEach(function(node){
                              var r=visibleRect(node);
                              if(!r){return;}
                              m.visibleChatCount+=1;
                              m.maxChatWidth=Math.max(m.maxChatWidth,Math.round(r.width));
                              m.maxChatHeight=Math.max(m.maxChatHeight,Math.round(r.height));
                              if((node.tagName||'').toLowerCase()==='iframe'){
                                var src=String(node.getAttribute('src')||'').toLowerCase();
                                if(src.indexOf('live_chat')>=0){m.liveChatIframeVisible=true;}
                              }
                            });
                            var sec=visibleRect(document.querySelector('#secondary'));
                            if(sec){m.secondaryWidth=Math.max(0,Math.round(sec.width));}
                            var pnl=visibleRect(document.querySelector('#panels'));
                            if(pnl){m.panelsWidth=Math.max(0,Math.round(pnl.width));}
                            var primary=visibleRect(document.querySelector('#primary')||document.querySelector('#primary-inner'));
                            if(primary){m.primaryWidth=Math.max(0,Math.round(primary.width));}
                            var player=visibleRect(document.querySelector('#movie_player')||document.querySelector('#player')||document.querySelector('.html5-video-player'));
                            if(player){m.playerWidth=Math.max(0,Math.round(player.width));}
                          }catch(_){}
                          return m;
                        };
                        var styleText=[
                          'ytd-live-chat-frame,#chat,#chat-container,#chatframe,#chat-messages,#panels,#secondary,#secondary-inner,',
                          'ytd-watch-flexy #secondary,ytd-watch-flexy #secondary-inner,ytd-watch-flexy #panels,',
                          'ytd-engagement-panel-section-list-renderer,',
                          'ytd-engagement-panel-section-list-renderer[target-id*="chat" i],',
                          'ytd-engagement-panel-section-list-renderer[panel-id*="chat" i],',
                          'ytd-engagement-panel-section-list-renderer[visibility*="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED" i],',
                          'iframe[src*="live_chat"],iframe[src*="live_chat_replay"],iframe[src*="youtube.com/live_chat"],iframe[src*="youtube.com/live_chat_replay"]{',
                          'display:none !important;visibility:hidden !important;opacity:0 !important;width:0 !important;min-width:0 !important;max-width:0 !important;',
                          'height:0 !important;min-height:0 !important;max-height:0 !important;flex:0 0 0px !important;margin:0 !important;padding:0 !important;',
                          'pointer-events:none !important;overflow:hidden !important;}',
                          'ytd-watch-flexy,ytd-watch-flexy[theater],ytd-watch-flexy[fullscreen],ytd-watch-flexy #columns,#columns,#primary,#primary-inner,#player,#player-container,#player-container-outer,#movie_player,.html5-video-player{',
                          'max-width:100vw !important;width:100vw !important;margin-right:0 !important;padding-right:0 !important;column-gap:0 !important;grid-template-columns:minmax(0,1fr) !important;}',
                          '#primary,#primary-inner{width:100% !important;max-width:100% !important;flex:1 1 auto !important;margin-right:0 !important;}',
                          'ytd-watch-flexy{',
                          '--ytd-watch-flexy-sidebar-width:0px !important;',
                          '--ytd-watch-flexy-sidebar-min-width:0px !important;',
                          '--ytd-watch-flexy-chat-max-height:0px !important;',
                          '--ytd-watch-flexy-panel-max-height:0px !important;}'
                        ].join('');
                        var ensureStyle=function(){
                          var style=document.getElementById(styleId);
                          if(!style){
                            style=document.createElement('style');
                            style.id=styleId;
                            (document.head||document.documentElement).appendChild(style);
                          }
                          if(style.textContent!==styleText){style.textContent=styleText;}
                          return style;
                        };
                        var applyNow=function(phase){
                          ensureStyle();
                          var host=document.querySelector('ytd-watch-flexy');
                          if(host&&host.style){
                            try{
                              host.style.setProperty('--ytd-watch-flexy-sidebar-width','0px','important');
                              host.style.setProperty('--ytd-watch-flexy-sidebar-min-width','0px','important');
                              host.style.setProperty('--ytd-watch-flexy-chat-max-height','0px','important');
                              host.style.setProperty('--ytd-watch-flexy-panel-max-height','0px','important');
                            }catch(_){}
                          }
                          return metrics();
                        };
                        var send=function(action,why,m){
                          try{
                            window.prompt(promptPrefix+JSON.stringify({
                              type:'youtube-fullscreen-chat-guard',
                              pageUrl:window.location.href,
                              action:action,
                              reason:why||'',
                              visibleChatCount:Number(m.visibleChatCount||0),
                              maxChatWidth:Number(m.maxChatWidth||0),
                              maxChatHeight:Number(m.maxChatHeight||0),
                              liveChatIframeVisible:!!m.liveChatIframeVisible,
                              secondaryWidth:Number(m.secondaryWidth||0),
                              panelsWidth:Number(m.panelsWidth||0),
                              viewportWidth:Number(m.viewportWidth||0),
                              primaryWidth:Number(m.primaryWidth||0),
                              playerWidth:Number(m.playerWidth||0)
                            }),'');
                          }catch(_){}
                        };
                        var state=window[guardKey];
                        if(!state){
                          state={observer:null,reapplyTimer:0,stopTimer:0,lastMutationLogAt:0,timers:[]};
                          window[guardKey]=state;
                        }
                        var m0=applyNow('apply');
                        send('applied',${JSONObject.quote(reason)},m0);
                        if(state.observer){try{state.observer.disconnect();}catch(_){}}
                        if(state.reapplyTimer){try{clearInterval(state.reapplyTimer);}catch(_){}}
                        if(state.stopTimer){try{clearTimeout(state.stopTimer);}catch(_){}}
                        if(state.timers&&state.timers.length){try{state.timers.forEach(function(id){clearTimeout(id);});}catch(_){}}
                        state.timers=[];
                        state.observer=new MutationObserver(function(){
                          var g=applyNow('mutation');
                          var t=now();
                          if(t-(state.lastMutationLogAt||0)>900){
                            state.lastMutationLogAt=t;
                            send('reapplied','mutation',g);
                          }
                        });
                        try{
                          state.observer.observe(document.documentElement||document,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','collapsed','aria-hidden']});
                        }catch(_){}
                        [250,750,1500,3000,6000,10000].forEach(function(delay){
                          var id=setTimeout(function(){
                            var gm=applyNow('schedule-'+delay);
                            send('reapplied','schedule-'+delay,gm);
                          },delay);
                          state.timers.push(id);
                        });
                        state.reapplyTimer=setInterval(function(){applyNow('interval');},700);
                        state.stopTimer=setTimeout(function(){
                          try{if(state.observer){state.observer.disconnect();}}catch(_){}
                          try{if(state.reapplyTimer){clearInterval(state.reapplyTimer);state.reapplyTimer=0;}}catch(_){}
                        },12000);
                      }catch(error){
                        try{
                          window.prompt(${JSONObject.quote(PROMPT_PREFIX)}+JSON.stringify({type:'youtube-fullscreen-chat-guard',pageUrl:window.location.href,action:'error',reason:String(error&&error.message||error),visibleChatCount:-1,maxChatWidth:-1,maxChatHeight:-1,liveChatIframeVisible:false,secondaryWidth:-1,panelsWidth:-1,viewportWidth:-1,primaryWidth:-1,playerWidth:-1}),'');
                        }catch(_){}
                      }
                    })();
                """.trimIndent()
                session.loadUri(script)
            },
            delayMs,
        )
    }

    private fun maybeDispatchYouTubeFullscreenChatGuardRemove(
        session: GeckoSession,
        pageUrl: String,
        reason: String,
    ) {
        if (!isYouTubePageUrl(pageUrl)) {
            return
        }
        val script = """
            javascript:(function(){
              try{
                var promptPrefix=${JSONObject.quote(PROMPT_PREFIX)};
                var guardKey='__kfYoutubeFullscreenChatGuard';
                var styleId='kf-youtube-fullscreen-chat-guard-style';
                var state=window[guardKey];
                if(state){
                  try{if(state.observer){state.observer.disconnect();}}catch(_){}
                  try{if(state.reapplyTimer){clearInterval(state.reapplyTimer);}}catch(_){}
                  try{if(state.stopTimer){clearTimeout(state.stopTimer);}}catch(_){}
                  try{if(state.timers&&state.timers.length){state.timers.forEach(function(id){clearTimeout(id);});}}catch(_){}
                }
                try{delete window[guardKey];}catch(_){window[guardKey]=null;}
                var style=document.getElementById(styleId);
                if(style&&style.parentNode){style.parentNode.removeChild(style);}
                var rect=function(node){try{if(!node){return 0;}var r=node.getBoundingClientRect();return Math.max(0,Math.round(r.width||0));}catch(_){return 0;}};
                var sec=rect(document.querySelector('#secondary'));
                var pnl=rect(document.querySelector('#panels'));
                var pri=rect(document.querySelector('#primary'));
                var ply=rect(document.querySelector('#movie_player')||document.querySelector('#player'));
                window.prompt(promptPrefix+JSON.stringify({type:'youtube-fullscreen-chat-guard',pageUrl:window.location.href,action:'removed',reason:${JSONObject.quote(reason)},visibleChatCount:0,maxChatWidth:0,maxChatHeight:0,liveChatIframeVisible:false,secondaryWidth:sec,panelsWidth:pnl,viewportWidth:Math.round(window.innerWidth||0),primaryWidth:pri,playerWidth:ply}),'');
              }catch(error){
                try{
                  window.prompt(${JSONObject.quote(PROMPT_PREFIX)}+JSON.stringify({type:'youtube-fullscreen-chat-guard',pageUrl:window.location.href,action:'error',reason:String(error&&error.message||error),visibleChatCount:-1,maxChatWidth:-1,maxChatHeight:-1,liveChatIframeVisible:false,secondaryWidth:-1,panelsWidth:-1,viewportWidth:-1,primaryWidth:-1,playerWidth:-1}),'');
                }catch(_){}
              }
            })();
        """.trimIndent()
        session.loadUri(script)
    }

    private fun maybeDispatchYouTubeChatCollapseForFullscreen(
        session: GeckoSession,
        pageUrl: String,
        reason: String,
        delayMs: Long,
    ) {
        if (!isYouTubeWatchOrLivePageUrl(pageUrl)) {
            return
        }
        val now = SystemClock.uptimeMillis()
        val last = youtubeFullscreenChatCollapseLastDispatchMsBySession[session] ?: 0L
        if (now - last < YOUTUBE_FULLSCREEN_CHAT_COLLAPSE_MIN_INTERVAL_MS) {
            return
        }
        youtubeFullscreenChatCollapseLastDispatchMsBySession[session] = now
        pointerHandler.postDelayed(
            {
                if (isFinishing || isDestroyed) {
                    return@postDelayed
                }
                val tab = tabController.findTabBySession(session) ?: return@postDelayed
                val activeUrl = tab.url
                if (!isYouTubeWatchOrLivePageUrl(activeUrl)) {
                    return@postDelayed
                }
                if (youtubeFullscreenStateBySession[session] != true) {
                    return@postDelayed
                }
                GvLogger.i("GvInput", "youtube-chat-collapse attempt reason=$reason url=$activeUrl")
                val script = """
                    javascript:(function(){
                      try{
                        var promptPrefix=${JSONObject.quote(PROMPT_PREFIX)};
                        var pageUrl=window.location.href;
                        var visible=function(node){
                          try{
                            if(!node||node.disabled){return false;}
                            var s=getComputedStyle(node);
                            if(s.visibility==='hidden'||s.display==='none'||Number(s.opacity||1)<0.05){return false;}
                            var r=node.getBoundingClientRect();
                            return r.width>10&&r.height>10&&r.bottom>0&&r.right>0&&r.top<window.innerHeight&&r.left<window.innerWidth;
                          }catch(_){return false;}
                        };
                        var clickNode=function(node){
                          if(!node){return false;}
                          try{node.click();return true;}catch(_){}
                          try{node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));return true;}catch(_){}
                          return false;
                        };
                        var closeSelector=[
                          'ytd-live-chat-frame #show-hide-button button',
                          'ytd-live-chat-frame button[aria-label*="close" i]',
                          'ytd-live-chat-frame button[aria-label*="hide" i]',
                          'ytd-engagement-panel-section-list-renderer button[aria-label*="close" i]',
                          'ytd-engagement-panel-section-list-renderer button[aria-label*="hide" i]',
                          'button[aria-label*="close chat" i]',
                          'button[aria-label*="hide chat" i]'
                        ].join(',');
                        var closeButton=Array.from(document.querySelectorAll(closeSelector)).find(visible)||null;
                        if(closeButton&&clickNode(closeButton)){
                          window.prompt(promptPrefix+JSON.stringify({type:'youtube-chat-collapse',pageUrl:pageUrl,action:'closed-button',reason:''}),'');
                          return;
                        }
                        var hidden=false;
                        var chatSelectors='ytd-live-chat-frame,#chat,#chat-container,#chatframe,ytd-engagement-panel-section-list-renderer[target-id*="chat" i],ytd-engagement-panel-section-list-renderer[panel-id*="chat" i]';
                        var chatNodes=Array.from(document.querySelectorAll(chatSelectors));
                        chatNodes.forEach(function(node){
                          try{
                            node.style.setProperty('display','none','important');
                            node.style.setProperty('visibility','hidden','important');
                            node.style.setProperty('width','0px','important');
                            node.style.setProperty('min-width','0px','important');
                            node.style.setProperty('max-width','0px','important');
                            node.style.setProperty('flex','0 0 0px','important');
                            node.style.setProperty('opacity','0','important');
                            hidden=true;
                          }catch(_){}
                        });
                        if(hidden){
                          Array.from(document.querySelectorAll('ytd-watch-flexy #secondary,ytd-watch-flexy #secondary-inner,ytd-watch-flexy #panels,ytd-watch-flexy #chat-container')).forEach(function(node){
                            try{
                              node.style.setProperty('display','none','important');
                              node.style.setProperty('visibility','hidden','important');
                              node.style.setProperty('width','0px','important');
                              node.style.setProperty('min-width','0px','important');
                              node.style.setProperty('max-width','0px','important');
                              node.style.setProperty('flex','0 0 0px','important');
                              node.style.setProperty('margin','0','important');
                              node.style.setProperty('padding','0','important');
                            }catch(_){}
                          });
                        }
                        if(hidden){
                          window.prompt(promptPrefix+JSON.stringify({type:'youtube-chat-collapse',pageUrl:pageUrl,action:'hidden-css',reason:'chat-and-secondary-collapsed'}),'');
                          return;
                        }
                        window.prompt(promptPrefix+JSON.stringify({type:'youtube-chat-collapse',pageUrl:pageUrl,action:'skipped',reason:'no-chat'}),'');
                      }catch(error){
                        try{
                          window.prompt(${JSONObject.quote(PROMPT_PREFIX)}+JSON.stringify({type:'youtube-chat-collapse',pageUrl:window.location.href,action:'skipped',reason:'exception',error:String(error&&error.message||error)}),'');
                        }catch(_){}
                      }
                    })();
                """.trimIndent()
                session.loadUri(script)
            },
            delayMs,
        )
    }

    private fun clearYouTubePremiumPopupTracking(session: GeckoSession) {
        youtubePremiumPopupTrackedUrlBySession.remove(session)
        youtubePremiumPopupCheckCountBySessionWindow.remove(session)
        youtubePremiumPopupPendingRunnablesBySession.remove(session)?.forEach { pointerHandler.removeCallbacks(it) }
        youtubePremiumPopupPendingWindowBySession.remove(session)
        youtubePremiumPopupLastInteractionBurstMsBySession.remove(session)
    }

    private fun youtubePremiumPopupWindowForReason(reason: String): String =
        if (reason.startsWith("fullscreen-enter")) "fullscreen-enter" else "location-change"

    private fun youtubePremiumPopupMaxChecksForWindow(window: String): Int =
        if (window == "fullscreen-enter") YOUTUBE_PREMIUM_POPUP_MAX_CHECKS_FULLSCREEN_WINDOW else YOUTUBE_PREMIUM_POPUP_MAX_CHECKS_LOCATION_WINDOW

    private fun maybeScheduleYouTubePremiumPopupChecks(
        session: GeckoSession,
        pageUrl: String,
        reason: String,
    ) {
        if (!isYouTubePageUrl(pageUrl)) {
            clearYouTubePremiumPopupTracking(session)
            GvLogger.i("GvInput", "youtube-premium-popup skipped reason=not-youtube pageUrl=$pageUrl")
            return
        }
        if (!isYouTubeWatchOrLivePageUrl(pageUrl)) {
            clearYouTubePremiumPopupTracking(session)
            GvLogger.i("GvInput", "youtube-premium-popup skipped reason=not-watch-live pageUrl=$pageUrl")
            return
        }
        val trackedUrl = youtubePremiumPopupTrackedUrlBySession[session]
        if (trackedUrl != pageUrl) {
            clearYouTubePremiumPopupTracking(session)
            youtubePremiumPopupTrackedUrlBySession[session] = pageUrl
        }
        val window = youtubePremiumPopupWindowForReason(reason)
        val now = SystemClock.uptimeMillis()
        val lastDismiss = youtubePremiumPopupLastDismissMsByUrl[pageUrl] ?: 0L
        if (lastDismiss > 0L && now - lastDismiss < YOUTUBE_PREMIUM_POPUP_DISMISS_COOLDOWN_MS) {
            GvLogger.i("GvInput", "youtube-premium-popup skipped reason=dismiss-cooldown pageUrl=$pageUrl")
            return
        }
        val pendingRunnables = youtubePremiumPopupPendingRunnablesBySession[session]
        val hasPending = pendingRunnables?.isNotEmpty() == true
        val pendingWindow = youtubePremiumPopupPendingWindowBySession[session]
        val isFullscreenRefresh = window == "fullscreen-enter" && reason.startsWith("fullscreen-enter-refresh")
        if (hasPending) {
            if ((window == "fullscreen-enter" && pendingWindow != "fullscreen-enter") || isFullscreenRefresh) {
                pendingRunnables?.forEach { pointerHandler.removeCallbacks(it) }
                youtubePremiumPopupPendingRunnablesBySession.remove(session)
                youtubePremiumPopupPendingWindowBySession.remove(session)
                GvLogger.i(
                    "GvInput",
                    "youtube-premium-popup burst-replace oldReason=${pendingWindow.orEmpty()} newReason=fullscreen-enter url=$pageUrl"
                )
            } else {
                GvLogger.i(
                    "GvInput",
                    "youtube-premium-popup skipped reason=window-pending window=${pendingWindow ?: window} pageUrl=$pageUrl"
                )
                return
            }
        }
        val countByWindow = youtubePremiumPopupCheckCountBySessionWindow.getOrPut(session) { linkedMapOf() }
        if (isFullscreenRefresh) {
            countByWindow.remove("fullscreen-enter")
        }
        val currentChecks = countByWindow[window] ?: 0
        val maxChecks = youtubePremiumPopupMaxChecksForWindow(window)
        if (currentChecks >= maxChecks) {
            GvLogger.i(
                "GvInput",
                "youtube-premium-popup skipped reason=window-budget-exhausted window=$window pageUrl=$pageUrl"
            )
            return
        }
        val delays = if (window == "fullscreen-enter") {
            longArrayOf(0L, 750L, 2000L, 5000L, 9000L)
        } else {
            longArrayOf(0L, 750L, 2000L)
        }
        if (window == "fullscreen-enter") {
            GvLogger.i("GvInput", "youtube-premium-popup burst-start reason=fullscreen-enter url=$pageUrl")
        }
        youtubePremiumPopupPendingWindowBySession[session] = window
        delays.forEachIndexed { index, delayMs ->
            maybeDispatchYouTubePremiumPopupCheck(
                session = session,
                expectedPageUrl = pageUrl,
                reason = "$window-pass${index + 1}",
                window = window,
                delayMs = delayMs,
            )
        }
    }

    private fun maybeScheduleYouTubePremiumPopupInteractionBurst(trigger: String) {
        val activeTab = tabController.getActiveTab() ?: return
        val session = activeTab.session
        val activeUrl = activeTab.url
        if (!isYouTubeWatchOrLivePageUrl(activeUrl)) {
            return
        }
        if (youtubeFullscreenStateBySession[session] != true && !isBrowserFullscreenLikeState(activeTab)) {
            return
        }
        val now = SystemClock.uptimeMillis()
        val lastBurst = youtubePremiumPopupLastInteractionBurstMsBySession[session] ?: 0L
        if (now - lastBurst < YOUTUBE_PREMIUM_POPUP_INTERACTION_BURST_MIN_INTERVAL_MS) {
            return
        }
        youtubePremiumPopupLastInteractionBurstMsBySession[session] = now
        maybeScheduleYouTubePremiumPopupChecks(
            session = session,
            pageUrl = activeUrl,
            reason = "fullscreen-enter-refresh-$trigger",
        )
    }

    private fun recordYouTubePremiumPopupDismiss(session: GeckoSession, pageUrl: String) {
        youtubePremiumPopupLastDismissMsByUrl[pageUrl] = SystemClock.uptimeMillis()
        youtubePremiumPopupCheckCountBySessionWindow.remove(session)
        youtubePremiumPopupPendingRunnablesBySession.remove(session)?.forEach { pointerHandler.removeCallbacks(it) }
        youtubePremiumPopupPendingWindowBySession.remove(session)
    }

    private fun maybeDispatchYouTubePremiumPopupCheck(
        session: GeckoSession,
        expectedPageUrl: String,
        reason: String,
        window: String,
        delayMs: Long,
    ) {
        val checkRunnable = object : Runnable {
            override fun run() {
                youtubePremiumPopupPendingRunnablesBySession[session]?.remove(this)
                if (youtubePremiumPopupPendingRunnablesBySession[session]?.isEmpty() == true) {
                    youtubePremiumPopupPendingRunnablesBySession.remove(session)
                    youtubePremiumPopupPendingWindowBySession.remove(session)
                }
                if (isFinishing || isDestroyed) return
                val tab = tabController.findTabBySession(session) ?: return
                val activeUrl = tab.url
                if (activeUrl != expectedPageUrl) {
                    GvLogger.i(
                        "GvInput",
                        "youtube-premium-popup skipped reason=url-changed expected=$expectedPageUrl actual=$activeUrl"
                    )
                    return
                }
                if (!isYouTubeWatchOrLivePageUrl(activeUrl)) {
                    GvLogger.i("GvInput", "youtube-premium-popup skipped reason=not-watch-live pageUrl=$activeUrl")
                    return
                }
                val now = SystemClock.uptimeMillis()
                val lastDismiss = youtubePremiumPopupLastDismissMsByUrl[activeUrl] ?: 0L
                if (lastDismiss > 0L && now - lastDismiss < YOUTUBE_PREMIUM_POPUP_DISMISS_COOLDOWN_MS) {
                    GvLogger.i("GvInput", "youtube-premium-popup skipped reason=dismiss-cooldown pageUrl=$activeUrl")
                    return
                }
                val countByWindow = youtubePremiumPopupCheckCountBySessionWindow.getOrPut(session) { linkedMapOf() }
                val currentChecks = countByWindow[window] ?: 0
                val maxChecks = youtubePremiumPopupMaxChecksForWindow(window)
                if (currentChecks >= maxChecks) {
                    GvLogger.i(
                        "GvInput",
                        "youtube-premium-popup skipped reason=window-budget-exhausted window=$window pageUrl=$activeUrl"
                    )
                    return
                }
                countByWindow[window] = currentChecks + 1
                GvLogger.i("GvInput", "youtube-premium-popup check reason=$reason pageUrl=$activeUrl")
                val script = """
                javascript:(function(){
                  try{
                    var promptPrefix=${JSONObject.quote(PROMPT_PREFIX)};
                    var checkReason=${JSONObject.quote(reason)};
                    var norm=function(v){return String(v||'').replace(/\s+/g,' ').trim();};
                    var lower=function(v){return norm(v).toLowerCase();};
                    var safeText=function(v,max){
                      var t=norm(v||'');
                      if(!max||max<1){return t;}
                      return t.length>max?t.slice(0,max):t;
                    };
                    var visible=function(node){
                      try{
                        if(!node){return false;}
                        var style=window.getComputedStyle(node);
                        if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity||1)<0.05){return false;}
                        var r=node.getBoundingClientRect();
                        return r.width>8&&r.height>8&&r.bottom>0&&r.right>0&&r.top<window.innerHeight&&r.left<window.innerWidth;
                      }catch(_){return false;}
                    };
                    var premiumSurfaceText=function(text){
                      var t=lower(text);
                      return t.indexOf('youtube premium')>=0||
                        t.indexOf('get youtube without the ads')>=0||
                        t.indexOf('youtube without the ads')>=0||
                        (t.indexOf('premium')>=0&&t.indexOf('youtube')>=0);
                    };
                    var negativeLabel=function(text){
                      var t=lower(text);
                      if(t==='no thanks'){return 'no thanks';}
                      if(t==='not now'){return 'not now';}
                      if(t==='maybe later'){return 'maybe later';}
                      if(t==='dismiss'){return 'dismiss';}
                      if(t.indexOf('no thanks')>=0){return 'no thanks';}
                      if(t.indexOf('not now')>=0){return 'not now';}
                      if(t.indexOf('maybe later')>=0){return 'maybe later';}
                      if(t.indexOf('dismiss')>=0){return 'dismiss';}
                      return '';
                    };
                    var isPositiveLabel=function(text){
                      var t=lower(text);
                      return t.indexOf('1 month free')>=0||
                        t.indexOf('try it free')>=0||
                        t.indexOf('start trial')>=0||
                        t.indexOf('subscribe')>=0||
                        t.indexOf('premium')>=0||
                        t.indexOf('get premium')>=0||
                        t.indexOf('buy')>=0||
                        t.indexOf('join')>=0||
                        t.indexOf('skip ads')>=0||
                        t==='skip'||
                        t.indexOf(' skip ')>=0;
                    };
                    var readLabel=function(node){
                      if(!node){return '';}
                      var fromNode=norm(node.innerText||node.textContent||'');
                      var aria=norm(node.getAttribute&&node.getAttribute('aria-label')||'');
                      var title=norm(node.getAttribute&&node.getAttribute('title')||'');
                      var value=norm(node.getAttribute&&node.getAttribute('value')||'');
                      var spanText='';
                      try{
                        spanText=norm(Array.from(node.querySelectorAll('span')).map(function(s){return norm(s.textContent||'');}).filter(Boolean).join(' '));
                      }catch(_){}
                      return norm(fromNode||aria||title||value||spanText);
                    };
                    var closestInteractive=function(node){
                      if(!node){return null;}
                      if(node.closest){
                        return node.closest('button,[role="button"],tp-yt-paper-button,yt-button-shape,a[role="button"],.yt-spec-button-shape-next');
                      }
                      return null;
                    };
                    var pushUnique=function(list, seen, node){
                      if(!node||!node.nodeType){return;}
                      if(seen.has(node)){return;}
                      seen.add(node);
                      list.push(node);
                    };
                    var buttonSelector='button,[role="button"],tp-yt-paper-button,yt-button-shape button,yt-button-shape,a[role="button"],.yt-spec-button-shape-next,.yt-spec-button-shape-next__button-text-content';
                    var rawCandidates=[];
                    var rawSeen=new Set();
                    try{
                      Array.from(document.querySelectorAll(buttonSelector)).forEach(function(node){
                        var resolved=closestInteractive(node)||node;
                        pushUnique(rawCandidates, rawSeen, resolved);
                      });
                    }catch(_){}
                    try{
                      var walker=document.createTreeWalker(document.documentElement||document.body, NodeFilter.SHOW_ELEMENT);
                      var visited=0;
                      var current=walker.currentNode;
                      while(current&&visited<2200){
                        visited++;
                        if(current.shadowRoot&&current.shadowRoot.querySelectorAll){
                          try{
                            Array.from(current.shadowRoot.querySelectorAll(buttonSelector)).forEach(function(node){
                              var resolved=closestInteractive(node)||node;
                              pushUnique(rawCandidates, rawSeen, resolved);
                            });
                          }catch(_){}
                        }
                        current=walker.nextNode();
                      }
                    }catch(_){}
                    var viewportWidth=Math.round(window.innerWidth||0);
                    var viewportHeight=Math.round(window.innerHeight||0);
                    var visibleCandidates=[];
                    for(var ci=0;ci<rawCandidates.length;ci++){
                      var candidate=rawCandidates[ci];
                      if(!visible(candidate)){continue;}
                      var rect=candidate.getBoundingClientRect();
                      if(rect.width<8||rect.height<8){continue;}
                      visibleCandidates.push(candidate);
                    }
                    var candidateButtons=visibleCandidates.length;
                    var negativeCandidates=[];
                    var seenNegativeNodes=new Set();
                    for(var vi=0;vi<visibleCandidates.length;vi++){
                      var node=visibleCandidates[vi];
                      var label=readLabel(node);
                      if(!label){continue;}
                      if(isPositiveLabel(label)){continue;}
                      var neg=negativeLabel(label);
                      if(!neg){continue;}
                      if(seenNegativeNodes.has(node)){continue;}
                      seenNegativeNodes.add(node);
                      negativeCandidates.push({node:node,label:label,neg:neg});
                    }
                    window.prompt(promptPrefix+JSON.stringify({
                      type:'youtube-premium-popup',
                      pageUrl:window.location.href,
                      action:'candidate-buttons',
                      reason:'count='+candidateButtons+' negativeCount='+negativeCandidates.length,
                      checkReason:checkReason,
                      buttonLabel:'',
                      containerText:'',
                      buttonCenterX:-1,
                      buttonCenterY:-1,
                      viewportWidth:viewportWidth,
                      viewportHeight:viewportHeight
                    }),'');
                    var collectContext=function(node){
                      var parts=[];
                      var seen=new Set();
                      var cur=node;
                      var depth=0;
                      while(cur&&depth<8){
                        depth++;
                        var txt=safeText(cur.innerText||cur.textContent||'', 420);
                        if(txt&&!seen.has(txt)){seen.add(txt);parts.push(txt);}
                        cur=cur.parentElement;
                      }
                      var popupSelectors=[
                        'tp-yt-paper-dialog',
                        'ytd-popup-container',
                        'ytd-popup-container tp-yt-paper-dialog',
                        'ytd-mealbar-promo-renderer',
                        'ytd-modal-with-title-and-button-renderer',
                        'yt-confirm-dialog-renderer',
                        'ytd-engagement-panel-section-list-renderer',
                        '.ytp-paid-content-overlay'
                      ];
                      for(var pi=0;pi<popupSelectors.length;pi++){
                        try{
                          var popup=node.closest&&node.closest(popupSelectors[pi]);
                          if(popup){
                            var ptxt=safeText(popup.innerText||popup.textContent||'', 600);
                            if(ptxt&&!seen.has(ptxt)){seen.add(ptxt);parts.push(ptxt);}
                          }
                        }catch(_){}
                      }
                      return safeText(parts.join(' | '), 220);
                    };
                    var isNoThanksZone=function(cx,cy,label){
                      if(lower(label)!=='no thanks'){return false;}
                      if(viewportWidth<200||viewportHeight<120){return false;}
                      return cx < Math.round(viewportWidth*0.40) && cy > Math.round(viewportHeight*0.55);
                    };
                    var chosen=null;
                    for(var ni=0;ni<negativeCandidates.length;ni++){
                      var hit=negativeCandidates[ni];
                      var r=hit.node.getBoundingClientRect();
                      var cx=Math.round((r.left+r.right)/2);
                      var cy=Math.round((r.top+r.bottom)/2);
                      var contextText=collectContext(hit.node);
                      if(premiumSurfaceText(contextText)){
                        chosen={node:hit.node,label:hit.label,cx:cx,cy:cy,context:contextText,matchReason:'context-match'};
                        break;
                      }
                    }
                    if(!chosen){
                      for(var zi=0;zi<negativeCandidates.length;zi++){
                        var zoneHit=negativeCandidates[zi];
                        var zr=zoneHit.node.getBoundingClientRect();
                        var zcx=Math.round((zr.left+zr.right)/2);
                        var zcy=Math.round((zr.top+zr.bottom)/2);
                        if(isNoThanksZone(zcx,zcy,zoneHit.neg)){
                          chosen={node:zoneHit.node,label:zoneHit.label,cx:zcx,cy:zcy,context:'',matchReason:'negative-button-zone-match'};
                          break;
                        }
                      }
                    }
                    if(!chosen){
                      var noMatchReason=negativeCandidates.length>0
                        ? ('no-premium-surface candidateButtons='+candidateButtons+' negativeCount='+negativeCandidates.length)
                        : ('no-negative-button candidateButtons='+candidateButtons+' negativeCount=0');
                      window.prompt(promptPrefix+JSON.stringify({
                        type:'youtube-premium-popup',
                        pageUrl:window.location.href,
                        action:'skipped',
                        reason:noMatchReason,
                        checkReason:checkReason,
                        buttonLabel:'',
                        containerText:'',
                        buttonCenterX:-1,
                        buttonCenterY:-1,
                        viewportWidth:viewportWidth,
                        viewportHeight:viewportHeight
                      }),'');
                      return;
                    }
                    var bcx=chosen.cx;
                    var bcy=chosen.cy;
                    window.prompt(promptPrefix+JSON.stringify({
                      type:'youtube-premium-popup',
                      pageUrl:window.location.href,
                      action:'negative-button-found',
                      reason:chosen.matchReason,
                      checkReason:checkReason,
                      buttonLabel:chosen.label,
                      containerText:chosen.context,
                      buttonCenterX:bcx,
                      buttonCenterY:bcy,
                      viewportWidth:viewportWidth,
                      viewportHeight:viewportHeight
                    }),'');
                  }catch(error){
                    try{
                      window.prompt(${JSONObject.quote(PROMPT_PREFIX)}+JSON.stringify({type:'youtube-premium-popup',pageUrl:window.location.href,action:'error',reason:String(error&&error.message||error),checkReason:${JSONObject.quote(reason)},buttonLabel:'',containerText:'',buttonCenterX:-1,buttonCenterY:-1,viewportWidth:Math.round(window.innerWidth||0),viewportHeight:Math.round(window.innerHeight||0)}),'');
                    }catch(_){}
                  }
                })();
            """.trimIndent()
                session.loadUri(script)
            }
        }
        youtubePremiumPopupPendingRunnablesBySession.getOrPut(session) { mutableListOf() }.add(checkRunnable)
        pointerHandler.postDelayed(checkRunnable, delayMs)
    }

    private val permissionDelegate = object : GeckoSession.PermissionDelegate {
        override fun onContentPermissionRequest(
            session: GeckoSession,
            permission: GeckoSession.PermissionDelegate.ContentPermission,
        ): GeckoResult<Int> {
            val uriHost = runCatching { android.net.Uri.parse(permission.uri).host }.getOrNull()
            val thirdPartyHost = runCatching { android.net.Uri.parse(permission.thirdPartyOrigin).host }.getOrNull()
            val facebookScoped = isFacebookHost(uriHost) || isFacebookHost(thirdPartyHost)
            val googleVideoScoped = isGoogleVideoSurfaceHost(uriHost) || isGoogleVideoSurfaceHost(thirdPartyHost)
            val activeSessionUrl = tabController.findTabBySession(session)?.url.orEmpty()
            val currentRootUrl = currentUrl
            val absTopContext = isAbsTegoAutoplayContextUrl(activeSessionUrl) || isAbsTegoAutoplayContextUrl(currentRootUrl)
            val absPermissionUri = isAbsTegoAutoplayContextUrl(permission.uri.orEmpty())
            val absThirdPartyTego = isAbsTegoPlayerUrl(permission.thirdPartyOrigin.orEmpty())
            val absAutoplayScoped = ENABLE_ABS_TEGO_AUTOPLAY_PERMISSION_ALLOW &&
                (
                    permission.permission == GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_AUDIBLE ||
                        permission.permission == GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_INAUDIBLE
                    ) &&
                (
                    absPermissionUri ||
                        (absTopContext && absThirdPartyTego)
                    )
            val tttTopContext = isTttTegoContextUrl(activeSessionUrl) || isTttTegoContextUrl(currentRootUrl)
            val tttPermissionUri = isTttTegoContextUrl(permission.uri.orEmpty())
            val tttThirdPartyTego = isAbsTegoPlayerUrl(permission.thirdPartyOrigin.orEmpty())
            val tttAutoplayScoped = ENABLE_TTT_TEGO_AUTOPLAY_PERMISSION_ALLOW &&
                (
                    permission.permission == GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_AUDIBLE ||
                        permission.permission == GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_INAUDIBLE
                    ) &&
                (
                    tttPermissionUri ||
                        (tttTopContext && tttThirdPartyTego)
                    )
            val novusProfileScoped = novusTelearubaProfileBySession[session] != null
            val novusTopContext = isNovusTelearubaContextUrl(activeSessionUrl) || isNovusTelearubaContextUrl(currentRootUrl)
            val novusPermissionUri = isNovusTelearubaContextUrl(permission.uri.orEmpty())
            val novusThirdParty = isNovusTelearubaHost(thirdPartyHost)
            val novusAutoplayScoped = ENABLE_NOVUS_TELEARUBA_AUTOPLAY_PERMISSION_ALLOW &&
                (
                    permission.permission == GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_AUDIBLE ||
                        permission.permission == GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_INAUDIBLE
                    ) &&
                (
                    novusPermissionUri ||
                        (novusTopContext && (novusThirdParty || novusProfileScoped))
                    )
            val cgtvTopContext = isCgtvExternalContextUrl(activeSessionUrl) || isCgtvExternalContextUrl(currentRootUrl)
            val cgtvPermissionUri = isCgtvExternalContextUrl(permission.uri.orEmpty())
            val cgtvThirdPartyBradmax = isBradmaxHost(thirdPartyHost)
            val cgtvAutoplayScoped = ENABLE_CGTV_AUTOPLAY_PERMISSION_ALLOW &&
                (
                    permission.permission == GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_AUDIBLE ||
                        permission.permission == GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_INAUDIBLE
                    ) &&
                (
                    cgtvPermissionUri ||
                        (cgtvTopContext && cgtvThirdPartyBradmax)
                    )
            val chtvTopContext = isChtvContextUrl(activeSessionUrl) || isChtvContextUrl(currentRootUrl)
            val chtvPermissionUri = isChtvContextUrl(permission.uri.orEmpty())
            val chtvThirdParty = isChtvHost(thirdPartyHost)
            val chtvAutoplayScoped = ENABLE_CHTV_AUTOPLAY_PERMISSION_ALLOW &&
                (
                    permission.permission == GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_AUDIBLE ||
                        permission.permission == GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_INAUDIBLE
                    ) &&
                (
                    chtvPermissionUri ||
                        (chtvTopContext && chtvThirdParty)
                    )
            val caribvisionTopContext = isCaribVisionAppUrl(activeSessionUrl) || isCaribVisionAppUrl(currentRootUrl)
            val caribvisionPermissionUri =
                isCaribVisionAutoplayContextUrl(permission.uri.orEmpty()) ||
                    isCaribVisionAutoplayContextUrl(permission.thirdPartyOrigin.orEmpty())
            val caribvisionThirdParty =
                thirdPartyHost == CARIBVISION_OFFICIAL_HLS_HOST ||
                    thirdPartyHost == "app.caribvision.tv"
            val caribvisionAutoplayScoped = ENABLE_CARIBVISION_AUTOPLAY_PERMISSION_ALLOW &&
                (
                    permission.permission == GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_AUDIBLE ||
                        permission.permission == GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_INAUDIBLE
                    ) &&
                (
                    caribvisionPermissionUri ||
                        (caribvisionTopContext && caribvisionThirdParty)
                    )
            val cvmTopContext = isCvmLiveStreamUrl(activeSessionUrl) || isCvmLiveStreamUrl(currentRootUrl)
            val cvmPermissionUri = isCvmVimeoDiagnosticUrl(permission.uri.orEmpty())
            val cvmThirdPartyVimeo = isVimeoHostForCvm(thirdPartyHost)
            val cvmAutoplayScoped = ENABLE_CVM_VIMEO_AUTOPLAY_PERMISSION_ALLOW &&
                (
                    permission.permission == GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_AUDIBLE ||
                        permission.permission == GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_INAUDIBLE
                    ) &&
                (
                    cvmTopContext ||
                        cvmPermissionUri ||
                        (cvmThirdPartyVimeo && cvmTopContext)
                    )
            val cvc9TopContext = isCvc9DailymotionWatchPageUrl(activeSessionUrl) || isCvc9DailymotionWatchPageUrl(currentRootUrl)
            val cvc9PermissionUri = isCvc9DailymotionWatchPageUrl(permission.uri.orEmpty())
            val cvc9ThirdPartyDailymotion = thirdPartyHost?.lowercase().orEmpty().removePrefix("www.") == "geo.dailymotion.com"
            val cvc9AutoplayScoped = ENABLE_CVC9_DAILYMOTION_AUTOPLAY_PERMISSION_ALLOW &&
                (
                    permission.permission == GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_AUDIBLE ||
                        permission.permission == GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_INAUDIBLE
                    ) &&
                (cvc9PermissionUri || (cvc9TopContext && cvc9ThirdPartyDailymotion))
            val cnc3TopContext = isCnc3LiveStreamPageUrl(activeSessionUrl) || isCnc3LiveStreamPageUrl(currentRootUrl)
            val cnc3PermissionUri =
                isCnc3LiveStreamPageUrl(permission.uri.orEmpty()) ||
                    isCnc3DailymotionPlayerUrl(permission.uri.orEmpty())
            val cnc3ThirdPartyDailymotion = thirdPartyHost?.lowercase().orEmpty().removePrefix("www.") == "geo.dailymotion.com"
            val cnc3AutoplayScoped = ENABLE_CNC3_DAILYMOTION_AUTOPLAY_PERMISSION_ALLOW &&
                (
                    permission.permission == GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_AUDIBLE ||
                        permission.permission == GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_INAUDIBLE
                    ) &&
                (
                    cnc3PermissionUri ||
                        (cnc3TopContext && cnc3ThirdPartyDailymotion)
                    )
            val gbnTopContext = isGbnLivePageUrl(activeSessionUrl) || isGbnLivePageUrl(currentRootUrl)
            val gbnPermissionUri =
                isGbnLivePageUrl(permission.uri.orEmpty()) ||
                    isGbnDailymotionEmbedContextUrl(permission.uri.orEmpty())
            val gbnThirdPartyDailymotion = thirdPartyHost?.lowercase().orEmpty().removePrefix("www.") in setOf("dailymotion.com", "geo.dailymotion.com")
            val gbnAutoplayScoped = ENABLE_GBN_DAILYMOTION_AUTOPLAY_PERMISSION_ALLOW &&
                (
                    permission.permission == GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_AUDIBLE ||
                        permission.permission == GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_INAUDIBLE
                    ) &&
                (
                    gbnPermissionUri ||
                        (gbnTopContext && gbnThirdPartyDailymotion)
                    )
            val decision = when {
                absAutoplayScoped -> GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW
                tttAutoplayScoped -> GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW
                novusAutoplayScoped -> GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW
                cgtvAutoplayScoped -> GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW
                chtvAutoplayScoped -> GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW
                caribvisionAutoplayScoped -> GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW
                cvmAutoplayScoped -> GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW
                cvc9AutoplayScoped -> GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW
                cnc3AutoplayScoped -> GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW
                gbnAutoplayScoped -> GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW
                (facebookScoped || googleVideoScoped) &&
                    (
                        permission.permission == GeckoSession.PermissionDelegate.PERMISSION_STORAGE_ACCESS ||
                            permission.permission == GeckoSession.PermissionDelegate.PERMISSION_PERSISTENT_STORAGE ||
                            permission.permission == GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_AUDIBLE ||
                            permission.permission == GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_INAUDIBLE
                        ) -> GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW
                else -> permission.value
            }
            val tabId = tabController.findTabBySession(session)?.id ?: "unknown"
            GvLogger.i(
                "GvNav",
                "content permission tabId=$tabId uri=${permission.uri} thirdParty=${permission.thirdPartyOrigin} permission=${permission.permission} requestedValue=${permission.value} decision=$decision facebookScoped=$facebookScoped googleVideoScoped=$googleVideoScoped"
            )
            if (cvmAutoplayScoped) {
                GvLogger.i(
                    "GvMedia",
                    "cvm vimeo autoplay permission allow uri=${permission.uri} thirdParty=${permission.thirdPartyOrigin} permission=${permission.permission} requestedValue=${permission.value} decision=$decision activeUrl=$activeSessionUrl currentUrl=$currentRootUrl"
                )
            }
            if (absAutoplayScoped) {
                GvLogger.i(
                    "GvMedia",
                    "abs tego autoplay permission allow uri=${permission.uri} thirdParty=${permission.thirdPartyOrigin} permission=${permission.permission} requestedValue=${permission.value} decision=$decision activeUrl=$activeSessionUrl currentUrl=$currentRootUrl"
                )
            }
            if (tttAutoplayScoped) {
                GvLogger.i(
                    "GvMedia",
                    "ttt tego autoplay permission allow uri=${permission.uri} thirdParty=${permission.thirdPartyOrigin} permission=${permission.permission} requestedValue=${permission.value} decision=$decision activeUrl=$activeSessionUrl currentUrl=$currentRootUrl"
                )
            }
            if (novusAutoplayScoped) {
                GvLogger.i(
                    "GvMedia",
                    "novus telearuba autoplay permission allow uri=${permission.uri} thirdParty=${permission.thirdPartyOrigin} permission=${permission.permission} requestedValue=${permission.value} decision=$decision activeUrl=$activeSessionUrl currentUrl=$currentRootUrl"
                )
            }
            if (cgtvAutoplayScoped) {
                GvLogger.i(
                    "GvMedia",
                    "cgtv autoplay permission allow uri=${permission.uri} thirdParty=${permission.thirdPartyOrigin} permission=${permission.permission} requestedValue=${permission.value} decision=$decision activeUrl=$activeSessionUrl currentUrl=$currentRootUrl"
                )
            }
            if (chtvAutoplayScoped) {
                GvLogger.i(
                    "GvMedia",
                    "chtv autoplay permission allow uri=${permission.uri} thirdParty=${permission.thirdPartyOrigin} permission=${permission.permission} requestedValue=${permission.value} decision=$decision activeUrl=$activeSessionUrl currentUrl=$currentRootUrl"
                )
            }
            if (caribvisionAutoplayScoped) {
                GvLogger.i(
                    "GvMedia",
                    "caribvision autoplay permission allow uri=${permission.uri} thirdParty=${permission.thirdPartyOrigin} permission=${permission.permission} requestedValue=${permission.value} decision=$decision activeUrl=$activeSessionUrl currentUrl=$currentRootUrl"
                )
            }
            if (cnc3AutoplayScoped) {
                GvLogger.i(
                    "GvMedia",
                    "cnc3 dailymotion autoplay permission allow uri=${permission.uri} thirdParty=${permission.thirdPartyOrigin} permission=${permission.permission} requestedValue=${permission.value} decision=$decision activeUrl=$activeSessionUrl currentUrl=$currentRootUrl"
                )
            }
            if (cvc9AutoplayScoped) {
                GvLogger.i(
                    "GvMedia",
                    "cvc9 dailymotion watch-page autoplay permission allow uri=${permission.uri} thirdParty=${permission.thirdPartyOrigin} permission=${permission.permission} requestedValue=${
                        permission.value
                    } decision=$decision activeUrl=$activeSessionUrl currentUrl=$currentRootUrl"
                )
            }
            if (gbnAutoplayScoped) {
                GvLogger.i(
                    "GvMedia",
                    "gbn dailymotion embed autoplay permission allow uri=${permission.uri} thirdParty=${permission.thirdPartyOrigin} permission=${permission.permission} requestedValue=${permission.value} decision=$decision activeUrl=$activeSessionUrl currentUrl=$currentRootUrl"
                )
            }
            if (ENABLE_CVM_VIMEO_DIAGNOSTIC &&
                (isCvmVimeoDiagnosticUrl(permission.uri.orEmpty()) || isCvmVimeoDiagnosticUrl(permission.thirdPartyOrigin.orEmpty()))
            ) {
                GvLogger.i(
                    "GvMedia",
                    "cvm vimeo diagnostic permission uri=${permission.uri} thirdParty=${permission.thirdPartyOrigin} permission=${permission.permission} requestedValue=${permission.value} decision=$decision"
                )
            }
            return GeckoResult.fromValue(decision)
        }
    }

    private fun handlePointerInput(event: KeyEvent): Boolean {
        if (tabsOverlay.visibility == View.VISIBLE) {
            return false
        }
        if (!pointerAssistModeActive) {
            return false
        }
        if (event.keyCode !in POINTER_KEY_CODES) {
            return false
        }
        if (geckoView.width <= 0 || geckoView.height <= 0) {
            return false
        }
        when (event.action) {
            KeyEvent.ACTION_DOWN -> {
                when (event.keyCode) {
                    KeyEvent.KEYCODE_DPAD_LEFT,
                    KeyEvent.KEYCODE_DPAD_RIGHT,
                    KeyEvent.KEYCODE_DPAD_UP,
                    KeyEvent.KEYCODE_DPAD_DOWN -> {
                        val activeUrl = tabController.getActiveTab()?.url ?: currentUrl
                        val activeSession = tabController.getActiveTab()?.session
                        val novusTelearubaContext = isNovusTelearubaContextUrl(activeUrl)
                        val wasHidden = !pointerVisible || !pointerOverlay.isPointerVisible()
                        if (isTttOrTegoLivePlayerUrl(activeUrl)) {
                            val revealReason = if (wasHidden) "dpad-wake" else "dpad-move"
                            val reveal = revealTttTransportBar(
                                reason = revealReason,
                                preferStoredPointer = !wasHidden,
                            )
                                GvLogger.i(
                                    "GvMedia",
                                    "ttt transport reveal hover reason=$revealReason x=${reveal.x.toInt()} y=${reveal.y.toInt()} handled=${reveal.handled} pageUrl=$activeUrl"
                                )
                        } else if (novusTelearubaContext) {
                            ensurePointerVisible()
                        } else {
                            ensurePointerVisible()
                        }
                        if (wasHidden && isYouTubePageUrl(activeUrl)) {
                            GvLogger.i("GvInput", "youtube pointer woke reason=dpad-move")
                        } else if (wasHidden && shouldPointerAssistIdleSleep(activeUrl)) {
                            GvLogger.i("GvInput", "pointer woke reason=dpad-move url=$activeUrl")
                        }
                        val firstPress = pointerDirectionKeys.add(event.keyCode)
                        if (firstPress) {
                            pointerRepeatTicks = 0
                            val delta = directionalPointerDelta(event.keyCode)
                            val move = movePointerBy(
                                deltaX = delta.first * POINTER_MOVE_STEP_PX,
                                deltaY = delta.second * POINTER_MOVE_STEP_PX,
                            )
                            if (isChtvContextUrl(activeUrl)) {
                                val revealReason = if (wasHidden) "dpad-wake" else "dpad-move"
                                val handled = dispatchNativeMouseHoverAt(pointerX, pointerY, "chtv-transport-reveal-$revealReason")
                                GvLogger.i(
                                    "GvMedia",
                                    "chtv transport reveal hover reason=$revealReason x=${pointerX.toInt()} y=${pointerY.toInt()} handled=$handled pageUrl=$activeUrl"
                                )
                            } else if (isCaribvisionPlayerActive(activeSession, activeUrl)) {
                                val revealReason = if (wasHidden) "dpad-wake" else "dpad-move"
                                val handled = dispatchNativeMouseHoverAt(pointerX, pointerY, "caribvision-transport-reveal-$revealReason")
                                GvLogger.i(
                                    "GvMedia",
                                    "caribvision transport reveal hover reason=$revealReason x=${pointerX.toInt()} y=${pointerY.toInt()} handled=$handled pageUrl=$activeUrl"
                                )
                            }
                            if (!novusTelearubaContext) {
                                maybeDispatchKulchaFloHomepageRailHoverScroll(event.keyCode, move.overshootX, reason = "initial-edge")
                                maybeScrollContent(move.overshootX, move.overshootY, "initial")
                            }
                            startPointerRepeater()
                            if (!novusTelearubaContext) {
                                maybeDispatchDpadDocumentScrollFallback(
                                    keyCode = event.keyCode,
                                    reason = "initial-edge",
                                    scrollY = (move.overshootY * EDGE_SCROLL_MULTIPLIER).toInt(),
                                )
                            }
                            if (novusTelearubaContext) {
                                return true
                            }
                        }
                        return true
                    }
                    KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> {
                        if (!pointerVisible || !pointerOverlay.isPointerVisible()) {
                            return false
                        }
                        pointerOverlay.setPointerPressed(true)
                        pointerDownTime = SystemClock.uptimeMillis()
                        val handled = dispatchPointerClick()
                        if (handled) {
                            maybeScheduleYouTubePremiumPopupInteractionBurst(trigger = "pointer-ok")
                        }
                        return true
                    }
                }
                return false
            }

            KeyEvent.ACTION_UP -> {
                if (event.keyCode in POINTER_DIRECTION_KEYS) {
                    pointerDirectionKeys.remove(event.keyCode)
                    if (pointerDirectionKeys.isEmpty()) {
                        stopPointerRepeater()
                    }
                    return true
                }
                if (event.keyCode == KeyEvent.KEYCODE_DPAD_CENTER || event.keyCode == KeyEvent.KEYCODE_ENTER) {
                    if (!pointerVisible || !pointerOverlay.isPointerVisible()) {
                        return false
                    }
                    pointerOverlay.setPointerPressed(false)
                    return true
                }
                return false
            }
        }
        return false
    }

    private fun maybeHandlePointerAssistManualSummon(event: KeyEvent): Boolean {
        if (event.action != KeyEvent.ACTION_DOWN) {
            return false
        }
        if (event.keyCode != KeyEvent.KEYCODE_DPAD_CENTER && event.keyCode != KeyEvent.KEYCODE_ENTER) {
            return false
        }
        if (!event.isLongPress) {
            return false
        }
        if (tabsOverlay.visibility == View.VISIBLE || promotedMediaPlayer.isPromoted()) {
            return false
        }
        val activeUrl = tabController.getActiveTab()?.url ?: currentUrl
        if (!isPointerAssistAllowedForUrl(activeUrl)) {
            GvLogger.i("GvInput", "pointer assist manual summon skipped reason=site-focus-mode url=$activeUrl")
            return true
        }
        enablePointerAssistMode(reason = "manual-long-press-ok", url = activeUrl)
        return true
    }

    private fun isBrowserFullscreenLikeState(tab: GvTab? = tabController.getActiveTab()): Boolean {
        val activeTab = tab ?: return false
        return browserFullscreenStateBySession[activeTab.session] == true
    }

    private fun hideBrowserFullscreenPointer(reason: String) {
        pointerDirectionKeys.clear()
        stopPointerRepeater()
        pointerOverlay.setPointerPressed(false)
        browserFullscreenWakeOnlyPendingKeyUp = false
        if (!pointerVisible || !pointerOverlay.isPointerVisible()) {
            return
        }
        pointerVisible = false
        pointerOverlay.hidePointer()
        GvLogger.i("GvInput", "browser fullscreen pointer hide reason=$reason")
    }

    private fun scheduleBrowserFullscreenPointerSleep(reason: String) {
        if (!browserFullscreenPointerSleepActive) {
            return
        }
        pointerHandler.removeCallbacks(pointerIdleRunnable)
        pointerHandler.postDelayed(pointerIdleRunnable, BROWSER_FULLSCREEN_POINTER_IDLE_HIDE_MS)
        GvLogger.i("GvInput", "browser fullscreen pointer sleep scheduled delayMs=$BROWSER_FULLSCREEN_POINTER_IDLE_HIDE_MS reason=$reason")
    }

    private fun enterBrowserFullscreenPointerSleep(reason: String) {
        browserFullscreenPointerSleepActive = true
        hideBrowserFullscreenPointer(reason = reason)
        scheduleBrowserFullscreenPointerSleep(reason = reason)
        GvLogger.i("GvInput", "browser fullscreen pointer sleep enter reason=$reason")
    }

    private fun wakeBrowserFullscreenPointer(reason: String, url: String): Boolean {
        if (promotedMediaPlayer.isPromoted()) {
            return false
        }
        pointerAssistModeActive = true
        ensurePointerVisible()
        browserFullscreenPointerSleepActive = true
        scheduleBrowserFullscreenPointerSleep(reason = reason)
        GvLogger.i("GvInput", "browser fullscreen pointer wake reason=$reason url=$url")
        return true
    }

    private fun maybeHandleBrowserFullscreenPointerInput(event: KeyEvent): Boolean {
        if (tabsOverlay.visibility == View.VISIBLE || promotedMediaPlayer.isPromoted()) {
            return false
        }
        if (event.keyCode !in POINTER_KEY_CODES) {
            return false
        }
        val activeTab = tabController.getActiveTab() ?: return false
        val fullscreenActive = isBrowserFullscreenLikeState(activeTab)
        if (!fullscreenActive && !browserFullscreenPointerSleepActive) {
            return false
        }
        val activeUrl = activeTab.url
        when (event.keyCode) {
            KeyEvent.KEYCODE_DPAD_LEFT,
            KeyEvent.KEYCODE_DPAD_RIGHT,
            KeyEvent.KEYCODE_DPAD_UP,
            KeyEvent.KEYCODE_DPAD_DOWN -> {
                if (event.action == KeyEvent.ACTION_DOWN && (!pointerVisible || !pointerOverlay.isPointerVisible())) {
                    wakeBrowserFullscreenPointer(reason = "dpad-move", url = activeUrl)
                }
                return handlePointerInput(event)
            }
            KeyEvent.KEYCODE_DPAD_CENTER,
            KeyEvent.KEYCODE_ENTER -> {
                if (event.action == KeyEvent.ACTION_DOWN) {
                    if (!pointerVisible || !pointerOverlay.isPointerVisible()) {
                        browserFullscreenWakeOnlyPendingKeyUp = true
                        wakeBrowserFullscreenPointer(reason = "ok-wake", url = activeUrl)
                        return true
                    }
                    return handlePointerInput(event)
                }
                if (event.action == KeyEvent.ACTION_UP) {
                    if (browserFullscreenWakeOnlyPendingKeyUp) {
                        browserFullscreenWakeOnlyPendingKeyUp = false
                        scheduleBrowserFullscreenPointerSleep(reason = "ok-wake")
                        return true
                    }
                    return handlePointerInput(event)
                }
            }
        }
        return false
    }

    private fun maybeHandleBrowserFullscreenBackPolicy(): Boolean {
        if (promotedMediaPlayer.isPromoted() || tabsOverlay.visibility == View.VISIBLE) {
            return false
        }
        val activeTab = tabController.getActiveTab() ?: return false
        val activeUrl = activeTab.url
        if (isNovusTelearubaContextUrl(activeUrl)) {
            browserFullscreenPointerSleepActive = false
            browserFullscreenWakeOnlyPendingKeyUp = false
            return false
        }
        if (isCbnVirginIslandsLivePageUrl(activeUrl)) {
            return false
        }
        val youtubePage = isYouTubePageUrl(activeUrl)
        val facebookPage = isFacebookUrl(activeUrl)
        val cvmPlayer = isCvmLiveStreamUrl(activeUrl) || isCvmVimeoPlayerUrl(activeUrl)
        val fullscreenActive = isBrowserFullscreenLikeState(activeTab)
        if (youtubePage && !fullscreenActive) {
            browserFullscreenPointerSleepActive = false
            return false
        }
        if (facebookPage && !fullscreenActive) {
            browserFullscreenPointerSleepActive = false
            return false
        }
        if (cvmPlayer) {
            return false
        }
        if (isCvc9ContextUrl(activeUrl) || isCvc9DailymotionMediaUrl(activeUrl)) {
            return maybeHandleCvc9BackExit(activeTab, activeTab.session, activeUrl)
        }
        if (!fullscreenActive && !browserFullscreenPointerSleepActive) {
            return false
        }
        if (youtubePage && fullscreenActive) {
            val activeSession = activeTab.session
            cancelPendingYouTubeHelpersForBack(activeSession, activeUrl)
            suppressYouTubeAutoFullscreenAfterBack(activeSession, activeUrl, reason = "back-pressed")
            hideBrowserFullscreenPointer(reason = "back-fullscreen-exit")
            val eventTime = SystemClock.uptimeMillis()
            val down = KeyEvent(eventTime, eventTime, KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ESCAPE, 0)
            val up = KeyEvent(eventTime, eventTime + 20L, KeyEvent.ACTION_UP, KeyEvent.KEYCODE_ESCAPE, 0)
            val downHandled = geckoView.dispatchKeyEvent(down)
            val upHandled = geckoView.dispatchKeyEvent(up)
            activeSession.loadUri(
                "javascript:(function(){try{if(document.fullscreenElement&&document.exitFullscreen){document.exitFullscreen();}}catch(_){}})();"
            )
            GvLogger.i(
                "GvInput",
                "youtube back consumed reason=exit-fullscreen url=$activeUrl downHandled=$downHandled upHandled=$upHandled"
            )
            return true
        }
        if (facebookPage && fullscreenActive) {
            hideBrowserFullscreenPointer(reason = "facebook-back-fullscreen-exit")
            val eventTime = SystemClock.uptimeMillis()
            val down = KeyEvent(eventTime, eventTime, KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ESCAPE, 0)
            val up = KeyEvent(eventTime, eventTime + 20L, KeyEvent.ACTION_UP, KeyEvent.KEYCODE_ESCAPE, 0)
            val downHandled = geckoView.dispatchKeyEvent(down)
            val upHandled = geckoView.dispatchKeyEvent(up)
            activeTab.session.loadUri(
                "javascript:(function(){try{if(document.fullscreenElement&&document.exitFullscreen){document.exitFullscreen();}}catch(_){}})();"
            )
            GvLogger.i(
                "GvInput",
                "facebook back consumed reason=exit-fullscreen url=$activeUrl downHandled=$downHandled upHandled=$upHandled"
            )
            return true
        }
        if (fullscreenActive && isCaribvisionPlayerActive(activeTab.session, activeUrl)) {
            suppressCaribvisionFullscreenAssistAfterBack(activeTab.session, activeUrl, reason = "back-pressed")
            val eventTime = SystemClock.uptimeMillis()
            val down = KeyEvent(eventTime, eventTime, KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ESCAPE, 0)
            val up = KeyEvent(eventTime, eventTime + 20L, KeyEvent.ACTION_UP, KeyEvent.KEYCODE_ESCAPE, 0)
            val downHandled = geckoView.dispatchKeyEvent(down)
            val upHandled = geckoView.dispatchKeyEvent(up)
            activeTab.session.loadUri(
                "javascript:(function(){try{if(document.fullscreenElement&&document.exitFullscreen){document.exitFullscreen();}}catch(_){}})();"
            )
            GvLogger.i(
                "GvInput",
                "caribvision back consumed reason=exit-fullscreen url=$activeUrl downHandled=$downHandled upHandled=$upHandled"
            )
            return true
        }
        if (cvmPlayer && pointerVisible && pointerOverlay.isPointerVisible()) {
            enterBrowserFullscreenPointerSleep(reason = "back")
            GvLogger.i("GvInput", "browser fullscreen back consumed reason=sleep-pointer url=$activeUrl")
            return true
        }
        if (pointerVisible && pointerOverlay.isPointerVisible()) {
            hideBrowserFullscreenPointer(reason = "back")
            GvLogger.i("GvInput", "browser fullscreen back consumed reason=hide-pointer url=$activeUrl")
            return true
        }
        if (fullscreenActive) {
            if (isChtvContextUrl(activeUrl)) {
                suppressChtvFullscreenAssistAfterBack(activeTab.session, activeUrl, reason = "back-pressed")
            }
            val eventTime = SystemClock.uptimeMillis()
            val down = KeyEvent(eventTime, eventTime, KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ESCAPE, 0)
            val up = KeyEvent(eventTime, eventTime + 20L, KeyEvent.ACTION_UP, KeyEvent.KEYCODE_ESCAPE, 0)
            val downHandled = geckoView.dispatchKeyEvent(down)
            val upHandled = geckoView.dispatchKeyEvent(up)
            activeTab.session.loadUri(
                "javascript:(function(){try{if(document.fullscreenElement&&document.exitFullscreen){document.exitFullscreen();}}catch(_){}})();"
            )
            GvLogger.i(
                "GvInput",
                "browser fullscreen back dispatched reason=exit-fullscreen downHandled=$downHandled upHandled=$upHandled url=$activeUrl"
            )
            return true
        }
        browserFullscreenPointerSleepActive = false
        return false
    }

    private fun maybeHandleYouTubeBackPolicy(): Boolean {
        if (promotedMediaPlayer.isPromoted() || tabsOverlay.visibility == View.VISIBLE) {
            return false
        }
        val activeTab = tabController.getActiveTab() ?: return false
        val activeUrl = activeTab.url
        if (!isYouTubePageUrl(activeUrl)) {
            return false
        }
        if (isBrowserFullscreenLikeState(activeTab)) {
            return false
        }
        // Cancel any pending auto-fullscreen attempt when user presses Back.
        val activeSession = activeTab.session
        if (isYouTubeWatchOrLivePageUrl(activeUrl)) {
            cancelPendingYouTubeHelpersForBack(activeSession, activeUrl)
            suppressYouTubeAutoFullscreenAfterBack(activeSession, activeUrl, reason = "back-pressed")
        } else {
            cancelPendingYouTubeHelpersForBack(activeSession, activeUrl)
        }
        val pointerMissing = !pointerAssistModeActive || !pointerVisible || !pointerOverlay.isPointerVisible()
        if (pointerMissing) {
            if (!pointerAssistModeActive) {
                enablePointerAssistMode(reason = "youtube-back-restore-pointer", url = activeUrl)
            } else {
                ensurePointerVisible()
            }
            GvLogger.i("GvInput", "youtube back not-consumed reason=restore-pointer-while-allowing-history url=$activeUrl")
            return false
        }
        GvLogger.i("GvInput", "youtube back allowed reason=normal-history url=$activeUrl")
        return false
    }

    private fun maybeRecoverYouTubePointerAssistForDpad(event: KeyEvent): Boolean {
        if (tabsOverlay.visibility == View.VISIBLE || promotedMediaPlayer.isPromoted()) {
            return false
        }
        if (event.keyCode !in POINTER_KEY_CODES) {
            return false
        }
        val activeUrl = tabController.getActiveTab()?.url ?: currentUrl
        if (!isYouTubePageUrl(activeUrl)) {
            return false
        }
        if (pointerAssistModeActive) {
            return false
        }
        if (event.action != KeyEvent.ACTION_DOWN) {
            return false
        }
        enablePointerAssistMode(reason = "youtube-dpad-recover", url = activeUrl)
        GvLogger.i("GvInput", "youtube pointer recovery enabled reason=dpad-input url=$activeUrl")
        return false
    }

    private fun handleKulchaFloSiteFocusInput(event: KeyEvent): Boolean {
        if (tabsOverlay.visibility == View.VISIBLE || promotedMediaPlayer.isPromoted()) {
            return false
        }
        if (event.keyCode !in POINTER_KEY_CODES) {
            return false
        }
        val activeTab = tabController.getActiveTab() ?: return false
        val activeUrl = activeTab.url
        if (!isKulchaFloPage(activeUrl)) {
            return false
        }
        if (isPointerAssistAllowedForUrl(activeUrl) && !isKulchaFloGeneralSiteFocusUrl(activeUrl)) {
            return false
        }
        if (event.action == KeyEvent.ACTION_UP) {
            return true
        }
        if (event.action != KeyEvent.ACTION_DOWN) {
            return false
        }
        val action = when (event.keyCode) {
            KeyEvent.KEYCODE_DPAD_LEFT -> "left"
            KeyEvent.KEYCODE_DPAD_RIGHT -> "right"
            KeyEvent.KEYCODE_DPAD_UP -> "up"
            KeyEvent.KEYCODE_DPAD_DOWN -> "down"
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> "activate"
            else -> return false
        }
        dispatchKulchaFloSiteFocusAction(activeTab.session, activeUrl, action)
        GvLogger.i("GvInput", "site focus key dispatched action=$action keyCode=${event.keyCode} url=$activeUrl")
        return true
    }

    private fun handlePromotedPointerInput(event: KeyEvent): Boolean {
        if (!promotedPointerModeActive || event.keyCode !in POINTER_KEY_CODES) {
            return false
        }
        if (!promotedMediaPlayer.isPromoted() || !isExactCbcLiveHlsUrl(promotedMediaPlayer.currentSourceUrl().orEmpty())) {
            disablePromotedPointerMode(reason = "source-inactive", keepPointerVisible = false)
            return false
        }
        if (geckoView.width <= 0 || geckoView.height <= 0) {
            return false
        }
        when (event.action) {
            KeyEvent.ACTION_DOWN -> {
                when (event.keyCode) {
                    KeyEvent.KEYCODE_DPAD_LEFT,
                    KeyEvent.KEYCODE_DPAD_RIGHT,
                    KeyEvent.KEYCODE_DPAD_UP,
                    KeyEvent.KEYCODE_DPAD_DOWN -> {
                        ensurePromotedPointerVisible()
                        val firstPress = pointerDirectionKeys.add(event.keyCode)
                        if (firstPress) {
                            pointerRepeatTicks = 0
                            val delta = directionalPointerDelta(event.keyCode)
                            movePromotedPointerBy(
                                deltaX = delta.first * POINTER_MOVE_STEP_PX,
                                deltaY = delta.second * POINTER_MOVE_STEP_PX,
                            )
                            startPromotedPointerRepeater()
                        }
                        return true
                    }
                    KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> {
                        ensurePromotedPointerVisible()
                        pointerOverlay.setPointerPressed(true)
                        pointerDownTime = SystemClock.uptimeMillis()
                        val handled = promotedMediaPlayer.dispatchPointerTap(pointerX, pointerY)
                        GvLogger.i(
                            "GvInput",
                            "promoted pointer tap dispatched target=player-view x=${pointerX.toInt()} y=${pointerY.toInt()} handled=$handled"
                        )
                        return true
                    }
                }
                return false
            }

            KeyEvent.ACTION_UP -> {
                if (event.keyCode in POINTER_DIRECTION_KEYS) {
                    pointerDirectionKeys.remove(event.keyCode)
                    if (pointerDirectionKeys.isEmpty()) {
                        stopPromotedPointerRepeater()
                    }
                    return true
                }
                if (event.keyCode == KeyEvent.KEYCODE_DPAD_CENTER || event.keyCode == KeyEvent.KEYCODE_ENTER) {
                    pointerOverlay.setPointerPressed(false)
                    return true
                }
                return false
            }
        }
        return false
    }

    private fun handleCnc3PromotedDpadInput(event: KeyEvent): Boolean {
        if (!promotedMediaPlayer.isPromoted() || event.keyCode !in POINTER_KEY_CODES) {
            return false
        }
        val sourceUrl = promotedMediaPlayer.currentSourceUrl().orEmpty()
        val activeUrl = tabController.getActiveTab()?.url ?: currentUrl
        if (!isCnc3DailymotionMediaUrl(sourceUrl) && !isCnc3ContextUrl(activeUrl)) {
            return false
        }
        if (geckoView.width <= 0 || geckoView.height <= 0) {
            return false
        }
        when (event.action) {
            KeyEvent.ACTION_DOWN -> {
                when (event.keyCode) {
                    KeyEvent.KEYCODE_DPAD_LEFT,
                    KeyEvent.KEYCODE_DPAD_RIGHT,
                    KeyEvent.KEYCODE_DPAD_UP,
                    KeyEvent.KEYCODE_DPAD_DOWN -> {
                        ensurePromotedPointerVisible()
                        val firstPress = pointerDirectionKeys.add(event.keyCode)
                        if (firstPress) {
                            pointerRepeatTicks = 0
                            val delta = directionalPointerDelta(event.keyCode)
                            movePromotedPointerBy(
                                deltaX = delta.first * POINTER_MOVE_STEP_PX,
                                deltaY = delta.second * POINTER_MOVE_STEP_PX,
                            )
                            startPromotedPointerRepeater()
                        }
                        return true
                    }
                }
                return false
            }

            KeyEvent.ACTION_UP -> {
                if (event.keyCode in POINTER_DIRECTION_KEYS) {
                    pointerDirectionKeys.remove(event.keyCode)
                    if (pointerDirectionKeys.isEmpty()) {
                        stopPromotedPointerRepeater()
                    }
                    return true
                }
                return false
            }
        }
        return false
    }

    private fun maybeHandleAbsBackExit(
        activeTab: GvTab?,
        activeSession: GeckoSession?,
        activeUrl: String,
    ): Boolean {
        if (activeTab == null || activeSession == null) {
            return false
        }
        if (!isAbsTegoGestureFullscreenContextUrl(activeUrl)) {
            return false
        }
        val returnUrl = absTegoPlayerFirstReturnUrlBySession[activeSession].orEmpty()
        val targetTab = returnUrl.takeIf { it.isNotBlank() }?.let { url ->
            tabController.getTabs().firstOrNull { tab ->
                tab.id != activeTab.id && tab.url.startsWith(url)
            }
        }
        if (targetTab == null && !activeTab.canGoBack && returnUrl.isBlank()) {
            return false
        }
        absTegoPlayerFirstReturnUrlBySession.remove(activeSession)
        browserFullscreenPointerSleepActive = false
        browserFullscreenWakeOnlyPendingKeyUp = false
        if (pointerAssistModeActive || pointerVisible || pointerOverlay.isPointerVisible()) {
            disablePointerAssistMode(reason = "abs-back-exit")
        }
        when {
            targetTab != null -> {
                GvLogger.i(
                    "GvNav",
                    "abs back consumed reason=exit-hostile-player mode=existing-tab url=$activeUrl returnUrl=$returnUrl tabId=${targetTab.id}"
                )
                tabController.activateTab(targetTab.id)
                tabController.closeTab(activeTab.id)
            }
            activeTab.canGoBack -> {
                GvLogger.i(
                    "GvNav",
                    "abs back consumed reason=exit-hostile-player mode=history-back url=$activeUrl returnUrl=$returnUrl"
                )
                activeSession.goBack()
            }
            returnUrl.isNotBlank() -> {
                GvLogger.i(
                    "GvNav",
                    "abs back consumed reason=exit-hostile-player mode=replace-history url=$activeUrl returnUrl=$returnUrl"
                )
                activeSession.load(
                    GeckoSession.Loader()
                        .uri(returnUrl)
                        .flags(GeckoSession.LOAD_FLAGS_REPLACE_HISTORY)
                )
            }
            else -> return false
        }
        return true
    }

    private fun maybeHandleTttBackExit(
        activeTab: GvTab?,
        activeSession: GeckoSession?,
        activeUrl: String,
    ): Boolean {
        if (activeTab == null || activeSession == null) {
            return false
        }
        if (!isTttOrTegoLivePlayerUrl(activeUrl)) {
            return false
        }
        val returnUrl = tttTegoPlayerFirstReturnUrlBySession[activeSession].orEmpty()
        val targetTab = returnUrl.takeIf { it.isNotBlank() }?.let { url ->
            tabController.getTabs().firstOrNull { tab ->
                tab.id != activeTab.id && tab.url.startsWith(url)
            }
        }
        if (targetTab == null && !activeTab.canGoBack && returnUrl.isBlank()) {
            return false
        }
        tttTegoPlayerFirstReturnUrlBySession.remove(activeSession)
        tttTegoPlayAssistBySession.remove(activeSession)
        browserFullscreenPointerSleepActive = false
        browserFullscreenWakeOnlyPendingKeyUp = false
        if (pointerAssistModeActive || pointerVisible || pointerOverlay.isPointerVisible()) {
            disablePointerAssistMode(reason = "ttt-back-exit")
        }
        when {
            targetTab != null -> {
                GvLogger.i(
                    "GvNav",
                    "ttt back consumed reason=exit-live-player mode=existing-tab url=$activeUrl returnUrl=$returnUrl tabId=${targetTab.id}"
                )
                tabController.activateTab(targetTab.id)
                tabController.closeTab(activeTab.id)
            }
            isTttLivePlayerUrl(activeUrl) && activeTab.canGoBack -> {
                GvLogger.i(
                    "GvNav",
                    "ttt back consumed reason=exit-live-player mode=history-back url=$activeUrl returnUrl=$returnUrl"
                )
                activeSession.goBack()
            }
            returnUrl.isNotBlank() -> {
                GvLogger.i(
                    "GvNav",
                    "ttt back consumed reason=exit-live-player mode=replace-history url=$activeUrl returnUrl=$returnUrl"
                )
                activeSession.load(
                    GeckoSession.Loader()
                        .uri(returnUrl)
                        .flags(GeckoSession.LOAD_FLAGS_REPLACE_HISTORY)
                )
            }
            activeTab.canGoBack -> {
                GvLogger.i(
                    "GvNav",
                    "ttt back consumed reason=exit-live-player mode=history-back-fallback url=$activeUrl returnUrl=$returnUrl"
                )
                activeSession.goBack()
            }
            else -> return false
        }
        return true
    }

    private fun novusTelearubaProfileTag(session: GeckoSession?): String {
        val channel = session?.let {
            novusTelearubaProfileBySession[it]?.desiredChannel
        }.orEmpty()
        return when (channel) {
            "13" -> "telearuba"
            "23" -> "nos-isla-novus"
            "49" -> "aruba-novus"
            else -> "novus-telearuba"
        }
    }

    private fun maybeHandleNovusTelearubaBackExit(
        activeTab: GvTab?,
        activeSession: GeckoSession?,
        activeUrl: String,
    ): Boolean {
        if (activeTab == null || activeSession == null) {
            return false
        }
        if (!isNovusTelearubaPlayerUrl(activeUrl)) {
            return false
        }
        val profileTag = novusTelearubaProfileTag(activeSession)
        val profile = novusTelearubaProfileBySession[activeSession]
        val returnUrl = novusTelearubaPlayerFirstReturnUrlBySession[activeSession]
            ?.takeIf { it.isNotBlank() }
                ?: profile?.returnUrl?.takeIf { it.isNotBlank() }
            ?: BuildConfig.DEFAULT_START_URL
        novusTelearubaPlayerFirstReturnUrlBySession.remove(activeSession)
        novusTelearubaProfileBySession.remove(activeSession)
        novusTelearubaPlayAssistBySession.remove(activeSession)
        browserFullscreenPointerSleepActive = false
        browserFullscreenWakeOnlyPendingKeyUp = false
        if (pointerAssistModeActive || pointerVisible || pointerOverlay.isPointerVisible()) {
            disablePointerAssistMode(reason = "novus-back-exit")
        }
        val targetTab = tabController.getTabs().firstOrNull { tab ->
            tab.id != activeTab.id && tab.url.startsWith(returnUrl)
        }
        return if (targetTab != null) {
            GvLogger.i(
                "GvNav",
                "$profileTag back consumed reason=exit-to-kulchaflo mode=existing-tab url=$activeUrl returnUrl=$returnUrl tabId=${targetTab.id}"
            )
            tabController.activateTab(targetTab.id)
            tabController.closeTab(activeTab.id)
            true
        } else {
            GvLogger.i(
                "GvNav",
                "$profileTag back consumed reason=exit-to-kulchaflo mode=new-tab url=$activeUrl returnUrl=$returnUrl"
            )
            tabController.createTab(returnUrl, activate = true)
            tabController.closeTab(activeTab.id)
            true
        }
    }

    private fun maybeHandleCbnVirginIslandsBackExit(
        activeTab: GvTab?,
        activeSession: GeckoSession?,
        activeUrl: String,
    ): Boolean {
        if (activeTab == null || activeSession == null) {
            return false
        }
        if (!isCbnVirginIslandsLivePageUrl(activeUrl)) {
            return false
        }
        browserFullscreenPointerSleepActive = false
        browserFullscreenWakeOnlyPendingKeyUp = false
        val returnUrl = BuildConfig.DEFAULT_START_URL
        if (activeTab.canGoBack) {
            GvLogger.i(
                "GvNav",
                "cbn back consumed reason=exit-to-kulchaflo mode=history-back url=$activeUrl returnUrl=$returnUrl"
            )
            activeSession.goBack()
        } else {
            GvLogger.i(
                "GvNav",
                "cbn back consumed reason=exit-to-kulchaflo mode=replace-history url=$activeUrl returnUrl=$returnUrl"
            )
            activeSession.load(
                GeckoSession.Loader()
                    .uri(returnUrl)
                    .flags(GeckoSession.LOAD_FLAGS_REPLACE_HISTORY)
            )
        }
        return true
    }

    private fun maybeHandleCvc9BackExit(
        activeTab: GvTab?,
        activeSession: GeckoSession?,
        activeUrl: String,
    ): Boolean {
        if (activeTab == null || activeSession == null) {
            return false
        }
        if (!isCvc9ContextUrl(activeUrl) && !isCvc9DailymotionMediaUrl(activeUrl)) {
            return false
        }
        browserFullscreenPointerSleepActive = false
        browserFullscreenWakeOnlyPendingKeyUp = false
        if (pointerAssistModeActive || pointerVisible || pointerOverlay.isPointerVisible()) {
            disablePointerAssistMode(reason = "cvc9-back-exit")
        }
        activeSession.load(
            GeckoSession.Loader()
                .uri(BuildConfig.DEFAULT_START_URL)
                .flags(GeckoSession.LOAD_FLAGS_REPLACE_HISTORY)
        )
        GvLogger.i(
            "GvNav",
            "cvc9 back consumed reason=exit-to-kulchaflo url=$activeUrl returnUrl=${BuildConfig.DEFAULT_START_URL}"
        )
        return true
    }

    private fun scheduleCbnVirginIslandsAutostartTap(
        session: GeckoSession,
        pageUrl: String,
        delayMs: Long = 700L,
    ) {
        if (cbnVirginIslandsAutostartTapRunnableBySession.containsKey(session)) {
            return
        }
        val runnable = Runnable {
            cbnVirginIslandsAutostartTapRunnableBySession.remove(session)
            if (isFinishing || isDestroyed) {
                return@Runnable
            }
            val activeTab = tabController.getActiveTab()
            if (activeTab?.session != session || !isCbnVirginIslandsLivePageUrl(activeTab.url)) {
                return@Runnable
            }
            if (isCbnVirginIslandsBrowserPlaybackActive(session)) {
                cbnVirginIslandsAutostartTapCountBySession.remove(session)
                return@Runnable
            }
            val width = (geckoView.width.takeIf { it > 0 } ?: resources.displayMetrics.widthPixels).toFloat()
            val height = (geckoView.height.takeIf { it > 0 } ?: resources.displayMetrics.heightPixels).toFloat()
            val handled = dispatchNativeMouseTapAt(width * 0.5f, height * 0.5f, "cbn-autostart")
            cbnVirginIslandsAutostartTapCountBySession[session] = 1
            GvLogger.i(
                "GvMedia",
                "cbn virgin islands native tap dispatched attempt=1 handled=$handled pageUrl=$pageUrl"
            )
        }
        cbnVirginIslandsAutostartTapRunnableBySession[session] = runnable
        pointerHandler.postDelayed(runnable, delayMs)
    }

    private fun maybeScheduleCnc3AutostartTap(
        session: GeckoSession,
        pageUrl: String,
        delayMs: Long = 300L,
    ) {
        if (cnc3AutostartAttemptedBySession.contains(session) || cnc3AutostartTapRunnableBySession.containsKey(session)) {
            return
        }
        if (!isCnc3LiveStreamPageUrl(pageUrl) && !isCnc3DailymotionPlayerUrl(pageUrl)) {
            return
        }
        cnc3AutostartAttemptedBySession.add(session)
        val runnable = Runnable {
            cnc3AutostartTapRunnableBySession.remove(session)
            if (isFinishing || isDestroyed) {
                return@Runnable
            }
            val activeTab = tabController.getActiveTab()
            val activeUrl = activeTab?.url.orEmpty()
            if (!isCnc3LiveStreamPageUrl(activeUrl) && !isCnc3DailymotionPlayerUrl(activeUrl)) {
                return@Runnable
            }
            if (isCnc3BrowserPlaybackActive(session)) {
                return@Runnable
            }
            val width = (geckoView.width.takeIf { it > 0 } ?: resources.displayMetrics.widthPixels).toFloat()
            val height = (geckoView.height.takeIf { it > 0 } ?: resources.displayMetrics.heightPixels).toFloat()
            val handled = dispatchNativeMouseTapAt(width * 0.5f, height * 0.5f, "cnc3-autostart")
            GvLogger.i("GvMedia", "cnc3 autostart tap dispatched handled=$handled pageUrl=$pageUrl")
        }
        cnc3AutostartTapRunnableBySession[session] = runnable
        pointerHandler.postDelayed(runnable, delayMs)
    }

    private fun isCnc3BrowserPlaybackActive(session: GeckoSession): Boolean {
        return browserMediaController.describeSessionState(session).contains("playing=true")
    }

    private fun isCbnVirginIslandsBrowserPlaybackActive(session: GeckoSession): Boolean {
        return browserMediaController.describeSessionState(session).contains("playing=true")
    }

    private fun ensurePointerVisible() {
        if (pointerVisible && pointerOverlay.isPointerVisible()) {
            schedulePointerIdleTimeout()
            return
        }
        val maxWidth = (geckoView.width.takeIf { it > 0 } ?: resources.displayMetrics.widthPixels).toFloat()
        val maxHeight = (geckoView.height.takeIf { it > 0 } ?: resources.displayMetrics.heightPixels).toFloat()
        val inset = pointerBoundsInsetPx()
        val minX = inset
        val maxX = maxWidth - inset
        val minY = inset
        val maxY = maxHeight - inset
        val hasStoredPosition = pointerX in minX..maxX && pointerY in minY..maxY
        pointerX = if (hasStoredPosition) pointerX.coerceIn(minX, maxX) else (maxWidth * 0.5f).coerceIn(minX, maxX)
        pointerY = if (hasStoredPosition) pointerY.coerceIn(minY, maxY) else (maxHeight * 0.5f).coerceIn(minY, maxY)
        pointerOverlay.showAt(pointerX, pointerY)
        pointerVisible = true
        schedulePointerIdleTimeout()
        GvLogger.i("GvInput", "pointer visible=true reason=ensure-visible restored=$hasStoredPosition x=${pointerX.toInt()} y=${pointerY.toInt()}")
        if (!promotedMediaPlayer.isPromoted()) {
            GvLogger.i("GvInput", "pointer assist remains available mode=page")
        }
    }

    private fun enablePointerAssistMode(reason: String, url: String) {
        pointerAssistModeActive = true
        ensurePointerVisible()
        GvLogger.i("GvInput", "pointer assist manually enabled reason=$reason url=$url")
    }

    private fun disablePointerAssistMode(reason: String) {
        pointerAssistModeActive = false
        pointerDirectionKeys.clear()
        stopPointerRepeater()
        pointerVisible = false
        pointerOverlay.setPointerPressed(false)
        pointerOverlay.hidePointer()
        GvLogger.i("GvInput", "pointer assist hidden reason=$reason")
    }

    private fun applyPageInputModePolicy(url: String, reason: String) {
        if (promotedMediaPlayer.isPromoted()) {
            return
        }
        if (isKulchaFloPage(url)) {
            if (pointerAssistModeActive || pointerVisible || pointerOverlay.isPointerVisible()) {
                disablePointerAssistMode(reason = "site-focus-mode")
            }
            browserFullscreenPointerSleepActive = false
            browserFullscreenWakeOnlyPendingKeyUp = false
            geckoView.requestFocus()
            GvLogger.i("GvInput", "site focus mode active url=$url reason=$reason")
            GvLogger.i("GvInput", "pointer assist hidden reason=site-focus-mode url=$url")
            return
        }
        val modeReason = when {
            isYouTubePageUrl(url) -> "external-youtube"
            isAbsTegoGestureFullscreenContextUrl(url) || isTttTegoContextUrl(url) -> "hostile-web-player"
            else -> "external-page"
        }
        if (!pointerAssistModeActive) {
            enablePointerAssistMode(reason = modeReason, url = url)
        } else if (!isBrowserFullscreenLikeState()) {
            ensurePointerVisible()
        }
        if (!isBrowserFullscreenLikeState()) {
            browserFullscreenPointerSleepActive = false
            browserFullscreenWakeOnlyPendingKeyUp = false
        }
        geckoView.requestFocus()
        if (isYouTubePageUrl(url)) {
            GvLogger.i("GvInput", "youtube simple policy active url=$url reason=$reason")
        } else {
            GvLogger.i("GvInput", "pointer assist auto-enabled reason=$modeReason url=$url")
        }
    }

    private fun isPointerAssistAllowedForUrl(url: String): Boolean {
        if (!isKulchaFloPage(url)) {
            return true
        }
        return isCgtvContextUrl(url) ||
            isAbsTegoChannel10ContextUrl(url) ||
            isTttTegoContextUrl(url) ||
            isNovusTelearubaContextUrl(url)
    }

    private fun shouldPointerAssistIdleSleep(url: String): Boolean {
        val activeSession = tabController.getActiveTab()?.session
        return isYouTubePageUrl(url) ||
            isAbsTegoGestureFullscreenContextUrl(url) ||
            isTttTegoContextUrl(url) ||
            isNovusTelearubaContextUrl(url) ||
            isCgtvContextUrl(url) ||
            isChtvContextUrl(url) ||
            isCaribvisionPlayerActive(activeSession, url) ||
            isCvc9ContextUrl(url) ||
            isCnc3LiveStreamPageUrl(url) ||
            isCnc3DailymotionPlayerUrl(url) ||
            isCvmLiveStreamUrl(url) ||
            isCvmVimeoPlayerUrl(url)
    }

    private fun isKulchaFloGeneralSiteFocusUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val host = uri.host?.lowercase()?.removePrefix("www.") ?: return false
        if (host != "kulchaflo.com") return false
        return true
    }

    private fun dispatchKulchaFloSiteFocusAction(session: GeckoSession, pageUrl: String, action: String) {
        val script = """
            javascript:(function(){
              try{
                var promptPrefix=${JSONObject.quote(PROMPT_PREFIX)};
                var pageUrl=${JSONObject.quote(pageUrl)};
                var action=${JSONObject.quote(action)};
                var stateKey='__kfTvFocusState';
                var state=window[stateKey]||(window[stateKey]={railIndex:0,itemByRail:{}});
                var detailPage=(function(){
                  try{
                    var path=new URL(pageUrl,location.href).pathname||location.pathname||'';
                    var parts=path.split('/').filter(Boolean);
                    if(parts.length<2){return false;}
                    if(parts[0]==='category'||parts[0]==='tag'||parts[0]==='search'||parts[0]==='countries'){return false;}
                    return true;
                  }catch(_){return false;}
                })();
                var styleId='kf-tv-focus-style';
                if(!document.getElementById(styleId)){
                  var style=document.createElement('style');
                  style.id=styleId;
                  style.textContent='input[type="search"],input[type="text"][name*="search" i],[role="searchbox"]{color:#f8f3ea!important;-webkit-text-fill-color:#f8f3ea!important;opacity:1!important;}input[type="search"]::placeholder,input[type="text"][name*="search" i]::placeholder{color:rgba(248,243,234,.72)!important;-webkit-text-fill-color:rgba(248,243,234,.72)!important;opacity:1!important;}[data-kf-tv-focused="1"],[data-kf-tv-focused="1"]:focus,[data-kf-tv-focused="1"]:focus-visible,[data-kf-tv-focused="1"] *:focus,[data-kf-tv-focused="1"] *:focus-visible{outline:none!important;}[data-kf-tv-focused="1"]{position:relative!important;z-index:20!important;transition:box-shadow .16s ease,transform .16s ease,background-color .16s ease,color .16s ease!important;}[data-kf-tv-focused="1"].kf-card,[data-kf-tv-focused="1"].kf-mini,[data-kf-tv-focused="1"].kf-channel-card,[data-kf-tv-focused="1"].kf-post-card,[data-kf-tv-focused="1"].wp-block-embed,[data-kf-tv-focused="1"].kf-watch-frame,[data-kf-tv-focused="1"].kf-player-frame,[data-kf-tv-focused="1"].kf-video-frame,[data-kf-tv-focused="1"].kf-meta-card,[data-kf-tv-focused="1"].kf-info-card,[data-kf-tv-focused="1"].kf-stat-card,[data-kf-tv-focused="1"].kf-channel-detail,[data-kf-tv-focused="1"].kf-channel-meta,[data-kf-tv-focused="1"].kf-channel-info,[data-kf-tv-focused="1"].wp-block-column,[data-kf-tv-focused="1"].wp-block-group{border-radius:18px!important;box-shadow:0 16px 38px rgba(255,255,255,.14)!important;transform:translateZ(0) scale(1.01)!important;}[data-kf-tv-focused="1"].kf-card::after,[data-kf-tv-focused="1"].kf-mini::after,[data-kf-tv-focused="1"].kf-channel-card::after,[data-kf-tv-focused="1"].kf-post-card::after,[data-kf-tv-focused="1"].wp-block-embed::after,[data-kf-tv-focused="1"].kf-watch-frame::after,[data-kf-tv-focused="1"].kf-player-frame::after,[data-kf-tv-focused="1"].kf-video-frame::after,[data-kf-tv-focused="1"].kf-meta-card::after,[data-kf-tv-focused="1"].kf-info-card::after,[data-kf-tv-focused="1"].kf-stat-card::after,[data-kf-tv-focused="1"].kf-channel-detail::after,[data-kf-tv-focused="1"].kf-channel-meta::after,[data-kf-tv-focused="1"].kf-channel-info::after,[data-kf-tv-focused="1"].wp-block-column::after,[data-kf-tv-focused="1"].wp-block-group::after{content:""!important;position:absolute!important;inset:0!important;border:5px solid #fff!important;border-radius:inherit!important;box-shadow:inset 0 0 0 3px rgba(8,10,12,.9)!important;pointer-events:none!important;z-index:40!important;}iframe[data-kf-tv-focused="1"],video[data-kf-tv-focused="1"]{border-radius:18px!important;box-shadow:0 0 0 5px #fff,0 0 0 9px rgba(8,10,12,.96),0 16px 38px rgba(255,255,255,.16)!important;}[data-kf-tv-focused="1"].kf-chipbtn,[data-kf-tv-focused="1"].wp-block-button__link,[data-kf-tv-focused="1"][role="button"],[data-kf-tv-focused="1"][role="link"],a[data-kf-tv-focused="1"]:not(.kf-card):not(.kf-mini):not(.kf-channel-card):not(.kf-post-card),button[data-kf-tv-focused="1"],summary[data-kf-tv-focused="1"]{background:#fff!important;color:#0b0907!important;border-color:#fff!important;border-radius:999px!important;box-shadow:inset 0 0 0 1px #3a2418,0 0 0 4px #fff,0 0 0 8px rgba(8,10,12,.96),0 10px 26px rgba(255,255,255,.18)!important;transform:translateZ(0) scale(1.025)!important;}input[data-kf-tv-focused="1"],[data-kf-tv-focused="1"][role="searchbox"]{background:#fff!important;color:#0b0907!important;-webkit-text-fill-color:#0b0907!important;border-color:#fff!important;border-radius:10px!important;box-shadow:inset 0 0 0 1px #3a2418,0 0 0 4px #fff,0 0 0 8px rgba(8,10,12,.96),0 10px 26px rgba(255,255,255,.18)!important;}input[data-kf-tv-focused="1"]::placeholder{color:rgba(11,9,7,.64)!important;-webkit-text-fill-color:rgba(11,9,7,.64)!important;opacity:1!important;}[data-kf-tv-focused="1"].kf-chipbtn *,[data-kf-tv-focused="1"].wp-block-button__link *,[data-kf-tv-focused="1"][role="button"] *,[data-kf-tv-focused="1"][role="link"] *,a[data-kf-tv-focused="1"]:not(.kf-card):not(.kf-mini):not(.kf-channel-card):not(.kf-post-card) *,button[data-kf-tv-focused="1"] *,summary[data-kf-tv-focused="1"] *{color:#0b0907!important;}[data-kf-tv-focused="1"] img{filter:saturate(1.04) contrast(1.02)!important;}';
                  document.documentElement.appendChild(style);
                }
                var itemSelector=[
                  'a.kf-card[href]','.kf-card a[href]','a.kf-channel-card[href]','.kf-channel-card a[href]',
                  'a.kf-post-card[href]','.kf-post-card a[href]','.wp-block-button__link','article a[href]',
                  '.wp-block-embed','iframe[src]','video','.kf-watch-frame','.kf-player-frame','.kf-video-frame',
                  'a[href]','button','summary','input[type="search"]','input[type="text"]',
                  '[role="button"]','[role="link"]','[role="menuitem"]','[role="searchbox"]'
                ].join(',');
                var channelInfoSelector='.kf-meta-card,.kf-info-card,.kf-stat-card,.kf-channel-detail,.kf-channel-meta,.kf-channel-info,.kf-show-hero,.kf-detail-hero,.kf-hero-media,.kf-media-frame,.kf-show-frame,.kf-video-card,.wp-block-column,.wp-block-group,figure,.wp-block-image';
                var railSelector='.kf-rail,.kf-chiprail,.kf-search-rail,.kf-grid,.kf-card-grid,.wp-block-post-template,.wp-block-query';
                var displayable=function(el){
                  try{
                    if(!el||el.disabled||el.getAttribute('aria-hidden')==='true'){return false;}
                    var tag=(el.tagName||'').toLowerCase();
                    var inputType=(el.getAttribute&&String(el.getAttribute('type')||'').toLowerCase())||'';
                    if(tag==='select'||tag==='textarea'||(tag==='input'&&inputType!=='search'&&inputType!=='text')){return false;}
                    var r=el.getBoundingClientRect();
                    if(r.width<8||r.height<8){return false;}
                    var s=getComputedStyle(el);
                    return !(s.visibility==='hidden'||s.display==='none'||Number(s.opacity||1)<0.05);
                  }catch(_){return false;}
                };
                var railVisible=function(el){
                  try{
                    if(!displayable(el)){return false;}
                    var r=el.getBoundingClientRect();
                    return r.bottom>=0&&r.top<window.innerHeight&&r.right>=0&&r.left<window.innerWidth;
                  }catch(_){return false;}
                };
                var normalize=function(el){
                  try{
                    if(!el){return null;}
                    var card=el.closest&&el.closest('a.kf-card[href],a.kf-channel-card[href],a.kf-post-card[href],.kf-card,.kf-channel-card,.kf-post-card');
                    if(card){
                      return card;
                    }
                    var frame=el.closest&&el.closest('.wp-block-embed,.kf-watch-frame,.kf-player-frame,.kf-video-frame');
                    if(frame){return frame;}
                    if(detailPage){
                      var info=el.closest&&el.closest(channelInfoSelector);
                      if(info){return info;}
                    }
                    if(el.matches&&el.matches(itemSelector)){return el;}
                    return el.closest&&el.closest(itemSelector);
                  }catch(_){return el;}
                };
                var unique=function(nodes){
                  var seen=new Set();
                  return nodes.filter(function(el){
                    if(!el||seen.has(el)||!displayable(el)){return false;}
                    seen.add(el);
                    return true;
                  });
                };
                var sortItems=function(items){
                  return items.slice().sort(function(a,b){
                    var ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();
                    var row=Math.abs(ar.top-br.top)>Math.max(32,Math.min(ar.height||0,br.height||0)*0.55);
                    if(row){return ar.top-br.top;}
                    return ar.left-br.left;
                  });
                };
                var docTop=function(el){
                  try{var r=el.getBoundingClientRect();return r.top+(window.scrollY||document.documentElement.scrollTop||0);}catch(_){return 0;}
                };
                var summary=function(el){
                  try{
                    if(!el){return 'none';}
                    var tag=(el.tagName||'').toLowerCase();
                    var id=el.id?('#'+el.id):'';
                    var cls=(typeof el.className==='string'&&el.className.trim())?('.'+el.className.trim().split(/\s+/).slice(0,3).join('.')):'';
                    var text=(el.innerText||el.getAttribute('aria-label')||el.getAttribute('title')||el.href||'').trim().replace(/\s+/g,' ').slice(0,80);
                    return tag+id+cls+(text?(' "'+text+'"'):'');
                  }catch(_){return 'unknown';}
                };
                var clear=function(){
                  try{document.querySelectorAll('[data-kf-tv-focused="1"]').forEach(function(el){el.removeAttribute('data-kf-tv-focused');});}catch(_){}
                };
                var makeRail=function(node,index){
                  var items=unique(Array.from(node.querySelectorAll(itemSelector)).map(normalize));
                  if(!items.length&&node.matches&&node.matches(itemSelector)){items=unique([normalize(node)]);}
                  items=sortItems(items);
                  return {node:node,index:index,items:items};
                };
                var splitWrappedRail=function(rail){
                  try{
                    if(!rail||!rail.items||rail.items.length<2){return [rail];}
                    var node=rail.node;
                    var isHorizontalScroller=node&&node.scrollWidth>node.clientWidth+12;
                    var rows=[];
                    rail.items.forEach(function(el){
                      var r=el.getBoundingClientRect();
                      var top=docTop(el);
                      var row=rows.find(function(candidate){
                        return Math.abs(candidate.top-top)<Math.max(42,Math.min(86,(r.height||80)*0.38));
                      });
                      if(!row){row={top:top,items:[]};rows.push(row);}
                      row.items.push(el);
                    });
                    rows=rows.sort(function(a,b){return a.top-b.top;}).map(function(row,idx){
                      return {node:node,index:String(rail.index)+':'+idx,items:sortItems(row.items),sectionIndex:rail.index,rowIndex:idx,rowCount:rows.length};
                    }).filter(function(row){return row.items.length>0;});
                    if(isHorizontalScroller&&rows.length<=1){return [rail];}
                    if(isHorizontalScroller&&rows.length>1){
                      var mostlyOneVisibleRow=rows.every(function(row){return row.items.length<=Math.max(1,Math.ceil(rail.items.length/rows.length)+1);});
                      if(!mostlyOneVisibleRow){return [rail];}
                    }
                    return rows.length?rows:[rail];
                  }catch(_){return [rail];}
                };
                var railNodes=Array.from(document.querySelectorAll(railSelector)).filter(function(node){
                  return displayable(node)&&node.querySelector(itemSelector);
                });
                var rails=railNodes.map(makeRail).filter(function(rail){return rail.items.length>0;}).reduce(function(acc,rail){
                  return acc.concat(splitWrappedRail(rail));
                },[]);
                if(detailPage){
                  var channelInfoItems=unique(Array.from(document.querySelectorAll(channelInfoSelector)).map(normalize)).filter(function(el){
                    try{
                      if(!displayable(el)){return false;}
                      if(el.querySelector&&el.querySelector(itemSelector)){return false;}
                      var r=el.getBoundingClientRect();
                      var text=(el.innerText||'').trim().replace(/\s+/g,' ');
                      return r.width>=120&&r.height>=44&&text.length>=2;
                    }catch(_){return false;}
                  });
                  if(channelInfoItems.length){
                    var infoRows=[];
                    sortItems(channelInfoItems).forEach(function(el){
                      var top=docTop(el);
                      var row=infoRows.find(function(candidate){return Math.abs(candidate.top-top)<58;});
                      if(!row){row={top:top,items:[]};infoRows.push(row);}
                      row.items.push(el);
                    });
                    infoRows=infoRows.map(function(row,idx){
                      return {node:document.scrollingElement||document.documentElement||document.body,index:'channel-info:'+idx,items:sortItems(row.items)};
                    }).filter(function(row){return row.items.length>0;});
                    rails=rails.concat(infoRows).sort(function(a,b){
                      var ai=a.items&&a.items[0],bi=b.items&&b.items[0];
                      return docTop(ai)-docTop(bi);
                    });
                  }
                }
                if(rails.length){
                  var inRail=function(el){
                    try{return railNodes.some(function(node){return node!==el&&node.contains(el);});}catch(_){return false;}
                  };
                  var topItems=unique(Array.from(document.querySelectorAll(itemSelector)).map(normalize)).filter(function(el){
                    try{
                      if(inRail(el)||!displayable(el)){return false;}
                      var r=el.getBoundingClientRect();
                      return r.width>=8&&r.height>=8;
                    }catch(_){return false;}
                  });
                  if(topItems.length){
                    var rows=[];
                    sortItems(topItems).forEach(function(el){
                      var top=docTop(el);
                      var row=rows.find(function(candidate){return Math.abs(candidate.top-top)<58;});
                      if(!row){row={top:top,items:[]};rows.push(row);}
                      row.items.push(el);
                    });
                    rows=rows.map(function(row,idx){
                      return {node:document.scrollingElement||document.documentElement||document.body,index:-(idx+1),items:sortItems(row.items)};
                    }).filter(function(row){return row.items.length>0;});
                    rails=rows.concat(rails).sort(function(a,b){
                      var ai=a.items&&a.items[0],bi=b.items&&b.items[0];
                      return docTop(ai)-docTop(bi);
                    });
                  }
                }
                if(!rails.length){
                  var visibleItems=unique(Array.from(document.querySelectorAll(itemSelector)).map(normalize)).filter(function(el){
                    try{var r=el.getBoundingClientRect();return r.bottom>=0&&r.top<window.innerHeight&&r.right>=0&&r.left<window.innerWidth;}catch(_){return false;}
                  });
                  rails=[{node:document.scrollingElement||document.documentElement||document.body,index:0,items:sortItems(visibleItems)}];
                }
                var current=document.querySelector('[data-kf-tv-focused="1"]');
                var activeRail=0,activeItem=0;
                rails.forEach(function(rail,ri){
                  var ii=rail.items.indexOf(current);
                  if(ii>=0){activeRail=ri;activeItem=ii;}
                });
                if(!current){
                  activeRail=Math.max(0,Math.min(Number(state.railIndex||0),rails.length-1));
                  activeItem=Math.max(0,Math.min(Number((state.itemByRail||{})[activeRail]||0),(rails[activeRail]&&rails[activeRail].items.length||1)-1));
                  if(detailPage&&!state.initializedForDetailPage){
                    var bestChannel=null,bestChannelScore=-1;
                    rails.forEach(function(rail,ri){
                      rail.items.forEach(function(item,ii){
                        try{
                          var r=item.getBoundingClientRect();
                          var text=(item.innerText||item.getAttribute('aria-label')||item.getAttribute('title')||'').trim().toLowerCase();
                          var media=item.matches&&item.matches('.wp-block-embed,.kf-watch-frame,.kf-player-frame,.kf-video-frame,iframe,video');
                          var watchButton=/^watch$/.test(text);
                          var score=(media?1000000:0)+(watchButton?600000:0)+(r.width*r.height);
                          if(score>bestChannelScore){bestChannelScore=score;bestChannel={rail:ri,item:ii};}
                        }catch(_){}
                      });
                    });
                    if(bestChannel){activeRail=bestChannel.rail;activeItem=bestChannel.item;}
                    state.initializedForDetailPage=true;
                  }
                }
                var closestIndex=function(items,reference){
                  if(!items.length){return 0;}
                  if(!reference){return Math.max(0,Math.min(Number((state.itemByRail||{})[activeRail]||0),items.length-1));}
                  try{
                    if(reference.matches&&reference.matches('.kf-viewall,.kf-section-more,.kf-rail-more,[class*="view-all" i],[aria-label*="view all" i]')){
                      return 0;
                    }
                    var rr=reference.getBoundingClientRect();
                    var rx=rr.left+rr.width/2;
                    var best=0,bestScore=Infinity;
                    items.forEach(function(el,i){
                      var r=el.getBoundingClientRect();
                      var x=r.left+r.width/2;
                      var score=Math.abs(x-rx);
                      if(score<bestScore){bestScore=score;best=i;}
                    });
                    return best;
                  }catch(_){return 0;}
                };
                var ensureVisible=function(rail,item){
                  try{
                    if(!rail||!item){return;}
                    var node=rail.node;
                    var nr=node.getBoundingClientRect();
                    var ir=item.getBoundingClientRect();
                    var pad=Math.max(26,Math.min(52,(window.innerWidth||1280)*0.035));
                    if(node&&node.scrollWidth>node.clientWidth+4){
                      var leftLimit=nr.left+pad;
                      var rightLimit=nr.right-pad;
                      var delta=0;
                      if(ir.left<leftLimit){delta=ir.left-leftLimit;}
                      else if(ir.right>rightLimit){delta=ir.right-rightLimit;}
                      if(Math.abs(delta)>3){node.scrollLeft=Number(node.scrollLeft||0)+delta;}
                    }
                    var currentY=window.scrollY||document.documentElement.scrollTop||0;
                    var viewportH=window.innerHeight||720;
                    var topSafe=Math.max(104,Math.min(156,viewportH*0.16));
                    var bottomSafe=viewportH-Math.max(96,Math.min(132,viewportH*0.14));
                    var targetY=null;
                    if(ir.top<topSafe){
                      targetY=currentY+ir.top-topSafe;
                    }else if(ir.bottom>bottomSafe){
                      targetY=currentY+(ir.bottom-bottomSafe)+28;
                    }
                    if(targetY!==null){
                      try{window.scrollTo({top:Math.max(0,targetY),left:0,behavior:'smooth'});}catch(_){window.scrollTo(0,Math.max(0,targetY));}
                    }
                  }catch(_){}
                };
                var focusItem=function(railIndex,itemIndex,mode,phase){
                  var rail=rails[railIndex];
                  var item=rail&&rail.items[itemIndex];
                  if(!rail||!item){return null;}
                  clear();
                  item.setAttribute('data-kf-tv-focused','1');
                  if(!item.hasAttribute('tabindex')&&!/^(a|button|summary)$/i.test(item.tagName||'')){item.setAttribute('tabindex','0');}
                  try{item.focus({preventScroll:true});}catch(_){try{item.focus();}catch(__){}}
                  ensureVisible(rail,item);
                  state.railIndex=railIndex;
                  state.itemByRail=state.itemByRail||{};
                  state.itemByRail[railIndex]=itemIndex;
                  window[stateKey]=state;
                  window.prompt(promptPrefix+JSON.stringify({type:'kulchaflo-site-focus',phase:phase||'move',pageUrl:pageUrl,action:action,mode:mode,railIndex:railIndex,itemIndex:itemIndex,railCount:rails.length,count:rail.items.length,target:summary(item)}),'');
                  return item;
                };
                var focusDetailGeometry=function(direction){
                  if(!detailPage){return false;}
                  try{
                    var currentItem=(rails[activeRail]&&rails[activeRail].items[activeItem])||current||null;
                    if(!currentItem){return false;}
                    var cr=currentItem.getBoundingClientRect();
                    var cx=cr.left+cr.width/2;
                    var cy=cr.top+cr.height/2;
                    var sign=direction==='down'?1:-1;
                    var candidates=unique(Array.from(document.querySelectorAll([
                      itemSelector,
                      channelInfoSelector,
                      '[class*="meta"]','[class*="info"]','[class*="detail"]','[class*="note"]','[class*="tag"]',
                      'figure','section','article div','main div'
                    ].join(','))).map(normalize)).filter(function(el){
                      try{
                        if(!el||el===currentItem||!displayable(el)){return false;}
                        if(el.contains&&el.contains(currentItem)){return false;}
                        var r=el.getBoundingClientRect();
                        var text=(el.innerText||el.getAttribute('aria-label')||el.getAttribute('title')||'').trim().replace(/\s+/g,' ');
                        if(r.width<80||r.height<28){return false;}
                        if(r.width>(window.innerWidth||1280)*0.98&&r.height>(window.innerHeight||720)*0.75){return false;}
                        if(!text&&!(el.matches&&el.matches('iframe,video,.wp-block-embed,.kf-watch-frame,.kf-player-frame,.kf-video-frame,figure,.wp-block-image'))){return false;}
                        var y=r.top+r.height/2;
                        return (y-cy)*sign>12;
                      }catch(_){return false;}
                    });
                    var best=null,bestScore=Infinity;
                    candidates.forEach(function(el){
                      var r=el.getBoundingClientRect();
                      var x=r.left+r.width/2,y=r.top+r.height/2;
                      var primary=Math.abs(y-cy);
                      var secondary=Math.abs(x-cx);
                      var score=primary*primary+secondary*secondary*0.45;
                      if(score<bestScore){bestScore=score;best=el;}
                    });
                    if(!best){return false;}
                    clear();
                    best.setAttribute('data-kf-tv-focused','1');
                    if(!best.hasAttribute('tabindex')&&!/^(a|button|summary|input)$/i.test(best.tagName||'')){best.setAttribute('tabindex','0');}
                    try{best.focus({preventScroll:true});}catch(_){try{best.focus();}catch(__){}}
                    var pseudoRail={node:document.scrollingElement||document.documentElement||document.body,index:'detail-geometry',items:[best]};
                    ensureVisible(pseudoRail,best);
                    state.railIndex=0;
                    state.itemByRail=state.itemByRail||{};
                    state.detailGeometryTarget=summary(best);
                    window[stateKey]=state;
                    window.prompt(promptPrefix+JSON.stringify({type:'kulchaflo-site-focus',phase:'move',pageUrl:pageUrl,action:direction,mode:'detail-geometry',railIndex:-1,itemIndex:0,railCount:rails.length,count:candidates.length,target:summary(best)}),'');
                    return true;
                  }catch(_){return false;}
                };
                if(!rails.length||!rails[0].items.length){
                  window.prompt(promptPrefix+JSON.stringify({type:'kulchaflo-site-focus',phase:'empty',pageUrl:pageUrl,action:action,mode:'rail-index',railCount:0,count:0,target:'none'}),'');
                  return;
                }
                if(action==='activate'){
                  var target=(rails[activeRail]&&rails[activeRail].items[activeItem])||null;
                  if(target){
                    focusItem(activeRail,activeItem,'rail-index','activate');
                    var nestedAnchor=(target.querySelector&&target.querySelector('a[href]'))||null;
                    var href=(target.href||(target.closest&&target.closest('a[href]')&&target.closest('a[href]').href)||(nestedAnchor&&nestedAnchor.href)||'');
                    if(href){window.location.href=href;}else{try{target.click();}catch(_){try{target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));}catch(__){}}}
                  }else{
                    window.prompt(promptPrefix+JSON.stringify({type:'kulchaflo-site-focus',phase:'activate',pageUrl:pageUrl,action:action,mode:'rail-index',railIndex:activeRail,itemIndex:activeItem,railCount:rails.length,count:0,target:'none'}),'');
                  }
                  return;
                }
                if(action==='left'||action==='right'){
                  var rail=rails[activeRail];
                  var nextItem=activeItem+(action==='right'?1:-1);
                  if(nextItem<0||nextItem>=rail.items.length){
                    window.prompt(promptPrefix+JSON.stringify({type:'kulchaflo-site-focus',phase:'boundary',pageUrl:pageUrl,action:action,mode:'rail-index-boundary',railIndex:activeRail,itemIndex:activeItem,railCount:rails.length,count:rail.items.length,target:summary(rail.items[activeItem])}),'');
                    return;
                  }
                  focusItem(activeRail,nextItem,'rail-index','move');
                  return;
                }
                if(action==='up'||action==='down'){
                  var nextRail=activeRail+(action==='down'?1:-1);
                  if(nextRail<0||nextRail>=rails.length){
                    if(focusDetailGeometry(action)){return;}
                    var before=Number((document.scrollingElement||document.documentElement||document.body).scrollTop||window.scrollY||0);
                    var amount=Math.round((window.innerHeight||720)*0.72)*(action==='down'?1:-1);
                    try{window.scrollBy({top:amount,left:0,behavior:'smooth'});}catch(_){window.scrollBy(0,amount);}
                    window.prompt(promptPrefix+JSON.stringify({type:'kulchaflo-site-focus',phase:'scroll',pageUrl:pageUrl,action:action,mode:'rail-vertical-boundary',railIndex:activeRail,itemIndex:activeItem,railCount:rails.length,count:(rails[activeRail]&&rails[activeRail].items.length)||0,target:summary((rails[activeRail]&&rails[activeRail].items[activeItem])||null),beforeY:before,amount:amount}),'');
                    return;
                  }
                  var remembered=state.itemByRail&&state.itemByRail[nextRail];
                  var nextItems=rails[nextRail].items;
                  var nextIndex=(remembered!==undefined)?Math.max(0,Math.min(Number(remembered),nextItems.length-1)):closestIndex(nextItems,rails[activeRail].items[activeItem]);
                  focusItem(nextRail,nextIndex,'rail-index-vertical','move');
                  return;
                }
              }catch(e){
                try{window.prompt(${JSONObject.quote(PROMPT_PREFIX)}+JSON.stringify({type:'kulchaflo-site-focus',phase:'error',pageUrl:${JSONObject.quote(pageUrl)},action:${JSONObject.quote(action)},error:String(e&&e.message||e)}),'');}catch(_){}
              }
            })();
        """.trimIndent()
        session.loadUri(script)
    }
    private fun showPointerAt(x: Float, y: Float, reason: String) {
        val maxWidth = (geckoView.width.takeIf { it > 0 } ?: resources.displayMetrics.widthPixels).toFloat()
        val maxHeight = (geckoView.height.takeIf { it > 0 } ?: resources.displayMetrics.heightPixels).toFloat()
        val inset = pointerBoundsInsetPx()
        pointerX = x.coerceIn(inset, maxWidth - inset)
        pointerY = y.coerceIn(inset, maxHeight - inset)
        val activeUrl = tabController.getActiveTab()?.url ?: currentUrl
        if (!promotedMediaPlayer.isPromoted() && isPointerAssistAllowedForUrl(activeUrl)) {
            pointerAssistModeActive = true
            GvLogger.i("GvInput", "pointer assist manually enabled reason=$reason url=$activeUrl")
        }
        pointerOverlay.showAt(pointerX, pointerY)
        pointerVisible = true
        schedulePointerIdleTimeout()
        GvLogger.i("GvInput", "pointer visible=true reason=$reason x=${pointerX.toInt()} y=${pointerY.toInt()}")
    }

    private fun ensurePromotedPointerVisible() {
        if (pointerVisible && pointerOverlay.isPointerVisible()) {
            schedulePointerIdleTimeout()
            return
        }
        val maxWidth = (geckoView.width.takeIf { it > 0 } ?: resources.displayMetrics.widthPixels).toFloat()
        val maxHeight = (geckoView.height.takeIf { it > 0 } ?: resources.displayMetrics.heightPixels).toFloat()
        val inset = pointerBoundsInsetPx()
        val minX = inset
        val maxX = maxWidth - inset
        val minY = inset
        val maxY = maxHeight - inset
        val hasStoredPosition = pointerX in minX..maxX && pointerY in minY..maxY
        pointerX = if (hasStoredPosition) pointerX.coerceIn(minX, maxX) else (maxWidth * 0.5f).coerceIn(minX, maxX)
        pointerY = if (hasStoredPosition) pointerY.coerceIn(minY, maxY) else (maxHeight * 0.5f).coerceIn(minY, maxY)
        pointerOverlay.visibility = View.VISIBLE
        pointerOverlay.bringToFront()
        pointerOverlay.showAt(pointerX, pointerY)
        pointerVisible = true
        schedulePointerIdleTimeout()
        GvLogger.i("GvInput", "pointer visible=true reason=promoted-pointer restored=$hasStoredPosition x=${pointerX.toInt()} y=${pointerY.toInt()}")
    }

    private fun movePointerBy(deltaX: Float, deltaY: Float): PointerMoveResult {
        ensurePointerVisible()
        val maxWidth = (geckoView.width.takeIf { it > 0 } ?: resources.displayMetrics.widthPixels).toFloat()
        val maxHeight = (geckoView.height.takeIf { it > 0 } ?: resources.displayMetrics.heightPixels).toFloat()
        val inset = pointerBoundsInsetPx()
        val minX = inset
        val maxX = maxWidth - inset
        val minY = inset
        val maxY = maxHeight - inset
        val rawNextX = pointerX + deltaX
        val rawNextY = pointerY + deltaY
        val nextX = rawNextX.coerceIn(minX, maxX)
        val nextY = rawNextY.coerceIn(minY, maxY)
        val overshootX = rawNextX - nextX
        val overshootY = rawNextY - nextY
        pointerX = nextX
        pointerY = nextY
        pointerOverlay.updatePosition(pointerX, pointerY)
        dispatchPointerHover()
        dispatchInteractionWakePulse()
        schedulePointerIdleTimeout()
        GvLogger.d("GvInput", "pointer moved x=${pointerX.toInt()} y=${pointerY.toInt()}")
        return PointerMoveResult(overshootX = overshootX, overshootY = overshootY)
    }

    private fun movePromotedPointerBy(deltaX: Float, deltaY: Float) {
        ensurePromotedPointerVisible()
        val maxWidth = (geckoView.width.takeIf { it > 0 } ?: resources.displayMetrics.widthPixels).toFloat()
        val maxHeight = (geckoView.height.takeIf { it > 0 } ?: resources.displayMetrics.heightPixels).toFloat()
        val inset = pointerBoundsInsetPx()
        pointerX = (pointerX + deltaX).coerceIn(inset, maxWidth - inset)
        pointerY = (pointerY + deltaY).coerceIn(inset, maxHeight - inset)
        pointerOverlay.updatePosition(pointerX, pointerY)
        val handled = promotedMediaPlayer.dispatchPointerHover(pointerX, pointerY)
        schedulePointerIdleTimeout()
        GvLogger.i("GvInput", "promoted pointer moved x=${pointerX.toInt()} y=${pointerY.toInt()} source=promoted hoverHandled=$handled")
    }

    private fun dispatchInteractionWakePulse() {
        val now = SystemClock.uptimeMillis()
        if (now - lastInteractionWakePulseMs < INTERACTION_WAKE_PULSE_MIN_INTERVAL_MS) {
            return
        }
        lastInteractionWakePulseMs = now
        val activeTab = tabController.getActiveTab() ?: return
        if (!shouldApplyUnifiedCompat(activeTab.url)) {
            return
        }
        val session = activeTab.session
        session.loadUri("javascript:(function(){try{window.__kfUnifiedCompatPoke&&window.__kfUnifiedCompatPoke();}catch(_){}})();")
    }

    private fun startPointerRepeater() {
        pointerHandler.removeCallbacks(pointerRepeatRunnable)
        pointerHandler.postDelayed(pointerRepeatRunnable, POINTER_INITIAL_REPEAT_DELAY_MS)
    }

    private fun stopPointerRepeater() {
        pointerHandler.removeCallbacks(pointerRepeatRunnable)
        pointerHandler.removeCallbacks(promotedPointerRepeatRunnable)
        pointerRepeatTicks = 0
    }

    private fun startPromotedPointerRepeater() {
        pointerHandler.removeCallbacks(promotedPointerRepeatRunnable)
        pointerHandler.postDelayed(promotedPointerRepeatRunnable, POINTER_INITIAL_REPEAT_DELAY_MS)
    }

    private fun stopPromotedPointerRepeater() {
        pointerHandler.removeCallbacks(promotedPointerRepeatRunnable)
        pointerRepeatTicks = 0
    }

    private fun applyNativePromotedInputPolicyIfCbc(sourceUrl: String) {
        if (!isExactCbcLiveHlsUrl(sourceUrl)) {
            return
        }
        if (promotedPointerModeActive) {
            GvLogger.i("GvInput", "promoted pointer auto-enable disabled reason=native-dpad-policy sourceUrl=$sourceUrl")
            disablePromotedPointerMode(reason = "native-dpad-policy", keepPointerVisible = false)
        } else {
            pointerDirectionKeys.clear()
            stopPromotedPointerRepeater()
            pointerOverlay.setPointerPressed(false)
            pointerVisible = false
            pointerOverlay.hidePointer()
            GvLogger.i("GvInput", "promoted pointer auto-enable skipped reason=native-dpad-policy sourceUrl=$sourceUrl")
        }
        GvLogger.i("GvInput", "native promoted playback uses DPAD policy sourceUrl=$sourceUrl")
    }

    private fun disablePromotedPointerMode(reason: String, keepPointerVisible: Boolean) {
        if (!promotedPointerModeActive) {
            return
        }
        promotedPointerModeActive = false
        pointerDirectionKeys.clear()
        stopPromotedPointerRepeater()
        pointerOverlay.setPointerPressed(false)
        if (keepPointerVisible) {
            ensurePointerVisible()
        } else {
            pointerVisible = false
            pointerOverlay.hidePointer()
        }
        GvLogger.i("GvInput", "promoted pointer mode disabled reason=$reason")
    }

    private fun maybeScrollContent(overshootX: Float, overshootY: Float, reason: String) {
        val scrollX = (overshootX * EDGE_SCROLL_MULTIPLIER).toInt()
        val scrollY = (overshootY * EDGE_SCROLL_MULTIPLIER).toInt()
        if (scrollX == 0 && scrollY == 0) {
            return
        }
        scrollActivePageBy(scrollX, scrollY, reason)
    }

    private fun currentPointerDelta(): Pair<Float, Float>? {
        var dx = 0
        var dy = 0
        if (pointerDirectionKeys.contains(KeyEvent.KEYCODE_DPAD_LEFT)) dx -= 1
        if (pointerDirectionKeys.contains(KeyEvent.KEYCODE_DPAD_RIGHT)) dx += 1
        if (pointerDirectionKeys.contains(KeyEvent.KEYCODE_DPAD_UP)) dy -= 1
        if (pointerDirectionKeys.contains(KeyEvent.KEYCODE_DPAD_DOWN)) dy += 1
        return if (dx == 0 && dy == 0) null else dx.toFloat() to dy.toFloat()
    }

    private fun currentVerticalDpadKey(): Int? {
        return when {
            pointerDirectionKeys.contains(KeyEvent.KEYCODE_DPAD_DOWN) -> KeyEvent.KEYCODE_DPAD_DOWN
            pointerDirectionKeys.contains(KeyEvent.KEYCODE_DPAD_UP) -> KeyEvent.KEYCODE_DPAD_UP
            else -> null
        }
    }

    private fun currentHorizontalDpadKey(): Int? {
        return when {
            pointerDirectionKeys.contains(KeyEvent.KEYCODE_DPAD_RIGHT) -> KeyEvent.KEYCODE_DPAD_RIGHT
            pointerDirectionKeys.contains(KeyEvent.KEYCODE_DPAD_LEFT) -> KeyEvent.KEYCODE_DPAD_LEFT
            else -> null
        }
    }

    private fun directionalPointerDelta(keyCode: Int): Pair<Float, Float> {
        return when (keyCode) {
            KeyEvent.KEYCODE_DPAD_LEFT -> -1f to 0f
            KeyEvent.KEYCODE_DPAD_RIGHT -> 1f to 0f
            KeyEvent.KEYCODE_DPAD_UP -> 0f to -1f
            KeyEvent.KEYCODE_DPAD_DOWN -> 0f to 1f
            else -> 0f to 0f
        }
    }

    private fun dispatchPointerClick(): Boolean {
        if (!pointerVisible) {
            ensurePointerVisible()
        }
        val downTime = pointerDownTime.takeIf { it != 0L } ?: SystemClock.uptimeMillis()
        val handledDown = dispatchPointerMotion(MotionEvent.ACTION_DOWN, downTime)
        val handledUp = dispatchPointerMotion(MotionEvent.ACTION_UP, downTime)
        pointerDownTime = 0L
        schedulePointerIdleTimeout()
        return handledDown || handledUp
    }

    private fun dispatchPointerMotion(action: Int, downTime: Long): Boolean {
        return dispatchPointerMotionAt(
            action = action,
            downTime = downTime,
            x = pointerX,
            y = pointerY,
            forceMouse = false,
            reason = "pointer",
        )
    }

    private fun dispatchNativeMouseTapAt(x: Float, y: Float, reason: String): Boolean {
        val downTime = SystemClock.uptimeMillis()
        val handledDown = dispatchPointerMotionAt(
            action = MotionEvent.ACTION_DOWN,
            downTime = downTime,
            x = x,
            y = y,
            forceMouse = true,
            reason = reason,
        )
        val handledUp = dispatchPointerMotionAt(
            action = MotionEvent.ACTION_UP,
            downTime = downTime,
            x = x,
            y = y,
            forceMouse = true,
            reason = reason,
        )
        return handledDown || handledUp
    }

    private fun dispatchNativeMouseHoverAt(x: Float, y: Float, reason: String): Boolean {
        val eventTime = SystemClock.uptimeMillis()
        val properties = arrayOf(
            MotionEvent.PointerProperties().apply {
                id = 0
                toolType = MotionEvent.TOOL_TYPE_MOUSE
            },
        )
        val coords = arrayOf(
            MotionEvent.PointerCoords().apply {
                this.x = x
                this.y = y
                pressure = 0f
                size = 1f
            },
        )
        val event = MotionEvent.obtain(
            eventTime,
            eventTime,
            MotionEvent.ACTION_HOVER_MOVE,
            1,
            properties,
            coords,
            0,
            0,
            1f,
            1f,
            0,
            0,
            InputDevice.SOURCE_MOUSE,
            0,
        )
        val handled = geckoView.dispatchGenericMotionEvent(event)
        event.recycle()
        GvLogger.i(
            "GvInput",
            "native pointer hover source=mouse reason=$reason x=${x.toInt()} y=${y.toInt()} handled=$handled"
        )
        return handled
    }

    private fun dispatchNativeMouseMoveAt(x: Float, y: Float, reason: String): Boolean {
        val eventTime = SystemClock.uptimeMillis()
        val handled = dispatchPointerMotionAt(
            action = MotionEvent.ACTION_MOVE,
            downTime = eventTime,
            x = x,
            y = y,
            forceMouse = true,
            reason = reason,
        )
        GvLogger.i(
            "GvInput",
            "native pointer move source=mouse reason=$reason x=${x.toInt()} y=${y.toInt()} handled=$handled"
        )
        return handled
    }

    private fun dispatchPointerMotionAt(
        action: Int,
        downTime: Long,
        x: Float,
        y: Float,
        forceMouse: Boolean,
        reason: String,
    ): Boolean {
        val activeUrl = tabController.getActiveTab()?.url.orEmpty()
        val useDesktopMouse = forceMouse || isFacebookUrl(activeUrl) || isGoogleVideoSurfaceUrl(activeUrl)
        val eventTime = SystemClock.uptimeMillis()
        val event = if (useDesktopMouse) {
            if (action == MotionEvent.ACTION_DOWN) {
                GvLogger.i(
                    "GvInput",
                    "native pointer click source=mouse reason=$reason x=${x.toInt()} y=${y.toInt()}"
                )
            }
            val properties = arrayOf(
                MotionEvent.PointerProperties().apply {
                    id = 0
                    toolType = MotionEvent.TOOL_TYPE_MOUSE
                },
            )
            val coords = arrayOf(
                MotionEvent.PointerCoords().apply {
                    this.x = x
                    this.y = y
                    pressure = 1f
                    size = 1f
                },
            )
            MotionEvent.obtain(
                downTime,
                eventTime,
                action,
                1,
                properties,
                coords,
                0,
                MotionEvent.BUTTON_PRIMARY,
                1f,
                1f,
                0,
                0,
                InputDevice.SOURCE_MOUSE,
                0,
            )
        } else {
            MotionEvent.obtain(
                downTime,
                eventTime,
                action,
                x,
                y,
                0,
            ).apply {
                source = InputDevice.SOURCE_TOUCHSCREEN
            }
        }
        val handled = geckoView.dispatchTouchEvent(event)
        event.recycle()
        return handled
    }

    private fun dispatchPointerHover() {
        val eventTime = SystemClock.uptimeMillis()
        val event = MotionEvent.obtain(
            eventTime,
            eventTime,
            MotionEvent.ACTION_HOVER_MOVE,
            pointerX,
            pointerY,
            0,
        )
        event.source = InputDevice.SOURCE_MOUSE
        geckoView.dispatchGenericMotionEvent(event)
        event.recycle()
    }

    private fun pointerBoundsInsetPx(): Float = EDGE_PADDING_PX

    private fun holdSpeedMultiplier(): Float {
        return when {
            pointerRepeatTicks >= 28 -> 2.4f
            pointerRepeatTicks >= 14 -> 1.8f
            pointerRepeatTicks >= 6 -> 1.35f
            else -> 1f
        }
    }

    private fun scrollActivePageBy(scrollX: Int, scrollY: Int, reason: String) {
        val activeTab = tabController.getActiveTab() ?: return
        val px = pointerX.toInt().coerceAtLeast(0)
        val py = pointerY.toInt().coerceAtLeast(0)
        val script = """
            javascript:(function(){
              try{
                var dx=$scrollX, dy=$scrollY;
                var px=$px, py=$py;
                var pick=function(){
                  var w=Math.max(1,window.innerWidth||0);
                  var h=Math.max(1,window.innerHeight||0);
                  var x=Math.min(Math.max(0,px),w-1);
                  var y=Math.min(Math.max(0,py),h-1);
                  return document.elementFromPoint(x,y)||document.activeElement||document.body;
                };
                var scrollable=function(node){
                  var cur=node;
                  while(cur&&cur!==document.documentElement){
                    try{
                      var style=window.getComputedStyle(cur);
                      var oy=(style&&style.overflowY||'').toLowerCase();
                      var ox=(style&&style.overflowX||'').toLowerCase();
                      var canY=(oy==='auto'||oy==='scroll'||oy==='overlay'||oy==='visible'||oy==='')&&cur.scrollHeight>cur.clientHeight+1;
                      var canX=(ox==='auto'||ox==='scroll'||ox==='overlay'||ox==='visible'||ox==='')&&cur.scrollWidth>cur.clientWidth+1;
                      if((dy!==0&&canY)||(dx!==0&&canX)){return cur;}
                    }catch(_){}
                    cur=cur.parentElement;
                  }
                  return null;
                };
                var visible=function(node){
                  try{
                    if(!node){return false;}
                    var style=window.getComputedStyle(node);
                    if(style&&(style.display==='none'||style.visibility==='hidden'||style.opacity==='0')){return false;}
                    var r=node.getBoundingClientRect();
                    return r.width>8&&r.height>8&&r.bottom>0&&r.right>0&&r.top<h&&r.left<w;
                  }catch(_){return false;}
                };
                var looksModal=function(node){
                  try{
                    if(!visible(node)){return false;}
                    var r=node.getBoundingClientRect();
                    var role=((node.getAttribute&&node.getAttribute('role'))||'').toLowerCase();
                    var aria=((node.getAttribute&&node.getAttribute('aria-modal'))||'').toLowerCase();
                    var cls=((typeof node.className==='string')?node.className:'').toLowerCase();
                    var id=((node.getAttribute&&node.getAttribute('id'))||'').toLowerCase();
                    var largeFixed=false;
                    var style=window.getComputedStyle(node);
                    if(style&&(style.position==='fixed'||style.position==='absolute')&&r.width>w*0.35&&r.height>h*0.35){largeFixed=true;}
                    return role==='dialog'||aria==='true'||cls.indexOf('dialog')>=0||cls.indexOf('modal')>=0||id.indexOf('dialog')>=0||largeFixed;
                  }catch(_){return false;}
                };
                var scrollableDescendant=function(root){
                  try{
                    if(!root||!root.querySelectorAll){return null;}
                    var nodes=[root].concat(Array.from(root.querySelectorAll('*')).slice(0,220));
                    var best=null,bestScore=-1;
                    for(var i=0;i<nodes.length;i++){
                      var node=nodes[i];
                      if(!visible(node)){continue;}
                      var style=window.getComputedStyle(node);
                      var oy=(style&&style.overflowY||'').toLowerCase();
                      var ox=(style&&style.overflowX||'').toLowerCase();
                      var canY=(dy!==0)&&(oy==='auto'||oy==='scroll'||oy==='overlay'||oy==='visible'||oy==='')&&node.scrollHeight>node.clientHeight+1;
                      var canX=(dx!==0)&&(ox==='auto'||ox==='scroll'||ox==='overlay'||ox==='visible'||ox==='')&&node.scrollWidth>node.clientWidth+1;
                      if(!canY&&!canX){continue;}
                      var r=node.getBoundingClientRect();
                      var score=(r.width*r.height)+(canY?1000000:0)+(canX?100000:0);
                      if(score>bestScore){best=node;bestScore=score;}
                    }
                    return best;
                  }catch(_){return null;}
                };
                var modalTarget=function(){
                  try{
                    var picked=pick();
                    var cur=picked;
                    while(cur&&cur!==document.documentElement){
                      if(looksModal(cur)){
                        var descendant=scrollableDescendant(cur);
                        if(descendant){return descendant;}
                      }
                      cur=cur.parentElement;
                    }
                    var nodes=Array.from(document.querySelectorAll('[role="dialog"],[aria-modal="true"],tp-yt-paper-dialog,yt-confirm-dialog-renderer,ytd-popup-container,div[class*="dialog"],div[class*="modal"]')).slice(0,80);
                    var best=null,bestScore=-1;
                    for(var i=0;i<nodes.length;i++){
                      var node=nodes[i];
                      if(!looksModal(node)){continue;}
                      var descendant=scrollableDescendant(node);
                      if(!descendant){continue;}
                      var r=node.getBoundingClientRect();
                      var centerPenalty=Math.abs((r.left+r.right)/2-x)+Math.abs((r.top+r.bottom)/2-y);
                      var score=(r.width*r.height)-centerPenalty;
                      if(score>bestScore){best=descendant;bestScore=score;}
                    }
                    return best;
                  }catch(_){return null;}
                };
                var target=modalTarget()||scrollable(pick())||document.scrollingElement||document.documentElement||document.body;
                var byY=target.scrollTop||window.scrollY||0;
                var byX=target.scrollLeft||window.scrollX||0;
                if(target&&target.scrollBy){target.scrollBy(dx,dy);} else {window.scrollBy(dx,dy);}
                var ayY=target.scrollTop||window.scrollY||0;
                var ayX=target.scrollLeft||window.scrollX||0;
                if(byY===ayY&&byX===ayX){
                  try{
                    var evt=new WheelEvent('wheel',{deltaX:dx,deltaY:dy,bubbles:true,cancelable:true});
                    (target||document.body).dispatchEvent(evt);
                  }catch(_){}
                }
              }catch(_){}
            })();
        """.trimIndent()
        activeTab.session.loadUri(script)
        GvLogger.d("GvInput", "content scroll x=$scrollX y=$scrollY reason=$reason")
    }

    private fun maybeDispatchDpadDocumentScrollFallback(keyCode: Int?, reason: String, scrollY: Int): Boolean {
        if (!ENABLE_DPAD_DOCUMENT_SCROLL_FALLBACK) {
            return false
        }
        if (keyCode != KeyEvent.KEYCODE_DPAD_DOWN && keyCode != KeyEvent.KEYCODE_DPAD_UP) {
            return false
        }
        if (scrollY == 0) {
            return false
        }
        if (tabsOverlay.visibility == View.VISIBLE || promotedMediaPlayer.isPromoted()) {
            return false
        }
        val activeTab = tabController.getActiveTab() ?: return false
        val activeUrl = activeTab.url
        val skipReason = dpadDocumentScrollFallbackSkipReason(activeUrl)
        val direction = if (keyCode == KeyEvent.KEYCODE_DPAD_DOWN) "down" else "up"
        val liveMediaSurface = isLiveMediaSurfaceUrl(activeUrl)
        if (skipReason != null) {
            GvLogger.i(
                "GvInput",
                "dpad document scroll fallback keyCode=$keyCode direction=$direction attempted=false reason=$skipReason url=$activeUrl pointer=${pointerX.toInt()},${pointerY.toInt()} liveMediaSurface=$liveMediaSurface"
            )
            return false
        }
        val now = SystemClock.uptimeMillis()
        if (now - lastDpadDocumentScrollFallbackMs < DPAD_DOCUMENT_SCROLL_FALLBACK_MIN_INTERVAL_MS) {
            return false
        }
        lastDpadDocumentScrollFallbackMs = now
        val pointerXValue = pointerX.toInt().coerceAtLeast(0)
        val pointerYValue = pointerY.toInt().coerceAtLeast(0)
        val pageUrlJson = JSONObject.quote(activeUrl)
        val script = """
            javascript:(function(){
              try{
                var promptPrefix=${JSONObject.quote(PROMPT_PREFIX)};
                var pageUrl=$pageUrlJson;
                var keyCode=$keyCode;
                var direction=${if (keyCode == KeyEvent.KEYCODE_DPAD_DOWN) 1 else -1};
                var px=$pointerXValue;
                var py=$pointerYValue;
                var viewportH=Math.max(1,window.innerHeight||document.documentElement.clientHeight||720);
                var amount=$scrollY;
                var scrollingElement=document.scrollingElement||document.documentElement||document.body;
                var active=document.activeElement;
                var activeTag=(active&&active.tagName?active.tagName:'').toLowerCase();
                var activeType=(active&&active.getAttribute?String(active.getAttribute('type')||''):'').toLowerCase();
                var editable=!!(active&&(active.isContentEditable||activeTag==='textarea'||activeTag==='select'||(activeTag==='input'&&activeType!=='button'&&activeType!=='submit'&&activeType!=='checkbox'&&activeType!=='radio')));
                var nodeSummary=function(node){
                  try{
                    if(!node){return 'none';}
                    var tag=(node.tagName||'').toLowerCase();
                    var role=(node.getAttribute&&node.getAttribute('role'))||'';
                    var id=(node.getAttribute&&node.getAttribute('id'))||'';
                    var cls=(typeof node.className==='string'?node.className:'');
                    if(cls.length>80){cls=cls.slice(0,80);}
                    var out=tag;
                    if(role){out+='[role='+role+']';}
                    if(id){out+='#'+id.slice(0,60);}
                    if(cls){out+='.'+cls.replace(/\s+/g,'.');}
                    return out;
                  }catch(_){return 'unknown';}
                };
                var pointNode=null;
                try{
                  var w=Math.max(1,window.innerWidth||0);
                  var h=Math.max(1,window.innerHeight||0);
                  pointNode=document.elementFromPoint(Math.min(Math.max(0,px),w-1),Math.min(Math.max(0,py),h-1));
                }catch(_){}
                var beforeY=Number((scrollingElement&&scrollingElement.scrollTop)||window.pageYOffset||0);
                var beforeX=Number((scrollingElement&&scrollingElement.scrollLeft)||window.pageXOffset||0);
                var afterY=beforeY;
                var afterX=beforeX;
                var skippedReason='';
                if(editable){
                  skippedReason='text-input-focused';
                }else if(!scrollingElement){
                  skippedReason='no-scrolling-element';
                }else{
                  try{
                    scrollingElement.scrollBy({top:amount,left:0,behavior:'auto'});
                  }catch(_){
                    try{scrollingElement.scrollTop=beforeY+amount;}catch(__){window.scrollBy(0,amount);}
                  }
                  afterY=Number((scrollingElement&&scrollingElement.scrollTop)||window.pageYOffset||0);
                  afterX=Number((scrollingElement&&scrollingElement.scrollLeft)||window.pageXOffset||0);
                }
                var emit=function(){
                  try{
                    var finalY=Number((scrollingElement&&scrollingElement.scrollTop)||window.pageYOffset||0);
                    var finalX=Number((scrollingElement&&scrollingElement.scrollLeft)||window.pageXOffset||0);
                    window.prompt(promptPrefix+JSON.stringify({
                      type:'dpad-document-scroll-fallback',
                      phase:'dpad-document-scroll-fallback',
                      pageUrl:pageUrl,
                      keyCode:keyCode,
                      direction:direction>0?'down':'up',
                      pointerX:px,
                      pointerY:py,
                      amount:amount,
                      skippedReason:skippedReason,
                      activeElement:nodeSummary(active),
                      pointElement:nodeSummary(pointNode),
                      beforeY:beforeY,
                      afterY:finalY,
                      deltaY:finalY-beforeY,
                      beforeX:beforeX,
                      afterX:finalX,
                      deltaX:finalX-beforeX,
                      viewportHeight:viewportH
                    }),'');
                  }catch(_){}
                };
                setTimeout(emit,60);
              }catch(_){}
            })();
        """.trimIndent()
        activeTab.session.loadUri(script)
        GvLogger.i(
            "GvInput",
            "dpad document scroll fallback keyCode=$keyCode direction=$direction attempted=true reason=$reason url=$activeUrl pointer=$pointerXValue,$pointerYValue scrollY=$scrollY liveMediaSurface=$liveMediaSurface"
        )
        return true
    }

    private fun maybeDispatchKulchaFloHomepageRailHoverScroll(keyCode: Int?, overshootX: Float, reason: String): Boolean {
        if (!ENABLE_KULCHAFLO_HOMEPAGE_RAIL_HOVER_SCROLL) return false
        if (keyCode != KeyEvent.KEYCODE_DPAD_LEFT && keyCode != KeyEvent.KEYCODE_DPAD_RIGHT) return false
        if (overshootX == 0f) return false
        if ((keyCode == KeyEvent.KEYCODE_DPAD_RIGHT && overshootX <= 0f) || (keyCode == KeyEvent.KEYCODE_DPAD_LEFT && overshootX >= 0f)) return false
        if (tabsOverlay.visibility == View.VISIBLE || promotedMediaPlayer.isPromoted()) return false
        val activeTab = tabController.getActiveTab() ?: return false
        val activeUrl = activeTab.url
        if (!isKulchaFloHomepage(activeUrl)) return false
        val now = SystemClock.uptimeMillis()
        if (now - lastKulchaFloRailHoverScrollMs < KULCHAFLO_RAIL_HOVER_SCROLL_MIN_INTERVAL_MS) return false
        lastKulchaFloRailHoverScrollMs = now
        val direction = if (keyCode == KeyEvent.KEYCODE_DPAD_RIGHT) 1 else -1
        val amount = (overshootX * KULCHAFLO_RAIL_HOVER_SCROLL_MULTIPLIER).toInt().let {
            if (it == 0) direction * KULCHAFLO_RAIL_HOVER_SCROLL_MIN_STEP_PX else it
        }
        val pointerXValue = pointerX.toInt().coerceAtLeast(0)
        val pointerYValue = pointerY.toInt().coerceAtLeast(0)
        val viewWidth = geckoView.width.coerceAtLeast(1)
        val viewHeight = geckoView.height.coerceAtLeast(1)
        val pageUrlJson = JSONObject.quote(activeUrl)
        val script = """
            javascript:(function(){
              try{
                var promptPrefix=${JSONObject.quote(PROMPT_PREFIX)};
                var pageUrl=$pageUrlJson;
                var rawPx=$pointerXValue;
                var rawPy=$pointerYValue;
                var viewWidth=$viewWidth;
                var viewHeight=$viewHeight;
                var amount=$amount;
                var nodeSummary=function(node){
                  try{
                    if(!node){return 'none';}
                    var tag=(node.tagName||'').toLowerCase();
                    var id=(node.id||'').trim();
                    var cls=(typeof node.className==='string'?node.className:'').trim().replace(/\s+/g,'.');
                    return tag+(id?('#'+id):'')+(cls?('.'+cls):'');
                  }catch(_){return 'unknown';}
                };
                var rectText=function(node){
                  try{
                    var r=node.getBoundingClientRect();
                    return Math.round(r.left)+","+Math.round(r.top)+" "+Math.round(r.width)+"x"+Math.round(r.height);
                  }catch(_){return '0,0 0x0';}
                };
                var w=Math.max(1,window.innerWidth||0),h=Math.max(1,window.innerHeight||0);
                var px=Math.round(rawPx*(w/Math.max(1,viewWidth)));
                var py=Math.round(rawPy*(h/Math.max(1,viewHeight)));
                var point=document.elementFromPoint(Math.min(Math.max(0,px),w-1),Math.min(Math.max(0,py),h-1));
                var isRail=function(node){
                  if(!node||node.nodeType!==1){return false;}
                  try{return node.matches('.kf-rail,.kf-chiprail,.kf-search-rail');}catch(_){return false;}
                };
                var rail=null,cur=point;
                while(cur&&cur!==document.body&&cur!==document.documentElement){
                  if(isRail(cur)){rail=cur;break;}
                  cur=cur.parentElement;
                }
                if(!rail){
                  var all=Array.from(document.querySelectorAll('.kf-rail,.kf-chiprail,.kf-search-rail')).filter(function(el){
                    try{
                      var r=el.getBoundingClientRect();
                      return r.width>100&&r.height>20&&py>=r.top&&py<=r.bottom;
                    }catch(_){return false;}
                  });
                  if(all.length>0){rail=all[0];}
                }
                var before=0,after=0,handled=false;
                if(rail){
                  before=Number(rail.scrollLeft||0);
                  try{rail.scrollBy({left:amount,top:0,behavior:'auto'});}catch(_){rail.scrollLeft=before+amount;}
                  after=Number(rail.scrollLeft||0);
                  handled=(after!==before);
                }
                window.prompt(promptPrefix+JSON.stringify({
                  type:'kulchaflo-rail-hover-scroll',
                  phase:'kulchaflo-rail-hover-scroll',
                  pageUrl:pageUrl,
                  pointerX:px,pointerY:py,
                  rawPointerX:rawPx,rawPointerY:rawPy,
                  overshootX:$overshootX,
                  viewportWidth:w,viewportHeight:h,
                  viewWidth:viewWidth,viewHeight:viewHeight,
                  amount:amount,
                  handled:handled,
                  rail:nodeSummary(rail),
                  railRect:rail?rectText(rail):'none',
                  before:before,
                  after:after,
                  point:nodeSummary(point)
                }),'');
              }catch(_){}
            })();
        """.trimIndent()
        activeTab.session.loadUri(script)
        GvLogger.i(
            "GvInput",
            "kulchaflo rail hover scroll attempted=true reason=$reason keyCode=$keyCode amount=$amount overshootX=$overshootX url=$activeUrl pointer=$pointerXValue,$pointerYValue"
        )
        return true
    }

    private fun dpadDocumentScrollFallbackSkipReason(url: String): String? {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return "unsupported-scheme"
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return "unsupported-scheme"
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty().lowercase().ifBlank { "/" }
        if (isFacebookHost(host)) {
            return "facebook"
        }
        if (isProtectedYouTubeDocumentScrollRoute(host, path)) {
            return "youtube"
        }
        if (host == "kulchaflo.com" && (path == "/watch" || path.startsWith("/watch/"))) {
            return "internal-watch-route"
        }
        if (isCvmLiveStreamUrl(url) || isCvmVimeoEmbedUrl(uri)) {
            return "cvm-vimeo-player"
        }
        if (isAdminOrBackendRoute(host, path)) {
            return "admin-backend"
        }
        return null
    }

    private fun isProtectedYouTubeDocumentScrollRoute(host: String, path: String): Boolean {
        if (host == "googlevideo.com" || host.endsWith(".googlevideo.com")) {
            return true
        }
        if (host == "youtube-nocookie.com" || host.endsWith(".youtube-nocookie.com")) {
            return true
        }
        if (host == "youtu.be") {
            return true
        }
        if (host != "youtube.com" && !host.endsWith(".youtube.com")) {
            return false
        }
        return path == "/watch" ||
            path.startsWith("/watch/") ||
            path == "/embed" ||
            path.startsWith("/embed/") ||
            path == "/shorts" ||
            path.startsWith("/shorts/") ||
            path == "/live" ||
            path.startsWith("/live/")
    }

    private fun syncPointerToActivePage(reason: String) {
        if (tabController.getActiveTab() == null) {
            cancelPointerIdleTimeout()
            browserFullscreenPointerSleepActive = false
            browserFullscreenWakeOnlyPendingKeyUp = false
            pointerVisible = false
            pointerOverlay.hidePointer()
            GvLogger.i("GvInput", "pointer hidden reason=$reason")
            return
        }
        if (pointerVisible && pointerOverlay.isPointerVisible()) {
            schedulePointerIdleTimeout()
            GvLogger.i("GvInput", "pointer synced reason=$reason")
            return
        }
        cancelPointerIdleTimeout()
        pointerVisible = false
        pointerOverlay.hidePointer()
        GvLogger.i("GvInput", "pointer idle reason=$reason")
    }

    private fun schedulePointerIdleTimeout() {
        pointerHandler.removeCallbacks(pointerIdleRunnable)
        if (browserFullscreenPointerSleepActive) {
            pointerHandler.postDelayed(pointerIdleRunnable, BROWSER_FULLSCREEN_POINTER_IDLE_HIDE_MS)
            return
        }
        val activeUrl = tabController.getActiveTab()?.url ?: currentUrl
        val pointerIdleSleepAllowed = shouldPointerAssistIdleSleep(activeUrl)
        if (pointerAssistModeActive && !promotedMediaPlayer.isPromoted() && !pointerIdleSleepAllowed) {
            GvLogger.i("GvInput", "pointer idle not scheduled reason=focus-navigation-mode")
            return
        }
        val delayMs = if (isYouTubePageUrl(activeUrl)) YOUTUBE_POINTER_IDLE_HIDE_MS else POINTER_IDLE_HIDE_MS
        pointerHandler.postDelayed(pointerIdleRunnable, delayMs)
        if (isYouTubePageUrl(activeUrl)) {
            GvLogger.i("GvInput", "youtube pointer sleep scheduled delayMs=$delayMs")
        } else if (pointerIdleSleepAllowed) {
            GvLogger.i("GvInput", "pointer idle scheduled delayMs=$delayMs url=$activeUrl")
        }
    }

    private fun cancelPointerIdleTimeout() {
        pointerHandler.removeCallbacks(pointerIdleRunnable)
    }

    private fun maybeStartLiveLoadTiming(session: GeckoSession, url: String, event: String) {
        val surface = liveLoadTimingSurface(url)
        if (surface == null) {
            if (liveLoadTimingBySession.remove(session) != null) {
                GvLogger.i(
                    "GvNav",
                    "live load timing event=state-clear reason=non-live-url tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} url=$url"
                )
            }
            absTegoStartupReprobeBySession.remove(session)
            absTegoPlayerFirstReturnUrlBySession.remove(session)
            tttTegoPlayerFirstReturnUrlBySession.remove(session)
            novusTelearubaPlayerFirstReturnUrlBySession.remove(session)
            novusTelearubaPlayAssistBySession.remove(session)
            return
        }
        val nowMs = SystemClock.elapsedRealtime()
        val state = LiveLoadTimingState(
            surface = surface,
            rootUrl = url,
            startedAtMs = nowMs,
        )
        liveLoadTimingBySession[session] = state
        GvLogger.i(
            "GvNav",
            "live load timing event=$event surface=$surface elapsedMs=0 tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} url=$url"
        )
        scheduleLiveLoadTimingCheckpoints(session, state)
    }

    private fun handleLiveLoadTimingLocationChange(session: GeckoSession, url: String) {
        val state = liveLoadTimingBySession[session]
        val surface = liveLoadTimingSurface(url)
        if (state == null) {
            if (surface != null) {
                maybeStartLiveLoadTiming(session, url, event = "location-change-start")
            }
            return
        }
        if (surface == null) {
            liveLoadTimingBySession.remove(session)
            absTegoStartupReprobeBySession.remove(session)
            GvLogger.i(
                "GvNav",
                "live load timing event=state-clear reason=left-live-surface surface=${state.surface} elapsedMs=${elapsedLiveLoadMs(state)} tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} url=$url"
            )
            return
        }
        logLiveLoadTimingEvent(session, state, event = "location-change", url = url)
        if (isTegoPlayerUrl(url) && !state.tegoIframeLogged) {
            state.tegoIframeLogged = true
            logLiveLoadTimingEvent(session, state, event = "tego-player-location", url = url)
        }
        maybeStartAbsTegoStartupReprobe(session, state, url, trigger = "location-change")
    }

    private fun logLiveLoadTimingPageStop(session: GeckoSession, url: String, success: Boolean) {
        val state = liveLoadTimingBySession[session] ?: return
        if (!state.pageStopLogged) {
            state.pageStopLogged = true
            logLiveLoadTimingEvent(session, state, event = "page-stop", url = url, extra = " success=$success")
        }
    }

    private fun scheduleLiveLoadTimingCheckpoints(session: GeckoSession, state: LiveLoadTimingState) {
        LIVE_LOAD_TIMING_CHECKPOINTS_MS.forEach { delayMs ->
            pointerHandler.postDelayed(
                {
                    if (isFinishing || isDestroyed) {
                        return@postDelayed
                    }
                    val currentState = liveLoadTimingBySession[session] ?: return@postDelayed
                    if (currentState.startedAtMs != state.startedAtMs) {
                        return@postDelayed
                    }
                    val currentSessionUrl = tabController.findTabBySession(session)?.url ?: currentUrl
                    GvLogger.i(
                        "GvNav",
                        "live load timing checkpoint surface=${currentState.surface} elapsedMs=${elapsedLiveLoadMs(currentState)} " +
                            "targetMs=$delayMs tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} currentUrl=$currentSessionUrl " +
                            "pageStopLogged=${currentState.pageStopLogged} tegoIframeLogged=${currentState.tegoIframeLogged} " +
                            "mediaEvidenceLogged=${currentState.mediaEvidenceLogged} tegoQualityLogged=${currentState.tegoQualityLogged} " +
                            "playableVideoLogged=${currentState.playableVideoLogged}"
                    )
                },
                delayMs,
            )
        }
    }

    private fun maybeLogLiveLoadTimingFromPayload(session: GeckoSession, payload: JSONObject) {
        val pageUrl = payload.optString("pageUrl")
        val surface = liveLoadTimingSurface(pageUrl)
        var state = liveLoadTimingBySession[session]
        if (state == null && surface != null) {
            maybeStartLiveLoadTiming(session, pageUrl, event = "payload-start")
            state = liveLoadTimingBySession[session]
        }
        state ?: return
        // Some ABS/Tego navigations show player.tegotv.com only via payload traces
        // without a corresponding top-level onLocationChange callback in the active tab.
        // Start the bounded startup reprobe from payload evidence only if absent to avoid churn.
        if (absTegoStartupReprobeBySession[session] == null) {
            maybeStartAbsTegoStartupReprobe(session, state, pageUrl, trigger = "payload")
        }
        val type = payload.optString("type")
        if (isTegoPlayerUrl(pageUrl) && !state.tegoIframeLogged) {
            state.tegoIframeLogged = true
            logLiveLoadTimingEvent(session, state, event = "tego-player-payload", url = pageUrl)
        }
        if (type == "media-evidence") {
            val candidates = payload.optJSONArray("directCandidates") ?: JSONArray()
            if (candidates.length() > 0 && !state.mediaEvidenceLogged) {
                state.mediaEvidenceLogged = true
                logLiveLoadTimingEvent(
                    session,
                    state,
                    event = "media-evidence",
                    url = pageUrl,
                    extra = " candidateCount=${candidates.length()} playableCandidate=${hasPlayableDirectCandidate(candidates)}"
                )
            }
            if (!state.playableVideoLogged && hasPlayableDirectCandidate(candidates)) {
                state.playableVideoLogged = true
                logLiveLoadTimingEvent(session, state, event = "playable-video", url = pageUrl, extra = " source=media-evidence")
            }
        }
        if (type == "tego-quality") {
            if (!state.tegoQualityLogged) {
                state.tegoQualityLogged = true
                logLiveLoadTimingEvent(
                    session,
                    state,
                    event = "tego-quality",
                    url = pageUrl,
                    extra = " applied=${payload.optBoolean("applied")} playerCount=${payload.optInt("playerCount")}"
                )
            }
            val videos = payload.optJSONArray("videos") ?: JSONArray()
            if (!state.playableVideoLogged && hasPlayableTegoVideo(videos)) {
                state.playableVideoLogged = true
                logLiveLoadTimingEvent(
                    session,
                    state,
                    event = "playable-video",
                    url = pageUrl,
                    extra = " source=tego-quality videos=${summarizeTegoVideosForTiming(videos)}"
                )
            }
            maybeUpdateAbsTegoStartupReprobeFromTegoQuality(session, state, payload, videos)
        }
    }

    private fun maybeStartAbsTegoStartupReprobe(
        session: GeckoSession,
        liveState: LiveLoadTimingState,
        pageUrl: String,
        trigger: String,
    ) {
        if (liveState.surface != "abs-live") {
            return
        }
        if (!isAbsTegoChannel10PlayerUrl(pageUrl)) {
            return
        }
        val nowMs = SystemClock.elapsedRealtime()
        val current = absTegoStartupReprobeBySession[session]
        if (current != null && current.rootUrl == liveState.rootUrl && !current.completed) {
            return
        }
        val generation = (current?.generation ?: 0) + 1
        val next = AbsTegoStartupReprobeState(
            rootUrl = liveState.rootUrl,
            startedAtMs = nowMs,
            generation = generation,
            latestPageUrl = pageUrl,
        )
        absTegoStartupReprobeBySession[session] = next
        GvLogger.i(
            "GvMedia",
            "abs tego startup reprobe start generation=${next.generation} trigger=$trigger rootUrl=${next.rootUrl} pageUrl=$pageUrl"
        )
        ABS_TEGO_STARTUP_REPROBE_DELAYS_MS.forEach { delayMs ->
            pointerHandler.postDelayed(
                {
                    if (isFinishing || isDestroyed) {
                        return@postDelayed
                    }
                    val state = absTegoStartupReprobeBySession[session] ?: return@postDelayed
                    if (state.generation != generation || state.completed) {
                        return@postDelayed
                    }
                    val activeUrl = tabController.findTabBySession(session)?.url.orEmpty()
                    val onTarget = isAbsTegoChannel10PlayerUrl(activeUrl) || isAbsTegoChannel10ContextUrl(activeUrl)
                    if (!onTarget) {
                        state.completed = true
                        state.completionReason = "url-left-abs-tego"
                        GvLogger.i(
                            "GvMedia",
                            "abs tego startup reprobe stop generation=${state.generation} reason=${state.completionReason} activeUrl=$activeUrl"
                        )
                        return@postDelayed
                    }
                    if (!shouldContinueAbsTegoStartupReprobe(session, liveState, state)) {
                        if (state.completionReason.isBlank()) {
                            state.completionReason = resolveAbsTegoStartupReprobeCompletionReason(session, liveState, state)
                        }
                        state.completed = true
                        GvLogger.i(
                            "GvMedia",
                            "abs tego startup reprobe stop generation=${state.generation} reason=${state.completionReason} " +
                                "applied=${state.latestApplied} playable=${state.latestPlayable} missingHls=${state.latestMissingHlsLevels} " +
                                "readyZeroPaused=${state.latestReadyZeroPaused} mediaSession=${browserMediaController.describeSessionState(session)} activeUrl=$activeUrl"
                        )
                        return@postDelayed
                    }
                    dispatchAbsTegoStartupReprobe(session, state, delayMs)
                },
                delayMs,
            )
        }
    }

    private fun shouldContinueAbsTegoStartupReprobe(
        session: GeckoSession,
        liveState: LiveLoadTimingState,
        state: AbsTegoStartupReprobeState,
    ): Boolean {
        if (liveState.playableVideoLogged || state.latestPlaybackProgressed) {
            return false
        }
        if (browserMediaController.describeSessionState(session).contains("active=true")) {
            return false
        }
        return true
    }

    private fun resolveAbsTegoStartupReprobeCompletionReason(
        session: GeckoSession,
        liveState: LiveLoadTimingState,
        state: AbsTegoStartupReprobeState,
    ): String {
        return when {
            state.latestPlaybackProgressed -> "playback-progressed"
            liveState.playableVideoLogged || state.latestPlayable -> "playable-video-detected"
            browserMediaController.describeSessionState(session).contains("active=true") -> "media-session-active"
            state.latestApplied && !state.latestMissingHlsLevels -> "quality-applied-waiting-playback"
            !state.latestReadyZeroPaused -> "video-state-transition"
            state.latestApplied -> "tego-quality-applied-pending-playback"
            else -> "conditions-no-longer-match"
        }
    }

    private fun maybeUpdateAbsTegoStartupReprobeFromTegoQuality(
        session: GeckoSession,
        liveState: LiveLoadTimingState,
        payload: JSONObject,
        videos: JSONArray,
    ) {
        if (liveState.surface != "abs-live") {
            return
        }
        val pageUrl = payload.optString("pageUrl")
        if (!isAbsTegoChannel10PlayerUrl(pageUrl)) {
            return
        }
        val state = absTegoStartupReprobeBySession[session] ?: return
        state.latestPageUrl = pageUrl
        state.latestApplied = payload.optBoolean("applied")
        state.latestPlayable = liveState.playableVideoLogged || hasPlayableTegoVideo(videos)
        state.latestPlaybackProgressed = hasPlaybackProgressedTegoVideo(videos)
        state.latestReadyZeroPaused = isReadyZeroPausedTegoVideos(videos)
        state.latestMissingHlsLevels = isMissingTegoHlsLevels(payload.optJSONArray("results"))
        if (!state.completed && !shouldContinueAbsTegoStartupReprobe(session, liveState, state)) {
            state.completionReason = resolveAbsTegoStartupReprobeCompletionReason(session, liveState, state)
            state.completed = true
            GvLogger.i(
                "GvMedia",
                "abs tego startup reprobe stop generation=${state.generation} reason=${state.completionReason} " +
                    "applied=${state.latestApplied} playable=${state.latestPlayable} playbackProgressed=${state.latestPlaybackProgressed} missingHls=${state.latestMissingHlsLevels} " +
                    "readyZeroPaused=${state.latestReadyZeroPaused} mediaSession=${browserMediaController.describeSessionState(session)} pageUrl=$pageUrl"
            )
            maybeDispatchAbsTegoNativeFKey(session, state, trigger = "tego-quality-playback-progressed")
        }
    }

    private fun maybeDispatchAbsTegoNativeFKey(
        session: GeckoSession,
        state: AbsTegoStartupReprobeState,
        trigger: String,
    ) {
        if (!ENABLE_ABS_TEGO_NATIVE_F_FULLSCREEN) {
            return
        }
        if (state.nativeFDispatched) {
            return
        }
        if (!state.latestPlaybackProgressed) {
            return
        }
        if (!isAbsTegoChannel10PlayerUrl(state.latestPageUrl)) {
            return
        }
        val activeUrl = tabController.findTabBySession(session)?.url.orEmpty()
        if (activeUrl.isNotBlank() && !isAbsTegoChannel10ContextUrl(activeUrl)) {
            GvLogger.i(
                "GvMedia",
                "abs tego native f fullscreen skipped trigger=$trigger reason=active-url-mismatch activeUrl=$activeUrl playerUrl=${state.latestPageUrl}"
            )
            return
        }
        state.nativeFDispatched = true
        pointerHandler.postDelayed(
            {
                if (isFinishing || isDestroyed) {
                    return@postDelayed
                }
                val eventTime = SystemClock.uptimeMillis()
                val down = KeyEvent(eventTime, eventTime, KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_F, 0)
                val up = KeyEvent(eventTime, eventTime + 40L, KeyEvent.ACTION_UP, KeyEvent.KEYCODE_F, 0)
                val downHandled = geckoView.dispatchKeyEvent(down)
                val upHandled = geckoView.dispatchKeyEvent(up)
                GvLogger.i(
                    "GvMedia",
                    "abs tego native f fullscreen dispatched trigger=$trigger downHandled=$downHandled upHandled=$upHandled activeUrl=$activeUrl playerUrl=${state.latestPageUrl}"
                )
            },
            450L,
        )
    }

    private fun maybeDispatchAbsTegoFullscreenControlNativeTap(
        session: GeckoSession,
        payload: JSONObject,
    ) {
        if (!ENABLE_ABS_TEGO_FULLSCREEN_NATIVE_TAP_FALLBACK) {
            return
        }
        val playerUrl = payload.optString("playerUrl").ifBlank { payload.optString("pageUrl") }
        if (!isAbsTegoChannel10PlayerUrl(playerUrl)) {
            return
        }
        if (!payload.optBoolean("translated", true)) {
            return
        }
        val centerX = payload.optDouble("centerX", -1.0).toFloat()
        val centerY = payload.optDouble("centerY", -1.0).toFloat()
        if (centerX <= 0f || centerY <= 0f) {
            return
        }
        val viewportWidth = payload.optDouble("viewportWidth", 0.0).toFloat()
        val viewportHeight = payload.optDouble("viewportHeight", 0.0).toFloat()
        val scaleX = if (viewportWidth > 0f && geckoView.width > 0) {
            geckoView.width.toFloat() / viewportWidth
        } else {
            1f
        }
        val scaleY = if (viewportHeight > 0f && geckoView.height > 0) {
            geckoView.height.toFloat() / viewportHeight
        } else {
            1f
        }
        val viewCenterX = centerX * scaleX
        val viewCenterY = centerY * scaleY
        val state = absTegoStartupReprobeBySession[session] ?: return
        if (state.nativeFullscreenTapDispatched) {
            return
        }
        if (!state.latestPlaybackProgressed) {
            return
        }
        state.nativeFullscreenTapDispatched = true
        val clampedX = viewCenterX.coerceIn(1f, (geckoView.width - 1).coerceAtLeast(1).toFloat())
        val clampedY = viewCenterY.coerceIn(1f, (geckoView.height - 1).coerceAtLeast(1).toFloat())
        pointerHandler.postDelayed(
            {
                if (isFinishing || isDestroyed) {
                    return@postDelayed
                }
                val activeUrl = tabController.findTabBySession(session)?.url.orEmpty()
                if (!isAbsTegoChannel10ContextUrl(activeUrl) && !isAbsTegoChannel10PlayerUrl(activeUrl)) {
                    GvLogger.i(
                        "GvMedia",
                        "abs tego fullscreen native tap skipped reason=active-url-mismatch activeUrl=$activeUrl playerUrl=$playerUrl"
                    )
                    return@postDelayed
                }
                val handled = dispatchNativeMouseTapAt(clampedX, clampedY, "abs-tego-fullscreen-control")
                GvLogger.i(
                    "GvMedia",
                    "abs tego fullscreen native tap dispatched x=${clampedX.toInt()} y=${clampedY.toInt()} rawCenter=${centerX.toInt()},${centerY.toInt()} " +
                        "viewport=${viewportWidth.toInt()}x${viewportHeight.toInt()} view=${geckoView.width}x${geckoView.height} scale=$scaleX,$scaleY " +
                        "handled=$handled activeUrl=$activeUrl playerUrl=$playerUrl"
                )
            },
            140L,
        )
    }

    private fun maybeDispatchTttTegoStartupNativePlayTap(
        session: GeckoSession,
        payload: JSONObject,
    ) {
        val playerUrl = payload.optString("playerUrl").ifBlank { payload.optString("pageUrl") }
        if (!isTttTegoPlayerUrl(playerUrl)) {
            return
        }
        if (!payload.optBoolean("translated", true)) {
            return
        }
        val attemptCount = tttTegoStartupNativeTapCountBySession[session] ?: 0
        if (attemptCount >= 2) {
            return
        }
        val centerX = payload.optDouble("centerX", -1.0).toFloat()
        val centerY = payload.optDouble("centerY", -1.0).toFloat()
        if (centerX <= 0f || centerY <= 0f) {
            return
        }
        val viewportWidth = payload.optDouble("viewportWidth", 0.0).toFloat()
        val viewportHeight = payload.optDouble("viewportHeight", 0.0).toFloat()
        val scaleX = if (viewportWidth > 0f && geckoView.width > 0) {
            geckoView.width.toFloat() / viewportWidth
        } else {
            1f
        }
        val scaleY = if (viewportHeight > 0f && geckoView.height > 0) {
            geckoView.height.toFloat() / viewportHeight
        } else {
            1f
        }
        val clampedX = (centerX * scaleX).coerceIn(1f, (geckoView.width - 1).coerceAtLeast(1).toFloat())
        val clampedY = (centerY * scaleY).coerceIn(1f, (geckoView.height - 1).coerceAtLeast(1).toFloat())
        tttTegoStartupNativeTapCountBySession[session] = attemptCount + 1
        pointerHandler.postDelayed(
            {
                if (isFinishing || isDestroyed) {
                    return@postDelayed
                }
                val activeUrl = tabController.findTabBySession(session)?.url.orEmpty()
                if (!isTttOrTegoLivePlayerUrl(activeUrl)) {
                    GvLogger.i(
                        "GvMedia",
                        "ttt tego startup native play tap skipped reason=active-url-mismatch activeUrl=$activeUrl playerUrl=$playerUrl"
                    )
                    return@postDelayed
                }
                val handled = dispatchNativeMouseTapAt(clampedX, clampedY, "ttt-tego-startup-native-play")
                GvLogger.i(
                    "GvMedia",
                    "ttt tego startup native play tap dispatched attempt=${attemptCount + 1} reason=${payload.optString("reason")} " +
                        "x=${clampedX.toInt()} y=${clampedY.toInt()} rawCenter=${centerX.toInt()},${centerY.toInt()} " +
                        "viewport=${viewportWidth.toInt()}x${viewportHeight.toInt()} view=${geckoView.width}x${geckoView.height} scale=$scaleX,$scaleY " +
                        "handled=$handled activeUrl=$activeUrl playerUrl=$playerUrl"
                )
            },
            140L,
        )
    }

    private fun maybeDispatchAbsTegoFullscreenControlNativeHover(
        session: GeckoSession,
        payload: JSONObject,
    ) {
        val playerUrl = payload.optString("playerUrl").ifBlank { payload.optString("pageUrl") }
        if (!isAbsTegoChannel10PlayerUrl(playerUrl)) {
            return
        }
        if (!payload.optBoolean("translated", true)) {
            return
        }
        val centerX = payload.optDouble("centerX", -1.0).toFloat()
        val centerY = payload.optDouble("centerY", -1.0).toFloat()
        if (centerX <= 0f || centerY <= 0f) {
            return
        }
        val state = absTegoStartupReprobeBySession[session] ?: return
        if (!state.latestPlaybackProgressed) {
            return
        }
        val viewportWidth = payload.optDouble("viewportWidth", 0.0).toFloat()
        val viewportHeight = payload.optDouble("viewportHeight", 0.0).toFloat()
        val scaleX = if (viewportWidth > 0f && geckoView.width > 0) {
            geckoView.width.toFloat() / viewportWidth
        } else {
            1f
        }
        val scaleY = if (viewportHeight > 0f && geckoView.height > 0) {
            geckoView.height.toFloat() / viewportHeight
        } else {
            1f
        }
        val clampedX = (centerX * scaleX).coerceIn(1f, (geckoView.width - 1).coerceAtLeast(1).toFloat())
        val clampedY = (centerY * scaleY).coerceIn(1f, (geckoView.height - 1).coerceAtLeast(1).toFloat())
        pointerHandler.postDelayed(
            {
                if (isFinishing || isDestroyed) {
                    return@postDelayed
                }
                val activeUrl = tabController.findTabBySession(session)?.url.orEmpty()
                if (!isAbsTegoChannel10ContextUrl(activeUrl) && !isAbsTegoChannel10PlayerUrl(activeUrl)) {
                    GvLogger.i(
                        "GvMedia",
                        "abs tego fullscreen native hover skipped reason=active-url-mismatch activeUrl=$activeUrl playerUrl=$playerUrl"
                    )
                    return@postDelayed
                }
                showPointerAt(clampedX, clampedY, "abs-tego-fullscreen-reveal")
                val handled = dispatchNativeMouseHoverAt(clampedX, clampedY, "abs-tego-fullscreen-reveal")
                GvLogger.i(
                    "GvMedia",
                    "abs tego fullscreen native hover dispatched x=${clampedX.toInt()} y=${clampedY.toInt()} rawCenter=${centerX.toInt()},${centerY.toInt()} " +
                        "viewport=${viewportWidth.toInt()}x${viewportHeight.toInt()} view=${geckoView.width}x${geckoView.height} scale=$scaleX,$scaleY " +
                        "handled=$handled activeUrl=$activeUrl playerUrl=$playerUrl reason=${payload.optString("reason")}"
                )
            },
            80L,
        )
    }

    private fun dispatchAbsTegoStartupReprobe(
        session: GeckoSession,
        state: AbsTegoStartupReprobeState,
        delayMs: Long,
    ) {
        val activeUrl = tabController.findTabBySession(session)?.url.orEmpty()
        val script = """
            javascript:(function(){
              try{
                var href=(window.location&&window.location.href)||'';
                var host=(window.location&&window.location.hostname||'').toLowerCase();
                var path=(window.location&&window.location.pathname||'').toLowerCase();
                if(host!=='player.tegotv.com'||path.indexOf('/player.php')!==0){return;}
                var q=new URLSearchParams((window.location&&window.location.search)||'');
                var channel=(q.get('channel')||'').trim();
                if(channel && channel!=='10'){return;}
                var num=function(v){var n=Number(v);return Number.isFinite(n)?n:0;};
                var results=[];
                try{
                  var pageWindow=window.wrappedJSObject||window;
                  var player=pageWindow.rmp;
                  if(player&&typeof player.getHlsJSInstance==='function'){
                    var hls=player.getHlsJSInstance();
                    if(hls&&Array.isArray(hls.levels)&&hls.levels.length){
                      var levels=hls.levels.map(function(level,index){
                        return {index:index,height:num(level&&level.height),width:num(level&&level.width),bitrate:num(level&&(level.bitrate||level.maxBitrate||level.averageBitrate))};
                      }).filter(function(level){return level.height>0||level.bitrate>0;});
                      if(levels.length){
                        var underCap=levels.filter(function(level){return level.height>0&&level.height<=720;});
                        var pool=(underCap.length?underCap:levels).sort(function(a,b){
                          if(b.height!==a.height){return b.height-a.height;}
                          return b.bitrate-a.bitrate;
                        });
                        var best=pool[0];
                        if(typeof hls.autoLevelCapping==='number'){hls.autoLevelCapping=best.index;}
                        hls.startLevel=best.index;
                        hls.nextLevel=best.index;
                        hls.loadLevel=best.index;
                        if(hls.currentLevel!==best.index){hls.currentLevel=best.index;}
                        results.push({source:'radiant-hlsjs',applied:true,selectedHeight:best.height,selectedBitrate:best.bitrate,currentLevel:num(hls.currentLevel),loadLevel:num(hls.loadLevel),nextLevel:num(hls.nextLevel)});
                      }else{
                        results.push({source:'radiant-hlsjs',applied:false,reason:'no-selectable-hls-levels'});
                      }
                    }else{
                      results.push({source:'radiant-hlsjs',applied:false,reason:'no-hls-levels'});
                    }
                  }
                }catch(error){
                  results.push({source:'radiant-hlsjs',applied:false,reason:(error&&error.message)||'error'});
                }
                var videos=Array.from(document.querySelectorAll('video')).slice(0,4).map(function(video,index){
                  return {
                    index:index,
                    videoWidth:num(video.videoWidth),
                    videoHeight:num(video.videoHeight),
                    readyState:num(video.readyState),
                    paused:!!video.paused,
                    currentTime:num(video.currentTime)
                  };
                });
                var hasPlayable=videos.some(function(video){
                  return video.videoWidth>0&&video.videoHeight>0&&(video.readyState>=4||(video.readyState>=1&&!video.paused)||video.currentTime>0);
                });
                var readyZeroPaused=videos.length===0||videos.every(function(video){return video.readyState===0&&video.paused;});
                var missingHls=results.some(function(result){return result&&result.source==='radiant-hlsjs'&&!result.applied&&String(result.reason||'').indexOf('no-hls-levels')>=0;});
                var applied=results.some(function(result){return result&&!!result.applied;});
                window.prompt(${JSONObject.quote(PROMPT_PREFIX)}+JSON.stringify({
                  type:'tego-startup-reprobe',
                  phase:'activity-tego-startup-reprobe',
                  pageUrl:href,
                  attemptAtMs:${delayMs},
                  applied:applied,
                  playable:hasPlayable,
                  missingHlsLevels:missingHls,
                  readyZeroPaused:readyZeroPaused,
                  results:results,
                  videos:videos
                }),'');
              }catch(_){}
            })();
        """.trimIndent()
        session.loadUri(script)
        GvLogger.i(
            "GvMedia",
            "abs tego startup reprobe dispatched generation=${state.generation} attemptAtMs=$delayMs activeUrl=$activeUrl"
        )
    }

    private fun maybeDispatchAbsTegoGestureFullscreen(session: GeckoSession?, trigger: String): Boolean {
        if (!ENABLE_ABS_TEGO_GESTURE_FULLSCREEN_RETRY) {
            return false
        }
        if (session == null) {
            return false
        }
        val activeUrl = tabController.findTabBySession(session)?.url.orEmpty()
        if (!isAbsTegoGestureFullscreenContextUrl(activeUrl)) {
            return false
        }
        val probeState = absTegoStartupReprobeBySession[session]
        val playbackReady = probeState?.let { it.latestPlaybackProgressed || it.latestPlayable } ?: false
        if (!playbackReady) {
            GvLogger.i(
                "GvMedia",
                "abs tego gesture fullscreen skipped trigger=$trigger reason=playback-not-ready activeUrl=$activeUrl"
            )
            return false
        }
        val script = """
            javascript:(function(){
              try{
                var href=(window.location&&window.location.href)||'';
                var host=(window.location&&window.location.hostname||'').toLowerCase();
                var path=(window.location&&window.location.pathname||'').toLowerCase();
                if(host!=='player.tegotv.com'||path.indexOf('/player.php')!==0){return;}
                var q=new URLSearchParams((window.location&&window.location.search)||'');
                var channel=(q.get('channel')||'').trim();
                if(channel && channel!=='10'){return;}
                var methods=[];
                var requestedFullscreen=false;
                var clickedFullscreen=false;
                var errors=0;
                var call=function(target,name,args){
                  try{
                    if(!target||typeof target[name]!=='function'){return false;}
                    target[name].apply(target,args||[]);
                    methods.push(name);
                    return true;
                  }catch(_){return false;}
                };
                var req=function(target,name){
                  try{
                    if(!target||typeof target[name]!=='function'){return false;}
                    target[name]();
                    methods.push(name);
                    return true;
                  }catch(_){return false;}
                };
                var isFullscreen=function(){
                  try{
                    return !!(document.fullscreenElement||document.webkitFullscreenElement||document.mozFullScreenElement||document.msFullscreenElement);
                  }catch(_){return false;}
                };
                var summarize=function(node){
                  try{
                    if(!node){return 'none';}
                    var tag=(node.tagName||'').toLowerCase();
                    var id=node.id?('#'+node.id):'';
                    var cls=(typeof node.className==='string'&&node.className.trim())?('.'+node.className.trim().replace(/\s+/g,'.')):'';
                    return (tag+id+cls).slice(0,180);
                  }catch(_){return 'none';}
                };
                try{
                  var pageWindow=window.wrappedJSObject||window;
                  var rmp=pageWindow&&pageWindow.rmp;
                  if(rmp){
                    if(call(rmp,'setFullscreen',[true])){requestedFullscreen=true;}
                    if(call(rmp,'enterFullscreen',[])){requestedFullscreen=true;}
                    if(call(rmp,'requestFullscreen',[])){requestedFullscreen=true;}
                  }
                  var fullscreenButton=Array.from(document.querySelectorAll("button,[role='button'],.rmp-fullscreen-button,.vjs-fullscreen-control,.jw-icon-fullscreen")).find(function(node){
                    try{
                      if(!node){return false;}
                      var style=window.getComputedStyle(node);
                      if(style&&(style.display==='none'||style.visibility==='hidden'||style.pointerEvents==='none'||style.opacity==='0')){return false;}
                      var rect=node.getBoundingClientRect();
                      if(rect.width<18||rect.height<18){return false;}
                      var text=((node.innerText||node.textContent||'')+' '+(node.getAttribute('aria-label')||'')+' '+(node.getAttribute('title')||'')).toLowerCase();
                      return text.indexOf('fullscreen')>=0||text.indexOf('full screen')>=0||text.indexOf('expand')>=0;
                    }catch(_){return false;}
                  });
                  if(fullscreenButton){
                    try{fullscreenButton.click();clickedFullscreen=true;methods.push('click-fullscreen-button');}catch(_){errors+=1;}
                  }
                  if(!requestedFullscreen){
                    var video=document.querySelector('video');
                    if(video){
                      requestedFullscreen=req(video,'requestFullscreen')||req(video,'webkitRequestFullscreen')||req(video,'mozRequestFullScreen')||req(video,'msRequestFullscreen')||requestedFullscreen;
                    }
                  }
                  if(!requestedFullscreen){
                    var root=document.querySelector('.rmp-container,.rmp-content,.video-js,.jwplayer,#player,.player')||document.documentElement;
                    if(root){
                      requestedFullscreen=req(root,'requestFullscreen')||req(root,'webkitRequestFullscreen')||req(root,'mozRequestFullScreen')||req(root,'msRequestFullscreen')||requestedFullscreen;
                    }
                  }
                }catch(_){errors+=1;}
                window.prompt(${JSONObject.quote(PROMPT_PREFIX)}+JSON.stringify({
                  type:'tego-startup-fullscreen',
                  phase:'activity-tego-gesture-fullscreen',
                  pageUrl:href,
                  attemptAtMs:-1,
                  playable:true,
                  playbackProgressed:true,
                  applied:true,
                  clickedFullscreen:clickedFullscreen,
                  requestedFullscreen:requestedFullscreen,
                  fullscreenActive:isFullscreen(),
                  fullscreenElement:summarize(document.fullscreenElement||document.webkitFullscreenElement||document.mozFullScreenElement||document.msFullscreenElement),
                  fullscreenLikeApplied:false,
                  fullscreenLikeTarget:'none',
                  methods:methods,
                  errors:errors
                }),'');
              }catch(_){}
            })();
        """.trimIndent()
        session.loadUri(script)
        GvLogger.i(
            "GvMedia",
            "abs tego gesture fullscreen dispatched trigger=$trigger activeUrl=$activeUrl"
        )
        return true
    }

    private fun logLiveLoadTimingEvent(
        session: GeckoSession,
        state: LiveLoadTimingState,
        event: String,
        url: String,
        extra: String = "",
    ) {
        GvLogger.i(
            "GvNav",
            "live load timing event=$event surface=${state.surface} elapsedMs=${elapsedLiveLoadMs(state)} " +
                "tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} url=$url rootUrl=${state.rootUrl}$extra"
        )
    }

    private fun elapsedLiveLoadMs(state: LiveLoadTimingState): Long {
        return (SystemClock.elapsedRealtime() - state.startedAtMs).coerceAtLeast(0L)
    }

    private fun hasPlayableDirectCandidate(candidates: JSONArray): Boolean {
        for (index in 0 until candidates.length()) {
            val candidate = candidates.optJSONObject(index) ?: continue
            val readyState = candidate.optInt("readyState")
            val videoWidth = candidate.optInt("videoWidth")
            val videoHeight = candidate.optInt("videoHeight")
            val currentTime = candidate.optDouble("currentTime")
            val src = candidate.optString("src")
            if (src.isNotBlank() && (readyState >= 1 || videoWidth > 0 || videoHeight > 0 || currentTime > 0.0)) {
                return true
            }
        }
        return false
    }

    private fun hasPlayableTegoVideo(videos: JSONArray): Boolean {
        for (index in 0 until videos.length()) {
            val video = videos.optJSONObject(index) ?: continue
            val readyState = video.optInt("readyState")
            val videoWidth = video.optInt("videoWidth")
            val videoHeight = video.optInt("videoHeight")
            val paused = video.optBoolean("paused")
            if (videoWidth > 0 && videoHeight > 0 && (readyState >= 4 || (readyState >= 1 && !paused))) {
                return true
            }
        }
        return false
    }

    private fun hasPlaybackProgressedTegoVideo(videos: JSONArray): Boolean {
        for (index in 0 until videos.length()) {
            val video = videos.optJSONObject(index) ?: continue
            val currentTime = video.optDouble("currentTime")
            if (currentTime >= 1.0) {
                return true
            }
            val readyState = video.optInt("readyState")
            val videoWidth = video.optInt("videoWidth")
            val videoHeight = video.optInt("videoHeight")
            val paused = video.optBoolean("paused")
            if (videoWidth > 0 && videoHeight > 0 && readyState >= 4 && !paused) {
                return true
            }
        }
        return false
    }

    private fun hasPlayingTegoVideo(videos: JSONArray): Boolean {
        for (index in 0 until videos.length()) {
            val video = videos.optJSONObject(index) ?: continue
            if (!video.optBoolean("paused") && video.optInt("readyState") >= 1 && video.optInt("videoWidth") > 0 && video.optInt("videoHeight") > 0) {
                return true
            }
        }
        return false
    }

    private fun summarizeTegoVideosForTiming(videos: JSONArray): String {
        return buildString {
            val limit = minOf(videos.length(), 3)
            for (index in 0 until limit) {
                val video = videos.optJSONObject(index) ?: continue
                if (isNotEmpty()) append("|")
                append("#").append(index + 1)
                append(":").append(video.optInt("videoWidth"))
                append("x").append(video.optInt("videoHeight"))
                append(":ready=").append(video.optInt("readyState"))
                append(":paused=").append(video.optBoolean("paused"))
            }
        }.ifBlank { "none" }
    }

    private fun isMissingTegoHlsLevels(results: JSONArray?): Boolean {
        if (results == null || results.length() == 0) {
            return true
        }
        var sawRadiant = false
        for (index in 0 until results.length()) {
            val result = results.optJSONObject(index) ?: continue
            if (result.optString("source") != "radiant-hlsjs") {
                continue
            }
            sawRadiant = true
            if (result.optBoolean("applied")) {
                return false
            }
            val reason = result.optString("reason")
            if (reason.contains("no-hls-levels")) {
                return true
            }
            if (reason.contains("no-selectable-hls-levels")) {
                return true
            }
        }
        return !sawRadiant
    }

    private fun isReadyZeroPausedTegoVideos(videos: JSONArray): Boolean {
        if (videos.length() == 0) {
            return true
        }
        for (index in 0 until videos.length()) {
            val video = videos.optJSONObject(index) ?: continue
            if (video.optInt("readyState") != 0 || !video.optBoolean("paused")) {
                return false
            }
        }
        return true
    }

    private fun handleExtensionPayload(
        session: GeckoSession,
        payload: JSONObject,
        source: String,
    ) {
        val pageUrl = payload.optString("pageUrl")
        val title = payload.optString("title")
        val phase = payload.optString("phase")
        val type = payload.optString("type")
        if ((type == "facebook-compat" || type == "facebook-overlay-diagnostics" || type == "facebook-cookie-allow-all-autoclick" || type == "facebook-login-modal-close" || type == "facebook-bottom-login-bar-cosmetic-hide") && !isCurrentFacebookPassiveGeneration(session, payload)) {
            return
        }
        val candidates = payload.optJSONArray("directCandidates") ?: JSONArray()
        GvLogger.i(
            "GvExt",
            "media observer message tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} type=$type phase=$phase pageUrl=$pageUrl candidateCount=${candidates.length()} source=$source"
        )
        if (type == "cvc9-live-state" && phase == "content-cvc9-consent-frame-detected") {
            scheduleCvc9ConsentFrameNativeTapBurst(session)
            return
        }
        if (type == "gbn-live-state" && phase == "content-gbn-consent-frame-detected") {
            return
        }
        if (type == "layout-evidence") {
            GvLogger.i(
                "GvLayout",
                "layout evidence viewport=${payload.optInt("viewportWidth")}x${payload.optInt("viewportHeight")} dpr=${payload.optDouble("devicePixelRatio")} heroFound=${payload.optBoolean("heroFound")} heroBgImage=${payload.optString("heroBackgroundImage")} heroBgColor=${payload.optString("heroBackgroundColor")} heroBannerFound=${payload.optBoolean("heroBannerFound")} heroBannerBg=${payload.optString("heroBannerBackgroundImage")} heroRect=${payload.optDouble("heroRectWidth")}x${payload.optDouble("heroRectHeight")} heroCopyFound=${payload.optBoolean("heroCopyFound")} heroCopyWidth=${payload.optString("heroCopyWidth")} heroCopyMaxWidth=${payload.optString("heroCopyMaxWidth")} imageCount=${payload.optInt("imageCount")} imageIncomplete=${payload.optInt("imageIncompleteCount")}"
            )
            return
        }
        if (type == "layout-hero-compat") {
            GvLogger.i(
                "GvLayout",
                "hero compat applied pageUrl=$pageUrl src=${payload.optString("heroImageSrc")}"
            )
            return
        }
        if (type == "consent-compat") {
            GvLogger.i("GvLayout", "consent compat applied pageUrl=$pageUrl")
            return
        }
        if (type == "compat-policy") {
            GvLogger.i(
                "GvLayout",
                "unified compat applied reason=normal-browsing-page pageUrl=$pageUrl trigger=${payload.optString("reason")} clicked=${payload.optBoolean("clicked")} matched=${payload.optString("matched")} noCandidatePasses=${payload.optInt("noCandidatePasses")} redirected=${payload.optBoolean("redirectedByFallback")} decision=${payload.optString("decision")} scale=${payload.optDouble("scale")}"
            )
            return
        }
        if (type == "viewport-diagnostic") {
            GvLogger.i(
                "GvLayout",
                "viewport diagnostic reason=${payload.optString("reason")} pageUrl=$pageUrl path=${payload.optString("path")} " +
                    "window=${payload.optInt("windowInnerWidth")}x${payload.optInt("windowInnerHeight")} " +
                    "outer=${payload.optInt("windowOuterWidth")}x${payload.optInt("windowOuterHeight")} " +
                    "visualViewport=${payload.optDouble("visualViewportWidth")}x${payload.optDouble("visualViewportHeight")}@${payload.optDouble("visualViewportScale")} " +
                    "dpr=${payload.optDouble("devicePixelRatio")} screen=${payload.optInt("screenWidth")}x${payload.optInt("screenHeight")} " +
                    "documentWidth=${payload.optInt("documentClientWidth")}/${payload.optInt("documentScrollWidth")} " +
                    "bodyWidth=${payload.optInt("bodyClientWidth")}/${payload.optInt("bodyScrollWidth")} " +
                    "metaViewport=${payload.optString("metaViewport")} cssCompatActive=${payload.optBoolean("cssCompatActive")} " +
                    "bodyTransform=${payload.optString("bodyComputedTransform")} tvViewportPolicyEnabled=${payload.optBoolean("tvViewportPolicyEnabled")} " +
                    "tvViewportPolicyDensity=${payload.optDouble("tvViewportPolicyDensity")} cssCompatDuringTvViewportPolicy=${payload.optBoolean("cssCompatDuringTvViewportPolicy")}"
            )
            return
        }
        if (type == "rail-diagnostic") {
            val rails = payload.optJSONArray("rails") ?: JSONArray()
            if (rails.length() == 0) {
                GvLogger.i(
                    "GvLayout",
                    "rail diagnostic reason=${payload.optString("reason")} pageUrl=$pageUrl path=${payload.optString("path")} railCount=0"
                )
                return
            }
            val limit = minOf(rails.length(), 40)
            for (index in 0 until limit) {
                val rail = rails.optJSONObject(index) ?: continue
                GvLogger.i(
                    "GvLayout",
                    "rail diagnostic reason=${payload.optString("reason")} pageUrl=$pageUrl path=${payload.optString("path")} " +
                        "index=${rail.optInt("index")} class=${rail.optString("className").take(140)} rect=${rail.optString("rect")} " +
                        "overflow=${rail.optString("overflowX")}/${rail.optString("overflowY")} " +
                        "width=${rail.optInt("clientWidth")}/${rail.optInt("scrollWidth")} scrollLeft=${rail.optInt("scrollLeft")} " +
                        "hasHorizontalOverflow=${rail.optBoolean("hasHorizontalOverflow")} " +
                        "scrollbarWidth=${rail.optString("scrollbarWidth")} scrollbarColor=${rail.optString("scrollbarColor").take(120)} " +
                        "visibleItems=${rail.optInt("firstVisibleIndex")}-${rail.optInt("lastVisibleIndex")}/${rail.optInt("visibleItemCount")}"
                )
            }
            return
        }
        if (type == "kulchaflo-rail-hover-scroll") {
            GvLogger.i(
                "GvInput",
                "kulchaflo rail hover scroll result pageUrl=$pageUrl handled=${payload.optBoolean("handled")} amount=${payload.optInt("amount")} " +
                    "pointer=${payload.optInt("pointerX")},${payload.optInt("pointerY")} rawPointer=${payload.optInt("rawPointerX")},${payload.optInt("rawPointerY")} overshootX=${payload.optDouble("overshootX")} " +
                    "viewport=${payload.optInt("viewportWidth")}x${payload.optInt("viewportHeight")} view=${payload.optInt("viewWidth")}x${payload.optInt("viewHeight")} " +
                    "rail=${payload.optString("rail")} rect=${payload.optString("railRect")} " +
                    "before=${payload.optDouble("before")} after=${payload.optDouble("after")} point=${payload.optString("point")}"
            )
            return
        }
        if (type == "kulchaflo-site-focus") {
            GvLogger.i(
                "GvInput",
                "kulchaflo site focus result phase=${payload.optString("phase")} action=${payload.optString("action")} mode=${payload.optString("mode")} count=${payload.optInt("count")} target=${payload.optString("target")} pageUrl=$pageUrl beforeY=${payload.optDouble("beforeY")} beforeX=${payload.optDouble("beforeX")} amount=${payload.optInt("amount")} error=${payload.optString("error")}"
            )
            return
        }
        if (type == "dpad-document-scroll-fallback") {
            GvLogger.i(
                "GvInput",
                "dpad document scroll fallback result keyCode=${payload.optInt("keyCode")} direction=${payload.optString("direction")} " +
                    "pageUrl=$pageUrl pointer=${payload.optInt("pointerX")},${payload.optInt("pointerY")} " +
                    "amount=${payload.optInt("amount")} skippedReason=${payload.optString("skippedReason").ifBlank { "none" }} " +
                    "beforeY=${payload.optDouble("beforeY")} afterY=${payload.optDouble("afterY")} deltaY=${payload.optDouble("deltaY")} " +
                    "active=${payload.optString("activeElement")} point=${payload.optString("pointElement")} viewportHeight=${payload.optInt("viewportHeight")}"
            )
            return
        }
        if (type == "cvm-vimeo-diagnostic") {
            val iframes = payload.optJSONArray("iframes") ?: JSONArray()
            val iframeSummary = buildString {
                val limit = minOf(iframes.length(), 6)
                for (index in 0 until limit) {
                    val frame = iframes.optJSONObject(index) ?: continue
                    if (isNotEmpty()) append(" | ")
                    append("#").append(index + 1)
                    append(":src=").append(frame.optString("src"))
                    append(" rect=").append(frame.optString("rect"))
                    append(" visible=").append(frame.optBoolean("visible"))
                    append(" sameOrigin=").append(frame.optBoolean("sameOriginAccessible"))
                }
            }.ifBlank { "none" }
            val videos = payload.optJSONArray("videos") ?: JSONArray()
            val videoSummary = buildString {
                val limit = minOf(videos.length(), 4)
                for (index in 0 until limit) {
                    val video = videos.optJSONObject(index) ?: continue
                    if (isNotEmpty()) append(" | ")
                    append("#").append(index + 1)
                    append(":paused=").append(video.optBoolean("paused"))
                    append(":ready=").append(video.optInt("readyState"))
                    append(":time=").append(video.optDouble("currentTime"))
                    append(":size=").append(video.optInt("videoWidth")).append("x").append(video.optInt("videoHeight"))
                    append(":muted=").append(video.optBoolean("muted"))
                    append(":controls=").append(video.optBoolean("controls"))
                }
            }.ifBlank { "none" }
            val playCandidates = payload.optJSONArray("playButtonCandidates") ?: JSONArray()
            val playSummary = buildString {
                val limit = minOf(playCandidates.length(), 6)
                for (index in 0 until limit) {
                    val candidate = playCandidates.optJSONObject(index) ?: continue
                    if (isNotEmpty()) append(" | ")
                    append("#").append(index + 1)
                    append(":").append(candidate.optString("text"))
                    append("@").append(candidate.optString("rect"))
                }
            }.ifBlank { "none" }
            val userActivation = payload.optJSONObject("userActivation")
            GvLogger.i(
                "GvMedia",
                "cvm vimeo diagnostic phase=${payload.optString("phase")} pageUrl=$pageUrl pointer=${payload.optInt("pointerX")},${payload.optInt("pointerY")} " +
                    "hasFocus=${payload.optBoolean("documentHasFocus")} active=${payload.optString("activeElement")} " +
                    "userActivationActive=${userActivation?.optBoolean("isActive") ?: false} userActivationEver=${userActivation?.optBoolean("hasBeenActive") ?: false} " +
                    "point=${payload.optString("elementFromPoint")} pointIsIframe=${payload.optBoolean("elementFromPointIsIframe")} " +
                    "iframeCount=${payload.optInt("iframeCount")} vimeoRect=${payload.optString("vimeoIframeRect")} vimeoVisible=${payload.optBoolean("vimeoIframeVisible")} " +
                    "videoCount=${payload.optInt("videoCount")} videos=$videoSummary playCandidates=$playSummary " +
                    "iframes=$iframeSummary mediaSession=${browserMediaController.describeSessionState(session)} error=${payload.optString("error")}"
            )
            return
        }
        if (type == "cbn-virgin-islands-state") {
            val layoutApplied = payload.optBoolean("layoutApplied")
            val playbackActive = payload.optBoolean("playbackActive")
            val requestPointerSleep = payload.optBoolean("requestPointerSleep")
            GvLogger.i(
                "GvMedia",
                "cbn virgin islands state layoutApplied=$layoutApplied playbackActive=$playbackActive requestPointerSleep=$requestPointerSleep pageUrl=$pageUrl"
            )
            if (playbackActive) {
                cbnVirginIslandsAutostartTapRunnableBySession.remove(session)?.let(pointerHandler::removeCallbacks)
                cbnVirginIslandsAutostartTapCountBySession.remove(session)
            } else if (layoutApplied) {
                scheduleCbnVirginIslandsAutostartTap(session, pageUrl)
            }
            if (requestPointerSleep || layoutApplied || playbackActive) {
                enterBrowserFullscreenPointerSleep(reason = "cbn-player-first")
            }
            return
        }
        if (type == "cnc3-live-state") {
            val layoutApplied = payload.optBoolean("layoutApplied")
            val playbackActive = payload.optBoolean("playbackActive")
            GvLogger.i(
                "GvMedia",
                "cnc3 live state layoutApplied=$layoutApplied playbackActive=$playbackActive pageUrl=$pageUrl"
            )
            if (playbackActive) {
                cnc3AutostartTapRunnableBySession.remove(session)?.let(pointerHandler::removeCallbacks)
                cnc3AutostartAttemptedBySession.add(session)
            } else if (layoutApplied) {
                maybeScheduleCnc3AutostartTap(session, pageUrl, delayMs = 120L)
            }
            if (layoutApplied || playbackActive) {
                enterBrowserFullscreenPointerSleep(reason = "cnc3-player-first")
            }
            return
        }
        if (type == "gbn-live-state") {
            val playerFirstApplied = phase == "content-gbn-player-first-applied"
            GvLogger.i(
                "GvMedia",
                "gbn live state phase=$phase playerFirstApplied=$playerFirstApplied pageUrl=$pageUrl"
            )
            if (playerFirstApplied) {
                enterBrowserFullscreenPointerSleep(reason = "gbn-player-first")
            }
            return
        }
        if (type == "ttt-consent-autoclick") {
            GvLogger.i(
                "GvLayout",
                "ttt consent autoclick result clicked=${payload.optBoolean("clicked")} reason=${payload.optString("reason")} phase=${payload.optString("phase")} pageUrl=$pageUrl dialogRect=${payload.optString("dialogRect")} buttonRect=${payload.optString("buttonRect")} buttonText=${payload.optString("buttonText")} dialogText=${payload.optString("dialogText").take(180)}"
            )
            return
        }
        if (type == "ttt-tego-play-assist") {
            val active = payload.optBoolean("active")
            val requiresUserAction = payload.optBoolean("requiresUserAction", false)
            if (active) {
                tttTegoPlayAssistBySession[session] = TttTegoPlayAssistState(
                    active = true,
                    requiresUserAction = requiresUserAction,
                    centerX = payload.optDouble("centerX", -1.0).toFloat(),
                    centerY = payload.optDouble("centerY", -1.0).toFloat(),
                    targetKind = payload.optString("targetKind"),
                    readyState = payload.optInt("readyState"),
                    paused = payload.optBoolean("paused", true),
                    reason = payload.optString("reason"),
                )
            } else {
                tttTegoPlayAssistBySession.remove(session)
            }
            GvLogger.i(
                "GvMedia",
                "ttt tego play assist active=$active requiresUserAction=$requiresUserAction reason=${payload.optString("reason")} pageUrl=$pageUrl rect=${payload.optString("rect")} " +
                    "targetKind=${payload.optString("targetKind")} target=${payload.optString("targetSummary")} " +
                    "center=${payload.optInt("centerX")},${payload.optInt("centerY")} ready=${payload.optInt("readyState")} paused=${payload.optBoolean("paused")} " +
                    "size=${payload.optInt("videoWidth")}x${payload.optInt("videoHeight")}"
            )
            if (!active) {
                tttTegoStartupNativeTapCountBySession.remove(session)
            }
            return
        }
        if (type == "ttt-tego-transport-reveal") {
            GvLogger.i(
                "GvMedia",
                "ttt tego transport reveal phase=${payload.optString("phase")} pageUrl=$pageUrl reason=${payload.optString("reason")} " +
                    "handled=${payload.optBoolean("handled")} visibleBefore=${payload.optBoolean("controlBarVisibleBefore")} visibleAfter=${payload.optBoolean("controlBarVisibleAfter")} " +
                    "target=${payload.optString("target")} rect=${payload.optString("rect")} hiddenState=${payload.optBoolean("hiddenState")} " +
                    "containerClass=${payload.optString("containerClassList")}"
            )
            return
        }
        if (type == "ttt-tego-startup-state") {
            GvLogger.i(
                "GvMedia",
                "ttt tego startup state phase=${payload.optString("phase")} pageUrl=$pageUrl attemptAtMs=${payload.optLong("attemptAtMs")} " +
                    "state=${payload.optString("state")} applied=${payload.optBoolean("applied")} playable=${payload.optBoolean("playable")} " +
                    "playbackProgressed=${payload.optBoolean("playbackProgressed")} missingHlsLevels=${payload.optBoolean("missingHlsLevels")} " +
                    "readyZeroPaused=${payload.optBoolean("readyZeroPaused")} wakeAttempted=${payload.optBoolean("wakeAttempted")} " +
                    "wakeSkippedReason=${payload.optString("wakeSkippedReason")} videos=${payload.optString("videoSummary").ifBlank { "none" }}"
            )
            return
        }
        if (type == "kulchaflo-cookie-consent-autoclick") {
            val clicked = payload.optBoolean("clicked")
            val resultReason = payload.optString("reason")
            GvLogger.i(
                "GvLayout",
                "kulchaflo cookie consent autoclick result clicked=$clicked reason=$resultReason phase=${payload.optString("phase")} pageUrl=$pageUrl panelRect=${payload.optString("panelRect")} buttonRect=${payload.optString("buttonRect")} buttonText=${payload.optString("buttonText")} panelText=${payload.optString("panelText").take(180)}"
            )
            return
        }
        maybeLogLiveLoadTimingFromPayload(session, payload)
        if (type == "tego-quality") {
            val results = payload.optJSONArray("results") ?: JSONArray()
            val resultSummary = buildString {
                val limit = minOf(results.length(), 5)
                for (index in 0 until limit) {
                    val result = results.optJSONObject(index) ?: continue
                    if (isNotEmpty()) append(" | ")
                    append(result.optString("source"))
                    append(":applied=").append(result.optBoolean("applied"))
                    append(":selected=").append(result.optInt("selectedHeight"))
                    val bitrate = result.optInt("selectedBitrate")
                    if (bitrate > 0) append(":bitrate=").append(bitrate)
                    val reasonValue = result.optString("reason")
                    if (reasonValue.isNotBlank()) append(":reason=").append(reasonValue)
                }
            }
            val videos = payload.optJSONArray("videos") ?: JSONArray()
            val videoSummary = buildString {
                val limit = minOf(videos.length(), 4)
                for (index in 0 until limit) {
                    val video = videos.optJSONObject(index) ?: continue
                    if (isNotEmpty()) append(" | ")
                    append("#").append(index + 1)
                    append(":").append(video.optInt("videoWidth"))
                    append("x").append(video.optInt("videoHeight"))
                    append(":ready=").append(video.optInt("readyState"))
                    append(":paused=").append(video.optBoolean("paused"))
                }
            }
            GvLogger.i(
                "GvMedia",
                "tego quality pageUrl=$pageUrl applied=${payload.optBoolean("applied")} playerCount=${payload.optInt("playerCount")} results=${resultSummary.ifBlank { "none" }} videos=${videoSummary.ifBlank { "none" }}"
            )
            if (isTttTegoContextUrl(pageUrl) && hasPlayingTegoVideo(videos)) {
                tttTegoStartupNativeTapCountBySession.remove(session)
                if (tttTegoPlayAssistBySession.remove(session) != null) {
                    GvLogger.i("GvMedia", "ttt tego play assist active=false reason=playback-started pageUrl=$pageUrl")
                }
            }
            return
        }
        if (type == "tego-startup-reprobe") {
            val results = payload.optJSONArray("results") ?: JSONArray()
            val resultSummary = buildString {
                val limit = minOf(results.length(), 3)
                for (index in 0 until limit) {
                    val result = results.optJSONObject(index) ?: continue
                    if (isNotEmpty()) append(" | ")
                    append(result.optString("source"))
                    append(":applied=").append(result.optBoolean("applied"))
                    val selected = result.optInt("selectedHeight")
                    if (selected > 0) append(":selected=").append(selected)
                    val reasonValue = result.optString("reason")
                    if (reasonValue.isNotBlank()) append(":reason=").append(reasonValue)
                }
            }.ifBlank { "none" }
            val videos = payload.optJSONArray("videos") ?: JSONArray()
            val videoSummary = summarizeTegoVideosForTiming(videos)
            GvLogger.i(
                "GvMedia",
                "abs tego startup reprobe result pageUrl=$pageUrl attemptAtMs=${payload.optLong("attemptAtMs")} " +
                    "applied=${payload.optBoolean("applied")} playable=${payload.optBoolean("playable")} playbackProgressed=${payload.optBoolean("playbackProgressed")} " +
                    "missingHlsLevels=${payload.optBoolean("missingHlsLevels")} readyZeroPaused=${payload.optBoolean("readyZeroPaused")} " +
                    "results=$resultSummary videos=$videoSummary"
            )
            if (isTttTegoContextUrl(pageUrl) && hasPlayingTegoVideo(videos)) {
                tttTegoStartupNativeTapCountBySession.remove(session)
                if (tttTegoPlayAssistBySession.remove(session) != null) {
                    GvLogger.i("GvMedia", "ttt tego play assist active=false reason=playback-started pageUrl=$pageUrl")
                }
            }
            val liveState = liveLoadTimingBySession[session]
            val probeState = absTegoStartupReprobeBySession[session]
            if (liveState != null && probeState != null && liveState.surface == "abs-live" && isAbsTegoChannel10PlayerUrl(pageUrl)) {
                probeState.latestPageUrl = pageUrl
                probeState.latestApplied = payload.optBoolean("applied")
                probeState.latestPlayable = payload.optBoolean("playable") || liveState.playableVideoLogged
                probeState.latestPlaybackProgressed = payload.optBoolean("playbackProgressed")
                probeState.latestMissingHlsLevels = payload.optBoolean("missingHlsLevels")
                probeState.latestReadyZeroPaused = payload.optBoolean("readyZeroPaused")
                if (!probeState.completed && !shouldContinueAbsTegoStartupReprobe(session, liveState, probeState)) {
                    probeState.completionReason = resolveAbsTegoStartupReprobeCompletionReason(session, liveState, probeState)
                    probeState.completed = true
                    GvLogger.i(
                        "GvMedia",
                        "abs tego startup reprobe stop generation=${probeState.generation} reason=${probeState.completionReason} " +
                            "applied=${probeState.latestApplied} playable=${probeState.latestPlayable} playbackProgressed=${probeState.latestPlaybackProgressed} missingHls=${probeState.latestMissingHlsLevels} " +
                            "readyZeroPaused=${probeState.latestReadyZeroPaused} mediaSession=${browserMediaController.describeSessionState(session)} pageUrl=$pageUrl"
                    )
                    maybeDispatchAbsTegoNativeFKey(session, probeState, trigger = "startup-reprobe-stop")
                }
            }
            return
        }
        if (type == "tego-startup-wake") {
            val methods = payload.optJSONArray("methods") ?: JSONArray()
            val methodSummary = buildString {
                val limit = minOf(methods.length(), 8)
                for (index in 0 until limit) {
                    if (isNotEmpty()) append("|")
                    append(methods.optString(index))
                }
            }.ifBlank { "none" }
            GvLogger.i(
                "GvMedia",
                "abs tego startup wake pageUrl=$pageUrl attemptAtMs=${payload.optLong("attemptAtMs")} " +
                    "playCalls=${payload.optInt("playCalls")} clickedPlay=${payload.optBoolean("clickedPlay")} " +
                    "wakeErrors=${payload.optInt("wakeErrors")} methods=$methodSummary"
            )
            return
        }
        if (type == "tego-startup-fullscreen") {
            val methods = payload.optJSONArray("methods") ?: JSONArray()
            val methodSummary = buildString {
                val limit = minOf(methods.length(), 8)
                for (index in 0 until limit) {
                    if (isNotEmpty()) append("|")
                    append(methods.optString(index))
                }
            }.ifBlank { "none" }
            GvLogger.i(
                "GvMedia",
                "abs tego startup fullscreen phase=${payload.optString("phase")} pageUrl=$pageUrl attemptAtMs=${payload.optLong("attemptAtMs")} " +
                    "playable=${payload.optBoolean("playable")} playbackProgressed=${payload.optBoolean("playbackProgressed")} applied=${payload.optBoolean("applied")} " +
                    "clickedFullscreen=${payload.optBoolean("clickedFullscreen")} requestedFullscreen=${payload.optBoolean("requestedFullscreen")} " +
                    "fullscreenActive=${payload.optBoolean("fullscreenActive")} fullscreenElement=${payload.optString("fullscreenElement")} " +
                    "fullscreenLikeApplied=${payload.optBoolean("fullscreenLikeApplied")} fullscreenLikeTarget=${payload.optString("fullscreenLikeTarget")} " +
                    "errors=${payload.optInt("errors")} methods=$methodSummary"
            )
            return
        }
        if (type == "abs-tego-fullscreen-control-click") {
            val methods = payload.optJSONArray("methods") ?: JSONArray()
            val methodSummary = buildString {
                val limit = minOf(methods.length(), 10)
                for (index in 0 until limit) {
                    if (isNotEmpty()) append("|")
                    append(methods.optString(index))
                }
            }.ifBlank { "none" }
            GvLogger.i(
                "GvMedia",
                "abs tego fullscreen control click phase=${payload.optString("phase")} pageUrl=$pageUrl attemptAtMs=${payload.optLong("attemptAtMs")} " +
                    "found=${payload.optBoolean("found")} controlSummary=${payload.optString("controlSummary")} rect=${payload.optString("rect")} " +
                    "center=${payload.optInt("centerX")},${payload.optInt("centerY")} " +
                    "clicked=${payload.optBoolean("clicked")} fullscreenBefore=${payload.optBoolean("fullscreenActiveBefore")} " +
                    "fullscreenAfter=${payload.optBoolean("fullscreenActiveAfter")} fullscreenElementAfter=${payload.optString("fullscreenElementAfter")} " +
                    "errors=${payload.optInt("errors")} methods=$methodSummary"
            )
            return
        }
        if (type == "abs-tego-fullscreen-preflight") {
            val style = payload.optJSONObject("buttonStyle")
            val userActivation = payload.optJSONObject("userActivation")
            GvLogger.i(
                "GvMedia",
                "abs tego fullscreen preflight path=${payload.optString("path")} phase=${payload.optString("phase")} pageUrl=$pageUrl attemptAtMs=${payload.optLong("attemptAtMs")} " +
                    "focus=${payload.optBoolean("documentHasFocus")} active=${payload.optString("activeElement")} " +
                    "button=${payload.optString("buttonSummary")} rect=${payload.optString("buttonRect")} " +
                    "style=display:${style?.optString("display")} visibility:${style?.optString("visibility")} opacity:${style?.optString("opacity")} pointer:${style?.optString("pointerEvents")} z:${style?.optString("zIndex")} " +
                    "point=${payload.optString("elementFromPoint")} pointMatches=${payload.optBoolean("elementFromPointMatchesButton")} " +
                    "containerClass=${payload.optString("containerClassList")} controlBarVisible=${payload.optBoolean("controlBarVisible")} " +
                    "fullscreen=${payload.optBoolean("fullscreenActive")} fullscreenElement=${payload.optString("fullscreenElement")} " +
                    "userActivation=isActive:${userActivation?.optBoolean("isActive")} hasBeenActive:${userActivation?.optBoolean("hasBeenActive")} available:${userActivation?.optBoolean("available")}"
            )
            return
        }
        if (type == "abs-tego-fullscreen-button-event") {
            val userActivation = payload.optJSONObject("userActivation")
            GvLogger.i(
                "GvMedia",
                "abs tego fullscreen button event path=${payload.optString("path")} event=${payload.optString("eventType")} trusted=${payload.optBoolean("isTrusted")} pageUrl=$pageUrl " +
                    "target=${payload.optString("target")} currentTarget=${payload.optString("currentTarget")} active=${payload.optString("activeElement")} " +
                    "button=${payload.optString("buttonSummary")} rect=${payload.optString("buttonRect")} center=${payload.optInt("buttonCenterX")},${payload.optInt("buttonCenterY")} " +
                    "fullscreen=${payload.optBoolean("fullscreenActive")} fullscreenElement=${payload.optString("fullscreenElement")} " +
                    "userActivation=isActive:${userActivation?.optBoolean("isActive")} hasBeenActive:${userActivation?.optBoolean("hasBeenActive")}"
            )
            return
        }
        if (type == "abs-tego-fullscreen-transition") {
            val userActivation = payload.optJSONObject("userActivation")
            val marker = if (payload.optString("path") == "manual") {
                "abs tego fullscreen manual transition"
            } else {
                "abs tego fullscreen automated transition"
            }
            GvLogger.i(
                "GvMedia",
                "$marker trigger=${payload.optString("trigger")} phase=${payload.optString("phase")} pageUrl=$pageUrl attemptAtMs=${payload.optLong("attemptAtMs")} " +
                    "focus=${payload.optBoolean("documentHasFocus")} active=${payload.optString("activeElement")} " +
                    "fullscreen=${payload.optBoolean("fullscreenActive")} fullscreenElement=${payload.optString("fullscreenElement")} " +
                    "userActivation=isActive:${userActivation?.optBoolean("isActive")} hasBeenActive:${userActivation?.optBoolean("hasBeenActive")}"
            )
            return
        }
        if (type == "abs-tego-fullscreen-gate-skip") {
            val style = payload.optJSONObject("buttonStyle")
            GvLogger.i(
                "GvMedia",
                "abs tego fullscreen gate skip phase=${payload.optString("phase")} pageUrl=$pageUrl attemptAtMs=${payload.optLong("attemptAtMs")} " +
                    "reason=${payload.optString("reason")} controlSummary=${payload.optString("controlSummary")} rect=${payload.optString("rect")} " +
                    "center=${payload.optInt("centerX")},${payload.optInt("centerY")} controlBarVisible=${payload.optBoolean("controlBarVisible")} " +
                    "style=display:${style?.optString("display")} visibility:${style?.optString("visibility")} pointer:${style?.optString("pointerEvents")} opacity:${style?.optString("opacity")} z:${style?.optString("zIndex")} " +
                    "point=${payload.optString("elementFromPoint")} pointMatches=${payload.optBoolean("pointMatches")} " +
                    "playbackProgressed=${payload.optBoolean("playbackProgressed")} stableVideo=${payload.optBoolean("stableVideo")} containerClass=${payload.optString("containerClassList")}"
            )
            return
        }
        if (type == "abs-tego-fullscreen-native-request") {
            GvLogger.i(
                "GvMedia",
                "abs tego fullscreen native request phase=${payload.optString("phase")} pageUrl=$pageUrl playerUrl=${payload.optString("playerUrl")} " +
                    "attemptAtMs=${payload.optLong("attemptAtMs")} translated=${payload.optBoolean("translated")} reason=${payload.optString("reason")} " +
                    "iframeRect=${payload.optString("iframeRect")} controlRect=${payload.optString("controlRect")} " +
                    "frameCenter=${payload.optInt("frameCenterX")},${payload.optInt("frameCenterY")} center=${payload.optInt("centerX")},${payload.optInt("centerY")} " +
                    "viewport=${payload.optInt("viewportWidth")}x${payload.optInt("viewportHeight")} dpr=${payload.optDouble("devicePixelRatio")} " +
                    "controlSummary=${payload.optString("controlSummary")}"
            )
            maybeDispatchAbsTegoFullscreenControlNativeTap(session, payload)
            return
        }
        if (type == "abs-tego-startup-native-play-request") {
            GvLogger.i(
                "GvMedia",
                "abs tego startup native play request phase=${payload.optString("phase")} pageUrl=$pageUrl playerUrl=${payload.optString("playerUrl")} " +
                    "attemptAtMs=${payload.optLong("attemptAtMs")} translated=${payload.optBoolean("translated")} reason=${payload.optString("reason")} " +
                    "iframeRect=${payload.optString("iframeRect")} controlRect=${payload.optString("controlRect")} " +
                    "frameCenter=${payload.optInt("frameCenterX")},${payload.optInt("frameCenterY")} center=${payload.optInt("centerX")},${payload.optInt("centerY")} " +
                    "viewport=${payload.optInt("viewportWidth")}x${payload.optInt("viewportHeight")} dpr=${payload.optDouble("devicePixelRatio")} " +
                    "controlSummary=${payload.optString("controlSummary")}"
            )
            if (isTttTegoPlayerUrl(payload.optString("playerUrl").ifBlank { pageUrl })) {
                maybeDispatchTttTegoStartupNativePlayTap(session, payload)
            } else {
                maybeDispatchAbsTegoFullscreenControlNativeTap(session, payload)
            }
            return
        }
        if (type == "abs-tego-fullscreen-native-hover") {
            GvLogger.i(
                "GvMedia",
                "abs tego fullscreen native hover request phase=${payload.optString("phase")} pageUrl=$pageUrl playerUrl=${payload.optString("playerUrl")} " +
                    "attemptAtMs=${payload.optLong("attemptAtMs")} translated=${payload.optBoolean("translated")} reason=${payload.optString("reason")} " +
                    "iframeRect=${payload.optString("iframeRect")} controlRect=${payload.optString("controlRect")} " +
                    "frameCenter=${payload.optInt("frameCenterX")},${payload.optInt("frameCenterY")} center=${payload.optInt("centerX")},${payload.optInt("centerY")} " +
                    "viewport=${payload.optInt("viewportWidth")}x${payload.optInt("viewportHeight")} dpr=${payload.optDouble("devicePixelRatio")} " +
                    "controlSummary=${payload.optString("controlSummary")}"
            )
            maybeDispatchAbsTegoFullscreenControlNativeHover(session, payload)
            return
        }
        if (type == "abs-tego-control-candidates") {
            val items = payload.optJSONArray("items") ?: JSONArray()
            val summary = buildString {
                val limit = minOf(items.length(), 18)
                for (index in 0 until limit) {
                    val item = items.optJSONObject(index) ?: continue
                    if (isNotEmpty()) append(" || ")
                    append("#").append(index + 1)
                    append(" tag=").append(item.optString("tag"))
                    val className = item.optString("className").replace(Regex("\\s+"), ".")
                    if (className.isNotBlank()) append(" class=").append(className.take(80))
                    val aria = item.optString("ariaLabel")
                    if (aria.isNotBlank()) append(" aria=").append(aria.take(60))
                    val title = item.optString("title")
                    if (title.isNotBlank()) append(" title=").append(title.take(60))
                    val text = item.optString("text")
                    if (text.isNotBlank()) append(" text=").append(text.take(80))
                    val rect = item.optJSONObject("rect")
                    val rectText = if (rect != null) {
                        "${rect.optInt("left")},${rect.optInt("top")} ${rect.optInt("width")}x${rect.optInt("height")}"
                    } else {
                        "0,0 0x0"
                    }
                    append(" rect=").append(rectText)
                    append(" visible=").append(item.optBoolean("visible"))
                    val pointer = item.optString("pointerEvents")
                    if (pointer.isNotBlank()) append(" pointerEvents=").append(pointer)
                }
            }.ifBlank { "none" }
            GvLogger.i(
                "GvMedia",
                "abs tego control candidates count=${payload.optInt("count", items.length())} pageUrl=$pageUrl attemptAtMs=${payload.optLong("attemptAtMs")} items=$summary"
            )
            return
        }
        if (type == "abs-tego-page-fullscreen-like") {
            if (payload.optBoolean("applied") && isAbsTegoChannel10ContextUrl(pageUrl)) {
                val profile = payload.optString("profile")
                val returnUrl = resolveTegoPlayerFirstReturnUrl(profile, pageUrl)
                if (!returnUrl.isNullOrBlank()) {
                    if (returnUrl == TTT_TEGO_RETURN_URL) {
                        tttTegoPlayerFirstReturnUrlBySession[session] = returnUrl
                        GvLogger.i(
                            "GvMedia",
                            "ttt tego player-first active pageUrl=$pageUrl reason=${payload.optString("reason")} returnUrl=$returnUrl"
                        )
                    } else {
                        absTegoPlayerFirstReturnUrlBySession[session] = returnUrl
                        GvLogger.i(
                            "GvMedia",
                            "abs tego player-first active pageUrl=$pageUrl reason=${payload.optString("reason")} returnUrl=$returnUrl"
                        )
                    }
                }
            }
            GvLogger.i(
                "GvMedia",
                "abs tego page fullscreen-like phase=${payload.optString("phase")} pageUrl=$pageUrl attemptAtMs=${payload.optLong("attemptAtMs")} " +
                    "profile=${payload.optString("profile")} applied=${payload.optBoolean("applied")} reason=${payload.optString("reason")} " +
                    "iframeRect=${payload.optString("iframeRect")} iframe=${payload.optString("iframeSummary")}"
            )
            return
        }
        if (type == "abs-tego-url-sanitized") {
            GvLogger.i(
                "GvMedia",
                "abs tego url sanitized profile=${payload.optString("profile")} context=${payload.optString("context")} pageUrl=$pageUrl before=${payload.optString("beforeUrl")} after=${payload.optString("afterUrl")}"
            )
            return
        }
        if (type == "abs-tego-page-overlay-cleanup") {
            GvLogger.i(
                "GvMedia",
                "abs tego page overlay cleanup phase=${payload.optString("phase")} pageUrl=$pageUrl attemptAtMs=${payload.optLong("attemptAtMs")} " +
                    "hiddenCount=${payload.optInt("hiddenCount")} iframeRect=${payload.optString("iframeRect")} " +
                    "hiddenSummary=${payload.optString("hiddenSummary")} hiddenRects=${payload.optString("hiddenRects")} hiddenZ=${payload.optString("hiddenZ")}"
            )
            return
        }
        if (type == "abs-tego-page-content-cleanup") {
            GvLogger.i(
                "GvMedia",
                "abs tego page content cleanup phase=${payload.optString("phase")} pageUrl=$pageUrl attemptAtMs=${payload.optLong("attemptAtMs")} " +
                    "hiddenCount=${payload.optInt("hiddenCount")} shellApplied=${payload.optBoolean("shellApplied")} " +
                    "iframeRect=${payload.optString("iframeRect")} finalIframeRect=${payload.optString("finalIframeRect")} " +
                    "pathSummary=${payload.optString("pathSummary")} prunedChildrenSummary=${payload.optString("prunedChildrenSummary")} " +
                    "hiddenSummary=${payload.optString("hiddenSummary")}"
            )
            return
        }
        if (type == "abs-tego-frame-overlay-cleanup") {
            GvLogger.i(
                "GvMedia",
                "abs tego frame overlay cleanup phase=${payload.optString("phase")} pageUrl=$pageUrl attemptAtMs=${payload.optLong("attemptAtMs")} " +
                    "hiddenCount=${payload.optInt("hiddenCount")} stableVideo=${payload.optBoolean("stableVideo")} videoRect=${payload.optString("videoRect")} " +
                    "hiddenSummary=${payload.optString("hiddenSummary")} hiddenRects=${payload.optString("hiddenRects")}"
            )
            return
        }
        if (type == "abs-tego-frame-overlay-snapshot") {
            val items = payload.optJSONArray("items") ?: JSONArray()
            val summary = buildString {
                val limit = minOf(items.length(), 14)
                for (index in 0 until limit) {
                    val item = items.optJSONObject(index) ?: continue
                    if (isNotEmpty()) append(" || ")
                    append("#").append(index + 1)
                    append(" node=").append(item.optString("node"))
                    append(" rect=").append(item.optString("rect"))
                    val z = item.optString("z")
                    if (z.isNotBlank()) append(" z=").append(z)
                    val pointer = item.optString("pointer")
                    if (pointer.isNotBlank()) append(" pointer=").append(pointer)
                    val opacity = item.optString("opacity")
                    if (opacity.isNotBlank()) append(" opacity=").append(opacity)
                }
            }.ifBlank { "none" }
            GvLogger.i(
                "GvMedia",
                "abs tego frame overlay snapshot phase=${payload.optString("phase")} pageUrl=$pageUrl attemptAtMs=${payload.optLong("attemptAtMs")} " +
                    "videoRect=${payload.optString("videoRect")} itemCount=${payload.optInt("itemCount", items.length())} items=$summary"
            )
            return
        }
        if (type == "abs-tego-post-stable-layer-dump") {
            val viewport = payload.optJSONObject("viewport")
            val samples = payload.optJSONArray("samples") ?: JSONArray()
            val overlaps = payload.optJSONArray("overlaps") ?: JSONArray()
            val sampleSummary = buildString {
                val limit = minOf(samples.length(), 7)
                for (index in 0 until limit) {
                    val item = samples.optJSONObject(index) ?: continue
                    if (isNotEmpty()) append(" || ")
                    val element = item.optJSONObject("element")
                    append(item.optString("label"))
                    append("@").append(item.optInt("x")).append(",").append(item.optInt("y"))
                    append(" node=").append(element?.optString("summary").orEmpty())
                    append(" rect=")
                    val rect = element?.optJSONObject("rect")
                    if (rect != null) {
                        append(rect.optInt("left")).append(",").append(rect.optInt("top"))
                            .append(" ").append(rect.optInt("width")).append("x").append(rect.optInt("height"))
                    } else {
                        append("0,0 0x0")
                    }
                    val z = element?.optString("zIndex").orEmpty()
                    if (z.isNotBlank()) append(" z=").append(z)
                    val pointer = element?.optString("pointerEvents").orEmpty()
                    if (pointer.isNotBlank()) append(" pointer=").append(pointer)
                    val text = element?.optString("text").orEmpty()
                    if (text.isNotBlank()) append(" text=").append(text.take(60))
                    val chain = item.optJSONArray("parentChain") ?: JSONArray()
                    if (chain.length() > 0) {
                        append(" chain=")
                        val chainLimit = minOf(chain.length(), 3)
                        for (c in 0 until chainLimit) {
                            val p = chain.optJSONObject(c) ?: continue
                            if (c > 0) append(">")
                            append(p.optString("summary"))
                        }
                    }
                }
            }.ifBlank { "none" }
            val overlapSummary = buildString {
                val limit = minOf(overlaps.length(), 12)
                for (index in 0 until limit) {
                    val item = overlaps.optJSONObject(index) ?: continue
                    if (isNotEmpty()) append(" || ")
                    append("#").append(index + 1)
                    append(" ").append(item.optString("summary"))
                    val rect = item.optJSONObject("rect")
                    append(" rect=")
                    if (rect != null) {
                        append(rect.optInt("left")).append(",").append(rect.optInt("top"))
                            .append(" ").append(rect.optInt("width")).append("x").append(rect.optInt("height"))
                    } else {
                        append("0,0 0x0")
                    }
                    val z = item.optString("zIndex")
                    if (z.isNotBlank()) append(" z=").append(z)
                    val pos = item.optString("position")
                    if (pos.isNotBlank()) append(" pos=").append(pos)
                    val pointer = item.optString("pointerEvents")
                    if (pointer.isNotBlank()) append(" pointer=").append(pointer)
                    val text = item.optString("text")
                    if (text.isNotBlank()) append(" text=").append(text.take(56))
                }
            }.ifBlank { "none" }
            GvLogger.i(
                "GvMedia",
                "abs tego post stable layer dump phase=${payload.optString("phase")} pageUrl=$pageUrl reason=${payload.optString("reason")} " +
                    "viewport=${viewport?.optInt("width")}x${viewport?.optInt("height")} videoRect=${payload.optJSONObject("videoRect")} " +
                    "sampleCount=${payload.optInt("sampleCount", samples.length())} samples=$sampleSummary " +
                    "overlapCount=${payload.optInt("overlapCount", overlaps.length())} overlaps=$overlapSummary"
            )
            return
        }
        if (type == "abs-tego-chrome-autohide") {
            GvLogger.i(
                "GvMedia",
                "abs tego chrome autohide phase=${payload.optString("phase")} pageUrl=$pageUrl event=${payload.optString("event")} hidden=${payload.optBoolean("hidden")} reason=${payload.optString("reason")}"
            )
            return
        }
        if (type == "abs-tego-player-first-active") {
            if (payload.optBoolean("applied") && isAbsTegoChannel10ContextUrl(pageUrl)) {
                val profile = payload.optString("profile")
                val returnUrl = resolveTegoPlayerFirstReturnUrl(profile, pageUrl)
                if (!returnUrl.isNullOrBlank()) {
                    if (returnUrl == TTT_TEGO_RETURN_URL) {
                        tttTegoPlayerFirstReturnUrlBySession[session] = returnUrl
                        GvLogger.i(
                            "GvMedia",
                            "ttt tego player-first active pageUrl=$pageUrl playerUrl=${payload.optString("playerUrl")} reason=${payload.optString("reason")} returnUrl=$returnUrl"
                        )
                    } else {
                        absTegoPlayerFirstReturnUrlBySession[session] = returnUrl
                        GvLogger.i(
                            "GvMedia",
                            "abs tego player-first active pageUrl=$pageUrl playerUrl=${payload.optString("playerUrl")} reason=${payload.optString("reason")} returnUrl=$returnUrl"
                        )
                    }
                }
            }
            return
        }
        if (type == "novus-telearuba-profile-active") {
            GvLogger.i(
                "GvMedia",
                "novus telearuba profile active pageUrl=$pageUrl desiredChannel=${payload.optString("desiredChannel")} returnUrl=${payload.optString("returnUrl")} reason=${payload.optString("reason")}"
            )
            return
        }
        if (type == "novus-telearuba-channel-select") {
            GvLogger.i(
                "GvMedia",
                "novus telearuba channel select pageUrl=$pageUrl desiredChannel=${payload.optString("desiredChannel")} clicked=${payload.optBoolean("clicked")} reason=${payload.optString("reason")} control=${payload.optString("controlSummary")} rect=${payload.optString("rect")} attemptAtMs=${payload.optLong("attemptAtMs")}"
            )
            return
        }
        if (type == "novus-telearuba-startup-state") {
            GvLogger.i(
                "GvMedia",
                "novus telearuba startup state pageUrl=$pageUrl desiredChannel=${payload.optString("desiredChannel")} state=${payload.optString("state")} " +
                    "hasVideo=${payload.optBoolean("hasVideo")} hasVisualTarget=${payload.optBoolean("hasVisualTarget")} " +
                    "mediaPresent=${payload.optBoolean("mediaPresent")} playable=${payload.optBoolean("playable")} playing=${payload.optBoolean("playing")} paused=${payload.optBoolean("paused")} " +
                    "readyState=${payload.optInt("readyState")} currentTime=${payload.optDouble("currentTime")} delta=${payload.optDouble("currentTimeDelta")} " +
                    "size=${payload.optInt("videoWidth")}x${payload.optInt("videoHeight")} rect=${payload.optString("videoRect")} " +
                    "muted=${payload.optBoolean("muted")} volume=${payload.optDouble("volume")} " +
                    "playAttempted=${payload.optBoolean("playAttempted")} playResolved=${payload.optBoolean("playResolved")} playRejected=${payload.optBoolean("playRejected")} playError=${payload.optString("playError")} " +
                    "mutedBefore=${payload.optBoolean("mutedBefore")} mutedAfter=${payload.optBoolean("mutedAfter")} volumeBefore=${payload.optDouble("volumeBefore")} volumeAfter=${payload.optDouble("volumeAfter")} " +
                    "attemptCount=${payload.optInt("autoplayAttemptCount")} attemptAtMs=${payload.optLong("attemptAtMs")} visualTarget=${payload.optString("visualTargetSummary")} visualTargetRect=${payload.optString("visualTargetRect")}"
            )
            return
        }
        if (type == "novus-telearuba-play-assist") {
            val active = payload.optBoolean("active")
            val requiresUserAction = payload.optBoolean("requiresUserAction", false)
            if (active) {
                novusTelearubaPlayAssistBySession[session] = NovusTelearubaPlayAssistState(
                    active = true,
                    requiresUserAction = requiresUserAction,
                    desiredChannel = payload.optString("desiredChannel"),
                    returnUrl = payload.optString("returnUrl"),
                    centerX = payload.optDouble("centerX", -1.0).toFloat(),
                    centerY = payload.optDouble("centerY", -1.0).toFloat(),
                    reason = payload.optString("reason"),
                )
            } else {
                novusTelearubaPlayAssistBySession.remove(session)
            }
            GvLogger.i(
                "GvMedia",
                "novus telearuba play assist active=$active requiresUserAction=$requiresUserAction desiredChannel=${payload.optString("desiredChannel")} " +
                    "reason=${payload.optString("reason")} pageUrl=$pageUrl center=${payload.optInt("centerX")},${payload.optInt("centerY")} " +
                    "rect=${payload.optString("rect")} targetKind=${payload.optString("targetKind")} target=${payload.optString("targetSummary")} " +
                    "paused=${payload.optBoolean("paused")} readyState=${payload.optInt("readyState")} muted=${payload.optBoolean("muted")} volume=${payload.optDouble("volume")} playError=${payload.optString("playError")}"
            )
            return
        }
        if (type == "novus-telearuba-playable-video") {
            GvLogger.i(
                "GvMedia",
                "novus telearuba playable-video pageUrl=$pageUrl desiredChannel=${payload.optString("desiredChannel")} mediaPresent=${payload.optBoolean("mediaPresent")} playable=${payload.optBoolean("playable")} playing=${payload.optBoolean("playing")} paused=${payload.optBoolean("paused")} muted=${payload.optBoolean("muted")} volume=${payload.optDouble("volume")} readyState=${payload.optInt("readyState")} currentTime=${payload.optDouble("currentTime")} rect=${payload.optString("videoRect")} size=${payload.optInt("videoWidth")}x${payload.optInt("videoHeight")} playAttempted=${payload.optBoolean("playAttempted")} playResolved=${payload.optBoolean("playResolved")} playRejected=${payload.optBoolean("playRejected")} playError=${payload.optString("playError")} mutedBefore=${payload.optBoolean("mutedBefore")} mutedAfter=${payload.optBoolean("mutedAfter")} volumeBefore=${payload.optDouble("volumeBefore")} volumeAfter=${payload.optDouble("volumeAfter")} attemptAtMs=${payload.optLong("attemptAtMs")}"
            )
            return
        }
        if (type == "novus-telearuba-player-first-active") {
            val desiredChannel = payload.optString("desiredChannel").ifBlank { "unknown" }
            val returnUrl = payload.optString("returnUrl")
            if (payload.optBoolean("applied") && !returnUrl.isNullOrBlank()) {
                novusTelearubaPlayerFirstReturnUrlBySession[session] = returnUrl
                GvLogger.i(
                    "GvMedia",
                    "novus telearuba player-first active pageUrl=$pageUrl desiredChannel=$desiredChannel returnUrl=$returnUrl reason=${payload.optString("reason")}"
                )
            }
            return
        }
        if (type == "novus-telearuba-page-cleanup") {
            GvLogger.i(
                "GvMedia",
                "novus telearuba page cleanup pageUrl=$pageUrl desiredChannel=${payload.optString("desiredChannel")} hiddenCount=${payload.optInt("hiddenCount")} reason=${payload.optString("reason")} target=${payload.optString("targetSummary")} targetRect=${payload.optString("targetRect")}"
            )
            return
        }
        if (type == "facebook-overlay-diagnostics") {
            logFacebookOverlayDiagnostics(payload)
            return
        }
        if (type == "facebook-cookie-allow-all-autoclick") {
            if (payload.optString("reason") == "scan") {
                GvLogger.i(
                    "GvLayout",
                    "facebook cookie allow-all autoclick scan phase=${payload.optString("phase")} generation=${payload.optInt("passiveGeneration")} attempt=${payload.optInt("passiveAttempt")}/${payload.optInt("passiveMaxAttempts")} pageUrl=$pageUrl"
                )
            }
            GvLogger.i(
                "GvLayout",
                "facebook cookie allow-all autoclick result clicked=${payload.optBoolean("clicked")} reason=${payload.optString("reason")} phase=${payload.optString("phase")} generation=${payload.optInt("passiveGeneration")} attempt=${payload.optInt("passiveAttempt")}/${payload.optInt("passiveMaxAttempts")} buttonText=${payload.optString("buttonText")} dialogRect=${payload.optString("dialogRect")} buttonRect=${payload.optString("buttonRect")} pageUrl=$pageUrl"
            )
            return
        }
        if (type == "facebook-login-modal-close") {
            if (payload.optString("reason") == "scheduled") {
                GvLogger.i(
                    "GvLayout",
                    "facebook login modal close scheduled modalVariant=${payload.optString("modalVariant")} phase=${payload.optString("phase")} generation=${payload.optInt("passiveGeneration")} attempt=${payload.optInt("passiveAttempt")}/${payload.optInt("passiveMaxAttempts")} primaryVideoAttached=${payload.optBoolean("primaryVideoAttached")} pageUrl=$pageUrl"
                )
                return
            }
            GvLogger.i(
                "GvLayout",
                "facebook login modal close result clicked=${payload.optBoolean("clicked")} reason=${payload.optString("reason")} modalVariant=${payload.optString("modalVariant")} phase=${payload.optString("phase")} generation=${payload.optInt("passiveGeneration")} attempt=${payload.optInt("passiveAttempt")}/${payload.optInt("passiveMaxAttempts")} modalRect=${payload.optString("modalRect")} closeButtonRect=${payload.optString("closeButtonRect")} buttonText=${payload.optString("buttonText")} primaryVideoAttached=${payload.optBoolean("primaryVideoAttached")} pageUrl=$pageUrl"
            )
            return
        }
        if (type == "facebook-bottom-login-bar-cosmetic-hide") {
            if (payload.optString("reason") == "scheduled") {
                GvLogger.i(
                    "GvLayout",
                    "facebook bottom login bar cosmetic hide scheduled phase=${payload.optString("phase")} generation=${payload.optInt("passiveGeneration")} attempt=${payload.optInt("passiveAttempt")}/${payload.optInt("passiveMaxAttempts")} primaryVideoAttached=${payload.optBoolean("primaryVideoAttached")} pageUrl=$pageUrl"
                )
                return
            }
            GvLogger.i(
                "GvLayout",
                "facebook bottom login bar cosmetic hide result hidden=${payload.optBoolean("hidden")} reason=${payload.optString("reason")} phase=${payload.optString("phase")} generation=${payload.optInt("passiveGeneration")} attempt=${payload.optInt("passiveAttempt")}/${payload.optInt("passiveMaxAttempts")} anchorRect=${payload.optString("anchorRect")} anchorText=${payload.optString("anchorText")} barRect=${payload.optString("barRect")} barText=${payload.optString("barTextSummary")} climbDepth=${payload.optInt("climbDepth", -1)} overlapsVideo=${payload.optBoolean("overlapsVideo")} primaryVideoAttached=${payload.optBoolean("primaryVideoAttached")} pageUrl=$pageUrl"
            )
            return
        }
        if (type == "facebook-compat") {
            val cookieClicked = payload.optBoolean("cookieClicked")
            if (payload.optBoolean("resolved")) {
                facebookCompatResolvedBySession.add(session)
            }
            fun summarizeNode(node: JSONObject?): String {
                if (node == null) return "none"
                return buildString {
                    append(node.optString("tag"))
                    val role = node.optString("role")
                    if (role.isNotBlank()) append("(role=").append(role).append(")")
                    val id = node.optString("id")
                    if (id.isNotBlank()) append("#").append(id)
                    val testid = node.optString("testid")
                    if (testid.isNotBlank()) append("[testid=").append(testid).append("]")
                    val text = node.optString("text")
                    if (text.isNotBlank()) append("{").append(text).append("}")
                    val rect = node.optString("rect")
                    if (rect.isNotBlank()) append("@").append(rect)
                    val position = node.optString("position")
                    if (position.isNotBlank()) append(" pos=").append(position)
                    val z = node.optString("z")
                    if (z.isNotBlank()) append(" z=").append(z)
                    val pointer = node.optString("pointer")
                    if (pointer.isNotBlank()) append(" ptr=").append(pointer)
                    val bg = node.optString("bg")
                    if (bg.isNotBlank()) append(" bg=").append(bg)
                    if (node.optBoolean("editable")) append(" editable=true")
                }
            }
            fun summarizeNodeArray(array: JSONArray?, limit: Int): String {
                if (array == null || array.length() == 0) return "none"
                return buildString {
                    val end = minOf(array.length(), limit)
                    for (index in 0 until end) {
                        val item = array.optJSONObject(index) ?: continue
                        if (isNotEmpty()) append(" | ")
                        append("#").append(index + 1).append(":").append(summarizeNode(item))
                    }
                }
            }
            val candidateSummary = buildString {
                val candidates = payload.optJSONArray("sampleCandidates") ?: JSONArray()
                val limit = minOf(candidates.length(), 6)
                for (index in 0 until limit) {
                    val candidate = candidates.optJSONObject(index) ?: continue
                    if (isNotEmpty()) append(" | ")
                    append("#")
                    append(index + 1)
                    append(":")
                    append(candidate.optString("tag"))
                    append(":")
                    append(candidate.optString("text"))
                    val aria = candidate.optString("aria")
                    if (aria.isNotBlank()) {
                        append(" aria=")
                        append(aria)
                    }
                    val testid = candidate.optString("testid")
                    if (testid.isNotBlank()) {
                        append(" testid=")
                        append(testid)
                    }
                }
            }
            GvLogger.i(
                "GvLayout",
                "facebook compat pageUrl=$pageUrl phase=${payload.optString("phase")} cookieClicked=$cookieClicked resolved=${facebookCompatResolvedBySession.contains(session)} reason=${payload.optString("reason")} loginDismissed=${payload.optBoolean("loginDismissed")} bottomLoginBarHidden=${payload.optBoolean("bottomLoginBarHidden")} loginDialogHidden=${payload.optBoolean("loginDialogHidden")} topLoginHeaderHidden=${payload.optBoolean("topLoginHeaderHidden")} blockingOverlayHidden=${payload.optBoolean("blockingOverlayHidden")} dimRestored=${payload.optBoolean("dimRestored")} autoBlurCount=${payload.optInt("autoBlurCount")} cookieClickCount=${payload.optInt("cookieClickCount")} loginDismissCount=${payload.optInt("loginDismissCount")} loginHideCount=${payload.optInt("loginHideCount")} videoCount=${payload.optInt("videoCount")} videoPlayAttempted=${payload.optBoolean("videoPlayAttempted")} playButtonClicked=${payload.optBoolean("playButtonClicked")} bottomBarHideCount=${payload.optInt("bottomBarHideCount")} topLoginHideCount=${payload.optInt("topLoginHideCount")} blockingOverlayHideCount=${payload.optInt("blockingOverlayHideCount")} dimRestoreCount=${payload.optInt("dimRestoreCount")} active=${summarizeNode(payload.optJSONObject("activeElement"))} activeChain=${summarizeNodeArray(payload.optJSONArray("activeElementChain"), 4)} center=${summarizeNodeArray(payload.optJSONArray("centerStack"), 4)} overlays=${summarizeNodeArray(payload.optJSONArray("overlayCandidates"), 6)} candidates=$candidateSummary"
            )
            if (phase.startsWith("facebook-")) {
                logFacebookCompatPhaseSnapshot(session, payload)
            }
            if (maybeHandleFacebookPassiveAttempt(session, payload)) {
                return
            }
            if (phase.startsWith("facebook-")) {
                maybeScheduleFacebookVideoHelperFromPayload(
                    session = session,
                    pageUrl = pageUrl,
                    payload = payload,
                    reason = "compat-$phase",
                    delayMs = 200L,
                )
            }
            if (payload.optBoolean("playbackWaiting")) {
                handleFacebookPlaybackWaiting(session, pageUrl, payload)
                return
            }
            if (payload.optString("phase") == "activity-facebook-simple") {
                maybeDispatchFacebookPlaybackDiagnostics(
                    session = session,
                    pageUrl = pageUrl,
                    reason = payload.optString("reason"),
                    videoCount = payload.optInt("videoCount"),
                    playButtonClicked = payload.optBoolean("playButtonClicked"),
                    videoPlayAttempted = payload.optBoolean("videoPlayAttempted"),
                )
                if (payload.optBoolean("playbackDeferred")) {
                    handleFacebookPlaybackDeferred(session, pageUrl, payload)
                } else {
                    facebookPlaybackDiagRetryCountBySession.remove(session)
                    facebookPlaybackWaitRetryCountBySession.remove(session)
                }
            }
            return
        }
        if (type == "facebook-playback-diagnostics") {
            handleFacebookPlaybackDiagnostics(session, payload)
            return
        }
        if (type == "facebook-video-helper") {
            val action = payload.optString("action")
            val helperReason = payload.optString("reason")
            val attempt = payload.optInt("attempt", -1)
            if (action == "error") {
                GvLogger.i(
                    "GvInput",
                    "facebook-video-helper error reason=$helperReason pageUrl=$pageUrl attempt=$attempt"
                )
                return
            }
            val mutedBefore = payload.optBoolean("mutedBefore")
            val mutedAfter = payload.optBoolean("mutedAfter")
            val defaultMutedBefore = payload.optBoolean("defaultMutedBefore")
            val defaultMutedAfter = payload.optBoolean("defaultMutedAfter")
            val volumeBefore = payload.optDouble("volumeBefore", 1.0)
            val volumeAfter = payload.optDouble("volumeAfter", 1.0)
            val pausedAfter = payload.optBoolean("pausedAfter")
            val readyStateBefore = payload.optInt("readyStateBefore", 0)
            val currentTimeBefore = payload.optDouble("currentTimeBefore", 0.0)
            val videoWidthBefore = payload.optInt("videoWidthBefore", 0)
            val videoHeightBefore = payload.optInt("videoHeightBefore", 0)
            val videoReady = payload.optBoolean("videoReady", false)
            val normalizedAttempt = attempt.coerceAtLeast(1)
            val fullscreenActive = payload.optBoolean("fullscreenActive", false)
            fun muteTapCount(): Int = facebookVideoHelperMuteTapCountBySession[session] ?: 0
            fun volumeBoostCount(): Int = facebookVideoHelperVolumeBoostCountBySession[session] ?: 0
            fun fullscreenTapCount(): Int = facebookVideoHelperFullscreenTapCountBySession[session] ?: 0
            fun controlsHoverCount(): Int = facebookVideoHelperControlsHoverCountBySession[session] ?: 0
            fun fullscreenCheckCount(): Int = facebookVideoHelperFullscreenCheckCountBySession[session] ?: 0
            fun stage(): String = currentFacebookVideoHelperStage(session)
            fun logSequenceState() = logFacebookVideoHelperSequenceState(session, pageUrl)
            GvLogger.i(
                "GvInput",
                "facebook-video-helper unmute-result reason=$helperReason pageUrl=$pageUrl mutedBefore=$mutedBefore mutedAfter=$mutedAfter defaultMutedBefore=$defaultMutedBefore defaultMutedAfter=$defaultMutedAfter volumeBefore=${String.format(java.util.Locale.US, "%.3f", volumeBefore)} volumeAfter=${String.format(java.util.Locale.US, "%.3f", volumeAfter)} paused=$pausedAfter readyState=$readyStateBefore currentTime=${String.format(java.util.Locale.US, "%.3f", currentTimeBefore)} videoWidth=$videoWidthBefore videoHeight=$videoHeightBefore"
            )
            logSequenceState()
            if (browserFullscreenStateBySession[session] == true || fullscreenActive) {
                if (stage() != FACEBOOK_VIDEO_HELPER_STAGE_SEQUENCE_COMPLETE) {
                    val enteredAttempt =
                        (fullscreenCheckCount() + 1).coerceAtMost(FACEBOOK_VIDEO_HELPER_MAX_FULLSCREEN_CALLBACK_CHECKS_PER_URL)
                    facebookVideoHelperFullscreenCheckCountBySession[session] = enteredAttempt
                    GvLogger.i(
                        "GvInput",
                        "facebook-video-helper fullscreen-check result=entered attempt=$enteredAttempt pageUrl=$pageUrl"
                    )
                }
                markFacebookVideoHelperSequenceComplete(session, pageUrl)
                GvLogger.i("GvInput", "facebook-video-helper skipped reason=sequence-complete pageUrl=$pageUrl")
                return
            }
            if (stage() == FACEBOOK_VIDEO_HELPER_STAGE_SEQUENCE_COMPLETE) {
                GvLogger.i("GvInput", "facebook-video-helper skipped reason=sequence-complete pageUrl=$pageUrl")
                return
            }
            if (stage() == FACEBOOK_VIDEO_HELPER_STAGE_FULLSCREEN_PENDING) {
                GvLogger.i("GvInput", "facebook-video-helper skipped reason=fullscreen-pending pageUrl=$pageUrl")
                return
            }
            if (fullscreenTapCount() >= FACEBOOK_VIDEO_HELPER_MAX_FULLSCREEN_TAPS_PER_URL) {
                markFacebookVideoHelperSequenceComplete(session, pageUrl)
                GvLogger.i("GvInput", "facebook-video-helper skipped reason=fullscreen-retry-budget pageUrl=$pageUrl")
                return
            }
            fun summarizePointStack(array: JSONArray?, limit: Int = 5): String {
                if (array == null || array.length() == 0) return "none"
                return buildString {
                    val end = minOf(array.length(), limit)
                    for (index in 0 until end) {
                        val item = array.optString(index)
                        if (item.isBlank()) continue
                        if (isNotEmpty()) append(" | ")
                        append("#").append(index + 1).append(":").append(item)
                    }
                }.ifBlank { "none" }
            }
            val viewportWidth = payload.optInt("viewportWidth", 0).coerceAtLeast(0)
            val viewportHeight = payload.optInt("viewportHeight", 0).coerceAtLeast(0)
            val scaleX = if (viewportWidth > 0 && geckoView.width > 0) geckoView.width.toFloat() / viewportWidth.toFloat() else 1f
            val scaleY = if (viewportHeight > 0 && geckoView.height > 0) geckoView.height.toFloat() / viewportHeight.toFloat() else 1f
            fun mapDomToNativeX(domX: Float): Float {
                return (domX * scaleX).coerceIn(1f, (geckoView.width - 1).coerceAtLeast(1).toFloat())
            }
            fun mapDomToNativeY(domY: Float): Float {
                return (domY * scaleY).coerceIn(1f, (geckoView.height - 1).coerceAtLeast(1).toFloat())
            }
            var muteTapHandled = false
            val muteTargetFound = payload.optBoolean("muteTargetFound", false)
            if (muteTargetFound) {
                val currentMuteTapCount = muteTapCount()
                if (currentMuteTapCount >= FACEBOOK_VIDEO_HELPER_MAX_MUTE_TAPS_PER_URL) {
                    GvLogger.i(
                        "GvInput",
                        "facebook-video-helper mute-target skipped reason=single-toggle-protection pageUrl=$pageUrl attempt=$attempt taps=$currentMuteTapCount"
                    )
                } else {
                    val muteX = payload.optDouble("muteTargetX", -1.0).toFloat()
                    val muteY = payload.optDouble("muteTargetY", -1.0).toFloat()
                    if (muteX > 0f && muteY > 0f) {
                        val mappedMuteX = mapDomToNativeX(muteX)
                        val mappedMuteY = mapDomToNativeY(muteY)
                        GvLogger.i(
                            "GvInput",
                            "facebook-video-helper mute-target measured source=${payload.optString("muteTargetReason")} x=${mappedMuteX.toInt()} y=${mappedMuteY.toInt()} label=${payload.optString("muteTargetLabel")} rect=${payload.optString("muteTargetRect")} viewport=${viewportWidth}x${viewportHeight} attempt=$attempt"
                        )
                        facebookVideoHelperMuteTapCountBySession[session] = currentMuteTapCount + 1
                        logSequenceState()
                        muteTapHandled = dispatchNativeMouseTapAt(mappedMuteX, mappedMuteY, "facebook-video-helper-mute")
                        GvLogger.i(
                            "GvInput",
                            "facebook-video-helper mute-tap x=${mappedMuteX.toInt()} y=${mappedMuteY.toInt()} handled=$muteTapHandled pageUrl=$pageUrl attempt=$attempt"
                        )
                        if (muteTapHandled && volumeBoostCount() < FACEBOOK_VIDEO_HELPER_MAX_VOLUME_BOOST_TAPS_PER_URL) {
                            val normalizedPageUrl = normalizeFacebookPassiveReentryUrl(pageUrl)
                            val volumeBoostDomY = (muteY - 80f).coerceAtLeast(1f)
                            val mappedVolumeBoostY = mapDomToNativeY(volumeBoostDomY)
                            pointerHandler.postDelayed(
                                {
                                    if (isFinishing || isDestroyed) return@postDelayed
                                    val tab = tabController.findTabBySession(session) ?: return@postDelayed
                                    if (normalizeFacebookPassiveReentryUrl(tab.url) != normalizedPageUrl) return@postDelayed
                                    if (browserFullscreenStateBySession[session] == true) {
                                        GvLogger.i("GvInput", "facebook-video-helper skipped reason=sequence-complete pageUrl=$pageUrl")
                                        return@postDelayed
                                    }
                                    val currentVolumeBoostCount = volumeBoostCount()
                                    if (currentVolumeBoostCount >= FACEBOOK_VIDEO_HELPER_MAX_VOLUME_BOOST_TAPS_PER_URL) {
                                        return@postDelayed
                                    }
                                    facebookVideoHelperVolumeBoostCountBySession[session] = currentVolumeBoostCount + 1
                                    logSequenceState()
                                    val handled = dispatchNativeMouseTapAt(mappedMuteX, mappedVolumeBoostY, "facebook-video-helper-volume-boost")
                                    GvLogger.i(
                                        "GvInput",
                                        "facebook-video-helper volume-boost-tap x=${mappedMuteX.toInt()} y=${mappedVolumeBoostY.toInt()} handled=$handled pageUrl=$pageUrl attempt=$attempt"
                                    )
                                },
                                250L,
                            )
                        }
                    } else {
                        GvLogger.i(
                            "GvInput",
                            "facebook-video-helper mute-target skipped reason=invalid-target-coordinates pageUrl=$pageUrl attempt=$attempt"
                        )
                    }
                }
            }
            if ((mutedAfter || volumeAfter < 0.95) && normalizedAttempt < FACEBOOK_VIDEO_HELPER_MAX_ATTEMPTS_PER_URL) {
                maybeScheduleFacebookVideoHelper(
                    session = session,
                    pageUrl = pageUrl,
                    reason = "unmute-followup",
                    delayMs = 900L,
                    bypassCooldown = true,
                )
            }
            val fullscreenTargetFound = payload.optBoolean("fullscreenTargetFound", false)
            if (muteTapHandled && normalizedAttempt < FACEBOOK_VIDEO_HELPER_MAX_ATTEMPTS_PER_URL) {
                maybeScheduleFacebookVideoHelper(
                    session = session,
                    pageUrl = pageUrl,
                    reason = "mute-tap-followup",
                    delayMs = FACEBOOK_VIDEO_HELPER_POST_VOLUME_BOOST_DELAY_MS,
                    bypassCooldown = true,
                )
                return
            }
            if (!fullscreenTargetFound) {
                val visualViewportWidth = payload.optInt("visualViewportWidth", 0).coerceAtLeast(0)
                val visualViewportHeight = payload.optInt("visualViewportHeight", 0).coerceAtLeast(0)
                val visualViewportScale = payload.optDouble("visualViewportScale", 0.0)
                val devicePixelRatio = payload.optDouble("devicePixelRatio", 0.0)
                val controlsRevealSuggested = payload.optBoolean("controlsRevealSuggested", false)
                val controlsRevealX = payload.optDouble("controlsRevealX", -1.0).toFloat()
                val controlsRevealY = payload.optDouble("controlsRevealY", -1.0).toFloat()
                val videoRect = payload.optString("videoRect").ifBlank { "none" }
                val controlsRevealStack = summarizePointStack(payload.optJSONArray("controlsRevealStack"))
                val lowerRightCandidates = summarizePointStack(payload.optJSONArray("lowerRightCandidates"), 4)
                val lowerLeftCandidates = summarizePointStack(payload.optJSONArray("lowerLeftCandidates"), 4)
                val controlbarCandidates = summarizePointStack(payload.optJSONArray("controlbarCandidates"), 8)
                val mappedHoverX = if (controlsRevealX > 0f) (controlsRevealX * scaleX).toInt() else -1
                val mappedHoverY = if (controlsRevealY > 0f) (controlsRevealY * scaleY).toInt() else -1
                GvLogger.i(
                    "GvInput",
                    "facebook-video-helper no-visible-fullscreen-target reason=${payload.optString("fullscreenTargetReason")} pageUrl=$pageUrl attempt=$attempt"
                )
                GvLogger.i(
                    "GvInput",
                    "facebook-video-helper controlbar-candidates count=${payload.optJSONArray("controlbarCandidates")?.length() ?: 0} items=$controlbarCandidates pageUrl=$pageUrl attempt=$attempt"
                )
                GvLogger.i(
                    "GvInput",
                    "facebook-video-helper viewport-diagnostics pageViewport=${viewportWidth}x$viewportHeight visualViewport=${visualViewportWidth}x$visualViewportHeight@$visualViewportScale dpr=$devicePixelRatio geckoView=${geckoView.width}x${geckoView.height} videoRect=$videoRect controlsRevealDom=${controlsRevealX.toInt()},${controlsRevealY.toInt()} controlsRevealNative=$mappedHoverX,$mappedHoverY scaleX=$scaleX scaleY=$scaleY lowerRightCandidates=$lowerRightCandidates lowerLeftCandidates=$lowerLeftCandidates attempt=$attempt"
                )
                GvLogger.i(
                    "GvInput",
                    "facebook-video-helper elementsFromPoint point=controls-reveal dom=${controlsRevealX.toInt()},${controlsRevealY.toInt()} stack=$controlsRevealStack"
                )
                if (videoReady && controlsRevealSuggested && controlsRevealX > 0f && controlsRevealY > 0f) {
                    val currentHoverCount = controlsHoverCount()
                    if (currentHoverCount >= FACEBOOK_VIDEO_HELPER_MAX_CONTROLS_REVEAL_HOVERS_BEFORE_FULLSCREEN) {
                        GvLogger.i("GvInput", "facebook-video-helper skipped reason=hover-budget pageUrl=$pageUrl attempt=$attempt")
                        return
                    }
                    facebookVideoHelperControlsHoverCountBySession[session] = currentHoverCount + 1
                    logSequenceState()
                    val mappedHoverXFloat = mapDomToNativeX(controlsRevealX)
                    val mappedHoverYFloat = mapDomToNativeY(controlsRevealY)
                    val hoverHandled = dispatchNativeMouseHoverAt(mappedHoverXFloat, mappedHoverYFloat, "facebook-video-helper-controls-reveal")
                    GvLogger.i(
                        "GvInput",
                        "facebook-video-helper controls-hover x=${mappedHoverXFloat.toInt()} y=${mappedHoverYFloat.toInt()} handled=$hoverHandled pageUrl=$pageUrl attempt=$normalizedAttempt"
                    )
                    maybeScheduleFacebookVideoHelper(
                        session = session,
                        pageUrl = pageUrl,
                        reason = "controls-reveal-reprobe",
                        delayMs = FACEBOOK_VIDEO_HELPER_REVEAL_RETRY_DELAY_MS,
                        bypassCooldown = true,
                    )
                }
                return
            }
            val centerX = payload.optDouble("fullscreenTargetX", -1.0).toFloat()
            val centerY = payload.optDouble("fullscreenTargetY", -1.0).toFloat()
            val controlbarCandidates = summarizePointStack(payload.optJSONArray("controlbarCandidates"), 8)
            GvLogger.i(
                "GvInput",
                "facebook-video-helper controlbar-candidates count=${payload.optJSONArray("controlbarCandidates")?.length() ?: 0} items=$controlbarCandidates pageUrl=$pageUrl attempt=$attempt"
            )
            if (centerX <= 0f || centerY <= 0f) {
                GvLogger.i(
                    "GvInput",
                    "facebook-video-helper no-visible-fullscreen-target reason=invalid-target-coordinates pageUrl=$pageUrl attempt=$attempt"
                )
                return
            }
            val mappedX = mapDomToNativeX(centerX)
            val mappedY = mapDomToNativeY(centerY)
            val fullscreenReason = payload.optString("fullscreenTargetReason")
            val controlbarCandidateCount = payload.optJSONArray("controlbarCandidates")?.length() ?: 0
            if (fullscreenReason != "coordinate-controlbar-fullscreen" || controlbarCandidateCount <= 0) {
                GvLogger.i(
                    "GvInput",
                    "facebook-video-helper fullscreen-target skipped reason=unsafe-candidate pageUrl=$pageUrl attempt=$attempt source=$fullscreenReason label=${payload.optString("fullscreenTargetLabel")} rect=${payload.optString("fullscreenTargetRect")}"
                )
                return
            }
            facebookVideoHelperLastFullscreenTargetXBySession[session] = mappedX
            facebookVideoHelperLastFullscreenTargetYBySession[session] = mappedY
            scheduleFacebookVideoHelperFullscreenAttempt(
                session = session,
                pageUrl = pageUrl,
                mappedX = mappedX,
                mappedY = mappedY,
                source = fullscreenReason,
                label = payload.optString("fullscreenTargetLabel"),
                rect = payload.optString("fullscreenTargetRect"),
                viewportWidth = viewportWidth,
                viewportHeight = viewportHeight,
                attempt = attempt,
            )
            return
        }
        if (type == "youtube-consent") {
            val actionX = payload.optDouble("actionX", -1.0).toFloat()
            val actionY = payload.optDouble("actionY", -1.0).toFloat()
            GvLogger.i(
                "GvLayout",
                "youtube consent pageUrl=$pageUrl reason=${payload.optString("reason")} clicked=${payload.optBoolean("clicked")} scrolled=${payload.optBoolean("scrolled")} matched=${payload.optString("matched")} action=${actionX.toInt()},${actionY.toInt()}"
            )
            maybeDispatchYouTubeConsentNativeTap(
                session = session,
                actionX = actionX,
                actionY = actionY,
                matched = payload.optString("matched"),
                reason = payload.optString("reason"),
            )
            return
        }
        if (type == "youtube-quality-helper") {
            val action = payload.optString("action")
            val reason = payload.optString("reason")
            val attempt = payload.optInt("attempt", -1)
            if (action == "error") {
                GvLogger.i("GvInput", "youtube-quality-helper error message=$reason")
                return
            }
            val hasPlayer = payload.optBoolean("hasPlayer", false)
            if (!hasPlayer) {
                GvLogger.i("GvInput", "youtube-quality-helper skipped reason=no-player")
                return
            }
            val levelsJson = payload.optJSONArray("levels") ?: JSONArray()
            val levels = mutableListOf<String>()
            for (index in 0 until levelsJson.length()) {
                val level = levelsJson.optString(index)
                if (level.isNotBlank()) {
                    levels.add(level)
                }
            }
            val levelsSummary = levels.joinToString(",").ifBlank { "none" }
            val currentBefore = payload.optString("currentBefore")
            val currentAfter = payload.optString("currentAfter")
            val videoWidthBefore = payload.optInt("videoWidthBefore", 0)
            val videoHeightBefore = payload.optInt("videoHeightBefore", 0)
            val videoWidthAfter = payload.optInt("videoWidthAfter", 0)
            val videoHeightAfter = payload.optInt("videoHeightAfter", 0)
            val target = payload.optString("target")
            val methodsJson = payload.optJSONArray("methodsApplied") ?: JSONArray()
            val methodsApplied = mutableListOf<String>()
            for (index in 0 until methodsJson.length()) {
                val method = methodsJson.optString(index)
                if (method.isNotBlank()) {
                    methodsApplied.add(method)
                }
            }
            val methodsSummary = methodsApplied.joinToString(",").ifBlank { "none" }
            GvLogger.i(
                "GvInput",
                "youtube-quality-helper probe levels=$levelsSummary current=$currentBefore videoWidth=$videoWidthBefore videoHeight=$videoHeightBefore"
            )
            if (target.isBlank()) {
                GvLogger.i("GvInput", "youtube-quality-helper skipped reason=no-hd-level levels=$levelsSummary")
                return
            }
            GvLogger.i("GvInput", "youtube-quality-helper target selected=$target reason=available-levels")
            GvLogger.i("GvInput", "youtube-quality-helper applied target=$target methods=$methodsSummary")
            val verifyOk = currentAfter == "hd1080" || currentAfter == "hd720" || (videoWidthAfter >= 1280 && videoHeightAfter >= 720)
            val verifyNoOp = currentAfter == currentBefore &&
                videoWidthAfter == videoWidthBefore &&
                videoHeightAfter == videoHeightBefore &&
                methodsApplied.isNotEmpty()
            val verifyResult = when {
                verifyOk -> "ok"
                verifyNoOp -> "no-op"
                else -> "not-yet"
            }
            GvLogger.i(
                "GvInput",
                "youtube-quality-helper verify target=$target current=$currentAfter videoWidth=$videoWidthAfter videoHeight=$videoHeightAfter result=$verifyResult"
            )
            if (!verifyOk && attempt in 1 until YOUTUBE_QUALITY_HELPER_MAX_ATTEMPTS_PER_URL) {
                val queuedUrl = youtubeQualityFollowUpQueuedUrlBySession[session]
                if (queuedUrl != pageUrl) {
                    youtubeQualityFollowUpQueuedUrlBySession[session] = pageUrl
                    maybeScheduleYouTubeQualityHelper(
                        session = session,
                        pageUrl = pageUrl,
                        reason = "verify-followup",
                        delayMs = YOUTUBE_QUALITY_HELPER_VERIFY_FOLLOW_UP_DELAY_MS,
                        bypassCooldown = true,
                    )
                }
            }
            if (verifyOk) {
                youtubeQualityFollowUpQueuedUrlBySession.remove(session)
            }
            return
        }
        if (type == "youtube-native-fullscreen-target") {
            val action = payload.optString("action")
            val reason = payload.optString("reason")
            val probeToken = payload.optString("probeToken")
            val attempt = payload.optInt("attempt", -1)
            val probePass = payload.optInt("probePass", 1).coerceAtLeast(1)
            val viewportWidth = payload.optInt("viewportWidth", 0).coerceAtLeast(0)
            val viewportHeight = payload.optInt("viewportHeight", 0).coerceAtLeast(0)
            val centerX = payload.optDouble("centerX", -1.0).toFloat()
            val centerY = payload.optDouble("centerY", -1.0).toFloat()
            val rectWidth = payload.optInt("width", -1)
            val rectHeight = payload.optInt("height", -1)
            val buttonExists = payload.optBoolean("buttonExists", false)
            val buttonVisible = payload.optBoolean("buttonVisible", false)
            val controlsVisible = payload.optBoolean("controlsVisible", false)
            val adVisible = payload.optBoolean("adVisible", false)
            val skipAdVisible = payload.optBoolean("skipAdVisible", false)
            val premiumVisible = payload.optBoolean("premiumVisible", false)
            val premiumNegativeButtonFound = payload.optBoolean("premiumNegativeButtonFound", false)
            val premiumNegativeButtonCenterX = payload.optDouble("premiumNegativeButtonCenterX", -1.0).toFloat()
            val premiumNegativeButtonCenterY = payload.optDouble("premiumNegativeButtonCenterY", -1.0).toFloat()
            val premiumNegativeButtonLabel = payload.optString("premiumNegativeButtonLabel").ifBlank { "No thanks" }
            val premiumNegativeButtonReason = payload.optString("premiumNegativeButtonReason")
            val fallbackPair = resolveYouTubeNativeTapPoint(
                xRatio = YOUTUBE_FULLSCREEN_BUTTON_X_RATIO,
                yRatio = YOUTUBE_FULLSCREEN_BUTTON_Y_RATIO,
                fallbackX = YOUTUBE_FULLSCREEN_BUTTON_X_FALLBACK,
                fallbackY = YOUTUBE_FULLSCREEN_BUTTON_Y_FALLBACK,
            )
            val targetAttempt = attempt.takeIf { it > 0 } ?: (youtubeAutoFsAttemptCountBySession[session] ?: 1)
            if (
                maybeHandleYouTubeFullscreenOverlayBlocker(
                    session = session,
                    pageUrl = pageUrl,
                    attempt = targetAttempt,
                    probePass = probePass,
                    probeToken = probeToken,
                    viewportWidth = viewportWidth,
                    viewportHeight = viewportHeight,
                    premiumVisible = premiumVisible,
                    premiumNegativeButtonFound = premiumNegativeButtonFound,
                    premiumNegativeButtonCenterX = premiumNegativeButtonCenterX,
                    premiumNegativeButtonCenterY = premiumNegativeButtonCenterY,
                    premiumNegativeButtonLabel = premiumNegativeButtonLabel,
                    premiumNegativeButtonReason = premiumNegativeButtonReason,
                    adVisible = adVisible,
                    skipAdVisible = skipAdVisible,
                    fallbackX = fallbackPair.first,
                    fallbackY = fallbackPair.second,
                )
            ) {
                return
            }
            if (action == "measured") {
                val scaleX = if (viewportWidth > 0 && geckoView.width > 0) geckoView.width.toFloat() / viewportWidth.toFloat() else 1f
                val scaleY = if (viewportHeight > 0 && geckoView.height > 0) geckoView.height.toFloat() / viewportHeight.toFloat() else 1f
                val mappedX = centerX * scaleX
                val mappedY = centerY * scaleY
                GvLogger.i(
                    "GvInput",
                    "youtube-native-fullscreen-target measured x=${mappedX.toInt()} y=${mappedY.toInt()} width=$rectWidth height=$rectHeight viewport=${viewportWidth}x${viewportHeight} attempt=$targetAttempt probePass=$probePass"
                )
                performYouTubeNativeFullscreenButtonTap(
                    session = session,
                    pageUrl = pageUrl,
                    attempt = targetAttempt,
                    x = mappedX,
                    y = mappedY,
                    source = "measured",
                    token = probeToken,
                )
                return
            }

            val skipReason = when {
                reason.isNotBlank() -> reason
                action == "error" -> "probe-error"
                else -> "no-visible-button"
            }
            GvLogger.i(
                "GvInput",
                "youtube-native-fullscreen-target skipped reason=$skipReason buttonExists=$buttonExists buttonVisible=$buttonVisible controlsVisible=$controlsVisible adVisible=$adVisible skipAdVisible=$skipAdVisible premiumVisible=$premiumVisible premiumNegativeButtonFound=$premiumNegativeButtonFound attempt=$targetAttempt probePass=$probePass"
            )
            handleYouTubeNativeFullscreenTargetProbeMiss(
                session = session,
                pageUrl = pageUrl,
                attempt = targetAttempt,
                probePass = probePass,
                reason = skipReason,
                token = probeToken,
                fallbackX = fallbackPair.first,
                fallbackY = fallbackPair.second,
            )
            return
        }
        if (type == "youtube-chat-collapse") {
            GvLogger.i(
                "GvInput",
                "youtube-chat-collapse action=${payload.optString("action")} reason=${payload.optString("reason")} pageUrl=$pageUrl"
            )
            return
        }
        if (type == "youtube-fullscreen-chat-guard") {
            val action = payload.optString("action")
            val reason = payload.optString("reason")
            val visibleChatCount = payload.optInt("visibleChatCount", -1)
            val maxChatWidth = payload.optInt("maxChatWidth", -1)
            val maxChatHeight = payload.optInt("maxChatHeight", -1)
            val liveChatIframeVisible = payload.optBoolean("liveChatIframeVisible", false)
            val secondaryWidth = payload.optInt("secondaryWidth", -1)
            val panelsWidth = payload.optInt("panelsWidth", -1)
            val viewportWidth = payload.optInt("viewportWidth", -1)
            val primaryWidth = payload.optInt("primaryWidth", -1)
            val playerWidth = payload.optInt("playerWidth", -1)
            val metricSuffix =
                "visibleChatCount=$visibleChatCount maxChatWidth=$maxChatWidth maxChatHeight=$maxChatHeight " +
                    "liveChatIframeVisible=$liveChatIframeVisible secondaryWidth=$secondaryWidth panelsWidth=$panelsWidth " +
                    "playerWidth=$playerWidth primaryWidth=$primaryWidth viewportWidth=$viewportWidth"
            when (action) {
                "applied" -> GvLogger.i("GvInput", "youtube-fullscreen-chat-guard applied reason=$reason pageUrl=$pageUrl $metricSuffix")
                "reapplied" -> GvLogger.i("GvInput", "youtube-fullscreen-chat-guard reapplied reason=$reason pageUrl=$pageUrl $metricSuffix")
                "removed" -> GvLogger.i("GvInput", "youtube-fullscreen-chat-guard removed reason=$reason pageUrl=$pageUrl $metricSuffix")
                else -> GvLogger.i("GvInput", "youtube-fullscreen-chat-guard action=$action reason=$reason pageUrl=$pageUrl $metricSuffix")
            }
            if (visibleChatCount > 0 && maxChatWidth > 0) {
                GvLogger.i(
                    "GvInput",
                    "youtube-fullscreen-chat-guard visible-chat-remaining count=$visibleChatCount maxChatWidth=$maxChatWidth secondaryWidth=$secondaryWidth panelsWidth=$panelsWidth"
                )
            }
            return
        }
        if (type == "youtube-premium-popup") {
            val action = payload.optString("action")
            val reason = payload.optString("reason")
            val checkReason = payload.optString("checkReason")
            val buttonLabel = payload.optString("buttonLabel")
            val containerText = payload.optString("containerText")
            val buttonCenterX = payload.optDouble("buttonCenterX", -1.0).toFloat()
            val buttonCenterY = payload.optDouble("buttonCenterY", -1.0).toFloat()
            val viewportWidth = payload.optInt("viewportWidth", 0).coerceAtLeast(0)
            val viewportHeight = payload.optInt("viewportHeight", 0).coerceAtLeast(0)
            when (action) {
                "candidate-buttons" -> {
                    GvLogger.i(
                        "GvInput",
                        "youtube-premium-popup candidate-buttons ${reason.ifBlank { "count=0 negativeCount=0" }} checkReason=$checkReason pageUrl=$pageUrl"
                    )
                }
                "negative-button-found" -> {
                    val scaleX = if (viewportWidth > 0 && geckoView.width > 0) geckoView.width.toFloat() / viewportWidth.toFloat() else 1f
                    val scaleY = if (viewportHeight > 0 && geckoView.height > 0) geckoView.height.toFloat() / viewportHeight.toFloat() else 1f
                    val mappedX = buttonCenterX * scaleX
                    val mappedY = buttonCenterY * scaleY
                    val clampedX = mappedX.coerceIn(1f, (geckoView.width - 1).coerceAtLeast(1).toFloat())
                    val clampedY = mappedY.coerceIn(1f, (geckoView.height - 1).coerceAtLeast(1).toFloat())
                    val handled = if (buttonCenterX > 0f && buttonCenterY > 0f) {
                        dispatchNativeMouseTapAt(clampedX, clampedY, "youtube-premium-popup-negative")
                    } else {
                        false
                    }
                    if (handled) {
                        recordYouTubePremiumPopupDismiss(session, pageUrl)
                        GvLogger.i(
                            "GvInput",
                            "youtube-premium-popup dismissed reason=$checkReason matchReason=$reason button=\"$buttonLabel\" mode=native-tap x=${clampedX.toInt()} y=${clampedY.toInt()} pageUrl=$pageUrl"
                        )
                    } else {
                        GvLogger.i(
                            "GvInput",
                            "youtube-premium-popup skipped reason=native-tap-failed matchReason=$reason checkReason=$checkReason button=\"$buttonLabel\" pageUrl=$pageUrl"
                        )
                    }
                }
                "dismissed" -> {
                    recordYouTubePremiumPopupDismiss(session, pageUrl)
                    GvLogger.i(
                        "GvInput",
                        "youtube-premium-popup dismissed reason=$checkReason button=\"$buttonLabel\" containerText=\"${containerText.take(90)}\" pageUrl=$pageUrl"
                    )
                }
                "skipped" -> {
                    GvLogger.i(
                        "GvInput",
                        "youtube-premium-popup skipped reason=$reason checkReason=$checkReason pageUrl=$pageUrl"
                    )
                }
                "error" -> {
                    GvLogger.i(
                        "GvInput",
                        "youtube-premium-popup error reason=$reason checkReason=$checkReason pageUrl=$pageUrl"
                    )
                }
                else -> {
                    GvLogger.i(
                        "GvInput",
                        "youtube-premium-popup action=$action reason=$reason checkReason=$checkReason pageUrl=$pageUrl"
                    )
                }
            }
            return
        }
        if (type == "cgtv-play-assist") {
            val active = payload.optBoolean("active")
            val requiresUserAction = payload.optBoolean("requiresUserAction", false)
            val targetKind = payload.optString("targetKind")
            val state = CgtvPlayAssistState(
                active = active,
                requiresUserAction = requiresUserAction,
                centerX = payload.optDouble("centerX", -1.0).toFloat(),
                centerY = payload.optDouble("centerY", -1.0).toFloat(),
                xRatio = payload.optDouble("xRatio", -1.0).toFloat(),
                yRatio = payload.optDouble("yRatio", -1.0).toFloat(),
                reason = payload.optString("reason"),
                targetKind = targetKind,
                pageUrl = pageUrl,
                viewportWidth = payload.optDouble("viewportWidth", 0.0).toFloat(),
                viewportHeight = payload.optDouble("viewportHeight", 0.0).toFloat(),
                hasVideo = payload.optBoolean("hasVideo"),
                paused = payload.optBoolean("paused", true),
                readyState = payload.optInt("readyState"),
                currentTime = payload.optDouble("currentTime"),
                videoWidth = payload.optInt("videoWidth"),
                videoHeight = payload.optInt("videoHeight"),
            )
            if (targetKind == "bradmax-iframe" && active) {
                cgtvPlayAssistBySession[session] = state
                val handled = dispatchCgtvPlayAssistNativeTap(session, state, trigger = "auto")
                if (handled) {
                    // Schedule a short Kotlin-side fallback that will release play-assist
                    // if page-side playing=true does not arrive in time.
                    scheduleCgtvPlayAssistFallbackRelease(session, pageUrl)
                }
            } else if (targetKind == "bradmax-video" && active && state.hasVideo && state.paused) {
                cgtvPlayAssistBySession[session] = state
                val handled = dispatchCgtvPlayAssistNativeTap(session, state, trigger = "auto-video")
                if (handled) {
                    scheduleCgtvPlayAssistFallbackRelease(session, pageUrl)
                }
            } else if (targetKind == "bradmax-video" && payload.optBoolean("playing")) {
                // Playback detected by the page. Cancel any scheduled fallback, remove
                // play-assist state and release browser-playback-active suppression so
                // user input works again.
                clearCgtvPlayAssistFallback(session)
                cgtvPlayAssistBySession.remove(session)
                if (cgtvBrowserPlaybackActiveBySession.contains(session)) {
                    cgtvBrowserPlaybackActiveBySession.remove(session)
                    GvLogger.i("GvMedia", "cgtv play assist released reason=playing")
                    // Restore pointer overlay if it was hidden by CGTV startup.
                    restoreCgtvPointerIfHidden(reason = "playing")
                    GvLogger.i("GvMedia", "cgtv transport lock released reason=playing")
                }
            }
            GvLogger.i(
                "GvMedia",
                "cgtv play assist active=$active requiresUserAction=$requiresUserAction reason=${state.reason} targetKind=$targetKind " +
                    "pageUrl=$pageUrl center=${state.centerX.toInt()},${state.centerY.toInt()} rect=${payload.optString("rect")} " +
                    "viewport=${state.viewportWidth.toInt()}x${state.viewportHeight.toInt()} dpr=${payload.optDouble("devicePixelRatio", 0.0)} " +
                    "hasVideo=${payload.optBoolean("hasVideo")} playing=${payload.optBoolean("playing")} paused=${payload.optBoolean("paused")} " +
                    "readyState=${payload.optInt("readyState")} currentTime=${payload.optDouble("currentTime")} size=${payload.optInt("videoWidth")}x${payload.optInt("videoHeight")}"
            )
            return
        }
        if (type == "chtv-play-assist") {
            val active = payload.optBoolean("active")
            val requiresUserAction = payload.optBoolean("requiresUserAction", false)
            val targetKind = payload.optString("targetKind")
            val state = ChtvPlayAssistState(
                active = active,
                requiresUserAction = requiresUserAction,
                centerX = payload.optDouble("centerX", -1.0).toFloat(),
                centerY = payload.optDouble("centerY", -1.0).toFloat(),
                xRatio = payload.optDouble("xRatio", -1.0).toFloat(),
                yRatio = payload.optDouble("yRatio", -1.0).toFloat(),
                reason = payload.optString("assistReason", payload.optString("reason")),
                targetKind = targetKind,
                pageUrl = pageUrl,
                viewportWidth = payload.optDouble("viewportWidth", 0.0).toFloat(),
                viewportHeight = payload.optDouble("viewportHeight", 0.0).toFloat(),
                hasVideo = payload.optBoolean("hasVideo"),
                paused = payload.optBoolean("paused", true),
                readyState = payload.optInt("readyState"),
                currentTime = payload.optDouble("currentTime"),
            )
            chtvPlayAssistBySession[session] = state
            if (active) {
                dispatchChtvPlayAssistNativeTap(session, state, trigger = "auto")
            }
            GvLogger.i(
                "GvMedia",
                "chtv play assist active=$active requiresUserAction=$requiresUserAction reason=${state.reason} targetKind=$targetKind " +
                    "pageUrl=$pageUrl center=${state.centerX.toInt()},${state.centerY.toInt()} rect=${payload.optString("rect")} playerRect=${payload.optString("playerRect")} " +
                    "viewport=${state.viewportWidth.toInt()}x${state.viewportHeight.toInt()} dpr=${payload.optDouble("devicePixelRatio", 0.0)} " +
                    "hasVideo=${payload.optBoolean("hasVideo")} playing=${payload.optBoolean("playing")} paused=${payload.optBoolean("paused")} " +
                    "readyState=${payload.optInt("readyState")} currentTime=${payload.optDouble("currentTime")}"
            )
            return
        }
        if (type == "chtv-fullscreen-assist") {
            val active = payload.optBoolean("active")
            val clicked = payload.optBoolean("clicked")
            val requestNativeFallback = payload.optBoolean("requestNativeFallback", false)
            val targetKind = payload.optString("targetKind")
            val suppressed = isChtvFullscreenAssistSuppressed(session, pageUrl)
            val state = ChtvFullscreenAssistState(
                active = active,
                centerX = payload.optDouble("centerX", -1.0).toFloat(),
                centerY = payload.optDouble("centerY", -1.0).toFloat(),
                xRatio = payload.optDouble("xRatio", -1.0).toFloat(),
                yRatio = payload.optDouble("yRatio", -1.0).toFloat(),
                reason = payload.optString("assistReason", payload.optString("reason")),
                targetKind = targetKind,
                pageUrl = pageUrl,
                viewportWidth = payload.optDouble("viewportWidth", 0.0).toFloat(),
                viewportHeight = payload.optDouble("viewportHeight", 0.0).toFloat(),
                clicked = clicked,
            )
            chtvFullscreenAssistBySession[session] = state
            if (suppressed) {
                GvLogger.i(
                    "GvMedia",
                    "chtv fullscreen assist skipped reason=suppressed-after-back pageUrl=$pageUrl targetKind=$targetKind"
                )
                return
            }
            if (active && requestNativeFallback && !clicked) {
                dispatchChtvFullscreenAssistNativeTap(session, state, trigger = "auto")
            }
            GvLogger.i(
                "GvMedia",
                "chtv fullscreen assist active=$active clicked=$clicked nativeFallback=$requestNativeFallback reason=${state.reason} targetKind=$targetKind " +
                    "pageUrl=$pageUrl center=${state.centerX.toInt()},${state.centerY.toInt()} rect=${payload.optString("rect")} playerRect=${payload.optString("playerRect")} " +
                    "viewport=${state.viewportWidth.toInt()}x${state.viewportHeight.toInt()} fullscreenBefore=${payload.optBoolean("fullscreenActiveBefore")} " +
                    "fullscreenAfter=${payload.optBoolean("fullscreenActiveAfter")} methods=${payload.optString("methods")}"
            )
            return
        }
        if (type == "caribvision-session-state") {
            val state = CaribvisionSessionState(
                loginRequired = payload.optBoolean("loginRequired"),
                playerVisible = payload.optBoolean("playerVisible"),
                pageUrl = pageUrl,
                reason = payload.optString("stateReason", payload.optString("reason")),
            )
            if (state.loginRequired || state.playerVisible) {
                caribvisionSessionStateBySession[session] = state
            } else {
                caribvisionSessionStateBySession.remove(session)
            }
            if (state.loginRequired) {
                GvLogger.i(
                    "GvMedia",
                    "caribvision session login-required reason=login-wall pageUrl=$pageUrl playerRect=${payload.optString("playerRect")} videoRect=${payload.optString("videoRect")}"
                )
                GvLogger.i("GvMedia", "caribvision helper skipped reason=login-required pageUrl=$pageUrl")
            }
            if (state.playerVisible) {
                GvLogger.i(
                    "GvMedia",
                    "caribvision session likely-authenticated reason=player-visible pageUrl=$pageUrl hasExactHls=${payload.optBoolean("hasExactHls")} hasDirectLiveId=${payload.optBoolean("hasDirectLiveId")}"
                )
                GvLogger.i("GvMedia", "caribvision helper active reason=player-visible pageUrl=$pageUrl")
            }
            return
        }
        if (type == "caribvision-play-assist") {
            val active = payload.optBoolean("active")
            val requiresUserAction = payload.optBoolean("requiresUserAction", false)
            val targetKind = payload.optString("targetKind")
            val state = CaribvisionPlayAssistState(
                active = active,
                requiresUserAction = requiresUserAction,
                centerX = payload.optDouble("centerX", -1.0).toFloat(),
                centerY = payload.optDouble("centerY", -1.0).toFloat(),
                xRatio = payload.optDouble("xRatio", -1.0).toFloat(),
                yRatio = payload.optDouble("yRatio", -1.0).toFloat(),
                reason = payload.optString("assistReason", payload.optString("reason")),
                targetKind = targetKind,
                targetLabel = payload.optString("targetLabel"),
                pageUrl = pageUrl,
                viewportWidth = payload.optDouble("viewportWidth", 0.0).toFloat(),
                viewportHeight = payload.optDouble("viewportHeight", 0.0).toFloat(),
                hasVideo = payload.optBoolean("hasVideo"),
                paused = payload.optBoolean("paused", true),
                muted = payload.optBoolean("muted"),
                volume = payload.optDouble("volume", 1.0).toFloat(),
                readyState = payload.optInt("readyState"),
                currentTime = payload.optDouble("currentTime"),
                videoWidth = payload.optInt("videoWidth"),
                videoHeight = payload.optInt("videoHeight"),
            )
            if (active) {
                caribvisionPlayAssistBySession[session] = state
            } else {
                caribvisionPlayAssistBySession.remove(session)
            }
            GvLogger.i(
                "GvMedia",
                "caribvision play assist target measured x=${state.centerX.toInt()} y=${state.centerY.toInt()} label=${state.targetLabel.ifBlank { targetKind }} reason=${state.reason} pageUrl=$pageUrl rect=${payload.optString("rect")} playerRect=${payload.optString("playerRect")} active=$active playing=${payload.optBoolean("playing")} paused=${payload.optBoolean("paused")} muted=${payload.optBoolean("muted")} volume=${payload.optDouble("volume", 1.0)} readyState=${payload.optInt("readyState")} currentTime=${payload.optDouble("currentTime")} size=${payload.optInt("videoWidth")}x${payload.optInt("videoHeight")} mutedBefore=${payload.optBoolean("mutedBefore")} mutedAfter=${payload.optBoolean("mutedAfter")} volumeBefore=${payload.optDouble("volumeBefore", 1.0)} volumeAfter=${payload.optDouble("volumeAfter", 1.0)} unmuteMethods=${payload.optString("unmuteMethods")}"
            )
            if (active) {
                dispatchCaribvisionPlayAssistNativeTap(session, state, trigger = "auto")
            }
            return
        }
        if (type == "caribvision-fullscreen-assist") {
            val active = payload.optBoolean("active")
            val requestNativeTap = payload.optBoolean("requestNativeTap", false)
            val targetKind = payload.optString("targetKind")
            val suppressed = isCaribvisionFullscreenAssistSuppressed(session, pageUrl)
            val state = CaribvisionFullscreenAssistState(
                active = active,
                centerX = payload.optDouble("centerX", -1.0).toFloat(),
                centerY = payload.optDouble("centerY", -1.0).toFloat(),
                xRatio = payload.optDouble("xRatio", -1.0).toFloat(),
                yRatio = payload.optDouble("yRatio", -1.0).toFloat(),
                audioCenterX = payload.optDouble("audioCenterX", -1.0).toFloat(),
                audioCenterY = payload.optDouble("audioCenterY", -1.0).toFloat(),
                audioXRatio = payload.optDouble("audioXRatio", -1.0).toFloat(),
                audioYRatio = payload.optDouble("audioYRatio", -1.0).toFloat(),
                reason = payload.optString("assistReason", payload.optString("reason")),
                targetKind = targetKind,
                targetLabel = payload.optString("targetLabel"),
                audioTargetKind = payload.optString("audioTargetKind"),
                audioTargetLabel = payload.optString("audioTargetLabel"),
                pageUrl = pageUrl,
                viewportWidth = payload.optDouble("viewportWidth", 0.0).toFloat(),
                viewportHeight = payload.optDouble("viewportHeight", 0.0).toFloat(),
                fullscreenActive = payload.optBoolean("fullscreenActive"),
            )
            if (active || state.fullscreenActive) {
                caribvisionFullscreenAssistBySession[session] = state
            } else {
                caribvisionFullscreenAssistBySession.remove(session)
            }
            if (state.centerX >= 0f && state.centerY >= 0f) {
                GvLogger.i(
                    "GvMedia",
                    "caribvision fullscreen target measured source=$targetKind x=${state.centerX.toInt()} y=${state.centerY.toInt()} pageUrl=$pageUrl rect=${payload.optString("rect")} playerRect=${payload.optString("playerRect")} label=${state.targetLabel.ifBlank { targetKind }} audioTarget=${state.audioTargetLabel.ifBlank { state.audioTargetKind }} audioX=${state.audioCenterX.toInt()} audioY=${state.audioCenterY.toInt()} active=$active requestNativeTap=$requestNativeTap fullscreenActive=${state.fullscreenActive} suppressedAfterBack=$suppressed audioDomClicked=${payload.optBoolean("audioDomClicked")} fullscreenDomClicked=${payload.optBoolean("fullscreenDomClicked")} playing=${payload.optBoolean("playing")} paused=${payload.optBoolean("paused")} muted=${payload.optBoolean("muted")} volume=${payload.optDouble("volume", 1.0)} playbackPrimed=${payload.optBoolean("playbackPrimed")} audioPrimed=${payload.optBoolean("audioPrimed")} readyState=${payload.optInt("readyState")} currentTime=${payload.optDouble("currentTime")}"
                )
            }
            if (suppressed) {
                GvLogger.i(
                    "GvMedia",
                    "caribvision fullscreen assist skipped reason=suppressed-after-back pageUrl=$pageUrl targetKind=$targetKind"
                )
                return
            }
            if (active && requestNativeTap && !state.fullscreenActive) {
                dispatchCaribvisionFullscreenAssistNativeTap(session, state, trigger = "auto")
            }
            return
        }
        if (type == "cgtv-transport-lock") {
            GvLogger.i(
                "GvMedia",
                "cgtv transport lock applied=${payload.optBoolean("applied")} reason=${payload.optString("reason")} pageUrl=$pageUrl"
            )
            return
        }
        if (type == "cgtv-page-fullscreen-like") {
            GvLogger.i(
                "GvMedia",
                "cgtv page fullscreen-like phase=${payload.optString("phase")} reason=${payload.optString("reason")} " +
                    "applied=${payload.optBoolean("applied")} pageUrl=$pageUrl attemptAtMs=${payload.optLong("attemptAtMs")} " +
                    "scrollY=${payload.optDouble("scrollYBefore")}->${payload.optDouble("scrollYAfter")} deltaY=${payload.optDouble("deltaY")} " +
                    "iframeRect=${payload.optString("iframeRect")} iframe=${payload.optString("iframeSummary")}"
            )
            return
        }
        if (type == "viewport-compat") {
            GvLogger.i(
                "GvLayout",
                "viewport compat applied pageUrl=$pageUrl viewport=${payload.optInt("viewportWidth")}x${payload.optInt("viewportHeight")} dpr=${payload.optDouble("devicePixelRatio")} meta=${payload.optString("viewportMeta")}"
            )
            return
        }
        if (type == "visual-scale-compat") {
            GvLogger.i(
                "GvLayout",
                "visual scale compat applied pageUrl=$pageUrl scale=${payload.optDouble("scale")} bodyWidth=${payload.optString("bodyWidth")} bodyTransform=${payload.optString("bodyTransform")} heroCopyWidth=${payload.optString("heroCopyWidth")} viewport=${payload.optInt("viewportWidth")}x${payload.optInt("viewportHeight")} dpr=${payload.optDouble("devicePixelRatio")}"
            )
            return
        }
        if (type == "caribvision-live-hls-ready") {
            val sourceUrl = payload.optString("sourceUrl").trim()
            val sourceType = payload.optString("sourceType")
            val muted = payload.optBoolean("muted")
            val autoplay = payload.optBoolean("autoplay")
            GvLogger.i(
                "GvMedia",
                "caribvision live hls ready pageUrl=$pageUrl playerId=${payload.optString("playerId")} sourceType=$sourceType muted=$muted autoplay=$autoplay sourceUrl=$sourceUrl"
            )
            GvLogger.i("GvMedia", "caribvision native promote skipped reason=browser-helper sourceUrl=$sourceUrl")
            return
        }
        if (type == "cbc-live-hls-ready") {
            val sourceUrl = payload.optString("sourceUrl").trim()
            val sourceType = payload.optString("sourceType")
            val autoplay = payload.optBoolean("autoplay")
            val controls = payload.optBoolean("controls")
            val playsinline = payload.optBoolean("playsinline")
            GvLogger.i(
                "GvMedia",
                "cbc live hls ready pageUrl=$pageUrl playerId=${payload.optString("playerId")} sourceType=$sourceType autoplay=$autoplay controls=$controls playsinline=$playsinline sourceUrl=$sourceUrl"
            )
            if (!isCbcLivePageUrl(pageUrl)) {
                GvLogger.i("GvMedia", "cbc native promote skipped reason=page-context pageUrl=$pageUrl")
                return
            }
            if (!isExactCbcLiveHlsUrl(sourceUrl)) {
                GvLogger.i("GvMedia", "cbc native promote skipped reason=non-exact-hls sourceUrl=$sourceUrl")
                return
            }
            if (isDirectMediaPromotionSuppressed(sourceUrl)) {
                GvLogger.i("GvMedia", "cbc native promote deferred reason=suppressed-after-back sourceUrl=$sourceUrl")
                geckoView.visibility = View.VISIBLE
                return
            }
            val observation = mediaPathController.onExtensionMediaEvidence(
                pageUrl = pageUrl,
                sourceUrl = sourceUrl,
                mimeType = if (sourceType.isBlank()) "application/x-mpegURL" else sourceType,
                title = title,
            )
            if (observation == null) {
                GvLogger.i("GvMedia", "cbc native promote skipped reason=observation-null sourceUrl=$sourceUrl")
                return
            }
            GvLogger.i("GvMedia", "cbc native promote allowed exact-hls sourceUrl=$sourceUrl")
            if (tabController.getActiveTab()?.session == session) {
                if (isExactCbcLiveHlsUrl(promotedMediaPlayer.currentSourceUrl().orEmpty())) {
                    GvLogger.i("GvMedia", "cbc native promote skipped reason=already-active sourceUrl=$sourceUrl")
                    return
                }
                geckoView.visibility = View.GONE
                promotedMediaPlayer.play(observation)
                applyNativePromotedInputPolicyIfCbc(sourceUrl)
            }
            return
        }
        if (isFacebookUrl(pageUrl)) {
            GvLogger.i(
                "GvExt",
                "media evidence ignored tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} pageUrl=$pageUrl reason=facebook-host"
            )
            return
        }
        if (isCaribVisionAppUrl(pageUrl)) {
            for (index in 0 until candidates.length()) {
                val candidate = candidates.optJSONObject(index) ?: continue
                val sourceUrl = candidate.optString("src").trim()
                if (!isExactCaribVisionLiveHlsUrl(sourceUrl)) continue
                GvLogger.i("GvMedia", "caribvision native promote skipped reason=browser-helper sourceUrl=$sourceUrl")
                return
            }
        }
        if (isCbcLivePageUrl(pageUrl)) {
            for (index in 0 until candidates.length()) {
                val candidate = candidates.optJSONObject(index) ?: continue
                val sourceUrl = candidate.optString("src").trim()
                if (!isExactCbcLiveHlsUrl(sourceUrl)) continue
                if (isDirectMediaPromotionSuppressed(sourceUrl)) {
                    GvLogger.i("GvMedia", "cbc native promote deferred reason=suppressed-after-back sourceUrl=$sourceUrl")
                    geckoView.visibility = View.VISIBLE
                    return
                }
                val observation = mediaPathController.onExtensionMediaEvidence(
                    pageUrl = pageUrl,
                    sourceUrl = sourceUrl,
                    mimeType = "application/x-mpegURL",
                    title = title,
                )
                if (observation == null) {
                    GvLogger.i("GvMedia", "cbc native promote skipped reason=observation-null sourceUrl=$sourceUrl")
                    return
                }
                GvLogger.i("GvMedia", "cbc native promote allowed exact-hls sourceUrl=$sourceUrl")
                if (tabController.getActiveTab()?.session == session) {
                    if (isExactCbcLiveHlsUrl(promotedMediaPlayer.currentSourceUrl().orEmpty())) {
                        GvLogger.i("GvMedia", "cbc native promote skipped reason=already-active sourceUrl=$sourceUrl")
                        return
                    }
                    geckoView.visibility = View.GONE
                    promotedMediaPlayer.play(observation)
                    applyNativePromotedInputPolicyIfCbc(sourceUrl)
                }
                return
            }
        }
        if (isCvc9DailymotionBrowserPlayerContextUrl(pageUrl)) {
            GvLogger.i(
                "GvMedia",
                "cvc9 native promote skipped reason=dailymotion-browser-player pageUrl=$pageUrl currentUrl=$currentUrl"
            )
            promotedMediaPlayer.stop(reason = "cvc9-dailymotion-browser-player")
            geckoView.visibility = View.VISIBLE
            return
        }
        if (isCnc3DailymotionPlayerUrl(pageUrl)) {
            GvLogger.i(
                "GvMedia",
                "cnc3 native promote skipped reason=dailymotion-page-player pageUrl=$pageUrl"
            )
            promotedMediaPlayer.stop(reason = "cnc3-dailymotion-page-player")
            geckoView.visibility = View.VISIBLE
            return
        }
        if (isGbnDailymotionBrowserPlayerContextUrl(pageUrl)) {
            GvLogger.i(
                "GvMedia",
                "gbn native promote skipped reason=dailymotion-browser-player pageUrl=$pageUrl currentUrl=$currentUrl"
            )
            promotedMediaPlayer.stop(reason = "gbn-dailymotion-browser-player")
            geckoView.visibility = View.VISIBLE
            return
        }
        if (!shouldPromoteDirectMedia(pageUrl)) {
            GvLogger.i(
                "GvExt",
                "media evidence ignored tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} pageUrl=$pageUrl reason=live-media-surface"
            )
            return
        }
        val cgtvSelection = selectCgtvCandidate(pageUrl, candidates)
        if (cgtvSelection != null) {
            GvLogger.i(
                "GvMedia",
                "cgtv promoted player-first skipped reason=native-player-disabled url=${cgtvSelection.sourceUrl}"
            )
            geckoView.visibility = View.VISIBLE
            restoreCgtvPointerIfHidden(reason = "native-player-disabled")
            return
        }
        if (isCgtvContextUrl(pageUrl) && candidates.length() > 0) {
            val fallbackUrl = candidates.optJSONObject(0)?.optString("src").orEmpty()
            GvLogger.i(
                "GvMedia",
                "cgtv promoted player-first skipped reason=wrong-layer url=$fallbackUrl"
            )
            restoreCgtvPointerIfHidden(reason = "wrong-layer")
            return
        }
        for (index in 0 until candidates.length()) {
            val candidate = candidates.optJSONObject(index) ?: continue
            val sourceUrl = candidate.optString("src")
            val mimeType = candidate.optString("mimeType").ifBlank { null }
            val observation = mediaPathController.onExtensionMediaEvidence(
                pageUrl = pageUrl,
                sourceUrl = sourceUrl,
                mimeType = mimeType,
                title = title,
            ) ?: continue
            if (tabController.getActiveTab()?.session == session) {
                handleMediaObservation(observation)
            }
            break
        }
    }

    private companion object {
        // Modern Sony Bravia UA from MkII successful run
        private const val SONY_BRAVIA_USER_AGENT =
            "Mozilla/5.0 (X11; Linux x86_64; BRAVIA 4K VH2 Build/STT2.230505.001.S100) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.7680.119 " +
            "Safari/537.36 SonyCEBrowser/1.0 KulchaFloTVMkII/2.0"
// Chrome UA - previous baseline for A/B comparison
        private const val FACEBOOK_DESKTOP_USER_AGENT_CHROME =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        // Firefox UA - default browser identity for normal browsing and Facebook.
        private const val DESKTOP_FIREFOX_USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0"
        private const val FACEBOOK_PASSIVE_DIAGNOSTIC_MODE = true
        // Facebook active DOM helpers are intentionally disabled. Firefox desktop UA plus passive source-attach monitoring is the current strategy.
        private const val FACEBOOK_ACTIVE_HELPERS_ENABLED = 0
        private const val FACEBOOK_COOKIE_CONSENT_ALLOW_ALL_AUTOCLICK_ENABLED = 1
        private const val FACEBOOK_LOGIN_MODAL_CLOSE_AFTER_ATTACH_ENABLED = 1
        private const val FACEBOOK_BOTTOM_LOGIN_BAR_COSMETIC_HIDE_ENABLED = 1
        private const val KULCHAFLO_COOKIE_CONSENT_ACCEPT_ALL_AUTOCLICK_ENABLED = true
        private const val TTT_CONSENT_AUTOCLICK_ENABLED = true
        private const val ENABLE_CVM_VIMEO_DIAGNOSTIC = false
        private const val ENABLE_CVM_VIMEO_AUTOPLAY_PERMISSION_ALLOW = true
        private const val ENABLE_ABS_TEGO_AUTOPLAY_PERMISSION_ALLOW = true
        private const val ENABLE_TTT_TEGO_AUTOPLAY_PERMISSION_ALLOW = true
        private const val ENABLE_NOVUS_TELEARUBA_AUTOPLAY_PERMISSION_ALLOW = true
        private const val ENABLE_CGTV_AUTOPLAY_PERMISSION_ALLOW = true
        private const val ENABLE_CHTV_AUTOPLAY_PERMISSION_ALLOW = true
        private const val ENABLE_CARIBVISION_AUTOPLAY_PERMISSION_ALLOW = true
        private const val ENABLE_CNC3_DAILYMOTION_AUTOPLAY_PERMISSION_ALLOW = true
        private const val ENABLE_CVC9_DAILYMOTION_AUTOPLAY_PERMISSION_ALLOW = true
        private const val ENABLE_GBN_DAILYMOTION_AUTOPLAY_PERMISSION_ALLOW = true
        private const val CVC9_DAILYMOTION_WATCH_PAGE_URL = "https://www.dailymotion.com/video/x7gy059"
        private const val ENABLE_ABS_TEGO_GESTURE_FULLSCREEN_RETRY = false
        private const val ENABLE_ABS_TEGO_NATIVE_F_FULLSCREEN = false
        private const val ENABLE_ABS_TEGO_FULLSCREEN_NATIVE_TAP_FALLBACK = false
        private val ABS_TEGO_STARTUP_REPROBE_DELAYS_MS = longArrayOf(2_000L, 5_000L, 9_000L, 14_000L)
        private const val ABS_TEGO_RETURN_URL = "https://kulchaflo.com/channels/abs-tv-antigua/"
        private const val TTT_TEGO_RETURN_URL = "https://kulchaflo.com/channels/ttt-live-official-24-7-stream/"
        private const val CARIBVISION_OFFICIAL_HLS_HOST = "5dcabf026b188.streamlock.net"
        private const val CARIBVISION_OFFICIAL_HLS_PATH = "/CaribVision/livestream/playlist.m3u8"
        private const val CBC_OFFICIAL_HLS_HOST = "1740288887.rsc.cdn77.org"
        private const val CBC_OFFICIAL_HLS_PATH = "/1740288887/index.m3u8"

        private const val PROMPT_PREFIX = "__GV_MEDIA__"
        private const val STATE_URL = "state_url"
        private const val STATE_TAB_URLS = "state_tab_urls"
        private const val STATE_ACTIVE_TAB_INDEX = "state_active_tab_index"
        private const val TRANSIENT_LOAD_ERROR_CATEGORY = 5
        private const val TRANSIENT_LOAD_ERROR_CODE = 37
        private const val MAX_TRANSIENT_LOAD_RETRIES = 2
        private const val RETRY_DELAY_BASE_MS = 800L
        private const val BACK_EXIT_CONFIRM_WINDOW_MS = 2200L
        private const val BACK_RETURN_HOME_CONFIRM_WINDOW_MS = 2200L
        private const val FACEBOOK_COMPAT_DISPATCH_MIN_INTERVAL_MS = 350L
        private const val FACEBOOK_PASSIVE_MAX_ATTEMPTS = 6
        private const val FACEBOOK_PASSIVE_REENTRY_MIN_ADVANCED_TIME_SECONDS = 0.25
        private const val FACEBOOK_VIDEO_HELPER_MAX_ATTEMPTS_PER_URL = 6
        private const val FACEBOOK_VIDEO_HELPER_MAX_MUTE_TAPS_PER_URL = 1
        private const val FACEBOOK_VIDEO_HELPER_MAX_VOLUME_BOOST_TAPS_PER_URL = 1
        private const val FACEBOOK_VIDEO_HELPER_MAX_FULLSCREEN_TAPS_PER_URL = 2
        private const val FACEBOOK_VIDEO_HELPER_MAX_CONTROLS_HOVER_ATTEMPTS_PER_URL = 3
        private const val FACEBOOK_VIDEO_HELPER_MAX_CONTROLS_REVEAL_HOVERS_BEFORE_FULLSCREEN = 1
        private const val FACEBOOK_VIDEO_HELPER_MAX_FULLSCREEN_CALLBACK_CHECKS_PER_URL = 2
        private const val FACEBOOK_VIDEO_HELPER_COOLDOWN_MS = 1600L
        private const val FACEBOOK_VIDEO_HELPER_RETRY_DELAY_MS = 1500L
        private const val FACEBOOK_VIDEO_HELPER_REVEAL_RETRY_DELAY_MS = 700L
        private const val FACEBOOK_VIDEO_HELPER_POST_VOLUME_BOOST_DELAY_MS = 1_000L
        private const val FACEBOOK_VIDEO_HELPER_FULLSCREEN_HOVER_SETTLE_DELAY_MS = 320L
        private const val FACEBOOK_VIDEO_HELPER_FULLSCREEN_CHECK_DELAY_MS = 1_400L
        private const val FACEBOOK_VIDEO_HELPER_STAGE_SOUND = "sound"
        private const val FACEBOOK_VIDEO_HELPER_STAGE_FULLSCREEN_PENDING = "fullscreen-pending"
        private const val FACEBOOK_VIDEO_HELPER_STAGE_SEQUENCE_COMPLETE = "sequence-complete"
        private const val POINTER_INITIAL_REPEAT_DELAY_MS = 110L
        private const val POINTER_REPEAT_FRAME_MS = 16L
        private const val POINTER_MOVE_STEP_PX = 18f
        private const val EDGE_PADDING_PX = 8f
        private const val EDGE_SCROLL_MULTIPLIER = 2.0f
        private const val ENABLE_DPAD_DOCUMENT_SCROLL_FALLBACK = true
        private const val DPAD_DOCUMENT_SCROLL_FALLBACK_MIN_INTERVAL_MS = 120L
        private const val ENABLE_KULCHAFLO_HOMEPAGE_RAIL_HOVER_SCROLL = true
        private const val KULCHAFLO_RAIL_HOVER_SCROLL_MULTIPLIER = 2.2f
        private const val KULCHAFLO_RAIL_HOVER_SCROLL_MIN_STEP_PX = 24
        private const val KULCHAFLO_RAIL_HOVER_SCROLL_MIN_INTERVAL_MS = 70L
        private const val CVM_VIMEO_DIAGNOSTIC_MIN_INTERVAL_MS = 150L
        private const val INTERACTION_WAKE_PULSE_MIN_INTERVAL_MS = 120L
        private val LIVE_LOAD_TIMING_CHECKPOINTS_MS = longArrayOf(5_000L, 30_000L, 90_000L, 180_000L)
        private const val POINTER_IDLE_HIDE_MS = 3500L
        private val YOUTUBE_POINTER_IDLE_HIDE_MS = YouTubePolicyConstants.YOUTUBE_POINTER_IDLE_HIDE_MS
        private val BROWSER_FULLSCREEN_POINTER_IDLE_HIDE_MS = YouTubePolicyConstants.BROWSER_FULLSCREEN_POINTER_IDLE_HIDE_MS
        private val YOUTUBE_AUTO_FULLSCREEN_SUPPRESS_AFTER_BACK_MS = YouTubePolicyConstants.YOUTUBE_AUTO_FULLSCREEN_SUPPRESS_AFTER_BACK_MS
        private val YOUTUBE_FULLSCREEN_CHAT_COLLAPSE_MIN_INTERVAL_MS = YouTubePolicyConstants.YOUTUBE_FULLSCREEN_CHAT_COLLAPSE_MIN_INTERVAL_MS
        private val YOUTUBE_PREMIUM_POPUP_MAX_CHECKS_LOCATION_WINDOW = YouTubePolicyConstants.YOUTUBE_PREMIUM_POPUP_MAX_CHECKS_LOCATION_WINDOW
        private val YOUTUBE_PREMIUM_POPUP_MAX_CHECKS_FULLSCREEN_WINDOW = YouTubePolicyConstants.YOUTUBE_PREMIUM_POPUP_MAX_CHECKS_FULLSCREEN_WINDOW
        private val YOUTUBE_PREMIUM_POPUP_DISMISS_COOLDOWN_MS = YouTubePolicyConstants.YOUTUBE_PREMIUM_POPUP_DISMISS_COOLDOWN_MS
        private val YOUTUBE_PREMIUM_POPUP_INTERACTION_BURST_MIN_INTERVAL_MS = YouTubePolicyConstants.YOUTUBE_PREMIUM_POPUP_INTERACTION_BURST_MIN_INTERVAL_MS
        private val YOUTUBE_QUALITY_HELPER_MAX_ATTEMPTS_PER_URL = YouTubePolicyConstants.YOUTUBE_QUALITY_HELPER_MAX_ATTEMPTS_PER_URL
        private val YOUTUBE_QUALITY_HELPER_COOLDOWN_MS = YouTubePolicyConstants.YOUTUBE_QUALITY_HELPER_COOLDOWN_MS
        private val YOUTUBE_QUALITY_HELPER_VERIFY_FOLLOW_UP_DELAY_MS = YouTubePolicyConstants.YOUTUBE_QUALITY_HELPER_VERIFY_FOLLOW_UP_DELAY_MS
        // YouTube smart auto-fullscreen timing constants (media-ready policy)
        private val YOUTUBE_AUTO_FULLSCREEN_AFTER_MEDIA_READY_MS = YouTubePolicyConstants.YOUTUBE_AUTO_FULLSCREEN_AFTER_MEDIA_READY_MS
        private val YOUTUBE_AUTO_FULLSCREEN_RETRY_1_MS = YouTubePolicyConstants.YOUTUBE_AUTO_FULLSCREEN_RETRY_1_MS
        private val YOUTUBE_AUTO_FULLSCREEN_RETRY_2_MS = YouTubePolicyConstants.YOUTUBE_AUTO_FULLSCREEN_RETRY_2_MS
        private val YOUTUBE_AUTO_FULLSCREEN_ABSOLUTE_FALLBACK_MS = YouTubePolicyConstants.YOUTUBE_AUTO_FULLSCREEN_ABSOLUTE_FALLBACK_MS
        private val YOUTUBE_AUTO_FULLSCREEN_CALLBACK_WAIT_MS = YouTubePolicyConstants.YOUTUBE_AUTO_FULLSCREEN_CALLBACK_WAIT_MS
        private val YOUTUBE_AUTO_FULLSCREEN_CONTROLS_REVEAL_TO_BUTTON_DELAY_MS = YouTubePolicyConstants.YOUTUBE_AUTO_FULLSCREEN_CONTROLS_REVEAL_TO_BUTTON_DELAY_MS
        private val YOUTUBE_AUTO_FULLSCREEN_TARGET_PROBE_TIMEOUT_MS = YouTubePolicyConstants.YOUTUBE_AUTO_FULLSCREEN_TARGET_PROBE_TIMEOUT_MS
        private val YOUTUBE_AUTO_FULLSCREEN_TARGET_PROBE_RETRY_DELAY_MS = YouTubePolicyConstants.YOUTUBE_AUTO_FULLSCREEN_TARGET_PROBE_RETRY_DELAY_MS
        private val YOUTUBE_AUTO_FULLSCREEN_TARGET_PROBE_MAX_PASSES_PER_ATTEMPT = YouTubePolicyConstants.YOUTUBE_AUTO_FULLSCREEN_TARGET_PROBE_MAX_PASSES_PER_ATTEMPT
        private val YOUTUBE_AUTO_FULLSCREEN_OVERLAY_RETRY_DELAY_MS = YouTubePolicyConstants.YOUTUBE_AUTO_FULLSCREEN_OVERLAY_RETRY_DELAY_MS
        private val YOUTUBE_AUTO_FULLSCREEN_AD_DEFER_DELAY_MS = YouTubePolicyConstants.YOUTUBE_AUTO_FULLSCREEN_AD_DEFER_DELAY_MS
        private val YOUTUBE_AUTO_FULLSCREEN_MAX_OVERLAY_DEFERRALS = YouTubePolicyConstants.YOUTUBE_AUTO_FULLSCREEN_MAX_OVERLAY_DEFERRALS
        private val YOUTUBE_AUTO_FULLSCREEN_MAX_ATTEMPTS = YouTubePolicyConstants.YOUTUBE_AUTO_FULLSCREEN_MAX_ATTEMPTS
        private val YOUTUBE_FULLSCREEN_CONTROLS_REVEAL_X_RATIO = YouTubePolicyConstants.YOUTUBE_FULLSCREEN_CONTROLS_REVEAL_X_RATIO
        private val YOUTUBE_FULLSCREEN_CONTROLS_REVEAL_Y_RATIO = YouTubePolicyConstants.YOUTUBE_FULLSCREEN_CONTROLS_REVEAL_Y_RATIO
        private val YOUTUBE_FULLSCREEN_BUTTON_X_RATIO = YouTubePolicyConstants.YOUTUBE_FULLSCREEN_BUTTON_X_RATIO
        private val YOUTUBE_FULLSCREEN_BUTTON_Y_RATIO = YouTubePolicyConstants.YOUTUBE_FULLSCREEN_BUTTON_Y_RATIO
        private val YOUTUBE_FULLSCREEN_CONTROLS_REVEAL_X_FALLBACK = YouTubePolicyConstants.YOUTUBE_FULLSCREEN_CONTROLS_REVEAL_X_FALLBACK
        private val YOUTUBE_FULLSCREEN_CONTROLS_REVEAL_Y_FALLBACK = YouTubePolicyConstants.YOUTUBE_FULLSCREEN_CONTROLS_REVEAL_Y_FALLBACK
        private val YOUTUBE_FULLSCREEN_BUTTON_X_FALLBACK = YouTubePolicyConstants.YOUTUBE_FULLSCREEN_BUTTON_X_FALLBACK
        private val YOUTUBE_FULLSCREEN_BUTTON_Y_FALLBACK = YouTubePolicyConstants.YOUTUBE_FULLSCREEN_BUTTON_Y_FALLBACK
        private const val DIRECT_MEDIA_PROMOTION_SUPPRESSION_MS = 15_000L
        private const val CGTV_PLAY_ASSIST_NATIVE_TAP_MIN_INTERVAL_MS = 1800L
        private const val CGTV_PLAY_ASSIST_AUTO_TAP_LIMIT = 2
        private const val CHTV_PLAY_ASSIST_NATIVE_TAP_MIN_INTERVAL_MS = 1800L
        private const val CHTV_PLAY_ASSIST_AUTO_TAP_LIMIT = 2
        private const val CHTV_FULLSCREEN_ASSIST_NATIVE_TAP_MIN_INTERVAL_MS = 1800L
        private const val CHTV_FULLSCREEN_ASSIST_AUTO_TAP_LIMIT = 2
        private const val CARIBVISION_PLAY_ASSIST_NATIVE_TAP_MIN_INTERVAL_MS = 1800L
        private const val CARIBVISION_PLAY_ASSIST_AUTO_TAP_LIMIT = 2
        private const val CARIBVISION_FULLSCREEN_ASSIST_NATIVE_TAP_MIN_INTERVAL_MS = 800L
        private const val CARIBVISION_FULLSCREEN_ASSIST_AUTO_TAP_LIMIT = 2
        private const val CARIBVISION_FULLSCREEN_CHECK_DELAY_MS = 1400L
        private const val CARIBVISION_FULLSCREEN_STAGE_NOT_STARTED = "fullscreen-not-started"
        private const val CARIBVISION_FULLSCREEN_STAGE_PENDING = "fullscreen-pending"
        private const val CARIBVISION_FULLSCREEN_STAGE_ENTERED = "fullscreen-entered"
        private const val CARIBVISION_FULLSCREEN_STAGE_FAILED = "fullscreen-failed"
        private val CVC9_CONSENT_FRAME_NATIVE_TAP_BURST_DELAYS_MS =
            longArrayOf(0L, 150L, 300L, 450L, 600L, 750L, 900L, 1050L, 1200L)
        // Fallback timeout used to release CGTV play-assist state if page-side playing=true
        // does not arrive within this window after an assisted native tap.
        private const val CGTV_PLAY_ASSIST_FALLBACK_TIMEOUT_MS = 5000L
        private const val GLOBAL_SITE_SCALE = 0.76
        private const val GLOBAL_WIDTH_COMPENSATION = 1.14
        private const val EXTRA_URL = "url"
        private const val CONSENT_DEFAULT_DECISION = "allow"
        private val CONSENT_CONTEXT_KEYWORDS = listOf(
            "cookie",
            "consent",
            "privacy",
            "gdpr",
            "tracking",
        )
        private val CONSENT_DENY_LABELS = listOf(
            "reject",
            "reject all",
            "decline",
            "essential only",
            "only essential",
            "necessary only",
            "continue without accepting",
            "do not accept",
            "no thanks",
            "not now",
            "cancel",
        )
        private val CONSENT_ALLOW_LABELS = listOf(
            "accept",
            "accept all",
            "allow all",
            "agree",
            "i agree",
        )
        private val POINTER_KEY_CODES = setOf(
            KeyEvent.KEYCODE_DPAD_LEFT,
            KeyEvent.KEYCODE_DPAD_RIGHT,
            KeyEvent.KEYCODE_DPAD_UP,
            KeyEvent.KEYCODE_DPAD_DOWN,
            KeyEvent.KEYCODE_DPAD_CENTER,
            KeyEvent.KEYCODE_ENTER,
        )
        private val POINTER_DIRECTION_KEYS = setOf(
            KeyEvent.KEYCODE_DPAD_LEFT,
            KeyEvent.KEYCODE_DPAD_RIGHT,
            KeyEvent.KEYCODE_DPAD_UP,
            KeyEvent.KEYCODE_DPAD_DOWN,
        )
    }

    private fun isKulchaFloHomepage(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val host = uri.host?.lowercase() ?: return false
        if (!(host == "kulchaflo.com" || host == "www.kulchaflo.com")) {
            return false
        }
        val path = uri.path ?: "/"
        return path == "/" || path.isBlank()
    }

    private fun isKulchaFloPage(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase()?.removePrefix("www.") ?: return false
        return host == "kulchaflo.com"
    }

    private fun isCbnVirginIslandsLivePageUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase()?.removePrefix("www.") ?: return false
        if (host != "cbnvirginislands.com") {
            return false
        }
        val path = uri.encodedPath.orEmpty().lowercase()
        return path == "/cbn-tv" || path.startsWith("/cbn-tv/")
    }

    private fun isCnc3LiveStreamPageUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        if (host != "cnc3.co.tt") {
            return false
        }
        val path = uri.encodedPath.orEmpty().lowercase()
        return path == "/live-stream" || path.startsWith("/live-stream/")
    }

    private fun isCnc3DailymotionPlayerUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        if (host != "geo.dailymotion.com") {
            return false
        }
        val path = uri.encodedPath.orEmpty().lowercase()
        val videoId = uri.getQueryParameter("video").orEmpty().lowercase()
        return path.startsWith("/player/") && videoId == "x9vba4u"
    }

    private fun isCnc3DailymotionMediaUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty()
        val path = uri.encodedPath.orEmpty().lowercase()
        return host.endsWith("dailymotion.com") &&
            path.contains("/video/x9vba4u") &&
            path.endsWith(".m3u8")
    }

    private fun isCnc3ContextUrl(url: String): Boolean {
        return isCnc3LiveStreamPageUrl(url) || isCnc3DailymotionPlayerUrl(url)
    }

    private fun isGbnLivePageUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        if (host != "gbn.gd") {
            return false
        }
        val path = uri.encodedPath.orEmpty().lowercase()
        return path == "/live-television" || path == "/live-television/"
    }

    private fun isGbnDailymotionEmbedPageUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        if (host != "dailymotion.com") {
            return false
        }
        val path = uri.encodedPath.orEmpty().lowercase()
        return path == "/embed/video/x85vz1r" || path.startsWith("/embed/video/x85vz1r/")
    }

    private fun isGbnDailymotionPlayerUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        if (host != "geo.dailymotion.com") {
            return false
        }
        val path = uri.encodedPath.orEmpty().lowercase()
        val videoId = uri.getQueryParameter("video").orEmpty().lowercase()
        val playerPath = path == "/player.html" || path.startsWith("/player/") || path.startsWith("/player.html")
        return playerPath && videoId == "x85vz1r"
    }

    private fun isGbnDailymotionConsentPageUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        return host == "consent.dailymotion.com"
    }

    private fun isGbnContextUrl(url: String): Boolean {
        return isGbnLivePageUrl(url) || isGbnDailymotionEmbedContextUrl(url)
    }

    private fun isGbnDailymotionEmbedContextUrl(url: String): Boolean {
        return isGbnDailymotionEmbedPageUrl(url) || isGbnDailymotionPlayerUrl(url)
    }

    private fun isGbnDailymotionPlayerContextUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty().lowercase()
        return host == "geo.dailymotion.com" &&
            (path == "/player.html" || path.startsWith("/player/") || path.startsWith("/player.html"))
    }

    private fun isGbnDailymotionBrowserPlayerContextUrl(url: String): Boolean {
        val activeUrl = tabController.getActiveTab()?.url.orEmpty()
        val currentContext =
            isGbnLivePageUrl(currentUrl) ||
                isGbnLivePageUrl(activeUrl) ||
                isGbnDailymotionEmbedContextUrl(currentUrl) ||
                isGbnDailymotionEmbedContextUrl(activeUrl) ||
                isGbnDailymotionConsentPageUrl(currentUrl) ||
                isGbnDailymotionConsentPageUrl(activeUrl)
        if (!currentContext) {
            return false
        }
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty().lowercase()
        val videoId = uri.getQueryParameter("video").orEmpty().lowercase()
        return (host == "dailymotion.com" && (path == "/embed/video/x85vz1r" || path.startsWith("/embed/video/x85vz1r/"))) ||
            (host == "geo.dailymotion.com" &&
                (path == "/player.html" || path.startsWith("/player/") || path.startsWith("/player.html")) &&
                (videoId == "x85vz1r" || isGbnLivePageUrl(currentUrl) || isGbnLivePageUrl(activeUrl)))
    }

    private fun isYouTubePageUrl(url: String): Boolean {
        return YouTubeUrlPolicy.isYouTubePageUrl(url)
    }

    private fun isYouTubeConsentPageUrl(url: String): Boolean {
        return YouTubeUrlPolicy.isYouTubeConsentPageUrl(url)
    }

    private fun isYouTubeWatchOrLivePageUrl(url: String): Boolean {
        return YouTubeUrlPolicy.isYouTubeWatchOrLivePageUrl(url)
    }

    private fun applyMediaSessionDelegateForUrl(
        session: GeckoSession,
        url: String?,
        reason: String,
    ) {
        val tabId = tabController.findTabBySession(session)?.id ?: "unknown"
        session.setMediaSessionDelegate(browserMediaController.delegate)
        GvLogger.i("GvMedia", "media delegate enabled tabId=$tabId reason=$reason url=${url.orEmpty()}")
    }

    private fun isFacebookUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        return isFacebookHost(uri.host)
    }

    private fun isFacebookWatchOrVideoPageUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        if (!isFacebookHost(uri.host)) {
            return false
        }
        val path = uri.encodedPath.orEmpty().lowercase()
        if (
            path.contains("/watch") ||
            path.contains("/videos/") ||
            path.startsWith("/video.php") ||
            path.contains("/reel/")
        ) {
            return true
        }
        return uri.getQueryParameter("v").orEmpty().isNotBlank()
    }

    private fun isGoogleVideoSurfaceUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        return isGoogleVideoSurfaceHost(uri.host)
    }

    private fun isWebHttpUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        return scheme == "http" || scheme == "https"
    }

    private fun applyUserAgentPolicyForUrl(
        session: GeckoSession,
        url: String,
        reason: String,
    ) {
        val (targetUa, policyMode) = resolveUserAgentPolicyForUrl(url)
        if (session.settings.userAgentOverride == targetUa) {
            return
        }
        session.settings.userAgentOverride = targetUa
        GvLogger.i(
            "GvNav",
            "ua policy applied tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} " +
                "url=$url uaMode=$policyMode ua=$targetUa reason=$reason"
        )
    }

    private fun resolveUserAgentPolicyForUrl(url: String): Pair<String, String> {
        return when {
            isFacebookUrl(url) -> DESKTOP_FIREFOX_USER_AGENT to "desktop-firefox-facebook"
            shouldUseSonyBraviaUserAgent(url) -> SONY_BRAVIA_USER_AGENT to "sony-bravia-override"
            else -> DESKTOP_FIREFOX_USER_AGENT to "desktop-firefox-default"
        }
    }

    private fun shouldUseSonyBraviaUserAgent(url: String): Boolean {
        // Provider-specific TV UA rollback hook. Keep false until a source proves it needs Sony Bravia identity.
        if (url.isBlank()) {
            return false
        }
        return false
    }

    private fun isFacebookHost(hostValue: String?): Boolean {
        val host = hostValue?.lowercase().orEmpty().removePrefix("www.")
        return host == "facebook.com" || host.endsWith(".facebook.com")
    }

    private fun isGoogleVideoSurfaceHost(hostValue: String?): Boolean {
        val host = hostValue?.lowercase().orEmpty().removePrefix("www.")
        return host == "youtube.com" ||
            host.endsWith(".youtube.com") ||
            host == "youtu.be" ||
            host == "youtube-nocookie.com" ||
            host.endsWith(".youtube-nocookie.com") ||
            host == "googlevideo.com" ||
            host.endsWith(".googlevideo.com") ||
            host == "google.com" ||
            host.endsWith(".google.com")
    }

    private fun isAmazonSurfaceUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        return host == "amazon.co.uk" ||
            host.endsWith(".amazon.co.uk") ||
            host == "amazon.com" ||
            host.endsWith(".amazon.com") ||
            host == "primevideo.com" ||
            host.endsWith(".primevideo.com")
    }

    private fun isTttLiveSurfaceUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        return host == "ttt.live" || host.endsWith(".ttt.live")
    }

    private fun isTttLivePlayerUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty().lowercase()
        return host == "ttt.live" && path.startsWith("/stream")
    }

    private fun isTegoPlayerUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty().lowercase()
        return host == "player.tegotv.com" || path.contains("/player.php")
    }

    private fun isTttTegoPlayerUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty().lowercase()
        if (host != "player.tegotv.com" || !path.contains("/player.php")) {
            return false
        }
        return uri.getQueryParameter("channel")?.trim().orEmpty() == "1"
    }

    private fun isTttOrTegoLivePlayerUrl(url: String): Boolean {
        return isTttLivePlayerUrl(url) || isTttTegoPlayerUrl(url)
    }

    private fun isAbsTegoAutoplayContextUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty().lowercase()
        if (host == "kulchaflo.com" && path.startsWith("/channels/abs-tv-antigua")) {
            return true
        }
        if (host == "abstvradio.com" && path.contains("/live-streaming")) {
            return true
        }
        if (host == "player.tegotv.com" && path.contains("/player.php")) {
            val channel = uri.getQueryParameter("channel")?.trim().orEmpty()
            if (channel.isBlank() || channel == "10") {
                return true
            }
        }
        return false
    }

    private fun isAbsTegoPlayerUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        return host == "player.tegotv.com"
    }

    private fun isAbsTegoChannel10ContextUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty().lowercase()
        if (host == "kulchaflo.com" && path.startsWith("/channels/abs-tv-antigua")) {
            return true
        }
        if (host == "abstvradio.com" && path.contains("/live-streaming")) {
            return true
        }
        if (host == "kulchaflo.com" && path.startsWith("/channels/ttt-live-official-24-7-stream")) {
            return true
        }
        if (host == "ttt.live" && path.startsWith("/stream")) {
            return true
        }
        return isAbsTegoChannel10PlayerUrl(url)
    }

    private fun isAbsTegoGestureFullscreenContextUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty().lowercase()
        if (host == "abstvradio.com" && path.contains("/live-streaming")) {
            return true
        }
        return isAbsTegoChannel10PlayerUrl(url)
    }

    private fun isAbsTegoChannel10PlayerUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        if (host != "player.tegotv.com") {
            return false
        }
        val path = uri.encodedPath.orEmpty().lowercase()
        if (!path.contains("/player.php")) {
            return false
        }
        val channel = uri.getQueryParameter("channel")?.trim().orEmpty()
        return channel.isBlank() || channel == "10" || channel == "1"
    }

    private fun resolveTegoPlayerFirstReturnUrl(profile: String, pageUrl: String): String? {
        return when {
            profile.equals("abs", ignoreCase = true) || isAbsTegoAutoplayContextUrl(pageUrl) -> ABS_TEGO_RETURN_URL
            profile.equals("ttt", ignoreCase = true) || isTttTegoContextUrl(pageUrl) -> TTT_TEGO_RETURN_URL
            else -> null
        }
    }

    private fun isTttTegoContextUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty().lowercase()
        if (host == "kulchaflo.com" && path.startsWith("/channels/ttt-live-official-24-7-stream")) {
            return true
        }
        if (host == "ttt.live" && path.startsWith("/stream")) {
            return true
        }
        if (host == "player.tegotv.com" && path.contains("/player.php")) {
            val channel = uri.getQueryParameter("channel")?.trim().orEmpty()
            return channel == "1"
        }
        return false
    }

    private fun isNovusTelearubaHost(hostValue: String?): Boolean {
        val host = hostValue?.lowercase().orEmpty().removePrefix("www.")
        return host == "novus.telearuba.aw"
    }

    private fun isNovusTelearubaContextUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        if (isNovusTelearubaHost(uri.host)) {
            return true
        }
        return resolveNovusTelearubaIntentFromKulchaFloUrl(url) != null
    }

    private fun isNovusTelearubaPlayerUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        return isNovusTelearubaHost(uri.host)
    }

    private fun resolveNovusTelearubaIntentFromKulchaFloUrl(url: String): NovusTelearubaProfileState? {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return null
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return null
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        if (host != "kulchaflo.com") {
            return null
        }
        val path = uri.encodedPath.orEmpty().lowercase()
        if (!path.startsWith("/channels/")) {
            return null
        }
        val desiredChannel = when {
            path.contains("telearuba") -> "13"
            path.contains("nos-isla") || path.contains("nosisla") -> "23"
            path.contains("aruba-tv") || path.contains("aruba.tv") -> "49"
            else -> return null
        }
        return NovusTelearubaProfileState(
            desiredChannel = desiredChannel,
            returnUrl = url,
        )
    }

    private fun captureNovusTelearubaProfileForSession(
        session: GeckoSession,
        url: String,
        reason: String,
    ) {
        val profile = resolveNovusTelearubaIntentFromKulchaFloUrl(url) ?: run {
            val uri = runCatching { android.net.Uri.parse(url) }.getOrNull()
            if (uri != null && isNovusTelearubaHost(uri.host)) {
                val channel = uri.getQueryParameter("kf_channel")?.trim().orEmpty()
                val returnUrl = uri.getQueryParameter("kf_return")?.trim().orEmpty()
                if ((channel == "13" || channel == "23" || channel == "49") && returnUrl.isNotBlank()) {
                    NovusTelearubaProfileState(desiredChannel = channel, returnUrl = returnUrl)
                } else {
                    null
                }
            } else {
                null
            }
        } ?: return
        novusTelearubaProfileBySession[session] = profile
        GvLogger.i(
            "GvNav",
            "novus telearuba profile active desiredChannel=${profile.desiredChannel} returnUrl=${profile.returnUrl} reason=$reason"
        )
    }

    private fun maybeRewriteNovusTelearubaRequestUrl(
        session: GeckoSession,
        requestUrl: String,
    ): String? {
        val profile = novusTelearubaProfileBySession[session] ?: return null
        val uri = runCatching { android.net.Uri.parse(requestUrl) }.getOrNull() ?: return null
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return null
        }
        if (!isNovusTelearubaHost(uri.host)) {
            return null
        }
        val currentChannel = uri.getQueryParameter("kf_channel")?.trim().orEmpty()
        val currentReturnUrl = uri.getQueryParameter("kf_return")?.trim().orEmpty()
        if (currentChannel == profile.desiredChannel && currentReturnUrl == profile.returnUrl) {
            return null
        }
        val builder = uri.buildUpon()
            .clearQuery()
        val names = uri.queryParameterNames
        for (name in names) {
            if (name.equals("kf_channel", ignoreCase = true) || name.equals("kf_return", ignoreCase = true)) {
                continue
            }
            val values = uri.getQueryParameters(name)
            if (values.isEmpty()) {
                builder.appendQueryParameter(name, "")
            } else {
                values.forEach { value -> builder.appendQueryParameter(name, value) }
            }
        }
        builder.appendQueryParameter("kf_channel", profile.desiredChannel)
        builder.appendQueryParameter("kf_return", profile.returnUrl)
        return builder.build().toString()
    }

    private fun isCvmVimeoDiagnosticUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty().lowercase()
        if (host == "cvmtv.com" && (path.startsWith("/more-pages/cvm-live-stream") || path == "/live" || path.startsWith("/live/"))) {
            return true
        }
        if (isCvmVimeoEmbedUrl(uri)) {
            return true
        }
        if (host == "player.vimeo.com" && path == "/static/proxy.html") {
            return true
        }
        return false
    }

    private fun isCvmLiveStreamUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty().lowercase()
        return host == "cvmtv.com" && (path.startsWith("/more-pages/cvm-live-stream") || path == "/live" || path.startsWith("/live/"))
    }

    private fun isCvmVimeoEmbedUrl(uri: android.net.Uri): Boolean {
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty().lowercase()
        return host == "vimeo.com" && path.startsWith("/event/") && path.endsWith("/embed")
    }

    private fun isCvmVimeoPlayerUrl(url: String): Boolean {
        if (isCvmLiveStreamUrl(url)) {
            return true
        }
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        return isCvmVimeoEmbedUrl(uri)
    }

    private fun isVimeoHostForCvm(hostValue: String?): Boolean {
        val host = hostValue?.lowercase().orEmpty().removePrefix("www.")
        return host == "vimeo.com" || host.endsWith(".vimeo.com")
    }

    private fun liveLoadTimingSurface(url: String): String? {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return null
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return null
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty().lowercase()
        if (isFacebookHost(host) || isYouTubeSurfaceHostForUnifiedCompat(host)) {
            return null
        }
        return when {
            host == "player.tegotv.com" || path.contains("/player.php") -> "tego-player"
            host == "ttt.live" || host.endsWith(".ttt.live") -> "ttt-live"
            host == "abstvradio.com" && path.contains("live-streaming") -> "abs-live"
            host == "novus.telearuba.aw" || host.endsWith(".novus.telearuba.aw") -> "novus-live"
            host == "caribvision.tv" || host.endsWith(".caribvision.tv") -> "caribvision-live"
            host == "cbc.bb" && path.startsWith("/live") -> "cbc-live"
            isCvc9LivePageUrl(url) -> "cvc9-live-page"
            isCvc9DailymotionWatchPageUrl(url) -> "cvc9-dailymotion-watch-page"
            isCnc3LiveStreamPageUrl(url) -> "cnc3-live-stream"
            isCnc3DailymotionPlayerUrl(url) -> "cnc3-dailymotion-player"
            isCvmLiveStreamUrl(url) -> "cvm-vimeo-player"
            isCvmVimeoEmbedUrl(uri) -> "cvm-vimeo-player"
            isLiveMediaSurfaceUrl(url) -> "live-media-surface"
            else -> null
        }
    }

    private fun isFacebookNativeScheme(uriValue: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(uriValue) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme == "http" || scheme == "https" || scheme.isBlank()) {
            return false
        }
        val valueLower = uriValue.lowercase()
        return scheme == "fb" ||
            scheme == "fba" ||
            scheme == "fb-messenger" ||
            scheme == "facebook" ||
            (scheme == "intent" && valueLower.contains("com.facebook.katana"))
    }

    private fun isFacebookRegDialogUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        if (!isFacebookHost(uri.host)) {
            return false
        }
        val path = uri.path?.lowercase().orEmpty()
        if (path != "/reg" && path != "/login") {
            return false
        }
        val entryPoint = uri.getQueryParameter("entry_point")?.lowercase().orEmpty()
        return entryPoint.contains("logged_out")
    }

    private fun shouldApplyUnifiedCompat(url: String): Boolean {
        return unifiedCompatSkipReason(url) == null
    }

    private fun restoreCgtvPointerIfHidden(reason: String) {
        try {
            if (pointerOverlay.visibility == View.VISIBLE) {
                return
            }
            pointerOverlay.visibility = View.VISIBLE
            GvLogger.i("GvInput", "cgtv pointer restored reason=$reason")
        } catch (_: Throwable) {
        }
    }

    private fun resetCgtvPlayAssistAttempt(
        session: GeckoSession,
        reason: String,
        pageUrl: String,
        logWhenEmpty: Boolean = false,
    ) {
        val hadState = cgtvPlayAssistBySession.remove(session) != null ||
            cgtvPlayAssistNativeTapCountBySession.remove(session) != null ||
            cgtvPlayAssistNativeTapLastMsBySession.remove(session) != null ||
            cgtvBrowserPlaybackActiveBySession.remove(session)
        clearCgtvPlayAssistFallback(session)
        if (hadState || logWhenEmpty) {
            GvLogger.i("GvMedia", "cgtv play assist attempt reset reason=$reason pageUrl=$pageUrl")
        }
    }

    private fun resetChtvPlayAssistAttempt(
        session: GeckoSession,
        reason: String,
        pageUrl: String,
        logWhenEmpty: Boolean = false,
    ) {
        val hadState = chtvPlayAssistBySession.remove(session) != null ||
            chtvPlayAssistNativeTapCountBySession.remove(session) != null ||
            chtvPlayAssistNativeTapLastMsBySession.remove(session) != null ||
            chtvFullscreenAssistBySession.remove(session) != null ||
            chtvFullscreenAssistNativeTapCountBySession.remove(session) != null ||
            chtvFullscreenAssistNativeTapLastMsBySession.remove(session) != null ||
            chtvFullscreenAssistSuppressedUrlBySession.remove(session) != null
        if (hadState || logWhenEmpty) {
            GvLogger.i("GvMedia", "chtv play assist attempt reset reason=$reason pageUrl=$pageUrl")
        }
    }

    private fun resetCaribvisionHelperAttempt(
        session: GeckoSession,
        reason: String,
        pageUrl: String,
        logWhenEmpty: Boolean = false,
    ) {
        val hadState = caribvisionSessionStateBySession.remove(session) != null ||
            caribvisionPlayAssistBySession.remove(session) != null ||
            caribvisionPlayAssistNativeTapCountBySession.remove(session) != null ||
            caribvisionPlayAssistNativeTapLastMsBySession.remove(session) != null ||
            caribvisionFullscreenAssistBySession.remove(session) != null ||
            caribvisionFullscreenAssistNativeTapCountBySession.remove(session) != null ||
            caribvisionFullscreenAssistNativeTapLastMsBySession.remove(session) != null ||
            caribvisionFullscreenAssistSuppressedUrlBySession.remove(session) != null ||
            caribvisionFullscreenStageBySession.remove(session) != null ||
            caribvisionFullscreenCheckRunnableBySession.containsKey(session)
        cancelCaribvisionFullscreenCheck(session)
        if (hadState || logWhenEmpty) {
            GvLogger.i("GvMedia", "caribvision helper reset reason=$reason pageUrl=$pageUrl")
        }
    }

    private fun scheduleCgtvPlayAssistFallbackRelease(session: GeckoSession, pageUrl: String) {
        try {
            if (cgtvPlayAssistFallbackReleaseRunnableBySession.containsKey(session)) return
            val runnable = Runnable {
                if (isFinishing || isDestroyed) return@Runnable
                // If playback evidence already arrived, make this fallback harmless.
                if (cgtvBrowserPlaybackActiveBySession.contains(session)) {
                    cgtvPlayAssistFallbackReleaseRunnableBySession.remove(session)
                    return@Runnable
                }
                // Clear CGTV play-assist state and related counters.
                cgtvPlayAssistBySession.remove(session)
                cgtvPlayAssistNativeTapCountBySession.remove(session)
                cgtvPlayAssistNativeTapLastMsBySession.remove(session)
                // Remove any lingering browser-playback-active marker and log transport lock release
                if (cgtvBrowserPlaybackActiveBySession.remove(session)) {
                    GvLogger.i("GvMedia", "cgtv transport lock released reason=fallback-timeout pageUrl=$pageUrl")
                }
                GvLogger.i("GvMedia", "cgtv play assist released reason=fallback-timeout pageUrl=$pageUrl")
                // Restore pointer overlay if it was hidden by CGTV startup.
                restoreCgtvPointerIfHidden(reason = "fallback-timeout")
                cgtvPlayAssistFallbackReleaseRunnableBySession.remove(session)
            }
            cgtvPlayAssistFallbackReleaseRunnableBySession[session] = runnable
            pointerHandler.postDelayed(runnable, CGTV_PLAY_ASSIST_FALLBACK_TIMEOUT_MS)
            GvLogger.i("GvMedia", "cgtv play assist fallback scheduled timeoutMs=$CGTV_PLAY_ASSIST_FALLBACK_TIMEOUT_MS pageUrl=$pageUrl")
        } catch (_: Throwable) {
        }
    }

    private fun clearCgtvPlayAssistFallback(session: GeckoSession) {
        try {
            val runnable = cgtvPlayAssistFallbackReleaseRunnableBySession.remove(session) ?: return
            pointerHandler.removeCallbacks(runnable)
            GvLogger.i("GvMedia", "cgtv play assist fallback cancelled reason=cleared")
        } catch (_: Throwable) {
        }
    }

    private fun dispatchCgtvPlayAssistNativeTap(
        session: GeckoSession,
        state: CgtvPlayAssistState,
        trigger: String,
    ): Boolean {
        val activeTab = tabController.getActiveTab()
        if (activeTab?.session != session || !isCgtvContextUrl(activeTab.url)) {
            GvLogger.i(
                "GvMedia",
                "cgtv play assist native tap skipped trigger=$trigger reason=active-url-mismatch pageUrl=${state.pageUrl} activeUrl=${activeTab?.url.orEmpty()}"
            )
            return false
        }
        if (state.centerX < 0f || state.centerY < 0f) {
            GvLogger.i(
                "GvMedia",
                "cgtv play assist native tap skipped trigger=$trigger reason=missing-coordinates pageUrl=${state.pageUrl}"
            )
            return false
        }
        val now = SystemClock.elapsedRealtime()
        val last = cgtvPlayAssistNativeTapLastMsBySession[session] ?: 0L
        if (now - last < CGTV_PLAY_ASSIST_NATIVE_TAP_MIN_INTERVAL_MS) {
            GvLogger.i(
                "GvMedia",
                "cgtv play assist native tap skipped trigger=$trigger reason=rate-limited pageUrl=${state.pageUrl}"
            )
            return false
        }
        val autoTrigger = trigger.startsWith("auto")
        if (autoTrigger) {
            val alignedViewport = if (state.yRatio > 0f) {
                // Ratio-based alignment check (device-independent)
                state.yRatio <= 0.65f
            } else {
                state.viewportHeight > 0f && state.centerY <= state.viewportHeight * 0.65f
            }
            if (state.targetKind == "bradmax-iframe" && !alignedViewport) {
                GvLogger.i(
                    "GvMedia",
                    "cgtv play assist native tap skipped trigger=$trigger reason=waiting-for-scroll-align css=${state.centerX.toInt()},${state.centerY.toInt()} viewport=${state.viewportWidth.toInt()}x${state.viewportHeight.toInt()} pageUrl=${state.pageUrl}"
                )
                return false
            }
            val count = cgtvPlayAssistNativeTapCountBySession[session] ?: 0
            if (count >= CGTV_PLAY_ASSIST_AUTO_TAP_LIMIT) {
                GvLogger.i(
                    "GvMedia",
                    "cgtv play assist native tap skipped trigger=$trigger reason=auto-limit pageUrl=${state.pageUrl}"
                )
                return false
            }
            cgtvPlayAssistNativeTapCountBySession[session] = count + 1
        }
        val maxWidth = (geckoView.width.takeIf { it > 0 } ?: resources.displayMetrics.widthPixels).toFloat()
        val maxHeight = (geckoView.height.takeIf { it > 0 } ?: resources.displayMetrics.heightPixels).toFloat()

        // Prefer ratio-based coordinates when available. Ratios are device-independent:
        // nativeX = geckoView.width * xRatio, nativeY = geckoView.height * yRatio
        val usingRatio = state.xRatio > 0f && state.yRatio > 0f
        val x: Float
        val y: Float
        val cssX = state.centerX
        val cssY = state.centerY
        if (usingRatio) {
            x = (maxWidth * state.xRatio).coerceIn(1f, maxWidth - 1f)
            y = (maxHeight * state.yRatio).coerceIn(1f, maxHeight - 1f)
        } else {
            val scaleX = if (state.viewportWidth > 0f && maxWidth > state.viewportWidth + 1f) {
                maxWidth / state.viewportWidth
            } else {
                1f
            }
            val scaleY = if (state.viewportHeight > 0f && maxHeight > state.viewportHeight + 1f) {
                maxHeight / state.viewportHeight
            } else {
                1f
            }
            x = (state.centerX * scaleX).coerceIn(1f, maxWidth - 1f)
            y = (state.centerY * scaleY).coerceIn(1f, maxHeight - 1f)
        }

        cgtvPlayAssistNativeTapLastMsBySession[session] = now
        val handled = dispatchNativeMouseTapAt(x, y, "cgtv-play-assist-$trigger")
        GvLogger.i(
            "GvMedia",
            "cgtv play assist native tap dispatched trigger=$trigger handled=$handled native=${x.toInt()},${y.toInt()} css=${cssX.toInt()},${cssY.toInt()} viewport=${state.viewportWidth.toInt()}x${state.viewportHeight.toInt()} ratio=${if (usingRatio) "${state.xRatio},${state.yRatio}" else "-,-"} targetKind=${state.targetKind} reason=${state.reason} pageUrl=${state.pageUrl}"
        )
        return handled
    }

    private fun dispatchChtvPlayAssistNativeTap(
        session: GeckoSession,
        state: ChtvPlayAssistState,
        trigger: String,
    ): Boolean {
        val activeTab = tabController.getActiveTab()
        if (activeTab?.session != session || !isChtvContextUrl(activeTab.url)) {
            GvLogger.i(
                "GvMedia",
                "chtv play assist native tap skipped trigger=$trigger reason=active-url-mismatch pageUrl=${state.pageUrl} activeUrl=${activeTab?.url.orEmpty()}"
            )
            return false
        }
        if (state.centerX < 0f || state.centerY < 0f) {
            GvLogger.i(
                "GvMedia",
                "chtv play assist native tap skipped trigger=$trigger reason=missing-coordinates pageUrl=${state.pageUrl}"
            )
            return false
        }
        val now = SystemClock.elapsedRealtime()
        val last = chtvPlayAssistNativeTapLastMsBySession[session] ?: 0L
        if (now - last < CHTV_PLAY_ASSIST_NATIVE_TAP_MIN_INTERVAL_MS) {
            GvLogger.i(
                "GvMedia",
                "chtv play assist native tap skipped trigger=$trigger reason=rate-limited pageUrl=${state.pageUrl}"
            )
            return false
        }
        if (trigger.startsWith("auto")) {
            val count = chtvPlayAssistNativeTapCountBySession[session] ?: 0
            if (count >= CHTV_PLAY_ASSIST_AUTO_TAP_LIMIT) {
                GvLogger.i(
                    "GvMedia",
                    "chtv play assist native tap skipped trigger=$trigger reason=auto-limit pageUrl=${state.pageUrl}"
                )
                return false
            }
            chtvPlayAssistNativeTapCountBySession[session] = count + 1
        }
        val maxWidth = (geckoView.width.takeIf { it > 0 } ?: resources.displayMetrics.widthPixels).toFloat()
        val maxHeight = (geckoView.height.takeIf { it > 0 } ?: resources.displayMetrics.heightPixels).toFloat()
        val usingRatio = state.xRatio > 0f && state.yRatio > 0f
        val cssX = state.centerX
        val cssY = state.centerY
        var x =
            if (usingRatio) {
                (maxWidth * state.xRatio).coerceIn(1f, maxWidth - 1f)
            } else {
                val scaleX =
                    if (state.viewportWidth > 0f && maxWidth > state.viewportWidth + 1f) {
                        maxWidth / state.viewportWidth
                    } else {
                        1f
                    }
                (state.centerX * scaleX).coerceIn(1f, maxWidth - 1f)
            }
        var y =
            if (usingRatio) {
                (maxHeight * state.yRatio).coerceIn(1f, maxHeight - 1f)
            } else {
                val scaleY =
                    if (state.viewportHeight > 0f && maxHeight > state.viewportHeight + 1f) {
                        maxHeight / state.viewportHeight
                    } else {
                        1f
                    }
                (state.centerY * scaleY).coerceIn(1f, maxHeight - 1f)
        }
        showPointerAt(x, y, reason = "chtv-play-assist")
        chtvPlayAssistNativeTapLastMsBySession[session] = now
        val handled = dispatchNativeMouseTapAt(x, y, "chtv-play-assist-$trigger")
        GvLogger.i(
            "GvMedia",
            "chtv play assist native tap dispatched trigger=$trigger handled=$handled native=${x.toInt()},${y.toInt()} css=${cssX.toInt()},${cssY.toInt()} viewport=${state.viewportWidth.toInt()}x${state.viewportHeight.toInt()} ratio=${if (usingRatio) "${state.xRatio},${state.yRatio}" else "-,-"} targetKind=${state.targetKind} reason=${state.reason} pageUrl=${state.pageUrl}"
        )
        return handled
    }

    private fun dispatchChtvFullscreenAssistNativeTap(
        session: GeckoSession,
        state: ChtvFullscreenAssistState,
        trigger: String,
    ): Boolean {
        val activeTab = tabController.getActiveTab()
        if (activeTab?.session != session || !isChtvContextUrl(activeTab.url)) {
            GvLogger.i(
                "GvMedia",
                "chtv fullscreen assist native tap skipped trigger=$trigger reason=active-url-mismatch pageUrl=${state.pageUrl} activeUrl=${activeTab?.url.orEmpty()}"
            )
            return false
        }
        if (state.centerX < 0f || state.centerY < 0f) {
            GvLogger.i(
                "GvMedia",
                "chtv fullscreen assist native tap skipped trigger=$trigger reason=missing-coordinates pageUrl=${state.pageUrl}"
            )
            return false
        }
        val now = SystemClock.elapsedRealtime()
        val last = chtvFullscreenAssistNativeTapLastMsBySession[session] ?: 0L
        if (now - last < CHTV_FULLSCREEN_ASSIST_NATIVE_TAP_MIN_INTERVAL_MS) {
            GvLogger.i(
                "GvMedia",
                "chtv fullscreen assist native tap skipped trigger=$trigger reason=rate-limited pageUrl=${state.pageUrl}"
            )
            return false
        }
        if (trigger.startsWith("auto")) {
            val count = chtvFullscreenAssistNativeTapCountBySession[session] ?: 0
            if (count >= CHTV_FULLSCREEN_ASSIST_AUTO_TAP_LIMIT) {
                GvLogger.i(
                    "GvMedia",
                    "chtv fullscreen assist native tap skipped trigger=$trigger reason=auto-limit pageUrl=${state.pageUrl}"
                )
                return false
            }
            chtvFullscreenAssistNativeTapCountBySession[session] = count + 1
        }
        val maxWidth = (geckoView.width.takeIf { it > 0 } ?: resources.displayMetrics.widthPixels).toFloat()
        val maxHeight = (geckoView.height.takeIf { it > 0 } ?: resources.displayMetrics.heightPixels).toFloat()
        val usingRatio = state.xRatio > 0f && state.yRatio > 0f
        val cssX = state.centerX
        val cssY = state.centerY
        var x =
            if (usingRatio) {
                (maxWidth * state.xRatio).coerceIn(1f, maxWidth - 1f)
            } else {
                val scaleX =
                    if (state.viewportWidth > 0f && maxWidth > state.viewportWidth + 1f) {
                        maxWidth / state.viewportWidth
                    } else {
                        1f
                    }
                (state.centerX * scaleX).coerceIn(1f, maxWidth - 1f)
            }
        var y =
            if (usingRatio) {
                (maxHeight * state.yRatio).coerceIn(1f, maxHeight - 1f)
            } else {
                val scaleY =
                    if (state.viewportHeight > 0f && maxHeight > state.viewportHeight + 1f) {
                        maxHeight / state.viewportHeight
                    } else {
                        1f
                    }
                (state.centerY * scaleY).coerceIn(1f, maxHeight - 1f)
            }
        showPointerAt(x, y, reason = "chtv-fullscreen-assist")
        chtvFullscreenAssistNativeTapLastMsBySession[session] = now
        val handled = dispatchNativeMouseTapAt(x, y, "chtv-fullscreen-assist-$trigger")
        GvLogger.i(
            "GvMedia",
            "chtv fullscreen assist native tap dispatched trigger=$trigger handled=$handled native=${x.toInt()},${y.toInt()} css=${cssX.toInt()},${cssY.toInt()} viewport=${state.viewportWidth.toInt()}x${state.viewportHeight.toInt()} ratio=${if (usingRatio) "${state.xRatio},${state.yRatio}" else "-,-"} targetKind=${state.targetKind} reason=${state.reason} pageUrl=${state.pageUrl}"
        )
        return handled
    }

    private fun dispatchCaribvisionPlayAssistNativeTap(
        session: GeckoSession,
        state: CaribvisionPlayAssistState,
        trigger: String,
    ): Boolean {
        val activeTab = tabController.getActiveTab()
        if (activeTab?.session != session || !isCaribvisionPlayerActive(session, activeTab.url)) {
            GvLogger.i(
                "GvMedia",
                "caribvision play assist native tap skipped trigger=$trigger reason=active-url-mismatch pageUrl=${state.pageUrl} activeUrl=${activeTab?.url.orEmpty()}"
            )
            return false
        }
        if (state.centerX < 0f || state.centerY < 0f) {
            GvLogger.i(
                "GvMedia",
                "caribvision play assist native tap skipped trigger=$trigger reason=missing-coordinates pageUrl=${state.pageUrl}"
            )
            return false
        }
        val now = SystemClock.elapsedRealtime()
        val last = caribvisionPlayAssistNativeTapLastMsBySession[session] ?: 0L
        if (now - last < CARIBVISION_PLAY_ASSIST_NATIVE_TAP_MIN_INTERVAL_MS) {
            GvLogger.i(
                "GvMedia",
                "caribvision play assist native tap skipped trigger=$trigger reason=rate-limited pageUrl=${state.pageUrl}"
            )
            return false
        }
        if (trigger.startsWith("auto")) {
            val count = caribvisionPlayAssistNativeTapCountBySession[session] ?: 0
            if (count >= CARIBVISION_PLAY_ASSIST_AUTO_TAP_LIMIT) {
                GvLogger.i(
                    "GvMedia",
                    "caribvision play assist native tap skipped trigger=$trigger reason=auto-limit pageUrl=${state.pageUrl}"
                )
                return false
            }
            caribvisionPlayAssistNativeTapCountBySession[session] = count + 1
        }
        val maxWidth = (geckoView.width.takeIf { it > 0 } ?: resources.displayMetrics.widthPixels).toFloat()
        val maxHeight = (geckoView.height.takeIf { it > 0 } ?: resources.displayMetrics.heightPixels).toFloat()
        val usingRatio = state.xRatio > 0f && state.yRatio > 0f
        var x =
            if (usingRatio) {
                (maxWidth * state.xRatio).coerceIn(1f, maxWidth - 1f)
            } else {
                val scaleX =
                    if (state.viewportWidth > 0f && maxWidth > state.viewportWidth + 1f) {
                        maxWidth / state.viewportWidth
                    } else {
                        1f
                    }
                (state.centerX * scaleX).coerceIn(1f, maxWidth - 1f)
            }
        var y =
            if (usingRatio) {
                (maxHeight * state.yRatio).coerceIn(1f, maxHeight - 1f)
            } else {
                val scaleY =
                    if (state.viewportHeight > 0f && maxHeight > state.viewportHeight + 1f) {
                        maxHeight / state.viewportHeight
                    } else {
                        1f
                    }
                (state.centerY * scaleY).coerceIn(1f, maxHeight - 1f)
            }
        showPointerAt(x, y, reason = "caribvision-play-assist")
        caribvisionPlayAssistNativeTapLastMsBySession[session] = now
        val handled = dispatchNativeMouseTapAt(x, y, "caribvision-play-assist-$trigger")
        GvLogger.i(
            "GvMedia",
            "caribvision play assist native tap dispatched x=${x.toInt()} y=${y.toInt()} handled=$handled trigger=$trigger label=${state.targetLabel.ifBlank { state.targetKind }} reason=${state.reason} pageUrl=${state.pageUrl}"
        )
        return handled
    }

    private fun cancelCaribvisionFullscreenCheck(session: GeckoSession) {
        caribvisionFullscreenCheckRunnableBySession.remove(session)?.let { runnable ->
            pointerHandler.removeCallbacks(runnable)
        }
    }

    private fun scheduleCaribvisionFullscreenCheck(
        session: GeckoSession,
        state: CaribvisionFullscreenAssistState,
        attempt: Int,
    ) {
        cancelCaribvisionFullscreenCheck(session)
        val runnable = Runnable {
            caribvisionFullscreenCheckRunnableBySession.remove(session)
            val activeTab = tabController.getActiveTab()
            val currentUrl = activeTab?.url.orEmpty().ifBlank { state.pageUrl }
            val entered = browserFullscreenStateBySession[session] == true
            if (entered) {
                caribvisionFullscreenStageBySession[session] = CARIBVISION_FULLSCREEN_STAGE_ENTERED
                caribvisionFullscreenAssistNativeTapCountBySession.remove(session)
                caribvisionFullscreenAssistNativeTapLastMsBySession.remove(session)
                GvLogger.i(
                    "GvMedia",
                    "caribvision fullscreen check result=entered attempt=$attempt pageUrl=$currentUrl"
                )
                GvLogger.i("GvMedia", "caribvision fullscreen complete pageUrl=$currentUrl")
                return@Runnable
            }
            GvLogger.i(
                "GvMedia",
                "caribvision fullscreen check result=not-entered attempt=$attempt pageUrl=$currentUrl"
            )
            val latestState = caribvisionFullscreenAssistBySession[session]
            if (
                attempt < CARIBVISION_FULLSCREEN_ASSIST_AUTO_TAP_LIMIT &&
                latestState != null &&
                latestState.active &&
                latestState.pageUrl == currentUrl &&
                isCaribvisionPlayerActive(session, currentUrl)
            ) {
                caribvisionFullscreenStageBySession[session] = CARIBVISION_FULLSCREEN_STAGE_NOT_STARTED
                GvLogger.i("GvMedia", "caribvision fullscreen retry reason=no-callback pageUrl=$currentUrl")
                dispatchCaribvisionFullscreenAssistNativeTap(session, latestState, trigger = "auto-retry")
                return@Runnable
            }
            caribvisionFullscreenStageBySession[session] = CARIBVISION_FULLSCREEN_STAGE_FAILED
        }
        caribvisionFullscreenCheckRunnableBySession[session] = runnable
        pointerHandler.postDelayed(runnable, CARIBVISION_FULLSCREEN_CHECK_DELAY_MS)
    }

    private fun dispatchCaribvisionFullscreenAssistNativeTap(
        session: GeckoSession,
        state: CaribvisionFullscreenAssistState,
        trigger: String,
    ): Boolean {
        val activeTab = tabController.getActiveTab()
        if (activeTab?.session != session || !isCaribvisionPlayerActive(session, activeTab.url)) {
            GvLogger.i(
                "GvMedia",
                "caribvision fullscreen tap skipped trigger=$trigger reason=active-url-mismatch pageUrl=${state.pageUrl} activeUrl=${activeTab?.url.orEmpty()}"
            )
            return false
        }
        if (browserFullscreenStateBySession[session] == true || state.fullscreenActive) {
            caribvisionFullscreenStageBySession[session] = CARIBVISION_FULLSCREEN_STAGE_ENTERED
            GvLogger.i(
                "GvMedia",
                "caribvision fullscreen tap skipped trigger=$trigger reason=already-fullscreen pageUrl=${state.pageUrl}"
            )
            return false
        }
        if (isCaribvisionFullscreenAssistSuppressed(session, state.pageUrl)) {
            caribvisionFullscreenStageBySession[session] = CARIBVISION_FULLSCREEN_STAGE_NOT_STARTED
            GvLogger.i(
                "GvMedia",
                "caribvision fullscreen tap skipped trigger=$trigger reason=suppressed-after-back pageUrl=${state.pageUrl}"
            )
            return false
        }
        if (caribvisionFullscreenStageBySession[session] == CARIBVISION_FULLSCREEN_STAGE_PENDING) {
            GvLogger.i(
                "GvMedia",
                "caribvision fullscreen tap skipped trigger=$trigger reason=pending-callback pageUrl=${state.pageUrl}"
            )
            return false
        }
        if (state.centerX < 0f || state.centerY < 0f) {
            GvLogger.i(
                "GvMedia",
                "caribvision fullscreen tap skipped trigger=$trigger reason=missing-coordinates pageUrl=${state.pageUrl}"
            )
            return false
        }
        val now = SystemClock.elapsedRealtime()
        val last = caribvisionFullscreenAssistNativeTapLastMsBySession[session] ?: 0L
        if (now - last < CARIBVISION_FULLSCREEN_ASSIST_NATIVE_TAP_MIN_INTERVAL_MS) {
            GvLogger.i(
                "GvMedia",
                "caribvision fullscreen tap skipped trigger=$trigger reason=rate-limited pageUrl=${state.pageUrl}"
            )
            return false
        }
        var attempt = caribvisionFullscreenAssistNativeTapCountBySession[session] ?: 0
        if (trigger.startsWith("auto")) {
            if (attempt >= CARIBVISION_FULLSCREEN_ASSIST_AUTO_TAP_LIMIT) {
                GvLogger.i(
                    "GvMedia",
                    "caribvision fullscreen tap skipped trigger=$trigger reason=auto-limit pageUrl=${state.pageUrl}"
                )
                return false
            }
            attempt += 1
            caribvisionFullscreenAssistNativeTapCountBySession[session] = attempt
        }
        val maxWidth = (geckoView.width.takeIf { it > 0 } ?: resources.displayMetrics.widthPixels).toFloat()
        val maxHeight = (geckoView.height.takeIf { it > 0 } ?: resources.displayMetrics.heightPixels).toFloat()
        val usingRatio = state.xRatio > 0f && state.yRatio > 0f
        var x =
            if (usingRatio) {
                (maxWidth * state.xRatio).coerceIn(1f, maxWidth - 1f)
            } else {
                val scaleX =
                    if (state.viewportWidth > 0f && maxWidth > state.viewportWidth + 1f) {
                        maxWidth / state.viewportWidth
                    } else {
                        1f
                    }
                (state.centerX * scaleX).coerceIn(1f, maxWidth - 1f)
            }
        var y =
            if (usingRatio) {
                (maxHeight * state.yRatio).coerceIn(1f, maxHeight - 1f)
            } else {
                val scaleY =
                    if (state.viewportHeight > 0f && maxHeight > state.viewportHeight + 1f) {
                        maxHeight / state.viewportHeight
                    } else {
                        1f
                    }
                (state.centerY * scaleY).coerceIn(1f, maxHeight - 1f)
            }
        if (trigger == "auto-retry" && state.targetKind == "caribvision-fullscreen-fallback") {
            x = (x + 28f).coerceIn(1f, maxWidth - 1f)
            y = (y + 20f).coerceIn(1f, maxHeight - 1f)
        }
        if (trigger == "auto" && attempt == 1 && state.audioCenterX >= 0f && state.audioCenterY >= 0f) {
            val useAudioRatio = state.audioXRatio > 0f && state.audioYRatio > 0f
            val audioX =
                if (useAudioRatio) {
                    (maxWidth * state.audioXRatio).coerceIn(1f, maxWidth - 1f)
                } else {
                    val scaleX =
                        if (state.viewportWidth > 0f && maxWidth > state.viewportWidth + 1f) {
                            maxWidth / state.viewportWidth
                        } else {
                            1f
                        }
                    (state.audioCenterX * scaleX).coerceIn(1f, maxWidth - 1f)
                }
            val audioY =
                if (useAudioRatio) {
                    (maxHeight * state.audioYRatio).coerceIn(1f, maxHeight - 1f)
                } else {
                    val scaleY =
                        if (state.viewportHeight > 0f && maxHeight > state.viewportHeight + 1f) {
                            maxHeight / state.viewportHeight
                        } else {
                            1f
                        }
                    (state.audioCenterY * scaleY).coerceIn(1f, maxHeight - 1f)
                }
            showPointerAt(audioX, audioY, reason = "caribvision-audio-assist")
            val audioHoverHandled = dispatchNativeMouseHoverAt(audioX, audioY, "caribvision-audio-assist-hover-$trigger")
            val audioHandled = dispatchNativeMouseTapAt(audioX, audioY, "caribvision-audio-assist-$trigger")
            GvLogger.i(
                "GvMedia",
                "caribvision audio tap x=${audioX.toInt()} y=${audioY.toInt()} handled=$audioHandled hoverHandled=$audioHoverHandled source=${state.audioTargetKind} label=${state.audioTargetLabel.ifBlank { state.audioTargetKind }} pageUrl=${state.pageUrl}"
            )
        }
        showPointerAt(x, y, reason = "caribvision-fullscreen-assist")
        val hoverHandled = dispatchNativeMouseHoverAt(x, y, "caribvision-fullscreen-assist-hover-$trigger")
        caribvisionFullscreenAssistNativeTapLastMsBySession[session] = now
        caribvisionFullscreenStageBySession[session] = CARIBVISION_FULLSCREEN_STAGE_PENDING
        val handled = dispatchNativeMouseTapAt(x, y, "caribvision-fullscreen-assist-$trigger")
        GvLogger.i(
            "GvMedia",
            "caribvision fullscreen tap x=${x.toInt()} y=${y.toInt()} handled=$handled hoverHandled=$hoverHandled attempt=$attempt trigger=$trigger source=${state.targetKind} pageUrl=${state.pageUrl}"
        )
        if (handled) {
            scheduleCaribvisionFullscreenCheck(session, state, attempt)
        } else {
            caribvisionFullscreenStageBySession[session] = CARIBVISION_FULLSCREEN_STAGE_NOT_STARTED
        }
        return handled
    }

    private fun selectCgtvCandidate(
        pageUrl: String,
        candidates: JSONArray,
    ): CgtvCandidateSelection? {
        if (!isCgtvContextUrl(pageUrl)) {
            return null
        }
        val selected = extractBradmaxMediaUrl(pageUrl)?.let { mediaUrl ->
            CgtvCandidateSelection(
                sourceUrl = mediaUrl,
                mimeType = inferMimeTypeFromUrl(mediaUrl),
                reason = if (isLikelyHlsUrl(mediaUrl, inferMimeTypeFromUrl(mediaUrl))) "bradmax-mediaUrl-hls" else "bradmax-mediaUrl",
            )
        } ?: run {
            var firstNonSplash: CgtvCandidateSelection? = null
            for (index in 0 until candidates.length()) {
                val candidate = candidates.optJSONObject(index) ?: continue
                val sourceUrl = candidate.optString("src").trim()
                if (sourceUrl.isBlank()) continue
                val mimeType = candidate.optString("mimeType").ifBlank { null }
                val bradmaxMediaUrl = extractBradmaxMediaUrl(sourceUrl)
                if (!bradmaxMediaUrl.isNullOrBlank() && isLikelyHlsUrl(bradmaxMediaUrl, mimeType)) {
                    return@run CgtvCandidateSelection(
                        sourceUrl = bradmaxMediaUrl,
                        mimeType = inferMimeTypeFromUrl(bradmaxMediaUrl),
                        reason = "bradmax-mediaUrl-hls",
                    )
                }
                if (isLikelyCgtvSplashAnimationUrl(sourceUrl)) {
                    GvLogger.i("GvMedia", "cgtv media candidate rejected reason=splash-animation url=$sourceUrl")
                    continue
                }
                val normalizedSource = bradmaxMediaUrl ?: sourceUrl
                val normalizedMime = mimeType ?: inferMimeTypeFromUrl(normalizedSource)
                val reason = if (isLikelyHlsUrl(normalizedSource, normalizedMime)) "direct-hls" else "direct-candidate"
                if (isLikelyHlsUrl(normalizedSource, normalizedMime)) {
                    return@run CgtvCandidateSelection(
                        sourceUrl = normalizedSource,
                        mimeType = normalizedMime,
                        reason = reason,
                    )
                }
                if (firstNonSplash == null) {
                    firstNonSplash = CgtvCandidateSelection(
                        sourceUrl = normalizedSource,
                        mimeType = normalizedMime,
                        reason = reason,
                    )
                }
            }
            firstNonSplash
        }
        if (selected != null) {
            GvLogger.i("GvMedia", "cgtv media candidate selected reason=${selected.reason} url=${selected.sourceUrl}")
        }
        return selected
    }

    private fun extractBradmaxMediaUrl(url: String): String? {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return null
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        if (host != "bradm.ax" && !host.endsWith(".bradm.ax")) {
            return null
        }
        val encoded = uri.getQueryParameter("mediaUrl")?.trim().orEmpty()
        if (encoded.isBlank()) {
            return null
        }
        val decoded = runCatching { android.net.Uri.decode(encoded) }.getOrDefault(encoded).trim()
        if (decoded.startsWith("http://", ignoreCase = true) || decoded.startsWith("https://", ignoreCase = true)) {
            return decoded
        }
        return null
    }

    private fun isCgtvContextUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty().lowercase()
        if (host == "kulchaflo.com" && path.startsWith("/channels/caribbean-gospel-tv")) {
            return true
        }
        if (host == "caribbeangospel.tv" || host.endsWith(".caribbeangospel.tv")) {
            return true
        }
        return host == "bradm.ax" || host.endsWith(".bradm.ax")
    }

    private fun isCvc9LivePageUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        if (host != "colorvision.com.do") {
            return false
        }
        val path = uri.encodedPath.orEmpty().lowercase()
        return path == "/en-vivo" || path.startsWith("/en-vivo/")
    }

    private fun isCvc9DailymotionWatchPageUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        if (host != "dailymotion.com") {
            return false
        }
        val path = uri.encodedPath.orEmpty().lowercase()
        return path == "/video/x7gy059" || path.startsWith("/video/x7gy059/")
    }

    private fun isCvc9DailymotionConsentPageUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        return host == "consent.dailymotion.com"
    }

    private fun isCvc9DailymotionConsentContextUrl(url: String): Boolean {
        return isCvc9DailymotionWatchPageUrl(url) || isCvc9DailymotionConsentPageUrl(url)
    }

    private fun isCvc9AdclickUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty().lowercase()
        return host == "adclick.g.doubleclick.net" && path.startsWith("/pcs/click")
    }

    private fun isGbnDailymotionAdNavigationUrl(url: String): Boolean {
        if (isCvc9AdclickUrl(url)) {
            return true
        }
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty().lowercase()
        val query = uri.encodedQuery.orEmpty().lowercase()
        return (host == "bing.com" && (path == "/api/v1/mediation/tracking" || path == "/aclick")) ||
            (host == "bing.com" && query.contains("rlink=https%3a%2f%2fwww.bing.com%2faclick")) ||
            (host == "bing.com" && query.contains("rlink=http%3a%2f%2fwww.bing.com%2faclick"))
    }

    private fun isGbnDailymotionAdAssetUrl(url: String): Boolean {
        val normalized = url.lowercase()
        if (normalized.contains("adsappsvideostorage")) {
            return true
        }
        if (normalized.contains("bingads") || normalized.contains("/bingads-")) {
            return true
        }
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty().lowercase()
        return (host.endsWith("bing.com") && path.contains("/ads/")) ||
            (host.contains("bingads")) ||
            (host.contains("adsappsvideostorage"))
    }

    private fun isCvc9DailymotionMediaUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty()
        val path = uri.encodedPath.orEmpty().lowercase()
        return host.endsWith("dailymotion.com") &&
            path.contains("/video/x7gy059") &&
            path.endsWith(".m3u8")
    }

    private fun isCvc9ContextUrl(url: String): Boolean {
        return isCvc9LivePageUrl(url) || isCvc9DailymotionWatchPageUrl(url)
    }

    private fun isCvc9DailymotionBrowserPlayerContextUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        if (host != "geo.dailymotion.com") {
            return false
        }
        val path = uri.encodedPath.orEmpty().lowercase()
        if (!path.startsWith("/player/")) {
            return false
        }
        val topUrl = currentUrl
        val activeTabUrl = tabController.getActiveTab()?.url.orEmpty()
        return isCvc9DailymotionWatchPageUrl(topUrl) ||
            isCvc9DailymotionWatchPageUrl(activeTabUrl) ||
            isCvc9LivePageUrl(topUrl) ||
            isCvc9LivePageUrl(activeTabUrl)
    }

    private fun isCgtvWatchPageUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty().lowercase()
        return host == "caribbeangospel.tv" && (path == "/watch" || path == "/watch/")
    }

    private fun isCgtvExternalContextUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        return host == "caribbeangospel.tv" || host.endsWith(".caribbeangospel.tv") || isBradmaxHost(host)
    }

    private fun isChtvContextUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return false
        }
        return isChtvHost(uri.host)
    }

    private fun isChtvHost(host: String?): Boolean {
        val normalized = host?.lowercase().orEmpty().removePrefix("www.")
        return normalized == "caribbeanhottv.com" || normalized.endsWith(".caribbeanhottv.com")
    }

    private fun isBradmaxHost(host: String?): Boolean {
        val normalized = host?.lowercase().orEmpty().removePrefix("www.")
        return normalized == "bradm.ax" || normalized.endsWith(".bradm.ax")
    }

    private fun isLikelyCgtvSplashAnimationUrl(url: String): Boolean {
        val lower = url.lowercase()
        if (!lower.contains(".mp4")) {
            return false
        }
        return lower.contains("cgtv-animation") ||
            lower.contains("animation") ||
            lower.contains("website-test") ||
            lower.contains("/wp-content/uploads/")
    }

    private fun inferMimeTypeFromUrl(url: String): String? {
        val path = runCatching { android.net.Uri.parse(url) }.getOrNull()?.encodedPath.orEmpty()
        return when {
            path.endsWith(".m3u8", ignoreCase = true) -> "application/x-mpegURL"
            path.endsWith(".mp4", ignoreCase = true) -> "video/mp4"
            path.endsWith(".webm", ignoreCase = true) -> "video/webm"
            path.endsWith(".mp3", ignoreCase = true) || path.endsWith(".m4a", ignoreCase = true) -> "audio/*"
            else -> null
        }
    }

    private fun isLikelyHlsUrl(url: String, mimeType: String?): Boolean {
        if (mimeType?.contains("mpegurl", ignoreCase = true) == true) {
            return true
        }
        val lower = url.lowercase()
        return lower.contains(".m3u8")
    }

    private fun isLikelyCgtvLiveSourceUrl(url: String, mimeType: String?): Boolean {
        if (isLikelyHlsUrl(url, mimeType)) {
            return true
        }
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty().lowercase()
        return host.endsWith(".servers.dvcloud.tv") && path.contains("/hls/")
    }

    private fun isCaribVisionAppUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        return host == "app.caribvision.tv"
    }

    private fun isCbcLivePageUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty()
        if (host != "cbc.bb") return false
        return path == "/live" || path == "/live/"
    }

    private fun isExactCaribVisionLiveHlsUrl(url: String): Boolean {
        if (url.isBlank()) return false
        val uri = runCatching { android.net.Uri.parse(url.trim()) }.getOrNull() ?: return false
        val host = uri.host?.lowercase().orEmpty()
        val path = uri.encodedPath.orEmpty()
        if (host != CARIBVISION_OFFICIAL_HLS_HOST) return false
        if (path != CARIBVISION_OFFICIAL_HLS_PATH) return false
        return true
    }

    private fun isCaribVisionAutoplayContextUrl(url: String): Boolean {
        return isCaribVisionAppUrl(url) || isExactCaribVisionLiveHlsUrl(url)
    }

    private fun isCaribvisionPlayerActive(session: GeckoSession?, url: String): Boolean {
        if (session == null || !isCaribVisionAppUrl(url)) {
            return false
        }
        return caribvisionSessionStateBySession[session]?.playerVisible == true
    }

    private fun isExactCbcLiveHlsUrl(url: String): Boolean {
        if (url.isBlank()) return false
        val uri = runCatching { android.net.Uri.parse(url.trim()) }.getOrNull() ?: return false
        val host = uri.host?.lowercase().orEmpty()
        val path = uri.encodedPath.orEmpty()
        if (host != CBC_OFFICIAL_HLS_HOST) return false
        if (path != CBC_OFFICIAL_HLS_PATH) return false
        return true
    }

    private fun shouldPromoteDirectMedia(url: String): Boolean {
        return !isLiveMediaSurfaceUrl(url)
    }

    private fun isLiveMediaSurfaceUrl(url: String): Boolean {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return false
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty().lowercase()
        return when {
            host == "cbc.bb" && path.startsWith("/live") -> true
            host == "kulchaflo.com" && path.startsWith("/channels/") -> true
            host == "caribvision.tv" || host.endsWith(".caribvision.tv") -> true
            host == "caribbeanhottv.com" || host.endsWith(".caribbeanhottv.com") -> true
            host == "abstvradio.com" && path.contains("live-streaming") -> true
            host == "novus.telearuba.aw" || host.endsWith(".novus.telearuba.aw") -> true
            host == "player.tegotv.com" -> true
            path.contains("/player.php") -> true
            path.contains("/live-stream") -> true
            isCvc9LivePageUrl(url) -> true
            isCvc9DailymotionWatchPageUrl(url) -> true
            isCnc3LiveStreamPageUrl(url) -> true
            isCvmLiveStreamUrl(url) -> true
            isCvmVimeoEmbedUrl(uri) -> true
            else -> false
        }
    }

    private fun unifiedCompatSkipReason(url: String): String? {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return "unsupported-scheme"
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return "unsupported-scheme"
        }
        val host = uri.host?.lowercase().orEmpty().removePrefix("www.")
        val path = uri.encodedPath.orEmpty().lowercase().ifBlank { "/" }
        if (isFacebookHost(host)) {
            return "facebook"
        }
        if (isYouTubeSurfaceHostForUnifiedCompat(host)) {
            return "youtube"
        }
        if (isAdminOrBackendRoute(host, path)) {
            return "admin-backend"
        }
        if (host == "kulchaflo.com") {
            return unifiedCompatKulchaFloSkipReason(path) ?: tvViewportPolicyCssCompatSkipReason()
        }
        if (isLiveMediaSurfaceUrl(url)) {
            return "media-surface"
        }
        tvViewportPolicyCssCompatSkipReason()?.let { return it }
        return null
    }

    private fun unifiedCompatKulchaFloSkipReason(path: String): String? {
        if (path == "/watch" || path.startsWith("/watch/")) {
            return "internal-watch-route"
        }
        return null
    }

    private fun tvViewportPolicyCssCompatSkipReason(): String? {
        if (GvRuntimeExperimentConfig.ENABLE_TV_VIEWPORT_POLICY &&
            !GvRuntimeExperimentConfig.ENABLE_CSS_VISUAL_SCALE_COMPAT_DURING_TV_VIEWPORT_POLICY
        ) {
            return "tv-viewport-policy-css-disabled"
        }
        return null
    }

    private fun isAdminOrBackendRoute(host: String, path: String): Boolean {
        if (path.startsWith("/api/") ||
            path.contains("/api/") ||
            path.startsWith("/graphql") ||
            path == "/xmlrpc.php"
        ) {
            return true
        }
        if (host != "kulchaflo.com") {
            return false
        }
        return path.startsWith("/wp-admin") ||
            path == "/wp-login.php" ||
            path.startsWith("/wp-json") ||
            path.contains("/admin-ajax.php") ||
            path == "/wp-cron.php" ||
            path.startsWith("/wp-content/uploads/") && (
                path.endsWith(".json") ||
                    path.endsWith(".xml")
                )
    }

    private fun isYouTubeSurfaceHostForUnifiedCompat(host: String): Boolean {
        return host == "youtube.com" ||
            host.endsWith(".youtube.com") ||
            host == "youtu.be" ||
            host == "youtube-nocookie.com" ||
            host.endsWith(".youtube-nocookie.com") ||
            host == "googlevideo.com" ||
            host.endsWith(".googlevideo.com")
    }

    private fun suppressDirectMediaPromotion(
        url: String,
        reason: String,
        durationMs: Long = DIRECT_MEDIA_PROMOTION_SUPPRESSION_MS,
    ) {
        val normalizedUrl = url.ifBlank { return }
        val untilMs = SystemClock.uptimeMillis() + durationMs
        directMediaPromotionSuppressedUntilByUrl[normalizedUrl] = untilMs
        GvLogger.i(
            "GvMedia",
            "direct media promotion suppressed url=$normalizedUrl until=$untilMs reason=$reason"
        )
    }

    private fun isDirectMediaPromotionSuppressed(url: String): Boolean {
        val normalizedUrl = url.ifBlank { return false }
        val now = SystemClock.uptimeMillis()
        val untilMs = directMediaPromotionSuppressedUntilByUrl[normalizedUrl] ?: return false
        if (untilMs <= now) {
            directMediaPromotionSuppressedUntilByUrl.remove(normalizedUrl)
            return false
        }
        return true
    }

    private fun extractFacebookDialogNextUrl(url: String): String? {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return null
        val rawNext = uri.getQueryParameter("next").orEmpty().trim()
        if (rawNext.isBlank()) {
            return null
        }
        val decoded = runCatching { android.net.Uri.decode(rawNext) }.getOrDefault(rawNext).trim()
        if (decoded.isBlank()) {
            return null
        }
        if (decoded.startsWith("http://", ignoreCase = true) || decoded.startsWith("https://", ignoreCase = true)) {
            return decoded
        }
        return if (decoded.startsWith("/")) {
            "https://www.facebook.com$decoded"
        } else {
            "https://www.facebook.com/$decoded"
        }
    }

    private fun normalizeToDesktopFacebookUrl(url: String): String? {
        val uri = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return null
        val scheme = uri.scheme?.lowercase().orEmpty()
        if (scheme != "http" && scheme != "https") {
            return null
        }
        val host = uri.host?.lowercase().orEmpty()
        val isMobileFacebookHost = host == "m.facebook.com" ||
            host == "mobile.facebook.com" ||
            host == "touch.facebook.com"
        if (!isMobileFacebookHost) {
            return null
        }
        val builder = uri.buildUpon().authority("www.facebook.com").clearQuery()
        uri.queryParameterNames.forEach { queryKey ->
            if (queryKey.equals("_rdr", ignoreCase = true)) {
                return@forEach
            }
            val values = uri.getQueryParameters(queryKey)
            if (values.isEmpty()) {
                builder.appendQueryParameter(queryKey, "")
            } else {
                values.forEach { value ->
                    builder.appendQueryParameter(queryKey, value)
                }
            }
        }
        return builder.build().toString()
    }

    private data class PointerMoveResult(
        val overshootX: Float,
        val overshootY: Float,
    )
}
