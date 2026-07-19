import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyNetworkRecord, configuredNetworkSignatureTokens } from '../src/network-evidence.mjs';
import { loadPlayerSignatures } from '../src/load-player-signatures.mjs';

test('network player host and script recognition is derived from configured signatures', () => {
  const signatures = loadPlayerSignatures();
  const tokens = configuredNetworkSignatureTokens(signatures);
  for (const family of Object.values(signatures.families)) {
    for (const host of family.hostPatterns) {
      assert.ok(tokens.hostPatterns.includes(host));
    }
    for (const pattern of family.scriptPatterns) {
      assert.ok(tokens.scriptPatterns.includes(pattern));
    }
  }
});

test('network classification recognises representative configured player URLs', () => {
  const cases = [
    ['https://player.vimeo.com/api/player.js', 'player-script,known-player-or-cdn-host'],
    ['https://www.dailymotion.com/player/metadata/video/x1', 'document,known-player-or-cdn-host'],
    ['https://cdn.jwplayer.com/players/example.js', 'player-script,known-player-or-cdn-host'],
    ['https://player.tegotv.com/player.php', 'document,known-player-or-cdn-host'],
    ['https://novus.telearuba.aw/assets/novus.js', 'player-script,known-player-or-cdn-host'],
  ];
  for (const [url, expectedKind] of cases) {
    const record = classifyNetworkRecord({ url, resourceType: url.endsWith('.js') ? 'script' : 'document', method: 'GET' });
    assert.equal(record.kind, expectedKind);
  }
});

test('network classification distinguishes nested iframe document safely', () => {
  const record = classifyNetworkRecord({
    url: 'https://example.test/nested-frame.html?token=secret#frag',
    resourceType: 'document',
    method: 'GET',
    documentKind: 'iframe-document',
  });
  assert.equal(record.kind, 'iframe-document');
  assert.equal(record.documentKind, 'iframe-document');
  assert.equal(record.url, 'https://example.test/nested-frame.html');
});
