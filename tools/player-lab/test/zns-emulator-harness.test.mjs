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
  if [[ "$2" == "-c" ]]; then
    exit 0
  fi
  if [[ "\${TV_FAKE_RECOVERY:-no}" == retry ]]; then
    count=$(cat "$TV_AM_START_COUNT" 2>/dev/null || printf '0')
    printf '%s\\n' '11-14 12:00:00.000 1234 1234 I KfMkIIGV:GvTabs: session configured tabId=abc url=https://znsbahamas.com/'
    printf '%s\\n' '11-14 12:00:00.001 1234 1234 I KfMkIIGV:GvTabs: tab activated id=abc url=https://znsbahamas.com/ loading=true'
    printf '%s\\n' '11-14 12:00:00.002 1234 1234 I KfMkIIGV:GvNav: page start tabId=abc url=https://znsbahamas.com/'
    printf '%s\\n' '11-14 12:00:00.003 1234 1234 I KfMkIIGV:GvNav: page stop tabId=abc success=true url=https://znsbahamas.com/'
    if (( count >= 2 )); then
      printf '%s\\n' '11-14 12:00:00.004 1234 1234 I KfMkIIGV:GvMedia: zns helper phase=zns-embedded-helper-active mode=browser-first ready=-1 paused=true muted=true volume=-1.0'
      printf '%s\\n' '11-14 12:00:00.005 1234 1234 I KfMkIIGV:GvMedia: zns helper phase=zns-embedded-observed mode=browser-first ready=2 paused=true muted=true volume=0.25 networkState=2 mediaError=0 sourcePresent=true rendered=yes autoplay=false controls=true'
    else
      printf '%s\\n' '11-14 12:00:00.004 1234 1234 I KfMkIIGV:GvMedia: zns helper phase=zns-outer-frame-load-watch-attached mode=browser-first ready=-1 paused=true muted=true volume=-1.0'
      printf '%s\\n' '11-14 12:00:00.005 1234 1234 I KfMkIIGV:GvMedia: zns helper phase=zns-outer-frame-load-observed mode=browser-first ready=-1 paused=true muted=true volume=-1.0'
      printf '%s\\n' '11-14 12:00:00.006 1234 1234 I KfMkIIGV:GvMedia: zns helper phase=zns-outer-player-first mode=browser-first ready=0 paused=true muted=true volume=0.0'
    fi
    exit 0
  fi
  printf '%s\\n' '11-14 12:00:00.000 1234 1234 I KfMkIIGV:GvTabs: session configured tabId=abc url=https://znsbahamas.com/'
  printf '%s\\n' '11-14 12:00:00.001 1234 1234 I KfMkIIGV:GvTabs: tab activated id=abc url=https://znsbahamas.com/ loading=true'
  printf '%s\\n' '11-14 12:00:00.002 1234 1234 I KfMkIIGV:GvNav: page start tabId=abc url=https://znsbahamas.com/'
  printf '%s\\n' '11-14 12:00:00.003 1234 1234 I KfMkIIGV:GvNav: page stop tabId=abc success=true url=https://znsbahamas.com/'
  printf '%s\\n' '11-14 12:00:00.003 1234 1234 I KfMkIIGV:GvMedia: zns helper phase=zns-outer-frame-load-watch-attached mode=browser-first ready=-1 paused=true muted=true volume=-1.0'
  printf '%s\\n' '11-14 12:00:00.003 1234 1234 I KfMkIIGV:GvMedia: zns helper phase=zns-outer-frame-load-observed mode=browser-first ready=-1 paused=true muted=true volume=-1.0'
  printf '%s\\n' '11-14 12:00:00.004 1234 1234 I KfMkIIGV:GvMedia: zns helper phase=zns-outer-player-first mode=browser-first ready=0 paused=true muted=true volume=0.0'
  printf '%s\\n' '11-14 12:00:00.004 1234 1234 I KfMkIIGV:GvMedia: zns helper phase=zns-embedded-helper-active mode=browser-first ready=-1 paused=true muted=true volume=-1.0'
  printf '%s\\n' '11-14 12:00:00.004 1234 1234 I KfMkIIGV:GvMedia: zns helper phase=zns-embedded-observed mode=browser-first ready=4 paused=false muted=true volume=0.25 networkState=2 mediaError=0 sourcePresent=true rendered=yes autoplay=false controls=true'
  printf '%s\\n' '11-14 12:00:00.005 1234 1234 I KfMkIIGV:GvMedia: zns media event=loadedmetadata ready=4 paused=false muted=true volume=0.25 networkState=2 mediaError=0 sourcePresent=true rendered=yes autoplay=false controls=true'
  printf '%s\\n' '11-14 12:00:00.006 1234 1234 I KfMkIIGV:GvMedia: zns autoplay permission type=inaudible requested=other decision=allow'
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
    am)
      if [[ "\${TV_FAKE_RECOVERY:-no}" == retry ]]; then
        count=$(cat "$TV_AM_START_COUNT" 2>/dev/null || printf '0')
        printf '%s\\n' "$((count + 1))" > "$TV_AM_START_COUNT"
      fi
      printf 'Status: ok\\n'
      ;;
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

