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
    private val directMediaPromotionSuppressedUntilByUrl = LinkedHashMap<String, Long>()
    private val youtubeConsentNativeTapLastMsBySession = LinkedHashMap<GeckoSession, Long>()
    private val facebookCompatResolvedBySession =
        Collections.newSetFromMap(WeakHashMap<GeckoSession, Boolean>())
    private val pointerDirectionKeys = LinkedHashSet<Int>()
    private val pointerHandler = Handler(Looper.getMainLooper())
    private var pointerVisible = false
    private var pointerX = 0f
    private var pointerY = 0f
    private var pointerDownTime = 0L
    private var pointerRepeatTicks = 0
    private var lastBackToExitAtMs = 0L
    private var lastBackToHomeAtMs = 0L
    private var lastInteractionWakePulseMs = 0L
    private val pointerIdleRunnable = Runnable {
        if (!pointerDirectionKeys.isEmpty()) {
            schedulePointerIdleTimeout()
            return@Runnable
        }
        if (!pointerVisible || !pointerOverlay.isPointerVisible()) {
            return@Runnable
        }
        pointerVisible = false
        pointerOverlay.hidePointer()
        GvLogger.i("GvInput", "pointer auto-hidden reason=idle-timeout")
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
            maybeScrollContent(move.overshootX, move.overshootY, "repeat")
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
        promotedMediaPlayer = GvPromotedMediaPlayer(this, promotedMediaHost as ViewGroup)

        restoreTabs(savedInstanceState)

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (tabsOverlay.visibility == View.VISIBLE) {
                        hideTabsOverlay()
                        return
                    }
                    if (promotedMediaPlayer.isPromoted()) {
                        promotedMediaPlayer.currentSourceUrl()?.let { sourceUrl ->
                            suppressDirectMediaPromotion(sourceUrl, reason = "back-pressed")
                        }
                        promotedMediaPlayer.stop(reason = "back-pressed")
                        geckoView.visibility = View.VISIBLE
                        return
                    }
                    val activeTab = tabController.getActiveTab()
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
                                !activeHost.contains("kulchaflo.com")
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
        if (handleTabsOverlayInput(event)) {
            return true
        }
        if (!promotedMediaPlayer.isPromoted() && browserMediaController.handleMediaKey(event)) {
            return true
        }
        if (!promotedMediaPlayer.isPromoted() && handlePointerInput(event)) {
            return true
        }
        if (event.action == KeyEvent.ACTION_DOWN && event.keyCode == KeyEvent.KEYCODE_MENU) {
            toggleTabsOverlay()
            return true
        }
        return super.dispatchKeyEvent(event)
    }

    override fun onDestroy() {
        stopPointerRepeater()
        pointerHandler.removeCallbacksAndMessages(null)
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
            if (isFacebookUrl(pageUrl)) {
                GvLogger.i(
                    "GvMedia",
                    "facebook transport snapshot url=$pageUrl ${browserMediaController.describeSessionState(session)}"
                )
            }
            if (success) {
                loadRetryAttemptsBySession.remove(session)
            }
            handleMediaObservation(mediaPathController.onPageObserved(pageUrl, titleView.text?.toString()))
            if (success) {
                if (isFacebookUrl(pageUrl)) {
                    maybeDispatchFacebookCompat(session, pageUrl, reason = "page-stop")
                } else {
                    maybeDispatchYouTubeConsentCompat(session, pageUrl, reason = "page-stop")
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
                            "unified compat skipped tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} url=$pageUrl reason=media-surface"
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
            if (isWebHttpUrl(url.orEmpty())) {
                applyUserAgentPolicyForUrl(session, url.orEmpty(), reason = "location-change")
            }
            maybeDispatchFacebookCompat(session, url.orEmpty(), reason = "location-change")
            maybeDispatchYouTubeConsentCompat(session, url.orEmpty(), reason = "location-change")
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
        syncPointerToActivePage("tab-activated")
        val observation = mediaPathController.onPageObserved(tab.url, tab.title)
        handleMediaObservation(observation)
        GvLogger.i("GvTabs", "tab activated id=${tab.id} url=${tab.url} loading=${tab.isLoading}")
    }

    override fun onTabClosed(tab: GvTab) {
        loadRetryAttemptsBySession.remove(tab.session)
        browserMediaController.clearForTab(tab.id)
        GvLogger.i("GvTabs", "tab closed id=${tab.id} url=${tab.url}")
        syncPointerToActivePage("tab-closed")
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
        val activeTab = tabController.getActiveTab()
        if (activeTab == null) {
            currentUrl = url
            loadingOverlay.visibility = View.VISIBLE
            tabController.createTab(url, activate = true)
            GvLogger.i("GvNav", "launch url created tab reason=$reason url=$url")
            return
        }
        currentUrl = url
        loadingOverlay.visibility = View.VISIBLE
        applyUserAgentPolicyForUrl(activeTab.session, url, reason = "launch-$reason")
        applyMediaSessionDelegateForUrl(activeTab.session, url, reason = "launch-$reason")
        activeTab.session.loadUri(url)
        GvLogger.i("GvNav", "launch url loaded tabId=${activeTab.id} reason=$reason url=$url")
    }

    private fun handleMediaObservation(observation: GvMediaPathController.Observation?) {
        when {
            observation == null -> {
                promotedMediaPlayer.stop(reason = "page-not-eligible")
                geckoView.visibility = View.VISIBLE
            }

            observation.kind == GvMediaPathController.ObservationKind.DIRECT_MEDIA_READY -> {
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
        if (isFacebookUrl(normalizedUrl)) {
            GvLogger.i(
                "GvExt",
                "unified compat skipped tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} url=$normalizedUrl reason=facebook-host"
            )
            return
        }
        if (!shouldApplyUnifiedCompat(normalizedUrl)) {
            GvLogger.i(
                "GvExt",
                "unified compat skipped tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} url=$normalizedUrl reason=media-surface"
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
                var wakeFacebookVideo=function(){
                  var result={videoCount:0,playAttempted:false,playButtonClicked:false,states:[]};
                  try{
                    var videos=Array.from(document.querySelectorAll('video')).slice(0,6);
                    result.videoCount=videos.length;
                    for(var i=0;i<videos.length;i++){
                      var video=videos[i];
                      var state={
                        visible:visible(video),
                        paused:!!video.paused,
                        readyState:video.readyState||0,
                        networkState:video.networkState||0,
                        currentSrc:(video.currentSrc||video.src||'').slice(0,80),
                        error:video.error?video.error.code:0
                      };
                      result.states.push(state);
                      if(!state.visible){continue;}
                      try{video.setAttribute('playsinline','');}catch(_){}
                      try{video.setAttribute('webkit-playsinline','');}catch(_){}
                      try{video.controls=true;}catch(_){}
                      if(video.paused){
                        try{
                          var playResult=video.play&&video.play();
                          result.playAttempted=true;
                          if(playResult&&playResult.catch){playResult.catch(function(){});}
                        }catch(_){}
                      }
                    }
                    if(!result.playAttempted){
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
                var cookieClicked=clickCookie();
                var loginDismissed=clickLoginDismiss();
                var loginHidden=loginDismissed?false:hideLoginDialog();
                var bottomLoginHidden=hideBottomLoginRail();
                var videoWake=wakeFacebookVideo();
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

    private fun scheduleYouTubeConsentFollowUp(session: GeckoSession, delayMs: Long) {
        pointerHandler.postDelayed(
            {
                if (isFinishing || isDestroyed) {
                    return@postDelayed
                }
                val tab = tabController.findTabBySession(session) ?: return@postDelayed
                val currentTabUrl = tab.url
                if (!isGoogleVideoSurfaceUrl(currentTabUrl)) {
                    return@postDelayed
                }
                triggerYouTubeConsentCompat(session, currentTabUrl, reason = "follow-up-$delayMs")
            },
            delayMs,
        )
    }

    private fun maybeDispatchYouTubeConsentCompat(
        session: GeckoSession,
        pageUrl: String,
        reason: String,
    ) {
        if (!isGoogleVideoSurfaceUrl(pageUrl)) {
            return
        }
        triggerYouTubeConsentCompat(session, pageUrl, reason)
        if (reason == "location-change") {
            scheduleYouTubeConsentFollowUp(session, 900L)
            scheduleYouTubeConsentFollowUp(session, 2500L)
            scheduleYouTubeConsentFollowUp(session, 5000L)
        }
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

    private val permissionDelegate = object : GeckoSession.PermissionDelegate {
        override fun onContentPermissionRequest(
            session: GeckoSession,
            permission: GeckoSession.PermissionDelegate.ContentPermission,
        ): GeckoResult<Int> {
            val uriHost = runCatching { android.net.Uri.parse(permission.uri).host }.getOrNull()
            val thirdPartyHost = runCatching { android.net.Uri.parse(permission.thirdPartyOrigin).host }.getOrNull()
            val facebookScoped = isFacebookHost(uriHost) || isFacebookHost(thirdPartyHost)
            val googleVideoScoped = isGoogleVideoSurfaceHost(uriHost) || isGoogleVideoSurfaceHost(thirdPartyHost)
            val decision = when {
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
            return GeckoResult.fromValue(decision)
        }
    }

    private fun handlePointerInput(event: KeyEvent): Boolean {
        if (tabsOverlay.visibility == View.VISIBLE) {
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
                        ensurePointerVisible()
                        val firstPress = pointerDirectionKeys.add(event.keyCode)
                        if (firstPress) {
                            pointerRepeatTicks = 0
                            val delta = directionalPointerDelta(event.keyCode)
                            val move = movePointerBy(
                                deltaX = delta.first * POINTER_MOVE_STEP_PX,
                                deltaY = delta.second * POINTER_MOVE_STEP_PX,
                            )
                            maybeScrollContent(move.overshootX, move.overshootY, "initial")
                            startPointerRepeater()
                        }
                        return true
                    }
                    KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> {
                        if (!pointerVisible || !pointerOverlay.isPointerVisible()) {
                            return false
                        }
                        pointerOverlay.setPointerPressed(true)
                        pointerDownTime = SystemClock.uptimeMillis()
                        dispatchPointerClick()
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

    private fun ensurePointerVisible() {
        if (pointerVisible && pointerOverlay.isPointerVisible()) {
            schedulePointerIdleTimeout()
            return
        }
        val maxWidth = (geckoView.width.takeIf { it > 0 } ?: resources.displayMetrics.widthPixels).toFloat()
        val maxHeight = (geckoView.height.takeIf { it > 0 } ?: resources.displayMetrics.heightPixels).toFloat()
        val inset = pointerBoundsInsetPx()
        pointerX = (maxWidth * 0.5f).coerceIn(inset, maxWidth - inset)
        pointerY = (maxHeight * 0.5f).coerceIn(inset, maxHeight - inset)
        pointerOverlay.showAt(pointerX, pointerY)
        pointerVisible = true
        schedulePointerIdleTimeout()
        GvLogger.i("GvInput", "pointer visible=true reason=ensure-visible x=${pointerX.toInt()} y=${pointerY.toInt()}")
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
        pointerRepeatTicks = 0
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

    private fun syncPointerToActivePage(reason: String) {
        if (tabController.getActiveTab() == null) {
            cancelPointerIdleTimeout()
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
        pointerHandler.postDelayed(pointerIdleRunnable, POINTER_IDLE_HIDE_MS)
    }

    private fun cancelPointerIdleTimeout() {
        pointerHandler.removeCallbacks(pointerIdleRunnable)
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
        val candidates = payload.optJSONArray("directCandidates") ?: JSONArray()
        GvLogger.i(
            "GvExt",
            "media observer message tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} type=$type phase=$phase pageUrl=$pageUrl candidateCount=${candidates.length()} source=$source"
        )
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
                "unified compat applied pageUrl=$pageUrl reason=${payload.optString("reason")} clicked=${payload.optBoolean("clicked")} matched=${payload.optString("matched")} noCandidatePasses=${payload.optInt("noCandidatePasses")} redirected=${payload.optBoolean("redirectedByFallback")} decision=${payload.optString("decision")} scale=${payload.optDouble("scale")}"
            )
            return
        }
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
        if (isFacebookUrl(pageUrl)) {
            GvLogger.i(
                "GvExt",
                "media evidence ignored tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} pageUrl=$pageUrl reason=facebook-host"
            )
            return
        }
        if (!shouldPromoteDirectMedia(pageUrl)) {
            GvLogger.i(
                "GvExt",
                "media evidence ignored tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} pageUrl=$pageUrl reason=live-media-surface"
            )
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
        private const val FACEBOOK_DESKTOP_USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

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
        private const val POINTER_INITIAL_REPEAT_DELAY_MS = 110L
        private const val POINTER_REPEAT_FRAME_MS = 16L
        private const val POINTER_MOVE_STEP_PX = 18f
        private const val EDGE_PADDING_PX = 8f
        private const val EDGE_SCROLL_MULTIPLIER = 2.0f
        private const val INTERACTION_WAKE_PULSE_MIN_INTERVAL_MS = 120L
        private const val POINTER_IDLE_HIDE_MS = 3500L
        private const val DIRECT_MEDIA_PROMOTION_SUPPRESSION_MS = 15_000L
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
        val targetUa = if (isFacebookUrl(url)) FACEBOOK_DESKTOP_USER_AGENT else SONY_BRAVIA_USER_AGENT
        if (session.settings.userAgentOverride == targetUa) {
            return
        }
        session.settings.userAgentOverride = targetUa
        val policy = if (targetUa == FACEBOOK_DESKTOP_USER_AGENT) "DESKTOP_FB" else "SONY_MODERN"
        GvLogger.i(
            "GvNav",
            "ua policy applied tabId=${tabController.findTabBySession(session)?.id ?: "unknown"} policy=$policy reason=$reason url=$url"
        )
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
        if (url.isBlank() || url == "about:blank") {
            return false
        }
        if (isFacebookUrl(url) || isLiveMediaSurfaceUrl(url)) {
            return false
        }
        return isUnifiedCompatAllowlistedUrl(url)
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
            host == "abstvradio.com" && path.contains("live-streaming") -> true
            host == "player.tegotv.com" -> true
            path.contains("/player.php") -> true
            path.contains("/live-stream") -> true
            else -> false
        }
    }

    private fun isUnifiedCompatAllowlistedUrl(url: String): Boolean {
        return isKulchaFloHomepage(url)
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
