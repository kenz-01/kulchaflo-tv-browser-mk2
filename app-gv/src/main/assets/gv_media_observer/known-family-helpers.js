(function () {
  "use strict";
  // Route-specific reuse of manual browser-first helpers. Never promotes media to Media3.
  // The public-target URLs are the source of these exact route gates.
  const ROUTES = Object.freeze([
    { id: "acento-tv", host: "acentotv.acento.com.do", path: "/en-vivo.html", family: "youtube" },
    { id: "ahora-tv", host: "ahoratv.com", path: "/", family: "youtube" },
    { id: "antena-7", host: "antena7.com.do", path: "/envivo-canal-7", family: "youtube" },
    { id: "energia-tv", host: "energiabonaire.com", path: "/", family: "youtube" },
    { id: "prensa-latina-tv", host: "prensa-latina.cu", path: "/", family: "youtube" },
    { id: "etv-guadeloupe", host: "etv.gp", path: "/direct", family: "videojs" },
    { id: "bonce-tv", host: "bonce.tv", path: "/", family: "videojs" },
    { id: "tele-peyi", host: "peyiguyane.com", path: "/tele-peyi", family: "videojs" },
    { id: "xfm-aruba", host: "xfmaruba.com", path: "/", family: "videojs" },
    { id: "balchi-tv", host: "balchitv.com", path: "/", family: "videojs" },
    { id: "teleonce", host: "cdn.teleonce.com", path: "/en-vivo", family: "jwplayer" },
    { id: "tv-direct-13", host: "tvdirect13.com", path: "/", family: "jwplayer" },
    { id: "telesistema-11", host: "telesistema11.com.do", path: "/en-vivo", family: "dailymotion" },
    { id: "teleuniverso-29", host: "teleuniversotv.com", path: "/", family: "dailymotion" },
    { id: "pointe-tv", host: "pointville.ag", path: "/live-stream", family: "vimeo" },
    { id: "bonao-tv", host: "bonaotv.com", path: "/", family: "hlsjs" },
    { id: "rtvd", host: "rtvd.gob.do", path: "/", family: "hlsjs" },
    { id: "yunavision", host: "yunavision.com", path: "/", family: "hlsjs" },
    { id: "adoram-tv", host: "adoramtv.org", path: "/programacion-en-vivo", family: "html5" }
  ]);

  function normalizePath(path) {
    const normalized = String(path || "/").toLowerCase().replace(/\/+$/, "");
    return normalized || "/";
  }

  function resolveRoute(rawUrl) {
    try {
      const url = new URL(String(rawUrl || ""));
      if (url.protocol !== "https:" || url.username || url.password) return null;
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      const path = normalizePath(url.pathname);
      return ROUTES.find((route) => route.host === host && route.path === path) || null;
    } catch (_) {
      return null;
    }
  }

  function trustedFrameUrl(family, rawUrl, pageUrl) {
    try {
      const url = new URL(String(rawUrl || ""), pageUrl || "https://invalid.example/");
      if (url.protocol !== "https:" || url.username || url.password) return false;
      const host = url.hostname.toLowerCase();
      const path = url.pathname.toLowerCase();
      if (family === "youtube") {
        return (host === "www.youtube.com" || host === "youtube.com" ||
          host === "www.youtube-nocookie.com" || host === "youtube-nocookie.com") &&
          (path.startsWith("/embed/") || path.startsWith("/live/"));
      }
      if (family === "vimeo") {
        return ((host === "player.vimeo.com" && path.startsWith("/video/")) ||
          ((host === "vimeo.com" || host === "www.vimeo.com") &&
            (path.startsWith("/event/") || path.startsWith("/video/"))));
      }
      if (family === "dailymotion") {
        return ((host === "www.dailymotion.com" || host === "dailymotion.com") &&
          (path.startsWith("/embed/") || path.startsWith("/video/"))) ||
          (host === "geo.dailymotion.com" && path.startsWith("/player"));
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  // Safe pure functions available for deterministic Player Lab tests.
  globalThis.KfKnownFamilyHelpers = Object.freeze({
    routes: ROUTES,
    resolveRoute,
    trustedFrameUrl
  });
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.top !== window || !document.body) return;

  const route = resolveRoute(window.location.href);
  if (!route) return;
  let playerFirstApplied = false;
  const startedVideos = new WeakSet();
  const RETRY_MS = [250, 800, 1800, 3500, 6000];

  function isUsable(node) {
    if (!node || typeof node.getBoundingClientRect !== "function") return false;
    const rect = node.getBoundingClientRect();
    return rect.width >= 300 && rect.height >= 160;
  }

  function chooseOne(nodes) {
    const matches = Array.from(nodes || []).filter(isUsable);
    // Never guess the correct stream on a multi-player page (e.g. RTVD).
    return matches.length === 1 ? matches[0] : null;
  }

  function findPlayer() {
    const family = route.family;
    if (family === "youtube" || family === "vimeo" || family === "dailymotion") {
      return chooseOne(Array.from(document.querySelectorAll("iframe[src]")).filter((frame) =>
        trustedFrameUrl(family, frame.getAttribute("src") || frame.src, window.location.href)));
    }
    if (family === "videojs") {
      return chooseOne(Array.from(document.querySelectorAll(".video-js, video-js")).filter((node) =>
        node.querySelector("video, .vjs-tech")));
    }
    if (family === "jwplayer") {
      return chooseOne(Array.from(document.querySelectorAll(".jwplayer, .jw-player")).filter((node) =>
        node.querySelector("video, .jw-preview, .jw-controls")));
    }
    if (family === "hlsjs" || family === "html5") {
      return chooseOne(Array.from(document.querySelectorAll("video")).filter((video) =>
        video.readyState >= 2 || !!(video.currentSrc || video.src) ||
        !!video.querySelector("source[src]")));
    }
    return null;
  }

  function applyPlayerFirst(player) {
    if (playerFirstApplied || !document.body || !isUsable(player)) return;
    // Use the tested manual-helper pattern: isolate only a positively matched player,
    // style outer ancestors, leave native/player transport descendants alone.
    const path = new Set();
    let node = player;
    while (node && node !== document.body) {
      path.add(node);
      node = node.parentElement;
    }
    if (node !== document.body) return;
    Array.from(document.body.children).forEach((child) => {
      if (!path.has(child)) child.style.setProperty("display", "none", "important");
    });
    for (let ancestor = player; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
      const style = ancestor.style;
      style.setProperty("position", "fixed", "important");
      style.setProperty("inset", "0", "important");
      style.setProperty("width", "100vw", "important");
      style.setProperty("height", "100vh", "important");
      style.setProperty("max-width", "none", "important");
      style.setProperty("max-height", "none", "important");
      style.setProperty("margin", "0", "important");
      style.setProperty("z-index", "2147483000", "important");
    }
    document.documentElement.style.setProperty("overflow", "hidden", "important");
    document.body.style.setProperty("overflow", "hidden", "important");
    document.body.style.setProperty("margin", "0", "important");
    document.body.style.setProperty("background", "#000", "important");
    playerFirstApplied = true;
    try {
      console.info("[KF known-family] player-first", route.id, route.family);
    } catch (_) {}
  }

  function allowTrustedFrame(player) {
    if (!player || player.tagName !== "IFRAME" ||
        !trustedFrameUrl(route.family, player.getAttribute("src") || player.src, window.location.href)) return;
    const allow = String(player.getAttribute("allow") || "");
    const parts = ["autoplay", "fullscreen", "picture-in-picture"];
    const additions = parts.filter((part) => !allow.toLowerCase().split(/[; ]+/).includes(part));
    if (additions.length) player.setAttribute("allow", (allow ? allow + "; " : "") + additions.join("; "));
    player.setAttribute("allowfullscreen", "true");
    // No iframe source rewrite, synthetic taps, or scripted YouTube/Dailymotion playback.
  }

  function maybeStartMedia(player) {
    if (route.family === "youtube" || route.family === "vimeo" || route.family === "dailymotion") return;
    const video = player.tagName === "VIDEO" ? player : player.querySelector("video");
    if (!video || startedVideos.has(video) || video.readyState < 2) return;
    startedVideos.add(video);
    try {
      video.muted = false;
      if (typeof video.volume === "number") video.volume = 1;
      if (video.paused && typeof video.play === "function") {
        const result = video.play();
        if (result && typeof result.catch === "function") result.catch(() => {});
      }
    } catch (_) {}
  }

  function attempt() {
    // An official route is not sufficient evidence: the expected player must exist.
    if (resolveRoute(window.location.href) !== route) return;
    const player = findPlayer();
    if (!player) return;
    if (route.family === "youtube" || route.family === "vimeo" || route.family === "dailymotion") {
      allowTrustedFrame(player);
    }
    applyPlayerFirst(player);
    maybeStartMedia(player);
  }

  RETRY_MS.forEach((delay) => setTimeout(attempt, delay));
})();
