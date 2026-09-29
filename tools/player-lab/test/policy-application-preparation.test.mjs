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
import { generateAndWritePolicyDiff, preparePolicyReview } from '../src/policy-review-approval.mjs';
import { POLICY_APPLICATION_VERSION, prepareAndWritePolicyApplication, preparePolicyApplication, renderRuntimePolicy } from '../src/policy-application-preparation.mjs';
import { runPreparePolicyApplicationCli } from '../src/prepare-policy-application-cli.mjs';
import { writeStagedArtifactOutput } from '../src/staged-json-output.mjs';
import { deriveAndWriteTargetObservations, inspectPlayerHelperRegistry, parsePlayerHelperRegistry } from '../src/target-observation-generator.mjs';

const fixture = (caseName, name) => fileURLToPath(new URL(`./fixtures/target-observation-generator/${caseName}/${name}`, import.meta.url));
const runtimePath = fileURLToPath(new URL('../../../app-gv/src/main/assets/gv_media_observer/content.js', import.meta.url));
const runtimeBytes = readFileSync(runtimePath);
const fixedNow = () => new Date('2026-07-26T16:00:00.000Z');
const choices = {
  cvm: { policyId: 'cvm-tv-embedded-vimeo', runtimePlayerFamily: 'embedded-vimeo', idleClass: 'kf-cvm-vimeo-transport-idle', styleId: 'kf-cvm-vimeo-transport-autohide-style' },
  reviewer: { policyId: 'reviewer-vimeo-embedded-vimeo', runtimePlayerFamily: 'embedded-vimeo', idleClass: 'kf-reviewer-vimeo-transport-idle', styleId: 'kf-reviewer-vimeo-transport-autohide-style' },
};

