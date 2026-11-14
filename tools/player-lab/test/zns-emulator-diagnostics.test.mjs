import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const scripts = resolve(process.cwd(), 'scripts');
const stateTool = resolve(scripts, 'tv-emulator-state.py');
const logTool = resolve(scripts, 'tv-zns-log-snapshot.py');
const packageName = 'com.kulchaflo.tv.mk2.gv';

function parseState({pidof = {stdout: '412\n', returncode: 0}, activity = {}, window = {}, input = {}} = {}) {
  const result = spawnSync('python3', [stateTool, '--parse-json'], {
    input: JSON.stringify({pidof, activity, window, input}),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function focusedWindow(packageName = 'com.kulchaflo.tv.mk2.gv', displayId = 0) {
  return {
    stdout: [
      'Input Dispatcher State:',
      '  FocusedWindows:',
      `    displayId=${displayId}, name='Window{abc u0 ${packageName}/.app.GeckoBrowserActivity}', token=secret-token`,
      '  FocusedApplications:',
      '    displayId=0, name=secret-application-token',
    ].join('\n'),
    returncode: 0,
  };
}

function captureWithStreamedInput(inputDump) {
  const root = mkdtempSync(join(tmpdir(), 'kf-input-dump-'));
  const bin = join(root, 'bin');
  const fixture = join(root, 'input-dump.txt');
  mkdirSync(bin);
  writeFileSync(fixture, inputDump);
  const adb = `#!/usr/bin/env bash
set -eu
case "$*" in
  "shell pidof com.kulchaflo.tv.mk2.gv") printf '412\\n' ;;
  "shell dumpsys activity activities") printf '%s\\n' 'topResumedActivity=ActivityRecord{a com.kulchaflo.tv.mk2.gv/.app.GeckoBrowserActivity t5}' ;;
  "shell dumpsys window windows") printf '%s\\n' 'mCurrentFocus=Window{b com.kulchaflo.tv.mk2.gv/.app.GeckoBrowserActivity}' ;;
  "shell dumpsys input") cat "$TV_INPUT_FIXTURE" ;;
esac
`;
  writeFileSync(join(bin, 'adb'), adb);
  chmodSync(join(bin, 'adb'), 0o755);
  const result = spawnSync('python3', [stateTool, 'capture'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      TV_INPUT_FIXTURE: fixture,
    },
  });
  rmSync(root, {recursive: true, force: true});
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('Android state reports only redacted target/other/unknown parser outcomes', () => {
  const target = parseState({
    activity: {stdout: `topResumedActivity=ActivityRecord{a ${packageName}/.app.GeckoBrowserActivity t5}`, returncode: 0},
    window: {stdout: `mCurrentFocus=Window{b ${packageName}/.app.GeckoBrowserActivity}`, returncode: 0},
    input: focusedWindow(),
  });
  assert.equal(target.process, 'yes');
  assert.equal(target.activity_foreground, 'yes');
  assert.equal(target.window_focus, 'yes');
  assert.equal(target.diagnostics.window_focus, 'target_component');
  assert.equal(target.diagnostics.input_focus, 'input_target_window');
  assert.equal(target.diagnostics.focus_source, 'both');

  const other = parseState({
    activity: {stdout: `topResumedActivity=ActivityRecord{a ${packageName}/.app.GeckoBrowserActivity t5}`, returncode: 0},
    window: {stdout: 'mCurrentFocus=Window{b com.android.launcher/.Launcher}', returncode: 0},
  });
  assert.equal(other.window_focus, 'no');
  assert.equal(other.diagnostics.window_focus, 'other_component');

  const absent = parseState({window: {stdout: '', returncode: 0}});
  assert.equal(absent.window_focus, 'unknown');
  assert.equal(absent.diagnostics.window_focus, 'entry_missing');
  const unreadable = parseState({window: {stdout: 'mCurrentFocus=Window{b splash without a component}', returncode: 0}});
  assert.equal(unreadable.window_focus, 'unknown');
  assert.equal(unreadable.diagnostics.window_focus, 'entry_unparsed');
  assert.doesNotMatch(JSON.stringify(other), /com\.android|GeckoBrowserActivity|412/);
});

test('truncated or unavailable Android state stays unknown unless target presence was observed', () => {
  const truncated = parseState({window: {
    stdout: `${'x'.repeat(64 * 1024)}mCurrentFocus=Window{b com.android.launcher/.Launcher}`,
    returncode: 0,
    truncated: true,
  }});
  assert.equal(truncated.window_focus, 'unknown');
  assert.equal(truncated.diagnostics.window_focus, 'output_truncated');
  const unavailable = parseState({window: {error: 'unavailable'}});
  assert.equal(unavailable.window_focus, 'unknown');
  assert.equal(unavailable.diagnostics.window_focus, 'command_unavailable');
});

test('null mCurrentFocus stays unknown when mFocusedApp reports the target activity', () => {
  const result = parseState({window: {stdout: [
    'mCurrentFocus=null',
    `mFocusedApp=ActivityRecord{a ${packageName}/.app.GeckoBrowserActivity t5}`,
  ].join('\n'), returncode: 0}});
  assert.equal(result.window_focus, 'unknown');
  assert.equal(result.diagnostics.window_focus, 'entry_unparsed');
  assert.equal(result.diagnostics.focus_source, 'unknown');
});

test('an other mCurrentFocus remains no when mFocusedApp reports the target activity', () => {
  const result = parseState({window: {stdout: [
    'mCurrentFocus=Window{b com.android.launcher/.Launcher}',
    `mFocusedApp=ActivityRecord{a ${packageName}/.app.GeckoBrowserActivity t5}`,
  ].join('\n'), returncode: 0}});
  assert.equal(result.window_focus, 'no');
  assert.equal(result.diagnostics.window_focus, 'other_component');
});

test('a target mCurrentFocus remains yes with a target mFocusedApp corroboration', () => {
  const result = parseState({window: {stdout: [
    `mCurrentFocus=Window{b ${packageName}/.app.GeckoBrowserActivity}`,
    `mFocusedApp=ActivityRecord{a ${packageName}/.app.GeckoBrowserActivity t5}`,
  ].join('\n'), returncode: 0}});
  assert.equal(result.window_focus, 'yes');
  assert.equal(result.diagnostics.window_focus, 'target_component');
});

test('truncated or unparseable mCurrentFocus stays unknown despite target mFocusedApp', () => {
  const unparseable = parseState({window: {stdout: [
    'mCurrentFocus=Window{b splash without a component}',
    `mFocusedApp=ActivityRecord{a ${packageName}/.app.GeckoBrowserActivity t5}`,
  ].join('\n'), returncode: 0}});
  assert.equal(unparseable.window_focus, 'unknown');
  assert.equal(unparseable.diagnostics.window_focus, 'entry_unparsed');

  const truncated = parseState({window: {
    stdout: [
      'mCurrentFocus=Window{b splash without a component}',
      `mFocusedApp=ActivityRecord{a ${packageName}/.app.GeckoBrowserActivity t5}`,
      'x'.repeat(64 * 1024),
    ].join('\n'),
    returncode: 0,
    truncated: true,
  }});
  assert.equal(truncated.window_focus, 'unknown');
  assert.equal(truncated.diagnostics.window_focus, 'entry_unparsed');
});

test('InputDispatcher focused display-0 window verifies API 36 focus when mCurrentFocus is absent', () => {
  const result = parseState({
    activity: {stdout: `topResumedActivity=ActivityRecord{a ${packageName}/.app.GeckoBrowserActivity t5}`, returncode: 0},
    window: {stdout: `mFocusedApp=ActivityRecord{a ${packageName}/.app.GeckoBrowserActivity t5}`, returncode: 0},
    input: focusedWindow(),
  });

  assert.equal(result.activity_foreground, 'yes');
  assert.equal(result.window_focus, 'yes');
  assert.equal(result.diagnostics.window_manager_focus, 'entry_missing');
  assert.equal(result.diagnostics.input_focus, 'input_target_window');
  assert.equal(result.diagnostics.window_focus, 'input_target_window');
  assert.equal(result.diagnostics.focus_source, 'input_dispatcher');
  assert.doesNotMatch(JSON.stringify(result), /secret|GeckoBrowserActivity|kulchaflo|Window\{/);
});

test('a verified other InputDispatcher window is lost app focus, distinct from missing diagnostics', () => {
  const lostFocus = parseState({
    window: {stdout: 'mFocusedApp=ActivityRecord{a com.kulchaflo.tv.mk2.gv/.app.GeckoBrowserActivity}', returncode: 0},
    input: focusedWindow('com.android.launcher', 0),
  });
  const missing = parseState({
    window: {stdout: 'mFocusedApp=ActivityRecord{a com.kulchaflo.tv.mk2.gv/.app.GeckoBrowserActivity}', returncode: 0},
    input: {stdout: 'Input Dispatcher State:\n  FocusedWindows:\n', returncode: 0},
  });

  assert.equal(lostFocus.window_focus, 'no');
  assert.equal(lostFocus.diagnostics.window_manager_focus, 'entry_missing');
  assert.equal(lostFocus.diagnostics.input_focus, 'input_other_window');
  assert.equal(lostFocus.diagnostics.window_focus, 'input_other_window');
  assert.equal(lostFocus.diagnostics.focus_source, 'input_dispatcher');
  assert.equal(missing.window_focus, 'unknown');
  assert.equal(missing.diagnostics.window_manager_focus, 'entry_missing');
  assert.equal(missing.diagnostics.input_focus, 'entry_missing');
  assert.equal(missing.diagnostics.focus_source, 'unknown');
});

test('conflicting, malformed, unavailable, and non-TV-display input evidence stays unknown', () => {
  const conflicting = parseState({
    window: {stdout: 'mCurrentFocus=Window{a com.android.launcher/.Launcher}', returncode: 0},
    input: focusedWindow(),
  });
  const malformed = parseState({input: {stdout: [
    'Input Dispatcher State:', '  FocusedWindows:', "    displayId=0, name='secret-window-without-component'",
  ].join('\n'), returncode: 0}});
  const unavailable = parseState({input: {error: 'unavailable'}});
  const otherDisplay = parseState({input: focusedWindow(packageName, 1)});
  const truncatedOther = parseState({input: {...focusedWindow('com.android.launcher'), truncated: true}});

  assert.equal(conflicting.window_focus, 'unknown');
  assert.equal(conflicting.diagnostics.window_focus, 'focus_signal_conflict');
  assert.equal(conflicting.diagnostics.focus_source, 'conflict');
  assert.equal(malformed.window_focus, 'unknown');
  assert.equal(malformed.diagnostics.input_focus, 'entry_unparsed');
  assert.equal(unavailable.window_focus, 'unknown');
  assert.equal(unavailable.diagnostics.input_focus, 'command_unavailable');
  assert.equal(otherDisplay.window_focus, 'unknown');
  assert.equal(otherDisplay.diagnostics.input_focus, 'entry_missing');
  assert.equal(truncatedOther.window_focus, 'unknown');
  assert.equal(truncatedOther.diagnostics.input_focus, 'output_truncated');
});

test('InputDispatcher with no FocusedWindows header fails closed without parser exceptions', () => {
  for (const stdout of [
    '',
    "Input Dispatcher State:\n  FocusedApplications:\n    displayId=0, name='secret-app'",
  ]) {
    const result = parseState({input: {stdout, returncode: 0}});
    assert.equal(result.window_focus, 'unknown');
    assert.equal(result.diagnostics.input_focus, 'entry_missing');
    assert.equal(result.diagnostics.focus_source, 'unknown');
    assert.doesNotMatch(JSON.stringify(result), /secret-app/);
  }

  const independentWindow = parseState({
    window: {stdout: `mCurrentFocus=Window{b ${packageName}/.app.GeckoBrowserActivity}`, returncode: 0},
    input: {stdout: 'Input Dispatcher State:', returncode: 0},
  });
  assert.equal(independentWindow.window_focus, 'yes');
  assert.equal(independentWindow.diagnostics.input_focus, 'entry_missing');
  assert.equal(independentWindow.diagnostics.focus_source, 'window_manager');
});

test('InputDispatcher finds a complete late section while streaming without retaining the dump', () => {
  const result = captureWithStreamedInput([
    'Input Dispatcher State:',
    'x'.repeat(100_000),
    '  FocusedWindows:',
    `    displayId=0, name='Window{abc u0 ${packageName}/.app.GeckoBrowserActivity}', token=private-token`,
    '  FocusedApplications:',
    '    displayId=0, name=private-application',
  ].join('\n'));
  assert.equal(result.window_focus, 'yes');
  assert.equal(result.diagnostics.input_focus, 'input_target_window');
  assert.equal(result.diagnostics.focus_source, 'both');
  assert.doesNotMatch(JSON.stringify(result), /private-token|private-application|x{100}/);

  const unclosed = captureWithStreamedInput([
    'Input Dispatcher State:',
    '  FocusedWindows:',
    `    displayId=0, name='Window{abc u0 ${packageName}/.app.GeckoBrowserActivity}'`,
  ].join('\n'));
  assert.equal(unclosed.window_focus, 'yes');
  assert.equal(unclosed.diagnostics.input_focus, 'output_truncated');
  assert.equal(unclosed.diagnostics.focus_source, 'window_manager');
});

test('InputDispatcher incomplete, duplicate, malformed, unavailable, and timed-out evidence is unknown', () => {
  const target = focusedWindow();
  const incomplete = parseState({input: {...target, section_complete: false}});
  const duplicateSection = parseState({input: {...target, section_count: 2}});
  const duplicateDisplay = parseState({input: {
    stdout: [
      'Input Dispatcher State:', '  FocusedWindows:',
      `    displayId=0, name='Window{abc ${packageName}/.app.GeckoBrowserActivity}'`,
      `    displayId=0, name='Window{def ${packageName}/.app.GeckoBrowserActivity}'`,
      '  FocusedApplications:',
    ].join('\n'), returncode: 0,
  }});
  const longMalformed = parseState({input: {
    stdout: `Input Dispatcher State:\n  FocusedWindows:\n    displayId=0, name='${'x'.repeat(9000)}`, returncode: 0,
  }});
  const unavailable = parseState({input: {error: 'unavailable'}});
  const timeout = parseState({input: {error: 'timeout'}});
  for (const result of [incomplete, duplicateSection, duplicateDisplay, longMalformed, unavailable, timeout]) {
    assert.equal(result.window_focus, 'unknown');
  }
  assert.equal(incomplete.diagnostics.input_focus, 'output_truncated');
  assert.equal(duplicateSection.diagnostics.input_focus, 'ambiguous_components');
  assert.equal(duplicateDisplay.diagnostics.input_focus, 'ambiguous_components');
  assert.equal(longMalformed.diagnostics.input_focus, 'entry_unparsed');
  assert.equal(unavailable.diagnostics.input_focus, 'command_unavailable');
  assert.equal(timeout.diagnostics.input_focus, 'command_timeout');
  assert.doesNotMatch(JSON.stringify(longMalformed), /x{100}/);
});

test('streamed InputDispatcher timeout terminates the command and preserves an unknown result', () => {
  const root = mkdtempSync(join(tmpdir(), 'kf-input-timeout-'));
  const bin = join(root, 'bin');
  mkdirSync(bin);
  const adb = join(bin, 'adb');
  writeFileSync(adb, '#!/bin/sh\nexec sleep 5\n');
  chmodSync(adb, 0o755);
  const probe = 'import json,runpy,sys; m=runpy.run_path(sys.argv[1]); c=m["run_input_dispatcher"](timeout=0.1); print(json.dumps(m["parse_capture"]({"input": c})))';
  const result = spawnSync('python3', ['-c', probe, stateTool], {
    encoding: 'utf8',
    env: {...process.env, PATH: `${bin}:${process.env.PATH}`},
    timeout: 3000,
  });
  rmSync(root, {recursive: true, force: true});
  assert.equal(result.status, 0, result.stderr);
  const state = JSON.parse(result.stdout);
  assert.equal(state.window_focus, 'unknown');
  assert.equal(state.diagnostics.input_focus, 'command_timeout');
});

test('truncated InputDispatcher dumps cannot establish focus from a retained prefix', () => {
  const target = focusedWindow();
  const other = focusedWindow('com.android.launcher');
  const oversized = {...target, stdout: `${target.stdout}\n${'x'.repeat(64 * 1024)}`};
  for (const input of [
    {...target, truncated: true},
    {...other, truncated: true},
    oversized,
  ]) {
    const result = parseState({input});
    assert.equal(result.window_focus, 'unknown');
    assert.equal(result.diagnostics.input_focus, 'output_truncated');
    assert.equal(result.diagnostics.window_focus, 'entry_missing');
    assert.equal(result.diagnostics.focus_source, 'unknown');
    assert.doesNotMatch(JSON.stringify(result), /secret|GeckoBrowserActivity|com\.android/);
  }

  // An independently complete WindowManager signal remains usable;
  // incomplete InputDispatcher evidence must not corroborate it.
  const windowManager = parseState({
    window: {stdout: `mCurrentFocus=Window{b ${packageName}/.app.GeckoBrowserActivity}`, returncode: 0},
    input: {...target, truncated: true},
  });
  assert.equal(windowManager.window_focus, 'yes');
  assert.equal(windowManager.diagnostics.window_focus, 'target_component');
  assert.equal(windowManager.diagnostics.input_focus, 'output_truncated');
  assert.equal(windowManager.diagnostics.focus_source, 'window_manager');
});

test('log snapshot retains only bounded allowlisted phases and player scalars', () => {
  const input = [
    '11-14 12:00:00.000 1234 1234 I KfMkIIGV:GvTabs: session configured tabId=abc url=https://znsbahamas.com/',
    '11-14 12:00:00.001 1234 1234 I KfMkIIGV:GvTabs: tab activated id=abc url=https://znsbahamas.com/',
    '11-14 12:00:00.002 1234 1234 I KfMkIIGV:GvNav: page start tabId=abc url=https://znsbahamas.com/?session=secret',
    '11-14 12:00:00.003 1234 1234 I KfMkIIGV:GvNav: page stop tabId=abc success=true url=https://znsbahamas.com/',
    '11-14 12:00:00.004 1234 1234 I KfMkIIGV:GvMedia: zns helper phase=zns-outer-player-first mode=browser-first ready=0 paused=true muted=true volume=0.0',
    '11-14 12:00:00.005 1234 1234 I KfMkIIGV:GvMedia: zns helper phase=zns-embedded-observed mode=browser-first ready=4 paused=false muted=true volume=0.25 networkState=2 mediaError=0 sourcePresent=true rendered=yes autoplay=true controls=false',
    '11-14 12:00:00.005 1234 1234 I KfMkIIGV:GvMedia: zns media event=waiting ready=0 paused=true muted=false volume=1.0 networkState=2 mediaError=0 sourcePresent=true rendered=yes autoplay=true controls=false',
    '11-14 12:00:00.005 1234 1234 E KfMkIIGV:GvMedia: zns media event=error ready=0 paused=true muted=false volume=1.0 networkState=3 mediaError=4 sourcePresent=true rendered=yes autoplay=true controls=false',
    '11-14 12:00:00.005 1234 1234 I KfMkIIGV:GvMedia: zns autoplay permission type=audible requested=other decision=allow',
    '11-14 12:00:00.006 1234 1234 I KfMkIIGV:GvMedia: zns helper phase=zns-video-time-advanced mode=browser-first ready=4 paused=false muted=true volume=0.25',
    '11-14 12:00:00.007 1234 1234 I KfMkIIGV:GvMedia: private token=never-copy https://example.invalid/?session=secret',
  ].join('\n');
  const result = spawnSync('python3', [logTool, '--parse'], {input, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.capture_status, 'complete');
  assert.deepEqual(report.observation_phases, [
    'zns-outer-player-first', 'zns-embedded-observed', 'zns-video-time-advanced',
  ]);
  assert.deepEqual(report.player_state, {ready: 4, paused: false, muted: true, volume: 0.25});
  assert.equal(report.official_frame_observed, 'yes');
  assert.equal(report.embed_observed, 'yes');
  assert.deepEqual(report.media_diagnostics, {
    observed: 'yes',
    network_state: 3,
    media_error_code: 4,
    error_observed: 'yes',
    source_present: true,
    rendered: 'yes',
    autoplay: true,
    controls: false,
    events_observed: 'yes',
    events: ['waiting', 'error'],
    autoplay_permission_observed: 'yes',
    autoplay_permission_events: [{type: 'audible', requested: 'other', decision: 'allow'}],
  });
  assert.equal(report.video_time_advanced_observed, 'yes');
  assert.deepEqual(report.launch_observations, {
    browser_session_configured: 'yes',
    browser_view_attached: 'yes',
    zns_navigation_requested: 'yes',
    zns_navigation_started: 'yes',
    zns_navigation_completed: 'yes',
    zns_navigation_failed: 'no',
  });
  assert.doesNotMatch(result.stdout, /private|secret|example\.invalid/);

  const incomplete = spawnSync('python3', [logTool, '--parse'], {
    input: 'x'.repeat(70 * 1024),
    encoding: 'utf8',
  });
  assert.equal(incomplete.status, 0, incomplete.stderr);
  const incompleteReport = JSON.parse(incomplete.stdout);
  assert.equal(incompleteReport.capture_status, 'truncated');
  assert.equal(incompleteReport.embed_observed, 'unknown');
  assert.equal(incompleteReport.media_diagnostics.observed, 'unknown');

  const oversized = spawnSync('python3', [logTool, '--parse'], {
    input: `token=hidden\n${'x'.repeat(70 * 1024)}`,
    encoding: 'utf8',
  });
  assert.equal(JSON.parse(oversized.stdout).capture_status, 'truncated');
  assert.doesNotMatch(oversized.stdout, /hidden/);
});

test('ZNS navigation failures reported with GeckoView uri fields are detected without retaining URLs', () => {
  const input = [
    '11-14 12:00:00.000 1234 1234 E KfMkIIGV:GvNav: load error tabId=abc uri=https://znsbahamas.com/?session=secret category=3 code=-11',
    '11-14 12:00:00.001 1234 1234 E KfMkIIGV:GvNav: load error tabId=abc uri=https://other.invalid/ category=3 code=-11',
    '11-14 12:00:00.002 1234 1234 E/GvNav: load error tabId=abc uri=https://znsbahamas.com/private category=3 code=-11',
  ].join('\n');
  const result = spawnSync('python3', [logTool, '--parse'], {input, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.launch_observations.zns_navigation_failed, 'yes');
  assert.doesNotMatch(result.stdout, /znsbahamas|other\.invalid|secret/);
});

test('log capture keeps navigation evidence older than a fixed 500-line tail', () => {
  const root = mkdtempSync(join(tmpdir(), 'kf-log-tail-'));
  const bin = join(root, 'bin');
  mkdirSync(bin);
  const adb = join(bin, 'adb');
  writeFileSync(adb, `#!/usr/bin/env bash
set -eu
case "$*" in
  "shell pidof com.kulchaflo.tv.mk2.gv") printf '412\\n' ;;
  "logcat -d --pid 412")
    printf '%s\\n' '11-14 12:00:00.000 412 412 I KfMkIIGV:GvNav: page start tabId=abc url=https://znsbahamas.com/'
    for i in {1..600}; do printf '%s\\n' "11-14 12:00:00.001 412 412 I KfMkIIGV:GvMedia: unrelated diagnostic $i"; done
    ;;
  "logcat -d -t 500 --pid 412")
    for i in {1..500}; do printf '%s\\n' "11-14 12:00:00.001 412 412 I KfMkIIGV:GvMedia: unrelated diagnostic $i"; done
    ;;
  *) exit 2 ;;
esac
`);
  chmodSync(adb, 0o755);
  const result = spawnSync('python3', [logTool, 'capture'], {
    encoding: 'utf8',
    env: {...process.env, PATH: `${bin}:${process.env.PATH}`},
  });
  rmSync(root, {recursive: true, force: true});
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.capture_status, 'complete');
  assert.equal(report.launch_observations.zns_navigation_started, 'yes');
});
