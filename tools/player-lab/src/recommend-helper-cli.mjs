import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HELPER_EVIDENCE_USAGE_TEXT, parseHelperEvidenceArguments } from './helper-evidence-arguments.mjs';
import { prepareHelperEvidence } from './helper-evidence-bridge.mjs';
import { assembleCapabilityObservations } from './helper-engine-contract.mjs';
import { proposeHelper } from './helper-proposal.mjs';
import { sanitizeDiagnosticString } from './report-model.mjs';

export async function runRecommendHelperCli(argv = process.argv.slice(2), { stdout = process.stdout, stderr = process.stderr, prepare = prepareHelperEvidence, propose = proposeHelper, assemble = assembleCapabilityObservations } = {}) {
  try {
    const args = parseHelperEvidenceArguments(argv);
    if (args.help) { stdout.write(HELPER_EVIDENCE_USAGE_TEXT); return 0; }
    const assembled = args.targetObservationsPath ? assemble({ analysisPath: resolve(args.analysisPath, 'analysis.json'), targetObservationsPath: args.targetObservationsPath, engineCertificationPath: args.engineCertificationPath }) : null;
    const bridge = prepare({ analysisPath: args.analysisPath, observations: assembled?.observations, outputRoot: args.outputDir });
    const proposal = propose({ reportPath: bridge.outputDir, outputRoot: bridge.outputDir, additionalArtifacts: assembled ? { 'helper-observation-assembly-provenance.json': assembled.provenance } : {} });
    stdout.write(`${proposal.outputDir}\n`);
    return 0;
  } catch (error) { stderr.write(`${sanitizeDiagnosticString(error.message)}\n`); return 1; }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exitCode = await runRecommendHelperCli();
