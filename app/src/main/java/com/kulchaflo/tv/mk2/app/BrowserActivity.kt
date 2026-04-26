package com.kulchaflo.tv.mk2.app

import android.os.Bundle
import android.os.Message
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.util.DisplayMetrics
import android.webkit.WebView
import android.webkit.CookieManager
import android.widget.FrameLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.kulchaflo.tv.mk2.BuildConfig
import com.kulchaflo.tv.mk2.R
import com.kulchaflo.tv.mk2.fullscreen.FullscreenController
import com.kulchaflo.tv.mk2.input.BackNavigationController
import com.kulchaflo.tv.mk2.input.FocusRecoveryController
import com.kulchaflo.tv.mk2.input.ImeHandoffController
import com.kulchaflo.tv.mk2.input.KeyRoutingResult
import com.kulchaflo.tv.mk2.input.PointerNavigationController
import com.kulchaflo.tv.mk2.input.TvInputSupervisor
import com.kulchaflo.tv.mk2.platform.PlatformDetector
import com.kulchaflo.tv.mk2.policy.BrowserPolicy
import com.kulchaflo.tv.mk2.policy.MediaPolicy
import com.kulchaflo.tv.mk2.policy.UserAgentMode
import com.kulchaflo.tv.mk2.policy.UserAgentPolicy
import com.kulchaflo.tv.mk2.promotedmedia.PromotedMediaController
import com.kulchaflo.tv.mk2.promotedmedia.GenericHtml5MediaAdapter
import com.kulchaflo.tv.mk2.promotedmedia.PromotedMediaHostView
import com.kulchaflo.tv.mk2.promotedmedia.PromotedMediaState
import com.kulchaflo.tv.mk2.promotedmedia.TextureSurfacePromotedMediaPlayer
import com.kulchaflo.tv.mk2.promotedmedia.PromotedMediaSiteAdapter
import com.kulchaflo.tv.mk2.promotedmedia.YouTubeMediaAdapter
import com.kulchaflo.tv.mk2.tabs.BrowserTab
import com.kulchaflo.tv.mk2.tabs.TabController
import com.kulchaflo.tv.mk2.tabs.TabRepository
import com.kulchaflo.tv.mk2.ui.chrome.BrowserChromeController
import com.kulchaflo.tv.mk2.ui.pointer.PointerOverlayView
import com.kulchaflo.tv.mk2.ui.tabs.TabStripView
import com.kulchaflo.tv.mk2.ui.tabs.TabsOverlayController
import com.kulchaflo.tv.mk2.util.Logger
import com.kulchaflo.tv.mk2.util.HostPolicyRegistry
import com.kulchaflo.tv.mk2.util.UrlRouter
import com.kulchaflo.tv.mk2.web.KfWebChromeClient
import com.kulchaflo.tv.mk2.web.KfWebViewClient
import com.kulchaflo.tv.mk2.web.KfWebViewFactory
import com.kulchaflo.tv.mk2.web.WebCompatRegistry
import com.kulchaflo.tv.mk2.web.WebPermissionController
import org.json.JSONArray
import org.json.JSONObject

