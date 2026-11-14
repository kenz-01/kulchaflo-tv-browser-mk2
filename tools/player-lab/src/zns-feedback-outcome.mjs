import {pathToFileURL} from 'node:url';

const SOURCE_URL = 'https://znsbahamas.com/';
const PHASES = new Set([
  'zns-outer-player-first',
  'zns-embedded-observed',
  'zns-embedded-playing',
  'zns-video-time-advanced',
]);
const APP_CHECKPOINTS = ['after_launch', 'after_dpad', 'after_back'];
const INFRA_FAILURE_STAGES = new Set([
  'preflight',
  'workflow_setup',
  'kvm_preflight',
  'apk_assembly',
  'emulator_boot',
  'apk_install',
  'interaction_capture',
]);
const FAILURE_STAGES = new Set([
  ...INFRA_FAILURE_STAGES,
  'launch',
  'required_app_state',
  'emulator_step',
  'evidence_capture',
  'log_capture',
  'complete',
]);
const APP_DIAGNOSTICS = new Set([
  'target_process', 'process_absent', 'unavailable', 'unparseable', 'output_truncated',
  'target_component', 'other_component', 'entry_missing', 'entry_unparsed',
  'ambiguous_components', 'too_many_entries', 'command_unavailable',
  'input_target_window', 'input_other_window', 'focus_signal_conflict',
]);
const FOCUS_SOURCES = new Set(['window_manager', 'input_dispatcher', 'both', 'conflict', 'unknown']);

const isStatus = (value) => value === 'yes' || value === 'no';
const asBoolean = (value) => value === true || value === 'true';

function validPlayerState(state) {
  if (!state || !/^[0-4]$/.test(String(state.ready ?? ''))) return false;
  if (!['true', 'false', true, false].includes(state.paused)) return false;
  if (!['true', 'false', true, false].includes(state.muted)) return false;
  const volume = Number(state.volume);
  return Number.isFinite(volume) && volume >= 0 && volume <= 1;
}

function safeAppState(appState = {}) {
  return Object.fromEntries(APP_CHECKPOINTS.map((checkpoint) => {
    const state = appState[checkpoint] ?? {};
    return [checkpoint, {
      process: isStatus(state.process) ? state.process : 'unknown',
      activity_foreground: isStatus(state.activity_foreground) ? state.activity_foreground : 'unknown',
      window_focus: isStatus(state.window_focus) ? state.window_focus : 'unknown',
    }];
  }));
}

function safeScreenshots(screenshots = {}) {
  const status = (value) => ['captured', 'missing', 'oversize'].includes(value) ? value : 'missing';
  return {
    after_launch: {
      file: 'zns-after-launch.png',
      status: status(screenshots.after_launch),
    },
    after_dpad: {
      file: 'zns-after-dpad.png',
      status: status(screenshots.after_dpad),
    },
    after_back: {
      file: 'zns-after-back.png',
      status: status(screenshots.after_back),
    },
    after_failure: {
      file: 'zns-after-failure.png',
      status: status(screenshots.after_failure),
    },
  };
}

function safeAppDiagnostics(diagnostics = {}) {
  return Object.fromEntries(['after_launch', 'after_dpad', 'after_back', 'after_failure'].map((checkpoint) => {
    const state = diagnostics[checkpoint] ?? {};
    const safe = (value) => APP_DIAGNOSTICS.has(value) ? value : 'unavailable';
    return [checkpoint, {
      pidof: safe(state.pidof),
      activity_foreground: safe(state.activity_foreground),
      window_focus: safe(state.window_focus),
      window_manager_focus: safe(state.window_manager_focus),
      input_focus: safe(state.input_focus),
      focus_source: FOCUS_SOURCES.has(state.focus_source) ? state.focus_source : 'unknown',
    }];
  }));
}

function safeActions(actions = {}) {
  return {
    dpad_down_up_dispatched: isStatus(actions.dpad_down_up_dispatched)
      ? actions.dpad_down_up_dispatched
      : 'unknown',
    back_dispatched: isStatus(actions.back_dispatched) ? actions.back_dispatched : 'unknown',
  };
}

function safePlayerState(state) {
  if (!validPlayerState(state)) return null;
  return {
    ready: Number(state.ready),
    paused: asBoolean(state.paused),
    muted: asBoolean(state.muted),
    volume: Number(state.volume),
  };
}

