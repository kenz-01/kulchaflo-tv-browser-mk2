import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPlayer, PLAYER_FAMILIES } from '../src/classify-player.mjs';
import { loadPlayerSignatures } from '../src/load-player-signatures.mjs';

const cases = [
  ['youtube', { iframeUrls: ['https://www.youtube.com/embed/abc'], scriptUrls: ['https://www.youtube.com/s/player/base.js'] }],
  ['vimeo', { iframeUrls: ['https://player.vimeo.com/video/123'], scriptUrls: ['https://player.vimeo.com/api/player.js'] }],
  ['dailymotion', { iframeUrls: ['https://geo.dailymotion.com/player.html?video=x1'], scriptUrls: ['https://static1.dmcdn.net/player.js'] }],
  ['jwplayer', { scriptUrls: ['https://cdn.jwplayer.com/players/HRQZA1oT-SkbOASt9.js'], domSignals: ['jw-player-container'] }],
  ['videojs', { scriptUrls: ['https://vjs.zencdn.net/8.0/video.min.js'], domSignals: ['video-js vjs-default-skin'] }],
  ['hlsjs', { scriptUrls: ['https://cdn.example.test/hls.min.js'], globals: ['Hls'] }],
  ['shaka', { scriptUrls: ['https://cdn.example.test/shaka-player.compiled.js'], globals: ['shaka'] }],
  ['flowplayer', { scriptUrls: ['https://cdn.example.test/flowplayer.min.js'], domSignals: ['flowplayer fp-player'] }],
  ['bradmax', { iframeUrls: ['https://bradm.ax/player/live'], domSignals: ['bradmax-player'] }],
  ['tego', { iframeUrls: ['https://player.tegotv.com/player.php?channel=1'], domSignals: ['tegotv-player'] }],
  ['novus', { scriptUrls: ['https://novus.telearuba.aw/assets/novus.js'], domSignals: ['novus-channel'] }],
  ['native-html5', { mediaElementCount: 1 }],
];

for (const [family, evidence] of cases) {
  test(`classifies ${family}`, () => {
    const result = classifyPlayer(evidence);
    assert.equal(result.primaryFamily, family);
    assert.notEqual(result.confidence, 'low');
    assert.ok(result.supportingEvidence.length > 0);
  });
}

test('hosted player outranks manifest evidence', () => {
  const result = classifyPlayer({
    iframeUrls: ['https://player.vimeo.com/video/123'],
    mediaUrls: ['https://cdn.example.test/live/playlist.m3u8?token=secret'],
  });
  assert.equal(result.primaryFamily, 'vimeo');
  assert.equal(result.secondaryFamilies.includes('hlsjs'), false);
});

test('arbitrary iframe does not classify as hosted player by generic path', () => {
  const result = classifyPlayer({ iframeUrls: ['https://ads.example.test/player/frame'] });
  assert.equal(result.primaryFamily, 'unknown');
  assert.equal(result.secondaryFamilies.length, 0);
});

test('real Novus hostname classifies as Novus', () => {
  const result = classifyPlayer({ iframeUrls: ['https://novus.telearuba.aw/live/channel-13'] });
  assert.equal(result.primaryFamily, 'novus');
});

test('generic player path without Bradmax host does not classify as Bradmax', () => {
  const result = classifyPlayer({ iframeUrls: ['https://video.example.test/player/live'] });
  assert.equal(result.primaryFamily, 'unknown');
  assert.equal(result.secondaryFamilies.includes('bradmax'), false);
});

test('known hosted-player hostname outranks generic HTML5 evidence', () => {
  const result = classifyPlayer({
    iframeUrls: ['https://player.vimeo.com/video/123'],
    mediaElementCount: 1,
  });
  assert.equal(result.primaryFamily, 'vimeo');
  assert.ok(result.secondaryFamilies.includes('native-html5'));
});

test('primary versus secondary ordering is deterministic for competing signatures', () => {
  const result = classifyPlayer({
    iframeUrls: ['https://geo.dailymotion.com/player.html?video=x1'],
    scriptUrls: ['https://cdn.jwplayer.com/players/example.js'],
    domSignals: ['jw-player'],
  });
  assert.equal(result.primaryFamily, 'jwplayer');
  assert.ok(result.secondaryFamilies.includes('dailymotion'));
});

test('confidence calculation returns high, medium and low', () => {
  assert.equal(classifyPlayer({
    iframeUrls: ['https://www.youtube.com/embed/abc'],
    scriptUrls: ['https://www.youtube.com/s/player/base.js'],
  }).confidence, 'high');

  assert.equal(classifyPlayer({
    scriptUrls: ['https://vjs.zencdn.net/8.0/video.min.js'],
  }).confidence, 'medium');

  assert.equal(classifyPlayer({
    mediaUrls: ['https://cdn.example.test/live/index.m3u8'],
  }).confidence, 'low');
});

test('manifest URLs alone are not Hls.js or Shaka Player library proof', () => {
  assert.equal(classifyPlayer({
    mediaUrls: ['https://cdn.example.test/live/index.m3u8'],
  }).primaryFamily, 'unknown');
  assert.equal(classifyPlayer({
    mediaUrls: ['https://cdn.example.test/live/index.mpd'],
  }).primaryFamily, 'unknown');
});

test('Hls.js script or global classifies as hlsjs', () => {
  assert.equal(classifyPlayer({ scriptUrls: ['https://cdn.example.test/hls.min.js'] }).primaryFamily, 'hlsjs');
  assert.equal(classifyPlayer({ globals: ['Hls'] }).primaryFamily, 'hlsjs');
});

test('Shaka script or global classifies as shaka', () => {
  assert.equal(classifyPlayer({ scriptUrls: ['https://cdn.example.test/shaka-player.compiled.js'] }).primaryFamily, 'shaka');
  assert.equal(classifyPlayer({ globals: ['shaka'] }).primaryFamily, 'shaka');
});

test('JWPlayer plus manifest remains JWPlayer primary', () => {
  const result = classifyPlayer({
    scriptUrls: ['https://cdn.jwplayer.com/players/example.js'],
    mediaUrls: ['https://cdn.example.test/live/index.m3u8'],
  });
  assert.equal(result.primaryFamily, 'jwplayer');
  assert.equal(result.secondaryFamilies.includes('hlsjs'), false);
});

test('unknown fallback has low confidence and uncertainty', () => {
  const result = classifyPlayer({ scriptUrls: ['https://cdn.example.test/app.js'] });
  assert.equal(result.primaryFamily, 'unknown');
  assert.equal(result.confidence, 'low');
  assert.ok(result.uncertainty.length > 0);
});

test('configured families match supported player families except unknown', () => {
  const configured = Object.keys(loadPlayerSignatures().families).sort();
  const supported = PLAYER_FAMILIES.filter((family) => family !== 'unknown').sort();
  assert.deepEqual(configured, supported);
});