class BrowserActivity : AppCompatActivity(),
    TabController.Listener,
    TabsOverlayController.Listener,
    FullscreenController.Listener,
    KfWebViewFactory.Callbacks {

    private lateinit var browserRoot: View
    private lateinit var tabHostContainer: FrameLayout
    private lateinit var fullscreenHostContainer: FrameLayout
    private lateinit var promotedMediaHostContainer: PromotedMediaHostView
    private lateinit var tabsOverlayContainer: FrameLayout
    private lateinit var startupLoadingOverlay: FrameLayout
    private lateinit var pointerOverlay: PointerOverlayView
    private lateinit var chromeController: BrowserChromeController
    private lateinit var fullscreenController: FullscreenController
    private lateinit var focusRecoveryController: FocusRecoveryController
    private lateinit var imeHandoffController: ImeHandoffController
    private lateinit var pointerNavigationController: PointerNavigationController
    private lateinit var tabsOverlayController: TabsOverlayController
    private lateinit var tabController: TabController
    private lateinit var backNavigationController: BackNavigationController
    private lateinit var inputSupervisor: TvInputSupervisor
    private lateinit var browserPolicy: BrowserPolicy
    private lateinit var compatRegistry: WebCompatRegistry
    private lateinit var promotedMediaController: PromotedMediaController
    private val pendingTrustedOutboundPopups = mutableMapOf<WebView, TrustedOutboundPopupProxy>()
    private var pendingYouTubeNavigationEscalation: YouTubeNavigationEscalationSession? = null
    private var nextYouTubeNavigationEscalationToken: Long = 1L
    private var pendingYouTubePlaybackResolutionSession: YouTubePlaybackResolutionSession? = null
    private var initialLoadBrandingVisible: Boolean = true
    private var startupPageLoaded: Boolean = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_browser)
        configureWindowForTv()

        browserRoot = findViewById(R.id.browser_root)
        tabHostContainer = findViewById(R.id.tab_host_container)
        fullscreenHostContainer = findViewById(R.id.fullscreen_host_container)
        promotedMediaHostContainer = findViewById(R.id.promoted_media_host_container)
        tabsOverlayContainer = findViewById(R.id.tabs_overlay_container)
        startupLoadingOverlay = findViewById(R.id.startup_loading_overlay)
        pointerOverlay = findViewById(R.id.pointer_overlay)
        chromeController = BrowserChromeController(
            chromeView = findViewById(R.id.chrome_placeholder),
            titleView = findViewById<TextView>(R.id.chrome_title),
        )

        val platformCapabilities = PlatformDetector().detect(this)
        browserPolicy = BrowserPolicy(
            startUrl = UrlRouter.normalize(BuildConfig.DEFAULT_START_URL),
            platformCapabilities = platformCapabilities,
        )
        Logger.i("BrowserActivity", "startup runtime selected = in-app url=${browserPolicy.startUrl}")
        val displayMetrics: DisplayMetrics = resources.displayMetrics
        Logger.i(
            "BrowserActivity",
            "display metrics widthPx=${displayMetrics.widthPixels} heightPx=${displayMetrics.heightPixels} densityDpi=${displayMetrics.densityDpi}"
        )

        fullscreenController = FullscreenController(fullscreenHostContainer)
        fullscreenController.setListener(this)
        focusRecoveryController = FocusRecoveryController()
        imeHandoffController = ImeHandoffController()
        pointerNavigationController = PointerNavigationController(
            rootView = browserRoot,
            overlayView = pointerOverlay,
            onPointerClickDispatched = { webView ->
                imeHandoffController.onPointerClickObserved()
                probeEditableFocusAfterPointerClick(webView)
            },
        )
        tabsOverlayController = TabsOverlayController(tabsOverlayContainer, TabStripView(this))
        tabsOverlayController.setListener(this)

        compatRegistry = WebCompatRegistry()
        promotedMediaController = PromotedMediaController(
            hostView = promotedMediaHostContainer,
            adapters = listOf(
                GenericHtml5MediaAdapter(),
                YouTubeMediaAdapter(),
            ),
            player = TextureSurfacePromotedMediaPlayer(),
            resolutionContextProvider = ::buildPromotedMediaResolutionContext,
        )
        promotedMediaController.enterBrowserMode("activity-created")
        Logger.i(
            BUILD_MARKER_TAG,
            "buildMarker=yt_zoom_skip:on yt_html_fallback:off page_fullscreen_pointer:on"
        )
        val webViewFactory = KfWebViewFactory(
            context = this,
            userAgentPolicy = UserAgentPolicy(selectUserAgentMode(platformCapabilities)),
            mediaPolicy = MediaPolicy(),
            focusRecoveryController = focusRecoveryController,
            fullscreenController = fullscreenController,
            compatRegistry = compatRegistry,
            permissionController = WebPermissionController(),
            callbacks = this,
        )
        Logger.i(
            "BrowserActivity",
            "selected ua mode=${selectUserAgentMode(platformCapabilities)}"
        )
        tabController = TabController(TabRepository(), webViewFactory, focusRecoveryController, this)
        backNavigationController = BackNavigationController(
            activity = this,
            fullscreenController = fullscreenController,
            tabsOverlayController = tabsOverlayController,
            imeHandoffController = imeHandoffController,
            tabController = tabController,
            onPromotedMediaExitRequested = {
                if (promotedMediaController.isPromotedActive()) {
                    requestExitPromotedMedia("back-pressed")
                    true
                } else {
                    false
                }
            },
            onFullscreenExited = { focusRecoveryController.onFullscreenExited(it) },
            onImeDismissed = { focusRecoveryController.onImeDismissed(it) },
        )
        inputSupervisor = TvInputSupervisor(
            fullscreenController = fullscreenController,
            tabsOverlayController = tabsOverlayController,
            imeHandoffController = imeHandoffController,
            backNavigationController = backNavigationController,
            tabController = tabController,
            pointerNavigationController = pointerNavigationController,
            onTabsTrigger = ::toggleTabsOverlay,
            onPromotedMediaTrigger = ::handlePromotedMediaTrigger,
        )

        if (savedInstanceState == null) {
            tabController.createTab(browserPolicy.startUrl, activate = true)
        }

        bindImeVisibilityTracking()

        // TODO: Restore tab/session state once the thin shell is validated on TV devices.
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        return when (inputSupervisor.route(event)) {
            KeyRoutingResult.CONSUMED -> true
            KeyRoutingResult.NOT_HANDLED -> super.dispatchKeyEvent(event)
        }
    }

    override fun onTabCreated(tab: BrowserTab, activate: Boolean) {
        tab.webView.layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
        )
        tab.webView.onFocusChangeListener = View.OnFocusChangeListener { _, hasFocus ->
            if (hasFocus && tabController.getActiveTab()?.id == tab.id) {
                Logger.d("KfFocusDebug", "webview focus restored tabId=${tab.id}")
                imeHandoffController.onWebViewFocusRestored()
                refreshPointerMode("webview-focus-restored")
            }
        }
        tab.webView.visibility = if (activate) WebView.VISIBLE else WebView.GONE
        tabHostContainer.addView(tab.webView)
        tabsOverlayController.refresh(tabController.getTabs(), tabController.getActiveTab()?.id)
        refreshPointerMode("tab-created")
        if (!activate) {
            // TODO: Add background preloading policy once tab UX is verified.
        }
    }

    override fun onTabClosed(tab: BrowserTab) {
        Logger.d("KfTabDebug", "activity tab closed id=${tab.id}")
        tabHostContainer.removeView(tab.webView)
        tabsOverlayController.refresh(tabController.getTabs(), tabController.getActiveTab()?.id)
        refreshPointerMode("tab-closed")
    }

    override fun onTabActivated(tab: BrowserTab) {
        Logger.d("KfTabDebug", "activity tab activated id=${tab.id}")
        repeat(tabHostContainer.childCount) { index ->
            tabHostContainer.getChildAt(index).visibility = WebView.GONE
        }
        tab.webView.visibility = WebView.VISIBLE
        chromeController.updateTitle(tab.webView.title)
        tabsOverlayController.hide()
        focusRecoveryController.onTabActivated(tab.webView)
        pointerNavigationController.setActiveWebView(tab.webView)
        if (promotedMediaController.getState() != PromotedMediaState.PROMOTED) {
            promotedMediaController.enterBrowserMode("tab-activated")
        }
        refreshPointerMode("tab-activated")
    }

    override fun onTabActivatedFromOverlay(tabId: String) {
        Logger.d("KfTabDebug", "overlay activate requested id=$tabId")
        tabController.activateTab(tabId)
    }

    override fun onTabCloseRequestedFromOverlay(tabId: String) {
        if (tabController.getTabs().size <= 1) {
            Logger.d("KfTabDebug", "overlay close blocked reason=last-tab id=$tabId")
            return
        }
        Logger.d("KfTabDebug", "overlay close requested id=$tabId")
        tabController.closeTab(tabId)
        if (tabsOverlayController.isVisible()) {
            tabsOverlayController.show(tabController.getTabs(), tabController.getActiveTab()?.id)
        }
    }

    override fun onPageStarted(url: String?) {
        Logger.d("BrowserActivity", "page started url=$url")
        pointerNavigationController.onPageStarted()
        promotedMediaController.evaluatePage(
            pageUrl = url,
            pageTitle = tabController.getActiveTab()?.webView?.title,
        )
        captureBrowserEnvironment(url, phase = "page-started")
    }

    override fun onPageFinished(url: String?) {
        Logger.d("BrowserActivity", "page finished url=$url")
        promotedMediaController.evaluatePage(
            pageUrl = url,
            pageTitle = tabController.getActiveTab()?.webView?.title,
        )
        if (isYouTubePlaybackPage(url)) {
            maybeRequestYouTubePlaybackResolution(
                expectedUrl = url,
                reason = "page-evaluated-page-finished",
            )
        }
        maybeEscalateYouTubeNavigationPage(url)
        applyBrowserPresentation(url)
    }

    override fun onUrlChanged(url: String?) {
        Logger.d("BrowserActivity", "url changed url=$url")
        promotedMediaController.evaluatePage(
            pageUrl = url,
            pageTitle = tabController.getActiveTab()?.webView?.title,
        )
        if (!isYouTubeNavigationEscalationActiveFor(url)) {
            clearYouTubeNavigationEscalationSession("url-changed")
        }
        if (!isYouTubePlaybackPage(url)) {
            clearPendingYouTubePlaybackResolution("url-changed-not-playback")
        } else {
            maybeRequestYouTubePlaybackResolution(expectedUrl = url, reason = "page-evaluated-url-changed")
            ensureYouTubePlaybackResolutionSession(expectedUrl = url, reason = "url-changed")
        }
    }

    override fun onPopupProxyNavigation(view: WebView?, url: String): Boolean {
        val proxy = pendingTrustedOutboundPopups.remove(view) ?: return false
        val activeWebView = tabController.getActiveTab()?.webView
        if (activeWebView == null) {
            Logger.w(
                "BrowserActivity",
                "trusted outbound merge failed reason=no-active-webview url=$url popupTabId=${proxy.popupTabId}"
            )
            return false
        }
        Logger.i("BrowserActivity", "trusted outbound merge into current tab url=${proxy.targetUrl}")
        activeWebView.loadUrl(proxy.targetUrl)
        tabController.closeTab(proxy.popupTabId)
        Logger.i("BrowserActivity", "popup child closed reason=trusted-outbound-merged id=${proxy.popupTabId}")
        return true
    }

    override fun onTitleReceived(title: String?) {
        tabController.updateActiveTabTitle(title)
        chromeController.updateTitle(title)
        tabsOverlayController.refresh(tabController.getTabs(), tabController.getActiveTab()?.id)
    }

    override fun onProgressChanged(progress: Int) {
        Logger.d("BrowserActivity", "progress=$progress")
    }

    override fun onCreateWindowRequested(
        sourceView: WebView?,
        isDialog: Boolean,
        isUserGesture: Boolean,
        resultMsg: Message?,
    ): Boolean {
        Logger.i(
            "BrowserActivity",
            "popup/new-window requested isDialog=$isDialog isUserGesture=$isUserGesture"
        )

        val transport = resultMsg?.obj as? WebView.WebViewTransport ?: run {
            Logger.w("BrowserActivity", "popup/new-window ignored because transport was missing")
            return false
        }

        val trustedOutboundUrl = extractTrustedOutboundUrl(sourceView)
        if (!trustedOutboundUrl.isNullOrBlank()) {
            val host = HostPolicyRegistry.normalizedHost(trustedOutboundUrl).orEmpty()
            val popupTab = tabController.createPopupTab(activate = false)
            Logger.i(
                "BrowserActivity",
                "popup handling mode=trusted-outbound-popup-proxy host=$host sourceIsActive=${sourceView === tabController.getActiveTab()?.webView}"
            )
            Logger.i(
                "BrowserActivity",
                "popup background suppressed reason=trusted-outbound"
            )
            Logger.i(
                "BrowserActivity",
                "popup auto-activation suppressed reason=trusted-outbound"
            )
            Logger.i(
                "BrowserActivity",
                "popup transport target=child-webview reason=webview-contract popupTabId=${popupTab.id}"
            )
            pendingTrustedOutboundPopups[popupTab.webView] = TrustedOutboundPopupProxy(
                popupTabId = popupTab.id,
                targetUrl = trustedOutboundUrl,
            )
            transport.webView = popupTab.webView
            resultMsg.sendToTarget()
            return true
        }

        val handlingMode = if (isDialog) {
            "popup-dialog-activate"
        } else {
            "create-background-popup"
        }
        val activatePopup = isDialog
        Logger.i(
            "BrowserActivity",
            "popup handling mode=$handlingMode sourceIsActive=${sourceView === tabController.getActiveTab()?.webView} autoActivate=$activatePopup"
        )
        if (!activatePopup) {
            Logger.i(
                "BrowserActivity",
                "popup auto-activation suppressed reason=single-interaction-preserve isUserGesture=$isUserGesture isDialog=$isDialog"
            )
        } else {
            Logger.i(
                "BrowserActivity",
                "popup auto-activation allowed reason=dialog-popup isUserGesture=$isUserGesture isDialog=$isDialog"
            )
        }

        val popupTab = tabController.createPopupTab(activate = activatePopup)
        transport.webView = popupTab.webView
        resultMsg.sendToTarget()
        return true
    }

    override fun onIconReceived(icon: android.graphics.Bitmap?) {
        // No-op for v1. Title-only tab rendering keeps startup lean.
    }

    override fun onResume() {
        super.onResume()
        Logger.d("KfFocusDebug", "activity resume requestApplyInsets=true")
        ViewCompat.requestApplyInsets(browserRoot)
        focusRecoveryController.onTabActivated(tabController.getActiveTab()?.webView)
        refreshPointerMode("activity-resume")
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        Logger.d("KfFocusDebug", "windowFocusChanged hasFocus=$hasFocus")
        if (hasFocus) {
            hideSystemBars()
            ViewCompat.requestApplyInsets(browserRoot)
            focusRecoveryController.onTabActivated(tabController.getActiveTab()?.webView)
            refreshPointerMode("window-focus")
        }
    }

    override fun onFullscreenEntered(mode: FullscreenController.FullscreenMode) {
        hideSystemBars()
        Logger.i(
            "KfBrowserPresentation",
            "fullscreen-entered mode=${if (mode == FullscreenController.FullscreenMode.VIDEO_FULLSCREEN) "video_fullscreen" else "page_fullscreen"}"
        )
        refreshPointerMode("fullscreen-entered")
        if (mode == FullscreenController.FullscreenMode.PAGE_FULLSCREEN) {
            val classification = fullscreenController.currentClassification()
            Logger.i(
                "KfFullscreenDebug",
                "fullscreen custom view contains SurfaceView=${classification?.stats?.surfaceViews ?: 0} TextureView=${classification?.stats?.textureViews ?: 0} kind=${classification?.kind ?: "unknown"}"
            )
            val youTubeAssist = isYouTubeUrl(tabController.getActiveTab()?.webView?.url)
            if (youTubeAssist) {
                Logger.i(
                    "KfPromotedMedia",
                    "wrapper route disabled for media playback platform=youtube pageKind=page_fullscreen staying in browser reason=wrapper-disabled"
                )
            }
            pointerNavigationController.setFullscreenInputTarget(
                target = fullscreenController.currentPageFullscreenInputTarget(),
                fallbackTarget = fullscreenController.currentPageFullscreenFallbackTarget(),
                reason = "fullscreen-entered-page",
            )
            pointerNavigationController.enterPageFullscreenPointerMode("fullscreen-entered-page")
        } else {
            pointerNavigationController.clearFullscreenInputTarget("fullscreen-entered-video")
            pointerNavigationController.exitPageFullscreenPointerMode("fullscreen-entered-video")
        }
    }

    override fun onFullscreenExited() {
        hideSystemBars()
        pointerNavigationController.clearFullscreenInputTarget("fullscreen-exited")
        pointerNavigationController.exitPageFullscreenPointerMode("fullscreen-exited")
        refreshPointerMode("fullscreen-exited")
    }

    private fun extractTrustedOutboundUrl(sourceView: WebView?): String? {
        val candidate = sourceView?.hitTestResult?.extra?.takeIf { it.isNotBlank() } ?: return null
        val host = HostPolicyRegistry.normalizedHost(candidate) ?: return null
        return if (HostPolicyRegistry.isTrustedOutboundPopupHost(host)) {
            candidate
        } else {
            null
        }
    }

    private fun isYouTubeUrl(url: String?): Boolean {
        return HostPolicyRegistry.isYouTubeHost(HostPolicyRegistry.normalizedHost(url))
    }

    private fun resolveYouTubePageKind(url: String?): String? {
        val parsed = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return null
        val host = HostPolicyRegistry.normalizedHostFromHost(parsed.host) ?: return null
        if (!HostPolicyRegistry.isYouTubeHost(host)) return null
        val path = parsed.encodedPath.orEmpty()
        return when {
            host == "youtu.be" -> "youtu-be"
            path.startsWith("/watch") -> "watch"
            path.startsWith("/playlist") -> "playlist"
            path.startsWith("/shorts") -> "shorts"
            path.startsWith("/live") -> "live"
            path.startsWith("/embed") -> "embed"
            path.startsWith("/channel/") -> "channel"
            path.startsWith("/c/") -> "custom-channel"
            path.startsWith("/user/") -> "user-channel"
            path.startsWith("/@") -> "handle-channel"
            else -> "other"
        }
    }

    private fun isYouTubeNavigationEscalationPage(kind: String, url: String?): Boolean {
        if (kind !in setOf("handle-channel", "channel", "custom-channel", "user-channel")) {
            return false
        }
        val path = runCatching { android.net.Uri.parse(url).encodedPath.orEmpty() }.getOrDefault("")
        return path.contains("/streams") || path.contains("/live") || path.contains("/videos") || path.endsWith("/featured") || path == "/@"
            || path.startsWith("/@") || path.startsWith("/channel/") || path.startsWith("/c/") || path.startsWith("/user/")
    }

    private fun isYouTubeNavigationEscalationActiveFor(url: String?): Boolean {
        val kind = resolveYouTubePageKind(url) ?: return false
        return isYouTubeNavigationEscalationPage(kind, url)
    }

    private fun normalizedYouTubeNavigationPageIdentity(url: String?, kind: String? = resolveYouTubePageKind(url)): String? {
        val pageKind = kind ?: return null
        if (!isYouTubeNavigationEscalationPage(pageKind, url)) return null
        val parsed = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return null
        val host = HostPolicyRegistry.normalizedHostFromHost(parsed.host) ?: return null
        val path = parsed.encodedPath.orEmpty().trimEnd('/').ifBlank { "/" }
        return "$host|$pageKind|$path"
    }

    private fun clearYouTubeNavigationEscalationSession(reason: String) {
        val session = pendingYouTubeNavigationEscalation ?: return
        session.retryRunnable?.let { session.webView.removeCallbacks(it) }
        pendingYouTubeNavigationEscalation = null
        Logger.d(
            "KfYouTubeRoute",
            "youtube navigation escalation session cleared reason=$reason token=${session.token} attempts=${session.attempt}"
        )
    }

    private fun maybeEscalateYouTubeNavigationPage(url: String?) {
        val activeWebView = tabController.getActiveTab()?.webView ?: return
        val pageUrl = url ?: activeWebView.url ?: return
        val pageKind = resolveYouTubePageKind(pageUrl) ?: return
        if (!isYouTubeNavigationEscalationPage(pageKind, pageUrl)) {
            clearYouTubeNavigationEscalationSession("not-navigation-page")
            return
        }
        val pageIdentity = normalizedYouTubeNavigationPageIdentity(pageUrl, pageKind) ?: return
        val existingSession = pendingYouTubeNavigationEscalation
        if (existingSession != null && existingSession.pageIdentity == pageIdentity && existingSession.webView == activeWebView) {
            return
        }
        clearYouTubeNavigationEscalationSession("new-navigation-page")
        Logger.i("KfYouTubeRoute", "youtube navigation page detected kind=$pageKind url=$pageUrl")
        val session = YouTubeNavigationEscalationSession(
            token = nextYouTubeNavigationEscalationToken++,
            webView = activeWebView,
            pageUrl = pageUrl,
            pageKind = pageKind,
            pageIdentity = pageIdentity,
        )
        pendingYouTubeNavigationEscalation = session
        runYouTubeNavigationEscalationAttempt(session)
    }

    private fun runYouTubeNavigationEscalationAttempt(session: YouTubeNavigationEscalationSession) {
        val activeWebView = tabController.getActiveTab()?.webView
        if (pendingYouTubeNavigationEscalation?.token != session.token || activeWebView !== session.webView) {
            Logger.i(
                "KfYouTubeRoute",
                "youtube navigation escalation stale-result ignored reason=webview-changed token=${session.token} attempt=${session.attempt + 1}"
            )
            if (pendingYouTubeNavigationEscalation?.token == session.token) {
                clearYouTubeNavigationEscalationSession("webview-changed-before-attempt")
            }
            return
        }
        val currentUrl = activeWebView?.url
        val currentIdentity = normalizedYouTubeNavigationPageIdentity(currentUrl)
        if (currentIdentity != session.pageIdentity) {
            Logger.i(
                "KfYouTubeRoute",
                "youtube navigation escalation stale-result ignored reason=page-changed token=${session.token} expectedIdentity=${session.pageIdentity} actualIdentity=$currentIdentity"
            )
            clearYouTubeNavigationEscalationSession("page-changed-before-attempt")
            return
        }
        val attempt = session.attempt + 1
        session.attempt = attempt
        Logger.i("KfYouTubeRoute", "youtube navigation escalation pageKind=${session.pageKind} attempt=$attempt")
        session.webView.evaluateJavascript(YOUTUBE_NAVIGATION_ESCALATION_SCRIPT) { rawResult ->
            handleYouTubeNavigationEscalationResult(session, rawResult)
        }
    }

    private fun handleYouTubeNavigationEscalationResult(
        session: YouTubeNavigationEscalationSession,
        rawResult: String?,
    ) {
        val currentSession = pendingYouTubeNavigationEscalation
        val activeWebView = tabController.getActiveTab()?.webView
        val currentUrl = activeWebView?.url
        if (currentSession?.token != session.token || activeWebView !== session.webView) {
            Logger.i(
                "KfYouTubeRoute",
                "youtube navigation escalation stale-result ignored reason=webview-changed token=${session.token} attempt=${session.attempt}"
            )
            if (currentSession?.token == session.token) {
                clearYouTubeNavigationEscalationSession("webview-changed-after-callback")
            }
            return
        }
        val currentIdentity = normalizedYouTubeNavigationPageIdentity(currentUrl)
        if (currentIdentity != session.pageIdentity) {
            Logger.i(
                "KfYouTubeRoute",
                "youtube navigation escalation stale-result ignored reason=page-changed token=${session.token} expectedIdentity=${session.pageIdentity} actualIdentity=$currentIdentity"
            )
            clearYouTubeNavigationEscalationSession("page-changed-after-callback")
            return
        }
        val payload = decodeJavascriptString(rawResult)
        if (payload.isNullOrBlank()) {
            maybeScheduleYouTubeNavigationEscalationRetry(
                session = session,
                candidateCount = 0,
                reason = "blank-result",
            )
            return
        }
        runCatching {
            val json = JSONObject(payload)
            val candidateCount = json.optInt("candidateCount", 0)
            val topCandidateHref = json.optString("topCandidateHref")
            val topCandidateScore = json.optInt("topCandidateScore", 0)
            Logger.i("KfYouTubeRoute", "youtube navigation escalation candidates count=$candidateCount")
            if (topCandidateHref.isNotBlank()) {
                Logger.i(
                    "KfYouTubeRoute",
                    "youtube navigation escalation top-candidate href=$topCandidateHref score=$topCandidateScore count=$candidateCount"
                )
            }
            when (json.optString("status").ifBlank { "invalid" }) {
                "found" -> {
                    val watchUrl = json.optString("watchUrl").takeIf { it.isNotBlank() }
                    if (watchUrl.isNullOrBlank()) {
                        maybeScheduleYouTubeNavigationEscalationRetry(
                            session = session,
                            candidateCount = candidateCount,
                            reason = "missing-watch-url",
                        )
                        return@runCatching
                    }
                    Logger.i("KfYouTubeRoute", "youtube navigation escalation found watchUrl=$watchUrl")
                    Logger.i("KfYouTubeRoute", "youtube navigation escalation auto-open disabled reason=user-selection-required")
                    clearYouTubeNavigationEscalationSession("watch-url-found")
                }

                else -> {
                    val reason = json.optString("reason").ifBlank { "no-qualified-watch-url" }
                    maybeScheduleYouTubeNavigationEscalationRetry(
                        session = session,
                        candidateCount = candidateCount,
                        reason = reason,
                    )
                }
            }
        }.onFailure {
            maybeScheduleYouTubeNavigationEscalationRetry(
                session = session,
                candidateCount = 0,
                reason = "parse-failure",
            )
        }
    }

    private fun maybeScheduleYouTubeNavigationEscalationRetry(
        session: YouTubeNavigationEscalationSession,
        candidateCount: Int,
        reason: String,
    ) {
        if (pendingYouTubeNavigationEscalation?.token != session.token) {
            return
        }
        if (session.attempt >= YOUTUBE_NAVIGATION_ESCALATION_MAX_ATTEMPTS) {
            clearYouTubeNavigationEscalationSession("attempt-limit")
            Logger.i(
                "KfYouTubeRoute",
                "youtube navigation escalation no-watch-target-found candidates=$candidateCount reason=$reason attempts=${session.attempt}"
            )
            return
        }
        session.retryRunnable?.let { session.webView.removeCallbacks(it) }
        val retryRunnable = Runnable { runYouTubeNavigationEscalationAttempt(session) }
        session.retryRunnable = retryRunnable
        session.webView.postDelayed(retryRunnable, YOUTUBE_NAVIGATION_ESCALATION_RETRY_MS)
    }

    private fun decodeJavascriptString(rawResult: String?): String? {
        if (rawResult.isNullOrBlank() || rawResult == "null") return null
        return runCatching {
            JSONArray("[$rawResult]").getString(0)
        }.getOrElse {
            rawResult.trim('"')
        }
    }

    private fun requestEnterPromotedMedia(reason: String) {
        promotedMediaController.requestEnterEligibleMedia(reason)
        refreshPointerMode("promoted-media-enter-request")
    }

    private fun clearPendingYouTubePlaybackResolution(reason: String) {
        val session = pendingYouTubePlaybackResolutionSession ?: return
        session.retryRunnable?.let { session.webView.removeCallbacks(it) }
        pendingYouTubePlaybackResolutionSession = null
        Logger.d(
            "KfPromotedMedia",
            "youtube playback resolution pending cleared reason=$reason url=${session.pageUrl} attempts=${session.attempts}"
        )
    }

    private fun isYouTubePlaybackPage(url: String?): Boolean {
        return resolveYouTubePageKind(url) in setOf("watch", "live", "shorts", "embed", "youtu-be")
    }

    private fun maybeRequestYouTubePlaybackResolution(expectedUrl: String?, reason: String): Boolean {
        if (promotedMediaController.isPromotedActive()) {
            Logger.i("KfPromotedMedia", "youtube playback resolution skipped reason=already-promoted trigger=$reason")
            return false
        }
        val activeWebView = tabController.getActiveTab()?.webView ?: return false
        val pageUrl = expectedUrl ?: activeWebView.url ?: return false
        if (!isYouTubePlaybackPage(pageUrl)) {
            Logger.i("KfPromotedMedia", "youtube playback resolution skipped reason=not-playback-page trigger=$reason url=$pageUrl")
            return false
        }
        val currentUrl = activeWebView.url
        if (!currentUrl.isNullOrBlank() && currentUrl != pageUrl && isYouTubePlaybackPage(currentUrl)) {
            Logger.i(
                "KfPromotedMedia",
                "youtube playback resolution skipped reason=url-mismatch trigger=$reason expectedUrl=$pageUrl actualUrl=$currentUrl"
            )
            return false
        }
        val eligibleSession = promotedMediaController.getEligibleSession()
        if (!promotedMediaController.hasEligibleSession() || eligibleSession == null) {
            Logger.i(
                "KfPromotedMedia",
                "youtube playback resolution skipped reason=no-eligible-session trigger=$reason expectedUrl=$pageUrl"
            )
            return false
        }
        if (eligibleSession.pageUrl != pageUrl || !isYouTubePlaybackPage(eligibleSession.pageUrl)) {
            Logger.i(
                "KfPromotedMedia",
                "youtube playback resolution skipped reason=eligible-session-mismatch trigger=$reason expectedUrl=$pageUrl eligibleUrl=${eligibleSession.pageUrl} pageKind=${eligibleSession.pageKind}"
            )
            return false
        }
        val session = pendingYouTubePlaybackResolutionSession
        if (session != null && session.pageUrl == pageUrl && session.lastAttemptedUrl == pageUrl) {
            Logger.i(
                "KfPromotedMedia",
                "youtube playback resolution skipped reason=already-attempted trigger=$reason url=$pageUrl attempt=${session.attempts}"
            )
            return false
        }
        if (session != null && session.pageUrl == pageUrl) {
            session.lastAttemptedUrl = pageUrl
        }
        Logger.i(
            "KfPromotedMedia",
            "youtube playback resolution trigger accepted reason=$reason url=$pageUrl"
        )
        if (session != null && session.pageUrl == pageUrl) {
            session.lastAttemptedReason = reason
        }
        requestEnterPromotedMedia("youtube-playback-$reason")
        return true
    }

    private fun ensureYouTubePlaybackResolutionSession(expectedUrl: String?, reason: String) {
        val activeWebView = tabController.getActiveTab()?.webView ?: return
        val pageUrl = expectedUrl ?: activeWebView.url ?: return
        if (!isYouTubePlaybackPage(pageUrl)) {
            clearPendingYouTubePlaybackResolution("not-playback-page")
            return
        }
        val existing = pendingYouTubePlaybackResolutionSession
        if (existing != null && existing.webView === activeWebView && existing.pageUrl == pageUrl) {
            scheduleNextYouTubePlaybackResolutionAttempt(existing, reason)
            return
        }
        clearPendingYouTubePlaybackResolution("new-playback-page")
        val session = YouTubePlaybackResolutionSession(
            token = nextYouTubeNavigationEscalationToken++,
            webView = activeWebView,
            pageUrl = pageUrl,
        )
        pendingYouTubePlaybackResolutionSession = session
        scheduleNextYouTubePlaybackResolutionAttempt(session, reason)
    }

    private fun scheduleNextYouTubePlaybackResolutionAttempt(
        session: YouTubePlaybackResolutionSession,
        reason: String,
    ) {
        if (pendingYouTubePlaybackResolutionSession?.token != session.token) {
            return
        }
        if (session.attempts >= YOUTUBE_PLAYBACK_RESOLUTION_MAX_ATTEMPTS) {
            Logger.i(
                "KfPromotedMedia",
                "youtube playback resolution retry window exhausted url=${session.pageUrl} attempts=${session.attempts} lastReason=${session.lastAttemptedReason ?: "none"}"
            )
            clearPendingYouTubePlaybackResolution("attempt-limit")
            return
        }
        session.retryRunnable?.let { session.webView.removeCallbacks(it) }
        val retryRunnable = Runnable {
            if (pendingYouTubePlaybackResolutionSession?.token != session.token) {
                return@Runnable
            }
            val currentWebView = tabController.getActiveTab()?.webView
            val currentUrl = currentWebView?.url
            if (currentWebView !== session.webView || !isYouTubePlaybackPage(currentUrl) || currentUrl != session.pageUrl) {
                Logger.i(
                    "KfPromotedMedia",
                    "youtube playback resolution skipped reason=stale-watch-page trigger=$reason expectedUrl=${session.pageUrl} actualUrl=$currentUrl"
                )
                clearPendingYouTubePlaybackResolution("stale-watch-page")
                return@Runnable
            }
            session.attempts += 1
            maybeRequestYouTubePlaybackResolution(
                expectedUrl = session.pageUrl,
                reason = "watch-retry-${session.attempts}:$reason",
            )
            if (!promotedMediaController.isPromotedActive()) {
                scheduleNextYouTubePlaybackResolutionAttempt(session, reason)
            } else {
                clearPendingYouTubePlaybackResolution("promoted-active")
            }
        }
        session.retryRunnable = retryRunnable
        session.webView.postDelayed(retryRunnable, YOUTUBE_PLAYBACK_RESOLUTION_DELAY_MS)
    }

    private fun requestExitPromotedMedia(reason: String) {
        promotedMediaController.exitPromotedMedia(reason)
        refreshPointerMode("promoted-media-exit-request")
    }

    private fun handlePromotedMediaTrigger(reason: String): Boolean {
        val eligibleSession = promotedMediaController.getEligibleSession()
        if (promotedMediaController.isPromotedActive()) {
            Logger.i(
                "KfPromotedMedia",
                "trigger ignored reason=already-promoted state=${promotedMediaController.getState().name.lowercase()}"
            )
            return false
        }
        if (eligibleSession == null || !promotedMediaController.hasEligibleSession()) {
            Logger.i("KfPromotedMedia", "trigger ignored reason=no-eligible-session trigger=$reason")
            return false
        }
        Logger.i(
            "KfPromotedMedia",
            "trigger accepted trigger=$reason platform=${eligibleSession.platformId} pageKind=${eligibleSession.pageKind} pageUrl=${eligibleSession.pageUrl}"
        )
        requestEnterPromotedMedia(reason)
        return true
    }

    private fun buildPromotedMediaResolutionContext(): PromotedMediaSiteAdapter.ResolutionContext? {
        val webView = tabController.getActiveTab()?.webView ?: return null
        return object : PromotedMediaSiteAdapter.ResolutionContext {
            override val pageUrl: String?
                get() = webView.url

            override val userAgent: String?
                get() = webView.settings.userAgentString

            override fun cookiesFor(url: String): String? = CookieManager.getInstance().getCookie(url)

            override fun evaluateJavascript(script: String, callback: (String?) -> Unit) {
                webView.post {
                    webView.evaluateJavascript(script, callback)
                }
            }
        }
    }

    private fun bindImeVisibilityTracking() {
        ViewCompat.setOnApplyWindowInsetsListener(browserRoot) { _, insets ->
            when (imeHandoffController.updateImeVisible(insets.isVisible(WindowInsetsCompat.Type.ime()))) {
                ImeHandoffController.VisibilityChange.HIDDEN -> {
                    Logger.d("KfInputDebug", "ime visibility changed visible=false")
                    focusRecoveryController.onImeDismissed(tabController.getActiveTab()?.webView)
                    refreshPointerMode("ime-hidden")
                }

                ImeHandoffController.VisibilityChange.SHOWN -> {
                    Logger.d("KfInputDebug", "ime visibility changed visible=true")
                    refreshPointerMode("ime-shown")
                }

                ImeHandoffController.VisibilityChange.UNCHANGED -> Unit
            }
            insets
        }
        ViewCompat.requestApplyInsets(browserRoot)
    }

    private fun configureWindowForTv() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        hideSystemBars()
    }

    private fun hideSystemBars() {
        WindowInsetsControllerCompat(window, window.decorView).let { controller ->
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun probeEditableFocusAfterPointerClick(webView: com.kulchaflo.tv.mk2.web.KfWebView) {
        webView.postDelayed({
            webView.evaluateJavascript(
                """
                (function() {
                  var el = document.activeElement;
                  if (!el) return "none";
                  var tag = (el.tagName || "").toLowerCase();
                  var type = (el.type || "").toLowerCase();
                  var editable = !!el.isContentEditable;
                  var textInput =
                    tag === "textarea" ||
                    tag === "select" ||
                    tag === "input" ||
                    editable;
                  return textInput ? (tag + ":" + type + ":" + editable) : "none";
                })();
                """.trimIndent()
            ) { result ->
                if (result != null && result != "\"none\"") {
                    Logger.d("KfInputDebug", "editable focus confirmed result=$result")
                    imeHandoffController.onEditableFocusConfirmed("dom-activeElement:$result")
                    refreshPointerMode("editable-focus-likely")
                } else {
                    Logger.d("KfInputDebug", "editable focus not confirmed result=$result")
                    imeHandoffController.onEditableFocusNotConfirmed("dom-activeElement:none")
                }
            }
        }, 120L)
    }

    fun toggleTabsOverlay(): Boolean {
        if (tabsOverlayController.isVisible()) {
            val hidden = tabsOverlayController.hide()
            if (hidden) {
                Logger.d("KfTabDebug", "toggle overlay result=hide")
                focusRecoveryController.onTabActivated(tabController.getActiveTab()?.webView)
                refreshPointerMode("tabs-overlay-hidden")
            }
            return hidden
        }
        Logger.d("KfTabDebug", "toggle overlay result=show")
        tabsOverlayController.show(tabController.getTabs(), tabController.getActiveTab()?.id)
        refreshPointerMode("tabs-overlay-shown")
        return true
    }

    private fun refreshPointerMode(reason: String) {
        val shouldEnable = ENABLE_POINTER_MODE &&
            startupPageLoaded &&
            !initialLoadBrandingVisible &&
            !tabsOverlayController.isVisible() &&
            !fullscreenController.isVideoFullscreen() &&
            !promotedMediaController.isPromotedActive() &&
            !imeHandoffController.isImeVisible() &&
            !imeHandoffController.isAwaitingFocusRestore() &&
            !imeHandoffController.isEditableFocusLikelyPending() &&
            tabController.getActiveTab()?.webView != null
        try {
            pointerNavigationController.setActiveWebView(tabController.getActiveTab()?.webView)
            Logger.d(
                "KfPointerDebug",
                "pointer availability reason=$reason enable=$shouldEnable fullscreenMode=${fullscreenController.currentMode()?.name ?: "NONE"}"
            )
            pointerNavigationController.updatePointerAvailability(shouldEnable, reason)
        } catch (throwable: Throwable) {
            Logger.w("KfPointerDebug", "pointer mode fallback reason=refresh-failed", throwable)
        }
    }

    private fun selectUserAgentMode(platformCapabilities: com.kulchaflo.tv.mk2.platform.PlatformCapabilities): UserAgentMode {
        val sonyLike = platformCapabilities.manufacturer.contains("sony", ignoreCase = true) ||
            platformCapabilities.brand.contains("sony", ignoreCase = true) ||
            platformCapabilities.model.contains("bravia", ignoreCase = true)
        return if (sonyLike) UserAgentMode.DESKTOP_SONY else UserAgentMode.DESKTOP
    }

    private fun applyBrowserPresentation(url: String?) {
        val webView = tabController.getActiveTab()?.webView
        val finalizeWithCapture = {
            if (!url.isNullOrBlank()) {
                captureBrowserEnvironment(url, phase = "page-finished")
            }
            finalizePageFinishedPresentation()
        }

        if (webView == null || url.isNullOrBlank()) {
            finalizeWithCapture()
            return
        }

        val zoomDecision = compatRegistry.resolveZoomDecision(
            url = url,
            defaultScale = FINAL_ZOOM_SCALE,
        )
        Logger.i(
            "KfBrowserPresentation",
            "url=$url zoomApply=${zoomDecision.applyZoom} scale=${zoomDecision.scale} reason=${zoomDecision.reason}"
        )
        val script = compatRegistry.buildPageFinishedScript(
            url = url,
            zoomDecision = zoomDecision,
        )
        webView.evaluateJavascript(script) {
            finalizeWithCapture()
        }
    }

    private fun captureBrowserEnvironment(url: String?, phase: String) {
        val webView = tabController.getActiveTab()?.webView ?: return
        if (url.isNullOrBlank()) return
        Logger.i(
            "KfWebSettings",
            "phase=$phase url=$url ${webView.describeSettingsSnapshot()} width=${webView.width} height=${webView.height}"
        )
        val script =
            """
            (() => {
              const vv = window.visualViewport;
              const viewport = document.querySelector('meta[name="viewport"]');
              const fullscreenNode = document.fullscreenElement || document.webkitFullscreenElement;
              return JSON.stringify({
                phase: "$phase",
                href: location.href,
                ua: navigator.userAgent,
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                outerWidth: window.outerWidth || null,
                outerHeight: window.outerHeight || null,
                dpr: window.devicePixelRatio,
                screenWidth: screen.width,
                screenHeight: screen.height,
                availWidth: screen.availWidth,
                availHeight: screen.availHeight,
                clientWidth: document.documentElement ? document.documentElement.clientWidth : null,
                clientHeight: document.documentElement ? document.documentElement.clientHeight : null,
                scrollWidth: document.documentElement ? document.documentElement.scrollWidth : null,
                scrollHeight: document.documentElement ? document.documentElement.scrollHeight : null,
                viewport: viewport ? viewport.getAttribute('content') : null,
                visualViewportWidth: vv ? vv.width : null,
                visualViewportHeight: vv ? vv.height : null,
                visualViewportScale: vv ? vv.scale : null,
                fullscreenEnabled: document.fullscreenEnabled ?? null,
                webkitFullscreenEnabled: document.webkitFullscreenEnabled ?? null,
                fullscreenElementTag: fullscreenNode ? fullscreenNode.tagName : null
              });
            })();
            """.trimIndent()
        webView.postDelayed({
            webView.evaluateJavascript(script) { result ->
                Logger.i("KfBrowserEnv", "url=$url result=$result")
            }
        }, BROWSER_ENV_CAPTURE_DELAY_MS)
    }

    private fun finalizePageFinishedPresentation() {
        startupPageLoaded = true
        if (initialLoadBrandingVisible) {
            startupLoadingOverlay.visibility = View.GONE
            initialLoadBrandingVisible = false
            refreshPointerMode("startup-branding-hidden")
            if (promotedMediaController.maybeAutoEnterEligibleMedia("page-finished")) {
                refreshPointerMode("promoted-media-auto-enter")
                return
            }
            if (maybeRequestYouTubePlaybackResolution(expectedUrl = tabController.getActiveTab()?.webView?.url, reason = "page-finished")) {
                refreshPointerMode("youtube-playback-resolution")
            }
            return
        }
        pointerNavigationController.onPageFinished()
        refreshPointerMode("page-finished")
        if (promotedMediaController.maybeAutoEnterEligibleMedia("page-finished")) {
            refreshPointerMode("promoted-media-auto-enter")
            return
        }
        if (maybeRequestYouTubePlaybackResolution(expectedUrl = tabController.getActiveTab()?.webView?.url, reason = "page-finished")) {
            refreshPointerMode("youtube-playback-resolution")
        }
    }

    private companion object {
        private const val BUILD_MARKER_TAG = "KfBuildMarker"
        private const val ENABLE_POINTER_MODE = true
        private const val BROWSER_ENV_CAPTURE_DELAY_MS = 120L
        private const val FINAL_ZOOM_SCALE = 0.68
        private const val YOUTUBE_PLAYBACK_RESOLUTION_DELAY_MS = 450L
        private const val YOUTUBE_PLAYBACK_RESOLUTION_MAX_ATTEMPTS = 4
        private const val YOUTUBE_NAVIGATION_ESCALATION_MAX_ATTEMPTS = 5
        private const val YOUTUBE_NAVIGATION_ESCALATION_RETRY_MS = 350L
        private val YOUTUBE_NAVIGATION_ESCALATION_SCRIPT =
            """
            (() => {
              const normalize = (href) => {
                try {
                  return new URL(href, location.href).toString();
                } catch (_error) {
                  return "";
                }
              };
              const anchors = Array.from(document.querySelectorAll("a[href]"));
              const visible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 &&
                  rect.top < window.innerHeight && rect.left < window.innerWidth;
              };
              const collectText = (el) => {
                return (
                  el.getAttribute("aria-label") ||
                  el.textContent ||
                  ""
                ).trim().replace(/\s+/g, " ").slice(0, 240);
              };
              const rendererSelectors = [
                "ytd-rich-item-renderer",
                "ytd-grid-video-renderer",
                "ytd-video-renderer",
                "ytd-rich-grid-media",
                "ytd-item-section-renderer"
              ];
              const rendererLinkSelectors = [
                "a#thumbnail[href*='/watch?v=']",
                "a#video-title-link[href*='/watch?v=']",
                "a#video-title[href*='/watch?v=']",
                "a[href*='/watch?v=']"
              ];
              const candidates = [];
              const addCandidate = (href, text, scoreBase) => {
                if (!href || href.indexOf("/watch?v=") < 0) return;
                const liveScore = /(^|\s)LIVE(\s|$)|watch live|live now/i.test(text) ? 100 : 0;
                const streamScore = /stream|upcoming|watch/i.test(text) ? 20 : 0;
                candidates.push({
                  href,
                  score: scoreBase + liveScore + streamScore
                });
              };
              const renderers = Array.from(new Set(
                rendererSelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)))
              ));
              renderers.forEach((renderer) => {
                const visibleRenderer = visible(renderer);
                rendererLinkSelectors.some((selector) => {
                  const anchor = renderer.querySelector(selector);
                  if (!anchor) return false;
                  const href = normalize(anchor.getAttribute("href") || "");
                  const text = collectText(anchor) + " " + collectText(renderer);
                  addCandidate(href, text, visibleRenderer ? 30 : 5);
                  return href.indexOf("/watch?v=") >= 0;
                });
              });
              anchors.forEach((anchor) => {
                const href = normalize(anchor.getAttribute("href") || "");
                if (!href || href.indexOf("/watch?v=") < 0) return;
                const text = collectText(anchor) + " " + collectText(anchor.closest("ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer, ytd-item-section-renderer, ytd-rich-grid-media"));
                const visibleScore = visible(anchor) ? 10 : 0;
                addCandidate(href, text, visibleScore);
              });
              const uniqueCandidates = Array.from(new Map(candidates.map((candidate) => [candidate.href, candidate])).values())
                .sort((a, b) => b.score - a.score);
              const firstWatch = uniqueCandidates.length > 0 ? uniqueCandidates[0].href : "";
              const topCandidate = uniqueCandidates.length > 0 ? uniqueCandidates[0] : null;
              if (firstWatch) {
                return JSON.stringify({
                  status: "found",
                  watchUrl: firstWatch,
                  candidateCount: uniqueCandidates.length,
                  topCandidateHref: topCandidate ? topCandidate.href : "",
                  topCandidateScore: topCandidate ? topCandidate.score : 0
                });
              }
              return JSON.stringify({
                status: "no-watch-target-found",
                candidateCount: uniqueCandidates.length,
                topCandidateHref: topCandidate ? topCandidate.href : "",
                topCandidateScore: topCandidate ? topCandidate.score : 0,
                reason: anchors.length === 0 ? "no-anchors" : "no-qualified-watch-url"
              });
            })();
            """.trimIndent()
    }

    private data class TrustedOutboundPopupProxy(
        val popupTabId: String,
        val targetUrl: String,
    )

    private data class YouTubePlaybackResolutionSession(
        val token: Long,
        val webView: WebView,
        val pageUrl: String,
        var attempts: Int = 0,
        var retryRunnable: Runnable? = null,
        var lastAttemptedUrl: String? = null,
        var lastAttemptedReason: String? = null,
    )

    private data class YouTubeNavigationEscalationSession(
        val token: Long,
        val webView: WebView,
        val pageUrl: String,
        val pageKind: String,
        val pageIdentity: String,
        var attempt: Int = 0,
        var retryRunnable: Runnable? = null,
    )
}
