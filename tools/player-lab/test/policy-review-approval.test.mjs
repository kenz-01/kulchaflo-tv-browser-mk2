import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { prepareHelperEvidence } from '../src/helper-evidence-bridge.mjs';
import { assembleHelperObservations, certifyHelperEngine } from '../src/helper-engine-contract.mjs';
import { proposeHelper } from '../src/helper-proposal.mjs';
import { generateAndWritePolicyDiff, generatePolicyDiff, POLICY_REVIEW_VERSION, prepareAndWritePolicyReview, preparePolicyReview, REVIEWED_FIELD_PATHS } from '../src/policy-review-approval.mjs';
import { runGeneratePolicyDiffCli } from '../src/generate-policy-diff-cli.mjs';
import { runPreparePolicyReviewCli } from '../src/prepare-policy-review-cli.mjs';
import { deriveAndWriteTargetObservations, parsePlayerHelperRegistry } from '../src/target-observation-generator.mjs';

const fixture = (caseName, name) => fileURLToPath(new URL(`./fixtures/target-observation-generator/${caseName}/${name}`, import.meta.url));
const runtimePath = fileURLToPath(new URL('../../../app-gv/src/main/assets/gv_media_observer/content.js', import.meta.url));
const runtimeBytes = readFileSync(runtimePath);
const fixedNow = () => new Date('2026-07-26T12:00:00.000Z');
const choices = {
  cvm: { policyId: 'cvm-tv-embedded-vimeo', runtimePlayerFamily: 'embedded-vimeo', idleClass: 'kf-cvm-vimeo-transport-idle', styleId: 'kf-cvm-vimeo-transport-autohide-style' },
  reviewer: { policyId: 'reviewer-vimeo-embedded-vimeo', runtimePlayerFamily: 'embedded-vimeo', idleClass: 'kf-reviewer-vimeo-transport-idle', styleId: 'kf-reviewer-vimeo-transport-autohide-style' },
};

