import { DEFAULT_LIMITS } from './limits.mjs';
import { utcTimestamp } from './timestamps.mjs';

const CATEGORY_LIMIT_KEYS = Object.freeze({
  relevantNetworkRecords: 'relevantNetworkRecords',
  consoleErrorRecords: 'consoleErrorRecords',
  pageErrorRecords: 'pageErrorRecords',
  mediaElementObservations: 'mediaElementObservations',
  candidateControlObservations: 'candidateControlObservations',
  frameLifecycleEvents: 'frameLifecycleEvents',
  scriptSignatureRecords: 'scriptSignatureRecords',
  iframeSignatureRecords: 'iframeSignatureRecords',
});

export const EVIDENCE_CATEGORIES = Object.freeze([
  ...Object.keys(CATEGORY_LIMIT_KEYS),
  'lifecycle',
]);

export function createEvidenceCollector({ limits = DEFAULT_LIMITS, now = () => utcTimestamp() } = {}) {
  const records = new Map();
  const truncation = new Map();
  const lifecycle = new Map();

  for (const category of Object.keys(CATEGORY_LIMIT_KEYS)) {
    records.set(category, []);
    truncation.set(category, { truncated: false, limit: limits[CATEGORY_LIMIT_KEYS[category]] });
  }

  function append(category, record, options = {}) {
    if (category === 'lifecycle') {
      const event = options.event ?? record?.event;
      if (typeof event !== 'string' || event.trim() === '') {
        throw new Error('Lifecycle evidence requires a non-empty event name.');
      }
      const safeEvent = event.trim();
      if (!lifecycle.has(safeEvent)) {
        lifecycle.set(safeEvent, []);
        truncation.set(`lifecycle:${safeEvent}`, {
          truncated: false,
          limit: limits.lifecycleRecordsPerEventCategory,
        });
      }
      return appendTo(lifecycle.get(safeEvent), decorate(record, now), `lifecycle:${safeEvent}`, limits.lifecycleRecordsPerEventCategory);
    }

    if (!CATEGORY_LIMIT_KEYS[category]) {
      throw new Error(`Unknown evidence category: ${category}`);
    }
    return appendTo(records.get(category), decorate(record, now), category, limits[CATEGORY_LIMIT_KEYS[category]]);
  }

  function appendTo(target, record, truncationKey, limit) {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error(`Invalid evidence limit for ${truncationKey}.`);
    }
    if (target.length >= limit) {
      truncation.set(truncationKey, { truncated: true, limit });
      return false;
    }
    target.push(record);
    if (!truncation.has(truncationKey)) {
      truncation.set(truncationKey, { truncated: false, limit });
    }
    return true;
  }

  function snapshot() {
    const output = {};
    for (const [category, items] of records.entries()) {
      output[category] = items.map(clone);
    }
    output.lifecycle = Object.fromEntries(
      [...lifecycle.entries()].map(([event, items]) => [event, items.map(clone)]),
    );
    output.truncation = Object.fromEntries(
      [...truncation.entries()].map(([category, state]) => [category, { ...state }]),
    );
    return deepFreeze(output);
  }

  return Object.freeze({ append, snapshot });
}

function decorate(record, now) {
  const base = record && typeof record === 'object' && !Array.isArray(record) ? { ...record } : { value: record };
  if (!base.timestamp) {
    base.timestamp = now();
  }
  return base;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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
