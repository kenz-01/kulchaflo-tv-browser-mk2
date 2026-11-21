(function () {
  "use strict";

  const OFFICIAL_HOST = "telesistema11.com.do";
  const SOURCE_ATTRIBUTES = Object.freeze(["src", "data-src", "data-lazy-src", "data-litespeed-src"]);
  const TRUSTED_HOSTS = new Set(["dailymotion.com", "www.dailymotion.com", "geo.dailymotion.com"]);
  const MAX_WAIT_MS = 60_000;
  const MAX_EVENTS = 32;
  const MAX_FRAMES = 16;

  function isOfficialPage(rawUrl) {
    try {
      const url = new URL(String(rawUrl || ""));
      return url.protocol === "https:" && !url.username && !url.password &&
        (!url.port || url.port === "443") &&
        url.hostname.toLowerCase().replace(/^www\./, "") === OFFICIAL_HOST &&
        url.pathname.toLowerCase().replace(/\/+$/, "") === "/en-vivo";
    } catch (_) {
      return false;
    }
  }

  function isTrustedPlayerSource(rawUrl, pageUrl) {
    try {
      const url = new URL(String(rawUrl || ""), pageUrl || "https://invalid.example/");
      if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
        return false;
      }
      const host = url.hostname.toLowerCase();
      const path = url.pathname.toLowerCase();
      return TRUSTED_HOSTS.has(host) && (
        (host === "dailymotion.com" || host === "www.dailymotion.com") &&
          (path.startsWith("/embed/") || path.startsWith("/video/")) ||
        host === "geo.dailymotion.com" &&
          (path === "/player" || path.startsWith("/player/") || path === "/player.html")
      );
    } catch (_) {
      return false;
    }
  }

  globalThis.KfTelesistemaFirstInteractionDiagnostic = Object.freeze({
    isOfficialPage,
    isTrustedPlayerSource,
    limits: Object.freeze({ maxWaitMs: MAX_WAIT_MS, maxEvents: MAX_EVENTS, maxFrames: MAX_FRAMES }),
  });

  if (typeof window === "undefined" || typeof document === "undefined" || window.top !== window) return;
  if (!isOfficialPage(window.location?.href)) return;

  const startedAt = Date.now();
  const ids = new WeakMap();
  const frames = new Map();
  let nextFrameId = 1;
  let eventCount = 0;
  let stopped = false;
  let observer = null;
  let deadline = null;

  function elapsedMs() {
    return Math.max(0, Math.min(MAX_WAIT_MS, Date.now() - startedAt));
  }

  function report(phase, fields = {}) {
    if (stopped || eventCount >= MAX_EVENTS) return;
    eventCount += 1;
    const payload = {
      type: "telesistema-interaction-diagnostic",
      phase,
      elapsedMs: elapsedMs(),
      ...fields,
    };
    try { window.prompt("__GV_MEDIA__" + JSON.stringify(payload), ""); } catch (_) {}
  }

  function trustedSource(frame) {
    for (const name of SOURCE_ATTRIBUTES) {
      const value = String(frame?.getAttribute?.(name) || "");
      if (isTrustedPlayerSource(value, window.location.href)) return { name, value };
    }
    return null;
  }

  function frameId(frame) {
    let id = ids.get(frame);
    if (!id && nextFrameId <= MAX_FRAMES) {
      id = nextFrameId++;
      ids.set(frame, id);
    }
    return id || 0;
  }

  function readAttributes(frame) {
    const values = new Map();
    for (const name of SOURCE_ATTRIBUTES) values.set(name, String(frame.getAttribute(name) || ""));
    return values;
  }

  function attach(frame) {
    if (frames.has(frame) || frames.size >= MAX_FRAMES || !trustedSource(frame)) return;
    const id = frameId(frame);
    if (!id) return;
    const entry = { id, attributes: readAttributes(frame), loadCount: 0, onLoad: null };
    entry.onLoad = () => {
      if (stopped || !trustedSource(frame)) return;
      entry.loadCount += 1;
      report("frame-load", { frameId: id, frameCount: frames.size, loadCount: entry.loadCount });
    };
    try { frame.addEventListener("load", entry.onLoad); } catch (_) {}
    frames.set(frame, entry);
    report("frame-added", { frameId: id, frameCount: frames.size, sourceChange: "initial" });
  }

  function detach(frame) {
    const entry = frames.get(frame);
    if (!entry) return;
    try { frame.removeEventListener("load", entry.onLoad); } catch (_) {}
    frames.delete(frame);
    report("frame-removed", { frameId: entry.id, frameCount: frames.size });
  }

  function scan() {
    let candidates = [];
    try {
      candidates = Array.from(document.querySelectorAll("iframe"));
    } catch (_) {}
    const present = new Set(candidates);
    for (const frame of candidates) attach(frame);
    for (const frame of Array.from(frames.keys())) {
      if (!present.has(frame)) detach(frame);
      else if (!trustedSource(frame)) detach(frame);
    }
  }

  function inspectAttribute(record) {
    const frame = record.target;
    if (!frame || String(frame.tagName || "").toUpperCase() !== "IFRAME") return;
    const name = String(record.attributeName || "").toLowerCase();
    if (!SOURCE_ATTRIBUTES.includes(name)) return;
    if (!frames.has(frame)) attach(frame);
    const entry = frames.get(frame);
    if (!entry) return;
    const previous = record.oldValue === undefined
      ? (entry.attributes.get(name) || "")
      : String(record.oldValue || "");
    const current = String(frame.getAttribute(name) || "");
    entry.attributes.set(name, current);
    const change = previous === current ? "same" : "changed";
    report("frame-source-change", {
      frameId: entry.id,
      frameCount: frames.size,
      sourceAttribute: name,
      sourceChange: change,
    });
    if (!trustedSource(frame)) detach(frame);
  }

  function inspectChildList(record) {
    const added = Array.from(record.addedNodes || []);
    const removed = Array.from(record.removedNodes || []);
    for (const node of added) {
      if (String(node?.tagName || "").toUpperCase() === "IFRAME") attach(node);
      try { node.querySelectorAll?.("iframe").forEach(attach); } catch (_) {}
    }
    for (const node of removed) {
      if (String(node?.tagName || "").toUpperCase() === "IFRAME") detach(node);
      try { node.querySelectorAll?.("iframe").forEach(detach); } catch (_) {}
    }
  }

  function stop(reason) {
    if (stopped) return;
    report(reason);
    stopped = true;
    try { observer?.disconnect(); } catch (_) {}
    try { if (deadline !== null) clearTimeout(deadline); } catch (_) {}
    for (const [frame, entry] of frames) {
      try { frame.removeEventListener("load", entry.onLoad); } catch (_) {}
    }
    frames.clear();
    try { window.removeEventListener("pagehide", onPageHide); } catch (_) {}
    try { window.removeEventListener("pageshow", onPageShow); } catch (_) {}
  }

  function onPageHide() { report("pagehide", { frameCount: frames.size }); }
  function onPageShow() { report("pageshow", { frameCount: frames.size }); }

  report("diagnostic-active", { frameCount: 0 });
  scan();
  report("frame-snapshot", { frameCount: frames.size });
  try {
    observer = new MutationObserver((records) => {
      if (!isOfficialPage(window.location?.href)) {
        stop("route-changed");
        return;
      }
      for (const record of records) {
        if (record.type === "attributes") inspectAttribute(record);
        else if (record.type === "childList") inspectChildList(record);
        if (eventCount >= MAX_EVENTS) break;
      }
      if (eventCount >= MAX_EVENTS) stop("observation-limit");
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeOldValue: true,
      attributeFilter: [...SOURCE_ATTRIBUTES],
      childList: true,
      subtree: true,
    });
  } catch (_) {}
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);
  deadline = setTimeout(() => stop("observation-limit"), MAX_WAIT_MS);
})();