test('CVM no-change, reviewer Vimeo add, compatible update, rejected, and changes-requested form the explicit 4H result matrix', () => {
  const root = mkdtempSync(join(tmpdir(), 'policy-review-results-'));
  try {
    const cvm = buildEligibleChain(join(root, 'cvm'), 'cvm');
    const prepared = prepareAndWritePolicyReview({ ...cvm, outputRoot: join(root, 'prepared'), now: fixedNow });
    assert.equal(prepared.template.reviewVersion, POLICY_REVIEW_VERSION);
    assert.equal(prepared.template.decision, 'pending');
    assert.deepEqual(prepared.template.reviewedFieldPaths, REVIEWED_FIELD_PATHS);
    for (const [field, path] of [
      ['analysisSha256', cvm.analysisPath], ['candidateSha256', cvm.candidatePath], ['targetObservationsSha256', cvm.targetObservationsPath],
      ['engineCertificationSha256', cvm.engineCertificationPath], ['assembledObservationsSha256', cvm.assembledObservationsPath],
      ['recommendationSha256', cvm.recommendationPath], ['runtimeSourceSha256', cvm.runtimeSourcePath],
    ]) assert.equal(prepared.template[field], digest(readFileSync(path)), field);
    const cvmReview = completeReview(prepared.template, 'approved', choices.cvm);
    const cvmReviewPath = writeJson(join(root, 'cvm-review.json'), cvmReview);
    const cvmResult = generatePolicyDiff({ ...cvm, reviewPath: cvmReviewPath, now: fixedNow });
    assert.equal(cvmResult.policyDiff.changeType, 'no-change');
    assert.deepEqual(cvmResult.policyDiff.changedFieldPaths, []);
    assert.deepEqual(cvmResult.policyDiff.policyBefore, cvmResult.policyDiff.policyAfter);
    assert.equal(cvmResult.policyDiff.applicationStatus, 'not-applied');

    const reviewer = buildEligibleChain(join(root, 'reviewer'), 'reviewer');
    const reviewerTemplate = preparePolicyReview({ ...reviewer, now: fixedNow }).template;
    const reviewerReviewPath = writeJson(join(root, 'reviewer-review.json'), completeReview(reviewerTemplate, 'approved', choices.reviewer));
    const add = generatePolicyDiff({ ...reviewer, reviewPath: reviewerReviewPath, now: fixedNow });
    assert.equal(add.policyDiff.changeType, 'add-policy');
    assert.equal(add.policyDiff.policyBefore, null);
    assert.equal(add.policyDiff.changedFieldPaths[0], '$add-policy');
    assert.deepEqual(add.proposedPolicy.match, JSON.parse(readFileSync(reviewer.targetObservationsPath, 'utf8')).trustedMatchingEvidence);
    assert.deepEqual(add.proposedPolicy.capabilities.transportAutohide.selectors, ['.vp-controls', '.vp-sidedock', '.vp-title']);
    assert.equal(add.proposedPolicy.capabilities.transportAutohide.idleMs, 3200);
    assert.equal(add.policyDiff.applicationStatus, 'not-applied');

    const changedRuntimePath = join(root, 'compatible-runtime.js');
    writeFileSync(changedRuntimePath, runtimeBytes.toString('utf8').replace('idleMs: 3200', 'idleMs: 3000'));
    const updateChain = buildEligibleChain(join(root, 'update'), 'cvm', changedRuntimePath);
    const updateTemplate = preparePolicyReview({ ...updateChain, now: fixedNow }).template;
    const updateReviewPath = writeJson(join(root, 'update-review.json'), completeReview(updateTemplate, 'approved', choices.cvm));
    const update = generatePolicyDiff({ ...updateChain, reviewPath: updateReviewPath, now: fixedNow });
    assert.equal(update.policyDiff.changeType, 'update-policy');
    assert.deepEqual(update.policyDiff.changedFieldPaths, ['capabilities.transportAutohide.idleMs']);
    assert.equal(update.policyDiff.policyBefore.capabilities.transportAutohide.idleMs, 3000);
    assert.equal(update.policyDiff.policyAfter.capabilities.transportAutohide.idleMs, 3200);

    for (const decision of ['rejected', 'changes-requested']) {
      const path = writeJson(join(root, `${decision}.json`), completeReview(reviewerTemplate, decision));
      const result = generateAndWritePolicyDiff({ ...reviewer, reviewPath: path, outputRoot: join(root, decision), now: fixedNow });
      assert.equal(result.decision.decision, decision);
      assert.equal(result.decision.policyProposalGenerated, false);
      assert.equal(result.proposedPolicy, null);
      assert.equal(result.policyDiff, null);
      assert.deepEqual(readdirSync(result.outputDir).sort(), ['policy-diff-provenance.json', 'policy-review-decision.json']);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('ineligible and stale evidence chains fail before output allocation', () => {
  const root = mkdtempSync(join(tmpdir(), 'policy-review-ineligible-'));
  try {
    const chain = buildEligibleChain(join(root, 'chain'), 'reviewer');
    const cases = [
      ['missing idle', 'candidatePath', (value) => { value.candidateStatus = 'insufficient-evidence'; value.unavailableFields.push('transportAutohide.idleMs'); }],
      ['partial Vimeo', 'candidatePath', (value) => { value.candidateStatus = 'insufficient-evidence'; }],
      ['selector conflict', 'candidatePath', (value) => { value.candidateStatus = 'conflicting-evidence'; value.conflictingFields.push('transportAutohide.selectors'); }],
      ['Island provider-specific', 'candidatePath', (value) => { value.candidateStatus = 'provider-specific'; value.targetObservationCandidate.providerSpecificBehavior = true; }],
      ['ABS engine extension', 'candidatePath', (value) => { value.candidateStatus = 'engine-extension-study'; value.targetObservationCandidate.unsupportedRequirements = ['readiness-predicate']; }],
      ['stale candidate', 'candidatePath', (value) => { value.analysisSha256 = '0'.repeat(64); }],
      ['stale target observations', 'targetObservationsPath', (value) => { value.transportAutohide.idleMs = 4100; }],
      ['uncertified engine', 'engineCertificationPath', (value) => { value.certificationStatus = 'failed'; }],
      ['stale assembly', 'assembledObservationsPath', (value) => { value.transportAutohide.idleMs = 4100; }],
      ['non-direct recommendation', 'recommendationPath', (value) => { value.recommendationCategory = 'insufficient-evidence'; }],
      ['stale recommendation', 'recommendationPath', (value) => { value.confidence = 'low'; }],
    ];
    for (const [name, field, mutate] of cases) {
      const caseRoot = join(root, name.replaceAll(' ', '-'));
      const value = JSON.parse(readFileSync(chain[field], 'utf8')); mutate(value);
      const path = writeJson(join(root, `${name.replaceAll(' ', '-')}.json`), value);
      const outputRoot = join(caseRoot, 'output');
      assert.throws(() => prepareAndWritePolicyReview({ ...chain, [field]: path, outputRoot, now: fixedNow }), undefined, name);
      assert.equal(existsSync(outputRoot), false, name);
    }
    const missingTargetOutput = join(root, 'missing-target-output');
    assert.throws(() => prepareAndWritePolicyReview({ ...chain, targetObservationsPath: join(root, 'missing.json'), outputRoot: missingTargetOutput, now: fixedNow }));
    assert.equal(existsSync(missingTargetOutput), false);
    const actualIneligible = [
      ['actual missing idle', 'vimeo-reviewer', { targetRegistryPath: fixture('vimeo-reviewer', 'registry.json') }],
      ['actual partial Vimeo', 'partial-vimeo', { profilePath: fixture('partial-vimeo', 'profile.json') }],
      ['actual selector conflict', 'selector-mismatch', { profilePath: fixture('selector-mismatch', 'profile.json'), targetRegistryPath: fixture('selector-mismatch', 'registry.json') }],
      ['actual Island provider-specific', 'island-dual', { characterizationPath: fixture('island-dual', 'characterization.json') }],
      ['actual ABS engine extension', 'abs-tego', { characterizationPath: fixture('abs-tego', 'characterization.json') }],
    ];
    for (const [name, caseName, extra] of actualIneligible) {
      const analysisPath = fixture(caseName, 'analysis.json');
      const derived = deriveAndWriteTargetObservations({ analysisPath, ...extra, outputRoot: join(root, `${caseName}-derived`), now: fixedNow });
      const outputRoot = join(root, `${caseName}-review-output`);
      assert.throws(() => prepareAndWritePolicyReview({ ...chain, analysisPath, candidatePath: join(derived.outputDir, 'target-observation-candidate.json'), outputRoot, now: fixedNow }), undefined, name);
      assert.equal(existsSync(outputRoot), false, name);
    }
    const mixedOutput = join(root, 'mixed-output');
    assert.throws(() => prepareAndWritePolicyReview({ ...chain, analysisPath: fixture('cvm-approved', 'analysis.json'), outputRoot: mixedOutput, now: fixedNow }));
    assert.equal(existsSync(mixedOutput), false);
    const staleRuntimePath = join(root, 'stale-runtime.js'); writeFileSync(staleRuntimePath, `${runtimeBytes.toString('utf8')}\n`);
    const staleRuntimeOutput = join(root, 'stale-runtime-output');
    assert.throws(() => prepareAndWritePolicyReview({ ...chain, runtimeSourcePath: staleRuntimePath, outputRoot: staleRuntimeOutput, now: fixedNow }));
    assert.equal(existsSync(staleRuntimeOutput), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('candidate source bindings, field provenance, and state fail closed before output allocation', () => {
  const root = mkdtempSync(join(tmpdir(), 'policy-review-candidate-provenance-'));
  try {
    const chain = buildEligibleChain(join(root, 'chain'), 'reviewer');
    const original = JSON.parse(readFileSync(chain.candidatePath, 'utf8'));
    const reviewed = (value, fieldPath) => value.fieldProvenance.find((record) => record.fieldPath === fieldPath && record.status === 'supported');
    const cases = [
      ['missing sourceBindings', (value) => { delete value.sourceBindings; }],
      ['empty sourceBindings', (value) => { value.sourceBindings = []; }],
      ['unknown source kind', (value) => { value.sourceBindings[1].kind = 'invented-source'; }],
      ['unknown authority', (value) => { value.sourceBindings[1].authorityType = 'invented-authority'; }],
      ['malformed source hash', (value) => { value.sourceBindings[1].sha256 = 'bad'; }],
      ['duplicate binding', (value) => { value.sourceBindings.push(structuredClone(value.sourceBindings[1])); }],
      ['analysis binding wrong hash', (value) => { value.sourceBindings[0].sha256 = '0'.repeat(64); }],
      ['analysis binding wrong provider', (value) => { value.sourceBindings[0].providerId = 'other-provider'; }],
      ['missing fieldProvenance', (value) => { delete value.fieldProvenance; }],
      ['unknown provenance field', (value) => { value.fieldProvenance[0].other = true; }],
      ['provenance missing source', (value) => { reviewed(value, 'trustedMatchingEvidence.frameHost').sourceArtifactId = 'missing-source.json'; }],
      ['provenance source hash mismatch', (value) => { reviewed(value, 'trustedMatchingEvidence.frameHost').sourceSha256 = '0'.repeat(64); }],
      ['missing reviewed-field provenance', (value) => { value.fieldProvenance = value.fieldProvenance.filter((record) => record.fieldPath !== 'trustedMatchingEvidence.frameHost'); }],
      ['reviewed-field value mismatch', (value) => { reviewed(value, 'trustedMatchingEvidence.frameHost').normalizedValue = 'other.example'; }],
      ['selector provenance mismatch', (value) => { reviewed(value, 'transportAutohide.selectors').normalizedValue = ['.other']; }],
      ['referrer-host provenance mismatch', (value) => { reviewed(value, 'trustedMatchingEvidence.referrerHosts').normalizedValue = ['other.example']; }],
      ['conflicting provenance status', (value) => { reviewed(value, 'transportAutohide.idleMs').status = 'conflicting'; }],
      ['unavailable reviewed-field provenance', (value) => {
        const record = reviewed(value, 'transportAutohide.idleMs');
        Object.assign(record, { normalizedValue: null, authorityType: 'unavailable', sourceArtifactId: null, sourceSha256: null, sourceField: null, status: 'unavailable', reason: 'Idle policy is unavailable.' });
        delete record.normalizationRule;
      }],
      ['unsafe provenance artifact ID', (value) => { value.sourceBindings[1].artifactId = '/Users/private/source.json'; }],
      ['engine-only provenance field', (value) => { reviewed(value, 'transportAutohide.idleMs').fieldPath = 'oneOwnedTimer'; }],
      ['unsupported downgrade reason', (value) => { value.downgradeReasons.push('invented-downgrade'); }],
    ];
    for (const [name, mutate] of cases) {
      const candidate = structuredClone(original);
      mutate(candidate);
      const candidatePath = writeJson(join(root, `${name.replaceAll(' ', '-')}.json`), candidate);
      const outputRoot = join(root, `output-${name.replaceAll(' ', '-')}`);
      assert.throws(() => prepareAndWritePolicyReview({ ...chain, candidatePath, outputRoot, now: fixedNow }), undefined, name);
      assert.equal(existsSync(outputRoot), false, name);
    }
    assert.equal(preparePolicyReview({ ...chain, now: fixedNow }).template.decision, 'pending');
    const cvm = buildEligibleChain(join(root, 'cvm'), 'cvm');
    assert.equal(preparePolicyReview({ ...cvm, now: fixedNow }).template.decision, 'pending');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('completed review tampering, unsafe content, and policy takeover fail closed before output allocation', () => {
  const root = mkdtempSync(join(tmpdir(), 'policy-review-tampering-'));
  try {
    const chain = buildEligibleChain(join(root, 'chain'), 'reviewer');
    const template = preparePolicyReview({ ...chain, now: fixedNow }).template;
    const base = completeReview(template, 'approved', choices.reviewer);
    const cases = [
      ['providerId', (value) => { value.providerId = 'other'; }],
      ['targetId', (value) => { value.targetId = 'other'; }],
      ['playerFamily', (value) => { value.playerFamily = 'native-html5'; }],
      ['evidence SHA', (value) => { value.candidateSha256 = '0'.repeat(64); }],
      ['incomplete fields', (value) => { value.reviewedFieldPaths.pop(); }],
      ['extra fields', (value) => { value.reviewedFieldPaths.push('transportAutohide.other'); }],
      ['pending', (value) => { value.decision = 'pending'; }],
      ['unknown decision', (value) => { value.decision = 'maybe'; }],
      ['false acknowledgement', (value) => { value.acknowledgements.targetFieldsReviewed = false; }],
      ['missing acknowledgement', (value) => { delete value.acknowledgements.targetFieldsReviewed; }],
      ['unsafe policyId', (value) => { value.implementationChoices.policyId = 'Bad ID'; }],
      ['unsupported runtime family', (value) => { value.implementationChoices.runtimePlayerFamily = 'vimeo'; }],
      ['unsafe idleClass', (value) => { value.implementationChoices.idleClass = '.bad'; }],
      ['unsafe styleId', (value) => { value.implementationChoices.styleId = 'javascript-bad'; }],
      ['matching override', (value) => { value.trustedMatchingEvidence = { frameHost: 'other.test' }; }],
      ['selector override', (value) => { value.selectors = ['.other']; }],
      ['idle override', (value) => { value.idleMs = 4100; }],
      ['enabled override', (value) => { value.enabled = false; }],
      ['free-form notes', (value) => { value.notes = 'anything'; }],
      ['raw URL', (value) => { value.implementationChoices.policyId = 'https://bad.test'; }],
      ['macOS path', (value) => { value.implementationChoices.policyId = '/Users/example/private'; }],
      ['Linux path', (value) => { value.implementationChoices.policyId = '/home/example/private'; }],
      ['Windows path', (value) => { value.implementationChoices.policyId = 'C:\\Users\\example\\private'; }],
      ['Authorization', (value) => { value.implementationChoices.policyId = 'Authorization: Bearer secret'; }],
      ['Bearer', (value) => { value.implementationChoices.policyId = 'Bearer secret'; }],
      ['token', (value) => { value.implementationChoices.policyId = 'access-token=secret'; }],
      ['email', (value) => { value.implementationChoices.policyId = 'person@example.test'; }],
      ['unknown field', (value) => { value.other = true; }],
    ];
    for (const [name, mutate] of cases) {
      const review = structuredClone(base); mutate(review);
      const reviewPath = writeJson(join(root, `${name.replaceAll(' ', '-')}.json`), review);
      const outputRoot = join(root, `output-${name.replaceAll(' ', '-')}`);
      assert.throws(() => generateAndWritePolicyDiff({ ...chain, reviewPath, outputRoot, now: fixedNow }), undefined, name);
      assert.equal(existsSync(outputRoot), false, name);
    }
    const takeover = structuredClone(base); takeover.implementationChoices.policyId = 'cvm-tv-embedded-vimeo';
    const takeoverPath = writeJson(join(root, 'takeover.json'), takeover);
    const takeoverOutput = join(root, 'takeover-output');
    assert.throws(() => generateAndWritePolicyDiff({ ...chain, reviewPath: takeoverPath, outputRoot: takeoverOutput, now: fixedNow }), /take over/);
    assert.equal(existsSync(takeoverOutput), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('runtime registry declaration discovery is string/comment-aware and rejects ambiguity without execution', () => {
  const text = runtimeBytes.toString('utf8');
  assert.equal(parsePlayerHelperRegistry(text).length, 1);
  for (const decoy of [
    '// const PLAYER_HELPER_REGISTRY = Object.freeze([]);\n',
    '/* const PLAYER_HELPER_REGISTRY = Object.freeze([]); */\n',
    'const quotedDecoy = "const PLAYER_HELPER_REGISTRY = Object.freeze([]);";\n',
    "const singleQuotedDecoy = 'const PLAYER_HELPER_REGISTRY = Object.freeze([]);';\n",
    'const templateDecoy = `const PLAYER_HELPER_REGISTRY = Object.freeze([]);`;\n',
    'const expressionTemplate = `safe-${1}`;\n',
  ]) assert.equal(parsePlayerHelperRegistry(`${decoy}${text}`).length, 1, decoy);
  assert.throws(() => parsePlayerHelperRegistry(`${text}\nconst PLAYER_HELPER_REGISTRY = Object.freeze([]);`), /multiple declarations/);
  assert.throws(() => parsePlayerHelperRegistry(text.replace('const PLAYER_HELPER_REGISTRY', 'const PLAYER_HELPER_REGISTRY_MISSING')), /missing/);
  assert.throws(() => parsePlayerHelperRegistry(text.replace('const PLAYER_HELPER_REGISTRY =', 'const PLAYER_HELPER_REGISTRY ||=')), /declaration is malformed/);
  assert.throws(() => parsePlayerHelperRegistry('const ambiguous = `${(() => { const PLAYER_HELPER_REGISTRY = Object.freeze([]); })()}`;'), /template expression is ambiguous/);
  const blockStart = text.indexOf('    Object.freeze({', text.indexOf('const PLAYER_HELPER_REGISTRY'));
  const blockEnd = text.indexOf('\n    })', blockStart) + '\n    })'.length;
  const block = text.slice(blockStart, blockEnd);
  assert.throws(() => parsePlayerHelperRegistry(text.replace(block, `${block},\n${block}`)), /duplicate policy IDs/);
  assert.throws(() => parsePlayerHelperRegistry(text.replace('id: "cvm-tv-embedded-vimeo"', 'id: makePolicyId()')));
  assert.throws(() => parsePlayerHelperRegistry(text.replace('idleMs: 3200', 'idleMs: computeIdle()')));
  assert.throws(() => parsePlayerHelperRegistry(text.replace('Object.freeze({\n      id: "cvm-tv-embedded-vimeo"', 'Object.freeze(sideEffect(), {\n      id: "cvm-tv-embedded-vimeo"')), /unexpected expression/);
  assert.throws(() => parsePlayerHelperRegistry(text.replace(block, `${block},\n${block.replace('id: "cvm-tv-embedded-vimeo"', 'id: "other-id"')}`)), /ambiguous provider/);
  const parserSource = readFileSync(fileURLToPath(new URL('../src/target-observation-generator.mjs', import.meta.url)), 'utf8');
  assert.doesNotMatch(parserSource, /\beval\s*\(|\bFunction\s*\(/);
});

test('policy outputs separate engine guarantees and remain private, staged, deterministic, and Android-read-only', () => {
  const root = mkdtempSync(join(tmpdir(), 'policy-review-output-'));
  try {
    const chain = buildEligibleChain(join(root, 'chain'), 'cvm');
    const template = preparePolicyReview({ ...chain, now: fixedNow }).template;
    const reviewPath = writeJson(join(root, 'review.json'), completeReview(template, 'approved', choices.cvm));
    const beforeRuntime = digest(readFileSync(runtimePath));
    const first = generateAndWritePolicyDiff({ ...chain, reviewPath, outputRoot: join(root, 'output'), now: fixedNow });
    const second = generateAndWritePolicyDiff({ ...chain, reviewPath, outputRoot: join(root, 'output'), now: fixedNow });
    assert.notEqual(first.outputDir, second.outputDir);
    assert.equal(digest(readFileSync(runtimePath)), beforeRuntime);
    for (const result of [first, second]) {
      const text = JSON.stringify({ decision: result.decision, provenance: result.provenance, proposedPolicy: result.proposedPolicy, policyDiff: result.policyDiff });
      for (const field of ['oneOwnedTimer', 'interactionReveal', 'pagehideCleanup', 'urlFreeDiagnostics', 'sourceCapabilityKey', 'normalizedCapabilityType', 'capabilityNormalizationRule', 'familyNormalizationRule']) assert.equal(text.includes(field), false, field);
      assert.equal(text.includes(root), false);
      assert.equal(result.policyDiff.applicationStatus, 'not-applied');
    }
    assert.equal(readdirSync(join(root, 'output')).some((name) => name.startsWith('.incomplete-')), false);
    const linkedRoot = join(root, 'linked-output'); symlinkSync(join(root, 'output'), linkedRoot);
    assert.throws(() => generateAndWritePolicyDiff({ ...chain, reviewPath, outputRoot: linkedRoot, now: fixedNow }), /real regular directory/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('all 4H sources use physical containment and privacy-safe intermediate-symlink rejection', async () => {
  const root = mkdtempSync(join(tmpdir(), 'policy-review-physical-paths-'));
  try {
    const chain = buildEligibleChain(join(root, 'source-chain'), 'reviewer');
    const normal = await createIsolatedPolicyHarness(join(root, 'normal-repository'), chain);
    const prepared = normal.module.preparePolicyReview({ ...normal.options, now: fixedNow });
    assert.equal(prepared.template.analysisSha256, digest(readFileSync(chain.analysisPath)));
    assert.equal(prepared.template.candidateSha256, digest(readFileSync(chain.candidatePath)));
    assert.equal(prepared.template.runtimeSourceSha256, digest(runtimeBytes));
    assert.equal(prepared.template.runtimeSourceArtifactId, 'app-gv/src/main/assets/gv_media_observer/content.js');

    const externalReviewPath = writeJson(join(root, 'external-policy-review.json'), completeReview(prepared.template, 'approved', choices.reviewer));
    const generated = normal.module.generatePolicyDiff({ ...normal.options, reviewPath: externalReviewPath, now: fixedNow });
    assert.match(generated.decision.reviewBinding.artifactId, /^external-policy-review-/);
    assert.equal(JSON.stringify(generated).includes(root), false);
    assert.equal(JSON.stringify(generated).includes(normal.repositoryRoot), false);

    const finalLink = await createIsolatedPolicyHarness(join(root, 'final-link-repository'), chain);
    const finalLinkPath = join(finalLink.repositoryRoot, 'tools/player-lab/test-inputs/candidate-final-link.json');
    symlinkSync(chain.candidatePath, finalLinkPath);
    const finalOutput = join(finalLink.repositoryRoot, 'tools/player-lab/test-output/final-link');
    assert.throws(() => finalLink.module.prepareAndWritePolicyReview({ ...finalLink.options, candidatePath: finalLinkPath, outputRoot: finalOutput, now: fixedNow }), /regular non-symlink file/);
    assert.equal(existsSync(finalOutput), false);

    for (const sourceKind of ['candidate', 'runtime', 'review']) {
      const harness = await createIsolatedPolicyHarness(join(root, `${sourceKind}-escape-repository`), chain);
      const outside = join(root, `${sourceKind}-outside`);
      let logicalPath;
      let invoke;
      if (sourceKind === 'candidate') {
        logicalPath = harness.options.candidatePath;
        replaceIntermediateDirectoryWithOutsideSymlink(logicalPath, outside, readFileSync(chain.candidatePath));
        invoke = (outputRoot) => harness.module.prepareAndWritePolicyReview({ ...harness.options, candidatePath: logicalPath, outputRoot, now: fixedNow });
      } else if (sourceKind === 'runtime') {
        logicalPath = harness.options.runtimeSourcePath;
        replaceIntermediateDirectoryWithOutsideSymlink(logicalPath, outside, runtimeBytes);
        invoke = (outputRoot) => harness.module.prepareAndWritePolicyReview({ ...harness.options, runtimeSourcePath: logicalPath, outputRoot, now: fixedNow });
      } else {
        const template = harness.module.preparePolicyReview({ ...harness.options, now: fixedNow }).template;
        logicalPath = join(harness.repositoryRoot, 'tools/player-lab/test-inputs/review/completed-policy-review.json');
        mkdirSync(dirname(logicalPath), { recursive: true });
        replaceIntermediateDirectoryWithOutsideSymlink(logicalPath, outside, Buffer.from(`${JSON.stringify(completeReview(template, 'approved', choices.reviewer), null, 2)}\n`));
        invoke = (outputRoot) => harness.module.generateAndWritePolicyDiff({ ...harness.options, reviewPath: logicalPath, outputRoot, now: fixedNow });
      }
      const outputRoot = join(harness.repositoryRoot, `tools/player-lab/test-output/${sourceKind}`);
      let error;
      try { invoke(outputRoot); } catch (caught) { error = caught; }
      assert.ok(error, `${sourceKind} must reject the physical escape`);
      assert.equal(error.message, 'Policy review source physical path escapes the repository.');
      assert.equal(error.message.includes(harness.repositoryRoot), false);
      assert.equal(error.message.includes(outside), false);
      assert.equal(existsSync(outputRoot), false);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('both 4H CLIs enforce strict offline arguments, safe outputs, sanitized failures, and one-line success', async () => {
  const root = mkdtempSync(join(tmpdir(), 'policy-review-cli-'));
  try {
    const externalRuntime = join(root, 'external-runtime.js'); copyFileSync(runtimePath, externalRuntime);
    const chain = buildEligibleChain(join(root, 'chain'), 'reviewer', externalRuntime);
    const base = cliArgs(chain);
    for (const [runner, requiredExtra] of [[runPreparePolicyReviewCli, []], [runGeneratePolicyDiffCli, ['--review', join(root, 'missing-review.json')]]]) {
      for (const argv of [['--help'], [], ['--analysis'], ['--unknown'], [...base, '--analysis', dirname(chain.analysisPath)], [...base, '--candidate']]) {
        const stdout = stream(); const stderr = stream();
        const code = await runner([...argv, ...requiredExtra], { stdout, stderr });
        if (argv[0] === '--help') assert.equal(code, 0); else assert.equal(code, 1);
      }
    }
    const prepareOut = stream(); const prepareErr = stream(); const prepareRoot = join(root, 'prepared');
    assert.equal(await runPreparePolicyReviewCli([...base, '--runtime-source', externalRuntime, '--output-dir', prepareRoot], { stdout: prepareOut, stderr: prepareErr }), 0, prepareErr.text);
    assert.equal(prepareErr.text, ''); assert.equal(prepareOut.text.trim().split('\n').length, 1);
    const template = JSON.parse(readFileSync(join(prepareOut.text.trim(), 'policy-review-template.json'), 'utf8'));
    assert.match(template.runtimeSourceArtifactId, /^external-runtime-source-/);
    const externalReview = writeJson(join(root, 'external-review.json'), completeReview(template, 'approved', choices.reviewer));
    const diffOut = stream(); const diffErr = stream(); const diffRoot = join(root, 'diff');
    assert.equal(await runGeneratePolicyDiffCli([...base, '--review', externalReview, '--runtime-source', chain.runtimeSourcePath, '--output-dir', diffRoot], { stdout: diffOut, stderr: diffErr }), 0, diffErr.text);
    assert.equal(diffErr.text, ''); assert.equal(diffOut.text.trim().split('\n').length, 1);
    for (const forbidden of [fileURLToPath(new URL('../../../app/forbidden-4h-output', import.meta.url)), fileURLToPath(new URL('../../../app-gv/forbidden-4h-output', import.meta.url))]) {
      const stdout = stream(); const stderr = stream();
      assert.equal(await runPreparePolicyReviewCli([...base, '--runtime-source', externalRuntime, '--output-dir', forbidden], { stdout, stderr }), 1);
      assert.equal(existsSync(forbidden), false);
    }
    const malformed = join(root, 'malformed.json'); writeFileSync(malformed, '{bad');
    const malformedOut = stream(); const malformedErr = stream();
    assert.equal(await runPreparePolicyReviewCli([...base.filter((_, index) => index < 10), '--recommendation', malformed, '--output-dir', join(root, 'malformed-output')], { stdout: malformedOut, stderr: malformedErr }), 1);
    assert.equal(malformedErr.text.includes(root), false);
    const linkedRuntime = join(root, 'runtime-link.js'); symlinkSync(runtimePath, linkedRuntime);
    const linkOut = stream(); const linkErr = stream();
    assert.equal(await runPreparePolicyReviewCli([...base, '--runtime-source', linkedRuntime, '--output-dir', join(root, 'link-output')], { stdout: linkOut, stderr: linkErr }), 1);
    for (const name of ['prepare-policy-review-cli.mjs', 'generate-policy-diff-cli.mjs', 'policy-review-approval.mjs']) {
      const source = readFileSync(fileURLToPath(new URL(`../src/${name}`, import.meta.url)), 'utf8');
      assert.doesNotMatch(source, /from ['"](?:playwright|node:https?|node:net|.*browser-runtime)/);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

function buildEligibleChain(root, kind, runtimeSourcePath = runtimePath) {
  const caseName = kind === 'cvm' ? 'cvm-approved' : 'vimeo-reviewer';
  const analysisPath = fixture(caseName, 'analysis.json');
  const deriveOptions = kind === 'cvm'
    ? { analysisPath }
    : { analysisPath, targetRegistryPath: fixture(caseName, 'registry.json'), reviewInputPath: fixture(caseName, 'reviewer.json') };
  const derived = deriveAndWriteTargetObservations({ ...deriveOptions, outputRoot: join(root, 'derived'), now: fixedNow });
  const candidatePath = join(derived.outputDir, 'target-observation-candidate.json');
  const targetObservationsPath = join(derived.outputDir, 'target-capability-observations.json');
  const certified = certifyHelperEngine({ sourcePath: runtimeSourcePath, outputRoot: join(root, 'certified'), now: fixedNow });
  const engineCertificationPath = join(certified.outputDir, 'engine-certification.json');
  const assembled = assembleHelperObservations({ analysisPath, targetObservationsPath, engineCertificationPath, sourcePath: runtimeSourcePath, outputRoot: join(root, 'assembled'), now: fixedNow });
  const assembledObservationsPath = join(assembled.outputDir, 'helper-capability-observations.json');
  const bridge = prepareHelperEvidence({ analysisPath: dirname(analysisPath), observations: assembled.observations, outputRoot: join(root, 'bridge'), now: fixedNow });
  const proposal = proposeHelper({ reportPath: bridge.outputDir, outputRoot: join(root, 'proposal'), now: fixedNow });
  return { analysisPath, candidatePath, targetObservationsPath, engineCertificationPath, assembledObservationsPath, recommendationPath: proposal.jsonPath, runtimeSourcePath };
}

function completeReview(template, decision, implementationChoices = null) {
  const review = structuredClone(template); review.decision = decision;
  if (decision === 'approved') {
    review.implementationChoices = structuredClone(implementationChoices);
    review.acknowledgements = { evidenceChainReviewed: true, targetFieldsReviewed: true, engineGuaranteesRemainSeparate: true, noAutomaticAndroidApplication: true };
  }
  return review;
}
async function createIsolatedPolicyHarness(repositoryRoot, chain) {
  mkdirSync(repositoryRoot, { recursive: true });
  repositoryRoot = realpathSync(repositoryRoot);
  const playerLabRoot = join(repositoryRoot, 'tools/player-lab');
  mkdirSync(playerLabRoot, { recursive: true });
  cpSync(fileURLToPath(new URL('../src', import.meta.url)), join(playerLabRoot, 'src'), { recursive: true });
  const inputRoot = join(playerLabRoot, 'test-inputs');
  const paths = {};
  for (const [key, source, filename] of [
    ['analysisPath', chain.analysisPath, 'analysis.json'],
    ['candidatePath', chain.candidatePath, 'candidate.json'],
    ['targetObservationsPath', chain.targetObservationsPath, 'target-observations.json'],
    ['engineCertificationPath', chain.engineCertificationPath, 'engine-certification.json'],
    ['assembledObservationsPath', chain.assembledObservationsPath, 'assembled-observations.json'],
    ['recommendationPath', chain.recommendationPath, 'recommendation.json'],
  ]) {
    const destination = join(inputRoot, key, filename);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    paths[key] = destination;
  }
  const isolatedRuntime = join(repositoryRoot, 'app-gv/src/main/assets/gv_media_observer/content.js');
  mkdirSync(dirname(isolatedRuntime), { recursive: true });
  copyFileSync(runtimePath, isolatedRuntime);
  paths.runtimeSourcePath = isolatedRuntime;
  const modulePath = join(playerLabRoot, 'src/policy-review-approval.mjs');
  const module = await import(`${pathToFileURL(modulePath).href}?harness=${encodeURIComponent(repositoryRoot)}`);
  return { repositoryRoot, module, options: paths };
}
function replaceIntermediateDirectoryWithOutsideSymlink(logicalPath, outsideDirectory, bytes) {
  const logicalDirectory = dirname(logicalPath);
  rmSync(logicalDirectory, { recursive: true, force: true });
  mkdirSync(outsideDirectory, { recursive: true });
  writeFileSync(join(outsideDirectory, basename(logicalPath)), bytes);
  symlinkSync(outsideDirectory, logicalDirectory);
}
function cliArgs(chain) { return ['--analysis', dirname(chain.analysisPath), '--candidate', chain.candidatePath, '--target-observations', chain.targetObservationsPath, '--engine-certification', chain.engineCertificationPath, '--assembled-observations', chain.assembledObservationsPath, '--recommendation', chain.recommendationPath]; }
function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); return path; }
function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function stream() { let text = ''; return { write(value) { text += value; }, get text() { return text; } }; }
