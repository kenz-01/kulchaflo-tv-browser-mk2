(function () {
  const PROMPT_PREFIX = "__GV_MEDIA__";
  let lastSignature = "";

  function isVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style && style.display !== "none" && style.visibility !== "hidden" && rect.width > 8 && rect.height > 8;
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
    try {
      window.prompt(PROMPT_PREFIX + JSON.stringify(payload), "");
    } catch (_) {}
  }

  publish();
  window.addEventListener("load", publish, { once: true });
  document.addEventListener("visibilitychange", publish);
  setInterval(publish, 2000);
})();
