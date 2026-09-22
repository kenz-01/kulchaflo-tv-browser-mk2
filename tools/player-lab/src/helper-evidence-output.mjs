import { existsSync, lstatSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { filesystemSafeTimestamp } from './output-directory.mjs';

export function createStagedHelperEvidenceOutputDirectory({ outputRoot, now = () => new Date() } = {}) {
  const root = resolve(outputRoot);
  mkdirSync(root, { recursive: true });
  const timestamp = filesystemSafeTimestamp(now());
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt ? `-${attempt + 1}` : '';
    const finalDir = resolve(root, `${timestamp}${suffix}`);
    const incompleteDir = resolve(root, `.incomplete-${timestamp}${suffix}`);
    if (dirname(finalDir) !== root || dirname(incompleteDir) !== root || existsSync(finalDir) || existsSync(incompleteDir)) continue;
    mkdirSync(incompleteDir);
    let promoted = false;
    return Object.freeze({
      incompleteDir,
      finalDir,
      promote() {
        verifyHelperEvidenceArtifacts(incompleteDir);
        if (existsSync(finalDir)) throw new Error('Completed helper evidence directory already exists.');
        renameSync(incompleteDir, finalDir);
        promoted = true;
        return finalDir;
      },
      cleanup() {
        if (!promoted && dirname(incompleteDir) === root && basename(incompleteDir).startsWith('.incomplete-')) {
          rmSync(incompleteDir, { recursive: true, force: true });
        }
      },
    });
  }
  throw new Error('Unable to allocate unique helper evidence output directory.');
}

export function writeHelperEvidenceArtifacts(evidence, provenance, { outputDir } = {}) {
  writeFileSync(join(outputDir, 'helper-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  writeFileSync(join(outputDir, 'helper-evidence-provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`, 'utf8');
}

export function verifyHelperEvidenceArtifacts(outputDir) {
  for (const name of ['helper-evidence.json', 'helper-evidence-provenance.json']) {
    const filePath = resolve(outputDir, name);
    if (dirname(filePath) !== outputDir) throw new Error('Helper evidence artifact traversal rejected.');
    let stat;
    try { stat = lstatSync(filePath); } catch { throw new Error(`Missing required helper evidence artifact: ${name}`); }
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Invalid helper evidence artifact: ${name}`);
  }
}
