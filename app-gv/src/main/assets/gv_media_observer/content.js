(function () {
  const PROMPT_PREFIX = "__GV_MEDIA__";
  const TEGO_TARGET_MAX_HEIGHT = 720;
  let lastSignature = "";
  let lastTegoSignature = "";

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

  function applyTegoQualityPolicy() {
    if (!isTegoPlayerFrame()) return;
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
        paused: !!video.paused
      }));
      const payload = {
        type: "tego-quality",
        phase: "content-tego-quality",
        pageUrl: window.location.href,
        title: document.title || "",
        playerCount: players.length,
        applied: results.some((result) => result && result.applied),
        results,
        videos
      };
      const signature = JSON.stringify(payload);
      if (signature !== lastTegoSignature) {
        lastTegoSignature = signature;
        promptPayload(payload);
      }
    } catch (_) {}
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

  publish();
  applyTegoQualityPolicy();
  window.addEventListener("load", publish, { once: true });
  window.addEventListener("load", applyTegoQualityPolicy, { once: true });
  document.addEventListener("visibilitychange", publish);
  document.addEventListener("visibilitychange", applyTegoQualityPolicy);
  setInterval(publish, 2000);
  setInterval(applyTegoQualityPolicy, 1200);
})();
