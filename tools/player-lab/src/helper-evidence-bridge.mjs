import { lstatSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertProviderId } from './redact-url.mjs';
import { PLAYER_FAMILIES } from './player-families.mjs';
import { assertSafeHelperProposal, resolveSafePlayerLabReportsOutputRoot, SUPPORTED_CAPABILITIES, validateHelperEvidence } from './helper-proposal.mjs';
import { createStagedHelperEvidenceOutputDirectory, writeHelperEvidenceArtifacts } from './helper-evidence-output.mjs';

export const HELPER_EVIDENCE_BRIDGE_VERSION = '0.1.0-checkpoint4e';
export const DEFAULT_HELPER_EVIDENCE_OUTPUT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'reports', 'helper-evidence');
const DIRECT_AUTHORITY = 'directly-observed-structured-evidence';
const ADVANCED_REQUIREMENTS = new Set([
  'readiness-predicate', 'initial-settle-delay', 'retry-delay-and-limit',
  'interaction-throttle', 'inline-style-visibility', 'external-reveal-bridge', 'shared-provider-state',
]);
const DIRECT_CAPABILITIES = Object.freeze(['enabled', 'idleMs', 'selectors', 'oneOwnedTimer', 'interactionReveal', 'pagehideCleanup', 'urlFreeDiagnostics']);

export function prepareHelperEvidence({ analysisPath, outputRoot, now = () => new Date(), createOutputDirectory = createStagedHelperEvidenceOutputDirectory } = {}) {
  const source = loadBridgeSource(analysisPath);
  const root = resolveSafePlayerLabReportsOutputRoot(outputRoot, DEFAULT_HELPER_EVIDENCE_OUTPUT_ROOT);
  const output = createOutputDirectory({ outputRoot: root, now });
  let completed = false;
  try {
    const { evidence, provenance } = bridgeAnalysisToHelperEvidence(source);
    writeHelperEvidenceArtifacts(evidence, provenance, { outputDir: output.incompleteDir });
    const outputDir = output.promote();
    completed = true;
    return Object.freeze({ outputDir, evidencePath: resolve(outputDir, 'helper-evidence.json'), provenancePath: resolve(outputDir, 'helper-evidence-provenance.json'), evidence, provenance });
  } finally {
    if (!completed) output.cleanup();
  }
}

export function loadBridgeSource(analysisPath) {
  if (typeof analysisPath !== 'string' || !analysisPath.trim()) throw new Error('Analysis directory is required.');
  const directory = resolve(analysisPath);
  const stat = safeLstat(directory, 'Analysis directory does not exist.');
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Analysis input must be a regular directory.');
  const analysisArtifact = readStructuredFile(directory, 'analysis.json');
  const analysis = analysisArtifact.value;
  validateAnalysisArtifact(analysis);
  let observations = null;
  try {
    observations = readStructuredFile(directory, 'helper-capability-observations.json').value;
    validateCapabilityObservations(observations, analysis, analysisArtifact.sha256);
  } catch (error) {
    if (!String(error.message).includes('does not exist')) throw error;
  }
  return deepFreeze({ directory, analysis: structuredClone(analysis), analysisSha256: analysisArtifact.sha256, observations: observations ? structuredClone(observations) : null });
}

