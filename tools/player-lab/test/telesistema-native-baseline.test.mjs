import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const assets = resolve(process.cwd(), '../../app-gv/src/main/assets/gv_media_observer');
const manifest = JSON.parse(readFileSync(resolve(assets, 'manifest.json'), 'utf8'));
const contentScript = readFileSync(resolve(assets, 'content.js'), 'utf8');
const activity = readFileSync(resolve(process.cwd(), '../../app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt'), 'utf8');
const targets = JSON.parse(readFileSync(resolve(process.cwd(), 'config/public-targets.json'), 'utf8'));

test('Telesistema viewport experiment is isolated to its official top-level live route', () => {
  assert.equal(manifest.content_scripts.length, 2);
  assert.deepEqual(manifest.content_scripts[0], {
    matches: [
      'https://telesistema11.com.do/en-vivo*',
      'https://www.telesistema11.com.do/en-vivo*',
    ],
    js: ['telesistema-viewport-alignment.js'],
    run_at: 'document_idle',
    all_frames: false,
  });
  assert.deepEqual(manifest.content_scripts[1], {
    matches: ['<all_urls>'],
    js: ['candidate-ranking.js', 'content.js', 'zns-streamcomedia-helper.js'],
    run_at: 'document_idle',
    all_frames: true,
  });
  assert.equal(existsSync(resolve(assets, 'telesistema-lazy-frame-helper.js')), false);
  assert.equal(existsSync(resolve(assets, 'telesistema-first-interaction-diagnostic.js')), false);
  assert.doesNotMatch(activity, /TelesistemaDiagnostic|telesistema-interaction-diagnostic/);
  assert.doesNotMatch(contentScript, /telesistema11\.com\.do|KfTelesistema|telesistema-lazy-frame-helper/);
  assert.doesNotMatch(activity, /"telesistema viewport alignment[^\n]*pageUrl=/);
});

test('viewport evidence is accepted only on the active official route and logs two booleans', () => {
  assert.match(activity, /if \(type == "telesistema-viewport-alignment"\) \{[\s\S]*?isTelesistemaLivePageUrl\(activeUrl\)[\s\S]*?opt\("visibleBefore"\) as\? Boolean[\s\S]*?opt\("scrollChanged"\) as\? Boolean[\s\S]*?telesistema viewport alignment visibleBefore=\$visibleBefore scrollChanged=\$scrollChanged/);
});

test('official route, scoped autoplay permission, and GeckoView media protection remain', () => {
  assert.equal(targets.targets['telesistema-11'].initialUrl, 'https://telesistema11.com.do/en-vivo/');
  assert.match(activity, /private fun isTelesistemaLivePageUrl\(url: String\): Boolean[\s\S]*?host != "telesistema11\.com\.do"[\s\S]*?path == "\/en-vivo"/);
  assert.match(activity, /private const val ENABLE_TELESISTEMA_DAILYMOTION_AUTOPLAY_PERMISSION_ALLOW = true/);
  assert.match(activity, /val telesistemaTopContext = isTelesistemaLivePageUrl\(activeSessionUrl\) \|\| isTelesistemaLivePageUrl\(currentRootUrl\)/);
  assert.match(activity, /val telesistemaAutoplayScoped = ENABLE_TELESISTEMA_DAILYMOTION_AUTOPLAY_PERMISSION_ALLOW &&\s*autoplayPermissionRequest && telesistemaTopContext && telesistemaDailymotionContext/);
  assert.match(activity, /telesistemaAutoplayScoped -> GeckoSession\.PermissionDelegate\.ContentPermission\.VALUE_ALLOW/);
  assert.match(activity, /private fun shouldPromoteDirectMedia\(url: String\): Boolean[\s\S]*?!isTelesistemaLivePageUrl\(url\)/);
});

test('generic Dailymotion layout helpers remain bound to other identified providers', () => {
  assert.match(contentScript, /host !== "gbn\.gd"[\s\S]*?path === "\/live-television"/);
  assert.match(contentScript, /x85vz1r/);
  assert.match(contentScript, /path === "\/video\/x7gy059"/);
  assert.match(contentScript, /referrer\.indexOf\("colorvision\.com\.do\/en-vivo"\)/);
  assert.match(contentScript, /host !== "cnc3\.co\.tt"[\s\S]*?path === "\/live-stream"/);
  assert.match(contentScript, /x9vba4u/);
});

test('Telesistema keeps normal remote input without the compatibility wake pulse', () => {
  const pulse = activity.match(/private fun dispatchInteractionWakePulse\(\) \{([\s\S]*?)\n    \}/)?.[1];
  assert.ok(pulse);
  const routeGuard = pulse.indexOf('isTelesistemaLivePageUrl(activeTab.url)');
  const javascriptPoke = pulse.indexOf('session.loadUri("javascript:');
  assert.notEqual(routeGuard, -1);
  assert.notEqual(javascriptPoke, -1);
  assert.ok(routeGuard < javascriptPoke);
  assert.match(pulse, /interaction wake pulse skipped surface=telesistema reason=publisher-owned-player/);
});
