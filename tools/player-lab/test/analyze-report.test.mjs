import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  analyzeReport,
  createRecommendation,
  loadAndValidateReport,
  normalizeEvidence,
  validateReportShape,
} from '../src/analyze-report.mjs';
import { createStagedAnalysisOutputDirectory } from '../src/analysis-output.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/cvm-tv-evidence.json', import.meta.url));

test('valid minimized CVM fixture is accepted and immutable', () => {
  const report = loadAndValidateReport(fixturePath);
  assert.equal(report.metadata.providerId, 'cvm-tv');
  assert.equal(Object.isFrozen(report), true);
  assert.throws(() => { report.metadata.providerId = 'other'; }, /read only|Cannot assign/);
});

test('report validation rejects missing required fields and non-zero interactions', () => {
  const report = fixture();
  delete report.frames;
  assert.throws(() => validateReportShape(report), /missing required field: frames/);

  const interacted = fixture();
  interacted.lifecycleEvidence.interactionCounters.click = 1;
  assert.throws(() => validateReportShape(interacted), /non-zero interaction/);
});

test('report validation rejects malformed required shapes', () => {
  for (const [mutate, pattern] of [
    [(report) => { report.metadata = []; }, /metadata must be a plain object/],
    [(report) => { report.metadata.targetId = '../bad'; }, /provider id|Unsafe/],
    [(report) => { report.metadata.profilerVersion = ''; }, /profilerVersion/],
    [(report) => { report.requestedUrl = ''; }, /requestedUrl/],
    [(report) => { report.finalUrl = null; }, /finalUrl/],
    [(report) => { report.playerClassification = []; }, /primaryFamily/],
    [(report) => { report.playerClassification.primaryFamily = ''; }, /primaryFamily/],
    [(report) => { report.playerClassification.secondaryFamilies = ['native-html5', 7]; }, /secondaryFamilies/],
    [(report) => { report.playerClassification.confidence = 'certain'; }, /confidence/],
    [(report) => { report.routeClassification = []; }, /route/],
    [(report) => { report.routeClassification.route = ''; }, /route/],
    [(report) => { delete report.lifecycleEvidence.interactionCounters.click; }, /exactly the required counters/],
    [(report) => { report.lifecycleEvidence.interactionCounters.extra = 0; }, /exactly the required counters/],
    [(report) => { report.lifecycleEvidence.interactionCounters.click = '0'; }, /finite numeric zero/],
    [(report) => { report.lifecycleEvidence.interactionCounters.click = Number.NaN; }, /finite numeric zero/],
    [(report) => { report.metadata.allowedMainFrameHosts = 'www.cvmtv.com'; }, /allowedMainFrameHosts/],
    [(report) => { report.metadata.allowedMainFrameHosts = []; }, /allowedMainFrameHosts/],
    [(report) => { report.metadata.allowedMainFrameHosts = ['*.cvmtv.com']; }, /wildcards/],
    [(report) => { report.metadata.allowedMainFrameHosts = ['www.cvmtv.com:443']; }, /ports/],
    [(report) => { report.metadata.allowedMainFrameHosts = ['https://www.cvmtv.com']; }, /ports, schemes, paths/],
    [(report) => { report.metadata.allowedMainFrameHosts = ['www.cvmtv.com/live']; }, /ports, schemes, paths/],
    [(report) => { report.metadata.allowedMainFrameHosts = ['www.cvmtv.com?x=1']; }, /ports, schemes, paths/],
    [(report) => { report.metadata.allowedMainFrameHosts = ['www.cvmtv.com#x']; }, /ports, schemes, paths/],
    [(report) => { report.metadata.allowedMainFrameHosts = ['CVMtv.com']; }, /lowercase/],
    [(report) => { report.metadata.allowedMainFrameHosts = ['www.cvmtv.com', 'www.cvmtv.com']; }, /duplicates/],
  ]) {
    const report = fixture();
    mutate(report);
    assert.throws(() => validateReportShape(report), pattern);
  }
});

