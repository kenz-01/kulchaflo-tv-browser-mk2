import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYER_FAMILIES } from './player-families.mjs';
import { assertProviderId } from './redact-url.mjs';
import {
  createStagedHelperProposalOutputDirectory,
  writeHelperProposalJson,
  writeHelperProposalMarkdown,
} from './helper-proposal-output.mjs';

export const HELPER_PROPOSAL_VERSION = '0.1.0-checkpoint4d';
export const RECOMMENDATION_CATEGORIES = Object.freeze([
  'direct-registry-policy',
  'engine-extension-study',
  'provider-specific-helper',
  'insufficient-evidence',
]);
export const APPROVED_VIMEO_SELECTORS = Object.freeze([
  '.vp-controls',
  '.vp-sidedock',
  '.vp-title',
]);
export const SUPPORTED_CAPABILITIES = Object.freeze([
  'enabled',
  'idleMs',
  'selectors',
  'oneOwnedTimer',
  'interactionReveal',
  'pagehideCleanup',
  'urlFreeDiagnostics',
]);
export const UNSUPPORTED_REQUIREMENTS = Object.freeze([
  'readiness-predicate',
  'initial-settle-delay',
  'retry-delay-and-limit',
  'interaction-throttle',
  'inline-style-visibility',
  'external-reveal-bridge',
  'shared-provider-state',
]);

export const TRANSPORT_AUTOHIDE_CONTRACT = Object.freeze({
  playerFamily: 'vimeo',
  trustedMatching: Object.freeze(['frameHost', 'pathPrefix', 'pathSuffix', 'referrerHosts']),
  requiredCapabilities: SUPPORTED_CAPABILITIES,
  approvedSelectors: APPROVED_VIMEO_SELECTORS,
  unsupportedRequirements: UNSUPPORTED_REQUIREMENTS,
});
const PLAYER_LAB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY_ROOT = resolve(PLAYER_LAB_ROOT, '..', '..');
export const DEFAULT_HELPER_PROPOSAL_OUTPUT_ROOT = resolve(PLAYER_LAB_ROOT, 'reports', 'helper-proposals');
const PLAYER_LAB_REPORTS_ROOT = resolve(PLAYER_LAB_ROOT, 'reports');

export function proposeHelper({
  reportPath,
  outputRoot,
  additionalArtifacts = {},
  now = () => new Date(),
  createOutputDirectory = createStagedHelperProposalOutputDirectory,
  writeJson = writeHelperProposalJson,
  writeMarkdown = writeHelperProposalMarkdown,
} = {}) {
  const evidence = loadHelperEvidence(reportPath);
  const root = resolveSafePlayerLabReportsOutputRoot(outputRoot, DEFAULT_HELPER_PROPOSAL_OUTPUT_ROOT);
  validateAdditionalArtifacts(additionalArtifacts);
  const output = createOutputDirectory({ outputRoot: root, now });
  let completed = false;
  try {
    const proposal = createHelperRecommendation(evidence, { generatedAt: now().toISOString() });
    assertSafeHelperProposal(proposal);
    writeJson(proposal, { outputDir: output.incompleteDir });
    writeMarkdown(proposal, { outputDir: output.incompleteDir });
    for (const [name, value] of Object.entries(additionalArtifacts)) {
      const path = resolve(output.incompleteDir, name);
      writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
      const stat = lstatSync(path);
      if (dirname(path) !== output.incompleteDir || !stat.isFile() || stat.isSymbolicLink()) throw new Error('Additional helper proposal artifact is invalid.');
    }
    const outputDir = output.promote();
    completed = true;
    return Object.freeze({
      outputDir,
      jsonPath: resolve(outputDir, 'helper-proposal.json'),
      markdownPath: resolve(outputDir, 'helper-proposal.md'),
      recommendation: proposal,
    });
  } finally {
    if (!completed) output.cleanup();
  }
}

export function resolveHelperProposalOutputRoot(outputRoot) {
  return resolveSafePlayerLabReportsOutputRoot(outputRoot, DEFAULT_HELPER_PROPOSAL_OUTPUT_ROOT);
}

export function resolveSafePlayerLabReportsOutputRoot(outputRoot, defaultRoot) {
  const root = outputRoot === undefined || outputRoot === null
    ? resolve(defaultRoot)
    : resolve(outputRoot);
  if (isInside(root, REPOSITORY_ROOT) && !isInside(root, PLAYER_LAB_REPORTS_ROOT)) {
    throw new Error('Repository proposal output must be beneath tools/player-lab/reports.');
  }
  rejectSymlinkComponents(root, isInside(root, REPOSITORY_ROOT) ? REPOSITORY_ROOT : null);
  return root;
}

