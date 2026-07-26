import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertProviderId } from './redact-url.mjs';
import { assertSafeHelperProposal, resolveSafePlayerLabReportsOutputRoot } from './helper-proposal.mjs';
import { DEFAULT_ENGINE_SOURCE_PATH } from './helper-engine-contract.mjs';
import { POLICY_DIFF_VERSION, POLICY_REVIEW_VERSION, REVIEWED_FIELD_PATHS } from './policy-review-approval.mjs';
import { inspectPlayerHelperRegistry, parsePlayerHelperRegistry } from './target-observation-generator.mjs';
import { writeStagedArtifactOutput } from './staged-json-output.mjs';

export const POLICY_APPLICATION_VERSION = '0.1.0-checkpoint4i';
const PLAYER_LAB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY_ROOT = resolve(PLAYER_LAB_ROOT, '..', '..');
const REAL_REPOSITORY_ROOT = realpathSync(REPOSITORY_ROOT);
const DEFAULT_OUTPUT_ROOT = resolve(PLAYER_LAB_ROOT, 'reports', 'policy-application-preparations');
const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_ARTIFACT_ID = /^[a-z0-9][a-z0-9._/-]{0,239}$/i;
const SAFE_POLICY_ID = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
const SAFE_DOM_ID = /^[a-z][a-z0-9-]{0,119}$/;
const SAFE_HOST = /^[a-z0-9.-]{1,253}$/;
const SAFE_SELECTOR = (value) => typeof value === 'string' && value.length > 0 && value.length <= 160 && /^[\x20-\x7e]+$/.test(value) && !/[\u0000-\u001f\u007f]|:\/\/|<|>|\{|\}|;|@import|javascript:/i.test(value);
const ENGINE_ONLY_FIELDS = ['oneOwnedTimer', 'interactionReveal', 'pagehideCleanup', 'urlFreeDiagnostics'];
const CHANGE_TYPES = ['no-change', 'add-policy', 'update-policy'];
const IMPLEMENTATION_FIELDS = ['policyId', 'runtimePlayerFamily', 'idleClass', 'styleId'];

