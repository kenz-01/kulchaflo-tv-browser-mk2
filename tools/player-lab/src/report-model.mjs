import { assertProviderId, redactUrl } from './redact-url.mjs';

const REQUIRED_TOP_LEVEL = Object.freeze([
  'metadata',
  'requestedUrl',
  'finalUrl',
  'timing',
  'browser',
  'navigation',
  'frames',
  'scripts',
  'iframes',
  'mediaObservations',
  'networkEvidence',
  'lifecycleEvidence',
  'candidateControls',
  'playerClassification',
  'routeClassification',
  'truncation',
  'warnings',
  'omissions',
]);

export function createReportModel(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Report model input must be an object.');
  }

  const model = sanitizeReport({
    metadata: input.metadata,
    requestedUrl: input.requestedUrl,
    finalUrl: input.finalUrl,
    timing: input.timing,
    browser: input.browser,
    navigation: input.navigation,
    frames: input.frames ?? [],
    scripts: input.scripts ?? [],
    iframes: input.iframes ?? [],
    mediaObservations: input.mediaObservations ?? [],
    networkEvidence: input.networkEvidence ?? [],
    lifecycleEvidence: input.lifecycleEvidence ?? {},
    candidateControls: input.candidateControls ?? [],
    playerClassification: input.playerClassification,
    routeClassification: input.routeClassification,
    truncation: input.truncation ?? {},
    warnings: input.warnings ?? [],
    omissions: input.omissions ?? [],
  });

  validateReportModel(model);
  return deepFreeze(model);
}

export function validateReportModel(model) {
  for (const key of REQUIRED_TOP_LEVEL) {
    if (!(key in model)) {
      throw new Error(`Report model missing required field: ${key}`);
    }
  }
  if (!isPlainObject(model.metadata)) {
    throw new Error('Report model metadata must be an object.');
  }
  if (typeof model.metadata.providerId !== 'string') {
    throw new Error('Report model metadata.providerId is required.');
  }
  assertProviderId(model.metadata.providerId);
  if (!isPlainObject(model.timing)) {
    throw new Error('Report model timing must be an object.');
  }
  if (!isValidTimestamp(model.timing.startedAt) || !isValidTimestamp(model.timing.finishedAt)) {
    throw new Error('Report model timing.startedAt and timing.finishedAt are required.');
  }
  for (const key of ['frames', 'scripts', 'iframes', 'mediaObservations', 'networkEvidence', 'candidateControls', 'warnings', 'omissions']) {
    if (!Array.isArray(model[key])) {
      throw new Error(`Report model ${key} must be an array.`);
    }
  }
  for (const key of ['lifecycleEvidence', 'truncation']) {
    if (!isPlainObject(model[key])) {
      throw new Error(`Report model ${key} must be an object.`);
    }
  }
  if (!isPlainObject(model.playerClassification) || typeof model.playerClassification.primaryFamily !== 'string') {
    throw new Error('Report model playerClassification.primaryFamily is required.');
  }
  if (!isPlainObject(model.routeClassification) || typeof model.routeClassification.route !== 'string') {
    throw new Error('Report model routeClassification.route is required.');
  }
  return true;
}

export function sanitizeReport(value, key = '') {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeReport(item, key));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [childKey, sanitizeReport(childValue, childKey)]),
    );
  }
  if (typeof value === 'string' && isUrlBearingKey(key)) {
    const redacted = redactUrl(value);
    return redacted.omitted ? null : redacted.url;
  }
  if (typeof value === 'string') {
    return sanitizeDiagnosticString(value);
  }
  return value;
}

export function sanitizeDiagnosticString(value) {
  if (typeof value !== 'string' || value === '') {
    return value;
  }
  return value.replace(/https?:\/\/[^\s<>"'`]+/gi, (match) => {
    const trailing = match.match(/[),.;:!?]+$/)?.[0] ?? '';
    const candidate = trailing ? match.slice(0, -trailing.length) : match;
    const redacted = redactUrl(candidate);
    return `${redacted.omitted ? '[redacted-url-omitted]' : redacted.url}${trailing}`;
  });
}

function isUrlBearingKey(key) {
  return /(^url$|url$|urls$|src$|currentSrc$|poster$|href$)/i.test(key);
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isValidTimestamp(value) {
  return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Date.parse(value));
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}
