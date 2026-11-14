import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const playerLab = process.cwd();
const repository = resolve(playerLab, '../..');
const relayScript = resolve(playerLab, 'scripts/tv-zns-evidence-relay.py');
const relayWorkflowPath = resolve(repository, '.github/workflows/tv-zns-evidence-relay.yml');
const emulatorWorkflowPath = resolve(repository, '.github/workflows/tv-cloud-emulator-qualification.yml');
const sha = 'c'.repeat(40);

function fixtureReceipt(overrides = {}) {
  const allState = (focus = 'unknown') => ({
    process: 'yes',
    activity_foreground: 'yes',
    window_focus: focus,
  });
  return {
    schema_version: 1,
    receipt_finalized: true,
    selected_profile: 'zns',
    commit: sha,
    classification: 'INFRA_FAILURE',
    reason: 'attacker-controlled reason must never be copied',
    failure_stage: 'required_app_state',
    launch_status: 'confirmed',
    source: {url: 'https://untrusted.invalid/?token=secret', observed: true},
    infrastructure: {emulator_boot: 'yes', apk_install: 'yes', app_launch: 'yes'},
    app_state: {
      after_launch: allState(),
      after_dpad: allState(),
      after_back: allState(),
    },
    app_state_diagnostics: {
      after_launch: {pidof: 'target_process', activity_foreground: 'target_component', window_focus: 'entry_missing', window_manager_focus: 'entry_missing', input_focus: 'input_other_window', focus_source: 'input_dispatcher'},
      after_dpad: {pidof: 'target_process', activity_foreground: 'target_component', window_focus: 'entry_missing'},
      after_back: {pidof: 'target_process', activity_foreground: 'target_component', window_focus: 'entry_missing'},
      after_failure: {pidof: 'target_process', activity_foreground: 'target_component', window_focus: 'entry_missing'},
    },
    failure_state: allState(),
    screenshots: {
      after_launch: {file: 'untrusted-path', status: 'captured'},
      after_dpad: {file: '../../secret', status: 'missing'},
      after_back: {file: 'no', status: 'missing'},
      after_failure: {file: 'bad', status: 'captured'},
    },
    actions: {dpad_down_up_dispatched: 'no', back_dispatched: 'no'},
    log_capture: 'complete',
    observation_phases: ['untrusted phase token=secret'],
    player_state: {ready: 9, paused: 'no', muted: 'no', volume: 3},
    video_time_advanced_observed: 'no',
    raw_log: 'never include me: token=secret',
    ...overrides,
  };
}

function sanitize(receipt, extraEnv = {}) {
  return spawnSync('python3', [relayScript, '--sanitize-json'], {
    input: JSON.stringify(receipt),
    encoding: 'utf8',
    env: {
      ...process.env,
      TV_TEST_HEAD_SHA: sha,
      TV_TEST_RUN_ID: '42909999999',
      TV_TEST_ATTEMPT: '1',
      TV_TEST_CONCLUSION: 'failure',
      ...extraEnv,
    },
  });
}

test('relay recomputes a bounded report and drops arbitrary strings, paths, phases, and invalid player values', () => {
  const result = sanitize(fixtureReceipt());
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.classification, 'INCONCLUSIVE');
  assert.equal(report.classification_consistent, false);
  assert.equal(report.source_observed, false);
  assert.equal(report.failure_stage, 'required_app_state');
  assert.equal(report.app_state.after_launch.window_focus, 'unknown');
  assert.equal(report.app_state_diagnostics.after_launch.window_focus, 'entry_missing');
  assert.equal(report.app_state_diagnostics.after_launch.window_manager_focus, 'entry_missing');
  assert.equal(report.app_state_diagnostics.after_launch.input_focus, 'input_other_window');
  assert.equal(report.app_state_diagnostics.after_launch.focus_source, 'input_dispatcher');
  assert.equal(report.screenshots.after_launch, 'captured');
  assert.equal(report.screenshots.after_failure, 'captured');
  assert.deepEqual(report.observation_phases, []);
  assert.equal(report.player_state, null);
  assert.equal(report.helper_initiated_playback, false);
  assert.equal(report.audio_output_verified, false);
  assert.doesNotMatch(result.stdout, /attacker-controlled|untrusted\.invalid|secret|\.\.\//);
});

test('relay bounds focus diagnostics and rejects arbitrary service output', () => {
  const receipt = fixtureReceipt({
    app_state_diagnostics: {
      after_launch: {
        pidof: 'target_process', activity_foreground: 'target_component', window_focus: 'entry_missing',
        window_manager_focus: 'window name token=secret', input_focus: 'other package=secret',
        focus_source: 'raw InputDispatcher dump secret',
      },
    },
  });
  const result = sanitize(receipt);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.app_state_diagnostics.after_launch.window_manager_focus, 'unavailable');
  assert.equal(report.app_state_diagnostics.after_launch.input_focus, 'unavailable');
  assert.equal(report.app_state_diagnostics.after_launch.focus_source, 'unknown');
  assert.doesNotMatch(result.stdout, /secret|raw InputDispatcher|window name/);
});

test('relay rejects wrong profile, SHA, and unfinalized receipts', () => {
  assert.notEqual(sanitize(fixtureReceipt({selected_profile: 'qualification'})).status, 0);
  assert.notEqual(sanitize(fixtureReceipt({commit: 'd'.repeat(40)})).status, 0);
  assert.notEqual(sanitize(fixtureReceipt({receipt_finalized: false})).status, 0);
});

