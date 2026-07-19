import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startFixtureServer } from '../fixtures/server.mjs';

test('fixture server selects an automatic localhost port and serves top page', async () => {
  const fixture = await startFixtureServer();
  try {
    assert.ok(fixture.port > 0);
    assert.match(fixture.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
    const response = await fetch(`${fixture.origin}/`);
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(body, /<title>Player Lab Fixture<\/title>/);
    assert.match(body, /nested-frame\.html\?token=frame-secret#frame-fragment/);
  } finally {
    await fixture.close();
  }
});

test('fixture server serves nested iframe response and content types', async () => {
  const fixture = await startFixtureServer();
  try {
    const nested = await fetch(`${fixture.origin}/nested-frame.html?token=test#fragment`);
    assert.equal(nested.status, 200);
    assert.match(nested.headers.get('content-type'), /text\/html/);
    const nestedBody = await nested.text();
    assert.match(nestedBody, /Nested Fixture Player/);
    assert.match(nestedBody, /data-source-change-delay-ms="750"/);
    assert.match(nestedBody, /data-replacement-delay-ms="1500"/);
    assert.match(nestedBody, /sourceChangeDelayMs: 750/);
    assert.match(nestedBody, /replacementDelayMs: 1500/);

    const script = await fetch(`${fixture.origin}/mock-player.js`);
    assert.equal(script.status, 200);
    assert.match(script.headers.get('content-type'), /text\/javascript/);

    const media = await fetch(`${fixture.origin}/sample-media.mp4`);
    assert.equal(media.status, 200);
    assert.match(media.headers.get('content-type'), /video\/mp4/);
  } finally {
    await fixture.close();
  }
});

test('fixture server returns 400 for malformed paths and remains operational', async () => {
  const fixture = await startFixtureServer();
  try {
    const malformed = await fetch(`${fixture.origin}/%E0%A4%A`);
    assert.equal(malformed.status, 400);
    assert.match(malformed.headers.get('content-type'), /text\/plain/);
    assert.match(await malformed.text(), /Bad request/);

    const index = await fetch(`${fixture.origin}/`);
    assert.equal(index.status, 200);
    assert.match(await index.text(), /Player Lab Fixture/);
  } finally {
    await fixture.close();
  }
});

test('fixture server rejects traversal attempts', async () => {
  const fixture = await startFixtureServer();
  try {
    const response = await fetch(`${fixture.origin}/..%2Fpackage.json`);
    assert.equal(response.status, 403);
  } finally {
    await fixture.close();
  }
});

test('fixture server closes cleanly', async () => {
  const fixture = await startFixtureServer();
  const response = await fetch(`${fixture.origin}/`);
  assert.equal(response.status, 200);
  await fixture.close();
  await assert.rejects(() => fetch(`${fixture.origin}/`));
});

test('sample media is a valid MP4 fixture, not the old text placeholder', () => {
  const mediaPath = fileURLToPath(new URL('../fixtures/sample-media.mp4', import.meta.url));
  const media = readFileSync(mediaPath);
  assert.ok(media.length > 32);
  assert.equal(media.subarray(4, 8).toString('ascii'), 'ftyp');
  assert.doesNotMatch(media.toString('utf8', 0, Math.min(media.length, 120)), /fixture media placeholder/);
});
