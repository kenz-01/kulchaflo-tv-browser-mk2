import { redactUrl } from './redact-url.mjs';

export async function ensurePassiveFrameProbe(frame) {
  return frame.evaluate(() => {
    if (window.__KFLAB_PASSIVE_OBSERVER__) {
      return true;
    }
    const state = {
      nextMediaId: 1,
      nextEventSeq: 1,
      mediaIds: new WeakMap(),
      queue: [],
      limit: 100,
      knownSrc: new WeakMap(),
      sampleStats: new WeakMap(),
      removedIds: [],
      addedIds: [],
    };
    const cap = (event) => {
      if (state.queue.length < state.limit) {
        state.queue.push({ ...event, seq: state.nextEventSeq, observedAt: Date.now() });
        state.nextEventSeq += 1;
      }
    };
    const idFor = (element) => {
      if (!state.mediaIds.has(element)) {
        state.mediaIds.set(element, `media-${state.nextMediaId}`);
        state.nextMediaId += 1;
      }
      return state.mediaIds.get(element);
    };
    const srcFor = (element) => `${element.getAttribute('src') || ''}|${element.getAttribute('poster') || ''}`;
    const sampleMedia = (element) => {
      const currentTime = Number(element.currentTime);
      if (!Number.isFinite(currentTime)) return;
      const previous = state.sampleStats.get(element) ?? { sampleCount: 0, restartCount: 0, lastCurrentTime: null };
      if (previous.lastCurrentTime !== null && previous.lastCurrentTime > 1 && currentTime + 0.5 < previous.lastCurrentTime) {
        previous.restartCount += 1;
        cap({ type: 'media-time-reset', mediaId: idFor(element), tag: element.tagName.toLowerCase() });
      }
      previous.sampleCount = Math.min(120, previous.sampleCount + 1);
      previous.lastCurrentTime = currentTime;
      state.sampleStats.set(element, previous);
    };
    const watchMedia = (element, { initial = false } = {}) => {
      const id = idFor(element);
      if (!state.knownSrc.has(element)) {
        state.knownSrc.set(element, srcFor(element));
        cap({ type: initial ? 'initial-media-observed' : 'media-added', mediaId: id, tag: element.tagName.toLowerCase() });
      }
      sampleMedia(element);
      for (const type of ['loadedmetadata', 'canplay', 'playing', 'pause', 'waiting', 'stalled', 'ended', 'error', 'volumechange']) {
        element.addEventListener(type, () => {
          cap({ type: `media-event:${type}`, mediaId: id, tag: element.tagName.toLowerCase() });
        }, { passive: true });
      }
    };
    const scan = () => {
      for (const element of document.querySelectorAll('video,audio')) {
        watchMedia(element, { initial: true });
        const nextSrc = srcFor(element);
        if (state.knownSrc.get(element) !== nextSrc) {
          state.knownSrc.set(element, nextSrc);
          cap({ type: 'source-change', mediaId: idFor(element), tag: element.tagName.toLowerCase() });
        }
      }
    };
    scan();
    setInterval(() => {
      for (const element of document.querySelectorAll('video,audio')) sampleMedia(element);
    }, 1000);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const removedThisMutation = [];
        const addedThisMutation = [];
        if (mutation.type === 'attributes' && mutation.target instanceof HTMLMediaElement) {
          const nextSrc = srcFor(mutation.target);
          if (state.knownSrc.get(mutation.target) !== nextSrc) {
            state.knownSrc.set(mutation.target, nextSrc);
            cap({ type: 'source-change', mediaId: idFor(mutation.target), tag: mutation.target.tagName.toLowerCase() });
          }
        }
        for (const node of mutation.removedNodes) {
          if (node instanceof HTMLMediaElement) {
            const id = idFor(node);
            state.removedIds.push(id);
            removedThisMutation.push(id);
            cap({ type: 'media-removed', mediaId: id, tag: node.tagName.toLowerCase() });
          }
          if (node.querySelectorAll) {
            for (const element of node.querySelectorAll('video,audio')) {
              const id = idFor(element);
              state.removedIds.push(id);
              removedThisMutation.push(id);
              cap({ type: 'media-removed', mediaId: id, tag: element.tagName.toLowerCase() });
            }
          }
        }
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLMediaElement) {
            watchMedia(node);
            const id = idFor(node);
            state.addedIds.push(id);
            addedThisMutation.push(id);
          }
          if (node.querySelectorAll) {
            for (const element of node.querySelectorAll('video,audio')) {
              watchMedia(element);
              const id = idFor(element);
              state.addedIds.push(id);
              addedThisMutation.push(id);
            }
          }
        }
        if (removedThisMutation.length === 1 && addedThisMutation.length === 1) {
          cap({
            type: 'media-replaced',
            replacedMediaId: removedThisMutation[0],
            replacementMediaId: addedThisMutation[0],
          });
        }
      }
      scan();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'poster'],
    });
    window.__KFLAB_PASSIVE_OBSERVER__ = {
      idOf(element) {
        return idFor(element);
      },
      statsOf(element) {
        return { ...(state.sampleStats.get(element) ?? { sampleCount: 0, restartCount: 0 }) };
      },
      drain() {
        scan();
        const queue = state.queue.slice();
        state.queue.length = 0;
        return {
          queue,
          removedIds: state.removedIds.slice(),
          addedIds: state.addedIds.slice(),
        };
      },
    };
    return true;
  });
}

