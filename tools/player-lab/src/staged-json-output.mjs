import { existsSync, lstatSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { filesystemSafeTimestamp } from './output-directory.mjs';

const SAFE_ARTIFACT_NAME = /^[a-z0-9][a-z0-9.-]*\.json$/;
const PREPARED_TEXT_ARTIFACT_NAME = 'prepared-content.js';

export function writeStagedJsonOutput({ outputRoot, now = () => new Date(), artifacts, result = {} } = {}) {
  if (!plain(artifacts) || !Object.keys(artifacts).length || Object.keys(artifacts).some((name) => !SAFE_ARTIFACT_NAME.test(name))) throw new Error('Staged JSON artifact names are invalid.');
  return writeStagedArtifactOutput({
    outputRoot,
    now,
    artifacts: Object.fromEntries(Object.entries(artifacts).map(([name, value]) => [name, { type: 'json', value }])),
    result,
  });
}

export function writeStagedArtifactOutput({ outputRoot, now = () => new Date(), artifacts, result = {} } = {}) {
  const prepared = prepareArtifacts(artifacts);
  const root = resolve(outputRoot);
  mkdirSync(root, { recursive: true });
  const rootStat = lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('Staged output root must be a real regular directory.');
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
      for (const [name, bytes] of prepared) {
        const file = resolve(incomplete, name);
        if (dirname(file) !== incomplete) throw new Error('Staged artifact escaped its allocated directory.');
        writeFileSync(file, bytes, { flag: 'wx' });
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

function prepareArtifacts(artifacts) {
  if (!plain(artifacts) || !Object.keys(artifacts).length) throw new Error('Staged artifacts must be a non-empty object.');
  const prepared = [];
  for (const [name, descriptor] of Object.entries(artifacts)) {
    if (!plain(descriptor) || !sameKeys(descriptor, ['type', 'value'])) throw new Error('Staged artifact descriptor is invalid.');
    if (descriptor.type === 'json') {
      if (!SAFE_ARTIFACT_NAME.test(name)) throw new Error('Staged JSON artifact name is invalid.');
      prepared.push([name, Buffer.from(`${JSON.stringify(descriptor.value, null, 2)}\n`, 'utf8')]);
      continue;
    }
    if (descriptor.type === 'utf8-text') {
      if (name !== PREPARED_TEXT_ARTIFACT_NAME || typeof descriptor.value !== 'string' || Buffer.from(descriptor.value, 'utf8').toString('utf8') !== descriptor.value) throw new Error('Staged UTF-8 text artifact is invalid.');
      prepared.push([name, Buffer.from(descriptor.value, 'utf8')]);
      continue;
    }
    throw new Error('Staged artifact type is unsupported.');
  }
  return prepared;
}

function sameKeys(value, keys) { return Object.keys(value).sort().join('|') === [...keys].sort().join('|'); }
function plain(value) { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function deepFreeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); } return value; }