export function loadHelperEvidence(reportPath) {
  if (typeof reportPath !== 'string' || reportPath.trim() === '') {
    throw new Error('Helper evidence directory is required.');
  }
  const reportDir = resolve(reportPath);
  let stat;
  try {
    stat = lstatSync(reportDir);
  } catch {
    throw new Error('Helper evidence directory does not exist.');
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error('Helper evidence input must be a regular directory.');
  }
  const evidencePath = resolve(reportDir, 'helper-evidence.json');
  if (dirname(evidencePath) !== reportDir) throw new Error('Helper evidence path traversal rejected.');
  let evidenceStat;
  try {
    evidenceStat = lstatSync(evidencePath);
  } catch {
    throw new Error('Helper evidence directory must contain helper-evidence.json.');
  }
  if (evidenceStat.isSymbolicLink() || !evidenceStat.isFile()) {
    throw new Error('Helper evidence must be a regular JSON file.');
  }
  let evidence;
  try {
    evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
  } catch (error) {
    throw new Error(`Malformed helper evidence JSON: ${error.message}`);
  }
  validateHelperEvidence(evidence);
  assertSafeHelperProposal(evidence);
  return deepFreeze(structuredClone(evidence));
}

export function validateHelperEvidence(evidence) {
  if (!isPlainObject(evidence)) throw new Error('Helper evidence must be an object.');
  if (evidence.schemaVersion !== 1) throw new Error('Helper evidence schemaVersion must be 1.');
  assertProviderId(evidence.providerId);
  if (evidence.targetId !== undefined && evidence.targetId !== null) assertProviderId(evidence.targetId);
  if (!PLAYER_FAMILIES.includes(evidence.playerFamily)) {
    throw new Error('Helper evidence playerFamily is not supported.');
  }
  if (!isPlainObject(evidence.trustedMatchingEvidence)) {
    throw new Error('Helper evidence trustedMatchingEvidence is required.');
  }
  const matching = evidence.trustedMatchingEvidence;
  for (const field of TRANSPORT_AUTOHIDE_CONTRACT.trustedMatching) {
    if (field === 'referrerHosts') continue;
    if (matching[field] !== undefined && typeof matching[field] !== 'string') {
      throw new Error(`Trusted matching field ${field} must be a string.`);
    }
  }
  if (matching.referrerHosts !== undefined &&
    (!Array.isArray(matching.referrerHosts) || !matching.referrerHosts.every(isHostname))) {
    throw new Error('Trusted matching referrerHosts must be lowercase hostnames.');
  }
  if (!Array.isArray(evidence.supportedCapabilities) || !evidence.supportedCapabilities.every((item) => SUPPORTED_CAPABILITIES.includes(item))) {
    throw new Error('Helper evidence supportedCapabilities must use current contract values.');
  }
  if (!Array.isArray(evidence.unsupportedRequirements) || !evidence.unsupportedRequirements.every((item) => UNSUPPORTED_REQUIREMENTS.includes(item))) {
    throw new Error('Helper evidence unsupportedRequirements must use known values.');
  }
  if (!Array.isArray(evidence.sourceEvidenceReferences) || !evidence.sourceEvidenceReferences.every(isSafeReference)) {
    throw new Error('Helper evidence sourceEvidenceReferences must contain safe references.');
  }
  if (evidence.transportAutohide !== undefined && !isPlainObject(evidence.transportAutohide)) {
    throw new Error('Helper evidence transportAutohide must be an object when present.');
  }
  validateTransportEvidence(evidence.transportAutohide);
  if (evidence.providerSpecificBehavior !== undefined && typeof evidence.providerSpecificBehavior !== 'boolean') {
    throw new Error('Helper evidence providerSpecificBehavior must be boolean when present.');
  }
  if (evidence.conflictingEvidence !== undefined && typeof evidence.conflictingEvidence !== 'boolean') {
    throw new Error('Helper evidence conflictingEvidence must be boolean when present.');
  }
  assertSafeHelperProposal(evidence);
  return true;
}

