import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleHelperObservations } from './helper-engine-contract.mjs';
import { sanitizeDiagnosticString } from './report-model.mjs';

function parse(argv) {
  const result = {}; const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]; if (key === '--help') return { help: true };
    if (!['--analysis', '--target-observations', '--engine-certification', '--output-dir'].includes(key) || seen.has(key)) throw new Error(`Invalid argument: ${key}`);
    const value = argv[++index]; if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    seen.add(key); result[key.slice(2).replaceAll('-', '')] = value;
  }
  for (const key of ['analysis', 'targetobservations', 'enginecertification']) if (!result[key]) throw new Error(`Missing required argument: --${key.replace('targetobservations', 'target-observations').replace('enginecertification', 'engine-certification')}`);
  return result;
}
export async function runAssembleHelperObservationsCli(argv = process.argv.slice(2), { stdout = process.stdout, stderr = process.stderr, assemble = assembleHelperObservations } = {}) {
  try { const args = parse(argv); if (args.help) { stdout.write('Usage: npm run assemble-helper-observations -- --analysis <directory> --target-observations <file> --engine-certification <file> [--output-dir <path>]\n'); return 0; }
    const result = assemble({ analysisPath: resolve(args.analysis, 'analysis.json'), targetObservationsPath: resolve(args.targetobservations), engineCertificationPath: resolve(args.enginecertification), outputRoot: args.outputdir }); stdout.write(`${result.outputDir}\n`); return 0;
  } catch (error) { stderr.write(`${sanitizeDiagnosticString(error.message)}\n`); return 1; }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exitCode = await runAssembleHelperObservationsCli();
