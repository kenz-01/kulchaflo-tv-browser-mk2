import { existsSync, lstatSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { filesystemSafeTimestamp } from './output-directory.mjs';

export function createStagedAnalysisOutputDirectory({
  outputRoot,
  now = () => new Date(),
} = {}) {
  if (typeof outputRoot !== 'string' || outputRoot.trim() === '') {
    throw new Error('Analysis output root is required.');
  }
  const root = resolve(outputRoot);
  mkdirSync(root, { recursive: true });
  const baseName = filesystemSafeTimestamp(now());
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
    const finalDir = resolve(root, `${baseName}${suffix}`);
    const incompleteDir = resolve(root, `.incomplete-${baseName}${suffix}`);
    assertInsideOrEqual(finalDir, root);
    assertInsideOrEqual(incompleteDir, root);
    if (!existsSync(finalDir) && !existsSync(incompleteDir)) {
      mkdirSync(incompleteDir);
      let promoted = false;
      return Object.freeze({
        incompleteDir,
        finalDir,
        promote() {
          verifyAnalysisArtifacts(incompleteDir);
          if (existsSync(finalDir)) {
            throw new Error('Completed analysis directory already exists.');
          }
          renameSync(incompleteDir, finalDir);
          promoted = true;
          return finalDir;
        },
        cleanup() {
          if (!promoted) {
            assertSafeIncompleteDir(incompleteDir, root);
            rmSync(incompleteDir, { recursive: true, force: true });
          }
        },
      });
    }
  }
  throw new Error('Unable to allocate unique analysis output directory.');
}

export function writeAnalysisJson(recommendation, { outputDir } = {}) {
  const filePath = join(outputDir, 'analysis.json');
  writeFileSync(filePath, `${JSON.stringify(recommendation, null, 2)}\n`, 'utf8');
  return { filePath };
}

export function writeAnalysisMarkdown(recommendation, { outputDir } = {}) {
  const lines = [
    '# Player Lab Analysis',
    '',
    `- Provider: ${safe(recommendation.providerId)}`,
    `- Source profiler version: ${safe(recommendation.sourceProfilerVersion)}`,
    `- Category: ${safe(recommendation.recommendation.category)}`,
    `- Recommended layer: ${safe(recommendation.recommendation.recommendedLayer)}`,
    `- Confidence: ${safe(recommendation.recommendation.confidence)} (${recommendation.recommendation.score})`,
    '',
    '## Evidence Summary',
    `- Primary player: ${safe(recommendation.evidenceSummary.primaryPlayerFamily)}`,
    `- Route: ${safe(recommendation.evidenceSummary.routeFamily)} ${safe(recommendation.evidenceSummary.routeStrategy)}`,
    `- Frames: ${recommendation.evidenceSummary.frameCount}`,
    `- Accessible frames: ${recommendation.evidenceSummary.accessibleFrameCount}`,
    `- Iframe hosts: ${safeList(recommendation.evidenceSummary.iframeHosts)}`,
    `- Script hosts: ${safeList(recommendation.evidenceSummary.scriptHosts)}`,
    `- Network evidence kinds: ${safeList(recommendation.evidenceSummary.networkEvidenceKinds)}`,
    `- Media elements: ${recommendation.evidenceSummary.mediaElementCount}`,
    `- Candidate controls: ${recommendation.evidenceSummary.candidateControlCount}`,
    '',
    '## Reason Codes',
    ...recommendation.recommendation.reasons.map((reason) => `- ${safe(reason.code)}: ${safe(reason.detail)}`),
    '',
    '## Avoided Approaches',
    ...recommendation.recommendation.avoidLayers.map((item) => `- ${safe(item)}`),
    '',
    '## Required Next Validation',
    ...recommendation.recommendation.requiredNextValidation.map((item) => `- ${safe(item)}`),
    '',
    '## Limitations',
    ...recommendation.recommendation.limitations.map((item) => `- ${safe(item)}`),
    '',
  ];
  const filePath = join(outputDir, 'analysis.md');
  writeFileSync(filePath, `${lines.join('\n')}`, 'utf8');
  return { filePath };
}

export function verifyAnalysisArtifacts(incompleteDir) {
  for (const artifactName of ['analysis.json', 'analysis.md']) {
    const artifactPath = resolve(incompleteDir, artifactName);
    assertDirectChild(artifactPath, incompleteDir);
    let stat;
    try {
      stat = lstatSync(artifactPath);
    } catch {
      throw new Error(`Missing required analysis artifact: ${artifactName}`);
    }
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`Invalid required analysis artifact: ${artifactName}`);
    }
  }
}

function safeList(values) {
  return values.length > 0 ? values.map(safe).join(', ') : 'none';
}

function safe(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
}

function assertSafeIncompleteDir(child, parent) {
  assertInsideOrEqual(child, parent);
  if (!basename(child).startsWith('.incomplete-') || dirname(child) !== parent) {
    throw new Error('Refusing to remove non-staging analysis directory.');
  }
}

function assertDirectChild(child, parent) {
  if (dirname(child) !== parent || !isInsideOrEqual(child, parent)) {
    throw new Error('Analysis artifact path traversal rejected.');
  }
}

function assertInsideOrEqual(child, parent) {
  if (!isInsideOrEqual(child, parent)) {
    throw new Error('Analysis output traversal rejected.');
  }
}

function isInsideOrEqual(child, parent) {
  const relative = child.slice(parent.length);
  return child === parent || (relative.startsWith('/') && !relative.includes('..'));
}
