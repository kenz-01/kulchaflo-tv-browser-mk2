import test from 'node:test';
import assert from 'node:assert/strict';
import { profileUrl } from '../src/profile-url.mjs';
import { validateCheckpoint3bUrl } from '../src/url-policy.mjs';

test('URL policy accepts localhost, IPv4 loopback, IPv6 loopback and HTTPS loopback', () => {
  assert.equal(validateCheckpoint3bUrl('http://localhost:3000/a?token=secret#frag').hostname, 'localhost');
  assert.equal(validateCheckpoint3bUrl('http://127.0.0.1:3000/a').hostname, '127.0.0.1');
  assert.ok(['[::1]', '::1'].includes(validateCheckpoint3bUrl('http://[::1]:3000/a').hostname));
  assert.equal(validateCheckpoint3bUrl('https://localhost/a').protocol, 'https:');
});

test('URL policy rejects public hosts with checkpoint message and redaction', () => {
  assert.throws(
    () => validateCheckpoint3bUrl('https://198.51.100.10/watch?token=secret#frag'),
    /Public-site profiling is not enabled in Checkpoint 3B\. URL: https:\/\/198\.51\.100\.10\/watch/,
  );
});

test('URL policy rejects embedded credentials', () => {
  assert.throws(() => validateCheckpoint3bUrl('http://user:pass@localhost/watch?token=secret#frag'), /embedded credentials/);
});

test('URL policy rejects unsupported schemes', () => {
  for (const value of ['file:///tmp/a.html', 'data:text/html,hi', 'javascript:alert(1)', 'blob:https://localhost/id', 'chrome://version']) {
    assert.throws(() => validateCheckpoint3bUrl(value), /unsupported protocol|malformed URL/);
  }
});

test('URL policy rejects malformed URLs', () => {
  assert.throws(() => validateCheckpoint3bUrl('not a url'), /malformed URL/);
});

test('URL policy rejection occurs before browser launch', async () => {
  let launchCount = 0;
  await assert.rejects(() => profileUrl({
    url: 'https://198.51.100.10/watch?token=secret#frag',
    providerId: 'local-fixture',
    launchBrowserContext: async () => {
      launchCount += 1;
      throw new Error('should not launch');
    },
  }), /Public-site profiling is not enabled in Checkpoint 3B/);
  assert.equal(launchCount, 0);
});