export function createHelperRecommendation(evidence, { generatedAt = new Date().toISOString() } = {}) {
  validateHelperEvidence(evidence);
  const unsupported = [...new Set(evidence.unsupportedRequirements)].sort();
  const supported = [...new Set(evidence.supportedCapabilities)].sort();
  const warnings = [];
  let recommendationCategory = 'insufficient-evidence';
  let recommendationReason = 'Evidence does not establish a safe reusable helper contract.';
  let confidence = 'low';
  let policyProposal = null;

  if (unsupported.length > 0) {
    recommendationCategory = 'engine-extension-study';
    recommendationReason = 'Required behavior exceeds the current registry capability contract.';
    confidence = 'high';
    warnings.push('No policy is generated while unsupported behavior is required.');
  } else if (evidence.conflictingEvidence === true) {
    recommendationCategory = 'insufficient-evidence';
    recommendationReason = 'Structured evidence contains a conflict and cannot authorize a helper classification.';
    confidence = 'low';
    warnings.push('A contradictory structured capability claim blocks every policy recommendation.');
  } else if (evidence.providerSpecificBehavior === true) {
    recommendationCategory = 'provider-specific-helper';
    recommendationReason = 'Observed behavior includes provider-specific selection or orchestration semantics.';
    confidence = 'high';
    warnings.push('Do not generalize provider-specific player selection from this evidence.');
  } else if (!hasCompleteMatching(evidence.trustedMatchingEvidence)) {
    recommendationCategory = 'insufficient-evidence';
    recommendationReason = 'Trusted provider/frame matching evidence is incomplete.';
    confidence = 'low';
    warnings.push('Player family detection alone never authorizes a registry policy.');
  } else if (isDirectTransportContract(evidence, supported)) {
    recommendationCategory = 'direct-registry-policy';
    recommendationReason = 'Evidence matches the existing embedded-Vimeo transport-auto-hide contract without advanced requirements.';
    confidence = 'high';
    policyProposal = createRegistryPolicyProposal(evidence);
    warnings.push('Proposed policy is unapproved and must be reviewed before any Android runtime change.');
  } else {
    recommendationCategory = 'provider-specific-helper';
    recommendationReason = 'Evidence is coherent but does not match an existing supported capability contract.';
    confidence = 'medium';
  }

  return deepFreeze({
    schemaVersion: 1,
    providerId: evidence.providerId,
    targetId: evidence.targetId ?? null,
    playerFamily: evidence.playerFamily,
    generatedAt,
    proposalVersion: HELPER_PROPOSAL_VERSION,
    confidence,
    recommendationCategory,
    recommendationReason,
    supportedCapabilities: supported,
    unsupportedRequirements: unsupported,
    trustedMatchingEvidence: normalizeMatching(evidence.trustedMatchingEvidence),
    policyProposal,
    reviewWarnings: warnings,
    sourceEvidenceReferences: [...new Set(evidence.sourceEvidenceReferences)].sort(),
  });
}

export function createRegistryPolicyProposal(evidence) {
  if (evidence.unsupportedRequirements.length > 0 || !hasCompleteMatching(evidence.trustedMatchingEvidence)) {
    throw new Error('Unsupported or incomplete evidence cannot generate a registry policy.');
  }
  const config = evidence.transportAutohide;
  return deepFreeze({
    proposalStatus: 'unapproved',
    id: `${evidence.providerId}-embedded-vimeo`,
    playerFamily: 'embedded-vimeo',
    match: normalizeMatching(evidence.trustedMatchingEvidence),
    capabilities: {
      transportAutohide: {
        enabled: true,
        idleMs: config.idleMs,
        selectors: [...config.selectors],
      },
    },
  });
}

function isDirectTransportContract(evidence, supported) {
  const config = evidence.transportAutohide;
  return evidence.playerFamily === TRANSPORT_AUTOHIDE_CONTRACT.playerFamily &&
    Boolean(config?.enabled) &&
    hasCompleteMatching(evidence.trustedMatchingEvidence) &&
    TRANSPORT_AUTOHIDE_CONTRACT.requiredCapabilities.every((item) => supported.includes(item)) &&
    config.oneOwnedTimer === true && config.interactionReveal === true &&
    config.pagehideCleanup === true && config.urlFreeDiagnostics === true &&
    approvedSelectorList(config.selectors);
}

function validateTransportEvidence(config) {
  if (config === undefined) return;
  for (const key of ['enabled', 'oneOwnedTimer', 'interactionReveal', 'pagehideCleanup', 'urlFreeDiagnostics']) {
    if (typeof config[key] !== 'boolean') throw new Error(`Transport evidence ${key} must be boolean.`);
  }
  if (!Number.isInteger(config.idleMs) || config.idleMs < 500 || config.idleMs > 10000) {
    throw new Error('Transport evidence idleMs must be an integer from 500 to 10000.');
  }
  validateEvidenceSelectorList(config.selectors);
}

