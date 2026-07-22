import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { assembleCapabilityObservations, assembleHelperObservations, certifyHelperEngine, certifyTransportAutohideEngine, ENGINE_ID, validateEngineCertification } from '../src/helper-engine-contract.mjs';
import { bridgeAnalysisToHelperEvidence, loadBridgeSource } from '../src/helper-evidence-bridge.mjs';
import { createHelperRecommendation, proposeHelper } from '../src/helper-proposal.mjs';
import { runCertifyHelperEngineCli } from '../src/helper-engine-cli.mjs';
import { runRecommendHelperCli } from '../src/recommend-helper-cli.mjs';

const contentPath = fileURLToPath(new URL('../../../app-gv/src/main/assets/gv_media_observer/content.js', import.meta.url));
const currentSource = readFileSync(contentPath, 'utf8');
const analysis = { schemaVersion: 1, providerId: 'contract-cvm', targetId: 'contract-cvm', evidenceSummary: { primaryPlayerFamily: 'vimeo' } };
const hash = (value) => createHash('sha256').update(value).digest('hex');

function target(overrides = {}) {
  return {
    schemaVersion: 1, authority: 'directly-observed-structured-evidence', providerId: 'contract-cvm', targetId: 'contract-cvm', playerFamily: 'vimeo', analysisSha256: '',
    trustedMatchingEvidence: { frameHost: 'vimeo.com', pathPrefix: '/event/', pathSuffix: '/embed', referrerHosts: ['contract-cvm.test'] },
    transportAutohide: { enabled: true, idleMs: 3200, selectors: ['.vp-controls', '.vp-sidedock', '.vp-title'] },
    providerSpecificBehavior: false, unsupportedRequirements: [], conflictingEvidence: false, sourceEvidenceReferences: ['contract-observed'], ...overrides,
  };
}
function sourceDir(targetObservation) {
  const root = mkdtempSync(join(tmpdir(), 'engine-contract-'));
  const text = `${JSON.stringify(analysis, null, 2)}\n`;
  writeFileSync(join(root, 'analysis.json'), text); targetObservation.analysisSha256 = hash(text);
  writeFileSync(join(root, 'target.json'), `${JSON.stringify(targetObservation, null, 2)}\n`);
  return root;
}

test('current transport engine certifies with exact source binding and bounded guarantees', () => {
  const certificate = certifyTransportAutohideEngine({ generatedAt: '2026-07-22T00:00:00.000Z' });
  assert.equal(certificate.certificationStatus, 'certified');
  assert.equal(certificate.engineId, ENGINE_ID);
  assert.equal(certificate.sourceSha256, hash(currentSource));
  assert.deepEqual(certificate.supportedGuarantees, ['oneOwnedTimer', 'interactionReveal', 'pagehideCleanup', 'urlFreeDiagnostics']);
  assert.deepEqual(certificate.approvedSelectors, ['.vp-controls', '.vp-sidedock', '.vp-title']);
  assert.equal(certificate.transportEngineCount, 1); assert.equal(certificate.timerImplementationCount, 1);
});

test('deterministic source verifier rejects duplicate engines, timers, missing cleanup, URL diagnostics and selectors', () => {
  const variants = [
    ['duplicate engine', `${currentSource}\nfunction installTransportAutohideCapability() {}`],
    ['duplicate timer', currentSource.replace('engine.timer = setTimeout(() => setIdle(reason), capability.idleMs);', 'engine.timer = setTimeout(() => setIdle(reason), capability.idleMs);\n      engine.timer = setTimeout(() => setIdle(reason), capability.idleMs);')],
    ['missing cleanup', currentSource.replace('window.addEventListener("pagehide"', 'window.addEventListener("pageHide"')],
    ['url diagnostic', currentSource.replace('policyId: policy.id,', 'pageUrl: "unsafe",\n        policyId: policy.id,')],
    ['document diagnostic', currentSource.replace('policyId: policy.id,', 'documentUrl: "unsafe",\n        policyId: policy.id,')],
    ['source diagnostic', currentSource.replace('policyId: policy.id,', 'sourceHref: "unsafe",\n        policyId: policy.id,')],
    ['media diagnostic', currentSource.replace('policyId: policy.id,', 'mediaLocation: "unsafe",\n        policyId: policy.id,')],
    ['extra diagnostic', currentSource.replace('policyId: policy.id,', 'extra: "unsafe",\n        policyId: policy.id,')],
    ['selector change', currentSource.replace('".vp-title"', '".unapproved"')],
  ];
  for (const [name, source] of variants) assert.equal(certifyTransportAutohideEngine({ sourceText: source }).certificationStatus, 'failed', name);
});

