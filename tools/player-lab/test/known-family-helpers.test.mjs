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

test('real Video.js video element gets one bounded play/unmute and player-first shell', () => {
  const writes = [];
  let plays = 0;
  const style = () => ({ setProperty: (...args) => writes.push(args) });
  const video = {
    tagName: 'VIDEO', style: style(), readyState: 3, paused: true,
    volume: 0, muted: true,
    getBoundingClientRect: () => ({ width: 960, height: 540 }),
    querySelector: () => null,
    play() { plays += 1; return Promise.resolve(); }
  };
  const body = { style: style(), children: [video] };
  video.parentElement = body;
  const timers = [];
  const fakeWindow = { location: { href: 'https://bonce.tv/' } };
  fakeWindow.top = fakeWindow;
  const fakeDocument = {
    body, documentElement: { style: style() },
    querySelectorAll(selector) {
      return selector === '.video-js, video-js' ? [video] : [];
    }
  };
  runInNewContext(script, {
    URL, window: fakeWindow, document: fakeDocument,
    setTimeout(callback) { timers.push(callback); },
    console: { info() {} }
  });
  assert.equal(timers.length, 7);
  timers.forEach((callback) => callback());
  assert.equal(plays, 1);
  assert.equal(video.muted, false);
  assert.equal(video.volume, 1);
  assert.ok(writes.some((args) => args[0] === 'position' && args[1] === 'fixed'));
});

test('unknown sites and ambiguous multi-player routes are not altered', () => {
  const timers = [];
  const unknownWindow = { location: { href: 'https://unknown.example/' } };
  unknownWindow.top = unknownWindow;
  runInNewContext(script, {
    URL, window: unknownWindow, document: { body: {} },
    setTimeout(callback) { timers.push(callback); }
  });
  assert.equal(timers.length, 0);

  const candidates = [1, 2].map(() => ({
    tagName: 'VIDEO', readyState: 3, src: 'https://example.com/live.m3u8',
    getBoundingClientRect: () => ({ width: 960, height: 540 })
  }));
  const multiWindow = { location: { href: 'https://rtvd.gob.do/' } };
  multiWindow.top = multiWindow;
  const multiTimers = [];
  let changes = 0;
  runInNewContext(script, {
    URL, window: multiWindow,
    document: { body: { children: [] }, querySelectorAll: () => candidates },
    setTimeout(callback) { multiTimers.push(callback); },
    console: { info() { changes += 1; } }
  });
  multiTimers.forEach((callback) => callback());
  assert.equal(changes, 0);
});

test('native GeckoView keeps the 19 new official channels browser-first', () => {
  const native = readFileSync(resolve(process.cwd(),
    '../../app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt'), 'utf8');
  assert.ok(native.includes('private fun isKnownFamilyLivePageUrl(url: String): Boolean'));
  assert.ok(native.includes('isKnownFamilyLivePageUrl(currentUrl)'));
  assert.ok(native.includes('isKnownFamilyLivePageUrl(pageUrl)'));
  assert.ok(native.includes('isKnownFamilyLivePageUrl(url) -> true'));
  assert.ok(native.includes('known-family-browser-first'));
  for (const route of routes) {
    assert.ok(native.includes('"' + route.host + '" -> path == "' + route.path + '"'),
      'missing exact native browser-first route: ' + route.id);
  }
});

test('Bonce exact route accepts one ready plain HTML5 video, not any arbitrary multi-video page', () => {
  const writes = [];
  const state = [];
  let started = 0;
  const style = () => ({ setProperty: (...args) => writes.push(args) });
  const video = {
    tagName: 'VIDEO', style: style(), readyState: 3, paused: true,
    src: 'https://example.com/hls/stream.m3u8', volume: 0, muted: true,
    getBoundingClientRect: () => ({ width: 800, height: 450 }),
    querySelector: () => null,
    play() { started++; return Promise.resolve(); }
  };
  const body = { style: style(), children: [video] };
  video.parentElement = body;
  const fakeWindow = {
    location: { href: 'https://bonce.tv/?utm_source=KulchaFlo' },
    prompt(message) { state.push(message); }
  };
  fakeWindow.top = fakeWindow;
  const timers = [];
  runInNewContext(script, {
    URL, window: fakeWindow,
    document: {
      body, documentElement: { style: style() },
      querySelectorAll(query) {
        if (query === 'video') return [video];
        if (query === 'iframe') return [];
        return [];
      }
    },
    setTimeout(callback) { timers.push(callback); }
  });
  timers.forEach((callback) => callback());
  assert.equal(started, 1);
  assert.equal(video.muted, false);
  assert.equal(video.volume, 1);
  assert.equal(state.length, 1);
  assert.ok(state[0].includes('content-known-family-player-first'));
  assert.ok(writes.some((write) => write[0] === 'position' && write[1] === 'fixed'));
});

test('only Bonce and Telesistema get additional source-scoped autoplay permissions', () => {
  const native = readFileSync(resolve(process.cwd(),
    '../../app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt'), 'utf8');
  assert.ok(native.includes('knownFamilyAutoplayScoped -> GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW'));
  assert.ok(native.includes('knownFamilyPermissionUri &&'));
  assert.ok(native.includes('knownFamilyHost == "bonce.tv"'));
  assert.ok(native.includes('knownFamilyHost == "telesistema11.com.do"'));
  assert.ok(native.includes('thirdPartyHost?.removePrefix("www.") == "geo.dailymotion.com"'));
  assert.ok(native.includes('reason = "radiant-player-first"'));
  assert.ok(native.includes('reason = "known-family-player-first"'));
});

