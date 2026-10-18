import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertProviderId } from './redact-url.mjs';
import { PLAYER_FAMILIES } from './player-families.mjs';
import { UNSUPPORTED_REQUIREMENTS, assertSafeHelperProposal, createHelperRecommendation, resolveSafePlayerLabReportsOutputRoot } from './helper-proposal.mjs';
import { bridgeAnalysisToHelperEvidence, validateCapabilityObservations } from './helper-evidence-bridge.mjs';
import { assembleCapabilityObservations, DEFAULT_ENGINE_SOURCE_PATH, validateEngineCertification, validateTargetObservation } from './helper-engine-contract.mjs';
import { parsePlayerHelperRegistry, TARGET_OBSERVATION_CANDIDATE_VERSION } from './target-observation-generator.mjs';
import { writeStagedJsonOutput } from './staged-json-output.mjs';

export const POLICY_REVIEW_VERSION = '0.1.0-checkpoint4h';
export const POLICY_DIFF_VERSION = '0.1.0-checkpoint4h';
export const REVIEWED_FIELD_PATHS = Object.freeze([
  'providerId',
  'targetId',
  'playerFamily',
  'trustedMatchingEvidence.frameHost',
  'trustedMatchingEvidence.allowFrameSubdomains',
  'trustedMatchingEvidence.pathPrefix',
  'trustedMatchingEvidence.pathSuffix',
  'trustedMatchingEvidence.referrerHosts',
  'transportAutohide.enabled',
  'transportAutohide.idleMs',
  'transportAutohide.selectors',
]);
const ENGINE_ONLY_FIELDS = ['oneOwnedTimer', 'interactionReveal', 'pagehideCleanup', 'urlFreeDiagnostics'];
const DIRECT_CAPABILITIES = ['enabled', 'idleMs', 'selectors'];
const PLAYER_LAB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY_ROOT = resolve(PLAYER_LAB_ROOT, '..', '..');
const REAL_REPOSITORY_ROOT = realpathSync(REPOSITORY_ROOT);
const DEFAULT_REVIEW_OUTPUT_ROOT = resolve(PLAYER_LAB_ROOT, 'reports', 'policy-reviews');
const DEFAULT_DIFF_OUTPUT_ROOT = resolve(PLAYER_LAB_ROOT, 'reports', 'policy-diffs');
const RUNTIME_SOURCE_ARTIFACT_ID = 'app-gv/src/main/assets/gv_media_observer/content.js';
const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_ARTIFACT_ID = /^[a-z0-9][a-z0-9._/-]{0,239}$/i;
const MATCHING_FIELDS = ['frameHost', 'allowFrameSubdomains', 'pathPrefix', 'pathSuffix', 'referrerHosts'];
const CANDIDATE_FIELD_PATHS = Object.freeze([
  'providerId', 'targetId', 'playerFamily', 'analysisSha256',
  ...MATCHING_FIELDS.map((field) => `trustedMatchingEvidence.${field}`),
  'transportAutohide.enabled', 'transportAutohide.idleMs', 'transportAutohide.selectors',
  'providerSpecificBehavior', 'conflictingEvidence',
]);
const SET_LIKE_FIELDS = new Set(['trustedMatchingEvidence.referrerHosts', 'transportAutohide.selectors']);
const DOWNGRADE_REASONS = new Set(['target-observation-incomplete', 'advanced-requirements-preserved', 'provider-specific-orchestration']);
const SOURCE_BINDING_CONTRACTS = Object.freeze({
  'validated-analysis': {
    authority: 'validated-analysis-derivation',
    required: [],
    optional: [],
  },
  'canonical-profile-report': {
    authority: 'canonical-profile-observation',
    required: ['reportSha256', 'profilerVersion', 'profileAnalysisBinding'],
    optional: ['reportId', 'runId', 'sourceReportReference'],
  },
  'test-support-profile-adapter': {
    authority: 'test-support-profile-observation',
    required: ['analysisSha256'],
    optional: [],
  },
  'registered-target-metadata': {
    authority: 'registered-target-metadata',
    required: [],
    optional: ['analysisSha256'],
  },
  'existing-approved-policy': {
    authority: 'existing-approved-policy',
    required: ['sourcePlayerFamily', 'normalizedPlayerFamily', 'familyNormalizationRule'],
    optional: [],
  },
  'bounded-reviewer-input': {
    authority: 'reviewer-supplied',
    required: ['analysisSha256'],
    optional: [],
  },
  'structured-characterization': {
    authority: 'structured-characterization',
    required: ['analysisSha256', 'adapterVersion', 'characterizationKind', 'basisArtifact', 'basisSha256', 'behaviorEvidence'],
    optional: [],
  },
  'characterization-basis': {
    authority: 'validated-characterization-basis',
    required: ['analysisSha256'],
    optional: [],
    targetIdOptional: true,
  },
});
const SOURCE_CONTRACT_FIELDS = new Set(['sourceCapabilityKey', 'normalizedCapabilityType', 'capabilityNormalizationRule', 'idleClass', 'styleId']);

