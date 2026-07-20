export const ANALYZE_USAGE_TEXT = `Usage: npm run analyze -- --report <path-to-report.json> [options]

Options:
  --report <path>       Existing local Player Lab report.json to analyze.
  --output-dir <path>   Optional output root. Default: <report-dir>/analysis.
  --help                Show this help.
`;

const VALUE_OPTIONS = new Set(['--report', '--output-dir']);

export function parseAnalyzeArguments(argv = []) {
  const parsed = { help: false, reportPath: undefined, outputDir: undefined };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') {
      if (seen.has(arg)) throw new Error('Duplicate argument: --help');
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
    if (arg === '--report') parsed.reportPath = value;
    if (arg === '--output-dir') parsed.outputDir = value;
  }
  if (parsed.help) return parsed;
  if (!parsed.reportPath) {
    throw new Error('Missing required argument: --report');
  }
  return parsed;
}
