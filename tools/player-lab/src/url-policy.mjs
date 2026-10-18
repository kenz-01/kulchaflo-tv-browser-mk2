import { redactUrl } from './redact-url.mjs';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:']);

export function validateCheckpoint3bUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Invalid URL: malformed URL.');
  }
  if (!SUPPORTED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`Invalid URL ${safeUrlForError(value)}: unsupported protocol.`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`Invalid URL ${safeUrlForError(value)}: embedded credentials are not allowed.`);
  }
  if (!LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error(`Arbitrary public URLs are not permitted; use a registered --target. URL: ${safeUrlForError(value)}`);
  }
  return parsed;
}

export function isCheckpoint3bAllowedUrl(value) {
  try {
    validateCheckpoint3bUrl(value);
    return true;
  } catch {
    return false;
  }
}

export function safeUrlForError(value) {
  const redacted = redactUrl(String(value ?? ''));
  return redacted.omitted ? '[invalid-url]' : redacted.url;
}