export function preparePolicyReview(options = {}) {
  const chain = validateEvidenceChain(options);
  return deepFreeze({ template: createReviewTemplate(chain, options.now ?? (() => new Date())) });
}

export function prepareAndWritePolicyReview({ outputRoot, now = () => new Date(), ...options } = {}) {
  const { template } = preparePolicyReview({ ...options, now });
  const root = resolveSafePlayerLabReportsOutputRoot(outputRoot, DEFAULT_REVIEW_OUTPUT_ROOT);
  return writeStagedJsonOutput({ outputRoot: root, now, artifacts: { 'policy-review-template.json': template }, result: { template } });
}

export function generatePolicyDiff({ reviewPath, now = () => new Date(), ...options } = {}) {
  const chain = validateEvidenceChain(options);
  const reviewArtifact = readJsonArtifact(reviewPath, 'Completed policy review', 'policy-review');
  validateCompletedReview(reviewArtifact.value, chain);
  const review = reviewArtifact.value;
  const evidenceBindings = evidenceBindingsFrom(chain);
  const reviewBinding = { artifactId: reviewArtifact.artifactId, sha256: reviewArtifact.sha256 };
  const approved = review.decision === 'approved';
  let proposedPolicy = null;
  let policyDiff = null;
  let classification = { changeType: null, policyBefore: null };
  if (approved) {
    proposedPolicy = createProposedPolicy(chain.target.value, review.implementationChoices);
    classification = classifyPolicyChange(chain, proposedPolicy);
    policyDiff = createPolicyDiff(chain, review, proposedPolicy, classification, evidenceBindings, now);
  }
  const decision = {
    schemaVersion: 1,
    reviewVersion: POLICY_REVIEW_VERSION,
    authority: 'explicit-reviewer-policy-review',
    decision: review.decision,
    providerId: chain.analysis.value.providerId,
    targetId: chain.analysis.value.targetId,
    playerFamily: chain.analysis.value.evidenceSummary.primaryPlayerFamily,
    evidenceBindings,
    reviewBinding,
    policyProposalGenerated: approved,
    policyDiffGenerated: approved,
    applicationStatus: 'not-applied',
    generatedAt: now().toISOString(),
  };
  const provenance = {
    schemaVersion: 1,
    diffVersion: POLICY_DIFF_VERSION,
    observedTargetFields: [...REVIEWED_FIELD_PATHS],
    certifiedEngineContract: evidenceBindings.engineCertification,
    recommendation: evidenceBindings.recommendation,
    reviewerApproval: { decision: review.decision, reviewArtifactId: reviewArtifact.artifactId, reviewSha256: reviewArtifact.sha256 },
    implementationChoices: approved ? Object.fromEntries(Object.keys(review.implementationChoices).map((field) => [field, { authority: 'reviewer-supplied-implementation-choice', value: review.implementationChoices[field] }])) : {},
    currentRuntimePolicy: approved ? classification.policyBefore : null,
    generatedDiff: approved ? { changeType: classification.changeType, applicationStatus: 'not-applied' } : null,
  };
  for (const artifact of [decision, provenance, proposedPolicy, policyDiff].filter(Boolean)) assertSafeHelperProposal(artifact);
  assertEngineFieldsSeparated({ decision, provenance, proposedPolicy, policyDiff });
  return deepFreeze({ decision, provenance, proposedPolicy, policyDiff });
}

export function generateAndWritePolicyDiff({ outputRoot, now = () => new Date(), ...options } = {}) {
  const result = generatePolicyDiff({ ...options, now });
  const artifacts = {
    'policy-review-decision.json': result.decision,
    'policy-diff-provenance.json': result.provenance,
    ...(result.proposedPolicy ? { 'proposed-player-helper-policy.json': result.proposedPolicy, 'player-helper-policy-diff.json': result.policyDiff } : {}),
  };
  const root = resolveSafePlayerLabReportsOutputRoot(outputRoot, DEFAULT_DIFF_OUTPUT_ROOT);
  return writeStagedJsonOutput({ outputRoot: root, now, artifacts, result });
}

