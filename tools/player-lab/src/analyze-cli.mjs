import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANALYZE_USAGE_TEXT, parseAnalyzeArguments } from './analysis-arguments.mjs';
import { analyzeReport } from './analyze-report.mjs';
import { sanitizeDiagnosticString } from './report-model.mjs';

export async function runAnalyzeCli(argv = process.argv.slice(2), {
  stdout = process.stdout,
  stderr = process.stderr,
  analyze = analyzeReport,
} = {}) {
  try {
    const args = parseAnalyzeArguments(argv);
    if (args.help) {
      stdout.write(ANALYZE_USAGE_TEXT);
      return 0;
    }
    const result = analyze({ reportPath: args.reportPath, outputRoot: args.outputDir });
    stdout.write(`${result.outputDir}\n`);
    return 0;
  } catch (error) {
    stderr.write(`${sanitizeDiagnosticString(error.message)}\n`);
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = await runAnalyzeCli();
}