export function preparePolicyApplication({
  reviewDecisionPath,
  diffProvenancePath,
  policyDiffPath,
  proposedPolicyPath,
  runtimeSourcePath = DEFAULT_ENGINE_SOURCE_PATH,
  now = () => new Date(),
} = {}) {
  const decision = readJsonArtifact(reviewDecisionPath, 'Policy review decision', 'policy-review-decision');
  validateReviewDecision(decision.value);
  if (decision.value.decision !== 'approved') throw new Error('Policy application preparation requires an approved review decision.');

  const provenance = readJsonArtifact(diffProvenancePath, 'Policy diff provenance', 'diff-provenance');
  const diff = readJsonArtifact(policyDiffPath, 'Policy diff', 'policy-diff');
  const proposed = proposedPolicyPath ? readJsonArtifact(proposedPolicyPath, 'Proposed policy', 'proposed-policy') : null;
  const runtime = readSourceArtifact(runtimeSourcePath, 'Runtime source', 'runtime-source');
  validateDiffProvenance(provenance.value);
  validatePolicyDiff(diff.value);
  if (proposed) validateRuntimePolicy(proposed.value);
  validateApplicationChain({ decision, provenance, diff, proposed, runtime });

  const runtimeText = exactUtf8(runtime.bytes, 'Runtime source');
  const layout = inspectPlayerHelperRegistry(runtimeText);
  const preparation = prepareRuntimeChange({ layout, runtimeText, diff: diff.value, proposed: proposed?.value ?? null });
  const preparedBytes = Buffer.from(preparation.preparedText, 'utf8');
  const preparedSha256 = digest(preparedBytes);
  if (preparation.changeType === 'no-change' && preparedSha256 !== runtime.sha256) throw new Error('No-change preparation altered runtime source bytes.');
  if (preparation.changeType !== 'no-change' && preparedSha256 === runtime.sha256) throw new Error('Prepared runtime source did not change for an add or update.');

  const generatedAt = now().toISOString();
  if (Number.isNaN(Date.parse(generatedAt))) throw new Error('Policy application generatedAt is invalid.');
  const inputBindings = {
    reviewDecision: binding(decision),
    diffProvenance: binding(provenance),
    policyDiff: binding(diff),
    proposedPolicy: proposed ? binding(proposed) : null,
    runtimeSource: binding(runtime),
  };
  const preparedSourceArtifactId = preparation.writeRequired ? `prepared-content-${preparedSha256.slice(0, 24)}` : null;
  const plan = {
    schemaVersion: 1,
    applicationVersion: POLICY_APPLICATION_VERSION,
    authority: 'approved-policy-application-preparation',
    decision: 'approved',
    changeType: diff.value.changeType,
    policyId: diff.value.policyId,
    providerId: diff.value.providerId,
    targetId: diff.value.targetId,
    normalizedPlayerFamily: diff.value.normalizedPlayerFamily,
    runtimePlayerFamily: diff.value.runtimePlayerFamily,
    runtimeSourceArtifactId: runtime.artifactId,
    runtimeSourceSha256Before: runtime.sha256,
    runtimeSourceSha256Prepared: preparedSha256,
    preparedSourceArtifactId,
    writeRequired: preparation.writeRequired,
    preparationStatus: preparation.writeRequired ? 'prepared' : 'no-op',
    changedFieldPaths: clone(diff.value.changedFieldPaths),
    reviewDecisionBinding: binding(decision),
    diffProvenanceBinding: binding(provenance),
    policyDiffBinding: binding(diff),
    proposedPolicyBinding: proposed ? binding(proposed) : null,
    generatedAt,
    applicationStatus: 'not-applied',
  };
  const applicationProvenance = {
    schemaVersion: 1,
    applicationVersion: POLICY_APPLICATION_VERSION,
    authority: 'approved-policy-application-preparation-provenance',
    inputBindings,
    approvedEvidenceBindings: clone(decision.value.evidenceBindings),
    completedReviewBinding: clone(decision.value.reviewBinding),
    implementationChoiceProvenance: clone(diff.value.implementationChoiceProvenance),
    currentRuntimePolicy: clone(diff.value.policyBefore),
    proposedRuntimePolicy: clone(diff.value.policyAfter),
    sourcePreservation: clone(preparation.sourcePreservation),
    generatedAt,
    applicationStatus: 'not-applied',
  };
  const manifest = preparation.writeRequired ? {
    schemaVersion: 1,
    applicationVersion: POLICY_APPLICATION_VERSION,
    runtimeSourceSha256Before: runtime.sha256,
    runtimeSourceSha256Prepared: preparedSha256,
    byteSizeBefore: runtime.bytes.length,
    byteSizePrepared: preparedBytes.length,
    registryPolicyIdsBefore: layout.entries.map((entry) => entry.policy.id),
    registryPolicyIdsAfter: preparation.afterPolicies.map((policy) => policy.id),
    policyCountBefore: layout.entries.length,
    policyCountAfter: preparation.afterPolicies.length,
    changedRegion: preparation.changedRegion,
    bytesOutsideAllowedRegistryRegionUnchanged: true,
    applicationStatus: 'not-applied',
  } : null;
  for (const artifact of [plan, applicationProvenance, manifest].filter(Boolean)) assertSafeHelperProposal(artifact);
  assertNoEnginePolicyFields(diff.value.policyAfter);
  return deepFreeze({
    plan,
    provenance: applicationProvenance,
    manifest,
    preparedContent: preparation.writeRequired ? preparation.preparedText : null,
  });
}

export function prepareAndWritePolicyApplication({ outputRoot, now = () => new Date(), ...options } = {}) {
  const result = preparePolicyApplication({ ...options, now });
  const root = resolveSafePlayerLabReportsOutputRoot(outputRoot, DEFAULT_OUTPUT_ROOT);
  const artifacts = {
    'policy-application-plan.json': { type: 'json', value: result.plan },
    'policy-application-provenance.json': { type: 'json', value: result.provenance },
    ...(result.preparedContent === null ? {} : {
      'prepared-content.js': { type: 'utf8-text', value: result.preparedContent },
      'prepared-content-manifest.json': { type: 'json', value: result.manifest },
    }),
  };
  return writeStagedArtifactOutput({
    outputRoot: root,
    now,
    artifacts,
    result: { plan: result.plan, provenance: result.provenance, manifest: result.manifest },
  });
}

