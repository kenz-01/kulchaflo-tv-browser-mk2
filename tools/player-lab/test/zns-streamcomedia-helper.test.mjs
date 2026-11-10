import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const assets = resolve(process.cwd(), '../../app-gv/src/main/assets/gv_media_observer');
const helperPath = resolve(assets, 'zns-streamcomedia-helper.js');
const helperSource = readFileSync(helperPath, 'utf8');

function loadApi() {
  const context = {URL};
  runInNewContext(helperSource, context);
  return context.KfZnsHelper;
}

function style(events = []) {
  return {setProperty(property, value, priority) { events.push([property, value, priority]); }};
}

test('ZNS and StreamcoMedia routes require exact HTTPS hosts and paths', () => {
  const api = loadApi();
  assert.equal(api.route('https://znsbahamas.com/'), 'site');
  assert.equal(api.route('https://www.znsbahamas.com/?view=tv'), 'site');
  assert.equal(api.route('https://player.streamcomedia.com/HTML5/znstv/'), 'embed');
  assert.equal(api.route('https://player.streamcomedia.com:443/HTML5/znstv'), 'embed');
  for (const url of [
    'http://znsbahamas.com/',
    'https://znsbahamas.com.evil.example/',
    'https://evil.znsbahamas.com/',
    'https://znsbahamas.com/news',
    'https://user@znsbahamas.com/',
    'https://znsbahamas.com:8443/',
    'https://evil.player.streamcomedia.com/HTML5/znstv',
    'https://player.streamcomedia.com/HTML5/other',
  ]) assert.equal(api.route(url), '', url);
});

test('only one visible official frame receives the bounded player-first layout', () => {
  const events = [];
  const body = {children: [], style: style(events)};
  const container = {children: [], parentElement: body, style: style(events)};
  const frame = {
    parentElement: container,
    style: style(events),
    attrs: {src: 'https://player.streamcomedia.com/HTML5/znstv/?session=private'},
    getAttribute(key) { return this.attrs[key] || null; },
    setAttribute(key, value) { this.attrs[key] = value; },
    getBoundingClientRect() { return {width: 900, height: 500}; },
  };
  const other = {parentElement: body, style: style(events)};
  container.children = [frame];
  body.children = [container, other];
  const promptEvents = [];
  const window = {location: {href: 'https://znsbahamas.com/?private=secret#fragment'}, prompt(value) { promptEvents.push(value); }};
  window.top = window;
  const timers = [];
  runInNewContext(helperSource, {
    URL,
    window,
    document: {body, documentElement: {style: style(events)}, querySelectorAll() { return [frame]; }},
    setTimeout(callback, delay) { timers.push({callback, delay}); },
  });
  timers.forEach(({callback}) => callback());

  assert.deepEqual(timers.map(({delay}) => delay), [300, 900, 2000, 4000, 7000, 11000, 18000]);
  assert.equal(frame.attrs.allowfullscreen, 'true');
  assert.match(frame.attrs.allow, /autoplay/i);
  assert.equal(promptEvents.length, 1);
  assert.match(promptEvents[0], /zns-outer-player-first/);
  assert.match(promptEvents[0], /https:\/\/znsbahamas\.com\//);
  assert.doesNotMatch(promptEvents[0], /secret|private|fragment/);
  assert.ok(events.some(([property, value]) => property === 'position' && value === 'fixed'));
  assert.ok(events.some(([property, value]) => property === 'display' && value === 'none'));
});

test('ambiguous visible official frames are left untouched', () => {
  const api = loadApi();
  const frame = () => ({
    getAttribute() { return 'https://player.streamcomedia.com/HTML5/znstv'; },
    getBoundingClientRect() { return {width: 900, height: 500}; },
  });
  assert.equal(api.officialFrame({querySelectorAll() { return [frame(), frame()]; }}), null);
});

test('trusted embed gets one play attempt and a bounded, URL-free time-progression receipt', () => {
  const timers = [];
  const prompts = [];
  let playCalls = 0;
  const video = {
    readyState: 4,
    paused: true,
    muted: true,
    volume: 0,
    currentTime: 1,
    addEventListener(name, callback) { this[`on${name}`] = callback; },
    getBoundingClientRect() { return {width: 900, height: 500}; },
    play() { playCalls += 1; return {catch() {}}; },
  };
  const window = {
    location: {href: 'https://player.streamcomedia.com/HTML5/znstv/?token=private'},
    top: {},
    prompt(value) { prompts.push(value); },
  };
  runInNewContext(helperSource, {
    URL,
    window,
    document: {
      referrer: 'https://www.znsbahamas.com/',
      querySelectorAll(selector) { return selector === 'video' ? [video] : []; },
    },
    setTimeout(callback, delay) { timers.push({callback, delay}); },
  });
  const retries = timers.splice(0);
  assert.deepEqual(retries.map(({delay}) => delay), [300, 900, 2000, 4000, 7000, 11000, 18000]);
  retries.forEach(({callback}) => callback());
  video.onplaying();
  video.ontimeupdate();
  assert.equal(playCalls, 1);
  assert.equal(video.muted, false);
  assert.equal(video.volume, 1);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 4000);
  video.currentTime = 2;
  timers[0].callback();
  assert.ok(prompts.some((value) => value.includes('zns-embedded-playing')));
  const progression = prompts.find((value) => value.includes('zns-video-time-advanced'));
  assert.ok(progression);
  assert.match(progression, /"sampleWindowMs":4000/);
  assert.match(progression, /https:\/\/player\.streamcomedia\.com\/HTML5\/znstv/);
  assert.doesNotMatch(progression, /token|private|currentTime|"start"|"end"/);
});

test('the embedded player helper does not run without the official site referrer', () => {
  const timers = [];
  runInNewContext(helperSource, {
    URL,
    window: {location: {href: 'https://player.streamcomedia.com/HTML5/znstv'}, top: {}},
    document: {referrer: 'https://untrusted.example/'},
    setTimeout(callback) { timers.push(callback); },
  });
  assert.equal(timers.length, 0);
});

test('Kotlin permission and native-promotion boundaries stay scoped to the official ZNS routes', () => {
  const activity = readFileSync(resolve(process.cwd(), '../../app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt'), 'utf8');
  const manifest = JSON.parse(readFileSync(resolve(assets, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.content_scripts[0].js, ['candidate-ranking.js', 'content.js', 'zns-streamcomedia-helper.js']);
  assert.match(activity, /private fun isZnsTvSiteUrl[\s\S]*?host == "znsbahamas\.com" && path == "\/"/);
  assert.match(activity, /private fun isZnsStreamcomediaEmbedUrl[\s\S]*?host == "player\.streamcomedia\.com" && path == "\/html5\/znstv"/);
  assert.match(activity, /val znsAutoplayScoped = znsTopContext[\s\S]*?znsAutoplayScoped -> GeckoSession\.PermissionDelegate\.ContentPermission\.VALUE_ALLOW/);
  assert.match(activity, /zns helper phase=\$phase mode=browser-first/);
  assert.match(activity, /zns browser-first candidate ignored/);
  assert.match(activity, /isZnsTvSiteUrl\(currentUrl\) \|\| isZnsStreamcomediaEmbedUrl\(currentUrl\)/);
});
