import { classifyPlayer } from './classify-player.mjs';
import { classifyRoute } from './classify-route.mjs';
import { launchFreshBrowserContext } from './browser-runtime.mjs';
import { createStagedProfileOutputDirectory, DEFAULT_OUTPUT_ROOT } from './output-directory.mjs';
import { observePagePassively } from './passive-page-observer.mjs';
import { createReportModel } from './report-model.mjs';
import { assertProviderId } from './redact-url.mjs';
import { writeReportJson } from './report-json.mjs';
import { writeReportMarkdown } from './report-markdown.mjs';
import { utcTimestamp } from './timestamps.mjs';
import { safeUrlForError, validateCheckpoint3bUrl } from './url-policy.mjs';

export const PROFILER_VERSION = '0.1.0-checkpoint3b';

export async function profileUrl({
  url,
  providerId,
  profileId = 'desktop-firefox',
  observationMs = 3000,
  navigationTimeoutMs = 10000,
  outputRoot = DEFAULT_OUTPUT_ROOT,
  launchBrowserContext = launchFreshBrowserContext,
  createOutputDirectory = createStagedProfileOutputDirectory,
  writeJson = writeReportJson,
  writeMarkdown = writeReportMarkdown,
  observePage = observePagePassively,
  abortSignal,
} = {}) {
  const parsedUrl = validateCheckpoint3bUrl(url);
  assertProviderId(providerId);
  const output = createOutputDirectory({ providerId, outputRoot });
  const startedAt = utcTimestamp();
  let launched;
  let page;
  let cleanupPromise;
  let completed = false;
  let abortHandler;
  let redirectError;
  const internalAbort = new AbortController();
  const combined = combineAbortSignals([abortSignal, internalAbort.signal]);
  const combinedSignal = combined.signal;
  const cleanup = () => {
    cleanupPromise ??= (async () => {
      await page?.close().catch(() => {});
      await launched?.context?.close().catch(() => {});
      await launched?.browser?.close().catch(() => {});
    })();
    return cleanupPromise;
  };

  try {
    throwIfAborted(combinedSignal);
    launched = await launchBrowserContext({ profileId });
    abortHandler = () => {
      cleanup().catch(() => {});
    };
    combinedSignal.addEventListener('abort', abortHandler, { once: true });
    throwIfAborted(combinedSignal);

    page = await launched.context.newPage();
    const onFrameNavigated = (frame) => {
      if (frame !== page.mainFrame()) {
        return;
      }
      const frameUrl = frame.url();
      const result = validateMainFrameNavigationCandidate(frameUrl);
      if (!result.valid) {
        redirectError = result.error;
        internalAbort.abort();
      }
    };
    page.on('framenavigated', onFrameNavigated);
    let observation;
    try {
      observation = await observePage({
        page,
        url: parsedUrl.toString(),
        observationMs,
        navigationTimeoutMs,
        abortSignal: combinedSignal,
      });
    } catch (error) {
      if (redirectError) {
        throw redirectError;
      }
      throw error;
    } finally {
      page?.off?.('framenavigated', onFrameNavigated);
    }
    if (redirectError) {
      throw redirectError;
    }
    throwIfAborted(combinedSignal);
    const finalUrl = page.url();
    validateCheckpoint3bUrl(finalUrl);
    const finishedAt = utcTimestamp();
    const classifierEvidence = evidenceForClassifiers(observation);
    const playerClassification = classifyPlayer(classifierEvidence);
    const routeClassification = classifyRoute({
      ...classifierEvidence,
      embeddedPlayerEvidence: hasMeaningfulEmbeddedEvidence(observation, playerClassification),
    });
    const report = createReportModel(stripUndefined({
      metadata: {
        providerId,
        profilerVersion: PROFILER_VERSION,
        requestedProfile: profileId,
        browserRuntimeType: launched.runtime.type,
        observationMs,
        navigationTimeoutMs,
        loopbackOnlyPolicyAllowed: true,
      },
      requestedUrl: parsedUrl.toString(),
      finalUrl,
      timing: {
        startedAt,
        finishedAt,
        durationSeconds: (Date.parse(finishedAt) - Date.parse(startedAt)) / 1000,
      },
      browser: {
        engine: 'chromium',
        runtimeType: launched.runtime.type,
        profile: launched.profile.id,
        userAgent: launched.profile.userAgent,
        viewport: launched.profile.viewport,
        emulationNote: launched.warnings[0],
      },
      navigation: observation.navigation,
      frames: observation.frames,
      scripts: observation.scripts,
      iframes: observation.iframes,
      mediaObservations: observation.mediaObservations,
      networkEvidence: observation.networkEvidence,
      lifecycleEvidence: observation.lifecycleEvidence,
      candidateControls: observation.candidateControls,
      playerClassification,
      routeClassification,
      truncation: observation.truncation,
      warnings: [...observation.warnings, ...launched.warnings],
      omissions: [
        'Cookies, Authorization headers, request bodies, response bodies, localStorage and sessionStorage are not captured.',
      ],
    }));
    const jsonResult = writeJson(report, { outputDir: output.incompleteDir, providerId });
    const markdownResult = writeMarkdown(report, { outputDir: output.incompleteDir, providerId });
    const screenshotPath = `${output.incompleteDir}/page.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });
    const outputDir = output.promote();
    completed = true;

    return {
      outputDir,
      screenshotPath: `${outputDir}/page.png`,
      jsonPath: `${outputDir}/report.json`,
      markdownPath: `${outputDir}/report.md`,
      report,
      interactionCounters: observation.interactionCounters,
      browserRuntime: { type: launched.runtime.type },
    };
  } finally {
    if (abortHandler) {
      combinedSignal.removeEventListener('abort', abortHandler);
    }
    combined.dispose();
    await cleanup();
    if (!completed) {
      output.cleanup();
    }
  }
}

export function validateMainFrameNavigationCandidate(url) {
  if (url === 'about:blank') {
    return { valid: true, ignored: true };
  }
  try {
    validateCheckpoint3bUrl(url);
    return { valid: true, ignored: false };
  } catch {
    return {
      valid: false,
      ignored: false,
      error: new Error(`Public-site profiling is not enabled in Checkpoint 3B. URL: ${safeUrlForError(url)}`),
    };
  }
}

export function evidenceForClassifiers(observation) {
  return {
    mediaElementCount: observation.mediaObservations.length,
    mediaElements: observation.mediaObservations,
    mediaUrls: observation.mediaObservations.flatMap((item) => [item.src, item.currentSrc]).filter(Boolean),
    scriptUrls: observation.scripts.map((item) => item.src).filter(Boolean),
    iframeUrls: observation.iframes.map((item) => item.src).filter(Boolean),
    networkUrls: observation.networkEvidence.map((item) => item.url).filter(Boolean),
    domSignals: [
      ...observation.scripts.flatMap((item) => [item.id, item.className]),
      ...observation.iframes.flatMap((item) => [item.id, item.className, item.title, item.name, item.allow, item.ariaLabel]),
      ...observation.candidateControls.flatMap((item) => [item.id, item.className, item.title, item.name, item.ariaLabel, item.text]),
      ...observation.frames.flatMap((item) => item.domSignals ?? []),
    ].filter(Boolean),
    officialPageEvidence: true,
  };
}

export function hasMeaningfulEmbeddedEvidence(observation, playerClassification) {
  const hostedFamilies = new Set(['youtube', 'vimeo', 'dailymotion', 'jwplayer', 'bradmax', 'tego', 'novus']);
  const classifiedHosted = [
    playerClassification?.primaryFamily,
    ...(playerClassification?.secondaryFamilies ?? []),
  ].some((family) => hostedFamilies.has(family));
  if (classifiedHosted && observation.iframes.length > 0) {
    return true;
  }
  return observation.iframes.some((iframe) => {
    const evidence = [iframe.id, iframe.className, iframe.title, iframe.name, iframe.allow, iframe.ariaLabel].join(' ').toLowerCase();
    const playerLike = /(player|video|jw|vjs|embed|fullscreen|autoplay)/.test(evidence);
    const corroborated = observation.mediaObservations.some((media) => media.frameId !== iframe.frameId) ||
      observation.candidateControls.some((control) => control.frameId !== iframe.frameId && control.matchedKinds.includes('play'));
    return playerLike && corroborated;
  });
}

function stripUndefined(value) {
  if (Array.isArray(value)) {
    return value.map(stripUndefined);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .map(([key, child]) => [key, stripUndefined(child)]),
    );
  }
  return value;
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new Error('Profiling interrupted.');
  }
}

function combineAbortSignals(signals) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const listeners = [];
  for (const signal of signals.filter(Boolean)) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener?.('abort', abort, { once: true });
    listeners.push(signal);
  }
  return {
    signal: controller.signal,
    dispose() {
      for (const signal of listeners) {
        signal.removeEventListener?.('abort', abort);
      }
    },
  };
}
