import test from 'node:test';
import assert from 'node:assert/strict';
import { createReportModel, validateReportModel } from '../src/report-model.mjs';
import { sampleReportInput } from './report-fixtures.mjs';

test('report model validates required fields', () => {
  const model = createReportModel(sampleReportInput());
  assert.equal(validateReportModel(model), true);
  assert.equal(model.metadata.providerId, 'fixture-provider');
});

test('report model fails with clear message for missing required fields', () => {
  assert.throws(() => createReportModel({}), /metadata must be an object/);
});

test('report model redacts nested URL-bearing fields', () => {
  const model = createReportModel(sampleReportInput());
  assert.equal(model.requestedUrl, 'https://example.test/watch');
  assert.equal(model.finalUrl, 'https://example.test/final');
  assert.equal(model.frames[0].url, 'https://example.test/frame');
  assert.equal(model.mediaObservations[0].src, 'https://cdn.example.test/live/index.m3u8');
  assert.equal(model.networkEvidence[0].url, 'https://cdn.example.test/player.js');
});

test('report model redacts URLs inside diagnostic strings recursively', () => {
  const model = createReportModel(sampleReportInput({
    navigation: {
      result: 'fixture-only',
      errors: ['Failed https://user:pass@nav.example.test/a?token=nav-secret#nav-frag, then https://nav.example.test/b?sig=two#two.'],
      redirectCount: 0,
      popupCount: 0,
      unexpectedPopupUrls: [],
    },
  }));
  const json = JSON.stringify(model);
  assert.doesNotMatch(json, /token=|sig=|user:pass|#nav-frag|#two|evidence-secret|message-secret|life-secret|control-secret|warning-secret/);
  assert.match(json, /https:\/\/nav\.example\.test\/a,/);
  assert.match(json, /https:\/\/nav\.example\.test\/b\./);
  assert.match(json, /https:\/\/player\.example\.test\/embed/);
});

test('report model validates provider id', () => {
  assert.throws(() => createReportModel(sampleReportInput({
    metadata: { providerId: '../evil', profilerVersion: 'x' },
  })), /Unsafe provider id/);
});

test('report model validates array fields', () => {
  assert.throws(() => createReportModel(sampleReportInput({ frames: {} })), /frames must be an array/);
  assert.throws(() => createReportModel(sampleReportInput({ warnings: {} })), /warnings must be an array/);
});

test('report model validates object fields and timestamps', () => {
  assert.throws(() => createReportModel(sampleReportInput({ lifecycleEvidence: [] })), /lifecycleEvidence must be an object/);
  assert.throws(() => createReportModel(sampleReportInput({ truncation: [] })), /truncation must be an object/);
  assert.throws(() => createReportModel(sampleReportInput({ playerClassification: [] })), /playerClassification\.primaryFamily is required/);
  assert.throws(() => createReportModel(sampleReportInput({ routeClassification: [] })), /routeClassification\.route is required/);
  assert.throws(() => createReportModel(sampleReportInput({
    timing: { startedAt: 'not-a-date', finishedAt: '2026-07-14T00:00:20.000Z' },
  })), /timing\.startedAt and timing\.finishedAt/);
});

test('report model output is immutable', () => {
  const model = createReportModel(sampleReportInput());
  assert.equal(Object.isFrozen(model), true);
  assert.equal(Object.isFrozen(model.frames), true);
  assert.throws(() => {
    model.frames.push({});
  }, /Cannot add property|object is not extensible|read only/);
});
