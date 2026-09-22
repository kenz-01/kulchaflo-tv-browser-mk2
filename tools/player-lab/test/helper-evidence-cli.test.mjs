import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parseHelperEvidenceArguments } from '../src/helper-evidence-arguments.mjs';
import { runPrepareHelperEvidenceCli } from '../src/prepare-helper-evidence-cli.mjs';
import { runRecommendHelperCli } from '../src/recommend-helper-cli.mjs';

const analysisPath = fileURLToPath(new URL('./fixtures/helper-evidence-bridge/cvm-complete/', import.meta.url));
const stream = () => { let text = ''; return { write(value) { text += value; }, get text() { return text; } }; };

test('bridge CLI parser rejects non-offline or incomplete input', () => {
  assert.equal(parseHelperEvidenceArguments(['--help']).help, true);
  assert.throws(() => parseHelperEvidenceArguments(['--url', 'x']), /Unknown argument/);
  assert.throws(() => parseHelperEvidenceArguments(['--analysis']), /Missing value/);
});

test('prepare and recommend CLIs emit only final approved-output paths', async () => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'helper-evidence-cli-'));
  try {
    const prepareOut = stream(); const prepareErr = stream();
    assert.equal(await runPrepareHelperEvidenceCli(['--analysis', analysisPath, '--output-dir', outputRoot], { stdout: prepareOut, stderr: prepareErr }), 0);
    assert.equal(prepareErr.text, '');
    const recommendOut = stream(); const recommendErr = stream();
    assert.equal(await runRecommendHelperCli(['--analysis', analysisPath, '--output-dir', outputRoot], { stdout: recommendOut, stderr: recommendErr }), 0);
    assert.equal(recommendErr.text, '');
    assert.equal(prepareOut.text.includes('token'), false);
    assert.equal(recommendOut.text.includes('token'), false);
  } finally { rmSync(outputRoot, { recursive: true, force: true }); }
});
