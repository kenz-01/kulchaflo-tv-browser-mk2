import { redactUrl } from './redact-url.mjs';
import { loadPlayerSignatures } from './load-player-signatures.mjs';

const MEDIA_CONTENT_TYPES = Object.freeze([
  'application/vnd.apple.mpegurl',
  'application/x-mpegurl',
  'application/dash+xml',
  'video/',
  'audio/',
]);

export function configuredNetworkSignatureTokens(signatures = loadPlayerSignatures()) {
  const hostPatterns = new Set();
  const scriptPatterns = new Set();
  for (const family of Object.values(signatures.families)) {
    for (const host of family.hostPatterns ?? []) {
      hostPatterns.add(String(host).toLowerCase());
    }
    for (const pattern of family.scriptPatterns ?? []) {
      scriptPatterns.add(String(pattern).toLowerCase());
    }
  }
  return {
    hostPatterns: [...hostPatterns].sort(),
    scriptPatterns: [...scriptPatterns].sort(),
  };
}

export function classifyNetworkRecord({ url, resourceType, method, status, contentType, failureText, documentKind, signatures } = {}) {
  const redacted = redactUrl(url);
  if (redacted.omitted) {
    return null;
  }
  const safeContentType = safeContentTypeValue(contentType);
  const lowerUrl = redacted.url.toLowerCase();
  const host = redacted.hostname ?? '';
  const path = redacted.path ?? '';
  const configured = configuredNetworkSignatureTokens(signatures);
  const kinds = [];

  if (resourceType === 'document') {
    kinds.push(documentKind === 'iframe-document' ? 'iframe-document' : 'document');
  }
  if (resourceType === 'script' && (includesAny(lowerUrl, configured.scriptPatterns) || hostMatches(host, configured.hostPatterns))) {
    kinds.push('player-script');
  }
  if (path.toLowerCase().endsWith('.m3u8')) {
    kinds.push('hls-manifest');
  }
  if (path.toLowerCase().endsWith('.mpd')) {
    kinds.push('dash-manifest');
  }
  if (safeContentType && MEDIA_CONTENT_TYPES.some((type) => safeContentType.includes(type))) {
    kinds.push('media-mime');
  }
  if (hostMatches(host, configured.hostPatterns)) {
    kinds.push('known-player-or-cdn-host');
  }
  if (failureText && (resourceType === 'media' || resourceType === 'script' || kinds.some((kind) => kind.includes('manifest') || kind.includes('player')))) {
    kinds.push('failed-media-or-player-request');
  }

  if (kinds.length === 0) {
    return null;
  }

  return {
    kind: kinds.join(','),
    resourceType,
    documentKind: documentKind === 'iframe-document' ? 'iframe-document' : resourceType === 'document' ? 'document' : undefined,
    method,
    url: redacted.url,
    contentType: safeContentType,
    status: Number.isInteger(status) ? status : undefined,
    failureText: safeFailureText(failureText),
  };
}

export function safeContentTypeValue(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }
  return value.split(';')[0].trim().toLowerCase().slice(0, 120);
}

function safeFailureText(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }
  return value.replace(/https?:\/\/[^\s]+/gi, '[redacted-url]').slice(0, 180);
}

function includesAny(value, needles) {
  return needles.some((needle) => String(value).toLowerCase().includes(needle));
}

function hostMatches(host, patterns) {
  const normalized = String(host).toLowerCase();
  return patterns.some((pattern) => normalized === pattern || normalized.endsWith(`.${pattern}`));
}
