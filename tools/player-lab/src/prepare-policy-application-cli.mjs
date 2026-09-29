import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_ENGINE_SOURCE_PATH } from './helper-engine-contract.mjs';
import { prepareAndWritePolicyApplication } from './policy-application-preparation.mjs';
import { sanitizeDiagnosticString } from './report-model.mjs';

export const PREPARE_POLICY_APPLICATION_USAGE = 'Usage: npm run prepare-policy-application -- --review-decision <file> --diff-provenance <file> --policy-diff <file> [--proposed-policy <file>] [--runtime-source <file>] [--output-dir <path>]\n';
const OPTIONS = new Map([
  ['--review-decision', 'reviewDecision'],
  ['--diff-provenance', 'diffProvenance'],
  ['--policy-diff', 'policyDiff'],
  ['--proposed-policy', 'proposedPolicy'],
  ['--runtime-source', 'runtimeSource'],
  ['--output-dir', 'outputDir'],
]);
const REQUIRED = ['reviewDecision', 'diffProvenance', 'policyDiff'];

export function parsePreparePolicyApplicationArguments(argv) {
  const result = {};
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === '--help') {
      if (seen.has(option)) throw new Error('Duplicate argument: --help');
      seen.add(option);
      result.help = true;
      continue;
    }
    if (!OPTIONS.has(option)) throw new Error(`Unknown argument: ${option}`);
    if (seen.has(option)) throw new Error(`Duplicate argument: ${option}`);
    seen.add(option);
    const value = argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${option}`);
    result[OPTIONS.get(option)] = value;
  }
  if (!result.help) {
    for (const key of REQUIRED) {
      if (!result[key]) {
        const option = [...OPTIONS].find(([, value]) => value === key)[0];
        throw new Error(`Missing required argument: ${option}`);
      }
    }
  }
  return result;
}

export async function runPreparePolicyApplicationCli(
  argv = process.argv.slice(2),
  { stdout = process.stdout, stderr = process.stderr, prepare = prepareAndWritePolicyApplication } = {},
) {
  try {
    const args = parsePreparePolicyApplicationArguments(argv);
    if (args.help) {
      stdout.write(PREPARE_POLICY_APPLICATION_USAGE);
      return 0;
    }
    const result = prepare({
      reviewDecisionPath: resolve(args.reviewDecision),
      diffProvenancePath: resolve(args.diffProvenance),
      policyDiffPath: resolve(args.policyDiff),
      proposedPolicyPath: args.proposedPolicy ? resolve(args.proposedPolicy) : undefined,
      runtimeSourcePath: resolve(args.runtimeSource ?? DEFAULT_ENGINE_SOURCE_PATH),
      outputRoot: args.outputDir,
    });
    stdout.write(`${result.outputDir}\n`);
    return 0;
  } catch (error) {
    stderr.write(`${sanitizeDiagnosticString(error.message)}\n`);
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exitCode = await runPreparePolicyApplicationCli();
