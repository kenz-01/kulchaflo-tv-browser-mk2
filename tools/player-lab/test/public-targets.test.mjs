import test from 'node:test';
import assert from 'node:assert/strict';
import { getPublicTargetPolicy, loadPublicTargets, validatePublicTargetsRegistry } from '../src/public-targets.mjs';

test('public target registry loads valid cvm-tv entry', () => {
  const registry = loadPublicTargets();
  const target = registry.targets['cvm-tv'];
  assert.equal(target.providerId, 'cvm-tv');
  assert.equal(target.initialUrl, 'https://www.cvmtv.com/live');
  assert.deepEqual(target.allowedMainFrameHosts, ['www.cvmtv.com', 'cvmtv.com']);
  assert.equal(target.requiredProtocol, 'https:');
  assert.equal(target.defaultProfileId, 'sony-bravia');
  assert.deepEqual(getPublicTargetPolicy('cvm-tv'), {
    mode: 'registered-public-target',
    targetId: 'cvm-tv',
    providerId: 'cvm-tv',
    initialUrl: 'https://www.cvmtv.com/live',
    allowedMainFrameHosts: ['www.cvmtv.com', 'cvmtv.com'],
    requiredProtocol: 'https:',
    defaultProfileId: 'sony-bravia',
  });
});

test('public target registry loads bounded mtm-tv entry without player assumptions', () => {
  const registry = loadPublicTargets();
  const target = registry.targets['mtm-tv'];
  assert.equal(target.providerId, 'mtm-tv');
  assert.equal(target.initialUrl, 'https://www.mercyandtruth.tv/watch/?utm_source=KulchaFlo');
  assert.deepEqual(target.allowedMainFrameHosts, ['mercyandtruth.tv', 'www.mercyandtruth.tv']);
  assert.equal(target.requiredProtocol, 'https:');
  assert.equal(target.defaultProfileId, 'sony-bravia');
  assert.deepEqual(getPublicTargetPolicy('mtm-tv'), {
    mode: 'registered-public-target',
    targetId: 'mtm-tv',
    providerId: 'mtm-tv',
    initialUrl: 'https://www.mercyandtruth.tv/watch/?utm_source=KulchaFlo',
    allowedMainFrameHosts: ['mercyandtruth.tv', 'www.mercyandtruth.tv'],
    requiredProtocol: 'https:',
    defaultProfileId: 'sony-bravia',
  });
});

test('public target registry rejects malformed target configurations', () => {
  assert.throws(() => validatePublicTargetsRegistry(registryWith({ initialUrl: 'not a url' })), /malformed initial URL/);
  assert.throws(() => validatePublicTargetsRegistry(registryWith({ initialUrl: 'http://www.cvmtv.com/live' })), /HTTPS/);
  assert.throws(() => validatePublicTargetsRegistry(registryWith({ initialUrl: 'https://user:pass@www.cvmtv.com/live' })), /credentials/);
  assert.throws(() => validatePublicTargetsRegistry(registryWith({ initialUrl: 'https://www.cvmtv.com/live?token=secret' })), /query or fragment/);
  assert.throws(() => validatePublicTargetsRegistry(registryWith({ initialUrl: 'https://www.cvmtv.com/live#frag' })), /query or fragment/);
  assert.throws(() => validatePublicTargetsRegistry(registryWith({ initialUrl: 'https://www.cvmtv.com/live?utm_source=Other' })), /query or fragment/);
  assert.throws(() => validatePublicTargetsRegistry(registryWith({ initialUrl: 'https://www.cvmtv.com/live?utm_source=KulchaFlo&extra=value' })), /query or fragment/);
  assert.throws(() => validatePublicTargetsRegistry(registryWith({ allowedMainFrameHosts: ['*.cvmtv.com'] })), /wildcard/);
  assert.throws(() => validatePublicTargetsRegistry(registryWith({ allowedMainFrameHosts: ['CVMtv.com'] })), /lowercase/);
  assert.throws(() => validatePublicTargetsRegistry(registryWith({ allowedMainFrameHosts: ['127.0.0.1'] })), /IP hosts/);
  assert.throws(() => validatePublicTargetsRegistry(registryWith({}, '../bad')), /Unsafe provider id|Invalid provider id/);
  assert.throws(() => validatePublicTargetsRegistry(registryWith({ providerId: '../bad' })), /Unsafe provider id|Invalid provider id/);
  assert.throws(() => validatePublicTargetsRegistry(registryWith({ allowedMainFrameHosts: ['www.cvmtv.com', 'www.cvmtv.com'] })), /duplicate allowed host/);
  assert.throws(() => validatePublicTargetsRegistry({ version: 2, targets: {} }), /unsupported version/);
  assert.throws(() => validatePublicTargetsRegistry({ version: 1, targets: [] }), /targets object/);
});

test('unknown public target is rejected', () => {
  assert.throws(() => getPublicTargetPolicy('missing-target'), /Unknown public target/);
  const registry = validatePublicTargetsRegistry(baseRegistry());
  assert.equal(registry.targets['cvm-tv'].providerId, 'cvm-tv');
});

function registryWith(overrides = {}, id = 'cvm-tv') {
  return {
    version: 1,
    targets: {
      [id]: {
        providerId: 'cvm-tv',
        initialUrl: 'https://www.cvmtv.com/live',
        allowedMainFrameHosts: ['www.cvmtv.com', 'cvmtv.com'],
        requiredProtocol: 'https:',
        defaultProfileId: 'sony-bravia',
        ...overrides,
      },
    },
  };
}

function baseRegistry() {
  return registryWith();
}
