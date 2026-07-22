export const HELPER_EVIDENCE_USAGE_TEXT = `Usage: npm run prepare-helper-evidence -- --analysis <analysis-directory> [options]
       npm run recommend-helper -- --analysis <analysis-directory> [options]

Options:
  --analysis <path>     Local directory containing analysis.json.
  --output-dir <path>   Optional external path or Player Lab reports path.
  --help                Show this help.
`;

export function parseHelperEvidenceArguments(argv = []) {
  const parsed = { help: false, analysisPath: undefined, outputDir: undefined };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') {
      if (seen.has(arg)) throw new Error('Duplicate argument: --help');
      seen.add(arg); parsed.help = true; continue;
    }
    if (!['--analysis', '--output-dir'].includes(arg)) throw new Error(`Unknown argument: ${arg}`);
    if (seen.has(arg)) throw new Error(`Duplicate argument: ${arg}`);
    seen.add(arg);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
    index += 1;
    if (arg === '--analysis') parsed.analysisPath = value;
    else parsed.outputDir = value;
  }
  if (parsed.help) return parsed;
  if (!parsed.analysisPath) throw new Error('Missing required argument: --analysis');
  return parsed;
}
