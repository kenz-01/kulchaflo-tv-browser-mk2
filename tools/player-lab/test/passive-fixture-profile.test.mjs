import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MISSING_CHROMIUM_COMMAND, resolveChromiumRuntime } from '../src/browser-runtime.mjs';
import { evidenceForClassifiers, profileFixture } from '../src/profile-fixture.mjs';
import { classifyPlayer } from '../src/classify-player.mjs';

const runtime = resolveChromiumRuntime();
const skipReason = runtime ? false : `No usable Chromium executable. Run: ${MISSING_CHROMIUM_COMMAND}`;

test('passive fixture profile observes frames, media, mutations and reports without interactions', { skip: skipReason }, async () => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'player-lab-profile-test-'));
  try {
    const result = await profileFixture({ outputRoot, observationMs: 3200 });
    assert.deepEqual(result.browserRuntime, { type: runtime.type });
    assert.equal(Object.hasOwn(result.browserRuntime, 'executablePath'), false);

    const jsonText = readFileSync(result.jsonPath, 'utf8');
    const markdown = readFileSync(result.markdownPath, 'utf8');
    const report = JSON.parse(jsonText);

    assert.ok(existsSync(result.jsonPath), 'report.json exists');
    assert.ok(existsSync(result.markdownPath), 'report.md exists');
    assert.ok(existsSync(result.screenshotPath), 'page.png exists');

    assert.deepEqual(result.report, report);
    assert.throws(() => { result.report.requestedUrl = 'https://leak.example.test/?token=secret#frag'; }, /read only|Cannot assign/);
    assert.equal(result.report.requestedUrl, report.requestedUrl);
    assert.equal(result.report.requestedUrl.includes('?'), false);
    assert.equal(result.report.requestedUrl.includes('#'), false);
    assert.equal(result.report.finalUrl.includes('?'), false);
    assert.equal(result.report.finalUrl.includes('#'), false);

    assert.equal(report.frames.length, 2);
    assert.equal(report.frames.some((frame) => frame.mainFrame && frame.url.endsWith('/')), true);
    assert.equal(report.frames.some((frame) => frame.name === 'fixture-nested-frame'), true);
    assert.ok(report.frames.every((frame) => frame.domInspectionSucceeded === true));

    assert.equal(report.mediaObservations.length, 3);
    assert.equal(new Set(report.mediaObservations.map((item) => item.id)).size, 3);
    assert.ok(report.mediaObservations.some((item) => item.tag === 'video' || item.tagType === 'video'));
    assert.equal(report.mediaObservations.reduce((sum, item) => sum + Number(item.sourceChangeCount ?? 0), 0), 1);
    assert.equal(report.lifecycleEvidence['source-change'].length, 1);
    assert.equal(report.lifecycleEvidence['media-removed'].length, 1);
    assert.equal(report.lifecycleEvidence['media-added'].length, 1);
    assert.equal(report.lifecycleEvidence['media-replaced'].length, 1);
    const replacement = report.lifecycleEvidence['media-replaced'][0];
    assert.ok(report.mediaObservations.some((item) => item.id === replacement.replacedMediaId && item.removed === true));
    assert.ok(report.mediaObservations.some((item) => item.id === replacement.replacementMediaId && item.removed === false));

    assert.ok(report.scripts.some((script) => script.path === '/mock-player.js'));
    assert.ok(report.iframes.some((iframe) => iframe.path === '/nested-frame.html'));
    assert.equal(report.candidateControls.length, 3);
    assert.equal(new Set(report.candidateControls.map((control) => `${control.frameId}|${control.ariaLabel}|${control.text}`)).size, 3);
    assert.equal(report.candidateControls.filter((control) => control.matchedKinds.includes('play')).length, 2);
    assert.equal(report.candidateControls.filter((control) => control.matchedKinds.includes('fullscreen')).length, 1);

    assert.ok(report.networkEvidence.length > 0);
    assert.ok(report.networkEvidence.every((item) => !String(item.url).includes('?') && !String(item.url).includes('#')));
    assert.ok(report.networkEvidence.some((item) => item.kind.includes('iframe-document') && item.url.endsWith('/nested-frame.html')));
    assert.ok(report.networkEvidence.some((item) => item.url.endsWith('/delayed-jwplayer.js') && item.status === 200 && item.contentType === 'text/javascript'));

    assert.ok(report.lifecycleEvidence['console-error'].length >= 1);
    assert.ok(report.lifecycleEvidence['page-error'].length >= 1);
    assert.ok(report.lifecycleEvidence['frame-lifecycle'].length >= 1);

    assert.match(JSON.stringify(report.playerClassification), /native-html5/);
    assert.match(JSON.stringify(report.playerClassification), /jwplayer/);
    assert.match(JSON.stringify(report.playerClassification), /videojs/);

    for (const secret of [
      'top-secret',
      'poster-secret',
      'media-secret',
      'frame-secret',
      'nested-secret',
      'nested-fragment',
      'nested-media-secret',
      'changed-secret',
      'console-secret',
      'page-secret',
      'delayed-secret',
      'fixture-secret',
      'fixture-fragment',
    ]) {
      assert.doesNotMatch(jsonText, new RegExp(secret));
      assert.doesNotMatch(markdown, new RegExp(secret));
      assert.doesNotMatch(JSON.stringify(result.report), new RegExp(secret));
    }

    assert.deepEqual(result.interactionCounters, {
      click: 0,
      pointer: 0,
      keyboard: 0,
      play: 0,
      pause: 0,
      requestFullscreen: 0,
    });
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('fixture profile runs twice sequentially with repeatable counts and cleanup', { skip: skipReason }, async () => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'player-lab-profile-repeat-'));
  try {
    const first = await profileFixture({ outputRoot, observationMs: 3200 });
    const second = await profileFixture({ outputRoot, observationMs: 3200 });
    for (const result of [first, second]) {
      assert.equal(result.report.frames.length, 2);
      assert.equal(result.report.mediaObservations.length, 3);
      assert.equal(result.report.candidateControls.length, 3);
      assert.equal(result.report.lifecycleEvidence['source-change'].length, 1);
      assert.equal(result.report.lifecycleEvidence['media-removed'].length, 1);
      assert.equal(result.report.lifecycleEvidence['media-added'].length, 1);
      assert.equal(result.report.lifecycleEvidence['media-replaced'].length, 1);
      assert.deepEqual(result.interactionCounters, {
        click: 0,
        pointer: 0,
        keyboard: 0,
        play: 0,
        pause: 0,
        requestFullscreen: 0,
      });
    }
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('classifier evidence uses supported scriptUrls key', () => {
  const evidence = evidenceForClassifiers({
    mediaObservations: [],
    scripts: [{ src: 'https://cdn.jwplayer.com/players/example.js' }],
    iframes: [],
    networkEvidence: [],
    candidateControls: [],
    frames: [],
  });
  assert.deepEqual(evidence.scriptUrls, ['https://cdn.jwplayer.com/players/example.js']);
  assert.equal(Object.hasOwn(evidence, 'scripts'), false);
  assert.equal(classifyPlayer(evidence).primaryFamily, 'jwplayer');
});
