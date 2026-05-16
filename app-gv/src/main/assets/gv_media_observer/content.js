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
  const CGTV_TOP_OFFSET_PX = 8;
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

  function collectCgtvBradmaxVideoState() {
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
        videoWidth: 0,
        videoHeight: 0,
        rectText: ""
      };
    }
    const rect = best.getBoundingClientRect();
    const paused = !!best.paused;
    const currentTime = typeof best.currentTime === "number" ? best.currentTime : 0;
    return {
      hasVideo: true,
      playing: !paused && (best.readyState || 0) >= 1,
      paused,
      readyState: best.readyState || 0,
      currentTime,
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
        centerX: Math.max(1, Math.floor(window.innerWidth / 2)),
        centerY: Math.max(1, Math.floor(window.innerHeight / 2)),
        viewportWidth: numberOrZero(window.innerWidth || 0),
        viewportHeight: numberOrZero(window.innerHeight || 0),
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
      const targetScrollY = Math.max(0, currentScrollY + beforeTop);
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
  scheduleNovusTelearubaFlow();
  scheduleCgtvPageFullscreenLike();
  scheduleCgtvPlayAssist();
  maybeAttachAbsTegoTopPlaybackListener();
  setupAbsTegoFullscreenNativeBridge();
  window.addEventListener("load", publish, { once: true });
  window.addEventListener("load", applyTegoQualityPolicy, { once: true });
  window.addEventListener("load", scheduleAbsTegoStartupReprobe, { once: true });
  window.addEventListener("load", scheduleAbsTegoPageFullscreenLike, { once: true });
  window.addEventListener("load", scheduleNovusTelearubaFlow, { once: true });
  window.addEventListener("load", scheduleCgtvPageFullscreenLike, { once: true });
  window.addEventListener("load", scheduleCgtvPlayAssist, { once: true });
  window.addEventListener("load", maybeAttachAbsTegoTopPlaybackListener, { once: true });
  document.addEventListener("visibilitychange", publish);
  document.addEventListener("visibilitychange", applyTegoQualityPolicy);
  setInterval(publish, 2000);
  setInterval(applyTegoQualityPolicy, 1200);
})();
