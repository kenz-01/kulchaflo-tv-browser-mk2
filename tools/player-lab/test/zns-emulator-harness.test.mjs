import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const playerLab = process.cwd();

function createSandbox(focusMode) {
  const root = mkdtempSync(join(tmpdir(), 'kf-zns-harness-'));
  const scriptDir = join(root, 'tools/player-lab/scripts');
  const sourceDir = join(root, 'tools/player-lab/src');
  const apk = join(root, 'app-gv/build/outputs/apk/universal/debug/app-gv-universal-debug.apk');
  const bin = join(root, 'bin');
  mkdirSync(scriptDir, {recursive: true});
  mkdirSync(sourceDir, {recursive: true});
  mkdirSync(join(root, 'app-gv/build/outputs/apk/universal/debug'), {recursive: true});
  mkdirSync(bin, {recursive: true});
  for (const filename of ['tv-zns-source-feedback.sh', 'tv-emulator-state.py', 'tv-zns-log-snapshot.py']) {
    writeFileSync(join(scriptDir, filename), readFileSync(join(playerLab, 'scripts', filename)));
  }
  writeFileSync(join(sourceDir, 'zns-feedback-outcome.mjs'), readFileSync(join(playerLab, 'src/zns-feedback-outcome.mjs')));
  writeFileSync(apk, 'test-only APK placeholder');
  const adb = `#!/usr/bin/env bash
set -eu
printf '%s\\n' "$*" >> "$TV_ADB_TRACE"
if [[ "$1" == "wait-for-device" ]]; then exit 0; fi
if [[ "$1" == "install" ]]; then exit 0; fi
if [[ "$1" == "pull" ]]; then printf '\\211PNG\\r\\n\\032\\n' > "$3"; exit 0; fi
if [[ "$1" == "logcat" ]]; then
  if [[ "$2" == "-c" ]]; then exit 0; fi
  printf '%s\\n' '11-14 12:00:00.000 1234 1234 I KfMkIIGV:GvTabs: session configured tabId=abc url=https://znsbahamas.com/'
  printf '%s\\n' '11-14 12:00:00.001 1234 1234 I KfMkIIGV:GvTabs: tab activated id=abc url=https://znsbahamas.com/ loading=true'
  printf '%s\\n' '11-14 12:00:00.002 1234 1234 I KfMkIIGV:GvNav: page start tabId=abc url=https://znsbahamas.com/'
  printf '%s\\n' '11-14 12:00:00.003 1234 1234 I KfMkIIGV:GvNav: page stop tabId=abc success=true url=https://znsbahamas.com/'
  printf '%s\\n' '11-14 12:00:00.004 1234 1234 I KfMkIIGV:GvMedia: zns helper phase=zns-embedded-observed mode=browser-first ready=4 paused=false muted=true volume=0.25'
  printf '%s\\n' '11-14 12:00:00.005 1234 1234 I KfMkIIGV:GvMedia: private token=must-not-enter-receipt'
  exit 0
fi
if [[ "$1" == "shell" ]]; then
  case "$2" in
    getprop)
      case "$3" in
        sys.boot_completed) printf '1\\n' ;;
        ro.product.cpu.abi) printf 'x86_64\\n' ;;
      esac
      ;;
    pm) printf 'feature:android.software.leanback\\n' ;;
    pidof) printf '1234\\n' ;;
    am) printf 'Status: ok\\n' ;;
    dumpsys)
      if [[ "$3" == "activity" ]]; then
        printf '%s\\n' 'topResumedActivity=ActivityRecord{a com.kulchaflo.tv.mk2.gv/.app.GeckoBrowserActivity t5}'
      elif [[ "$3" == "window" ]]; then
        case "$TV_FOCUS_MODE" in
          target) printf '%s\\n' 'mCurrentFocus=Window{b com.kulchaflo.tv.mk2.gv/.app.GeckoBrowserActivity}' ;;
          input-target) printf '%s\\n' 'mFocusedApp=ActivityRecord{a com.kulchaflo.tv.mk2.gv/.app.GeckoBrowserActivity t5}' ;;
          other) printf '%s\\n' 'mCurrentFocus=Window{b com.android.launcher/.Launcher}' ;;
          missing) : ;;
        esac
      elif [[ "$3" == "input" ]]; then
        case "$TV_FOCUS_MODE" in
          target) printf '%s\\n' "Input Dispatcher State:" "  FocusedWindows:" "    displayId=0, name='Window{b u0 com.kulchaflo.tv.mk2.gv/.app.GeckoBrowserActivity}', token=secret" "  FocusedApplications:" ;;
          input-target) printf '%s\\n' "Input Dispatcher State:" "  FocusedWindows:" "    displayId=0, name='Window{b u0 com.kulchaflo.tv.mk2.gv/.app.GeckoBrowserActivity}', token=secret" "  FocusedApplications:" ;;
          other) printf '%s\\n' "Input Dispatcher State:" "  FocusedWindows:" "    displayId=0, name='Window{b u0 com.android.launcher/.Launcher}', token=secret" "  FocusedApplications:" ;;
          missing) printf '%s\\n' "Input Dispatcher State:" "  FocusedWindows:" "  FocusedApplications:" ;;
        esac
      fi
      ;;
    screencap) exit 0 ;;
    input) exit 0 ;;
  esac
fi
exit 0
`;
  writeFileSync(join(bin, 'adb'), adb);
  writeFileSync(join(bin, 'sleep'), '#!/bin/sh\nexit 0\n');
  chmodSync(join(bin, 'adb'), 0o755);
  chmodSync(join(bin, 'sleep'), 0o755);
  return {root, scriptPath: join(scriptDir, 'tv-zns-source-feedback.sh'), bin, apk};
}

