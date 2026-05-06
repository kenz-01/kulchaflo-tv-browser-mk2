(function () {
  const PROMPT_PREFIX = "__GV_MEDIA__";
  const TEGO_TARGET_MAX_HEIGHT = 720;
  const ABS_TEGO_STARTUP_REPROBE_DELAYS_MS = [2000, 5000, 9000, 14000];
  const ABS_TEGO_FULLSCREEN_SEQUENCE_DELAYS_MS = [0, 700, 1600, 2600, 4200, 6500, 9000, 12500, 16000];
  const ENABLE_ABS_TEGO_PAGE_FULLSCREEN_LIKE = true;
  const ENABLE_ABS_TEGO_PLAYER_FULLSCREEN_LIKE = true;
  const ENABLE_ABS_TEGO_F_KEY_AFTER_FULLSCREEN_LIKE = false;
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
    if (!isTegoPlayerFrame()) return false;
    const path = (window.location.pathname || "").toLowerCase();
    if (!path.startsWith("/player.php")) return false;
    let channel = "";
    try {
      channel = (new URLSearchParams(window.location.search || "").get("channel") || "").trim();
    } catch (_) {
      channel = "";
    }
    return !channel || channel === "10";
  }

  function isAbsLiveTopPage() {
    const host = (window.location.hostname || "").toLowerCase();
    if (host !== "abstvradio.com" && host !== "www.abstvradio.com") return false;
    const path = (window.location.pathname || "").toLowerCase();
    return path.indexOf("/live-streaming") === 0;
  }

  function isAbsTegoChannel10Iframe(node) {
    if (!node || node.tagName !== "IFRAME") return false;
    const src = String(node.src || "").toLowerCase();
    if (src.indexOf("player.tegotv.com/player.php") < 0) return false;
    return src.indexOf("channel=10") >= 0 || src.indexOf("channel%3d10") >= 0 || src.indexOf("channel") < 0;
  }

  function sanitizeAbsTegoPlayerUrl(rawUrl) {
    try {
      const url = new URL(String(rawUrl || ""), window.location.href);
      const host = (url.hostname || "").toLowerCase();
      const path = (url.pathname || "").toLowerCase();
      if (host.indexOf("player.tegotv.com") < 0) return String(rawUrl || "");
      if (path.indexOf("/player.php") < 0) return String(rawUrl || "");
      const channel = (url.searchParams.get("channel") || "").trim();
      if (channel && channel !== "10") return String(rawUrl || "");
      url.searchParams.set("channel", "10");
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
    if (!isAbsLiveTopPage()) return null;
    const payload = {
      type: "abs-tego-page-fullscreen-like",
      phase: phase || "content-abs-tego-page-fullscreen-like",
      pageUrl: window.location.href,
      attemptAtMs: numberOrZero(attemptAtMs),
      applied: false,
      reason: "no-iframe",
      iframeRect: "none",
      iframeSummary: "none"
    };
    try {
      const iframe = Array.from(document.querySelectorAll("iframe")).find((node) => isAbsTegoChannel10Iframe(node));
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
      emitAbsTegoPlayerFirstActive("abs-top-iframe-promoted", attemptAtMs);
      return payload;
    } catch (error) {
      payload.reason = (error && error.message) || "error";
      promptPayload(payload);
      return payload;
    }
  }

  function emitAbsTegoPlayerFirstActive(reason, attemptAtMs) {
    if (absTegoPlayerFirstActiveEmitted) return;
    absTegoPlayerFirstActiveEmitted = true;
    promptPayload({
      type: "abs-tego-player-first-active",
      phase: "content-abs-tego-player-first-active",
      pageUrl: window.location.href,
      playerUrl: window.location.href,
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
    if (!isAbsLiveTopPage() || !iframe || absTegoTopOverlayCleanupScheduled) return;
    absTegoTopOverlayCleanupScheduled = true;
    const baseAttemptAtMs = numberOrZero(triggerAttemptAtMs);
    [250, 1300, 3000, 5200].forEach((delayMs) => {
      setTimeout(() => {
        if (!isAbsLiveTopPage() || !iframe || !document.body) return;
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
    if (!isAbsLiveTopPage() || !iframe || !document.body || absTegoPageContentCleanupScheduled) return;
    absTegoPageContentCleanupScheduled = true;
    const baseAttemptAtMs = numberOrZero(triggerAttemptAtMs);
    [250, 1100, 2600, 4800, 7600].forEach((delayMs) => {
      setTimeout(() => {
        if (!isAbsLiveTopPage() || !iframe || !document.body || !document.documentElement) return;
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
    if (!isAbsLiveTopPage() || absTegoTopPlaybackListenerAttached) return;
    absTegoTopPlaybackListenerAttached = true;
    window.addEventListener("message", (event) => {
      if (!isAbsLiveTopPage()) return;
      const data = event && event.data;
      if (!data || data.type !== "__KF_ABS_TEGO_PLAYBACK_PROGRESS__") return;
      if (!data.fullscreenLikeApplied) return;
      const playerUrl = String(data.playerUrl || "").toLowerCase();
      if (playerUrl.indexOf("player.tegotv.com/player.php") < 0) return;
      const iframe = Array.from(document.querySelectorAll("iframe")).find((node) => isAbsTegoChannel10Iframe(node));
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

  function scheduleAbsTegoPageFullscreenLike() {
    if (!ENABLE_ABS_TEGO_PAGE_FULLSCREEN_LIKE) return;
    if (absTegoPageFullscreenLikeStarted || !isAbsLiveTopPage()) return;
    absTegoPageFullscreenLikeStarted = true;
    [600, 1800, 4200, 7600].forEach((delayMs, index, arr) => {
      setTimeout(() => {
        if (!isAbsLiveTopPage()) return;
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
    if (snapshot.playbackProgressed) return false;
    if (snapshot.readyZeroPaused) return true;
    if (snapshot.missingHlsLevels) return true;
    if (snapshot.applied) return true;
    if (snapshot.playable) return true;
    return false;
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

  function setupAbsTegoFullscreenNativeBridge() {
    window.addEventListener("message", (event) => {
      if (!isAbsLiveTopPage()) return;
      const data = event && event.data;
      if (
        !data ||
        (
          data.type !== "kf-abs-tego-fullscreen-native-request" &&
          data.type !== "kf-abs-tego-fullscreen-native-hover"
        )
      ) {
        return;
      }
      const promptType =
        data.type === "kf-abs-tego-fullscreen-native-hover"
          ? "abs-tego-fullscreen-native-hover"
          : "abs-tego-fullscreen-native-request";
      let iframe = null;
      try {
        iframe = Array.from(document.querySelectorAll("iframe")).find((node) => {
          try {
            return isAbsTegoChannel10Iframe(node) && node.contentWindow === event.source;
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
          phase: data.type === "kf-abs-tego-fullscreen-native-hover" ? "content-abs-tego-fullscreen-native-hover" : "content-abs-tego-fullscreen-native-request",
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
        phase: data.type === "kf-abs-tego-fullscreen-native-hover" ? "content-abs-tego-fullscreen-native-hover" : "content-abs-tego-fullscreen-native-request",
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
        emitAbsTegoPlayerFirstActive("tego-player-first-layout", baseAttemptAtMs);
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
        const shouldContinue = shouldContinueAbsTegoStartupReprobe(snapshot);
        if (snapshot && snapshot.playbackProgressed) {
          runAbsTegoFullscreenSequence(delayMs, snapshot);
        }
        if (shouldContinue) {
          attemptAbsTegoStartupWake(delayMs);
        } else {
          absTegoStartupReprobeStopped = true;
          return;
        }
        if (delayMs === ABS_TEGO_STARTUP_REPROBE_DELAYS_MS[ABS_TEGO_STARTUP_REPROBE_DELAYS_MS.length - 1]) {
          absTegoStartupReprobeStopped = true;
        }
      }, delayMs);
    });
  }

  function maybeSanitizeAbsTegoPlayerFrameUrl() {
    if (!isAbsTegoChannel10Frame()) return false;
    const beforeUrl = String(window.location.href || "");
    const afterUrl = sanitizeAbsTegoPlayerUrl(beforeUrl);
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
    const signature = JSON.stringify(payload);
    if (signature === lastSignature) {
      return;
    }
    lastSignature = signature;
    promptPayload(payload);
  }

  const absTegoUrlRedirected = maybeSanitizeAbsTegoPlayerFrameUrl();
  if (absTegoUrlRedirected) {
    return;
  }
  publish();
  applyTegoQualityPolicy();
  scheduleAbsTegoStartupReprobe();
  scheduleAbsTegoPageFullscreenLike();
  maybeAttachAbsTegoTopPlaybackListener();
  setupAbsTegoFullscreenNativeBridge();
  window.addEventListener("load", publish, { once: true });
  window.addEventListener("load", applyTegoQualityPolicy, { once: true });
  window.addEventListener("load", scheduleAbsTegoStartupReprobe, { once: true });
  window.addEventListener("load", scheduleAbsTegoPageFullscreenLike, { once: true });
  window.addEventListener("load", maybeAttachAbsTegoTopPlaybackListener, { once: true });
  document.addEventListener("visibilitychange", publish);
  document.addEventListener("visibilitychange", applyTegoQualityPolicy);
  setInterval(publish, 2000);
  setInterval(applyTegoQualityPolicy, 1200);
})();
