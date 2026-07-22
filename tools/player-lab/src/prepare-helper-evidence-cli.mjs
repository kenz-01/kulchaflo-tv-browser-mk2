import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HELPER_EVIDENCE_USAGE_TEXT, parseHelperEvidenceArguments } from './helper-evidence-arguments.mjs';
import { prepareHelperEvidence } from './helper-evidence-bridge.mjs';
import { sanitizeDiagnosticString } from './report-model.mjs';

export async function runPrepareHelperEvidenceCli(argv = process.argv.slice(2), { stdout = process.stdout, stderr = process.stderr, prepare = prepareHelperEvidence } = {}) {
  try {
    const args = parseHelperEvidenceArguments(argv);
    if (args.help) { stdout.write(HELPER_EVIDENCE_USAGE_TEXT); return 0; }
    const result = prepare({ analysisPath: args.analysisPath, outputRoot: args.outputDir });
    stdout.write(`${result.outputDir}\n`);
    return 0;
  } catch (error) { stderr.write(`${sanitizeDiagnosticString(error.message)}\n`); return 1; }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exitCode = await runPrepareHelperEvidenceCli();
