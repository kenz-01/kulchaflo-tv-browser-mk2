import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sourcePath = resolve(process.cwd(), '../../app-gv/src/main/assets/gv_media_observer/content.js');

test('Radiant TV helper source parses and stays narrowly scoped', () => {
  const source = readFileSync(sourcePath, 'utf8');
  assert.doesNotThrow(() => new Function(source));

  for (const marker of [
    'function radiantTvRouteKind()',
    '/players/5tv/',
    '/players/15tv/',
    '/players/13bot/',
    'function scheduleRadiantTvHelper()',
    'function attemptRadiantTvPlayback(attemptAtMs)',
    'content-radiant-player-first',
    'content-radiant-playback-check'
  ]) {
    assert.ok(source.includes(marker), `missing Radiant marker: ${marker}`);
  }

  assert.ok(source.includes('video.muted = false'));
  assert.ok(source.includes('video.volume = 1'));
  assert.ok(source.includes('radiantTvFullscreenAttempted'));
  assert.ok(source.includes('.rmp-overlay-button'));

  // The first Radiant helper remains browser-first. No direct/native media
  // promotion is introduced by this family-specific implementation.
  const start = source.indexOf('function radiantTvRouteKind()');
  const end = source.indexOf('function readNovusIntent()', start);
  assert.ok(start >= 0 && end > start);
  const helper = source.slice(start, end);
  assert.equal(helper.includes('EXTRACTED_STREAM'), false);
  assert.equal(helper.includes('PROMOTE_DIRECT_CANDIDATE'), false);
  assert.equal(helper.includes('Media3'), false);
});
