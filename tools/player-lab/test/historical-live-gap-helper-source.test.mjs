import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const contentPath = resolve(process.cwd(), '../../app-gv/src/main/assets/gv_media_observer/content.js');
const activityPath = resolve(process.cwd(), '../../app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt');

test('historical live gap wrappers stay exact-route and browser-first', () => {
  const content = readFileSync(contentPath, 'utf8');
  const activity = readFileSync(activityPath, 'utf8');
  assert.doesNotThrow(() => new Function(content));

  for (const marker of [
    'function historicalLiveGapKind()',
    'wapa.tv',
    'wipr.pr',
    'zizonline.com',
    'tv6tnt.com',
    '/player/x8dgt.html',
    '.fp-playbutton',
    '.vjs-big-play-button',
    '#tvUnmute',
    'content-historical-live-gap-player-first'
  ]) assert.ok(content.includes(marker), `missing historical wrapper marker: ${marker}`);

  for (const marker of [
    'ENABLE_HISTORICAL_LIVE_GAP_AUTOPLAY_PERMISSION_ALLOW = true',
    'isHistoricalLiveGapAutoplayContextUrl',
    'isTv6DailymotionPlayerUrl',
    'historicalGapAutoplayScoped -> GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW'
  ]) assert.ok(activity.includes(marker), `missing historical autoplay marker: ${marker}`);

  const start = content.indexOf('function historicalLiveGapKind()');
  const end = content.indexOf('function isIdentiteTvTopPage()', start);
  assert.ok(start >= 0 && end > start);
  const helper = content.slice(start, end);
  assert.equal(helper.includes('EXTRACTED_STREAM'), false);
  assert.equal(helper.includes('PROMOTE_DIRECT_CANDIDATE'), false);
  assert.equal(helper.includes('Media3'), false);
});
