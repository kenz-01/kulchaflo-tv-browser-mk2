import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPlayerSignatures, validatePlayerSignatures } from '../src/load-player-signatures.mjs';
import { PLAYER_FAMILIES } from '../src/player-families.mjs';

test('loads and validates player-signatures.json', () => {
  const config = loadPlayerSignatures();
  assert.deepEqual(
    Object.keys(config.families).sort(),
    PLAYER_FAMILIES.filter((family) => family !== 'unknown').sort(),
  );
});

test('rejects missing required family', () => {
  const config = cloneConfig();
  delete config.families.youtube;
  assert.throws(() => validatePlayerSignatures(config), /missing required families: youtube/);
});

test('rejects unknown family', () => {
  const config = cloneConfig();
  config.families.fakeplayer = cloneConfig().families.youtube;
  assert.throws(() => validatePlayerSignatures(config), /unknown families: fakeplayer/);
});

test('rejects malformed pattern arrays', () => {
  const config = cloneConfig();
  config.families.vimeo.hostPatterns = 'player.vimeo.com';
  assert.throws(() => validatePlayerSignatures(config), /vimeo\.hostPatterns must be an array/);
});

test('rejects empty pattern values', () => {
  const config = cloneConfig();
  config.families.vimeo.scriptPatterns = [''];
  assert.throws(() => validatePlayerSignatures(config), /empty or non-string pattern/);
});

test('rejects unsafe catch-all path patterns', () => {
  const config = cloneConfig();
  config.families.novus.pathPatterns = ['/'];
  assert.throws(() => validatePlayerSignatures(config), /unsafe catch-all path/);
});

function cloneConfig() {
  return JSON.parse(JSON.stringify(loadPlayerSignatures()));
}
