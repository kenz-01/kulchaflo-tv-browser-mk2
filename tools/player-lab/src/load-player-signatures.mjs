import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYER_FAMILIES } from './player-families.mjs';

const REQUIRED_PATTERN_KEYS = Object.freeze([
  'hostPatterns',
  'pathPatterns',
  'scriptPatterns',
  'domPatterns',
  'globalNames',
]);

const UNSAFE_CATCH_ALL_PATHS = new Set(['', '/', '*', '/*', '.*']);

export function loadPlayerSignatures(configPath = defaultConfigPath()) {
  let raw;
  try {
    raw = readFileSync(configPath, 'utf8');
  } catch (error) {
    throw new Error(`Unable to read player signatures config: ${error.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Malformed player signatures config JSON: ${error.message}`);
  }

  return validatePlayerSignatures(parsed);
}

export function validatePlayerSignatures(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Player signatures config must be an object.');
  }
  if (!config.families || typeof config.families !== 'object' || Array.isArray(config.families)) {
    throw new Error('Player signatures config must contain a families object.');
  }

  const requiredFamilies = PLAYER_FAMILIES.filter((family) => family !== 'unknown');
  const configuredFamilies = Object.keys(config.families).sort();
  const requiredSorted = [...requiredFamilies].sort();

  const missing = requiredSorted.filter((family) => !configuredFamilies.includes(family));
  const unknown = configuredFamilies.filter((family) => !requiredSorted.includes(family));
  if (missing.length > 0) {
    throw new Error(`Player signatures config missing required families: ${missing.join(', ')}`);
  }
  if (unknown.length > 0) {
    throw new Error(`Player signatures config contains unknown families: ${unknown.join(', ')}`);
  }

  for (const family of requiredFamilies) {
    const signature = config.families[family];
    if (!signature || typeof signature !== 'object' || Array.isArray(signature)) {
      throw new Error(`Player signature for ${family} must be an object.`);
    }
    for (const key of REQUIRED_PATTERN_KEYS) {
      if (!Array.isArray(signature[key])) {
        throw new Error(`Player signature ${family}.${key} must be an array.`);
      }
      for (const pattern of signature[key]) {
        if (typeof pattern !== 'string' || pattern.trim() === '') {
          throw new Error(`Player signature ${family}.${key} contains an empty or non-string pattern.`);
        }
      }
    }
    for (const pattern of signature.pathPatterns) {
      if (UNSAFE_CATCH_ALL_PATHS.has(pattern.trim())) {
        throw new Error(`Player signature ${family}.pathPatterns contains unsafe catch-all path: ${pattern}`);
      }
    }
  }

  return Object.freeze({
    ...config,
    families: Object.freeze(
      Object.fromEntries(
        requiredFamilies.map((family) => [
          family,
          Object.freeze(
            Object.fromEntries(
              REQUIRED_PATTERN_KEYS.map((key) => [key, Object.freeze([...config.families[family][key]])]),
            ),
          ),
        ]),
      ),
    ),
  });
}

export function configuredFamilies(config = loadPlayerSignatures()) {
  return Object.keys(config.families).sort();
}

function defaultConfigPath() {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  return resolve(moduleDir, '../config/player-signatures.json');
}
