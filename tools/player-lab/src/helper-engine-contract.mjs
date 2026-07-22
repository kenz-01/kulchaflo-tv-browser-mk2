import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertProviderId } from './redact-url.mjs';
import { PLAYER_FAMILIES } from './player-families.mjs';
import { APPROVED_VIMEO_SELECTORS, SUPPORTED_CAPABILITIES, assertSafeHelperProposal, resolveSafePlayerLabReportsOutputRoot } from './helper-proposal.mjs';
import { filesystemSafeTimestamp } from './output-directory.mjs';
import { validateCapabilityObservations } from './helper-evidence-bridge.mjs';

export const ENGINE_ID = 'transport-autohide-v1';
export const ENGINE_CONTRACT_VERSION = 1;
export const ENGINE_SOURCE_ARTIFACT = 'app-gv/src/main/assets/gv_media_observer/content.js';
export const DEFAULT_ENGINE_SOURCE_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'app-gv', 'src', 'main', 'assets', 'gv_media_observer', 'content.js');
export const DEFAULT_ENGINE_CERTIFICATION_OUTPUT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'reports', 'helper-engine-certifications');
export const DEFAULT_OBSERVATION_ASSEMBLY_OUTPUT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'reports', 'helper-observation-assemblies');
const ENGINE_GUARANTEES = Object.freeze(['oneOwnedTimer', 'interactionReveal', 'pagehideCleanup', 'urlFreeDiagnostics']);
const ADVANCED_REQUIREMENTS = new Set(['readiness-predicate', 'initial-settle-delay', 'retry-delay-and-limit', 'interaction-throttle', 'inline-style-visibility', 'external-reveal-bridge', 'shared-provider-state']);

