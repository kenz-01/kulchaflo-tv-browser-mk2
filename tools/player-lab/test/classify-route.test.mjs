import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyRoute } from '../src/classify-route.mjs';
import { DEFAULT_LIMITS, applyLimit } from '../src/limits.mjs';

test('classifies embedded-player browser-first route', () => {
  const result = classifyRoute({
    iframeUrls: ['https://player.vimeo.com/video/123'],
    playerHosts: ['player.vimeo.com'],
  });
  assert.equal(result.route, 'embedded-player browser-first');
  assert.equal(result.confidence, 'medium');
});

test('classifies official-page browser-first route', () => {
  const result = classifyRoute({ officialPageEvidence: true, mediaElementCount: 1 });
  assert.equal(result.route, 'official-page browser-first');
});

test('authenticated-flow precedence beats embedded evidence', () => {
  const result = classifyRoute({
    iframeUrls: ['https://player.example.test/embed'],
    authSignals: ['Sign in to continue watching'],
  });
  assert.equal(result.route, 'authenticated flow');
  assert.equal(result.confidence, 'high');
});

test('generic newsletter subscription copy is not authenticated player flow', () => {
  const result = classifyRoute({
    officialPageEvidence: true,
    domSignals: ['Subscribe to our newsletter'],
  });
  assert.equal(result.route, 'official-page browser-first');
});

test('contextual sign-in watching copy is authenticated player flow', () => {
  const result = classifyRoute({
    officialPageEvidence: true,
    authSignals: ['Sign in to continue watching'],
  });
  assert.equal(result.route, 'authenticated flow');
});

test('exact native promotion requires exact known safe source evidence', () => {
  const result = classifyRoute({
    officialPageEvidence: true,
    exactKnownNativeSource: true,
  });
  assert.equal(result.route, 'exact-native-promotion candidate');
  assert.equal(result.confidence, 'medium');
});

test('manifest evidence alone does not imply native promotion', () => {
  const result = classifyRoute({
    manifestUrls: ['https://cdn.example.test/live/index.m3u8?token=secret'],
  });
  assert.equal(result.route, 'unknown / further investigation');
  assert.ok(result.uncertainty.some((item) => item.includes('Manifest evidence alone')));
});

test('route notes manifest uncertainty for browser-first routes', () => {
  const result = classifyRoute({
    officialPageEvidence: true,
    networkUrls: ['https://cdn.example.test/live/index.mpd'],
  });
  assert.equal(result.route, 'official-page browser-first');
  assert.ok(result.uncertainty.some((item) => item.includes('does not justify exact native promotion')));
});

test('limits define required categories and truncation markers', () => {
  assert.equal(DEFAULT_LIMITS.relevantNetworkRecords, 500);
  assert.equal(DEFAULT_LIMITS.consoleErrorRecords, 200);
  assert.equal(DEFAULT_LIMITS.pageErrorRecords, 200);
  assert.equal(DEFAULT_LIMITS.lifecycleRecordsPerEventCategory, 100);
  assert.equal(DEFAULT_LIMITS.mediaElementObservations, 100);
  assert.equal(DEFAULT_LIMITS.candidateControlObservations, 100);
  assert.equal(DEFAULT_LIMITS.frameLifecycleEvents, 100);
  assert.equal(DEFAULT_LIMITS.scriptSignatureRecords, 100);
  assert.equal(DEFAULT_LIMITS.iframeSignatureRecords, 100);

  const records = [];
  const truncation = {};
  assert.equal(applyLimit(records, 'a', 'mediaElementObservations', truncation, { mediaElementObservations: 1 }), true);
  assert.equal(applyLimit(records, 'b', 'mediaElementObservations', truncation, { mediaElementObservations: 1 }), false);
  assert.deepEqual(truncation.mediaElementObservations, { truncated: true, limit: 1 });
});