function validateReviewDecision(value) {
  const keys = ['schemaVersion', 'reviewVersion', 'authority', 'decision', 'providerId', 'targetId', 'playerFamily', 'evidenceBindings', 'reviewBinding', 'policyProposalGenerated', 'policyDiffGenerated', 'applicationStatus', 'generatedAt'];
  if (!plain(value) || !sameKeys(value, keys) || value.schemaVersion !== 1 || value.reviewVersion !== POLICY_REVIEW_VERSION || value.authority !== 'explicit-reviewer-policy-review') throw new Error('Policy review decision has an unsupported schema.');
  if (!['approved', 'rejected', 'changes-requested'].includes(value.decision)) throw new Error('Policy review decision is invalid.');
  assertProviderId(value.providerId);
  assertProviderId(value.targetId);
  if (value.playerFamily !== 'vimeo' || value.applicationStatus !== 'not-applied' || typeof value.policyProposalGenerated !== 'boolean' || typeof value.policyDiffGenerated !== 'boolean' || Number.isNaN(Date.parse(value.generatedAt))) throw new Error('Policy review decision state is invalid.');
  validateEvidenceBindings(value.evidenceBindings);
  validateBinding(value.reviewBinding);
  assertSafeHelperProposal(value);
}

function validateDiffProvenance(value) {
  const keys = ['schemaVersion', 'diffVersion', 'observedTargetFields', 'certifiedEngineContract', 'recommendation', 'reviewerApproval', 'implementationChoices', 'currentRuntimePolicy', 'generatedDiff'];
  if (!plain(value) || !sameKeys(value, keys) || value.schemaVersion !== 1 || value.diffVersion !== POLICY_DIFF_VERSION || !same(value.observedTargetFields, REVIEWED_FIELD_PATHS)) throw new Error('Policy diff provenance has an unsupported schema.');
  validateBinding(value.certifiedEngineContract);
  validateBinding(value.recommendation);
  if (!plain(value.reviewerApproval) || !sameKeys(value.reviewerApproval, ['decision', 'reviewArtifactId', 'reviewSha256']) || value.reviewerApproval.decision !== 'approved') throw new Error('Policy diff provenance reviewer approval is invalid.');
  validateArtifactId(value.reviewerApproval.reviewArtifactId);
  if (!SHA256.test(value.reviewerApproval.reviewSha256)) throw new Error('Policy diff provenance review hash is invalid.');
  if (!plain(value.implementationChoices) || !sameKeys(value.implementationChoices, IMPLEMENTATION_FIELDS)) throw new Error('Policy diff implementation-choice provenance is invalid.');
  for (const field of IMPLEMENTATION_FIELDS) {
    const choice = value.implementationChoices[field];
    if (!plain(choice) || !sameKeys(choice, ['authority', 'value']) || choice.authority !== 'reviewer-supplied-implementation-choice') throw new Error('Policy diff implementation-choice provenance is invalid.');
  }
  if (value.currentRuntimePolicy !== null) validateRuntimePolicy(value.currentRuntimePolicy);
  if (!plain(value.generatedDiff) || !sameKeys(value.generatedDiff, ['changeType', 'applicationStatus']) || !CHANGE_TYPES.includes(value.generatedDiff.changeType) || value.generatedDiff.applicationStatus !== 'not-applied') throw new Error('Policy diff provenance generated-diff record is invalid.');
  assertSafeHelperProposal(value);
}

