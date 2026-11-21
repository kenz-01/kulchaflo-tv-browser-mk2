(function () {
  "use strict";

  const DISCOVERY_WINDOW_MS = 12000;
  const PROMPT_PREFIX = "__GV_MEDIA__";
  let completed = false;
  let observer = null;
  let discoveryTimer = null;

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

  function isOfficialDailymotionEmbed(frame) {
    try {
      const rawSrc = frame && frame.getAttribute && frame.getAttribute("src");
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

  function findOfficialDailymotionIframe() {
    try {
      const frames = document.querySelectorAll("iframe[src]");
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

  function emitEvidence(visibleBefore, scrollChanged) {
    try {
      window.prompt(PROMPT_PREFIX + JSON.stringify({
        type: "telesistema-viewport-alignment",
        visibleBefore: !!visibleBefore,
        scrollChanged: !!scrollChanged
      }), "");
    } catch (_) {}
  }

  function alignOnce(frame) {
    if (completed || !isTelesistemaLiveRoute()) return;
    completed = true;
    stopDiscovery();

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

    const reportAfterLayout = function () {
      if (!isTelesistemaLiveRoute()) return;
      const afterX = Number(window.scrollX || window.pageXOffset || 0);
      const afterY = Number(window.scrollY || window.pageYOffset || 0);
      emitEvidence(viewportBefore.visible, beforeX !== afterX || beforeY !== afterY);
    };
    try {
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(reportAfterLayout);
      });
    } catch (_) {
      setTimeout(reportAfterLayout, 0);
    }
  }

  if (!isTelesistemaLiveRoute()) return;
  const existingFrame = findOfficialDailymotionIframe();
  if (existingFrame) {
    alignOnce(existingFrame);
    return;
  }

  try {
    observer = new MutationObserver(function () {
      if (!isTelesistemaLiveRoute()) {
        stopDiscovery();
        return;
      }
      const lateFrame = findOfficialDailymotionIframe();
      if (lateFrame) alignOnce(lateFrame);
    });
    observer.observe(document.documentElement || document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src"]
    });
    discoveryTimer = setTimeout(stopDiscovery, DISCOVERY_WINDOW_MS);
    window.addEventListener("pagehide", stopDiscovery, { once: true });
  } catch (_) {
    stopDiscovery();
  }
})();
