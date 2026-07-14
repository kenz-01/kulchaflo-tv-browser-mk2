const SAFE_PROVIDER_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function redactUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return { url: null, omitted: true, reason: 'empty-or-non-string' };
  }

  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    return { url: null, omitted: true, reason: 'malformed-url' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { url: null, omitted: true, reason: 'unsupported-scheme' };
  }

  parsed.username = '';
  parsed.password = '';
  parsed.search = '';
  parsed.hash = '';

  return {
    url: parsed.toString(),
    omitted: false,
    reason: null,
    hostname: parsed.hostname,
    path: parsed.pathname,
  };
}

export function redactUrlString(value) {
  return redactUrl(value).url;
}

export function validateProviderId(value) {
  if (typeof value !== 'string') {
    return { valid: false, reason: 'not-a-string' };
  }
  if (value.length === 0) {
    return { valid: false, reason: 'empty' };
  }
  if (value.length > 64) {
    return { valid: false, reason: 'too-long' };
  }
  if (value.includes('/') || value.includes('\\')) {
    return { valid: false, reason: 'path-separator' };
  }
  if (value.includes('..')) {
    return { valid: false, reason: 'traversal' };
  }
  if (/\s/.test(value)) {
    return { valid: false, reason: 'whitespace' };
  }
  if (!SAFE_PROVIDER_ID.test(value)) {
    return { valid: false, reason: 'unsafe-characters' };
  }
  return { valid: true, reason: null };
}

export function assertProviderId(value) {
  const result = validateProviderId(value);
  if (!result.valid) {
    throw new Error(`Unsafe provider id: ${result.reason}`);
  }
  return value;
}
