import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { certifyHelperEngine } from './helper-engine-contract.mjs';
import { sanitizeDiagnosticString } from './report-model.mjs';

export async function runCertifyHelperEngineCli(argv = process.argv.slice(2), { stdout = process.stdout, stderr = process.stderr, certify = certifyHelperEngine } = {}) {
  try {
    if (argv.length === 1 && argv[0] === '--help') { stdout.write('Usage: npm run certify-helper-engine [--output-dir <path>]\n'); return 0; }
    if (argv.length > 2 || (argv.length && argv[0] !== '--output-dir') || (argv.length === 1) || (argv.length === 2 && (!argv[1] || argv[1].startsWith('--')))) throw new Error('Usage: npm run certify-helper-engine [--output-dir <path>]');
    const result = certify({ outputRoot: argv[1] });
    stdout.write(`${result.outputDir}\n`); return 0;
  } catch (error) { stderr.write(`${sanitizeDiagnosticString(error.message)}\n`); return 1; }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exitCode = await runCertifyHelperEngineCli();
