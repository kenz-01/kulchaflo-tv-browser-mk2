import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertProviderId } from './redact-url.mjs';
import { PLAYER_FAMILIES } from './player-families.mjs';
import { UNSUPPORTED_REQUIREMENTS, assertSafeHelperProposal, resolveSafePlayerLabReportsOutputRoot } from './helper-proposal.mjs';
import { validateTargetObservation } from './helper-engine-contract.mjs';
import { validateCapabilityObservations } from './helper-evidence-bridge.mjs';
import { loadAndValidateReport } from './analyze-report.mjs';
import { writeStagedJsonOutput } from './staged-json-output.mjs';

export const TARGET_OBSERVATION_CANDIDATE_VERSION = '0.1.0-checkpoint4g';
export const DEFAULT_TARGET_OBSERVATION_OUTPUT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'reports', 'target-observation-candidates');
const ENGINE_ONLY = new Set(['oneOwnedTimer', 'interactionReveal', 'pagehideCleanup', 'urlFreeDiagnostics']);
const SAFE_SELECTOR = (v) => typeof v === 'string' && v.length > 0 && v.length <= 160 && !/[\u0000-\u001f\u007f]|:\/\/|<|>|\{|\}|;|@import|javascript:/i.test(v);
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const REAL_REPOSITORY_ROOT = realpathSync(REPOSITORY_ROOT);
const MATCHING_FIELDS = ['frameHost', 'allowFrameSubdomains', 'pathPrefix', 'pathSuffix', 'referrerHosts'];
const CHARACTERIZATION_BASIS_PATHS = Object.freeze({
  'abs-tego': 'tools/player-lab/test/fixtures/helper-evidence-bridge/abs-tego/helper-capability-observations.json',
  'island-dual-player': 'tools/player-lab/test/fixtures/helper-evidence-bridge/island-dual/helper-capability-observations.json',
});
const BASIS_FIELDS = new Set(['schemaVersion', 'authority', 'providerId', 'targetId', 'playerFamily', 'analysisSha256', 'trustedMatchingEvidence', 'supportedCapabilities', 'unsupportedRequirements', 'transportAutohide', 'providerSpecificBehavior', 'conflictingEvidence', 'sourceEvidenceReferences']);
const BASIS_TRANSPORT_FIELDS = new Set(['enabled', 'idleMs', 'selectors', 'oneOwnedTimer', 'interactionReveal', 'pagehideCleanup', 'urlFreeDiagnostics']);
const RECONCILED_FIELDS = ['providerId', 'targetId', 'playerFamily', 'analysisSha256', ...MATCHING_FIELDS.map((field) => `trustedMatchingEvidence.${field}`), 'transportAutohide.enabled', 'transportAutohide.idleMs', 'transportAutohide.selectors', 'providerSpecificBehavior', 'conflictingEvidence'];
const SET_FIELDS = new Set(['trustedMatchingEvidence.referrerHosts', 'transportAutohide.selectors']);
const AUTHORITY_ORDER = ['existing-approved-policy', 'registered-target-metadata', 'reviewer-supplied', 'canonical-profile-observation', 'structured-characterization', 'validated-characterization-basis', 'validated-analysis-derivation', 'test-support-profile-observation', 'unavailable'];

export function deriveTargetObservationCandidate({ analysisPath, profilePath, targetRegistryPath, reviewInputPath, characterizationPath, now = () => new Date() } = {}) {
  const analysisSource = readArtifact(analysisPath, 'analysis.json', 'analysis');
  const analysis = analysisSource.value;
  validateAnalysis(analysis);
  const sourceRecords = [analysisRecord(analysisSource, analysis)];
  if (profilePath) sourceRecords.push(readProfile(profilePath, analysis, analysisSource.sha256));
  if (targetRegistryPath) sourceRecords.push(readRegistry(targetRegistryPath, analysis));
  const approved = approvedPolicyFor(analysis);
  if (approved) sourceRecords.push(approved);
  if (reviewInputPath) sourceRecords.push(readReview(reviewInputPath, analysis, analysisSource.sha256));
  if (characterizationPath) sourceRecords.push(...readCharacterization(characterizationPath, analysis, analysisSource.sha256));
  const contributions = sourceRecords.flatMap(contributionsForSource);
  const reconciled = new Map(RECONCILED_FIELDS.map((fieldPath) => [fieldPath, reconcileField(fieldPath, contributions.filter((item) => item.fieldPath === fieldPath), { setLike: SET_FIELDS.has(fieldPath) })]));
  const conflicts = RECONCILED_FIELDS.filter((fieldPath) => reconciled.get(fieldPath).conflict);
  if (reconciled.get('conflictingEvidence').value === true && !conflicts.includes('conflictingEvidence')) conflicts.push('conflictingEvidence');
  const provenance = [...reconciled.values()].flatMap((result) => result.provenance);
  const unavailable = RECONCILED_FIELDS.filter((fieldPath) => reconciled.get(fieldPath).status === 'unavailable');
  const profileBindingUnavailable = sourceRecords.some((source) => source.kind === 'canonical-profile-report' && source.profileAnalysisBinding === 'unavailable');
  if (profileBindingUnavailable) {
    unavailable.push('profileAnalysisBinding');
    provenance.push(unavailableProvenance('profileAnalysisBinding', 'Canonical report has no represented analysis/report binding.'));
  }
  const requirements = reconcileRequirements(contributions.filter((item) => item.fieldPath.startsWith('unsupportedRequirements.')));
  provenance.push(...requirements.provenance);
  const unsupportedRequirements = requirements.values;
  const downgrade = [];
  const matching = objectFromResults(reconciled, 'trustedMatchingEvidence', MATCHING_FIELDS);
  const transport = objectFromResults(reconciled, 'transportAutohide', ['enabled', 'idleMs', 'selectors']);
  const providerSpecificBehavior = reconciled.get('providerSpecificBehavior').value === true;
  const targetObservationCandidate = {
    ...(Object.keys(matching).length ? { trustedMatchingEvidence: matching } : {}),
    ...(Object.keys(transport).length ? { transportAutohide: transport } : {}),
    unsupportedRequirements,
    providerSpecificBehavior,
    conflictingEvidence: conflicts.length > 0,
  };
  const required = [...MATCHING_FIELDS.map((field) => `trustedMatchingEvidence.${field}`), 'transportAutohide.enabled', 'transportAutohide.idleMs', 'transportAutohide.selectors'];
  const complete = required.every((field) => reconciled.get(field).status === 'supported') && transport.enabled === true && !profileBindingUnavailable;
  let candidateStatus = 'ready-for-review';
  if (conflicts.length) candidateStatus = 'conflicting-evidence';
  else if (unsupportedRequirements.length) candidateStatus = 'engine-extension-study';
  else if (providerSpecificBehavior) candidateStatus = 'provider-specific';
  else if (!complete) candidateStatus = 'insufficient-evidence';
  if (!complete) downgrade.push('target-observation-incomplete');
  if (unsupportedRequirements.length) downgrade.push('advanced-requirements-preserved');
  if (providerSpecificBehavior) downgrade.push('provider-specific-orchestration');
  const candidate = { schemaVersion: 1, candidateVersion: TARGET_OBSERVATION_CANDIDATE_VERSION, providerId: analysis.providerId, ...(analysis.targetId ? { targetId: analysis.targetId } : {}), playerFamily: analysis.evidenceSummary.primaryPlayerFamily, analysisSha256: analysisSource.sha256, sourceBindings: sourceRecords.map((source) => candidateBinding(source.binding)), targetObservationCandidate, fieldProvenance: provenance, unavailableFields: unique(unavailable), conflictingFields: unique(conflicts), downgradeReasons: unique(downgrade), candidateStatus, generatedAt: now().toISOString() };
  assertSafeHelperProposal(candidate);
  let promoted = null;
  if (candidateStatus === 'ready-for-review') {
    promoted = { schemaVersion: 1, authority: 'directly-observed-structured-evidence', providerId: candidate.providerId, ...(candidate.targetId ? { targetId: candidate.targetId } : {}), playerFamily: candidate.playerFamily, analysisSha256: candidate.analysisSha256, trustedMatchingEvidence: matching, transportAutohide: transport, unsupportedRequirements, providerSpecificBehavior, conflictingEvidence: false, sourceEvidenceReferences: ['target-observation-candidate'] };
    validateTargetObservation(promoted, analysis, analysisSource.sha256);
    assertSafeHelperProposal(promoted);
  }
  return deepFreeze({ candidate, provenance: { schemaVersion: 1, candidateVersion: TARGET_OBSERVATION_CANDIDATE_VERSION, fields: provenance }, promoted });
}