test('diagnostic verifier extracts every later payload assignment and validates approved value origins', () => {
  const dynamicFields = ['pageUrl', 'documentUrl', 'sourceHref', 'mediaLocation', 'extra'];
  const variants = [
    ...dynamicFields.map((field) => [`dynamic ${field}`, currentSource.replace('payload.delayMs = delayMs;', `payload.${field} = "unsafe";\n      payload.delayMs = delayMs;`)]),
    ['reason location', currentSource.replace('reason: String(reason || "idle")', 'reason: window.location.href')],
    ['policy document URL', currentSource.replace('policyId: policy.id', 'policyId: document.URL')],
    ['delay location', currentSource.replace('payload.delayMs = delayMs;', 'payload.delayMs = window.location.href;')],
    ['phase media source', currentSource.replace('        phase,\n        reason:', '        phase: video.currentSrc,\n        reason:')],
  ];
  for (const [name, source] of variants) assert.equal(certifyTransportAutohideEngine({ sourceText: source }).certificationStatus, 'failed', name);
});

test('registry count and installation scope mutations cannot certify', () => {
  const registryEnd = currentSource.indexOf(']);', currentSource.indexOf('const PLAYER_HELPER_REGISTRY'));
  const variants = [
    ['second policy', `${currentSource.slice(0, registryEnd)}, Object.freeze({ id: "second-policy" })${currentSource.slice(registryEnd)}`],
    ['second id', currentSource.replace('providerId: "cvm-tv",', 'id: "inserted-policy",\n      providerId: "cvm-tv",')],
    ['bypass policy return', currentSource.replace('if (!policy) return false;', 'if (!policy) return installTransportAutohideCapability(PLAYER_HELPER_REGISTRY[0]);')],
    ['global listener', currentSource.replace('scheduleHide("install", true);', 'window.addEventListener("click", wake, true);\n    scheduleHide("install", true);')],
    ['global timer', currentSource.replace('scheduleHide("install", true);', 'setTimeout(() => {}, 1);\n    scheduleHide("install", true);')],
  ];
  for (const [name, source] of variants) assert.equal(certifyTransportAutohideEngine({ sourceText: source }).certificationStatus, 'failed', name);
});

test('matcher semantic broadening and default-policy mutations cannot certify', () => {
  const variants = [
    ['always registry first', currentSource.replace('return PLAYER_HELPER_REGISTRY.find((policy) => matchesPlayerHelperPolicy(policy)) || null;', 'return PLAYER_HELPER_REGISTRY[0];')],
    ['fallback registry first', currentSource.replace('return PLAYER_HELPER_REGISTRY.find((policy) => matchesPlayerHelperPolicy(policy)) || null;', 'return PLAYER_HELPER_REGISTRY.find((policy) => matchesPlayerHelperPolicy(policy)) || PLAYER_HELPER_REGISTRY[0];')],
    ['matcher always true', currentSource.replace('if (!policy || !policy.match) return false;', 'return true;')],
    ['remove frame host', currentSource.replace('if (!matchesExactOrSubdomain(frameHost, match.frameHost, match.allowFrameSubdomains)) return false;\n    ', '')],
    ['remove path', currentSource.replace('if (!framePath.startsWith(match.pathPrefix) || !framePath.endsWith(match.pathSuffix)) return false;\n    ', '')],
    ['remove referrer', currentSource.replace('return Array.isArray(match.referrerHosts) && match.referrerHosts.indexOf(referrerHost) >= 0;', 'return true;')],
    ['installer default policy', currentSource.replace('if (!policy) return false;', 'if (!policy) return installTransportAutohideCapability(PLAYER_HELPER_REGISTRY[0]);')],
  ];
  for (const [name, source] of variants) assert.equal(certifyTransportAutohideEngine({ sourceText: source }).certificationStatus, 'failed', name);
});

