import { createEvidenceCollector } from './evidence-collector.mjs';
import { classifyNetworkRecord } from './network-evidence.mjs';
import { ensurePassiveFrameProbe, readPassiveFrameState } from './frame-probe.mjs';
import { redactUrl } from './redact-url.mjs';
import { sanitizeDiagnosticString } from './report-model.mjs';
import { utcTimestamp } from './timestamps.mjs';

const DEFAULT_NAVIGATION_TIMEOUT_MS = 10000;
const DEFAULT_OBSERVATION_MS = 3000;

export async function observePagePassively({
  page,
  url,
  observationMs = DEFAULT_OBSERVATION_MS,
  navigationTimeoutMs = DEFAULT_NAVIGATION_TIMEOUT_MS,
  now = () => utcTimestamp(),
  abortSignal,
} = {}) {
  const collector = createEvidenceCollector({ now });
  const frames = new Map();
  const mediaFirst = new Map();
  const mediaFinal = new Map();
  const scripts = new Map();
  const iframes = new Map();
  const controls = new Map();
  const popups = [];
  const warnings = [];
  const pendingResponses = new Set();
  let acceptingResponses = true;
  let navigationResult = 'not-started';

  const frameIdFor = createFrameIdRegistry(frames, collector, now);
  const recordFrame = (frame, event) => {
    const id = frameIdFor(frame);
    const parent = frame.parentFrame();
    const redacted = redactUrl(frame.url());
    const existing = frames.get(frame);
    const item = {
      id,
      parentId: parent ? frameIdFor(parent) : null,
      mainFrame: frame === page.mainFrame(),
      name: frame.name(),
      url: redacted.url,
      hostname: redacted.hostname,
      attachedAt: existing?.attachedAt ?? now(),
      navigationHistory: [...(existing?.navigationHistory ?? [])],
      detachedAt: existing?.detachedAt ?? null,
      domInspectionSucceeded: existing?.domInspectionSucceeded ?? false,
      domSignals: existing?.domSignals ?? [],
      interactionCounters: existing?.interactionCounters ?? null,
    };
    if (event === 'framenavigated' && item.url) {
      item.navigationHistory.push({ url: item.url, timestamp: now() });
    }
    if (event === 'framedetached') {
      item.detachedAt = now();
    }
    frames.set(frame, item);
    const lifecycleRecord = { event, frameId: id, url: item.url, parentId: item.parentId };
    collector.append('frameLifecycleEvents', lifecycleRecord);
    collector.append('lifecycle', lifecycleRecord, { event: 'frame-lifecycle' });
  };

  page.on('frameattached', (frame) => recordFrame(frame, 'frameattached'));
  page.on('framenavigated', (frame) => recordFrame(frame, 'framenavigated'));
  page.on('framedetached', (frame) => recordFrame(frame, 'framedetached'));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const record = { type: message.type(), text: safeDiagnostic(message.text(), 300) };
      collector.append('consoleErrorRecords', record);
      collector.append('lifecycle', { event: 'console-error', ...record }, { event: 'console-error' });
    }
  });
  page.on('pageerror', (error) => {
    const record = { name: error.name, message: safeDiagnostic(error.message, 300) };
    collector.append('pageErrorRecords', record);
    collector.append('lifecycle', { event: 'page-error', ...record }, { event: 'page-error' });
  });
  page.on('popup', async (popup) => {
    const redacted = redactUrl(popup.url());
    popups.push(redacted.url);
    collector.append('lifecycle', { event: 'popup', url: redacted.url }, { event: 'popup' });
    await popup.close().catch(() => {});
  });
  page.on('request', (request) => {
    const record = classifyNetworkRecord({
      url: request.url(),
      resourceType: request.resourceType(),
      method: request.method(),
      documentKind: documentKindForRequest(request, page),
    });
    if (record) {
      collector.append('relevantNetworkRecords', record);
    }
  });
  page.on('response', (response) => {
    if (!acceptingResponses) {
      return;
    }
    const task = recordResponseEvidence(response, page, collector);
    pendingResponses.add(task);
    task.finally(() => pendingResponses.delete(task)).catch(() => {});
  });
  page.on('requestfailed', (request) => {
    const record = classifyNetworkRecord({
      url: request.url(),
      resourceType: request.resourceType(),
      method: request.method(),
      documentKind: documentKindForRequest(request, page),
      failureText: request.failure()?.errorText,
    });
    if (record) {
      collector.append('relevantNetworkRecords', record);
    }
    collector.append('lifecycle', {
      event: 'requestfailed',
      url: redactUrl(request.url()).url,
      resourceType: request.resourceType(),
      failureText: safeDiagnostic(request.failure()?.errorText, 180),
    }, { event: 'requestfailed' });
  });

  recordFrame(page.mainFrame(), 'frameattached');
  try {
    throwIfAborted(abortSignal);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: navigationTimeoutMs });
    throwIfAborted(abortSignal);
    navigationResult = 'domcontentloaded';
  } catch (error) {
    throwIfAborted(abortSignal);
    navigationResult = 'navigation-error';
    warnings.push(`Navigation did not reach domcontentloaded before timeout: ${safeDiagnostic(error.message, 180)}`);
  }

  throwIfAborted(abortSignal);
  await installProbes(page, frames, collector);
  await snapshotFrames(page, frames, collector, mediaFirst, mediaFinal, { scripts, iframes, controls });
  await wait(Math.max(0, observationMs), abortSignal);
  throwIfAborted(abortSignal);
  await installProbes(page, frames, collector);
  await snapshotFrames(page, frames, collector, mediaFirst, mediaFinal, { scripts, iframes, controls });
  acceptingResponses = false;
  await Promise.allSettled([...pendingResponses]);

  const evidence = collector.snapshot();
  const mediaObservations = [...mediaFinal.values()].map((final) => {
    const first = mediaFirst.get(final.id);
    const sourceChangeCount = evidence.lifecycle['source-change']?.filter((item) => item.mediaId === final.id).length ?? 0;
    const removed = Boolean(evidence.lifecycle['media-removed']?.some((item) => item.mediaId === final.id));
    const replacementAsOriginal = evidence.lifecycle['media-replaced']?.find((item) => item.replacedMediaId === final.id);
    const replacementAsNew = evidence.lifecycle['media-replaced']?.find((item) => item.replacementMediaId === final.id);
    const replacementDetected = Boolean(replacementAsOriginal || replacementAsNew);
    return {
      ...final,
      tagType: final.tag,
      firstCurrentTime: first?.currentTime ?? final.currentTime,
      finalCurrentTime: final.currentTime,
      timeAdvanced: Number(final.currentTime) > Number(first?.currentTime ?? final.currentTime),
      sourceChangeCount,
      removed,
      replacementDetected,
      replacedMediaId: replacementAsNew?.replacedMediaId,
      replacementMediaId: replacementAsOriginal?.replacementMediaId,
    };
  });

  return {
    navigation: {
      result: navigationResult,
      errors: warnings,
      redirectCount: 0,
      popupCount: popups.length,
      unexpectedPopupUrls: popups,
    },
    frames: [...frames.values()],
    scripts: [...scripts.values()],
    iframes: [...iframes.values()],
    mediaObservations,
    networkEvidence: evidence.relevantNetworkRecords,
    lifecycleEvidence: evidence.lifecycle,
    candidateControls: [...controls.values()],
    truncation: evidence.truncation,
    warnings,
    interactionCounters: collectInteractionCounters(frames),
  };
}

