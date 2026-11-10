import test from 'node:test';
import assert from 'node:assert/strict';
import {chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const playerLab = process.cwd();
const repository = resolve(playerLab, '../..');
const workflow = readFileSync(resolve(repository, '.github/workflows/tv-cloud-emulator-qualification.yml'), 'utf8');
const dispatcherPath = resolve(playerLab, 'scripts/tv-cloud-emulator-dispatch.sh');
const neutralScript = readFileSync(resolve(playerLab, 'scripts/tv-cloud-emulator-qualification.sh'), 'utf8');
const znsScript = readFileSync(resolve(playerLab, 'scripts/tv-zns-source-feedback.sh'), 'utf8');
const classifier = readFileSync(resolve(playerLab, 'src/zns-feedback-outcome.mjs'), 'utf8');

function workflowScriptCommand() {
  const lines = workflow.split(/\r?\n/).filter((line) => /^\s+script:/.test(line));
  assert.equal(lines.length, 1, 'expected one emulator-runner script input');
  const command = lines[0].replace(/^\s+script:\s*/, '').trim();
  assert.notEqual(command, '', 'emulator-runner script input must not be empty');
  assert.equal(command.includes('\n'), false, 'emulator-runner script input must remain one line');
  return command;
}

function createDispatchSandbox() {
  const root = mkdtempSync(join(tmpdir(), 'kf-tv-dispatch-'));
  const scriptsDir = join(root, 'tools/player-lab/scripts');
  mkdirSync(scriptsDir, {recursive: true});
  writeFileSync(join(root, 'routed-profiles.txt'), '');
  writeFileSync(join(root, 'selected-profile-receipt.txt'), '');
  const dispatcher = join(scriptsDir, 'tv-cloud-emulator-dispatch.sh');
  writeFileSync(dispatcher, readFileSync(dispatcherPath));
  chmodSync(dispatcher, 0o755);

  for (const [filename, expectedProfile] of [
    ['tv-cloud-emulator-qualification.sh', 'qualification'],
    ['tv-zns-source-feedback.sh', 'zns'],
  ]) {
    const stub = [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      `printf '%s\\n' '${expectedProfile}' >> "$TV_ROUTE_LOG"`,
      `printf 'selected_profile=%s\\n' "$TV_TEST_PROFILE" > "$TV_PROFILE_RECEIPT"`,
      '',
    ].join('\n');
    const stubPath = join(scriptsDir, filename);
    writeFileSync(stubPath, stub);
    chmodSync(stubPath, 0o755);
  }

  return root;
}

function runWorkflowCommand(root, profile) {
  const routeLog = join(root, 'routed-profiles.txt');
  const receipt = join(root, 'selected-profile-receipt.txt');
  const result = spawnSync('/usr/bin/sh', ['-c', workflowScriptCommand()], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      TV_TEST_PROFILE: profile,
      TV_ROUTE_LOG: routeLog,
      TV_PROFILE_RECEIPT: receipt,
    },
  });
  return {result, routeLog, receipt};
}

test('the original multiline dispatch failure reproduces under /usr/bin/sh -c', () => {
  const result = spawnSync('/usr/bin/sh', ['-c', 'case "$TV_TEST_PROFILE" in'], {
    encoding: 'utf8',
    env: {...process.env, TV_TEST_PROFILE: 'zns'},
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Syntax error: end of file unexpected/);
});

test('the actual workflow script command is one shell invocation and routes each profile exclusively', () => {
  const command = workflowScriptCommand();
  assert.equal(command, 'bash tools/player-lab/scripts/tv-cloud-emulator-dispatch.sh "$TV_TEST_PROFILE"');
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s*(pull_request|push|schedule):/m);

  for (const profile of ['qualification', 'zns']) {
    const root = createDispatchSandbox();
    try {
      const {result, routeLog, receipt} = runWorkflowCommand(root, profile);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(readFileSync(routeLog, 'utf8').trim().split('\n'), [profile]);
      assert.equal(readFileSync(receipt, 'utf8').trim(), `selected_profile=${profile}`);
    } finally {
      rmSync(root, {recursive: true, force: true});
    }
  }
});

test('unsupported profiles fail closed without routing either test', () => {
  const root = createDispatchSandbox();
  try {
    const {result, routeLog, receipt} = runWorkflowCommand(root, 'zns-and-qualification');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Unsupported TV emulator profile/);
    assert.equal(readFileSync(routeLog, 'utf8'), '');
    assert.equal(readFileSync(receipt, 'utf8'), '');
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('the selected profile is recorded by each production receipt path', () => {
  assert.match(neutralScript, /echo "selected_profile=qualification"/);
  assert.match(znsScript, /export TV_TEST_PROFILE=zns/);
  assert.match(classifier, /selected_profile: evidence\.profile === 'zns' \? 'zns' : 'unknown'/);
  assert.match(workflow, /"selected_profile": "zns"/);
});
