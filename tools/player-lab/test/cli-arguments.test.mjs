import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCliArguments, USAGE_TEXT } from '../src/cli-arguments.mjs';

test('CLI parser accepts a complete invocation', () => {
  const args = parseCliArguments([
    '--url', 'http://127.0.0.1:3000/?token=secret#frag',
    '--provider-id', 'local-fixture',
    '--profile', 'sony-bravia',
    '--observe-ms', '3500',
    '--navigation-timeout-ms', '12000',
    '--output-root', '/tmp/player-lab',
  ]);
  assert.equal(args.url, 'http://127.0.0.1:3000/?token=secret#frag');
  assert.equal(args.providerId, 'local-fixture');
  assert.equal(args.profileId, 'sony-bravia');
  assert.equal(args.observationMs, 3500);
  assert.equal(args.navigationTimeoutMs, 12000);
  assert.equal(args.outputRoot, '/tmp/player-lab');
});

test('CLI parser applies defaults', () => {
  const args = parseCliArguments(['--url', 'http://localhost:3000/', '--provider-id', 'local-fixture']);
  assert.equal(args.profileId, 'desktop-firefox');
  assert.equal(args.observationMs, 3000);
  assert.equal(args.navigationTimeoutMs, 10000);
  assert.equal(args.outputRoot, undefined);
});

test('CLI parser supports help without required arguments', () => {
  const args = parseCliArguments(['--help']);
  assert.equal(args.help, true);
  assert.match(USAGE_TEXT, /--url <URL>/);
  assert.match(USAGE_TEXT, /--target <target-id>/);
  assert.match(USAGE_TEXT, /Registered public target/);
});

test('CLI parser rejects unknown arguments', () => {
  assert.throws(() => parseCliArguments(['--wat']), /Unknown argument/);
});

test('CLI parser rejects missing values', () => {
  assert.throws(() => parseCliArguments(['--url']), /Missing value/);
  assert.throws(() => parseCliArguments(['--url', '--provider-id']), /Missing value/);
});

test('CLI parser rejects duplicate singleton arguments', () => {
  assert.throws(() => parseCliArguments([
    '--url', 'http://localhost/',
    '--url', 'http://127.0.0.1/',
    '--provider-id', 'local-fixture',
  ]), /Duplicate argument/);
});

test('CLI parser rejects invalid integer bounds', () => {
  assert.throws(() => parseCliArguments(['--url', 'http://localhost/', '--provider-id', 'local-fixture', '--observe-ms', 'abc']), /Invalid integer/);
  assert.throws(() => parseCliArguments(['--url', 'http://localhost/', '--provider-id', 'local-fixture', '--observe-ms', '1']), /Invalid integer bounds/);
});

test('CLI parser rejects invalid profile', () => {
  assert.throws(() => parseCliArguments(['--url', 'http://localhost/', '--provider-id', 'local-fixture', '--profile', 'firefox']), /Unknown browser profile/);
});

test('CLI parser rejects missing required URL and provider id', () => {
  assert.throws(() => parseCliArguments(['--provider-id', 'local-fixture']), /--url/);
  assert.throws(() => parseCliArguments(['--url', 'http://localhost/']), /--provider-id/);
});

test('CLI parser accepts registered target invocation', () => {
  const args = parseCliArguments(['--target', 'cvm-tv']);
  assert.equal(args.targetId, 'cvm-tv');
  assert.equal(args.providerId, undefined);
  assert.equal(args.profileId, 'desktop-firefox');
  assert.equal(args.profileExplicit, false);
});

test('CLI parser accepts explicit target profile override', () => {
  const args = parseCliArguments(['--target', 'cvm-tv', '--profile', 'desktop-firefox']);
  assert.equal(args.targetId, 'cvm-tv');
  assert.equal(args.profileId, 'desktop-firefox');
  assert.equal(args.profileExplicit, true);
});

test('CLI parser rejects mutually exclusive target combinations', () => {
  assert.throws(() => parseCliArguments(['--target', 'cvm-tv', '--url', 'http://localhost/']), /mutually exclusive/);
  assert.throws(() => parseCliArguments(['--target', 'cvm-tv', '--provider-id', 'cvm-tv']), /not allowed with --target/);
});
