import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

const scripts = resolve(process.cwd(), 'scripts');
const stateTool = resolve(scripts, 'tv-emulator-state.py');
const logTool = resolve(scripts, 'tv-zns-log-snapshot.py');
const packageName = 'com.kulchaflo.tv.mk2.gv';

function parseState({pidof = {stdout: '412\n', returncode: 0}, activity = {}, window = {}} = {}) {
  const result = spawnSync('python3', [stateTool, '--parse-json'], {
    input: JSON.stringify({pidof, activity, window}),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('Android state reports only redacted target/other/unknown parser outcomes', () => {
  const target = parseState({
    activity: {stdout: `topResumedActivity=ActivityRecord{a ${packageName}/.app.GeckoBrowserActivity t5}`, returncode: 0},
    window: {stdout: `mCurrentFocus=Window{b ${packageName}/.app.GeckoBrowserActivity}`, returncode: 0},
  });
  assert.equal(target.process, 'yes');
  assert.equal(target.activity_foreground, 'yes');
  assert.equal(target.window_focus, 'yes');
  assert.equal(target.diagnostics.window_focus, 'target_component');

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
