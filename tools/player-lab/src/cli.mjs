import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCliArguments, USAGE_TEXT } from './cli-arguments.mjs';
import { profileUrl } from './profile-url.mjs';
import { sanitizeDiagnosticString } from './report-model.mjs';

export async function runCli(argv = process.argv.slice(2), {
  stdout = process.stdout,
  stderr = process.stderr,
  profile = profileUrl,
} = {}) {
  let controller;
  const signalHandlers = [];
  try {
    const args = parseCliArguments(argv);
    if (args.help) {
      stdout.write(USAGE_TEXT);
      return 0;
    }
    controller = new AbortController();
    for (const signal of ['SIGINT', 'SIGTERM']) {
      const handler = () => controller.abort();
      process.once(signal, handler);
      signalHandlers.push([signal, handler]);
    }
    const result = await profile({
      url: args.url,
      providerId: args.providerId,
      targetId: args.targetId,
      profileId: args.targetId && !args.profileExplicit ? undefined : args.profileId,
      observationMs: args.observationMs,
      navigationTimeoutMs: args.navigationTimeoutMs,
      outputRoot: args.outputRoot,
      abortSignal: controller.signal,
    });
    stdout.write(`${result.outputDir}\n`);
    return 0;
  } catch (error) {
    stderr.write(`${controller?.signal.aborted ? 'Profiling interrupted.' : sanitizeDiagnosticString(error.message)}\n`);
    return controller?.signal.aborted ? 130 : 1;
  } finally {
    for (const [signal, handler] of signalHandlers) {
      process.off(signal, handler);
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = await runCli();
}
