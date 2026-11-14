import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyZnsFeedback} from '../src/zns-feedback-outcome.mjs';

const allAppState = (status = 'yes') => Object.fromEntries(
  ['after_launch', 'after_dpad', 'after_back'].map((checkpoint) => [checkpoint, {
    process: status,
    activity_foreground: status,
    window_focus: status,
  }]),
);

function completeEvidence(overrides = {}) {
  return {
    commit: 'a'.repeat(40),
    profile: 'zns',
    source_url: 'https://znsbahamas.com/',
    infrastructure: {emulator_boot: 'yes', apk_install: 'yes', app_launch: 'yes'},
    app_state: allAppState(),
    screenshots: {after_dpad: 'captured', after_back: 'captured'},
    actions: {dpad_down_up_dispatched: 'yes', back_dispatched: 'yes'},
    log_capture: 'complete',
    observation_phases: [],
    player_state: null,
    video_time_advanced_observed: 'no',
    ...overrides,
  };
}

test('classifies actual bounded current-time advancement without claiming live video or audio', () => {
  const receipt = classifyZnsFeedback(completeEvidence({
    observation_phases: ['zns-outer-player-first', 'zns-embedded-observed', 'zns-video-time-advanced'],
    player_state: {ready: '4', paused: 'false', muted: 'true', volume: '0.35'},
    video_time_advanced_observed: 'yes',
  }));

  assert.equal(receipt.classification, 'PROGRESSION_OBSERVED');
  assert.equal(receipt.harness_completed, true);
  assert.equal(receipt.commit, 'a'.repeat(40));
  assert.equal(receipt.selected_profile, 'zns');
  assert.equal(receipt.source.observed, true);
  assert.equal(receipt.player_state.muted, true);
  assert.equal(receipt.player_state.volume, 0.35);
  assert.deepEqual(receipt.screenshots.after_dpad, {file: 'zns-after-dpad.png', status: 'captured'});
  assert.deepEqual(receipt.actions, {dpad_down_up_dispatched: 'yes', back_dispatched: 'yes'});
  assert.equal(receipt.moving_picture_verified, false);
  assert.equal(receipt.live_stream_verified, false);
  assert.equal(receipt.audio_output_verified, false);
});

test('classifies a complete run with no ZNS observation separately from a player with no progression', () => {
  const noSource = classifyZnsFeedback(completeEvidence());
  const noProgress = classifyZnsFeedback(completeEvidence({
    observation_phases: ['zns-outer-player-first', 'zns-embedded-observed'],
    player_state: {ready: '4', paused: 'true', muted: 'true', volume: '0.35'},
  }));

  assert.equal(noSource.classification, 'SOURCE_NOT_OBSERVED');
  assert.equal(noSource.harness_completed, true);
  assert.equal(noSource.source.observed, false);
  assert.equal(noProgress.classification, 'PLAYER_OBSERVED_NO_PROGRESS');
  assert.equal(noProgress.video_time_advanced_observed, 'no');
});

test('foreground app launch does not imply GeckoView readiness or ZNS navigation', () => {
  const receipt = classifyZnsFeedback(completeEvidence({
    launch_observations: {
      browser_session_configured: 'no',
      browser_view_attached: 'no',
      zns_navigation_requested: 'no',
      zns_navigation_started: 'no',
      zns_navigation_completed: 'no',
      zns_navigation_failed: 'no',
    },
  }));
  assert.equal(receipt.app_state.after_launch.activity_foreground, 'yes');
  assert.equal(receipt.launch_observations.browser_session_configured, 'no');
  assert.equal(receipt.launch_observations.zns_navigation_started, 'no');
  assert.equal(receipt.classification, 'SOURCE_NOT_OBSERVED');
  assert.equal(receipt.source.observed, false);
});

test('classifies missing or contradictory evidence as inconclusive, never as progression', () => {
  const screenshotMissing = classifyZnsFeedback(completeEvidence({
    screenshots: {after_dpad: 'captured', after_back: 'missing'},
    observation_phases: ['zns-embedded-observed', 'zns-video-time-advanced'],
    player_state: {ready: '4', paused: 'false', muted: 'false', volume: '1'},
    video_time_advanced_observed: 'yes',
  }));
  const outerOnly = classifyZnsFeedback(completeEvidence({
    observation_phases: ['zns-outer-player-first'],
  }));
  const phaseConflict = classifyZnsFeedback(completeEvidence({
    observation_phases: ['zns-embedded-observed', 'zns-video-time-advanced'],
    player_state: {ready: '4', paused: 'false', muted: 'false', volume: '1'},
    video_time_advanced_observed: 'no',
  }));
  const missingPlayerState = classifyZnsFeedback(completeEvidence({
    observation_phases: ['zns-embedded-observed'],
  }));
  const missingActionEvidence = classifyZnsFeedback(completeEvidence({
    actions: {dpad_down_up_dispatched: 'yes'},
  }));

  for (const receipt of [screenshotMissing, outerOnly, phaseConflict, missingPlayerState, missingActionEvidence]) {
    assert.equal(receipt.classification, 'INCONCLUSIVE');
    assert.equal(receipt.moving_picture_verified, false);
  }
});