test('Telesistema wakes a unique lazy Dailymotion iframe before player-first, without changing its URL', () => {
  const events = [];
  const original = 'https://www.dailymotion.com/embed/video/x80ac48?autoplay=1&mute=1';
  const writes = [];
  const style = () => ({ setProperty: (...args) => writes.push(args) });
  const frame = {
    tagName: 'IFRAME', style: style(), parentElement: null,
    attrs: { src: 'about:blank', 'data-lazy-src': original },
    getAttribute(name) { return this.attrs[name] || null; },
    setAttribute(name, value) { this.attrs[name] = value; },
    getBoundingClientRect() { return { width: 960, height: 540 }; },
    scrollIntoView() {
      events.push('scroll');
      // Simulated LiteSpeed viewport observer may still fire after the eager source activation.
    }
  };
  const body = { children: [frame], style: style() };
  frame.parentElement = body;
  const timers = [];
  const page = { location: { href: 'https://telesistema11.com.do/en-vivo/?utm_source=KulchaFlo' },
    prompt(message) { events.push(message); } };
  page.top = page;
  runInNewContext(script, {
    URL, window: page, setTimeout(callback) { timers.push(callback); },
    document: {
      body, documentElement: { style: style() },
      querySelectorAll(selector) {
        if (selector === 'iframe') return [frame];
        if (selector === 'iframe[src]') return frame.attrs.src !== 'about:blank' ? [frame] : [];
        if (selector === 'video') return [];
        return [];
      }
    }
  });
  assert.equal(timers.length, 10);
  timers.forEach((fn) => fn());
  assert.equal(events.filter((x) => x === 'scroll').length, 1);
  assert.equal(frame.getAttribute('src'), original);
  assert.ok(events.some((x) => x.includes('content-telesistema-eager-iframe-wake')));
  assert.ok(events.some((x) => x.includes('content-known-family-player-first')));
  assert.equal(events[0], 'scroll');
  assert.ok(writes.some((entry) => entry[0] === 'position' && entry[1] === 'fixed'));
});

test('lazy iframe wake is fail-closed for unknown provider or multiple Dailymotion embeds', () => {
  const source = 'https://www.dailymotion.com/embed/video/x80ac48';
  for (const [location, count] of [
    ['https://telesistema11.com.do/en-vivo/', 2],
    ['https://bonce.tv/', 1]
  ]) {
    let moved = 0;
    const frames = Array.from({ length: count }, () => ({
      tagName: 'IFRAME',
      getAttribute(name) { return name === 'data-lazy-src' ? source : 'about:blank'; },
      scrollIntoView() { moved++; },
      getBoundingClientRect() { return { width: 800, height: 450 }; }
    }));
    const page = { location: { href: location } };
    page.top = page;
    const timers = [];
    runInNewContext(script, {
      URL, window: page, setTimeout(callback) { timers.push(callback); },
      document: {
        body: {}, querySelectorAll(selector) {
          return selector === 'iframe' ? frames : [];
        }
      }
    });
    timers.forEach((fn) => fn());
    assert.equal(moved, 0, 'no lazy iframe scroll outside one official Dailymotion player');
  }
});

test('Telesistema forces exactly one trusted publisher-authored LiteSpeed src to load eagerly', () => {
  const events = [];
  const official = 'https://www.dailymotion.com/embed/video/x80ac48?autoplay=1';
  const frame = {
    tagName: 'IFRAME', className: 'entered litespeed-loading',
    attrs: { src: official, loading: 'lazy' },
    getAttribute(name) { return this.attrs[name] || null; },
    setAttribute(name, value) { this.attrs[name] = value; events.push([name,value]); },
    getBoundingClientRect() { return { width: 960, height: 540 }; },
    scrollIntoView() { events.push(['scroll']); },
    style: { setProperty() {} }, parentElement: null
  };
  const body = { children: [frame], style: { setProperty() {} } };
  frame.parentElement = body;
  const fakeWindow = { location: { href: 'https://telesistema11.com.do/en-vivo/' },
    prompt(message) { events.push(['prompt', message]); } };
  fakeWindow.top = fakeWindow;
  const timers=[];
  runInNewContext(script, {
    URL, window:fakeWindow, setTimeout(callback){timers.push(callback);},
    document: {
      body, documentElement:{style:{setProperty(){}}},
      querySelectorAll(selector) {
        if(selector === 'iframe') return [frame];
        if(selector === 'iframe[src]') return [frame];
        if(selector === 'video') return [];
        return [];
      }
    }
  });
  timers.forEach(fn => fn());
  assert.equal(frame.attrs.loading, 'eager');
  assert.equal(frame.attrs.src, official);
  assert.equal(events.filter(x=>x[0]==='src').length,1);
  assert.equal(events.filter(x=>x[0]==='scroll').length,1);
  assert.ok(events.some(x=>x[0]==='prompt' && x[1].includes('sourceActivated')));
});

test('Telesistema does not load untrusted lazy sources', () => {
  let sourceChanges=0;
  const frame={
    tagName:'IFRAME', className:'litespeed-loading',
    getAttribute(name) { return name==='src'?'about:blank':name==='data-lazy-src'?'https://evil.example/player':''; },
    setAttribute(name) { if(name==='src') sourceChanges++; },
    scrollIntoView(){ throw Error('should not scroll'); },
    getBoundingClientRect(){ return {width:700,height:350}; }
  };
  const w={location:{href:'https://telesistema11.com.do/en-vivo/'}};w.top=w;
  const timers=[];
  runInNewContext(script,{URL,window:w,setTimeout(fn){timers.push(fn);},
    document:{body:{},querySelectorAll(sel){return sel==='iframe'?[frame]:[];}}});
  timers.forEach(fn=>fn());
  assert.equal(sourceChanges,0);
});