function runHarness(focusMode) {
  const sandbox = createSandbox(focusMode);
  const summary = join(sandbox.root, 'step-summary.md');
  const trace = join(sandbox.root, 'adb-trace.txt');
  const runnerTemp = join(sandbox.root, 'runner-temp');
  const result = spawnSync('/usr/bin/bash', [sandbox.scriptPath], {
    cwd: sandbox.root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${sandbox.bin}:${process.env.PATH}`,
      RUNNER_TEMP: runnerTemp,
      GITHUB_STEP_SUMMARY: summary,
      GITHUB_SHA: 'b'.repeat(40),
      TV_ADB_TRACE: trace,
      TV_FOCUS_MODE: focusMode,
    },
  });
  const snapshot = spawnSync('python3', [join(sandbox.root, 'tools/player-lab/scripts/tv-zns-log-snapshot.py'), 'capture'], {
    encoding: 'utf8',
    env: {...process.env, PATH: `${sandbox.bin}:${process.env.PATH}`, TV_ADB_TRACE: trace},
  });
  let receipt;
  try {
    receipt = JSON.parse(result.stdout.trim());
  } catch {
    receipt = null;
  }
  const traceText = readFileSync(trace, 'utf8');
  const summaryText = readFileSync(summary, 'utf8');
  rmSync(sandbox.root, {recursive: true, force: true});
  return {result, receipt, traceText, summaryText, snapshot};
}

test('failure captures an early frame, bounded state, failure frame, and safe summary before exit', () => {
  const {result, receipt, traceText, summaryText, snapshot} = runHarness('missing');
  assert.equal(result.status, 1, result.stderr);
  assert.ok(receipt);
  assert.equal(receipt.failure_stage, 'diagnostic_continuation');
  assert.equal(receipt.classification, 'INCONCLUSIVE');
  assert.equal(receipt.app_state.after_launch.window_focus, 'unknown');
  assert.equal(receipt.app_state_diagnostics.after_launch.window_focus, 'entry_missing');
  assert.equal(receipt.app_state_diagnostics.after_launch.window_manager_focus, 'entry_missing');
  assert.equal(receipt.app_state_diagnostics.after_launch.input_focus, 'entry_missing');
  assert.equal(receipt.app_state_diagnostics.after_launch.focus_source, 'unknown');
  assert.equal(receipt.failure_state.window_focus, 'unknown');
  assert.equal(receipt.app_state_diagnostics.after_failure.window_focus, 'entry_missing');
  assert.equal(receipt.screenshots.after_launch.status, 'captured');
  assert.equal(receipt.screenshots.after_failure.status, 'captured');
  assert.equal(receipt.screenshots.after_dpad.status, 'missing');
  assert.deepEqual(receipt.diagnostic_continuation, {
    mode: 'passive_focus_unknown',
    additional_passive_observation: 'yes',
    remote_keys_withheld: 'yes',
  });
  assert.equal(receipt.log_capture, 'complete', `${JSON.stringify(receipt)}\n${snapshot.stdout}\n${snapshot.stderr}`);
  assert.deepEqual(receipt.observation_phases, ['zns-embedded-observed']);
  assert.deepEqual(receipt.launch_observations, {
    browser_session_configured: 'yes',
    browser_view_attached: 'yes',
    zns_navigation_requested: 'yes',
    zns_navigation_started: 'yes',
    zns_navigation_completed: 'yes',
    zns_navigation_failed: 'no',
  });
  assert.deepEqual(receipt.player_state, {ready: 4, paused: false, muted: true, volume: 0.25});
  assert.doesNotMatch(JSON.stringify(receipt), /1234|GeckoBrowserActivity|android\.launcher|must-not-enter-receipt/);

  assert.ok(traceText.indexOf('shell screencap -p /sdcard/kf-zns-after-launch.png')
    < traceText.indexOf('shell dumpsys activity activities'), 'launch screenshot must precede first focus assertion');
  assert.match(traceText, /logcat -d -t 500 --pid 1234/);
  assert.match(traceText, /shell screencap -p \/sdcard\/kf-zns-after-failure\.png/);
  assert.match(summaryText, /Classification: `INCONCLUSIVE`/);
  assert.match(summaryText, /Commit: `b{40}`/);
  assert.doesNotMatch(result.stderr, /command not found/);
  assert.doesNotMatch(traceText, /shell input keyevent/);
});

test('a parsed other focused component is a real negative state, not parser uncertainty', () => {
  const {result, receipt} = runHarness('other');
  assert.equal(result.status, 1);
  assert.equal(receipt.app_state.after_launch.window_focus, 'no');
  assert.equal(receipt.app_state_diagnostics.after_launch.window_focus, 'other_component');
  assert.equal(receipt.classification, 'INFRA_FAILURE');
});

test('the harness accepts verified InputDispatcher focus when API 36 omits mCurrentFocus', () => {
  const {result, receipt, traceText} = runHarness('input-target');
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  assert.equal(receipt.harness_completed, true);
  assert.equal(receipt.app_state.after_launch.window_focus, 'yes');
  assert.equal(receipt.app_state_diagnostics.after_launch.window_manager_focus, 'entry_missing');
  assert.equal(receipt.app_state_diagnostics.after_launch.input_focus, 'input_target_window');
  assert.equal(receipt.app_state_diagnostics.after_launch.window_focus, 'input_target_window');
  assert.equal(receipt.app_state_diagnostics.after_launch.focus_source, 'input_dispatcher');
  assert.match(traceText, /shell dumpsys input/);
  assert.doesNotMatch(JSON.stringify(receipt), /secret|GeckoBrowserActivity|kulchaflo/);
});
