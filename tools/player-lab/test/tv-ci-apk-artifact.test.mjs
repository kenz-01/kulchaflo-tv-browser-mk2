import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workflow = readFileSync(resolve(process.cwd(), '../../.github/workflows/tv-ci.yml'), 'utf8');

test('TV deterministic CI checks out the exact PR head', () => {
  assert.match(workflow, /ref:\s*\$\{\{\s*github\.event\.pull_request\.head\.sha\s*\|\|\s*github\.sha\s*\}\}/);
  assert.match(workflow, /permissions:\s*\n\s+contents:\s*read/);
});

test('Bravia candidate artifact is checksum-bound, same-repository only, and short-lived', () => {
  assert.match(workflow, /name:\s*Prepare Bravia APK artifact/);
  assert.match(workflow, /git rev-parse HEAD/);
  assert.match(workflow, /sha256sum app-gv-bravia-release\.apk > SHA256SUMS\.txt/);
  assert.match(workflow, /name:\s*Upload Bravia test APK for same-repository pull requests/);
  assert.match(workflow,
    /if:\s*github\.event_name == 'pull_request' && github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  assert.match(workflow, /uses:\s*actions\/upload-artifact@v4/);
  assert.match(workflow, /retention-days:\s*1/);
  assert.match(workflow, /compression-level:\s*0/);
  assert.doesNotMatch(workflow, /pull_request_target|contents:\s*write/);
});
