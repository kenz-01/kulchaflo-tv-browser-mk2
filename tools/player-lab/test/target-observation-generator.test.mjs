import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { artifactIdForSource, createApprovedCvmPolicySource, deriveAndWriteTargetObservations, deriveTargetObservationCandidate, extractApprovedCvmPolicy, isolateCvmPolicyBlock } from '../src/target-observation-generator.mjs';
import { runDeriveTargetObservationsCli } from '../src/derive-target-observations-cli.mjs';
import { assembleHelperObservations, certifyHelperEngine } from '../src/helper-engine-contract.mjs';
import { runRecommendHelperCli } from '../src/recommend-helper-cli.mjs';
import { createHelperRecommendation, loadHelperEvidence } from '../src/helper-proposal.mjs';

const runtimePath = fileURLToPath(new URL('../../../app-gv/src/main/assets/gv_media_observer/content.js', import.meta.url));
const runtimeBytes = readFileSync(runtimePath);
const runtimeSource = runtimeBytes.toString('utf8');

const fixture = (name) => fileURLToPath(new URL(`./fixtures/target-observation-generator/cvm/${name}`, import.meta.url));
const matrixFixture = (caseName, name) => fileURLToPath(new URL(`./fixtures/target-observation-generator/${caseName}/${name}`, import.meta.url));
const basisFixture = (caseName) => fileURLToPath(new URL(`./fixtures/helper-evidence-bridge/${caseName}/helper-capability-observations.json`, import.meta.url));
function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); return path; }
function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function stream() { let text = ''; return { write(value) { text += value; }, get text() { return text; } }; }
function cvmSources(root, mutateRegistry = (entry) => entry) {
  const analysis = { schemaVersion: 1, providerId: 'cvm-tv', targetId: 'cvm-tv', evidenceSummary: { primaryPlayerFamily: 'vimeo' } };
  const analysisPath = writeJson(join(root, 'analysis.json'), analysis);
  const entry = mutateRegistry({ providerId: 'cvm-tv', targetId: 'cvm-tv', playerFamily: 'vimeo', trustedMatchingEvidence: { frameHost: 'vimeo.com', allowFrameSubdomains: true, pathPrefix: '/event/', pathSuffix: '/embed', referrerHosts: ['cvmtv.com', 'www.cvmtv.com'] }, transportAutohide: { enabled: true, idleMs: 3200, selectors: ['.vp-controls', '.vp-sidedock', '.vp-title'] }, unsupportedRequirements: [] });
  const targetRegistryPath = writeJson(join(root, 'registry.json'), { schemaVersion: 1, targets: { 'cvm-tv': entry } });
  return { analysisPath, targetRegistryPath, analysisSha256: createHash('sha256').update(readFileSync(analysisPath)).digest('hex') };
}
test('derives complete CVM target observations from bound profile and registered metadata', () => {
  const root = mkdtempSync(join(tmpdir(), 'target-observations-'));
  try {
    const result = deriveAndWriteTargetObservations({ analysisPath: fixture('analysis.json'), profilePath: fixture('profile.json'), targetRegistryPath: fixture('registry.json'), outputRoot: root, now: () => new Date('2026-07-22T10:00:00.000Z') });
    assert.equal(result.candidate.candidateStatus, 'ready-for-review');
    assert.equal(result.promoted.transportAutohide.idleMs, 3200);
    assert.equal(existsSync(join(result.outputDir, 'target-capability-observations.json')), true);
    assert.equal(JSON.parse(readFileSync(join(result.outputDir, 'target-observation-candidate.json'), 'utf8')).sourceBindings.length, 3);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('missing idle delay stays unavailable and engine-only profile claims are rejected', () => {
  const candidate = deriveTargetObservationCandidate({ analysisPath: fixture('analysis.json'), profilePath: fixture('profile.json') });
  assert.equal(candidate.candidate.candidateStatus, 'insufficient-evidence');
  assert.ok(candidate.candidate.unavailableFields.includes('transportAutohide.idleMs'));
});
test('approved CVM policy extraction retains source-derived capability and family normalization', () => {
  const policy = extractApprovedCvmPolicy(runtimeSource);
  assert.equal(policy.transportAutohide.idleMs, 3200);
  assert.deepEqual(policy.transportAutohide.selectors, ['.vp-controls', '.vp-sidedock', '.vp-title']);
  assert.equal(policy.sourceCapabilityKey, 'transportAutohide');
  assert.equal(policy.normalizedCapabilityType, 'transport-autohide');
  assert.equal(policy.capabilityNormalizationRule, 'transportAutohide-to-transport-autohide');
  assert.equal(policy.sourcePlayerFamily, 'embedded-vimeo');
  assert.equal(policy.normalizedPlayerFamily, 'vimeo');
  assert.equal(policy.familyNormalizationRule, 'embedded-vimeo-to-vimeo');
});
test('approved-policy binding retains normalized family, capability metadata, exact hash, and repository ID', () => {
  const approved = createApprovedCvmPolicySource(runtimeBytes);
  assert.equal(approved.binding.playerFamily, 'vimeo');
  assert.equal(approved.binding.sourcePlayerFamily, 'embedded-vimeo');
  assert.equal(approved.binding.normalizedPlayerFamily, 'vimeo');
  assert.equal(approved.binding.familyNormalizationRule, 'embedded-vimeo-to-vimeo');
  assert.equal(approved.binding.sourceCapabilityKey, 'transportAutohide');
  assert.equal(approved.binding.normalizedCapabilityType, 'transport-autohide');
  assert.equal(approved.binding.capabilityNormalizationRule, 'transportAutohide-to-transport-autohide');
  assert.equal(approved.binding.sha256, createHash('sha256').update(runtimeBytes).digest('hex'));
  assert.equal(approved.binding.artifactId, 'app-gv/src/main/assets/gv_media_observer/content.js');
});
test('neighbouring registry policy cannot contaminate isolated CVM extraction', () => {
  const neighbour = 'Object.freeze({ id: "other", providerId: "other", playerFamily: "other", match: Object.freeze({ frameHost: "other.test", allowFrameSubdomains: false, pathPrefix: "/x", pathSuffix: "/y", referrerHosts: Object.freeze(["other.test"]) }), capabilities: Object.freeze({ transportAutohide: Object.freeze({ enabled: false, idleMs: 900, idleClass: "other", selectors: Object.freeze([".other"]) }) }) }),\n    ';
  const source = runtimeSource.replace('    Object.freeze({\n      id: "cvm-tv-embedded-vimeo"', `    ${neighbour}Object.freeze({\n      id: "cvm-tv-embedded-vimeo"`);
  const policy = extractApprovedCvmPolicy(source);
  assert.equal(policy.providerId, 'cvm-tv');
  assert.equal(policy.transportAutohide.idleMs, 3200);
});

test('strict nested policy parser rejects every required duplicate, missing, changed, malformed, and unsafe mutation', () => {
  const cases = [
    ['duplicate id', '      id: "cvm-tv-embedded-vimeo",', '      id: "cvm-tv-embedded-vimeo",\n      id: "cvm-tv-embedded-vimeo",'],
    ['missing id', '      id: "cvm-tv-embedded-vimeo",\n', ''],
    ['changed id', 'id: "cvm-tv-embedded-vimeo"', 'id: "other-policy"'],
    ['duplicate providerId', '      providerId: "cvm-tv",', '      providerId: "cvm-tv",\n      providerId: "cvm-tv",'],
    ['changed providerId', 'providerId: "cvm-tv"', 'providerId: "other"'],
    ['duplicate playerFamily', '      playerFamily: "embedded-vimeo",', '      playerFamily: "embedded-vimeo",\n      playerFamily: "embedded-vimeo",'],
    ['changed playerFamily', 'playerFamily: "embedded-vimeo"', 'playerFamily: "other"'],
    ['duplicate match', '      match: Object.freeze({', '      match: Object.freeze({}),\n      match: Object.freeze({'],
    ['duplicate capabilities', '      capabilities: Object.freeze({', '      capabilities: Object.freeze({}),\n      capabilities: Object.freeze({'],
    ['duplicate frameHost', '        frameHost: "vimeo.com",', '        frameHost: "vimeo.com",\n        frameHost: "vimeo.com",'],
    ['unsafe frameHost', 'frameHost: "vimeo.com"', 'frameHost: "https://bad"'],
    ['duplicate pathPrefix', '        pathPrefix: "/event/",', '        pathPrefix: "/event/",\n        pathPrefix: "/event/",'],
    ['duplicate pathSuffix', '        pathSuffix: "/embed",', '        pathSuffix: "/embed",\n        pathSuffix: "/embed",'],
    ['duplicate referrerHosts', '        referrerHosts: Object.freeze(["cvmtv.com", "www.cvmtv.com"])', '        referrerHosts: Object.freeze(["cvmtv.com", "www.cvmtv.com"]),\n        referrerHosts: Object.freeze(["cvmtv.com"])'],
    ['unsafe path', 'pathPrefix: "/event/"', 'pathPrefix: "https://bad"'],
    ['unsafe referrer', '"cvmtv.com", "www.cvmtv.com"', '"https://bad", "www.cvmtv.com"'],
    ['renamed capability', 'transportAutohide: Object.freeze({', 'renamedTransport: Object.freeze({'],
    ['missing capability', '        transportAutohide: Object.freeze({', '        removedTransport: Object.freeze({'],
    ['duplicate transport capability', '        transportAutohide: Object.freeze({', '        transportAutohide: Object.freeze({}),\n        transportAutohide: Object.freeze({'],
    ['additional unsupported capability', '      capabilities: Object.freeze({', '      capabilities: Object.freeze({\n        otherCapability: Object.freeze({}),'],
    ['duplicate enabled', '          enabled: true,', '          enabled: true,\n          enabled: true,'],
    ['enabled false', '          enabled: true,', '          enabled: false,'],
    ['duplicate idleMs', '          idleMs: 3200,', '          idleMs: 3200,\n          idleMs: 3200,'],
    ['idleMs zero', 'idleMs: 3200', 'idleMs: 0'],
    ['idleMs below bound', 'idleMs: 3200', 'idleMs: 499'],
    ['idleMs above bound', 'idleMs: 3200', 'idleMs: 10001'],
    ['idleMs non-integer', 'idleMs: 3200', 'idleMs: 3200.5'],
    ['duplicate idleClass', '          idleClass: "kf-cvm-vimeo-transport-idle",', '          idleClass: "kf-cvm-vimeo-transport-idle",\n          idleClass: "duplicate",'],
    ['unsafe idleClass', 'idleClass: "kf-cvm-vimeo-transport-idle"', 'idleClass: "javascript:bad"'],
    ['duplicate selectors', '          selectors: Object.freeze([".vp-controls", ".vp-sidedock", ".vp-title"])', '          selectors: Object.freeze([".vp-controls", ".vp-sidedock", ".vp-title"]),\n          selectors: Object.freeze([".duplicate"])'],
    ['empty selectors', 'selectors: Object.freeze([".vp-controls", ".vp-sidedock", ".vp-title"])', 'selectors: Object.freeze([])'],
    ['unsafe selector', '".vp-controls", ".vp-sidedock", ".vp-title"', '"javascript:bad", ".vp-sidedock", ".vp-title"'],
  ];
  for (const [name, from, to] of cases) {
    const source = runtimeSource.replace(from, to);
    assert.notEqual(source, runtimeSource, `${name} mutation must change source`);
    if (to) assert.equal(source.includes(to), true, `${name} fragment must be present`);
    else assert.equal(source.includes(from), false, `${name} fragment must be absent`);
    assert.throws(() => extractApprovedCvmPolicy(source), undefined, name);
  }
});

test('duplicate policy-level id mutation is present twice inside the isolated CVM block', () => {
  const from = '      id: "cvm-tv-embedded-vimeo",';
  const to = `${from}\n${from}`;
  const source = runtimeSource.replace(from, to);
  assert.notEqual(source, runtimeSource);
  const block = isolateCvmPolicyBlock(source);
  assert.equal([...block.matchAll(/^\s*id\s*:/gm)].length, 2);
  assert.throws(() => extractApprovedCvmPolicy(source));
});

test('approved policy and registered metadata load independently and identical values combine provenance', () => {
  const root = mkdtempSync(join(tmpdir(), 'target-sources-'));
  try {
    const inputs = cvmSources(root);
    const { candidate } = deriveTargetObservationCandidate(inputs);
    assert.deepEqual(candidate.sourceBindings.map((source) => source.kind), ['validated-analysis', 'registered-target-metadata', 'existing-approved-policy']);
    const selectorSources = candidate.fieldProvenance.filter((item) => item.fieldPath === 'transportAutohide.selectors');
    assert.deepEqual(selectorSources.map((item) => item.authorityType), ['existing-approved-policy', 'registered-target-metadata']);
    assert.deepEqual(candidate.conflictingFields, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('registry disagreements with approved policy create exact selector, idle, and matching conflicts', () => {
  const cases = [
    ['transportAutohide.selectors', (entry) => { entry.transportAutohide.selectors = ['.different']; }],
    ['transportAutohide.idleMs', (entry) => { entry.transportAutohide.idleMs = 4100; }],
    ['trustedMatchingEvidence.frameHost', (entry) => { entry.trustedMatchingEvidence.frameHost = 'player.vimeo.com'; }],
    ['trustedMatchingEvidence.allowFrameSubdomains', (entry) => { entry.trustedMatchingEvidence.allowFrameSubdomains = false; }],
    ['trustedMatchingEvidence.pathPrefix', (entry) => { entry.trustedMatchingEvidence.pathPrefix = '/video/'; }],
    ['trustedMatchingEvidence.pathSuffix', (entry) => { entry.trustedMatchingEvidence.pathSuffix = '/player'; }],
    ['trustedMatchingEvidence.referrerHosts', (entry) => { entry.trustedMatchingEvidence.referrerHosts = ['other.test']; }],
  ];
  for (const [fieldPath, mutate] of cases) {
    const root = mkdtempSync(join(tmpdir(), 'target-conflict-'));
    try {
      const inputs = cvmSources(root, (entry) => { mutate(entry); return entry; });
      const { candidate, promoted } = deriveTargetObservationCandidate(inputs);
      assert.equal(candidate.candidateStatus, 'conflicting-evidence', fieldPath);
      assert.deepEqual(candidate.conflictingFields, [fieldPath], fieldPath);
      assert.equal(promoted, null, fieldPath);
      assert.equal(candidate.fieldProvenance.filter((item) => item.fieldPath === fieldPath && item.status === 'conflicting').length, 2, fieldPath);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('reviewer idle disagreement is retained as an exact conflict rather than overriding policy', () => {
  const root = mkdtempSync(join(tmpdir(), 'target-reviewer-conflict-'));
  try {
    const inputs = cvmSources(root);
    const reviewInputPath = writeJson(join(root, 'review.json'), { schemaVersion: 1, authority: 'bounded-reviewer-input', providerId: 'cvm-tv', targetId: 'cvm-tv', playerFamily: 'vimeo', analysisSha256: inputs.analysisSha256, transportAutohide: { idleMs: 4100 } });
    const { candidate } = deriveTargetObservationCandidate({ ...inputs, reviewInputPath });
    assert.deepEqual(candidate.conflictingFields, ['transportAutohide.idleMs']);
    const evidence = candidate.fieldProvenance.filter((item) => item.fieldPath === 'transportAutohide.idleMs');
    assert.ok(evidence.some((item) => item.authorityType === 'reviewer-supplied'));
    assert.ok(evidence.some((item) => item.authorityType === 'existing-approved-policy'));
    assert.equal(JSON.stringify(candidate).includes(root), false);
    assert.ok(candidate.sourceBindings.some((source) => source.artifactId.startsWith('external-registry-')));
    assert.ok(candidate.sourceBindings.some((source) => source.artifactId.startsWith('external-reviewer-input-')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('reviewer input schema rejects unknown or non-idle policy fields', () => {
  const cases = [
    { notes: 'free form' },
    { transportAutohide: { idleMs: 3200, enabled: true } },
    { transportAutohide: { idleMs: 3200, selectors: ['.vp-controls'] } },
  ];
  for (const extra of cases) {
    const root = mkdtempSync(join(tmpdir(), 'target-reviewer-schema-'));
    try {
      const inputs = cvmSources(root);
      const base = { schemaVersion: 1, authority: 'bounded-reviewer-input', providerId: 'cvm-tv', targetId: 'cvm-tv', playerFamily: 'vimeo', analysisSha256: inputs.analysisSha256, transportAutohide: { idleMs: 3200 } };
      const review = { ...base, ...extra };
      const reviewInputPath = writeJson(join(root, 'review.json'), review);
      assert.throws(() => deriveTargetObservationCandidate({ ...inputs, reviewInputPath }), /Reviewer input/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('fatal source identity and analysis bindings fail before output allocation', () => {
  for (const [name, mutate] of [
    ['provider', (entry) => { entry.providerId = 'other'; }],
    ['target', (entry) => { entry.targetId = 'other'; }],
    ['family', (entry) => { entry.playerFamily = 'native-html5'; }],
  ]) {
    const root = mkdtempSync(join(tmpdir(), `target-fatal-${name}-`));
    try {
      const inputs = cvmSources(root, (entry) => { mutate(entry); return entry; });
      const outputRoot = join(root, 'output');
      assert.throws(() => deriveAndWriteTargetObservations({ ...inputs, outputRoot }), /does not match analysis/);
      assert.equal(existsSync(outputRoot), false);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('unsupported requirements are additive with per-item provenance and empty arrays erase nothing', () => {
  const root = mkdtempSync(join(tmpdir(), 'target-requirements-'));
  try {
    const inputs = cvmSources(root, (entry) => { entry.unsupportedRequirements = ['readiness-predicate']; return entry; });
    const profilePath = writeJson(join(root, 'profile.json'), { schemaVersion: 1, authority: 'structured-profile-target-evidence', providerId: 'cvm-tv', targetId: 'cvm-tv', playerFamily: 'vimeo', analysisSha256: inputs.analysisSha256, unsupportedRequirements: ['retry-delay-and-limit'], transportAutohide: {} });
    const first = deriveTargetObservationCandidate({ ...inputs, profilePath }).candidate;
    assert.deepEqual(first.targetObservationCandidate.unsupportedRequirements, ['readiness-predicate', 'retry-delay-and-limit']);
    assert.equal(first.fieldProvenance.filter((item) => item.fieldPath.startsWith('unsupportedRequirements.')).length, 2);
    writeJson(profilePath, { schemaVersion: 1, authority: 'structured-profile-target-evidence', providerId: 'cvm-tv', targetId: 'cvm-tv', playerFamily: 'vimeo', analysisSha256: inputs.analysisSha256, unsupportedRequirements: [], transportAutohide: {} });
    assert.deepEqual(deriveTargetObservationCandidate({ ...inputs, profilePath }).candidate.targetObservationCandidate.unsupportedRequirements, ['readiness-predicate']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('source artifact IDs are repository-relative or deterministic kind-specific external IDs', () => {
  const repositoryFixture = fixture('profile.json');
  assert.match(artifactIdForSource(repositoryFixture, 'profile'), /^tools\/player-lab\//);
  assert.equal(artifactIdForSource(runtimePath, 'profile'), 'app-gv/src/main/assets/gv_media_observer/content.js');
  const root = mkdtempSync(join(tmpdir(), 'target-artifact-ids-'));
  try {
    const bytes = Buffer.from('{}\n');
    for (const [kind, prefix] of [['profile', 'external-profile-'], ['reviewer-input', 'external-reviewer-input-'], ['registry', 'external-registry-'], ['characterization', 'external-characterization-']]) {
      const path = join(root, `${kind}.json`); writeFileSync(path, bytes);
      const id = artifactIdForSource(path, kind, bytes);
      assert.match(id, new RegExp(`^${prefix}`));
      assert.equal(id.includes(root), false);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('canonical report uses the real validator, cannot synthesize selectors, and cannot promote without represented binding', () => {
  const root = mkdtempSync(join(tmpdir(), 'target-canonical-profile-'));
  try {
    const inputs = cvmSources(root);
    const profilePath = fileURLToPath(new URL('./fixtures/cvm-tv-evidence.json', import.meta.url));
    const { candidate, promoted } = deriveTargetObservationCandidate({ analysisPath: inputs.analysisPath, profilePath });
    assert.equal(candidate.sourceBindings.some((source) => source.kind === 'canonical-profile-report'), true);
    assert.ok(candidate.unavailableFields.includes('profileAnalysisBinding'));
    assert.equal(candidate.fieldProvenance.some((item) => item.authorityType === 'canonical-profile-observation' && item.fieldPath === 'transportAutohide.selectors'), false);
    assert.equal(candidate.candidateStatus, 'insufficient-evidence');
    assert.equal(promoted, null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('styleId is validated as source-only metadata and excluded from candidate and promoted observations', () => {
  const approved = createApprovedCvmPolicySource(runtimeBytes);
  assert.equal(approved.normalized.sourceContractMetadata.styleId, 'kf-cvm-vimeo-transport-autohide-style');
  const root = mkdtempSync(join(tmpdir(), 'target-style-id-'));
  try {
    const result = deriveTargetObservationCandidate(cvmSources(root));
    assert.equal(JSON.stringify(result.candidate).includes('styleId'), false);
    assert.equal(JSON.stringify(result.promoted).includes('styleId'), false);
    assert.throws(() => extractApprovedCvmPolicy(runtimeSource.replace('styleId: "kf-cvm-vimeo-transport-autohide-style"', 'styleId: "javascript:bad"')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('shared staging retries fixed timestamps, rejects symlink roots, and leaves no incomplete residue', () => {
  const root = mkdtempSync(join(tmpdir(), 'target-shared-stage-'));
  const now = () => new Date('2026-07-22T10:00:00.000Z');
  try {
    const inputs = cvmSources(root);
    const outputRoot = join(root, 'output');
    const first = deriveAndWriteTargetObservations({ ...inputs, outputRoot, now });
    const second = deriveAndWriteTargetObservations({ ...inputs, outputRoot, now });
    assert.notEqual(first.outputDir, second.outputDir);
    assert.equal(readdirSync(outputRoot).some((name) => name.startsWith('.incomplete-')), false);
    const linked = join(root, 'linked'); symlinkSync(outputRoot, linked);
    assert.throws(() => deriveAndWriteTargetObservations({ ...inputs, outputRoot: linked, now }), /regular directory/);
    assert.equal(readdirSync(outputRoot).some((name) => name.startsWith('.incomplete-')), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('complete 4G-B candidate matrix preserves characterization and bounded review outcomes', () => {
  const cvm = deriveTargetObservationCandidate({ analysisPath: matrixFixture('cvm-approved', 'analysis.json') });
  assert.equal(cvm.candidate.candidateStatus, 'ready-for-review'); assert.ok(cvm.promoted);
  const agreeing = deriveTargetObservationCandidate({ analysisPath: matrixFixture('cvm-approved', 'analysis.json'), targetRegistryPath: matrixFixture('cvm-approved', 'registry.json') });
  assert.equal(agreeing.candidate.candidateStatus, 'ready-for-review');
  assert.deepEqual(agreeing.candidate.sourceBindings.map((item) => item.kind), ['validated-analysis', 'registered-target-metadata', 'existing-approved-policy']);
  const reviewerAgreement = deriveTargetObservationCandidate({ analysisPath: matrixFixture('cvm-approved', 'analysis.json'), reviewInputPath: matrixFixture('cvm-approved', 'reviewer.json') });
  assert.equal(reviewerAgreement.candidate.candidateStatus, 'ready-for-review');
  assert.ok(reviewerAgreement.candidate.fieldProvenance.some((item) => item.fieldPath === 'transportAutohide.idleMs' && item.authorityType === 'reviewer-supplied'));

  const missingIdle = deriveTargetObservationCandidate({ analysisPath: matrixFixture('vimeo-reviewer', 'analysis.json'), targetRegistryPath: matrixFixture('vimeo-reviewer', 'registry.json') });
  assert.equal(missingIdle.candidate.candidateStatus, 'insufficient-evidence'); assert.equal(missingIdle.promoted, null);
  assert.ok(missingIdle.candidate.unavailableFields.includes('transportAutohide.idleMs'));
  assert.match(missingIdle.candidate.fieldProvenance.find((item) => item.fieldPath === 'transportAutohide.idleMs').reason, /manually required/);
  const reviewerComplete = deriveTargetObservationCandidate({ analysisPath: matrixFixture('vimeo-reviewer', 'analysis.json'), targetRegistryPath: matrixFixture('vimeo-reviewer', 'registry.json'), reviewInputPath: matrixFixture('vimeo-reviewer', 'reviewer.json') });
  assert.equal(reviewerComplete.candidate.candidateStatus, 'ready-for-review'); assert.ok(reviewerComplete.promoted);

  const partial = deriveTargetObservationCandidate({ analysisPath: matrixFixture('partial-vimeo', 'analysis.json'), profilePath: matrixFixture('partial-vimeo', 'profile.json') });
  assert.equal(partial.candidate.candidateStatus, 'insufficient-evidence'); assert.equal(partial.promoted, null);
  assert.ok(partial.candidate.unavailableFields.includes('transportAutohide.selectors'));
  assert.ok(partial.candidate.unavailableFields.includes('transportAutohide.idleMs'));
  const mismatch = deriveTargetObservationCandidate({ analysisPath: matrixFixture('selector-mismatch', 'analysis.json'), profilePath: matrixFixture('selector-mismatch', 'profile.json'), targetRegistryPath: matrixFixture('selector-mismatch', 'registry.json') });
  assert.equal(mismatch.candidate.candidateStatus, 'conflicting-evidence'); assert.deepEqual(mismatch.candidate.conflictingFields, ['transportAutohide.selectors']); assert.equal(mismatch.promoted, null);
  assert.ok(mismatch.candidate.fieldProvenance.some((item) => item.fieldPath === 'transportAutohide.selectors' && item.authorityType === 'test-support-profile-observation' && item.normalizedValue[0] === '.observed-safe-controls'));

  const abs = deriveTargetObservationCandidate({ analysisPath: matrixFixture('abs-tego', 'analysis.json'), characterizationPath: matrixFixture('abs-tego', 'characterization.json') });
  assert.equal(abs.candidate.candidateStatus, 'engine-extension-study'); assert.equal(abs.promoted, null);
  assert.deepEqual(abs.candidate.targetObservationCandidate.unsupportedRequirements, ['external-reveal-bridge', 'initial-settle-delay', 'inline-style-visibility', 'interaction-throttle', 'readiness-predicate', 'retry-delay-and-limit', 'shared-provider-state']);
  assert.equal(abs.candidate.targetObservationCandidate.transportAutohide.enabled, true);
  const island = deriveTargetObservationCandidate({ analysisPath: matrixFixture('island-dual', 'analysis.json'), characterizationPath: matrixFixture('island-dual', 'characterization.json') });
  assert.equal(island.candidate.candidateStatus, 'provider-specific'); assert.equal(island.promoted, null);
  assert.equal(island.candidate.targetObservationCandidate.providerSpecificBehavior, true);

  assert.equal(createHelperRecommendation(loadHelperEvidence(fileURLToPath(new URL('./fixtures/helper-proposals/abs-tego/', import.meta.url)))).recommendationCategory, 'engine-extension-study');
  assert.equal(createHelperRecommendation(loadHelperEvidence(fileURLToPath(new URL('./fixtures/helper-proposals/island-dual-player/', import.meta.url)))).recommendationCategory, 'provider-specific-helper');
});

test('characterization adapters bind exact validated ABS and Island basis artifacts with independent provenance', () => {
  for (const [caseName, basisCase, providerId, playerFamily, expectedSha] of [
    ['abs-tego', 'abs-tego', 'abs-channel-10', 'tego', '36d51dc995a397edd0c7e029f0a904a2f4ffedbdcc87de70e29a757dd18faab9'],
    ['island-dual', 'island-dual', 'island-tv', 'vimeo', '3e7dcb8e5c1aae97ee176b63798dee8e67a02aa5e581d9e06949bdebb52ba1ed'],
  ]) {
    const characterizationPath = matrixFixture(caseName, 'characterization.json');
    const basisPath = basisFixture(basisCase);
    const result = deriveTargetObservationCandidate({ analysisPath: matrixFixture(caseName, 'analysis.json'), characterizationPath });
    const adapter = result.candidate.sourceBindings.find((item) => item.kind === 'structured-characterization');
    const basis = result.candidate.sourceBindings.find((item) => item.kind === 'characterization-basis');
    assert.equal(adapter.sha256, digest(readFileSync(characterizationPath)));
    assert.equal(adapter.basisSha256, expectedSha);
    assert.deepEqual(basis, {
      kind: 'characterization-basis',
      authorityType: 'validated-characterization-basis',
      artifactId: `tools/player-lab/test/fixtures/helper-evidence-bridge/${basisCase}/helper-capability-observations.json`,
      sha256: expectedSha,
      schemaVersion: 1,
      providerId,
      playerFamily,
      analysisSha256: JSON.parse(readFileSync(basisPath, 'utf8')).analysisSha256,
    });
    assert.equal(basis.sha256, digest(readFileSync(basisPath)));
    const identityProvenance = result.candidate.fieldProvenance.filter((item) => item.fieldPath === 'providerId');
    assert.ok(identityProvenance.some((item) => item.authorityType === 'structured-characterization' && item.sourceArtifactId === adapter.artifactId));
    assert.ok(identityProvenance.some((item) => item.authorityType === 'validated-characterization-basis' && item.sourceArtifactId === basis.artifactId && item.sourceField === 'providerId'));
  }
});

test('characterization basis path, hash, file type, JSON, identity, structure, and privacy failures allocate no output root', async () => {
  const harnessRoot = mkdtempSync(join(tmpdir(), 'target-isolated-repository-'));
  try {
    const deriveAndWrite = await createIsolatedBasisHarness(harnessRoot);
    const adapterFailures = [
      ['stale basisSha256', 'abs-tego', (adapter) => { adapter.basisSha256 = '0'.repeat(64); }, /basis SHA-256/],
      ['wrong allowlisted path', 'abs-tego', (adapter) => { adapter.basisArtifact = 'tools/player-lab/test/fixtures/helper-evidence-bridge/island-dual/helper-capability-observations.json'; }, /not allowlisted/],
      ['traversal path', 'abs-tego', (adapter) => { adapter.basisArtifact = '../helper-capability-observations.json'; }, /traversal/],
      ['absolute path', 'abs-tego', (adapter) => { adapter.basisArtifact = '/tmp/helper-capability-observations.json'; }, /repository-relative/],
      ['adapter matching disagreement', 'abs-tego', (adapter) => { adapter.trustedMatchingEvidence.frameHost = 'other.test'; }, /trustedMatchingEvidence.frameHost/],
      ['adapter transport disagreement', 'abs-tego', (adapter) => { adapter.transportAutohide.idleMs = 1900; }, /transportAutohide.idleMs/],
    ];
    for (const [name, caseName, mutateAdapter, pattern] of adapterFailures) assertCharacterizationFailure({ name, caseName, mutateAdapter, pattern, harnessRoot, deriveAndWrite });

    const basisFailures = [
      ['changed basis bytes', 'abs-tego', (bytes) => Buffer.concat([bytes, Buffer.from(' ')]), false, /basis SHA-256/],
      ['malformed basis JSON', 'abs-tego', () => Buffer.from('{ malformed\n'), true, /Malformed Characterization basis/],
      ['basis provider mismatch', 'abs-tego', (bytes) => mutateJsonBytes(bytes, (basis) => { basis.providerId = 'other-provider'; }), true, /do not match analysis identity/],
      ['basis player-family mismatch', 'abs-tego', (bytes) => mutateJsonBytes(bytes, (basis) => { basis.playerFamily = 'vimeo'; }), true, /do not match analysis identity/],
      ['ABS requirement disagreement', 'abs-tego', (bytes) => mutateJsonBytes(bytes, (basis) => { basis.unsupportedRequirements.pop(); }), true, /unsupportedRequirements|seven requirements/],
      ['Island provider-specific disagreement', 'island-dual', (bytes) => mutateJsonBytes(bytes, (basis) => { basis.providerSpecificBehavior = false; }), true, /providerSpecificBehavior|provider-specific/],
      ['Island structured evidence disagreement', 'island-dual', (bytes) => mutateJsonBytes(bytes, (basis) => { basis.sourceEvidenceReferences = ['different-observation']; }), true, /dual-player behavior/],
      ['basis raw URL privacy', 'island-dual', (bytes) => mutateJsonBytes(bytes, (basis) => { basis.sourceEvidenceReferences = ['https://example.test/private']; }), true, /source references|Unsafe/],
      ['basis unrestricted text', 'island-dual', (bytes) => mutateJsonBytes(bytes, (basis) => { basis.unrestrictedText = 'anything'; }), true, /unknown field/],
    ];
    for (const [name, caseName, mutateBytes, refreshHash, pattern] of basisFailures) assertCharacterizationFailure({ name, caseName, mutateBytes, refreshHash, pattern, harnessRoot, deriveAndWrite });

    assertCharacterizationSymlinkFailure({ harnessRoot, deriveAndWrite });
    assertCharacterizationIntermediateSymlinkEscape({ harnessRoot, deriveAndWrite });
  } finally {
    rmSync(harnessRoot, { recursive: true, force: true });
  }
});

test('registered target source bindings use complete-file hashes and selected-entry identity without nulls', () => {
  for (const [caseName, providerId, targetId] of [
    ['cvm-approved', 'cvm-tv', 'cvm-tv'],
    ['vimeo-reviewer', 'reviewer-vimeo', 'reviewer-vimeo'],
  ]) {
    const registryPath = matrixFixture(caseName, 'registry.json');
    const result = deriveTargetObservationCandidate({ analysisPath: matrixFixture(caseName, 'analysis.json'), targetRegistryPath: registryPath });
    const binding = result.candidate.sourceBindings.find((item) => item.kind === 'registered-target-metadata');
    assert.deepEqual(binding, {
      kind: 'registered-target-metadata',
      authorityType: 'registered-target-metadata',
      artifactId: `tools/player-lab/test/fixtures/target-observation-generator/${caseName}/registry.json`,
      sha256: digest(readFileSync(registryPath)),
      schemaVersion: 1,
      providerId,
      targetId,
      playerFamily: 'vimeo',
    });
    assert.equal(Object.values(binding).includes(null), false);
  }
});

test('engine and source-contract fields remain absent until compatible 4F assembly', () => {
  const forbidden = ['oneOwnedTimer', 'interactionReveal', 'pagehideCleanup', 'urlFreeDiagnostics', 'styleId', 'idleClass', 'sourceCapabilityKey', 'normalizedCapabilityType', 'capabilityNormalizationRule'];
  for (const options of [
    { analysisPath: matrixFixture('cvm-approved', 'analysis.json') },
    { analysisPath: matrixFixture('vimeo-reviewer', 'analysis.json'), targetRegistryPath: matrixFixture('vimeo-reviewer', 'registry.json'), reviewInputPath: matrixFixture('vimeo-reviewer', 'reviewer.json') },
    { analysisPath: matrixFixture('abs-tego', 'analysis.json'), characterizationPath: matrixFixture('abs-tego', 'characterization.json') },
  ]) {
    const result = deriveTargetObservationCandidate(options);
    const text = JSON.stringify({ candidate: result.candidate, promoted: result.promoted });
    for (const field of forbidden) assert.equal(text.includes(field), false, field);
  }
});

test('complete CVM and reviewer-completed Vimeo run through derive, certify, assemble, and recommend', async () => {
  const root = mkdtempSync(join(tmpdir(), 'target-end-to-end-'));
  try {
    for (const [name, inputs, expectedGuarantees] of [
      ['cvm', { analysisPath: matrixFixture('cvm-approved', 'analysis.json') }, true],
      ['cvm-registry', { analysisPath: matrixFixture('cvm-approved', 'analysis.json'), targetRegistryPath: matrixFixture('cvm-approved', 'registry.json') }, true],
      ['reviewer-vimeo', { analysisPath: matrixFixture('vimeo-reviewer', 'analysis.json'), targetRegistryPath: matrixFixture('vimeo-reviewer', 'registry.json'), reviewInputPath: matrixFixture('vimeo-reviewer', 'reviewer.json') }, true],
    ]) {
      const outputRoot = join(root, name);
      const derived = deriveAndWriteTargetObservations({ ...inputs, outputRoot: join(outputRoot, 'derived') });
      const targetPath = join(derived.outputDir, 'target-capability-observations.json');
      const certified = certifyHelperEngine({ outputRoot: join(outputRoot, 'certified') });
      const certificationPath = join(certified.outputDir, 'engine-certification.json');
      const assembled = assembleHelperObservations({ analysisPath: inputs.analysisPath, targetObservationsPath: targetPath, engineCertificationPath: certificationPath, outputRoot: join(outputRoot, 'assembled') });
      for (const guarantee of ['oneOwnedTimer', 'interactionReveal', 'pagehideCleanup', 'urlFreeDiagnostics']) assert.equal(assembled.observations.transportAutohide[guarantee], expectedGuarantees);
      const stdout = stream(); const stderr = stream();
      const analysisDirectory = inputs.analysisPath.slice(0, inputs.analysisPath.lastIndexOf('/'));
      assert.equal(await runRecommendHelperCli(['--analysis', analysisDirectory, '--target-observations', targetPath, '--engine-certification', certificationPath, '--output-dir', join(outputRoot, 'recommended')], { stdout, stderr }), 0, stderr.text);
      assert.equal(stderr.text, '');
      const finalDir = stdout.text.trim();
      const proposal = JSON.parse(readFileSync(join(finalDir, 'helper-proposal.json'), 'utf8'));
      assert.equal(proposal.recommendationCategory, 'direct-registry-policy');
      assert.equal(existsSync(join(finalDir, 'helper-observation-assembly-provenance.json')), true);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('full invalid binding, privacy, schema, and source-artifact matrix fails before allocation', () => {
  const cases = [
    ['wrong provider', 'registry', (value) => { value.targets['matrix-vimeo'].providerId = 'other'; }],
    ['wrong target', 'registry', (value) => { value.targets['matrix-vimeo'].targetId = 'other'; }],
    ['wrong player family', 'registry', (value) => { value.targets['matrix-vimeo'].playerFamily = 'native-html5'; }],
    ['stale analysis hash', 'profile', (value) => { value.analysisSha256 = '0'.repeat(64); }],
    ['wrong profile report binding', 'profile', (value) => { value.targetId = 'other'; }],
    ['unsafe frame host', 'registry', (value) => { value.targets['matrix-vimeo'].trustedMatchingEvidence.frameHost = 'https://bad.test'; }],
    ['unsafe path prefix', 'registry', (value) => { value.targets['matrix-vimeo'].trustedMatchingEvidence.pathPrefix = 'https://bad.test/private'; }],
    ['unsafe path suffix', 'registry', (value) => { value.targets['matrix-vimeo'].trustedMatchingEvidence.pathSuffix = '/embed?token=secret'; }],
    ['unsafe referrer', 'registry', (value) => { value.targets['matrix-vimeo'].trustedMatchingEvidence.referrerHosts = ['https://bad.test']; }],
    ['raw HTTP URL', 'profile', (value) => { value.sourceEvidenceReferences = ['http://example.test/private']; }],
    ['raw HTTPS URL', 'profile', (value) => { value.sourceEvidenceReferences = ['https://example.test/private']; }],
    ['macOS path', 'profile', (value) => { value.sourceEvidenceReferences = ['/Users/example/private']; }],
    ['Linux path', 'profile', (value) => { value.sourceEvidenceReferences = ['/home/example/private']; }],
    ['Windows path', 'profile', (value) => { value.sourceEvidenceReferences = ['C:\\Users\\example\\private']; }],
    ['Authorization bearer', 'profile', (value) => { value.sourceEvidenceReferences = ['Authorization: Bearer secret']; }],
    ['token credential', 'profile', (value) => { value.sourceEvidenceReferences = ['access-token-secret-abcdef']; }],
    ['email address', 'profile', (value) => { value.sourceEvidenceReferences = ['person@example.test']; }],
    ['unsafe selector', 'profile', (value) => { value.transportAutohide.selectors = ['javascript:bad']; }],
    ['engine-only claim', 'profile', (value) => { value.transportAutohide.oneOwnedTimer = true; }],
    ['unknown requirement', 'profile', (value) => { value.unsupportedRequirements = ['unknown-requirement']; }],
    ['unknown source field', 'profile', (value) => { value.unboundedNotes = 'anything'; }],
  ];
  for (const [name, sourceKind, mutate] of cases) {
    const root = mkdtempSync(join(tmpdir(), 'target-invalid-'));
    try {
      const analysisPath = writeJson(join(root, 'analysis.json'), { schemaVersion: 1, providerId: 'matrix-vimeo', targetId: 'matrix-vimeo', evidenceSummary: { primaryPlayerFamily: 'vimeo' } });
      const analysisSha256 = createHash('sha256').update(readFileSync(analysisPath)).digest('hex');
      const profile = { schemaVersion: 1, authority: 'structured-profile-target-evidence', providerId: 'matrix-vimeo', targetId: 'matrix-vimeo', playerFamily: 'vimeo', analysisSha256, transportAutohide: { enabled: true, selectors: ['.vp-controls'] }, unsupportedRequirements: [] };
      const registry = { schemaVersion: 1, targets: { 'matrix-vimeo': { providerId: 'matrix-vimeo', targetId: 'matrix-vimeo', playerFamily: 'vimeo', trustedMatchingEvidence: { frameHost: 'vimeo.com', allowFrameSubdomains: false, pathPrefix: '/event/', pathSuffix: '/embed', referrerHosts: ['matrix-vimeo.test'] }, transportAutohide: { idleMs: 3200 }, unsupportedRequirements: [] } } };
      mutate(sourceKind === 'profile' ? profile : registry);
      const profilePath = writeJson(join(root, 'profile.json'), profile); const targetRegistryPath = writeJson(join(root, 'registry.json'), registry);
      const outputRoot = join(root, 'output');
      assert.throws(() => deriveAndWriteTargetObservations({ analysisPath, profilePath, targetRegistryPath, outputRoot }), undefined, name);
      assert.equal(existsSync(outputRoot), false, name);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }

  for (const name of ['wrong characterization binding', 'malformed JSON', 'symlink source']) {
    const root = mkdtempSync(join(tmpdir(), 'target-invalid-special-'));
    try {
      const outputRoot = join(root, 'output');
      if (name === 'wrong characterization binding') {
        const analysisPath = matrixFixture('abs-tego', 'analysis.json');
        const value = JSON.parse(readFileSync(matrixFixture('abs-tego', 'characterization.json'), 'utf8')); value.analysisSha256 = '0'.repeat(64);
        const characterizationPath = writeJson(join(root, 'characterization.json'), value);
        assert.throws(() => deriveAndWriteTargetObservations({ analysisPath, characterizationPath, outputRoot }), /Characterization analysis SHA-256/);
      } else if (name === 'malformed JSON') {
        const profilePath = join(root, 'profile.json'); writeFileSync(profilePath, '{ malformed');
        assert.throws(() => deriveAndWriteTargetObservations({ analysisPath: fixture('analysis.json'), profilePath, outputRoot }), /Malformed Profile/);
      } else {
        const profilePath = join(root, 'profile.json'); symlinkSync(fixture('profile.json'), profilePath);
        assert.throws(() => deriveAndWriteTargetObservations({ analysisPath: fixture('analysis.json'), profilePath, outputRoot }), /regular file/);
      }
      assert.equal(existsSync(outputRoot), false, name);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('derive CLI covers strict arguments, repository and external sources, output policy, and import isolation', async () => {
  for (const [argv, expected] of [
    [['--help'], 0], [[], 1], [['--analysis'], 1], [['--analysis', 'a', '--analysis', 'b'], 1], [['--unknown'], 1],
  ]) {
    const stdout = stream(); const stderr = stream();
    assert.equal(await runDeriveTargetObservationsCli(argv, { stdout, stderr }), expected);
  }
  const root = mkdtempSync(join(tmpdir(), 'target-cli-'));
  try {
    const runs = [
      ['repository', matrixFixture('cvm-approved', 'analysis.json').replace(/\/analysis\.json$/, ''), []],
      ['external-profile', matrixFixture('partial-vimeo', 'analysis.json').replace(/\/analysis\.json$/, ''), ['--profile', copyTo(root, matrixFixture('partial-vimeo', 'profile.json'), 'external-profile.json')]],
      ['external-reviewer', matrixFixture('vimeo-reviewer', 'analysis.json').replace(/\/analysis\.json$/, ''), ['--target-registry', matrixFixture('vimeo-reviewer', 'registry.json'), '--review-input', copyTo(root, matrixFixture('vimeo-reviewer', 'reviewer.json'), 'external-reviewer.json')]],
      ['external-characterization', matrixFixture('abs-tego', 'analysis.json').replace(/\/analysis\.json$/, ''), ['--characterization', copyTo(root, matrixFixture('abs-tego', 'characterization.json'), 'external-characterization.json')]],
    ];
    for (const [name, analysisDir, extra] of runs) {
      const stdout = stream(); const stderr = stream(); const outputRoot = join(root, `output-${name}`);
      assert.equal(await runDeriveTargetObservationsCli(['--analysis', analysisDir, ...extra, '--output-dir', outputRoot], { stdout, stderr }), 0, `${name}: ${stderr.text}`);
      assert.equal(stderr.text, ''); assert.equal(stdout.text.trim().split('\n').length, 1); assert.ok(stdout.text.trim().startsWith(outputRoot));
    }
    for (const forbidden of [fileURLToPath(new URL('../../../app/forbidden-4g-output', import.meta.url)), fileURLToPath(new URL('../../../app-gv/forbidden-4g-output', import.meta.url))]) {
      const stdout = stream(); const stderr = stream();
      assert.equal(await runDeriveTargetObservationsCli(['--analysis', matrixFixture('cvm-approved', 'analysis.json').replace(/\/analysis\.json$/, ''), '--output-dir', forbidden], { stdout, stderr }), 1);
      assert.equal(existsSync(forbidden), false);
    }
    const malformed = join(root, 'malformed.json'); writeFileSync(malformed, '{bad');
    const malformedOut = stream(); const malformedErr = stream();
    assert.equal(await runDeriveTargetObservationsCli(['--analysis', matrixFixture('partial-vimeo', 'analysis.json').replace(/\/analysis\.json$/, ''), '--profile', malformed, '--output-dir', join(root, 'malformed-output')], { stdout: malformedOut, stderr: malformedErr }), 1);
    assert.equal(malformedErr.text.includes(root), false);
    const mismatch = JSON.parse(readFileSync(matrixFixture('partial-vimeo', 'profile.json'), 'utf8')); mismatch.providerId = 'other';
    const mismatchPath = writeJson(join(root, 'mismatch.json'), mismatch); const mismatchOut = stream(); const mismatchErr = stream();
    assert.equal(await runDeriveTargetObservationsCli(['--analysis', matrixFixture('partial-vimeo', 'analysis.json').replace(/\/analysis\.json$/, ''), '--profile', mismatchPath, '--output-dir', join(root, 'mismatch-output')], { stdout: mismatchOut, stderr: mismatchErr }), 1);
    assert.equal(existsSync(join(root, 'mismatch-output')), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
  for (const name of ['derive-target-observations-cli.mjs', 'target-observation-generator.mjs']) {
    const source = readFileSync(fileURLToPath(new URL(`../src/${name}`, import.meta.url)), 'utf8');
    assert.doesNotMatch(source, /from ['"](?:playwright|node:https?|node:net|.*browser-runtime)/);
  }
});

function copyTo(root, source, name) { const destination = join(root, name); copyFileSync(source, destination); return destination; }

function mutateJsonBytes(bytes, mutate) {
  const value = JSON.parse(bytes.toString('utf8'));
  mutate(value);
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

async function createIsolatedBasisHarness(root) {
  const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
  const isolatedSource = join(root, 'tools/player-lab/src');
  mkdirSync(join(root, 'tools/player-lab/test/fixtures/helper-evidence-bridge'), { recursive: true });
  cpSync(sourceRoot, isolatedSource, { recursive: true });
  for (const caseName of ['abs-tego', 'island-dual']) cpSync(fileURLToPath(new URL(`./fixtures/helper-evidence-bridge/${caseName}/`, import.meta.url)), join(root, `tools/player-lab/test/fixtures/helper-evidence-bridge/${caseName}`), { recursive: true });
  return (await import(pathToFileURL(join(isolatedSource, 'target-observation-generator.mjs')).href)).deriveAndWriteTargetObservations;
}

function assertCharacterizationFailure({ name, caseName, mutateAdapter = () => {}, mutateBytes, refreshHash = false, pattern, harnessRoot, deriveAndWrite }) {
  const root = mkdtempSync(join(tmpdir(), 'target-basis-invalid-'));
  const basisCase = caseName === 'island-dual' ? 'island-dual' : 'abs-tego';
  const basisPath = join(harnessRoot, `tools/player-lab/test/fixtures/helper-evidence-bridge/${basisCase}/helper-capability-observations.json`);
  const originalBasis = readFileSync(basisPath);
  try {
    const adapter = JSON.parse(readFileSync(matrixFixture(caseName, 'characterization.json'), 'utf8'));
    mutateAdapter(adapter);
    if (mutateBytes) {
      const changed = mutateBytes(originalBasis);
      writeFileSync(basisPath, changed);
      if (refreshHash) adapter.basisSha256 = digest(changed);
    }
    const characterizationPath = writeJson(join(root, 'characterization.json'), adapter);
    const outputRoot = join(root, 'output');
    assert.throws(() => deriveAndWrite({ analysisPath: matrixFixture(caseName, 'analysis.json'), characterizationPath, outputRoot }), pattern, name);
    assert.equal(existsSync(outputRoot), false, name);
  } finally {
    if (digest(readFileSync(basisPath)) !== digest(originalBasis)) writeFileSync(basisPath, originalBasis);
    rmSync(root, { recursive: true, force: true });
  }
}

function assertCharacterizationSymlinkFailure({ harnessRoot, deriveAndWrite }) {
  const root = mkdtempSync(join(tmpdir(), 'target-basis-symlink-'));
  const basisPath = join(harnessRoot, 'tools/player-lab/test/fixtures/helper-evidence-bridge/abs-tego/helper-capability-observations.json');
  const originalBasis = readFileSync(basisPath);
  const copyPath = join(root, 'basis-copy.json');
  writeFileSync(copyPath, originalBasis);
  try {
    unlinkSync(basisPath);
    symlinkSync(copyPath, basisPath);
    const outputRoot = join(root, 'output');
    assert.throws(() => deriveAndWrite({
      analysisPath: matrixFixture('abs-tego', 'analysis.json'),
      characterizationPath: matrixFixture('abs-tego', 'characterization.json'),
      outputRoot,
    }), /regular non-symlink file/, 'symlink basis');
    assert.equal(existsSync(outputRoot), false, 'symlink basis');
  } finally {
    try { unlinkSync(basisPath); } catch {}
    writeFileSync(basisPath, originalBasis);
    rmSync(root, { recursive: true, force: true });
  }
}

function assertCharacterizationIntermediateSymlinkEscape({ harnessRoot, deriveAndWrite }) {
  const operationRoot = mkdtempSync(join(tmpdir(), 'target-basis-directory-symlink-'));
  const outsideRoot = mkdtempSync(join(tmpdir(), 'target-basis-outside-'));
  const basisDirectory = join(harnessRoot, 'tools/player-lab/test/fixtures/helper-evidence-bridge/abs-tego');
  const basisPath = join(basisDirectory, 'helper-capability-observations.json');
  const originalBasis = readFileSync(basisPath);
  const outsideBasisPath = join(outsideRoot, 'helper-capability-observations.json');
  writeFileSync(outsideBasisPath, originalBasis);
  try {
    rmSync(basisDirectory, { recursive: true });
    symlinkSync(outsideRoot, basisDirectory);
    const outputRoot = join(operationRoot, 'output');
    let failure;
    try {
      deriveAndWrite({
        analysisPath: matrixFixture('abs-tego', 'analysis.json'),
        characterizationPath: matrixFixture('abs-tego', 'characterization.json'),
        outputRoot,
      });
    } catch (error) {
      failure = error;
    }
    assert.ok(failure, 'intermediate directory symlink must fail');
    assert.equal(failure.message, 'Characterization basis physical path escapes the repository.');
    assert.equal(failure.message.includes(harnessRoot), false);
    assert.equal(failure.message.includes(outsideRoot), false);
    assert.equal(failure.message.includes(operationRoot), false);
    assert.equal(existsSync(outputRoot), false);
  } finally {
    try { unlinkSync(basisDirectory); } catch {}
    mkdirSync(basisDirectory, { recursive: true });
    writeFileSync(basisPath, originalBasis);
    rmSync(operationRoot, { recursive: true, force: true });
    rmSync(outsideRoot, { recursive: true, force: true });
  }
}

test('fixed-time candidate, promotion, certification, and assembly outputs remain collision-safe and fixture-clean', () => {
  const root = mkdtempSync(join(tmpdir(), 'target-output-hygiene-')); const now = () => new Date('2026-07-23T12:00:00.000Z');
  try {
    const candidateOptions = { analysisPath: matrixFixture('partial-vimeo', 'analysis.json'), profilePath: matrixFixture('partial-vimeo', 'profile.json'), outputRoot: join(root, 'candidate'), now };
    const candidateFirst = deriveAndWriteTargetObservations(candidateOptions); const candidateSecond = deriveAndWriteTargetObservations(candidateOptions);
    assert.notEqual(candidateFirst.outputDir, candidateSecond.outputDir); assert.equal(existsSync(join(candidateFirst.outputDir, 'target-capability-observations.json')), false);
    const promotedOptions = { analysisPath: matrixFixture('cvm-approved', 'analysis.json'), outputRoot: join(root, 'promoted'), now };
    const promotedFirst = deriveAndWriteTargetObservations(promotedOptions); const promotedSecond = deriveAndWriteTargetObservations(promotedOptions);
    assert.notEqual(promotedFirst.outputDir, promotedSecond.outputDir);
    const certFirst = certifyHelperEngine({ outputRoot: join(root, 'certification'), now }); const certSecond = certifyHelperEngine({ outputRoot: join(root, 'certification'), now });
    assert.notEqual(certFirst.outputDir, certSecond.outputDir);
    const assemblyOptions = { analysisPath: matrixFixture('cvm-approved', 'analysis.json'), targetObservationsPath: join(promotedFirst.outputDir, 'target-capability-observations.json'), engineCertificationPath: join(certFirst.outputDir, 'engine-certification.json'), outputRoot: join(root, 'assembly'), now };
    const assemblyFirst = assembleHelperObservations(assemblyOptions); const assemblySecond = assembleHelperObservations(assemblyOptions);
    assert.notEqual(assemblyFirst.outputDir, assemblySecond.outputDir);
    for (const directory of readdirSync(root, { recursive: true }).filter((name) => String(name).startsWith('.incomplete-'))) assert.fail(`Incomplete residue: ${directory}`);
    const fixtureEntries = readdirSync(fileURLToPath(new URL('./fixtures/target-observation-generator/', import.meta.url)), { recursive: true });
    assert.equal(fixtureEntries.some((name) => ['target-observation-candidate.json', 'target-capability-observations.json', 'engine-certification.json'].includes(String(name).split('/').at(-1))), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
