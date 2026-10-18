import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvidenceCollector } from '../src/evidence-collector.mjs';

test('evidence collector stores records before limit and truncates after limit', () => {
  const collector = createEvidenceCollector({
    limits: {
      relevantNetworkRecords: 1,
      consoleErrorRecords: 1,
      pageErrorRecords: 1,
      lifecycleRecordsPerEventCategory: 1,
      mediaElementObservations: 1,
      candidateControlObservations: 1,
      frameLifecycleEvents: 1,
      scriptSignatureRecords: 1,
      iframeSignatureRecords: 1,
    },
    now: fixedNow(),
  });

  assert.equal(collector.append('relevantNetworkRecords', { url: 'https://example.test/a' }), true);
  assert.equal(collector.append('relevantNetworkRecords', { url: 'https://example.test/b' }), false);

  const snapshot = collector.snapshot();
  assert.equal(snapshot.relevantNetworkRecords.length, 1);
  assert.deepEqual(snapshot.truncation.relevantNetworkRecords, { truncated: true, limit: 1 });
});

test('evidence collector rejects unknown categories', () => {
  const collector = createEvidenceCollector({ now: fixedNow() });
  assert.throws(() => collector.append('unknownCategory', {}), /Unknown evidence category/);
});

test('evidence collector caps lifecycle records per event category', () => {
  const collector = createEvidenceCollector({
    limits: {
      relevantNetworkRecords: 1,
      consoleErrorRecords: 1,
      pageErrorRecords: 1,
      lifecycleRecordsPerEventCategory: 1,
      mediaElementObservations: 1,
      candidateControlObservations: 1,
      frameLifecycleEvents: 1,
      scriptSignatureRecords: 1,
      iframeSignatureRecords: 1,
    },
    now: fixedNow(),
  });
  assert.equal(collector.append('lifecycle', { event: 'playing', target: 'v1' }), true);
  assert.equal(collector.append('lifecycle', { event: 'playing', target: 'v1' }), false);
  assert.equal(collector.append('lifecycle', { event: 'waiting', target: 'v1' }), true);

  const snapshot = collector.snapshot();
  assert.equal(snapshot.lifecycle.playing.length, 1);
  assert.equal(snapshot.lifecycle.waiting.length, 1);
  assert.deepEqual(snapshot.truncation['lifecycle:playing'], { truncated: true, limit: 1 });
});

test('evidence collector snapshots are immutable and detached', () => {
  const collector = createEvidenceCollector({ now: fixedNow() });
  collector.append('consoleErrorRecords', { message: 'first' });
  const snapshot = collector.snapshot();
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.consoleErrorRecords), true);
  assert.throws(() => {
    snapshot.consoleErrorRecords.push({ message: 'mutate' });
  }, /Cannot add property|object is not extensible|read only/);

  collector.append('consoleErrorRecords', { message: 'second' });
  assert.equal(snapshot.consoleErrorRecords.length, 1);
  assert.equal(collector.snapshot().consoleErrorRecords.length, 2);
});

function fixedNow() {
  return () => '2026-07-14T00:00:00.000Z';
}
