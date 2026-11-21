(function () {
  "use strict";

  const DISCOVERY_WINDOW_MS = 35000;
  const FRAME_READY_FALLBACK_MS = 2500;
  const PROMPT_PREFIX = "__GV_MEDIA__";
  const PLAYER_CLASS = "kf-telesistema-full-viewport-player";
  const PLAYER_STYLE_ID = "kf-telesistema-full-viewport-player-style";
  let alignmentStarted = false;
  let observer = null;
  let discoveryTimer = null;
  let frameReadyTimer = null;
  let waitingFrame = null;
  let frameLoadListener = null;
  let playerStyle = null;
  let playerFrame = null;
  let alignmentEvidence = null;
  let hoverRequestSent = false;
  let stopped = false;

  function isTelesistemaLiveRoute() {
    try {
      if (window.top !== window.self) return false;
      const location = window.location;
      const host = String(location.hostname || "").toLowerCase();
      const path = String(location.pathname || "").toLowerCase();
      const port = String(location.port || "");
      return location.protocol === "https:" &&
        (host === "telesistema11.com.do" || host === "www.telesistema11.com.do") &&
        (port === "" || port === "443") &&
        (path === "/en-vivo" || path === "/en-vivo/");
    } catch (_) {
      return false;
    }
  }

  function isOfficialDailymotionUrl(rawSrc) {
    try {
      if (!rawSrc) return false;
      const source = new URL(String(rawSrc), document.baseURI);
      if (source.protocol !== "https:" || (source.port && source.port !== "443")) return false;
      const host = source.hostname.toLowerCase();
      if (host === "geo.dailymotion.com") return source.pathname.indexOf("/player/") === 0;
      if (host === "dailymotion.com" || host === "www.dailymotion.com") {
        return source.pathname.indexOf("/embed/") === 0;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  function hasOfficialDailymotionSource(frame) {
    try {
      return isOfficialDailymotionUrl(frame && frame.getAttribute && frame.getAttribute("src"));
    } catch (_) {
      return false;
    }
  }

  function isOfficialDailymotionEmbed(frame) {
    try {
      if (!frame || !frame.getAttribute) return false;
      const sourceAttributes = ["src", "data-src", "data-lazy-src", "data-litespeed-src"];
      for (let index = 0; index < sourceAttributes.length; index += 1) {
        if (isOfficialDailymotionUrl(frame.getAttribute(sourceAttributes[index]))) return true;
      }
    } catch (_) {}
    return false;
  }

  function findOfficialDailymotionIframe() {
    try {
      const frames = document.querySelectorAll("iframe");
      for (let index = 0; index < frames.length; index += 1) {
        if (isOfficialDailymotionEmbed(frames[index])) return frames[index];
      }
    } catch (_) {}
    return null;
  }

  function measureViewport(frame) {
    try {
      const rect = frame.getBoundingClientRect();
      const style = window.getComputedStyle(frame);
      const rendered = !!rect && rect.width > 0 && rect.height > 0 &&
        style.display !== "none" && style.visibility !== "hidden";
      return {
        visible: rendered && rect.right > 0 && rect.bottom > 0 &&
          rect.left < window.innerWidth && rect.top < window.innerHeight,
        fullyVisible: rendered && rect.left >= 0 && rect.top >= 0 &&
          rect.right <= window.innerWidth && rect.bottom <= window.innerHeight
      };
    } catch (_) {
      return { visible: false, fullyVisible: false };
    }
  }

  function stopDiscovery() {
    if (observer) {
      try { observer.disconnect(); } catch (_) {}
      observer = null;
    }
    if (discoveryTimer !== null) {
      clearTimeout(discoveryTimer);
      discoveryTimer = null;
    }
  }

  function restorePlayerFirstLayout() {
    if (waitingFrame && frameLoadListener) {
      try { waitingFrame.removeEventListener("load", frameLoadListener); } catch (_) {}
    }
    waitingFrame = null;
    frameLoadListener = null;
    if (frameReadyTimer !== null) {
      clearTimeout(frameReadyTimer);
      frameReadyTimer = null;
    }
    if (playerFrame && playerFrame.classList) {
      try { playerFrame.classList.remove(PLAYER_CLASS); } catch (_) {}
    }
    if (playerStyle && playerStyle.parentNode) {
      try { playerStyle.parentNode.removeChild(playerStyle); } catch (_) {}
    }
    playerFrame = null;
    playerStyle = null;
  }

  function cleanupIfRouteChanged() {
    if (isTelesistemaLiveRoute()) return;
    stopped = true;
    stopDiscovery();
    restorePlayerFirstLayout();
    try { window.removeEventListener("pagehide", handlePageHide); } catch (_) {}
    try { window.removeEventListener("popstate", cleanupIfRouteChanged); } catch (_) {}
    try { window.removeEventListener("hashchange", cleanupIfRouteChanged); } catch (_) {}
  }

  function handlePageHide() {
    stopped = true;
    stopDiscovery();
    restorePlayerFirstLayout();
  }

  function applyPlayerFirstLayout(frame) {
    try {
      const style = document.createElement("style");
      style.id = PLAYER_STYLE_ID;
      style.textContent = "." + PLAYER_CLASS + "{" +
        "position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;" +
        "width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;" +
        "margin:0!important;border:0!important;z-index:2147483647!important;background:#000!important;}";
      (document.head || document.documentElement).appendChild(style);
      frame.classList.add(PLAYER_CLASS);
      playerStyle = style;
      playerFrame = frame;
      return true;
    } catch (_) {
      return false;
    }
  }

  function emitEvidence(visibleBefore, scrollChanged) {
    try {
      window.prompt(PROMPT_PREFIX + JSON.stringify({
        type: "telesistema-viewport-alignment",
        visibleBefore: !!visibleBefore,
        scrollChanged: !!scrollChanged
      }), "");
    } catch (_) {}
  }

  function requestNativeHover() {
    if (hoverRequestSent || stopped) return;
    hoverRequestSent = true;
    if (waitingFrame && frameLoadListener) {
      try { waitingFrame.removeEventListener("load", frameLoadListener); } catch (_) {}
    }
    waitingFrame = null;
    frameLoadListener = null;
    if (frameReadyTimer !== null) {
      clearTimeout(frameReadyTimer);
      frameReadyTimer = null;
    }
    if (!isTelesistemaLiveRoute()) {
      cleanupIfRouteChanged();
      return;
    }
    const evidence = alignmentEvidence || { visibleBefore: false, scrollChanged: false };
    const report = function () {
      if (stopped || !isTelesistemaLiveRoute()) {
        cleanupIfRouteChanged();
        return;
      }
      emitEvidence(evidence.visibleBefore, evidence.scrollChanged);
    };
    try {
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(report);
      });
    } catch (_) {
      setTimeout(report, 0);
    }
  }

  function waitForOfficialFrameLoad(frame) {
    if (hoverRequestSent || stopped || waitingFrame === frame || !hasOfficialDailymotionSource(frame)) return;
    applyPlayerFirstLayout(frame);
    stopDiscovery();
    waitingFrame = frame;
    frameLoadListener = requestNativeHover;
    try { frame.addEventListener("load", frameLoadListener, { once: true }); } catch (_) {}
    frameReadyTimer = setTimeout(requestNativeHover, FRAME_READY_FALLBACK_MS);
  }

  function alignOnce(frame) {
    if (alignmentStarted || !isTelesistemaLiveRoute()) return;
    alignmentStarted = true;
    playerFrame = frame;

    const viewportBefore = measureViewport(frame);
    const beforeX = Number(window.scrollX || window.pageXOffset || 0);
    const beforeY = Number(window.scrollY || window.pageYOffset || 0);
    if (!viewportBefore.fullyVisible) {
      try {
        frame.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
      } catch (_) {
        try { frame.scrollIntoView(); } catch (_) {}
      }
    }
    const afterX = Number(window.scrollX || window.pageXOffset || 0);
    const afterY = Number(window.scrollY || window.pageYOffset || 0);
    const scrollChanged = beforeX !== afterX || beforeY !== afterY;
    alignmentEvidence = { visibleBefore: viewportBefore.visible, scrollChanged: scrollChanged };
    if (hasOfficialDailymotionSource(frame)) waitForOfficialFrameLoad(frame);
  }

  if (!isTelesistemaLiveRoute()) return;
  window.addEventListener("pagehide", handlePageHide, { once: true });
  window.addEventListener("popstate", cleanupIfRouteChanged);
  window.addEventListener("hashchange", cleanupIfRouteChanged);

  try {
    observer = new MutationObserver(function () {
      if (!isTelesistemaLiveRoute()) {
        stopDiscovery();
        return;
      }
      if (!alignmentStarted) {
        const candidateFrame = findOfficialDailymotionIframe();
        if (candidateFrame) alignOnce(candidateFrame);
      }
      if (alignmentStarted && playerFrame && hasOfficialDailymotionSource(playerFrame)) {
        waitForOfficialFrameLoad(playerFrame);
      }
    });
    observer.observe(document.documentElement || document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "data-src", "data-lazy-src", "data-litespeed-src"]
    });
    discoveryTimer = setTimeout(function () {
      stopDiscovery();
      if (alignmentStarted && !hasOfficialDailymotionSource(playerFrame)) restorePlayerFirstLayout();
    }, DISCOVERY_WINDOW_MS);
    const existingFrame = findOfficialDailymotionIframe();
    if (existingFrame) {
      alignOnce(existingFrame);
      if (hasOfficialDailymotionSource(existingFrame)) waitForOfficialFrameLoad(existingFrame);
    }
  } catch (_) {
    stopDiscovery();
  }
})();