async function recordResponseEvidence(response, page, collector) {
  try {
    const request = response.request();
    const record = classifyNetworkRecord({
      url: response.url(),
      resourceType: request.resourceType(),
      method: request.method(),
      status: response.status(),
      contentType: await response.headerValue('content-type').catch(() => undefined),
      documentKind: documentKindForRequest(request, page),
    });
    if (record) {
      collector.append('relevantNetworkRecords', record);
    }
  } catch (error) {
    collector.append('lifecycle', {
      event: 'response-evidence-error',
      message: safeDiagnostic(error.message, 180),
    }, { event: 'response-evidence-error' });
  }
}

async function installProbes(page, frames, collector) {
  for (const frame of page.frames()) {
    const id = [...frames.entries()].find(([candidate]) => candidate === frame)?.[1]?.id;
    try {
      await ensurePassiveFrameProbe(frame);
      const record = frames.get(frame);
      if (record) {
        record.domInspectionSucceeded = true;
      }
    } catch (error) {
      const record = { event: 'dom-inspection-failed', frameId: id, message: safeDiagnostic(error.message, 180) };
      collector.append('frameLifecycleEvents', record);
      collector.append('lifecycle', record, { event: 'frame-lifecycle' });
    }
  }
}

async function snapshotFrames(page, frames, collector, mediaFirst, mediaFinal, staticEvidence) {
  for (const frame of page.frames()) {
    if (!frames.has(frame)) {
      continue;
    }
    const frameRecord = frames.get(frame);
    let state;
    try {
      state = await readPassiveFrameState(frame, frameRecord.id);
      frameRecord.domInspectionSucceeded = true;
      frameRecord.interactionCounters = state.interactionCounters;
      frameRecord.domSignals = state.domSignals;
    } catch (error) {
      const record = { event: 'dom-inspection-failed', frameId: frameRecord.id, message: safeDiagnostic(error.message, 180) };
      collector.append('frameLifecycleEvents', record);
      collector.append('lifecycle', record, { event: 'frame-lifecycle' });
      continue;
    }
    for (const script of state.scripts) {
      appendUnique(staticEvidence.scripts, scriptKey(script), script, collector, 'scriptSignatureRecords');
    }
    for (const iframe of state.iframes) {
      appendUnique(staticEvidence.iframes, iframeKey(iframe), iframe, collector, 'iframeSignatureRecords');
    }
    for (const control of state.controls) {
      appendUnique(staticEvidence.controls, controlKey(control), control, collector, 'candidateControlObservations');
    }
    const queue = state.observer?.queue ?? [];
    for (const event of queue) {
      const mediaId = event.mediaId ? `${frameRecord.id}:${event.mediaId}` : undefined;
      const replacedMediaId = event.replacedMediaId ? `${frameRecord.id}:${event.replacedMediaId}` : undefined;
      const replacementMediaId = event.replacementMediaId ? `${frameRecord.id}:${event.replacementMediaId}` : undefined;
      collector.append('lifecycle', { ...event, mediaId, replacedMediaId, replacementMediaId }, { event: event.type });
    }
    for (const media of state.media) {
      if (!mediaFirst.has(media.id)) {
        mediaFirst.set(media.id, media);
      }
      mediaFinal.set(media.id, media);
      collector.append('mediaElementObservations', media);
    }
  }
}

