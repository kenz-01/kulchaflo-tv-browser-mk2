import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const contentPath = resolve(process.cwd(), '../../app-gv/src/main/assets/gv_media_observer/content.js');
const activityPath = resolve(process.cwd(), '../../app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt');

test('Identite pro-fhi helper isolates the 1080-capable live widget and stays browser-first', () => {
  const content = readFileSync(contentPath, 'utf8');
  const activity = readFileSync(activityPath, 'utf8');
  assert.doesNotThrow(() => new Function(content));

  for (const marker of [
    'function isIdentiteTvTopPage()',
    'function isIdentiteProFhiFrame()',
    '/hybrid-stream-video-widget/',
    'content-pro-fhi-player-first',
    'content-pro-fhi-playback-check',
    'identiteradio.com',
    'vdo2.pro-fhi.net'
  ]) assert.ok(content.includes(marker), `missing pro-fhi marker: ${marker}`);

  for (const marker of [
    'ENABLE_IDENTITE_PRO_FHI_AUTOPLAY_PERMISSION_ALLOW = true',
    'isIdentiteProFhiAutoplayContextUrl',
    'identiteAutoplayScoped -> GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW'
  ]) assert.ok(activity.includes(marker), `missing pro-fhi autoplay marker: ${marker}`);

  const start = content.indexOf('function isIdentiteTvTopPage()');
  const end = content.indexOf('function embeddedLiveVideoJsTopKind()', start);
  assert.ok(start >= 0 && end > start);
  const helper = content.slice(start, end);
  assert.equal(helper.includes('EXTRACTED_STREAM'), false);
  assert.equal(helper.includes('PROMOTE_DIRECT_CANDIDATE'), false);
  assert.equal(helper.includes('Media3'), false);
});