/** Classify only bounded, sanitized ZNS observations; this never claims live playback. */
export function classifyZnsFeedback(evidence = {}) {
  const phasesAreValid = Array.isArray(evidence.observation_phases)
    && evidence.observation_phases.every((phase) => PHASES.has(phase));
  const phases = phasesAreValid ? [...new Set(evidence.observation_phases)] : [];
  const appState = safeAppState(evidence.app_state);
  const appDiagnostics = safeAppDiagnostics(evidence.app_state_diagnostics);
  const failureState = Object.fromEntries(['process', 'activity_foreground', 'window_focus'].map((key) => [
    key,
    isStatus(evidence.failure_state?.[key]) ? evidence.failure_state[key] : 'unknown',
  ]));
  const screenshots = safeScreenshots(evidence.screenshots);
  const actions = safeActions(evidence.actions);
  const playerState = safePlayerState(evidence.player_state);
  const infra = evidence.infrastructure ?? {};
  const failureStage = FAILURE_STAGES.has(evidence.failure_stage)
    ? evidence.failure_stage
    : null;

  const explicitInfraFailure = INFRA_FAILURE_STAGES.has(failureStage)
    || failureStage === 'launch' && evidence.infrastructure?.app_launch === 'no'
    || failureStage === 'required_app_state'
      && APP_CHECKPOINTS.some((checkpoint) => Object.values(appState[checkpoint]).includes('no'))
    || infra.emulator_boot === 'no'
    || infra.apk_install === 'no'
    || infra.app_launch === 'no'
    || APP_CHECKPOINTS.some((checkpoint) => Object.values(appState[checkpoint]).includes('no'));

  let classification = 'INCONCLUSIVE';
  let reason = 'Evidence is incomplete or contradictory.';
  if (explicitInfraFailure) {
    classification = 'INFRA_FAILURE';
    reason = 'Emulator, install, launch, or required app process/focus state failed.';
  } else {
    const appStateComplete = APP_CHECKPOINTS.every((checkpoint) =>
      Object.values(appState[checkpoint]).every((value) => value === 'yes'));
    const infrastructureComplete = infra.emulator_boot === 'yes'
      && infra.apk_install === 'yes'
      && infra.app_launch === 'yes';
    const evidenceCaptureComplete = evidence.log_capture === 'complete'
      && screenshots.after_dpad.status === 'captured'
      && screenshots.after_back.status === 'captured';
    const interactionsComplete = actions.dpad_down_up_dispatched === 'yes'
      && actions.back_dispatched === 'yes';
    const identityComplete = /^[a-f\d]{40}$/i.test(String(evidence.commit ?? ''))
      && evidence.profile === 'zns'
      && evidence.source_url === SOURCE_URL;
    const baseComplete = appStateComplete && infrastructureComplete && evidenceCaptureComplete && interactionsComplete && identityComplete;
    const progressionFlag = evidence.video_time_advanced_observed === 'yes'
      || evidence.video_time_advanced_observed === true;
    const progressionPhase = phases.includes('zns-video-time-advanced');
    const embeddedPhase = phases.includes('zns-embedded-observed');

    if (!baseComplete || !phasesAreValid || !isStatus(evidence.video_time_advanced_observed)) {
      reason = 'Required run identity, app state, screenshot, log, or phase evidence is incomplete.';
    } else if (progressionFlag !== progressionPhase) {
      reason = 'The bounded progression flag conflicts with the allowlisted observation phases.';
    } else if (phases.length === 0 && !playerState) {
      classification = 'SOURCE_NOT_OBSERVED';
      reason = 'The bounded run completed, but no ZNS player observation phase was recorded.';
    } else if (!embeddedPhase || !playerState) {
      reason = 'Source/player-related evidence exists, but a complete embedded-player state was not observed.';
    } else if (progressionPhase) {
      classification = 'PROGRESSION_OBSERVED';
      reason = 'The official embedded player reported bounded current-time advancement; live video and audio remain unverified.';
    } else {
      classification = 'PLAYER_OBSERVED_NO_PROGRESS';
      reason = 'The official embedded player state was observed without bounded current-time advancement.';
    }
  }

  const allRequiredAppState = APP_CHECKPOINTS.every((checkpoint) =>
    Object.values(appState[checkpoint]).every((value) => value === 'yes'));
  const harnessCompleted = evidence.infrastructure?.emulator_boot === 'yes'
    && evidence.infrastructure?.apk_install === 'yes'
    && evidence.infrastructure?.app_launch === 'yes'
    && allRequiredAppState
    && evidence.log_capture === 'complete'
    && screenshots.after_dpad.status === 'captured'
    && screenshots.after_back.status === 'captured'
    && actions.dpad_down_up_dispatched === 'yes'
    && actions.back_dispatched === 'yes';

  return {
    schema_version: 1,
    receipt_finalized: true,
    harness_completed: Boolean(harnessCompleted),
    commit: /^[a-f\d]{40}$/i.test(String(evidence.commit ?? '')) ? evidence.commit.toLowerCase() : 'unknown',
    selected_profile: evidence.profile === 'zns' ? 'zns' : 'unknown',
    source: {
      url: evidence.source_url === SOURCE_URL ? SOURCE_URL : 'unknown',
      identification: evidence.source_url === SOURCE_URL ? 'official_zns_bahamas_route_requested' : 'unknown',
      observed: phases.includes('zns-outer-player-first') || phases.includes('zns-embedded-observed'),
    },
    infrastructure: {
      emulator_boot: isStatus(infra.emulator_boot) ? infra.emulator_boot : 'unknown',
      apk_install: isStatus(infra.apk_install) ? infra.apk_install : 'unknown',
      app_launch: isStatus(infra.app_launch) ? infra.app_launch : 'unknown',
    },
    app_state: appState,
    app_state_diagnostics: appDiagnostics,
    failure_state: failureState,
    screenshots,
    actions,
    log_capture: evidence.log_capture === 'complete' ? 'complete' : 'incomplete',
    observation_phases: phases,
    player_state: playerState,
    video_time_advanced_observed: evidence.video_time_advanced_observed === 'yes' ? 'yes' : 'no',
    classification,
    reason,
    failure_stage: failureStage,
    launch_status: ['confirmed', 'failed', 'unconfirmed'].includes(evidence.launch_status)
      ? evidence.launch_status
      : 'unknown',
    helper_initiated_playback: false,
    live_stream_verified: false,
    moving_picture_verified: false,
    audio_output_verified: false,
    physical_bravia_verified: false,
  };
}

