import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveAndWriteTargetObservations } from './target-observation-generator.mjs';
import { sanitizeDiagnosticString } from './report-model.mjs';

const USAGE = 'Usage: npm run derive-target-observations -- --analysis <directory> [--profile <file>] [--target-registry <file>] [--review-input <file>] [--characterization <file>] [--output-dir <path>]\n';
export async function runDeriveTargetObservationsCli(argv = process.argv.slice(2), { stdout = process.stdout, stderr = process.stderr, derive = deriveAndWriteTargetObservations } = {}) {
  try {
    const args = parse(argv);
    if (args.help) { stdout.write(USAGE); return 0; }
    const result = derive({ analysisPath: resolve(args.analysis, 'analysis.json'), profilePath: args.profile && resolve(args.profile), targetRegistryPath: args.targetRegistry && resolve(args.targetRegistry), reviewInputPath: args.reviewInput && resolve(args.reviewInput), characterizationPath: args.characterization && resolve(args.characterization), outputRoot: args.outputDir });
    stdout.write(`${result.outputDir}\n`); return 0;
  } catch (error) { stderr.write(`${sanitizeDiagnosticString(error.message)}\n`); return 1; }
}
function parse(argv) { const out = {}; const seen = new Set(); const names = new Map([['--analysis', 'analysis'], ['--profile', 'profile'], ['--target-registry', 'targetRegistry'], ['--review-input', 'reviewInput'], ['--characterization', 'characterization'], ['--output-dir', 'outputDir']]); for (let i = 0; i < argv.length; i += 1) { const key = argv[i]; if (key === '--help') { if (seen.has(key)) throw new Error('Duplicate argument: --help'); seen.add(key); out.help = true; continue; } if (!names.has(key)) throw new Error(`Unknown argument: ${key}`); if (seen.has(key)) throw new Error(`Duplicate argument: ${key}`); seen.add(key); const value = argv[++i]; if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`); out[names.get(key)] = value; } if (!out.help && !out.analysis) throw new Error('Missing required argument: --analysis'); return out; }
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exitCode = await runDeriveTargetObservationsCli();