function validatePolicyDiff(value) {
  const keys = ['schemaVersion', 'diffVersion', 'changeType', 'policyId', 'providerId', 'targetId', 'normalizedPlayerFamily', 'runtimePlayerFamily', 'runtimeSourceArtifactId', 'runtimeSourceSha256Before', 'policyBefore', 'policyAfter', 'changedFieldPaths', 'evidenceBindings', 'implementationChoiceProvenance', 'generatedAt', 'applicationStatus'];
  if (!plain(value) || !sameKeys(value, keys) || value.schemaVersion !== 1 || value.diffVersion !== POLICY_DIFF_VERSION || !CHANGE_TYPES.includes(value.changeType)) throw new Error('Policy diff has an unsupported schema.');
  if (!SAFE_POLICY_ID.test(value.policyId)) throw new Error('Policy diff policyId is unsafe.');
  assertProviderId(value.providerId);
  assertProviderId(value.targetId);
  if (value.targetId !== value.providerId || value.normalizedPlayerFamily !== 'vimeo' || value.runtimePlayerFamily !== 'embedded-vimeo') throw new Error('Policy diff identity is unsupported.');
  validateArtifactId(value.runtimeSourceArtifactId);
  if (!SHA256.test(value.runtimeSourceSha256Before) || value.applicationStatus !== 'not-applied' || Number.isNaN(Date.parse(value.generatedAt))) throw new Error('Policy diff runtime binding is invalid.');
  if (value.policyBefore !== null) validateRuntimePolicy(value.policyBefore);
  validateRuntimePolicy(value.policyAfter);
  if (!Array.isArray(value.changedFieldPaths) || !value.changedFieldPaths.every(validChangedFieldPath) || new Set(value.changedFieldPaths).size !== value.changedFieldPaths.length) throw new Error('Policy diff changedFieldPaths are invalid.');
  validateEvidenceBindings(value.evidenceBindings);
  if (!plain(value.implementationChoiceProvenance) || !sameKeys(value.implementationChoiceProvenance, IMPLEMENTATION_FIELDS) || Object.values(value.implementationChoiceProvenance).some((authority) => authority !== 'reviewer-supplied-implementation-choice')) throw new Error('Policy diff implementation-choice provenance is invalid.');
  assertNoEnginePolicyFields(value.policyBefore);
  assertNoEnginePolicyFields(value.policyAfter);
  assertSafeHelperProposal(value);
}

function validateApplicationChain({ decision, provenance, diff, proposed, runtime }) {
  const decisionValue = decision.value;
  const provenanceValue = provenance.value;
  const diffValue = diff.value;
  if (!decisionValue.policyProposalGenerated || !decisionValue.policyDiffGenerated) throw new Error('Approved review decision did not authorize a policy diff.');
  if (!same(decisionValue.evidenceBindings, diffValue.evidenceBindings)) throw new Error('Policy diff evidence bindings do not match the approved decision.');
  if (!same(provenanceValue.certifiedEngineContract, decisionValue.evidenceBindings.engineCertification) || !same(provenanceValue.recommendation, decisionValue.evidenceBindings.recommendation)) throw new Error('Policy diff provenance evidence bindings are stale or mixed.');
  if (provenanceValue.reviewerApproval.reviewArtifactId !== decisionValue.reviewBinding.artifactId || provenanceValue.reviewerApproval.reviewSha256 !== decisionValue.reviewBinding.sha256) throw new Error('Policy diff provenance reviewer binding is stale or mixed.');
  if (provenanceValue.generatedDiff.changeType !== diffValue.changeType || provenanceValue.generatedDiff.applicationStatus !== diffValue.applicationStatus) throw new Error('Policy diff provenance classification is stale or mixed.');
  if (!same(provenanceValue.currentRuntimePolicy, diffValue.policyBefore)) throw new Error('Policy diff provenance current policy is stale or mixed.');
  if (decisionValue.generatedAt !== diffValue.generatedAt) throw new Error('Policy review decision and policy diff timestamps are stale or mixed.');
  if (decisionValue.providerId !== diffValue.providerId || decisionValue.targetId !== diffValue.targetId || decisionValue.playerFamily !== diffValue.normalizedPlayerFamily) throw new Error('Policy application identity is stale or mixed.');
  if (diffValue.policyId !== diffValue.policyAfter.id || diffValue.providerId !== diffValue.policyAfter.providerId || diffValue.runtimePlayerFamily !== diffValue.policyAfter.playerFamily) throw new Error('Policy diff after-policy identity is inconsistent.');
  if (diffValue.runtimeSourceArtifactId !== runtime.artifactId || diffValue.runtimeSourceSha256Before !== runtime.sha256) throw new Error('Policy diff does not bind the selected runtime source.');
  if (!same(decisionValue.evidenceBindings.runtimeSource, { artifactId: runtime.artifactId, sha256: runtime.sha256 })) throw new Error('Approved decision does not bind the selected runtime source.');
  const choiceValues = Object.fromEntries(IMPLEMENTATION_FIELDS.map((field) => [field, provenanceValue.implementationChoices[field].value]));
  const expectedChoices = {
    policyId: diffValue.policyId,
    runtimePlayerFamily: diffValue.runtimePlayerFamily,
    idleClass: diffValue.policyAfter.capabilities.transportAutohide.idleClass,
    styleId: diffValue.policyAfter.capabilities.transportAutohide.styleId,
  };
  if (!same(choiceValues, expectedChoices)) throw new Error('Implementation-choice provenance does not match the policy diff.');
  if (!sameKeys(diffValue.implementationChoiceProvenance, IMPLEMENTATION_FIELDS)) throw new Error('Policy diff implementation-choice fields are incomplete.');
  if (diffValue.changeType !== 'no-change' && !proposed) throw new Error('Add and update preparation require the proposed policy artifact.');
  if (proposed && !same(proposed.value, diffValue.policyAfter)) throw new Error('Proposed policy does not match policyAfter.');
}

