export const HELPER_PROPOSAL_USAGE_TEXT = `Usage: npm run propose-helper -- --report <offline-evidence-directory> [options]

Options:
  --report <path>       Local directory containing helper-evidence.json.
  --output-dir <path>   Optional external path or Player Lab reports path.
                        Default: tools/player-lab/reports/helper-proposals.
  --help                Show this help.
`;

const VALUE_OPTIONS = new Set(['--report', '--output-dir']);

export function parseHelperProposalArguments(argv = []) {
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
    if (!VALUE_OPTIONS.has(arg)) throw new Error(`Unknown argument: ${arg}`);
    if (seen.has(arg)) throw new Error(`Duplicate argument: ${arg}`);
    seen.add(arg);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
    index += 1;
    if (arg === '--report') parsed.reportPath = value;
    if (arg === '--output-dir') parsed.outputDir = value;
  }
  if (parsed.help) return parsed;
  if (!parsed.reportPath) throw new Error('Missing required argument: --report');
  return parsed;
}