export function deriveAndWriteTargetObservations({ outputRoot, now = () => new Date(), ...options } = {}) {
  const result = deriveTargetObservationCandidate({ ...options, now });
  const root = resolveSafePlayerLabReportsOutputRoot(outputRoot, DEFAULT_TARGET_OBSERVATION_OUTPUT_ROOT);
  return writeStagedJsonOutput({ outputRoot: root, now, artifacts: { 'target-observation-candidate.json': result.candidate, 'target-observation-provenance.json': result.provenance, ...(result.promoted ? { 'target-capability-observations.json': result.promoted } : {}) }, result });
}

function analysisRecord(source, analysis) { return sourceRecord('validated-analysis', 'validated-analysis-derivation', source, analysis, analysis); }
function readProfile(path, analysis, analysisSha256) {
  const source = readArtifact(path, 'Profile', 'profile');
  const raw = source.value;
  if (plain(raw?.metadata) && Array.isArray(raw?.candidateControls)) {
    const report = loadAndValidateReport(resolve(path));
    const value = { schemaVersion: 1, providerId: report.metadata.providerId, targetId: report.metadata.targetId ?? null, playerFamily: report.playerClassification.primaryFamily, reportSha256: source.sha256 };
    validateIdentity(value, analysis, null, true, 'Profile report');
    const representedReference = report.metadata.sourceReportReference ?? null;
    if (representedReference !== null && !/^[a-z0-9][a-z0-9._-]{0,119}$/i.test(representedReference)) throw new Error('Canonical report source reference is unsafe.');
    const record = sourceRecord('canonical-profile-report', 'canonical-profile-observation', source, value, value);
    record.profileAnalysisBinding = 'unavailable';
    record.reportIdentity = { profilerVersion: report.metadata.profilerVersion, reportId: report.metadata.reportId ?? null, runId: report.metadata.runId ?? null, sourceReportReference: representedReference };
    record.binding = { ...record.binding, reportSha256: source.sha256, profilerVersion: report.metadata.profilerVersion, ...(report.metadata.reportId ? { reportId: report.metadata.reportId } : {}), ...(report.metadata.runId ? { runId: report.metadata.runId } : {}), ...(representedReference ? { sourceReportReference: representedReference } : {}), profileAnalysisBinding: 'unavailable' };
    return record;
  }
  if (!plain(raw) || raw.authority !== 'structured-profile-target-evidence') throw new Error('Profile must be a canonical Player Lab report or explicit test-support profile adapter.');
  validateIdentity(raw, analysis, analysisSha256, false, 'Test-support profile');
  validateTargetFields(raw);
  return sourceRecord('test-support-profile-adapter', 'test-support-profile-observation', source, raw, raw);
}
function readRegistry(path, analysis) {
  const source = readArtifact(path, 'Target registry', 'registry'); const value = source.value;
  if (!plain(value) || value.schemaVersion !== 1 || !plain(value.targets) || !analysis.targetId) throw new Error('Target registry requires a matching analysis target.');
  const entry = value.targets[analysis.targetId]; if (!plain(entry)) throw new Error('Registered target does not correspond to analysis target.');
  validateIdentity(entry, analysis, null, true, 'Registered target'); validateTargetFields(entry);
  const bindingValue = { schemaVersion: value.schemaVersion, providerId: entry.providerId, targetId: entry.targetId, playerFamily: entry.playerFamily, ...(entry.analysisSha256 ? { analysisSha256: entry.analysisSha256 } : {}) };
  return sourceRecord('registered-target-metadata', 'registered-target-metadata', source, entry, bindingValue);
}
function readReview(path, analysis, analysisSha256) {
  const source = readArtifact(path, 'Reviewer input', 'reviewer-input'); const value = source.value;
  if (!plain(value) || !sameKeys(value, ['schemaVersion', 'authority', 'providerId', ...(value.targetId === undefined ? [] : ['targetId']), 'playerFamily', 'analysisSha256', 'transportAutohide']) || value.schemaVersion !== 1 || value.authority !== 'bounded-reviewer-input') throw new Error('Reviewer input has an unsupported schema or field.');
  validateIdentity(value, analysis, analysisSha256, false, 'Reviewer input');
  if (!plain(value.transportAutohide) || !sameKeys(value.transportAutohide, ['idleMs']) || !validIdle(value.transportAutohide.idleMs)) throw new Error('Reviewer input may contain only bounded idleMs.');
  assertSafeHelperProposal(value);
  return sourceRecord('bounded-reviewer-input', 'reviewer-supplied', source, value, value);
}
function readCharacterization(path, analysis, analysisSha256) {
  const source = readArtifact(path, 'Characterization', 'characterization'); const value = source.value;
  const allowed = ['schemaVersion', 'adapterVersion', 'authority', 'characterizationKind', 'basisArtifact', 'basisSha256', 'providerId', ...(value.targetId === undefined ? [] : ['targetId']), 'playerFamily', 'analysisSha256', ...(value.trustedMatchingEvidence === undefined ? [] : ['trustedMatchingEvidence']), ...(value.transportAutohide === undefined ? [] : ['transportAutohide']), 'unsupportedRequirements', 'providerSpecificBehavior', 'conflictingEvidence', 'behaviorEvidence'];
  if (!plain(value) || !sameKeys(value, allowed) || value.schemaVersion !== 1 || value.adapterVersion !== TARGET_OBSERVATION_CANDIDATE_VERSION || value.authority !== 'bounded-existing-characterization-adapter' || !['abs-tego', 'island-dual-player'].includes(value.characterizationKind)) throw new Error('Characterization input is invalid.');
  if (!/^[a-f0-9]{64}$/.test(value.basisSha256) || !Array.isArray(value.behaviorEvidence) || !value.behaviorEvidence.every((item) => /^[a-z0-9][a-z0-9-]{0,119}$/.test(item))) throw new Error('Characterization evidence references are unsafe.');
  validateIdentity(value, analysis, analysisSha256, false, 'Characterization');
  validateTargetFields(Object.fromEntries(['schemaVersion', 'authority', 'providerId', 'targetId', 'playerFamily', 'analysisSha256', 'trustedMatchingEvidence', 'transportAutohide', 'unsupportedRequirements', 'providerSpecificBehavior', 'conflictingEvidence'].filter((key) => value[key] !== undefined).map((key) => [key, value[key]])));
  if (value.characterizationKind === 'abs-tego' && (value.providerId !== 'abs-channel-10' || value.playerFamily !== 'tego' || value.providerSpecificBehavior !== false || !sameSet(value.behaviorEvidence, ['checkpoint-4c-advanced-helper-characterization']) || !sameSet(value.unsupportedRequirements, UNSUPPORTED_REQUIREMENTS))) throw new Error('ABS/Tego characterization contract is invalid.');
  if (value.characterizationKind === 'island-dual-player' && (value.providerId !== 'island-tv' || value.playerFamily !== 'vimeo' || value.providerSpecificBehavior !== true || !sameSet(value.behaviorEvidence, ['dual-player-selection']))) throw new Error('Island characterization contract is invalid.');
  const basisSource = readCharacterizationBasis(value, analysis, analysisSha256);
  validateCharacterizationAgreement(value, basisSource.value);
  const record = sourceRecord('structured-characterization', 'structured-characterization', source, value, value);
  record.binding = { ...record.binding, adapterVersion: value.adapterVersion, characterizationKind: value.characterizationKind, basisArtifact: value.basisArtifact, basisSha256: value.basisSha256, behaviorEvidence: [...value.behaviorEvidence] };
  const basisRecord = sourceRecord('characterization-basis', 'validated-characterization-basis', basisSource, basisSource.value, basisSource.value);
  if (basisSource.value.targetId === undefined) delete basisRecord.binding.targetId;
  return [record, basisRecord];
}
function readCharacterizationBasis(adapter, analysis, analysisSha256) {
  const expected = CHARACTERIZATION_BASIS_PATHS[adapter.characterizationKind];
  if (typeof adapter.basisArtifact !== 'string' || adapter.basisArtifact.startsWith('/') || /^[A-Za-z]:[\\/]/.test(adapter.basisArtifact)) throw new Error('Characterization basis path must be repository-relative.');
  if (adapter.basisArtifact.split(/[\\/]/).includes('..')) throw new Error('Characterization basis traversal rejected.');
  if (adapter.basisArtifact !== expected) throw new Error('Characterization basis artifact is not allowlisted for this kind.');
  const file = resolve(REPOSITORY_ROOT, adapter.basisArtifact);
  const stat = safeLstat(file, 'Characterization basis must be a regular file.');
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Characterization basis must be a regular non-symlink file.');
  let realBasisPath;
  try { realBasisPath = realpathSync(file); } catch { throw new Error('Characterization basis physical path could not be verified.'); }
  const physicalRelative = relative(REAL_REPOSITORY_ROOT, realBasisPath);
  if (!physicalRelative || physicalRelative === '..' || physicalRelative.startsWith(`..${sep}`) || physicalRelative.startsWith(sep) || isAbsolute(physicalRelative)) throw new Error('Characterization basis physical path escapes the repository.');
  const bytes = readFileSync(realBasisPath);
  const digest = sha256(bytes);
  if (digest !== adapter.basisSha256) throw new Error('Characterization basis SHA-256 does not match exact basis bytes.');
  let basis;
  try { basis = JSON.parse(bytes.toString('utf8')); } catch (error) { throw new Error(`Malformed Characterization basis: ${error.message}`); }
  validateCapabilityObservations(basis, analysis, analysisSha256);
  validateCharacterizationBasisShape(basis);
  assertSafeHelperProposal(basis);
  return { artifactId: adapter.basisArtifact, sha256: digest, value: basis };
}
function validateCharacterizationBasisShape(basis) {
  if (Object.keys(basis).some((key) => !BASIS_FIELDS.has(key))) throw new Error('Characterization basis contains an unknown field.');
  if (basis.transportAutohide && Object.keys(basis.transportAutohide).some((key) => !BASIS_TRANSPORT_FIELDS.has(key))) throw new Error('Characterization basis transport contains an unknown field.');
}
function validateCharacterizationAgreement(adapter, basis) {
  const compare = (field, adapterValue, basisValue, { setLike = false } = {}) => {
    if (basisValue === undefined) return;
    const agrees = setLike ? sameSet(adapterValue, basisValue) : stableValue(adapterValue) === stableValue(basisValue);
    if (!agrees) throw new Error(`Characterization adapter disagrees with basis field ${field}.`);
  };
  compare('providerId', adapter.providerId, basis.providerId);
  if (Object.hasOwn(adapter, 'targetId') !== Object.hasOwn(basis, 'targetId')) throw new Error('Characterization adapter disagrees with basis targetId absence.');
  compare('targetId', adapter.targetId, basis.targetId);
  compare('playerFamily', adapter.playerFamily, basis.playerFamily);
  for (const field of MATCHING_FIELDS) compare(`trustedMatchingEvidence.${field}`, adapter.trustedMatchingEvidence?.[field], basis.trustedMatchingEvidence?.[field]);
  for (const field of ['enabled', 'idleMs', 'selectors']) compare(`transportAutohide.${field}`, adapter.transportAutohide?.[field], basis.transportAutohide?.[field]);
  compare('unsupportedRequirements', adapter.unsupportedRequirements, basis.unsupportedRequirements, { setLike: true });
  compare('providerSpecificBehavior', adapter.providerSpecificBehavior, basis.providerSpecificBehavior);
  compare('conflictingEvidence', adapter.conflictingEvidence, basis.conflictingEvidence);
  if (adapter.characterizationKind === 'abs-tego' && !sameSet(basis.unsupportedRequirements, UNSUPPORTED_REQUIREMENTS)) throw new Error('ABS/Tego basis does not represent all seven requirements.');
  if (adapter.characterizationKind === 'island-dual-player' && (basis.providerSpecificBehavior !== true || !sameSet(basis.sourceEvidenceReferences, ['dual-player-observed']))) throw new Error('Island basis does not establish provider-specific dual-player behavior.');
}
function validateAnalysis(value) { if (!plain(value) || value.schemaVersion !== 1 || !plain(value.evidenceSummary)) throw new Error('Analysis artifact is invalid.'); assertProviderId(value.providerId); if (value.targetId != null) assertProviderId(value.targetId); if (!PLAYER_FAMILIES.includes(value.evidenceSummary.primaryPlayerFamily)) throw new Error('Analysis player family is invalid.'); }
function validateIdentity(value, analysis, analysisSha256, allowNoHash, label) { assertProviderId(value.providerId); if (value.providerId !== analysis.providerId) throw new Error(`${label} provider ID does not match analysis.`); if ((value.targetId ?? null) !== (analysis.targetId ?? null)) throw new Error(`${label} target ID does not match analysis.`); if (value.playerFamily !== analysis.evidenceSummary.primaryPlayerFamily) throw new Error(`${label} player family does not match analysis.`); if (!allowNoHash && value.analysisSha256 !== analysisSha256) throw new Error(`${label} analysis SHA-256 does not match exact analysis bytes.`); }
function validateTargetFields(value) { const allowed = new Set(['schemaVersion', 'authority', 'providerId', 'targetId', 'playerFamily', 'analysisSha256', 'trustedMatchingEvidence', 'transportAutohide', 'unsupportedRequirements', 'providerSpecificBehavior', 'conflictingEvidence', 'sourceEvidenceReferences']); if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error('Target source contains an unknown field.'); rejectEngineClaims(value.transportAutohide); if (value.unsupportedRequirements !== undefined && (!Array.isArray(value.unsupportedRequirements) || !value.unsupportedRequirements.every((v) => UNSUPPORTED_REQUIREMENTS.includes(v)))) throw new Error('Unsupported requirements are invalid.'); if (value.trustedMatchingEvidence) validateMatching(value.trustedMatchingEvidence); if (value.transportAutohide && (!plain(value.transportAutohide) || Object.keys(value.transportAutohide).some((key) => !['enabled', 'idleMs', 'selectors'].includes(key)))) throw new Error('Target source contains an unknown or engine-only transport field.'); if (value.transportAutohide?.enabled !== undefined && typeof value.transportAutohide.enabled !== 'boolean') throw new Error('Target enabled must be boolean.'); if (value.transportAutohide?.idleMs !== undefined && !validIdle(value.transportAutohide.idleMs)) throw new Error('Target idleMs is invalid.'); if (value.transportAutohide?.selectors !== undefined && (!Array.isArray(value.transportAutohide.selectors) || !value.transportAutohide.selectors.length || !value.transportAutohide.selectors.every(SAFE_SELECTOR))) throw new Error('Selectors are unsafe.'); for (const key of ['providerSpecificBehavior', 'conflictingEvidence']) if (value[key] !== undefined && typeof value[key] !== 'boolean') throw new Error(`Target ${key} is invalid.`); if (value.sourceEvidenceReferences && (!Array.isArray(value.sourceEvidenceReferences) || !value.sourceEvidenceReferences.every((v) => /^[a-z0-9][a-z0-9-]{0,119}$/.test(v) && !/(?:authorization|bearer|credential|secret|(?:access|auth|api)-?token)/i.test(v)))) throw new Error('Target source references are invalid.'); assertSafeHelperProposal(value); }
function rejectEngineClaims(transport) { if (transport && Object.keys(transport).some((key) => ENGINE_ONLY.has(key))) throw new Error('Target source may not claim engine-only fields.'); }
function validateMatching(m) { if (!plain(m) || Object.keys(m).some((key) => !MATCHING_FIELDS.includes(key)) || typeof m.frameHost !== 'string' || !/^[a-z0-9.-]+$/.test(m.frameHost) || (m.allowFrameSubdomains !== undefined && typeof m.allowFrameSubdomains !== 'boolean') || !['pathPrefix', 'pathSuffix'].every((k) => typeof m[k] === 'string' && m[k].startsWith('/') && !/[?#]|:\/\//.test(m[k])) || !Array.isArray(m.referrerHosts) || !m.referrerHosts.length || !m.referrerHosts.every((h) => /^[a-z0-9.-]+$/.test(h))) throw new Error('Trusted matching metadata is invalid.'); }
function readArtifact(path, label, kind) { const file = resolve(path); const stat = safeLstat(file, `${label} must be a regular file.`); if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} must be a regular file.`); const bytes = readFileSync(file); try { return { artifactId: artifactIdForSource(file, kind, bytes), sha256: sha256(bytes), value: JSON.parse(bytes.toString('utf8')) }; } catch (error) { throw new Error(`Malformed ${label}: ${error.message}`); } }
export function artifactIdForSource(path, kind, bytes = readFileSync(resolve(path))) { const absolute = resolve(path); const rel = relative(REPOSITORY_ROOT, absolute); if (rel && !rel.startsWith(`..${sep}`) && rel !== '..' && !rel.startsWith(sep)) return rel.split(sep).join('/'); const prefix = { profile: 'external-profile', 'reviewer-input': 'external-reviewer-input', registry: 'external-registry', characterization: 'external-characterization', analysis: 'external-analysis' }[kind]; if (!prefix) throw new Error('External source kind is unsupported.'); return `${prefix}-${sha256(bytes).slice(0, 24)}`; }
function sourceRecord(kind, authorityType, source, value, bindingValue) { return { kind, authorityType, source, value, binding: binding(kind, authorityType, source, bindingValue), profileAnalysisBinding: 'represented' }; }
function binding(kind, authorityType, source, value) { return { kind, authorityType, artifactId: source.artifactId, sha256: source.sha256, schemaVersion: value.schemaVersion ?? null, providerId: value.providerId ?? null, targetId: value.targetId ?? null, playerFamily: value.playerFamily ?? value.normalizedPlayerFamily ?? value.evidenceSummary?.primaryPlayerFamily ?? null, ...(value.analysisSha256 ? { analysisSha256: value.analysisSha256 } : {}), ...(value.sourcePlayerFamily ? { sourcePlayerFamily: value.sourcePlayerFamily, normalizedPlayerFamily: value.normalizedPlayerFamily, familyNormalizationRule: value.familyNormalizationRule, sourceCapabilityKey: value.sourceCapabilityKey, normalizedCapabilityType: value.normalizedCapabilityType, capabilityNormalizationRule: value.capabilityNormalizationRule } : {}) }; }
function candidateBinding(value) { const { sourceCapabilityKey, normalizedCapabilityType, capabilityNormalizationRule, ...safe } = value; return safe; }
function approvedPolicyFor(analysis) { if (analysis.providerId !== 'cvm-tv' || analysis.targetId !== 'cvm-tv') return null; const path = resolve(REPOSITORY_ROOT, 'app-gv', 'src', 'main', 'assets', 'gv_media_observer', 'content.js'); const approved = createApprovedCvmPolicySource(readFileSync(path)); return { kind: 'existing-approved-policy', authorityType: 'existing-approved-policy', source: approved.source, value: approved.normalized, binding: approved.binding, profileAnalysisBinding: 'represented' }; }

function contributionsForSource(record) {
  const { value, authorityType, source } = record;
  const add = (fieldPath, normalizedValue, sourceField, normalizationRule) => ({ fieldPath, normalizedValue, authorityType, sourceArtifactId: source.artifactId, sourceSha256: source.sha256, sourceField, status: 'supported', ...(normalizationRule ? { normalizationRule } : {}) });
  const out = [];
  const providerId = value.providerId;
  const targetId = value.targetId;
  const playerFamily = value.playerFamily ?? value.normalizedPlayerFamily ?? value.evidenceSummary?.primaryPlayerFamily;
  if (providerId !== undefined) out.push(add('providerId', providerId, 'providerId'));
  if (targetId !== undefined && targetId !== null) out.push(add('targetId', targetId, 'targetId'));
  if (playerFamily !== undefined) out.push(add('playerFamily', playerFamily, value.evidenceSummary ? 'evidenceSummary.primaryPlayerFamily' : (value.normalizedPlayerFamily ? 'normalizedPlayerFamily' : 'playerFamily'), value.familyNormalizationRule));
  const analysisHash = record.kind === 'validated-analysis' ? source.sha256 : value.analysisSha256;
  if (analysisHash) out.push(add('analysisSha256', analysisHash, record.kind === 'validated-analysis' ? 'exact artifact bytes' : 'analysisSha256'));
  for (const field of MATCHING_FIELDS) if (value.trustedMatchingEvidence?.[field] !== undefined) out.push(add(`trustedMatchingEvidence.${field}`, value.trustedMatchingEvidence[field], `trustedMatchingEvidence.${field}`));
  for (const field of ['enabled', 'idleMs', 'selectors']) if (value.transportAutohide?.[field] !== undefined) out.push(add(`transportAutohide.${field}`, value.transportAutohide[field], `transportAutohide.${field}`));
  for (const field of ['providerSpecificBehavior', 'conflictingEvidence']) if (value[field] !== undefined) out.push(add(field, value[field], field));
  for (const requirement of value.unsupportedRequirements ?? []) out.push(add(`unsupportedRequirements.${requirement}`, requirement, `unsupportedRequirements[${JSON.stringify(requirement)}]`));
  return out;
}

function reconcileField(fieldPath, contributions, { setLike = false } = {}) {
  if (!contributions.length) return { fieldPath, value: undefined, status: 'unavailable', conflict: false, provenance: [unavailableProvenance(fieldPath, fieldPath === 'transportAutohide.idleMs' ? 'Idle policy is unavailable and manually required.' : `No authoritative source supports ${fieldPath}.`)] };
  const ordered = [...contributions].sort((left, right) => authorityRank(left.authorityType) - authorityRank(right.authorityType) || left.sourceArtifactId.localeCompare(right.sourceArtifactId));
  const groups = new Map();
  for (const item of ordered) {
    const comparable = setLike ? JSON.stringify(normalizedSet(item.normalizedValue, fieldPath)) : stableValue(item.normalizedValue);
    if (!groups.has(comparable)) groups.set(comparable, []);
    groups.get(comparable).push(item);
  }
  return { fieldPath, value: clone(ordered[0].normalizedValue), status: 'supported', conflict: groups.size > 1, provenance: ordered.map((item) => ({ ...item, ...(groups.size > 1 ? { status: 'conflicting' } : {}) })) };
}

function reconcileRequirements(contributions) {
  const byRequirement = new Map();
  for (const item of contributions) {
    if (!UNSUPPORTED_REQUIREMENTS.includes(item.normalizedValue)) throw new Error(`Unknown unsupported requirement: ${item.normalizedValue}.`);
    if (!byRequirement.has(item.normalizedValue)) byRequirement.set(item.normalizedValue, []);
    byRequirement.get(item.normalizedValue).push(item);
  }
  const values = [...byRequirement.keys()].sort();
  return { values, provenance: values.flatMap((value) => byRequirement.get(value).sort((a, b) => authorityRank(a.authorityType) - authorityRank(b.authorityType) || a.sourceArtifactId.localeCompare(b.sourceArtifactId))) };
}

function objectFromResults(results, prefix, fields) { const value = {}; for (const field of fields) { const result = results.get(`${prefix}.${field}`); if (result?.value !== undefined) value[field] = clone(result.value); } return value; }
function unavailableProvenance(fieldPath, reason) { return { fieldPath, normalizedValue: null, authorityType: 'unavailable', sourceArtifactId: null, sourceSha256: null, sourceField: null, status: 'unavailable', reason }; }
function normalizedSet(value, fieldPath) { if (!Array.isArray(value)) throw new Error(`${fieldPath} must be a list.`); const normalized = value.map((item) => fieldPath.includes('referrerHosts') ? item.toLowerCase() : item); return [...new Set(normalized)].sort(); }
function stableValue(value) { return JSON.stringify(value); }
function authorityRank(authority) { const index = AUTHORITY_ORDER.indexOf(authority); if (index < 0) throw new Error(`Unknown authority type: ${authority}.`); return index; }
function clone(value) { return value === undefined ? undefined : structuredClone(value); }
function sameKeys(value, expected) { return Object.keys(value).sort().join('|') === [...expected].sort().join('|'); }
function validIdle(value) { return Number.isInteger(value) && value >= 500 && value <= 10000; }
function sameSet(left, right) { return Array.isArray(left) && left.length === right.length && [...left].sort().join('|') === [...right].sort().join('|'); }
export function createApprovedCvmPolicySource(bytes) { if (!Buffer.isBuffer(bytes)) throw new Error('Approved policy source must be exact bytes.'); const extracted = extractApprovedCvmPolicy(bytes.toString('utf8')); const normalized = { ...extracted, targetId: 'cvm-tv', playerFamily: extracted.normalizedPlayerFamily }; const source = { artifactId: 'app-gv/src/main/assets/gv_media_observer/content.js', sha256: sha256(bytes) }; return deepFreeze({ normalized, source, binding: binding('existing-approved-policy', 'existing-approved-policy', source, normalized) }); }
export function parsePlayerHelperRegistry(text) {
  if (typeof text !== 'string') throw new Error('Player helper registry source must be text.');
  const policies = registryPolicyLayout(text).entries.map((entry) => parseRuntimePolicyBlock(entry.block));
  if (!policies.length) throw new Error('Player helper registry must contain at least one policy.');
  if (new Set(policies.map((policy) => policy.id)).size !== policies.length) throw new Error('Player helper registry contains duplicate policy IDs.');
  if (new Set(policies.map((policy) => policy.providerId)).size !== policies.length) throw new Error('Player helper registry contains ambiguous provider policies.');
  return deepFreeze(policies);
}
export function inspectPlayerHelperRegistry(text) {
  if (typeof text !== 'string') throw new Error('Player helper registry source must be text.');
  const layout = registryPolicyLayout(text);
  const policies = parsePlayerHelperRegistry(text);
  return deepFreeze({
    arrayOpen: layout.arrayOpen,
    arrayClose: layout.arrayClose,
    entries: layout.entries.map((entry, index) => ({ ...entry, policy: policies[index] })),
  });
}
function registryPolicyLayout(text) {
  const arrayOpen = registryDeclarationArrayOpen(text);
  const arrayClose = balancedDelimited(text, arrayOpen, '[', ']');
  if (arrayClose < 0) throw new Error('Player helper registry is malformed.');
  const closeParen = skipSpace(text, arrayClose + 1);
  if (text[closeParen] !== ')') throw new Error('Player helper registry wrapper is malformed.');
  const statementEnd = skipSpace(text, closeParen + 1);
  if (text[statementEnd] !== ';') throw new Error('Player helper registry statement is malformed.');
  const entries = []; let index = skipSpace(text, arrayOpen + 1);
  while (index < arrayClose) {
    const wrapperStart = index;
    if (!text.startsWith('Object.freeze(', index)) throw new Error('Player helper registry entry is malformed.');
    const wrapperValueStart = skipSpace(text, index + 'Object.freeze('.length);
    const objectOpen = text.indexOf('{', index);
    if (wrapperValueStart !== objectOpen) throw new Error('Player helper policy wrapper contains an unexpected expression.');
    const objectClose = balancedClose(text, objectOpen);
    if (objectOpen < 0 || objectClose < 0 || objectClose > arrayClose) throw new Error('Player helper policy block is malformed.');
    const policyCloseParen = skipSpace(text, objectClose + 1);
    if (text[policyCloseParen] !== ')') throw new Error('Player helper policy wrapper is malformed.');
    entries.push({
      wrapperStart,
      wrapperEnd: policyCloseParen + 1,
      objectStart: objectOpen,
      objectEnd: objectClose + 1,
      block: text.slice(objectOpen, objectClose + 1),
      wrapper: text.slice(wrapperStart, policyCloseParen + 1),
    });
    index = skipSpace(text, policyCloseParen + 1);
    if (index < arrayClose) {
      if (text[index] !== ',') throw new Error('Player helper registry policy separator is malformed.');
      index = skipSpace(text, index + 1);
    }
  }
  return { arrayOpen, arrayClose, entries };
}
function registryDeclarationArrayOpen(text) {
  const tokens = lexicalTokens(text);
  const declarations = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (tokens[index].value === 'const' && tokens[index + 1].value === 'PLAYER_HELPER_REGISTRY') declarations.push(index);
  }
  if (declarations.length === 0) throw new Error('Player helper registry is missing.');
  if (declarations.length !== 1) throw new Error('Player helper registry has multiple declarations.');
  const index = declarations[0];
  const expected = ['const', 'PLAYER_HELPER_REGISTRY', '=', 'Object', '.', 'freeze', '(', '['];
  if (!expected.every((value, offset) => tokens[index + offset]?.value === value)) throw new Error('Player helper registry declaration is malformed.');
  return tokens[index + expected.length - 1].start;
}
function lexicalTokens(text) {
  const tokens = [];
  for (let index = 0; index < text.length;) {
    const ch = text[index];
    if (/\s/.test(ch)) { index += 1; continue; }
    if (ch === '/' && text[index + 1] === '/') {
      index += 2;
      while (index < text.length && text[index] !== '\n') index += 1;
      continue;
    }
    if (ch === '/' && text[index + 1] === '*') {
      const close = text.indexOf('*/', index + 2);
      if (close < 0) throw new Error('Player helper registry source has an unterminated block comment.');
      index = close + 2;
      continue;
    }
    if (ch === '"' || ch === "'") { index = skipLexicalString(text, index, ch); continue; }
    if (ch === '`') { index = skipLexicalTemplate(text, index); continue; }
    const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(text.slice(index));
    if (identifier) {
      tokens.push({ value: identifier[0], start: index });
      index += identifier[0].length;
      continue;
    }
    tokens.push({ value: ch, start: index });
    index += 1;
  }
  return tokens;
}
function skipLexicalString(text, start, quote) {
  for (let index = start + 1; index < text.length; index += 1) {
    if (text[index] === '\\') { index += 1; continue; }
    if (text[index] === quote) return index + 1;
  }
  throw new Error('Player helper registry source has an unterminated string.');
}
function skipLexicalTemplate(text, start) {
  for (let index = start + 1; index < text.length; index += 1) {
    if (text[index] === '\\') { index += 1; continue; }
    if (text[index] === '`') return index + 1;
    if (text[index] === '$' && text[index + 1] === '{') {
      const close = skipTemplateExpression(text, index + 2);
      if (text.slice(index + 2, close).includes('PLAYER_HELPER_REGISTRY')) throw new Error('Player helper registry declaration inside a template expression is ambiguous.');
      index = close;
    }
  }
  throw new Error('Player helper registry source has an unterminated template string.');
}
function skipTemplateExpression(text, start) {
  let depth = 1;
  for (let index = start; index < text.length; index += 1) {
    const ch = text[index];
    if (ch === '"' || ch === "'") { index = skipLexicalString(text, index, ch) - 1; continue; }
    if (ch === '`') { index = skipLexicalTemplate(text, index) - 1; continue; }
    if (ch === '/' && text[index + 1] === '/') {
      index += 2;
      while (index < text.length && text[index] !== '\n') index += 1;
      continue;
    }
    if (ch === '/' && text[index + 1] === '*') {
      const close = text.indexOf('*/', index + 2);
      if (close < 0) throw new Error('Player helper registry source has an unterminated template comment.');
      index = close + 1;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}' && --depth === 0) return index;
  }
  throw new Error('Player helper registry source has an unterminated template expression.');
}
function parseRuntimePolicyBlock(block) {
  const policy = parseObjectProperties(block, ['id', 'providerId', 'playerFamily', 'match', 'capabilities']);
  const matchFields = parseFrozenObject(property(policy, 'match'), ['frameHost', 'allowFrameSubdomains', 'pathPrefix', 'pathSuffix', 'referrerHosts']);
  const capabilityFields = parseFrozenObject(property(policy, 'capabilities'), ['transportAutohide']);
  const transportFields = parseFrozenObject(property(capabilityFields, 'transportAutohide'), ['enabled', 'idleMs', 'idleClass', 'styleId', 'selectors']);
  const runtimePolicy = {
    id: stringValue(property(policy, 'id')),
    providerId: stringValue(property(policy, 'providerId')),
    playerFamily: stringValue(property(policy, 'playerFamily')),
    match: {
      frameHost: stringValue(property(matchFields, 'frameHost')),
      allowFrameSubdomains: booleanValue(property(matchFields, 'allowFrameSubdomains')),
      pathPrefix: stringValue(property(matchFields, 'pathPrefix')),
      pathSuffix: stringValue(property(matchFields, 'pathSuffix')),
      referrerHosts: frozenStringArray(property(matchFields, 'referrerHosts')),
    },
    capabilities: {
      transportAutohide: {
        enabled: booleanValue(property(transportFields, 'enabled')),
        idleMs: integerValue(property(transportFields, 'idleMs')),
        idleClass: stringValue(property(transportFields, 'idleClass')),
        styleId: stringValue(property(transportFields, 'styleId')),
        selectors: frozenStringArray(property(transportFields, 'selectors')),
      },
    },
  };
  assertProviderId(runtimePolicy.providerId);
  if (!/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(runtimePolicy.id)) throw new Error('Player helper policy ID is invalid.');
  if (runtimePolicy.playerFamily !== 'embedded-vimeo') throw new Error('Player helper runtime family is unsupported.');
  validateMatching(runtimePolicy.match);
  const transport = runtimePolicy.capabilities.transportAutohide;
  if (transport.enabled !== true || !validIdle(transport.idleMs) || !/^[a-z][a-z0-9-]{0,119}$/.test(transport.idleClass) || !/^[a-z][a-z0-9-]{0,119}$/.test(transport.styleId) || !transport.selectors.every(SAFE_SELECTOR)) throw new Error('Player helper transport policy is invalid.');
  return runtimePolicy;
}
export function isolateCvmPolicyBlock(text) { const blocks = registryPolicyLayout(text).entries.map((entry) => entry.block).filter((block) => [...block.matchAll(/^\s*id\s*:\s*"cvm-tv-embedded-vimeo"/gm)].length > 0); if (blocks.length !== 1) throw new Error('Expected exactly one CVM approved policy.'); return blocks[0]; }
export function extractApprovedCvmPolicy(text) {
  const policy = parseObjectProperties(isolateCvmPolicyBlock(text), ['id', 'providerId', 'playerFamily', 'match', 'capabilities']);
  const match = parseFrozenObject(property(policy, 'match'), ['frameHost', 'allowFrameSubdomains', 'pathPrefix', 'pathSuffix', 'referrerHosts']);
  const capabilities = parseFrozenObject(property(policy, 'capabilities'), ['transportAutohide']);
  const [sourceCapabilityKey] = [...capabilities.keys()];
  if (sourceCapabilityKey !== 'transportAutohide') throw new Error('Unsupported CVM capability key.');
  const transport = parseFrozenObject(property(capabilities, sourceCapabilityKey), ['enabled', 'idleMs', 'idleClass', 'styleId', 'selectors']);
  const sourcePlayerFamily = stringValue(property(policy, 'playerFamily'));
  const idleMs = integerValue(property(transport, 'idleMs'));
  const styleId = stringValue(property(transport, 'styleId'));
  const entry = {
    policyId: stringValue(property(policy, 'id')),
    providerId: stringValue(property(policy, 'providerId')),
    sourcePlayerFamily,
    normalizedPlayerFamily: sourcePlayerFamily === 'embedded-vimeo' ? 'vimeo' : null,
    familyNormalizationRule: 'embedded-vimeo-to-vimeo',
    sourceCapabilityKey,
    normalizedCapabilityType: 'transport-autohide',
    capabilityNormalizationRule: 'transportAutohide-to-transport-autohide',
    trustedMatchingEvidence: {
      frameHost: stringValue(property(match, 'frameHost')),
      allowFrameSubdomains: booleanValue(property(match, 'allowFrameSubdomains')),
      pathPrefix: stringValue(property(match, 'pathPrefix')),
      pathSuffix: stringValue(property(match, 'pathSuffix')),
      referrerHosts: frozenStringArray(property(match, 'referrerHosts')),
    },
    transportAutohide: {
      enabled: booleanValue(property(transport, 'enabled')),
      idleMs,
      idleClass: stringValue(property(transport, 'idleClass')),
      selectors: frozenStringArray(property(transport, 'selectors')),
    },
    sourceContractMetadata: { styleId, targetObservationField: false },
  };
  if (entry.policyId !== 'cvm-tv-embedded-vimeo' || entry.providerId !== 'cvm-tv' || entry.sourcePlayerFamily !== 'embedded-vimeo' || entry.normalizedPlayerFamily !== 'vimeo' || entry.transportAutohide.enabled !== true || idleMs < 500 || idleMs > 10000 || !SAFE_SELECTOR(entry.transportAutohide.idleClass) || !/^[a-z][a-z0-9-]{0,119}$/.test(styleId) || !entry.transportAutohide.selectors.length || !entry.transportAutohide.selectors.every(SAFE_SELECTOR)) throw new Error('CVM approved policy contract is invalid.');
  validateMatching(entry.trustedMatchingEvidence);
  return entry;
}
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function count(value, needle) { return value.split(needle).length - 1; }
function parseObjectProperties(block, allowed) {
  const text = block.trim();
  if (text[0] !== '{' || balancedClose(text, 0) !== text.length - 1) throw new Error('Malformed object literal.');
  const fields = new Map(); let index = 1;
  while (index < text.length - 1) {
    index = skipSpaceComma(text, index);
    if (index >= text.length - 1) break;
    const nameMatch = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(text.slice(index));
    if (!nameMatch) throw new Error('Malformed object property name.');
    const name = nameMatch[0]; index += name.length; index = skipSpace(text, index);
    if (text[index] !== ':') throw new Error(`Malformed object property: ${name}.`);
    index = skipSpace(text, index + 1); const valueStart = index;
    const end = valueEnd(text, index);
    const raw = text.slice(valueStart, end).trim();
    if (!raw || fields.has(name)) throw new Error(`Duplicate or empty object property: ${name}.`);
    fields.set(name, { name, raw, start: valueStart, end }); index = end;
  }
  if (fields.size !== allowed.length || [...fields.keys()].some((name) => !allowed.includes(name)) || allowed.some((name) => !fields.has(name))) throw new Error('Object properties do not match the approved contract.');
  return fields;
}
function parseFrozenObject(value, allowed) { const text = value.raw.trim(); const prefix = 'Object.freeze('; if (!text.startsWith(prefix) || !text.endsWith(')')) throw new Error(`Property ${value.name} must be a frozen object.`); return parseObjectProperties(text.slice(prefix.length, -1), allowed); }
function property(fields, name) { const value = fields.get(name); if (!value) throw new Error(`Missing required property: ${name}.`); return value; }
function stringValue(value) { try { const parsed = JSON.parse(value.raw); if (typeof parsed !== 'string') throw new Error(); return parsed; } catch { throw new Error(`Property ${value.name} must be a string.`); } }
function booleanValue(value) { if (value.raw === 'true') return true; if (value.raw === 'false') return false; throw new Error(`Property ${value.name} must be boolean.`); }
function integerValue(value) { if (!/^(0|[1-9]\d*)$/.test(value.raw)) throw new Error(`Property ${value.name} must be an integer.`); return Number(value.raw); }
function frozenStringArray(value) { const text = value.raw.trim(); const prefix = 'Object.freeze('; if (!text.startsWith(prefix) || !text.endsWith(')')) throw new Error(`Property ${value.name} must be a frozen array.`); const arrayText = text.slice(prefix.length, -1); let parsed; try { parsed = JSON.parse(arrayText); } catch { throw new Error(`Property ${value.name} contains a malformed array.`); } if (!Array.isArray(parsed) || !parsed.length || !parsed.every((item) => typeof item === 'string')) throw new Error(`Property ${value.name} must be a non-empty string array.`); return parsed; }
function skipSpace(text, index) { while (/\s/.test(text[index] ?? '')) index += 1; return index; }
function skipSpaceComma(text, index) { index = skipSpace(text, index); if (text[index] === ',') index = skipSpace(text, index + 1); return index; }
function valueEnd(text, start) { let braces = 0; let brackets = 0; let parens = 0; let quote = null; let escape = false; for (let i = start; i < text.length; i += 1) { const ch = text[i]; if (quote) { if (escape) escape = false; else if (ch === '\\') escape = true; else if (ch === quote) quote = null; continue; } if (ch === '"' || ch === "'") { quote = ch; continue; } if (ch === '{') braces += 1; else if (ch === '}') { if (!braces && !brackets && !parens) return i; braces -= 1; if (braces < 0) throw new Error('Malformed object braces.'); } else if (ch === '[') brackets += 1; else if (ch === ']') { brackets -= 1; if (brackets < 0) throw new Error('Malformed array brackets.'); } else if (ch === '(') parens += 1; else if (ch === ')') { parens -= 1; if (parens < 0) throw new Error('Malformed parentheses.'); } else if (ch === ',' && !braces && !brackets && !parens) return i; } throw new Error('Unterminated object property value.'); }
function balancedClose(text, open) { let depth = 0; let quote = null; let escape = false; for (let i = open; i < text.length; i += 1) { const ch = text[i]; if (quote) { if (escape) escape = false; else if (ch === '\\') escape = true; else if (ch === quote) quote = null; continue; } if (ch === '"' || ch === "'") { quote = ch; continue; } if (ch === '{') depth += 1; else if (ch === '}' && --depth === 0) return i; } return -1; }
function balancedDelimited(text, open, opening, closing) { if (open < 0 || text[open] !== opening) return -1; let depth = 0; let quote = null; let escape = false; for (let i = open; i < text.length; i += 1) { const ch = text[i]; if (quote) { if (escape) escape = false; else if (ch === '\\') escape = true; else if (ch === quote) quote = null; continue; } if (ch === '"' || ch === "'") quote = ch; else if (ch === opening) depth += 1; else if (ch === closing && --depth === 0) return i; } return -1; }
function safeLstat(path, message) { try { return lstatSync(path); } catch { throw new Error(message); } }
function plain(value) { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function unique(values) { return [...new Set(values)].sort(); }
function deepFreeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); } return value; }
