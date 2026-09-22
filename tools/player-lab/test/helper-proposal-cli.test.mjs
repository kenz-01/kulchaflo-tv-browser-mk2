import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parseHelperProposalArguments } from '../src/helper-proposal-arguments.mjs';
import { runHelperProposalCli } from '../src/helper-proposal-cli.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/helper-proposals/cvm-like/', import.meta.url));

function memoryStream() {
  let text = '';
  return { write(value) { text += value; }, get text() { return text; } };
}

test('helper proposal CLI parser validates offline-only arguments', () => {
  assert.equal(parseHelperProposalArguments(['--help']).help, true);
  assert.throws(() => parseHelperProposalArguments(['--url', 'https://example.test']), /Unknown argument/);
  assert.throws(() => parseHelperProposalArguments(['--report']), /Missing value/);
  assert.throws(() => parseHelperProposalArguments(['--report', 'one', '--report', 'two']), /Duplicate argument/);
});

test('helper proposal CLI emits only its final generated directory', async () => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'player-helper-cli-'));
  const stdout = memoryStream();
  const stderr = memoryStream();
  try {
    const code = await runHelperProposalCli(['--report', fixturePath, '--output-dir', outputRoot], { stdout, stderr });
    assert.equal(code, 0);
    assert.match(stdout.text, new RegExp(`^${outputRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[^\n]+\n$`));
    assert.equal(stderr.text, '');
    assert.equal(stdout.text.includes('token'), false);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});
