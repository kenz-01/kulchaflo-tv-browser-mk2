(function () {
  "use strict";

  const SCOPE = Object.freeze({
    site: "znsbahamas.com",
    embed: "player.streamcomedia.com",
  });
  const RETRY_DELAYS_MS = Object.freeze([300, 900, 2000, 4000, 7000, 11000, 18000]);
  const PROGRESS_SAMPLE_MS = 4000;

  function route(raw) {
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return "";
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      const path = url.pathname.toLowerCase().replace(/\/+$/, "") || "/";
      if (host === SCOPE.site && path === "/") return "site";
      if (host === SCOPE.embed && path === "/html5/znstv") return "embed";
    } catch (_) {}
    return "";
  }

  function visible(el) {
    try {
      const rect = el.getBoundingClientRect();
      return rect.width >= 280 && rect.height >= 150;
    } catch (_) {
      return false;
    }
  }

  function oneVisible(elements) {
    const matches = Array.from(elements).filter(visible);
    return matches.length === 1 ? matches[0] : null;
  }

  function officialFrame(doc) {
    const frames = Array.from(doc.querySelectorAll("iframe[src]"))
      .filter((frame) => route(frame.getAttribute("src") || frame.src) === "embed");
    return oneVisible(frames);
  }

  function safePageUrl() {
    try {
      const url = new URL(window.location.href);
      return `${url.origin}${url.pathname}`;
    } catch (_) {
      return "";
    }
  }

  function report(phase, extra = {}) {
    try {
      window.prompt("__GV_MEDIA__" + JSON.stringify({
        type: "zns-player-state",
        phase,
        pageUrl: safePageUrl(),
        ...extra,
      }), "");
    } catch (_) {}
  }

  function applyPlayerFirst(frame, doc) {
    if (!frame || !doc.body) return false;
    const ancestors = new Set();
    let node = frame;
    while (node && node !== doc.body) {
      ancestors.add(node);
      node = node.parentElement;
    }
    if (node !== doc.body) return false;

    for (const ancestor of ancestors) {
      for (const sibling of Array.from(ancestor.parentElement?.children || [])) {
        if (!ancestors.has(sibling) && sibling.style) {
          sibling.style.setProperty("display", "none", "important");
        }
      }
    }
    for (let current = frame; current && current !== doc.body; current = current.parentElement) {
      if (!current.style) continue;
      for (const [property, value] of [
        ["position", "fixed"], ["inset", "0"], ["width", "100vw"], ["height", "100vh"],
        ["max-width", "none"], ["max-height", "none"], ["z-index", "2147483000"],
        ["background", "#000"], ["margin", "0"],
      ]) current.style.setProperty(property, value, "important");
    }
    for (const element of [doc.body, doc.documentElement]) {
      if (!element?.style) continue;
      element.style.setProperty("overflow", "hidden", "important");
      element.style.setProperty("background", "#000", "important");
    }
    return true;
  }

  globalThis.KfZnsHelper = Object.freeze({ route, visible, oneVisible, officialFrame, applyPlayerFirst });
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const ownRoute = route(window.location.href);
  if (ownRoute === "site" && window.top === window) {
    let applied = false;
    const attempt = () => {
      if (applied || route(window.location.href) !== "site") return;
      const frame = officialFrame(document);
      if (!frame) return;
      const allow = String(frame.getAttribute("allow") || "");
      if (!allow.toLowerCase().includes("autoplay")) {
        frame.setAttribute("allow", allow ? `${allow}; autoplay` : "autoplay");
      }
      frame.setAttribute("allowfullscreen", "true");
      if (!applyPlayerFirst(frame, document)) return;
      applied = true;
      report("zns-outer-player-first");
    };
    RETRY_DELAYS_MS.forEach((delay) => setTimeout(attempt, delay));
    return;
  }

  if (ownRoute !== "embed" || window.top === window || route(document.referrer) !== "site") return;
  const playAttempted = new WeakSet();
  const observed = new WeakSet();
  const progressSampled = new WeakSet();
  const attempt = () => {
    const video = oneVisible(Array.from(document.querySelectorAll("video")).slice(0, 8));
    if (!video) return;
    if (!observed.has(video)) {
      observed.add(video);
      video.addEventListener("playing", () => report("zns-embedded-playing"));
      video.addEventListener("timeupdate", () => {
        if (progressSampled.has(video)) return;
        let startTime;
        try { startTime = Number(video.currentTime); } catch (_) { return; }
        if (!Number.isFinite(startTime) || startTime < 0) return;
        progressSampled.add(video);
        setTimeout(() => {
          let endTime;
          try { endTime = Number(video.currentTime); } catch (_) { return; }
          if (Number.isFinite(endTime) && endTime > startTime + 0.25) {
            report("zns-video-time-advanced", { sampleWindowMs: PROGRESS_SAMPLE_MS });
          }
        }, PROGRESS_SAMPLE_MS);
      });
    }
    if (video.readyState < 2 || playAttempted.has(video)) return;
    playAttempted.add(video);
    try {
      video.muted = false;
      if (typeof video.volume === "number") video.volume = 1;
      if (video.paused && typeof video.play === "function") {
        const result = video.play();
        if (result && typeof result.catch === "function") {
          result.catch(() => report("zns-embedded-play-rejected"));
        }
      }
      report("zns-embedded-start-attempt");
    } catch (_) {
      report("zns-embedded-play-rejected");
    }
  };
  RETRY_DELAYS_MS.forEach((delay) => setTimeout(attempt, delay));
})();
