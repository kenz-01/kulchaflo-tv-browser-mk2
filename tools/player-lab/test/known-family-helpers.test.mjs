import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const root = resolve(process.cwd(), '../../app-gv/src/main/assets/gv_media_observer');
const script = readFileSync(resolve(root, 'known-family-helpers.js'), 'utf8');
const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
const scope = { URL };
runInNewContext(script, scope);
const { routes, resolveRoute, trustedFrameUrl } = scope.KfKnownFamilyHelpers;

test('19 exact official routes reuse 7 existing player families', () => {
  assert.equal(routes.length, 19);
  assert.equal(new Set(routes.map((route) => route.id)).size, 19);
  const byFamily = Object.fromEntries(
    [...new Set(routes.map((route) => route.family))].map((family) =>
      [family, routes.filter((route) => route.family === family).length]));
  assert.deepEqual(byFamily, {
    youtube: 5, videojs: 5, jwplayer: 2, dailymotion: 2,
    vimeo: 1, hlsjs: 3, html5: 1
  });
  for (const route of routes) {
    const url = 'https://' + route.host + route.path;
    assert.equal(resolveRoute(url)?.id, route.id);
    assert.equal(resolveRoute(url + (route.path === '/' ? '' : '/') + '?utm_source=KulchaFlo')?.id, route.id);
    assert.equal(resolveRoute('http://' + route.host + route.path), null);
    assert.equal(resolveRoute('https://evil.' + route.host + route.path), null);
    assert.equal(resolveRoute('https://' + route.host + route.path + '/some-other-programme'), null);
  }
});

test('official routes agree with registered public targets', () => {
  const registry = JSON.parse(readFileSync(resolve(process.cwd(), 'config/public-targets.json'), 'utf8'));
  for (const route of routes) {
    const target = Object.values(registry.targets).find((value) => value.providerId === route.id ||
      (route.id === 'antena-7' && value.providerId === 'antena-7-do') ||
      (route.id === 'energia-tv' && value.providerId === 'energia-bonaire-tv') ||
      (route.id === 'tele-peyi' && value.providerId === 'tele-peyi-guyane') ||
      (route.id === 'tv-direct-13' && value.providerId === 'tv-direct-13-curacao') ||
      (route.id === 'pointe-tv' && value.providerId === 'pointe-tv-antigua') ||
      (route.id === 'yunavision' && value.providerId === 'yunavision') ||
      (route.id === 'ahora-tv' && value.providerId === 'ahora-tv-do') ||
      (route.id === 'xfm-aruba' && value.providerId === 'xfm-aruba') ||
      (route.id === 'teleuniverso-29' && value.providerId === 'teleuniverso-29'));
    assert.ok(target, 'missing official public target: ' + route.id);
    assert.equal(resolveRoute(target.initialUrl)?.id, route.id,
      'route should match the official registered URL for ' + route.id);
  }
});

test('platform frames must be real HTTPS players, never arbitrary iframes or media', () => {
  assert.equal(trustedFrameUrl('youtube', 'https://www.youtube.com/embed/abc', 'https://ahoratv.com/'), true);
  assert.equal(trustedFrameUrl('youtube', 'https://evil.youtube.com/embed/abc'), false);
  assert.equal(trustedFrameUrl('youtube', 'https://youtube.com/shorts/abc'), false);
  assert.equal(trustedFrameUrl('vimeo', 'https://player.vimeo.com/video/123'), true);
  assert.equal(trustedFrameUrl('vimeo', 'https://vimeo.com/event/123/embed'), true);
  assert.equal(trustedFrameUrl('dailymotion', 'https://geo.dailymotion.com/player/x.html?video=abc'), true);
  assert.equal(trustedFrameUrl('dailymotion', 'https://ads.example/video/abc'), false);
  assert.equal(trustedFrameUrl('dailymotion', 'http://geo.dailymotion.com/player/abc'), false);
  assert.equal(trustedFrameUrl('videojs', 'https://geo.dailymotion.com/player/abc'), false);
});

test('helper is isolated and does not enable broad autoplay or native promotion', () => {
  assert.ok(manifest.content_scripts[0].js.includes('known-family-helpers.js'));
  assert.doesNotThrow(() => new Function(script));
  assert.ok(script.includes('window.top !== window'));
  assert.ok(script.includes('matches.length === 1'));
  assert.ok(script.includes('video.readyState < 2'));
  assert.ok(script.includes('startedVideos.has(video)'));
  assert.ok(script.includes('No iframe source rewrite'));
  for (const banned of ['EXTRACTED_STREAM', 'PROMOTE_DIRECT_CANDIDATE', 'Media3', 'window.location.replace', 'dispatchEvent(new MouseEvent']) {
    if (banned === 'Media3') {
      assert.ok(script.includes('Never promotes media to Media3.'));
    } else if (banned === 'EXTRACTED_STREAM') {
      assert.equal(script.includes('EXTRACTED_STREAM'), false);
    } else {
      assert.equal(script.includes(banned), false);
    }
  }
});
