import { getBrowserProfile, DEFAULT_BROWSER_PROFILE_ID } from './browser-runtime.mjs';
import { assertProviderId } from './redact-url.mjs';

export const DEFAULT_OBSERVATION_MS = 3000;
export const DEFAULT_NAVIGATION_TIMEOUT_MS = 10000;

export const USAGE_TEXT = `Usage: npm run profile -- --url <URL> --provider-id <safe-id> [options]

Options:
  --url <URL>                         Loopback URL to profile.
  --provider-id <safe-id>             Required lowercase directory-safe provider id.
  --profile <desktop-firefox|sony-bravia>
  --observe-ms <milliseconds>         Default: 3000.
  --navigation-timeout-ms <milliseconds>
                                      Default: 10000.
  --output-root <directory>           Default: tools/player-lab/reports.
  --help                              Show this help.
`;

const VALUE_OPTIONS = new Set([
  '--url',
  '--provider-id',
  '--profile',
  '--observe-ms',
  '--navigation-timeout-ms',
  '--output-root',
]);

export function parseCliArguments(argv = []) {
  const parsed = {
    help: false,
    profileId: DEFAULT_BROWSER_PROFILE_ID,
    observationMs: DEFAULT_OBSERVATION_MS,
    navigationTimeoutMs: DEFAULT_NAVIGATION_TIMEOUT_MS,
    outputRoot: undefined,
  };
  const seen = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') {
      if (seen.has(arg)) {
        throw new Error('Duplicate argument: --help');
      }
      seen.add(arg);
      parsed.help = true;
      continue;
    }
    if (!VALUE_OPTIONS.has(arg)) {
      throw new Error(`Unknown argument: ${arg}`);
    }
    if (seen.has(arg)) {
      throw new Error(`Duplicate argument: ${arg}`);
    }
    seen.add(arg);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }
    index += 1;
    if (arg === '--url') {
      parsed.url = value;
    } else if (arg === '--provider-id') {
      assertProviderId(value);
      parsed.providerId = value;
    } else if (arg === '--profile') {
      getBrowserProfile(value);
      parsed.profileId = value;
    } else if (arg === '--observe-ms') {
      parsed.observationMs = parseBoundedInteger(value, arg, { min: 100, max: 60000 });
    } else if (arg === '--navigation-timeout-ms') {
      parsed.navigationTimeoutMs = parseBoundedInteger(value, arg, { min: 1000, max: 120000 });
    } else if (arg === '--output-root') {
      parsed.outputRoot = value;
    }
  }

  if (parsed.help) {
    return parsed;
  }
  if (!parsed.url) {
    throw new Error('Missing required argument: --url');
  }
  if (!parsed.providerId) {
    throw new Error('Missing required argument: --provider-id');
  }
  return parsed;
}

function parseBoundedInteger(value, name, { min, max }) {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid integer for ${name}.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Invalid integer bounds for ${name}; expected ${min}-${max}.`);
  }
  return parsed;
}
