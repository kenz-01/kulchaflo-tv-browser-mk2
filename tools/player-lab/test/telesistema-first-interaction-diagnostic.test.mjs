import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const assetRoot = resolve(process.cwd(), '../../app-gv/src/main/assets/gv_media_observer');
const script = readFileSync(resolve(assetRoot, 'telesistema-first-interaction-diagnostic.js'), 'utf8');
const manifest = JSON.parse(readFileSync(resolve(assetRoot, 'manifest.json'), 'utf8'));
const activity = readFileSync(resolve(process.cwd(), '../../app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt'), 'utf8');
const mediaController = readFileSync(resolve(process.cwd(), '../../app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/media/GvBrowserMediaController.kt'), 'utf8');

function makeFrame(attributes = {}) {
  const listeners = new Map();
  return {
    tagName: 'IFRAME',
    attributes: { ...attributes },
    getAttribute(name) { return this.attributes[name] || null; },
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name) { listeners.delete(name); },
    fire(name) { listeners.get(name)?.(); },
    querySelectorAll() { return []; },
  };
}

function runPage({ url, frames = [] }) {
  const messages = [];
  const timers = [];
  let mutationObserver;
  const page = {
    location: { href: url },
    listeners: new Map(),
    prompt(message) { messages.push(String(message)); },
    addEventListener(name, listener) { this.listeners.set(name, listener); },
    removeEventListener(name) { this.listeners.delete(name); },
  };
  page.top = page;
  class TestMutationObserver {
    constructor(callback) { this.callback = callback; mutationObserver = this; }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  const scope = {
    URL,
    Date,
    window: page,
    document: {
      documentElement: {},
      querySelectorAll(selector) { return selector === 'iframe' ? frames : []; },
    },
    MutationObserver: TestMutationObserver,
    setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; },
    clearTimeout(id) { if (timers[id - 1]) timers[id - 1].cleared = true; },
  };
  runInNewContext(script, scope);
  return { messages, timers, page, observer: () => mutationObserver };
}

function payloads(page) {
  return page.messages.map((message) => JSON.parse(message.replace('__GV_MEDIA__', '')));
}

test('diagnostic is exact-route scoped and bounded', () => {
  const scope = { URL };
  runInNewContext(script, scope);
  const api = scope.KfTelesistemaFirstInteractionDiagnostic;
  assert.equal(api.isOfficialPage('https://telesistema11.com.do/en-vivo/?utm_source=x'), true);
  assert.equal(api.isOfficialPage('https://www.telesistema11.com.do/en-vivo/'), true);
  assert.equal(api.isOfficialPage('https://telesistema11.com.do/'), false);
  assert.equal(api.isOfficialPage('http://telesistema11.com.do/en-vivo/'), false);
  assert.equal(api.isTrustedPlayerSource('https://geo.dailymotion.com/player.html?video=private-token'), true);
  assert.equal(api.isTrustedPlayerSource('https://geo.evil.example/player.html'), false);
  assert.deepEqual({ ...api.limits }, { maxWaitMs: 60_000, maxEvents: 32, maxFrames: 16 });

  const unrelated = runPage({ url: 'https://example.com/', frames: [] });
  assert.deepEqual(unrelated.messages, []);
  assert.equal(unrelated.observer(), undefined);
});

test('reports opaque frame identity and source changes without source values', () => {
  const secretSource = 'https://geo.dailymotion.com/player.html?video=private-token&sig=secret';
  const frame = makeFrame({ src: 'about:blank', 'data-lazy-src': secretSource });
  const page = runPage({ url: 'https://telesistema11.com.do/en-vivo/', frames: [frame] });
  const initial = payloads(page);
  assert.deepEqual(initial.map((item) => item.phase), ['diagnostic-active', 'frame-added', 'frame-snapshot']);
  assert.equal(initial[1].frameId, 1);
  assert.equal(initial[1].frameCount, 1);

  frame.attributes.src = 'https://geo.dailymotion.com/player.html?video=another-private-token';
  page.observer().callback([{ type: 'attributes', target: frame, attributeName: 'src' }]);
  frame.fire('load');
  const observed = payloads(page).slice(3);
  assert.equal(observed[0].phase, 'frame-source-change');
  assert.equal(observed[0].sourceAttribute, 'src');
  assert.equal(observed[0].sourceChange, 'changed');
  assert.equal(observed[0].frameId, 1);
  assert.equal(observed[1].phase, 'frame-load');
  assert.equal(observed[1].loadCount, 1);
  assert.ok(!page.messages.join('\n').includes('private-token'));
  assert.ok(!page.messages.join('\n').includes('secret'));
  assert.ok(!page.messages.join('\n').includes('dailymotion'));

  page.observer().callback([{ type: 'childList', addedNodes: [], removedNodes: [frame] }]);
  const removed = payloads(page).at(-1);
  assert.equal(removed.phase, 'frame-removed');
  assert.equal(removed.frameId, 1);
  assert.equal(removed.frameCount, 0);
});

test('manifest and native bridge accept only fixed route-scoped diagnostic fields', () => {
  const entry = manifest.content_scripts.find((item) =>
    item.js.includes('telesistema-first-interaction-diagnostic.js'));
  assert.ok(entry);
  assert.deepEqual(entry.matches, [
    'https://telesistema11.com.do/en-vivo*',
    'https://www.telesistema11.com.do/en-vivo*',
  ]);
  assert.equal(entry.all_frames, false);
  assert.match(activity, /beginTelesistemaKeyDispatch\(event\)/);
  assert.match(activity, /TELESISTEMA_DIAGNOSTIC_MAX_KEY_EVENTS = 8/);
  assert.match(activity, /handleTelesistemaDiagnosticPayload\(session, payload\)/);
  assert.match(activity, /event=\$phase ageMs=\$ageMs[\s\S]{0,100}frameId=\$frameId[\s\S]{0,100}frameCount=\$frameCount/);
  assert.match(activity, /frameLoadCount=\$frameLoadCount/);
  assert.match(activity, /scriptElapsedMs=\$scriptElapsedMs/);
  assert.match(mediaController, /diagnosticEventListener\?\.invoke\(session, "media-deactivated"\)/);
  assert.match(activity, /key=\$\{trace\.keyCategory\} action=\$\{trace\.action\}[\s\S]{0,100}route=/);
  assert.doesNotMatch(script, /console\.(?:log|info|warn|error)/);
  assert.doesNotMatch(script, /window\.location\.href\s*[,}]/);
});
