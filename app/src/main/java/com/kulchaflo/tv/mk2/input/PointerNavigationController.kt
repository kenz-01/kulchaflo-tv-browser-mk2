package com.kulchaflo.tv.mk2.input

import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import com.kulchaflo.tv.mk2.util.HostPolicyRegistry
import com.kulchaflo.tv.mk2.util.Logger
import com.kulchaflo.tv.mk2.web.KfWebView
import com.kulchaflo.tv.mk2.ui.pointer.PointerOverlayView
import kotlin.math.max
import kotlin.math.min

class PointerNavigationController(
    private val rootView: View,
    private val overlayView: PointerOverlayView,
    private val onPointerClickDispatched: ((KfWebView) -> Unit)? = null,
    private val handler: Handler = Handler(Looper.getMainLooper()),
) {
    private val rootLocation = IntArray(2)
    private val targetLocation = IntArray(2)
    private val pressedDirections = linkedSetOf<Int>()

    private var activeWebView: KfWebView? = null
    private var pointerEnabled = false
    private var pointerX = 0f
    private var pointerY = 0f
    private var hoverActive = false
    private var lastDownTime = 0L
    private var repeatTicks = 0
    private var normalizedX = 0.5f
    private var normalizedY = 0.5f
    private var activeScrollListener: View.OnScrollChangeListener? = null
    private var activeLayoutListener: View.OnLayoutChangeListener? = null
    private var pageFullscreenPointerMode = false
    private var fullscreenInputTarget: View? = null
    private var fullscreenFallbackTarget: View? = null
    private var fullscreenOverlayOrderingConfirmed = false
    private var fullscreenHoverFailureCount = 0
    private var fullscreenHoverSuppressed = false
    private var fullscreenCenterPressed = false
    private var youtubeBrowserControlAssistArmed = false
    private var lastYouTubeChromeCueAtMs = 0L

    private val normalPointerHideRunnable = Runnable {
        if (!pointerEnabled || pageFullscreenPointerMode) {
            return@Runnable
        }
        overlayView.hidePointer()
        Logger.d(DEBUG_TAG, "cursor visible=false reason=normal-inactivity-timeout")
    }

    private val pageFullscreenHideRunnable = Runnable {
        if (!pageFullscreenPointerMode || !pointerEnabled) {
            return@Runnable
        }
        overlayView.hidePointer()
        fullscreenCenterPressed = false
        dispatchHoverExit("page-fullscreen-timeout")
        Logger.d(DEBUG_TAG, "fullscreen cursor visible=false reason=page-fullscreen-timeout")
    }

    private val repeatRunnable = object : Runnable {
        override fun run() {
            val webView = activeWebView ?: return
            if (!pointerEnabled || pressedDirections.isEmpty() || !webView.isAttachedToWindow || webView.visibility != View.VISIBLE) {
                return
            }
            val delta = currentDirectionalDelta()
            if (delta.first != 0f || delta.second != 0f) {
                repeatTicks += 1
                val multiplier = holdSpeedMultiplier()
                movePointerBy(delta.first * multiplier, delta.second * multiplier, "hold")
                if (pageFullscreenPointerMode) {
                    keepPageFullscreenPointerResponsive("hold-repeat")
                } else {
                    dispatchHover("hold")
                    maybeCueYouTubeBrowserChrome("hold")
                }
            }
            handler.postDelayed(this, FRAME_DELAY_MS)
        }
    }

    fun setActiveWebView(webView: KfWebView?) {
        if (activeWebView === webView) {
            return
        }
        detachActiveWebViewObservers()
        activeWebView = webView
        hoverActive = false
        if (pointerEnabled && webView != null) {
            attachActiveWebViewObservers(webView)
            restorePointerPosition()
            dispatchHover("active-tab")
            Logger.d(DEBUG_TAG, "pointer shown reason=active-tab")
        } else {
            dispatchHoverExit("active-tab-lost")
            overlayView.hidePointer()
            Logger.d(DEBUG_TAG, "pointer hidden reason=no-active-webview")
        }
    }

    fun updatePointerAvailability(enabled: Boolean, reason: String) {
        if (pointerEnabled == enabled) {
            return
        }
        pointerEnabled = enabled
        pressedDirections.clear()
        repeatTicks = 0
        handler.removeCallbacks(repeatRunnable)
        cancelNormalPointerHideTimer()
        cancelPageFullscreenHideTimer()
        overlayView.setPointerPressed(false)
        hoverActive = false
        if (enabled && activeWebView != null) {
            ensurePointerVisible(reason)
            dispatchHover(reason)
            scheduleNormalPointerHideTimer(reason)
        } else {
            dispatchHoverExit(reason)
            overlayView.hidePointer()
            Logger.d(DEBUG_TAG, "cursor visible=false reason=$reason")
        }
    }

    fun enterPageFullscreenPointerMode(reason: String) {
        pageFullscreenPointerMode = true
        fullscreenOverlayOrderingConfirmed = false
        resetFullscreenFallbackSession(reason)
        if (!pointerEnabled || resolvePrimaryInputTarget() == null) {
            Logger.d(DEBUG_TAG, "page-fullscreen pointer pending reason=$reason pointerEnabled=$pointerEnabled hasTarget=${resolvePrimaryInputTarget() != null}")
            return
        }
        showFullscreenCursor(reason, assistMode = "entry", forceOrdering = true)
        dispatchHover("page-fullscreen-enter")
        schedulePageFullscreenHideTimer("enter")
    }

    fun exitPageFullscreenPointerMode(reason: String) {
        if (!pageFullscreenPointerMode) {
            return
        }
        pageFullscreenPointerMode = false
        fullscreenOverlayOrderingConfirmed = false
        resetFullscreenFallbackSession(reason)
        cancelPageFullscreenHideTimer()
        Logger.d(DEBUG_TAG, "page-fullscreen pointer mode exited reason=$reason")
    }

    fun setFullscreenInputTarget(target: View?, fallbackTarget: View?, reason: String) {
        fullscreenInputTarget = target
        fullscreenFallbackTarget = fallbackTarget
        fullscreenOverlayOrderingConfirmed = false
        resetFullscreenFallbackSession(reason)
        ensureFullscreenOverlayOrdering(reason, assistMode = "target-register", force = true)
        logFullscreenOverlayDiagnostics(reason)
        Logger.d(
            DEBUG_TAG,
            "fullscreen input target registered reason=$reason target=${target?.javaClass?.simpleName ?: "none"} fallback=${fallbackTarget?.javaClass?.simpleName ?: "none"}"
        )
    }

    fun clearFullscreenInputTarget(reason: String) {
        fullscreenInputTarget = null
        fullscreenFallbackTarget = null
        fullscreenOverlayOrderingConfirmed = false
        resetFullscreenFallbackSession(reason)
        Logger.d(DEBUG_TAG, "fullscreen input target cleared reason=$reason")
    }

    fun handleKeyEvent(event: KeyEvent): Boolean {
        if (!pointerEnabled) {
            return false
        }
        if (event.keyCode == KeyEvent.KEYCODE_DPAD_CENTER || event.keyCode == KeyEvent.KEYCODE_ENTER) {
            return handleClickKey(event)
        }
        if (!isDirectional(event.keyCode)) {
            return false
        }
        return handleDirectionalKey(event)
    }

    private fun handleDirectionalKey(event: KeyEvent): Boolean {
        when (event.action) {
            KeyEvent.ACTION_DOWN -> {
                val firstPress = pressedDirections.add(event.keyCode)
                if (pageFullscreenPointerMode) {
                    wakePointerForPageFullscreen(
                        reason = "directional-${KeyEvent.keyCodeToString(event.keyCode)}",
                        assistMode = if (!overlayView.isPointerVisible()) "wake" else if (firstPress) "initial" else "repeat",
                        isPassive = true
                    )
                } else {
                    wakePointerForNormalBrowsing("directional-${KeyEvent.keyCodeToString(event.keyCode)}")
                }
                if (firstPress) {
                    val delta = directionalDelta(event.keyCode)
                    movePointerBy(delta.first, delta.second, "initial")
                    if (!pageFullscreenPointerMode) {
                        dispatchHover("initial")
                        maybeCueYouTubeBrowserChrome("initial")
                    }
                    startRepeater()
                }
                return true
            }

            KeyEvent.ACTION_UP -> {
                pressedDirections.remove(event.keyCode)
                repeatTicks = 0
                if (pressedDirections.isEmpty()) {
                    handler.removeCallbacks(repeatRunnable)
                }
                return true
            }
        }
        return false
    }

    private fun handleClickKey(event: KeyEvent): Boolean {
        val target = resolvePrimaryInputTarget() ?: return false
        if (!isUsableTarget(target)) {
            Logger.d(DEBUG_TAG, "fallback reason=click-target-unavailable")
            return false
        }
        if (!pageFullscreenPointerMode && shouldUseYouTubeBrowserControlAssist(target)) {
            return handleYouTubeBrowserControlAssist(event)
        }
        return when (event.action) {
            KeyEvent.ACTION_DOWN -> {
                if (pageFullscreenPointerMode && fullscreenCenterPressed) {
                    Logger.d(
                        DEBUG_TAG,
                        "fullscreen center debounce active=true reason=repeat-down"
                    )
                    Logger.d(
                        DEBUG_TAG,
                        "fullscreen click allowed firstPress=false suppressed repeat=true phase=down"
                    )
                    return true
                }
                if (pageFullscreenPointerMode) {
                    fullscreenCenterPressed = true
                    Logger.d(DEBUG_TAG, "fullscreen center allowed deliberate=true")
                    Logger.d(
                        DEBUG_TAG,
                        "fullscreen click allowed firstPress=true suppressed repeat=false phase=down"
                    )
                }
                if (pageFullscreenPointerMode) {
                    wakePointerForPageFullscreen("click-down", assistMode = if (!overlayView.isPointerVisible()) "wake" else "click", isPassive = false)
                } else {
                    wakePointerForNormalBrowsing("click-down")
                }
                overlayView.setPointerPressed(true)
                lastDownTime = SystemClock.uptimeMillis()
                if (!pageFullscreenPointerMode || !fullscreenHoverSuppressed) {
                    dispatchHover("pre-click")
                } else {
                    Logger.d(DEBUG_TAG, "fullscreen hover suppressed=true reason=consecutive-failures count=$fullscreenHoverFailureCount")
                }
                dispatchTouch(MotionEvent.ACTION_DOWN, lastDownTime, "down")
            }

            KeyEvent.ACTION_UP -> {
                if (pageFullscreenPointerMode && !fullscreenCenterPressed) {
                    Logger.d(
                        DEBUG_TAG,
                        "fullscreen click allowed firstPress=false suppressed repeat=true phase=up"
                    )
                    return true
                }
                if (pageFullscreenPointerMode) {
                    fullscreenCenterPressed = false
                }
                overlayView.setPointerPressed(false)
                val downTime = if (lastDownTime == 0L) SystemClock.uptimeMillis() else lastDownTime
                val touchResult = dispatchTouch(MotionEvent.ACTION_UP, downTime, "up")
                if (fullscreenInputTarget == null) {
                    activeWebView?.let { onPointerClickDispatched?.invoke(it) }
                }
                if (pageFullscreenPointerMode) {
                    schedulePageFullscreenHideTimer("click-up")
                } else {
                    scheduleNormalPointerHideTimer("click-up")
                }
                touchResult
            }

            else -> false
        }
    }

    private fun handleYouTubeBrowserControlAssist(event: KeyEvent): Boolean {
        val webView = activeWebView ?: return false
        return when (event.action) {
            KeyEvent.ACTION_DOWN -> {
                if (youtubeBrowserControlAssistArmed) {
                    Logger.d(DEBUG_TAG, "youtube browser-control assist repeat ignored=true")
                    return true
                }
                youtubeBrowserControlAssistArmed = true
                wakePointerForNormalBrowsing("click-down")
                overlayView.setPointerPressed(true)
                lastDownTime = SystemClock.uptimeMillis()
                Logger.d(DEBUG_TAG, "youtube browser-control assist armed=true")
                true
            }

            KeyEvent.ACTION_UP -> {
                if (!youtubeBrowserControlAssistArmed) {
                    return true
                }
                youtubeBrowserControlAssistArmed = false
                overlayView.setPointerPressed(false)
                attemptYouTubeBrowserControlAssist(webView)
                true
            }

            else -> false
        }
    }

    private fun startRepeater() {
        handler.removeCallbacks(repeatRunnable)
        repeatTicks = 0
        handler.postDelayed(repeatRunnable, INITIAL_REPEAT_DELAY_MS)
    }

    fun onPageStarted() {
        hoverActive = false
    }

    fun onPageFinished() {
        if (!pointerEnabled || resolvePrimaryInputTarget() == null) {
            return
        }
        ensurePointerVisible("page-finished")
        dispatchHover("page-finished")
        if (pageFullscreenPointerMode) {
            schedulePageFullscreenHideTimer("page-finished")
        } else {
            scheduleNormalPointerHideTimer("page-finished")
        }
    }

    private fun wakePointerForPageFullscreen(reason: String, assistMode: String, isPassive: Boolean = false) {
        val wasHidden = !overlayView.isPointerVisible()
        if (wasHidden) {
            fullscreenCenterPressed = false
        }
        showFullscreenCursor(
            reason = reason,
            assistMode = assistMode,
            forceOrdering = wasHidden || assistMode == "entry",
        )
        
        if (wasHidden || isPassive) {
            val modeLog = if (wasHidden) "cursor-only" else "passive-directional"
            val skipReason = if (wasHidden) "movement-wake" else "directional-passive"
            Logger.d(DEBUG_TAG, "fullscreen directional mode=$modeLog assist skipped=true reason=$reason")
            Logger.d(DEBUG_TAG, "fullscreen focus assist skipped reason=$skipReason")
            Logger.d(DEBUG_TAG, "fullscreen hover skipped reason=$skipReason")
            maybeCueYouTubeFullscreenChrome(reason)
            schedulePageFullscreenHideTimer(reason)
            return // Truly passive wake: restore cursor visual only, do not interact with page content.
        }

        if (assistMode != "initial" && assistMode != "click") {
            Logger.d(DEBUG_TAG, "fullscreen assist mode=$assistMode repeat path lightweight=true reason=$reason")
        }

        if (assistMode == "repeat") {
            Logger.d(DEBUG_TAG, "fullscreen hover skipped reason=$reason assistMode=$assistMode")
        } else if (fullscreenHoverSuppressed) {
            Logger.d(DEBUG_TAG, "fullscreen hover suppressed=true reason=consecutive-failures count=$fullscreenHoverFailureCount")
        } else {
            dispatchHover("page-fullscreen-wake")
        }
        schedulePageFullscreenHideTimer(reason)
    }

    private fun keepPageFullscreenPointerResponsive(reason: String) {
        restorePointerPosition()
        Logger.d(DEBUG_TAG, "fullscreen directional mode=passive-directional assist skipped=true reason=$reason")
        Logger.d(DEBUG_TAG, "fullscreen focus assist skipped reason=directional-passive")
        Logger.d(DEBUG_TAG, "fullscreen hover skipped reason=directional-passive")
        maybeCueYouTubeFullscreenChrome(reason)
        Logger.d(DEBUG_TAG, "fullscreen cursor visible=true reason=$reason")
        schedulePageFullscreenHideTimer(reason)
    }

    private fun attemptYouTubeBrowserControlAssist(webView: KfWebView) {
        val local = localForTarget(webView)
        if (local == null) {
            Logger.d(DEBUG_TAG, "youtube browser-control assist unavailable reason=no-target")
            dispatchRawBrowserClickFallback(webView)
            return
        }
        val clientXRatio = (local.first / max(1f, webView.width.toFloat())).coerceIn(0f, 1f)
        val clientYRatio = (local.second / max(1f, webView.height.toFloat())).coerceIn(0f, 1f)
        val script =
            """
            (() => {
              const selectorPriority = [
                ".ytp-ad-skip-button",
                ".ytp-ad-skip-button-modern",
                ".ytp-skip-ad-button",
                "button.ytp-ad-skip-button",
                "button.ytp-ad-skip-button-modern",
                ".ytp-play-button",
                ".ytp-mute-button",
                ".ytp-settings-button",
                ".ytp-subtitles-button"
              ];
              const controlContainers = [
                ".ytp-chrome-controls",
                ".ytp-right-controls",
                ".ytp-left-controls",
                ".ytp-ad-player-overlay",
                ".video-ads"
              ];
              const player = document.querySelector(".html5-video-player");
              if (!player) return JSON.stringify({ status: "no-player" });
              const viewportX = (${clientXRatio}) * window.innerWidth;
              const viewportY = (${clientYRatio}) * window.innerHeight;
              const visible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 &&
                  rect.top < window.innerHeight && rect.left < window.innerWidth;
              };
              const labelOf = (el) => {
                return (
                  el.getAttribute("aria-label") ||
                  el.getAttribute("title") ||
                  el.textContent ||
                  el.className ||
                  ""
                ).trim().replace(/\s+/g, " ").slice(0, 120);
              };
              const describe = (el) => {
                if (!el) return "none";
                const parts = [];
                parts.push(el.tagName || "unknown");
                if (el.id) parts.push("#" + el.id);
                const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 4).join(".") : "";
                if (cls) parts.push("." + cls);
                return parts.join("");
              };
              const adSkipSelectors = [
                ".ytp-ad-skip-button",
                ".ytp-ad-skip-button-modern",
                ".ytp-skip-ad-button",
                "button.ytp-ad-skip-button",
                "button.ytp-ad-skip-button-modern"
              ];
              const adSkipControl = () => {
                for (const selector of adSkipSelectors) {
                  const node = player.querySelector(selector);
                  if (!node || !visible(node)) continue;
                  const root = node.matches("button, [role='button']") ? node : node.closest("button, [role='button'], .ytp-button");
                  if (!root || !visible(root)) continue;
                  const container = root.closest(controlContainers.join(","));
                  if (!container || !player.contains(container)) continue;
                  return { selector, target: root };
                }
                return null;
              };
              const activeAdSkip = adSkipControl();
              const actionableControl = (node) => {
                if (!node) return null;
                const inChatFrame = !!node.closest("#chatframe, ytd-live-chat-frame, iframe[src*='live_chat']");
                if (activeAdSkip && inChatFrame) {
                  return {
                    accepted: false,
                    reason: "chatframe-suppressed-ad-active",
                    target: node
                  };
                }
                const fullscreen = node.closest(".ytp-fullscreen-button");
                if (fullscreen) {
                  return {
                    accepted: false,
                    reason: "fullscreen-raw-click-preferred",
                    target: fullscreen
                  };
                }
                const direct = node.closest(selectorPriority.join(","));
                if (!direct) {
                  return { accepted: false, reason: "non-actionable-tooltip", target: node };
                }
                const controlRoot = direct.matches("button, [role='button']") ? direct : direct.closest("button, [role='button'], .ytp-button");
                if (!controlRoot) {
                  return { accepted: false, reason: "non-actionable-tooltip", target: direct };
                }
                const container = controlRoot.closest(controlContainers.join(","));
                if (!container || !player.contains(container)) {
                  return { accepted: false, reason: "outside-player-controls", target: controlRoot };
                }
                return { accepted: true, target: controlRoot, selector: selectorPriority.find((selector) => direct.matches(selector) || controlRoot.matches(selector) || !!controlRoot.closest(selector)) || "unknown" };
              };
              const triggerClick = (target) => {
                if (!target) return false;
                if (typeof target.focus === "function") target.focus();
                ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
                  target.dispatchEvent(new MouseEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    view: window
                  }));
                });
                return true;
              };
              const direct = document.elementFromPoint(viewportX, viewportY);
              if (activeAdSkip) {
                return JSON.stringify({
                  status: "matched",
                  selector: activeAdSkip.selector,
                  target: labelOf(activeAdSkip.target),
                  adSkip: true,
                  clicked: triggerClick(activeAdSkip.target),
                  priority: "global-ad-skip"
                });
              }
              const directMatch = direct ? actionableControl(direct) : null;
              if (directMatch && !directMatch.accepted) {
                return JSON.stringify({
                  status: "rejected",
                  reason: directMatch.reason,
                  target: describe(directMatch.target)
                });
              }
              if (directMatch && directMatch.accepted && visible(directMatch.target)) {
                return JSON.stringify({
                  status: "matched",
                  selector: directMatch.selector,
                  target: labelOf(directMatch.target),
                  adSkip: directMatch.selector.indexOf("ad-skip") >= 0 || directMatch.selector.indexOf("skip-ad") >= 0,
                  clicked: triggerClick(directMatch.target)
                });
              }
              const controls = selectorPriority.flatMap((selector) => {
                return Array.from(player.querySelectorAll(selector)).map((el) => ({ selector, el }));
              }).filter(({ el }) => visible(el));
              for (const entry of controls) {
                const match = actionableControl(entry.el);
                if (!match) continue;
                if (!match.accepted) {
                  continue;
                }
                const rect = match.target.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                const dx = cx - viewportX;
                const dy = cy - viewportY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= 120) {
                  return JSON.stringify({
                    status: "matched",
                    selector: match.selector,
                    target: labelOf(match.target),
                    adSkip: match.selector.indexOf("ad-skip") >= 0 || match.selector.indexOf("skip-ad") >= 0,
                    clicked: triggerClick(match.target),
                    distance: distance
                  });
                }
              }
              return JSON.stringify({ status: "no-target" });
            })();
            """.trimIndent()
        webView.evaluateJavascript(script) { result ->
            val normalized = decodeEvaluateJavascriptString(result)
            when {
                normalized.contains("\"status\":\"matched\"") -> {
                    val targetLabel = extractJsonField(normalized, "target")
                    val selector = extractJsonField(normalized, "selector")
                    val adSkip = normalized.contains("\"adSkip\":true")
                    Logger.d(DEBUG_TAG, "youtube browser-control assist matched selector=${selector ?: "unknown"} target=${targetLabel ?: "unknown"}")
                    Logger.d(DEBUG_TAG, "youtube browser-control assist matched adSkip=$adSkip")
                    Logger.d(DEBUG_TAG, "youtube browser-control assist click dispatched target=${targetLabel ?: "unknown"}")
                    scheduleNormalPointerHideTimer("youtube-browser-control-assist")
                }

                normalized.contains("\"status\":\"rejected\"") -> {
                    val reason = extractJsonField(normalized, "reason") ?: "unknown"
                    val target = extractJsonField(normalized, "target") ?: "unknown"
                    Logger.d(DEBUG_TAG, "youtube browser-control assist rejected reason=$reason target=$target")
                    Logger.d(DEBUG_TAG, "youtube browser-control assist fallback=raw-click")
                    dispatchRawBrowserClickFallback(webView)
                }

                normalized.contains("\"status\":\"no-target\"") || normalized.contains("\"status\":\"no-player\"") -> {
                    val reason = if (normalized.contains("\"status\":\"no-player\"")) "no-player" else "no-target"
                    Logger.d(DEBUG_TAG, "youtube browser-control assist unavailable reason=$reason")
                    Logger.d(DEBUG_TAG, "youtube browser-control assist fallback=raw-click")
                    dispatchRawBrowserClickFallback(webView)
                }

                else -> {
                    Logger.d(DEBUG_TAG, "youtube browser-control assist unavailable reason=script-invalid")
                    Logger.d(DEBUG_TAG, "youtube browser-control assist rawResult=${result?.trim().orEmpty()}")
                    Logger.d(DEBUG_TAG, "youtube browser-control assist fallback=raw-click")
                    dispatchRawBrowserClickFallback(webView)
                }
            }
        }
    }

    private fun maybeCueYouTubeBrowserChrome(reason: String) {
        val webView = activeWebView ?: return
        if (!shouldUseYouTubeBrowserControlAssist(webView)) {
            return
        }
        val now = SystemClock.uptimeMillis()
        if (now - lastYouTubeChromeCueAtMs < YOUTUBE_BROWSER_CHROME_CUE_THROTTLE_MS) {
            return
        }
        val local = localForTarget(webView) ?: return
        lastYouTubeChromeCueAtMs = now
        val clientXRatio = (local.first / max(1f, webView.width.toFloat())).coerceIn(0f, 1f)
        val clientYRatio = (local.second / max(1f, webView.height.toFloat())).coerceIn(0f, 1f)
        val script =
            """
            (() => {
              const player = document.querySelector(".html5-video-player");
              if (!player) return JSON.stringify({ status: "no-player" });
              const x = (${clientXRatio}) * window.innerWidth;
              const y = (${clientYRatio}) * window.innerHeight;
              const target = document.querySelector(".ytp-chrome-bottom, .ytp-chrome-controls") || player;
              ["mousemove", "mouseover", "mouseenter"].forEach((type) => {
                target.dispatchEvent(new MouseEvent(type, {
                  bubbles: true,
                  cancelable: true,
                  composed: true,
                  clientX: x,
                  clientY: y,
                  view: window
                }));
              });
              return JSON.stringify({
                status: "cued",
                target: typeof target.className === "string" && target.className.length > 0 ? target.className : (target.tagName || "player")
              });
            })();
            """.trimIndent()
        webView.evaluateJavascript(script) { result ->
            val normalized = decodeEvaluateJavascriptString(result)
            when {
                normalized.contains("\"status\":\"cued\"") -> {
                    val target = extractJsonField(normalized, "target") ?: "player"
                    Logger.d(DEBUG_TAG, "youtube browser-control cue dispatched target=$target reason=$reason")
                }
                normalized.contains("\"status\":\"no-player\"") -> {
                    Logger.d(DEBUG_TAG, "youtube browser-control cue skipped reason=no-player")
                }
                else -> {
                    Logger.d(DEBUG_TAG, "youtube browser-control cue skipped reason=no-target")
                }
            }
        }
    }

    private fun maybeCueYouTubeFullscreenChrome(reason: String) {
        if (!pageFullscreenPointerMode) {
            return
        }
        val webView = activeWebView ?: return
        if (!shouldUseYouTubeBrowserControlAssist(webView)) {
            return
        }
        val now = SystemClock.uptimeMillis()
        if (now - lastYouTubeChromeCueAtMs < YOUTUBE_BROWSER_CHROME_CUE_THROTTLE_MS) {
            return
        }
        lastYouTubeChromeCueAtMs = now
        val script =
            """
            (() => {
              const player = document.querySelector(".html5-video-player");
              if (!player) return JSON.stringify({ status: "no-player" });
              const rect = player.getBoundingClientRect();
              const x = Math.max(1, Math.min(window.innerWidth - 1, rect.left + rect.width * 0.5));
              const y = Math.max(1, Math.min(window.innerHeight - 1, rect.top + rect.height - 24));
              const target = document.querySelector(".ytp-chrome-bottom, .ytp-chrome-controls") || player;
              ["mousemove", "mouseover", "mouseenter"].forEach((type) => {
                target.dispatchEvent(new MouseEvent(type, {
                  bubbles: true,
                  cancelable: true,
                  composed: true,
                  clientX: x,
                  clientY: y,
                  view: window
                }));
              });
              return JSON.stringify({
                status: "cued",
                target: typeof target.className === "string" && target.className.length > 0 ? target.className : (target.tagName || "player")
              });
            })();
            """.trimIndent()
        webView.evaluateJavascript(script) { result ->
            val normalized = decodeEvaluateJavascriptString(result)
            when {
                normalized.contains("\"status\":\"cued\"") -> {
                    val target = extractJsonField(normalized, "target") ?: "player"
                    Logger.d(DEBUG_TAG, "youtube fullscreen transport cue dispatched target=$target reason=$reason")
                }
                normalized.contains("\"status\":\"no-player\"") -> {
                    Logger.d(DEBUG_TAG, "youtube fullscreen transport cue skipped reason=no-player")
                }
                else -> {
                    Logger.d(DEBUG_TAG, "youtube fullscreen transport cue skipped reason=no-target")
                }
            }
        }
    }

    private fun dispatchRawBrowserClickFallback(webView: KfWebView) {
        val downTime = SystemClock.uptimeMillis()
        dispatchTouchToTarget(
            target = webView,
            fallback = null,
            action = MotionEvent.ACTION_DOWN,
            downTime = downTime,
            phase = "youtube-assist-fallback-down",
        )
        dispatchTouchToTarget(
            target = webView,
            fallback = null,
            action = MotionEvent.ACTION_UP,
            downTime = downTime,
            phase = "youtube-assist-fallback-up",
        )
        onPointerClickDispatched?.invoke(webView)
        scheduleNormalPointerHideTimer("youtube-browser-control-fallback")
    }

    private fun showFullscreenCursor(reason: String, assistMode: String, forceOrdering: Boolean) {
        restorePointerPosition()
        ensureFullscreenOverlayOrdering(reason, assistMode, forceOrdering)
        Logger.d(DEBUG_TAG, "fullscreen cursor visible=true reason=$reason")
    }

    private fun ensureFullscreenOverlayOrdering(reason: String, assistMode: String, force: Boolean) {
        if (!force && fullscreenOverlayOrderingConfirmed) {
            Logger.d(DEBUG_TAG, "fullscreen assist mode=$assistMode reorder skipped=already-ordered reason=$reason")
            return
        }
        overlayView.bringToFront()
        val sharedParent = sharedOverlayParent()
        val overlayParent = overlayView.parent as? ViewGroup
        if (sharedParent != null && overlayParent === sharedParent) {
            sharedParent.bringChildToFront(overlayView)
            sharedParent.requestLayout()
            sharedParent.invalidate()
        } else {
            overlayParent?.requestLayout()
            overlayParent?.invalidate()
        }
        overlayView.invalidate()
        rootView.invalidate()
        fullscreenOverlayOrderingConfirmed = true
        logFullscreenOverlayDiagnostics("$reason-ordering")
    }

    private fun logFullscreenOverlayDiagnostics(reason: String) {
        val overlayParent = overlayView.parent as? ViewGroup
        val host = fullscreenFallbackTarget
        val hostParent = host?.parent as? ViewGroup
        val target = fullscreenInputTarget
        val targetParent = target?.parent as? ViewGroup
        val overlayIndex = overlayParent?.indexOfChild(overlayView) ?: -1
        val hostIndex = if (overlayParent != null && host != null && host.parent === overlayParent) {
            overlayParent.indexOfChild(host)
        } else {
            -1
        }
        Logger.d(
            DEBUG_TAG,
            "fullscreen overlay parent=${overlayParent?.javaClass?.simpleName ?: "none"} index=$overlayIndex visibility=${overlayView.visibility} alpha=${overlayView.alpha} width=${overlayView.width} height=${overlayView.height} reason=$reason"
        )
        Logger.d(
            DEBUG_TAG,
            "fullscreen host parent=${hostParent?.javaClass?.simpleName ?: "none"} index=$hostIndex targetParent=${targetParent?.javaClass?.simpleName ?: "none"} target=${target?.javaClass?.simpleName ?: "none"} fallback=${host?.javaClass?.simpleName ?: "none"} reason=$reason"
        )
        Logger.d(
            DEBUG_TAG,
            "fullscreen overlay reordered success=${sharedOverlayParent() != null} reason=$reason"
        )
    }

    private fun sharedOverlayParent(): ViewGroup? {
        val overlayParent = overlayView.parent as? ViewGroup ?: return null
        val fallback = fullscreenFallbackTarget ?: return null
        return if (fallback.parent === overlayParent) overlayParent else null
    }

    private fun wakePointerForNormalBrowsing(reason: String) {
        ensurePointerVisible(reason)
        scheduleNormalPointerHideTimer(reason)
    }

    private fun ensurePointerVisible(reason: String) {
        restorePointerPosition()
        Logger.d(DEBUG_TAG, "cursor visible=true reason=$reason")
    }

    private fun schedulePageFullscreenHideTimer(reason: String) {
        if (!pageFullscreenPointerMode) return
        handler.removeCallbacks(pageFullscreenHideRunnable)
        handler.postDelayed(pageFullscreenHideRunnable, PAGE_FULLSCREEN_POINTER_GRACE_MS)
        Logger.d(DEBUG_TAG, "fullscreen cursor hide scheduled reason=$reason timeoutMs=$PAGE_FULLSCREEN_POINTER_GRACE_MS")
    }

    private fun scheduleNormalPointerHideTimer(reason: String) {
        if (pageFullscreenPointerMode || !pointerEnabled) return
        handler.removeCallbacks(normalPointerHideRunnable)
        handler.postDelayed(normalPointerHideRunnable, NORMAL_POINTER_INACTIVITY_MS)
        Logger.d(DEBUG_TAG, "cursor inactivity timer scheduled reason=$reason timeoutMs=$NORMAL_POINTER_INACTIVITY_MS")
    }

    private fun cancelNormalPointerHideTimer() {
        handler.removeCallbacks(normalPointerHideRunnable)
    }

    private fun cancelPageFullscreenHideTimer() {
        handler.removeCallbacks(pageFullscreenHideRunnable)
    }

    private fun centerOnWebView() {
        val bounds = currentTargetBounds() ?: return
        pointerX = bounds.left + (bounds.width() / 2f)
        pointerY = bounds.top + (bounds.height() / 2f)
        updateNormalizedPosition(bounds)
        overlayView.showAt(pointerX, pointerY)
    }

    private fun restorePointerPosition() {
        val bounds = currentTargetBounds() ?: return centerOnWebView()
        pointerX = bounds.left + (bounds.width() * normalizedX)
        pointerY = bounds.top + (bounds.height() * normalizedY)
        overlayView.showAt(pointerX, pointerY)
    }

    private fun movePointerBy(dx: Float, dy: Float, reason: String) {
        val bounds = currentTargetBounds() ?: return
        val minX = bounds.left + EDGE_PADDING_PX
        val maxX = bounds.right - EDGE_PADDING_PX
        val minY = bounds.top + EDGE_PADDING_PX
        val maxY = bounds.bottom - EDGE_PADDING_PX
        val rawNextX = pointerX + dx
        val rawNextY = pointerY + dy
        val nextX = min(maxX, max(minX, rawNextX))
        val nextY = min(maxY, max(minY, rawNextY))

        // Only overshoot if we're actually pushing against the physical bounds of the WebView,
        // and even then, only if the WebView can actually scroll in that direction.
        val overshootX = when {
            rawNextX < minX && activeWebView?.canScrollHorizontally(-1) == true -> rawNextX - minX
            rawNextX > maxX && activeWebView?.canScrollHorizontally(1) == true -> rawNextX - maxX
            else -> 0f
        }
        val overshootY = when {
            rawNextY < minY && activeWebView?.canScrollVertically(-1) == true -> rawNextY - minY
            rawNextY > maxY && activeWebView?.canScrollVertically(1) == true -> rawNextY - maxY
            else -> 0f
        }

        pointerX = nextX
        pointerY = nextY
        updateNormalizedPosition(bounds)
        overlayView.showAt(pointerX, pointerY)

        if ((overshootX != 0f || overshootY != 0f) && fullscreenInputTarget == null) {
            maybeScrollContent(overshootX, overshootY)
        }
        Logger.d(DEBUG_TAG, "pointer moved x=${pointerX.toInt()} y=${pointerY.toInt()} reason=$reason")
    }

    private fun maybeScrollContent(overshootX: Float, overshootY: Float) {
        val webView = activeWebView ?: return
        val scrollX = (overshootX * EDGE_SCROLL_MULTIPLIER).toInt()
        val scrollY = (overshootY * EDGE_SCROLL_MULTIPLIER).toInt()

        if (scrollX == 0 && scrollY == 0) {
            return
        }

        webView.scrollBy(scrollX, scrollY)
        Logger.d(DEBUG_TAG, "content scroll x=$scrollX y=$scrollY")
    }

    private fun dispatchHover(reason: String): Boolean {
        if (pageFullscreenPointerMode && fullscreenHoverSuppressed) {
            Logger.d(DEBUG_TAG, "fullscreen hover suppressed=true reason=consecutive-failures count=$fullscreenHoverFailureCount")
            return false
        }
        val action = if (hoverActive) MotionEvent.ACTION_HOVER_MOVE else MotionEvent.ACTION_HOVER_ENTER
        val dispatched = dispatchGenericMotionToActiveTarget(action, reason)
        hoverActive = dispatched
        if (pageFullscreenPointerMode) {
            if (dispatched) {
                fullscreenHoverFailureCount = 0
                fullscreenHoverSuppressed = false
            } else {
                fullscreenHoverFailureCount += 1
                if (fullscreenHoverFailureCount >= FULLSCREEN_HOVER_FAILURE_THRESHOLD) {
                    fullscreenHoverSuppressed = true
                    Logger.d(
                        DEBUG_TAG,
                        "fullscreen hover suppressed=true reason=consecutive-failures count=$fullscreenHoverFailureCount"
                    )
                }
            }
        }
        return dispatched
    }

    private fun dispatchHoverExit(reason: String): Boolean {
        if (pageFullscreenPointerMode && fullscreenHoverSuppressed) {
            Logger.d(DEBUG_TAG, "fullscreen hover exit skipped reason=$reason suppressed=true")
            hoverActive = false
            return false
        }
        if (!hoverActive) {
            return false
        }
        val dispatched = dispatchGenericMotionToActiveTarget(MotionEvent.ACTION_HOVER_EXIT, reason)
        hoverActive = false
        return dispatched
    }

    private fun resetFullscreenFallbackSession(reason: String) {
        fullscreenHoverFailureCount = 0
        fullscreenHoverSuppressed = false
        fullscreenCenterPressed = false
        Logger.d(DEBUG_TAG, "fullscreen fallback session reset reason=$reason")
    }

    private fun dispatchTouch(action: Int, downTime: Long, phase: String): Boolean {
        return dispatchTouchToActiveTarget(action, downTime, phase)
    }

    private fun rootToLocal(): Pair<Float, Float>? {
        val bounds = currentTargetBounds() ?: return null
        val x = pointerX - bounds.left
        val y = pointerY - bounds.top
        return x to y
    }

    private fun currentDirectionalDelta(): Pair<Float, Float> {
        var dx = 0f
        var dy = 0f
        pressedDirections.forEach { keyCode ->
            val delta = directionalDelta(keyCode)
            dx += delta.first
            dy += delta.second
        }
        return dx to dy
    }

    private fun holdSpeedMultiplier(): Float {
        return when {
            repeatTicks >= 28 -> 2.4f
            repeatTicks >= 14 -> 1.8f
            repeatTicks >= 6 -> 1.35f
            else -> 1f
        }
    }

    private fun directionalDelta(keyCode: Int): Pair<Float, Float> {
        return when (keyCode) {
            KeyEvent.KEYCODE_DPAD_LEFT -> -MOVE_STEP_PX to 0f
            KeyEvent.KEYCODE_DPAD_RIGHT -> MOVE_STEP_PX to 0f
            KeyEvent.KEYCODE_DPAD_UP -> 0f to -MOVE_STEP_PX
            KeyEvent.KEYCODE_DPAD_DOWN -> 0f to MOVE_STEP_PX
            else -> 0f to 0f
        }
    }

    private fun currentTargetBounds(): android.graphics.RectF? {
        val target = resolvePrimaryInputTarget() ?: return null
        if (!isUsableTarget(target)) {
            return null
        }
        rootView.getLocationOnScreen(rootLocation)
        target.getLocationOnScreen(targetLocation)
        val left = (targetLocation[0] - rootLocation[0]).toFloat()
        val top = (targetLocation[1] - rootLocation[1]).toFloat()
        return android.graphics.RectF(left, top, left + target.width, top + target.height)
    }

    private fun resolvePrimaryInputTarget(): View? = fullscreenInputTarget ?: activeWebView

    private fun isUsableTarget(target: View): Boolean {
        return target.isAttachedToWindow && target.visibility == View.VISIBLE
    }

    private fun dispatchGenericMotionToActiveTarget(action: Int, reason: String): Boolean {
        val primary = resolvePrimaryInputTarget() ?: return false
        return dispatchGenericMotionToTarget(
            target = primary,
            fallback = if (primary === fullscreenInputTarget) fullscreenFallbackTarget else null,
            action = action,
            reason = reason,
        )
    }

    private fun dispatchGenericMotionToTarget(
        target: View,
        fallback: View?,
        action: Int,
        reason: String,
    ): Boolean {
        val local = localForTarget(target)
        val eventTime = SystemClock.uptimeMillis()
        if (local != null) {
            val event = MotionEvent.obtain(
                eventTime,
                eventTime,
                action,
                local.first,
                local.second,
                0,
            ).apply {
                source = InputDevice.SOURCE_MOUSE
            }
            val dispatched = target.dispatchGenericMotionEvent(event)
            event.recycle()
            Logger.d(
                DEBUG_TAG,
                "${if (target === fullscreenInputTarget) "fullscreen " else ""}hover dispatched action=$action reason=$reason target=${target.javaClass.simpleName} fullscreen-target=${target === fullscreenInputTarget} success=$dispatched cursorVisible=${overlayView.isPointerVisible()}"
            )
            if (dispatched) {
                return true
            }
        }
        if (fallback != null && fallback !== target && isUsableTarget(fallback)) {
            Logger.d(DEBUG_TAG, "hover fallback reason=$reason target=${fallback.javaClass.simpleName}")
            return dispatchGenericMotionToTarget(fallback, null, action, "$reason-fallback")
        }
        if (fullscreenInputTarget != null) {
            Logger.d(DEBUG_TAG, "hover fallback reason=$reason target=normal-webview-unavailable")
        }
        return false
    }

    private fun dispatchTouchToActiveTarget(action: Int, downTime: Long, phase: String): Boolean {
        val primary = resolvePrimaryInputTarget() ?: return false
        return dispatchTouchToTarget(
            target = primary,
            fallback = if (primary === fullscreenInputTarget) fullscreenFallbackTarget else null,
            action = action,
            downTime = downTime,
            phase = phase,
        )
    }

    private fun dispatchTouchToTarget(
        target: View,
        fallback: View?,
        action: Int,
        downTime: Long,
        phase: String,
    ): Boolean {
        val local = localForTarget(target)
        val eventTime = SystemClock.uptimeMillis()
        if (local != null) {
            val event = MotionEvent.obtain(
                downTime,
                eventTime,
                action,
                local.first,
                local.second,
                0,
            ).apply {
                source = InputDevice.SOURCE_TOUCHSCREEN
            }
            val dispatched = target.dispatchTouchEvent(event)
            event.recycle()
            Logger.d(
                DEBUG_TAG,
                "click dispatched phase=$phase x=${local.first.toInt()} y=${local.second.toInt()} target=${target.javaClass.simpleName} fullscreen-target=${target === fullscreenInputTarget} success=$dispatched cursorVisible=${overlayView.isPointerVisible()}"
            )
            if (dispatched) {
                return true
            }
        }
        if (fallback != null && fallback !== target && isUsableTarget(fallback)) {
            Logger.d(DEBUG_TAG, "click fallback phase=$phase target=${fallback.javaClass.simpleName}")
            return dispatchTouchToTarget(fallback, null, action, downTime, "$phase-fallback")
        }
        if (fullscreenInputTarget != null) {
            Logger.d(DEBUG_TAG, "click fallback phase=$phase target=normal-webview-unavailable")
        }
        return false
    }

    private fun shouldUseYouTubeBrowserControlAssist(target: View): Boolean {
        val webView = activeWebView ?: return false
        if (target !== webView) return false
        val parsed = runCatching { Uri.parse(webView.url.orEmpty()) }.getOrNull() ?: return false
        val host = HostPolicyRegistry.normalizedHostFromHost(parsed.host)
        val path = parsed.encodedPath.orEmpty()
        return HostPolicyRegistry.isYouTubeHost(host) && path.startsWith("/watch")
    }

    private fun extractJsonField(json: String, key: String): String? {
        val token = "\"$key\":\""
        val start = json.indexOf(token)
        if (start < 0) return null
        val valueStart = start + token.length
        val end = json.indexOf('"', valueStart)
        if (end <= valueStart) return null
        return json.substring(valueStart, end)
    }

    private fun decodeEvaluateJavascriptString(result: String?): String {
        val raw = result?.trim().orEmpty()
        if (raw.length >= 2 && raw.first() == '"' && raw.last() == '"') {
            return raw
                .substring(1, raw.length - 1)
                .replace("\\\\", "\\")
                .replace("\\\"", "\"")
                .replace("\\n", "")
                .replace("\\t", "")
        }
        return raw
    }

    private fun localForTarget(target: View): Pair<Float, Float>? {
        if (!isUsableTarget(target)) return null
        val bounds = boundsForTarget(target) ?: return null
        val x = pointerX - bounds.left
        val y = pointerY - bounds.top
        return x to y
    }

    private fun boundsForTarget(target: View): android.graphics.RectF? {
        if (!isUsableTarget(target)) return null
        rootView.getLocationOnScreen(rootLocation)
        target.getLocationOnScreen(targetLocation)
        val left = (targetLocation[0] - rootLocation[0]).toFloat()
        val top = (targetLocation[1] - rootLocation[1]).toFloat()
        return android.graphics.RectF(left, top, left + target.width, top + target.height)
    }

    private fun updateNormalizedPosition(bounds: android.graphics.RectF) {
        val width = bounds.width().takeIf { it > 0f } ?: return
        val height = bounds.height().takeIf { it > 0f } ?: return
        normalizedX = ((pointerX - bounds.left) / width).coerceIn(0f, 1f)
        normalizedY = ((pointerY - bounds.top) / height).coerceIn(0f, 1f)
    }

    private fun attachActiveWebViewObservers(webView: KfWebView) {
        val scrollListener = View.OnScrollChangeListener { _, _, _, _, _ ->
            if (!pointerEnabled) return@OnScrollChangeListener
            dispatchHover("scroll-sync")
        }
        val layoutListener = View.OnLayoutChangeListener { _, _, _, _, _, _, _, _, _ ->
            if (!pointerEnabled) return@OnLayoutChangeListener
            restorePointerPosition()
            dispatchHover("layout-sync")
        }
        webView.setOnScrollChangeListener(scrollListener)
        webView.addOnLayoutChangeListener(layoutListener)
        activeScrollListener = scrollListener
        activeLayoutListener = layoutListener
    }

    private fun detachActiveWebViewObservers() {
        val webView = activeWebView ?: return
        activeScrollListener?.let { webView.setOnScrollChangeListener(null) }
        activeLayoutListener?.let { webView.removeOnLayoutChangeListener(it) }
        activeScrollListener = null
        activeLayoutListener = null
    }

    private fun isDirectional(keyCode: Int): Boolean {
        return keyCode == KeyEvent.KEYCODE_DPAD_LEFT ||
            keyCode == KeyEvent.KEYCODE_DPAD_RIGHT ||
            keyCode == KeyEvent.KEYCODE_DPAD_UP ||
            keyCode == KeyEvent.KEYCODE_DPAD_DOWN
    }

    private companion object {
        private const val DEBUG_TAG = "KfPointerDebug"
        private const val INITIAL_REPEAT_DELAY_MS = 110L
        private const val FRAME_DELAY_MS = 16L
        private const val MOVE_STEP_PX = 18f
        private const val EDGE_PADDING_PX = 8f
        private const val EDGE_SCROLL_MULTIPLIER = 2.0f // Reduced from 3.5f for less eager scroll
        private const val NORMAL_POINTER_INACTIVITY_MS = 4800L
        private const val PAGE_FULLSCREEN_POINTER_GRACE_MS = 3200L
        private const val FULLSCREEN_HOVER_FAILURE_THRESHOLD = 3
        private const val YOUTUBE_BROWSER_CHROME_CUE_THROTTLE_MS = 220L
    }
}