function validateEvidenceChain({ analysisPath, candidatePath, targetObservationsPath, engineCertificationPath, assembledObservationsPath, recommendationPath, runtimeSourcePath = DEFAULT_ENGINE_SOURCE_PATH } = {}) {
  const analysis = readJsonArtifact(analysisPath, 'Analysis', 'analysis');
  validateAnalysis(analysis.value);
  const candidate = readJsonArtifact(candidatePath, 'Target observation candidate', 'candidate');
  const target = readJsonArtifact(targetObservationsPath, 'Target observations', 'target-observations');
  const certification = readJsonArtifact(engineCertificationPath, 'Engine certification', 'engine-certification');
  const assembled = readJsonArtifact(assembledObservationsPath, 'Assembled observations', 'assembled-observations');
  const recommendation = readJsonArtifact(recommendationPath, 'Recommendation', 'recommendation');
  const runtime = readSourceArtifact(runtimeSourcePath, 'Runtime source', 'runtime-source');

  validateTargetObservation(target.value, analysis.value, analysis.sha256);
  validateCandidate(candidate.value, analysis, target.value);
  validateCandidateTargetAgreement(candidate.value, target.value);
  if (!sameKeys(certification.value, ['schemaVersion', 'contractVersion', 'engineId', 'playerFamily', 'sourceArtifact', 'sourceSha256', 'registryPolicyCount', 'transportEngineCount', 'timerImplementationCount', 'supportedGuarantees', 'approvedSelectors', 'diagnosticFields', 'certificationChecks', 'certificationStatus', 'generatedAt'])) throw new Error('Engine certification has an unsupported schema.');
  validateEngineCertification(certification.value, { sourcePath: runtime.path });
  if (certification.value.certificationStatus !== 'certified' || certification.value.sourceSha256 !== runtime.sha256 || certification.value.sourceArtifact !== RUNTIME_SOURCE_ARTIFACT_ID) throw new Error('Engine certification does not bind the selected runtime source.');
  validateCapabilityObservations(assembled.value, analysis.value, analysis.sha256);
  const freshAssembly = assembleCapabilityObservations({ analysisPath: analysis.path, targetObservationsPath: target.path, engineCertificationPath: certification.path, sourcePath: runtime.path });
  if (!same(assembled.value, freshAssembly.observations)) throw new Error('Assembled observations are stale or mixed.');
  validateRecommendation(recommendation.value, analysis, assembled.value);
  const runtimePolicies = parsePlayerHelperRegistry(runtime.bytes.toString('utf8'));
  const chain = { analysis, candidate, target, certification, assembled, recommendation, runtime, runtimePolicies };
  for (const artifact of [candidate.value, target.value, certification.value, assembled.value, recommendation.value]) assertSafeHelperProposal(artifact);
  return chain;
}

function validateAnalysis(value) {
  if (!plain(value) || value.schemaVersion !== 1 || !plain(value.evidenceSummary)) throw new Error('Analysis artifact is invalid.');
  assertProviderId(value.providerId);
  if (value.targetId == null) throw new Error('Policy review requires a targetId.');
  assertProviderId(value.targetId);
  if (!PLAYER_FAMILIES.includes(value.evidenceSummary.primaryPlayerFamily)) throw new Error('Analysis player family is invalid.');
}

function validateCandidate(value, analysis, target) {
  if (!plain(value) || value.schemaVersion !== 1 || value.candidateVersion !== TARGET_OBSERVATION_CANDIDATE_VERSION) throw new Error('Candidate contract is invalid.');
  if (!sameKeys(value, ['schemaVersion', 'candidateVersion', 'providerId', 'targetId', 'playerFamily', 'analysisSha256', 'sourceBindings', 'targetObservationCandidate', 'fieldProvenance', 'unavailableFields', 'conflictingFields', 'downgradeReasons', 'candidateStatus', 'generatedAt'])) throw new Error('Candidate contract contains unknown or missing fields.');
  if (value.providerId !== analysis.value.providerId || value.targetId !== analysis.value.targetId || value.playerFamily !== analysis.value.evidenceSummary.primaryPlayerFamily || value.analysisSha256 !== analysis.sha256) throw new Error('Candidate identity or analysis binding is stale or mixed.');
  assertProviderId(value.providerId);
  assertProviderId(value.targetId);
  if (!PLAYER_FAMILIES.includes(value.playerFamily) || !SHA256.test(value.analysisSha256)) throw new Error('Candidate identity fields are invalid.');
  validateCandidateState(value);
  const bindings = validateCandidateSourceBindings(value.sourceBindings, value);
  validateCandidateFieldProvenance(value.fieldProvenance, bindings, value, target);
  const observed = value.targetObservationCandidate;
  if (!plain(observed) || !sameKeys(observed, ['trustedMatchingEvidence', 'transportAutohide', 'unsupportedRequirements', 'providerSpecificBehavior', 'conflictingEvidence'])) throw new Error('Candidate target observation has an unsupported schema.');
  if (!plain(observed.trustedMatchingEvidence) || !sameKeys(observed.trustedMatchingEvidence, MATCHING_FIELDS) || !plain(observed.transportAutohide) || !sameKeys(observed.transportAutohide, DIRECT_CAPABILITIES)) throw new Error('Candidate target observation fields are incomplete or unknown.');
  rejectCandidateOnlyFields(observed);
  if (value.candidateStatus !== 'ready-for-review') throw new Error('Candidate is not eligible for policy review.');
  if (observed.providerSpecificBehavior === true || observed.conflictingEvidence === true || !Array.isArray(observed.unsupportedRequirements) || observed.unsupportedRequirements.length) throw new Error('Candidate requires provider-specific or advanced behavior.');
}

