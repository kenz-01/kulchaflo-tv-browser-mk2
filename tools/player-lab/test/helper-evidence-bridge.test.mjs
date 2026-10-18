import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { bridgeAnalysisToHelperEvidence, DEFAULT_HELPER_EVIDENCE_OUTPUT_ROOT, loadBridgeSource, prepareHelperEvidence } from '../src/helper-evidence-bridge.mjs';
import { createHelperRecommendation } from '../src/helper-proposal.mjs';
import { createRecommendation, loadAndValidateReport } from '../src/analyze-report.mjs';

const fixtureRoot = new URL('./fixtures/helper-evidence-bridge/', import.meta.url);
const fixturePath = (name) => fileURLToPath(new URL(`${name}/`, fixtureRoot));
const fixedNow = () => new Date('2026-07-22T01:00:00.000Z');

function bridged(name) {
  return bridgeAnalysisToHelperEvidence(loadBridgeSource(fixturePath(name)));
}

function mutableCompleteSource() {
  return structuredClone(loadBridgeSource(fixturePath('cvm-complete')));
}

function writeBoundSource(directory, analysis, observation) {
  mkdirSync(directory, { recursive: true });
  const analysisBytes = `${JSON.stringify(analysis, null, 2)}\n`;
  writeFileSync(join(directory, 'analysis.json'), analysisBytes, 'utf8');
  const analysisSha256 = createHash('sha256').update(analysisBytes).digest('hex');
  if (observation) {
    writeFileSync(join(directory, 'helper-capability-observations.json'), `${JSON.stringify({
      ...observation,
      providerId: observation.providerId ?? analysis.providerId,
      ...(analysis.targetId ? { targetId: observation.targetId ?? analysis.targetId } : {}),
      playerFamily: observation.playerFamily ?? analysis.evidenceSummary.primaryPlayerFamily,
      analysisSha256: observation.analysisSha256 ?? analysisSha256,
    }, null, 2)}\n`, 'utf8');
  }
  return analysisSha256;
}

test('complete source evidence creates valid helper evidence and a direct registry proposal', () => {
  const { evidence, provenance } = bridged('cvm-complete');
  const recommendation = createHelperRecommendation(evidence);
  assert.equal(evidence.playerFamily, 'vimeo');
  assert.equal(recommendation.recommendationCategory, 'direct-registry-policy');
  assert.equal(recommendation.policyProposal.proposalStatus, 'unapproved');
  assert.deepEqual(provenance.directlyObservedFields, [
    'transportAutohide.enabled', 'transportAutohide.idleMs', 'transportAutohide.interactionReveal',
    'transportAutohide.oneOwnedTimer', 'transportAutohide.pagehideCleanup', 'transportAutohide.selectors',
    'transportAutohide.urlFreeDiagnostics', 'trustedMatchingEvidence.frameHost', 'trustedMatchingEvidence.pathPrefix',
    'trustedMatchingEvidence.pathSuffix', 'trustedMatchingEvidence.referrerHosts',
  ]);
  assert.deepEqual(provenance.validatedAnalyzerDerivedFields, ['providerId', 'targetId', 'playerFamily']);
  assert.deepEqual(provenance.fixtureOrTestEvidenceFields, []);
});

test('Vimeo analysis without trusted matching is downgraded and never fabricates fields', () => {
  const { evidence, provenance } = bridged('vimeo-untrusted');
  assert.deepEqual(evidence.trustedMatchingEvidence, {});
  assert.equal(evidence.conflictingEvidence, true);
  assert.equal(createHelperRecommendation(evidence).recommendationCategory, 'insufficient-evidence');
  assert.ok(provenance.unavailableFields.includes('trustedMatchingEvidence.referrerHosts'));
  assert.deepEqual(provenance.validatedAnalyzerDerivedFields, ['providerId', 'playerFamily']);
});

