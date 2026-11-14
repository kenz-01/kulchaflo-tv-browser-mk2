import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const contentPath = resolve(process.cwd(), '../../app-gv/src/main/assets/gv_media_observer/content.js');
const activityPath = resolve(process.cwd(), '../../app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt');

test('ZIZ helper parses and stays scoped to Channel 5 live page', () => {
  const source = readFileSync(contentPath, 'utf8');
  assert.doesNotThrow(() => new Function(source));
  for (const marker of [
    'function isZizTvLivePage()',
    'function scheduleZizTvHelper()',
    'function attemptZizTvPlaybackAndPresentation(attemptAtMs)',
    '#tvVideo',
    '#tvUnmute',
    '#tvFs',
    'content-ziz-player-first',
    'content-ziz-playback-check'
  ]) {
    assert.ok(source.includes(marker), `missing ZIZ marker: ${marker}`);
  }
  const start = source.indexOf('function isZizTvLivePage()');
  const end = source.indexOf('function readNovusIntent()', start);
  assert.ok(start >= 0 && end > start);
  const helper = source.slice(start, end);
  assert.ok(helper.includes('zizonline.com'));
  assert.ok(helper.includes('/tv/channel-5'));
  assert.equal(helper.includes('EXTRACTED_STREAM'), false);
  assert.equal(helper.includes('PROMOTE_DIRECT_CANDIDATE'), false);
  assert.equal(helper.includes('Media3'), false);
});

test('ZIZ autoplay permission stays limited to official Channel 5 route', () => {
  const source = readFileSync(activityPath, 'utf8');
  for (const marker of [
    'ENABLE_ZIZ_TV_AUTOPLAY_PERMISSION_ALLOW = true',
    'isZizTvAutoplayContextUrl',
    'host == "zizonline.com"',
    'path == "/tv/channel-5"',
    'zizAutoplayScoped -> GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW'
  ]) {
    assert.ok(source.includes(marker), `missing ZIZ autoplay marker: ${marker}`);
  }
});