test('real no-change, synthetic add/update, rejected, and changes-requested form the explicit 4I-A result matrix', () => {
  const root = mkdtempSync(join(tmpdir(), 'policy-application-results-'));
  try {
    const runtimeHashBefore = digest(runtimeBytes);
    const cvm = build4HResult(join(root, 'cvm'), 'cvm', runtimePath);
    const noChange = prepareAndWritePolicyApplication({ ...cvm.application, outputRoot: join(root, 'no-change'), now: fixedNow });
    assert.equal(noChange.plan.applicationVersion, POLICY_APPLICATION_VERSION);
    assert.equal(noChange.plan.changeType, 'no-change');
    assert.equal(noChange.plan.preparationStatus, 'no-op');
    assert.equal(noChange.plan.writeRequired, false);
    assert.equal(noChange.plan.runtimeSourceSha256Before, noChange.plan.runtimeSourceSha256Prepared);
    assert.equal(noChange.plan.applicationStatus, 'not-applied');
    assert.deepEqual(readdirSync(noChange.outputDir).sort(), ['policy-application-plan.json', 'policy-application-provenance.json']);
    const noProposed = preparePolicyApplication({ ...cvm.application, proposedPolicyPath: undefined, now: fixedNow });
    assert.equal(noProposed.plan.proposedPolicyBinding, null);
    assert.equal(noProposed.preparedContent, null);
    assert.equal(digest(readFileSync(runtimePath)), runtimeHashBefore);

    const addRuntime = join(root, 'add-runtime.js');
    copyFileSync(runtimePath, addRuntime);
    const reviewer = build4HResult(join(root, 'reviewer'), 'reviewer', addRuntime);
    const add = prepareAndWritePolicyApplication({ ...reviewer.application, outputRoot: join(root, 'add'), now: fixedNow });
    assert.equal(add.plan.changeType, 'add-policy');
    assert.equal(add.plan.preparationStatus, 'prepared');
    assert.equal(add.plan.writeRequired, true);
    assert.notEqual(add.plan.runtimeSourceSha256Before, add.plan.runtimeSourceSha256Prepared);
    assert.equal(add.plan.applicationStatus, 'not-applied');
    const addPrepared = readFileSync(join(add.outputDir, 'prepared-content.js'), 'utf8');
    for (const field of ['oneOwnedTimer', 'interactionReveal', 'pagehideCleanup', 'urlFreeDiagnostics']) assert.equal(addPrepared.includes(field), false);
    const addPolicies = parsePlayerHelperRegistry(addPrepared);
    assert.equal(addPolicies.length, 2);
    assert.deepEqual(addPolicies[0], parsePlayerHelperRegistry(runtimeBytes.toString('utf8'))[0]);
    assert.deepEqual(addPolicies[1], reviewer.proposedPolicy);

    const updateRuntime = join(root, 'update-runtime.js');
    writeFileSync(updateRuntime, runtimeBytes.toString('utf8').replace('idleMs: 3200', 'idleMs: 3000'));
    const update4H = build4HResult(join(root, 'update'), 'cvm', updateRuntime);
    const update = prepareAndWritePolicyApplication({ ...update4H.application, outputRoot: join(root, 'update-output'), now: fixedNow });
    assert.equal(update.plan.changeType, 'update-policy');
    assert.equal(update.plan.writeRequired, true);
    assert.deepEqual(update.plan.changedFieldPaths, ['capabilities.transportAutohide.idleMs']);
    assert.equal(parsePlayerHelperRegistry(readFileSync(join(update.outputDir, 'prepared-content.js'), 'utf8'))[0].capabilities.transportAutohide.idleMs, 3200);

    for (const decision of ['rejected', 'changes-requested']) {
      const rejected = build4HResult(join(root, decision), 'reviewer', addRuntime, decision);
      const outputRoot = join(root, `${decision}-output`);
      assert.throws(() => prepareAndWritePolicyApplication({ ...reviewer.application, reviewDecisionPath: rejected.reviewDecisionPath, outputRoot, now: fixedNow }), /requires an approved/);
      assert.equal(existsSync(outputRoot), false);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('add and update preserve exact source bytes outside the one approved registry change', () => {
  const root = mkdtempSync(join(tmpdir(), 'policy-application-preservation-'));
  try {
    const addRuntime = join(root, 'add-runtime.js');
    copyFileSync(runtimePath, addRuntime);
    const reviewer = build4HResult(join(root, 'reviewer'), 'reviewer', addRuntime);
    const add = preparePolicyApplication({ ...reviewer.application, now: fixedNow });
    const addRegion = add.manifest.changedRegion;
    const addBefore = readFileSync(addRuntime);
    const addAfter = Buffer.from(add.preparedContent, 'utf8');
    assert.deepEqual(addAfter.subarray(0, addRegion.byteOffset), addBefore.subarray(0, addRegion.byteOffset));
    assert.deepEqual(addAfter.subarray(addRegion.byteOffset + addRegion.insertedByteLength), addBefore.subarray(addRegion.byteOffset));
    const beforeLayout = inspectPlayerHelperRegistry(addBefore.toString('utf8'));
    const afterLayout = inspectPlayerHelperRegistry(add.preparedContent);
    assert.equal(afterLayout.entries[0].wrapper, beforeLayout.entries[0].wrapper);

    const onePolicyUpdateRuntime = join(root, 'one-policy-update-runtime.js');
    writeFileSync(onePolicyUpdateRuntime, runtimeBytes.toString('utf8').replace('idleMs: 3200', 'idleMs: 3000'));
    const update4H = build4HResult(join(root, 'update'), 'cvm', onePolicyUpdateRuntime);
    const twoPolicyRuntime = join(root, 'two-policy-update-runtime.js');
    writeFileSync(twoPolicyRuntime, add.preparedContent.replace('idleMs: 3200', 'idleMs: 3000'));
    const reboundUpdate = rebindRuntimeArtifacts(join(root, 'two-policy-rebound'), update4H, twoPolicyRuntime);
    const update = preparePolicyApplication({ ...reboundUpdate, now: fixedNow });
    const updateRegion = update.manifest.changedRegion;
    const updateBefore = readFileSync(twoPolicyRuntime);
    const updateAfter = Buffer.from(update.preparedContent, 'utf8');
    assert.deepEqual(updateAfter.subarray(0, updateRegion.byteOffset), updateBefore.subarray(0, updateRegion.byteOffset));
    assert.deepEqual(updateAfter.subarray(updateRegion.byteOffset + updateRegion.insertedByteLength), updateBefore.subarray(updateRegion.byteOffset + updateRegion.removedByteLength));
    const updateBeforeLayout = inspectPlayerHelperRegistry(updateBefore.toString('utf8'));
    const updateAfterLayout = inspectPlayerHelperRegistry(update.preparedContent);
    assert.equal(updateAfterLayout.entries[1].wrapper, updateBeforeLayout.entries[1].wrapper);
    assert.deepEqual(updateAfterLayout.entries[1].policy, reviewer.proposedPolicy);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('deterministic renderer and staged UTF-8 output remain bounded and collision safe', () => {
  const root = mkdtempSync(join(tmpdir(), 'policy-application-renderer-'));
  try {
    const addRuntime = join(root, 'runtime.js');
    copyFileSync(runtimePath, addRuntime);
    const reviewer = build4HResult(join(root, 'reviewer'), 'reviewer', addRuntime);
    const firstRender = renderRuntimePolicy(reviewer.proposedPolicy);
    assert.equal(renderRuntimePolicy(reviewer.proposedPolicy), firstRender);
    const renderedPolicies = parsePlayerHelperRegistry(`const PLAYER_HELPER_REGISTRY = Object.freeze([\n${firstRender}\n]);`);
    assert.deepEqual(renderedPolicies, [reviewer.proposedPolicy]);
    assert.doesNotMatch(firstRender, /\beval\s*\(|\bFunction\s*\(/);

    const first = prepareAndWritePolicyApplication({ ...reviewer.application, outputRoot: join(root, 'outputs'), now: fixedNow });
    const second = prepareAndWritePolicyApplication({ ...reviewer.application, outputRoot: join(root, 'outputs'), now: fixedNow });
    assert.notEqual(first.outputDir, second.outputDir);
    assert.deepEqual(readdirSync(first.outputDir).sort(), ['policy-application-plan.json', 'policy-application-provenance.json', 'prepared-content-manifest.json', 'prepared-content.js']);
    assert.equal(readdirSync(join(root, 'outputs')).some((name) => name.startsWith('.incomplete-')), false);
    const badNameRoot = join(root, 'bad-name');
    assert.throws(() => writeStagedArtifactOutput({ outputRoot: badNameRoot, artifacts: { 'other.js': { type: 'utf8-text', value: 'safe' } } }), /UTF-8 text artifact/);
    assert.equal(existsSync(badNameRoot), false);
    const badTypeRoot = join(root, 'bad-type');
    assert.throws(() => writeStagedArtifactOutput({ outputRoot: badTypeRoot, artifacts: { 'prepared-content.js': { type: 'arbitrary', value: 'safe' } } }), /unsupported/);
    assert.equal(existsSync(badTypeRoot), false);
    const linkedRoot = join(root, 'linked-root');
    symlinkSync(join(root, 'outputs'), linkedRoot);
    assert.throws(() => prepareAndWritePolicyApplication({ ...reviewer.application, outputRoot: linkedRoot, now: fixedNow }), /real regular directory/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('tampered, stale, unsafe, malformed, or mixed application chains fail before output allocation', () => {
  const root = mkdtempSync(join(tmpdir(), 'policy-application-tampering-'));
  try {
    const runtime = join(root, 'runtime.js');
    copyFileSync(runtimePath, runtime);
    const reviewer = build4HResult(join(root, 'reviewer'), 'reviewer', runtime);
    const baseArtifacts = {
      reviewDecisionPath: reviewer.reviewDecisionPath,
      diffProvenancePath: reviewer.diffProvenancePath,
      policyDiffPath: reviewer.policyDiffPath,
      proposedPolicyPath: reviewer.proposedPolicyPath,
    };
    const cases = [
      ['pending review', 'reviewDecisionPath', (value) => { value.decision = 'pending'; }],
      ['rejected review', 'reviewDecisionPath', (value) => { value.decision = 'rejected'; }],
      ['changes requested', 'reviewDecisionPath', (value) => { value.decision = 'changes-requested'; }],
      ['unsupported deletion', 'policyDiffPath', (value) => { value.changeType = 'delete-policy'; }],
      ['changeType mismatch', 'policyDiffPath', (value) => { value.changeType = 'update-policy'; }],
      ['policyId mismatch', 'policyDiffPath', (value) => { value.policyId = 'other-policy'; }],
      ['provider mismatch', 'policyDiffPath', (value) => { value.providerId = 'other-provider'; }],
      ['target mismatch', 'policyDiffPath', (value) => { value.targetId = 'other-target'; }],
      ['family mismatch', 'policyDiffPath', (value) => { value.normalizedPlayerFamily = 'native-html5'; }],
      ['policyBefore mismatch', 'policyDiffPath', (value) => { value.policyBefore = value.policyAfter; }],
      ['policyAfter mismatch', 'policyDiffPath', (value) => { value.policyAfter.capabilities.transportAutohide.idleMs = 4100; }],
      ['changedFieldPaths mismatch', 'policyDiffPath', (value) => { value.changedFieldPaths.pop(); }],
      ['engine field', 'policyDiffPath', (value) => { value.policyAfter.oneOwnedTimer = true; }],
      ['unknown field', 'policyDiffPath', (value) => { value.notes = 'anything'; }],
      ['reviewer identity', 'diffProvenancePath', (value) => { value.reviewerIdentity = 'reviewer'; }],
      ['raw URL', 'proposedPolicyPath', (value) => { value.id = 'https://bad.test'; }],
      ['local path', 'proposedPolicyPath', (value) => { value.id = '/Users/private/source'; }],
      ['credential', 'proposedPolicyPath', (value) => { value.id = 'Authorization: Bearer secret'; }],
      ['token', 'proposedPolicyPath', (value) => { value.id = 'access-token=secret'; }],
      ['email', 'proposedPolicyPath', (value) => { value.id = 'person@example.test'; }],
      ['query matching path', 'proposedPolicyPath', (value) => { value.match.pathPrefix = '/event/?token'; }],
      ['unsafe selector', 'proposedPolicyPath', (value) => { value.capabilities.transportAutohide.selectors = ['javascript:bad']; }],
      ['unsafe idleClass', 'proposedPolicyPath', (value) => { value.capabilities.transportAutohide.idleClass = '.bad'; }],
      ['unsafe styleId', 'proposedPolicyPath', (value) => { value.capabilities.transportAutohide.styleId = 'bad style'; }],
      ['implementation provenance', 'diffProvenancePath', (value) => { value.implementationChoices.policyId.value = 'other-policy'; }],
    ];
    for (const [name, key, mutate] of cases) {
      const value = JSON.parse(readFileSync(baseArtifacts[key], 'utf8'));
      mutate(value);
      const path = writeJson(join(root, `${name.replaceAll(' ', '-')}.json`), value);
      const outputRoot = join(root, `output-${name.replaceAll(' ', '-')}`);
      assert.throws(() => prepareAndWritePolicyApplication({ ...reviewer.application, [key]: path, outputRoot, now: fixedNow }), undefined, name);
      assert.equal(existsSync(outputRoot), false, name);
    }
    for (const [name, key] of [
      ['stale review-decision hash', 'reviewDecisionPath'],
      ['stale diff-provenance hash', 'diffProvenancePath'],
      ['stale policy-diff hash', 'policyDiffPath'],
      ['stale proposed-policy hash', 'proposedPolicyPath'],
    ]) {
      const path = join(root, `${name}.json`);
      writeFileSync(path, `${readFileSync(baseArtifacts[key], 'utf8')}\n`);
      const outputRoot = join(root, `output-${name}`);
      assert.throws(() => prepareAndWritePolicyApplication({ ...reviewer.application, [key]: path, outputRoot, now: fixedNow }), /exact bytes/);
      assert.equal(existsSync(outputRoot), false);
    }
    const staleRuntime = join(root, 'stale-runtime.js');
    writeFileSync(staleRuntime, `${runtimeBytes.toString('utf8')}\n`);
    const staleRuntimeOutput = join(root, 'stale-runtime-output');
    assert.throws(() => prepareAndWritePolicyApplication({ ...reviewer.application, runtimeSourcePath: staleRuntime, outputRoot: staleRuntimeOutput, now: fixedNow }), /bind/);
    assert.equal(existsSync(staleRuntimeOutput), false);
    const malformedJson = join(root, 'malformed.json');
    writeFileSync(malformedJson, '{bad');
    const malformedOutput = join(root, 'malformed-output');
    assert.throws(() => prepareAndWritePolicyApplication({ ...reviewer.application, policyDiffPath: malformedJson, outputRoot: malformedOutput, now: fixedNow }), /Malformed/);
    assert.equal(existsSync(malformedOutput), false);
    const malformedRuntime = join(root, 'malformed-runtime.js');
    writeFileSync(malformedRuntime, runtimeBytes.toString('utf8').replace('const PLAYER_HELPER_REGISTRY', 'const PLAYER_HELPER_REGISTRY_MISSING'));
    const reboundMalformed = rebindRuntimeArtifacts(join(root, 'malformed-rebound'), reviewer, malformedRuntime);
    const malformedRuntimeOutput = join(root, 'malformed-runtime-output');
    assert.throws(() => prepareAndWritePolicyApplication({ ...reboundMalformed, outputRoot: malformedRuntimeOutput, now: fixedNow }), /registry is missing/);
    assert.equal(existsSync(malformedRuntimeOutput), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('runtime identity takeover and duplicate-policy preparations fail closed', () => {
  const root = mkdtempSync(join(tmpdir(), 'policy-application-takeover-'));
  try {
    const runtime = join(root, 'runtime.js');
    copyFileSync(runtimePath, runtime);
    const reviewer = build4HResult(join(root, 'reviewer'), 'reviewer', runtime);
    const validAdd = preparePolicyApplication({ ...reviewer.application, now: fixedNow });

    const alreadyPresent = join(root, 'already-present.js');
    writeFileSync(alreadyPresent, validAdd.preparedContent);
    const reboundPresent = rebindRuntimeArtifacts(join(root, 'present-chain'), reviewer, alreadyPresent);
    const presentOutput = join(root, 'present-output');
    assert.throws(() => prepareAndWritePolicyApplication({ ...reboundPresent, outputRoot: presentOutput, now: fixedNow }), /duplicate or take over/);
    assert.equal(existsSync(presentOutput), false);

    const claimedProvider = join(root, 'claimed-provider.js');
    writeFileSync(claimedProvider, validAdd.preparedContent.replace('"reviewer-vimeo-embedded-vimeo"', '"other-reviewer-policy"'));
    const reboundClaimed = rebindRuntimeArtifacts(join(root, 'claimed-chain'), reviewer, claimedProvider);
    const claimedOutput = join(root, 'claimed-output');
    assert.throws(() => prepareAndWritePolicyApplication({ ...reboundClaimed, outputRoot: claimedOutput, now: fixedNow }), /duplicate or take over/);
    assert.equal(existsSync(claimedOutput), false);

    const duplicateRuntime = join(root, 'duplicate-runtime.js');
    const layout = inspectPlayerHelperRegistry(validAdd.preparedContent);
    const duplicated = `${validAdd.preparedContent.slice(0, layout.entries[1].wrapperEnd)},\n${layout.entries[1].wrapper}${validAdd.preparedContent.slice(layout.entries[1].wrapperEnd)}`;
    writeFileSync(duplicateRuntime, duplicated);
    const reboundDuplicate = rebindRuntimeArtifacts(join(root, 'duplicate-chain'), reviewer, duplicateRuntime);
    const duplicateOutput = join(root, 'duplicate-output');
    assert.throws(() => prepareAndWritePolicyApplication({ ...reboundDuplicate, outputRoot: duplicateOutput, now: fixedNow }), /duplicate policy IDs/);
    assert.equal(existsSync(duplicateOutput), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('physical source boundaries reject final and intermediate symlinks without path disclosure', async () => {
  const root = mkdtempSync(join(tmpdir(), 'policy-application-physical-'));
  try {
    const runtime = join(root, 'runtime.js');
    copyFileSync(runtimePath, runtime);
    const reviewer = build4HResult(join(root, 'reviewer'), 'reviewer', runtime);
    const finalLink = join(root, 'proposed-link.json');
    symlinkSync(reviewer.proposedPolicyPath, finalLink);
    const finalOutput = join(root, 'final-output');
    assert.throws(() => prepareAndWritePolicyApplication({ ...reviewer.application, proposedPolicyPath: finalLink, outputRoot: finalOutput, now: fixedNow }), /regular non-symlink/);
    assert.equal(existsSync(finalOutput), false);

    const isolated = await createIsolatedApplicationHarness(join(root, 'isolated-repository'), reviewer);
    const outside = join(root, 'outside-runtime');
    replaceIntermediateDirectoryWithOutsideSymlink(isolated.options.runtimeSourcePath, outside, runtimeBytes);
    const outputRoot = join(isolated.repositoryRoot, 'tools/player-lab/reports/application-test');
    let error;
    try { isolated.module.prepareAndWritePolicyApplication({ ...isolated.options, outputRoot, now: fixedNow }); } catch (caught) { error = caught; }
    assert.ok(error);
    assert.equal(error.message, 'Policy application source physical path escapes the repository.');
    assert.equal(error.message.includes(isolated.repositoryRoot), false);
    assert.equal(error.message.includes(outside), false);
    assert.equal(existsSync(outputRoot), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CLI is strict, offline, sanitized, one-line, and contains no Android-write or process execution API', async () => {
  const root = mkdtempSync(join(tmpdir(), 'policy-application-cli-'));
  try {
    const runtime = join(root, 'runtime.js');
    copyFileSync(runtimePath, runtime);
    const reviewer = build4HResult(join(root, 'reviewer'), 'reviewer', runtime);
    const base = applicationCliArgs(reviewer.application);
    for (const argv of [['--help'], [], ['--review-decision'], ['--unknown'], [...base, '--policy-diff', reviewer.policyDiffPath], [...base, '--runtime-source']]) {
      const stdout = stream();
      const stderr = stream();
      const code = await runPreparePolicyApplicationCli(argv, { stdout, stderr });
      if (argv[0] === '--help') assert.equal(code, 0); else assert.equal(code, 1);
    }
    const stdout = stream();
    const stderr = stream();
    const outputRoot = join(root, 'external-output');
    assert.equal(await runPreparePolicyApplicationCli([...base, '--runtime-source', runtime, '--output-dir', outputRoot], { stdout, stderr }), 0, stderr.text);
    assert.equal(stderr.text, '');
    assert.equal(stdout.text.trim().split('\n').length, 1);
    assert.equal(existsSync(stdout.text.trim()), true);
    const cvm = build4HResult(join(root, 'cvm'), 'cvm', runtimePath);
    const cvmOut = stream();
    const cvmErr = stream();
    assert.equal(await runPreparePolicyApplicationCli([...applicationCliArgs(cvm.application), '--runtime-source', runtimePath, '--output-dir', join(root, 'cvm-output')], { stdout: cvmOut, stderr: cvmErr }), 0, cvmErr.text);
    assert.equal(JSON.parse(readFileSync(join(cvmOut.text.trim(), 'policy-application-plan.json'), 'utf8')).preparationStatus, 'no-op');
    for (const forbidden of [fileURLToPath(new URL('../../../app/forbidden-4i-output', import.meta.url)), fileURLToPath(new URL('../../../app-gv/forbidden-4i-output', import.meta.url))]) {
      const out = stream();
      const err = stream();
      assert.equal(await runPreparePolicyApplicationCli([...base, '--runtime-source', runtime, '--output-dir', forbidden], { stdout: out, stderr: err }), 1);
      assert.equal(existsSync(forbidden), false);
    }
    const linkedRuntime = join(root, 'runtime-link.js');
    symlinkSync(runtime, linkedRuntime);
    const linkOut = stream();
    const linkErr = stream();
    assert.equal(await runPreparePolicyApplicationCli([...base, '--runtime-source', linkedRuntime, '--output-dir', join(root, 'link-output')], { stdout: linkOut, stderr: linkErr }), 1);
    assert.equal(linkErr.text.includes(root), false);
    const malformed = join(root, 'malformed.json');
    writeFileSync(malformed, '{bad');
    const malformedOut = stream();
    const malformedErr = stream();
    assert.equal(await runPreparePolicyApplicationCli([...base.slice(0, 4), '--policy-diff', malformed, '--proposed-policy', reviewer.proposedPolicyPath, '--runtime-source', runtime, '--output-dir', join(root, 'malformed-output')], { stdout: malformedOut, stderr: malformedErr }), 1);
    assert.equal(malformedErr.text.includes(root), false);

    const implementation = readFileSync(fileURLToPath(new URL('../src/policy-application-preparation.mjs', import.meta.url)), 'utf8');
    const cli = readFileSync(fileURLToPath(new URL('../src/prepare-policy-application-cli.mjs', import.meta.url)), 'utf8');
    for (const source of [implementation, cli]) {
      assert.doesNotMatch(source, /from ['"](?:playwright|node:https?|node:net|node:child_process|.*browser-runtime)/);
      assert.doesNotMatch(source, /\b(?:exec|spawn|execFile|fork)\s*\(/);
      assert.doesNotMatch(source, /\b(?:git|gradle|adb)\b/i);
    }
    assert.doesNotMatch(implementation, /\b(?:writeFileSync|renameSync|copyFileSync)\b/);
    assert.doesNotMatch(implementation, /\beval\s*\(|\bFunction\s*\(/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

function build4HResult(root, kind, runtimeSourcePath, decision = 'approved') {
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
  const chain = { analysisPath, candidatePath, targetObservationsPath, engineCertificationPath, assembledObservationsPath, recommendationPath: proposal.jsonPath, runtimeSourcePath };
  const template = preparePolicyReview({ ...chain, now: fixedNow }).template;
  const reviewPath = writeJson(join(root, 'completed-review.json'), completeReview(template, decision, choices[kind]));
  const generated = generateAndWritePolicyDiff({ ...chain, reviewPath, outputRoot: join(root, '4h-output'), now: fixedNow });
  const result = {
    reviewDecisionPath: join(generated.outputDir, 'policy-review-decision.json'),
    diffProvenancePath: join(generated.outputDir, 'policy-diff-provenance.json'),
    runtimeSourcePath,
  };
  if (decision === 'approved') {
    result.policyDiffPath = join(generated.outputDir, 'player-helper-policy-diff.json');
    result.proposedPolicyPath = join(generated.outputDir, 'proposed-player-helper-policy.json');
    result.proposedPolicy = JSON.parse(readFileSync(result.proposedPolicyPath, 'utf8'));
  }
  return { ...result, application: result };
}

function completeReview(template, decision, implementationChoices) {
  const review = structuredClone(template);
  review.decision = decision;
  if (decision === 'approved') {
    review.implementationChoices = structuredClone(implementationChoices);
    review.acknowledgements = { evidenceChainReviewed: true, targetFieldsReviewed: true, engineGuaranteesRemainSeparate: true, noAutomaticAndroidApplication: true };
  }
  return review;
}

function rebindRuntimeArtifacts(root, source, runtimeSourcePath) {
  mkdirSync(root, { recursive: true });
  const runtimeSha256 = digest(readFileSync(runtimeSourcePath));
  const runtimeArtifactId = `external-runtime-source-${runtimeSha256.slice(0, 24)}`;
  const decision = JSON.parse(readFileSync(source.reviewDecisionPath, 'utf8'));
  const diff = JSON.parse(readFileSync(source.policyDiffPath, 'utf8'));
  decision.evidenceBindings.runtimeSource = { artifactId: runtimeArtifactId, sha256: runtimeSha256 };
  diff.evidenceBindings.runtimeSource = { artifactId: runtimeArtifactId, sha256: runtimeSha256 };
  diff.runtimeSourceArtifactId = runtimeArtifactId;
  diff.runtimeSourceSha256Before = runtimeSha256;
  return {
    reviewDecisionPath: writeJson(join(root, 'decision.json'), decision),
    diffProvenancePath: source.diffProvenancePath,
    policyDiffPath: writeJson(join(root, 'diff.json'), diff),
    proposedPolicyPath: source.proposedPolicyPath,
    runtimeSourcePath,
  };
}

async function createIsolatedApplicationHarness(repositoryRoot, source) {
  mkdirSync(repositoryRoot, { recursive: true });
  repositoryRoot = realpathSync(repositoryRoot);
  const playerLabRoot = join(repositoryRoot, 'tools/player-lab');
  mkdirSync(playerLabRoot, { recursive: true });
  cpSync(fileURLToPath(new URL('../src', import.meta.url)), join(playerLabRoot, 'src'), { recursive: true });
  const options = {};
  for (const [key, sourcePath] of [
    ['reviewDecisionPath', source.reviewDecisionPath],
    ['diffProvenancePath', source.diffProvenancePath],
    ['policyDiffPath', source.policyDiffPath],
    ['proposedPolicyPath', source.proposedPolicyPath],
  ]) {
    const destination = join(playerLabRoot, 'test-inputs', key, basename(sourcePath));
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(sourcePath, destination);
    options[key] = destination;
  }
  const runtimeSourcePath = join(repositoryRoot, 'app-gv/src/main/assets/gv_media_observer/content.js');
  mkdirSync(dirname(runtimeSourcePath), { recursive: true });
  copyFileSync(source.runtimeSourcePath, runtimeSourcePath);
  options.runtimeSourcePath = runtimeSourcePath;
  const modulePath = join(playerLabRoot, 'src/policy-application-preparation.mjs');
  const module = await import(`${pathToFileURL(modulePath).href}?harness=${encodeURIComponent(repositoryRoot)}`);
  return { repositoryRoot, module, options };
}

function replaceIntermediateDirectoryWithOutsideSymlink(logicalPath, outsideDirectory, bytes) {
  const logicalDirectory = dirname(logicalPath);
  rmSync(logicalDirectory, { recursive: true, force: true });
  mkdirSync(outsideDirectory, { recursive: true });
  writeFileSync(join(outsideDirectory, basename(logicalPath)), bytes);
  symlinkSync(outsideDirectory, logicalDirectory);
}

function applicationCliArgs(options) {
  return [
    '--review-decision', options.reviewDecisionPath,
    '--diff-provenance', options.diffProvenancePath,
    '--policy-diff', options.policyDiffPath,
    '--proposed-policy', options.proposedPolicyPath,
  ];
}
function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); return path; }
function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function stream() { let text = ''; return { write(value) { text += value; }, get text() { return text; } }; }
