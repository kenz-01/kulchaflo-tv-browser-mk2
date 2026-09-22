import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchFreshBrowserContext } from './browser-runtime.mjs';
import { getPublicTargetPolicy } from './public-targets.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROBE_PATH = resolve(ROOT, 'config/interaction-probes.json');

function loadProbes() {
  const parsed = JSON.parse(readFileSync(PROBE_PATH, 'utf8'));
  if (parsed.version !== 1 || !parsed.probes || typeof parsed.probes !== 'object') {
    throw new Error('Invalid interaction probe registry.');
  }
  return parsed.probes;
}

function safeFrameMatch(frame, probe) {
  let url;
  try {
    url = new URL(frame.url());
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.hostname !== probe.frameHost) return false;
  if (probe.pathPrefix && !url.pathname.startsWith(probe.pathPrefix)) return false;
  return true;
}

async function mediaSnapshot(frame) {
  return frame.evaluate(() => [...document.querySelectorAll('video,audio')].map((media, index) => ({
    index,
    tag: media.tagName.toLowerCase(),
    paused: media.paused,
    ended: media.ended,
    muted: media.muted,
    volume: media.volume,
    readyState: media.readyState,
    currentTime: Number.isFinite(media.currentTime) ? Number(media.currentTime.toFixed(3)) : null,
    duration: Number.isFinite(media.duration) ? Number(media.duration.toFixed(3)) : null,
    width: media.videoWidth || null,
    height: media.videoHeight || null
  })));
}

async function run(targetId, outputRoot) {
  const probe = loadProbes()[targetId];
  if (!probe) throw new Error(`No bounded interaction probe registered for ${targetId}.`);
  const policy = getPublicTargetPolicy(targetId);
  const launched = await launchFreshBrowserContext({ profileId: policy.defaultProfileId });
  try {
    const page = await launched.context.newPage();
    await page.goto(policy.initialUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(7000);
    const frames = page.frames().filter((frame) => safeFrameMatch(frame, probe));
    if (frames.length !== 1) {
      throw new Error(`Expected exactly one bounded player frame; found ${frames.length}.`);
    }
    const frame = frames[0];
    const locator = frame.locator(probe.selector);
    const count = await locator.count();
    if (count !== 1) throw new Error(`Expected exactly one bounded play control; found ${count}.`);
    if (!(await locator.isVisible())) throw new Error('Bounded play control is not visible.');

    const before = await mediaSnapshot(frame);
    await locator.click({ timeout: 5000 });
    await page.waitForTimeout(5000);
    const after = await mediaSnapshot(frame);
    const playbackStarted = after.some((media, index) => {
      const previous = before[index];
      return !media.paused &&
        !media.ended &&
        media.readyState >= 2 &&
        (!previous || media.currentTime > (previous.currentTime ?? 0) + 0.25);
    });

    const result = {
      schemaVersion: 1,
      targetId,
      providerId: policy.providerId,
      family: probe.family,
      frameHost: probe.frameHost,
      selector: probe.selector,
      clickCount: 1,
      playbackStarted,
      before,
      after,
      warnings: ['Chromium Sony-profile emulation is not physical GeckoView/Bravia validation.']
    };
    mkdirSync(outputRoot, { recursive: true });
    const path = resolve(outputRoot, `${targetId}.json`);
    writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`);
    process.stdout.write(`${path}\n`);
  } finally {
    await launched.context.close().catch(() => {});
    await launched.browser.close().catch(() => {});
  }
}

const args = process.argv.slice(2);
const targetIndex = args.indexOf('--target');
const outputIndex = args.indexOf('--output-root');
if (targetIndex < 0 || !args[targetIndex + 1]) throw new Error('Missing --target.');
const outputRoot =
  outputIndex >= 0 && args[outputIndex + 1]
    ? resolve(args[outputIndex + 1])
    : resolve(ROOT, 'reports/interaction-probes');

await run(args[targetIndex + 1], outputRoot);
