import {pathToFileURL} from 'node:url';

const SOURCE_URL = 'https://znsbahamas.com/';
const PHASES = new Set([
  'zns-outer-player-first',
  'zns-embedded-observed',
  'zns-embedded-playing',
  'zns-video-time-advanced',
]);
const MEDIA_EVENTS = new Set([
  'loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'play', 'playing',
  'pause', 'waiting', 'stalled', 'error', 'abort', 'emptied',
]);
const AUTOPLAY_TYPES = new Set(['audible', 'inaudible']);
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
  'diagnostic_continuation',
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
  'command_timeout',
]);
const FOCUS_SOURCES = new Set(['window_manager', 'input_dispatcher', 'both', 'conflict', 'unknown']);
const LAUNCH_OBSERVATIONS = [
  'browser_session_configured',
  'browser_view_attached',
  'zns_navigation_requested',
  'zns_navigation_started',
  'zns_navigation_completed',
  'zns_navigation_failed',
];
const ATTEMPT_RECOVERY_REASONS = new Set([
  'initial_navigation',
  'official_frame_without_embedded_helper',
  'navigation_failed_after_start',
  'navigation_completed_without_player_state',
  'navigation_pending_after_bounded_wait',
]);
const ATTEMPT_STOP_OBSERVATIONS = new Set([
  'embedded_video_time_advanced',
  'top_level_navigation_failed',
  'embedded_state_window_elapsed_without_time_advancement',
  'embedded_state_poll_limit_without_time_advancement',
  'embedded_helper_active_without_video_state',
  'official_frame_seen_without_embedded_helper',
  'top_level_navigation_completed_without_player_state',
  'top_level_navigation_pending_at_poll_limit',
  'navigation_start_not_observed_at_poll_limit',
  'recovery_launch_not_confirmed',
]);

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

function safeAttemptSnapshot(snapshot = {}) {
  const phasesValid = Array.isArray(snapshot.observation_phases)
    && snapshot.observation_phases.every((phase) => PHASES.has(phase));
  const phases = phasesValid ? [...new Set(snapshot.observation_phases)] : [];
  const captureStatus = ['complete', 'incomplete', 'truncated'].includes(snapshot.capture_status)
    ? snapshot.capture_status
    : 'incomplete';
  return {
    capture_status: captureStatus,
    official_frame_observed: isStatus(snapshot.official_frame_observed) ? snapshot.official_frame_observed : 'unknown',
    embed_observed: isStatus(snapshot.embed_observed) ? snapshot.embed_observed : 'unknown',
    iframe_load_watch_attached: isStatus(snapshot.iframe_load_watch_attached) ? snapshot.iframe_load_watch_attached : 'unknown',
    iframe_load_event_after_watch: isStatus(snapshot.iframe_load_event_after_watch) ? snapshot.iframe_load_event_after_watch : 'unknown',
    embedded_helper_active_observed: isStatus(snapshot.embedded_helper_active_observed) ? snapshot.embedded_helper_active_observed : 'unknown',
    launch_observations: safeLaunchObservations(snapshot.launch_observations),
    observation_phases: phases,
    player_state: safePlayerState(snapshot.player_state),
    media_diagnostics: safeMediaDiagnostics(snapshot.media_diagnostics),
    video_time_advanced_observed: isStatus(snapshot.video_time_advanced_observed) ? snapshot.video_time_advanced_observed : 'unknown',
  };
}

function safeNavigationAttempts(value = []) {
  if (!Array.isArray(value)) return [];
  const status = (input) => ['captured', 'missing', 'oversize'].includes(input) ? input : 'missing';
  return value.slice(0, 2).flatMap((attempt, index) => {
    if (!attempt || typeof attempt !== 'object') return [];
    const number = attempt.attempt_number;
    if (!Number.isInteger(number) || number !== index + 1) return [];
    return [{
      attempt_number: number,
      recovery_reason: ATTEMPT_RECOVERY_REASONS.has(attempt.recovery_reason) ? attempt.recovery_reason : 'initial_navigation',
      poll_count: Number.isInteger(attempt.poll_count) ? Math.max(0, Math.min(15, attempt.poll_count)) : 0,
      stop_observation: ATTEMPT_STOP_OBSERVATIONS.has(attempt.stop_observation)
        ? attempt.stop_observation
        : 'navigation_start_not_observed_at_poll_limit',
      before: safeAttemptSnapshot(attempt.before),
      after: safeAttemptSnapshot(attempt.after),
      screenshots: {
        before: {file: `zns-attempt-${number}-before.png`, status: status(attempt.screenshots?.before)},
        after: {file: `zns-attempt-${number}-after.png`, status: status(attempt.screenshots?.after)},
      },
    }];
  });
}

