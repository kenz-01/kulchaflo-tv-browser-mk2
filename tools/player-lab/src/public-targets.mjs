import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getBrowserProfile } from './browser-runtime.mjs';
import { assertProviderId } from './redact-url.mjs';

const DEFAULT_REGISTRY_PATH = fileURLToPath(new URL('../config/public-targets.json', import.meta.url));
const HOST_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

export function loadPublicTargets({ path = DEFAULT_REGISTRY_PATH, readFile = readFileSync } = {}) {
  let parsed;
  try {
    parsed = JSON.parse(readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid public target registry: ${error.message}`);
  }
  return validatePublicTargetsRegistry(parsed);
}

export function getPublicTargetPolicy(targetId) {
  const registry = loadPublicTargets();
  const target = registry.targets[targetId];
  if (!target) {
    throw new Error(`Unknown public target: ${targetId}`);
  }
  return deepFreeze({
    mode: 'registered-public-target',
    targetId: target.id,
    providerId: target.providerId,
    initialUrl: target.initialUrl,
    allowedMainFrameHosts: [...target.allowedMainFrameHosts],
    requiredProtocol: target.requiredProtocol,
    defaultProfileId: target.defaultProfileId,
  });
}

export function validatePublicTargetsRegistry(registry) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
    throw new Error('Invalid public target registry: expected object.');
  }
  if (registry.version !== 1) {
    throw new Error('Invalid public target registry: unsupported version.');
  }
  if (!registry.targets || typeof registry.targets !== 'object' || Array.isArray(registry.targets)) {
    throw new Error('Invalid public target registry: targets object is required.');
  }

  const targets = {};
  for (const [targetId, target] of Object.entries(registry.targets)) {
    assertSafeTargetId(targetId);
    targets[targetId] = validateTarget(targetId, target);
  }
  return deepFreeze({ version: 1, targets });
}

export function assertSafeTargetId(value) {
  assertProviderId(value);
  return value;
}

function validateTarget(targetId, target) {
  if (!target || typeof target !== 'object' || Array.isArray(target)) {
    throw new Error(`Invalid public target ${targetId}: expected object.`);
  }
  assertProviderId(target.providerId);
  const parsed = validateRegistryInitialUrl(target.initialUrl, targetId);
  if (!Array.isArray(target.allowedMainFrameHosts) || target.allowedMainFrameHosts.length === 0) {
    throw new Error(`Invalid public target ${targetId}: allowedMainFrameHosts is required.`);
  }
  const seenHosts = new Set();
  const hosts = target.allowedMainFrameHosts.map((host) => validateAllowedHost(host, targetId));
  for (const host of hosts) {
    if (seenHosts.has(host)) {
      throw new Error(`Invalid public target ${targetId}: duplicate allowed host.`);
    }
    seenHosts.add(host);
  }
  if (target.requiredProtocol !== 'https:') {
    throw new Error(`Invalid public target ${targetId}: requiredProtocol must be https:.`);
  }
  getBrowserProfile(target.defaultProfileId);
  if (!seenHosts.has(parsed.hostname)) {
    throw new Error(`Invalid public target ${targetId}: initial host must be allowed.`);
  }
  return deepFreeze({
    id: targetId,
    providerId: target.providerId,
    initialUrl: parsed.toString(),
    allowedMainFrameHosts: hosts,
    requiredProtocol: target.requiredProtocol,
    defaultProfileId: target.defaultProfileId,
  });
}

function validateRegistryInitialUrl(value, targetId) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid public target ${targetId}: malformed initial URL.`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`Invalid public target ${targetId}: initial URL must use HTTPS.`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`Invalid public target ${targetId}: initial URL credentials are forbidden.`);
  }
  if (parsed.hash || (parsed.search && !isExactKulchaFloAttribution(parsed.searchParams))) {
    throw new Error(`Invalid public target ${targetId}: initial URL must not include query or fragment.`);
  }
  if (parsed.port) {
    throw new Error(`Invalid public target ${targetId}: initial URL must use the default HTTPS port.`);
  }
  validateAllowedHost(parsed.hostname, targetId);
  return parsed;
}

function isExactKulchaFloAttribution(searchParams) {
  const entries = [...searchParams.entries()];
  return entries.length === 1 && entries[0][0] === 'utm_source' && entries[0][1] === 'KulchaFlo';
}

function validateAllowedHost(value, targetId) {
  if (typeof value !== 'string' || value !== value.toLowerCase() || value.trim() !== value) {
    throw new Error(`Invalid public target ${targetId}: allowed host must be lowercase.`);
  }
  if (value.includes('*')) {
    throw new Error(`Invalid public target ${targetId}: wildcard hosts are forbidden.`);
  }
  if (!HOST_PATTERN.test(value)) {
    throw new Error(`Invalid public target ${targetId}: malformed allowed host.`);
  }
  if (isIpLiteral(value)) {
    throw new Error(`Invalid public target ${targetId}: IP hosts are forbidden.`);
  }
  return value;
}

function isIpLiteral(value) {
  return /^\d+\.\d+\.\d+\.\d+$/.test(value) || value.includes(':');
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
