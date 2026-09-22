import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL(
  '../../../app-gv/src/main/assets/gv_media_observer/candidate-ranking.js',
  import.meta.url,
));
const contentPath = fileURLToPath(new URL(
  '../../../app-gv/src/main/assets/gv_media_observer/content.js',
  import.meta.url,
));
const manifestPath = fileURLToPath(new URL(
  '../../../app-gv/src/main/assets/gv_media_observer/manifest.json',
  import.meta.url,
));
const activityPath = fileURLToPath(new URL(
  '../../../app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt',
  import.meta.url,
));
const promotedPlayerPath = fileURLToPath(new URL(
  '../../../app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/media/GvPromotedMediaPlayer.kt',
  import.meta.url,
));

function loadDescriptor() {
  const context = {
    URL,
    innerWidth: 1920,
    innerHeight: 1080,
    getComputedStyle: (element) => element.style,
  };
  context.globalThis = context;
  vm.runInNewContext(readFileSync(sourcePath, 'utf8'), context);
  return context.KfMediaCandidateDescriptor;
}

function element(overrides = {}) {
  return {
    tagName: 'VIDEO',
    id: '',
    className: '',
    parentElement: null,
    style: { display: 'block', visibility: 'visible', opacity: '1' },
    error: null,
    readyState: 4,
    paused: false,
    ended: false,
    muted: false,
    autoplay: false,
    loop: false,
    controls: true,
    duration: 120,
    getAttribute: () => '',
    getBoundingClientRect: () => ({
      left: 0, top: 0, right: 1280, bottom: 720, width: 1280, height: 720,
    }),
    ...overrides,
  };
}

test('descriptor exposes bounded MTM decorative and managed-player facts without a blob URL', () => {
  const api = loadDescriptor();
  const backgroundParent = { id: '', className: 'brz-bg-video background', parentElement: null };
  const background = api.describeCandidate(
    element({
      muted: true,
      autoplay: true,
      controls: false,
      duration: 11.6,
      parentElement: backgroundParent,
      getBoundingClientRect: () => ({
        left: 0, top: 0, right: 1920, bottom: 326, width: 1920, height: 326,
      }),
    }),
    'https://media.example.test/banner.mp4',
    { frameId: 'top-frame', frameRole: 'top-level', mediaOrder: 1, sourceOrder: 1 },
  );
  assert.equal(background.sourceKind, 'direct-mp4');
  assert.equal(background.durationCategory, 'finite-short');
  assert.equal(background.backgroundAncestry, true);
  assert.equal(background.visible, true);

  const playerParent = { id: 'bradmax-player', className: 'bsplayer', parentElement: null };
  const managed = api.describeCandidate(
    element({ controls: false, parentElement: playerParent }),
    'blob:https://player.example.test/random-id',
    { frameId: 'top-frame', frameRole: 'top-level', mediaOrder: 3, sourceOrder: 1 },
  );
  assert.equal(managed.sourceKind, 'managed-media-source');
  assert.equal(managed.managedMediaSource, true);
  assert.equal(managed.playerManagedAncestry, true);
  assert.equal(managed.src, '');
  assert.doesNotMatch(JSON.stringify(managed), /blob:|random-id/);
});

test('safe promotable URL rejects queries, fragments, credentials, blobs and audio', () => {
  const api = loadDescriptor();
  assert.equal(api.safePromotableUrl('https://media.example.test/main.mp4', 'direct-mp4'), 'https://media.example.test/main.mp4');
  for (const value of [
    'https://media.example.test/main.mp4?token=secret',
    'https://media.example.test/main.mp4#fragment',
    'https://user:pass@media.example.test/main.mp4',
    'blob:https://media.example.test/id',
  ]) {
    assert.equal(api.safePromotableUrl(value, api.sourceKind(value, 'video/mp4')), '');
  }
  assert.equal(api.safePromotableUrl('https://media.example.test/audio.mp3', 'direct-audio'), '');
});

test('settlement requires three stable observations, caps duplicate replay, and can reset', () => {
  const api = loadDescriptor();
  let state = api.nextSettlement(null, 'candidate-a');
  assert.equal(state.stableObservationCount, 1);
  state = api.nextSettlement(state, 'candidate-a');
  assert.equal(state.stableObservationCount, 2);
  state = api.nextSettlement(state, 'candidate-a');
  assert.equal(state.stableObservationCount, 3);
  state = api.nextSettlement(state, 'candidate-a');
  assert.equal(state.stableObservationCount, 3);
  state = api.nextSettlement(state, 'candidate-a+managed');
  assert.equal(state.stableObservationCount, 1);
  const reset = api.nextSettlement({ signature: '', stableObservationCount: 0 }, 'candidate-a');
  assert.equal(reset.stableObservationCount, 1);
});

test('content owns one media publish timer and clears it on pagehide', () => {
  const source = readFileSync(contentPath, 'utf8');
  assert.equal((source.match(/mediaPublishTimer = setInterval\(publish, 2000\)/g) ?? []).length, 1);
  assert.equal((source.match(/clearInterval\(mediaPublishTimer\)/g) ?? []).length, 1);
  assert.match(source, /mediaCandidateSettlement = \{ signature: "", stableObservationCount: 0 \}/);
  assert.equal(source.includes('window.addEventListener("pagehide"'), true);
});

test('bounded descriptor helper loads before content and the legacy activity probe is absent', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.deepEqual(
    manifest.content_scripts[0].js,
    ['candidate-ranking.js', 'content.js'],
  );
  const activity = readFileSync(activityPath, 'utf8');
  assert.doesNotMatch(activity, /triggerDirectMediaProbe|activity-js-probe|lastProbeUrlBySession/);
});

test('generic duplicate promotion is guarded and newly exercised player diagnostics omit source URLs', () => {
  const player = readFileSync(promotedPlayerPath, 'utf8');
  assert.match(player, /if \(activeSource\?\.url == source\.url\)/);
  assert.doesNotMatch(player, /GvLogger\.[iew]\([^\n]*url=\$\{source\.url\}/);
  assert.doesNotMatch(player, /error\.message/);
});
