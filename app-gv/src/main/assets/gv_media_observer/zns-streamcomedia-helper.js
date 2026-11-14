(function () {
  "use strict";

  const SCOPE = Object.freeze({
    site: "znsbahamas.com",
    embed: "player.streamcomedia.com",
  });
  const RETRY_DELAYS_MS = Object.freeze([300, 900, 2000, 4000, 7000, 11000, 18000]);
  const PROGRESS_SAMPLE_MS = 4000;
  const MAX_PROGRESS_SAMPLES = 3;
  const MEDIA_EVENTS = Object.freeze([
    "loadstart", "loadedmetadata", "loadeddata", "canplay", "play", "playing",
    "pause", "waiting", "stalled", "error", "abort", "emptied",
  ]);

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
      frame.setAttribute("allowfullscreen", "true");
      if (!applyPlayerFirst(frame, document)) return;
      applied = true;
      report("zns-outer-player-first");
    };
    RETRY_DELAYS_MS.forEach((delay) => setTimeout(attempt, delay));
    return;
  }

  if (ownRoute !== "embed" || window.top === window || route(document.referrer) !== "site") return;
  const observed = new WeakSet();
  const progressSampleCount = new WeakMap();
  const progressPending = new WeakSet();
  const progressReported = new WeakSet();
  const reportedMediaEvents = new WeakMap();
  const mediaEventNames = new Set(MEDIA_EVENTS);
  const mediaSnapshot = (video) => {
    const boundedInt = (value, min, max, fallback) => {
      const number = Number(value);
      return Number.isInteger(number) ? Math.max(min, Math.min(max, number)) : fallback;
    };
    let volume = -1;
    let networkState = -1;
    let mediaErrorCode = -1;
    let sourcePresent = false;
    let rendered = "unknown";
    try {
      const value = Number(video.volume);
      if (Number.isFinite(value)) volume = Math.max(0, Math.min(1, value));
    } catch (_) {}
    try { networkState = boundedInt(video.networkState, 0, 3, -1); } catch (_) {}
    try { mediaErrorCode = boundedInt(video.error?.code, 1, 4, video.error ? -1 : 0); } catch (_) {}
    try {
      sourcePresent = Boolean(video.currentSrc || video.getAttribute("src") || video.querySelector("source[src]"));
    } catch (_) {}
    try {
      const style = window.getComputedStyle(video);
      rendered = style && style.display !== "none" &&
        style.visibility !== "hidden" && style.visibility !== "collapse" &&
        Number(style.opacity || 1) >= 0.05 ? "yes" : "no";
      for (let parent = video.parentElement; rendered === "yes" && parent; parent = parent.parentElement) {
        const parentStyle = window.getComputedStyle(parent);
        if (!parentStyle || parentStyle.display === "none" ||
            parentStyle.visibility === "hidden" || parentStyle.visibility === "collapse" ||
            Number(parentStyle.opacity || 1) < 0.05) rendered = "no";
      }
    } catch (_) {}
    return {
      readyState: boundedInt(video.readyState, 0, 4, 0),
      paused: Boolean(video.paused),
      muted: Boolean(video.muted),
      volume,
      networkState,
      mediaErrorCode,
      sourcePresent,
      rendered,
      autoplay: Boolean(video.autoplay),
      controls: Boolean(video.controls),
    };
  };
  const reportMediaEvent = (video, event) => {
    if (!mediaEventNames.has(event)) return;
    let reported = reportedMediaEvents.get(video);
    if (!reported) {
      reported = new Set();
      reportedMediaEvents.set(video, reported);
    }
    if (reported.has(event)) return;
    reported.add(event);
    report("zns-media-event", { event, ...mediaSnapshot(video) });
  };
  const attempt = () => {
    const video = oneVisible(Array.from(document.querySelectorAll("video")).slice(0, 8));
    if (!video) return;
    if (!observed.has(video)) {
      observed.add(video);
      report("zns-embedded-observed", mediaSnapshot(video));
      video.addEventListener("playing", () => {
        report("zns-embedded-playing", mediaSnapshot(video));
        reportMediaEvent(video, "playing");
      });
      MEDIA_EVENTS.filter((event) => event !== "playing").forEach((event) => {
        video.addEventListener(event, () => reportMediaEvent(video, event));
      });
      video.addEventListener("timeupdate", () => {
        if (progressReported.has(video) || progressPending.has(video)) return;
        const sampleCount = progressSampleCount.get(video) || 0;
        if (sampleCount >= MAX_PROGRESS_SAMPLES) return;
        let startTime;
        try { startTime = Number(video.currentTime); } catch (_) { return; }
        if (!Number.isFinite(startTime) || startTime < 0) return;
        progressSampleCount.set(video, sampleCount + 1);
        progressPending.add(video);
        setTimeout(() => {
          progressPending.delete(video);
          let endTime;
          try { endTime = Number(video.currentTime); } catch (_) { return; }
          if (Number.isFinite(endTime) && endTime > startTime + 0.25) {
            progressReported.add(video);
            report("zns-video-time-advanced", { sampleWindowMs: PROGRESS_SAMPLE_MS });
          }
        }, PROGRESS_SAMPLE_MS);
      });
    }
  };
  RETRY_DELAYS_MS.forEach((delay) => setTimeout(attempt, delay));
})();
