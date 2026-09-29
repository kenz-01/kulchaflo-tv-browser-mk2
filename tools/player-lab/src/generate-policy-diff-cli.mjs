import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_ENGINE_SOURCE_PATH } from './helper-engine-contract.mjs';
import { generateAndWritePolicyDiff } from './policy-review-approval.mjs';
import { sanitizeDiagnosticString } from './report-model.mjs';

export const GENERATE_POLICY_DIFF_USAGE = 'Usage: npm run generate-policy-diff -- --analysis <directory> --candidate <file> --target-observations <file> --engine-certification <file> --assembled-observations <file> --recommendation <file> --review <file> [--runtime-source <file>] [--output-dir <path>]\n';
const OPTIONS = new Map([
  ['--analysis', 'analysis'], ['--candidate', 'candidate'], ['--target-observations', 'targetObservations'],
  ['--engine-certification', 'engineCertification'], ['--assembled-observations', 'assembledObservations'],
  ['--recommendation', 'recommendation'], ['--review', 'review'], ['--runtime-source', 'runtimeSource'], ['--output-dir', 'outputDir'],
]);
const REQUIRED = ['analysis', 'candidate', 'targetObservations', 'engineCertification', 'assembledObservations', 'recommendation', 'review'];

export function parseGeneratePolicyDiffArguments(argv) {
  const result = {}; const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === '--help') { if (seen.has(key)) throw new Error('Duplicate argument: --help'); seen.add(key); result.help = true; continue; }
    if (!OPTIONS.has(key)) throw new Error(`Unknown argument: ${key}`);
    if (seen.has(key)) throw new Error(`Duplicate argument: ${key}`);
    seen.add(key);
    const value = argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    result[OPTIONS.get(key)] = value;
  }
  if (!result.help) for (const key of REQUIRED) if (!result[key]) throw new Error(`Missing required argument: --${[...OPTIONS].find(([, value]) => value === key)[0].slice(2)}`);
  return result;
}

export async function runGeneratePolicyDiffCli(argv = process.argv.slice(2), { stdout = process.stdout, stderr = process.stderr, generate = generateAndWritePolicyDiff } = {}) {
  try {
    const args = parseGeneratePolicyDiffArguments(argv);
    if (args.help) { stdout.write(GENERATE_POLICY_DIFF_USAGE); return 0; }
    const result = generate({
      analysisPath: resolve(args.analysis, 'analysis.json'),
      candidatePath: resolve(args.candidate),
      targetObservationsPath: resolve(args.targetObservations),
      engineCertificationPath: resolve(args.engineCertification),
      assembledObservationsPath: resolve(args.assembledObservations),
      recommendationPath: resolve(args.recommendation),
      reviewPath: resolve(args.review),
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

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exitCode = await runGeneratePolicyDiffCli();
