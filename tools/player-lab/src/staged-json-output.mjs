import { existsSync, lstatSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { filesystemSafeTimestamp } from './output-directory.mjs';

const SAFE_ARTIFACT_NAME = /^[a-z0-9][a-z0-9.-]*\.json$/;

export function writeStagedJsonOutput({ outputRoot, now = () => new Date(), artifacts, result = {} } = {}) {
  const root = resolve(outputRoot);
  mkdirSync(root, { recursive: true });
  const rootStat = lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('Staged output root must be a real regular directory.');
  if (!plain(artifacts) || !Object.keys(artifacts).length || Object.keys(artifacts).some((name) => !SAFE_ARTIFACT_NAME.test(name))) throw new Error('Staged JSON artifact names are invalid.');
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
      for (const [name, value] of Object.entries(artifacts)) {
        const file = resolve(incomplete, name);
        if (dirname(file) !== incomplete) throw new Error('Staged artifact escaped its allocated directory.');
        writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
        const stat = lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Staged artifact must be a regular non-symlink file.');
      }
      if (existsSync(finalDir)) throw new Error('Completed staged output directory already exists.');
      renameSync(incomplete, finalDir);
      complete = true;
      return deepFreeze({ outputDir: finalDir, ...result });
    } finally {
      if (!complete && dirname(incomplete) === root && basename(incomplete).startsWith('.incomplete-')) rmSync(incomplete, { recursive: true, force: true });
    }
  }
  throw new Error('Unable to allocate unique staged output directory.');
}

function plain(value) { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function deepFreeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); } return value; }
