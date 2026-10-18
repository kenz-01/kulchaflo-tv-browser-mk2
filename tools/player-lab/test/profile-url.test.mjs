import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MISSING_CHROMIUM_COMMAND, resolveChromiumRuntime } from '../src/browser-runtime.mjs';
import { profileUrl, validateMainFrameNavigationCandidate } from '../src/profile-url.mjs';
import { getPublicTargetPolicy, validatePublicTargetsRegistry } from '../src/public-targets.mjs';
import { startFixtureServer } from '../fixtures/server.mjs';

const runtime = resolveChromiumRuntime();
const skipReason = runtime ? false : `No usable Chromium executable. Run: ${MISSING_CHROMIUM_COMMAND}`;

test('generic profileUrl profiles local fixture and returns canonical report', { skip: skipReason }, async () => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'player-lab-profile-url-'));
  const fixture = await startFixtureServer();
  try {
    const result = await profileUrl({
      url: `${fixture.origin}/?token=cli-secret#cli-fragment`,
      providerId: 'local-fixture',
      outputRoot,
      observationMs: 3200,
    });
    const jsonText = readFileSync(result.jsonPath, 'utf8');
    const markdown = readFileSync(result.markdownPath, 'utf8');
    const parsed = JSON.parse(jsonText);

    assert.equal(existsSync(result.jsonPath), true);
    assert.equal(existsSync(result.markdownPath), true);
    assert.equal(existsSync(result.screenshotPath), true);
    assert.deepEqual(result.report, parsed);
    assert.equal(result.report.requestedUrl.includes('?'), false);
    assert.equal(result.report.finalUrl.includes('#'), false);
    assert.equal(result.report.frames.length, 2);
    assert.equal(result.report.mediaObservations.length, 3);
    assert.equal(result.report.candidateControls.length, 3);
    assert.deepEqual(result.interactionCounters, zeroCounters());
    assert.deepEqual(result.report.lifecycleEvidence.interactionCounters, zeroCounters());
    assert.deepEqual(result.browserRuntime, { type: result.browserRuntime.type });
    assert.equal(Object.hasOwn(result.browserRuntime, 'executablePath'), false);
    for (const text of [JSON.stringify(result.report), jsonText, markdown]) {
      assert.doesNotMatch(text, /cli-secret|cli-fragment|token=|\?token=|#cli-fragment/);
    }
  } finally {
    await fixture.close();
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('profileUrl closes page context and browser when report writing fails', async () => {
  const closed = { page: 0, context: 0, browser: 0 };
  const outputRoot = mkdtempSync(join(tmpdir(), 'player-lab-profile-url-'));
  try {
    await assert.rejects(() => profileUrl({
      url: 'http://localhost:1234/',
      providerId: 'local-fixture',
      outputRoot,
      launchBrowserContext: async () => ({
        runtime: { type: 'test' },
        profile: {
          id: 'desktop-firefox',
          userAgent: 'test-agent',
          viewport: { width: 1920, height: 1080 },
        },
        warnings: [],
        context: {
          newPage: async () => ({
            url: () => 'http://localhost:1234/',
            screenshot: async () => {},
            close: async () => { closed.page += 1; },
            on: () => {},
            off: () => {},
            mainFrame: () => ({}),
          }),
          close: async () => { closed.context += 1; },
        },
        browser: {
          close: async () => { closed.browser += 1; },
        },
      }),
      observePage: async () => sampleObservation(),
      writeJson: () => {
        throw new Error('write failed');
      },
    }), /write failed/);
    assert.equal(closed.page, 1);
    assert.equal(closed.context, 1);
    assert.equal(closed.browser, 1);
    assert.deepEqual(findRelativeFiles(outputRoot), []);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('profileUrl launch failure leaves no incomplete directory', async () => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'player-lab-profile-url-'));
  try {
    await assert.rejects(() => profileUrl({
      url: 'http://localhost:1234/',
      providerId: 'local-fixture',
      outputRoot,
      launchBrowserContext: async () => {
        throw new Error('launch failed');
      },
    }), /launch failed/);
    assert.deepEqual(findRelativeFiles(outputRoot), []);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('profileUrl screenshot failure leaves no incomplete directory', async () => {
  const closed = { page: 0, context: 0, browser: 0 };
  const outputRoot = mkdtempSync(join(tmpdir(), 'player-lab-profile-url-'));
  try {
    await assert.rejects(() => profileUrl({
      url: 'http://localhost:1234/',
      providerId: 'local-fixture',
      outputRoot,
      launchBrowserContext: async () => fakeLaunch(closed, {
        screenshot: async () => { throw new Error('screenshot failed'); },
      }),
      observePage: async () => sampleObservation(),
    }), /screenshot failed/);
    assert.equal(closed.page, 1);
    assert.equal(closed.context, 1);
    assert.equal(closed.browser, 1);
    assert.deepEqual(findRelativeFiles(outputRoot), []);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('profileUrl does not promote when JSON writer reports success without file', async () => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'player-lab-profile-url-'));
  const closed = { page: 0, context: 0, browser: 0 };
  try {
    await assert.rejects(() => profileUrl({
      url: 'http://localhost:1234/',
      providerId: 'local-fixture',
      outputRoot,
      launchBrowserContext: async () => fakeLaunch(closed, {
        screenshot: async ({ path }) => writeFileSync(path, 'png'),
      }),
      observePage: async () => sampleObservation(),
      writeJson: (_report, { outputDir }) => ({ filePath: join(outputDir, 'report.json') }),
      writeMarkdown: (_report, { outputDir }) => {
        const filePath = join(outputDir, 'report.md');
        writeFileSync(filePath, '# ok\n');
        return { filePath, markdown: '# ok\n' };
      },
    }), /Missing required profile artifact: report\.json/);
    assert.deepEqual(findRelativeFiles(outputRoot), []);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('profileUrl does not promote when Markdown writer reports success without file', async () => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'player-lab-profile-url-'));
  const closed = { page: 0, context: 0, browser: 0 };
  try {
    await assert.rejects(() => profileUrl({
      url: 'http://localhost:1234/',
      providerId: 'local-fixture',
      outputRoot,
      launchBrowserContext: async () => fakeLaunch(closed, {
        screenshot: async ({ path }) => writeFileSync(path, 'png'),
      }),
      observePage: async () => sampleObservation(),
      writeJson: (_report, { outputDir }) => {
        const filePath = join(outputDir, 'report.json');
        writeFileSync(filePath, '{}\n');
        return { filePath, json: '{}\n' };
      },
      writeMarkdown: (_report, { outputDir }) => ({ filePath: join(outputDir, 'report.md') }),
    }), /Missing required profile artifact: report\.md/);
    assert.deepEqual(findRelativeFiles(outputRoot), []);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('profileUrl does not promote when screenshot resolves without page.png', async () => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'player-lab-profile-url-'));
  const closed = { page: 0, context: 0, browser: 0 };
  try {
    await assert.rejects(() => profileUrl({
      url: 'http://localhost:1234/',
      providerId: 'local-fixture',
      outputRoot,
      launchBrowserContext: async () => fakeLaunch(closed),
      observePage: async () => sampleObservation(),
      writeJson: writeSmallJson,
      writeMarkdown: writeSmallMarkdown,
    }), /Missing required profile artifact: page\.png/);
    assert.deepEqual(findRelativeFiles(outputRoot), []);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('profileUrl rejects artifact directory before promotion', async () => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'player-lab-profile-url-'));
  const closed = { page: 0, context: 0, browser: 0 };
  try {
    await assert.rejects(() => profileUrl({
      url: 'http://localhost:1234/',
      providerId: 'local-fixture',
      outputRoot,
      launchBrowserContext: async () => fakeLaunch(closed, {
        screenshot: async ({ path }) => writeFileSync(path, 'png'),
      }),
      observePage: async () => sampleObservation(),
      writeJson: (_report, { outputDir }) => {
        const filePath = join(outputDir, 'report.json');
        mkdirSync(filePath);
        return { filePath };
      },
      writeMarkdown: writeSmallMarkdown,
    }), /Invalid required profile artifact: report\.json/);
    assert.deepEqual(findRelativeFiles(outputRoot), []);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('profileUrl rejects symbolic-link artifact before promotion when supported', async (t) => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'player-lab-profile-url-'));
  const closed = { page: 0, context: 0, browser: 0 };
  try {
    await assert.rejects(() => profileUrl({
      url: 'http://localhost:1234/',
      providerId: 'local-fixture',
      outputRoot,
      launchBrowserContext: async () => fakeLaunch(closed, {
        screenshot: async ({ path }) => writeFileSync(path, 'png'),
      }),
      observePage: async () => sampleObservation(),
      writeJson: (_report, { outputDir }) => {
        const targetPath = join(outputDir, 'target.json');
        const filePath = join(outputDir, 'report.json');
        writeFileSync(targetPath, '{}\n');
        try {
          symlinkSync(targetPath, filePath);
        } catch (error) {
          if (['EPERM', 'ENOSYS', 'EOPNOTSUPP'].includes(error.code)) {
            t.skip(`Symlinks unsupported: ${error.code}`);
            throw new Error('Invalid required profile artifact: report.json');
          }
          throw error;
        }
        return { filePath };
      },
      writeMarkdown: writeSmallMarkdown,
    }), /Invalid required profile artifact: report\.json/);
    assert.deepEqual(findRelativeFiles(outputRoot), []);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('profileUrl interruption cleans incomplete directory and closes resources once', async () => {
  const closed = { page: 0, context: 0, browser: 0 };
  const outputRoot = mkdtempSync(join(tmpdir(), 'player-lab-profile-url-'));
  const controller = new AbortController();
  try {
    await assert.rejects(() => profileUrl({
      url: 'http://localhost:1234/',
      providerId: 'local-fixture',
      outputRoot,
      launchBrowserContext: async () => fakeLaunch(closed),
      observePage: async ({ abortSignal }) => {
        controller.abort();
        await new Promise((resolve) => setTimeout(resolve, 10));
        if (abortSignal.aborted) {
          throw new Error('Profiling interrupted.');
        }
        return sampleObservation();
      },
      abortSignal: controller.signal,
    }), /Profiling interrupted/);
    assert.equal(closed.page, 1);
    assert.equal(closed.context, 1);
    assert.equal(closed.browser, 1);
    assert.deepEqual(findRelativeFiles(outputRoot), []);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('profileUrl simulated main-frame public navigation is rejected and cleans output', async () => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'player-lab-profile-url-'));
  const closed = { page: 0, context: 0, browser: 0 };
  let capturedHandler;
  const mainFrame = {
    url: () => 'https://198.51.100.10/watch?token=simulated-public-secret#simulated-public-fragment',
  };
  try {
    await assert.rejects(() => profileUrl({
      url: 'http://localhost:1234/',
      providerId: 'local-fixture',
      outputRoot,
      launchBrowserContext: async () => fakeLaunch(closed, {
        mainFrame: () => mainFrame,
        on: (event, handler) => {
          if (event === 'framenavigated') {
            capturedHandler = handler;
          }
        },
      }),
      observePage: async ({ abortSignal }) => {
        capturedHandler(mainFrame);
        assert.equal(abortSignal.aborted, true);
        throw new Error('Profiling interrupted.');
      },
    }), (error) => {
      assert.match(error.message, /Arbitrary public URLs are not permitted; use a registered --target/);
      assert.doesNotMatch(error.message, /simulated-public-secret|simulated-public-fragment|token=|\?token=|#/);
      return true;
    });
    assert.equal(closed.page, 1);
    assert.equal(closed.context, 1);
    assert.equal(closed.browser, 1);
    assert.deepEqual(findRelativeFiles(outputRoot), []);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('profileUrl simulated registered-target disallowed main-frame navigation aborts and cleans output', async () => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'player-lab-profile-url-'));
  const closed = { page: 0, context: 0, browser: 0 };
  let capturedHandler;
  const mainFrame = {
    url: () => 'https://cvmtv.com.attacker.invalid/live?token=simulated-target-secret#simulated-target-fragment',
  };
  try {
    await assert.rejects(() => profileUrl({
      targetId: 'cvm-tv',
      outputRoot,
      launchBrowserContext: async () => fakeLaunch(closed, {
        url: () => 'https://www.cvmtv.com/live',
        mainFrame: () => mainFrame,
        on: (event, handler) => {
          if (event === 'framenavigated') {
            capturedHandler = handler;
          }
        },
      }),
      observePage: async ({ abortSignal }) => {
        capturedHandler(mainFrame);
        assert.equal(abortSignal.aborted, true);
        throw new Error('Profiling interrupted.');
      },
    }), (error) => {
      assert.match(error.message, /Navigation is outside the registered public target policy/);
      assert.doesNotMatch(error.message, /simulated-target-secret|simulated-target-fragment|token=|\?token=|#/);
      return true;
    });
    assert.equal(closed.page, 1);
    assert.equal(closed.context, 1);
    assert.equal(closed.browser, 1);
    assert.deepEqual(findRelativeFiles(outputRoot), []);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('profileUrl registered target ignores iframe navigation for main-frame policy', async () => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'player-lab-profile-url-'));
  const closed = { page: 0, context: 0, browser: 0 };
  let capturedHandler;
  const mainFrame = { url: () => 'https://www.cvmtv.com/live' };
  const iframeFrame = { url: () => 'https://cvmtv.com.attacker.invalid/embed?token=iframe-secret#iframe-fragment' };
  try {
    const result = await profileUrl({
      targetId: 'cvm-tv',
      outputRoot,
      launchBrowserContext: async () => fakeLaunch(closed, {
        url: () => 'https://www.cvmtv.com/live',
        mainFrame: () => mainFrame,
        on: (event, handler) => {
          if (event === 'framenavigated') {
            capturedHandler = handler;
          }
        },
        screenshot: async ({ path }) => writeFileSync(path, 'png'),
      }),
      observePage: async ({ abortSignal }) => {
        capturedHandler(iframeFrame);
        assert.equal(abortSignal.aborted, false);
        return sampleObservation();
      },
    });
    assert.equal(existsSync(result.jsonPath), true);
    assert.equal(closed.page, 1);
    assert.equal(closed.context, 1);
    assert.equal(closed.browser, 1);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('profileUrl registered target metadata reaches canonical report and runtime summary is path-free', async () => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'player-lab-profile-url-'));
  const closed = { page: 0, context: 0, browser: 0 };
  try {
    const result = await profileUrl({
      targetId: 'cvm-tv',
      outputRoot,
      launchBrowserContext: async () => fakeLaunch(closed, {
        url: () => 'https://cvmtv.com/live?session=metadata-secret#metadata-fragment',
        screenshot: async ({ path }) => writeFileSync(path, 'png'),
      }),
      observePage: async () => sampleObservation(),
    });
    const parsed = JSON.parse(readFileSync(result.jsonPath, 'utf8'));
    assert.deepEqual(result.report, parsed);
    assert.equal(result.report.metadata.policyMode, 'registered-public-target');
    assert.equal(result.report.metadata.targetId, 'cvm-tv');
    assert.equal(result.report.metadata.providerId, 'cvm-tv');
    assert.equal(result.report.metadata.requestedProfile, 'sony-bravia');
    assert.deepEqual(result.report.metadata.allowedMainFrameHosts, ['www.cvmtv.com', 'cvmtv.com']);
    assert.equal(result.report.metadata.requiredProtocol, 'https:');
    assert.equal(result.report.metadata.initialUrlSource, 'registry');
    assert.equal(result.report.metadata.passiveObservationOnly, true);
    assert.equal(result.report.requestedUrl, 'https://www.cvmtv.com/live');
    assert.equal(result.report.finalUrl, 'https://cvmtv.com/live');
    assert.deepEqual(result.browserRuntime, { type: 'test' });
    assert.equal(Object.hasOwn(result.browserRuntime, 'executablePath'), false);
    assert.deepEqual(result.interactionCounters, zeroCounters());
    assert.deepEqual(result.report.lifecycleEvidence.interactionCounters, zeroCounters());
    assert.doesNotMatch(JSON.stringify(result.report), /metadata-secret|metadata-fragment|session=|\?session=|#/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('profileUrl MTM registered attribution query is authorized but omitted from canonical output', async () => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'player-lab-profile-url-'));
  const closed = { page: 0, context: 0, browser: 0 };
  try {
    const result = await profileUrl({
      targetId: 'mtm-tv',
      outputRoot,
      launchBrowserContext: async () => fakeLaunch(closed, {
        url: () => 'https://www.mercyandtruth.tv/watch/?utm_source=KulchaFlo#removed',
        screenshot: async ({ path }) => writeFileSync(path, 'png'),
      }),
      observePage: async () => sampleObservation(),
    });
    assert.equal(result.report.metadata.targetId, 'mtm-tv');
    assert.equal(result.report.metadata.providerId, 'mtm-tv');
    assert.equal(result.report.requestedUrl, 'https://www.mercyandtruth.tv/watch/');
    assert.equal(result.report.finalUrl, 'https://www.mercyandtruth.tv/watch/');
    assert.doesNotMatch(JSON.stringify(result.report), /utm_source|KulchaFlo|[?#]/);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('profileUrl registered target resolves fixed registry before fake browser launch', async () => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'player-lab-profile-url-'));
  const closed = { page: 0, context: 0, browser: 0 };
  const observed = {};
  try {
    const result = await profileUrl({
      targetId: 'cvm-tv',
      outputRoot,
      launchBrowserContext: async ({ profileId }) => {
        observed.profileId = profileId;
        return fakeLaunch(closed, {
          url: () => 'https://www.cvmtv.com/live',
          screenshot: async ({ path }) => writeFileSync(path, 'png'),
        });
      },
      observePage: async ({ url }) => {
        observed.url = url;
        return sampleObservation();
      },
    });
    assert.equal(observed.url, 'https://www.cvmtv.com/live');
    assert.equal(observed.profileId, 'sony-bravia');
    assert.match(result.outputDir, /\/cvm-tv\//);
    assert.equal(result.report.metadata.providerId, 'cvm-tv');
    assert.equal(result.report.metadata.targetId, 'cvm-tv');
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('profileUrl registered target respects explicit desktop-firefox override', async () => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'player-lab-profile-url-'));
  const closed = { page: 0, context: 0, browser: 0 };
  let launchedProfile;
  try {
    const result = await profileUrl({
      targetId: 'cvm-tv',
      profileId: 'desktop-firefox',
      outputRoot,
      launchBrowserContext: async ({ profileId }) => {
        launchedProfile = profileId;
        return fakeLaunch(closed, {
          url: () => 'https://www.cvmtv.com/live',
          screenshot: async ({ path }) => writeFileSync(path, 'png'),
        });
      },
      observePage: async () => sampleObservation(),
    });
    assert.equal(launchedProfile, 'desktop-firefox');
    assert.equal(result.report.metadata.requestedProfile, 'desktop-firefox');
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('profileUrl unknown target fails before browser launch', async () => {
  let launches = 0;
  await assert.rejects(() => profileUrl({
    targetId: 'missing-target',
    launchBrowserContext: async () => {
      launches += 1;
    },
  }), /Unknown public target/);
  assert.equal(launches, 0);
});

test('profileUrl rejects forged targetPolicy before browser launch', async () => {
  let launches = 0;
  await assert.rejects(() => profileUrl({
    targetPolicy: {
      mode: 'registered-public-target',
      targetId: 'forged',
      providerId: 'forged',
      initialUrl: 'https://forged.example.invalid/live',
      allowedMainFrameHosts: ['forged.example.invalid'],
      requiredProtocol: 'https:',
      defaultProfileId: 'desktop-firefox',
    },
    launchBrowserContext: async () => {
      launches += 1;
    },
  }), /Unsupported profileUrl option: targetPolicy/);
  assert.equal(launches, 0);
});

test('registry validation helpers do not authorize profileUrl public mode', async () => {
  const registry = validatePublicTargetsRegistry({
    version: 1,
    targets: {
      forged: {
        providerId: 'forged',
        initialUrl: 'https://forged.example.invalid/live',
        allowedMainFrameHosts: ['forged.example.invalid'],
        requiredProtocol: 'https:',
        defaultProfileId: 'desktop-firefox',
      },
    },
  });
  assert.equal(registry.targets.forged.providerId, 'forged');
  let launches = 0;
  await assert.rejects(() => profileUrl({
    targetId: 'forged',
    launchBrowserContext: async () => {
      launches += 1;
    },
  }), /Unknown public target/);
  assert.equal(launches, 0);
});

test('profileUrl loopback-to-loopback redirect remains allowed', { skip: skipReason }, async () => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'player-lab-profile-url-'));
  const fixture = await startFixtureServer();
  try {
    const result = await profileUrl({
      url: `${fixture.origin}/redirect-loopback?token=start-secret#start-frag`,
      providerId: 'local-fixture',
      outputRoot,
      observationMs: 3200,
    });
    assert.equal(existsSync(result.jsonPath), true);
    assert.equal(result.report.finalUrl.includes('token='), false);
  } finally {
    await fixture.close();
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('profileUrl rejects invalid URL before browser launch', async () => {
  let launches = 0;
  await assert.rejects(() => profileUrl({
    url: 'file:///tmp/local.html',
    providerId: 'local-fixture',
    launchBrowserContext: async () => {
      launches += 1;
    },
  }), /unsupported protocol/);
  assert.equal(launches, 0);
});

test('main-frame navigation guard ignores about:blank, accepts loopback, and redacts public rejection', () => {
  assert.deepEqual(validateMainFrameNavigationCandidate('about:blank'), { valid: true, ignored: true });
  assert.deepEqual(validateMainFrameNavigationCandidate('https://localhost/watch?token=ok#frag'), { valid: true, ignored: false });
  const result = validateMainFrameNavigationCandidate('https://198.51.100.10/watch?token=guard-secret#guard-frag');
  assert.equal(result.valid, false);
  assert.match(result.error.message, /Arbitrary public URLs are not permitted; use a registered --target/);
  assert.match(result.error.message, /https:\/\/198\.51\.100\.10\/watch/);
  assert.doesNotMatch(result.error.message, /guard-secret|guard-frag|token=|\?token=|#/);
});

test('registered public main-frame policy validates exact hosts and HTTPS only', () => {
  const policy = cvmPolicy();
  assert.deepEqual(validateMainFrameNavigationCandidate('about:blank', policy), { valid: true, ignored: true });
  assert.deepEqual(validateMainFrameNavigationCandidate('https://www.cvmtv.com/live', policy), { valid: true, ignored: false });
  assert.deepEqual(validateMainFrameNavigationCandidate('https://www.cvmtv.com/live?token=ok#frag', policy), { valid: true, ignored: false });
  assert.deepEqual(validateMainFrameNavigationCandidate('https://cvmtv.com/live', policy), { valid: true, ignored: false });

  for (const value of [
    'http://www.cvmtv.com/live?token=http-secret#frag',
    'https://www.cvmtv.com:444/live?token=port-secret#frag',
    'https://user:pass@www.cvmtv.com/live?token=credential-secret#frag',
    'https://cvmtv.com.example.invalid/live?token=suffix-secret#frag',
    'https://cvmtv.com.attacker.invalid/live?token=prefix-secret#frag',
    'https://live.cvmtv.com/live?token=subdomain-secret#frag',
    'https://198.51.100.10/live?token=unrelated-secret#frag',
  ]) {
    const result = validateMainFrameNavigationCandidate(value, policy);
    assert.equal(result.valid, false);
    assert.match(result.error.message, /Navigation is outside the registered public target policy/);
    assert.doesNotMatch(result.error.message, /secret|token=|\?token=|#/);
  }
});

function sampleObservation() {
  return {
    navigation: { result: 'fixture', errors: [], redirectCount: 0, popupCount: 0, unexpectedPopupUrls: [] },
    frames: [],
    scripts: [],
    iframes: [],
    mediaObservations: [],
    networkEvidence: [],
    lifecycleEvidence: {},
    candidateControls: [],
    truncation: {},
    warnings: [],
    interactionCounters: zeroCounters(),
  };
}

function fakeLaunch(closed, pageOverrides = {}) {
  return {
    runtime: { type: 'test', executablePath: '/private/browser/path' },
    profile: {
      id: 'desktop-firefox',
      userAgent: 'test-agent',
      viewport: { width: 1920, height: 1080 },
    },
    warnings: [],
    context: {
      newPage: async () => ({
        url: () => 'http://localhost:1234/',
        screenshot: async () => {},
        close: async () => { closed.page += 1; },
        on: () => {},
        off: () => {},
        mainFrame: () => ({}),
        ...pageOverrides,
      }),
      close: async () => { closed.context += 1; },
    },
    browser: {
      close: async () => { closed.browser += 1; },
    },
  };
}

function writeSmallJson(_report, { outputDir }) {
  const filePath = join(outputDir, 'report.json');
  writeFileSync(filePath, '{}\n');
  return { filePath, json: '{}\n' };
}

function writeSmallMarkdown(_report, { outputDir }) {
  const filePath = join(outputDir, 'report.md');
  writeFileSync(filePath, '# ok\n');
  return { filePath, markdown: '# ok\n' };
}

function zeroCounters() {
  return { click: 0, pointer: 0, keyboard: 0, play: 0, pause: 0, requestFullscreen: 0 };
}

function cvmPolicy() {
  return getPublicTargetPolicy('cvm-tv');
}

function findRelativeFiles(root) {
  const results = [];
  const walk = (dir, prefix = '') => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const relative = prefix ? `${prefix}/${entry}` : entry;
      if (statSync(full).isDirectory()) {
        walk(full, relative);
      } else {
        results.push(relative);
      }
    }
  };
  walk(root);
  return results.sort();
}