export function bridgeAnalysisToHelperEvidence(source) {
  const analysis = source.analysis;
  const observations = source.observations;
  const observed = observations?.authority === DIRECT_AUTHORITY ? observations : null;
  const unavailable = [];
  const direct = [];
  const derived = ['providerId', 'playerFamily'];
  if (analysis.targetId) derived.splice(1, 0, 'targetId');
  const matching = observed?.trustedMatchingEvidence ? structuredClone(observed.trustedMatchingEvidence) : {};
  const rawTransport = observed?.transportAutohide ? structuredClone(observed.transportAutohide) : undefined;
  const claimedCapabilities = observed?.supportedCapabilities ? [...observed.supportedCapabilities] : [];
  const unsupportedRequirements = observed?.unsupportedRequirements ? [...observed.unsupportedRequirements] : [];
  const providerSpecificBehavior = observed?.providerSpecificBehavior === true;
  const matchingStatus = collectMatchingStatus(matching, direct, unavailable);
  const capabilityStatus = collectCapabilityStatus(rawTransport, claimedCapabilities, direct, unavailable);
  const transport = capabilityStatus.fullShape ? rawTransport : undefined;
  const supportedCapabilities = capabilityStatus.coherentClaims;
  if (unsupportedRequirements.length) direct.push('unsupportedRequirements');
  if (providerSpecificBehavior) direct.push('providerSpecificBehavior');
  const directContractRequired = analysis.evidenceSummary?.primaryPlayerFamily === 'vimeo' && !providerSpecificBehavior;
  const incompleteMatching = directContractRequired && !matchingStatus.complete;
  const incompleteCapability = directContractRequired && !capabilityStatus.completeDirectContract;
  const explicitConflictFields = [
    ...(analysis.conflictingEvidence === true ? ['analysis.conflictingEvidence'] : []),
    ...(observed?.conflictingEvidence === true ? ['observations.conflictingEvidence'] : []),
  ];
  const hardConflict = explicitConflictFields.length > 0 || capabilityStatus.conflicts.length > 0;
  const conflictingEvidence = hardConflict || incompleteMatching || incompleteCapability;
  const evidence = {
    schemaVersion: 1,
    providerId: analysis.providerId,
    ...(analysis.targetId ? { targetId: analysis.targetId } : {}),
    playerFamily: analysis.evidenceSummary.primaryPlayerFamily,
    trustedMatchingEvidence: matching,
    supportedCapabilities,
    unsupportedRequirements,
    ...(transport ? { transportAutohide: transport } : {}),
    providerSpecificBehavior,
    conflictingEvidence,
    sourceEvidenceReferences: ['analysis-json', ...(observed?.sourceEvidenceReferences ?? [])],
  };
  validateHelperEvidence(evidence);
  assertSafeHelperProposal(evidence);
  const provenance = {
    schemaVersion: 1,
    bridgeVersion: HELPER_EVIDENCE_BRIDGE_VERSION,
    sourceArtifactTypes: observations ? ['analysis.json', 'helper-capability-observations.json'] : ['analysis.json'],
    sourceArtifactIds: ['analysis-json', ...(observed?.sourceEvidenceReferences ?? [])],
    directlyObservedFields: direct.sort(),
    validatedAnalyzerDerivedFields: derived,
    fixtureOrTestEvidenceFields: [],
    unavailableFields: [...new Set(unavailable)].sort(),
    conflictingFields: [...new Set([...capabilityStatus.conflicts, ...explicitConflictFields])].sort(),
    downgradeReasons: [
      ...(incompleteMatching ? ['trusted-matching-unavailable'] : []),
      ...(incompleteCapability ? ['direct-transport-contract-incomplete'] : []),
      ...(capabilityStatus.conflicts.length ? ['capability-claim-contradicts-observation'] : []),
      ...(explicitConflictFields.length ? ['structured-observation-conflict'] : []),
    ],
  };
  assertSafeHelperProposal(provenance);
  return deepFreeze({ evidence, provenance });
}

function validateAnalysisArtifact(analysis) {
  if (!plain(analysis) || analysis.schemaVersion !== 1) throw new Error('Analysis artifact schemaVersion must be 1.');
  assertProviderId(analysis.providerId);
  if (analysis.targetId !== undefined && analysis.targetId !== null) assertProviderId(analysis.targetId);
  if (!plain(analysis.evidenceSummary) || !PLAYER_FAMILIES.includes(analysis.evidenceSummary.primaryPlayerFamily)) {
    throw new Error('Analysis artifact must contain a canonical primary player family.');
  }
}

function validateCapabilityObservations(value, analysis, analysisSha256) {
  if (!plain(value) || value.schemaVersion !== 1 || value.authority !== DIRECT_AUTHORITY) throw new Error('Capability observations must be direct structured evidence.');
  assertProviderId(value.providerId);
  if (!PLAYER_FAMILIES.includes(value.playerFamily)) throw new Error('Capability observation playerFamily is invalid.');
  if (value.providerId !== analysis.providerId || value.playerFamily !== analysis.evidenceSummary.primaryPlayerFamily) throw new Error('Capability observations do not match analysis identity.');
  const analysisTarget = analysis.targetId ?? null;
  const observationTarget = value.targetId ?? null;
  if (analysisTarget !== observationTarget) throw new Error('Capability observations do not match analysis target identity.');
  if (typeof value.analysisSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.analysisSha256) || value.analysisSha256 !== analysisSha256) throw new Error('Capability observations do not match analysis SHA-256.');
  if (value.trustedMatchingEvidence !== undefined && !plain(value.trustedMatchingEvidence)) throw new Error('Capability trusted matching must be structured.');
  if (value.supportedCapabilities !== undefined && (!Array.isArray(value.supportedCapabilities) || !value.supportedCapabilities.every((item) => SUPPORTED_CAPABILITIES.includes(item)))) throw new Error('Capability supportedCapabilities must use known values.');
  if (value.unsupportedRequirements !== undefined && (!Array.isArray(value.unsupportedRequirements) || !value.unsupportedRequirements.every((item) => ADVANCED_REQUIREMENTS.has(item)))) throw new Error('Capability unsupportedRequirements are invalid.');
  if (value.sourceEvidenceReferences !== undefined && (!Array.isArray(value.sourceEvidenceReferences) || !value.sourceEvidenceReferences.every(safeReference))) throw new Error('Capability source references are invalid.');
  if (value.providerSpecificBehavior !== undefined && typeof value.providerSpecificBehavior !== 'boolean') throw new Error('Capability providerSpecificBehavior must be boolean.');
  if (value.conflictingEvidence !== undefined && typeof value.conflictingEvidence !== 'boolean') throw new Error('Capability conflictingEvidence must be boolean.');
  validatePartialTransport(value.transportAutohide);
}

