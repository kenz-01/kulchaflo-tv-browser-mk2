import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  APPROVED_VIMEO_SELECTORS,
  DEFAULT_HELPER_PROPOSAL_OUTPUT_ROOT,
  assertSafeHelperProposal,
  createHelperRecommendation,
  loadHelperEvidence,
  proposeHelper,
  validateHelperEvidence,
} from '../src/helper-proposal.mjs';

const fixturesRoot = new URL('./fixtures/helper-proposals/', import.meta.url);
const fixturePath = (name) => fileURLToPath(new URL(`${name}/`, fixturesRoot));
const fixedNow = () => new Date('2026-07-22T00:00:00.000Z');

test('CVM-like evidence yields a direct unapproved registry policy with approved fields only', () => {
  const evidence = loadHelperEvidence(fixturePath('cvm-like'));
  const result = createHelperRecommendation(evidence, { generatedAt: fixedNow().toISOString() });
  assert.equal(result.recommendationCategory, 'direct-registry-policy');
  assert.equal(result.policyProposal.proposalStatus, 'unapproved');
  assert.deepEqual(result.policyProposal.capabilities.transportAutohide.selectors, APPROVED_VIMEO_SELECTORS);
  assert.deepEqual(Object.keys(result.policyProposal.capabilities.transportAutohide).sort(), ['enabled', 'idleMs', 'selectors']);
  assert.equal(JSON.stringify(result.policyProposal).includes('url'), false);
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(Object.keys(result).sort(), [
    'confidence',
    'generatedAt',
    'playerFamily',
    'policyProposal',
    'proposalVersion',
    'providerId',
    'recommendationCategory',
    'recommendationReason',
    'reviewWarnings',
    'schemaVersion',
    'sourceEvidenceReferences',
    'supportedCapabilities',
    'targetId',
    'trustedMatchingEvidence',
    'unsupportedRequirements',
  ]);
});

test('unrelated Vimeo does not inherit the CVM policy', () => {
  const result = createHelperRecommendation(loadHelperEvidence(fixturePath('unrelated-vimeo')));
  assert.equal(result.recommendationCategory, 'insufficient-evidence');
  assert.equal(result.policyProposal, null);
});

test('ABS/Tego advanced requirements force an engine extension study without a proposal', () => {
  const evidence = loadHelperEvidence(fixturePath('abs-tego'));
  assert.deepEqual(evidence.transportAutohide.selectors, ['.rmp-control-bar', '.rmp-controls', '.rmp-module']);
  const result = createHelperRecommendation(evidence);
  assert.equal(result.recommendationCategory, 'engine-extension-study');
  assert.equal(result.policyProposal, null);
  assert.deepEqual(result.unsupportedRequirements, [
    'external-reveal-bridge',
    'initial-settle-delay',
    'inline-style-visibility',
    'interaction-throttle',
    'readiness-predicate',
    'retry-delay-and-limit',
    'shared-provider-state',
  ]);
});

test('Island-style dual player behavior stays provider-specific', () => {
  const result = createHelperRecommendation(loadHelperEvidence(fixturePath('island-dual-player')));
  assert.equal(result.recommendationCategory, 'provider-specific-helper');
  assert.equal(result.policyProposal, null);
});

test('a structured conflict takes precedence over provider-specific behavior', () => {
  const evidence = structuredClone(loadHelperEvidence(fixturePath('island-dual-player')));
  evidence.conflictingEvidence = true;
  const result = createHelperRecommendation(evidence);
  assert.equal(result.recommendationCategory, 'insufficient-evidence');
  assert.equal(result.policyProposal, null);
});

test('weak or conflicting evidence remains insufficient', () => {
  const result = createHelperRecommendation(loadHelperEvidence(fixturePath('insufficient')));
  assert.equal(result.recommendationCategory, 'insufficient-evidence');
  assert.equal(result.policyProposal, null);
});

test('unsupported requirements block a direct proposal regardless of otherwise strong evidence', () => {
  const evidence = structuredClone(loadHelperEvidence(fixturePath('cvm-like')));
  evidence.unsupportedRequirements = ['readiness-predicate'];
  const result = createHelperRecommendation(evidence);
  assert.equal(result.recommendationCategory, 'engine-extension-study');
  assert.equal(result.policyProposal, null);
});

