import test from 'node:test';
import assert from 'node:assert/strict';
import { redactUrl, validateProviderId } from '../src/redact-url.mjs';

test('redactUrl removes query strings and fragments', () => {
  const result = redactUrl('https://example.com/live/player.m3u8?token=secret#frag');
  assert.equal(result.url, 'https://example.com/live/player.m3u8');
  assert.equal(result.omitted, false);
});

test('redactUrl removes usernames and passwords', () => {
  const result = redactUrl('https://user:pass@example.com:8443/live/watch');
  assert.equal(result.url, 'https://example.com:8443/live/watch');
});

test('redactUrl preserves useful host, port and path', () => {
  const result = redactUrl('http://media.example.test:8080/channel/live/index.mpd?access_key=nope');
  assert.equal(result.url, 'http://media.example.test:8080/channel/live/index.mpd');
  assert.equal(result.hostname, 'media.example.test');
  assert.equal(result.path, '/channel/live/index.mpd');
});

test('redactUrl handles malformed and unsupported URLs safely', () => {
  assert.deepEqual(redactUrl('not a url'), { url: null, omitted: true, reason: 'malformed-url' });
  assert.deepEqual(redactUrl('file:///tmp/example'), { url: null, omitted: true, reason: 'unsupported-scheme' });
});

test('validateProviderId accepts safe lowercase ids', () => {
  for (const id of ['cvc9', 'player-lab', 'abc-123-live', 'a'.repeat(64)]) {
    assert.deepEqual(validateProviderId(id), { valid: true, reason: null });
  }
});

test('validateProviderId rejects unsafe ids', () => {
  const unsafe = ['', '../evil', 'evil/path', 'evil\\path', 'Upper', 'has space', 'semi;colon', 'under_score', 'a'.repeat(65)];
  for (const id of unsafe) {
    assert.equal(validateProviderId(id).valid, false, id);
  }
});
