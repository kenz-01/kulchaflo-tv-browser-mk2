import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const contentPath = resolve(process.cwd(), '../../app-gv/src/main/assets/gv_media_observer/content.js');
const activityPath = resolve(process.cwd(), '../../app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt');

test('hosted Video.js helper parses and is narrowly scoped', () => {
  const source = readFileSync(contentPath, 'utf8');
  assert.doesNotThrow(() => new Function(source));

  for (const marker of [
    'function hostedVideoJsContextKind()',
    'biztv.com',
    'c.streamhoster.com',
    '/embed/media/',
    'rhtguadeloupe.fr',
    'player.infomaniak.com',
    'function scheduleHostedVideoJsHelper()',
    '.vjs-big-play-button',
    '.vjs-mute-control',
    '.vjs-fullscreen-control',
    'content-hosted-videojs-player-first',
    'content-hosted-videojs-playback-check'
  ]) {
    assert.ok(source.includes(marker), `missing hosted Video.js marker: ${marker}`);
  }

  const start = source.indexOf('function hostedVideoJsContextKind()');
  const end = source.indexOf('function readNovusIntent()', start);
  assert.ok(start >= 0 && end > start);
  const helper = source.slice(start, end);
  assert.equal(helper.includes('EXTRACTED_STREAM'), false);
  assert.equal(helper.includes('PROMOTE_DIRECT_CANDIDATE'), false);
  assert.equal(helper.includes('Media3'), false);
});

test('hosted Video.js autoplay permission stays bounded to Bizz and RHT', () => {
  const source = readFileSync(activityPath, 'utf8');
  for (const marker of [
    'ENABLE_HOSTED_VIDEOJS_AUTOPLAY_PERMISSION_ALLOW = true',
    'isBizzTvLiveUrl',
    'isBizzTvPlayerUrl',
    'isRhtTvLiveUrl',
    'isRhtTvPlayerUrl',
    'host == "biztv.com"',
    'host == "c.streamhoster.com"',
    'host == "rhtguadeloupe.fr"',
    'host == "player.infomaniak.com"',
    'bizzVideoJsAutoplayScoped -> GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW',
    'rhtVideoJsAutoplayScoped -> GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW'
  ]) {
    assert.ok(source.includes(marker), `missing hosted Video.js autoplay marker: ${marker}`);
  }
});