test('classifies emulator and required app-state failures as infrastructure failures', () => {
  const emulatorFailure = classifyZnsFeedback(completeEvidence({
    infrastructure: {emulator_boot: 'no', apk_install: 'unknown', app_launch: 'unknown'},
    failure_stage: 'emulator_boot',
  }));
  const focusFailure = classifyZnsFeedback(completeEvidence({
    app_state: {
      ...allAppState(),
      after_back: {process: 'yes', activity_foreground: 'no', window_focus: 'no'},
    },
  }));

  assert.equal(emulatorFailure.classification, 'INFRA_FAILURE');
  assert.equal(focusFailure.classification, 'INFRA_FAILURE');
  assert.equal(emulatorFailure.harness_completed, false);
});

test('an unparseable focus entry stays inconclusive while a parsed other window is a real failure', () => {
  const uncertainFocus = classifyZnsFeedback(completeEvidence({
    app_state: {
      ...allAppState(),
      after_launch: {process: 'yes', activity_foreground: 'yes', window_focus: 'unknown'},
    },
    app_state_diagnostics: {
      after_launch: {pidof: 'target_process', activity_foreground: 'target_component', window_focus: 'entry_missing'},
    },
    failure_state: {process: 'yes', activity_foreground: 'yes', window_focus: 'unknown'},
    failure_stage: 'required_app_state',
    launch_status: 'confirmed',
  }));
  const otherWindow = classifyZnsFeedback(completeEvidence({
    app_state: {
      ...allAppState(),
      after_launch: {process: 'yes', activity_foreground: 'yes', window_focus: 'no'},
    },
    app_state_diagnostics: {
      after_launch: {pidof: 'target_process', activity_foreground: 'target_component', window_focus: 'other_component'},
    },
    failure_stage: 'required_app_state',
  }));

  assert.equal(uncertainFocus.classification, 'INCONCLUSIVE');
  assert.equal(uncertainFocus.failure_stage, 'required_app_state');
  assert.equal(uncertainFocus.app_state_diagnostics.after_launch.window_focus, 'entry_missing');
  assert.equal(uncertainFocus.failure_state.window_focus, 'unknown');
  assert.equal(otherWindow.classification, 'INFRA_FAILURE');
  assert.equal(otherWindow.app_state_diagnostics.after_launch.window_focus, 'other_component');
});

test('focus service evidence is allowlisted and missing diagnostics remain unknown', () => {
  const receipt = classifyZnsFeedback(completeEvidence({
    app_state: {
      ...allAppState(),
      after_launch: {process: 'yes', activity_foreground: 'yes', window_focus: 'unknown'},
    },
    app_state_diagnostics: {
      after_launch: {
        pidof: 'target_process',
        activity_foreground: 'target_component',
        window_focus: 'entry_missing',
        window_manager_focus: 'entry_missing',
        input_focus: 'entry_missing',
        focus_source: 'untrusted token=secret',
      },
    },
  }));

  assert.equal(receipt.classification, 'INCONCLUSIVE');
  assert.deepEqual(receipt.app_state_diagnostics.after_launch, {
    pidof: 'target_process',
    activity_foreground: 'target_component',
    window_focus: 'entry_missing',
    window_manager_focus: 'entry_missing',
    input_focus: 'entry_missing',
    focus_source: 'unknown',
  });
  assert.doesNotMatch(JSON.stringify(receipt), /secret|untrusted/);
});

test('install, launch, profile, and commit prerequisites fail closed', () => {
  const installFailure = classifyZnsFeedback(completeEvidence({
    infrastructure: {emulator_boot: 'yes', apk_install: 'no', app_launch: 'unknown'},
    failure_stage: 'apk_install',
  }));
  const launchFailure = classifyZnsFeedback(completeEvidence({
    infrastructure: {emulator_boot: 'yes', apk_install: 'yes', app_launch: 'no'},
    failure_stage: 'launch',
  }));
  const identityIncomplete = classifyZnsFeedback(completeEvidence({commit: 'main', profile: 'qualification'}));

  assert.equal(installFailure.classification, 'INFRA_FAILURE');
  assert.equal(launchFailure.classification, 'INFRA_FAILURE');
  assert.equal(identityIncomplete.classification, 'INCONCLUSIVE');
  assert.equal(identityIncomplete.commit, 'unknown');
  assert.equal(identityIncomplete.selected_profile, 'unknown');
});

test('receipt whitelists log phases and never copies arbitrary diagnostic strings', () => {
  const receipt = classifyZnsFeedback(completeEvidence({
    observation_phases: ['zns-embedded-observed', 'secret token=private'],
    player_state: {ready: '4', paused: 'true', muted: 'true', volume: '0'},
  }));

  assert.equal(receipt.classification, 'INCONCLUSIVE');
  assert.deepEqual(receipt.observation_phases, []);
  assert.doesNotMatch(JSON.stringify(receipt), /private|secret/);
});

test('passive continuation with withheld remote keys cannot be reported as completed playback', () => {
  const receipt = classifyZnsFeedback(completeEvidence({
    observation_phases: ['zns-outer-player-first', 'zns-embedded-observed', 'zns-video-time-advanced'],
    player_state: {ready: '4', paused: 'false', muted: 'true', volume: '0.35'},
    video_time_advanced_observed: 'yes',
    diagnostic_continuation: {
      mode: 'passive_focus_unknown',
      additional_passive_observation: 'yes',
      remote_keys_withheld: 'yes',
    },
  }));
  assert.equal(receipt.classification, 'INCONCLUSIVE');
  assert.equal(receipt.harness_completed, false);
  assert.equal(receipt.video_time_advanced_observed, 'yes');
  assert.equal(receipt.diagnostic_continuation.remote_keys_withheld, 'yes');
  assert.equal(receipt.moving_picture_verified, false);
});
