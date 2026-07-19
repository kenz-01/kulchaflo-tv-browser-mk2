import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFixtureServer } from '../fixtures/server.mjs';
import { classifyPlayer } from './classify-player.mjs';
import { classifyRoute } from './classify-route.mjs';
import { observePagePassively } from './passive-page-observer.mjs';
import { launchFreshBrowserContext } from './browser-runtime.mjs';
import { createReportModel } from './report-model.mjs';
import { writeReportJson } from './report-json.mjs';
import { writeReportMarkdown } from './report-markdown.mjs';
import { utcTimestamp } from './timestamps.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

export async function profileFixture({
  profileId = 'desktop-firefox',
  observationMs = 3000,
  outputRoot = join(ROOT, 'reports'),
} = {}) {
  let fixture;
  let launched;
  const startedAt = utcTimestamp();
  try {
    fixture = await startFixtureServer();
    launched = await launchFreshBrowserContext({ profileId });
    const page = await launched.context.newPage();
    const requestedUrl = `${fixture.origin}/?token=fixture-secret#fixture-fragment`;
    const observation = await observePagePassively({
      page,
      url: requestedUrl,
      observationMs,
    });
    const finalUrl = page.url();
    const finishedAt = utcTimestamp();
    const outputDir = join(outputRoot, `fixture-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    mkdirSync(outputDir, { recursive: true });
    const screenshotPath = join(outputDir, 'page.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    await page.close().catch(() => {});

    const classifierEvidence = evidenceForClassifiers(observation);
    const playerClassification = classifyPlayer(classifierEvidence);
    const routeClassification = classifyRoute({
      ...classifierEvidence,
      embeddedPlayerEvidence: hasMeaningfulEmbeddedEvidence(observation, playerClassification),
    });
    const reportInput = {
      metadata: {
        providerId: 'local-fixture',
        profilerVersion: '0.1.0-checkpoint3a',
      },
      requestedUrl,
      finalUrl,
      timing: {
        startedAt,
        finishedAt,
        durationSeconds: (Date.parse(finishedAt) - Date.parse(startedAt)) / 1000,
      },
      browser: {
        engine: 'chromium',
        runtimeType: launched.runtime.type,
        executablePath: launched.runtime.executablePath,
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
    };
    const report = createReportModel(stripUndefined(reportInput));
    const jsonResult = writeReportJson(report, { outputDir, providerId: 'local-fixture' });
    const markdownResult = writeReportMarkdown(report, { outputDir, providerId: 'local-fixture' });
    return {
      outputDir,
      screenshotPath,
      jsonPath: jsonResult.filePath,
      markdownPath: markdownResult.filePath,
      report,
      interactionCounters: observation.interactionCounters,
      browserRuntime: launched.runtime,
    };
  } finally {
    if (launched) {
      await launched.context.close().catch(() => {});
      await launched.browser.close().catch(() => {});
    }
    if (fixture) {
      await fixture.close().catch(() => {});
    }
  }
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

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const result = await profileFixture();
  console.log(result.outputDir);
}