test('partial transport observations promote safely but cannot generate a direct policy', () => {
  const source = mutableCompleteSource();
  const missingSelectors = structuredClone(source);
  delete missingSelectors.observations.transportAutohide.selectors;
  const result = bridgeAnalysisToHelperEvidence(missingSelectors);
  assert.equal(result.evidence.transportAutohide, undefined);
  assert.ok(result.provenance.unavailableFields.includes('transportAutohide.selectors'));
  assert.equal(createHelperRecommendation(result.evidence).recommendationCategory, 'insufficient-evidence');
  assert.equal(createHelperRecommendation(result.evidence).policyProposal, null);
});

test('missing idle delay and claimed missing capability are explicitly downgraded', () => {
  const missingIdle = mutableCompleteSource();
  delete missingIdle.observations.transportAutohide.idleMs;
  const idleResult = bridgeAnalysisToHelperEvidence(missingIdle);
  assert.ok(idleResult.provenance.unavailableFields.includes('transportAutohide.idleMs'));
  assert.equal(createHelperRecommendation(idleResult.evidence).recommendationCategory, 'insufficient-evidence');

  const missingBacking = mutableCompleteSource();
  delete missingBacking.observations.transportAutohide.pagehideCleanup;
  const backingResult = bridgeAnalysisToHelperEvidence(missingBacking);
  assert.ok(backingResult.provenance.conflictingFields.includes('transportAutohide.pagehideCleanup'));
  assert.ok(backingResult.provenance.downgradeReasons.includes('capability-claim-contradicts-observation'));
  assert.equal(createHelperRecommendation(backingResult.evidence).recommendationCategory, 'insufficient-evidence');
  assert.equal(createHelperRecommendation(backingResult.evidence).policyProposal, null);
});

test('false or contradictory timer ownership is insufficient evidence with no policy proposal', () => {
  const source = mutableCompleteSource();
  source.observations.transportAutohide.oneOwnedTimer = false;
  const result = bridgeAnalysisToHelperEvidence(source);
  const recommendation = createHelperRecommendation(result.evidence);
  assert.ok(result.provenance.conflictingFields.includes('transportAutohide.oneOwnedTimer'));
  assert.equal(result.evidence.conflictingEvidence, true);
  assert.equal(recommendation.recommendationCategory, 'insufficient-evidence');
  assert.equal(recommendation.policyProposal, null);
});

test('provider-specific behavior cannot override a contradictory timer ownership claim', () => {
  const { evidence, provenance } = bridged('provider-specific-contradictory');
  const recommendation = createHelperRecommendation(evidence);
  assert.equal(evidence.providerSpecificBehavior, true);
  assert.equal(evidence.conflictingEvidence, true);
  assert.ok(provenance.conflictingFields.includes('transportAutohide.oneOwnedTimer'));
  assert.equal(recommendation.recommendationCategory, 'insufficient-evidence');
  assert.equal(recommendation.policyProposal, null);
});

