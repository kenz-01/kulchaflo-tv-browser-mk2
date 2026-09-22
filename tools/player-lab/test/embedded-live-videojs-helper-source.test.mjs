import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const contentPath = resolve(process.cwd(), '../../app-gv/src/main/assets/gv_media_observer/content.js');
const activityPath = resolve(process.cwd(), '../../app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt');

test('Bizz and RHT embedded live Video.js helpers stay browser-first and scoped', () => {
  const content = readFileSync(contentPath, 'utf8');
  const activity = readFileSync(activityPath, 'utf8');
  assert.doesNotThrow(() => new Function(content));

  for (const marker of [
    'function embeddedLiveVideoJsTopKind()',
    'function embeddedLiveVideoJsFrameKind()',
    'biztv.com',
    'c.streamhoster.com',
    'rhtguadeloupe.fr',
    'player.infomaniak.com',
    'content-embedded-live-videojs-player-first',
    'content-embedded-live-videojs-playback-check'
  ]) assert.ok(content.includes(marker), `missing helper marker: ${marker}`);

  for (const marker of [
    'ENABLE_EMBEDDED_LIVE_VIDEOJS_AUTOPLAY_PERMISSION_ALLOW = true',
    'isEmbeddedLiveVideoJsAutoplayContextUrl',
    'embeddedLiveVideoJsAutoplayScoped -> GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW'
  ]) assert.ok(activity.includes(marker), `missing autoplay marker: ${marker}`);

  const start = content.indexOf('function embeddedLiveVideoJsTopKind()');
  const end = content.indexOf('function isSvgTvTopPage()', start);
  assert.ok(start >= 0 && end > start);
  const helper = content.slice(start, end);
  assert.equal(helper.includes('EXTRACTED_STREAM'), false);
  assert.equal(helper.includes('PROMOTE_DIRECT_CANDIDATE'), false);
  assert.equal(helper.includes('Media3'), false);
});