function validateCandidateState(candidate) {
  if (!Array.isArray(candidate.conflictingFields) || !candidate.conflictingFields.every((field) => CANDIDATE_FIELD_PATHS.includes(field)) || new Set(candidate.conflictingFields).size !== candidate.conflictingFields.length) throw new Error('Candidate conflictingFields are invalid.');
  const unavailablePaths = new Set([...CANDIDATE_FIELD_PATHS, 'profileAnalysisBinding']);
  if (!Array.isArray(candidate.unavailableFields) || !candidate.unavailableFields.every((field) => unavailablePaths.has(field)) || new Set(candidate.unavailableFields).size !== candidate.unavailableFields.length) throw new Error('Candidate unavailableFields are invalid.');
  if (!Array.isArray(candidate.downgradeReasons) || !candidate.downgradeReasons.every((reason) => DOWNGRADE_REASONS.has(reason)) || new Set(candidate.downgradeReasons).size !== candidate.downgradeReasons.length) throw new Error('Candidate downgradeReasons are invalid.');
  if (!['ready-for-review', 'insufficient-evidence', 'conflicting-evidence', 'provider-specific', 'engine-extension-study'].includes(candidate.candidateStatus)) throw new Error('Candidate status is invalid.');
  if (candidate.candidateStatus === 'ready-for-review' && (candidate.conflictingFields.some((field) => REVIEWED_FIELD_PATHS.includes(field)) || candidate.unavailableFields.some((field) => REVIEWED_FIELD_PATHS.includes(field)))) throw new Error('Ready candidate has a reviewed-field conflict or unavailability.');
  if (candidate.candidateStatus === 'ready-for-review' && candidate.downgradeReasons.some((reason) => reason === 'advanced-requirements-preserved' || reason === 'provider-specific-orchestration')) throw new Error('Ready candidate has an incompatible downgrade reason.');
}

function validateCandidateSourceBindings(sourceBindings, candidate) {
  if (!Array.isArray(sourceBindings) || sourceBindings.length === 0) throw new Error('Candidate sourceBindings must be a non-empty array.');
  const seen = new Set();
  const bindings = new Map();
  for (const binding of sourceBindings) {
    if (!plain(binding)) throw new Error('Candidate source binding must be an object.');
    const contract = SOURCE_BINDING_CONTRACTS[binding.kind];
    if (!contract) throw new Error('Candidate source binding kind is unrecognised.');
    const base = ['kind', 'authorityType', 'artifactId', 'sha256', 'schemaVersion', 'providerId', 'playerFamily'];
    if (!contract.targetIdOptional || Object.hasOwn(binding, 'targetId')) base.push('targetId');
    const expected = [...base, ...contract.required, ...contract.optional.filter((field) => Object.hasOwn(binding, field))];
    if (!sameKeys(binding, expected)) throw new Error('Candidate source binding contains unknown or missing fields.');
    if (binding.authorityType !== contract.authority) throw new Error('Candidate source binding authority is unrecognised.');
    validateArtifactId(binding.artifactId);
    if (!SHA256.test(binding.sha256)) throw new Error('Candidate source binding SHA-256 is invalid.');
    if (binding.providerId !== null) assertProviderId(binding.providerId);
    if (Object.hasOwn(binding, 'targetId') && binding.targetId !== null) assertProviderId(binding.targetId);
    if (binding.playerFamily !== null && !PLAYER_FAMILIES.includes(binding.playerFamily)) throw new Error('Candidate source binding player family is invalid.');
    if (!(binding.schemaVersion === null || Number.isInteger(binding.schemaVersion))) throw new Error('Candidate source binding schema version is invalid.');
    validateBindingSpecificFields(binding);
    assertSafeHelperProposal(binding);
    const duplicateKey = `${binding.kind}\u0000${binding.artifactId}\u0000${binding.sha256}`;
    if (seen.has(duplicateKey)) throw new Error('Candidate source binding is duplicated.');
    seen.add(duplicateKey);
    const referenceKey = `${binding.artifactId}\u0000${binding.sha256}\u0000${binding.authorityType}`;
    if (bindings.has(referenceKey)) throw new Error('Candidate source binding reference is ambiguous.');
    bindings.set(referenceKey, binding);
  }
  const analysisBindings = sourceBindings.filter((binding) => binding.kind === 'validated-analysis');
  if (analysisBindings.length !== 1) throw new Error('Candidate must contain exactly one validated-analysis source binding.');
  const analysisBinding = analysisBindings[0];
  if (analysisBinding.sha256 !== candidate.analysisSha256 || analysisBinding.providerId !== candidate.providerId || analysisBinding.targetId !== candidate.targetId || analysisBinding.playerFamily !== candidate.playerFamily) throw new Error('Candidate validated-analysis source binding is stale or mixed.');
  return bindings;
}