function prepareRuntimeChange({ layout, runtimeText, diff, proposed }) {
  const policies = layout.entries.map((entry) => entry.policy);
  const byId = layout.entries.filter((entry) => entry.policy.id === diff.policyId);
  if (diff.changeType === 'no-change') {
    if (byId.length !== 1 || diff.policyBefore === null || !same(diff.policyBefore, diff.policyAfter) || !same(byId[0].policy, diff.policyBefore) || diff.changedFieldPaths.length !== 0) throw new Error('No-change policy gate failed.');
    if (proposed && !same(proposed, byId[0].policy)) throw new Error('No-change proposed policy does not match the runtime policy.');
    return {
      changeType: 'no-change',
      writeRequired: false,
      preparedText: runtimeText,
      afterPolicies: policies,
      changedRegion: null,
      sourcePreservation: { mode: 'byte-identical-no-op', prefixUnchanged: true, suffixUnchanged: true, nonTargetPoliciesUnchanged: true },
    };
  }
  if (diff.changeType === 'add-policy') return prepareAddPolicy({ layout, runtimeText, diff, policies });
  return prepareUpdatePolicy({ layout, runtimeText, diff, policies });
}

function prepareAddPolicy({ layout, runtimeText, diff, policies }) {
  if (diff.policyBefore !== null || policies.some((policy) => policy.id === diff.policyId) || policies.some((policy) => policy.providerId === diff.providerId)) throw new Error('Add-policy would duplicate or take over a runtime identity.');
  const expectedPaths = ['$add-policy', ...leafPaths(diff.policyAfter)];
  if (!same(diff.changedFieldPaths, expectedPaths)) throw new Error('Add-policy changedFieldPaths do not match the independent structural addition.');
  const insertionIndex = layout.entries.at(-1)?.wrapperEnd;
  if (!Number.isInteger(insertionIndex)) throw new Error('Add-policy requires an existing bounded registry entry.');
  const rendered = renderRuntimePolicy(diff.policyAfter, 4);
  const insertion = `,\n${rendered}`;
  const prefix = runtimeText.slice(0, insertionIndex);
  const suffix = runtimeText.slice(insertionIndex);
  const preparedText = `${prefix}${insertion}${suffix}`;
  if (!preparedText.startsWith(prefix) || !preparedText.endsWith(suffix)) throw new Error('Add-policy source preservation failed.');
  const afterPolicies = parsePlayerHelperRegistry(preparedText);
  if (!same(afterPolicies, [...policies, diff.policyAfter])) throw new Error('Prepared add-policy registry does not contain exactly the approved policy append.');
  return {
    changeType: 'add-policy',
    writeRequired: true,
    preparedText,
    afterPolicies,
    changedRegion: {
      kind: 'append-policy-entry',
      byteOffset: Buffer.byteLength(prefix, 'utf8'),
      removedByteLength: 0,
      insertedByteLength: Buffer.byteLength(insertion, 'utf8'),
    },
    sourcePreservation: { mode: 'registry-policy-append', prefixUnchanged: true, suffixUnchanged: true, nonTargetPoliciesUnchanged: true },
  };
}

