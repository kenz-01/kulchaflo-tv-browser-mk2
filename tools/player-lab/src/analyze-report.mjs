import { lstatSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertProviderId } from './redact-url.mjs';
import {
  createStagedAnalysisOutputDirectory,
  writeAnalysisJson,
  writeAnalysisMarkdown,
} from './analysis-output.mjs';

export const ANALYSIS_VERSION = '0.1.0-checkpoint3d';
const CATEGORIES = new Set([
  'no-helper-needed',
  'generic-embedded-vimeo',
  'provider-specific-vimeo-wrapper',
  'native-media-promotion',
  'insufficient-evidence',
]);
const HOST_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

export function analyzeReport({
  reportPath,
  outputRoot,
  now = () => new Date(),
  createOutputDirectory = createStagedAnalysisOutputDirectory,
  writeJson = writeAnalysisJson,
  writeMarkdown = writeAnalysisMarkdown,
} = {}) {
  const report = loadAndValidateReport(reportPath);
  const root = outputRoot ? resolve(outputRoot) : resolve(dirname(resolve(reportPath)), 'analysis');
  const output = createOutputDirectory({ outputRoot: root, now });
  let completed = false;
  try {
    const recommendation = createRecommendation(report, { generatedAt: now().toISOString() });
    assertSafeAnalysisContents(recommendation);
    writeJson(recommendation, { outputDir: output.incompleteDir });
    writeMarkdown(recommendation, { outputDir: output.incompleteDir });
    const outputDir = output.promote();
    completed = true;
    return Object.freeze({
      outputDir,
      jsonPath: resolve(outputDir, 'analysis.json'),
      markdownPath: resolve(outputDir, 'analysis.md'),
      recommendation,
    });
  } finally {
    if (!completed) output.cleanup();
  }
}

export function loadAndValidateReport(reportPath) {
  if (typeof reportPath !== 'string' || reportPath.trim() === '') {
    throw new Error('Analysis report path is required.');
  }
  const resolved = resolve(reportPath);
  let stat;
  try {
    stat = lstatSync(resolved);
  } catch {
    throw new Error('Report file does not exist.');
  }
  if (stat.isSymbolicLink()) {
    throw new Error('Report input must not be a symbolic link.');
  }
  if (!stat.isFile()) {
    throw new Error('Report input must be a regular file.');
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(resolved, 'utf8'));
  } catch (error) {
    throw new Error(`Malformed report JSON: ${error.message}`);
  }
  validateReportShape(parsed);
  assertSafeReportContents(parsed);
  return deepFreeze(structuredClone(parsed));
}

export function validateReportShape(report) {
  if (!isPlainObject(report)) throw new Error('Report must be an object.');
  const required = [
    'metadata',
    'requestedUrl',
    'finalUrl',
    'frames',
    'scripts',
    'iframes',
    'mediaObservations',
    'networkEvidence',
    'candidateControls',
    'playerClassification',
    'routeClassification',
    'lifecycleEvidence',
    'warnings',
    'omissions',
  ];
  for (const key of required) {
    if (!(key in report)) throw new Error(`Report missing required field: ${key}`);
  }
  if (!isPlainObject(report.metadata)) throw new Error('Report metadata must be a plain object.');
  assertProviderId(report.metadata?.providerId);
  if (report.metadata?.targetId !== undefined && report.metadata?.targetId !== null) {
    assertProviderId(report.metadata.targetId);
  }
  if (typeof report.metadata?.profilerVersion !== 'string' || report.metadata.profilerVersion.trim() === '') {
    throw new Error('Report metadata.profilerVersion is required.');
  }
  requireRedactedUrlString(report.requestedUrl, 'requestedUrl');
  requireRedactedUrlString(report.finalUrl, 'finalUrl');
  validateAllowedMainFrameHosts(report.metadata.allowedMainFrameHosts);
  for (const key of ['frames', 'scripts', 'iframes', 'mediaObservations', 'networkEvidence', 'candidateControls', 'warnings', 'omissions']) {
    if (!Array.isArray(report[key])) throw new Error(`Report ${key} must be an array.`);
  }
  if (!isPlainObject(report.lifecycleEvidence)) throw new Error('Report lifecycleEvidence must be an object.');
  if (!isPlainObject(report.lifecycleEvidence.interactionCounters)) {
    throw new Error('Report lifecycleEvidence.interactionCounters is required.');
  }
  const requiredCounters = ['click', 'pointer', 'keyboard', 'play', 'pause', 'requestFullscreen'];
  const counterKeys = Object.keys(report.lifecycleEvidence.interactionCounters).sort();
  if (counterKeys.join('|') !== [...requiredCounters].sort().join('|')) {
    throw new Error('Report lifecycleEvidence.interactionCounters must contain exactly the required counters.');
  }
  for (const key of requiredCounters) {
    const value = report.lifecycleEvidence.interactionCounters[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`Interaction counter ${key} must be a finite numeric zero.`);
    }
    if (value !== 0) {
      throw new Error('Reports with non-zero interaction counters are not valid analysis input.');
    }
  }
  if (!isPlainObject(report.playerClassification) || typeof report.playerClassification.primaryFamily !== 'string' || report.playerClassification.primaryFamily.trim() === '') {
    throw new Error('Report playerClassification.primaryFamily is required.');
  }
  if (report.playerClassification.secondaryFamilies !== undefined &&
    (!Array.isArray(report.playerClassification.secondaryFamilies) || !report.playerClassification.secondaryFamilies.every((item) => typeof item === 'string'))) {
    throw new Error('Report playerClassification.secondaryFamilies must be an array of strings.');
  }
  if (report.playerClassification.confidence !== undefined && !['high', 'medium', 'low', 'insufficient', 'unknown'].includes(report.playerClassification.confidence)) {
    throw new Error('Report playerClassification.confidence is not a known bounded value.');
  }
  if (!isPlainObject(report.routeClassification) || typeof report.routeClassification.route !== 'string' || report.routeClassification.route.trim() === '') {
    throw new Error('Report routeClassification.route is required.');
  }
  return true;
}