function validateBindingSpecificFields(binding) {
  for (const field of ['analysisSha256', 'reportSha256', 'basisSha256']) if (Object.hasOwn(binding, field) && !SHA256.test(binding[field])) throw new Error(`Candidate source binding ${field} is invalid.`);
  for (const field of ['profilerVersion', 'reportId', 'runId', 'sourceReportReference', 'adapterVersion', 'characterizationKind', 'sourcePlayerFamily', 'normalizedPlayerFamily', 'familyNormalizationRule']) {
    if (Object.hasOwn(binding, field) && (typeof binding[field] !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,119}$/i.test(binding[field]))) throw new Error(`Candidate source binding ${field} is invalid.`);
  }
  if (Object.hasOwn(binding, 'normalizedPlayerFamily') && !PLAYER_FAMILIES.includes(binding.normalizedPlayerFamily)) throw new Error('Candidate normalized player family is invalid.');
  if (Object.hasOwn(binding, 'basisArtifact')) validateArtifactId(binding.basisArtifact);
  if (Object.hasOwn(binding, 'behaviorEvidence') && (!Array.isArray(binding.behaviorEvidence) || !binding.behaviorEvidence.length || !binding.behaviorEvidence.every((item) => typeof item === 'string' && /^[a-z0-9][a-z0-9-]{0,119}$/.test(item)))) throw new Error('Candidate characterization behavior evidence is invalid.');
  if (Object.hasOwn(binding, 'profileAnalysisBinding') && binding.profileAnalysisBinding !== 'unavailable') throw new Error('Candidate canonical profile analysis binding is invalid.');
}

function validateCandidateFieldProvenance(fieldProvenance, bindings, candidate, target) {
  if (!Array.isArray(fieldProvenance) || fieldProvenance.length === 0) throw new Error('Candidate fieldProvenance must be a non-empty array.');
  const supportedReviewed = new Set();
  for (const record of fieldProvenance) {
    if (!plain(record)) throw new Error('Candidate field provenance must be an object.');
    const unavailable = record.status === 'unavailable';
    const expected = unavailable
      ? ['fieldPath', 'normalizedValue', 'authorityType', 'sourceArtifactId', 'sourceSha256', 'sourceField', 'status', 'reason']
      : ['fieldPath', 'normalizedValue', 'authorityType', 'sourceArtifactId', 'sourceSha256', 'sourceField', 'status', ...(Object.hasOwn(record, 'normalizationRule') ? ['normalizationRule'] : [])];
    if (!sameKeys(record, expected)) throw new Error('Candidate field provenance contains unknown or missing fields.');
    validateProvenanceFieldPath(record.fieldPath);
    rejectCandidateOnlyFields({ fieldPath: record.fieldPath, sourceField: record.sourceField });
    assertSafeHelperProposal(record);
    if (unavailable) {
      if (record.authorityType !== 'unavailable' || record.normalizedValue !== null || record.sourceArtifactId !== null || record.sourceSha256 !== null || record.sourceField !== null || typeof record.reason !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9 .-]{0,199}$/.test(record.reason)) throw new Error('Candidate unavailable provenance record is invalid.');
      if (REVIEWED_FIELD_PATHS.includes(record.fieldPath)) throw new Error('Reviewed candidate field provenance may not be unavailable.');
      continue;
    }
    if (!['supported', 'conflicting'].includes(record.status)) throw new Error('Candidate field provenance status is invalid.');
    if (record.fieldPath === 'profileAnalysisBinding') throw new Error('Candidate profileAnalysisBinding provenance must be unavailable.');
    validateArtifactId(record.sourceArtifactId);
    if (!SHA256.test(record.sourceSha256) || typeof record.sourceField !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9.[\]_" -]{0,199}$/.test(record.sourceField)) throw new Error('Candidate field provenance source is invalid.');
    if (Object.hasOwn(record, 'normalizationRule') && (typeof record.normalizationRule !== 'string' || !/^[a-z0-9][a-z0-9-]{0,119}$/.test(record.normalizationRule))) throw new Error('Candidate provenance normalization rule is invalid.');
    const binding = bindings.get(`${record.sourceArtifactId}\u0000${record.sourceSha256}\u0000${record.authorityType}`);
    if (!binding) throw new Error('Candidate field provenance does not reference a matching source binding.');
    rejectCandidateOnlyFields(record.normalizedValue);
    if (REVIEWED_FIELD_PATHS.includes(record.fieldPath)) {
      if (record.status !== 'supported') throw new Error('Reviewed candidate field provenance must be supported.');
      const expectedValue = reviewedFieldValue(candidate, target, record.fieldPath);
      if (!equivalentProvenanceValue(record.normalizedValue, expectedValue, record.fieldPath)) throw new Error(`Candidate field provenance value disagrees with ${record.fieldPath}.`);
      supportedReviewed.add(record.fieldPath);
    } else if (CANDIDATE_FIELD_PATHS.includes(record.fieldPath)) {
      const expectedValue = candidateFieldValue(candidate, target, record.fieldPath);
      if (expectedValue !== undefined && !equivalentProvenanceValue(record.normalizedValue, expectedValue, record.fieldPath)) throw new Error(`Candidate field provenance value disagrees with ${record.fieldPath}.`);
    } else if (record.fieldPath.startsWith('unsupportedRequirements.')) {
      const requirement = record.fieldPath.slice('unsupportedRequirements.'.length);
      if (!UNSUPPORTED_REQUIREMENTS.includes(requirement) || record.normalizedValue !== requirement || !candidate.targetObservationCandidate.unsupportedRequirements.includes(requirement)) throw new Error('Candidate unsupported-requirement provenance is invalid.');
    }
  }
  for (const fieldPath of REVIEWED_FIELD_PATHS) if (!supportedReviewed.has(fieldPath)) throw new Error(`Candidate is missing supported provenance for ${fieldPath}.`);
}

