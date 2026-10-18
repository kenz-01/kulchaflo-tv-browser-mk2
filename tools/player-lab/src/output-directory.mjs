import { existsSync, lstatSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertProviderId } from './redact-url.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const DEFAULT_OUTPUT_ROOT = resolve(ROOT, 'reports');

export function createStagedProfileOutputDirectory({
  providerId,
  outputRoot = DEFAULT_OUTPUT_ROOT,
  now = () => new Date(),
} = {}) {
  assertProviderId(providerId);
  const root = resolve(outputRoot);
  const providerDir = resolve(root, providerId);
  assertInsideOrEqual(providerDir, root);
  mkdirSync(providerDir, { recursive: true });

  const baseName = filesystemSafeTimestamp(now());
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
    const finalDir = resolve(providerDir, `${baseName}${suffix}`);
    const incompleteDir = resolve(providerDir, `.incomplete-${baseName}${suffix}`);
    assertInsideOrEqual(finalDir, providerDir);
    assertInsideOrEqual(incompleteDir, providerDir);
    if (!existsSync(finalDir) && !existsSync(incompleteDir)) {
      mkdirSync(incompleteDir);
      let promoted = false;
      return Object.freeze({
        providerDir,
        incompleteDir,
        finalDir,
        promote() {
          assertInsideOrEqual(incompleteDir, providerDir);
          assertInsideOrEqual(finalDir, providerDir);
          if (existsSync(finalDir)) {
            throw new Error('Completed report directory already exists.');
          }
          verifyCompletedArtifacts(incompleteDir);
          renameSync(incompleteDir, finalDir);
          promoted = true;
          return finalDir;
        },
        cleanup() {
          if (!promoted) {
            assertSafeIncompleteDir(incompleteDir, providerDir);
            rmSync(incompleteDir, { recursive: true, force: true });
          }
        },
      });
    }
  }
  throw new Error('Unable to allocate unique output directory.');
}

export function filesystemSafeTimestamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid output timestamp.');
  }
  return date.toISOString().replace(/[:.]/g, '-');
}

export function verifyCompletedArtifacts(incompleteDir) {
  for (const artifactName of ['report.json', 'report.md', 'page.png']) {
    const artifactPath = resolve(incompleteDir, artifactName);
    assertDirectChild(artifactPath, incompleteDir);
    let stat;
    try {
      stat = lstatSync(artifactPath);
    } catch {
      throw new Error(`Missing required profile artifact: ${artifactName}`);
    }
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`Invalid required profile artifact: ${artifactName}`);
    }
  }
}

function assertSafeIncompleteDir(child, parent) {
  assertInsideOrEqual(child, parent);
  if (!basename(child).startsWith('.incomplete-') || dirname(child) !== parent) {
    throw new Error('Refusing to remove non-staging output directory.');
  }
}

function assertInsideOrEqual(child, parent) {
  if (!isInsideOrEqual(child, parent)) {
    throw new Error('Output directory traversal rejected.');
  }
}

function assertDirectChild(child, parent) {
  if (dirname(child) !== parent || !isInsideOrEqual(child, parent)) {
    throw new Error('Output artifact path traversal rejected.');
  }
}

function isInsideOrEqual(child, parent) {
  const relative = child.slice(parent.length);
  return child === parent || (relative.startsWith('/') && !relative.includes('..'));
}