function collectMatchingStatus(value, direct, unavailable) {
  const fields = ['frameHost', 'pathPrefix', 'pathSuffix', 'referrerHosts'];
  for (const field of fields) {
    if (value[field] === undefined || (field === 'referrerHosts' && (!Array.isArray(value[field]) || value[field].length === 0))) unavailable.push(`trustedMatchingEvidence.${field}`);
    else direct.push(`trustedMatchingEvidence.${field}`);
  }
  return { complete: unavailable.every((field) => !field.startsWith('trustedMatchingEvidence.')) };
}

function collectCapabilityStatus(transport, claims, direct, unavailable) {
  const coherentClaims = [];
  const conflicts = [];
  for (const capability of DIRECT_CAPABILITIES) {
    const backing = transportBackingIsValid(transport, capability);
    if (backing.present) direct.push(`transportAutohide.${capability}`);
    else unavailable.push(`transportAutohide.${capability}`);
    if (claims.includes(capability)) {
      if (backing.valid) coherentClaims.push(capability);
      else conflicts.push(`transportAutohide.${capability}`);
    }
  }
  const fullShape = DIRECT_CAPABILITIES.every((capability) => transportBackingIsValid(transport, capability).present);
  return {
    coherentClaims,
    conflicts,
    fullShape,
    completeDirectContract: fullShape && DIRECT_CAPABILITIES.every((capability) => coherentClaims.includes(capability)),
  };
}

function transportBackingIsValid(transport, capability) {
  if (!plain(transport)) return { present: false, valid: false };
  const value = transport[capability];
  if (value === undefined) return { present: false, valid: false };
  if (capability === 'idleMs') return { present: true, valid: Number.isInteger(value) && value >= 500 && value <= 10000 };
  if (capability === 'selectors') return { present: true, valid: Array.isArray(value) && value.length > 0 };
  return { present: true, valid: value === true };
}

function validatePartialTransport(value) {
  if (value === undefined) return;
  if (!plain(value)) throw new Error('Capability transport observation must be structured.');
  for (const key of ['enabled', 'oneOwnedTimer', 'interactionReveal', 'pagehideCleanup', 'urlFreeDiagnostics']) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') throw new Error(`Capability transport ${key} must be boolean.`);
  }
  if (value.idleMs !== undefined && (!Number.isInteger(value.idleMs) || value.idleMs < 500 || value.idleMs > 10000)) throw new Error('Capability transport idleMs is invalid.');
  if (value.selectors !== undefined && (!Array.isArray(value.selectors) || value.selectors.length === 0 || !value.selectors.every((item) => typeof item === 'string' && item.length <= 160 && !/[\u0000-\u001f\u007f]|:\/\/|<|>|\{|\}|;|@import|javascript:/i.test(item)))) throw new Error('Capability transport selectors are invalid.');
}

function readStructuredFile(directory, name) {
  const path = resolve(directory, name);
  if (dirname(path) !== directory) throw new Error('Bridge artifact traversal rejected.');
  const stat = safeLstat(path, `Bridge artifact ${name} does not exist.`);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Bridge artifact ${name} must be a regular file.`);
  const bytes = readFileSync(path);
  try { return { value: JSON.parse(bytes.toString('utf8')), sha256: createHash('sha256').update(bytes).digest('hex') }; } catch (error) { throw new Error(`Malformed ${name}: ${error.message}`); }
}

function safeLstat(path, message) { try { return lstatSync(path); } catch { throw new Error(message); } }
function safeReference(value) { return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,119}$/.test(value); }
function plain(value) { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function deepFreeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); } return value; }