function prepareUpdatePolicy({ layout, runtimeText, diff, policies }) {
  if (diff.policyBefore === null) throw new Error('Update-policy requires policyBefore.');
  const matches = layout.entries.filter((entry) => entry.policy.id === diff.policyId);
  if (matches.length !== 1) throw new Error('Update-policy requires exactly one matching runtime policy.');
  const selected = matches[0];
  if (selected.policy.providerId !== diff.providerId || diff.policyBefore.providerId !== diff.providerId || diff.policyAfter.providerId !== diff.providerId) throw new Error('Update-policy would take over another provider identity.');
  if (!same(selected.policy, diff.policyBefore)) throw new Error('Update-policy policyBefore does not match the runtime policy.');
  const expectedPaths = changedPaths(diff.policyBefore, diff.policyAfter);
  if (!expectedPaths.length || !same(diff.changedFieldPaths, expectedPaths)) throw new Error('Update-policy changedFieldPaths do not match the independent structural diff.');
  const rendered = renderRuntimePolicy(diff.policyAfter, 4);
  const prefix = runtimeText.slice(0, selected.wrapperStart);
  const suffix = runtimeText.slice(selected.wrapperEnd);
  const preparedText = `${prefix}${rendered}${suffix}`;
  if (!preparedText.startsWith(prefix) || !preparedText.endsWith(suffix)) throw new Error('Update-policy source preservation failed.');
  const afterPolicies = parsePlayerHelperRegistry(preparedText);
  const selectedIndex = layout.entries.indexOf(selected);
  const expectedPolicies = policies.map((policy, index) => index === selectedIndex ? diff.policyAfter : policy);
  if (!same(afterPolicies, expectedPolicies)) throw new Error('Prepared update-policy registry does not contain exactly the approved replacement.');
  return {
    changeType: 'update-policy',
    writeRequired: true,
    preparedText,
    afterPolicies,
    changedRegion: {
      kind: 'replace-policy-entry',
      byteOffset: Buffer.byteLength(prefix, 'utf8'),
      removedByteLength: Buffer.byteLength(selected.wrapper, 'utf8'),
      insertedByteLength: Buffer.byteLength(rendered, 'utf8'),
    },
    sourcePreservation: { mode: 'registry-policy-replacement', prefixUnchanged: true, suffixUnchanged: true, nonTargetPoliciesUnchanged: true },
  };
}

export function renderRuntimePolicy(policy, indent = 4) {
  validateRuntimePolicy(policy);
  if (!Number.isInteger(indent) || indent < 0 || indent > 12) throw new Error('Runtime policy indentation is invalid.');
  const i0 = ' '.repeat(indent);
  const i1 = ' '.repeat(indent + 2);
  const i2 = ' '.repeat(indent + 4);
  const i3 = ' '.repeat(indent + 6);
  const match = policy.match;
  const transport = policy.capabilities.transportAutohide;
  return [
    `${i0}Object.freeze({`,
    `${i1}id: ${JSON.stringify(policy.id)},`,
    `${i1}providerId: ${JSON.stringify(policy.providerId)},`,
    `${i1}playerFamily: ${JSON.stringify(policy.playerFamily)},`,
    `${i1}match: Object.freeze({`,
    `${i2}frameHost: ${JSON.stringify(match.frameHost)},`,
    `${i2}allowFrameSubdomains: ${match.allowFrameSubdomains},`,
    `${i2}pathPrefix: ${JSON.stringify(match.pathPrefix)},`,
    `${i2}pathSuffix: ${JSON.stringify(match.pathSuffix)},`,
    `${i2}referrerHosts: Object.freeze(${JSON.stringify(match.referrerHosts)})`,
    `${i1}}),`,
    `${i1}capabilities: Object.freeze({`,
    `${i2}transportAutohide: Object.freeze({`,
    `${i3}enabled: ${transport.enabled},`,
    `${i3}idleMs: ${transport.idleMs},`,
    `${i3}idleClass: ${JSON.stringify(transport.idleClass)},`,
    `${i3}styleId: ${JSON.stringify(transport.styleId)},`,
    `${i3}selectors: Object.freeze(${JSON.stringify(transport.selectors)})`,
    `${i2}})`,
    `${i1}})`,
    `${i0}})`,
  ].join('\n');
}