export function normalizeEvidence(report) {
  const routeParts = String(report.routeClassification.route ?? '').split(/\s+/);
  const sourceChangeCount = report.mediaObservations.reduce((total, media) => total + Number(media.sourceChangeCount ?? 0), 0);
  const replacementCount = report.mediaObservations.filter((media) => media.replacementDetected === true || media.likelyReplacement === true).length;
  const providerWrapperEvidence = detectProviderWrapperEvidence(report);
  return deepFreeze({
    providerId: report.metadata.providerId,
    targetId: report.metadata.targetId ?? null,
    sourceProfilerVersion: report.metadata.profilerVersion,
    passiveObservationOnly: report.metadata.passiveObservationOnly === true,
    browserRuntimeType: report.metadata.browserRuntimeType ?? null,
    primaryPlayerFamily: report.playerClassification.primaryFamily,
    playerConfidence: report.playerClassification.confidence ?? 'unknown',
    secondaryPlayerFamilies: [...(report.playerClassification.secondaryFamilies ?? [])].sort(),
    routeFamily: routeParts[0] ?? 'unknown',
    routeStrategy: routeParts.slice(1).join(' ') || 'unknown',
    providerHosts: providerHostsForReport(report),
    frameCount: report.frames.length,
    accessibleFrameCount: report.frames.filter((frame) => frame.domInspectionSucceeded === true).length,
    inaccessibleFrameCount: report.frames.filter((frame) => frame.domInspectionSucceeded !== true).length,
    iframeHosts: sortedHosts(report.iframes),
    scriptHosts: sortedHosts(report.scripts),
    networkHosts: sortedHosts(report.networkEvidence),
    networkEvidenceKinds: sortedKinds(report.networkEvidence),
    mediaElementCount: report.mediaObservations.length,
    media: report.mediaObservations.map((media) => Object.freeze({
      tag: media.tag ?? media.tagType ?? null,
      hasSource: Boolean(media.src || media.currentSrc),
      readyState: media.readyState ?? null,
      paused: media.paused ?? null,
      muted: media.muted ?? null,
      volume: media.volume ?? null,
      autoplay: media.autoplay ?? null,
      controls: media.controls ?? null,
      timeAdvanced: media.timeAdvanced === true || media.currentTimeAdvanced === true,
      sourceChangeCount: Number(media.sourceChangeCount ?? 0),
      replacementDetected: media.replacementDetected === true || media.likelyReplacement === true,
    })),
    candidateControlCount: report.candidateControls.length,
    providerWrapperEvidence,
    sourceChangeCount,
    replacementCount,
    consoleErrorCount: report.lifecycleEvidence['console-error']?.length ?? 0,
    pageErrorCount: report.lifecycleEvidence['page-error']?.length ?? 0,
    interactionCounters: { ...report.lifecycleEvidence.interactionCounters },
    truncation: report.truncation ?? {},
  });
}

