import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const helperPath = resolve(process.cwd(), '../../app-gv/src/main/assets/gv_media_observer/telesistema-viewport-alignment.js');
const helper = readFileSync(helperPath, 'utf8');

function runHelper({ url = 'https://telesistema11.com.do/en-vivo/', frames = [] } = {}) {
  const state = { frames, events: [], observer: null, timers: [], scrollCalls: 0 };
  const window = {
    location: new URL(url),
    innerWidth: 1920,
    innerHeight: 1080,
    scrollX: 0,
    scrollY: 0,
    requestAnimationFrame(callback) { callback(); },
    getComputedStyle() { return { display: 'block', visibility: 'visible' }; },
    addEventListener() {},
    prompt(message) {
      assert.match(message, /^__GV_MEDIA__/);
      state.events.push(JSON.parse(message.slice('__GV_MEDIA__'.length)));
    },
  };
  window.top = window;
  window.self = window;
  const document = {
    baseURI: url,
    documentElement: {},
    querySelectorAll(selector) {
      assert.equal(selector, 'iframe[src]');
      return state.frames;
    },
  };
  class MutationObserver {
    constructor(callback) { this.callback = callback; state.observer = this; }
    observe(_target, options) {
      assert.equal(options.childList, true);
      assert.equal(options.subtree, true);
      assert.equal(options.attributes, true);
      assert.equal(options.attributeFilter[0], 'src');
    }
    disconnect() { this.disconnected = true; }
  }
  let timerId = 0;
  vm.runInNewContext(helper, {
    window,
    document,
    MutationObserver,
    URL,
    Number,
    Math,
    setTimeout(callback, delayMs) {
      const timer = { id: ++timerId, callback, delayMs, cleared: false };
      state.timers.push(timer);
      return timer.id;
    },
    clearTimeout(id) {
      const timer = state.timers.find((candidate) => candidate.id === id);
      if (timer) timer.cleared = true;
    },
  });
  return { state, window };
}

function dailymotionFrame(window, { top = 1300, left = 0 } = {}) {
  const frame = {
    src: 'https://geo.dailymotion.com/player/x123.html?video=x456',
    attributesWritten: 0,
    clicks: 0,
    plays: 0,
    dispatchedEvents: 0,
    rect: { top, left, right: left + 800, bottom: top + 450, width: 800, height: 450 },
    getAttribute(name) { return name === 'src' ? this.src : null; },
    setAttribute() { this.attributesWritten += 1; },
    click() { this.clicks += 1; },
    play() { this.plays += 1; },
    dispatchEvent() { this.dispatchedEvents += 1; },
    getBoundingClientRect() { return this.rect; },
    scrollIntoView(options) {
      window.scrollY += 500;
      this.rect = { ...this.rect, top: 100, bottom: 550 };
      this.lastScrollOptions = options;
      this.scrollCount = (this.scrollCount || 0) + 1;
    },
  };
  return frame;
}

test('offscreen official Dailymotion iframe is aligned once and reports only minimal booleans', () => {
  const { state, window } = runHelper();
  const frame = dailymotionFrame(window);
  state.frames.push(frame);
  state.observer.callback([]);
  state.observer.callback([]);

  assert.equal(frame.scrollCount, 1);
  assert.equal(frame.lastScrollOptions.block, 'center');
  assert.equal(state.events.length, 1);
  assert.deepEqual({ ...state.events[0] }, {
    type: 'telesistema-viewport-alignment',
    visibleBefore: false,
    scrollChanged: true,
  });
  assert.equal(state.observer.disconnected, true);
  assert.equal(state.timers[0].delayMs, 12000);
  assert.equal(state.timers[0].cleared, true);
  assert.equal(frame.attributesWritten + frame.clicks + frame.plays + frame.dispatchedEvents, 0);
  assert.equal(frame.src, 'https://geo.dailymotion.com/player/x123.html?video=x456');
});

test('already visible Dailymotion iframe is reported without scrolling', () => {
  const frame = dailymotionFrame(null, { top: 50 });
  const { state, window } = runHelper({ frames: [frame] });
  frame.scrollIntoView = () => { state.scrollCalls += 1; };

  assert.equal(state.events.length, 1);
  assert.deepEqual({ ...state.events[0] }, {
    type: 'telesistema-viewport-alignment',
    visibleBefore: true,
    scrollChanged: false,
  });
  assert.equal(state.scrollCalls, 0);
  assert.equal(window.scrollY, 0);
});

test('partially visible iframe is brought fully into the viewport once', () => {
  const { state, window } = runHelper();
  const frame = dailymotionFrame(window, { top: 800 });
  state.frames.push(frame);
  state.observer.callback([]);

  assert.equal(frame.scrollCount, 1);
  assert.deepEqual({ ...state.events[0] }, {
    type: 'telesistema-viewport-alignment',
    visibleBefore: true,
    scrollChanged: true,
  });
});

test('late Dailymotion iframe discovery is bounded and rejects non-official embed hosts', () => {
  const { state, window } = runHelper();
  const rejected = dailymotionFrame(window);
  rejected.src = 'https://evil.dailymotion.com/player/x123.html';
  state.frames.push(rejected);
  assert.equal(state.events.length, 0);

  rejected.src = 'https://geo.dailymotion.com/player/x123.html?video=x456';
  state.observer.callback([]);
  assert.equal(state.events.length, 1);
  assert.equal(rejected.scrollCount, 1);
  assert.equal(state.observer.disconnected, true);
});

test('unrelated route and expired discovery do not align any iframe', () => {
  const { state } = runHelper({ url: 'https://telesistema11.com.do/news/' });
  assert.equal(state.observer, null);
  assert.equal(state.events.length, 0);

  const nearMiss = runHelper({ url: 'https://telesistema11.com.do/en-vivo-extra/' });
  assert.equal(nearMiss.state.observer, null);
  assert.equal(nearMiss.state.events.length, 0);

  const pending = runHelper();
  assert.equal(pending.state.timers[0].delayMs, 12000);
  pending.state.timers[0].callback();
  assert.equal(pending.state.observer.disconnected, true);
  assert.equal(pending.state.events.length, 0);
});

test('helper source cannot click, play, synthesize input, mutate player attributes, or force fullscreen', () => {
  assert.doesNotMatch(helper, /\.click\s*\(|\.play\s*\(|dispatchEvent|setAttribute\s*\(|removeAttribute\s*\(|\.src\s*=|requestFullscreen|fullscreen|autoplay|KEYCODE|DPAD/i);
  assert.match(helper, /frame\.scrollIntoView/);
});
