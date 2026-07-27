(function (root) {
  "use strict";

  const REQUIRED_STABLE_OBSERVATIONS = 3;
  const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
  const BACKGROUND_MARKER = /\b(background|banner|hero|decorative)\b|(?:^|[-_])bg(?:[-_]|$)/i;
  const PLAYER_MARKER = /\b(player|videojs|vjs|jwplayer|flowplayer|bradmax|bmp|shaka)\b/i;
  const SUPPORT_MARKER = /\b(support|supporting|ad-play|hidden)\b/i;

  function safeToken(value, fallback) {
    const normalized = String(value || "").trim().toLowerCase();
    return SAFE_ID.test(normalized) ? normalized : fallback;
  }

  function sourceKind(rawSource, mimeType) {
    const source = String(rawSource || "").trim();
    const mime = String(mimeType || "").trim().toLowerCase();
    if (source.toLowerCase().startsWith("blob:")) return "managed-media-source";
    let path = "";
    try {
      path = new URL(source).pathname.toLowerCase();
    } catch (_) {}
    if (path.endsWith(".m3u8") || mime.includes("mpegurl")) return "direct-hls";
    if (path.endsWith(".mp4") || mime === "video/mp4") return "direct-mp4";
    if (path.endsWith(".webm") || mime === "video/webm") return "direct-webm";
    if (path.endsWith(".mp3") || path.endsWith(".m4a") || mime.startsWith("audio/")) return "direct-audio";
    return source ? "unsupported-source" : "unavailable";
  }

  function safePromotableUrl(rawSource, kind) {
    if (!["direct-hls", "direct-mp4", "direct-webm"].includes(kind)) return "";
    try {
      const parsed = new URL(String(rawSource || ""));
      if (!["http:", "https:"].includes(parsed.protocol)) return "";
      if (parsed.username || parsed.password || parsed.search || parsed.hash) return "";
      return parsed.toString();
    } catch (_) {
      return "";
    }
  }

  function durationCategory(duration) {
    if (duration === Infinity) return "infinite-live";
    const value = Number(duration);
    if (!Number.isFinite(value) || value <= 0) return "unavailable";
    return value <= 30 ? "finite-short" : "finite-long";
  }

  function markerText(element) {
    const values = [];
    let current = element;
    for (let depth = 0; current && depth < 5; depth += 1) {
      values.push(String(current.id || ""));
      values.push(String(current.className || ""));
      current = current.parentElement;
    }
    return values.join(" ").slice(0, 600);
  }

  function describeCandidate(element, source, options) {
    const settings = options || {};
    const rect = element.getBoundingClientRect();
    const style = root.getComputedStyle(element);
    const viewportWidth = Number(root.innerWidth || 0);
    const viewportHeight = Number(root.innerHeight || 0);
    const intersectionWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
    const intersectionHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
    const visibleArea = Math.round(intersectionWidth * intersectionHeight);
    const renderedArea = Math.max(1, Number(rect.width || 0) * Number(rect.height || 0));
    const markers = markerText(element);
    const mimeType = String(settings.mimeType || element.getAttribute("type") || "").slice(0, 80);
    const kind = sourceKind(source, mimeType);
    const tagName = String(element.tagName || "").toLowerCase();
    const visible = style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity || 1) > 0 &&
      rect.width > 2 &&
      rect.height > 2 &&
      visibleArea > 0;
    const frameId = safeToken(settings.frameId, "unknown-frame");
    const mediaOrder = Math.max(1, Math.min(64, Number(settings.mediaOrder) || 1));
    const sourceOrder = Math.max(1, Math.min(16, Number(settings.sourceOrder) || 1));
    return {
      candidateId: `${frameId}-media-${mediaOrder}-source-${sourceOrder}`,
      frameId,
      frameRole: settings.frameRole === "top-level" ? "top-level" : "child-frame",
      frameLocalOrder: mediaOrder,
      sourceKind: kind,
      src: safePromotableUrl(source, kind),
      mimeType,
      tagName,
      visible,
      renderedWidth: Math.round(Number(rect.width || 0)),
      renderedHeight: Math.round(Number(rect.height || 0)),
      visibleArea,
      viewportIntersection: Number((visibleArea / renderedArea).toFixed(4)),
      mediaError: Number(element.error && element.error.code || 0),
      readyState: Number(element.readyState || 0),
      paused: Boolean(element.paused),
      ended: Boolean(element.ended),
      muted: Boolean(element.muted),
      autoplay: Boolean(element.autoplay),
      loop: Boolean(element.loop),
      controls: Boolean(element.controls),
      durationCategory: durationCategory(element.duration),
      backgroundAncestry: BACKGROUND_MARKER.test(markers),
      playerManagedAncestry: PLAYER_MARKER.test(markers),
      hiddenSupportElement: SUPPORT_MARKER.test(markers) && !visible,
      managedMediaSource: kind === "managed-media-source"
    };
  }

  function nextSettlement(previous, candidateSignature) {
    const prior = previous || { signature: "", stableObservationCount: 0 };
    const signature = String(candidateSignature || "");
    const stableObservationCount = signature === prior.signature
      ? Math.min(REQUIRED_STABLE_OBSERVATIONS, prior.stableObservationCount + 1)
      : 1;
    return { signature, stableObservationCount };
  }

  root.KfMediaCandidateDescriptor = Object.freeze({
    REQUIRED_STABLE_OBSERVATIONS,
    describeCandidate,
    durationCategory,
    nextSettlement,
    safePromotableUrl,
    sourceKind
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
