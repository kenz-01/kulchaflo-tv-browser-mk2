(function () {
  "use strict";

  const SCOPE = Object.freeze({
    site: "znsbahamas.com",
    embed: "player.streamcomedia.com",
  });
  const RETRY_DELAYS_MS = Object.freeze([300, 900, 2000, 4000, 7000, 11000, 18000]);
  const VIDEO_DISCOVERY_WINDOW_MS = 60000;
  const MAX_VIDEO_DISCOVERY_EVENTS = 8;
  const PROGRESS_SAMPLE_MS = 4000;
  const MAX_PROGRESS_SAMPLES = 3;
  const TRUSTED_INPUT_WINDOW_MS = 5000;
  const TRUSTED_INPUT_EVENTS = Object.freeze(["pointerdown", "pointerup", "click", "keydown"]);
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
    const watchedFrames = new WeakSet();
    const attempt = () => {
      if (applied || route(window.location.href) !== "site") return;
      const frame = officialFrame(document);
      if (!frame) return;
      if (!watchedFrames.has(frame)) {
        watchedFrames.add(frame);
        frame.addEventListener("load", () => report("zns-outer-frame-load-observed"), { once: true });
        report("zns-outer-frame-load-watch-attached");
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
  const helperStartedAtMs = Date.now();
  const videoElements = () => {
    try { return Array.from(document.querySelectorAll("video")).slice(0, 32); } catch (_) { return []; }
  };
  const initialVideos = videoElements();
  const initialVisibleVideoCount = initialVideos.filter(visible).length;
  report("zns-embedded-helper-active", {
    helperAgeMs: 0,
    initialVideoCount: initialVideos.length,
    initialVisibleVideoCount,
  });
  const observed = new WeakSet();
  const progressSampleCount = new WeakMap();
  const progressPending = new WeakSet();
  const progressReported = new WeakSet();
  const reportedMediaEvents = new WeakMap();
  const mediaEventNames = new Set(MEDIA_EVENTS);
  let lastTrustedInput = null;
  TRUSTED_INPUT_EVENTS.forEach((eventName) => {
    try {
      document.addEventListener?.(eventName, (event) => {
        if (!event || event.isTrusted !== true) return;
        lastTrustedInput = { kind: eventName, atMs: Date.now() };
      }, true);
    } catch (_) {}
  });
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
  const audioSnapshot = (video) => {
    const snapshot = mediaSnapshot(video);
    return { muted: snapshot.muted, volume: snapshot.volume };
  };
  const reportAudioStateChange = (video, before) => {
    const after = audioSnapshot(video);
    if (before.muted === after.muted && before.volume === after.volume) return before;
    const inputAgeMs = lastTrustedInput ? Math.max(0, Date.now() - lastTrustedInput.atMs) : -1;
    const hasRecentInput = inputAgeMs >= 0 && inputAgeMs <= TRUSTED_INPUT_WINDOW_MS;
    report("zns-audio-state", {
      event: "volumechange",
      mutedBefore: before.muted,
      mutedAfter: after.muted,
      volumeBefore: before.volume,
      volumeAfter: after.volume,
      recentTrustedInput: hasRecentInput ? lastTrustedInput.kind : "none",
      recentTrustedInputAgeMs: hasRecentInput ? inputAgeMs : -1,
    });
    return after;
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
  let lastDiscoveryVideoCount = initialVideos.length;
  let lastDiscoveryVisibleCount = initialVisibleVideoCount;
  let discoveryEventCount = 0;
  let discoveryStopped = false;
  let videoEverObserved = false;
  const discoveryAgeMs = () => Math.max(0, Math.min(VIDEO_DISCOVERY_WINDOW_MS, Date.now() - helperStartedAtMs));
  const attempt = (trigger = "scheduled") => {
    const video = oneVisible(videoElements().slice(0, 8));
    if (!video) return;
    if (!observed.has(video)) {
      observed.add(video);
      videoEverObserved = true;
      const initialSnapshot = mediaSnapshot(video);
      let previousAudioState = { muted: initialSnapshot.muted, volume: initialSnapshot.volume };
      report("zns-embedded-observed", {
        ...initialSnapshot,
        helperAgeMs: discoveryAgeMs(),
        discoveryTrigger: trigger,
      });
      video.addEventListener("volumechange", () => {
        previousAudioState = reportAudioStateChange(video, previousAudioState);
      });
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
  const videoIn = (node) => {
    try {
      return Boolean(node && (
        node.matches?.("video") || node.querySelector?.("video") || node.closest?.("video")
      ));
    } catch (_) { return false; }
  };
  const stopDiscovery = (reason) => {
    if (discoveryStopped) return;
    discoveryStopped = true;
    try { discoveryObserver?.disconnect(); } catch (_) {}
    report("zns-video-discovery-window-ended", {
      helperAgeMs: discoveryAgeMs(),
      reason,
      videoEverObserved,
    });
  };
  let discoveryObserver = null;
  if (typeof MutationObserver === "function") {
    discoveryObserver = new MutationObserver((records) => {
      if (discoveryStopped || discoveryAgeMs() >= VIDEO_DISCOVERY_WINDOW_MS) return;
      const relevantRecord = records.find((record) => {
        if (record.type === "childList") return Array.from(record.addedNodes || []).some(videoIn);
        if (record.type === "attributes" && ["class", "hidden", "src", "style"].includes(record.attributeName)) {
          return videoIn(record.target);
        }
        return false;
      });
      if (!relevantRecord) return;
      const videos = videoElements();
      const visibleVideoCount = videos.filter(visible).length;
      if (videos.length !== lastDiscoveryVideoCount || visibleVideoCount !== lastDiscoveryVisibleCount) {
        lastDiscoveryVideoCount = videos.length;
        lastDiscoveryVisibleCount = visibleVideoCount;
        if (discoveryEventCount < MAX_VIDEO_DISCOVERY_EVENTS) {
          discoveryEventCount += 1;
          report("zns-video-discovery", {
            helperAgeMs: discoveryAgeMs(),
            videoCount: videos.length,
            visibleVideoCount,
            trigger: relevantRecord.type === "childList" ? "video_inserted" : "video_changed",
          });
        }
      }
      attempt("mutation");
    });
    try {
      discoveryObserver.observe(document.documentElement || document, {
        attributes: true,
        attributeFilter: ["class", "hidden", "src", "style"],
        childList: true,
        subtree: true,
      });
    } catch (_) {
      discoveryObserver = null;
    }
  }
  if (!discoveryObserver) {
    report("zns-video-discovery", {
      helperAgeMs: 0,
      videoCount: initialVideos.length,
      visibleVideoCount: initialVisibleVideoCount,
      trigger: "observer_unavailable",
    });
  }
  document.addEventListener?.("pagehide", () => stopDiscovery("pagehide"), { once: true });
  setTimeout(() => stopDiscovery("deadline"), VIDEO_DISCOVERY_WINDOW_MS);
  attempt("initial");
  RETRY_DELAYS_MS.forEach((delay) => setTimeout(() => attempt("scheduled"), delay));
})();
