(function () {
  const PROMPT_PREFIX = "__GV_MEDIA__";
  const TEGO_TARGET_MAX_HEIGHT = 720;
  const ABS_TEGO_STARTUP_REPROBE_DELAYS_MS = [2000, 5000, 9000, 14000];
  const TTT_TEGO_STARTUP_EXTRA_REPROBE_DELAYS_MS = [18000, 23000, 30000];
  const TTT_TEGO_STARTUP_WAKE_MAX_DELAY_MS = 5000;
  const ABS_TEGO_FULLSCREEN_SEQUENCE_DELAYS_MS = [0, 700, 1600, 2600, 4200, 6500, 9000, 12500, 16000];
  const NOVUS_CHANNEL_SELECT_DELAYS_MS = [350, 1200, 2600, 4500];
  const NOVUS_PLAYABLE_CHECK_DELAYS_MS = [1200, 2600, 5000, 8000, 12000, 16000, 22000, 30000];
  const CGTV_PLAY_ASSIST_DELAYS_MS = [900, 2400, 5200];
  const CHTV_PLAY_ASSIST_DELAYS_MS = [700, 1800, 4000, 6500];
  const CHTV_FULLSCREEN_ASSIST_DELAYS_MS = [2200, 4200, 7000];
  const CARIBVISION_PLAY_ASSIST_DELAYS_MS = [900, 2400, 5200];
  const CARIBVISION_FULLSCREEN_ASSIST_DELAYS_MS = [2200, 4200, 7000];
  const CARIBVISION_OFFICIAL_HLS_HOST = "5dcabf026b188.streamlock.net";
  const CARIBVISION_OFFICIAL_HLS_PATH = "/CaribVision/livestream/playlist.m3u8";
  const CGTV_TOP_OFFSET_PX = 0;
  const NOVUS_AUTOPLAY_MAX_ATTEMPTS = 6;
  const ENABLE_ABS_TEGO_PAGE_FULLSCREEN_LIKE = true;
  const ENABLE_ABS_TEGO_PLAYER_FULLSCREEN_LIKE = true;
  const ENABLE_ABS_TEGO_F_KEY_AFTER_FULLSCREEN_LIKE = false;
  const ENABLE_TTT_TEGO_AUTOSTART_HACKS = false;
  const ENABLE_TTT_TEGO_READINESS_ASSIST = true;
  const TTT_TEGO_READINESS_ASSIST_DELAY_MS = 18000;
  let lastSignature = "";
  let lastTegoSignature = "";
  let absTegoStartupReprobeStarted = false;
  let absTegoStartupReprobeStopped = false;
  let absTegoFullscreenSequenceStarted = false;
  let absTegoFullscreenSequenceCompleted = false;
  let absTegoPageFullscreenLikeStarted = false;
  let absTegoControlCandidatesLogged = false;
  let absTegoFullscreenNativeRequestPosted = false;
  let absTegoFullscreenDiagListenersAttached = false;
  let absTegoFullscreenControlListenersAttached = false;
  let absTegoAutomatedFullscreenInFlight = false;
  let absTegoFullscreenNativeHoverCount = 0;
  let absTegoPlayerFirstActiveEmitted = false;
  let absTegoTopOverlayCleanupScheduled = false;
  let absTegoPageContentCleanupScheduled = false;
  let absTegoFrameOverlayCleanupScheduled = false;
  let absTegoChromeAutoHideScheduled = false;
  let absTegoChromeHidden = false;
  let absTegoChromeHideTimer = null;
  let absTegoChromeLastShowMs = 0;
  let absTegoChromeStabilityRetryCount = 0;
  let absTegoFullscreenLikeApplied = false;
  let absTegoPostStableLayerDumpScheduled = false;
  let absTegoPostStableLayerDumpDone = false;
  let absTegoPlaybackProgressPosted = false;
  let absTegoTopPlaybackListenerAttached = false;
  let tttTegoExtraStartupReprobeStarted = false;
  let tttTegoStartupNativePlayRequestPosted = false;
  let tttTegoStartupNativePlayRetryPosted = false;
  let tttTegoAutoplayWatchdogStarted = false;
  let tttTegoAutoplayWatchdogTick = 0;
  let tttTegoAutoplayWatchdogTimer = null;
  let tttTegoPlayAssistLastActive = false;
  let tttTegoPlayAssistLastReason = "";
  let tttTegoStartupStateLastKey = "";
  let novusProfileActiveEmitted = false;
  let novusChannelSelectionStarted = false;
  let novusChannelSelectionCompleted = false;
  let novusPlayerFirstActiveEmitted = false;
  let novusCleanupApplied = false;
  let novusPlayableLogged = false;
  let novusAutoplayAttemptCount = 0;
  let novusLastCurrentTime = 0;
  let novusAutoplayBlockedByPolicy = false;
  let novusPlayAssistLastActive = false;
  let novusPlayAssistLastReason = "";
  let cgtvPlayAssistScheduled = false;
  let cgtvPlayAssistLastKey = "";
  let cgtvPageFullscreenLikeStarted = false;
  let cgtvPageFullscreenLikeApplied = false;
  let cgtvTransportLockApplied = false;
  let cgtvFullscreenAssistAttempted = false;
  let cgtvBradmaxPlaybackHookAttached = false;
  let cgtvBradmaxFullscreenPollStarted = false;
  let chtvPlayAssistScheduled = false;
  let chtvPlayAssistLastKey = "";
  let chtvFullscreenAssistScheduled = false;
  let chtvFullscreenAssistLastKey = "";
  let chtvFullscreenAssistClickCount = 0;
  let caribvisionSessionStateLastKey = "";
  let caribvisionPlayAssistScheduled = false;
  let caribvisionPlayAssistLastKey = "";
  let caribvisionFullscreenAssistScheduled = false;
  let caribvisionFullscreenAssistLastKey = "";
  let caribvisionAudioDomClickDone = false;
  let caribvisionFullscreenDomClickDone = false;
  let cvmVimeoPlayerFirstApplied = false;
  let cvmVimeoQualityPreferenceResolved = false;
  let cbnVirginIslandsLayoutApplied = false;
  let cbnVirginIslandsAutoplayAttempted = false;
  let cbnVirginIslandsMutedFallbackAttempted = false;
  let cbnVirginIslandsMutedFallbackRetryCount = 0;
  let cbnVirginIslandsMutedFallbackRetryTimer = null;
  let cbnVirginIslandsPointerSleepRequested = false;
  let cbnVirginIslandsPointerSleepTimer = null;
  let cnc3PlayerFirstApplied = false;
  let gbnPlayerFirstApplied = false;
  let gbnPlayerFirstObserverAttached = false;
  let gbnPlayerFirstAppliedLogged = false;
  let gbnPlayerFirstNoTargetLogged = false;
  let gbnPlayerFirstRetryLogCount = 0;
  let gbnConsentFrameDetectedLogged = false;
  let cvc9ConsentFrameDetectedLogged = false;
  let cvc9PlayerFirstApplied = false;
  let cvc9PlayerFirstObserverAttached = false;
  let cvc9PlayerFirstAppliedLogged = false;
  let cvc9PlayerFirstNoTargetLogged = false;
  let cvc9PlayerFirstRetryLogCount = 0;
  const GBN_PLAYER_FIRST_RETRY_DELAYS_MS = [250, 500, 1000, 2000, 4000, 8000, 12000];
  const CVC9_PLAYER_FIRST_RETRY_DELAYS_MS = [250, 500, 1000, 2000, 4000, 8000, 12000];

  function isVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style && style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
  }

  function promptPayload(payload) {
    try {
      window.prompt(PROMPT_PREFIX + JSON.stringify(payload), "");
    } catch (_) {}
  }

  function isTegoPlayerFrame() {
    const host = (window.location.hostname || "").toLowerCase();
    return host === "player.tegotv.com" || host.endsWith(".player.tegotv.com");
  }

  function isAbsTegoChannel10Frame() {
    return isSupportedTegoFrame();
  }

  function isAbsLiveTopPage() {
    const host = (window.location.hostname || "").toLowerCase();
    if (host !== "abstvradio.com" && host !== "www.abstvradio.com") return false;
    const path = (window.location.pathname || "").toLowerCase();
    return path.indexOf("/live-streaming") === 0;
  }

  function isTttLiveTopPage() {
    const host = (window.location.hostname || "").toLowerCase();
    if (host !== "ttt.live" && host !== "www.ttt.live") return false;
    const path = (window.location.pathname || "").toLowerCase();
    return path.indexOf("/stream") === 0;
  }

  function isCvmLiveTopPage() {
    const host = (window.location.hostname || "").toLowerCase();
    if (host !== "cvmtv.com" && host !== "www.cvmtv.com") return false;
    const path = (window.location.pathname || "").toLowerCase();
    return path === "/live" || path.indexOf("/live/") === 0 || path.indexOf("/more-pages/cvm-live-stream") === 0;
  }

  function isCvmVimeoEmbedFrame() {
    const host = (window.location.hostname || "").toLowerCase();
    if (host !== "vimeo.com" && !host.endsWith(".vimeo.com")) return false;
    const path = (window.location.pathname || "").toLowerCase();
    return path.indexOf("/event/") === 0 && path.endsWith("/embed");
  }

  function isCbnVirginIslandsLivePage() {
    const host = (window.location.hostname || "").toLowerCase();
    if (host !== "cbnvirginislands.com" && host !== "www.cbnvirginislands.com") return false;
    const path = (window.location.pathname || "").toLowerCase();
    return path === "/cbn-tv" || path.indexOf("/cbn-tv/") === 0;
  }

  function isCbnVirginIslandsEmbedFrame() {
    const href = String(window.location.href || "").toLowerCase();
    return href.indexOf("cbnvirginislands-com.filesusr.com/html/") >= 0;
  }

  function isCnc3LiveStreamPage() {
    const host = (window.location.hostname || "").toLowerCase();
    if (host !== "cnc3.co.tt" && host !== "www.cnc3.co.tt") return false;
    const path = (window.location.pathname || "").toLowerCase();
    return path === "/live-stream" || path.indexOf("/live-stream/") === 0;
  }

  function isGbnLiveTelevisionPage() {
    const host = String(window.location.hostname || "").toLowerCase().replace(/^www\./, "");
    if (host !== "gbn.gd") return false;
    const path = String(window.location.pathname || "").toLowerCase();
    return path === "/live-television" || path === "/live-television/";
  }

  function isGbnDailymotionConsentFrame() {
    const host = String(window.location.hostname || "").toLowerCase().replace(/^www\./, "");
    const path = String(window.location.pathname || "").toLowerCase();
    if (host !== "consent.dailymotion.com") return false;
    if (path !== "/index.html" && path.indexOf("/consent") < 0) return false;
    const referrer = String(document.referrer || "").toLowerCase();
    const search = String(window.location.search || "").toLowerCase();
    const href = String(window.location.href || "").toLowerCase();
    return (
      referrer.indexOf("gbn.gd/live-television") >= 0 ||
      referrer.indexOf("dailymotion.com/embed/video/x85vz1r") >= 0 ||
      referrer.indexOf("x85vz1r") >= 0 ||
      search.indexOf("x85vz1r") >= 0 ||
      href.indexOf("x85vz1r") >= 0
    );
  }

  function isCvc9DailymotionWatchPage() {
    const host = String(window.location.hostname || "").toLowerCase().replace(/^www\./, "");
    const path = String(window.location.pathname || "").toLowerCase();
    return host === "dailymotion.com" && (path === "/video/x7gy059" || path.indexOf("/video/x7gy059/") === 0);
  }

  function isCvc9DailymotionPlayerFrame() {
    const host = String(window.location.hostname || "").toLowerCase().replace(/^www\./, "");
    const path = String(window.location.pathname || "").toLowerCase();
    if (host !== "geo.dailymotion.com" || path.indexOf("/player/") !== 0) {
      return false;
    }
    const referrer = String(document.referrer || "").toLowerCase();
    return referrer.indexOf("colorvision.com.do/en-vivo") >= 0 || referrer.indexOf("dailymotion.com/video/x7gy059") >= 0;
  }

  function isCvc9DailymotionConsentFrame() {
    const host = String(window.location.hostname || "").toLowerCase().replace(/^www\./, "");
    const path = String(window.location.pathname || "").toLowerCase();
    if (host !== "consent.dailymotion.com") {
      return false;
    }
    if (path !== "/index.html" && path.indexOf("/consent") < 0) {
      return false;
    }
    const referrer = String(document.referrer || "").toLowerCase();
    const search = String(window.location.search || "").toLowerCase();
    return (
      referrer.indexOf("dailymotion.com/video/x7gy059") >= 0 ||
      referrer.indexOf("geo.dailymotion.com/player/") >= 0 ||
      search.indexOf("consent_origin=https%3a%2f%2fconsent.dailymotion.com") >= 0 ||
      search.indexOf("preload_message=true") >= 0
    );
  }

  function isCvc9DailymotionConsentContext() {
    return isCvc9DailymotionWatchPage() || isCvc9DailymotionPlayerFrame() || isCvc9DailymotionConsentFrame();
  }

  function isGbnContext() {
    return isGbnLiveTelevisionPage() || isGbnDailymotionConsentFrame();
  }

  function emitGbnConsentFrameDetected(source) {
    if (gbnConsentFrameDetectedLogged || !isGbnDailymotionConsentFrame()) return false;
    if (isCvc9AdclickPage()) return false;
    gbnConsentFrameDetectedLogged = true;
    promptPayload({
      type: "gbn-live-state",
      phase: "content-gbn-consent-frame-detected",
      pageUrl: window.location.href,
      candidateCount: 0,
      source: String(source || "scan")
    });
    return true;
  }

  function ensureGbnConsentFrameDetector() {
    if (!isGbnDailymotionConsentFrame()) {
      return false;
    }
    emitGbnConsentFrameDetected("initial");
    try {
      const observer = new MutationObserver(() => {
        if (!isGbnDailymotionConsentFrame() || gbnConsentFrameDetectedLogged) {
          try {
            observer.disconnect();
          } catch (_) {}
          return;
        }
        emitGbnConsentFrameDetected("mutation");
      });
      observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class", "hidden", "aria-hidden"]
      });
    } catch (_) {}
    return true;
  }

  function emitCvc9ConsentFrameDetected(source) {
    if (cvc9ConsentFrameDetectedLogged || !isCvc9DailymotionConsentFrame()) return false;
    const host = String(window.location.hostname || "").toLowerCase().replace(/^www\./, "");
    if (host === "adclick.g.doubleclick.net") return false;
    cvc9ConsentFrameDetectedLogged = true;
    promptPayload({
      type: "cvc9-live-state",
      phase: "content-cvc9-consent-frame-detected",
      pageUrl: window.location.href,
      candidateCount: 0,
      source: String(source || "scan")
    });
    return true;
  }

  function ensureCvc9ConsentFrameDetector() {
    if (!isCvc9DailymotionConsentFrame()) {
      return false;
    }
    emitCvc9ConsentFrameDetected("initial");
    try {
      const observer = new MutationObserver(() => {
        if (!isCvc9DailymotionConsentFrame() || cvc9ConsentFrameDetectedLogged) {
          try {
            observer.disconnect();
          } catch (_) {}
          return;
        }
        emitCvc9ConsentFrameDetected("mutation");
      });
      observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class", "hidden", "aria-hidden"]
      });
    } catch (_) {}
    return true;
  }

  function isCvc9AdclickPage() {
    const host = String(window.location.hostname || "").toLowerCase().replace(/^www\./, "");
    const path = String(window.location.pathname || "").toLowerCase();
    return host === "adclick.g.doubleclick.net" && path.indexOf("/pcs/click") === 0;
  }

  function cvc9PlayerFirstLog(phase, source, candidateCount) {
    promptPayload({
      type: "cvc9-live-state",
      phase,
      pageUrl: window.location.href,
      candidateCount: Number(candidateCount || 0),
      source: String(source || "unknown")
    });
  }

  function scoreCvc9PlayerFirstCandidate(node) {
    if (!node || !isVisible(node)) return -1;
    let rect;
    try {
      rect = node.getBoundingClientRect();
    } catch (_) {
      return -1;
    }
    if (!rect || rect.width < 120 || rect.height < 68) return -1;
    const tag = String(node.tagName || "").toLowerCase();
    const src = String((node.getAttribute && node.getAttribute("src")) || node.src || "").toLowerCase();
    const cls = String(node.className || "").toLowerCase();
    let score = rect.width * rect.height;
    if (tag === "iframe") score += 3000000;
    if (tag === "video") score += 2500000;
    if (src.indexOf("geo.dailymotion.com/player") >= 0) score += 4000000;
    if (src.indexOf("dailymotion.com/embed") >= 0 || src.indexOf("dailymotion.com/player") >= 0) score += 2500000;
    if (cls.indexOf("player") >= 0 || cls.indexOf("video") >= 0) score += 200000;
    return score;
  }

  function findCvc9PlayerFirstCandidates() {
    const selector = [
      "iframe[src*='geo.dailymotion.com/player']",
      "iframe[src*='dailymotion.com/embed']",
      "iframe[src*='dailymotion.com/player']",
      "video"
    ].join(",");
    return Array.from(document.querySelectorAll(selector)).filter((node) => scoreCvc9PlayerFirstCandidate(node) >= 0);
  }

  function resolveCvc9PlayerFirstTarget(node) {
    if (!node) return null;
    let target = node;
    let bestScore = scoreCvc9PlayerFirstCandidate(node);
    let cursor = node.parentElement;
    for (let depth = 0; cursor && depth < 4; depth += 1) {
      if (cursor === document.body || cursor === document.documentElement) break;
      if (!isVisible(cursor)) {
        cursor = cursor.parentElement;
        continue;
      }
      let rect;
      try {
        rect = cursor.getBoundingClientRect();
      } catch (_) {
        rect = null;
      }
      if (!rect || rect.width < 120 || rect.height < 68) {
        cursor = cursor.parentElement;
        continue;
      }
      const parentScore = rect.width * rect.height;
      if (parentScore >= bestScore * 0.92 && parentScore <= bestScore * 1.8) {
        target = cursor;
        bestScore = parentScore;
      }
      cursor = cursor.parentElement;
    }
    return target;
  }

  function fillCvc9PlayerFirstNode(node) {
    if (!node || !node.style) return;
    node.style.setProperty("position", "fixed", "important");
    node.style.setProperty("inset", "0", "important");
    node.style.setProperty("left", "0", "important");
    node.style.setProperty("top", "0", "important");
    node.style.setProperty("width", "100vw", "important");
    node.style.setProperty("height", "100vh", "important");
    node.style.setProperty("max-width", "100vw", "important");
    node.style.setProperty("max-height", "100vh", "important");
    node.style.setProperty("margin", "0", "important");
    node.style.setProperty("padding", "0", "important");
    node.style.setProperty("border", "0", "important");
    node.style.setProperty("overflow", "hidden", "important");
    node.style.setProperty("background", "#000", "important");
    node.style.setProperty("z-index", "2147483647", "important");
  }

  function applyCvc9PlayerFirstRootStyles() {
    [document.documentElement, document.body].forEach((node) => {
      if (!node || !node.style) return;
      node.style.setProperty("margin", "0", "important");
      node.style.setProperty("padding", "0", "important");
      node.style.setProperty("width", "100vw", "important");
      node.style.setProperty("height", "100vh", "important");
      node.style.setProperty("min-width", "100vw", "important");
      node.style.setProperty("min-height", "100vh", "important");
      node.style.setProperty("overflow", "hidden", "important");
      node.style.setProperty("background", "#000", "important");
    });
  }

  function applyCvc9WatchPageChromeSuppression(target) {
    if (!isCvc9DailymotionWatchPage()) return;
    const quietSelectors = [
      "header",
      "footer",
      "[class*='sidebar']",
      "[class*='Sidebar']",
      "[class*='recommend']",
      "[class*='Recommend']",
      "[class*='related']",
      "[class*='Related']"
    ];
    quietSelectors.forEach((selector) => {
      try {
        Array.from(document.querySelectorAll(selector)).forEach((node) => {
          if (!node || node === target || node.contains(target) || target.contains(node)) return;
          if (!node.style) return;
          node.style.setProperty("visibility", "hidden", "important");
          node.style.setProperty("pointer-events", "none", "important");
        });
      } catch (_) {}
    });
  }

  function applyCvc9DailymotionPlayerFirstLayout(source) {
    if (cvc9PlayerFirstApplied || isCvc9AdclickPage()) return false;
    const watchPage = isCvc9DailymotionWatchPage();
    const playerFrame = isCvc9DailymotionPlayerFrame();
    if (!watchPage && !playerFrame) return false;
    applyCvc9PlayerFirstRootStyles();
    const candidates = playerFrame
      ? Array.from(document.querySelectorAll("video,iframe,[id*='player'],[class*='player'],main,body")).filter((node) => {
          if (!node || node === document.documentElement) return false;
          try {
            const rect = node.getBoundingClientRect();
            return rect.width > 120 && rect.height > 68;
          } catch (_) {
            return false;
          }
        })
      : findCvc9PlayerFirstCandidates();
    const sortedCandidates = candidates.slice().sort((a, b) => scoreCvc9PlayerFirstCandidate(b) - scoreCvc9PlayerFirstCandidate(a));
    const target = resolveCvc9PlayerFirstTarget(sortedCandidates[0] || (playerFrame ? (document.querySelector("video") || document.body) : null));
    if (!target) {
      const sourceText = String(source || "unknown");
      if (sourceText.indexOf("retry-") === 0 && cvc9PlayerFirstRetryLogCount < 3) {
        cvc9PlayerFirstRetryLogCount += 1;
        cvc9PlayerFirstLog("content-cvc9-player-first-retry", sourceText, candidates.length);
      } else if (!cvc9PlayerFirstNoTargetLogged && (sourceText === "retry-12000" || sourceText === "observer-expire" || sourceText === "load")) {
        cvc9PlayerFirstNoTargetLogged = true;
        cvc9PlayerFirstLog("content-cvc9-player-first-no-target", sourceText, candidates.length);
      }
      return false;
    }
    fillCvc9PlayerFirstNode(target);
    try {
      Array.from(target.querySelectorAll("iframe,video,[class*='player'],[id*='player']")).forEach((node) => {
        if (!node || !node.style) return;
        node.style.setProperty("width", "100%", "important");
        node.style.setProperty("height", "100%", "important");
        node.style.setProperty("max-width", "100%", "important");
        node.style.setProperty("max-height", "100%", "important");
        node.style.setProperty("margin", "0", "important");
        node.style.setProperty("padding", "0", "important");
        node.style.setProperty("border", "0", "important");
        node.style.setProperty("background", "#000", "important");
      });
    } catch (_) {}
    if (playerFrame) {
      [document.body, document.querySelector("main"), document.querySelector("#root"), document.querySelector("[id*='player']")].forEach((node) => {
        if (!node || !node.style) return;
        node.style.setProperty("width", "100vw", "important");
        node.style.setProperty("height", "100vh", "important");
        node.style.setProperty("margin", "0", "important");
        node.style.setProperty("padding", "0", "important");
        node.style.setProperty("overflow", "hidden", "important");
        node.style.setProperty("background", "#000", "important");
      });
    } else {
      applyCvc9WatchPageChromeSuppression(target);
    }
    try {
      target.setAttribute("data-kf-cvc9-player-first", "1");
    } catch (_) {}
    cvc9PlayerFirstApplied = true;
    if (!cvc9PlayerFirstAppliedLogged) {
      cvc9PlayerFirstAppliedLogged = true;
      cvc9PlayerFirstLog("content-cvc9-player-first-applied", source, candidates.length);
    }
    return true;
  }

  function scheduleCvc9DailymotionPlayerFirstLayout() {
    if (isCvc9AdclickPage()) return false;
    if (!isCvc9DailymotionWatchPage() && !isCvc9DailymotionPlayerFrame()) return false;
    applyCvc9DailymotionPlayerFirstLayout("initial");
    const retryApply = (source) => applyCvc9DailymotionPlayerFirstLayout(source);
    CVC9_PLAYER_FIRST_RETRY_DELAYS_MS.forEach((delayMs) => {
      setTimeout(() => retryApply(`retry-${delayMs}`), delayMs);
    });
    const domReady = () => retryApply("dom-content-loaded");
    const loaded = () => retryApply("load");
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", domReady, { once: true });
    } else {
      domReady();
    }
    window.addEventListener("load", loaded, { once: true });
    if (cvc9PlayerFirstObserverAttached) return true;
    cvc9PlayerFirstObserverAttached = true;
    try {
      const observer = new MutationObserver(() => {
        if (cvc9PlayerFirstApplied) {
          try {
            observer.disconnect();
          } catch (_) {}
          return;
        }
        retryApply("mutation");
      });
      observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class", "hidden", "src"]
      });
      setTimeout(() => {
        try {
          observer.disconnect();
        } catch (_) {}
        if (!cvc9PlayerFirstApplied) {
          retryApply("observer-expire");
        }
      }, 15000);
    } catch (_) {}
    return true;
  }

  function gbnPlayerFirstLog(phase, source, candidateCount, details) {
    const extra = details && typeof details === "object" ? details : {};
    promptPayload(Object.assign({
      type: "gbn-live-state",
      phase,
      pageUrl: window.location.href,
      candidateCount: Number(candidateCount || 0),
      source: String(source || "unknown")
    }, extra));
  }

  function scoreGbnOfficialIframe(node) {
    if (!node || !isVisible(node)) return -1;
    let rect;
    try {
      rect = node.getBoundingClientRect();
    } catch (_) {
      return -1;
    }
    if (!rect || rect.width < 120 || rect.height < 68) return -1;
    const tag = String(node.tagName || "").toLowerCase();
    const src = String((node.getAttribute && node.getAttribute("src")) || node.src || "").toLowerCase();
    if (tag !== "iframe" || src.indexOf("x85vz1r") < 0 || src.indexOf("dailymotion") < 0) return -1;
    let score = rect.width * rect.height;
    if (src.indexOf("geo.dailymotion.com/player.html") >= 0) score += 5000000;
    if (src.indexOf("geo.dailymotion.com/player") >= 0) score += 4000000;
    if (src.indexOf("dailymotion.com/embed/video/x85vz1r") >= 0) score += 3000000;
    return score;
  }

  function findGbnOfficialIframe() {
    const selectors = [
      "iframe[src*='dailymotion.com/embed/video/x85vz1r']",
      "iframe[src*='geo.dailymotion.com/player.html'][src*='x85vz1r']",
      "iframe[src*='geo.dailymotion.com/player'][src*='x85vz1r']",
      "iframe[src*='x85vz1r'][src*='dailymotion']",
      "iframe[src*='x85vz1r'][src*='geo.dailymotion.com']"
    ];
    const seen = new Set();
    let best = null;
    let bestScore = -1;
    selectors.forEach((selector) => {
      try {
        Array.from(document.querySelectorAll(selector)).forEach((node) => {
          if (!node || seen.has(node)) return;
          seen.add(node);
          const score = scoreGbnOfficialIframe(node);
          if (score > bestScore) {
            best = node;
            bestScore = score;
          }
        });
      } catch (_) {}
    });
    return bestScore >= 0 ? best : null;
  }

  function isGbnResponsiveWrapper(node) {
    if (!node || !node.style) return false;
    const style = String(node.getAttribute("style") || "").toLowerCase();
    const cls = String(node.className || "").toLowerCase();
    return (
      style.indexOf("position:relative") >= 0 ||
      cls.indexOf("video") >= 0 ||
      cls.indexOf("player") >= 0 ||
      cls.indexOf("embed") >= 0 ||
      cls.indexOf("fluid") >= 0 ||
      cls.indexOf("responsive") >= 0 ||
      cls.indexOf("dailymotion") >= 0
    ) && (
      style.indexOf("padding-bottom:56.25%") >= 0 ||
      style.indexOf("padding-bottom: 56.25%") >= 0 ||
      cls.indexOf("fluid-width-video-wrapper") >= 0 ||
      cls.indexOf("embed-responsive") >= 0
    );
  }

  function isForbiddenGbnWrapper(node) {
    if (!node) return true;
    const tag = String(node.tagName || "").toLowerCase();
    if (["html", "body", "script", "style", "link", "meta", "noscript"].indexOf(tag) >= 0) {
      return true;
    }
    const cls = String(node.className || "").toLowerCase();
    return cls.indexOf("et-l--header") >= 0 ||
      cls.indexOf("et-l--footer") >= 0 ||
      cls.indexOf("main-header") >= 0 ||
      cls.indexOf("main-footer") >= 0;
  }

  function describeGbnTarget(node, label) {
    if (!node) return String(label || "unknown");
    const tag = String(node.tagName || "").toLowerCase();
    const cls = String(node.className || "").trim().replace(/\s+/g, ".").slice(0, 80);
    return `${String(label || tag)}:${tag}${cls ? "." + cls : ""}`;
  }

  function resolveGbnOfficialIframeWrapper(iframe) {
    if (!iframe) return null;
    let iframeRect;
    try {
      iframeRect = iframe.getBoundingClientRect();
    } catch (_) {
      iframeRect = null;
    }
    const iframeArea = iframeRect ? iframeRect.width * iframeRect.height : 0;
    let best = iframe;
    let bestScore = 60;
    let cursor = iframe;
    for (let depth = 0; cursor && depth <= 2; depth += 1) {
      if (depth > 0) {
        cursor = cursor.parentElement;
      }
      if (!cursor || isForbiddenGbnWrapper(cursor) || !isVisible(cursor)) {
        continue;
      }
      let rect;
      try {
        rect = cursor.getBoundingClientRect();
      } catch (_) {
        rect = null;
      }
      if (!rect || rect.width < 120 || rect.height < 68) continue;
      const area = rect.width * rect.height;
      const tag = String(cursor.tagName || "").toLowerCase();
      const cls = String(cursor.className || "").toLowerCase();
      let score = depth === 0 ? 80 : (depth === 1 ? 120 : 95);
      if (isGbnResponsiveWrapper(cursor)) score += 180;
      if (area >= iframeArea * 0.95 && area <= iframeArea * 2.5) score += 140;
      else if (area <= iframeArea * 6) score += 40;
      else score -= 160;
      if (["main", "article", "section", "header", "footer", "nav"].indexOf(tag) >= 0) score -= 180;
      if (
        cls.indexOf("et_pb_section") >= 0 ||
        cls.indexOf("et_pb_row") >= 0 ||
        cls.indexOf("et_pb_column") >= 0 ||
        cls.indexOf("container") >= 0 ||
        cls.indexOf("post") >= 0 ||
        cls.indexOf("content") >= 0
      ) {
        score -= 80;
      }
      if (score > bestScore) {
        best = cursor;
        bestScore = score;
      }
    }
    return best;
  }

  function applyGbnPlayerFirstWrapperStyles(target, iframe) {
    if (!target || !target.style || !iframe || !iframe.style) return;
    target.style.setProperty("position", "fixed", "important");
    target.style.setProperty("inset", "0", "important");
    target.style.setProperty("left", "0", "important");
    target.style.setProperty("top", "0", "important");
    target.style.setProperty("width", "100vw", "important");
    target.style.setProperty("height", "100vh", "important");
    target.style.setProperty("max-width", "100vw", "important");
    target.style.setProperty("max-height", "100vh", "important");
    target.style.setProperty("z-index", "2147483647", "important");
    target.style.setProperty("background", "#000", "important");
    target.style.setProperty("overflow", "hidden", "important");
    target.style.setProperty("margin", "0", "important");
    target.style.setProperty("padding", "0", "important");
    target.style.setProperty("transform", "none", "important");
    if (target !== iframe) {
      iframe.style.setProperty("position", "absolute", "important");
      iframe.style.setProperty("left", "0", "important");
      iframe.style.setProperty("top", "0", "important");
      iframe.style.setProperty("width", "100%", "important");
      iframe.style.setProperty("height", "100%", "important");
    } else {
      iframe.style.setProperty("position", "fixed", "important");
      iframe.style.setProperty("left", "0", "important");
      iframe.style.setProperty("top", "0", "important");
      iframe.style.setProperty("width", "100vw", "important");
      iframe.style.setProperty("height", "100vh", "important");
    }
    iframe.style.setProperty("border", "0", "important");
    iframe.style.setProperty("background", "#000", "important");
    iframe.style.setProperty("margin", "0", "important");
    iframe.style.setProperty("padding", "0", "important");
    iframe.style.setProperty("transform", "none", "important");
  }

  function applyGbnPlayerFirstRootStyles() {
    [document.documentElement, document.body].forEach((node) => {
      if (!node || !node.style) return;
      node.style.setProperty("margin", "0", "important");
      node.style.setProperty("padding", "0", "important");
      node.style.setProperty("width", "100vw", "important");
      node.style.setProperty("height", "100vh", "important");
      node.style.setProperty("min-width", "100vw", "important");
      node.style.setProperty("min-height", "100vh", "important");
      node.style.setProperty("overflow", "hidden", "important");
      node.style.setProperty("background", "#000", "important");
    });
  }

  function hideGbnVisualNode(node) {
    if (!node || !node.style) return;
    const tag = String(node.tagName || "").toLowerCase();
    if (["script", "style", "link", "meta", "noscript"].indexOf(tag) >= 0) return;
    node.style.setProperty("display", "none", "important");
    node.style.setProperty("visibility", "hidden", "important");
    node.style.setProperty("pointer-events", "none", "important");
  }

  function buildGbnPlayerPath(target) {
    const path = new Set();
    let cursor = target;
    while (cursor && cursor !== document.documentElement) {
      path.add(cursor);
      cursor = cursor.parentElement;
    }
    if (document.documentElement) path.add(document.documentElement);
    if (document.body) path.add(document.body);
    return path;
  }

  function isOutsideGbnPlayerPath(node, target, path) {
    if (!node || path.has(node)) return false;
    if (node === target) return false;
    if (node.contains(target) || target.contains(node)) return false;
    return true;
  }

  function applyGbnWatchPageChromeSuppression(target) {
    if (!isGbnLiveTelevisionPage()) return;
    const path = buildGbnPlayerPath(target);
    path.forEach((node) => {
      const parent = node && node.parentElement;
      if (!parent) return;
      Array.from(parent.children || []).forEach((sibling) => {
        if (!isOutsideGbnPlayerPath(sibling, target, path)) return;
        hideGbnVisualNode(sibling);
      });
    });
    const quietSelectors = [
      "#main-header",
      "#main-footer",
      "#top-header",
      ".et-l--header",
      ".et-l--footer",
      "header",
      "footer",
      "nav",
      "[role='banner']",
      "[role='navigation']",
      "[class*='header']",
      "[class*='Header']",
      "[class*='nav']",
      "[class*='Nav']",
      "[class*='menu']",
      "[class*='Menu']",
      "[class*='social']",
      "[class*='Social']"
    ];
    quietSelectors.forEach((selector) => {
      try {
        Array.from(document.querySelectorAll(selector)).forEach((node) => {
          if (!isOutsideGbnPlayerPath(node, target, path)) return;
          hideGbnVisualNode(node);
        });
      } catch (_) {}
    });
  }

  function applyGbnDailymotionEmbedPlayerFirstLayout(source) {
    if (gbnPlayerFirstApplied || isCvc9AdclickPage()) return false;
    const livePage = isGbnLiveTelevisionPage();
    if (!livePage) return false;
    applyGbnPlayerFirstRootStyles();
    const iframe = findGbnOfficialIframe();
    const candidateCount = iframe ? 1 : 0;
    const target = resolveGbnOfficialIframeWrapper(iframe);
    if (!iframe || !target) {
      const sourceText = String(source || "unknown");
      if (sourceText.indexOf("retry-") === 0 && gbnPlayerFirstRetryLogCount < 3) {
        gbnPlayerFirstRetryLogCount += 1;
        gbnPlayerFirstLog("content-gbn-player-first-retry", sourceText, candidateCount);
      } else if (!gbnPlayerFirstNoTargetLogged && (sourceText === "retry-12000" || sourceText === "observer-expire" || sourceText === "load")) {
        gbnPlayerFirstNoTargetLogged = true;
        gbnPlayerFirstLog("content-gbn-player-first-no-target", sourceText, candidateCount);
      }
      return false;
    }
    applyGbnPlayerFirstWrapperStyles(target, iframe);
    try {
      target.setAttribute("data-kf-gbn-player-first", "1");
      iframe.setAttribute("data-kf-gbn-iframe", "1");
    } catch (_) {}
    applyGbnWatchPageChromeSuppression(target);
    gbnPlayerFirstApplied = true;
    if (!gbnPlayerFirstAppliedLogged) {
      gbnPlayerFirstAppliedLogged = true;
      gbnPlayerFirstLog("content-gbn-player-first-applied", source, 1, {
        target: "gbn-outer-iframe",
        targetSummary: describeGbnTarget(target, target === iframe ? "iframe-target" : "wrapper-target"),
        iframeSrc: String((iframe.getAttribute && iframe.getAttribute("src")) || iframe.src || "")
      });
    }
    return true;
  }

  function scheduleGbnDailymotionPlayerFirstLayout() {
    if (isCvc9AdclickPage()) return false;
    if (!isGbnLiveTelevisionPage()) return false;
    applyGbnDailymotionEmbedPlayerFirstLayout("initial");
    const retryApply = (source) => applyGbnDailymotionEmbedPlayerFirstLayout(source);
    GBN_PLAYER_FIRST_RETRY_DELAYS_MS.forEach((delayMs) => {
      setTimeout(() => retryApply(`retry-${delayMs}`), delayMs);
    });
    const domReady = () => retryApply("dom-content-loaded");
    const loaded = () => retryApply("load");
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", domReady, { once: true });
    } else {
      domReady();
    }
    window.addEventListener("load", loaded, { once: true });
    if (gbnPlayerFirstObserverAttached) return true;
    gbnPlayerFirstObserverAttached = true;
    try {
      const observer = new MutationObserver(() => {
        if (gbnPlayerFirstApplied) {
          try {
            observer.disconnect();
          } catch (_) {}
          return;
        }
        retryApply("mutation");
      });
      observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class", "hidden", "src"]
      });
      setTimeout(() => {
        try {
          observer.disconnect();
        } catch (_) {}
        if (!gbnPlayerFirstApplied) {
          retryApply("observer-expire");
        }
      }, 15000);
    } catch (_) {}
    return true;
  }

  function applyCvmVimeoPlayerFirstLayout() {
    if (cvmVimeoPlayerFirstApplied) return false;
    const shouldApply = isCvmLiveTopPage() || isCvmVimeoEmbedFrame();
    if (!shouldApply) return false;
    const target = isCvmLiveTopPage()
      ? Array.from(document.querySelectorAll("iframe")).find((node) => {
          const src = String(node.src || node.getAttribute("src") || "").toLowerCase();
          return src.indexOf("vimeo.com/event/") >= 0 && src.indexOf("/embed") >= 0;
        })
      : (document.querySelector("iframe") || document.body);
    if (!target) return false;
    try {
      if (document.documentElement && document.documentElement.style) {
        document.documentElement.style.setProperty("margin", "0", "important");
        document.documentElement.style.setProperty("padding", "0", "important");
        document.documentElement.style.setProperty("width", "100vw", "important");
        document.documentElement.style.setProperty("height", "100vh", "important");
        document.documentElement.style.setProperty("overflow", "hidden", "important");
        document.documentElement.style.setProperty("background", "#000", "important");
      }
      if (document.body && document.body.style) {
        document.body.style.setProperty("margin", "0", "important");
        document.body.style.setProperty("padding", "0", "important");
        document.body.style.setProperty("width", "100vw", "important");
        document.body.style.setProperty("height", "100vh", "important");
        document.body.style.setProperty("overflow", "hidden", "important");
        document.body.style.setProperty("background", "#000", "important");
      }
      if (target && target.style) {
        target.style.setProperty("position", "fixed", "important");
        target.style.setProperty("left", "0", "important");
        target.style.setProperty("top", "0", "important");
        target.style.setProperty("width", "100vw", "important");
        target.style.setProperty("height", "100vh", "important");
        target.style.setProperty("max-width", "100vw", "important");
        target.style.setProperty("max-height", "100vh", "important");
        target.style.setProperty("margin", "0", "important");
        target.style.setProperty("padding", "0", "important");
        target.style.setProperty("border", "0", "important");
        target.style.setProperty("z-index", "2147483647", "important");
        target.style.setProperty("background", "#000", "important");
      }
      cvmVimeoPlayerFirstApplied = true;
      return true;
    } catch (_) {
      return false;
    }
  }

  function maybePreferCvmVimeo1080p() {
    if (cvmVimeoQualityPreferenceResolved || !isCvmVimeoEmbedFrame()) return false;
    try {
      const PlayerCtor = window.Vimeo && window.Vimeo.Player;
      if (typeof PlayerCtor !== "function") return false;
      const root = Array.from(document.querySelectorAll("iframe, div[data-vimeo-id], div[data-vimeo-url]")).find((node) => {
        const src = String(node.src || node.getAttribute("data-vimeo-url") || "").toLowerCase();
        return src.indexOf("vimeo.com") >= 0 || node.hasAttribute("data-vimeo-id") || node.hasAttribute("data-vimeo-url");
      });
      if (!root) return false;
      const player = new PlayerCtor(root);
      Promise.resolve(player.getQualities())
        .then((qualities) => {
          const preferred = Array.isArray(qualities)
            ? qualities.find((quality) => String((quality && (quality.id || quality.label)) || "").toLowerCase() === "1080p")
            : null;
          if (!preferred) {
            cvmVimeoQualityPreferenceResolved = true;
            return null;
          }
          return Promise.resolve(player.getQuality())
            .then((current) => {
              if (String(current || "").toLowerCase() === "1080p") {
                cvmVimeoQualityPreferenceResolved = true;
                return current;
              }
              return player.setQuality(preferred.id || preferred.label || "1080p");
            })
            .then(() => {
              cvmVimeoQualityPreferenceResolved = true;
            })
            .catch(() => {
              cvmVimeoQualityPreferenceResolved = true;
            });
        })
        .catch(() => {});
      return true;
    } catch (_) {
      return false;
    }
  }

  function isCbnVirginIslandsPlaybackActive() {
    try {
      const visibleVideos = Array.from(document.querySelectorAll("video")).filter((node) => isVisible(node));
      if (visibleVideos.some((node) => !node.paused && !node.ended)) {
        return true;
      }
      if (typeof window.jwplayer === "function") {
        const jwplayerInstance = window.jwplayer();
        if (jwplayerInstance && typeof jwplayerInstance.getState === "function") {
          const state = String(jwplayerInstance.getState() || "").toLowerCase();
          if (state === "playing") {
            return true;
          }
        }
      }
    } catch (_) {}
    return false;
  }

  function applyCbnVirginIslandsPlayerFirstLayout() {
    if (cbnVirginIslandsLayoutApplied || !isCbnVirginIslandsLivePage()) return false;
    const player = document.getElementById("comp-ke1v14ts");
    if (!player) return false;
    try {
      if (document.documentElement && document.documentElement.style) {
        document.documentElement.style.setProperty("margin", "0", "important");
        document.documentElement.style.setProperty("padding", "0", "important");
        document.documentElement.style.setProperty("width", "100vw", "important");
        document.documentElement.style.setProperty("height", "100vh", "important");
        document.documentElement.style.setProperty("overflow", "hidden", "important");
        document.documentElement.style.setProperty("background", "#000", "important");
      }
      if (document.body && document.body.style) {
        document.body.style.setProperty("margin", "0", "important");
        document.body.style.setProperty("padding", "0", "important");
        document.body.style.setProperty("width", "100vw", "important");
        document.body.style.setProperty("height", "100vh", "important");
        document.body.style.setProperty("overflow", "hidden", "important");
        document.body.style.setProperty("background", "#000", "important");
      }
      const playerFrame = player.querySelector("iframe");
      const targets = [player, playerFrame].filter(Boolean);
      targets.forEach((node) => {
        if (!node || !node.style) return;
        node.style.setProperty("position", "fixed", "important");
        node.style.setProperty("left", "0", "important");
        node.style.setProperty("top", "0", "important");
        node.style.setProperty("width", "100vw", "important");
        node.style.setProperty("height", "100vh", "important");
        node.style.setProperty("max-width", "100vw", "important");
        node.style.setProperty("max-height", "100vh", "important");
        node.style.setProperty("margin", "0", "important");
        node.style.setProperty("padding", "0", "important");
        node.style.setProperty("border", "0", "important");
        node.style.setProperty("overflow", "hidden", "important");
        node.style.setProperty("background", "#000", "important");
        node.style.setProperty("z-index", "2147483647", "important");
      });
      try {
        const quietSelectors = ["#comp-lg70kcxq"];
        quietSelectors.forEach((selector) => {
          const node = document.querySelector(selector);
          if (node && node.style) {
            node.style.setProperty("display", "none", "important");
          }
        });
      } catch (_) {}
      cbnVirginIslandsLayoutApplied = true;
      maybeScheduleCbnVirginIslandsPointerSleep();
      return true;
    } catch (_) {
      return false;
    }
  }

  function applyCnc3PlayerFirstLayout() {
    if (cnc3PlayerFirstApplied || !isCnc3LiveStreamPage()) return false;
    const playerFrame = document.querySelector("iframe[src*='geo.dailymotion.com/player/'][src*='x9vba4u']");
    const player = playerFrame?.parentElement;
    if (!player && !playerFrame) return false;
    try {
      if (document.documentElement && document.documentElement.style) {
        document.documentElement.style.setProperty("margin", "0", "important");
        document.documentElement.style.setProperty("padding", "0", "important");
        document.documentElement.style.setProperty("width", "100vw", "important");
        document.documentElement.style.setProperty("height", "100vh", "important");
        document.documentElement.style.setProperty("overflow", "hidden", "important");
        document.documentElement.style.setProperty("background", "#000", "important");
      }
      if (document.body && document.body.style) {
        document.body.style.setProperty("margin", "0", "important");
        document.body.style.setProperty("padding", "0", "important");
        document.body.style.setProperty("width", "100vw", "important");
        document.body.style.setProperty("height", "100vh", "important");
        document.body.style.setProperty("overflow", "hidden", "important");
        document.body.style.setProperty("background", "#000", "important");
      }
      [player, playerFrame].filter(Boolean).forEach((node) => {
        if (!node || !node.style) return;
        node.style.setProperty("position", "fixed", "important");
        node.style.setProperty("left", "0", "important");
        node.style.setProperty("top", "0", "important");
        node.style.setProperty("width", "100vw", "important");
        node.style.setProperty("height", "100vh", "important");
        node.style.setProperty("max-width", "100vw", "important");
        node.style.setProperty("max-height", "100vh", "important");
        node.style.setProperty("margin", "0", "important");
        node.style.setProperty("padding", "0", "important");
        node.style.setProperty("border", "0", "important");
        node.style.setProperty("overflow", "hidden", "important");
        node.style.setProperty("background", "#000", "important");
        node.style.setProperty("z-index", "2147483647", "important");
      });
      cnc3PlayerFirstApplied = true;
      promptPayload({
        type: "cnc3-live-state",
        phase: "content-cnc3-player-first",
        pageUrl: window.location.href,
        layoutApplied: true,
        playbackActive: false
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  function maybeScheduleCbnVirginIslandsPointerSleep() {
    if (cbnVirginIslandsPointerSleepRequested || cbnVirginIslandsPointerSleepTimer || !isCbnVirginIslandsLivePage()) {
      return false;
    }
    if (!cbnVirginIslandsLayoutApplied && !isCbnVirginIslandsPlaybackActive()) {
      return false;
    }
    cbnVirginIslandsPointerSleepTimer = setTimeout(() => {
      cbnVirginIslandsPointerSleepTimer = null;
      if (cbnVirginIslandsPointerSleepRequested || !isCbnVirginIslandsLivePage()) return;
      cbnVirginIslandsPointerSleepRequested = true;
      promptPayload({
        type: "cbn-virgin-islands-state",
        phase: "content-cbn-virgin-islands-pointer-sleep",
        pageUrl: window.location.href,
        layoutApplied: !!cbnVirginIslandsLayoutApplied,
        playbackActive: isCbnVirginIslandsPlaybackActive(),
        requestPointerSleep: true
      });
    }, 1800);
    return true;
  }

  function tryCbnVirginIslandsMutedFallback() {
    if (cbnVirginIslandsMutedFallbackAttempted || !isCbnVirginIslandsEmbedFrame()) return false;
    let attempted = false;
    let foundTarget = false;
    try {
      const jwplayerInstance = typeof window.jwplayer === "function" ? window.jwplayer() : null;
      if (jwplayerInstance) {
        foundTarget = true;
        attempted = safeMethodCall(jwplayerInstance, "play", [true], null) || attempted;
        attempted = safeMethodCall(jwplayerInstance, "play", [], null) || attempted;
      }
    } catch (_) {}
    try {
      const visibleVideos = Array.from(document.querySelectorAll("video")).filter((node) => isVisible(node));
      const mutedVideo = visibleVideos.find((node) => node.paused || node.ended) || visibleVideos[0] || null;
      if (mutedVideo) {
        foundTarget = true;
        try {
          mutedVideo.playsInline = true;
        } catch (_) {}
        const playResult = mutedVideo.play();
        attempted = true;
        if (playResult && typeof playResult.catch === "function") {
          playResult.catch(() => {});
        }
      }
    } catch (_) {}
    if (isCbnVirginIslandsPlaybackActive()) {
      cbnVirginIslandsMutedFallbackAttempted = true;
      cbnVirginIslandsMutedFallbackRetryCount = 0;
      maybeScheduleCbnVirginIslandsPointerSleep();
      return true;
    }
    if ((attempted || foundTarget) && !cbnVirginIslandsMutedFallbackRetryTimer && cbnVirginIslandsMutedFallbackRetryCount < 3) {
      const retryDelayMs = 500 + (cbnVirginIslandsMutedFallbackRetryCount * 700);
      cbnVirginIslandsMutedFallbackRetryCount += 1;
      cbnVirginIslandsMutedFallbackRetryTimer = setTimeout(() => {
        cbnVirginIslandsMutedFallbackRetryTimer = null;
        if (!isCbnVirginIslandsEmbedFrame() || cbnVirginIslandsMutedFallbackAttempted || isCbnVirginIslandsPlaybackActive()) {
          return;
        }
        tryCbnVirginIslandsMutedFallback();
      }, retryDelayMs);
    }
    return attempted || foundTarget;
  }

  function maybeKickCbnVirginIslandsPlayer() {
    if (cbnVirginIslandsAutoplayAttempted || !isCbnVirginIslandsEmbedFrame()) return false;
    let attempted = false;
    let foundTarget = false;
    try {
      const jwplayerInstance = typeof window.jwplayer === "function" ? window.jwplayer() : null;
      if (jwplayerInstance) {
        foundTarget = true;
        try {
          if (typeof jwplayerInstance.getState === "function") {
            const state = String(jwplayerInstance.getState() || "").toLowerCase();
            if (state === "playing") {
              cbnVirginIslandsAutoplayAttempted = true;
              maybeScheduleCbnVirginIslandsPointerSleep();
              return true;
            }
          }
          attempted = safeMethodCall(jwplayerInstance, "play", [true], null) || attempted;
          attempted = safeMethodCall(jwplayerInstance, "play", [], null) || attempted;
        } catch (_) {}
      }
      if (!attempted) {
        try {
          const visibleVideos = Array.from(document.querySelectorAll("video")).filter((node) => isVisible(node));
          const activeVideo = visibleVideos.find((node) => node.paused || node.ended) || null;
          if (activeVideo) {
            foundTarget = true;
            try {
              if (activeVideo.muted) activeVideo.muted = false;
              if (typeof activeVideo.volume === "number" && activeVideo.volume < 1) activeVideo.volume = 1;
              activeVideo.playsInline = true;
            } catch (_) {}
            const playResult = activeVideo.play();
            attempted = true;
            if (playResult && typeof playResult.catch === "function") {
              playResult.catch(() => {
                tryCbnVirginIslandsMutedFallback();
              });
            }
          }
        } catch (_) {}
      }
      if (!attempted) {
        const playButton = Array.from(
          document.querySelectorAll("button,[role='button'],.jw-icon-playback,.jw-display-icon-container,.jw-icon-play,.jw-big-play-button")
        ).find((node) => {
          if (!isVisible(node)) return false;
          const blob = String(
            node.innerText || node.textContent || node.getAttribute("aria-label") || node.getAttribute("title") || node.className || ""
          ).replace(/\s+/g, " ").trim().toLowerCase();
          if (!blob) return false;
          if (blob.indexOf("pause") >= 0) return false;
          return blob.indexOf("play") >= 0 || blob.indexOf("watch") >= 0 || blob.indexOf("live") >= 0;
        });
        if (playButton) {
          foundTarget = true;
          try {
            playButton.click();
            attempted = true;
          } catch (_) {}
        }
      }
    } catch (_) {}
    if (!foundTarget) {
      return false;
    }
    cbnVirginIslandsAutoplayAttempted = true;
    if (attempted) {
      maybeScheduleCbnVirginIslandsPointerSleep();
    } else {
      tryCbnVirginIslandsMutedFallback();
    }
    return attempted;
  }

  function detectTegoProfileFromPlayerUrl(rawUrl) {
    try {
      const url = new URL(String(rawUrl || ""), window.location.href);
      const host = (url.hostname || "").toLowerCase();
      const path = (url.pathname || "").toLowerCase();
      if (host.indexOf("player.tegotv.com") < 0 || path.indexOf("/player.php") < 0) return "";
      const channel = (url.searchParams.get("channel") || "").trim();
      if (!channel || channel === "10") return "abs";
      if (channel === "1") return "ttt";
      return "";
    } catch (_) {
      return "";
    }
  }

  function activeTegoTopProfile() {
    if (isAbsLiveTopPage()) return "abs";
    if (isTttLiveTopPage()) return "ttt";
    return "";
  }

  function isNovusTelearubaTopPage() {
    const host = (window.location.hostname || "").toLowerCase();
    return host === "novus.telearuba.aw" || host === "www.novus.telearuba.aw";
  }

  function isCgtvWatchTopPage() {
    const host = (window.location.hostname || "").toLowerCase();
    const path = (window.location.pathname || "").toLowerCase();
    return (host === "caribbeangospel.tv" || host === "www.caribbeangospel.tv") && path.indexOf("/watch") === 0;
  }

  function isCgtvBradmaxFrame() {
    const host = (window.location.hostname || "").toLowerCase();
    return host === "bradm.ax" || host.endsWith(".bradm.ax");
  }

  function isChtvTopPage() {
    const host = (window.location.hostname || "").toLowerCase();
    return host === "caribbeanhottv.com" || host === "www.caribbeanhottv.com";
  }

  function isCaribVisionAppPage() {
    const host = (window.location.hostname || "").toLowerCase();
    return host === "app.caribvision.tv";
  }

  function isCbcLiveTopPage() {
    const host = (window.location.hostname || "").toLowerCase();
    if (host !== "cbc.bb" && host !== "www.cbc.bb") return false;
    const path = (window.location.pathname || "").toLowerCase();
    return path === "/live" || path === "/live/";
  }

  function emitCbcLiveHlsReady(reason) {
    if (!isCbcLiveTopPage()) return false;
    try {
      const player = document.querySelector('video-js[id^="videojs"]');
      if (!player) return false;
      const source = player.querySelector('source[type="application/x-mpegURL" i]');
      if (!source) return false;
      const sourceUrl = String(source.getAttribute("src") || source.src || "").trim();
      if (!sourceUrl) return false;
      promptPayload({
        type: "cbc-live-hls-ready",
        phase: "content-cbc-live-hls-ready",
        pageUrl: window.location.href,
        reason: String(reason || "videojs-source"),
        playerId: String(player.getAttribute("id") || ""),
        sourceUrl,
        sourceType: String(source.getAttribute("type") || ""),
        autoplay: !!(player.autoplay || player.hasAttribute("autoplay")),
        controls: !!(player.controls || player.hasAttribute("controls")),
        playsinline: !!(player.playsInline || player.hasAttribute("playsinline"))
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  function scheduleCbcLiveHlsReady() {
    if (!isCbcLiveTopPage()) return;
    [400, 1200, 2600, 5000].forEach((delayMs) => {
      setTimeout(() => emitCbcLiveHlsReady("scheduled-" + delayMs), delayMs);
    });
  }

  function emitCaribVisionLiveHlsReady(reason) {
    if (!isCaribVisionAppPage()) return false;
    try {
      const player = document.querySelector("video#live-stream-player");
      if (!player) return false;
      const source = player.querySelector('source[type="application/x-mpegURL" i]');
      if (!source) return false;
      const sourceUrl = String(source.getAttribute("src") || source.src || "").trim();
      if (!sourceUrl) return false;
      promptPayload({
        type: "caribvision-live-hls-ready",
        phase: "content-caribvision-live-hls-ready",
        pageUrl: window.location.href,
        reason: String(reason || "videojs-source"),
        playerId: "live-stream-player",
        sourceUrl,
        sourceType: String(source.getAttribute("type") || ""),
        muted: !!player.muted,
        autoplay: !!player.autoplay
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  function scheduleCaribVisionLiveHlsReady() {
    if (!isCaribVisionAppPage()) return;
    [400, 1200, 2600, 5000].forEach((delayMs) => {
      setTimeout(() => emitCaribVisionLiveHlsReady("scheduled-" + delayMs), delayMs);
    });
  }

  function isExactCaribVisionLiveHlsUrl(rawUrl) {
    try {
      const url = new URL(String(rawUrl || ""), window.location.href);
      return url.hostname.toLowerCase() === CARIBVISION_OFFICIAL_HLS_HOST &&
        url.pathname === CARIBVISION_OFFICIAL_HLS_PATH;
    } catch (_) {
      return false;
    }
  }

  function isCaribVisionAuthPath() {
    if (!isCaribVisionAppPage()) return false;
    const path = (window.location.pathname || "").toLowerCase();
    return path.indexOf("/login") >= 0 ||
      path.indexOf("/signin") >= 0 ||
      path.indexOf("/signup") >= 0 ||
      path.indexOf("/signup_free") >= 0 ||
      path.indexOf("/register") >= 0 ||
      path.indexOf("/account") >= 0;
  }

  function findVisibleCaribVisionPasswordInput() {
    if (!isCaribVisionAppPage()) return null;
    return Array.from(document.querySelectorAll("input")).find((node) => {
      try {
        if (!isVisible(node)) return false;
        const type = String(node.getAttribute("type") || "").toLowerCase();
        const name = String(node.getAttribute("name") || "").toLowerCase();
        const autocomplete = String(node.getAttribute("autocomplete") || "").toLowerCase();
        return type === "password" ||
          name.indexOf("password") >= 0 ||
          autocomplete.indexOf("password") >= 0;
      } catch (_) {
        return false;
      }
    }) || null;
  }

  function hasVisibleCaribVisionAuthAction() {
    if (!isCaribVisionAppPage()) return false;
    const authTerms = [
      "sign in",
      "signin",
      "login",
      "log in",
      "create account",
      "register",
      "forgot password"
    ];
    return Array.from(document.querySelectorAll("button,[role='button'],a,label,h1,h2,h3,p,span,div")).some((node) => {
      try {
        if (!isVisible(node)) return false;
        const rect = node.getBoundingClientRect();
        if (rect.width < 20 || rect.height < 12) return false;
        const text = String(node.innerText || node.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
        if (!text) return false;
        return authTerms.some((term) => text.indexOf(term) >= 0);
      } catch (_) {
        return false;
      }
    });
  }

  function findCaribVisionExactSource(root) {
    const scope = root || document;
    let nodes = [];
    try {
      nodes = Array.from(scope.querySelectorAll('source[type="application/x-mpegURL" i],source[src*=".m3u8" i]'));
    } catch (_) {
      nodes = [];
    }
    return nodes.find((node) => {
      try {
        const sourceUrl = String(node.getAttribute("src") || node.src || "").trim();
        return isExactCaribVisionLiveHlsUrl(sourceUrl);
      } catch (_) {
        return false;
      }
    }) || null;
  }

  function scoreCaribVisionPlayerCandidate(node) {
    if (!node) return -1;
    try {
      if (!isVisible(node)) return -1;
      const rect = node.getBoundingClientRect();
      if (rect.width < 160 || rect.height < 90) return -1;
      const id = String(node.getAttribute && node.getAttribute("id") || "").toLowerCase();
      const cls = String(node.className || "").toLowerCase();
      let score = rect.width * rect.height;
      if (id.indexOf("live-stream-player") >= 0 || cls.indexOf("live-stream-player") >= 0) {
        score += 2000000;
      }
      if (cls.indexOf("video-js") >= 0 || cls.indexOf("vjs") >= 0) {
        score += 500000;
      }
      if (findCaribVisionExactSource(node)) {
        score += 3000000;
      }
      return score;
    } catch (_) {
      return -1;
    }
  }

  function findCaribVisionPlayerRoot() {
    if (!isCaribVisionAppPage()) return null;
    const candidates = [];
    const pushCandidate = (node) => {
      if (node && candidates.indexOf(node) < 0) {
        candidates.push(node);
      }
    };
    pushCandidate(document.querySelector("video#live-stream-player"));
    pushCandidate(document.querySelector("#live-stream-player_html5_api"));
    pushCandidate(document.querySelector("#live-stream-player"));
    const exactSource = findCaribVisionExactSource(document);
    if (exactSource) {
      pushCandidate(exactSource.parentElement);
      pushCandidate(exactSource.closest("video-js,.video-js,[data-vjs-player],.vjs-player,.player"));
    }
    try {
      Array.from(document.querySelectorAll("video-js,.video-js,[data-vjs-player],.vjs-player,video")).forEach(pushCandidate);
    } catch (_) {}
    let best = null;
    let bestScore = -1;
    candidates.forEach((node) => {
      const score = scoreCaribVisionPlayerCandidate(node);
      if (score > bestScore) {
        best = node;
        bestScore = score;
      }
    });
    return best;
  }

  function collectCaribVisionVideoState(player) {
    const viewportWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1280);
    const viewportHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 720);
    const exactSource = findCaribVisionExactSource(player || document);
    let playerRect = null;
    try {
      playerRect = player && player.getBoundingClientRect ? player.getBoundingClientRect() : null;
    } catch (_) {
      playerRect = null;
    }
    let videos = [];
    try {
      videos = Array.from((player && player.querySelectorAll("video")) || document.querySelectorAll("video"));
    } catch (_) {
      videos = [];
    }
    let bestVideo = null;
    let bestScore = -1;
    videos.forEach((video) => {
      try {
        if (!isVisible(video)) return;
        const rect = video.getBoundingClientRect();
        if (rect.width < 120 || rect.height < 68) return;
        let score = rect.width * rect.height;
        const id = String(video.getAttribute("id") || "").toLowerCase();
        const cls = String(video.className || "").toLowerCase();
        if (id === "live-stream-player" || id === "live-stream-player_html5_api") score += 3000000;
        if (cls.indexOf("vjs-tech") >= 0) score += 1000000;
        if (playerRect && !(rect.right < playerRect.left - 8 || rect.left > playerRect.right + 8 || rect.bottom < playerRect.top - 8 || rect.top > playerRect.bottom + 8)) {
          score += 200000;
        }
        if (score > bestScore) {
          bestVideo = video;
          bestScore = score;
        }
      } catch (_) {}
    });
    let rect = null;
    try {
      rect = bestVideo ? bestVideo.getBoundingClientRect() : playerRect;
    } catch (_) {
      rect = playerRect;
    }
    const centerX = rect ? Math.round(rect.left + Math.max(1, Math.floor(rect.width / 2))) : Math.max(1, Math.floor(viewportWidth / 2));
    const centerY = rect ? Math.round(rect.top + Math.max(1, Math.floor(rect.height / 2))) : Math.max(1, Math.floor(viewportHeight / 2));
    const paused = bestVideo ? !!bestVideo.paused : true;
    const readyState = Number(bestVideo && bestVideo.readyState || 0);
    const currentTime = Number(bestVideo && typeof bestVideo.currentTime === "number" ? bestVideo.currentTime : 0);
    const muted = !!(bestVideo && bestVideo.muted);
    const volume = bestVideo && typeof bestVideo.volume === "number" ? Number(bestVideo.volume) : 1;
    const videoId = String(bestVideo && bestVideo.getAttribute && bestVideo.getAttribute("id") || "").toLowerCase();
    const playerId = String(player && player.getAttribute && player.getAttribute("id") || "").toLowerCase();
    return {
      video: bestVideo,
      hasVideo: !!bestVideo,
      paused,
      readyState,
      currentTime,
      playing: !!bestVideo && !paused && readyState >= 2,
      videoWidth: bestVideo && bestVideo.videoWidth || 0,
      videoHeight: bestVideo && bestVideo.videoHeight || 0,
      muted,
      volume,
      centerX,
      centerY,
      xRatio: parseFloat((centerX / viewportWidth).toFixed(4)),
      yRatio: parseFloat((centerY / viewportHeight).toFixed(4)),
      rectText: rect ? rectAsText(rect) : "",
      playerRectText: playerRect ? rectAsText(playerRect) : "",
      playerLeft: playerRect ? Number(playerRect.left) : -1,
      playerTop: playerRect ? Number(playerRect.top) : -1,
      playerWidth: playerRect ? Number(playerRect.width) : 0,
      playerHeight: playerRect ? Number(playerRect.height) : 0,
      viewportWidth,
      viewportHeight,
      hasExactHls: !!exactSource,
      hasDirectLiveId: videoId === "live-stream-player" || videoId === "live-stream-player_html5_api" || playerId.indexOf("live-stream-player") >= 0
    };
  }

  function attemptCaribVisionPlaybackUnmute(state) {
    const video = state && state.video;
    const methods = [];
    const result = {
      mutedBefore: !!(video && video.muted),
      mutedAfter: !!(video && video.muted),
      volumeBefore: video && typeof video.volume === "number" ? Number(video.volume) : Number((state && state.volume) || 1),
      volumeAfter: video && typeof video.volume === "number" ? Number(video.volume) : Number((state && state.volume) || 1),
      methods: "",
      changed: false
    };
    if (video) {
      try {
        video.defaultMuted = false;
      } catch (_) {}
      try {
        video.muted = false;
      } catch (_) {}
      try {
        if (typeof video.volume === "number" && video.volume < 0.95) {
          video.volume = 1;
        }
      } catch (_) {}
    }
    try {
      readVideoJsPlayers().forEach((player) => {
        safeMethodCall(player, "muted", [false], methods);
        safeMethodCall(player, "volume", [1], methods);
      });
    } catch (_) {}
    result.methods = methods.join(",");
    result.mutedAfter = !!(video && video.muted);
    result.volumeAfter = video && typeof video.volume === "number" ? Number(video.volume) : result.volumeBefore;
    result.changed =
      result.mutedBefore !== result.mutedAfter ||
      Math.abs(result.volumeAfter - result.volumeBefore) > 0.001 ||
      methods.length > 0;
    return result;
  }

  function detectCaribVisionState() {
    if (!isCaribVisionAppPage()) {
      return {
        playerVisible: false,
        loginRequired: false
      };
    }
    const player = findCaribVisionPlayerRoot();
    const videoState = collectCaribVisionVideoState(player);
    const authPath = isCaribVisionAuthPath();
    const hasPasswordField = !!findVisibleCaribVisionPasswordInput();
    const hasAuthAction = hasVisibleCaribVisionAuthAction();
    const authSignals = authPath || hasPasswordField || hasAuthAction;
    const playerVisible = !!player && (videoState.hasExactHls || (videoState.hasDirectLiveId && !authSignals));
    const loginRequired = !playerVisible && authSignals;
    return {
      player,
      videoState,
      playerVisible,
      loginRequired,
      reason: playerVisible ? "player-visible" : (loginRequired ? "login-wall" : "no-clear-signal")
    };
  }

  function emitCaribVisionSessionState(reason) {
    const detected = detectCaribVisionState();
    if (!detected.playerVisible && !detected.loginRequired) return false;
    if (detected.loginRequired || !detected.playerVisible) {
      caribvisionAudioDomClickDone = false;
      caribvisionFullscreenDomClickDone = false;
      caribvisionPlayAssistLastKey = "";
      caribvisionFullscreenAssistLastKey = "";
    }
    const key = [
      detected.playerVisible ? "player" : "not-player",
      detected.loginRequired ? "login" : "not-login",
      detected.reason,
      window.location.href
    ].join(":");
    if (key === caribvisionSessionStateLastKey) return true;
    caribvisionSessionStateLastKey = key;
    promptPayload({
      type: "caribvision-session-state",
      phase: "content-caribvision-session-state",
      pageUrl: window.location.href,
      playerVisible: detected.playerVisible,
      loginRequired: detected.loginRequired,
      reason: String(reason || detected.reason),
      stateReason: detected.reason,
      playerRect: detected.videoState && detected.videoState.playerRectText || "",
      videoRect: detected.videoState && detected.videoState.rectText || "",
      hasExactHls: !!(detected.videoState && detected.videoState.hasExactHls),
      hasDirectLiveId: !!(detected.videoState && detected.videoState.hasDirectLiveId)
    });
    return true;
  }

  function isCaribVisionFullscreenAssistSuppressed() {
    try {
      const suppressedUrl = String(window.__kfCaribvisionFullscreenAssistSuppressedUrl || "");
      return !!suppressedUrl && suppressedUrl === window.location.href;
    } catch (_) {
      return false;
    }
  }

  function findCaribVisionPlayControl(player) {
    if (!player) return null;
    const selectors = [
      ".vjs-big-play-button",
      ".vjs-play-control",
      ".vjs-play-button",
      "button",
      "[role='button']",
      "a",
      "div",
      "span"
    ];
    const seen = new Set();
    let best = null;
    let bestScore = -1;
    selectors.forEach((selector) => {
      let nodes = [];
      try {
        nodes = Array.from(player.querySelectorAll(selector));
      } catch (_) {
        nodes = [];
      }
      nodes.forEach((node) => {
        if (!node || seen.has(node)) return;
        seen.add(node);
        try {
          if (!isVisible(node)) return;
          const rect = node.getBoundingClientRect();
          if (rect.width < 18 || rect.height < 18) return;
          const cls = String(node.className || "").toLowerCase();
          const aria = String(node.getAttribute && node.getAttribute("aria-label") || "").toLowerCase();
          const title = String(node.getAttribute && node.getAttribute("title") || "").toLowerCase();
          const text = String(node.innerText || node.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
          const blob = `${cls} ${aria} ${title} ${text}`;
          if (blob.indexOf("pause") >= 0) return;
          if (blob.indexOf("fullscreen") >= 0 || blob.indexOf("full screen") >= 0) return;
          if (blob.indexOf("volume") >= 0 || blob.indexOf("mute") >= 0 || blob.indexOf("unmute") >= 0) return;
          if (blob.indexOf("play") < 0 && cls.indexOf("vjs-play") < 0) return;
          let score = rect.width * rect.height;
          if (cls.indexOf("vjs-big-play-button") >= 0) score += 2000000;
          if (cls.indexOf("vjs-play-control") >= 0) score += 1000000;
          if (score > bestScore) {
            best = node;
            bestScore = score;
          }
        } catch (_) {}
      });
    });
    return best;
  }

  function isCaribVisionFullscreenActive(player) {
    if (!player) return false;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
        return true;
      }
    } catch (_) {}
    try {
      const cls = String(player.className || "").toLowerCase();
      return cls.indexOf("vjs-fullscreen") >= 0 || cls.indexOf("fullscreen") >= 0;
    } catch (_) {
      return false;
    }
  }

  function findCaribVisionFullscreenControl(player) {
    if (!player) return null;
    let playerRect = null;
    try {
      playerRect = player.getBoundingClientRect();
    } catch (_) {}
    let best = null;
    let bestScore = -1;
    const seen = [];
    const roots = [player, document];
    roots.forEach((root) => {
      try {
        Array.from(root.querySelectorAll(".vjs-fullscreen-control,button,[role='button'],a,div,span")).forEach((node) => {
          try {
            if (!node || seen.indexOf(node) >= 0) return;
            seen.push(node);
            const cls = String(node.className || "").toLowerCase();
            const aria = String(node.getAttribute && node.getAttribute("aria-label") || "").toLowerCase();
            const title = String(node.getAttribute && node.getAttribute("title") || "").toLowerCase();
            const text = String(node.innerText || node.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
            const blob = `${cls} ${aria} ${title} ${text}`;
            const semantic = blob.indexOf("fullscreen") >= 0 || blob.indexOf("full screen") >= 0 || cls.indexOf("vjs-fullscreen-control") >= 0;
            if (!semantic) return;
            if (blob.indexOf("exit fullscreen") >= 0 || blob.indexOf("exit full screen") >= 0) return;
            const visible = isVisible(node);
            if (!visible && cls.indexOf("vjs-fullscreen-control") < 0) return;
            const rect = node.getBoundingClientRect();
            if (rect.width < 14 || rect.height < 14) return;
            if (
              playerRect &&
              (
                rect.bottom < playerRect.top - 220 ||
                rect.top > playerRect.bottom + 220 ||
                rect.right < playerRect.left - 220 ||
                rect.left > playerRect.right + 220
              )
            ) {
              return;
            }
            let score = rect.width * rect.height;
            if (cls.indexOf("vjs-fullscreen-control") >= 0) score += 2200000;
            if (title.indexOf("fullscreen") >= 0 || aria.indexOf("fullscreen") >= 0 || text.indexOf("fullscreen") >= 0 || text.indexOf("full screen") >= 0) {
              score += 300000;
            }
            if (playerRect) {
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              const insidePlayer = centerX >= playerRect.left - 6 && centerX <= playerRect.right + 6 && centerY >= playerRect.top - 6 && centerY <= playerRect.bottom + 6;
              if (insidePlayer) score += 140000;
              const nearTopLeft = Math.abs(rect.left - playerRect.left) <= 180 && Math.abs(rect.top - playerRect.top) <= 130;
              if (nearTopLeft) score += 1200000;
              const nearBottomRight = Math.abs(rect.right - playerRect.right) <= 180 && Math.abs(rect.bottom - playerRect.bottom) <= 130;
              if (nearBottomRight) score += 450000;
            }
            if (score > bestScore) {
              best = node;
              bestScore = score;
            }
          } catch (_) {}
        });
      } catch (_) {}
    });
    return best;
  }

  function findCaribVisionAudioControl(player) {
    if (!player) return null;
    let playerRect = null;
    try {
      playerRect = player.getBoundingClientRect();
    } catch (_) {}
    let best = null;
    let bestScore = -1;
    const seen = [];
    const roots = [player, document];
    roots.forEach((root) => {
      try {
        Array.from(root.querySelectorAll(".vjs-mute-control,.vjs-volume-menu-button,button,[role='button'],a,div,span")).forEach((node) => {
          try {
            if (!node || seen.indexOf(node) >= 0) return;
            seen.push(node);
            if (!isVisible(node)) return;
            const rect = node.getBoundingClientRect();
            if (rect.width < 14 || rect.height < 14) return;
            if (
              playerRect &&
              (
                rect.bottom < playerRect.top - 220 ||
                rect.top > playerRect.bottom + 220 ||
                rect.right < playerRect.left - 220 ||
                rect.left > playerRect.right + 220
              )
            ) {
              return;
            }
            const cls = String(node.className || "").toLowerCase();
            const aria = String(node.getAttribute && node.getAttribute("aria-label") || "").toLowerCase();
            const title = String(node.getAttribute && node.getAttribute("title") || "").toLowerCase();
            const text = String(node.innerText || node.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
            const blob = `${cls} ${aria} ${title} ${text}`;
            const semantic = blob.indexOf("unmute") >= 0 || blob.indexOf("mute") >= 0 || blob.indexOf("volume") >= 0 || cls.indexOf("vjs-mute-control") >= 0 || cls.indexOf("vjs-volume-menu-button") >= 0;
            if (!semantic) return;
            let score = rect.width * rect.height;
            if (blob.indexOf("unmute") >= 0) score += 1800000;
            if (cls.indexOf("vjs-mute-control") >= 0) score += 1400000;
            if (cls.indexOf("vjs-volume-menu-button") >= 0) score += 900000;
            if (blob.indexOf("mute") >= 0 || blob.indexOf("volume") >= 0) score += 200000;
            if (playerRect) {
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              const insidePlayer = centerX >= playerRect.left - 6 && centerX <= playerRect.right + 6 && centerY >= playerRect.top - 6 && centerY <= playerRect.bottom + 6;
              if (insidePlayer) score += 140000;
              const nearBottom = Math.abs(rect.bottom - playerRect.bottom) <= 140;
              if (nearBottom) score += 300000;
            }
            if (score > bestScore) {
              best = node;
              bestScore = score;
            }
          } catch (_) {}
        });
      } catch (_) {}
    });
    return best;
  }

  function clickCaribVisionControlNode(node) {
    if (!node) return false;
    try {
      node.click();
      return true;
    } catch (_) {}
    try {
      const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
      return !!node.dispatchEvent(ev);
    } catch (_) {}
    return false;
  }

  function emitCaribVisionPlayAssist(reason, attemptAtMs) {
    const detected = detectCaribVisionState();
    if (!detected.playerVisible || !detected.player) return false;
    let state = detected.videoState;
    const unmute = attemptCaribVisionPlaybackUnmute(state);
    state = collectCaribVisionVideoState(detected.player);
    let target = findCaribVisionPlayControl(detected.player);
    let targetKind = "caribvision-play-control";
    if (!target && state.video) {
      target = state.video;
      targetKind = "caribvision-video";
    }
    if (!target) {
      target = detected.player;
      targetKind = "caribvision-player";
    }
    let rect;
    try {
      rect = target.getBoundingClientRect();
    } catch (_) {
      return false;
    }
    const centerX = Math.round(rect.left + Math.max(1, Math.floor(rect.width / 2)));
    const centerY = Math.round(rect.top + Math.max(1, Math.floor(rect.height / 2)));
    const active = !state.playing;
    const reasonText = active
      ? (targetKind === "caribvision-play-control" ? "player-paused-play-control" : "player-paused")
      : "playing";
    const key = [
      active ? "active" : "idle",
      reasonText,
      targetKind,
      centerX,
      centerY,
      detected.videoState.playerRectText
    ].join(":");
    if (key === caribvisionPlayAssistLastKey) return true;
    caribvisionPlayAssistLastKey = key;
    promptPayload({
      type: "caribvision-play-assist",
      phase: "content-caribvision-play-assist",
      pageUrl: window.location.href,
      active,
      requiresUserAction: active,
      reason: String(reason || reasonText),
      assistReason: reasonText,
      attemptAtMs: numberOrZero(attemptAtMs),
      centerX,
      centerY,
      xRatio: centerX / detected.videoState.viewportWidth,
      yRatio: centerY / detected.videoState.viewportHeight,
      rect: rectAsText(rect),
      playerRect: detected.videoState.playerRectText,
      targetKind,
      targetLabel: summarizeNode(target),
      viewportWidth: detected.videoState.viewportWidth,
      viewportHeight: detected.videoState.viewportHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      hasVideo: state.hasVideo,
      paused: state.paused,
      playing: state.playing,
      muted: !!state.muted,
      volume: Number(state.volume || 1),
      mutedBefore: !!unmute.mutedBefore,
      mutedAfter: !!unmute.mutedAfter,
      volumeBefore: Number(unmute.volumeBefore || 1),
      volumeAfter: Number(unmute.volumeAfter || 1),
      unmuteMethods: unmute.methods,
      readyState: state.readyState,
      currentTime: state.currentTime,
      videoWidth: state.videoWidth,
      videoHeight: state.videoHeight
    });
    return true;
  }

  function emitCaribVisionFullscreenAssist(reason, attemptAtMs) {
    const detected = detectCaribVisionState();
    if (!detected.playerVisible || !detected.player) return false;
    let state = detected.videoState;
    attemptCaribVisionPlaybackUnmute(state);
    state = collectCaribVisionVideoState(detected.player);
    const suppressedAfterBack = isCaribVisionFullscreenAssistSuppressed();
    const fullscreenActive = isCaribVisionFullscreenActive(detected.player);
    const control = findCaribVisionFullscreenControl(detected.player);
    const audioControl = findCaribVisionAudioControl(detected.player);
    let audioDomClicked = false;
    let fullscreenDomClicked = false;
    let rect = null;
    let targetKind = "none";
    let targetLabel = "none";
    let audioRect = null;
    let audioTargetKind = "none";
    let audioTargetLabel = "none";
    if (control) {
      try {
        rect = control.getBoundingClientRect();
      } catch (_) {
        rect = null;
      }
      targetKind = "caribvision-fullscreen-control";
      targetLabel = summarizeNode(control);
    }
    if (audioControl) {
      try {
        audioRect = audioControl.getBoundingClientRect();
      } catch (_) {
        audioRect = null;
      }
      audioTargetKind = "caribvision-audio-control";
      audioTargetLabel = summarizeNode(audioControl);
      if (!caribvisionAudioDomClickDone) {
        audioDomClicked = clickCaribVisionControlNode(audioControl);
        if (audioDomClicked) caribvisionAudioDomClickDone = true;
      }
    }
    if (!audioRect && state.playerWidth >= 220 && state.playerHeight >= 120) {
      const width = Math.max(34, Math.min(56, Math.round(state.playerWidth * 0.043)));
      const height = Math.max(26, Math.min(44, Math.round(state.playerHeight * 0.08)));
      const insetLeft = Math.max(30, Math.min(58, Math.round(state.playerWidth * 0.03)));
      const insetBottom = Math.max(6, Math.min(18, Math.round(state.playerHeight * 0.015)));
      const left = state.playerLeft + insetLeft;
      const top = state.playerTop + state.playerHeight - insetBottom - height;
      audioRect = {
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height
      };
      audioTargetKind = "caribvision-audio-fallback";
      audioTargetLabel = "player-bottom-left-audio-fallback";
    }
    if (!rect && state.playerWidth >= 220 && state.playerHeight >= 120) {
      const width = Math.max(34, Math.min(56, Math.round(state.playerWidth * 0.043)));
      const height = Math.max(26, Math.min(44, Math.round(state.playerHeight * 0.08)));
      const insetRight = Math.max(8, Math.min(22, Math.round(state.playerWidth * 0.012)));
      const insetBottom = Math.max(6, Math.min(18, Math.round(state.playerHeight * 0.015)));
      const left = state.playerLeft + state.playerWidth - insetRight - width;
      const top = state.playerTop + state.playerHeight - insetBottom - height;
      rect = {
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height
      };
      targetKind = "caribvision-fullscreen-fallback";
      targetLabel = "player-bottom-right-fallback";
    }
    if (!suppressedAfterBack && control && !caribvisionFullscreenDomClickDone) {
      fullscreenDomClicked = clickCaribVisionControlNode(control);
      if (fullscreenDomClicked) caribvisionFullscreenDomClickDone = true;
    }
    const centerX = rect ? Math.round(rect.left + Math.max(1, Math.floor(rect.width / 2))) : -1;
    const centerY = rect ? Math.round(rect.top + Math.max(1, Math.floor(rect.height / 2))) : -1;
    const audioCenterX = audioRect ? Math.round(audioRect.left + Math.max(1, Math.floor(audioRect.width / 2))) : -1;
    const audioCenterY = audioRect ? Math.round(audioRect.top + Math.max(1, Math.floor(audioRect.height / 2))) : -1;
    const hasTarget = !!rect;
    const playbackPrimed = !!(state.playing || state.currentTime > 0.2 || (!state.paused && state.readyState >= 1));
    const audioPrimed = !!(!state.muted && Number(state.volume || 0) > 0.01);
    const active = !!(!suppressedAfterBack && !fullscreenActive && hasTarget && !fullscreenDomClicked);
    const reasonText = suppressedAfterBack
      ? "suppressed-after-back"
      : fullscreenActive
      ? "already-fullscreen"
      : control
        ? (state.playing ? "fullscreen-ready" : "fullscreen-control-visible")
        : hasTarget
          ? "fullscreen-fallback"
        : "fullscreen-control-missing";
    const key = [
      active ? "active" : "idle",
      reasonText,
      centerX,
      centerY,
      detected.videoState.playerRectText
    ].join(":");
    if (key === caribvisionFullscreenAssistLastKey) return true;
    caribvisionFullscreenAssistLastKey = key;
    promptPayload({
      type: "caribvision-fullscreen-assist",
      phase: "content-caribvision-fullscreen-assist",
      pageUrl: window.location.href,
      active,
      requestNativeTap: !!active,
      reason: String(reason || reasonText),
      assistReason: reasonText,
      attemptAtMs: numberOrZero(attemptAtMs),
      centerX,
      centerY,
      xRatio: centerX >= 0 ? centerX / detected.videoState.viewportWidth : -1,
      yRatio: centerY >= 0 ? centerY / detected.videoState.viewportHeight : -1,
      audioCenterX,
      audioCenterY,
      audioXRatio: audioCenterX >= 0 ? audioCenterX / detected.videoState.viewportWidth : -1,
      audioYRatio: audioCenterY >= 0 ? audioCenterY / detected.videoState.viewportHeight : -1,
      rect: rect ? rectAsText(rect) : "none",
      audioRect: audioRect ? rectAsText(audioRect) : "none",
      playerRect: detected.videoState.playerRectText,
      targetKind,
      targetLabel,
      audioTargetKind,
      audioTargetLabel,
      audioDomClicked,
      fullscreenDomClicked,
      suppressedAfterBack,
      viewportWidth: detected.videoState.viewportWidth,
      viewportHeight: detected.videoState.viewportHeight,
      fullscreenActive,
      playing: state.playing,
      paused: state.paused,
      muted: !!state.muted,
      volume: Number(state.volume || 1),
      playbackPrimed,
      audioPrimed,
      readyState: state.readyState,
      currentTime: state.currentTime
    });
    return true;
  }

  function scheduleCaribVisionPlayAssist() {
    if (caribvisionPlayAssistScheduled || !isCaribVisionAppPage()) return;
    caribvisionPlayAssistScheduled = true;
    CARIBVISION_PLAY_ASSIST_DELAYS_MS.forEach((delayMs) => {
      setTimeout(() => emitCaribVisionPlayAssist("scheduled-" + delayMs, delayMs), delayMs);
    });
  }

  function scheduleCaribVisionFullscreenAssist() {
    if (caribvisionFullscreenAssistScheduled || !isCaribVisionAppPage()) return;
    caribvisionFullscreenAssistScheduled = true;
    CARIBVISION_FULLSCREEN_ASSIST_DELAYS_MS.forEach((delayMs) => {
      setTimeout(() => emitCaribVisionFullscreenAssist("scheduled-" + delayMs, delayMs), delayMs);
    });
  }

  function findCgtvBradmaxIframe() {
    if (!isCgtvWatchTopPage()) return null;
    const frames = Array.from(document.querySelectorAll("iframe[src]"));
    let best = null;
    let bestScore = -1;
    frames.forEach((frame) => {
      try {
        const src = String(frame.getAttribute("src") || frame.src || "").toLowerCase();
        if (src.indexOf("bradm.ax") < 0) return;
        if (!isVisible(frame)) return;
        const rect = frame.getBoundingClientRect();
        if (rect.width < 120 || rect.height < 80) return;
        const score = rect.width * rect.height;
        if (score > bestScore) {
          best = frame;
          bestScore = score;
        }
      } catch (_) {}
    });
    return best;
  }

  function parseChtvDataItem(player) {
    if (!player || !player.getAttribute) return null;
    try {
      const raw = String(player.getAttribute("data-item") || "").trim();
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function isChtvLiveFlowplayer(player) {
    if (!player) return false;
    try {
      const cls = String(player.className || "").toLowerCase();
      if (cls.indexOf("flowplayer") < 0) return false;
      if (cls.indexOf("is-youtube") >= 0) return false;
      const liveAttr = String(player.getAttribute && player.getAttribute("data-live") || "").toLowerCase();
      if (liveAttr === "true" || liveAttr === "1") return true;
      const dataItem = parseChtvDataItem(player);
      const sources = Array.isArray(dataItem && dataItem.sources) ? dataItem.sources : [];
      return sources.some((source) => {
        const src = String(source && source.src || "").toLowerCase();
        const type = String(source && source.type || "").toLowerCase();
        return src.indexOf(".m3u8") >= 0 || type.indexOf("mpegurl") >= 0;
      });
    } catch (_) {
      return false;
    }
  }

  function isChtvFullscreenAssistSuppressed() {
    try {
      const suppressedUrl = String(window.__kfChtvFullscreenAssistSuppressedUrl || "");
      return !!suppressedUrl && suppressedUrl === window.location.href;
    } catch (_) {
      return false;
    }
  }

  function findChtvLiveFlowplayer() {
    if (!isChtvTopPage()) return null;
    const players = Array.from(document.querySelectorAll(".flowplayer"));
    let best = null;
    let bestScore = -1;
    players.forEach((player) => {
      try {
        if (!isChtvLiveFlowplayer(player)) return;
        if (!isVisible(player)) return;
        const rect = player.getBoundingClientRect();
        if (rect.width < 160 || rect.height < 100) return;
        const score = rect.width * rect.height;
        if (score > bestScore) {
          best = player;
          bestScore = score;
        }
      } catch (_) {}
    });
    return best;
  }

  function collectChtvVideoState(player) {
    const videos = Array.from((player && player.querySelectorAll("video")) || []);
    const video = videos.find((node) => {
      try {
        const rect = node.getBoundingClientRect();
        return rect.width > 32 && rect.height > 32;
      } catch (_) {
        return false;
      }
    }) || null;
    const readyState = Number(video && video.readyState || 0);
    const paused = video ? !!video.paused : true;
    const currentTime = Number(video && typeof video.currentTime === "number" ? video.currentTime : 0);
    const playing = !!video && !paused && readyState >= 2;
    return {
      video,
      hasVideo: !!video,
      readyState,
      paused,
      currentTime,
      playing
    };
  }

  function findChtvPlayControl(player) {
    if (!player) return null;
    const direct = Array.from(player.querySelectorAll(".fp-play.fp-visible,.fp-play,.fp-ui .fp-play")).find((node) => {
      try {
        if (!isVisible(node)) return false;
        const rect = node.getBoundingClientRect();
        return rect.width >= 20 && rect.height >= 20;
      } catch (_) {
        return false;
      }
    });
    if (direct) return direct;
    return Array.from(player.querySelectorAll("button,[role='button'],a,div")).find((node) => {
      try {
        if (!isVisible(node)) return false;
        const rect = node.getBoundingClientRect();
        if (rect.width < 20 || rect.height < 20) return false;
        const cls = String(node.className || "").toLowerCase();
        const aria = String(node.getAttribute && node.getAttribute("aria-label") || "").toLowerCase();
        const title = String(node.getAttribute && node.getAttribute("title") || "").toLowerCase();
        const text = String(node.innerText || node.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
        const blob = `${cls} ${aria} ${title} ${text}`;
        if (blob.indexOf("pause") >= 0) return false;
        if (blob.indexOf("fullscreen") >= 0 || blob.indexOf("full screen") >= 0) return false;
        if (blob.indexOf("volume") >= 0 || blob.indexOf("mute") >= 0) return false;
        if (blob.indexOf("youtube") >= 0) return false;
        return blob.indexOf("play") >= 0 || cls.indexOf("fp-play") >= 0;
      } catch (_) {
        return false;
      }
    }) || null;
  }

  function isChtvFullscreenActive(player) {
    if (!player) return false;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
        return true;
      }
    } catch (_) {}
    try {
      const cls = String(player.className || "").toLowerCase();
      return cls.indexOf("is-fullscreen") >= 0 || cls.indexOf("fake-fullscreen") >= 0 || cls.indexOf("forced-fullscreen") >= 0;
    } catch (_) {
      return false;
    }
  }

  function findChtvFullscreenControl(player) {
    if (!player) return null;
    let playerRect = null;
    try {
      playerRect = player.getBoundingClientRect();
    } catch (_) {}
    let best = null;
    let bestScore = -1;
    Array.from(player.querySelectorAll(".fp-fullscreen,.fp-header .fp-fullscreen,button,[role='button'],a,div,span")).forEach((node) => {
      try {
        if (!isVisible(node)) return;
        const rect = node.getBoundingClientRect();
        if (rect.width < 18 || rect.height < 18) return;
        if (playerRect && (rect.bottom < playerRect.top - 8 || rect.top > playerRect.bottom + 8 || rect.right < playerRect.left - 8 || rect.left > playerRect.right + 8)) {
          return;
        }
        const cls = String(node.className || "").toLowerCase();
        const aria = String(node.getAttribute && node.getAttribute("aria-label") || "").toLowerCase();
        const title = String(node.getAttribute && node.getAttribute("title") || "").toLowerCase();
        const text = String(node.innerText || node.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
        const blob = `${cls} ${aria} ${title} ${text}`;
        if (blob.indexOf("fullscreen") < 0 && blob.indexOf("full screen") < 0 && cls.indexOf("fp-fullscreen") < 0) return;
        if (blob.indexOf("exit fullscreen") >= 0 || blob.indexOf("exit full screen") >= 0) return;
        const exact = cls.indexOf("fp-fullscreen") >= 0 ? 500 : 0;
        const topBias = playerRect ? Math.max(0, Math.round(playerRect.bottom - rect.bottom)) : 0;
        const score = exact + topBias + Math.round(rect.width + rect.height);
        if (score > bestScore) {
          best = node;
          bestScore = score;
        }
      } catch (_) {}
    });
    return best;
  }

  function emitChtvFullscreenAssist(reason, attemptAtMs) {
    if (!isChtvTopPage()) return false;
    const player = findChtvLiveFlowplayer();
    if (!player) return false;
    const state = collectChtvVideoState(player);
    const fullscreenActiveBefore = isChtvFullscreenActive(player);
    const suppressedAfterBack = isChtvFullscreenAssistSuppressed();
    let playerRect;
    try {
      playerRect = player.getBoundingClientRect();
    } catch (_) {
      return false;
    }
    const methods = [];
    if (state.playing && !fullscreenActiveBefore) {
      dispatchMousePointerSequence(player, playerRect, methods);
    }
    const control = findChtvFullscreenControl(player);
    let rect = null;
    if (control) {
      try {
        rect = control.getBoundingClientRect();
      } catch (_) {
        rect = null;
      }
    }
    const viewportWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1280);
    const viewportHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 720);
    const centerX = rect ? Math.round(rect.left + Math.max(1, Math.floor(rect.width / 2))) : -1;
    const centerY = rect ? Math.round(rect.top + Math.max(1, Math.floor(rect.height / 2))) : -1;
    const active = !!(state.playing && !fullscreenActiveBefore && control && !suppressedAfterBack);
    let clicked = false;
    if (active && chtvFullscreenAssistClickCount < 2) {
      clicked = clickNodeIfPossible(control);
      if (!clicked && rect) {
        clicked = dispatchMousePointerSequence(control, rect, methods);
      }
      if (clicked) {
        chtvFullscreenAssistClickCount += 1;
      }
    }
    const fullscreenActiveAfter = isChtvFullscreenActive(player);
    const reasonText =
      fullscreenActiveAfter ? "already-fullscreen" :
      suppressedAfterBack ? "suppressed-after-back" :
      !state.playing ? "not-playing" :
      control ? (clicked ? "playing-fullscreen-clicked" : "playing-fullscreen-ready") :
      "fullscreen-control-missing";
    const key = [
      active ? "active" : "idle",
      reasonText,
      clicked ? "clicked" : "not-clicked",
      fullscreenActiveBefore ? "before-fs" : "before-windowed",
      fullscreenActiveAfter ? "after-fs" : "after-windowed",
      Math.round(centerX),
      Math.round(centerY),
      Math.round(playerRect.top),
      Math.round(playerRect.width),
      Math.round(playerRect.height)
    ].join(":");
    if (key === chtvFullscreenAssistLastKey) return true;
    chtvFullscreenAssistLastKey = key;
    promptPayload({
      type: "chtv-fullscreen-assist",
      phase: "content-chtv-fullscreen-assist",
      pageUrl: window.location.href,
      active,
      clicked,
      requestNativeFallback: !!(active && !clicked && control),
      reason: String(reason || reasonText),
      assistReason: reasonText,
      attemptAtMs: numberOrZero(attemptAtMs),
      centerX,
      centerY,
      xRatio: centerX >= 0 ? centerX / viewportWidth : -1,
      yRatio: centerY >= 0 ? centerY / viewportHeight : -1,
      rect: rect ? `${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}` : "none",
      playerRect: `${Math.round(playerRect.left)},${Math.round(playerRect.top)} ${Math.round(playerRect.width)}x${Math.round(playerRect.height)}`,
      targetKind: control ? "flowplayer-fullscreen-control" : "none",
      targetSummary: control ? summarizeNode(control) : "none",
      viewportWidth,
      viewportHeight,
      fullscreenActiveBefore,
      fullscreenActiveAfter,
      methods: methods.join(","),
      playing: state.playing,
      paused: state.paused,
      readyState: state.readyState,
      currentTime: state.currentTime
    });
    return true;
  }

  function emitChtvPlayAssist(reason, attemptAtMs) {
    if (!isChtvTopPage()) return false;
    const player = findChtvLiveFlowplayer();
    if (!player) return false;
    try {
      const initialRect = player.getBoundingClientRect();
      const currentScrollY = window.scrollY || window.pageYOffset || 0;
      if (Math.abs(initialRect.top) > 6) {
        const targetScrollY = Math.max(0, Math.round(currentScrollY + initialRect.top));
        window.scrollTo(0, targetScrollY);
      }
    } catch (_) {}
    let playerRect;
    try {
      playerRect = player.getBoundingClientRect();
    } catch (_) {
      return false;
    }
    const state = collectChtvVideoState(player);
    let target = findChtvPlayControl(player);
    let targetKind = "flowplayer-play-control";
    if (!target && state.video) {
      target = state.video;
      targetKind = "flowplayer-video";
    }
    if (!target) {
      target = player;
      targetKind = "flowplayer-container";
    }
    let rect;
    try {
      rect = target.getBoundingClientRect();
    } catch (_) {
      return false;
    }
    const viewportWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1280);
    const viewportHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 720);
    const centerX = Math.round(rect.left + Math.max(1, Math.floor(rect.width / 2)));
    const centerY = Math.round(rect.top + Math.max(1, Math.floor(rect.height / 2)));
    const active = !state.playing;
    const reasonText = active
      ? (targetKind === "flowplayer-play-control" ? "flowplayer-live-play" : "flowplayer-live-paused")
      : "playing";
    const key = [
      active ? "active" : "idle",
      reasonText,
      targetKind,
      Math.round(centerX),
      Math.round(centerY),
      Math.round(playerRect.top),
      Math.round(playerRect.width),
      Math.round(playerRect.height)
    ].join(":");
    if (key === chtvPlayAssistLastKey) return true;
    chtvPlayAssistLastKey = key;
    promptPayload({
      type: "chtv-play-assist",
      phase: "content-chtv-play-assist",
      pageUrl: window.location.href,
      active,
      requiresUserAction: active,
      reason: String(reason || reasonText),
      assistReason: reasonText,
      attemptAtMs: numberOrZero(attemptAtMs),
      centerX,
      centerY,
      xRatio: centerX / viewportWidth,
      yRatio: centerY / viewportHeight,
      rect: `${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}`,
      playerRect: `${Math.round(playerRect.left)},${Math.round(playerRect.top)} ${Math.round(playerRect.width)}x${Math.round(playerRect.height)}`,
      targetKind,
      targetSummary: summarizeNode(target),
      viewportWidth,
      viewportHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      hasVideo: state.hasVideo,
      paused: state.paused,
      playing: state.playing,
      readyState: state.readyState,
      currentTime: state.currentTime
    });
    return true;
  }

  function scheduleChtvPlayAssist() {
    if (chtvPlayAssistScheduled || !isChtvTopPage()) return;
    chtvPlayAssistScheduled = true;
    CHTV_PLAY_ASSIST_DELAYS_MS.forEach((delayMs) => {
      setTimeout(() => emitChtvPlayAssist("scheduled-" + delayMs, delayMs), delayMs);
    });
  }

  function scheduleChtvFullscreenAssist() {
    if (chtvFullscreenAssistScheduled || !isChtvTopPage()) return;
    chtvFullscreenAssistScheduled = true;
    CHTV_FULLSCREEN_ASSIST_DELAYS_MS.forEach((delayMs) => {
      setTimeout(() => emitChtvFullscreenAssist("scheduled-" + delayMs, delayMs), delayMs);
    });
  }

  function collectCgtvBradmaxVideoState() {
    const vw = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 0);
    const vh = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 0);
    const videos = Array.from(document.querySelectorAll("video"));
    let best = null;
    let bestScore = -1;
    videos.forEach((video) => {
      try {
        const rect = video.getBoundingClientRect();
        const score = (isVisible(video) ? 1000000 : 0) + Math.max(0, rect.width * rect.height);
        if (score > bestScore) {
          best = video;
          bestScore = score;
        }
      } catch (_) {}
    });
    if (!best) {
      return {
        hasVideo: false,
        playing: false,
        paused: true,
        readyState: 0,
        currentTime: 0,
        centerX: Math.max(1, Math.floor(vw / 2)),
        centerY: Math.max(1, Math.floor(vh / 2)),
        xRatio: 0.5,
        yRatio: 0.5,
        videoWidth: 0,
        videoHeight: 0,
        rectText: ""
      };
    }
    const rect = best.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const paused = !!best.paused;
    const currentTime = typeof best.currentTime === "number" ? best.currentTime : 0;
    return {
      hasVideo: true,
      playing: !paused && (best.readyState || 0) >= 1,
      paused,
      readyState: best.readyState || 0,
      currentTime,
      centerX: Math.round(centerX),
      centerY: Math.round(centerY),
      xRatio: parseFloat((vw > 0 ? centerX / vw : 0.5).toFixed(4)),
      yRatio: parseFloat((vh > 0 ? centerY / vh : 0.5).toFixed(4)),
      videoWidth: best.videoWidth || 0,
      videoHeight: best.videoHeight || 0,
      rectText: rectAsText(rect)
    };
  }

  function applyCgtvBradmaxTransportLock(reason) {
    if (!isCgtvBradmaxFrame() || cgtvTransportLockApplied) return false;
    try {
      const style = document.createElement("style");
      style.setAttribute("data-kf-cgtv-transport-lock", "1");
      // Hide obvious UI chrome but do NOT permanently disable pointer events on the video
      // element or hide the cursor. Pointer-events must remain enabled so users can interact
      // with the player after startup.
      style.textContent = [
        ".bmpui-ui-controlbar,.bmpui-ui-titlebar,.bmpui-ui-subtitle-overlay,.bmpui-ui-seekbar,.bmpui-ui-volumeslider,",
        ".bmpui-ui-playbacktogglebutton,.bmpui-ui-fullscreentogglebutton,.bmpui-ui-hugeplaybacktogglebutton,",
        "[class*='controlbar'],[class*='ControlBar'],[class*='seekbar'],[class*='SeekBar'],",
        "[class*='playbacktoggle'],[class*='PlaybackToggle'],[class*='fullscreen'],[class*='Fullscreen']{",
        "opacity:0!important;visibility:hidden!important;pointer-events:none!important;",
        "}"
      ].join("");
      (document.head || document.documentElement || document.body).appendChild(style);
      cgtvTransportLockApplied = true;
      promptPayload({
        type: "cgtv-transport-lock",
        phase: "content-cgtv-transport-lock",
        pageUrl: window.location.href,
        applied: true,
        reason: String(reason || "playing")
      });
      return true;
    } catch (error) {
      promptPayload({
        type: "cgtv-transport-lock",
        phase: "content-cgtv-transport-lock",
        pageUrl: window.location.href,
        applied: false,
        reason: (error && (error.name || error.message)) || "error"
      });
      return false;
    }
  }

  function removeCgtvBradmaxTransportLock(reason) {
    try {
      const existing = document.querySelector('style[data-kf-cgtv-transport-lock]');
      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
      cgtvTransportLockApplied = false;
      promptPayload({
        type: "cgtv-transport-lock",
        phase: "content-cgtv-transport-lock",
        pageUrl: window.location.href,
        applied: false,
        reason: String(reason || "released")
      });
      return true;
    } catch (error) {
      promptPayload({
        type: "cgtv-transport-lock",
        phase: "content-cgtv-transport-lock",
        pageUrl: window.location.href,
        applied: false,
        reason: (error && (error.name || error.message)) || "error"
      });
      return false;
    }
  }

  function findCgtvBradmaxFullscreenControl() {
    if (!isCgtvBradmaxFrame()) return null;
    const selectors = [
      ".bmpui-ui-fullscreentogglebutton",
      "button",
      "[role='button']",
      "[aria-label]",
      "[title]"
    ];
    const seen = new Set();
    let best = null;
    let bestScore = -1;
    selectors.forEach((selector) => {
      let nodes = [];
      try {
        nodes = Array.from(document.querySelectorAll(selector));
      } catch (_) {
        nodes = [];
      }
      nodes.forEach((node) => {
        if (!node || seen.has(node)) return;
        seen.add(node);
        try {
          const rect = node.getBoundingClientRect();
          if (rect.width < 12 || rect.height < 12) return;
          const cls = String(node.className || "").toLowerCase();
          const aria = String(node.getAttribute && node.getAttribute("aria-label") || "").toLowerCase();
          const title = String(node.getAttribute && node.getAttribute("title") || "").toLowerCase();
          const text = String(node.innerText || node.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
          const blob = `${cls} ${aria} ${title} ${text}`;
          if (blob.indexOf("fullscreen") < 0 && blob.indexOf("full screen") < 0) return;
          if (blob.indexOf("exit fullscreen") >= 0 || blob.indexOf("exit full screen") >= 0) return;
          const visibleScore = isVisible(node) ? 1000 : 0;
          const exactScore = cls.indexOf("bmpui-ui-fullscreentogglebutton") >= 0 ? 500 : 0;
          const score = visibleScore + exactScore + Math.round(rect.width * rect.height);
          if (score > bestScore) {
            best = node;
            bestScore = score;
          }
        } catch (_) {}
      });
    });
    return best;
  }

  function maybeTriggerCgtvBradmaxFullscreen(reason, attemptAtMs, state) {
    if (!isCgtvBradmaxFrame() || cgtvFullscreenAssistAttempted) return false;
    if (!state || !state.playing) return false;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
        cgtvFullscreenAssistAttempted = true;
        try { console.info(`KF_CGTV_FULLSCREEN_ASSIST clicked=false reason=already-fullscreen currentTime=${Number(state.currentTime || 0)}`); } catch (_) {}
        promptPayload({
          type: "cgtv-fullscreen-assist",
          phase: "content-cgtv-fullscreen-assist",
          pageUrl: window.location.href,
          clicked: false,
          reason: "already-fullscreen",
          attemptAtMs: numberOrZero(attemptAtMs),
          controlSummary: "none",
          controlRect: "none",
          playing: !!state.playing,
          currentTime: Number(state.currentTime || 0)
        });
        return false;
      }
      const control = findCgtvBradmaxFullscreenControl();
      const controlRect = control ? rectSummary(control) : "none";
      const clicked = clickNodeIfPossible(control);
      if (clicked) {
        cgtvFullscreenAssistAttempted = true;
      }
      try { console.info(`KF_CGTV_FULLSCREEN_ASSIST clicked=${!!clicked} reason=${clicked ? String(reason || "playing-fullscreen-clicked") : "fullscreen-control-not-clicked"} controlRect=${controlRect} currentTime=${Number(state.currentTime || 0)}`); } catch (_) {}
      promptPayload({
        type: "cgtv-fullscreen-assist",
        phase: "content-cgtv-fullscreen-assist",
        pageUrl: window.location.href,
        clicked: !!clicked,
        reason: clicked ? String(reason || "playing-fullscreen-clicked") : "fullscreen-control-not-clicked",
        attemptAtMs: numberOrZero(attemptAtMs),
        controlSummary: control ? summarizeNode(control) : "none",
        controlRect,
        playing: !!state.playing,
        currentTime: Number(state.currentTime || 0)
      });
      return !!clicked;
    } catch (error) {
      try { console.info(`KF_CGTV_FULLSCREEN_ASSIST clicked=false reason=${(error && (error.name || error.message)) || "error"}`); } catch (_) {}
      promptPayload({
        type: "cgtv-fullscreen-assist",
        phase: "content-cgtv-fullscreen-assist",
        pageUrl: window.location.href,
        clicked: false,
        reason: (error && (error.name || error.message)) || "error",
        attemptAtMs: numberOrZero(attemptAtMs),
        controlSummary: "none",
        controlRect: "none",
        playing: !!(state && state.playing),
        currentTime: Number((state && state.currentTime) || 0)
      });
      return false;
    }
  }

  function ensureCgtvBradmaxPlaybackHook(attemptAtMs) {
    if (!isCgtvBradmaxFrame() || cgtvBradmaxPlaybackHookAttached) return false;
    const trigger = (eventName) => {
      setTimeout(() => {
        if (!isCgtvBradmaxFrame()) return;
        const state = collectCgtvBradmaxVideoState();
        maybeTriggerCgtvBradmaxFullscreen(`video-${eventName}-fullscreen-clicked`, attemptAtMs + 300, state);
      }, 300);
    };
    try {
      const playbackListener = (event) => {
        const target = event && event.target;
        if (!target || String(target.tagName || "").toLowerCase() !== "video") return;
        trigger(String(event && event.type || "play"));
      };
      document.addEventListener("play", playbackListener, true);
      document.addEventListener("playing", playbackListener, true);
      cgtvBradmaxPlaybackHookAttached = true;
      try { console.info(`KF_CGTV_FULLSCREEN_HOOK reason=playback-hook-attached currentTime=${Number(collectCgtvBradmaxVideoState().currentTime || 0)}`); } catch (_) {}
      promptPayload({
        type: "cgtv-fullscreen-assist",
        phase: "content-cgtv-fullscreen-assist-hook",
        pageUrl: window.location.href,
        clicked: false,
        reason: "playback-hook-attached",
        attemptAtMs: numberOrZero(attemptAtMs),
        controlSummary: "document-video-play-hook",
        controlRect: "none",
        playing: !!collectCgtvBradmaxVideoState().playing,
        currentTime: Number(collectCgtvBradmaxVideoState().currentTime || 0)
      });
      if (collectCgtvBradmaxVideoState().playing) {
        trigger("already-playing");
      }
      return true;
    } catch (error) {
      promptPayload({
        type: "cgtv-fullscreen-assist",
        phase: "content-cgtv-fullscreen-assist-hook",
        pageUrl: window.location.href,
        clicked: false,
        reason: (error && (error.name || error.message)) || "hook-error",
        attemptAtMs: numberOrZero(attemptAtMs),
        controlSummary: "document-video-play-hook",
        controlRect: "none",
        playing: false,
        currentTime: 0
      });
      return false;
    }
  }

  function scheduleCgtvBradmaxFullscreenPoll(attemptAtMs) {
    if (!isCgtvBradmaxFrame() || cgtvBradmaxFullscreenPollStarted) return false;
    cgtvBradmaxFullscreenPollStarted = true;
    let tick = 0;
    const timer = setInterval(() => {
      tick += 1;
      if (!isCgtvBradmaxFrame() || cgtvFullscreenAssistAttempted || tick > 20) {
        clearInterval(timer);
        return;
      }
      const state = collectCgtvBradmaxVideoState();
      const playingLike = !!state.playing || Number(state.currentTime || 0) > 0.1 || (!!state.hasVideo && Number(state.readyState || 0) >= 2 && !state.paused);
      if (!playingLike) return;
      const clicked = maybeTriggerCgtvBradmaxFullscreen("poll-playing-fullscreen-clicked", attemptAtMs + (tick * 500), state);
      if (clicked || cgtvFullscreenAssistAttempted) {
        clearInterval(timer);
      }
    }, 500);
    return true;
  }

  function emitCgtvPlayAssist(reason, attemptAtMs) {
    // Stability-gated CGTV scroll-align and play-assist. Only emit active=true
    // after a post-scroll stable measurement sequence (two measurements within ~3px).
    if (isCgtvWatchTopPage()) {
      const frame = findCgtvBradmaxIframe();
      if (!frame) return false;

      try {
        const vw = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 0);
        const vh = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 0);

        const measuredTops = [];
        const measureRect = () => {
          try {
            return frame.getBoundingClientRect();
          } catch (_) {
            return null;
          }
        };
        const recordTop = (rect) => {
          const top = rect && typeof rect.top === "number" ? rect.top : NaN;
          if (!Number.isNaN(top)) {
            measuredTops.push(Math.round(top));
          }
          return top;
        };
        const payloadFromRect = (rect, active, msg) => {
          const centerX = rect ? rect.left + rect.width / 2 : Math.max(1, vw / 2);
          const centerY = rect ? rect.top + rect.height / 2 : Math.max(1, vh / 2);
          const xRatio = vw > 0 ? centerX / vw : 0;
          const yRatio = vh > 0 ? centerY / vh : 0;
          return {
            type: "cgtv-play-assist",
            phase: "content-cgtv-play-assist",
            pageUrl: window.location.href,
            active: !!active,
            requiresUserAction: false,
            reason: String(msg || (active ? "aligned-after-scroll" : "waiting-for-scroll-align")),
            attemptAtMs: numberOrZero(attemptAtMs),
            measuredTops: measuredTops.slice(),
            centerX: Math.round(centerX),
            centerY: Math.round(centerY),
            viewportWidth: numberOrZero(vw),
            viewportHeight: numberOrZero(vh),
            xRatio: parseFloat(xRatio.toFixed(4)),
            yRatio: parseFloat(yRatio.toFixed(4)),
            devicePixelRatio: numberOrZero(window.devicePixelRatio || 0),
            rect: rect ? rectAsText(rect) : "0,0 0x0",
            targetKind: "bradmax-iframe",
            targetSummary: summarizeNode(frame),
            hasVideo: false,
            playing: false,
            paused: true,
            readyState: 0,
            currentTime: 0,
            videoWidth: 0,
            videoHeight: 0
          };
        };
        const sendWaitingPayload = (rect, msg) => {
          promptPayload(payloadFromRect(rect, false, msg || "waiting-for-scroll-align"));
        };
        const sendActivePayload = (rect) => {
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const key = ["top", Math.round(centerX), Math.round(centerY), Math.round(rect.width), Math.round(rect.height), reason].join(":");
          if (key === cgtvPlayAssistLastKey) return true;
          cgtvPlayAssistLastKey = key;
          promptPayload(payloadFromRect(rect, true, "aligned-after-scroll"));
          return true;
        };

        const rect0 = measureRect();
        if (!rect0) return false;
        const top0 = recordTop(rect0);

        try {
          const currentScrollY = window.scrollY || window.pageYOffset || 0;
          const targetScrollY = Math.max(0, Math.round(currentScrollY + (Number.isNaN(top0) ? 0 : top0) - CGTV_TOP_OFFSET_PX));
          if (Math.abs(targetScrollY - currentScrollY) >= 1) {
            window.scrollTo({ top: targetScrollY, left: 0, behavior: "auto" });
          }
        } catch (_) {}

        const finalizeStableCheck = (previousRect, previousTop) => {
          setTimeout(() => {
            try {
              const finalRect = measureRect();
              if (!finalRect) {
                sendWaitingPayload(previousRect || rect0, "waiting-for-scroll-align");
                return;
              }
              const finalTop = recordTop(finalRect);
              const alignedFinal = !Number.isNaN(finalTop) && finalTop >= 0 && finalTop <= 20;
              const stable = !Number.isNaN(previousTop) && !Number.isNaN(finalTop) && Math.abs(finalTop - previousTop) <= 3;
              if (alignedFinal && stable) {
                sendActivePayload(finalRect);
                return;
              }
              sendWaitingPayload(finalRect, "waiting-for-scroll-align");
            } catch (_) {
              sendWaitingPayload(previousRect || rect0, "waiting-for-scroll-align");
            }
          }, 300);
        };

        setTimeout(() => {
          try {
            const rect1 = measureRect();
            if (!rect1) {
              sendWaitingPayload(rect0, "waiting-for-scroll-align");
              return;
            }
            const top1 = recordTop(rect1);
            const needsCorrection = Number.isNaN(top1) || top1 < 0 || top1 > 20;
            if (!needsCorrection) {
              finalizeStableCheck(rect1, top1);
              return;
            }

            try {
              const currentScrollY2 = window.scrollY || window.pageYOffset || 0;
              const correctiveTargetScrollY = Math.max(0, Math.round(currentScrollY2 + (Number.isNaN(top1) ? 0 : top1) - CGTV_TOP_OFFSET_PX));
              if (Math.abs(correctiveTargetScrollY - currentScrollY2) >= 1) {
                window.scrollTo({ top: correctiveTargetScrollY, left: 0, behavior: "auto" });
              }
            } catch (_) {}

            setTimeout(() => {
              try {
                const rect2 = measureRect();
                if (!rect2) {
                  sendWaitingPayload(rect1, "waiting-for-scroll-align");
                  return;
                }
                const top2 = recordTop(rect2);
                finalizeStableCheck(rect2, top2);
              } catch (_) {
                sendWaitingPayload(rect1, "waiting-for-scroll-align");
              }
            }, 300);
          } catch (_) {
            sendWaitingPayload(rect0, "waiting-for-scroll-align");
          }
        }, 300);
        return true;
      } catch (error) {
        return false;
      }
    }
    if (isCgtvBradmaxFrame()) {
      ensureCgtvBradmaxPlaybackHook(attemptAtMs);
      scheduleCgtvBradmaxFullscreenPoll(attemptAtMs);
      const state = collectCgtvBradmaxVideoState();
      if (state.playing) {
        // If the page is already playing, ensure we do not leave a transport lock applied
        // that would prevent pointer interaction. Remove any existing lock.
        removeCgtvBradmaxTransportLock("playing");
        setTimeout(() => {
          if (!isCgtvBradmaxFrame()) return;
          maybeTriggerCgtvBradmaxFullscreen("playing-fullscreen-clicked", attemptAtMs + 250, collectCgtvBradmaxVideoState());
        }, 250);
      }
      promptPayload({
        type: "cgtv-play-assist",
        phase: "content-cgtv-play-assist",
        pageUrl: window.location.href,
        active: !!state.hasVideo && !state.playing,
        requiresUserAction: !!state.hasVideo && !state.playing,
        reason: state.playing ? "playing" : "bradmax-video-state",
        attemptAtMs: numberOrZero(attemptAtMs),
        centerX: state.centerX,
        centerY: state.centerY,
        viewportWidth: numberOrZero(window.innerWidth || 0),
        viewportHeight: numberOrZero(window.innerHeight || 0),
        xRatio: state.xRatio,
        yRatio: state.yRatio,
        devicePixelRatio: numberOrZero(window.devicePixelRatio || 0),
        rect: state.rectText,
        targetKind: "bradmax-video",
        targetSummary: "video",
        hasVideo: !!state.hasVideo,
        playing: !!state.playing,
        paused: !!state.paused,
        readyState: state.readyState,
        currentTime: state.currentTime,
        videoWidth: state.videoWidth,
        videoHeight: state.videoHeight
      });
      return true;
    }
    return false;
  }

  function scheduleCgtvPlayAssist() {
    if (cgtvPlayAssistScheduled) return;
    if (!isCgtvWatchTopPage() && !isCgtvBradmaxFrame()) return;
    cgtvPlayAssistScheduled = true;
    CGTV_PLAY_ASSIST_DELAYS_MS.forEach((delayMs) => {
      setTimeout(() => {
        emitCgtvPlayAssist("scheduled-" + delayMs, delayMs);
      }, delayMs);
    });
  }

  function attemptCgtvPageFullscreenLike(attemptAtMs, phase) {
    const payload = {
      type: "cgtv-page-fullscreen-like",
      phase: phase || "content-cgtv-page-fullscreen-like",
      pageUrl: window.location.href,
      attemptAtMs: numberOrZero(attemptAtMs),
      applied: false,
      reason: "not-cgtv-watch",
      iframeRect: "none",
      iframeSummary: "none"
    };
    if (!isCgtvWatchTopPage()) {
      promptPayload(payload);
      return payload;
    }
    try {
      const iframe = findCgtvBradmaxIframe();
      if (!iframe) {
        payload.reason = "no-bradmax-iframe";
        promptPayload(payload);
        return payload;
      }
      payload.iframeSummary = summarizeNode(iframe);
      payload.iframeRect = rectSummary(iframe);
      if (!isVisible(iframe)) {
        payload.reason = "iframe-not-visible";
        promptPayload(payload);
        return payload;
      }
      const beforeTop = iframe.getBoundingClientRect().top;
      const currentScrollY = window.scrollY || window.pageYOffset || 0;
      const targetScrollY = Math.max(0, currentScrollY + beforeTop - CGTV_TOP_OFFSET_PX);
      if (Math.abs(beforeTop) > 2) {
        window.scrollTo({ top: targetScrollY, left: 0, behavior: "auto" });
      }
      iframe.setAttribute("data-kf-cgtv-scroll-aligned", "1");
      if (document.documentElement && document.documentElement.style) {
        document.documentElement.style.backgroundColor = "black";
      }
      if (document.body && document.body.style) {
        document.body.style.backgroundColor = "black";
      }
      cgtvPageFullscreenLikeApplied = true;
      payload.applied = true;
      payload.reason = Math.abs(beforeTop) > 2 ? "bradmax-iframe-scroll-aligned" : "bradmax-iframe-already-aligned";
      payload.scrollYBefore = numberOrZero(currentScrollY);
      payload.scrollYAfter = numberOrZero(window.scrollY || window.pageYOffset || 0);
      payload.deltaY = numberOrZero((window.scrollY || window.pageYOffset || 0) - currentScrollY);
      payload.iframeRect = rectSummary(iframe);
      promptPayload(payload);
      return payload;
    } catch (error) {
      payload.reason = (error && (error.name || error.message)) || "error";
      promptPayload(payload);
      return payload;
    }
  }

  function scheduleCgtvPageFullscreenLike() {
    if (cgtvPageFullscreenLikeStarted || !isCgtvWatchTopPage()) return;
    cgtvPageFullscreenLikeStarted = true;
    [500, 1200, 2600, 5200].forEach((delayMs, index, arr) => {
      setTimeout(() => {
        if (!isCgtvWatchTopPage()) return;
        const payload = cgtvPageFullscreenLikeApplied
          ? {
              applied: true,
              reason: "already-applied",
              iframeRect: rectSummary(findCgtvBradmaxIframe()),
              iframeSummary: summarizeNode(findCgtvBradmaxIframe())
            }
          : attemptCgtvPageFullscreenLike(delayMs, "content-cgtv-page-fullscreen-like");
        if (index === arr.length - 1) {
          promptPayload({
            type: "cgtv-page-fullscreen-like",
            phase: "content-cgtv-page-fullscreen-like-final",
            pageUrl: window.location.href,
            attemptAtMs: delayMs,
            applied: !!(payload && payload.applied),
            reason: (payload && payload.reason) || "no-result",
            iframeRect: (payload && payload.iframeRect) || "none",
            iframeSummary: (payload && payload.iframeSummary) || "none"
          });
        }
      }, delayMs);
    });
  }

  function readNovusIntent() {
    try {
      const url = new URL(window.location.href);
      const desiredChannel = String(url.searchParams.get("kf_channel") || "").trim();
      const returnUrl = String(url.searchParams.get("kf_return") || "").trim();
      const validDesiredChannel = desiredChannel === "13" || desiredChannel === "23" || desiredChannel === "49";
      return { desiredChannel, returnUrl, validDesiredChannel };
    } catch (_) {
      return { desiredChannel: "", returnUrl: "", validDesiredChannel: false };
    }
  }

  function emitNovusProfileActive(intent, reason) {
    if (!isNovusTelearubaTopPage() || !intent || !intent.validDesiredChannel) return;
    if (novusProfileActiveEmitted) return;
    novusProfileActiveEmitted = true;
    promptPayload({
      type: "novus-telearuba-profile-active",
      phase: "content-novus-telearuba-profile-active",
      pageUrl: window.location.href,
      desiredChannel: intent.desiredChannel,
      returnUrl: intent.returnUrl || "",
      reason: String(reason || "novus-profile-detected")
    });
  }

  function nodeTextFingerprint(node) {
    try {
      const text = [
        node && node.innerText,
        node && node.textContent,
        node && node.getAttribute && node.getAttribute("aria-label"),
        node && node.getAttribute && node.getAttribute("title"),
        node && node.getAttribute && node.getAttribute("data-title"),
        node && node.getAttribute && node.getAttribute("data-tooltip"),
        node && node.value
      ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().toLowerCase();
      return text.slice(0, 200);
    } catch (_) {
      return "";
    }
  }

  function findNovusChannelControl(desiredChannel) {
    const selectors = [
      "button",
      "a",
      "[role='button']",
      "input[type='button']",
      "input[type='submit']",
      "[aria-label]",
      "[title]"
    ];
    const all = [];
    selectors.forEach((selector) => {
      try {
        all.push(...Array.from(document.querySelectorAll(selector)));
      } catch (_) {}
    });
    const seen = new Set();
    let best = null;
    let bestScore = -1;
    all.forEach((node) => {
      if (!node || seen.has(node)) return;
      seen.add(node);
      const rect = node.getBoundingClientRect();
      if (rect.width < 26 || rect.height < 20) return;
      const text = nodeTextFingerprint(node);
      if (!text) return;
      const hasChannelWord = text.indexOf("channel") >= 0;
      const exactPhrase = text.indexOf(`channel ${desiredChannel}`) >= 0;
      const channelToken = new RegExp(`\\b${desiredChannel}\\b`).test(text);
      if (!exactPhrase && !(hasChannelWord && channelToken)) return;
      const visible = isVisible(node);
      const score = (visible ? 1000 : 0) + (exactPhrase ? 200 : 0) + Math.round(rect.width + rect.height);
      if (score > bestScore) {
        best = node;
        bestScore = score;
      }
    });
    return best;
  }

  function clickNodeIfPossible(node) {
    if (!node) return false;
    try {
      if (typeof node.click === "function") {
        node.click();
        return true;
      }
    } catch (_) {}
    return false;
  }

  function collectNovusPrimaryVideoState() {
    let bestVideo = null;
    let bestArea = -1;
    const videos = Array.from(document.querySelectorAll("video"));
    videos.forEach((video) => {
      if (!video) return;
      const rect = video.getBoundingClientRect();
      const area = Math.max(0, rect.width) * Math.max(0, rect.height);
      if (area <= 0) return;
      if (area > bestArea) {
        bestArea = area;
        bestVideo = video;
      }
    });
    if (!bestVideo) {
      return {
        hasVideo: false,
        mediaPresent: false,
        playable: false,
        playing: false,
        paused: true,
        readyState: 0,
        currentTime: 0,
        videoWidth: 0,
        videoHeight: 0,
        muted: false,
        volume: 1,
        rect: "0,0 0x0",
        node: null
      };
    }
    const rect = bestVideo.getBoundingClientRect();
    const area = Math.max(0, rect.width) * Math.max(0, rect.height);
    const hasLargeVisibleVideo = isVisible(bestVideo) && area >= 90000;
    const paused = !!bestVideo.paused;
    const readyState = Number(bestVideo.readyState || 0);
    const currentTime = Number(bestVideo.currentTime || 0);
    const videoWidth = Number(bestVideo.videoWidth || 0);
    const videoHeight = Number(bestVideo.videoHeight || 0);
    const muted = !!bestVideo.muted;
    const volume = typeof bestVideo.volume === "number" ? Number(bestVideo.volume) : 1;
    const mediaPresent = hasLargeVisibleVideo && readyState >= 1;
    const playable = readyState >= 2 || (videoWidth > 0 && videoHeight > 0) || currentTime > 0.1;
    const playing = !paused && (currentTime > 0.1 || readyState >= 2);
    return {
      hasVideo: true,
      mediaPresent,
      playable,
      playing,
      paused,
      readyState,
      currentTime,
      videoWidth,
      videoHeight,
      muted,
      volume,
      rect: `${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}`,
      node: bestVideo
    };
  }

  function classifyNovusStartupState(state, hasVisualTarget) {
    if (!state || !state.hasVideo) {
      return hasVisualTarget ? "loading-no-video" : "loading-no-video";
    }
    if (state.playing) return "playing";
    if (state.playable && state.paused) return "playable-paused";
    if (state.mediaPresent && state.paused) return "media-present-paused";
    if (state.readyState <= 0) return "loading-ready0";
    return "loading-ready1plus";
  }

  function emitNovusStartupState(intent, state, attemptAtMs, extras) {
    if (!isNovusTelearubaTopPage() || !intent || !intent.validDesiredChannel) return;
    const visualTarget = chooseNovusVisualTarget();
    const startupState = classifyNovusStartupState(state, !!visualTarget);
    const payload = {
      type: "novus-telearuba-startup-state",
      phase: "content-novus-telearuba-startup-state",
      pageUrl: window.location.href,
      desiredChannel: intent.desiredChannel,
      returnUrl: intent.returnUrl || "",
      state: startupState,
      hasVideo: !!(state && state.hasVideo),
      hasVisualTarget: !!visualTarget,
      visualTargetSummary: visualTarget ? summarizeNode(visualTarget) : "none",
      visualTargetRect: visualTarget ? rectSummary(visualTarget) : "0,0 0x0",
      mediaPresent: !!(state && state.mediaPresent),
      playable: !!(state && state.playable),
      playing: !!(state && state.playing),
      paused: !!(state && state.paused),
      muted: !!(state && state.muted),
      volume: Number((state && typeof state.volume === "number") ? state.volume : 1),
      readyState: Number((state && state.readyState) || 0),
      currentTime: Number((state && state.currentTime) || 0),
      currentTimeDelta: Number((state && state.currentTime) || 0) - Number(novusLastCurrentTime || 0),
      videoWidth: Number((state && state.videoWidth) || 0),
      videoHeight: Number((state && state.videoHeight) || 0),
      videoRect: (state && state.rect) || "0,0 0x0",
      attemptAtMs: numberOrZero(attemptAtMs),
      autoplayAttemptCount: novusAutoplayAttemptCount
    };
    if (extras && typeof extras === "object") {
      Object.keys(extras).forEach((key) => {
        payload[key] = extras[key];
      });
    }
    promptPayload(payload);
    novusLastCurrentTime = Number((state && state.currentTime) || novusLastCurrentTime || 0);
  }

  function maybeAttemptNovusAutoplayUnmute(intent, state, attemptAtMs) {
    const result = {
      playAttempted: false,
      playResolved: false,
      playRejected: false,
      playError: "",
      mutedBefore: !!(state && state.muted),
      mutedAfter: !!(state && state.muted),
      volumeBefore: Number((state && typeof state.volume === "number") ? state.volume : 1),
      volumeAfter: Number((state && typeof state.volume === "number") ? state.volume : 1),
      reason: "not-attempted"
    };
    if (!state || !state.node) {
      result.reason = "no-video-node";
      return result;
    }
    if (!(state.mediaPresent || state.playable)) {
      result.reason = "media-not-present";
      return result;
    }
    const video = state.node;
    try {
      if (video.muted) video.muted = false;
      if (typeof video.volume === "number" && video.volume < 0.95) video.volume = 1.0;
    } catch (_) {}
    result.mutedAfter = !!video.muted;
    result.volumeAfter = typeof video.volume === "number" ? Number(video.volume) : result.volumeBefore;
    const shouldPlayAttempt = !!video.paused;
    if (!shouldPlayAttempt) {
      result.reason = "already-playing";
      return result;
    }
    if (novusAutoplayBlockedByPolicy) {
      result.reason = "blocked-by-policy";
      return result;
    }
    if (novusAutoplayAttemptCount >= NOVUS_AUTOPLAY_MAX_ATTEMPTS) {
      result.reason = "attempt-limit";
      return result;
    }
    novusAutoplayAttemptCount += 1;
    result.playAttempted = true;
    result.reason = "play-attempted";
    try {
      const playResult = video.play();
      if (playResult && typeof playResult.then === "function") {
        playResult.then(() => {
          novusAutoplayBlockedByPolicy = false;
          emitNovusStartupState(intent, collectNovusPrimaryVideoState(), attemptAtMs + 1, {
            playAttempted: true,
            playResolved: true,
            playRejected: false,
            playError: "",
            mutedBefore: result.mutedBefore,
            mutedAfter: !!video.muted,
            volumeBefore: result.volumeBefore,
            volumeAfter: typeof video.volume === "number" ? Number(video.volume) : result.volumeBefore
          });
        }).catch((error) => {
          const playError = String((error && error.name) || (error && error.message) || "play-rejected");
          if (playError.toLowerCase().indexOf("notallowed") >= 0) {
            novusAutoplayBlockedByPolicy = true;
          }
          emitNovusStartupState(intent, collectNovusPrimaryVideoState(), attemptAtMs + 1, {
            playAttempted: true,
            playResolved: false,
            playRejected: true,
            playError,
            mutedBefore: result.mutedBefore,
            mutedAfter: !!video.muted,
            volumeBefore: result.volumeBefore,
            volumeAfter: typeof video.volume === "number" ? Number(video.volume) : result.volumeBefore
          });
          if (playError.toLowerCase().indexOf("notallowed") >= 0) {
            emitNovusPlayAssist(intent, true, "play-not-allowed", attemptAtMs + 2, collectNovusPrimaryVideoState(), playError);
          }
        });
      } else {
        result.playResolved = true;
      }
    } catch (error) {
      result.playRejected = true;
      result.playError = String((error && error.name) || (error && error.message) || "play-throw");
      if (result.playError.toLowerCase().indexOf("notallowed") >= 0) {
        novusAutoplayBlockedByPolicy = true;
      }
      result.reason = "play-throw";
    }
    return result;
  }

  function chooseNovusVisualTarget() {
    const videoState = collectNovusPrimaryVideoState();
    if (videoState.node) return videoState.node;
    const candidates = Array.from(document.querySelectorAll("iframe, [class*='player' i], [id*='player' i]"));
    let best = null;
    let bestArea = -1;
    candidates.forEach((node) => {
      if (!node || !isVisible(node)) return;
      const rect = node.getBoundingClientRect();
      const area = Math.max(0, rect.width) * Math.max(0, rect.height);
      if (area < 64000) return;
      if (area > bestArea) {
        bestArea = area;
        best = node;
      }
    });
    return best;
  }

  function emitNovusPlayAssist(intent, active, reason, attemptAtMs, state, playError) {
    if (!isNovusTelearubaTopPage() || !intent || !intent.validDesiredChannel) return;
    const reasonText = String(reason || (active ? "playable-paused" : "playing"));
    if (!active && !novusPlayAssistLastActive) return;
    if (active === novusPlayAssistLastActive && active && reasonText === novusPlayAssistLastReason) return;
    novusPlayAssistLastActive = !!active;
    novusPlayAssistLastReason = active ? reasonText : "";
    let centerX = -1;
    let centerY = -1;
    let rect = "none";
    let targetKind = "none";
    let targetSummary = "none";
    try {
      const playControl = Array.from(
        document.querySelectorAll("button,[role='button'],a,[class*='play' i],[aria-label*='play' i],[title*='play' i]")
      ).find((node) => {
        if (!isVisible(node)) return false;
        const cls = String(node.className || "").toLowerCase();
        const aria = String(node.getAttribute && node.getAttribute("aria-label") || "").toLowerCase();
        const title = String(node.getAttribute && node.getAttribute("title") || "").toLowerCase();
        const text = String(node.innerText || node.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
        const blob = `${cls} ${aria} ${title} ${text}`;
        if (blob.indexOf("pause") >= 0) return false;
        if (blob.indexOf("fullscreen") >= 0 || blob.indexOf("full screen") >= 0) return false;
        if (blob.indexOf("volume") >= 0 || blob.indexOf("mute") >= 0) return false;
        if (blob.indexOf("channel") >= 0) return false;
        return blob.indexOf("play") >= 0 || blob.indexOf("start") >= 0;
      });
      if (playControl) {
        const r = playControl.getBoundingClientRect();
        if (r.width >= 20 && r.height >= 20) {
          centerX = Math.round(r.left + Math.max(1, Math.floor(r.width / 2)));
          centerY = Math.round(r.top + Math.max(1, Math.floor(r.height / 2)));
          rect = `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`;
          targetKind = "play-control";
          targetSummary = summarizeNode(playControl);
        }
      }
      if (centerX < 0 || centerY < 0) {
        const target = chooseNovusVisualTarget();
        if (target) {
          const r = target.getBoundingClientRect();
          centerX = Math.round(r.left + Math.max(1, Math.floor(r.width / 2)));
          centerY = Math.round(r.top + Math.max(1, Math.floor(r.height / 2)));
          rect = `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`;
          targetKind = target.tagName && target.tagName.toLowerCase() === "video" ? "video" : "player-container";
          targetSummary = summarizeNode(target);
        }
      }
    } catch (_) {}
    if (active && (centerX < 0 || centerY < 0)) {
      centerX = Math.round(Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1280) / 2);
      centerY = Math.round(Math.max(1, window.innerHeight || document.documentElement.clientHeight || 720) / 2);
      rect = "viewport-center";
      targetKind = "viewport-center";
      targetSummary = "viewport";
    }
    promptPayload({
      type: "novus-telearuba-play-assist",
      phase: "content-novus-telearuba-play-assist",
      pageUrl: window.location.href,
      desiredChannel: intent.desiredChannel,
      returnUrl: intent.returnUrl || "",
      active: !!active,
      requiresUserAction: !!active,
      reason: reasonText,
      attemptAtMs: numberOrZero(attemptAtMs),
      centerX,
      centerY,
      rect,
      targetKind,
      targetSummary,
      readyState: Number((state && state.readyState) || 0),
      paused: !!(state && state.paused),
      muted: !!(state && state.muted),
      volume: Number((state && typeof state.volume === "number") ? state.volume : 1),
      playError: String(playError || "")
    });
  }

  function applyNovusPlayerFirstShell(intent, reason, attemptAtMs) {
    if (!isNovusTelearubaTopPage() || !intent || !intent.validDesiredChannel) return null;
    const target = chooseNovusVisualTarget();
    if (!target) {
      promptPayload({
        type: "novus-telearuba-page-cleanup",
        phase: "content-novus-telearuba-page-cleanup",
        pageUrl: window.location.href,
        desiredChannel: intent.desiredChannel,
        hiddenCount: 0,
        reason: "no-target",
        targetSummary: "none",
        targetRect: "0,0 0x0"
      });
      return null;
    }
    const preserved = new Set();
    let cursor = target;
    while (cursor && cursor.nodeType === 1) {
      preserved.add(cursor);
      if (cursor === document.body || cursor === document.documentElement) break;
      cursor = cursor.parentElement;
    }
    preserved.add(document.body);
    preserved.add(document.documentElement);
    let hiddenCount = 0;
    const hideNode = (node) => {
      if (!node || preserved.has(node)) return;
      if (target.contains(node) || node.contains(target)) return;
      try {
        node.style.setProperty("display", "none", "important");
        node.setAttribute("data-kf-novus-page-content-hidden", "1");
        hiddenCount += 1;
      } catch (_) {}
    };
    try {
      Array.from(document.body.children).forEach((child) => hideNode(child));
    } catch (_) {}
    try {
      document.documentElement.style.setProperty("margin", "0", "important");
      document.documentElement.style.setProperty("padding", "0", "important");
      document.documentElement.style.setProperty("width", "100vw", "important");
      document.documentElement.style.setProperty("height", "100vh", "important");
      document.documentElement.style.setProperty("overflow", "hidden", "important");
      document.documentElement.style.setProperty("background", "#000", "important");
      document.body.style.setProperty("margin", "0", "important");
      document.body.style.setProperty("padding", "0", "important");
      document.body.style.setProperty("width", "100vw", "important");
      document.body.style.setProperty("height", "100vh", "important");
      document.body.style.setProperty("overflow", "hidden", "important");
      document.body.style.setProperty("background", "#000", "important");
      target.style.setProperty("position", "fixed", "important");
      target.style.setProperty("left", "0", "important");
      target.style.setProperty("top", "0", "important");
      target.style.setProperty("width", "100vw", "important");
      target.style.setProperty("height", "100vh", "important");
      target.style.setProperty("max-width", "100vw", "important");
      target.style.setProperty("max-height", "100vh", "important");
      target.style.setProperty("border", "0", "important");
      target.style.setProperty("margin", "0", "important");
      target.style.setProperty("padding", "0", "important");
      target.style.setProperty("z-index", "2147483647", "important");
      target.style.setProperty("background", "#000", "important");
      target.setAttribute("data-kf-novus-player-first", "1");
    } catch (_) {}
    const targetRect = rectSummary(target);
    promptPayload({
      type: "novus-telearuba-page-cleanup",
      phase: "content-novus-telearuba-page-cleanup",
      pageUrl: window.location.href,
      desiredChannel: intent.desiredChannel,
      hiddenCount,
      reason: String(reason || "player-first-cleanup"),
      targetSummary: summarizeNode(target),
      targetRect
    });
    if (!novusPlayerFirstActiveEmitted) {
      novusPlayerFirstActiveEmitted = true;
      promptPayload({
        type: "novus-telearuba-player-first-active",
        phase: "content-novus-telearuba-player-first-active",
        pageUrl: window.location.href,
        desiredChannel: intent.desiredChannel,
        returnUrl: intent.returnUrl || "",
        applied: true,
        reason: String(reason || "novus-player-first-layout"),
        attemptAtMs: numberOrZero(attemptAtMs)
      });
    }
    return target;
  }

  function emitNovusPlayableState(intent, attemptAtMs) {
    if (!isNovusTelearubaTopPage() || !intent || !intent.validDesiredChannel) return;
    const state = collectNovusPrimaryVideoState();
    const autoplay = maybeAttemptNovusAutoplayUnmute(intent, state, attemptAtMs);
    emitNovusStartupState(intent, state, attemptAtMs, autoplay);
    promptPayload({
      type: "novus-telearuba-playable-video",
      phase: "content-novus-telearuba-playable-video",
      pageUrl: window.location.href,
      desiredChannel: intent.desiredChannel,
      mediaPresent: !!state.mediaPresent,
      playable: !!state.playable,
      playing: !!state.playing,
      paused: !!state.paused,
      muted: !!state.muted,
      volume: Number(state.volume || 1),
      readyState: Number(state.readyState || 0),
      currentTime: Number(state.currentTime || 0),
      videoWidth: Number(state.videoWidth || 0),
      videoHeight: Number(state.videoHeight || 0),
      videoRect: state.rect || "0,0 0x0",
      playAttempted: !!autoplay.playAttempted,
      playResolved: !!autoplay.playResolved,
      playRejected: !!autoplay.playRejected,
      playError: autoplay.playError || "",
      mutedBefore: !!autoplay.mutedBefore,
      mutedAfter: !!autoplay.mutedAfter,
      volumeBefore: Number(autoplay.volumeBefore || 1),
      volumeAfter: Number(autoplay.volumeAfter || 1),
      attemptAtMs: numberOrZero(attemptAtMs)
    });
    if (state.playing) {
      novusAutoplayBlockedByPolicy = false;
      emitNovusPlayAssist(intent, false, "playing", attemptAtMs, state, "");
    } else {
      const playError = String(autoplay.playError || "");
      if (autoplay.playRejected && playError.toLowerCase().indexOf("notallowed") >= 0) {
        novusAutoplayBlockedByPolicy = true;
        emitNovusPlayAssist(intent, true, "play-not-allowed", attemptAtMs, state, playError);
      } else if (state.paused && (state.playable || (state.mediaPresent && novusCleanupApplied))) {
        emitNovusPlayAssist(intent, true, state.playable ? "playable-paused" : "media-present-paused", attemptAtMs, state, playError);
      }
    }
    if (state.playable || state.playing) {
      novusPlayableLogged = true;
    }
    const shouldApplyPlayerFirst =
      state.playing ||
      ((state.playable || state.mediaPresent) && state.paused && attemptAtMs >= 12000);
    if (shouldApplyPlayerFirst && !novusCleanupApplied) {
      if (!novusCleanupApplied) {
        novusCleanupApplied = true;
        setTimeout(() => {
          applyNovusPlayerFirstShell(
            intent,
            state.playing ? "novus-playing" : (state.playable ? "novus-playable-paused" : "novus-media-present-paused"),
            attemptAtMs + 600
          );
        }, 600);
      }
    }
  }

  function attemptNovusChannelSelection(intent, attemptAtMs) {
    if (!isNovusTelearubaTopPage() || !intent || !intent.validDesiredChannel) return;
    const control = findNovusChannelControl(intent.desiredChannel);
    const rect = control ? control.getBoundingClientRect() : null;
    const clicked = clickNodeIfPossible(control);
    if (clicked) {
      novusChannelSelectionCompleted = true;
    }
    promptPayload({
      type: "novus-telearuba-channel-select",
      phase: "content-novus-telearuba-channel-select",
      pageUrl: window.location.href,
      desiredChannel: intent.desiredChannel,
      returnUrl: intent.returnUrl || "",
      clicked,
      reason: control ? (clicked ? "clicked" : "click-failed") : "control-not-found",
      controlSummary: control ? summarizeNode(control) : "none",
      rect: rect ? `${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}` : "0,0 0x0",
      attemptAtMs: numberOrZero(attemptAtMs)
    });
  }

  function scheduleNovusTelearubaFlow() {
    if (!isNovusTelearubaTopPage() || novusChannelSelectionStarted) return;
    const intent = readNovusIntent();
    if (!intent.validDesiredChannel) return;
    novusChannelSelectionStarted = true;
    emitNovusProfileActive(intent, "intent-from-url");
    NOVUS_CHANNEL_SELECT_DELAYS_MS.forEach((delayMs) => {
      setTimeout(() => {
        if (!isNovusTelearubaTopPage()) return;
        if (!novusChannelSelectionCompleted || delayMs === NOVUS_CHANNEL_SELECT_DELAYS_MS[NOVUS_CHANNEL_SELECT_DELAYS_MS.length - 1]) {
          attemptNovusChannelSelection(intent, delayMs);
        }
      }, delayMs);
    });
    NOVUS_PLAYABLE_CHECK_DELAYS_MS.forEach((delayMs) => {
      setTimeout(() => {
        if (!isNovusTelearubaTopPage()) return;
        emitNovusPlayableState(intent, delayMs);
      }, delayMs);
    });
  }

  function isSupportedTegoFrame() {
    return detectTegoProfileFromPlayerUrl(window.location.href) !== "";
  }

  function isTttTegoFrame() {
    return detectTegoProfileFromPlayerUrl(window.location.href) === "ttt";
  }

  function isAbsTegoChannel10Iframe(node) {
    if (!node || node.tagName !== "IFRAME") return false;
    const src = String(node.src || "").toLowerCase();
    if (src.indexOf("player.tegotv.com/player.php") < 0) return false;
    return src.indexOf("channel=10") >= 0 || src.indexOf("channel%3d10") >= 0 || src.indexOf("channel") < 0;
  }

  function isTttTegoChannel1Iframe(node) {
    if (!node || node.tagName !== "IFRAME") return false;
    const src = String(node.src || "").toLowerCase();
    if (src.indexOf("player.tegotv.com/player.php") < 0) return false;
    return src.indexOf("channel=1") >= 0 || src.indexOf("channel%3d1") >= 0;
  }

  function isProfileTegoIframe(node, profile) {
    if (profile === "abs") return isAbsTegoChannel10Iframe(node);
    if (profile === "ttt") return isTttTegoChannel1Iframe(node);
    return false;
  }

  function sanitizeAbsTegoPlayerUrl(rawUrl) {
    try {
      const url = new URL(String(rawUrl || ""), window.location.href);
      const host = (url.hostname || "").toLowerCase();
      const path = (url.pathname || "").toLowerCase();
      if (host.indexOf("player.tegotv.com") < 0) return String(rawUrl || "");
      if (path.indexOf("/player.php") < 0) return String(rawUrl || "");
      const profile = detectTegoProfileFromPlayerUrl(url.toString());
      if (!profile) return String(rawUrl || "");
      if (profile === "abs") {
        url.searchParams.set("channel", "10");
      } else if (profile === "ttt") {
        url.searchParams.set("channel", "1");
      }
      url.searchParams.set("about", "0");
      url.searchParams.set("streams", "0");
      url.searchParams.set("videos", "0");
      url.searchParams.set("channels", "0");
      url.searchParams.set("matches", "0");
      url.searchParams.set("movies", "0");
      url.searchParams.set("tv_shows", "0");
      url.searchParams.set("apps", "0");
      url.searchParams.set("chat", "0");
      url.searchParams.set("donation", "0");
      url.searchParams.set("epg", "0");
      url.searchParams.set("packages", "0");
      if (!url.searchParams.has("resume")) {
        url.searchParams.set("resume", "optional");
      }
      return url.toString();
    } catch (_) {
      return String(rawUrl || "");
    }
  }

  function rectSummary(node) {
    try {
      const rect = node.getBoundingClientRect();
      return `${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}`;
    } catch (_) {
      return "0,0 0x0";
    }
  }

  function attemptAbsTegoPageFullscreenLike(attemptAtMs, phase) {
    const profile = activeTegoTopProfile();
    if (!profile) return null;
    const payload = {
      type: "abs-tego-page-fullscreen-like",
      phase: phase || "content-abs-tego-page-fullscreen-like",
      pageUrl: window.location.href,
      attemptAtMs: numberOrZero(attemptAtMs),
      profile,
      applied: false,
      reason: "no-iframe",
      iframeRect: "none",
      iframeSummary: "none"
    };
    try {
      const iframe = Array.from(document.querySelectorAll("iframe")).find((node) => isProfileTegoIframe(node, profile));
      if (!iframe) {
        promptPayload(payload);
        return payload;
      }
      const beforeUrl = String(iframe.src || "");
      const afterUrl = sanitizeAbsTegoPlayerUrl(beforeUrl);
      if (afterUrl && beforeUrl && afterUrl !== beforeUrl && iframe.getAttribute("data-kf-abs-tego-url-sanitized") !== "1") {
        iframe.setAttribute("data-kf-abs-tego-url-sanitized", "1");
        promptPayload({
          type: "abs-tego-url-sanitized",
          phase: "content-abs-tego-url-sanitized",
          pageUrl: window.location.href,
          profile,
          context: "top-iframe",
          beforeUrl,
          afterUrl
        });
        iframe.src = afterUrl;
      }
      payload.iframeSummary = summarizeNode(iframe);
      payload.iframeRect = rectSummary(iframe);
      if (!isVisible(iframe)) {
        payload.reason = "iframe-not-visible";
        promptPayload(payload);
        return payload;
      }
      if (iframe.style) {
        iframe.style.position = "fixed";
        iframe.style.left = "0";
        iframe.style.top = "0";
        iframe.style.width = "100vw";
        iframe.style.height = "100vh";
        iframe.style.maxWidth = "100vw";
        iframe.style.maxHeight = "100vh";
        iframe.style.margin = "0";
        iframe.style.padding = "0";
        iframe.style.border = "0";
        iframe.style.zIndex = "2147483000";
        iframe.style.background = "black";
      }
      iframe.setAttribute("data-kf-abs-fullscreen-like", "1");
      if (document.documentElement && document.documentElement.style) {
        document.documentElement.style.backgroundColor = "black";
        document.documentElement.style.margin = "0";
      }
      if (document.body && document.body.style) {
        document.body.style.backgroundColor = "black";
        document.body.style.margin = "0";
        document.body.style.padding = "0";
        document.body.style.minHeight = "100vh";
      }
      payload.applied = true;
      payload.reason = "iframe-promoted";
      payload.iframeRect = rectSummary(iframe);
      promptPayload(payload);
      emitAbsTegoPlayerFirstActive(profile, profile + "-top-iframe-promoted", attemptAtMs);
      return payload;
    } catch (error) {
      payload.reason = (error && error.message) || "error";
      promptPayload(payload);
      return payload;
    }
  }

  function emitAbsTegoPlayerFirstActive(profile, reason, attemptAtMs) {
    if (absTegoPlayerFirstActiveEmitted) return;
    absTegoPlayerFirstActiveEmitted = true;
    promptPayload({
      type: "abs-tego-player-first-active",
      phase: "content-abs-tego-player-first-active",
      pageUrl: window.location.href,
      playerUrl: window.location.href,
      profile: String(profile || ""),
      applied: true,
      reason: String(reason || "tego-player-first-layout"),
      attemptAtMs: numberOrZero(attemptAtMs)
    });
  }

  function rectOverlapArea(a, b) {
    const left = Math.max(a.left, b.left);
    const top = Math.max(a.top, b.top);
    const right = Math.min(a.right, b.right);
    const bottom = Math.min(a.bottom, b.bottom);
    const width = right - left;
    const height = bottom - top;
    if (width <= 0 || height <= 0) return 0;
    return width * height;
  }

  function scheduleAbsTegoTopOverlayCleanup(iframe, triggerAttemptAtMs) {
    if (!activeTegoTopProfile() || !iframe || absTegoTopOverlayCleanupScheduled) return;
    absTegoTopOverlayCleanupScheduled = true;
    const baseAttemptAtMs = numberOrZero(triggerAttemptAtMs);
    [250, 1300, 3000, 5200].forEach((delayMs) => {
      setTimeout(() => {
        if (!activeTegoTopProfile() || !iframe || !document.body) return;
        const iframeRect = iframe.getBoundingClientRect();
        const viewportHeight = Math.max(0, Math.floor(window.innerHeight || 0));
        const selectors = [
          "[role='dialog']",
          "[aria-modal='true']",
          "[id*='overlay' i]",
          "[class*='overlay' i]",
          "[id*='modal' i]",
          "[class*='modal' i]",
          "[id*='popup' i]",
          "[class*='popup' i]",
          "[id*='cookie' i]",
          "[class*='cookie' i]",
          "[id*='consent' i]",
          "[class*='consent' i]",
          "[id*='banner' i]",
          "[class*='banner' i]"
        ];
        const seen = new Set();
        const candidates = [];
        selectors.forEach((selector) => {
          let nodes = [];
          try {
            nodes = Array.from(document.querySelectorAll(selector));
          } catch (_) {
            nodes = [];
          }
          nodes.forEach((node) => {
            if (!node || seen.has(node)) return;
            seen.add(node);
            candidates.push(node);
          });
        });
        let hidden = 0;
        const hiddenSummaries = [];
        const hiddenRects = [];
        const hiddenZ = [];
        const hideCandidate = (node, sourceTag) => {
          try {
            if (!node || node === iframe) return;
            if (node.contains(iframe) || iframe.contains(node)) return;
            if (!isVisible(node)) return;
            const rect = node.getBoundingClientRect();
            if (rect.width < 80 || rect.height < 24) return;
            if (rect.top >= viewportHeight * 0.78) return;
            const overlapArea = rectOverlapArea(rect, iframeRect);
            if (overlapArea <= 0) return;
            const overlapRatio = overlapArea / Math.max(1, rect.width * rect.height);
            if (overlapRatio < 0.18) return;
            const style = window.getComputedStyle(node);
            const pointerEvents = String(style.pointerEvents || "").toLowerCase();
            if (pointerEvents === "none") return;
            const zIndex = String(style.zIndex || "");
            const position = String(style.position || "").toLowerCase();
            if (!(position === "fixed" || position === "absolute" || position === "sticky" || position === "relative")) return;
            node.style.display = "none";
            node.setAttribute("data-kf-abs-overlay-hidden", "1");
            hidden += 1;
            hiddenSummaries.push(`${sourceTag}:${summarizeNode(node)}`);
            hiddenRects.push(`${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}`);
            hiddenZ.push(zIndex);
          } catch (_) {}
        };
        candidates.slice(0, 60).forEach((node) => hideCandidate(node, "selector"));

        // Fallback pass: generic top-level blockers are often plain div wrappers without overlay-like class/id names.
        // Keep this ABS-only and conservative to preserve bottom navigation links.
        if (hidden === 0 && document.body) {
          Array.from(document.body.children).slice(0, 120).forEach((node) => {
            hideCandidate(node, "body-child");
          });
          const iframeParent = iframe.parentElement;
          if (iframeParent) {
            Array.from(iframeParent.children).slice(0, 80).forEach((node) => {
              hideCandidate(node, "iframe-sibling");
            });
            if (iframeParent.parentElement) {
              Array.from(iframeParent.parentElement.children).slice(0, 80).forEach((node) => {
                hideCandidate(node, "parent-sibling");
              });
            }
          }
        }
        promptPayload({
          type: "abs-tego-page-overlay-cleanup",
          phase: "content-abs-tego-page-overlay-cleanup",
          pageUrl: window.location.href,
          attemptAtMs: baseAttemptAtMs + delayMs,
          hiddenCount: hidden,
          hiddenSummary: hiddenSummaries.slice(0, 10).join("|"),
          hiddenRects: hiddenRects.slice(0, 10).join("|"),
          hiddenZ: hiddenZ.slice(0, 10).join("|"),
          iframeRect: rectSummary(iframe)
        });
      }, delayMs);
    });
  }

  function scheduleAbsTegoPageContentCleanup(iframe, triggerAttemptAtMs) {
    if (!activeTegoTopProfile() || !iframe || !document.body || absTegoPageContentCleanupScheduled) return;
    absTegoPageContentCleanupScheduled = true;
    const baseAttemptAtMs = numberOrZero(triggerAttemptAtMs);
    [250, 1100, 2600, 4800, 7600].forEach((delayMs) => {
      setTimeout(() => {
        if (!activeTegoTopProfile() || !iframe || !document.body || !document.documentElement) return;
        const path = [];
        let cursor = iframe;
        while (cursor) {
          path.push(cursor);
          if (cursor === document.body) break;
          cursor = cursor.parentElement;
        }
        if (path[path.length - 1] !== document.body) {
          promptPayload({
            type: "abs-tego-page-content-cleanup",
            phase: "content-abs-tego-page-content-cleanup",
            pageUrl: window.location.href,
            attemptAtMs: baseAttemptAtMs + delayMs,
            hiddenCount: 0,
            hiddenSummary: "no-body-path",
            pathSummary: "none",
            prunedChildrenSummary: "",
            iframeRect: rectSummary(iframe),
            finalIframeRect: rectSummary(iframe),
            shellApplied: false
          });
          return;
        }
        path.reverse(); // body -> ... -> iframe
        const preserve = new Set(path);
        preserve.add(document.documentElement);

        if (document.body.classList) {
          document.body.classList.add("kf-abs-player-shell-active");
        }
        if (!document.getElementById("kf-abs-player-shell-style")) {
          const style = document.createElement("style");
          style.id = "kf-abs-player-shell-style";
          style.textContent =
            ".kf-abs-player-shell-active *::before,.kf-abs-player-shell-active *::after{content:none !important;display:none !important;}";
          (document.head || document.documentElement).appendChild(style);
        }

        try {
          if (document.documentElement.style) {
            document.documentElement.style.setProperty("margin", "0", "important");
            document.documentElement.style.setProperty("padding", "0", "important");
            document.documentElement.style.setProperty("width", "100vw", "important");
            document.documentElement.style.setProperty("height", "100vh", "important");
            document.documentElement.style.setProperty("overflow", "hidden", "important");
            document.documentElement.style.setProperty("background", "#000", "important");
          }
          if (document.body.style) {
            document.body.style.setProperty("margin", "0", "important");
            document.body.style.setProperty("padding", "0", "important");
            document.body.style.setProperty("width", "100vw", "important");
            document.body.style.setProperty("height", "100vh", "important");
            document.body.style.setProperty("overflow", "hidden", "important");
            document.body.style.setProperty("background", "#000", "important");
          }
        } catch (_) {}

        let hiddenCount = 0;
        const hiddenSummary = [];
        const prunedChildrenSummary = [];
        const hideNode = (node, reasonTag) => {
          try {
            if (!node || preserve.has(node)) return false;
            const tag = String(node.tagName || "").toLowerCase();
            if (tag === "script" || tag === "style" || tag === "link" || tag === "meta") return false;
            if (!node.style) return false;
            if (!isVisible(node) && node.getAttribute("data-kf-abs-page-content-hidden") === "1") return false;
            node.style.setProperty("display", "none", "important");
            node.setAttribute("data-kf-abs-page-content-hidden", "1");
            hiddenCount += 1;
            if (hiddenSummary.length < 16) {
              hiddenSummary.push(`${reasonTag}:${summarizeNode(node)}`);
            }
            return true;
          } catch (_) {}
          return false;
        };

        // Prune body-level children except the path child.
        const bodyPathChild = path.length > 1 ? path[1] : iframe;
        Array.from(document.body.children).forEach((child) => {
          if (child !== bodyPathChild) {
            const hidden = hideNode(child, "body-child");
            if (hidden && prunedChildrenSummary.length < 24) {
              prunedChildrenSummary.push(`body>${summarizeNode(child)}`);
            }
          }
        });

        // For each path ancestor, prune direct children except the next path node.
        for (let index = 0; index < path.length - 1; index += 1) {
          const ancestor = path[index];
          const nextChild = path[index + 1];
          if (!ancestor || !ancestor.children) continue;
          Array.from(ancestor.children).forEach((child) => {
            if (child !== nextChild) {
              const hidden = hideNode(child, `path-sibling-${index}`);
              if (hidden && prunedChildrenSummary.length < 24) {
                prunedChildrenSummary.push(`${summarizeNode(ancestor)}>${summarizeNode(child)}`);
              }
            }
          });
        }

        // Force path shell visuals and neutralize text leakage on wrappers.
        path.forEach((node) => {
          try {
            if (!node || !node.style) return;
            if (node !== iframe) {
              node.style.setProperty("margin", "0", "important");
              node.style.setProperty("padding", "0", "important");
              node.style.setProperty("border", "0", "important");
              node.style.setProperty("width", "100vw", "important");
              node.style.setProperty("height", "100vh", "important");
              node.style.setProperty("max-width", "none", "important");
              node.style.setProperty("max-height", "none", "important");
              node.style.setProperty("overflow", "hidden", "important");
              node.style.setProperty("background", "#000", "important");
              node.style.setProperty("color", "transparent", "important");
              node.style.setProperty("font-size", "0", "important");
              if (node !== document.body) {
                node.style.setProperty("position", "fixed", "important");
                node.style.setProperty("inset", "0", "important");
              }
            }
          } catch (_) {}
        });

        try {
          if (iframe.style) {
            iframe.style.setProperty("display", "block", "important");
            iframe.style.setProperty("position", "fixed", "important");
            iframe.style.setProperty("inset", "0", "important");
            iframe.style.setProperty("width", "100vw", "important");
            iframe.style.setProperty("height", "100vh", "important");
            iframe.style.setProperty("border", "0", "important");
            iframe.style.setProperty("margin", "0", "important");
            iframe.style.setProperty("padding", "0", "important");
            iframe.style.setProperty("z-index", "2147483647", "important");
            iframe.style.setProperty("background", "#000", "important");
          }
        } catch (_) {}

        const pathSummary = path.map((node) => summarizeNode(node)).join("|");

        promptPayload({
          type: "abs-tego-page-content-cleanup",
          phase: "content-abs-tego-page-content-cleanup",
          pageUrl: window.location.href,
          attemptAtMs: baseAttemptAtMs + delayMs,
          hiddenCount,
          hiddenSummary: hiddenSummary.join("|"),
          pathSummary,
          prunedChildrenSummary: prunedChildrenSummary.join("|"),
          iframeRect: rectSummary(iframe),
          finalIframeRect: rectSummary(iframe),
          shellApplied: true
        });
      }, delayMs);
    });
  }

  function maybeAttachAbsTegoTopPlaybackListener() {
    if (!activeTegoTopProfile() || absTegoTopPlaybackListenerAttached) return;
    absTegoTopPlaybackListenerAttached = true;
    window.addEventListener("message", (event) => {
      if (!activeTegoTopProfile()) return;
      const data = event && event.data;
      if (!data || data.type !== "__KF_ABS_TEGO_PLAYBACK_PROGRESS__") return;
      if (!data.fullscreenLikeApplied) return;
      const playerUrl = String(data.playerUrl || "").toLowerCase();
      if (playerUrl.indexOf("player.tegotv.com/player.php") < 0) return;
      const topProfile = activeTegoTopProfile();
      const iframe = Array.from(document.querySelectorAll("iframe")).find((node) => isProfileTegoIframe(node, topProfile));
      if (!iframe) {
        promptPayload({
          type: "abs-tego-page-overlay-cleanup",
          phase: "content-abs-tego-page-overlay-cleanup-trigger",
          pageUrl: window.location.href,
          attemptAtMs: numberOrZero(data.attemptAtMs),
          hiddenCount: 0,
          hiddenSummary: "no-iframe-on-playback-trigger",
          hiddenRects: "",
          hiddenZ: "",
          iframeRect: "none"
        });
        return;
      }
      const triggerAtMs = numberOrZero(data.attemptAtMs) + 900;
      scheduleAbsTegoTopOverlayCleanup(iframe, triggerAtMs);
      scheduleAbsTegoPageContentCleanup(iframe, triggerAtMs);
    }, true);
  }

  function scheduleAbsTegoFrameOverlayCleanup(baseAttemptAtMs) {
    if (!isAbsTegoChannel10Frame() || absTegoFrameOverlayCleanupScheduled) return;
    absTegoFrameOverlayCleanupScheduled = true;
    let snapshotLogged = false;
    [700, 1900, 3600].forEach((delayMs) => {
      setTimeout(() => {
        if (!isAbsTegoChannel10Frame()) return;
        const videos = Array.from(document.querySelectorAll("video"));
        const primaryVideo = videos.find((video) => isVisible(video)) || videos[0];
        const videoRect = primaryVideo ? primaryVideo.getBoundingClientRect() : null;
        const stableVideo = !!(primaryVideo &&
          numberOrZero(primaryVideo.videoWidth) >= 1200 &&
          numberOrZero(primaryVideo.videoHeight) >= 680 &&
          numberOrZero(primaryVideo.readyState) >= 3 &&
          !primaryVideo.paused);
        let hiddenCount = 0;
        const hiddenSummary = [];
        const hiddenRects = [];

        const allowlist = [
          { marker: "rmp-loading-spin", label: "loading-spin" },
          { marker: "rmp-logo", label: "logo" },
          { marker: "rmp-sharing", label: "sharing" }
        ];

        const candidates = Array.from(
          document.querySelectorAll(".rmp-container *, .rmp-module *, .rmp-overlay *, .rmp-content *")
        ).slice(0, 260);

        candidates.forEach((node) => {
          try {
            if (!node || node.tagName === "VIDEO") return;
            if (!isVisible(node)) return;
            if (primaryVideo && (node.contains(primaryVideo) || primaryVideo.contains(node))) return;
            if (node.querySelector && node.querySelector("video")) return;
            const rect = node.getBoundingClientRect();
            if (rect.width < 24 || rect.height < 16) return;
            const overlapArea = videoRect ? rectOverlapArea(rect, videoRect) : 0;
            if (videoRect && overlapArea <= 0) return;
            const classBlob = String(node.className || "").toLowerCase();
            if (classBlob.indexOf("rmp-loaded") >= 0) return;
            const entry = allowlist.find((item) => classBlob.indexOf(item.marker) >= 0);
            if (!entry) return;
            if (entry.label !== "loading-spin" && !stableVideo) return;
            const style = window.getComputedStyle(node);
            if (String(style.pointerEvents || "").toLowerCase() === "none") return;
            node.style.display = "none";
            node.setAttribute("data-kf-abs-frame-overlay-hidden", "1");
            hiddenCount += 1;
            hiddenSummary.push(`${entry.label}:${summarizeNode(node)}`);
            hiddenRects.push(`${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}`);
          } catch (_) {}
        });

        if (stableVideo && !snapshotLogged) {
          snapshotLogged = true;
          const items = [];
          const overlayNodes = Array.from(document.querySelectorAll(".rmp-container *")).slice(0, 360);
          overlayNodes.forEach((node) => {
            if (items.length >= 32) return;
            try {
              if (!node || !isVisible(node) || node.tagName === "VIDEO") return;
              const cls = String(node.className || "");
              if (cls.indexOf("rmp-") < 0) return;
              const rect = node.getBoundingClientRect();
              if (rect.width < 20 || rect.height < 12) return;
              const style = window.getComputedStyle(node);
              items.push({
                node: summarizeNode(node),
                rect: `${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}`,
                z: String(style.zIndex || ""),
                pointer: String(style.pointerEvents || ""),
                opacity: String(style.opacity || ""),
                display: String(style.display || ""),
                visibility: String(style.visibility || "")
              });
            } catch (_) {}
          });
          promptPayload({
            type: "abs-tego-frame-overlay-snapshot",
            phase: "content-abs-tego-frame-overlay-snapshot",
            pageUrl: window.location.href,
            attemptAtMs: numberOrZero(baseAttemptAtMs) + delayMs,
            videoRect: primaryVideo ? rectSummary(primaryVideo) : "none",
            itemCount: items.length,
            items
          });
        }

        promptPayload({
          type: "abs-tego-frame-overlay-cleanup",
          phase: "content-abs-tego-frame-overlay-cleanup",
          pageUrl: window.location.href,
          attemptAtMs: numberOrZero(baseAttemptAtMs) + delayMs,
          hiddenCount,
          hiddenSummary: hiddenSummary.slice(0, 12).join("|"),
          hiddenRects: hiddenRects.slice(0, 12).join("|"),
          videoRect: primaryVideo ? rectSummary(primaryVideo) : "none",
          stableVideo
        });
      }, delayMs);
    });
  }

  function absTegoEmitChromeAutoHide(event, hidden, reason) {
    promptPayload({
      type: "abs-tego-chrome-autohide",
      phase: "content-abs-tego-chrome-autohide",
      pageUrl: window.location.href,
      event: String(event || "unknown"),
      hidden: !!hidden,
      reason: String(reason || ""),
    });
  }

  function absTegoStablePlaybackNow() {
    const videos = Array.from(document.querySelectorAll("video"));
    const primaryVideo = videos.find((video) => isVisible(video)) || videos[0];
    if (!primaryVideo) return false;
    return (
      numberOrZero(primaryVideo.videoWidth) >= 1200 &&
      numberOrZero(primaryVideo.videoHeight) >= 680 &&
      numberOrZero(primaryVideo.readyState) >= 3 &&
      !primaryVideo.paused
    );
  }

  function setAbsTegoChromeHidden(hidden, reason) {
    const controls = Array.from(document.querySelectorAll(".rmp-control-bar,.rmp-controls,.rmp-module"));
    let changed = 0;
    controls.forEach((node) => {
      try {
        if (!node || !node.style) return;
        if (hidden) {
          if (node.style.opacity !== "0" || node.style.pointerEvents !== "none") {
            node.style.opacity = "0";
            node.style.pointerEvents = "none";
            changed += 1;
          }
        } else {
          if (node.style.opacity !== "1" || node.style.pointerEvents !== "auto") {
            node.style.opacity = "1";
            node.style.pointerEvents = "auto";
            changed += 1;
          }
        }
      } catch (_) {}
    });
    if (changed > 0 || absTegoChromeHidden !== hidden) {
      absTegoChromeHidden = hidden;
      absTegoEmitChromeAutoHide(hidden ? "hide" : "show", hidden, reason);
      if (hidden) {
        scheduleAbsTegoPostStableLayerDump(reason || "chrome-hidden");
      }
    }
  }

  function scheduleAbsTegoChromeHide(reason) {
    if (absTegoChromeHideTimer) {
      clearTimeout(absTegoChromeHideTimer);
      absTegoChromeHideTimer = null;
    }
    absTegoChromeHideTimer = setTimeout(() => {
      if (!isAbsTegoChannel10Frame()) return;
      if (!absTegoStablePlaybackNow()) {
        absTegoEmitChromeAutoHide("hide-skip", false, "not-stable");
        if (absTegoChromeStabilityRetryCount < 8) {
          absTegoChromeStabilityRetryCount += 1;
          setTimeout(() => {
            if (!isAbsTegoChannel10Frame() || absTegoChromeHidden) return;
            scheduleAbsTegoChromeHide("post-stable-retry");
          }, 850);
        }
        return;
      }
      absTegoChromeStabilityRetryCount = 0;
      setAbsTegoChromeHidden(true, reason || "idle-timeout");
    }, 1800);
  }

  function scheduleAbsTegoChromeAutoHide() {
    if (!isAbsTegoChannel10Frame() || absTegoChromeAutoHideScheduled) return;
    absTegoChromeAutoHideScheduled = true;
    absTegoEmitChromeAutoHide("scheduled", false, "post-settle");

    const interactionHandler = (event) => {
      if (!isAbsTegoChannel10Frame()) return;
      const type = String(event && event.type || "");
      const now = Date.now();
      // Ignore noisy motion events that repeatedly surface chrome.
      if (type === "mousemove" || type === "pointermove" || type === "touchmove") {
        return;
      }
      // Only allow show at a controlled cadence.
      if (now - absTegoChromeLastShowMs < 1500) {
        return;
      }
      absTegoChromeLastShowMs = now;
      setAbsTegoChromeHidden(false, "interaction");
      scheduleAbsTegoChromeHide("interaction-idle");
    };
    ["mousedown", "pointerdown", "keydown", "touchstart"].forEach((eventName) => {
      document.addEventListener(eventName, interactionHandler, true);
    });

    setTimeout(() => {
      if (!isAbsTegoChannel10Frame()) return;
      if (!absTegoStablePlaybackNow()) {
        absTegoEmitChromeAutoHide("initial-skip", false, "not-stable");
        if (absTegoChromeStabilityRetryCount < 8) {
          absTegoChromeStabilityRetryCount += 1;
          setTimeout(() => {
            if (!isAbsTegoChannel10Frame() || absTegoChromeHidden) return;
            scheduleAbsTegoChromeHide("initial-post-stable-retry");
          }, 850);
        }
        return;
      }
      absTegoChromeStabilityRetryCount = 0;
      setAbsTegoChromeHidden(false, "initial-show");
      scheduleAbsTegoChromeHide("initial-idle");
    }, 600);
  }

  function emitTttTegoTransportReveal(reason, handled, controlBarVisibleBefore, controlBarVisibleAfter, target, rect, container) {
    promptPayload({
      type: "ttt-tego-transport-reveal",
      phase: "content-ttt-tego-transport-reveal",
      pageUrl: window.location.href,
      reason: String(reason || ""),
      handled: !!handled,
      controlBarVisibleBefore: !!controlBarVisibleBefore,
      controlBarVisibleAfter: !!controlBarVisibleAfter,
      target: summarizeNode(target),
      rect: rectAsText(rect || { left: 0, top: 0, width: 0, height: 0 }),
      containerClassList: shortText(container && container.className ? String(container.className) : "", 220),
      hiddenState: !!absTegoChromeHidden
    });
  }

  function revealTttTegoTransport(reason) {
    if (!isSupportedTegoFrame()) return false;
    const container = document.querySelector(".rmp-container,#rmpPlayer,#rmp");
    const controlBar = document.querySelector(".rmp-control-bar,.rmp-controls");
    const target = controlBar || container || document.body;
    const controlBarVisibleBefore = !!(controlBar && isVisible(controlBar));
    setAbsTegoChromeHidden(false, reason || "external-reveal");
    let handled = false;
    const rect = controlRect(target);
    const clientX = Math.round(rect.left + Math.max(1, rect.width) * 0.5);
    const clientY = Math.round(rect.top + Math.max(1, rect.height) * (target === controlBar ? 0.5 : 0.84));
    const mouseEventInit = {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      screenX: clientX,
      screenY: clientY,
      buttons: 0,
      button: 0,
      relatedTarget: null,
      view: window
    };
    ["mouseover", "mouseenter", "mousemove"].forEach((eventName) => {
      try {
        target.dispatchEvent(new MouseEvent(eventName, mouseEventInit));
        handled = true;
      } catch (_) {}
    });
    if (typeof window.PointerEvent === "function") {
      ["pointerover", "pointerenter", "pointermove"].forEach((eventName) => {
        try {
          target.dispatchEvent(new PointerEvent(eventName, Object.assign({ pointerType: "mouse", isPrimary: true }, mouseEventInit)));
          handled = true;
        } catch (_) {}
      });
    }
    try {
      document.dispatchEvent(new MouseEvent("mousemove", mouseEventInit));
      handled = true;
    } catch (_) {}
    scheduleAbsTegoChromeHide("interaction-idle");
    const controlBarVisibleAfter = !!(controlBar && isVisible(controlBar));
    emitTttTegoTransportReveal(
      reason,
      handled || controlBarVisibleAfter,
      controlBarVisibleBefore,
      controlBarVisibleAfter,
      target,
      rect,
      container
    );
    return handled || controlBarVisibleAfter;
  }

  function setupTttTegoTransportRevealBridge() {
    if (window.__kfTttTegoTransportRevealBridgeInstalled) return;
    window.__kfTttTegoTransportRevealBridgeInstalled = true;
    window.addEventListener("message", (event) => {
      const data = event && event.data;
      if (!data || data.type !== "kf-tego-transport-reveal") return;
      if (!isSupportedTegoFrame()) return;
      revealTttTegoTransport(String(data.reason || "bridge"));
    });
  }

  function scheduleAbsTegoPageFullscreenLike() {
    if (!ENABLE_ABS_TEGO_PAGE_FULLSCREEN_LIKE) return;
    if (absTegoPageFullscreenLikeStarted || !activeTegoTopProfile()) return;
    absTegoPageFullscreenLikeStarted = true;
    [600, 1800, 4200, 7600].forEach((delayMs, index, arr) => {
      setTimeout(() => {
        if (!activeTegoTopProfile()) return;
        const payload = attemptAbsTegoPageFullscreenLike(delayMs, "content-abs-tego-page-fullscreen-like");
        if (index === arr.length - 1) {
          promptPayload({
            type: "abs-tego-page-fullscreen-like",
            phase: "content-abs-tego-page-fullscreen-like-final",
            pageUrl: window.location.href,
            attemptAtMs: delayMs,
            applied: !!(payload && payload.applied),
            reason: (payload && payload.reason) || "no-result",
            iframeRect: (payload && payload.iframeRect) || "none",
            iframeSummary: (payload && payload.iframeSummary) || "none"
          });
        }
      }, delayMs);
    });
  }

  function numberOrZero(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function getEnabledFlag(item) {
    try {
      if (!item) return true;
      if (typeof item.enabled === "function") return item.enabled();
      if (typeof item.enabled === "boolean") return item.enabled;
    } catch (_) {}
    return true;
  }

  function setEnabledFlag(item, enabled) {
    try {
      if (!item) return false;
      if (typeof item.enabled === "function") {
        item.enabled(!!enabled);
        return true;
      }
      item.enabled = !!enabled;
      return true;
    } catch (_) {
      return false;
    }
  }

  function readVideoJsPlayers() {
    try {
      if (!window.videojs) return [];
      if (typeof window.videojs.getAllPlayers === "function") {
        return window.videojs.getAllPlayers().filter(Boolean);
      }
      if (typeof window.videojs.getPlayers === "function") {
        const players = window.videojs.getPlayers();
        return Object.keys(players || {}).map((key) => players[key]).filter(Boolean);
      }
    } catch (_) {}
    return [];
  }

  function chooseBestLevel(levels) {
    const candidates = levels
      .map((level, index) => ({
        index,
        ref: level.ref,
        height: numberOrZero(level.height),
        width: numberOrZero(level.width),
        bitrate: numberOrZero(level.bitrate || level.bandwidth),
        label: level.label || ""
      }))
      .filter((level) => level.height > 0 || level.bitrate > 0);
    if (!candidates.length) return null;
    const underCap = candidates.filter((level) => level.height > 0 && level.height <= TEGO_TARGET_MAX_HEIGHT);
    const pool = underCap.length ? underCap : candidates;
    return pool.sort((a, b) => {
      if (b.height !== a.height) return b.height - a.height;
      return b.bitrate - a.bitrate;
    })[0];
  }

  function applyLevelSet(levels, source) {
    const best = chooseBestLevel(levels);
    if (!best) {
      return { source, applied: false, reason: "no-levels", levels: [] };
    }
    let changed = 0;
    const summary = levels.map((level, index) => {
      const shouldEnable = index === best.index;
      if (setEnabledFlag(level.ref, shouldEnable)) changed += 1;
      return {
        index,
        height: numberOrZero(level.height),
        width: numberOrZero(level.width),
        bitrate: numberOrZero(level.bitrate || level.bandwidth),
        label: level.label || "",
        enabled: shouldEnable
      };
    });
    return {
      source,
      applied: changed > 0,
      selectedHeight: best.height,
      selectedBitrate: best.bitrate,
      selectedLabel: best.label,
      levels: summary
    };
  }

  function applyRadiantHlsLevel() {
    try {
      const pageWindow = window.wrappedJSObject || window;
      const player = pageWindow.rmp;
      if (!player || typeof player.getHlsJSInstance !== "function") {
        return null;
      }
      const hls = player.getHlsJSInstance();
      if (!hls || !hls.levels || !hls.levels.length) {
        return { source: "radiant-hlsjs", applied: false, reason: "no-hls-levels" };
      }
      const levels = Array.from(hls.levels).map((level, index) => ({
        ref: level,
        index,
        height: level.height,
        width: level.width,
        bitrate: level.bitrate || level.maxBitrate || level.averageBitrate,
        label: level.name || level.attrs && level.attrs.RESOLUTION || ""
      }));
      const best = chooseBestLevel(levels);
      if (!best) {
        return { source: "radiant-hlsjs", applied: false, reason: "no-selectable-hls-levels" };
      }
      if (typeof hls.autoLevelCapping === "number") {
        hls.autoLevelCapping = best.index;
      }
      hls.startLevel = best.index;
      hls.nextLevel = best.index;
      hls.loadLevel = best.index;
      if (hls.currentLevel !== best.index) {
        hls.currentLevel = best.index;
      }
      return {
        source: "radiant-hlsjs",
        applied: true,
        selectedHeight: best.height,
        selectedBitrate: best.bitrate,
        selectedLabel: best.label,
        currentLevel: hls.currentLevel,
        loadLevel: hls.loadLevel,
        nextLevel: hls.nextLevel,
        levels: levels.map((level) => ({
          index: level.index,
          height: numberOrZero(level.height),
          width: numberOrZero(level.width),
          bitrate: numberOrZero(level.bitrate),
          label: level.label || "",
          enabled: level.index === best.index
        }))
      };
    } catch (error) {
      return { source: "radiant-hlsjs", applied: false, reason: error.message || "error" };
    }
  }

  function hasAbsTegoPlaybackProgressed(videos) {
    return videos.some((video) => {
      const currentTime = numberOrZero(video.currentTime);
      if (currentTime >= 1.0) return true;
      return (
        numberOrZero(video.videoWidth) > 0 &&
        numberOrZero(video.videoHeight) > 0 &&
        numberOrZero(video.readyState) >= 4 &&
        !video.paused
      );
    });
  }

  function analyzeTegoPlayback(videos, results) {
    const playable = videos.some((video) =>
      video.videoWidth > 0 &&
      video.videoHeight > 0 &&
      (video.readyState >= 4 || (video.readyState >= 1 && !video.paused) || video.currentTime > 0)
    );
    const playbackProgressed = hasAbsTegoPlaybackProgressed(videos);
    const readyZeroPaused = !videos.length || videos.every((video) => video.readyState === 0 && !!video.paused);
    const applied = results.some((result) => result && !!result.applied);
    const missingHlsLevels = results.some((result) => {
      if (!result || result.source !== "radiant-hlsjs" || result.applied) return false;
      const reason = String(result.reason || "");
      return reason.indexOf("no-hls-levels") >= 0 || reason.indexOf("no-selectable-hls-levels") >= 0;
    });
    return { playable, playbackProgressed, readyZeroPaused, applied, missingHlsLevels };
  }

  function applyTegoQualityPolicy() {
    if (!isTegoPlayerFrame()) return null;
    const results = [];
    const players = readVideoJsPlayers();
    const radiantResult = applyRadiantHlsLevel();
    if (radiantResult) {
      results.push(radiantResult);
    }

    players.forEach((player, playerIndex) => {
      try {
        if (typeof player.qualityLevels === "function") {
          const qualityLevels = player.qualityLevels();
          const levels = [];
          for (let index = 0; qualityLevels && index < qualityLevels.length; index += 1) {
            const level = qualityLevels[index];
            levels.push({
              ref: level,
              height: level.height,
              width: level.width,
              bitrate: level.bitrate,
              label: level.label || level.id || "",
              enabled: getEnabledFlag(level)
            });
          }
          results.push(applyLevelSet(levels, "videojs-qualityLevels#" + playerIndex));
        }
      } catch (error) {
        results.push({ source: "videojs-qualityLevels#" + playerIndex, applied: false, reason: error.message || "error" });
      }

      try {
        const tech = typeof player.tech === "function" ? player.tech(true) : null;
        const vhs = tech && (tech.vhs || tech.hls);
        const reps = vhs && typeof vhs.representations === "function" ? vhs.representations() : [];
        if (reps && reps.length) {
          const levels = Array.from(reps).map((rep) => ({
            ref: rep,
            height: rep.height,
            width: rep.width,
            bitrate: rep.bandwidth || rep.bitrate,
            label: rep.id || ""
          }));
          results.push(applyLevelSet(levels, "videojs-vhs-representations#" + playerIndex));
        }
      } catch (error) {
        results.push({ source: "videojs-vhs-representations#" + playerIndex, applied: false, reason: error.message || "error" });
      }
    });

    try {
      const videos = Array.from(document.querySelectorAll("video")).map((video, index) => ({
        index,
        src: (video.currentSrc || video.src || "").slice(0, 180),
        videoWidth: video.videoWidth || 0,
        videoHeight: video.videoHeight || 0,
        readyState: video.readyState || 0,
        networkState: video.networkState || 0,
        currentTime: typeof video.currentTime === "number" ? video.currentTime : 0,
        paused: !!video.paused
      }));
      const analyzed = analyzeTegoPlayback(videos, results);
      const payload = {
        type: "tego-quality",
        phase: "content-tego-quality",
        pageUrl: window.location.href,
        title: document.title || "",
        playerCount: players.length,
        applied: analyzed.applied,
        results,
        videos
      };
      const signature = JSON.stringify(payload);
      if (signature !== lastTegoSignature) {
        lastTegoSignature = signature;
        promptPayload(payload);
      }
      return {
        pageUrl: payload.pageUrl,
        applied: analyzed.applied,
        playable: analyzed.playable,
        playbackProgressed: analyzed.playbackProgressed,
        readyZeroPaused: analyzed.readyZeroPaused,
        missingHlsLevels: analyzed.missingHlsLevels,
        results,
        videos
      };
    } catch (_) {}
    return null;
  }

  function dispatchAbsTegoStartupReprobe(attemptAtMs) {
    if (!isAbsTegoChannel10Frame()) return null;
    const snapshot = applyTegoQualityPolicy();
    if (!snapshot) return null;
    promptPayload({
      type: "tego-startup-reprobe",
      phase: "content-tego-startup-reprobe",
      pageUrl: snapshot.pageUrl,
      attemptAtMs,
      applied: !!snapshot.applied,
      playable: !!snapshot.playable,
      playbackProgressed: !!snapshot.playbackProgressed,
      missingHlsLevels: !!snapshot.missingHlsLevels,
      readyZeroPaused: !!snapshot.readyZeroPaused,
      results: snapshot.results,
      videos: snapshot.videos
    });
    return snapshot;
  }

  function shouldContinueAbsTegoStartupReprobe(snapshot) {
    if (!snapshot) return false;
    if (isTttTegoFrame()) {
      if (snapshotHasPlayingVideo(snapshot)) return false;
      return true;
    }
    if (snapshot.playbackProgressed) return false;
    if (snapshot.readyZeroPaused) return true;
    if (snapshot.missingHlsLevels) return true;
    if (snapshot.applied) return true;
    if (snapshot.playable) return true;
    return false;
  }

  function snapshotHasPlayingVideo(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.videos)) return false;
    return snapshot.videos.some((video) => {
      const ready = Number(video && video.readyState || 0);
      const paused = !!(video && video.paused);
      const width = Number(video && video.videoWidth || 0);
      const height = Number(video && video.videoHeight || 0);
      const currentTime = Number(video && video.currentTime || 0);
      return !paused && ready >= 1 && width > 0 && height > 0 && currentTime >= 0;
    });
  }

  function snapshotHasPausedReadyVideo(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.videos)) return false;
    return snapshot.videos.some((video) => {
      const ready = Number(video && video.readyState || 0);
      const paused = !!(video && video.paused);
      const width = Number(video && video.videoWidth || 0);
      const height = Number(video && video.videoHeight || 0);
      return paused && ready >= 1 && width > 0 && height > 0;
    });
  }

  function summarizeTttStartupVideos(videos) {
    if (!Array.isArray(videos) || videos.length === 0) return "none";
    return videos.slice(0, 3).map((video, index) => {
      const width = Number(video && video.videoWidth || 0);
      const height = Number(video && video.videoHeight || 0);
      const ready = Number(video && video.readyState || 0);
      const paused = !!(video && video.paused);
      return `#${index + 1}:${width}x${height}:ready=${ready}:paused=${paused}`;
    }).join("|");
  }

  function resolveTttStartupState(snapshot) {
    if (!snapshot) return "loading-no-snapshot";
    if (snapshotHasPlayingVideo(snapshot) || snapshot.playbackProgressed) return "playing";
    if (snapshotHasPausedReadyVideo(snapshot)) return "paused-ready";
    if (snapshot.missingHlsLevels) return "loading-hls-levels";
    if (snapshot.readyZeroPaused) return "loading-ready0-paused";
    return "loading-video-readiness";
  }

  function emitTttStartupState(snapshot, attemptAtMs, phase, wakeAttempted, wakeSkippedReason) {
    if (!isTttTegoFrame()) return;
    const state = resolveTttStartupState(snapshot);
    const applied = !!(snapshot && snapshot.applied);
    const playable = !!(snapshot && snapshot.playable);
    const playbackProgressed = !!(snapshot && snapshot.playbackProgressed);
    const missingHlsLevels = !!(snapshot && snapshot.missingHlsLevels);
    const readyZeroPaused = !!(snapshot && snapshot.readyZeroPaused);
    const key = `${state}|${applied}|${playable}|${playbackProgressed}|${missingHlsLevels}|${readyZeroPaused}|${wakeAttempted}|${wakeSkippedReason || ""}`;
    if (key === tttTegoStartupStateLastKey && state !== "paused-ready") {
      return;
    }
    tttTegoStartupStateLastKey = key;
    promptPayload({
      type: "ttt-tego-startup-state",
      phase: String(phase || "content-ttt-tego-startup-state"),
      pageUrl: window.location.href,
      attemptAtMs: numberOrZero(attemptAtMs),
      state,
      applied,
      playable,
      playbackProgressed,
      missingHlsLevels,
      readyZeroPaused,
      wakeAttempted: !!wakeAttempted,
      wakeSkippedReason: String(wakeSkippedReason || ""),
      videos: snapshot && Array.isArray(snapshot.videos) ? snapshot.videos : [],
      videoSummary: summarizeTttStartupVideos(snapshot && snapshot.videos),
      results: snapshot && Array.isArray(snapshot.results) ? snapshot.results : []
    });
  }

  function safeMethodCall(target, methodName, args, methods) {
    try {
      if (!target || typeof target[methodName] !== "function") return false;
      target[methodName].apply(target, args || []);
      if (methods) methods.push(methodName);
      return true;
    } catch (_) {
      return false;
    }
  }

  function attemptAbsTegoStartupWake(attemptAtMs) {
    if (!isAbsTegoChannel10Frame()) return null;
    const methods = [];
    let clickedPlay = false;
    let playCalls = 0;
    let wakeErrors = 0;
    try {
      const videos = Array.from(document.querySelectorAll("video")).slice(0, 6);
      videos.forEach((video) => {
        try {
          video.autoplay = true;
          video.playsInline = true;
          video.muted = false;
          if (typeof video.volume === "number" && video.volume < 1) {
            video.volume = 1;
          }
          const playResult = video.play();
          playCalls += 1;
          if (playResult && typeof playResult.then === "function") {
            playResult.catch(() => {});
          }
        } catch (_) {
          wakeErrors += 1;
        }
      });

      const players = readVideoJsPlayers();
      players.forEach((player) => {
        try {
          safeMethodCall(player, "muted", [false], methods);
          safeMethodCall(player, "volume", [1], methods);
          if (safeMethodCall(player, "play", [], methods)) {
            playCalls += 1;
          }
        } catch (_) {
          wakeErrors += 1;
        }
      });

      const pageWindow = window.wrappedJSObject || window;
      const rmp = pageWindow && pageWindow.rmp;
      if (rmp) {
        safeMethodCall(rmp, "muted", [false], methods);
        safeMethodCall(rmp, "setVolume", [1], methods);
        safeMethodCall(rmp, "setVolume", [100], methods);
        try {
          if (typeof rmp.getHlsJSInstance === "function") {
            const hls = rmp.getHlsJSInstance();
            if (hls) {
              safeMethodCall(hls, "startLoad", [-1], methods);
              safeMethodCall(hls, "startLoad", [], methods);
            }
          }
        } catch (_) {}
        if (safeMethodCall(rmp, "play", [], methods)) {
          playCalls += 1;
        }
        safeMethodCall(rmp, "resume", [], methods);
      }

      const playButton = Array.from(
        document.querySelectorAll("button,[role='button'],.rmp-play-button,.vjs-big-play-button")
      ).find((node) => {
        if (!isVisible(node)) return false;
        const text = ((node.innerText || node.textContent || node.getAttribute("aria-label") || "") + "").trim().toLowerCase();
        if (!text) return false;
        if (text.indexOf("play") >= 0 && text.indexOf("replay") < 0 && text.indexOf("pause") < 0) return true;
        return false;
      });
      if (playButton) {
        try {
          playButton.click();
          clickedPlay = true;
        } catch (_) {
          wakeErrors += 1;
        }
      }
      if (!clickedPlay && isTttTegoFrame()) {
        let tttPlayRect = null;
        const tttPlayCandidate = Array.from(
          document.querySelectorAll("button,[role='button'],.rmp-button,.rmp-i,.rmp-play-button,.rmp-control-bar *")
        ).find((node) => {
          if (!isVisible(node)) return false;
          const cls = String(node.className || "").toLowerCase();
          const aria = String(node.getAttribute && node.getAttribute("aria-label") || "").toLowerCase();
          const title = String(node.getAttribute && node.getAttribute("title") || "").toLowerCase();
          const text = String(node.innerText || node.textContent || "").trim().toLowerCase();
          if (cls.indexOf("pause") >= 0 || aria.indexOf("pause") >= 0 || title.indexOf("pause") >= 0 || text.indexOf("pause") >= 0) return false;
          return (
            cls.indexOf("play") >= 0 ||
            cls.indexOf("rmp-i-play") >= 0 ||
            aria.indexOf("play") >= 0 ||
            title.indexOf("play") >= 0 ||
            text === "play"
          );
        });
        if (tttPlayCandidate) {
          try {
            tttPlayRect = tttPlayCandidate.getBoundingClientRect();
          } catch (_) {
            tttPlayRect = null;
          }
          try {
            tttPlayCandidate.click();
            clickedPlay = true;
            methods.push("ttt-play-candidate-click");
          } catch (_) {
            wakeErrors += 1;
          }
          if (ENABLE_TTT_TEGO_AUTOSTART_HACKS && tttPlayRect && tttPlayRect.width >= 24 && tttPlayRect.height >= 24) {
            const centerX = tttPlayRect.left + Math.max(1, Math.floor(tttPlayRect.width / 2));
            const centerY = tttPlayRect.top + Math.max(1, Math.floor(tttPlayRect.height / 2));
            const rectText = `${Math.round(tttPlayRect.left)},${Math.round(tttPlayRect.top)} ${Math.round(tttPlayRect.width)}x${Math.round(tttPlayRect.height)}`;
            const summary = summarizeNode(tttPlayCandidate);
            postTttTegoStartupNativePlayRequest(attemptAtMs, summary, rectText, centerX, centerY, "ttt-paused-after-play-candidate", false);
          }
        } else if (ENABLE_TTT_TEGO_AUTOSTART_HACKS) {
          maybePostTttTegoVideoCenterNativePlayRequest(attemptAtMs, "ttt-no-play-candidate-video-center", false);
        }
      }
      if (ENABLE_TTT_TEGO_AUTOSTART_HACKS && isTttTegoFrame() && !tttTegoStartupNativePlayRequestPosted) {
        maybePostTttTegoVideoCenterNativePlayRequest(attemptAtMs, "ttt-post-wake-video-center", false);
      }
    } catch (_) {
      wakeErrors += 1;
    }

    const payload = {
      type: "tego-startup-wake",
      phase: "content-tego-startup-wake",
      pageUrl: window.location.href,
      attemptAtMs,
      playCalls,
      clickedPlay,
      methods,
      wakeErrors
    };
    promptPayload(payload);
    return payload;
  }

  function currentFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement || null;
  }

  function isInFullscreen() {
    return !!currentFullscreenElement();
  }

  function summarizeNode(node) {
    if (!node) return "none";
    const tag = (node.tagName || "").toLowerCase();
    const id = (node.id || "").trim();
    const cls = (typeof node.className === "string" ? node.className : "").trim().replace(/\s+/g, ".");
    return [tag, id ? "#" + id : "", cls ? "." + cls : ""].join("");
  }

  function hasFullscreenKeyword(node) {
    if (!node || typeof node.getAttribute !== "function") return false;
    const text = (
      (node.innerText || node.textContent || "") +
      " " +
      (node.getAttribute("aria-label") || "") +
      " " +
      (node.getAttribute("title") || "") +
      " " +
      (node.getAttribute("data-title") || "") +
      " " +
      (node.getAttribute("data-tooltip") || "")
    )
      .trim()
      .toLowerCase();
    if (!text) return false;
    return (
      text.indexOf("fullscreen") >= 0 ||
      text.indexOf("full screen") >= 0 ||
      text.indexOf("expand") >= 0 ||
      text.indexOf("maximize") >= 0
    );
  }

  function isLikelyFullscreenControl(node) {
    if (!node) return false;
    const rect = controlRect(node);
    const sizeOk = rect.width >= 24 && rect.height >= 24;
    if (!sizeOk) return false;
    const classBlob = ((node.className || "") + "").toLowerCase();
    const textBlob = (
      (node.innerText || node.textContent || "") +
      " " +
      (node.getAttribute && node.getAttribute("aria-label") || "") +
      " " +
      (node.getAttribute && node.getAttribute("title") || "") +
      " " +
      (node.getAttribute && node.getAttribute("data-title") || "") +
      " " +
      (node.getAttribute && node.getAttribute("data-tooltip") || "")
    )
      .trim()
      .toLowerCase();
    const isRmpFullscreen =
      classBlob.indexOf("rmp-fullscreen") >= 0 ||
      classBlob.indexOf("rmp-i-resize-full") >= 0;
    const hasFullscreenText =
      textBlob.indexOf("enter full screen") >= 0 ||
      textBlob.indexOf("fullscreen") >= 0 ||
      textBlob.indexOf("full screen") >= 0;

    // ABS/Tego-specific bypass: accept the known RMP fullscreen control even when
    // computed visibility reports false, as long as geometry and marker text/class match.
    if (isAbsTegoChannel10Frame() && (isRmpFullscreen || hasFullscreenText)) {
      return true;
    }

    if (!isVisible(node)) return false;
    if (
      classBlob.indexOf("rmp-fullscreen") >= 0 ||
      classBlob.indexOf("vjs-fullscreen") >= 0 ||
      classBlob.indexOf("jw-icon-fullscreen") >= 0
    ) {
      return true;
    }
    const dataControl = ((node.getAttribute && node.getAttribute("data-control")) || "").toLowerCase();
    if (dataControl.indexOf("fullscreen") >= 0) {
      return true;
    }
    return hasFullscreenKeyword(node);
  }

  function controlRect(node) {
    try {
      const rect = node.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    } catch (_) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }
  }

  function rectAsText(rect) {
    return `${rect.left},${rect.top} ${rect.width}x${rect.height}`;
  }

  function styleValue(node, key, fallback) {
    try {
      const style = window.getComputedStyle(node);
      if (!style) return fallback || "";
      return String(style[key] || fallback || "");
    } catch (_) {
      return fallback || "";
    }
  }

  function shortText(value, limit) {
    const max = Math.max(16, Number(limit) || 140);
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length <= max) return text;
    return text.slice(0, max);
  }

  function nodeSummary(node) {
    if (!node) return null;
    const rect = controlRect(node);
    return {
      tag: String((node.tagName || "").toLowerCase()),
      className: shortText(typeof node.className === "string" ? node.className : "", 180),
      id: shortText(node.id || "", 80),
      role: shortText((node.getAttribute && node.getAttribute("role")) || "", 40),
      ariaLabel: shortText((node.getAttribute && node.getAttribute("aria-label")) || "", 140),
      title: shortText((node.getAttribute && node.getAttribute("title")) || "", 140),
      dataTitle: shortText((node.getAttribute && node.getAttribute("data-title")) || "", 140),
      dataTooltip: shortText((node.getAttribute && node.getAttribute("data-tooltip")) || "", 140),
      text: shortText((node.innerText || node.textContent || ""), 160),
      visible: isVisible(node),
      rect,
      pointerEvents: shortText(styleValue(node, "pointerEvents", ""), 30),
      opacity: shortText(styleValue(node, "opacity", ""), 12),
      display: shortText(styleValue(node, "display", ""), 24),
      visibility: shortText(styleValue(node, "visibility", ""), 24)
    };
  }

  function rectIntersects(a, b) {
    if (!a || !b) return false;
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function serializeNodeWithStyle(node) {
    if (!node) return null;
    const rect = controlRect(node);
    return {
      summary: summarizeNode(node),
      tag: String((node.tagName || "").toLowerCase()),
      className: shortText(typeof node.className === "string" ? node.className : "", 180),
      id: shortText(node.id || "", 80),
      role: shortText((node.getAttribute && node.getAttribute("role")) || "", 40),
      ariaLabel: shortText((node.getAttribute && node.getAttribute("aria-label")) || "", 140),
      text: shortText((node.innerText || node.textContent || ""), 100),
      rect,
      zIndex: shortText(styleValue(node, "zIndex", ""), 16),
      position: shortText(styleValue(node, "position", ""), 20),
      opacity: shortText(styleValue(node, "opacity", ""), 12),
      display: shortText(styleValue(node, "display", ""), 24),
      visibility: shortText(styleValue(node, "visibility", ""), 24),
      pointerEvents: shortText(styleValue(node, "pointerEvents", ""), 24)
    };
  }

  function sampleElementAt(label, x, y) {
    const clampedX = Math.max(0, Math.min(Math.floor(window.innerWidth || 0) - 1, Math.round(x)));
    const clampedY = Math.max(0, Math.min(Math.floor(window.innerHeight || 0) - 1, Math.round(y)));
    const element = document.elementFromPoint(clampedX, clampedY);
    const item = {
      label,
      x: clampedX,
      y: clampedY,
      element: serializeNodeWithStyle(element),
      parentChain: []
    };
    let current = element && element.parentElement;
    let depth = 0;
    while (current && depth < 6) {
      item.parentChain.push(serializeNodeWithStyle(current));
      current = current.parentElement;
      depth += 1;
    }
    return item;
  }

  function collectOverlappingVisibleNodes(videoRect) {
    const nodes = Array.from(document.querySelectorAll("div,span,button,img,svg,[role='button']")).slice(0, 1200);
    const items = [];
    nodes.forEach((node) => {
      if (items.length >= 120) return;
      try {
        if (!node || !isVisible(node)) return;
        if (node.tagName === "VIDEO") return;
        if (node.id === "rmpPlayer" || node.classList.contains("rmp-container")) return;
        if (node.closest && node.closest("html,body,video,#rmpPlayer,.rmp-container")) return;
        const rect = node.getBoundingClientRect();
        if (rect.width < 10 || rect.height < 10) return;
        if (!rectIntersects(rect, videoRect)) return;
        const serialized = serializeNodeWithStyle(node);
        if (!serialized) return;
        const zRaw = Number.parseInt(String(serialized.zIndex || ""), 10);
        const z = Number.isFinite(zRaw) ? zRaw : -9999;
        const area = Math.max(1, serialized.rect.width * serialized.rect.height);
        items.push({ ...serialized, _z: z, _area: area });
      } catch (_) {}
    });
    items.sort((a, b) => (b._z - a._z) || (b._area - a._area));
    return items.slice(0, 40).map((entry) => {
      const { _z, _area, ...rest } = entry;
      return rest;
    });
  }

  function emitAbsTegoPostStableLayerDump(reason) {
    if (!isAbsTegoChannel10Frame() || absTegoPostStableLayerDumpDone) return;
    const videos = Array.from(document.querySelectorAll("video"));
    const primaryVideo = videos.find((video) => isVisible(video)) || videos[0];
    if (!primaryVideo) return;
    const stableVideo = (
      numberOrZero(primaryVideo.videoWidth) >= 1200 &&
      numberOrZero(primaryVideo.videoHeight) >= 680 &&
      numberOrZero(primaryVideo.readyState) >= 3 &&
      !primaryVideo.paused
    );
    if (!stableVideo || !absTegoFullscreenLikeApplied) return;
    const videoRectDom = primaryVideo.getBoundingClientRect();
    const videoRect = {
      left: Math.round(videoRectDom.left),
      top: Math.round(videoRectDom.top),
      right: Math.round(videoRectDom.right),
      bottom: Math.round(videoRectDom.bottom),
      width: Math.round(videoRectDom.width),
      height: Math.round(videoRectDom.height)
    };
    const w = Math.max(1, Math.floor(window.innerWidth || 0));
    const h = Math.max(1, Math.floor(window.innerHeight || 0));
    const points = [
      ["center", w * 0.5, h * 0.5],
      ["top-left-quadrant", w * 0.25, h * 0.25],
      ["top-center", w * 0.5, h * 0.18],
      ["top-right-quadrant", w * 0.75, h * 0.25],
      ["bottom-left", w * 0.25, h * 0.82],
      ["bottom-center", w * 0.5, h * 0.86],
      ["bottom-right", w * 0.75, h * 0.82]
    ];
    const samples = points.map(([label, x, y]) => sampleElementAt(label, x, y));
    const overlaps = collectOverlappingVisibleNodes(videoRectDom);
    absTegoPostStableLayerDumpDone = true;
    promptPayload({
      type: "abs-tego-post-stable-layer-dump",
      phase: "content-abs-tego-post-stable-layer-dump",
      pageUrl: window.location.href,
      reason: String(reason || "post-stable"),
      viewport: { width: w, height: h },
      videoRect,
      sampleCount: samples.length,
      samples,
      overlapCount: overlaps.length,
      overlaps
    });
  }

  function scheduleAbsTegoPostStableLayerDump(reason) {
    if (!isAbsTegoChannel10Frame() || absTegoPostStableLayerDumpDone || absTegoPostStableLayerDumpScheduled) return;
    absTegoPostStableLayerDumpScheduled = true;
    setTimeout(() => {
      absTegoPostStableLayerDumpScheduled = false;
      emitAbsTegoPostStableLayerDump(reason || "post-stable-delay");
    }, 600);
  }

  function isSameOrRelatedNode(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    try {
      if (typeof a.contains === "function" && a.contains(b)) return true;
    } catch (_) {}
    try {
      if (typeof b.contains === "function" && b.contains(a)) return true;
    } catch (_) {}
    return false;
  }

  function userActivationState() {
    try {
      if (!navigator || !navigator.userActivation) {
        return { isActive: false, hasBeenActive: false, available: false };
      }
      return {
        isActive: !!navigator.userActivation.isActive,
        hasBeenActive: !!navigator.userActivation.hasBeenActive,
        available: true
      };
    } catch (_) {
      return { isActive: false, hasBeenActive: false, available: false };
    }
  }

  function preflightStyleSummary(node) {
    return {
      display: shortText(styleValue(node, "display", ""), 24),
      visibility: shortText(styleValue(node, "visibility", ""), 24),
      opacity: shortText(styleValue(node, "opacity", ""), 16),
      pointerEvents: shortText(styleValue(node, "pointerEvents", ""), 24),
      zIndex: shortText(styleValue(node, "zIndex", ""), 24)
    };
  }

  function emitAbsTegoFullscreenPreflight(control, attemptAtMs, path) {
    if (!isAbsTegoChannel10Frame() || !control) return;
    const rect = controlRect(control);
    const centerX = rect.left + Math.max(1, Math.floor(rect.width / 2));
    const centerY = rect.top + Math.max(1, Math.floor(rect.height / 2));
    let pointNode = null;
    try {
      pointNode = document.elementFromPoint(centerX, centerY);
    } catch (_) {
      pointNode = null;
    }
    const pointMatchesControl = isSameOrRelatedNode(pointNode, control);
    const container = document.querySelector(".rmp-container,#rmpPlayer,#rmp");
    const controlBar = document.querySelector(".rmp-control-bar,.rmp-controls");
    const payload = {
      type: "abs-tego-fullscreen-preflight",
      phase: "content-abs-tego-fullscreen-preflight",
      pageUrl: window.location.href,
      path: String(path || "unknown"),
      attemptAtMs: numberOrZero(attemptAtMs),
      documentHasFocus: !!document.hasFocus(),
      activeElement: summarizeNode(document.activeElement),
      buttonSummary: summarizeNode(control),
      buttonRect: rectAsText(rect),
      buttonStyle: preflightStyleSummary(control),
      elementFromPoint: summarizeNode(pointNode),
      elementFromPointMatchesButton: pointMatchesControl,
      containerClassList: shortText(container && container.className ? String(container.className) : "", 220),
      controlBarVisible: !!(controlBar && isVisible(controlBar)),
      fullscreenActive: isInFullscreen(),
      fullscreenElement: summarizeNode(currentFullscreenElement()),
      userActivation: userActivationState()
    };
    promptPayload(payload);
  }

  function hasAbsTegoStableVideo(snapshot) {
    const videos = snapshot && Array.isArray(snapshot.videos) ? snapshot.videos : [];
    return videos.some((video) => {
      return (
        numberOrZero(video.videoWidth) > 0 &&
        numberOrZero(video.videoHeight) > 0 &&
        numberOrZero(video.readyState) >= 3 &&
        !video.paused
      );
    });
  }

  function evaluateAbsTegoFullscreenGate(control, snapshot) {
    const gate = {
      pass: false,
      reason: "unknown",
      rect: "0,0 0x0",
      centerX: -1,
      centerY: -1,
      controlBarVisible: false,
      elementFromPoint: "none",
      pointMatches: false,
      buttonStyle: {
        display: "",
        visibility: "",
        opacity: "",
        pointerEvents: "",
        zIndex: ""
      },
      playbackProgressed: !!(snapshot && snapshot.playbackProgressed),
      stableVideo: hasAbsTegoStableVideo(snapshot),
      containerClassList: ""
    };
    if (!control) {
      gate.reason = "control-missing";
      return gate;
    }
    const rect = controlRect(control);
    gate.rect = rectAsText(rect);
    gate.centerX = rect.left + Math.max(1, Math.floor(rect.width / 2));
    gate.centerY = rect.top + Math.max(1, Math.floor(rect.height / 2));
    gate.buttonStyle = preflightStyleSummary(control);
    const controlBar = document.querySelector(".rmp-control-bar,.rmp-controls");
    const container = document.querySelector(".rmp-container,#rmpPlayer,#rmp");
    gate.containerClassList = shortText(container && container.className ? String(container.className) : "", 220);
    gate.controlBarVisible = !!(controlBar && isVisible(controlBar));
    let pointNode = null;
    try {
      pointNode = document.elementFromPoint(gate.centerX, gate.centerY);
    } catch (_) {
      pointNode = null;
    }
    gate.elementFromPoint = summarizeNode(pointNode);
    gate.pointMatches = isSameOrRelatedNode(pointNode, control);

    if (rect.width < 24 || rect.height < 24) {
      gate.reason = "rect-too-small";
      return gate;
    }
    if (!gate.controlBarVisible) {
      gate.reason = "control-bar-hidden";
      return gate;
    }
    const visibility = String(gate.buttonStyle.visibility || "").toLowerCase();
    if (visibility === "hidden" || visibility === "collapse") {
      gate.reason = "button-visibility-hidden";
      return gate;
    }
    const display = String(gate.buttonStyle.display || "").toLowerCase();
    if (display === "none") {
      gate.reason = "button-display-none";
      return gate;
    }
    const pointerEvents = String(gate.buttonStyle.pointerEvents || "").toLowerCase();
    if (pointerEvents === "none") {
      gate.reason = "button-pointer-events-none";
      return gate;
    }
    if (!gate.pointMatches) {
      gate.reason = "point-mismatch";
      return gate;
    }
    if (!gate.playbackProgressed) {
      gate.reason = "playback-not-progressed";
      return gate;
    }
    if (!gate.stableVideo) {
      gate.reason = "video-not-stable";
      return gate;
    }
    if (String(gate.containerClassList || "").toLowerCase().indexOf("rmp-waiting") >= 0) {
      gate.reason = "player-waiting";
      return gate;
    }
    gate.pass = true;
    gate.reason = "ok";
    return gate;
  }

  function emitAbsTegoFullscreenGateSkip(attemptAtMs, controlSummary, gate) {
    promptPayload({
      type: "abs-tego-fullscreen-gate-skip",
      phase: "content-abs-tego-fullscreen-gate-skip",
      pageUrl: window.location.href,
      attemptAtMs,
      reason: String((gate && gate.reason) || "unknown"),
      controlSummary: String(controlSummary || "none"),
      controlBarVisible: !!(gate && gate.controlBarVisible),
      buttonStyle: (gate && gate.buttonStyle) || {},
      elementFromPoint: String((gate && gate.elementFromPoint) || "none"),
      pointMatches: !!(gate && gate.pointMatches),
      rect: String((gate && gate.rect) || "0,0 0x0"),
      centerX: Number((gate && gate.centerX) || -1),
      centerY: Number((gate && gate.centerY) || -1),
      playbackProgressed: !!(gate && gate.playbackProgressed),
      stableVideo: !!(gate && gate.stableVideo),
      containerClassList: String((gate && gate.containerClassList) || "")
    });
  }

  function emitAbsTegoFullscreenButtonEvent(event, control, path, attemptAtMs) {
    if (!isAbsTegoChannel10Frame() || !event || !control) return;
    const rect = controlRect(control);
    const centerX = rect.left + Math.max(1, Math.floor(rect.width / 2));
    const centerY = rect.top + Math.max(1, Math.floor(rect.height / 2));
    const payload = {
      type: "abs-tego-fullscreen-button-event",
      phase: "content-abs-tego-fullscreen-button-event",
      pageUrl: window.location.href,
      path: String(path || "unknown"),
      attemptAtMs: numberOrZero(attemptAtMs),
      eventType: String(event.type || ""),
      isTrusted: !!event.isTrusted,
      target: summarizeNode(event.target),
      currentTarget: summarizeNode(event.currentTarget),
      buttonSummary: summarizeNode(control),
      buttonRect: rectAsText(rect),
      buttonCenterX: centerX,
      buttonCenterY: centerY,
      activeElement: summarizeNode(document.activeElement),
      fullscreenActive: isInFullscreen(),
      fullscreenElement: summarizeNode(currentFullscreenElement()),
      userActivation: userActivationState()
    };
    promptPayload(payload);
  }

  function emitAbsTegoFullscreenTransition(path, trigger, attemptAtMs) {
    if (!isAbsTegoChannel10Frame()) return;
    promptPayload({
      type: "abs-tego-fullscreen-transition",
      phase: "content-abs-tego-fullscreen-transition",
      pageUrl: window.location.href,
      path: String(path || "unknown"),
      trigger: String(trigger || "unknown"),
      attemptAtMs: numberOrZero(attemptAtMs),
      documentHasFocus: !!document.hasFocus(),
      activeElement: summarizeNode(document.activeElement),
      fullscreenActive: isInFullscreen(),
      fullscreenElement: summarizeNode(currentFullscreenElement()),
      userActivation: userActivationState()
    });
  }

  function attachAbsTegoFullscreenDiagnostics(control, attemptAtMs) {
    if (!isAbsTegoChannel10Frame() || !control) return;
    if (!absTegoFullscreenDiagListenersAttached) {
      absTegoFullscreenDiagListenersAttached = true;
      const eventTypes = ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "keydown"];
      eventTypes.forEach((type) => {
        document.addEventListener(
          type,
          (event) => {
            emitAbsTegoFullscreenButtonEvent(event, control, absTegoAutomatedFullscreenInFlight ? "automated" : "manual", attemptAtMs);
          },
          true
        );
      });
      document.addEventListener(
        "fullscreenchange",
        () => {
          emitAbsTegoFullscreenTransition(absTegoAutomatedFullscreenInFlight ? "automated" : "manual", "fullscreenchange", attemptAtMs);
        },
        true
      );
    }
    if (!absTegoFullscreenControlListenersAttached) {
      absTegoFullscreenControlListenersAttached = true;
      const buttonEvents = ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "keydown"];
      buttonEvents.forEach((type) => {
        control.addEventListener(
          type,
          (event) => emitAbsTegoFullscreenButtonEvent(event, control, absTegoAutomatedFullscreenInFlight ? "automated" : "manual", attemptAtMs),
          true
        );
      });
    }
  }

  function collectAbsTegoVisibleControls() {
    if (!isAbsTegoChannel10Frame()) return [];
    const selectors = [
      "button",
      "[role='button']",
      "[aria-label]",
      "[title]",
      "[data-title]",
      "[data-tooltip]",
      "[class*='full']",
      "[class*='screen']",
      "[class*='expand']",
      "[class*='control']",
      ".rmp-control-bar *",
      ".rmp-module *",
      ".rmp-container *"
    ];
    const unique = new Set();
    const items = [];
    selectors.forEach((selector) => {
      if (items.length >= 80) return;
      let nodes = [];
      try {
        nodes = Array.from(document.querySelectorAll(selector));
      } catch (_) {
        nodes = [];
      }
      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        if (!node || unique.has(node)) continue;
        unique.add(node);
        const summary = nodeSummary(node);
        if (!summary) continue;
        items.push(summary);
        if (items.length >= 80) break;
      }
    });
    return items;
  }

  function postAbsTegoFullscreenNativeRequest(attemptAtMs, controlSummary, rectText, centerX, centerY) {
    if (!isAbsTegoChannel10Frame() || window.parent === window) return false;
    try {
      window.parent.postMessage(
        {
          type: "kf-abs-tego-fullscreen-native-request",
          playerUrl: window.location.href,
          attemptAtMs,
          controlSummary,
          controlRect: rectText,
          frameCenterX: centerX,
          frameCenterY: centerY
        },
        "*"
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  function postAbsTegoFullscreenNativeHover(attemptAtMs, controlSummary, rectText, centerX, centerY, reason) {
    if (!isAbsTegoChannel10Frame() || window.parent === window) return false;
    try {
      window.parent.postMessage(
        {
          type: "kf-abs-tego-fullscreen-native-hover",
          playerUrl: window.location.href,
          attemptAtMs,
          controlSummary,
          controlRect: rectText,
          frameCenterX: centerX,
          frameCenterY: centerY,
          reason: String(reason || "reveal-controls")
        },
        "*"
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  function postTttTegoStartupNativePlayRequest(attemptAtMs, controlSummary, rectText, centerX, centerY, reason, allowRetry) {
    if (!isTttTegoFrame() || window.parent === window) return false;
    if (tttTegoStartupNativePlayRequestPosted && !allowRetry) return false;
    try {
      window.parent.postMessage(
        {
          type: "kf-abs-tego-startup-native-play-request",
          playerUrl: window.location.href,
          attemptAtMs,
          controlSummary,
          controlRect: rectText,
          frameCenterX: centerX,
          frameCenterY: centerY,
          reason: String(reason || "ttt-startup-paused")
        },
        "*"
      );
      tttTegoStartupNativePlayRequestPosted = true;
      return true;
    } catch (_) {
      return false;
    }
  }

  function maybePostTttTegoVideoCenterNativePlayRequest(attemptAtMs, reason, allowRetry) {
    if (!isTttTegoFrame()) return false;
    if (tttTegoStartupNativePlayRequestPosted && !allowRetry) return false;
    let targetVideo = null;
    try {
      targetVideo = Array.from(document.querySelectorAll("video")).find((video) => {
        if (!video || !isVisible(video)) return false;
        const rect = video.getBoundingClientRect();
        if (!rect || rect.width < 120 || rect.height < 80) return false;
        return Number(video.readyState || 0) >= 1 && !!video.paused;
      }) || null;
    } catch (_) {
      targetVideo = null;
    }
    if (!targetVideo) return false;
    try {
      const rect = targetVideo.getBoundingClientRect();
      const centerX = rect.left + Math.max(1, Math.floor(rect.width / 2));
      const centerY = rect.top + Math.max(1, Math.floor(rect.height / 2));
      const rectText = `${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}`;
      return postTttTegoStartupNativePlayRequest(
        attemptAtMs,
        summarizeNode(targetVideo),
        rectText,
        centerX,
        centerY,
        String(reason || "ttt-paused-video-center"),
        !!allowRetry
      );
    } catch (_) {
      return false;
    }
  }

  function maybePostTttTegoLoadingNativePlayRequest(snapshot, attemptAtMs, reason, allowRetry) {
    if (!isTttTegoFrame() || window.parent === window) return false;
    if (tttTegoStartupNativePlayRequestPosted && !allowRetry) return false;
    if (!snapshot) return false;
    if (snapshotHasPlayingVideo(snapshot) || snapshot.playbackProgressed || snapshot.playable) return false;
    if (!snapshot.missingHlsLevels && !snapshot.readyZeroPaused) return false;
    let target = null;
    let targetRect = null;
    try {
      target = Array.from(document.querySelectorAll("video")).find((node) => {
        if (!node || !isVisible(node)) return false;
        const rect = node.getBoundingClientRect();
        return !!rect && rect.width >= 160 && rect.height >= 90;
      }) || null;
      if (!target) {
        target = document.querySelector(".rmp-container,#rmpPlayer,#rmp");
      }
      if (!target || !isVisible(target)) return false;
      targetRect = target.getBoundingClientRect();
      if (!targetRect || targetRect.width < 80 || targetRect.height < 60) return false;
    } catch (_) {
      target = null;
      targetRect = null;
    }
    if (!target || !targetRect) return false;
    const centerX = targetRect.left + Math.max(1, Math.floor(targetRect.width / 2));
    const centerY = targetRect.top + Math.max(1, Math.floor(targetRect.height / 2));
    const rectText = `${Math.round(targetRect.left)},${Math.round(targetRect.top)} ${Math.round(targetRect.width)}x${Math.round(targetRect.height)}`;
    return postTttTegoStartupNativePlayRequest(
      attemptAtMs,
      summarizeNode(target),
      rectText,
      centerX,
      centerY,
      String(reason || "ttt-loading-center"),
      !!allowRetry
    );
  }

  function emitTttTegoPlayAssist(active, reason, attemptAtMs) {
    if (!isTttTegoFrame()) return;
    const reasonText = String(reason || (active ? "paused-ready" : "playing"));
    const requiresUserAction = !!active && reasonText === "paused-ready";
    if (!active && !tttTegoPlayAssistLastActive) return;
    if (active === tttTegoPlayAssistLastActive && active && reasonText === tttTegoPlayAssistLastReason) return;
    tttTegoPlayAssistLastActive = !!active;
    tttTegoPlayAssistLastReason = active ? reasonText : "";
    let centerX = -1;
    let centerY = -1;
    let rect = "none";
    let targetKind = "none";
    let targetSummary = "none";
    let readyState = 0;
    let paused = true;
    let videoWidth = 0;
    let videoHeight = 0;
    try {
      const video = Array.from(document.querySelectorAll("video")).find((node) => isVisible(node)) || null;
      if (video) {
        const r = video.getBoundingClientRect();
        centerX = Math.round(r.left + Math.max(1, Math.floor(r.width / 2)));
        centerY = Math.round(r.top + Math.max(1, Math.floor(r.height / 2)));
        rect = `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`;
        targetKind = "video";
        targetSummary = summarizeNode(video);
        readyState = Number(video.readyState || 0);
        paused = !!video.paused;
        videoWidth = Number(video.videoWidth || 0);
        videoHeight = Number(video.videoHeight || 0);
      }
      const playControl = Array.from(
        document.querySelectorAll("button,[role='button'],.rmp-button,.rmp-i,.rmp-play-button,.rmp-control-bar *")
      ).find((node) => {
        if (!isVisible(node)) return false;
        const cls = String(node.className || "").toLowerCase();
        const aria = String(node.getAttribute && node.getAttribute("aria-label") || "").toLowerCase();
        const title = String(node.getAttribute && node.getAttribute("title") || "").toLowerCase();
        const text = String(node.innerText || node.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
        const blob = `${cls} ${aria} ${title} ${text}`;
        if (blob.indexOf("pause") >= 0) return false;
        if (blob.indexOf("replay") >= 0) return false;
        if (blob.indexOf("fullscreen") >= 0 || blob.indexOf("full screen") >= 0) return false;
        if (blob.indexOf("volume") >= 0 || blob.indexOf("mute") >= 0) return false;
        return blob.indexOf("play") >= 0 || cls.indexOf("rmp-i-play") >= 0;
      });
      if (playControl) {
        const r = playControl.getBoundingClientRect();
        if (r.width >= 20 && r.height >= 20) {
          centerX = Math.round(r.left + Math.max(1, Math.floor(r.width / 2)));
          centerY = Math.round(r.top + Math.max(1, Math.floor(r.height / 2)));
          rect = `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`;
          targetKind = "play-control";
          targetSummary = summarizeNode(playControl);
        }
      }
    } catch (_) {}
    if (active && (centerX < 0 || centerY < 0)) {
      centerX = Math.round(Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1280) / 2);
      centerY = Math.round(Math.max(1, window.innerHeight || document.documentElement.clientHeight || 720) / 2);
      rect = "viewport-center";
      targetKind = "viewport-center";
      targetSummary = "viewport";
    }
    promptPayload({
      type: "ttt-tego-play-assist",
      phase: "content-ttt-tego-play-assist",
      pageUrl: window.location.href,
      active: !!active,
      requiresUserAction,
      reason: reasonText,
      attemptAtMs: numberOrZero(attemptAtMs),
      centerX,
      centerY,
      rect,
      targetKind,
      targetSummary,
      readyState,
      paused,
      videoWidth,
      videoHeight
    });
  }

  function scheduleTttTegoAutoplayWatchdog() {
    if (tttTegoAutoplayWatchdogStarted || !isTttTegoFrame()) return;
    tttTegoAutoplayWatchdogStarted = true;
    const startedAt = Date.now();
    const maxDurationMs = 120000;
    const tick = function () {
      if (!isTttTegoFrame()) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed > maxDurationMs) return;
      tttTegoAutoplayWatchdogTick += 1;
      const attemptAtMs = 30000 + (tttTegoAutoplayWatchdogTick * 2000);
      const snapshot = dispatchAbsTegoStartupReprobe(attemptAtMs);
      emitTttStartupState(snapshot, attemptAtMs, "content-ttt-tego-startup-watchdog", false, "watchdog");
      if (snapshotHasPlayingVideo(snapshot)) {
        emitTttTegoPlayAssist(false, "playing", attemptAtMs);
        return;
      }
      if (snapshotHasPausedReadyVideo(snapshot)) {
        emitTttTegoPlayAssist(true, "paused-ready", attemptAtMs);
      } else if (ENABLE_TTT_TEGO_READINESS_ASSIST && elapsed >= TTT_TEGO_READINESS_ASSIST_DELAY_MS) {
        const reason = !snapshot
          ? "loading-no-snapshot"
          : snapshot.missingHlsLevels
            ? "loading-hls-levels"
            : "loading-video-readiness";
        emitTttTegoPlayAssist(true, reason, attemptAtMs);
      }
      if (ENABLE_TTT_TEGO_AUTOSTART_HACKS && (!tttTegoStartupNativePlayRequestPosted || tttTegoAutoplayWatchdogTick % 3 === 0)) {
        maybePostTttTegoVideoCenterNativePlayRequest(
          attemptAtMs,
          "ttt-autoplay-watchdog",
          true
        );
      }
      tttTegoAutoplayWatchdogTimer = setTimeout(tick, 2000);
    };
    tttTegoAutoplayWatchdogTimer = setTimeout(tick, 2200);
  }

  function setupAbsTegoFullscreenNativeBridge() {
    window.addEventListener("message", (event) => {
      const profile = activeTegoTopProfile();
      if (profile !== "abs" && profile !== "ttt") return;
      const data = event && event.data;
      if (
        !data ||
        (
          data.type !== "kf-abs-tego-fullscreen-native-request" &&
          data.type !== "kf-abs-tego-fullscreen-native-hover" &&
          data.type !== "kf-abs-tego-startup-native-play-request"
        )
      ) {
        return;
      }
      const promptType =
        data.type === "kf-abs-tego-fullscreen-native-hover"
          ? "abs-tego-fullscreen-native-hover"
          : data.type === "kf-abs-tego-startup-native-play-request"
            ? "abs-tego-startup-native-play-request"
            : "abs-tego-fullscreen-native-request";
      let iframe = null;
      try {
        iframe = Array.from(document.querySelectorAll("iframe")).find((node) => {
          try {
            return isProfileTegoIframe(node, profile) && node.contentWindow === event.source;
          } catch (_) {
            return false;
          }
        });
      } catch (_) {
        iframe = null;
      }
      if (!iframe) {
        promptPayload({
          type: promptType,
          phase:
            data.type === "kf-abs-tego-fullscreen-native-hover"
              ? "content-abs-tego-fullscreen-native-hover"
              : data.type === "kf-abs-tego-startup-native-play-request"
                ? "content-abs-tego-startup-native-play-request"
                : "content-abs-tego-fullscreen-native-request",
          pageUrl: window.location.href,
          playerUrl: String(data.playerUrl || ""),
          attemptAtMs: numberOrZero(data.attemptAtMs),
          translated: false,
          reason: String(data.reason || "iframe-not-found"),
          iframeRect: "none",
          controlRect: String(data.controlRect || ""),
          controlSummary: String(data.controlSummary || ""),
          centerX: -1,
          centerY: -1,
          viewportWidth: Math.round(window.innerWidth || 0),
          viewportHeight: Math.round(window.innerHeight || 0),
          devicePixelRatio: numberOrZero(window.devicePixelRatio || 0),
          frameCenterX: numberOrZero(data.frameCenterX),
          frameCenterY: numberOrZero(data.frameCenterY)
        });
        return;
      }
      const iframeRect = controlRect(iframe);
      const frameCenterX = numberOrZero(data.frameCenterX);
      const frameCenterY = numberOrZero(data.frameCenterY);
      promptPayload({
          type: promptType,
        phase:
          data.type === "kf-abs-tego-fullscreen-native-hover"
            ? "content-abs-tego-fullscreen-native-hover"
            : data.type === "kf-abs-tego-startup-native-play-request"
              ? "content-abs-tego-startup-native-play-request"
              : "content-abs-tego-fullscreen-native-request",
        pageUrl: window.location.href,
        playerUrl: String(data.playerUrl || ""),
        attemptAtMs: numberOrZero(data.attemptAtMs),
        translated: true,
        reason: String(data.reason || "translated-from-iframe"),
        iframeRect: rectAsText(iframeRect),
        controlRect: String(data.controlRect || ""),
        controlSummary: String(data.controlSummary || ""),
        centerX: iframeRect.left + frameCenterX,
        centerY: iframeRect.top + frameCenterY,
        viewportWidth: Math.round(window.innerWidth || 0),
        viewportHeight: Math.round(window.innerHeight || 0),
        devicePixelRatio: numberOrZero(window.devicePixelRatio || 0),
        frameCenterX,
        frameCenterY
      });
    });
  }

  function dispatchMousePointerSequence(node, rect, methods) {
    if (!node) return false;
    const centerX = rect.left + Math.max(1, Math.floor(rect.width / 2));
    const centerY = rect.top + Math.max(1, Math.floor(rect.height / 2));
    const pointerInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      clientX: centerX,
      clientY: centerY,
      button: 0,
      buttons: 1
    };
    const mouseInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: centerX,
      clientY: centerY,
      button: 0,
      buttons: 1
    };
    const dispatch = function (eventName, ctor, init, methodName) {
      try {
        node.dispatchEvent(new ctor(eventName, init));
        if (Array.isArray(methods)) methods.push(methodName);
      } catch (_) {}
    };
    dispatch("pointerover", PointerEvent, pointerInit, "pointerover");
    dispatch("pointerenter", PointerEvent, pointerInit, "pointerenter");
    dispatch("mouseover", MouseEvent, mouseInit, "mouseover");
    dispatch("mousedown", MouseEvent, mouseInit, "mousedown");
    dispatch("pointerdown", PointerEvent, pointerInit, "pointerdown");
    dispatch("mouseup", MouseEvent, mouseInit, "mouseup");
    dispatch("pointerup", PointerEvent, pointerInit, "pointerup");
    dispatch("click", MouseEvent, mouseInit, "click");
    return true;
  }

  function applyAbsTegoFullscreenLikeLayout(methods) {
    let applied = false;
    let targetSummary = "none";
    try {
      const viewportWidth = Math.max(640, Math.floor(window.innerWidth || 0));
      const viewportHeight = Math.max(360, Math.floor(window.innerHeight || 0));
      const pageWindow = window.wrappedJSObject || window;
      const rmp = pageWindow && pageWindow.rmp;
      if (rmp) {
        if (safeMethodCall(rmp, "setPlayerSize", [viewportWidth, viewportHeight], methods)) {
          applied = true;
        }
        if (safeMethodCall(rmp, "setPlayerSize", [{ width: viewportWidth, height: viewportHeight }], methods)) {
          applied = true;
        }
        safeMethodCall(rmp, "resize", [], methods);
      }

      const root = document.querySelector(".rmp-container,#rmp,.rmp-wrapper,.rmp-content,.video-js,.jwplayer,#player,.player");
      if (root && root.style) {
        root.style.width = "100vw";
        root.style.height = "100vh";
        root.style.maxWidth = "100vw";
        root.style.maxHeight = "100vh";
        root.style.margin = "0";
        root.style.left = "0";
        root.style.top = "0";
        targetSummary = summarizeNode(root);
        applied = true;
      }
      if (document.body && document.body.style) {
        document.body.style.margin = "0";
        document.body.style.backgroundColor = "black";
      }
      if (document.documentElement && document.documentElement.style) {
        document.documentElement.style.backgroundColor = "black";
      }
    } catch (_) {}
    return { applied, targetSummary };
  }

  function dispatchAbsTegoFullscreenFKey(methods) {
    if (!ENABLE_ABS_TEGO_F_KEY_AFTER_FULLSCREEN_LIKE || !isAbsTegoChannel10Frame()) return false;
    try {
      const init = {
        key: "f",
        code: "KeyF",
        keyCode: 70,
        which: 70,
        bubbles: true,
        cancelable: true,
        composed: true
      };
      const targets = [document.activeElement, document.body, document.documentElement, document, window].filter(Boolean);
      targets.forEach((target) => {
        try {
          target.dispatchEvent(new KeyboardEvent("keydown", init));
          target.dispatchEvent(new KeyboardEvent("keyup", init));
        } catch (_) {}
      });
      if (Array.isArray(methods)) methods.push("dispatch-f-key");
      return true;
    } catch (_) {
      return false;
    }
  }

  function attemptAbsTegoFullscreen(attemptAtMs, snapshot) {
    if (!isAbsTegoChannel10Frame()) return null;
    const methods = [];
    let found = false;
    let clicked = false;
    let centerX = -1;
    let centerY = -1;
    let controlSummary = "none";
    let rectText = "0,0 0x0";
    let errors = 0;
    const fullscreenBefore = isInFullscreen();
    try {
      const control = Array.from(
        document.querySelectorAll("button,[role='button'],.rmp-fullscreen-button,.vjs-fullscreen-control,.jw-icon-fullscreen")
      ).find((node) => isLikelyFullscreenControl(node));
      if (control) {
        found = true;
        controlSummary = summarizeNode(control);
        const rect = controlRect(control);
        rectText = rectAsText(rect);
        centerX = rect.left + Math.max(1, Math.floor(rect.width / 2));
        centerY = rect.top + Math.max(1, Math.floor(rect.height / 2));
        attachAbsTegoFullscreenDiagnostics(control, attemptAtMs);
        emitAbsTegoFullscreenPreflight(control, attemptAtMs, "automated");
        const gate = evaluateAbsTegoFullscreenGate(control, snapshot);
        if (!gate.pass) {
          emitAbsTegoFullscreenGateSkip(attemptAtMs, controlSummary, gate);
          methods.push("gate-skip:" + gate.reason);
          if (
            gate.playbackProgressed &&
            gate.stableVideo &&
            absTegoFullscreenNativeHoverCount < 4 &&
            (
              gate.reason === "control-bar-hidden" ||
              gate.reason === "button-visibility-hidden" ||
              gate.reason === "point-mismatch"
            )
          ) {
            absTegoFullscreenNativeHoverCount += 1;
            if (postAbsTegoFullscreenNativeHover(attemptAtMs, controlSummary, rectText, centerX, centerY, gate.reason)) {
              methods.push("post-native-hover:" + gate.reason);
            }
          }
        } else {
          clicked = true;
          methods.push("native-request-only");
        }
      }
    } catch (_) {
      errors += 1;
    }
    setTimeout(() => {
      promptPayload({
        type: "abs-tego-fullscreen-control-click",
        phase: "content-abs-tego-fullscreen-control-click",
        pageUrl: window.location.href,
        attemptAtMs,
        playable: !!(snapshot && snapshot.playable),
        playbackProgressed: !!(snapshot && snapshot.playbackProgressed),
        applied: !!(snapshot && snapshot.applied),
        found,
        controlSummary,
        rect: rectText,
        centerX,
        centerY,
        clicked,
        fullscreenActiveBefore: fullscreenBefore,
        fullscreenActiveAfter: isInFullscreen(),
        fullscreenElementAfter: summarizeNode(currentFullscreenElement()),
        methods,
        errors
      });
      emitAbsTegoFullscreenTransition("automated", "post-attempt", attemptAtMs);
      if (!found && !absTegoControlCandidatesLogged && isAbsTegoChannel10Frame()) {
        absTegoControlCandidatesLogged = true;
        const items = collectAbsTegoVisibleControls();
        promptPayload({
          type: "abs-tego-control-candidates",
          phase: "content-abs-tego-control-candidates",
          pageUrl: window.location.href,
          attemptAtMs,
          count: items.length,
          items
        });
      }
      if (found && clicked && !isInFullscreen() && !absTegoFullscreenNativeRequestPosted) {
        absTegoFullscreenNativeRequestPosted = postAbsTegoFullscreenNativeRequest(attemptAtMs, controlSummary, rectText, centerX, centerY);
        if (Array.isArray(methods) && absTegoFullscreenNativeRequestPosted) methods.push("post-native-request");
      }
    }, 220);
    return { found, clicked, controlSummary, rectText, centerX, centerY };
  }

  function runAbsTegoFullscreenSequence(baseAttemptAtMs, snapshot) {
    if (absTegoFullscreenSequenceStarted || !isAbsTegoChannel10Frame()) return;
    absTegoFullscreenSequenceStarted = true;
    absTegoFullscreenSequenceCompleted = false;
    if (ENABLE_ABS_TEGO_PLAYER_FULLSCREEN_LIKE && snapshot && snapshot.playbackProgressed) {
      const methods = [];
      const result = applyAbsTegoFullscreenLikeLayout(methods);
      promptPayload({
        type: "tego-startup-fullscreen",
        phase: "content-tego-startup-fullscreen-like",
        pageUrl: window.location.href,
        attemptAtMs: numberOrZero(baseAttemptAtMs),
        playable: !!snapshot.playable,
        playbackProgressed: !!snapshot.playbackProgressed,
        applied: !!(result && result.applied),
        clickedFullscreen: false,
        requestedFullscreen: false,
        fullscreenActive: isInFullscreen(),
        fullscreenElement: summarizeNode(currentFullscreenElement()),
        fullscreenLikeApplied: !!(result && result.applied),
        fullscreenLikeTarget: (result && result.targetSummary) || "none",
        methods,
        errors: 0
      });
      if (result && result.applied) {
        absTegoFullscreenLikeApplied = true;
        if (!absTegoPlaybackProgressPosted) {
          absTegoPlaybackProgressPosted = true;
          try {
            if (window.top && window.top !== window) {
              window.top.postMessage({
                type: "__KF_ABS_TEGO_PLAYBACK_PROGRESS__",
                playerUrl: window.location.href,
                attemptAtMs: numberOrZero(baseAttemptAtMs),
                fullscreenLikeApplied: true
              }, "*");
            }
          } catch (_) {}
        }
        emitAbsTegoPlayerFirstActive(detectTegoProfileFromPlayerUrl(window.location.href), "tego-player-first-layout", baseAttemptAtMs);
        scheduleAbsTegoFrameOverlayCleanup(baseAttemptAtMs);
        scheduleAbsTegoChromeAutoHide();
      }
      absTegoFullscreenSequenceCompleted = true;
      return;
    }
    const sequence = ABS_TEGO_FULLSCREEN_SEQUENCE_DELAYS_MS;
    sequence.forEach((deltaMs) => {
      setTimeout(() => {
        if (!isAbsTegoChannel10Frame() || absTegoFullscreenSequenceCompleted) return;
        const result = attemptAbsTegoFullscreen(baseAttemptAtMs + deltaMs, snapshot);
        if (result && result.found && result.clicked) {
          absTegoFullscreenSequenceCompleted = true;
        }
      }, deltaMs);
    });
  }

  function scheduleAbsTegoStartupReprobe() {
    if (absTegoStartupReprobeStarted || !isAbsTegoChannel10Frame()) return;
    absTegoStartupReprobeStarted = true;
    absTegoStartupReprobeStopped = false;
    ABS_TEGO_STARTUP_REPROBE_DELAYS_MS.forEach((delayMs) => {
      setTimeout(() => {
        if (absTegoStartupReprobeStopped) return;
        if (!isAbsTegoChannel10Frame()) {
          absTegoStartupReprobeStopped = true;
          return;
        }
        const snapshot = dispatchAbsTegoStartupReprobe(delayMs);
        const tttFrame = isTttTegoFrame();
        if (tttFrame) {
          emitTttStartupState(snapshot, delayMs, "content-ttt-tego-startup-base", false, "");
        }
        const shouldContinue = shouldContinueAbsTegoStartupReprobe(snapshot);
        if (snapshot && snapshot.playbackProgressed) {
          runAbsTegoFullscreenSequence(delayMs, snapshot);
        }
        if (shouldContinue) {
          const shouldWake = !tttFrame || delayMs <= TTT_TEGO_STARTUP_WAKE_MAX_DELAY_MS;
          if (shouldWake) {
            attemptAbsTegoStartupWake(delayMs);
            if (tttFrame) {
              emitTttStartupState(snapshot, delayMs, "content-ttt-tego-startup-base", true, "");
              if (delayMs >= TTT_TEGO_STARTUP_WAKE_MAX_DELAY_MS) {
                maybePostTttTegoLoadingNativePlayRequest(
                  snapshot,
                  delayMs + 350,
                  "ttt-loading-hls-levels-center",
                  false
                );
              }
            }
          } else if (tttFrame) {
            emitTttStartupState(snapshot, delayMs, "content-ttt-tego-startup-base", false, "wake-capped");
          }
        } else {
          absTegoStartupReprobeStopped = true;
          return;
        }
        if (delayMs === ABS_TEGO_STARTUP_REPROBE_DELAYS_MS[ABS_TEGO_STARTUP_REPROBE_DELAYS_MS.length - 1]) {
          absTegoStartupReprobeStopped = true;
        }
      }, delayMs);
    });
    scheduleTttTegoExtraStartupReprobe();
  }

  function scheduleTttTegoExtraStartupReprobe() {
    if (tttTegoExtraStartupReprobeStarted || !isTttTegoFrame()) return;
    tttTegoExtraStartupReprobeStarted = true;
    TTT_TEGO_STARTUP_EXTRA_REPROBE_DELAYS_MS.forEach((delayMs) => {
      setTimeout(() => {
        if (!isTttTegoFrame()) return;
        const snapshot = dispatchAbsTegoStartupReprobe(delayMs);
        emitTttStartupState(snapshot, delayMs, "content-ttt-tego-startup-extra", false, "extra-reprobe");
        if (snapshotHasPlayingVideo(snapshot)) {
          emitTttTegoPlayAssist(false, "playing", delayMs);
          return;
        }
        if (snapshotHasPausedReadyVideo(snapshot)) {
          emitTttTegoPlayAssist(true, "paused-ready", delayMs);
        } else if (ENABLE_TTT_TEGO_READINESS_ASSIST && delayMs >= TTT_TEGO_READINESS_ASSIST_DELAY_MS) {
          const reason = !snapshot
            ? "loading-no-snapshot"
            : snapshot.missingHlsLevels
              ? "loading-hls-levels"
              : "loading-video-readiness";
          emitTttTegoPlayAssist(true, reason, delayMs);
        }
        if (!tttTegoStartupNativePlayRetryPosted && delayMs >= TTT_TEGO_STARTUP_EXTRA_REPROBE_DELAYS_MS[0]) {
          const posted = maybePostTttTegoLoadingNativePlayRequest(
            snapshot,
            delayMs + 500,
            "ttt-loading-hls-levels-retry",
            true
          );
          if (posted) tttTegoStartupNativePlayRetryPosted = true;
        }
        if (ENABLE_TTT_TEGO_AUTOSTART_HACKS && !tttTegoStartupNativePlayRetryPosted) {
          setTimeout(() => {
            if (!isTttTegoFrame() || tttTegoStartupNativePlayRetryPosted) return;
            const posted = maybePostTttTegoVideoCenterNativePlayRequest(delayMs + 2000, "ttt-delayed-video-center-retry", true);
            if (posted) tttTegoStartupNativePlayRetryPosted = true;
          }, 2000);
        }
      }, delayMs);
    });
    scheduleTttTegoAutoplayWatchdog();
  }

  function maybeSanitizeAbsTegoPlayerFrameUrl() {
    if (!isAbsTegoChannel10Frame()) return false;
    const beforeUrl = String(window.location.href || "");
    const afterUrl = sanitizeAbsTegoPlayerUrl(beforeUrl);
    const profile = detectTegoProfileFromPlayerUrl(beforeUrl);
    if (!afterUrl || afterUrl === beforeUrl) return false;
    let alreadySanitized = false;
    try {
      alreadySanitized = String(window.sessionStorage.getItem("kfAbsTegoUrlSanitized") || "") === "1";
    } catch (_) {
      alreadySanitized = false;
    }
    if (alreadySanitized) return false;
    try {
      window.sessionStorage.setItem("kfAbsTegoUrlSanitized", "1");
    } catch (_) {}
    promptPayload({
      type: "abs-tego-url-sanitized",
      phase: "content-abs-tego-url-sanitized",
      pageUrl: window.location.href,
      profile,
      context: "player-frame",
      beforeUrl,
      afterUrl
    });
    try {
      window.location.replace(afterUrl);
      return true;
    } catch (_) {
      return false;
    }
  }

  function collect() {
    const mediaElements = Array.from(document.querySelectorAll("video, audio"));
    const directCandidates = [];

    mediaElements.forEach((element) => {
      const currentSrc = element.currentSrc || element.src || "";
      const sourceChildren = Array.from(element.querySelectorAll("source[src]")).map((source) => source.src || "");
      const allSources = [currentSrc, ...sourceChildren].filter(Boolean);
      allSources.forEach((src) => {
        directCandidates.push({
          src,
          tagName: element.tagName.toLowerCase(),
          visible: isVisible(element),
          mimeType: element.getAttribute("type") || "",
          videoWidth: element.videoWidth || 0,
          videoHeight: element.videoHeight || 0,
          readyState: element.readyState || 0,
          networkState: element.networkState || 0,
          currentTime: typeof element.currentTime === "number" ? element.currentTime : 0,
          duration: typeof element.duration === "number" ? element.duration : 0
        });
      });
    });

    return {
      type: "media-evidence",
      phase: "content-collect",
      pageUrl: window.location.href,
      title: document.title || "",
      candidateCount: directCandidates.length,
      directCandidates
    };
  }

  function publish() {
    const payload = collect();
    applyGbnDailymotionEmbedPlayerFirstLayout("publish");
    applyCvc9DailymotionPlayerFirstLayout("publish");
    applyCvmVimeoPlayerFirstLayout();
    maybePreferCvmVimeo1080p();
    applyCbnVirginIslandsPlayerFirstLayout();
    maybeKickCbnVirginIslandsPlayer();
    applyCnc3PlayerFirstLayout();
    const signature = JSON.stringify(payload);
    if (signature === lastSignature) {
      emitCaribVisionSessionState("publish-no-change");
      emitCaribVisionPlayAssist("publish-no-change");
      emitCaribVisionFullscreenAssist("publish-no-change");
      emitChtvPlayAssist("publish-no-change");
      emitChtvFullscreenAssist("publish-no-change");
      emitCbcLiveHlsReady("publish-no-change");
      emitCaribVisionLiveHlsReady("publish-no-change");
      return;
    }
    lastSignature = signature;
    promptPayload(payload);
    emitCaribVisionSessionState("publish");
    emitCaribVisionPlayAssist("publish");
    emitCaribVisionFullscreenAssist("publish");
    emitChtvPlayAssist("publish");
    emitChtvFullscreenAssist("publish");
    emitCbcLiveHlsReady("publish");
    emitCaribVisionLiveHlsReady("publish");
  }

  const absTegoUrlRedirected = maybeSanitizeAbsTegoPlayerFrameUrl();
  if (absTegoUrlRedirected) {
    return;
  }
  scheduleGbnDailymotionPlayerFirstLayout();
  scheduleCvc9DailymotionPlayerFirstLayout();
  publish();
  ensureGbnConsentFrameDetector();
  ensureCvc9ConsentFrameDetector();
  applyTegoQualityPolicy();
  scheduleAbsTegoStartupReprobe();
  scheduleAbsTegoPageFullscreenLike();
  scheduleNovusTelearubaFlow();
  scheduleCgtvPageFullscreenLike();
  scheduleCgtvPlayAssist();
  scheduleCaribVisionPlayAssist();
  scheduleCaribVisionFullscreenAssist();
  scheduleChtvPlayAssist();
  scheduleChtvFullscreenAssist();
  scheduleCbcLiveHlsReady();
  scheduleCaribVisionLiveHlsReady();
  maybeAttachAbsTegoTopPlaybackListener();
  setupTttTegoTransportRevealBridge();
  setupAbsTegoFullscreenNativeBridge();
  window.addEventListener("load", publish, { once: true });
  window.addEventListener("load", applyTegoQualityPolicy, { once: true });
  window.addEventListener("load", scheduleAbsTegoStartupReprobe, { once: true });
  window.addEventListener("load", scheduleAbsTegoPageFullscreenLike, { once: true });
  window.addEventListener("load", scheduleNovusTelearubaFlow, { once: true });
  window.addEventListener("load", scheduleCgtvPageFullscreenLike, { once: true });
  window.addEventListener("load", scheduleCgtvPlayAssist, { once: true });
  window.addEventListener("load", scheduleCaribVisionPlayAssist, { once: true });
  window.addEventListener("load", scheduleCaribVisionFullscreenAssist, { once: true });
  window.addEventListener("load", scheduleChtvPlayAssist, { once: true });
  window.addEventListener("load", scheduleChtvFullscreenAssist, { once: true });
  window.addEventListener("load", scheduleCbcLiveHlsReady, { once: true });
  window.addEventListener("load", scheduleCaribVisionLiveHlsReady, { once: true });
  window.addEventListener("load", maybeAttachAbsTegoTopPlaybackListener, { once: true });
  window.addEventListener("load", setupTttTegoTransportRevealBridge, { once: true });
  document.addEventListener("visibilitychange", publish);
  document.addEventListener("visibilitychange", applyTegoQualityPolicy);
  setInterval(publish, 2000);
  setInterval(applyTegoQualityPolicy, 1200);
})();