function normalizeMatching(matching) {
  return deepFreeze({
    frameHost: matching.frameHost ?? null,
    pathPrefix: matching.pathPrefix ?? null,
    pathSuffix: matching.pathSuffix ?? null,
    allowFrameSubdomains: matching.allowFrameSubdomains === true,
    referrerHosts: Array.isArray(matching.referrerHosts) ? [...matching.referrerHosts].sort() : [],
  });
}

function hasCompleteMatching(matching) {
  return typeof matching.frameHost === 'string' && isHostname(matching.frameHost) &&
    typeof matching.pathPrefix === 'string' && matching.pathPrefix.startsWith('/') &&
    typeof matching.pathSuffix === 'string' && matching.pathSuffix.startsWith('/') &&
    Array.isArray(matching.referrerHosts) && matching.referrerHosts.length > 0 && matching.referrerHosts.every(isHostname);
}

function approvedSelectorList(selectors) {
  return Array.isArray(selectors) && selectors.length === APPROVED_VIMEO_SELECTORS.length &&
    [...new Set(selectors)].length === selectors.length &&
    [...selectors].sort().join('|') === [...APPROVED_VIMEO_SELECTORS].sort().join('|');
}

function validateEvidenceSelectorList(selectors) {
  if (!Array.isArray(selectors) || selectors.length === 0 || selectors.length > 12) {
    throw new Error('Transport evidence selectors must be a non-empty bounded array.');
  }
  for (const selector of selectors) {
    if (typeof selector !== 'string' || selector.length === 0 || selector.length > 160) {
      throw new Error('Transport evidence selectors must be bounded strings.');
    }
    if (/[\u0000-\u001f\u007f]/.test(selector) || /:\/\/|\burl\s*\(|<|>|\{|\}|;|@import|javascript:/i.test(selector)) {
      throw new Error('Transport evidence selector contains unsafe material.');
    }
  }
}

function isHostname(value) {
  return typeof value === 'string' && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/.test(value);
}

function isSafeReference(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 120 && !/[\s/?#@]/.test(value);
}

export function assertSafeHelperProposal(value) {
  const text = JSON.stringify(value);
  const unsafe = [
    [/(?:https?|file):\/\//i, 'raw URL'],
    [/https?:\/\/[^\s"<>]+[?#]/i, 'query string or fragment'],
    [/https?:\/\/[^/\s"<>]+@/i, 'embedded credentials'],
    [/\b(cookie|authorization)\s*[:=]/i, 'cookie or Authorization value'],
    [/\bbearer\s+[a-z0-9._-]+/i, 'bearer token'],
    [/\b(signature|sig|token|expires)=/i, 'signed URL or token value'],
    [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, 'email address'],
    [/\/Users\/[A-Za-z0-9._-]+|\/home\/[A-Za-z0-9._-]+|[A-Z]:\\+Users\\+[^\\/]+/i, 'local executable or home path'],
  ];
  for (const [pattern, reason] of unsafe) {
    if (pattern.test(text)) throw new Error(`Unsafe helper proposal content rejected: ${reason}.`);
  }
  return true;
}

function validateAdditionalArtifacts(artifacts) {
  if (!plainJsonObject(artifacts)) throw new Error('Additional helper proposal artifacts must be an object.');
  for (const [name, value] of Object.entries(artifacts)) {
    if (!/^[a-z0-9][a-z0-9-]{0,119}\.json$/.test(name)) throw new Error('Additional helper proposal artifact name is invalid.');
    if (!plainJsonObject(value) || !jsonCompatible(value)) throw new Error('Additional helper proposal artifact must be a plain JSON-compatible object.');
    assertSafeHelperProposal(value);
  }
}

function jsonCompatible(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(jsonCompatible);
  return plainJsonObject(value) && Object.values(value).every(jsonCompatible);
}

function plainJsonObject(value) { return Boolean(value && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)); }

function isInside(child, parent) {
  return child === parent || child.startsWith(`${parent}/`);
}

function rejectSymlinkComponents(target, boundary) {
  const normalized = resolve(target);
  const stop = boundary ? resolve(boundary) : dirname(normalized);
  if (boundary && !isInside(normalized, stop)) throw new Error('Proposal output traversal rejected.');
  const relative = boundary ? normalized.slice(stop.length).split('/').filter(Boolean) : [];
  let current = stop;
  if (boundary && existsSync(current) && lstatSync(current).isSymbolicLink()) {
    throw new Error('Proposal output root must not use symbolic links.');
  }
  for (const part of relative) {
    current = resolve(current, part);
    if (!existsSync(current)) break;
    if (lstatSync(current).isSymbolicLink()) throw new Error('Proposal output root must not use symbolic links.');
  }
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
