import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const MISSING_CHROMIUM_COMMAND = 'npx playwright install chromium';
export const DEFAULT_BROWSER_PROFILE_ID = 'desktop-firefox';
const PROFILE_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../config/browser-profiles.json');

const SYSTEM_CHROMIUM_CANDIDATES = Object.freeze([
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
]);

export function loadBrowserProfiles({ profilePath = PROFILE_PATH } = {}) {
  const config = JSON.parse(readFileSync(profilePath, 'utf8'));
  if (!config.profiles || typeof config.profiles !== 'object') {
    throw new Error('browser-profiles.json must contain a profiles object.');
  }
  return config.profiles;
}

export function getBrowserProfile(profileId = DEFAULT_BROWSER_PROFILE_ID, options = {}) {
  const profiles = options.profiles ?? loadBrowserProfiles(options);
  const profile = profiles[profileId];
  if (!profile) {
    throw new Error(`Unknown browser profile: ${profileId}`);
  }
  if (typeof profile.userAgent !== 'string' || !profile.viewport) {
    throw new Error(`Browser profile ${profileId} must define userAgent and viewport.`);
  }
  return { id: profileId, ...profile };
}

export function discoverSystemChromium() {
  const envPath = process.env.PLAYER_LAB_CHROMIUM_EXECUTABLE;
  if (envPath && existsSync(envPath)) {
    return { type: 'system', executablePath: envPath, source: 'PLAYER_LAB_CHROMIUM_EXECUTABLE' };
  }
  for (const executablePath of SYSTEM_CHROMIUM_CANDIDATES) {
    if (existsSync(executablePath)) {
      return { type: 'system', executablePath, source: 'known-path' };
    }
  }
  for (const command of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try {
      const executablePath = execFileSync('/usr/bin/which', [command], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (executablePath && existsSync(executablePath)) {
        return { type: 'system', executablePath, source: `command:${command}` };
      }
    } catch {
      // Safe discovery only; absence is expected on many machines.
    }
  }
  return null;
}

export function resolveChromiumRuntime({ playwrightChromium = chromium } = {}) {
  const managedPath = playwrightChromium.executablePath();
  if (managedPath && existsSync(managedPath)) {
    return { type: 'playwright-managed', executablePath: managedPath, installCommand: null };
  }
  const system = discoverSystemChromium();
  if (system) {
    return { ...system, installCommand: null };
  }
  return null;
}

export function missingBrowserError() {
  return new Error(`No usable Chromium browser executable was found. Install Playwright Chromium with: ${MISSING_CHROMIUM_COMMAND}`);
}

export function requireChromiumRuntime(options = {}) {
  const runtime = resolveChromiumRuntime(options);
  if (!runtime) {
    throw missingBrowserError();
  }
  return runtime;
}

export function contextOptionsForProfile(profileId = DEFAULT_BROWSER_PROFILE_ID, options = {}) {
  const profile = getBrowserProfile(profileId, options);
  return {
    profile,
    contextOptions: {
      acceptDownloads: false,
      userAgent: profile.userAgent,
      viewport: {
        width: profile.viewport.width,
        height: profile.viewport.height,
      },
    },
    warnings: [
      'Chromium user-agent emulation does not reproduce GeckoView runtime behavior or the physical Sony Bravia device.',
    ],
  };
}

export async function launchFreshBrowserContext({
  profileId = DEFAULT_BROWSER_PROFILE_ID,
  executablePath,
  playwrightChromium = chromium,
  headless = true,
} = {}) {
  const runtime = executablePath
    ? { type: 'explicit', executablePath }
    : requireChromiumRuntime({ playwrightChromium });
  const { profile, contextOptions, warnings } = contextOptionsForProfile(profileId);
  const browser = await playwrightChromium.launch({
    executablePath: runtime.executablePath,
    headless,
  });
  let context;
  try {
    context = await browser.newContext(contextOptions);
  } catch (error) {
    await browser.close();
    throw error;
  }
  return {
    browser,
    context,
    runtime,
    profile,
    contextOptions,
    warnings,
  };
}

export async function withFreshBrowserContext(options, callback) {
  const launched = await launchFreshBrowserContext(options);
  try {
    return await callback(launched);
  } finally {
    await launched.context.close().catch(() => {});
    await launched.browser.close().catch(() => {});
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const runtime = resolveChromiumRuntime();
  if (!runtime) {
    console.error(`No usable Chromium browser executable was found.`);
    console.error(`Missing-browser command: ${MISSING_CHROMIUM_COMMAND}`);
    process.exitCode = 1;
  } else {
    console.log(`Chromium available: ${runtime.type}`);
    console.log(`Executable: ${runtime.executablePath}`);
  }
}