export function certifyTransportAutohideEngine({ sourcePath = DEFAULT_ENGINE_SOURCE_PATH, sourceText, generatedAt = new Date().toISOString() } = {}) {
  const bytes = sourceText === undefined ? readRegularBytes(sourcePath, 'Engine source must be a regular file.') : Buffer.from(sourceText, 'utf8');
  const text = bytes.toString('utf8');
  const sourceSha256 = sha256(bytes);
  const engine = extractEngine(text);
  const installer = extractFunction(text, 'installTransportAutohideCapability');
  const matcherInstaller = extractFunction(text, 'installMatchedPlayerHelperCapabilities');
  const matchedPolicy = extractFunction(text, 'matchedPlayerHelperPolicy');
  const policyMatcher = extractFunction(text, 'matchesPlayerHelperPolicy');
  const selectors = extractSelectors(text);
  const diagnostic = inspectDiagnosticPayload(installer);
  const registry = extractRegistry(text);
  const registryPolicyCount = registry.ids.length;
  const checks = {
    oneGenericEngine: count(text, 'function installTransportAutohideCapability(') === 1,
    exactlyOneRegistryPolicy: registry.complete && registryPolicyCount === 1,
    oneTimerImplementation: count(installer, 'engine.timer = setTimeout(') === 1 && count(engine, 'setTimeout(') === 1,
    clearsBeforeReschedule: /if \(engine\.timer\) \{\s*clearTimeout\(engine\.timer\);\s*engine\.timer = null;/.test(installer),
    interactionReveal: /root\.classList\.remove\(capability\.idleClass\)/.test(installer) && count(installer, 'TRANSPORT_AUTOHIDE_INTERACTION_EVENTS.forEach') === 1,
    pagehideCleanup: /window\.addEventListener\("pagehide", \(\) => \{\s*if \(engine\.timer\) \{\s*clearTimeout\(engine\.timer\);\s*engine\.timer = null;/.test(installer),
    boundedDiagnostics: diagnostic.type === 'player-helper-capability' && sameList(diagnostic.fields, ['policyId', 'capability', 'phase', 'reason', 'delayMs']) && diagnostic.originsValid,
    urlFreeDiagnostics: !diagnostic.fields.some((field) => /(url|uri|href|location|source|media|path|referrer)/i.test(field)),
    approvedSelectors: sameList(selectors, APPROVED_VIMEO_SELECTORS),
    policyResolutionBeforeInstallation: /^\s*const policy = matchedPlayerHelperPolicy\(\);\s*if \(!policy\) return false;\s*return installTransportAutohideCapability\(policy\);\s*$/s.test(matcherInstaller),
    matchedPolicySelectsOnlyMatches: /^\s*return PLAYER_HELPER_REGISTRY\.find\(\(policy\) => matchesPlayerHelperPolicy\(policy\)\) \|\| null;\s*$/s.test(matchedPolicy),
    matcherAppliesTrustedScope: /if \(!policy \|\| !policy\.match\) return false;/.test(policyMatcher) &&
      /const frameHost = String\(window\.location\.hostname \|\| ""\)\.toLowerCase\(\);/.test(policyMatcher) &&
      /const framePath = String\(window\.location\.pathname \|\| ""\)\.toLowerCase\(\);/.test(policyMatcher) &&
      /const referrerHost = hostnameFromUrl\(document\.referrer\);/.test(policyMatcher) &&
      /if \(!matchesExactOrSubdomain\(frameHost, match\.frameHost, match\.allowFrameSubdomains\)\) return false;/.test(policyMatcher) &&
      /if \(!framePath\.startsWith\(match\.pathPrefix\) \|\| !framePath\.endsWith\(match\.pathSuffix\)\) return false;/.test(policyMatcher) &&
      /return Array\.isArray\(match\.referrerHosts\) && match\.referrerHosts\.indexOf\(referrerHost\) >= 0;/.test(policyMatcher),
    nonMatchingInstallsNothing: /if \(!capability \|\| !capability\.enabled \|\| transportAutohideEngine\) return false;/.test(installer) && /if \(!matchesPlayerHelperPolicy\(policy\)\) return;/.test(installer),
    oneInteractionListenerLoop: count(installer, 'TRANSPORT_AUTOHIDE_INTERACTION_EVENTS.forEach') === 1 && count(engine, 'TRANSPORT_AUTOHIDE_INTERACTION_EVENTS.forEach') === 1,
    onePagehideListener: count(installer, 'window.addEventListener("pagehide"') === 1 && count(engine, 'window.addEventListener("pagehide"') === 1,
    noGlobalTransportInstallation: count(engine, 'window.addEventListener(') === 2 && count(engine, 'setTimeout(') === 1,
    policySeparatedFromEngine: /function matchedPlayerHelperPolicy\(\)/.test(text) && /function matchesPlayerHelperPolicy\(policy\)/.test(text),
  };
  const certificationStatus = Object.values(checks).every(Boolean) ? 'certified' : 'failed';
  const certificate = {
    schemaVersion: 1,
    contractVersion: ENGINE_CONTRACT_VERSION,
    engineId: ENGINE_ID,
    playerFamily: 'vimeo',
    sourceArtifact: ENGINE_SOURCE_ARTIFACT,
    sourceSha256,
    registryPolicyCount,
    transportEngineCount: count(text, 'function installTransportAutohideCapability('),
    timerImplementationCount: count(engine, 'engine.timer = setTimeout('),
    supportedGuarantees: certificationStatus === 'certified' ? [...ENGINE_GUARANTEES] : [],
    approvedSelectors: selectors,
    diagnosticFields: diagnostic.fields,
    certificationChecks: checks,
    certificationStatus,
    generatedAt,
  };
  assertSafeHelperProposal(certificate);
  return deepFreeze(certificate);
}

export function validateEngineCertification(certification, { sourcePath = DEFAULT_ENGINE_SOURCE_PATH } = {}) {
  if (!plain(certification)) throw new Error('Engine certification has an unsupported contract.');
  const bytes = readRegularBytes(sourcePath, 'Engine source must be a regular file.');
  const fresh = certifyTransportAutohideEngine({ sourceText: bytes.toString('utf8'), generatedAt: certification.generatedAt });
  if (fresh.certificationStatus !== 'certified') throw new Error('Independent engine recertification failed.');
  for (const field of ['schemaVersion', 'contractVersion', 'engineId', 'playerFamily', 'sourceArtifact', 'sourceSha256', 'registryPolicyCount', 'transportEngineCount', 'timerImplementationCount', 'supportedGuarantees', 'approvedSelectors', 'diagnosticFields', 'certificationChecks', 'certificationStatus']) {
    if (JSON.stringify(certification[field]) !== JSON.stringify(fresh[field])) throw new Error(`Engine certification does not match independent recertification: ${field}.`);
  }
  return true;
}

export function assembleCapabilityObservations({ analysisPath, targetObservationsPath, engineCertificationPath, sourcePath = DEFAULT_ENGINE_SOURCE_PATH } = {}) {
  const analysisArtifact = readJsonArtifact(analysisPath, 'analysis.json');
  validateAnalysis(analysisArtifact.value);
  const targetArtifact = readJsonArtifact(targetObservationsPath, 'Target observations');
  validateTargetObservation(targetArtifact.value, analysisArtifact.value, analysisArtifact.sha256);
  const certification = readJsonArtifact(engineCertificationPath, 'Engine certification').value;
  validateEngineCertification(certification, { sourcePath });
  const target = targetArtifact.value;
  const engineCompatible = target.playerFamily === certification.playerFamily && sameList(target.transportAutohide?.selectors, certification.approvedSelectors);
  const transport = target.transportAutohide ? {
    ...target.transportAutohide,
    ...(target.transportAutohide.enabled === true && engineCompatible ? guaranteesFrom(certification) : {}),
  } : undefined;
  const observations = {
    schemaVersion: 1,
    authority: 'directly-observed-structured-evidence',
    providerId: target.providerId,
    ...(target.targetId ? { targetId: target.targetId } : {}),
    playerFamily: target.playerFamily,
    analysisSha256: target.analysisSha256,
    trustedMatchingEvidence: target.trustedMatchingEvidence ?? {},
    supportedCapabilities: transport?.enabled === true ? ['enabled', 'idleMs', 'selectors', ...(engineCompatible ? ENGINE_GUARANTEES : [])] : [],
    unsupportedRequirements: target.unsupportedRequirements ?? [],
    ...(transport ? { transportAutohide: transport } : {}),
    providerSpecificBehavior: target.providerSpecificBehavior === true,
    conflictingEvidence: target.conflictingEvidence === true,
    sourceEvidenceReferences: target.sourceEvidenceReferences ?? [],
  };
  const provenance = {
    schemaVersion: 1,
    engineId: certification.engineId,
    engineContractVersion: certification.contractVersion,
    engineSourceArtifact: certification.sourceArtifact,
    engineSourceSha256: certification.sourceSha256,
    targetObservedFields: Object.keys(target.transportAutohide ?? {}).map((key) => `transportAutohide.${key}`).sort(),
    engineDerivedFields: transport?.enabled === true && engineCompatible ? ENGINE_GUARANTEES.map((key) => `transportAutohide.${key}`) : [],
  };
  validateCapabilityObservations(observations, analysisArtifact.value, analysisArtifact.sha256);
  assertSafeHelperProposal(observations); assertSafeHelperProposal(provenance);
  return deepFreeze({ observations, provenance });
}

export function certifyHelperEngine({ outputRoot, now = () => new Date(), ...options } = {}) {
  const certification = certifyTransportAutohideEngine({ ...options, generatedAt: now().toISOString() });
  if (certification.certificationStatus !== 'certified') throw new Error('Engine certification failed.');
  return writeStaged({ outputRoot: resolveSafePlayerLabReportsOutputRoot(outputRoot, DEFAULT_ENGINE_CERTIFICATION_OUTPUT_ROOT), now, artifacts: { 'engine-certification.json': certification } });
}

export function assembleHelperObservations({ outputRoot, now = () => new Date(), ...options } = {}) {
  const result = assembleCapabilityObservations(options);
  return writeStaged({ outputRoot: resolveSafePlayerLabReportsOutputRoot(outputRoot, DEFAULT_OBSERVATION_ASSEMBLY_OUTPUT_ROOT), now, artifacts: { 'helper-capability-observations.json': result.observations, 'helper-observation-assembly-provenance.json': result.provenance }, result });
}

function guaranteesFrom(certification) { return Object.fromEntries(certification.supportedGuarantees.map((key) => [key, true])); }
function validateAnalysis(analysis) { if (!plain(analysis) || analysis.schemaVersion !== 1) throw new Error('Analysis artifact schemaVersion must be 1.'); assertProviderId(analysis.providerId); if (analysis.targetId != null) assertProviderId(analysis.targetId); if (!plain(analysis.evidenceSummary) || !PLAYER_FAMILIES.includes(analysis.evidenceSummary.primaryPlayerFamily)) throw new Error('Analysis artifact must contain a canonical primary player family.'); }
function validateTargetObservation(target, analysis, analysisSha256) {
  if (!plain(target) || target.schemaVersion !== 1 || target.authority !== 'directly-observed-structured-evidence') throw new Error('Target observations must be direct structured evidence.');
  const allowed = new Set(['schemaVersion', 'authority', 'providerId', 'targetId', 'playerFamily', 'analysisSha256', 'trustedMatchingEvidence', 'transportAutohide', 'unsupportedRequirements', 'providerSpecificBehavior', 'conflictingEvidence', 'sourceEvidenceReferences']);
  if (Object.keys(target).some((key) => !allowed.has(key))) throw new Error('Target observations contain an unknown capability or field.');
  assertProviderId(target.providerId); if (target.targetId != null) assertProviderId(target.targetId);
  if (target.providerId !== analysis.providerId || target.playerFamily !== analysis.evidenceSummary.primaryPlayerFamily) throw new Error('Target observations do not match analysis identity.');
  if ((target.targetId ?? null) !== (analysis.targetId ?? null)) throw new Error('Target observations do not match analysis target identity.');
  if (target.analysisSha256 !== analysisSha256) throw new Error('Target observations do not match analysis SHA-256.');
  if (target.transportAutohide && (!plain(target.transportAutohide) || Object.keys(target.transportAutohide).some((key) => !['enabled', 'idleMs', 'selectors'].includes(key)))) throw new Error('Target observations may not claim engine-only fields.');
  if (target.transportAutohide?.enabled !== undefined && target.transportAutohide.enabled !== true) throw new Error('Target transport enabled must be true when present.');
  if (target.transportAutohide?.idleMs !== undefined && (!Number.isInteger(target.transportAutohide.idleMs) || target.transportAutohide.idleMs < 500 || target.transportAutohide.idleMs > 10000)) throw new Error('Target transport idleMs is invalid.');
  if (target.transportAutohide?.selectors !== undefined && (!Array.isArray(target.transportAutohide.selectors) || target.transportAutohide.selectors.length === 0 || !target.transportAutohide.selectors.every(safeSelector))) throw new Error('Target transport selectors are invalid.');
  if (target.unsupportedRequirements !== undefined && (!Array.isArray(target.unsupportedRequirements) || !target.unsupportedRequirements.every((item) => ADVANCED_REQUIREMENTS.has(item)))) throw new Error('Target unsupported requirements are invalid.');
  if (target.providerSpecificBehavior !== undefined && typeof target.providerSpecificBehavior !== 'boolean') throw new Error('Target providerSpecificBehavior is invalid.');
  if (target.conflictingEvidence !== undefined && typeof target.conflictingEvidence !== 'boolean') throw new Error('Target conflictingEvidence is invalid.');
}
function extractEngine(text) { const start = text.indexOf('function matchesExactOrSubdomain'); const end = text.indexOf('function islandTvLog'); if (start < 0 || end < start) return ''; return text.slice(start, end); }
function extractFunction(text, name) {
  const start = text.indexOf(`function ${name}(`);
  if (start < 0) return '';
  const bodyStart = text.indexOf('{', start);
  if (bodyStart < 0) return '';
  let depth = 0;
  for (let index = bodyStart; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1;
    if (text[index] === '}' && --depth === 0) return text.slice(bodyStart + 1, index);
  }
  return '';
}
function extractRegistry(text) {
  const start = text.indexOf('const PLAYER_HELPER_REGISTRY = Object.freeze([');
  const end = text.indexOf(']);', start);
  if (start < 0 || end < start) return { complete: false, ids: [] };
  const body = text.slice(start, end + 3);
  return { complete: true, ids: [...body.matchAll(/\bid:\s*"([^"]+)"/g)].map((match) => match[1]) };
}
function extractSelectors(text) { const match = text.match(/selectors: Object\.freeze\(\[([^\]]+)\]\)/); return match ? [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]) : []; }
function inspectDiagnosticPayload(installer) {
  const payload = installer.match(/const payload = \{([\s\S]*?)\n\s*\};/);
  if (!payload) return { type: null, fields: [], originsValid: false };
  const entries = payload[1];
  const literal = new Map([...entries.matchAll(/^\s*([A-Za-z][A-Za-z0-9]*)(?:\s*:\s*([^,\n]+)|\s*),?\s*$/gm)]
    .map((match) => [match[1], (match[2] ?? match[1]).trim()]));
  const assignments = [...installer.matchAll(/\bpayload\.([A-Za-z][A-Za-z0-9]*)\s*=\s*([^;]+);/g)]
    .map((match) => [match[1], match[2].trim()]);
  const dynamic = new Map(assignments);
  const type = literal.get('type')?.replaceAll('"', '') ?? null;
  const fields = [...new Set([...literal.keys(), ...dynamic.keys()].filter((field) => field !== 'type'))];
  const originsValid = literal.get('policyId') === 'policy.id' &&
    literal.get('capability') === '"transport-autohide"' &&
    literal.get('phase') === 'phase' &&
    literal.get('reason') === 'String(reason || "idle")' &&
    !literal.has('delayMs') &&
    assignments.length === 1 && dynamic.get('delayMs') === 'delayMs' &&
    /if \(typeof delayMs === "number"\) payload\.delayMs = delayMs;/.test(installer);
  return { type, fields, originsValid };
}
function count(text, needle) { return text.split(needle).length - 1; }
function sameList(actual, expected) { return Array.isArray(actual) && actual.length === expected.length && [...actual].sort().join('|') === [...expected].sort().join('|'); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function readRegularBytes(path, message) { const stat = safeLstat(path, message); if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(message); return readFileSync(path); }
function readRegularText(path, message) { return readRegularBytes(path, message).toString('utf8'); }
function readJsonArtifact(path, label) { const bytes = readRegularBytes(path, `${label} must be a regular file.`); try { return { value: JSON.parse(bytes.toString('utf8')), sha256: sha256(bytes) }; } catch (error) { throw new Error(`Malformed ${label}: ${error.message}`); } }
function writeStaged({ outputRoot, now, artifacts, result = null }) {
  const root = resolve(outputRoot);
  mkdirSync(root, { recursive: true });
  const rootStat = lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('Staged output root must be a regular directory.');
  const timestamp = filesystemSafeTimestamp(now());
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt ? `-${attempt + 1}` : '';
    const incomplete = resolve(root, `.incomplete-${timestamp}${suffix}`);
    const finalDir = resolve(root, `${timestamp}${suffix}`);
    if (dirname(incomplete) !== root || dirname(finalDir) !== root || existsSync(incomplete) || existsSync(finalDir)) continue;
    try { mkdirSync(incomplete); } catch (error) { if (error.code === 'EEXIST') continue; throw error; }
    let complete = false;
    try {
      const stagingStat = lstatSync(incomplete);
      if (!stagingStat.isDirectory() || stagingStat.isSymbolicLink()) throw new Error('Staged output directory is invalid.');
      for (const [name, value] of Object.entries(artifacts)) writeFileSync(resolve(incomplete, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
      for (const name of Object.keys(artifacts)) {
        const file = resolve(incomplete, name); const stat = lstatSync(file);
        if (dirname(file) !== incomplete || !stat.isFile() || stat.isSymbolicLink()) throw new Error('Invalid assembled artifact.');
      }
      if (existsSync(finalDir)) throw new Error('Completed staged output directory already exists.');
      renameSync(incomplete, finalDir);
      complete = true;
      return deepFreeze({ outputDir: finalDir, ...(result ?? { certification: artifacts['engine-certification.json'] }) });
    } finally {
      if (!complete && dirname(incomplete) === root && basename(incomplete).startsWith('.incomplete-')) rmSync(incomplete, { recursive: true, force: true });
    }
  }
  throw new Error('Unable to allocate unique staged output directory.');
}
function safeSelector(value) { return typeof value === 'string' && value.length > 0 && value.length <= 160 && !/[\u0000-\u001f\u007f]|:\/\/|<|>|\{|\}|;|@import|javascript:/i.test(value); }
function safeLstat(path, message) { try { return lstatSync(resolve(path)); } catch { throw new Error(message); } }
function plain(value) { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function deepFreeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); } return value; }
