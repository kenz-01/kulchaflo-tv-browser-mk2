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
    attrs: {src: 'https://player.streamcomedia.com/HTML5/znstv/?session=private', allow: 'fullscreen; picture-in-picture'},
    getAttribute(key) { return this.attrs[key] || null; },
    setAttribute(key, value) { this.attrs[key] = value; },
    addEventListener(name, callback) { this[`on${name}`] = callback; },
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
  frame.onload();

  assert.deepEqual(timers.map(({delay}) => delay), [300, 900, 2000, 4000, 7000, 11000, 18000]);
  assert.equal(frame.attrs.allowfullscreen, 'true');
  assert.equal(frame.attrs.allow, 'fullscreen; picture-in-picture');
  assert.equal(promptEvents.length, 3);
  assert.match(promptEvents[0], /zns-outer-frame-load-watch-attached/);
  assert.match(promptEvents[1], /zns-outer-player-first/);
  assert.match(promptEvents[2], /zns-outer-frame-load-observed/);
  assert.match(promptEvents[0], /https:\/\/znsbahamas\.com\//);
  assert.doesNotMatch(promptEvents.join('\n'), /secret|private|fragment/);
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

test('loading the trusted embed preserves mute and volume and never calls play', () => {
  for (const [muted, volume] of [[true, 0], [false, 0.35]]) {
    const timers = [];
    let playCalls = 0;
    const video = {
      readyState: 4,
      paused: true,
      muted,
      volume,
      currentTime: 1,
      addEventListener() {},
      getBoundingClientRect() { return {width: 900, height: 500}; },
      play() { playCalls += 1; return {catch() {}}; },
    };
    const window = {location: {href: 'https://player.streamcomedia.com/HTML5/znstv/'}, top: {}, prompt() {}};
    runInNewContext(helperSource, {
      URL,
      window,
      document: {
        referrer: 'https://znsbahamas.com/',
        querySelectorAll(selector) { return selector === 'video' ? [video] : []; },
      },
      setTimeout(callback, delay) { timers.push({callback, delay}); },
    });
    timers.forEach(({callback}) => callback());

    assert.equal(playCalls, 0);
    assert.equal(video.paused, true);
    assert.equal(video.muted, muted);
    assert.equal(video.volume, volume);
  }
});

test('trusted player state and bounded time progression are reported without audio changes', () => {
  const timers = [];
  const prompts = [];
  let playCalls = 0;
  const video = {
    readyState: 4,
    networkState: 2,
    error: null,
    paused: true,
    muted: true,
    volume: 0.35,
    currentSrc: 'https://cdn.invalid/live.m3u8?token=private',
    autoplay: true,
    controls: false,
    currentTime: 1,
    addEventListener(name, callback) { this[`on${name}`] = callback; },
    querySelector() { return null; },
    getBoundingClientRect() { return {width: 900, height: 500}; },
    play() { playCalls += 1; return {catch() {}}; },
  };
  const window = {
    location: {href: 'https://player.streamcomedia.com/HTML5/znstv/?token=private'},
    top: {},
    prompt(value) { prompts.push(value); },
    getComputedStyle() { return {display: 'block', visibility: 'visible', opacity: '1'}; },
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
  const retries = timers.splice(0).filter(({delay}) => delay <= 18000);
  assert.deepEqual(retries.map(({delay}) => delay), [300, 900, 2000, 4000, 7000, 11000, 18000]);
  retries.forEach(({callback}) => callback());
  assert.ok(prompts.some((value) => value.includes('zns-embedded-helper-active')));
  assert.equal(playCalls, 0);
  assert.equal(video.paused, true);
  assert.equal(video.muted, true);
  assert.equal(video.volume, 0.35);
  const observed = prompts.find((value) => value.includes('zns-embedded-observed'));
  assert.ok(observed);
  assert.match(observed, /"paused":true/);
  assert.match(observed, /"muted":true/);
  assert.match(observed, /"volume":0\.35/);
  assert.match(observed, /"networkState":2/);
  assert.match(observed, /"mediaErrorCode":0/);
  assert.match(observed, /"sourcePresent":true/);
  assert.match(observed, /"rendered":"yes"/);
  assert.match(observed, /"autoplay":true/);
  assert.doesNotMatch(observed, /cdn\.invalid|token|private/);

  // Simulate site-owned playback events; the helper only observes them.
  video.paused = false;
  video.onplaying();
  video.onwaiting();
  video.onwaiting();
  video.ontimeupdate();
  assert.equal(playCalls, 0);
  assert.equal(video.muted, true);
  assert.equal(video.volume, 0.35);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 4000);
  video.currentTime = 2;
  timers[0].callback();
  assert.ok(prompts.some((value) => value.includes('zns-embedded-playing')));
  assert.ok(prompts.some((value) => value.includes('"event":"waiting"')));
  assert.equal(prompts.filter((value) => value.includes('"event":"waiting"')).length, 1);
  const progression = prompts.find((value) => value.includes('zns-video-time-advanced'));
  assert.ok(progression);
  assert.match(progression, /"sampleWindowMs":4000/);
  assert.match(progression, /https:\/\/player\.streamcomedia\.com\/HTML5\/znstv/);
  assert.doesNotMatch(progression, /token|private|currentTime|"start"|"end"/);
});

test('ZNS mute transitions report before/after state and recent trusted input without changing playback', () => {
  const timers = [];
  const prompts = [];
  const documentListeners = {};
  let now = 1000;
  let muted = false;
  let mutedWrites = 0;
  let playCalls = 0;
  const video = {
    readyState: 3,
    networkState: 2,
    error: null,
    paused: true,
    get muted() { return muted; },
    set muted(value) { muted = value; mutedWrites += 1; },
    volume: 1,
    currentSrc: 'https://cdn.example.invalid/opaque-id',
    autoplay: false,
    controls: true,
    currentTime: 0,
    addEventListener(name, callback) { this[`on${name}`] = callback; },
    querySelector() { return null; },
    getBoundingClientRect() { return {width: 900, height: 500}; },
    play() { playCalls += 1; return Promise.resolve(); },
  };
  const window = {
    location: {href: 'https://player.streamcomedia.com/HTML5/znstv?secret=private'},
    top: {},
    prompt(value) { prompts.push(value); },
    getComputedStyle() { return {display: 'block', visibility: 'visible', opacity: '1'}; },
  };
  const document = {
    referrer: 'https://znsbahamas.com/',
    addEventListener(name, callback) { documentListeners[name] = callback; },
    querySelectorAll(selector) { return selector === 'video' ? [video] : []; },
  };
  runInNewContext(helperSource, {
    URL,
    Date: {now: () => now},
    window,
    document,
    setTimeout(callback, delay) { timers.push({callback, delay}); },
  });
  timers.splice(0).forEach(({callback}) => callback());

  documentListeners.click({isTrusted: true});
  now += 150;
  video.muted = true; // Simulated player-owned change.
  const writesAfterPlayerChange = mutedWrites;
  video.onvolumechange({isTrusted: true});
  assert.equal(mutedWrites, writesAfterPlayerChange);
  video.onplay();

  documentListeners.pointerup({isTrusted: true});
  now += 100;
  video.muted = false; // Simulated explicit user unmute retained by the player.
  const writesAfterUserChange = mutedWrites;
  video.onvolumechange({isTrusted: true});
  assert.equal(mutedWrites, writesAfterUserChange);
  video.paused = false;
  video.onplaying();

  const events = prompts.map((value) => JSON.parse(value.slice('__GV_MEDIA__'.length)));
  const transitions = events.filter((event) => event.phase === 'zns-audio-state');
  assert.deepEqual(transitions.map(({mutedBefore, mutedAfter}) => [mutedBefore, mutedAfter]), [
    [false, true],
    [true, false],
  ]);
  assert.equal(transitions[0].recentTrustedInput, 'click');
  assert.equal(transitions[0].recentTrustedInputAgeMs, 150);
  assert.equal(transitions[1].recentTrustedInput, 'pointerup');
  assert.equal(transitions[1].recentTrustedInputAgeMs, 100);
  const playing = events.find((event) => event.phase === 'zns-embedded-playing');
  assert.ok(playing);
  assert.equal(playing.muted, false);
  assert.equal(playCalls, 0);
  assert.doesNotMatch(prompts.join('\n'), /opaque-id|secret|private/);
});

test('late ZNS video insertion is observed by a bounded DOM watcher with helper-relative timing', () => {
  const timers = [];
  const prompts = [];
  let now = 1000;
  let videos = [];
  let mutationCallback;
  let observedOptions;
  let disconnected = false;
  class FakeMutationObserver {
    constructor(callback) { mutationCallback = callback; }
    observe(_target, options) { observedOptions = options; }
    disconnect() { disconnected = true; }
  }
  const document = {
    referrer: 'https://znsbahamas.com/',
    documentElement: {},
    addEventListener() {},
    querySelectorAll(selector) { return selector === 'video' ? videos : []; },
  };
  const window = {
    location: {href: 'https://player.streamcomedia.com/HTML5/znstv/'},
    top: {},
    prompt(value) { prompts.push(JSON.parse(value.slice('__GV_MEDIA__'.length))); },
    getComputedStyle() { return {display: 'block', visibility: 'visible', opacity: '1'}; },
  };
  runInNewContext(helperSource, {
    URL,
    Date: {now: () => now},
    MutationObserver: FakeMutationObserver,
    window,
    document,
    setTimeout(callback, delay) { timers.push({callback, delay}); },
  });

  assert.equal(JSON.stringify(observedOptions), JSON.stringify({
    attributes: true,
    attributeFilter: ['class', 'hidden', 'src', 'style'],
    childList: true,
    subtree: true,
  }));
  assert.ok(prompts.some(({phase, initialVideoCount}) => phase === 'zns-embedded-helper-active' && initialVideoCount === 0));

  now += 39000;
  const video = {
    readyState: 1,
    networkState: 2,
    error: null,
    paused: true,
    muted: true,
    volume: 1,
    currentSrc: '',
    autoplay: false,
    controls: true,
    currentTime: 0,
    addEventListener(name, callback) { this[`on${name}`] = callback; },
    querySelector() { return null; },
    matches(selector) { return selector === 'video'; },
    getBoundingClientRect() { return {width: 900, height: 500}; },
  };
  videos = [video];
  mutationCallback([{type: 'childList', addedNodes: [video]}]);

  const discovery = prompts.find(({phase}) => phase === 'zns-video-discovery');
  assert.deepEqual(
    {age: discovery.helperAgeMs, count: discovery.videoCount, visible: discovery.visibleVideoCount, trigger: discovery.trigger},
    {age: 39000, count: 1, visible: 1, trigger: 'video_inserted'},
  );
  const observed = prompts.find(({phase}) => phase === 'zns-embedded-observed');
  assert.equal(observed.helperAgeMs, 39000);
  assert.equal(observed.discoveryTrigger, 'mutation');
  assert.equal(observed.autoplay, false);
  assert.equal(video.muted, true);
  assert.equal(video.volume, 1);
  assert.equal(disconnected, false);
  assert.equal(timers.find(({delay}) => delay === 60000) !== undefined, true);
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
  const genericObserver = manifest.content_scripts.find((entry) => entry.matches.includes('<all_urls>'));
  assert.deepEqual(genericObserver.js, ['candidate-ranking.js', 'content.js', 'zns-streamcomedia-helper.js']);
  assert.match(activity, /private fun isZnsTvSiteUrl[\s\S]*?host == "znsbahamas\.com" && path == "\/"/);
  assert.match(activity, /private fun isZnsStreamcomediaEmbedUrl[\s\S]*?host == "player\.streamcomedia\.com" && path == "\/html5\/znstv"/);
  assert.match(activity, /private const val ENABLE_ZNS_AUTOPLAY_PERMISSION_ALLOW = true/);
  assert.match(activity, /private fun isZnsTvPermissionOriginUrl[\s\S]*?removePrefix\("www\."\) == "znsbahamas\.com"/);
  assert.match(activity, /val znsTopContext = isZnsTvSiteUrl\(activeSessionUrl\)/);
  assert.match(activity, /val znsPermissionOrigin = listOf\(permission\.uri\.orEmpty\(\), permission\.thirdPartyOrigin\.orEmpty\(\)\)[\s\S]*?isZnsTvPermissionOriginUrl\(origin\) -> "publisher"[\s\S]*?isZnsStreamcomediaEmbedUrl\(origin\) -> "streamcomedia"/);
  assert.match(activity, /val znsPermissionContext = znsPermissionOrigin != null/);
  assert.match(activity, /val znsAutoplayScoped = ENABLE_ZNS_AUTOPLAY_PERMISSION_ALLOW &&[\s\S]*?autoplayPermissionRequest && znsTopContext && znsPermissionContext/);
  assert.match(activity, /znsAutoplayScoped -> GeckoSession\.PermissionDelegate\.ContentPermission\.VALUE_ALLOW/);
  assert.doesNotMatch(helperSource, /video\.muted\s*=|video\.volume\s*=|video\.play\s*\(/);
  assert.match(helperSource, /addEventListener\("playing"/);
  assert.match(helperSource, /addEventListener\("volumechange"/);
  assert.match(helperSource, /recentTrustedInput/);
  assert.match(helperSource, /addEventListener\("timeupdate"/);
  const permissionDecision = activity.slice(
    activity.indexOf('val decision = when'),
    activity.indexOf('val tabId', activity.indexOf('val decision = when')),
  );
  assert.ok(permissionDecision.length > 0);
  assert.match(permissionDecision, /znsAutoplayScoped -> GeckoSession\.PermissionDelegate\.ContentPermission\.VALUE_ALLOW/);
  assert.match(permissionDecision, /else -> permission\.value/);
  assert.match(activity, /else -> permission\.value/);
  assert.match(activity, /if \(phase == "zns-audio-state"\)/);
  assert.match(activity, /zns audio state event=volumechange mutedBefore=/);
  assert.match(activity, /zns helper phase=\$phase mode=browser-first ready=\$readyState paused=\$paused muted=\$muted volume=\$volume/);
  assert.match(activity, /zns autoplay permission type=\$type requested=\$requested decision=\$decisionLabel " \+[\s\S]*?origin=\$\{znsPermissionOrigin \?: "other"\} scopeMatched=\$znsPermissionContext/);
  assert.match(activity, /zns video discovery phase=\$phase ageMs=\$helperAgeMs videoCount=\$videoCount/);
  assert.match(activity, /content permission tabId=\$tabId uriHost=\$\{uriHost \?: "unknown"\}/);
  assert.match(activity, /zns media event=\$mediaEvent/);
  assert.match(activity, /zns helper phase=\$phase mode=browser-first/);
  assert.match(activity, /zns-outer-frame-load-watch-attached/);
  assert.match(activity, /zns-outer-frame-load-observed/);
  assert.match(activity, /zns-embedded-helper-active/);
  assert.match(activity, /zns browser-first candidate ignored/);
  assert.match(activity, /isZnsTvSiteUrl\(currentUrl\) \|\| isZnsStreamcomediaEmbedUrl\(currentUrl\)/);
});

test('a stalled first progression sample can retry and remains bounded', () => {
  const timers = [];
  const prompts = [];
  const video = {
    readyState: 1,
    networkState: 2,
    error: null,
    paused: false,
    muted: false,
    volume: 1,
    currentSrc: '',
    autoplay: false,
    controls: true,
    currentTime: 0,
    addEventListener(name, callback) { this[`on${name}`] = callback; },
    querySelector() { return null; },
    getBoundingClientRect() { return {width: 900, height: 500}; },
  };
  const window = {
    location: {href: 'https://player.streamcomedia.com/HTML5/znstv'},
    top: {},
    prompt(value) { prompts.push(value); },
    getComputedStyle() { return {display: 'block', visibility: 'visible', opacity: '1'}; },
  };
  runInNewContext(helperSource, {
    URL,
    window,
    document: {
      referrer: 'https://znsbahamas.com/',
      querySelectorAll(selector) { return selector === 'video' ? [video] : []; },
    },
    setTimeout(callback, delay) { timers.push({callback, delay}); },
  });
  timers.splice(0).forEach(({callback}) => callback());
  video.ontimeupdate();
  assert.equal(timers.length, 1);
  timers.shift().callback(); // The initial four-second sample sees no movement.
  assert.equal(prompts.some((value) => value.includes('zns-video-time-advanced')), false);

  video.ontimeupdate();
  assert.equal(timers.length, 1);
  video.currentTime = 1;
  timers.shift().callback();
  assert.equal(prompts.filter((value) => value.includes('zns-video-time-advanced')).length, 1);

  video.ontimeupdate();
  assert.equal(timers.length, 0);
});