function createFrameIdRegistry(frames, collector, now) {
  const ids = new WeakMap();
  let nextFrameId = 1;
  return (frame) => {
    if (!ids.has(frame)) {
      ids.set(frame, `frame-${nextFrameId}`);
      nextFrameId += 1;
      const redacted = redactUrl(frame.url());
      frames.set(frame, {
        id: ids.get(frame),
        parentId: null,
        mainFrame: false,
        name: frame.name(),
        url: redacted.url,
        hostname: redacted.hostname,
        attachedAt: now(),
        navigationHistory: [],
        detachedAt: null,
        domInspectionSucceeded: false,
      });
      collector.append('frameLifecycleEvents', { event: 'frame-created', frameId: ids.get(frame), url: redacted.url });
      collector.append('lifecycle', { event: 'frame-created', frameId: ids.get(frame), url: redacted.url }, { event: 'frame-lifecycle' });
    }
    return ids.get(frame);
  };
}

function collectInteractionCounters(frames) {
  const total = { click: 0, pointer: 0, keyboard: 0, play: 0, pause: 0, requestFullscreen: 0 };
  for (const frame of frames.values()) {
    const counters = frame.interactionCounters;
    if (!counters) {
      continue;
    }
    for (const key of Object.keys(total)) {
      total[key] += Number(counters[key] ?? 0);
    }
  }
  return total;
}

function wait(ms, abortSignal) {
  if (abortSignal?.aborted) {
    return Promise.reject(new Error('Profiling interrupted.'));
  }
  let abort;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    abort = () => {
      clearTimeout(timeout);
      reject(new Error('Profiling interrupted.'));
    };
    abortSignal?.addEventListener?.('abort', abort, { once: true });
  }).finally(() => {
    abortSignal?.removeEventListener?.('abort', abort);
  });
}

function appendUnique(map, key, value, collector, category) {
  if (map.has(key)) {
    return;
  }
  map.set(key, value);
  collector.append(category, value);
}

function scriptKey(script) {
  return `${script.frameId}|${script.src || script.id || script.path || ''}`;
}

function iframeKey(iframe) {
  return `${iframe.frameId}|${iframe.id}|${iframe.name}|${iframe.src}`;
}

function controlKey(control) {
  return `${control.frameId}|${control.tag}|${control.id}|${control.className}|${control.ariaLabel}|${control.text}|${control.matchedKinds.join(',')}`;
}

function safeDiagnostic(value, length) {
  return sanitizeDiagnosticString(String(value ?? '')).slice(0, length);
}

function documentKindForRequest(request, page) {
  if (request.resourceType() !== 'document') {
    return undefined;
  }
  let frame;
  try {
    frame = request.frame();
  } catch {
    return 'document';
  }
  return frame && frame !== page.mainFrame() ? 'iframe-document' : 'document';
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new Error('Profiling interrupted.');
  }
}