export function createRecommendation(report, { generatedAt = new Date().toISOString() } = {}) {
  const evidence = normalizeEvidence(report);
  const reasons = [];
  const supporting = [];
  const limiting = [];
  const avoidLayers = [];
  const requiredNextValidation = [];
  const limitations = [];
  const add = (bucket, code, detail) => {
    const reason = { code, detail };
    reasons.push(reason);
    bucket.push(code);
    return reason;
  };

  if (evidence.primaryPlayerFamily === 'vimeo' && evidence.playerConfidence === 'high') {
    add(supporting, 'PRIMARY_PLAYER_VIMEO_HIGH_CONFIDENCE', 'Primary player classification is Vimeo with high confidence.');
  }
  if (evidence.iframeHosts.some((host) => host === 'vimeo.com' || host === 'player.vimeo.com')) {
    add(supporting, 'EMBEDDED_VIMEO_FRAME_PRESENT', 'Vimeo iframe evidence is present.');
  }
  if (evidence.routeFamily === 'embedded-player' && evidence.routeStrategy === 'browser-first') {
    add(supporting, 'BROWSER_FIRST_ROUTE', 'Route classification retains browser-first embedded playback.');
  }
  if (evidence.mediaElementCount > 0) {
    add(supporting, 'ACCESSIBLE_MEDIA_ELEMENT_PRESENT', 'At least one media element was visible to passive DOM inspection.');
  }
  if (evidence.candidateControlCount > 0) {
    add(supporting, 'CANDIDATE_PLAYER_CONTROLS_PRESENT', 'Candidate player controls were observed without interaction.');
  }
  if (evidence.providerWrapperEvidence.present) {
    add(supporting, 'PROVIDER_WRAPPER_EVIDENCE_PRESENT', 'Observable provider-layer wrapper evidence is present.');
  }
  if (allZero(evidence.interactionCounters)) {
    add(supporting, 'ZERO_INTERACTION_CONFIRMED', 'The profiler interaction counters are all zero.');
  }
  if (evidence.mediaElementCount > 0 && evidence.media.every((media) => !media.hasSource)) {
    add(limiting, 'MEDIA_SOURCE_NOT_ACCESSIBLE', 'Accessible media elements did not expose src/currentSrc.');
    avoidLayers.push('native media promotion without accessible media source');
    avoidLayers.push('direct HLS extraction');
  }
  if (evidence.sourceChangeCount === 0 && evidence.replacementCount === 0) {
    add(limiting, 'NO_SOURCE_REPLACEMENT_EVIDENCE', 'No source-change or media-replacement evidence was observed.');
  }
  if (evidence.passiveObservationOnly) {
    add(limiting, 'PASSIVE_OBSERVATION_ONLY', 'The evidence was collected passively with no player interaction.');
    limitations.push('Passive observation cannot prove autoplay, user-gesture behavior, or broken playback.');
  }
  if (evidence.browserRuntimeType === 'system') {
    add(limiting, 'CHROMIUM_NOT_GECKOVIEW', 'The evidence came from Chromium and does not reproduce GeckoView or physical Sony Bravia behavior.');
    requiredNextValidation.push('Run a later controlled GeckoView validation before app integration.');
    requiredNextValidation.push('Run a later physical Sony Bravia validation before app integration.');
  }
  if (evidence.targetId) {
    requiredNextValidation.push(`Validate the ${evidence.targetId} route before app integration.`);
    limitations.push('Provider or target identity scopes later validation but does not determine player architecture.');
  }
  if (evidence.inaccessibleFrameCount > 0) {
    add(limiting, 'OPAQUE_FRAME_LIMITATION', 'At least one frame was inaccessible or opaque to DOM inspection.');
    limitations.push('Opaque frame contents may hide additional player state.');
  }

  let category = 'insufficient-evidence';
  let recommendedLayer = 'no helper recommendation';
  if (evidence.primaryPlayerFamily === 'unknown' && evidence.mediaElementCount === 0 && evidence.iframeHosts.length === 0) {
    category = 'no-helper-needed';
    recommendedLayer = 'no player-specific helper layer';
  } else if (evidence.primaryPlayerFamily === 'native-html5' && evidence.media.some((media) => media.hasSource) && evidence.routeFamily !== 'embedded-player') {
    category = 'native-media-promotion';
    recommendedLayer = 'native media promotion after controlled validation';
  } else if (evidence.primaryPlayerFamily === 'vimeo' && evidence.iframeHosts.some((host) => host === 'vimeo.com' || host === 'player.vimeo.com')) {
    category = evidence.providerWrapperEvidence.present ? 'provider-specific-vimeo-wrapper' : 'generic-embedded-vimeo';
    recommendedLayer = category === 'provider-specific-vimeo-wrapper'
      ? 'browser-side embedded Vimeo handling scoped to observed provider wrapper evidence'
      : 'browser-side embedded Vimeo handling';
  }
  if (!CATEGORIES.has(category)) throw new Error('Internal recommendation category error.');

  const score = scoreRecommendation({ category, supportingCount: supporting.length, limitingCount: limiting.length });
  return deepFreeze({
    schemaVersion: 1,
    providerId: evidence.providerId,
    targetId: evidence.targetId,
    sourceProfilerVersion: evidence.sourceProfilerVersion,
    analysisVersion: ANALYSIS_VERSION,
    generatedAt,
    evidenceSummary: {
      primaryPlayerFamily: evidence.primaryPlayerFamily,
      secondaryPlayerFamilies: evidence.secondaryPlayerFamilies,
      routeFamily: evidence.routeFamily,
      routeStrategy: evidence.routeStrategy,
      frameCount: evidence.frameCount,
      accessibleFrameCount: evidence.accessibleFrameCount,
      providerHosts: evidence.providerHosts,
      iframeHosts: evidence.iframeHosts,
      scriptHosts: evidence.scriptHosts,
      networkEvidenceKinds: evidence.networkEvidenceKinds,
      mediaElementCount: evidence.mediaElementCount,
      mediaStates: evidence.media,
      candidateControlCount: evidence.candidateControlCount,
      providerWrapperEvidence: evidence.providerWrapperEvidence,
      sourceChangeCount: evidence.sourceChangeCount,
      replacementCount: evidence.replacementCount,
      interactionCounters: evidence.interactionCounters,
    },
    recommendation: {
      category,
      confidence: confidenceLevel(score),
      score,
      recommendedLayer,
      avoidLayers: [...new Set(avoidLayers)],
      reasons,
      supportingReasonCodes: supporting,
      limitingReasonCodes: limiting,
      supportingEvidenceCount: supporting.length,
      limitingEvidenceCount: limiting.length,
      rationale: reasons.map((reason) => reason.detail),
      requiredNextValidation,
      limitations,
    },
  });
}