function validateProvenanceFieldPath(fieldPath) {
  const requirementPrefix = 'unsupportedRequirements.';
  if (typeof fieldPath !== 'string' || (!CANDIDATE_FIELD_PATHS.includes(fieldPath) && fieldPath !== 'profileAnalysisBinding' && !(fieldPath.startsWith(requirementPrefix) && UNSUPPORTED_REQUIREMENTS.includes(fieldPath.slice(requirementPrefix.length))))) throw new Error('Candidate provenance fieldPath is invalid.');
}

function reviewedFieldValue(candidate, target, fieldPath) {
  if (fieldPath === 'providerId' || fieldPath === 'targetId' || fieldPath === 'playerFamily') return candidate[fieldPath];
  return fieldPath.split('.').reduce((value, key) => value?.[key], target);
}
function candidateFieldValue(candidate, target, fieldPath) {
  if (fieldPath === 'analysisSha256') return candidate.analysisSha256;
  return reviewedFieldValue(candidate, target, fieldPath);
}

function equivalentProvenanceValue(actual, expected, fieldPath) {
  if (!SET_LIKE_FIELDS.has(fieldPath)) return same(actual, expected);
  return Array.isArray(actual) && Array.isArray(expected) && same([...new Set(actual)].sort(), [...new Set(expected)].sort());
}

function validateArtifactId(artifactId) {
  if (typeof artifactId !== 'string' || !SAFE_ARTIFACT_ID.test(artifactId) || isAbsolute(artifactId) || artifactId.includes('\\') || artifactId.split('/').some((part) => part === '..' || part === '') || /(?:https?:|authorization|bearer|credential|secret|(?:access|auth|api)-?token|@)/i.test(artifactId)) throw new Error('Candidate source artifact ID is unsafe.');
}

function rejectCandidateOnlyFields(value) {
  const visit = (item) => {
    if (Array.isArray(item)) return item.forEach(visit);
    if (!plain(item)) return;
    for (const [key, child] of Object.entries(item)) {
      if (ENGINE_ONLY_FIELDS.includes(key) || SOURCE_CONTRACT_FIELDS.has(key)) throw new Error('Candidate contains an engine-only or source-contract-only field.');
      visit(child);
    }
  };
  visit(value);
  for (const text of [value?.fieldPath, value?.sourceField].filter((item) => typeof item === 'string')) {
    if ([...ENGINE_ONLY_FIELDS, ...SOURCE_CONTRACT_FIELDS].some((field) => text.split(/[.[\]]/).includes(field))) throw new Error('Candidate provenance contains an engine-only or source-contract-only field.');
  }
}

function validateCandidateTargetAgreement(candidate, target) {
  const expected = {
    trustedMatchingEvidence: target.trustedMatchingEvidence,
    transportAutohide: target.transportAutohide,
    unsupportedRequirements: target.unsupportedRequirements,
    providerSpecificBehavior: target.providerSpecificBehavior,
    conflictingEvidence: target.conflictingEvidence,
  };
  if (!same(candidate.targetObservationCandidate, expected)) throw new Error('Promoted target observations do not match the reviewed candidate.');
  if (!same(target.sourceEvidenceReferences, ['target-observation-candidate'])) throw new Error('Promoted target observation source is invalid.');
}

function validateRecommendation(value, analysis, assembled) {
  if (!plain(value) || value.recommendationCategory !== 'direct-registry-policy') throw new Error('Recommendation is not direct-registry-policy.');
  if (value.providerId !== analysis.value.providerId || value.targetId !== analysis.value.targetId || value.playerFamily !== analysis.value.evidenceSummary.primaryPlayerFamily) throw new Error('Recommendation identity is stale or mixed.');
  const bridged = bridgeAnalysisToHelperEvidence({ analysis: analysis.value, analysisSha256: analysis.sha256, observations: assembled });
  const fresh = createHelperRecommendation(bridged.evidence, { generatedAt: value.generatedAt });
  if (!same(value, fresh)) throw new Error('Recommendation is stale or does not match assembled observations.');
}

