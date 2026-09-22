import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const contentPath = resolve(process.cwd(), '../../app-gv/src/main/assets/gv_media_observer/content.js');
const activityPath = resolve(process.cwd(), '../../app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt');

test('SVG-TV Cloudflare helper is player-first and autoplay scoped', () => {
  const content = readFileSync(contentPath, 'utf8');
  const activity = readFileSync(activityPath, 'utf8');
  assert.doesNotThrow(() => new Function(content));

  for (const marker of [
    'function isSvgTvTopPage()',
    'function findSvgTvCloudflareFrame()',
    'function ensureSvgTvCloudflareAutoplay(frame)',
    'function applySvgTvCloudflarePlayerFirst()',
    'content-svg-cloudflare-player-first',
    'cloudflarestream.com',
    'autoplay',
    '100vw',
    '100vh'
  ]) {
    assert.ok(content.includes(marker), `missing SVG helper marker: ${marker}`);
  }

  for (const marker of [
    'ENABLE_SVG_CLOUDFLARE_AUTOPLAY_PERMISSION_ALLOW = true',
    'isSvgTvAutoplayContextUrl',
    'isSvgTvCloudflareHost',
    'watchsvgtv.com',
    'svgAutoplayScoped -> GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW'
  ]) {
    assert.ok(activity.includes(marker), `missing SVG autoplay marker: ${marker}`);
  }

  const start = content.indexOf('function isSvgTvTopPage()');
  const end = content.indexOf('function radiantTvRouteKind()', start);
  assert.ok(start >= 0 && end > start);
  const helper = content.slice(start, end);
  assert.equal(helper.includes('EXTRACTED_STREAM'), false);
  assert.equal(helper.includes('PROMOTE_DIRECT_CANDIDATE'), false);
  assert.equal(helper.includes('Media3'), false);
});