function validateRuntimePolicy(policy) {
  if (!plain(policy) || !sameKeys(policy, ['id', 'providerId', 'playerFamily', 'match', 'capabilities'])) throw new Error('Runtime policy has an unsupported schema.');
  if (!SAFE_POLICY_ID.test(policy.id)) throw new Error('Runtime policy ID is unsafe.');
  assertProviderId(policy.providerId);
  if (policy.playerFamily !== 'embedded-vimeo') throw new Error('Runtime policy player family is unsupported.');
  const match = policy.match;
  if (!plain(match) || !sameKeys(match, ['frameHost', 'allowFrameSubdomains', 'pathPrefix', 'pathSuffix', 'referrerHosts']) || !SAFE_HOST.test(match.frameHost) || typeof match.allowFrameSubdomains !== 'boolean') throw new Error('Runtime policy matching fields are invalid.');
  for (const field of ['pathPrefix', 'pathSuffix']) if (typeof match[field] !== 'string' || !match[field].startsWith('/') || /[?#]|:\/\//.test(match[field]) || !/^[\x20-\x7e]{1,160}$/.test(match[field])) throw new Error('Runtime policy matching path is unsafe.');
  if (!Array.isArray(match.referrerHosts) || !match.referrerHosts.length || !match.referrerHosts.every((host) => SAFE_HOST.test(host)) || new Set(match.referrerHosts).size !== match.referrerHosts.length) throw new Error('Runtime policy referrer hosts are invalid.');
  if (!plain(policy.capabilities) || !sameKeys(policy.capabilities, ['transportAutohide'])) throw new Error('Runtime policy capabilities are invalid.');
  const transport = policy.capabilities.transportAutohide;
  if (!plain(transport) || !sameKeys(transport, ['enabled', 'idleMs', 'idleClass', 'styleId', 'selectors']) || transport.enabled !== true || !Number.isInteger(transport.idleMs) || transport.idleMs < 500 || transport.idleMs > 10000 || !SAFE_DOM_ID.test(transport.idleClass) || !SAFE_DOM_ID.test(transport.styleId) || /javascript|url/i.test(transport.idleClass) || /javascript|url/i.test(transport.styleId) || !Array.isArray(transport.selectors) || !transport.selectors.length || !transport.selectors.every(SAFE_SELECTOR) || new Set(transport.selectors).size !== transport.selectors.length) throw new Error('Runtime policy transport fields are invalid.');
  assertNoEnginePolicyFields(policy);
  assertSafeHelperProposal(policy);
}

function validateEvidenceBindings(value) {
  const keys = ['analysis', 'candidate', 'targetObservations', 'engineCertification', 'assembledObservations', 'recommendation', 'runtimeSource'];
  if (!plain(value) || !sameKeys(value, keys)) throw new Error('Approved evidence bindings have an unsupported schema.');
  for (const bindingValue of Object.values(value)) validateBinding(bindingValue);
}

function validateBinding(value) {
  if (!plain(value) || !sameKeys(value, ['artifactId', 'sha256'])) throw new Error('Application source binding has an unsupported schema.');
  validateArtifactId(value.artifactId);
  if (!SHA256.test(value.sha256)) throw new Error('Application source binding SHA-256 is invalid.');
}

function validateArtifactId(value) {
  if (typeof value !== 'string' || !SAFE_ARTIFACT_ID.test(value) || isAbsolute(value) || value.includes('\\') || value.split('/').some((part) => !part || part === '..') || /(?:https?:|authorization|bearer|credential|secret|(?:access|auth|api)-?token|@)/i.test(value)) throw new Error('Application source artifact ID is unsafe.');
}

function validChangedFieldPath(value) {
  return value === '$add-policy' || typeof value === 'string' && /^(?:id|providerId|playerFamily|match\.(?:frameHost|allowFrameSubdomains|pathPrefix|pathSuffix|referrerHosts)|capabilities\.transportAutohide\.(?:enabled|idleMs|idleClass|styleId|selectors))$/.test(value);
}

function assertNoEnginePolicyFields(value) {
  if (value === null) return;
  const text = JSON.stringify(value);
  if (ENGINE_ONLY_FIELDS.some((field) => text.includes(`"${field}"`))) throw new Error('Engine-only fields are forbidden in runtime policy data.');
}

function readJsonArtifact(path, label, kind) {
  const artifact = readSourceArtifact(path, label, kind);
  let value;
  try { value = JSON.parse(exactUtf8(artifact.bytes, label)); } catch (error) { throw new Error(`Malformed ${label}: ${error.message}`); }
  const canonicalBytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  if (!canonicalBytes.equals(artifact.bytes)) throw new Error(`${label} exact bytes are not the canonical staged JSON representation.`);
  return { ...artifact, value };
}

function readSourceArtifact(path, label, kind) {
  if (typeof path !== 'string' || !path) throw new Error(`${label} path is required.`);
  const logicalPath = resolve(path);
  const logicalRelative = relative(REPOSITORY_ROOT, logicalPath);
  const logicallyRepositoryOwned = strictlyContained(logicalRelative);
  let stat;
  try { stat = lstatSync(logicalPath); } catch { throw new Error(`${label} must be a regular file.`); }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} must be a regular non-symlink file.`);
  let physicalPath;
  try { physicalPath = realpathSync(logicalPath); } catch { throw new Error(`${label} physical path could not be verified.`); }
  const physicalRelative = relative(REAL_REPOSITORY_ROOT, physicalPath);
  const physicallyRepositoryOwned = strictlyContained(physicalRelative);
  if (logicallyRepositoryOwned && !physicallyRepositoryOwned) throw new Error('Policy application source physical path escapes the repository.');
  const bytes = readFileSync(physicalPath);
  const sha256 = digest(bytes);
  const artifactId = logicallyRepositoryOwned && physicallyRepositoryOwned ? logicalRelative.split(sep).join('/') : `external-${kind}-${sha256.slice(0, 24)}`;
  return { path: physicalPath, bytes, sha256, artifactId };
}

function exactUtf8(bytes, label) {
  const text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes)) throw new Error(`${label} must contain exact UTF-8 bytes.`);
  return text;
}

function strictlyContained(path) { return Boolean(path) && path !== '..' && !path.startsWith(`..${sep}`) && !path.startsWith(sep) && !isAbsolute(path); }
function binding(artifact) { return { artifactId: artifact.artifactId, sha256: artifact.sha256 }; }
function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function leafPaths(value, prefix = '') { if (!plain(value)) return [prefix]; return Object.keys(value).sort().flatMap((key) => leafPaths(value[key], prefix ? `${prefix}.${key}` : key)); }
function changedPaths(before, after) { return [...new Set([...leafPaths(before), ...leafPaths(after)])].filter((path) => !same(readPath(before, path), readPath(after, path))).sort(); }
function readPath(value, path) { return path.split('.').reduce((current, key) => current?.[key], value); }
function same(left, right) { return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right)); }
function canonical(value) { if (Array.isArray(value)) return value.map(canonical); if (plain(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])); return value; }
function sameKeys(value, keys) { return Object.keys(value).sort().join('|') === [...keys].sort().join('|'); }
function plain(value) { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function clone(value) { return structuredClone(value); }
function deepFreeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); } return value; }