test('report validation rejects unsafe URL and diagnostic content', () => {
  for (const mutate of [
    (report) => { report.requestedUrl = 'https://www.cvmtv.com/live?token=secret'; },
    (report) => { report.finalUrl = 'https://www.cvmtv.com/live#frag'; },
    (report) => { report.frames[0].url = 'https://user:pass@www.cvmtv.com/live'; },
    (report) => { report.warnings = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']; },
    (report) => { report.warnings = ['/Users/kenz/private/file']; },
    (report) => { report.warnings = ['cookie=value']; },
    (report) => { report.warnings = ['Authorization: Bearer abc123']; },
    (report) => { report.warnings = ['localStorage: secret']; },
  ]) {
    const report = fixture();
    mutate(report);
    const path = tempJson(report);
    try {
      assert.throws(() => loadAndValidateReport(path), /Unsafe|query string|fragment|credentials/);
    } finally {
      rmSync(path, { force: true });
    }
  }
});

test('evidence normalization deduplicates, sorts and excludes raw URLs', () => {
  const report = fixture();
  report.scripts.reverse();
  report.iframes.reverse();
  report.networkEvidence.reverse();
  const normalized = normalizeEvidence(report);
  assert.deepEqual(normalized.iframeHosts, ['player.vimeo.com', 'vimeo.com']);
  assert.deepEqual(normalized.scriptHosts, ['f.vimeocdn.com', 'www.cvmtv.com', 'www.gstatic.com']);
  assert.deepEqual(normalized.networkEvidenceKinds, ['document', 'hls-manifest', 'iframe-document', 'known-player-or-cdn-host', 'media-mime', 'player-script']);
  assert.deepEqual(normalized.providerHosts, ['www.cvmtv.com']);
  assert.equal(normalized.frameCount, 4);
  assert.equal(normalized.accessibleFrameCount, 3);
  assert.equal(normalized.inaccessibleFrameCount, 1);
  assert.equal(JSON.stringify(normalized).includes('https://'), false);
});

test('CVM recommendation selects generic embedded Vimeo with stable reasons', () => {
  const recommendation = createRecommendation(fixture(), { generatedAt: '2026-07-20T00:00:00.000Z' });
  assert.equal(recommendation.recommendation.category, 'generic-embedded-vimeo');
  assert.equal(recommendation.recommendation.recommendedLayer, 'browser-side embedded Vimeo handling');
  assert.equal(recommendation.recommendation.confidence, 'medium');
  assert.equal(recommendation.recommendation.score, 64);
  assert.deepEqual(recommendation.recommendation.supportingReasonCodes, [
    'PRIMARY_PLAYER_VIMEO_HIGH_CONFIDENCE',
    'EMBEDDED_VIMEO_FRAME_PRESENT',
    'BROWSER_FIRST_ROUTE',
    'ACCESSIBLE_MEDIA_ELEMENT_PRESENT',
    'CANDIDATE_PLAYER_CONTROLS_PRESENT',
    'ZERO_INTERACTION_CONFIRMED',
  ]);
  assert.deepEqual(recommendation.recommendation.limitingReasonCodes, [
    'MEDIA_SOURCE_NOT_ACCESSIBLE',
    'NO_SOURCE_REPLACEMENT_EVIDENCE',
    'PASSIVE_OBSERVATION_ONLY',
    'CHROMIUM_NOT_GECKOVIEW',
    'OPAQUE_FRAME_LIMITATION',
  ]);
  assert.ok(recommendation.recommendation.avoidLayers.includes('native media promotion without accessible media source'));
  assert.ok(recommendation.recommendation.avoidLayers.includes('direct HLS extraction'));
  assert.ok(recommendation.recommendation.requiredNextValidation.some((item) => /GeckoView/.test(item)));
  assert.ok(recommendation.recommendation.requiredNextValidation.some((item) => /Sony Bravia/.test(item)));
  assert.ok(recommendation.recommendation.requiredNextValidation.some((item) => /cvm-tv route/.test(item)));
  assert.equal(recommendation.evidenceSummary.providerWrapperEvidence.present, false);
  assert.equal(recommendation.recommendation.supportingReasonCodes.includes('PROVIDER_WRAPPER_EVIDENCE_PRESENT'), false);
});

test('provider and target identity do not determine category', () => {
  const cvm = createRecommendation(fixture(), { generatedAt: '2026-07-20T00:00:00.000Z' });
  const renamed = fixture();
  renamed.metadata.providerId = 'different-provider';
  renamed.metadata.targetId = 'different-target';
  const other = createRecommendation(renamed, { generatedAt: '2026-07-20T00:00:00.000Z' });
  assert.equal(cvm.recommendation.category, 'generic-embedded-vimeo');
  assert.equal(other.recommendation.category, 'generic-embedded-vimeo');
  assert.equal(cvm.recommendation.recommendedLayer, other.recommendation.recommendedLayer);
});

test('provider-specific Vimeo wrapper requires explicit wrapper evidence', () => {
  const report = fixture();
  report.scripts.push({ host: 'www.cvmtv.com', path: '/assets/provider-vimeo-wrapper.js' });
  const recommendation = createRecommendation(report, { generatedAt: '2026-07-20T00:00:00.000Z' });
  assert.equal(recommendation.recommendation.category, 'provider-specific-vimeo-wrapper');
  assert.equal(recommendation.recommendation.recommendedLayer, 'browser-side embedded Vimeo handling scoped to observed provider wrapper evidence');
  assert.equal(recommendation.evidenceSummary.providerWrapperEvidence.present, true);
  assert.ok(recommendation.recommendation.supportingReasonCodes.includes('PROVIDER_WRAPPER_EVIDENCE_PRESENT'));

  report.scripts.pop();
  const generic = createRecommendation(report, { generatedAt: '2026-07-20T00:00:00.000Z' });
  assert.equal(generic.recommendation.category, 'generic-embedded-vimeo');
});

test('provider wrapper evidence requires authoritative provider-owned origin', () => {
  const report = fixture();
  report.frames.push({ id: 'frame-consent', hostname: 'consent.example.test', url: 'https://consent.example.test/frame', domInspectionSucceeded: true });
  report.scripts.push({ host: 'consent.example.test', path: '/assets/player-wrapper.js' });
  report.candidateControls.push({
    frameId: 'frame-consent',
    matchedKinds: ['play'],
    className: 'provider-vimeo-wrapper',
    text: 'Play',
  });
  report.candidateControls.push({
    frameId: 'frame-2',
    matchedKinds: ['play'],
    className: 'provider-vimeo-wrapper',
    text: 'Play',
  });
  report.lifecycleEvidence['wrapper-test'] = [
    { event: 'provider-vimeo-wrapper' },
    { frameId: 'frame-2', event: 'provider-vimeo-wrapper' },
    { host: 'consent.example.test', event: 'provider-vimeo-wrapper' },
  ];
  let recommendation = createRecommendation(report, { generatedAt: '2026-07-20T00:00:00.000Z' });
  assert.equal(recommendation.evidenceSummary.providerWrapperEvidence.present, false);
  assert.equal(recommendation.recommendation.category, 'generic-embedded-vimeo');
  assert.deepEqual(recommendation.evidenceSummary.providerHosts, ['www.cvmtv.com']);

  report.lifecycleEvidence['wrapper-test'].push({ frameId: 'frame-1', event: 'provider-vimeo-wrapper' });
  recommendation = createRecommendation(report, { generatedAt: '2026-07-20T00:00:00.000Z' });
  assert.equal(recommendation.evidenceSummary.providerWrapperEvidence.present, true);
  assert.ok(recommendation.evidenceSummary.providerWrapperEvidence.signals.some((signal) => signal.kind === 'provider-lifecycle-wrapper-signal'));
  assert.equal(recommendation.recommendation.category, 'provider-specific-vimeo-wrapper');
});

test('provider-hosted wrapper script qualifies but generic live control does not', () => {
  const generic = fixture();
  generic.candidateControls.push({
    frameId: 'frame-1',
    matchedKinds: ['live'],
    className: 'provider-vimeo-wrapper',
    text: 'CVM LIVE',
  });
  assert.equal(createRecommendation(generic).evidenceSummary.providerWrapperEvidence.present, false);

  const scripted = fixture();
  scripted.scripts.push({ host: 'www.cvmtv.com', path: '/assets/provider-vimeo-wrapper.js' });
  const recommendation = createRecommendation(scripted);
  assert.equal(recommendation.evidenceSummary.providerWrapperEvidence.present, true);
  assert.ok(recommendation.evidenceSummary.providerWrapperEvidence.signals.some((signal) => signal.kind === 'provider-script-wrapper-signal'));
});

test('same evidence in different ordering gives identical recommendation apart from generatedAt', () => {
  const a = createRecommendation(fixture(), { generatedAt: '2026-07-20T00:00:00.000Z' });
  const report = fixture();
  report.scripts.reverse();
  report.iframes.reverse();
  report.networkEvidence.reverse();
  const b = createRecommendation(report, { generatedAt: '2026-07-20T00:00:00.000Z' });
  assert.deepEqual(a, b);
});

test('counterfactual native evidence can choose native media promotion', () => {
  const report = fixture();
  report.metadata.providerId = 'native-test';
  report.metadata.targetId = undefined;
  report.playerClassification = { primaryFamily: 'native-html5', secondaryFamilies: [], confidence: 'high' };
  report.routeClassification = { route: 'official-page browser-first', confidence: 'medium' };
  report.iframes = [];
  report.mediaObservations[0].src = 'https://media.example.test/live.m3u8';
  const recommendation = createRecommendation(report, { generatedAt: '2026-07-20T00:00:00.000Z' });
  assert.equal(recommendation.recommendation.category, 'native-media-promotion');
});

test('counterfactual generic Vimeo evidence selects generic embedded Vimeo', () => {
  const report = fixture();
  report.metadata.providerId = 'generic-tv';
  report.metadata.targetId = undefined;
  const recommendation = createRecommendation(report, { generatedAt: '2026-07-20T00:00:00.000Z' });
  assert.equal(recommendation.recommendation.category, 'generic-embedded-vimeo');
});

test('weak or no-player evidence produces bounded fallback category', () => {
  const weak = fixture();
  weak.playerClassification = { primaryFamily: 'unknown', secondaryFamilies: [], confidence: 'low' };
  weak.routeClassification = { route: 'unknown further-investigation', confidence: 'low' };
  weak.iframes = [];
  weak.mediaObservations = [];
  weak.candidateControls = [];
  assert.equal(createRecommendation(weak).recommendation.category, 'no-helper-needed');

  const contradictory = fixture();
  contradictory.playerClassification = { primaryFamily: 'unknown', secondaryFamilies: [], confidence: 'low' };
  contradictory.routeClassification = { route: 'embedded-player browser-first', confidence: 'low' };
  assert.equal(createRecommendation(contradictory).recommendation.category, 'insufficient-evidence');
});

test('analysis output writes canonical files and cleans staging on failures', () => {
  const root = mkdtempSync(join(tmpdir(), 'player-lab-analysis-'));
  try {
    const reportPath = join(root, 'report.json');
    writeFileSync(reportPath, JSON.stringify(fixture()), 'utf8');
    const result = analyzeReport({ reportPath, now: fixedNow });
    assert.equal(existsSync(result.jsonPath), true);
    assert.equal(existsSync(result.markdownPath), true);
    assert.deepEqual(JSON.parse(readFileSync(result.jsonPath, 'utf8')), result.recommendation);
    assert.equal(findEntries(root).some((entry) => entry.includes('.incomplete-')), false);
    const text = readFileSync(result.markdownPath, 'utf8') + readFileSync(result.jsonPath, 'utf8');
    assert.doesNotMatch(text, /https?:\/\/[^\s"]+[?#]|token=|\?token=|Bearer|cookie=|\/Users\/|Google Chrome\.app/);

    assert.throws(() => analyzeReport({
      reportPath,
      now: fixedNow,
      writeJson: () => {},
      writeMarkdown: (recommendation, { outputDir }) => {
        writeFileSync(join(outputDir, 'analysis.md'), '# ok\n');
      },
    }), /Missing required analysis artifact: analysis\.json/);
    assert.equal(findEntries(root).some((entry) => entry.includes('.incomplete-')), false);

    assert.throws(() => analyzeReport({
      reportPath,
      now: () => new Date('2026-07-20T01:00:00.000Z'),
      writeJson: () => { throw new Error('writer failed'); },
    }), /writer failed/);
    assert.equal(findEntries(root).some((entry) => entry.includes('.incomplete-')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('analysis output preserves completed directories and blocks invalid artifacts', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'player-lab-analysis-'));
  try {
    const completed = join(root, '2026-07-20T00-00-00-000Z');
    mkdirSync(completed);
    writeFileSync(join(completed, 'marker.txt'), 'existing');
    const allocated = createStagedAnalysisOutputDirectory({ outputRoot: root, now: fixedNow });
    assert.equal(existsSync(completed), true);
    assert.equal(readFileSync(join(completed, 'marker.txt'), 'utf8'), 'existing');
    assert.equal(existsSync(allocated.finalDir), false);
    assert.match(allocated.incompleteDir, /\.incomplete-2026-07-20T00-00-00-000Z-2$/);
    allocated.cleanup();
    assert.equal(findEntries(root).some((entry) => entry.includes('.incomplete-')), false);

    const missingMarkdown = createStagedAnalysisOutputDirectory({ outputRoot: root, now: () => new Date('2026-07-20T02:00:00.000Z') });
    writeFileSync(join(missingMarkdown.incompleteDir, 'analysis.json'), '{}\n');
    assert.throws(() => missingMarkdown.promote(), /Missing required analysis artifact: analysis\.md/);
    missingMarkdown.cleanup();

    const directoryArtifact = createStagedAnalysisOutputDirectory({ outputRoot: root, now: () => new Date('2026-07-20T03:00:00.000Z') });
    writeFileSync(join(directoryArtifact.incompleteDir, 'analysis.json'), '{}\n');
    mkdirSync(join(directoryArtifact.incompleteDir, 'analysis.md'));
    assert.throws(() => directoryArtifact.promote(), /Invalid required analysis artifact: analysis\.md/);
    directoryArtifact.cleanup();

    const symlinkArtifact = createStagedAnalysisOutputDirectory({ outputRoot: root, now: () => new Date('2026-07-20T04:00:00.000Z') });
    writeFileSync(join(symlinkArtifact.incompleteDir, 'analysis.json'), '{}\n');
    const target = join(symlinkArtifact.incompleteDir, 'target.md');
    writeFileSync(target, '# ok\n');
    try {
      symlinkSync(target, join(symlinkArtifact.incompleteDir, 'analysis.md'));
    } catch (error) {
      symlinkArtifact.cleanup();
      if (['EPERM', 'ENOSYS', 'EOPNOTSUPP'].includes(error.code)) {
        t.skip(`Symlinks unsupported: ${error.code}`);
        return;
      }
      throw error;
    }
    assert.throws(() => symlinkArtifact.promote(), /Invalid required analysis artifact: analysis\.md/);
    symlinkArtifact.cleanup();
    assert.equal(findEntries(root).some((entry) => entry.includes('.incomplete-')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('analysis rejects directory and symlink inputs', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'player-lab-analysis-'));
  try {
    assert.throws(() => loadAndValidateReport(root), /regular file/);
    const target = join(root, 'report.json');
    const link = join(root, 'link.json');
    writeFileSync(target, JSON.stringify(fixture()), 'utf8');
    try {
      symlinkSync(target, link);
    } catch (error) {
      if (['EPERM', 'ENOSYS', 'EOPNOTSUPP'].includes(error.code)) {
        t.skip(`Symlinks unsupported: ${error.code}`);
        return;
      }
      throw error;
    }
    assert.throws(() => loadAndValidateReport(link), /symbolic link/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture() {
  return JSON.parse(readFileSync(fixturePath, 'utf8'));
}

function tempJson(value) {
  const root = mkdtempSync(join(tmpdir(), 'player-lab-analysis-invalid-'));
  const path = join(root, 'report.json');
  writeFileSync(path, JSON.stringify(value), 'utf8');
  return path;
}

function fixedNow() {
  return new Date('2026-07-20T00:00:00.000Z');
}

function findEntries(root) {
  const results = [];
  const walk = (dir, prefix = '') => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const relative = prefix ? `${prefix}/${entry}` : entry;
      results.push(relative);
      if (statSync(full).isDirectory()) walk(full, relative);
    }
  };
  walk(root);
  return results.sort();
}