export async function readPassiveFrameState(frame, frameId) {
  const raw = await frame.evaluate(() => {
    const clip = (value, length = 160) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, length);
    const rectFor = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };
    const coverageFor = (rect) => {
      const width = Math.max(0, Math.min(rect.x + rect.width, window.innerWidth) - Math.max(rect.x, 0));
      const height = Math.max(0, Math.min(rect.y + rect.height, window.innerHeight) - Math.max(rect.y, 0));
      const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
      return Number(((width * height) / viewportArea).toFixed(6));
    };
    const visibleFor = (element, rect) => {
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
        return 'hidden';
      }
      if (rect.width <= 0 || rect.height <= 0) {
        return 'zero-area';
      }
      return 'visible';
    };
    const sourceKindFor = (value) => {
      const text = String(value || '').trim().toLowerCase();
      if (!text) return 'unavailable';
      if (text.startsWith('blob:')) return 'blob-media-source';
      try {
        const path = new URL(text, window.location.href).pathname.toLowerCase();
        if (path.endsWith('.m3u8')) return 'hls-manifest';
        if (path.endsWith('.mpd')) return 'dash-manifest';
        if (path.endsWith('.mp4')) return 'direct-mp4';
        if (path.endsWith('.webm')) return 'direct-webm';
        if (path.endsWith('.mp3') || path.endsWith('.m4a')) return 'direct-audio';
      } catch {}
      return 'other-media-source';
    };
    const ancestryFor = (element) => {
      const markers = [];
      let current = element;
      while (current && current.nodeType === 1 && markers.length < 5) {
        const safe = (value) => /^[A-Za-z0-9_-]{1,64}$/.test(value);
        markers.push({
          tag: String(current.tagName || '').toLowerCase().slice(0, 24),
          id: safe(String(current.id || '')) ? String(current.id) : '',
          classes: [...(current.classList || [])].filter(safe).slice(0, 6),
        });
        current = current.parentElement;
      }
      return markers;
    };
    const passive = window.__KFLAB_PASSIVE_OBSERVER__?.drain?.() ?? { queue: [], removedIds: [], addedIds: [] };
    const media = [...document.querySelectorAll('video,audio')].map((element, index) => {
      const rect = rectFor(element);
      const id = window.__KFLAB_PASSIVE_OBSERVER__?.idOf?.(element) ?? `media-${index + 1}`;
      const sourceValue = element.currentSrc || element.getAttribute('src') || '';
      const style = window.getComputedStyle(element);
      const intersectionWidth = Math.max(0, Math.min(rect.x + rect.width, window.innerWidth) - Math.max(rect.x, 0));
      const intersectionHeight = Math.max(0, Math.min(rect.y + rect.height, window.innerHeight) - Math.max(rect.y, 0));
      const elementArea = Math.max(1, rect.width * rect.height);
      const durationCategory = element.duration === Infinity
        ? 'infinite-live'
        : Number.isFinite(element.duration)
          ? (element.duration <= 30 ? 'finite-short' : 'finite-long')
          : 'unavailable';
      const sampleStats = window.__KFLAB_PASSIVE_OBSERVER__?.statsOf?.(element) ?? { sampleCount: 0, restartCount: 0 };
      const error = element.error;
      return {
        id,
        frameLocalDiscoveryOrder: Number(String(id).replace(/^media-/, '')) || index + 1,
        tag: element.tagName.toLowerCase(),
        src: element.getAttribute('src') || '',
        currentSrc: element.currentSrc || '',
        poster: element.getAttribute('poster') || '',
        paused: element.paused,
        ended: element.ended,
        muted: element.muted,
        volume: element.volume,
        autoplay: element.autoplay,
        loop: element.loop,
        controls: element.controls,
        playsInline: element.playsInline,
        readyState: element.readyState,
        networkState: element.networkState,
        currentTime: element.currentTime,
        duration: Number.isFinite(element.duration) ? element.duration : null,
        durationCategory,
        sourceKind: sourceKindFor(sourceValue),
        ancestry: ancestryFor(element),
        computedStyle: {
          display: clip(style.display, 32),
          visibility: clip(style.visibility, 32),
          opacity: clip(style.opacity, 16),
          zIndex: clip(style.zIndex, 32),
          position: clip(style.position, 32),
        },
        videoWidth: element.videoWidth || 0,
        videoHeight: element.videoHeight || 0,
        boundingRect: rect,
        viewportCoverageRatio: coverageFor(rect),
        viewportIntersectionRatio: Number(((intersectionWidth * intersectionHeight) / elementArea).toFixed(6)),
        visibleArea: Math.round(intersectionWidth * intersectionHeight),
        computedVisibility: visibleFor(element, rect),
        sampleCount: Number(sampleStats.sampleCount || 0),
        restartCount: Number(sampleStats.restartCount || 0),
        mediaErrorCode: error?.code ?? null,
        mediaErrorMessage: clip(error?.message, 120),
      };
    });
    const controls = [...document.querySelectorAll('button,a,[role="button"],input,[aria-label]')]
      .map((element) => {
        const rect = rectFor(element);
        const text = clip(element.innerText || element.value || element.textContent || '', 80);
        const ariaLabel = clip(element.getAttribute('aria-label'), 80);
        const evidence = [text, ariaLabel, element.id, element.className, element.title, element.name].join(' ').toLowerCase();
        const matched = ['play', 'pause', 'fullscreen', 'mute', 'unmute', 'live', 'consent', 'close']
          .filter((token) => evidence.includes(token));
        if (matched.length === 0 || visibleFor(element, rect) !== 'visible') {
          return null;
        }
        return {
          tag: element.tagName.toLowerCase(),
          id: clip(element.id, 80),
          className: clip(element.className, 120),
          title: clip(element.title, 80),
          name: clip(element.name, 80),
          ariaLabel,
          text,
          matchedKinds: matched,
          boundingRect: rect,
        };
      })
      .filter(Boolean);
    return {
      title: document.title,
      media,
      scripts: [...document.scripts].map((script) => ({
        src: script.src || '',
        id: clip(script.id, 80),
        className: clip(script.className, 120),
      })),
      iframes: [...document.querySelectorAll('iframe')].map((iframe) => ({
        src: iframe.src || iframe.getAttribute('src') || '',
        id: clip(iframe.id, 80),
        className: clip(iframe.className, 120),
        title: clip(iframe.title, 120),
        name: clip(iframe.name, 80),
        allow: clip(iframe.getAttribute('allow'), 120),
        ariaLabel: clip(iframe.getAttribute('aria-label'), 80),
      })),
      controls,
      observer: passive,
      interactionCounters: window.__KFLAB_INTERACTION_COUNTERS__ ? { ...window.__KFLAB_INTERACTION_COUNTERS__ } : null,
      domSignals: [...document.querySelectorAll('[id],[class],[title],[name],[allow],[aria-label]')]
        .slice(0, 100)
        .map((element) => clip([element.id, element.className, element.title, element.name, element.getAttribute('allow'), element.getAttribute('aria-label')].join(' '), 180))
        .filter(Boolean),
    };
  });
  return sanitizeFrameState(raw, frameId);
}

function sanitizeFrameState(raw, frameId) {
  return {
    ...raw,
    media: raw.media.map((item) => ({
      ...item,
      id: `${frameId}:${item.id}`,
      frameId,
      src: redactUrl(item.src).url,
      currentSrc: redactUrl(item.currentSrc).url,
      poster: redactUrl(item.poster).url,
    })),
    scripts: raw.scripts.map((item) => ({
      ...item,
      frameId,
      src: redactUrl(item.src).url,
      host: redactUrl(item.src).hostname,
      path: redactUrl(item.src).path,
    })),
    iframes: raw.iframes.map((item) => ({
      ...item,
      frameId,
      src: redactUrl(item.src).url,
      host: redactUrl(item.src).hostname,
      path: redactUrl(item.src).path,
    })),
    controls: raw.controls.map((item) => ({ ...item, frameId })),
  };
}