test('stale certification cannot authorize a changed source', () => {
  const certificate = certifyTransportAutohideEngine();
  const root = mkdtempSync(join(tmpdir(), 'engine-stale-'));
  try { const changed = join(root, 'content.js'); writeFileSync(changed, `${currentSource}\n`); assert.throws(() => validateEngineCertification(certificate, { sourcePath: changed }), /recertification/); } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a forged certified certificate cannot authorize unsafe source bytes with a matching hash', () => {
  const unsafe = currentSource.replace('window.addEventListener("pagehide"', 'window.addEventListener("pageHide"');
  const forged = { ...certifyTransportAutohideEngine(), sourceSha256: hash(unsafe), certificationStatus: 'certified' };
  const root = mkdtempSync(join(tmpdir(), 'engine-forged-'));
  try { const source = join(root, 'content.js'); writeFileSync(source, unsafe); assert.throws(() => validateEngineCertification(forged, { sourcePath: source }), /Independent engine recertification failed/); } finally { rmSync(root, { recursive: true, force: true }); }
});

test('assembly adds engine guarantees only from certification and creates 4E-compatible direct evidence', () => {
  const root = sourceDir(target());
  try {
    const assembled = assembleCapabilityObservations({ analysisPath: join(root, 'analysis.json'), targetObservationsPath: join(root, 'target.json'), engineCertificationPath: writeCertificate(root) });
    assert.equal(assembled.observations.transportAutohide.oneOwnedTimer, true);
    assert.equal(assembled.observations.transportAutohide.pagehideCleanup, true);
    writeFileSync(join(root, 'helper-capability-observations.json'), `${JSON.stringify(assembled.observations, null, 2)}\n`);
    const result = createHelperRecommendation(bridgeAnalysisToHelperEvidence(loadBridgeSource(root)).evidence);
    assert.equal(result.recommendationCategory, 'direct-registry-policy');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('analysis binding hashes the exact analysis file bytes', () => {
  const root = sourceDir(target());
  try {
    const bytes = readFileSync(join(root, 'analysis.json'));
    const assembled = assembleCapabilityObservations({ analysisPath: join(root, 'analysis.json'), targetObservationsPath: join(root, 'target.json'), engineCertificationPath: writeCertificate(root) });
    assert.equal(assembled.observations.analysisSha256, createHash('sha256').update(bytes).digest('hex'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('target engine-only claims, partial targets, Island behavior and ABS requirements remain safe', () => {
  const scenarios = [
    [target({ transportAutohide: { enabled: true, idleMs: 3200, selectors: ['.vp-controls'], oneOwnedTimer: true } }), /engine-only/],
    [target({ transportAutohide: { enabled: true, idleMs: 3200, selectors: ['.vp-controls'] } }), 'insufficient-evidence'],
    [target({ providerSpecificBehavior: true, transportAutohide: undefined }), 'provider-specific-helper'],
    [target({ providerId: 'abs-contract', targetId: undefined, playerFamily: 'tego', transportAutohide: { enabled: true, idleMs: 1800, selectors: ['.rmp-controls'] }, unsupportedRequirements: ['readiness-predicate', 'retry-delay-and-limit'] }), 'engine-extension-study'],
  ];
  for (const [observation, expected] of scenarios) {
    const root = sourceDir(observation);
    try {
      if (expected instanceof RegExp) { assert.throws(() => assembleCapabilityObservations({ analysisPath: join(root, 'analysis.json'), targetObservationsPath: join(root, 'target.json'), engineCertificationPath: writeCertificate(root) }), expected); continue; }
      if (observation.providerId !== analysis.providerId) { const absAnalysis = { ...analysis, providerId: observation.providerId, targetId: null, evidenceSummary: { primaryPlayerFamily: 'tego' } }; const text = `${JSON.stringify(absAnalysis, null, 2)}\n`; writeFileSync(join(root, 'analysis.json'), text); observation.analysisSha256 = hash(text); writeFileSync(join(root, 'target.json'), `${JSON.stringify(observation, null, 2)}\n`); }
      const assembled = assembleCapabilityObservations({ analysisPath: join(root, 'analysis.json'), targetObservationsPath: join(root, 'target.json'), engineCertificationPath: writeCertificate(root) });
      if (observation.playerFamily === 'tego') {
        assert.deepEqual(assembled.observations.supportedCapabilities, ['enabled', 'idleMs', 'selectors']);
        assert.equal('oneOwnedTimer' in assembled.observations.transportAutohide, false);
      }
      writeFileSync(join(root, 'helper-capability-observations.json'), `${JSON.stringify(assembled.observations, null, 2)}\n`);
      assert.equal(createHelperRecommendation(bridgeAnalysisToHelperEvidence(loadBridgeSource(root)).evidence).recommendationCategory, expected);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('assembler validates the final artifact with the same 4E bridge validator', () => {
  for (const [field, value] of [
    ['trustedMatchingEvidence.frameHost', 'https://unsafe.test'],
    ['trustedMatchingEvidence.referrerHosts', ['https://unsafe.test']],
    ['sourceEvidenceReferences', ['https://unsafe.test']],
    ['transportAutohide.selectors', ['javascript:unsafe']],
    ['supportedCapabilities', ['unknown-capability']],
  ]) {
    const observation = target();
    const [parent, child] = field.split('.');
    if (child) observation[parent][child] = value; else observation[parent] = value;
    const root = sourceDir(observation);
    try { assert.throws(() => assembleCapabilityObservations({ analysisPath: join(root, 'analysis.json'), targetObservationsPath: join(root, 'target.json'), engineCertificationPath: writeCertificate(root) }), /invalid|known|references|unsafe/i, field); }
    finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('staging retries fixed timestamps, never promotes symlinks, and cleans only its incomplete directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'engine-staging-'));
  const now = () => new Date('2026-07-22T04:00:00.000Z');
  try {
    const first = certifyHelperEngine({ outputRoot: root, now });
    const second = certifyHelperEngine({ outputRoot: root, now });
    assert.notEqual(first.outputDir, second.outputDir);
    assert.equal(readdirSync(root).some((name) => name.startsWith('.incomplete-')), false);
    assert.equal(existsSync(join(first.outputDir, 'engine-certification.json')), true);
    const linkedRoot = join(root, 'linked-output');
    symlinkSync(root, linkedRoot);
    assert.throws(() => certifyHelperEngine({ outputRoot: linkedRoot, now }), /regular directory/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('certification CLI strictly parses output-dir and recommendation retains assembly provenance', async () => {
  const stream = () => { let text = ''; return { write(value) { text += value; }, get text() { return text; } }; };
  for (const argv of [['--output-dir'], ['--output-dir', 'a', '--output-dir', 'b'], ['--unknown'], ['--help']]) {
    const out = stream(); const err = stream(); const code = await runCertifyHelperEngineCli(argv, { stdout: out, stderr: err });
    if (argv[0] === '--help') assert.equal(code, 0); else assert.equal(code, 1);
  }
  const root = mkdtempSync(join(tmpdir(), 'engine-recommend-'));
  try {
    const cliOut = stream(); const cliErr = stream();
    assert.equal(await runCertifyHelperEngineCli(['--output-dir', root], { stdout: cliOut, stderr: cliErr }), 0);
    assert.equal(cliErr.text, '');
    const forbiddenOut = stream(); const forbiddenErr = stream();
    assert.equal(await runCertifyHelperEngineCli(['--output-dir', fileURLToPath(new URL('../../../app-gv/forbidden-engine-output', import.meta.url))], { stdout: forbiddenOut, stderr: forbiddenErr }), 1);
    const cert = certifyHelperEngine({ outputRoot: root });
    const out = stream(); const err = stream();
    const analysisPath = fileURLToPath(new URL('./fixtures/helper-evidence-bridge/cvm-complete/', import.meta.url));
    const targetPath = fileURLToPath(new URL('./fixtures/helper-engine-contract/cvm-target-observations.json', import.meta.url));
    assert.equal(await runRecommendHelperCli(['--analysis', analysisPath, '--target-observations', targetPath, '--engine-certification', join(cert.outputDir, 'engine-certification.json'), '--output-dir', root], { stdout: out, stderr: err }), 0, err.text);
    const outputDir = out.text.trim();
    const provenance = JSON.parse(readFileSync(join(outputDir, 'helper-observation-assembly-provenance.json'), 'utf8'));
    assert.equal(provenance.engineId, ENGINE_ID);
    assert.deepEqual(provenance.engineDerivedFields, ['transportAutohide.oneOwnedTimer', 'transportAutohide.interactionReveal', 'transportAutohide.pagehideCleanup', 'transportAutohide.urlFreeDiagnostics']);
    assert.equal(readdirSync(root).some((name) => name.startsWith('.incomplete-')), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('unsafe additional proposal artifacts fail before staging and safe provenance remains accepted', () => {
  const root = mkdtempSync(join(tmpdir(), 'engine-additional-artifacts-'));
  const reportPath = fileURLToPath(new URL('./fixtures/helper-proposals/cvm-like/', import.meta.url));
  try {
    for (const value of ['https://example.test/private', '/Users/example/private', '/home/example/private', 'C:\\Users\\example\\private', 'Authorization: Bearer secret', 'person@example.test']) {
      const outputRoot = join(root, `unsafe-${createHash('sha256').update(value).digest('hex').slice(0, 8)}`);
      assert.throws(() => proposeHelper({ reportPath, outputRoot, additionalArtifacts: { 'assembly-provenance.json': { value } } }), /Unsafe helper proposal content/);
      assert.equal(existsSync(outputRoot), false);
    }
    const outputRoot = join(root, 'safe');
    const result = proposeHelper({ reportPath, outputRoot, additionalArtifacts: { 'assembly-provenance.json': { engineId: ENGINE_ID, engineDerivedFields: ['transportAutohide.oneOwnedTimer'] } } });
    assert.equal(existsSync(join(result.outputDir, 'assembly-provenance.json')), true);
    assert.equal(readdirSync(outputRoot).some((name) => name.startsWith('.incomplete-')), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('reviewable target fixtures preserve target observations and produce the required matrix', () => {
  const cases = [
    ['cvm-complete', 'cvm-target-observations.json', 'direct-registry-policy', true],
    ['partial-vimeo', 'partial-vimeo-target-observations.json', 'insufficient-evidence', false],
    ['cvm-complete', 'selector-mismatched-vimeo-target-observations.json', 'insufficient-evidence', false],
    ['island-dual', 'island-provider-specific-target-observations.json', 'provider-specific-helper', false],
    ['abs-tego', 'abs-tego-target-observations.json', 'engine-extension-study', false],
  ];
  const root = mkdtempSync(join(tmpdir(), 'engine-fixtures-'));
  try {
    const certificate = writeCertificate(root);
    for (const [analysisName, targetName, category, compatible] of cases) {
      const analysisPath = fileURLToPath(new URL(`./fixtures/helper-evidence-bridge/${analysisName}/analysis.json`, import.meta.url));
      const targetPath = fileURLToPath(new URL(`./fixtures/helper-engine-contract/${targetName}`, import.meta.url));
      const assembled = assembleCapabilityObservations({ analysisPath, targetObservationsPath: targetPath, engineCertificationPath: certificate });
      assert.equal(assembled.observations.supportedCapabilities.includes('oneOwnedTimer'), compatible, targetName);
      if (targetName === 'abs-tego-target-observations.json') assert.deepEqual(assembled.observations.supportedCapabilities, ['enabled', 'idleMs', 'selectors']);
      const source = { analysis: JSON.parse(readFileSync(analysisPath, 'utf8')), analysisSha256: assembled.observations.analysisSha256, observations: assembled.observations };
      assert.equal(createHelperRecommendation(bridgeAnalysisToHelperEvidence(source).evidence).recommendationCategory, category, targetName);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

function writeCertificate(root) { const path = join(root, 'certificate.json'); writeFileSync(path, `${JSON.stringify(certifyTransportAutohideEngine(), null, 2)}\n`); return path; }