function createReviewTemplate(chain, now) {
  const template = {
    schemaVersion: 1,
    reviewVersion: POLICY_REVIEW_VERSION,
    authority: 'explicit-reviewer-policy-review',
    decision: 'pending',
    providerId: chain.analysis.value.providerId,
    targetId: chain.analysis.value.targetId,
    playerFamily: chain.analysis.value.evidenceSummary.primaryPlayerFamily,
    analysisSha256: chain.analysis.sha256,
    candidateSha256: chain.candidate.sha256,
    targetObservationsSha256: chain.target.sha256,
    engineCertificationSha256: chain.certification.sha256,
    assembledObservationsSha256: chain.assembled.sha256,
    recommendationSha256: chain.recommendation.sha256,
    runtimeSourceArtifactId: chain.runtime.artifactId,
    runtimeSourceSha256: chain.runtime.sha256,
    recommendationCategory: 'direct-registry-policy',
    reviewedFieldPaths: [...REVIEWED_FIELD_PATHS],
    implementationChoices: { policyId: null, runtimePlayerFamily: null, idleClass: null, styleId: null },
    acknowledgements: { evidenceChainReviewed: false, targetFieldsReviewed: false, engineGuaranteesRemainSeparate: false, noAutomaticAndroidApplication: false },
    generatedAt: now().toISOString(),
  };
  assertSafeHelperProposal(template);
  return template;
}

function validateCompletedReview(review, chain) {
  const keys = ['schemaVersion', 'reviewVersion', 'authority', 'decision', 'providerId', 'targetId', 'playerFamily', 'analysisSha256', 'candidateSha256', 'targetObservationsSha256', 'engineCertificationSha256', 'assembledObservationsSha256', 'recommendationSha256', 'runtimeSourceArtifactId', 'runtimeSourceSha256', 'recommendationCategory', 'reviewedFieldPaths', 'implementationChoices', 'acknowledgements', 'generatedAt'];
  if (!plain(review) || !sameKeys(review, keys)) throw new Error('Completed policy review has an unsupported schema.');
  assertSafeHelperProposal(review);
  if (!['approved', 'rejected', 'changes-requested'].includes(review.decision)) throw new Error('Completed policy review decision is invalid.');
  if (Number.isNaN(Date.parse(review.generatedAt))) throw new Error('Completed policy review generatedAt is invalid.');
  const expected = createReviewTemplate(chain, () => new Date(review.generatedAt));
  for (const key of keys.filter((key) => !['decision', 'implementationChoices', 'acknowledgements'].includes(key))) if (!same(review[key], expected[key])) throw new Error(`Completed policy review changed bound field ${key}.`);
  if (!same(review.reviewedFieldPaths, REVIEWED_FIELD_PATHS)) throw new Error('Completed policy review field set is incomplete or changed.');
  if (!plain(review.implementationChoices) || !sameKeys(review.implementationChoices, ['policyId', 'runtimePlayerFamily', 'idleClass', 'styleId'])) throw new Error('Review implementation choices have an unsupported schema.');
  if (!plain(review.acknowledgements) || !sameKeys(review.acknowledgements, ['evidenceChainReviewed', 'targetFieldsReviewed', 'engineGuaranteesRemainSeparate', 'noAutomaticAndroidApplication'])) throw new Error('Review acknowledgements have an unsupported schema.');
  if (review.decision === 'approved') {
    validateImplementationChoices(review.implementationChoices, chain.analysis.value.evidenceSummary.primaryPlayerFamily);
    if (Object.values(review.acknowledgements).some((value) => value !== true)) throw new Error('Approved review requires every acknowledgement.');
  } else {
    if (Object.values(review.implementationChoices).some((value) => value !== null) || Object.values(review.acknowledgements).some((value) => value !== false)) throw new Error('Non-approved review may not supply implementation choices or acknowledgements.');
  }
}

function validateImplementationChoices(value, normalizedFamily) {
  if (typeof value.policyId !== 'string' || !/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(value.policyId)) throw new Error('Review policyId is unsafe.');
  if (normalizedFamily !== 'vimeo' || value.runtimePlayerFamily !== 'embedded-vimeo') throw new Error('Review runtime player family mapping is unsupported.');
  for (const field of ['idleClass', 'styleId']) if (typeof value[field] !== 'string' || !/^[a-z][a-z0-9-]{0,119}$/.test(value[field]) || /javascript|url/i.test(value[field])) throw new Error(`Review ${field} is unsafe.`);
}

function createProposedPolicy(target, choices) {
  return {
    id: choices.policyId,
    providerId: target.providerId,
    playerFamily: choices.runtimePlayerFamily,
    match: clone(target.trustedMatchingEvidence),
    capabilities: { transportAutohide: { enabled: target.transportAutohide.enabled, idleMs: target.transportAutohide.idleMs, idleClass: choices.idleClass, styleId: choices.styleId, selectors: clone(target.transportAutohide.selectors) } },
  };
}

