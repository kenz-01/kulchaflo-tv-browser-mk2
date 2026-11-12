import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

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
  const unavailable = parseState({input: {error: 'timeout'}});
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

test('log snapshot retains only bounded allowlisted phases and player scalars', () => {
  const input = [
    'I/GvMedia: zns helper phase=zns-outer-player-first mode=browser-first ready=0 paused=true muted=true volume=0.0',
    'I/GvMedia: zns helper phase=zns-embedded-observed mode=browser-first ready=4 paused=false muted=true volume=0.25',
    'I/GvMedia: zns helper phase=zns-video-time-advanced mode=browser-first ready=4 paused=false muted=true volume=0.25',
    'I/GvMedia: private token=never-copy https://example.invalid/?session=secret',
  ].join('\n');
  const result = spawnSync('python3', [logTool, '--parse'], {input, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.capture_status, 'complete');
  assert.deepEqual(report.observation_phases, [
    'zns-outer-player-first', 'zns-embedded-observed', 'zns-video-time-advanced',
  ]);
  assert.deepEqual(report.player_state, {ready: 4, paused: false, muted: true, volume: 0.25});
  assert.equal(report.video_time_advanced_observed, 'yes');
  assert.doesNotMatch(result.stdout, /private|secret|example\.invalid/);

  const oversized = spawnSync('python3', [logTool, '--parse'], {
    input: `token=hidden\n${'x'.repeat(70 * 1024)}`,
    encoding: 'utf8',
  });
  assert.equal(JSON.parse(oversized.stdout).capture_status, 'truncated');
  assert.doesNotMatch(oversized.stdout, /hidden/);
});