function evidenceFromEnvironment(env) {
  const phases = env.TV_ZNS_PHASES ? env.TV_ZNS_PHASES.split(',').filter(Boolean) : [];
  const appCheckpoint = (name) => ({
    process: env[`TV_${name}_PROCESS`] || 'unknown',
    activity_foreground: env[`TV_${name}_FOREGROUND`] || 'unknown',
    window_focus: env[`TV_${name}_FOCUS`] || 'unknown',
  });
  const diagnosticCheckpoint = (name) => ({
    pidof: env[`TV_${name}_PIDOF_DIAGNOSTIC`] || 'unavailable',
    activity_foreground: env[`TV_${name}_ACTIVITY_DIAGNOSTIC`] || 'command_unavailable',
    window_focus: env[`TV_${name}_FOCUS_DIAGNOSTIC`] || 'command_unavailable',
    window_manager_focus: env[`TV_${name}_WINDOW_MANAGER_FOCUS_DIAGNOSTIC`] || 'command_unavailable',
    input_focus: env[`TV_${name}_INPUT_FOCUS_DIAGNOSTIC`] || 'command_unavailable',
    focus_source: env[`TV_${name}_FOCUS_SOURCE`] || 'unknown',
  });
  return {
    commit: env.GITHUB_SHA,
    profile: env.TV_TEST_PROFILE,
    source_url: env.TV_ZNS_SOURCE_URL,
    infrastructure: {
      emulator_boot: env.TV_EMULATOR_BOOT,
      apk_install: env.TV_APK_INSTALL,
      app_launch: env.TV_APP_LAUNCH,
    },
    app_state: {
      after_launch: appCheckpoint('LAUNCH'),
      after_dpad: appCheckpoint('DPAD'),
      after_back: appCheckpoint('BACK'),
    },
    app_state_diagnostics: {
      after_launch: diagnosticCheckpoint('LAUNCH'),
      after_dpad: diagnosticCheckpoint('DPAD'),
      after_back: diagnosticCheckpoint('BACK'),
      after_failure: diagnosticCheckpoint('FAILURE'),
    },
    failure_state: appCheckpoint('FAILURE'),
    screenshots: {
      after_launch: env.TV_SCREENSHOT_LAUNCH,
      after_dpad: env.TV_SCREENSHOT_DPAD,
      after_back: env.TV_SCREENSHOT_BACK,
      after_failure: env.TV_SCREENSHOT_FAILURE,
    },
    actions: {
      dpad_down_up_dispatched: env.TV_DPAD_DISPATCH,
      back_dispatched: env.TV_BACK_DISPATCH,
    },
    log_capture: env.TV_LOG_CAPTURE,
    observation_phases: phases,
    player_state: {
      ready: env.TV_PLAYER_READY,
      paused: env.TV_PLAYER_PAUSED,
      muted: env.TV_PLAYER_MUTED,
      volume: env.TV_PLAYER_VOLUME,
    },
    video_time_advanced_observed: env.TV_TIME_ADVANCED,
    failure_stage: env.TV_FAILURE_STAGE,
    launch_status: env.TV_LAUNCH_STATUS,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] !== '--from-env') {
    process.stderr.write('Usage: node zns-feedback-outcome.mjs --from-env\n');
    process.exitCode = 2;
  } else {
    const receipt = classifyZnsFeedback(evidenceFromEnvironment(process.env));
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  }
}
