import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { MISSING_CHROMIUM_COMMAND, resolveChromiumRuntime } from '../src/browser-runtime.mjs';
import { startFixtureServer } from '../fixtures/server.mjs';
import { runCli } from '../src/cli.mjs';

const execFileAsync = promisify(execFile);
const cwd = resolve(fileURLToPath(new URL('..', import.meta.url)));
const runtime = resolveChromiumRuntime();
const browserSkip = runtime ? false : `No usable Chromium executable. Run: ${MISSING_CHROMIUM_COMMAND}`;

test('CLI --help exits 0', async () => {
  const result = await execFileAsync('node', ['src/cli.mjs', '--help'], { cwd });
  assert.match(result.stdout, /npm run profile -- --url/);
  assert.match(result.stdout, /npm run profile -- --target/);
  assert.equal(result.stderr, '');
});

test('importing cli.mjs has no stdout or stderr side effects', async () => {
  const result = await execFileAsync('node', ['-e', "await import('./src/cli.mjs')"], { cwd });
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});

test('runCli invalid profile error is redacted through dependency injection', async () => {
  const output = captureOutput();
  const code = await runCli([
    '--url', 'http://localhost:1234/?token=cli-redaction-secret#cli-redaction-fragment',
    '--provider-id', 'local-fixture',
  ], {
    stdout: output.stdout,
    stderr: output.stderr,
    profile: async () => {
      throw new Error('Arbitrary public URLs are not permitted; use a registered --target. URL: https://198.51.100.10/watch');
    },
  });
  assert.equal(code, 1);
  assert.equal(output.stdoutText(), '');
  assert.match(output.stderrText(), /Arbitrary public URLs are not permitted; use a registered --target/);
  assert.doesNotMatch(`${output.stdoutText()}\n${output.stderrText()}`, /cli-redaction-secret|cli-redaction-fragment|token=|\?token=|#/);
});

test('runCli target handoff contains targetId and no public policy fields', async () => {
  const output = captureOutput();
  let received;
  const code = await runCli(['--target', 'cvm-tv'], {
    stdout: output.stdout,
    stderr: output.stderr,
    profile: async (options) => {
      received = options;
      return { outputDir: '/tmp/reports/cvm-tv/2026-07-19T12-00-00-000Z' };
    },
  });
  assert.equal(code, 0);
  assert.equal(output.stdoutText(), '/tmp/reports/cvm-tv/2026-07-19T12-00-00-000Z\n');
  assert.equal(output.stderrText(), '');
  assert.equal(received.url, undefined);
  assert.equal(received.providerId, undefined);
  assert.equal(received.targetId, 'cvm-tv');
  assert.equal(received.profileId, undefined);
  assert.equal(Object.hasOwn(received, 'targetPolicy'), false);
  assert.equal(Object.hasOwn(received, 'allowedMainFrameHosts'), false);
  assert.equal(Object.hasOwn(received, 'initialUrl'), false);
});

test('runCli target supports explicit profile override', async () => {
  let received;
  const code = await runCli(['--target', 'cvm-tv', '--profile', 'desktop-firefox'], {
    stdout: captureOutput().stdout,
    stderr: captureOutput().stderr,
    profile: async (options) => {
      received = options;
      return { outputDir: '/tmp/reports/cvm-tv/2026-07-19T12-00-00-000Z' };
    },
  });
  assert.equal(code, 0);
  assert.equal(received.profileId, 'desktop-firefox');
});

test('runCli unknown target fails before profiling', async () => {
  const output = captureOutput();
  const code = await runCli(['--target', 'missing-target'], {
    stdout: output.stdout,
    stderr: output.stderr,
  });
  assert.equal(code, 1);
  assert.match(output.stderrText(), /Unknown public target/);
});

test('runCli public target errors are redacted through dependency injection', async () => {
  const output = captureOutput();
  const code = await runCli(['--target', 'cvm-tv'], {
    stdout: output.stdout,
    stderr: output.stderr,
    profile: async () => {
      throw new Error('Navigation is outside the registered public target policy. URL: https://www.cvmtv.com/live?token=target-secret#target-fragment');
    },
  });
  assert.equal(code, 1);
  assert.match(output.stderrText(), /Navigation is outside the registered public target policy/);
  assert.doesNotMatch(`${output.stdoutText()}\n${output.stderrText()}`, /target-secret|target-fragment|token=|\?token=|#/);
});

test('CLI successful local fixture invocation exits 0 and prints report directory only', { skip: browserSkip }, async () => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'player-lab-cli-'));
  const fixture = await startFixtureServer();
  try {
    const result = await execFileAsync('npm', [
      'run',
      '--silent',
      'profile',
      '--',
      '--url',
      `${fixture.origin}/?token=process-secret#process-fragment`,
      '--provider-id',
      'local-fixture',
      '--observe-ms',
      '3200',
      '--output-root',
      outputRoot,
    ], { cwd, timeout: 30000 });
    const outputDir = result.stdout.trim();
    assert.match(outputDir, /local-fixture/);
    assert.equal(result.stderr, '');
    assert.doesNotMatch(result.stdout, /process-secret|process-fragment|token=|\?token=|#/);
    assert.doesNotMatch(result.stderr, /process-secret|process-fragment|token=|\?token=|#/);
    assert.equal(existsSync(join(outputDir, 'report.json')), true);
    assert.equal(existsSync(join(outputDir, 'report.md')), true);
    assert.equal(existsSync(join(outputDir, 'page.png')), true);
    const reportText = readFileSync(join(outputDir, 'report.json'), 'utf8');
    assert.doesNotMatch(reportText, /process-secret|process-fragment|token=|\?token=|#/);
  } finally {
    await fixture.close();
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  test(`CLI ${signal} interruption exits 130, cleans staging, and next profile works`, { skip: browserSkip }, async () => {
    const outputRoot = mkdtempSync(join(tmpdir(), `player-lab-cli-${signal.toLowerCase()}-`));
    const fixture = await startFixtureServer();
    try {
      const url = `${fixture.origin}/?token=${signal.toLowerCase()}-secret#${signal.toLowerCase()}-fragment`;
      const child = spawn('node', [
        'src/cli.mjs',
        '--url', url,
        '--provider-id', 'local-fixture',
        '--observe-ms', '20000',
        '--output-root', outputRoot,
      ], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      await waitForIncomplete(outputRoot);
      const startedAt = Date.now();
      child.kill(signal);
      const exit = await waitForExit(child, 8000);
      const durationMs = Date.now() - startedAt;
      assert.equal(exit.code, 130);
      assert.equal(exit.signal, null);
      assert.ok(durationMs < 8000);
      assert.equal(stdout.trim(), '');
      if (stderr.trim()) {
        assert.match(stderr, /Profiling interrupted/);
      }
      assert.doesNotMatch(`${stdout}\n${stderr}`, new RegExp(`${signal.toLowerCase()}-secret|${signal.toLowerCase()}-fragment|token=|\\?token=|#`));
      assert.equal(findEntries(outputRoot).some((entry) => entry.includes('.incomplete-')), false);

      const normal = await execFileAsync('node', [
        'src/cli.mjs',
        '--url', `${fixture.origin}/?token=after-signal-secret#after-signal-fragment`,
        '--provider-id', 'local-fixture',
        '--observe-ms', '3200',
        '--output-root', outputRoot,
      ], { cwd, timeout: 45000 });
      const outputDir = normal.stdout.trim();
      assert.equal(existsSync(join(outputDir, 'report.json')), true);
      assert.doesNotMatch(`${normal.stdout}\n${normal.stderr}`, /after-signal-secret|after-signal-fragment|token=|\?token=|#/);
    } finally {
      await fixture.close();
      rmSync(outputRoot, { recursive: true, force: true });
    }
  });
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolveWait, rejectWait) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      rejectWait(new Error('Timed out waiting for child exit.'));
    }, timeoutMs);
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      resolveWait({ code, signal });
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      rejectWait(error);
    });
  });
}

function captureOutput() {
  let stdout = '';
  let stderr = '';
  return {
    stdout: { write: (value) => { stdout += value; } },
    stderr: { write: (value) => { stderr += value; } },
    stdoutText: () => stdout,
    stderrText: () => stderr,
  };
}


async function waitForIncomplete(root) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (findEntries(root).some((entry) => entry.includes('.incomplete-'))) {
      return;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error('Timed out waiting for incomplete output directory.');
}

function findEntries(root) {
  if (!existsSync(root)) {
    return [];
  }
  const results = [];
  const walk = (dir, prefix = '') => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const relative = prefix ? `${prefix}/${entry}` : entry;
      results.push(relative);
      if (statSync(full).isDirectory()) {
        walk(full, relative);
      }
    }
  };
  walk(root);
  return results.sort();
}