test('partial observations are promoted with exact unavailable provenance and no transport contract', () => {
  const root = mkdtempSync(join(tmpdir(), 'helper-evidence-partial-'));
  const outputRoot = join(root, 'output');
  const analysis = { schemaVersion: 1, providerId: 'partial-vimeo', evidenceSummary: { primaryPlayerFamily: 'vimeo' } };
  const observation = {
    schemaVersion: 1,
    authority: 'directly-observed-structured-evidence',
    trustedMatchingEvidence: { frameHost: 'vimeo.com', pathPrefix: '/event/', pathSuffix: '/embed', referrerHosts: ['partial.test'] },
    supportedCapabilities: ['enabled'],
    unsupportedRequirements: [],
    transportAutohide: { enabled: true },
  };
  try {
    writeBoundSource(join(root, 'source'), analysis, observation);
    const result = prepareHelperEvidence({ analysisPath: join(root, 'source'), outputRoot, now: fixedNow });
    assert.equal(result.evidence.transportAutohide, undefined);
    assert.deepEqual(result.provenance.unavailableFields.filter((field) => field.startsWith('transportAutohide.')), [
      'transportAutohide.idleMs', 'transportAutohide.interactionReveal', 'transportAutohide.oneOwnedTimer',
      'transportAutohide.pagehideCleanup', 'transportAutohide.selectors', 'transportAutohide.urlFreeDiagnostics',
    ]);
    assert.equal(createHelperRecommendation(result.evidence).recommendationCategory, 'insufficient-evidence');
    assert.equal(readdirSync(outputRoot).filter((name) => name.startsWith('.incomplete-')).length, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('malformed partial transport values still fail closed before output allocation', () => {
  const root = mkdtempSync(join(tmpdir(), 'helper-evidence-malformed-partial-'));
  const outputRoot = join(root, 'output');
  const analysis = { schemaVersion: 1, providerId: 'malformed-partial', evidenceSummary: { primaryPlayerFamily: 'vimeo' } };
  try {
    writeBoundSource(join(root, 'source'), analysis, {
      schemaVersion: 1,
      authority: 'directly-observed-structured-evidence',
      trustedMatchingEvidence: {},
      supportedCapabilities: [],
      unsupportedRequirements: [],
      transportAutohide: { selectors: 'not-an-array' },
    });
    assert.throws(() => prepareHelperEvidence({ analysisPath: join(root, 'source'), outputRoot }), /selectors/);
    assert.equal(existsSync(outputRoot), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('ABS maps characterized advanced requirements and remains an engine study', () => {
  const { evidence } = bridged('abs-tego');
  assert.deepEqual(evidence.transportAutohide.selectors, ['.rmp-control-bar', '.rmp-controls', '.rmp-module']);
  assert.equal(evidence.unsupportedRequirements.length, 7);
  const recommendation = createHelperRecommendation(evidence);
  assert.equal(recommendation.recommendationCategory, 'engine-extension-study');
  assert.equal(recommendation.policyProposal, null);
});

test('Island dual-player remains coherent provider-specific behavior without a direct transport contract', () => {
  const island = bridged('island-dual');
  const islandRecommendation = createHelperRecommendation(island.evidence);
  assert.equal(island.evidence.providerSpecificBehavior, true);
  assert.equal(island.evidence.conflictingEvidence, false);
  assert.deepEqual(island.provenance.conflictingFields, []);
  assert.equal(islandRecommendation.recommendationCategory, 'provider-specific-helper');
  assert.equal(islandRecommendation.policyProposal, null);
});

test('explicitly conflicting source remains insufficient', () => {
  assert.equal(createHelperRecommendation(bridged('conflicting').evidence).recommendationCategory, 'insufficient-evidence');
});

test('bridge output is deterministic, staged, and does not write beside fixtures', () => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'helper-evidence-bridge-'));
  try {
    const first = prepareHelperEvidence({ analysisPath: fixturePath('cvm-complete'), outputRoot, now: fixedNow });
    const second = prepareHelperEvidence({ analysisPath: fixturePath('cvm-complete'), outputRoot, now: fixedNow });
    assert.deepEqual(first.evidence, second.evidence);
    assert.deepEqual(JSON.parse(readFileSync(first.evidencePath, 'utf8')), first.evidence);
    assert.equal(existsSync(first.provenancePath), true);
    assert.equal(existsSync(join(fixturePath('cvm-complete'), 'helper-evidence.json')), false);
    assert.equal(existsSync(join(outputRoot, '.incomplete-2026-07-22T01-00-00-000Z')), false);
  } finally { rmSync(outputRoot, { recursive: true, force: true }); }
});

test('bound observations reject identity and analysis hash mismatches before output allocation', () => {
  const root = mkdtempSync(join(tmpdir(), 'helper-evidence-identity-'));
  const outputRoot = join(root, 'output');
  const analysis = { schemaVersion: 1, providerId: 'identity-test', targetId: 'identity-test', evidenceSummary: { primaryPlayerFamily: 'vimeo' } };
  const baseObservation = {
    schemaVersion: 1,
    authority: 'directly-observed-structured-evidence',
    trustedMatchingEvidence: {},
    supportedCapabilities: [],
    unsupportedRequirements: [],
  };
  try {
    for (const [name, overrides, expected] of [
      ['wrong-provider', { providerId: 'other-provider' }, /identity/],
      ['wrong-player', { playerFamily: 'native-html5' }, /identity/],
      ['wrong-target', { targetId: 'other-target' }, /target identity/],
      ['wrong-hash', { analysisSha256: '0'.repeat(64) }, /SHA-256/],
    ]) {
      const sourceDir = join(root, name);
      writeBoundSource(sourceDir, analysis, { ...baseObservation, ...overrides });
      assert.throws(() => prepareHelperEvidence({ analysisPath: sourceDir, outputRoot }), expected);
      assert.equal(existsSync(outputRoot), false);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('canonical Checkpoint 3D analysis output is accepted without copying unused raw fields', () => {
  const root = mkdtempSync(join(tmpdir(), 'helper-evidence-canonical-'));
  try {
    const reportPath = fileURLToPath(new URL('./fixtures/cvm-tv-evidence.json', import.meta.url));
    const canonicalAnalysis = createRecommendation(loadAndValidateReport(reportPath), { generatedAt: '2026-07-22T00:00:00.000Z' });
    const analysis = { ...canonicalAnalysis, unusedSourceUrl: 'https://unused.example.test/private.m3u8?token=hidden' };
    const observation = {
      schemaVersion: 1,
      authority: 'directly-observed-structured-evidence',
      trustedMatchingEvidence: { frameHost: 'vimeo.com', pathPrefix: '/event/', pathSuffix: '/embed', referrerHosts: ['cvm-tv.test'] },
      supportedCapabilities: ['enabled', 'idleMs', 'selectors', 'oneOwnedTimer', 'interactionReveal', 'pagehideCleanup', 'urlFreeDiagnostics'],
      unsupportedRequirements: [],
      transportAutohide: { enabled: true, idleMs: 3200, selectors: ['.vp-controls', '.vp-sidedock', '.vp-title'], oneOwnedTimer: true, interactionReveal: true, pagehideCleanup: true, urlFreeDiagnostics: true },
    };
    writeBoundSource(root, analysis, observation);
    const result = bridgeAnalysisToHelperEvidence(loadBridgeSource(root));
    assert.equal(result.evidence.providerId, canonicalAnalysis.providerId);
    assert.equal(result.evidence.targetId, canonicalAnalysis.targetId);
    assert.equal(result.evidence.playerFamily, canonicalAnalysis.evidenceSummary.primaryPlayerFamily);
    assert.equal(JSON.stringify(result).includes('unused.example.test'), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('default bridge output remains under the ignored Player Lab reports root', () => {
  const result = prepareHelperEvidence({ analysisPath: fixturePath('cvm-complete'), now: fixedNow });
  try {
    assert.equal(result.outputDir.startsWith(`${DEFAULT_HELPER_EVIDENCE_OUTPUT_ROOT}/`), true);
    assert.equal(result.outputDir.includes('/test/fixtures/'), false);
  } finally { rmSync(result.outputDir, { recursive: true, force: true }); }
});

test('malformed analysis fails before output promotion and proposal output restrictions remain enforced', () => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'helper-evidence-failure-'));
  try {
    assert.throws(() => prepareHelperEvidence({ analysisPath: fixturePath('malformed'), outputRoot }), /canonical primary player family/);
    assert.deepEqual(readdirSync(outputRoot), []);
    const forbidden = fileURLToPath(new URL('../../../app-gv/bridge-output', import.meta.url));
    assert.throws(() => prepareHelperEvidence({ analysisPath: fixturePath('cvm-complete'), outputRoot: forbidden }), /reports/);
  } finally { rmSync(outputRoot, { recursive: true, force: true }); }
});

test('bridge modules remain offline and do not import browser or network modules', () => {
  const text = readFileSync(new URL('../src/helper-evidence-bridge.mjs', import.meta.url), 'utf8');
  for (const forbidden of ['playwright', 'browser-runtime', 'profile-url', 'fetch(', 'http:', 'https:']) {
    assert.equal(text.includes(forbidden), false, `unexpected bridge dependency: ${forbidden}`);
  }
});