function classifyPolicyChange(chain, proposedPolicy) {
  const target = chain.target.value;
  if (target.targetId !== target.providerId) throw new Error('Runtime registry cannot safely represent this target identity.');
  const byId = chain.runtimePolicies.filter((policy) => policy.id === proposedPolicy.id);
  if (byId.length > 1) throw new Error('Runtime registry policy ID is ambiguous.');
  if (byId.length === 1) {
    if (byId[0].providerId !== target.providerId) throw new Error('Approved policyId would take over another target.');
    return { changeType: same(byId[0], proposedPolicy) ? 'no-change' : 'update-policy', policyBefore: clone(byId[0]) };
  }
  if (chain.runtimePolicies.some((policy) => policy.providerId === target.providerId)) throw new Error('Another runtime policy already claims this target identity.');
  return { changeType: 'add-policy', policyBefore: null };
}

function createPolicyDiff(chain, review, proposedPolicy, classification, evidenceBindings, now) {
  const changedFieldPaths = classification.changeType === 'no-change' ? [] : classification.changeType === 'add-policy' ? ['$add-policy', ...leafPaths(proposedPolicy)] : changedPaths(classification.policyBefore, proposedPolicy);
  return {
    schemaVersion: 1,
    diffVersion: POLICY_DIFF_VERSION,
    changeType: classification.changeType,
    policyId: proposedPolicy.id,
    providerId: chain.target.value.providerId,
    targetId: chain.target.value.targetId,
    normalizedPlayerFamily: chain.target.value.playerFamily,
    runtimePlayerFamily: review.implementationChoices.runtimePlayerFamily,
    runtimeSourceArtifactId: chain.runtime.artifactId,
    runtimeSourceSha256Before: chain.runtime.sha256,
    policyBefore: classification.policyBefore,
    policyAfter: proposedPolicy,
    changedFieldPaths,
    evidenceBindings,
    implementationChoiceProvenance: Object.fromEntries(Object.keys(review.implementationChoices).map((field) => [field, 'reviewer-supplied-implementation-choice'])),
    generatedAt: now().toISOString(),
    applicationStatus: 'not-applied',
  };
}

function evidenceBindingsFrom(chain) {
  return {
    analysis: binding(chain.analysis),
    candidate: binding(chain.candidate),
    targetObservations: binding(chain.target),
    engineCertification: binding(chain.certification),
    assembledObservations: binding(chain.assembled),
    recommendation: binding(chain.recommendation),
    runtimeSource: binding(chain.runtime),
  };
}

function binding(artifact) { return { artifactId: artifact.artifactId, sha256: artifact.sha256 }; }
function assertEngineFieldsSeparated(value) {
  const text = JSON.stringify(value);
  for (const field of ENGINE_ONLY_FIELDS) if (text.includes(field)) throw new Error('Engine-only guarantees leaked into policy review output.');
}
function leafPaths(value, prefix = '') { if (!plain(value)) return [prefix]; return Object.keys(value).sort().flatMap((key) => leafPaths(value[key], prefix ? `${prefix}.${key}` : key)); }
function changedPaths(before, after) { return [...new Set([...leafPaths(before), ...leafPaths(after)])].filter((path) => !same(readPath(before, path), readPath(after, path))).sort(); }
function readPath(value, path) { return path.split('.').reduce((current, key) => current?.[key], value); }
function readJsonArtifact(path, label, kind) { const artifact = readSourceArtifact(path, label, kind); try { return { ...artifact, value: JSON.parse(artifact.bytes.toString('utf8')) }; } catch (error) { throw new Error(`Malformed ${label}: ${error.message}`); } }
function readSourceArtifact(path, label, kind) {
  if (typeof path !== 'string' || !path) throw new Error(`${label} path is required.`);
  const file = resolve(path);
  const logicalRelative = relative(REPOSITORY_ROOT, file);
  const logicallyRepositoryOwned = strictlyContained(logicalRelative);
  const stat = safeLstat(file, `${label} must be a regular file.`);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} must be a regular non-symlink file.`);
  let realFile;
  try { realFile = realpathSync(file); } catch { throw new Error(`${label} physical path could not be verified.`); }
  const physicalRelative = relative(REAL_REPOSITORY_ROOT, realFile);
  const physicallyRepositoryOwned = strictlyContained(physicalRelative);
  if (logicallyRepositoryOwned && !physicallyRepositoryOwned) throw new Error('Policy review source physical path escapes the repository.');
  const bytes = readFileSync(realFile);
  const sha256 = digest(bytes);
  return { path: realFile, bytes, sha256, artifactId: logicallyRepositoryOwned && physicallyRepositoryOwned ? logicalRelative.split(sep).join('/') : `external-${kind}-${sha256.slice(0, 24)}` };
}
function strictlyContained(path) { return Boolean(path) && path !== '..' && !path.startsWith(`..${sep}`) && !path.startsWith(sep) && !isAbsolute(path); }
function safeLstat(path, message) { try { return lstatSync(path); } catch { throw new Error(message); } }
function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function same(left, right) { return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right)); }
function canonical(value) { if (Array.isArray(value)) return value.map(canonical); if (plain(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])); return value; }
function sameKeys(value, keys) { return Object.keys(value).sort().join('|') === [...keys].sort().join('|'); }
function plain(value) { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function clone(value) { return structuredClone(value); }
function deepFreeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); } return value; }
