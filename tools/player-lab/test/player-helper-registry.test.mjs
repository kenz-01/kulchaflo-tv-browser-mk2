import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const contentPath = new URL('../../../app-gv/src/main/assets/gv_media_observer/content.js', import.meta.url);
const content = readFileSync(contentPath, 'utf8');
const registryStart = content.indexOf('const PLAYER_HELPER_REGISTRY');
const stateStart = content.indexOf('let transportAutohideEngine = null;');
const engineStart = content.indexOf('function matchesExactOrSubdomain');
const engineEnd = content.indexOf('function islandTvLog');
const registry = content.slice(registryStart, stateStart);
const engine = content.slice(engineStart, engineEnd);
const registryAndEngine = registry + engine;

test('CVM embedded Vimeo registry policy uses exact trusted frame and referrer signals', () => {
  assert.match(registryAndEngine, /id: "cvm-tv-embedded-vimeo"/);
  assert.match(registryAndEngine, /frameHost: "vimeo\.com"/);
  assert.match(registryAndEngine, /pathPrefix: "\/event\/"/);
  assert.match(registryAndEngine, /pathSuffix: "\/embed"/);
  assert.match(registryAndEngine, /referrerHosts: Object\.freeze\(\["cvmtv\.com", "www\.cvmtv\.com"\]\)/);
  assert.match(registryAndEngine, /hostnameFromUrl\(document\.referrer\)/);
  assert.match(registryAndEngine, /match\.referrerHosts\.indexOf\(referrerHost\) >= 0/);
  assert.match(registryAndEngine, /matchesExactOrSubdomain\(frameHost, match\.frameHost, match\.allowFrameSubdomains\)/);
});

test('registry engine installs nothing for non-matches or a disabled capability', () => {
  assert.match(registryAndEngine, /if \(!policy\) return false;/);
  assert.match(registryAndEngine, /if \(!capability \|\| !capability\.enabled \|\| transportAutohideEngine\) return false;/);
  assert.match(registryAndEngine, /return PLAYER_HELPER_REGISTRY\.find\(\(policy\) => matchesPlayerHelperPolicy\(policy\)\) \|\| null;/);
});

test('transport-autohide registry configuration contains only approved Vimeo chrome selectors', () => {
  const selectors = [...registryAndEngine.matchAll(/selectors: Object\.freeze\(\[([^\]]+)\]\)/g)]
    .flatMap((match) => [...match[1].matchAll(/"([^"]+)"/g)].map((selector) => selector[1]));
  assert.deepEqual(selectors, ['.vp-controls', '.vp-sidedock', '.vp-title']);
  for (const forbidden of [
    "[class*='control-bar']", "[class*='ControlBar']", "[class*='controls']",
    "[class*='Controls']", '[data-control-bar]', '.vp-player-ui-overlays',
  ]) {
    assert.equal(registryAndEngine.includes(forbidden), false, `forbidden selector: ${forbidden}`);
  }
});

test('transport-autohide engine owns one timer, is idempotent, reschedules, and cleans up on pagehide', () => {
  assert.match(content, /let transportAutohideEngine = null;/);
  assert.match(engine, /const engine = \{\s*timer: null,/);
  assert.match(engine, /if \(engine\.timer\) \{\s*clearTimeout\(engine\.timer\);\s*engine\.timer = null;/);
  assert.match(engine, /engine\.timer = setTimeout\(\(\) => setIdle\(reason\), capability\.idleMs\);/);
  assert.match(engine, /window\.addEventListener\("pagehide", \(\) => \{/);
  assert.match(engine, /TRANSPORT_AUTOHIDE_INTERACTION_EVENTS\.forEach/);
  assert.match(engine, /root\.classList\.remove\(capability\.idleClass\)/);
});

test('transport-autohide diagnostics are bounded and the new engine adds no playback or input interception', () => {
  for (const required of ['policyId: policy.id', 'capability: "transport-autohide"', 'phase', 'reason', 'delayMs']) {
    assert.ok(registryAndEngine.includes(required), `missing diagnostic field: ${required}`);
  }
  for (const forbidden of [
    'pageUrl', 'window.location.href', 'currentSrc', 'play(', 'pause(', 'requestFullscreen',
    'preventDefault', 'stopPropagation', 'stopImmediatePropagation', 'muted =', 'volume =',
    'currentTime =', 'src =', 'HLS', 'hls', 'native media promotion',
  ]) {
    assert.equal(engine.includes(forbidden), false, `forbidden engine behavior: ${forbidden}`);
  }
});
