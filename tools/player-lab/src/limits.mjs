export const DEFAULT_LIMITS = Object.freeze({
  relevantNetworkRecords: 500,
  consoleErrorRecords: 200,
  pageErrorRecords: 200,
  lifecycleRecordsPerEventCategory: 100,
  mediaElementObservations: 100,
  candidateControlObservations: 100,
  frameLifecycleEvents: 100,
  scriptSignatureRecords: 100,
  iframeSignatureRecords: 100,
});

export function createLimitState(limits = DEFAULT_LIMITS) {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(limits).map(([category, limit]) => [
        category,
        Object.freeze({ limit, truncated: false }),
      ]),
    ),
  );
}

export function applyLimit(records, record, category, truncation, limits = DEFAULT_LIMITS) {
  const limit = limits[category];
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error(`Unknown or invalid limit category: ${category}`);
  }
  if (records.length >= limit) {
    truncation[category] = { truncated: true, limit };
    return false;
  }
  records.push(record);
  if (!truncation[category]) {
    truncation[category] = { truncated: false, limit };
  }
  return true;
}
