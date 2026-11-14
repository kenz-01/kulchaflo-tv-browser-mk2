(function () {
  "use strict";

  const OFFICIAL_HOST = "telesistema11.com.do";
  const OFFICIAL_PATH = "/en-vivo";
  const SOURCE_ATTRIBUTES = Object.freeze(["src", "data-src", "data-lazy-src", "data-litespeed-src"]);
  const RETRY_DELAYS_MS = Object.freeze([250, 800, 1800, 3500, 6000, 10000, 15000, 20000]);
  const MAX_ATTEMPTS = 32;

  function isOfficialPage(rawUrl) {
    try {
      const url = new URL(String(rawUrl || ""));
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      const path = url.pathname.toLowerCase().replace(/\/+$/, "") || "/";
      return url.protocol === "https:" && !url.username && !url.password &&
        (!url.port || url.port === "443") && host === OFFICIAL_HOST && path === OFFICIAL_PATH;
    } catch (_) {
      return false;
    }
  }

  function isTrustedDailymotionUrl(rawUrl, pageUrl) {
    try {
      const url = new URL(String(rawUrl || ""), pageUrl || "https://invalid.example/");
      if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
        return false;
      }
      const host = url.hostname.toLowerCase();
      const path = url.pathname.toLowerCase();
      return ((host === "dailymotion.com" || host === "www.dailymotion.com") &&
        (path.startsWith("/embed/") || path.startsWith("/video/"))) ||
        (host === "geo.dailymotion.com" &&
          (path === "/player" || path.startsWith("/player/") || path === "/player.html"));
    } catch (_) {
      return false;
    }
  }

  function sourceForFrame(frame, pageUrl) {
    for (const name of SOURCE_ATTRIBUTES) {
      const value = String(frame?.getAttribute?.(name) || "");
      if (isTrustedDailymotionUrl(value, pageUrl)) return value;
    }
    return "";
  }

  function hasDeferredClass(frame) {
    return /(?:^|\s)(?:lazy|lazyload|lazy-load|lazy-loading|litespeed-loading)(?:\s|$)/i
      .test(String(frame?.className || ""));
  }

  function needsWake(frame, pageUrl) {
    if (!sourceForFrame(frame, pageUrl)) return false;
    const currentSrc = String(frame?.getAttribute?.("src") || "");
    const loading = String(frame?.getAttribute?.("loading") || "").toLowerCase();
    return !isTrustedDailymotionUrl(currentSrc, pageUrl) || loading === "lazy" ||
      hasDeferredClass(frame);
  }

  // Expose pure route/source checks for the offline Player Lab regression suite.
  globalThis.KfTelesistemaLazyFrameHelper = Object.freeze({
    isOfficialPage,
    isTrustedDailymotionUrl,
    sourceForFrame,
    needsWake,
    policy: Object.freeze({ retryDelaysMs: RETRY_DELAYS_MS, maxAttempts: MAX_ATTEMPTS, maxWaitMs: 30000 })
  });

  if (typeof window === "undefined" || typeof document === "undefined" || window.top !== window) return;
  if (!isOfficialPage(window.location?.href)) return;

  let stopped = false;
  let attempts = 0;
  let observer = null;
  let deadlineTimer = null;
  let observerAttemptPending = false;
  const startedAt = Date.now();

  function report(result, extra = {}) {
    try {
      // Only fixed route/status labels are logged; never emit iframe URLs or media tokens.
      console.info("KF_TELESISTEMA_LAZY_FRAME result=" + result +
        " attempts=" + attempts + " elapsedMs=" + Math.max(0, Date.now() - startedAt) +
        (extra.sourceActivated ? " sourceActivated=true" : " sourceActivated=false"));
    } catch (_) {}
  }

  function finish(result, extra) {
    if (stopped) return;
    stopped = true;
    try { observer?.disconnect(); } catch (_) {}
    try { if (deadlineTimer !== null) clearTimeout(deadlineTimer); } catch (_) {}
    report(result, extra);
  }

  function attempt() {
    if (stopped) return;
    if (!isOfficialPage(window.location?.href)) {
      finish("route-changed");
      return;
    }
    if (attempts >= MAX_ATTEMPTS || Date.now() - startedAt >= 30000) {
      finish("observation-limit");
      return;
    }
    attempts += 1;

    let candidates = [];
    try {
      candidates = Array.from(document.querySelectorAll("iframe"))
        .filter((frame) => sourceForFrame(frame, window.location.href));
    } catch (_) {}
    if (candidates.length > 1) {
      finish("ambiguous-player");
      return;
    }
    if (candidates.length !== 1) return;

    const frame = candidates[0];
    if (!needsWake(frame, window.location.href)) {
      finish("frame-already-active");
      return;
    }

    const originalSource = sourceForFrame(frame, window.location.href);
    const currentSource = String(frame.getAttribute("src") || "");
    const deferredSource = !isTrustedDailymotionUrl(currentSource, window.location.href);
    const loading = String(frame.getAttribute("loading") || "").toLowerCase();
    const liteSpeedMarker = /(?:^|\s)litespeed-loading(?:\s|$)/i.test(String(frame.className || ""));
    let sourceActivated = false;

    try {
      if (loading === "lazy") frame.setAttribute("loading", "eager");
      if (deferredSource || liteSpeedMarker) {
        // Activate only the exact HTTPS Dailymotion URL already present in the
        // publisher's own iframe src/data-* attributes. Never invent or substitute a source.
        frame.setAttribute("src", originalSource);
        sourceActivated = true;
      }
      if (typeof frame.scrollIntoView === "function") {
        frame.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
      }
      finish("wake-requested", { sourceActivated });
    } catch (_) {
      finish("wake-failed", { sourceActivated });
    }
  }

  function scheduleAttempt() {
    if (stopped || observerAttemptPending) return;
    observerAttemptPending = true;
    try {
      setTimeout(() => {
        observerAttemptPending = false;
        attempt();
      }, 0);
    } catch (_) {
      observerAttemptPending = false;
      attempt();
    }
  }

  function isRelevantMutation(record) {
    if (record?.type === "attributes") {
      return String(record.target?.tagName || "").toUpperCase() === "IFRAME" &&
        ["class", "data-lazy-src", "data-litespeed-src", "data-src", "loading", "src"]
          .includes(String(record.attributeName || "").toLowerCase());
    }
    if (record?.type !== "childList") return false;
    return Array.from(record.addedNodes || []).some((node) => {
      if (String(node?.tagName || "").toUpperCase() === "IFRAME") return true;
      try { return !!node?.querySelector?.("iframe"); } catch (_) { return false; }
    });
  }

  try {
    if (typeof MutationObserver !== "undefined" && document.documentElement) {
      observer = new MutationObserver((records) => {
        if (Array.from(records || []).some(isRelevantMutation)) scheduleAttempt();
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-lazy-src", "data-litespeed-src", "data-src", "loading", "src"],
        childList: true,
        subtree: true
      });
    }
  } catch (_) {}

  deadlineTimer = setTimeout(() => finish("observation-limit"), 30000);
  RETRY_DELAYS_MS.forEach((delay) => setTimeout(attempt, delay));
  scheduleAttempt();
})();