function diagnosticCause(mediaDiagnostics) {
  return ({
    1: 'media_aborted',
    2: 'media_network_error',
    3: 'media_decode_error',
    4: 'unsupported_media_source',
  })[mediaDiagnostics.media_error_code] ?? 'not_established';
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

function safeMediaDiagnostics(value = {}) {
  const state = value && typeof value === 'object' ? value : {};
  const integer = (number, allowed) => Number.isInteger(number) && allowed.includes(number) ? number : null;
  const boolean = (input) => typeof input === 'boolean' ? input : null;
  const events = Array.isArray(state.events)
    ? [...new Set(state.events.filter((event) => MEDIA_EVENTS.has(event)))].slice(0, MEDIA_EVENTS.size)
    : [];
  const permissionEvents = Array.isArray(state.autoplay_permission_events)
    ? state.autoplay_permission_events.slice(0, 8).flatMap((entry) => {
      if (!entry || !AUTOPLAY_TYPES.has(entry.type)) return [];
      const label = (input) => ['allow', 'deny', 'other'].includes(input) ? input : 'unknown';
      return [{type: entry.type, requested: label(entry.requested), decision: label(entry.decision)}];
    })
    : [];
  const status = (input) => isStatus(input) ? input : 'unknown';
  return {
    observed: status(state.observed),
    network_state: integer(state.network_state, [0, 1, 2, 3]),
    media_error_code: integer(state.media_error_code, [1, 2, 3, 4]),
    error_observed: status(state.error_observed),
    source_present: boolean(state.source_present),
    rendered: ['yes', 'no', 'unknown'].includes(state.rendered) ? state.rendered : 'unknown',
    autoplay: boolean(state.autoplay),
    controls: boolean(state.controls),
    events_observed: status(state.events_observed),
    events,
    autoplay_permission_observed: status(state.autoplay_permission_observed),
    autoplay_permission_events: permissionEvents,
  };
}

function safeLaunchObservations(value = {}) {
  return Object.fromEntries(LAUNCH_OBSERVATIONS.map((key) => [
    key,
    isStatus(value?.[key]) ? value[key] : 'unknown',
  ]));
}

function safeContinuation(value = {}) {
  return {
    mode: value?.mode === 'passive_focus_unknown' ? 'passive_focus_unknown' : 'not_used',
    additional_passive_observation: isStatus(value?.additional_passive_observation)
      ? value.additional_passive_observation
      : 'no',
    remote_keys_withheld: isStatus(value?.remote_keys_withheld) ? value.remote_keys_withheld : 'no',
  };
}

/** Classify only bounded, sanitized ZNS observations; this never claims live playback. */
export function classifyZnsFeedback(evidence = {}) {
  const phasesAreValid = Array.isArray(evidence.observation_phases)
    && evidence.observation_phases.every((phase) => PHASES.has(phase));
  const phases = phasesAreValid ? [...new Set(evidence.observation_phases)] : [];
  const progressionFlag = evidence.video_time_advanced_observed === 'yes'
    || evidence.video_time_advanced_observed === true;
  const progressionPhase = phases.includes('zns-video-time-advanced');
  const appState = safeAppState(evidence.app_state);
  const appDiagnostics = safeAppDiagnostics(evidence.app_state_diagnostics);
  const failureState = Object.fromEntries(['process', 'activity_foreground', 'window_focus'].map((key) => [
    key,
    isStatus(evidence.failure_state?.[key]) ? evidence.failure_state[key] : 'unknown',
  ]));
  const screenshots = safeScreenshots(evidence.screenshots);
  const actions = safeActions(evidence.actions);
  const playerState = safePlayerState(evidence.player_state);
  const mediaDiagnostics = safeMediaDiagnostics(evidence.media_diagnostics);
  const launchObservations = safeLaunchObservations(evidence.launch_observations);
  const navigationAttempts = safeNavigationAttempts(evidence.navigation_attempts);
  const frameLifecycle = {
    iframe_load_watch_attached: isStatus(evidence.iframe_load_watch_attached) ? evidence.iframe_load_watch_attached : 'unknown',
    iframe_load_event_after_watch: isStatus(evidence.iframe_load_event_after_watch) ? evidence.iframe_load_event_after_watch : 'unknown',
    embedded_helper_active_observed: isStatus(evidence.embedded_helper_active_observed) ? evidence.embedded_helper_active_observed : 'unknown',
  };
  const diagnosticContinuation = safeContinuation(evidence.diagnostic_continuation);
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
    const baseComplete = appStateComplete && infrastructureComplete && evidenceCaptureComplete
      && interactionsComplete && identityComplete
      && diagnosticContinuation.mode !== 'passive_focus_unknown';
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
    && actions.back_dispatched === 'yes'
    && diagnosticContinuation.mode !== 'passive_focus_unknown';
  const mediaCause = diagnosticCause(mediaDiagnostics);
  const progressionConsistent = progressionFlag === progressionPhase;
  const playbackProgression = progressionConsistent && progressionFlag
    ? 'yes'
    : progressionConsistent && evidence.log_capture === 'complete' ? 'no' : 'unknown';

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
    official_frame_observed: isStatus(evidence.official_frame_observed)
      ? evidence.official_frame_observed
      : phases.includes('zns-outer-player-first') ? 'yes' : evidence.log_capture === 'complete' ? 'no' : 'unknown',
    embed_observed: isStatus(evidence.embed_observed)
      ? evidence.embed_observed
      : phases.includes('zns-embedded-observed') ? 'yes' : evidence.log_capture === 'complete' ? 'no' : 'unknown',
    infrastructure: {
      emulator_boot: isStatus(infra.emulator_boot) ? infra.emulator_boot : 'unknown',
      apk_install: isStatus(infra.apk_install) ? infra.apk_install : 'unknown',
      app_launch: isStatus(infra.app_launch) ? infra.app_launch : 'unknown',
    },
    app_state: appState,
    app_state_diagnostics: appDiagnostics,
    failure_state: failureState,
    screenshots,
    navigation_attempts: navigationAttempts,
    frame_lifecycle: frameLifecycle,
    harness_limits: {
      max_navigation_attempts: 2,
      max_recovery_attempts: 1,
      max_navigation_window_seconds_per_attempt: 45,
      max_log_snapshot_seconds: 6,
      max_polls_per_attempt: 15,
      poll_interval_seconds: 2,
      post_embed_observation_polls: 5,
    },
    actions,
    launch_observations: launchObservations,
    diagnostic_continuation: diagnosticContinuation,
    log_capture: ['complete', 'incomplete', 'truncated'].includes(evidence.log_capture)
      ? evidence.log_capture
      : 'incomplete',
    observation_phases: phases,
    player_state: playerState,
    media_diagnostics: mediaDiagnostics,
    video_time_advanced_observed: evidence.video_time_advanced_observed === 'yes' ? 'yes' : 'no',
    diagnostic_success: mediaCause !== 'not_established',
    diagnostic_cause: mediaCause,
    playback_progression: playbackProgression,
    device_acceptance: 'not_tested',
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
    launch_observations: Object.fromEntries(LAUNCH_OBSERVATIONS.map((key) => [
      key,
      env[`TV_${key.replaceAll(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}`] || 'unknown',
    ])),
    diagnostic_continuation: {
      mode: env.TV_CONTINUATION_MODE,
      additional_passive_observation: env.TV_CONTINUATION_WAIT,
      remote_keys_withheld: env.TV_CONTINUATION_KEYS_WITHHELD,
    },
    log_capture: env.TV_LOG_CAPTURE,
    observation_phases: phases,
    player_state: {
      ready: env.TV_PLAYER_READY,
      paused: env.TV_PLAYER_PAUSED,
      muted: env.TV_PLAYER_MUTED,
      volume: env.TV_PLAYER_VOLUME,
    },
    media_diagnostics: (() => {
      try { return JSON.parse(env.TV_ZNS_MEDIA_DIAGNOSTICS || '{}'); } catch { return {}; }
    })(),
    iframe_load_watch_attached: env.TV_IFRAME_LOAD_WATCH_ATTACHED,
    iframe_load_event_after_watch: env.TV_IFRAME_LOAD_EVENT_AFTER_WATCH,
    embedded_helper_active_observed: env.TV_EMBEDDED_HELPER_ACTIVE,
    navigation_attempts: (() => {
      try { return JSON.parse(env.TV_NAVIGATION_ATTEMPTS_JSON || '[]'); } catch { return []; }
    })(),
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
