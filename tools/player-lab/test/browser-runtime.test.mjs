import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contextOptionsForProfile,
  getBrowserProfile,
  loadBrowserProfiles,
  missingBrowserError,
  MISSING_CHROMIUM_COMMAND,
} from '../src/browser-runtime.mjs';

test('browser profiles load with default desktop and sony bravia entries', () => {
  const profiles = loadBrowserProfiles();
  assert.ok(profiles['desktop-firefox']);
  assert.ok(profiles['sony-bravia']);
  assert.equal(getBrowserProfile().id, 'desktop-firefox');
  assert.match(getBrowserProfile('sony-bravia').userAgent, /BRAVIA|SonyCEBrowser/);
});

test('missing browser executable error is actionable', () => {
  assert.match(missingBrowserError().message, /No usable Chromium browser executable/);
  assert.match(missingBrowserError().message, new RegExp(MISSING_CHROMIUM_COMMAND.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('fresh context options use profile viewport, user agent and no storage state', () => {
  const { profile, contextOptions, warnings } = contextOptionsForProfile('sony-bravia');
  assert.equal(profile.id, 'sony-bravia');
  assert.equal(contextOptions.acceptDownloads, false);
  assert.deepEqual(contextOptions.viewport, { width: 1920, height: 1080 });
  assert.equal(contextOptions.userAgent, profile.userAgent);
  assert.equal(Object.hasOwn(contextOptions, 'storageState'), false);
  assert.match(warnings.join(' '), /does not reproduce GeckoView/);
  assert.match(warnings.join(' '), /physical Sony Bravia/);
});