// Scoring is deterministic and intentionally simple: category evidence starts
// from a bounded base, stable support adds confidence, and limitations subtract
// enough to keep passive Chromium-only evidence below "high" when appropriate.
function scoreRecommendation({ category, supportingCount, limitingCount }) {
  const base = {
    'provider-specific-vimeo-wrapper': 72,
    'generic-embedded-vimeo': 66,
    'native-media-promotion': 62,
    'no-helper-needed': 55,
    'insufficient-evidence': 25,
  }[category];
  return Math.max(0, Math.min(100, base + supportingCount * 3 - limitingCount * 4));
}

function requireRedactedUrlString(value, key) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Report ${key} must be a non-empty redacted URL string.`);
  }
  assertSafeUrl(value, { requireUrl: true });
}

function validateAllowedMainFrameHosts(value) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Report metadata.allowedMainFrameHosts must be a non-empty array when present.');
  }
  const seen = new Set();
  for (const host of value) {
    validateHostname(host, 'metadata.allowedMainFrameHosts');
    if (seen.has(host)) {
      throw new Error('Report metadata.allowedMainFrameHosts must not contain duplicates.');
    }
    seen.add(host);
  }
}

function detectProviderWrapperEvidence(report) {
  const providerHosts = new Set(providerHostsForReport(report));
  const frameHosts = new Map(report.frames.map((frame) => [frame.id, frame.hostname]));
  const signals = [];
  const wrapperPattern = /\b(provider|custom|site|outer|host|cvm)[-_ ]?(vimeo|embed|player)[-_ ]?(wrapper|controller|bridge|shell)\b|\b(vimeo|embed|player)[-_ ]?(wrapper|controller|bridge|shell)\b/i;
  for (const script of report.scripts) {
    const host = script.host ?? hostFromUrl(script.src);
    const text = [script.path, script.id, script.className, script.src].filter(Boolean).join(' ');
    if (providerHosts.has(host) && wrapperPattern.test(text)) {
      signals.push({ kind: 'provider-script-wrapper-signal', host });
    }
  }
  for (const control of report.candidateControls) {
    const host = frameHosts.get(control.frameId);
    const text = [control.id, control.className, control.title, control.name, control.ariaLabel, control.text].filter(Boolean).join(' ');
    const playerControl = (control.matchedKinds ?? []).some((kind) => ['play', 'pause', 'fullscreen', 'mute', 'unmute'].includes(kind));
    if (providerHosts.has(host) && playerControl && wrapperPattern.test(text)) {
      signals.push({ kind: 'provider-control-wrapper-signal', host });
    }
  }
  for (const [event, records] of Object.entries(report.lifecycleEvidence ?? {})) {
    if (!Array.isArray(records)) continue;
    for (const record of records) {
      const text = [event, record.event, record.type, record.detail, record.reason].filter(Boolean).join(' ');
      const host = record.host ?? record.hostname ?? frameHosts.get(record.frameId);
      if (providerHosts.has(host) && wrapperPattern.test(text)) {
        signals.push({ kind: 'provider-lifecycle-wrapper-signal', host });
      }
    }
  }
  return Object.freeze({
    present: signals.length > 0,
    signals: signals.slice(0, 10).map((signal) => Object.freeze(signal)),
  });
}

function providerHostsForReport(report) {
  const hosts = [
    hostFromUrl(report.requestedUrl),
    hostFromUrl(report.finalUrl),
    ...(report.metadata.allowedMainFrameHosts ?? []),
  ].filter(Boolean).map((host) => host.toLowerCase());
  for (const host of hosts) validateHostname(host, 'provider host');
  return [...new Set(hosts)].sort();
}

function validateHostname(host, label) {
  if (typeof host !== 'string' || host.trim() !== host || host !== host.toLowerCase()) {
    throw new Error(`Report ${label} must contain exact lowercase hostname strings.`);
  }
  if (host.includes('*')) {
    throw new Error(`Report ${label} must not contain wildcards.`);
  }
  if (host.includes(':') || host.includes('/') || host.includes('?') || host.includes('#')) {
    throw new Error(`Report ${label} must not contain ports, schemes, paths, queries or fragments.`);
  }
  if (!HOST_PATTERN.test(host)) {
    throw new Error(`Report ${label} contains a malformed hostname.`);
  }
}

function confidenceLevel(score) {
  if (score >= 80) return 'high';
  if (score >= 55) return 'medium';
  if (score >= 30) return 'low';
  return 'insufficient';
}

export function assertSafeReportContents(report) {
  assertSafeObject(report, 'report');
  for (const value of collectUrlStrings(report)) {
    assertSafeUrl(value);
  }
  return true;
}

export function assertSafeAnalysisContents(recommendation) {
  assertSafeObject(recommendation, 'analysis');
  return true;
}

function assertSafeObject(value, label) {
  const text = JSON.stringify(value);
  const checks = [
    [/https?:\/\/[^\s"<>]+[?#]/i, 'query string or fragment'],
    [/https?:\/\/[^/\s"<>]+@/i, 'embedded credentials'],
    [/\/Users\/[A-Za-z0-9._-]+|Google Chrome\.app|\/Applications\//, 'local executable or home path'],
    [/\b(cookie|authorization)\s*[:=]/i, 'cookie or Authorization value'],
    [/\bbearer\s+[a-z0-9._-]+/i, 'bearer token'],
    [/\b(signature|sig|token|expires)=/i, 'signed URL or token value'],
    [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, 'email address'],
    [/\b(localStorage|sessionStorage|storageState)\s*[:=]/i, 'storage value'],
  ];
  for (const [pattern, reason] of checks) {
    if (pattern.test(text)) {
      throw new Error(`Unsafe ${label} content rejected: ${reason}.`);
    }
  }
}

function assertSafeUrl(value, { requireUrl = false } = {}) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    if (requireUrl) throw new Error('Report URL must be a valid redacted URL.');
    return;
  }
  if (parsed.search || parsed.hash) throw new Error('Report URL contains query string or fragment.');
  if (parsed.username || parsed.password) throw new Error('Report URL contains embedded credentials.');
}

function collectUrlStrings(value, results = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectUrlStrings(item, results);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === 'string' && /(^url$|url$|urls$|src$|currentSrc$|poster$)/i.test(key)) {
        results.push(child);
      }
      collectUrlStrings(child, results);
    }
  }
  return results;
}

function sortedHosts(items) {
  return [...new Set(items.map((item) => item.host ?? item.hostname ?? hostFromUrl(item.url ?? item.src)).filter(Boolean))].sort();
}

function sortedKinds(items) {
  return [...new Set(items.flatMap((item) => String(item.kind ?? '').split(',')).map((value) => value.trim()).filter(Boolean))].sort();
}

function hostFromUrl(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function allZero(counters) {
  return Object.values(counters).every((value) => Number(value) === 0);
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
