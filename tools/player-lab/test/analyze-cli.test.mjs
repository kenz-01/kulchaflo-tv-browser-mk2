import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseAnalyzeArguments } from '../src/analysis-arguments.mjs';
import { runAnalyzeCli } from '../src/analyze-cli.mjs';

const execFileAsync = promisify(execFile);
const cwd = resolve(fileURLToPath(new URL('..', import.meta.url)));
const fixturePath = fileURLToPath(new URL('./fixtures/cvm-tv-evidence.json', import.meta.url));

test('analyze CLI help exits 0', async () => {
  const result = await execFileAsync('node', ['src/analyze-cli.mjs', '--help'], { cwd });
  assert.match(result.stdout, /npm run analyze/);
  assert.equal(result.stderr, '');
});

test('analyze argument parser rejects invalid invocations', () => {
  assert.throws(() => parseAnalyzeArguments(['--wat']), /Unknown argument/);
  assert.throws(() => parseAnalyzeArguments(['--report']), /Missing value/);
  assert.throws(() => parseAnalyzeArguments(['--report', fixturePath, '--report', fixturePath]), /Duplicate argument/);
  assert.throws(() => parseAnalyzeArguments([]), /--report/);
  assert.throws(() => parseAnalyzeArguments(['--url', 'http://localhost/']), /Unknown argument/);
  assert.throws(() => parseAnalyzeArguments(['--target', 'cvm-tv']), /Unknown argument/);
});

test('runAnalyzeCli valid invocation prints output path only and no sensitive values', async () => {
  const root = mkdtempSync(join(tmpdir(), 'player-lab-analyze-cli-'));
  const output = captureOutput();
  try {
    const code = await runAnalyzeCli(['--report', fixturePath, '--output-dir', root], {
      stdout: output.stdout,
      stderr: output.stderr,
    });
    assert.equal(code, 0);
    assert.equal(output.stderrText(), '');
    const outputDir = output.stdoutText().trim();
    assert.equal(existsSync(join(outputDir, 'analysis.json')), true);
    assert.equal(existsSync(join(outputDir, 'analysis.md')), true);
    assert.equal(output.stdoutText().trim().split(/\s+/).length, 1);
    assert.doesNotMatch(`${output.stdoutText()}\n${output.stderrText()}`, /token=|\?token=|#|Bearer|cookie=/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('runAnalyzeCli failures are non-zero and redact report contents', async () => {
  const root = mkdtempSync(join(tmpdir(), 'player-lab-analyze-cli-'));
  try {
    const missing = captureOutput();
    assert.equal(await runAnalyzeCli(['--report', join(root, 'missing.json')], missing), 1);
    assert.match(missing.stderrText(), /does not exist/);

    const bad = join(root, 'bad.json');
    writeFileSync(bad, '{nope', 'utf8');
    const malformed = captureOutput();
    assert.equal(await runAnalyzeCli(['--report', bad], malformed), 1);
    assert.match(malformed.stderrText(), /Malformed report JSON/);
    assert.doesNotMatch(malformed.stderrText(), /token=|\?token=|#/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('analyze CLI module does not import browser runtime or network modules', async () => {
  const result = await execFileAsync('node', ['-e', "await import('./src/analyze-cli.mjs'); console.log('ok')"], { cwd });
  assert.equal(result.stdout.trim(), 'ok');
  for (const source of ['src/analyze-cli.mjs', 'src/analyze-report.mjs']) {
    const text = readFileSync(resolve(cwd, source), 'utf8');
    assert.doesNotMatch(text, /playwright|browser-runtime|https:|http:/);
  }
});

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
