import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HELPER_PROPOSAL_USAGE_TEXT, parseHelperProposalArguments } from './helper-proposal-arguments.mjs';
import { proposeHelper } from './helper-proposal.mjs';
import { sanitizeDiagnosticString } from './report-model.mjs';

export async function runHelperProposalCli(argv = process.argv.slice(2), {
  stdout = process.stdout,
  stderr = process.stderr,
  propose = proposeHelper,
} = {}) {
  try {
    const args = parseHelperProposalArguments(argv);
    if (args.help) {
      stdout.write(HELPER_PROPOSAL_USAGE_TEXT);
      return 0;
    }
    const result = propose({ reportPath: args.reportPath, outputRoot: args.outputDir });
    stdout.write(`${result.outputDir}\n`);
    return 0;
  } catch (error) {
    stderr.write(`${sanitizeDiagnosticString(error.message)}\n`);
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = await runHelperProposalCli();
}