test('run provenance binds the workflow path, same-repository dispatch, and branch head', () => {
  const run = {
    event: 'workflow_dispatch',
    status: 'completed',
    workflow_id: 412417539,
    head_repository: {full_name: 'kenz-01/kulchaflo-tv-browser-mk2'},
    head_sha: sha,
    head_branch: 'codex/zns-on-demand-feedback',
    run_attempt: 1,
  };
  const fixture = {
    repo: 'kenz-01/kulchaflo-tv-browser-mk2',
    workflow_id: 412417539,
    branch: run.head_branch,
    run,
    workflow: {id: 412417539, path: '.github/workflows/tv-cloud-emulator-qualification.yml', state: 'active'},
  };
  const good = spawnSync('python3', [relayScript, '--validate-run-json'], {
    input: JSON.stringify(fixture), encoding: 'utf8',
  });
  assert.equal(good.status, 0, good.stderr);
  assert.equal(JSON.parse(good.stdout).valid, true);

  const fork = spawnSync('python3', [relayScript, '--validate-run-json'], {
    input: JSON.stringify({...fixture, run: {...run, head_repository: {full_name: 'untrusted/fork'}}}),
    encoding: 'utf8',
  });
  assert.notEqual(fork.status, 0);
  const wrongWorkflow = spawnSync('python3', [relayScript, '--validate-run-json'], {
    input: JSON.stringify({...fixture, workflow: {...fixture.workflow, path: '.github/workflows/other.yml'}}),
    encoding: 'utf8',
  });
  assert.notEqual(wrongWorkflow.status, 0);

  const malformedRepository = spawnSync('python3', [relayScript, '--validate-run-json'], {
    input: JSON.stringify({...fixture, run: {...run, head_repository: 'untrusted'}}),
    encoding: 'utf8',
  });
  assert.notEqual(malformedRepository.status, 0);
  const malformedWorkflow = spawnSync('python3', [relayScript, '--validate-run-json'], {
    input: JSON.stringify({...fixture, workflow: null}),
    encoding: 'utf8',
  });
  assert.notEqual(malformedWorkflow.status, 0);
});

test('artifact parser accepts only the bounded receipt and expected PNG names', () => {
  const root = mkdtempSync(join(tmpdir(), 'kf-zns-relay-'));
  try {
    const zipPath = join(root, 'artifact.zip');
    const receiptPath = join(root, 'receipt.json');
    writeFileSync(receiptPath, JSON.stringify(fixtureReceipt({
      classification: 'INCONCLUSIVE',
      observation_phases: [],
    })));
    const goodZip = spawnSync('python3', ['-c', `
import sys,zipfile
with zipfile.ZipFile(sys.argv[1],'w',compression=zipfile.ZIP_DEFLATED) as z:
 z.write(sys.argv[2],'zns-diagnostic-receipt.json')
 z.writestr('zns-after-launch.png',bytes([137,80,78,71,13,10,26,10]))
`, zipPath, receiptPath], {encoding: 'utf8'});
    assert.equal(goodZip.status, 0, goodZip.stderr);
    const good = spawnSync('python3', [relayScript, '--sanitize-archive', zipPath], {
      encoding: 'utf8',
      env: {...process.env, TV_TEST_HEAD_SHA: sha},
    });
    assert.equal(good.status, 0, good.stderr);
    assert.equal(JSON.parse(good.stdout).run_id, 1);

    const evilZip = spawnSync('python3', ['-c', `
import sys,zipfile
with zipfile.ZipFile(sys.argv[1],'w') as z:
 z.write(sys.argv[2],'zns-diagnostic-receipt.json')
 z.writestr('../unsafe.txt','no')
`, zipPath, receiptPath], {encoding: 'utf8'});
    assert.equal(evilZip.status, 0, evilZip.stderr);
    const rejected = spawnSync('python3', [relayScript, '--sanitize-archive', zipPath], {
      encoding: 'utf8', env: {...process.env, TV_TEST_HEAD_SHA: sha},
    });
    assert.notEqual(rejected.status, 0);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('privileged relay exists only on workflow_run and candidate workflow has no write token', () => {
  const relayWorkflow = readFileSync(relayWorkflowPath, 'utf8');
  const emulatorWorkflow = readFileSync(emulatorWorkflowPath, 'utf8');
  const relayCode = readFileSync(relayScript, 'utf8');
  assert.match(relayWorkflow, /workflow_run:[\s\S]*types:\s*\[completed\]/);
  assert.match(relayWorkflow, /ref:\s+main/);
  assert.match(relayWorkflow, /actions:\s+read/);
  assert.match(relayWorkflow, /pull-requests:\s+read/);
  assert.match(relayWorkflow, /issues:\s+write/);
  assert.doesNotMatch(relayWorkflow, /pull_request_target|pull_request:/);
  assert.doesNotMatch(emulatorWorkflow, /issues:\s*write|pull-requests:\s*write|GITHUB_TOKEN/);
  assert.match(relayCode, /workflow_id/);
  assert.match(relayCode, /WORKFLOW_PATH/);
  assert.match(relayCode, /run\.get\("head_sha"\)/);
  assert.match(relayCode, /MAX_RECEIPT_BYTES/);
  assert.match(relayCode, /Never echo API bodies, signed URLs/);
  assert.match(relayCode, /comment_marker\(run_id\)/);
});