test('proposal output is deterministic and staged artifacts match the returned result', () => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'player-helper-proposal-'));
  try {
    const first = proposeHelper({ reportPath: fixturePath('cvm-like'), outputRoot, now: fixedNow });
    const second = proposeHelper({ reportPath: fixturePath('cvm-like'), outputRoot, now: fixedNow });
    assert.deepEqual(first.recommendation, second.recommendation);
    assert.deepEqual(JSON.parse(readFileSync(first.jsonPath, 'utf8')), first.recommendation);
    assert.equal(existsSync(first.markdownPath), true);
    assert.equal(existsSync(join(outputRoot, '.incomplete-2026-07-22T00-00-00-000Z')), false);
    assertSafeHelperProposal(first.recommendation);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('default proposal output is ignored Player Lab reports output, not beside evidence', () => {
  const result = proposeHelper({ reportPath: fixturePath('cvm-like'), now: fixedNow });
  try {
    assert.equal(result.outputDir.startsWith(`${DEFAULT_HELPER_PROPOSAL_OUTPUT_ROOT}/`), true);
    assert.equal(result.outputDir.includes('/test/fixtures/'), false);
  } finally {
    rmSync(result.outputDir, { recursive: true, force: true });
  }
});

test('tracked repository output paths are rejected before allocation while external paths work', () => {
  const forbiddenAppOutput = fileURLToPath(new URL('../../../app-gv/helper-proposal-test-output', import.meta.url));
  const forbiddenFixtureOutput = fileURLToPath(new URL('./fixtures/helper-proposal-output', import.meta.url));
  assert.equal(existsSync(forbiddenAppOutput), false);
  assert.equal(existsSync(forbiddenFixtureOutput), false);
  assert.throws(() => proposeHelper({ reportPath: fixturePath('cvm-like'), outputRoot: forbiddenAppOutput }), /reports/);
  assert.throws(() => proposeHelper({ reportPath: fixturePath('cvm-like'), outputRoot: forbiddenFixtureOutput }), /reports/);
  assert.equal(existsSync(forbiddenAppOutput), false);
  assert.equal(existsSync(forbiddenFixtureOutput), false);
  const externalOutput = mkdtempSync(join(tmpdir(), 'player-helper-proposal-external-'));
  try {
    const result = proposeHelper({ reportPath: fixturePath('cvm-like'), outputRoot: externalOutput, now: fixedNow });
    assert.equal(result.outputDir.startsWith(`${externalOutput}/`), true);
  } finally {
    rmSync(externalOutput, { recursive: true, force: true });
  }
});

test('helper evidence validation rejects unsafe content and malformed contract values', () => {
  const evidence = structuredClone(loadHelperEvidence(fixturePath('cvm-like')));
  evidence.sourceEvidenceReferences = ['unsafe?token=value'];
  assert.throws(() => validateHelperEvidence(evidence), /safe references/);
  evidence.sourceEvidenceReferences = ['safe-reference'];
  evidence.transportAutohide.selectors = ['.safe-selector{color:red}'];
  assert.throws(() => validateHelperEvidence(evidence), /unsafe material/);
  evidence.transportAutohide.selectors = ['.rmp-controls'];
  evidence.supportedCapabilities = ['unknown-capability'];
  assert.throws(() => validateHelperEvidence(evidence), /current contract values/);
});

test('raw URLs and local paths are rejected while structural host and path matching remains valid', () => {
  const evidence = structuredClone(loadHelperEvidence(fixturePath('cvm-like')));
  evidence.freeText = 'https://media.example.test/stream.m3u8';
  assert.throws(() => validateHelperEvidence(evidence), /raw URL/);
  evidence.freeText = '/home/example/private';
  assert.throws(() => validateHelperEvidence(evidence), /home path/);
  evidence.freeText = 'C:\\Users\\example\\private';
  assert.throws(() => validateHelperEvidence(evidence), /home path/);
  delete evidence.freeText;
  assert.equal(validateHelperEvidence(evidence), true);
});

test('proposal modules remain offline and do not import browser or network modules', () => {
  const moduleText = readFileSync(new URL('../src/helper-proposal.mjs', import.meta.url), 'utf8');
  const cliText = readFileSync(new URL('../src/helper-proposal-cli.mjs', import.meta.url), 'utf8');
  for (const forbidden of ['playwright', 'browser-runtime', 'profile-url', 'http:', 'https:', 'fetch(']) {
    assert.equal(moduleText.includes(forbidden), false, `unexpected proposal dependency: ${forbidden}`);
    assert.equal(cliText.includes(forbidden), false, `unexpected CLI dependency: ${forbidden}`);
  }
});
