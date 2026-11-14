import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const root = resolve(process.cwd(), '../../app-gv/src/main/assets/gv_media_observer');
const script = readFileSync(resolve(root, 'telesistema-lazy-frame-helper.js'), 'utf8');
const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
const activity = readFileSync(resolve(process.cwd(), '../../app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt'), 'utf8');
const targets = JSON.parse(readFileSync(resolve(process.cwd(), 'config/public-targets.json'), 'utf8'));

function pureApi() {
  const scope = { URL };
  runInNewContext(script, scope);
  return scope.KfTelesistemaLazyFrameHelper;
}

function makeFrame(attributes = {}, className = '') {
  const writes = [];
  return {
    tagName: 'IFRAME',
    className,
    attrs: { ...attributes },
    writes,
    scrolls: 0,
    getAttribute(name) { return this.attrs[name] || null; },
    setAttribute(name, value) { this.attrs[name] = value; writes.push([name, value]); },
    scrollIntoView() { this.scrolls++; }
  };
}

function runPage({ url, frames = [], topFrame = true }) {
  const timers = [];
  const messages = [];
  let observerInstance = null;
  const page = { location: { href: url } };
  page.top = topFrame ? page : {};
  class TestMutationObserver {
    constructor(callback) { this.callback = callback; observerInstance = this; }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  const scope = {
    URL,
    Date,
    window: page,
    document: {
      documentElement: {},
      querySelectorAll(selector) { return selector === 'iframe' ? frames : []; }
    },
    MutationObserver: TestMutationObserver,
    setTimeout(callback, delay = 0) {
      const timer = { callback, delay, cleared: false };
      timers.push(timer);
      return timers.length;
    },
    clearTimeout(id) { if (timers[id - 1]) timers[id - 1].cleared = true; },
    console: { info(message) { messages.push(String(message)); } }
  };
  runInNewContext(script, scope);
  return {
    timers,
    messages,
    helper: scope.KfTelesistemaLazyFrameHelper,
    observer: () => observerInstance,
    runNextZeroTimer() {
      const timer = timers.find((item) => !item.cleared && item.delay === 0 && !item.ran);
      if (timer) { timer.ran = true; timer.callback(); }
      return timer;
    }
  };
}

test('official Telesistema route and Dailymotion source checks are exact and bounded', () => {
  const helper = pureApi();
  assert.equal(helper.isOfficialPage('https://telesistema11.com.do/en-vivo/?utm_source=KulchaFlo'), true);
  assert.equal(helper.isOfficialPage('https://www.telesistema11.com.do/en-vivo/'), true);
  assert.equal(helper.isOfficialPage('http://telesistema11.com.do/en-vivo/'), false);
  assert.equal(helper.isOfficialPage('https://telesistema11.com.do/en-vivo/other'), false);
  assert.equal(helper.isOfficialPage('https://evil.example/en-vivo/'), false);
  assert.equal(helper.isOfficialPage('https://user@telesistema11.com.do/en-vivo/'), false);

  assert.equal(helper.isTrustedDailymotionUrl('https://geo.dailymotion.com/player/x.html?video=x8abc'), true);
  assert.equal(helper.isTrustedDailymotionUrl('https://geo.dailymotion.com/player-fake/x.html'), false);
  assert.equal(helper.isTrustedDailymotionUrl('https://www.dailymotion.com/embed/video/x8abc'), true);
  assert.equal(helper.isTrustedDailymotionUrl('http://geo.dailymotion.com/player/x.html'), false);
  assert.equal(helper.isTrustedDailymotionUrl('https://geo.evil.example/player/x.html'), false);
  assert.equal(helper.isTrustedDailymotionUrl('https://www.dailymotion.com/ads/x'), false);

  assert.deepEqual(Array.from(helper.policy.retryDelaysMs), [250, 800, 1800, 3500, 6000, 10000, 15000, 20000]);
  assert.equal(helper.policy.maxAttempts, 32);
  assert.equal(helper.policy.maxWaitMs, 30000);
  assert.equal(targets.targets['telesistema-11'].initialUrl, 'https://telesistema11.com.do/en-vivo/');
  assert.deepEqual(targets.targets['telesistema-11'].allowedMainFrameHosts,
    ['telesistema11.com.do', 'www.telesistema11.com.do']);
});

test('only the manifest-injected exact page wakes one publisher-owned lazy Dailymotion frame', () => {
  const scriptEntry = manifest.content_scripts.find((entry) =>
    entry.js.includes('telesistema-lazy-frame-helper.js'));
  assert.ok(scriptEntry);
  assert.deepEqual(scriptEntry.matches, [
    'https://telesistema11.com.do/en-vivo*',
    'https://www.telesistema11.com.do/en-vivo*'
  ]);
  assert.equal(scriptEntry.all_frames, false);
  assert.ok(!manifest.content_scripts[0].js.includes('telesistema-lazy-frame-helper.js'));
  assert.match(activity, /private fun shouldPromoteDirectMedia\(url: String\): Boolean\s*\{\s*\/\/ Telesistema[\s\S]*?!isTelesistemaLivePageUrl\(url\)/);
  assert.match(activity, /private fun isTelesistemaLivePageUrl\(url: String\): Boolean[\s\S]*?host != "telesistema11\.com\.do"[\s\S]*?path == "\/en-vivo"/);

  const original = 'https://www.dailymotion.com/embed/video/x8abc?autoplay=1';
  const frame = makeFrame({ src: 'about:blank', 'data-lazy-src': original, loading: 'lazy' }, 'litespeed-loading');
  const page = runPage({ url: 'https://telesistema11.com.do/en-vivo/?utm_source=KulchaFlo', frames: [frame] });
  page.runNextZeroTimer();

  assert.equal(frame.attrs.src, original);
  assert.equal(frame.attrs.loading, 'eager');
  assert.deepEqual(frame.writes, [['loading', 'eager'], ['src', original]]);
  assert.equal(frame.scrolls, 1);
  assert.equal(page.observer().disconnected, true);
  assert.equal(page.messages.length, 1);
  assert.match(page.messages[0], /result=wake-requested/);
  assert.doesNotMatch(page.messages[0], /dailymotion|x8abc|autoplay|https?:/i);
});

test('an already active frame and unrelated sites keep publisher UI and source untouched', () => {
  const active = makeFrame({ src: 'https://geo.dailymotion.com/player/x.html?video=x8abc' });
  const page = runPage({ url: 'https://telesistema11.com.do/en-vivo/', frames: [active] });
  page.runNextZeroTimer();
  assert.deepEqual(active.writes, []);
  assert.equal(active.scrolls, 0);
  assert.match(page.messages[0], /result=frame-already-active/);

  const loaded = makeFrame({ src: 'https://geo.dailymotion.com/player/x.html?video=x8abc' }, 'litespeed-loaded');
  const loadedPage = runPage({ url: 'https://telesistema11.com.do/en-vivo/', frames: [loaded] });
  loadedPage.runNextZeroTimer();
  assert.deepEqual(loaded.writes, []);
  assert.equal(loaded.scrolls, 0);
  assert.match(loadedPage.messages[0], /result=frame-already-active/);

  const otherProvider = makeFrame({ 'data-lazy-src': 'https://geo.dailymotion.com/player/x.html?video=x8abc' }, 'litespeed-loading');
  const otherPage = runPage({ url: 'https://bonce.tv/', frames: [otherProvider] });
  assert.equal(otherPage.timers.length, 0);
  assert.deepEqual(otherProvider.writes, []);
  assert.equal(otherProvider.scrolls, 0);

  const otherPath = runPage({ url: 'https://telesistema11.com.do/', frames: [otherProvider] });
  assert.equal(otherPath.timers.length, 0);
});

test('a relevant late iframe insertion is observed; unrelated DOM churn is ignored', () => {
  const frames = [];
  const page = runPage({ url: 'https://telesistema11.com.do/en-vivo/', frames });
  page.runNextZeroTimer();
  const pendingZeroTimers = () => page.timers.filter((item) => item.delay === 0 && !item.ran).length;
  assert.equal(pendingZeroTimers(), 0);

  page.observer().callback([{ type: 'attributes', attributeName: 'class', target: { tagName: 'DIV' } }]);
  assert.equal(pendingZeroTimers(), 0);

  const original = 'https://www.dailymotion.com/embed/video/x8late';
  const frame = makeFrame({ src: 'about:blank', 'data-lazy-src': original }, 'litespeed-loading');
  frames.push(frame);
  page.observer().callback([{ type: 'childList', addedNodes: [frame] }]);
  assert.equal(pendingZeroTimers(), 1);
  page.runNextZeroTimer();
  assert.equal(frame.attrs.src, original);
  assert.equal(frame.scrolls, 1);
  assert.match(page.messages[0], /result=wake-requested/);
});

test('ambiguous, untrusted, and embedded-frame contexts fail closed', () => {
  const first = makeFrame({ 'data-src': 'https://geo.dailymotion.com/player/x.html?video=a' }, 'lazyload');
  const second = makeFrame({ 'data-lazy-src': 'https://www.dailymotion.com/embed/video/b' }, 'lazyload');
  const ambiguous = runPage({ url: 'https://telesistema11.com.do/en-vivo/', frames: [first, second] });
  ambiguous.runNextZeroTimer();
  assert.deepEqual(first.writes, []);
  assert.deepEqual(second.writes, []);
  assert.equal(first.scrolls + second.scrolls, 0);
  assert.match(ambiguous.messages[0], /result=ambiguous-player/);

  const untrusted = makeFrame({ src: 'about:blank', 'data-lazy-src': 'https://evil.example/player' }, 'litespeed-loading');
  const unsafePage = runPage({ url: 'https://telesistema11.com.do/en-vivo/', frames: [untrusted] });
  unsafePage.runNextZeroTimer();
  assert.deepEqual(untrusted.writes, []);
  assert.equal(untrusted.scrolls, 0);
  assert.equal(unsafePage.messages.length, 0);

  const embedded = runPage({
    url: 'https://telesistema11.com.do/en-vivo/',
    frames: [makeFrame({ 'data-lazy-src': 'https://geo.dailymotion.com/player/x.html' }, 'lazy')],
    topFrame: false
  });
  assert.equal(embedded.timers.length, 0);
});