function runHarness(focusMode, recoveryMode = 'no') {
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
      TV_FAKE_RECOVERY: recoveryMode,
      TV_AM_START_COUNT: join(sandbox.root, 'activity-start-count.txt'),
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
  assert.equal(receipt.log_capture, 'complete', `${JSON.stringify(receipt)}\n${snapshot.stdout}\n${snapshot.stderr}\n${traceText}`);
  assert.deepEqual(receipt.observation_phases, ['zns-outer-player-first', 'zns-embedded-observed']);
  assert.deepEqual(receipt.launch_observations, {
    browser_session_configured: 'yes',
    browser_view_attached: 'yes',
    zns_navigation_requested: 'yes',
    zns_navigation_started: 'yes',
    zns_navigation_completed: 'yes',
    zns_navigation_failed: 'no',
  });
  assert.deepEqual(receipt.player_state, {ready: 4, paused: false, muted: true, volume: 0.25});
  assert.equal(receipt.embed_observed, 'yes');
  assert.equal(receipt.official_frame_observed, 'yes');
  assert.deepEqual(receipt.frame_lifecycle, {
    iframe_load_watch_attached: 'yes',
    iframe_load_event_after_watch: 'yes',
    embedded_helper_active_observed: 'yes',
  });
  assert.equal(receipt.media_diagnostics.source_present, true);
  assert.equal(receipt.media_diagnostics.network_state, 2);
  assert.deepEqual(receipt.media_diagnostics.events, ['loadedmetadata']);
  assert.deepEqual(receipt.media_diagnostics.autoplay_permission_events, [
    {type: 'inaudible', requested: 'other', decision: 'allow'},
  ]);
  assert.equal(receipt.diagnostic_success, false);
  assert.equal(receipt.diagnostic_cause, 'not_established');
  assert.equal(receipt.playback_progression, 'no');
  assert.equal(receipt.device_acceptance, 'not_tested');
  assert.doesNotMatch(JSON.stringify(receipt), /1234|GeckoBrowserActivity|android\.launcher|must-not-enter-receipt/);

  assert.ok(traceText.indexOf('shell screencap -p /sdcard/kf-zns-after-launch.png')
    < traceText.indexOf('shell dumpsys activity activities'), 'launch screenshot must precede first focus assertion');
  assert.match(traceText, /logcat -d --pid 1234/);
  assert.match(traceText, /shell screencap -p \/sdcard\/kf-zns-after-failure\.png/);
  assert.match(traceText, /shell screencap -p \/sdcard\/kf-zns-attempt-1-before\.png/);
  assert.match(summaryText, /Classification: `INCONCLUSIVE`/);
  assert.match(summaryText, /Commit: `b{40}`/);
  assert.match(summaryText, /Diagnostic success: `no`; cause: `not_established`/);
  assert.match(summaryText, /Navigation attempts: no attempt completed/);
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
  assert.equal(receipt.navigation_attempts.length, 1);
  assert.equal(receipt.navigation_attempts[0].attempt_number, 1);
  assert.equal(receipt.navigation_attempts[0].stop_observation, 'embedded_state_window_elapsed_without_time_advancement');
  assert.deepEqual(receipt.navigation_attempts[0].screenshots, {
    before: {file: 'zns-attempt-1-before.png', status: 'captured'},
    after: {file: 'zns-attempt-1-after.png', status: 'captured'},
  });
  assert.match(traceText, /shell dumpsys input/);
  assert.doesNotMatch(JSON.stringify(receipt), /secret|GeckoBrowserActivity|kulchaflo/);
});

test('one bounded fresh navigation recovers from a loaded outer frame without child-helper evidence', () => {
  const {result, receipt, traceText} = runHarness('target', 'retry');
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  assert.equal(receipt.classification, 'PLAYER_OBSERVED_NO_PROGRESS');
  assert.equal(receipt.navigation_attempts.length, 2);
  assert.equal(receipt.navigation_attempts[0].stop_observation, 'official_frame_seen_without_embedded_helper');
  assert.equal(receipt.navigation_attempts[0].after.iframe_load_event_after_watch, 'yes');
  assert.equal(receipt.navigation_attempts[0].after.embedded_helper_active_observed, 'no');
  assert.equal(receipt.navigation_attempts[1].recovery_reason, 'official_frame_without_embedded_helper');
  assert.equal(receipt.navigation_attempts[1].after.embedded_helper_active_observed, 'yes');
  assert.equal(receipt.navigation_attempts[1].after.embed_observed, 'yes');
  assert.equal(receipt.navigation_attempts[1].screenshots.before.status, 'captured');
  assert.equal(receipt.navigation_attempts[1].screenshots.after.status, 'captured');
  assert.match(traceText, /shell screencap -p \/sdcard\/kf-zns-attempt-1-after\.png/);
  assert.equal((traceText.match(/shell am start -W/g) || []).length, 2);
  assert.equal((traceText.match(/logcat -c/g) || []).length, 2);
  assert.doesNotMatch(JSON.stringify(receipt), /streamcomedia|znsbahamas\.com\?/);
});
