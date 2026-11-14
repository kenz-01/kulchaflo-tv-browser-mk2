#!/usr/bin/env bash
set -euo pipefail

# Explicitly selected, on-demand observation of the official ZNS browser route.
# It never starts, unmutes, or raises the volume of a video element.
PACKAGE="com.kulchaflo.tv.mk2.gv"
ACTIVITY="$PACKAGE/.app.GeckoBrowserActivity"
APK="app-gv/build/outputs/apk/universal/debug/app-gv-universal-debug.apk"
REPORT_DIR="${RUNNER_TEMP:-/tmp}/tv-emulator-qualification"
RECEIPT="$REPORT_DIR/zns-diagnostic-receipt.json"
ATTEMPT_SCREENSHOT_DIR="$REPORT_DIR/navigation-attempts"
SOURCE_URL="https://znsbahamas.com/"
STAGE="preflight"
MAX_SCREENSHOT_BYTES=$((4 * 1024 * 1024))
MAX_NAVIGATION_POLLS=15
POLL_INTERVAL_SECONDS=2
MIN_POST_EMBED_POLLS=5
MAX_NAVIGATION_SECONDS_PER_ATTEMPT=45
MAX_LOG_SNAPSHOT_SECONDS=6

mkdir -p "$REPORT_DIR"
mkdir -p "$ATTEMPT_SCREENSHOT_DIR"
export TV_TEST_PROFILE=zns TV_ZNS_SOURCE_URL="$SOURCE_URL"
export TV_EMULATOR_BOOT=no TV_APK_INSTALL=unknown TV_APP_LAUNCH=unknown
export TV_LAUNCH_STATUS=unknown TV_FAILURE_STAGE=
export TV_LOG_CAPTURE=incomplete TV_ZNS_PHASES= TV_TIME_ADVANCED=no
export TV_PLAYER_READY=unknown TV_PLAYER_PAUSED=unknown TV_PLAYER_MUTED=unknown TV_PLAYER_VOLUME=unknown
export TV_ZNS_MEDIA_DIAGNOSTICS='{}'
export TV_BROWSER_SESSION_CONFIGURED=unknown TV_BROWSER_VIEW_ATTACHED=unknown
export TV_ZNS_NAVIGATION_REQUESTED=unknown TV_ZNS_NAVIGATION_STARTED=unknown
export TV_ZNS_NAVIGATION_COMPLETED=unknown TV_ZNS_NAVIGATION_FAILED=unknown
export TV_CONTINUATION_MODE=not_used TV_CONTINUATION_WAIT=no TV_CONTINUATION_KEYS_WITHHELD=no
export TV_FAILURE_CAPTURED=no
export TV_IFRAME_LOAD_WATCH_ATTACHED=unknown TV_IFRAME_LOAD_EVENT_AFTER_WATCH=unknown
export TV_EMBEDDED_HELPER_ACTIVE=unknown TV_CURRENT_ZNS_SNAPSHOT='{}'
export TV_NAVIGATION_ATTEMPTS_JSON='[]'
for checkpoint in LAUNCH DPAD BACK FAILURE; do
  printf -v "TV_${checkpoint}_PROCESS" '%s' unknown
  printf -v "TV_${checkpoint}_FOREGROUND" '%s' unknown
  printf -v "TV_${checkpoint}_FOCUS" '%s' unknown
  printf -v "TV_${checkpoint}_PIDOF_DIAGNOSTIC" '%s' unavailable
  printf -v "TV_${checkpoint}_ACTIVITY_DIAGNOSTIC" '%s' command_unavailable
  printf -v "TV_${checkpoint}_FOCUS_DIAGNOSTIC" '%s' command_unavailable
  printf -v "TV_${checkpoint}_WINDOW_MANAGER_FOCUS_DIAGNOSTIC" '%s' command_unavailable
  printf -v "TV_${checkpoint}_INPUT_FOCUS_DIAGNOSTIC" '%s' command_unavailable
  printf -v "TV_${checkpoint}_FOCUS_SOURCE" '%s' unknown
  export "TV_${checkpoint}_PROCESS" "TV_${checkpoint}_FOREGROUND" "TV_${checkpoint}_FOCUS"
  export "TV_${checkpoint}_PIDOF_DIAGNOSTIC" "TV_${checkpoint}_ACTIVITY_DIAGNOSTIC" "TV_${checkpoint}_FOCUS_DIAGNOSTIC"
  export "TV_${checkpoint}_WINDOW_MANAGER_FOCUS_DIAGNOSTIC" "TV_${checkpoint}_INPUT_FOCUS_DIAGNOSTIC" "TV_${checkpoint}_FOCUS_SOURCE"
done
export TV_SCREENSHOT_LAUNCH=missing TV_SCREENSHOT_DPAD=missing
export TV_SCREENSHOT_BACK=missing TV_SCREENSHOT_FAILURE=missing
export TV_ATTEMPT1_BEFORE_SCREENSHOT=missing TV_ATTEMPT1_AFTER_SCREENSHOT=missing
export TV_ATTEMPT2_BEFORE_SCREENSHOT=missing TV_ATTEMPT2_AFTER_SCREENSHOT=missing
export TV_DPAD_DISPATCH=no TV_BACK_DISPATCH=no

capture_screenshot() {
  local phase="$1" label="$1" remote local_path size status=missing attempt_status_name=
  case "$phase" in
    launch) remote=/sdcard/kf-zns-after-launch.png; local_path="$REPORT_DIR/zns-after-launch.png" ;;
    dpad) remote=/sdcard/kf-zns-after-dpad.png; local_path="$REPORT_DIR/zns-after-dpad.png" ;;
    back) remote=/sdcard/kf-zns-after-back.png; local_path="$REPORT_DIR/zns-after-back.png" ;;
    failure) remote=/sdcard/kf-zns-after-failure.png; local_path="$REPORT_DIR/zns-after-failure.png" ;;
    attempt-1-before) remote=/sdcard/kf-zns-attempt-1-before.png; local_path="$ATTEMPT_SCREENSHOT_DIR/zns-attempt-1-before.png"; attempt_status_name=TV_ATTEMPT1_BEFORE_SCREENSHOT ;;
    attempt-1-after) remote=/sdcard/kf-zns-attempt-1-after.png; local_path="$ATTEMPT_SCREENSHOT_DIR/zns-attempt-1-after.png"; attempt_status_name=TV_ATTEMPT1_AFTER_SCREENSHOT ;;
    attempt-2-before) remote=/sdcard/kf-zns-attempt-2-before.png; local_path="$ATTEMPT_SCREENSHOT_DIR/zns-attempt-2-before.png"; attempt_status_name=TV_ATTEMPT2_BEFORE_SCREENSHOT ;;
    attempt-2-after) remote=/sdcard/kf-zns-attempt-2-after.png; local_path="$ATTEMPT_SCREENSHOT_DIR/zns-attempt-2-after.png"; attempt_status_name=TV_ATTEMPT2_AFTER_SCREENSHOT ;;
    *) return 0 ;;
  esac
  if timeout 8 adb shell screencap -p "$remote" >/dev/null 2>&1 \
    && timeout 8 adb pull "$remote" "$local_path" >/dev/null 2>&1 \
    && [[ -s "$local_path" ]]; then
    size=$(stat -c '%s' "$local_path" 2>/dev/null || printf '0')
    if [[ "$size" =~ ^[0-9]+$ ]] && (( size <= MAX_SCREENSHOT_BYTES )); then
      status=captured
    else
      status=oversize
      rm -f "$local_path"
    fi
  else
    rm -f "$local_path"
  fi
  if [[ -n "$attempt_status_name" ]]; then
    printf -v "$attempt_status_name" '%s' "$status"
    export "$attempt_status_name"
  else
    label=${label^^}
    printf -v "TV_SCREENSHOT_${label}" '%s' "$status"
    export "TV_SCREENSHOT_${label}"
  fi
}

capture_app_state() {
  local label="$1" state_json decoded
  state_json=$(python3 tools/player-lab/scripts/tv-emulator-state.py capture 2>/dev/null || true)
  decoded=$(printf '%s' "$state_json" | python3 -c '
import json,re,sys
try:
 d=json.load(sys.stdin)
 state=[d.get("process","unknown"),d.get("activity_foreground","unknown"),d.get("window_focus","unknown")]
 diag=d.get("diagnostics",{})
 details=[diag.get("pidof","unavailable"),diag.get("activity_foreground","command_unavailable"),diag.get("window_focus","command_unavailable"),diag.get("window_manager_focus","command_unavailable"),diag.get("input_focus","command_unavailable")]
 source=diag.get("focus_source","unknown")
 statuses={"yes","no","unknown"}
 allowed={"target_process","process_absent","unavailable","unparseable","output_truncated","too_many_entries","target_component","other_component","input_target_window","input_other_window","focus_signal_conflict","entry_missing","entry_unparsed","ambiguous_components","command_timeout","command_unavailable"}
 sources={"window_manager","input_dispatcher","both","conflict","unknown"}
 values=[value if isinstance(value,str) and value in statuses else "unknown" for value in state]
 values += [value if isinstance(value,str) and value in allowed else "unavailable" for value in details]
 values.append(source if isinstance(source,str) and source in sources else "unknown")
 print("\t".join(values))
except Exception:
 print("unknown\tunknown\tunknown\tunavailable\tcommand_unavailable\tcommand_unavailable\tcommand_unavailable\tcommand_unavailable\tunknown")
' 2>/dev/null || printf 'unknown\tunknown\tunknown\tunavailable\tcommand_unavailable\tcommand_unavailable\tcommand_unavailable\tcommand_unavailable\tunknown')
  local process foreground focus pidof_diag activity_diag focus_diag window_manager_diag input_diag focus_source
  IFS=$'\t' read -r process foreground focus pidof_diag activity_diag focus_diag window_manager_diag input_diag focus_source <<< "$decoded"
  printf -v "TV_${label}_PROCESS" '%s' "${process:-unknown}"
  printf -v "TV_${label}_FOREGROUND" '%s' "${foreground:-unknown}"
  printf -v "TV_${label}_FOCUS" '%s' "${focus:-unknown}"
  printf -v "TV_${label}_PIDOF_DIAGNOSTIC" '%s' "${pidof_diag:-unavailable}"
  printf -v "TV_${label}_ACTIVITY_DIAGNOSTIC" '%s' "${activity_diag:-command_unavailable}"
  printf -v "TV_${label}_FOCUS_DIAGNOSTIC" '%s' "${focus_diag:-command_unavailable}"
  printf -v "TV_${label}_WINDOW_MANAGER_FOCUS_DIAGNOSTIC" '%s' "${window_manager_diag:-command_unavailable}"
  printf -v "TV_${label}_INPUT_FOCUS_DIAGNOSTIC" '%s' "${input_diag:-command_unavailable}"
  printf -v "TV_${label}_FOCUS_SOURCE" '%s' "${focus_source:-unknown}"
  export "TV_${label}_PROCESS" "TV_${label}_FOREGROUND" "TV_${label}_FOCUS"
  export "TV_${label}_PIDOF_DIAGNOSTIC" "TV_${label}_ACTIVITY_DIAGNOSTIC" "TV_${label}_FOCUS_DIAGNOSTIC"
  export "TV_${label}_WINDOW_MANAGER_FOCUS_DIAGNOSTIC" "TV_${label}_INPUT_FOCUS_DIAGNOSTIC" "TV_${label}_FOCUS_SOURCE"
  [[ "$process" == yes && "$foreground" == yes && "$focus" == yes ]]
}

check_app_state() {
  capture_app_state "$1"
}

capture_player_observations() {
  local snapshot decoded
  snapshot=$(timeout "${MAX_LOG_SNAPSHOT_SECONDS}s" python3 tools/player-lab/scripts/tv-zns-log-snapshot.py capture 2>/dev/null || true)
  [[ "$snapshot" == \{*\} ]] || snapshot='{}'
  TV_CURRENT_ZNS_SNAPSHOT="$snapshot"
  export TV_CURRENT_ZNS_SNAPSHOT
  decoded=$(printf '%s' "$snapshot" | python3 -c '
import json,re,sys
try:
 d=json.load(sys.stdin)
 phases=d.get("observation_phases",[])
 if not isinstance(phases,list): phases=[]
 phases=[p for p in phases if isinstance(p,str) and p in {"zns-outer-player-first","zns-embedded-observed","zns-embedded-playing","zns-video-time-advanced"}]
 state=d.get("player_state") or {}
 capture=d.get("capture_status","incomplete")
 capture=capture if capture in {"complete","incomplete","truncated"} else "incomplete"
 ready=str(state.get("ready","unknown"))
 ready=ready if ready in {"0","1","2","3","4"} else "unknown"
 def boolean(value):
  if value is True or value == "true": return "true"
  if value is False or value == "false": return "false"
  return "unknown"
 volume=str(state.get("volume","unknown"))
 volume=volume if re.fullmatch(r"(?:0(?:\.[0-9]+)?|1(?:\.0+)?)",volume) else "unknown"
 advanced=d.get("video_time_advanced_observed","no")
 advanced=advanced if advanced in {"yes","no"} else "no"
 launch=d.get("launch_observations") or {}
 keys=("browser_session_configured","browser_view_attached","zns_navigation_requested","zns_navigation_started","zns_navigation_completed","zns_navigation_failed")
 launch_values=[launch.get(key,"unknown") for key in keys]
 launch_values=[value if value in {"yes","no","unknown"} else "unknown" for value in launch_values]
 lifecycle_keys=("iframe_load_watch_attached","iframe_load_event_after_watch","embedded_helper_active_observed")
 lifecycle_values=[d.get(key,"unknown") for key in lifecycle_keys]
 lifecycle_values=[value if value in {"yes","no","unknown"} else "unknown" for value in lifecycle_values]
 official=d.get("official_frame_observed","unknown")
 official=official if official in {"yes","no","unknown"} else "unknown"
 values=[capture,",".join(phases) or "none",ready,boolean(state.get("paused")),boolean(state.get("muted")),volume,advanced,*launch_values,*lifecycle_values,official]
 allowed=set(values)
 print("\t".join(value if value in allowed else "unknown" for value in values))
except Exception:
 print("\t".join(["incomplete","none","unknown","unknown","unknown","unknown","no"]+["unknown"]*10))
' 2>/dev/null || printf 'incomplete\tnone\tunknown\tunknown\tunknown\tunknown\tno\tunknown\tunknown\tunknown\tunknown\tunknown\tunknown\tunknown\tunknown\tunknown')
  IFS=$'\t' read -r TV_LOG_CAPTURE TV_ZNS_PHASES TV_PLAYER_READY TV_PLAYER_PAUSED TV_PLAYER_MUTED TV_PLAYER_VOLUME TV_TIME_ADVANCED \
    TV_BROWSER_SESSION_CONFIGURED TV_BROWSER_VIEW_ATTACHED TV_ZNS_NAVIGATION_REQUESTED \
    TV_ZNS_NAVIGATION_STARTED TV_ZNS_NAVIGATION_COMPLETED TV_ZNS_NAVIGATION_FAILED \
    TV_IFRAME_LOAD_WATCH_ATTACHED TV_IFRAME_LOAD_EVENT_AFTER_WATCH TV_EMBEDDED_HELPER_ACTIVE TV_OFFICIAL_FRAME_OBSERVED <<< "$decoded"
  TV_LOG_CAPTURE=${TV_LOG_CAPTURE:-incomplete}
  [[ "$TV_ZNS_PHASES" == none ]] && TV_ZNS_PHASES=
  TV_PLAYER_READY=${TV_PLAYER_READY:-unknown}
  TV_PLAYER_PAUSED=${TV_PLAYER_PAUSED:-unknown}
  TV_PLAYER_MUTED=${TV_PLAYER_MUTED:-unknown}
  TV_PLAYER_VOLUME=${TV_PLAYER_VOLUME:-unknown}
  TV_TIME_ADVANCED=${TV_TIME_ADVANCED:-no}
  for name in TV_BROWSER_SESSION_CONFIGURED TV_BROWSER_VIEW_ATTACHED TV_ZNS_NAVIGATION_REQUESTED TV_ZNS_NAVIGATION_STARTED TV_ZNS_NAVIGATION_COMPLETED TV_ZNS_NAVIGATION_FAILED TV_IFRAME_LOAD_WATCH_ATTACHED TV_IFRAME_LOAD_EVENT_AFTER_WATCH TV_EMBEDDED_HELPER_ACTIVE TV_OFFICIAL_FRAME_OBSERVED; do
    [[ "${!name:-}" =~ ^(yes|no|unknown)$ ]] || printf -v "$name" '%s' unknown
  done
  TV_ZNS_MEDIA_DIAGNOSTICS=$(printf '%s' "$snapshot" | python3 -c '
import json,sys
events={"loadstart","loadedmetadata","loadeddata","canplay","play","playing","pause","waiting","stalled","error","abort","emptied"}
statuses={"yes","no","unknown"}
try:
 d=json.load(sys.stdin)
 raw=d.get("media_diagnostics") or {}
 def status(value): return value if isinstance(value,str) and value in statuses else "unknown"
 def boolean(value): return value if isinstance(value,bool) else None
 def integer(value,allowed): return value if isinstance(value,int) and not isinstance(value,bool) and value in allowed else None
 rendered=raw.get("rendered")
 rendered=rendered if rendered in {"yes","no","unknown"} else "unknown"
 safe_events=[value for value in raw.get("events",[]) if isinstance(value,str) and value in events] if isinstance(raw.get("events"),list) else []
 permissions=[]
 for item in raw.get("autoplay_permission_events",[])[:8] if isinstance(raw.get("autoplay_permission_events"),list) else []:
  if not isinstance(item,dict) or item.get("type") not in {"audible","inaudible"}: continue
  label=lambda value: value if value in {"allow","deny","other"} else "unknown"
  permissions.append({"type":item["type"],"requested":label(item.get("requested")),"decision":label(item.get("decision"))})
 report={
  "observed":status(raw.get("observed")),
  "network_state":integer(raw.get("network_state"),{0,1,2,3}),
  "media_error_code":integer(raw.get("media_error_code"),{1,2,3,4}),
  "error_observed":status(raw.get("error_observed")),
  "source_present":boolean(raw.get("source_present")),
  "rendered":rendered,
  "autoplay":boolean(raw.get("autoplay")),
  "controls":boolean(raw.get("controls")),
  "events_observed":status(raw.get("events_observed")),
  "events":list(dict.fromkeys(safe_events))[:12],
  "autoplay_permission_observed":status(raw.get("autoplay_permission_observed")),
  "autoplay_permission_events":permissions,
 }
 print(json.dumps(report,separators=(",",":"),sort_keys=True))
except Exception:
 print("{}")
' 2>/dev/null || printf '{}')
  [[ "$TV_ZNS_MEDIA_DIAGNOSTICS" == \{*\} ]] || TV_ZNS_MEDIA_DIAGNOSTICS='{}'
  export TV_LOG_CAPTURE TV_ZNS_PHASES TV_PLAYER_READY TV_PLAYER_PAUSED TV_PLAYER_MUTED TV_PLAYER_VOLUME TV_TIME_ADVANCED
  export TV_BROWSER_SESSION_CONFIGURED TV_BROWSER_VIEW_ATTACHED TV_ZNS_NAVIGATION_REQUESTED TV_ZNS_NAVIGATION_STARTED
  export TV_ZNS_NAVIGATION_COMPLETED TV_ZNS_NAVIGATION_FAILED
  export TV_IFRAME_LOAD_WATCH_ATTACHED TV_IFRAME_LOAD_EVENT_AFTER_WATCH TV_EMBEDDED_HELPER_ACTIVE TV_OFFICIAL_FRAME_OBSERVED
  export TV_ZNS_MEDIA_DIAGNOSTICS
}

wait_for_navigation_phase() {
  local polls=0 embed_first_poll=0 stop_observation= started_at=$SECONDS
  while (( polls < MAX_NAVIGATION_POLLS && SECONDS - started_at < MAX_NAVIGATION_SECONDS_PER_ATTEMPT )); do
    capture_player_observations
    ((polls += 1))
    if [[ "$TV_TIME_ADVANCED" == yes ]]; then
      stop_observation=embedded_video_time_advanced
      break
    fi
    if [[ "$TV_ZNS_NAVIGATION_FAILED" == yes ]]; then
      stop_observation=top_level_navigation_failed
      break
    fi
    if [[ ",$TV_ZNS_PHASES," == *,zns-embedded-observed,* ]]; then
      (( embed_first_poll == 0 )) && embed_first_poll=$polls
      if (( polls - embed_first_poll >= MIN_POST_EMBED_POLLS )); then
        stop_observation=embedded_state_window_elapsed_without_time_advancement
        break
      fi
    fi
    if (( polls < MAX_NAVIGATION_POLLS )); then
      sleep "$POLL_INTERVAL_SECONDS"
    fi
  done
  if [[ -z "$stop_observation" ]]; then
    if [[ ",$TV_ZNS_PHASES," == *,zns-embedded-observed,* ]]; then
      stop_observation=embedded_state_poll_limit_without_time_advancement
    elif [[ "$TV_EMBEDDED_HELPER_ACTIVE" == yes ]]; then
      stop_observation=embedded_helper_active_without_video_state
    elif [[ "$TV_OFFICIAL_FRAME_OBSERVED" == yes ]]; then
      stop_observation=official_frame_seen_without_embedded_helper
    elif [[ "$TV_ZNS_NAVIGATION_COMPLETED" == yes ]]; then
      stop_observation=top_level_navigation_completed_without_player_state
    elif [[ "$TV_ZNS_NAVIGATION_STARTED" == yes ]]; then
      stop_observation=top_level_navigation_pending_at_poll_limit
    else
      stop_observation=navigation_start_not_observed_at_poll_limit
    fi
  fi
  TV_ATTEMPT_POLL_COUNT="$polls"
  TV_ATTEMPT_STOP_OBSERVATION="$stop_observation"
}

retry_reason_for_current_observation() {
  [[ "$TV_EMBEDDED_HELPER_ACTIVE" != yes && ",$TV_ZNS_PHASES," != *,zns-embedded-observed,* ]] || return 0
  if [[ "$TV_OFFICIAL_FRAME_OBSERVED" == yes ]]; then
    printf '%s\n' 'official_frame_without_embedded_helper'
  elif [[ "$TV_ZNS_NAVIGATION_STARTED" == yes && "$TV_ZNS_NAVIGATION_FAILED" == yes ]]; then
    printf '%s\n' 'navigation_failed_after_start'
  elif [[ "$TV_ZNS_NAVIGATION_STARTED" == yes && "$TV_ZNS_NAVIGATION_COMPLETED" == yes ]]; then
    printf '%s\n' 'navigation_completed_without_player_state'
  elif [[ "$TV_ZNS_NAVIGATION_STARTED" == yes ]]; then
    printf '%s\n' 'navigation_pending_after_bounded_wait'
  fi
}

record_navigation_attempt() {
  local attempt_number="$1" recovery_reason="$2" stop_observation="$3" polls="$4"
  local before_snapshot="$5" after_snapshot="$6" before_status="$7" after_status="$8"
  export TV_RECORD_ATTEMPTS="$TV_NAVIGATION_ATTEMPTS_JSON"
  export TV_RECORD_BEFORE="$before_snapshot" TV_RECORD_AFTER="$after_snapshot"
  export TV_RECORD_ATTEMPT_NUMBER="$attempt_number" TV_RECORD_RECOVERY_REASON="$recovery_reason"
  export TV_RECORD_STOP_OBSERVATION="$stop_observation" TV_RECORD_POLLS="$polls"
  export TV_RECORD_BEFORE_SCREENSHOT="$before_status" TV_RECORD_AFTER_SCREENSHOT="$after_status"
  TV_NAVIGATION_ATTEMPTS_JSON=$(python3 -c '
import json,os
allowed_reasons={"initial_navigation","official_frame_without_embedded_helper","navigation_failed_after_start","navigation_completed_without_player_state","navigation_pending_after_bounded_wait"}
allowed_stops={"embedded_video_time_advanced","top_level_navigation_failed","embedded_state_window_elapsed_without_time_advancement","embedded_state_poll_limit_without_time_advancement","embedded_helper_active_without_video_state","official_frame_seen_without_embedded_helper","top_level_navigation_completed_without_player_state","top_level_navigation_pending_at_poll_limit","navigation_start_not_observed_at_poll_limit","recovery_launch_not_confirmed"}
try:
 records=json.loads(os.environ.get("TV_RECORD_ATTEMPTS","[]"))
 if not isinstance(records,list): records=[]
 number=int(os.environ.get("TV_RECORD_ATTEMPT_NUMBER","0"))
 polls=int(os.environ.get("TV_RECORD_POLLS","0"))
 reason=os.environ.get("TV_RECORD_RECOVERY_REASON","")
 stop=os.environ.get("TV_RECORD_STOP_OBSERVATION","")
 before=json.loads(os.environ.get("TV_RECORD_BEFORE","{}"))
 after=json.loads(os.environ.get("TV_RECORD_AFTER","{}"))
 if number not in (1,2) or not 0 <= polls <= 15 or reason not in allowed_reasons or stop not in allowed_stops: raise ValueError()
 status=lambda value: value if value in {"captured","missing","oversize"} else "missing"
 entry={"attempt_number":number,"recovery_reason":reason,"poll_count":polls,"stop_observation":stop,
        "before":before,"after":after,
        "screenshots":{"before":status(os.environ.get("TV_RECORD_BEFORE_SCREENSHOT")),"after":status(os.environ.get("TV_RECORD_AFTER_SCREENSHOT"))}}
 records=[item for item in records if isinstance(item,dict) and item.get("attempt_number") in (1,2)]
 records.append(entry)
 records=sorted(records,key=lambda item:item["attempt_number"])[:2]
 print(json.dumps(records,separators=(",",":")))
except Exception:
 print("[]")
')
  export TV_NAVIGATION_ATTEMPTS_JSON
}

finish() {
  local original_status=$? classification final_status
  trap - EXIT
  set +e
  if (( original_status != 0 )); then
    export TV_FAILURE_STAGE="$STAGE"
    if [[ "$TV_EMULATOR_BOOT" == yes && "$TV_FAILURE_CAPTURED" != yes ]]; then
      capture_app_state FAILURE
      capture_screenshot failure
    fi
  fi
  capture_player_observations
  node tools/player-lab/src/zns-feedback-outcome.mjs --from-env > "$RECEIPT"
  local classifier_status=$?
  if (( classifier_status != 0 )); then
    original_status=1
    printf '{"schema_version":1,"receipt_finalized":false,"classification":"INCONCLUSIVE","reason":"Receipt classifier failed.","live_stream_verified":false,"moving_picture_verified":false,"audio_output_verified":false,"physical_bravia_verified":false}\n' > "$RECEIPT"
  fi
  classification=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("classification", "INCONCLUSIVE"))' "$RECEIPT" 2>/dev/null)
  {
    printf '%s\n' '## ZNS diagnostic harness report' ''
    printf -- '- Classification: `%s`\n' "${classification:-INCONCLUSIVE}"
    printf -- '- Commit: `%s`\n' "${GITHUB_SHA:-unknown}"
    printf '%s\n' '- Selected profile: `zns`'
    python3 - "$RECEIPT" <<'PY'
import json,sys
try:
    receipt=json.load(open(sys.argv[1],encoding="utf-8"))
except (OSError,json.JSONDecodeError):
    receipt={}
yes_no=lambda value: "yes" if value is True else "no" if value is False else "unknown"
print(f"- Harness success: `{yes_no(receipt.get('harness_completed'))}`")
print(f"- Diagnostic success: `{yes_no(receipt.get('diagnostic_success'))}`; cause: `{receipt.get('diagnostic_cause','not_established')}`")
print(f"- Playback progression: `{receipt.get('playback_progression','unknown')}` (actual bounded media-time advancement)")
print(f"- Physical TV acceptance: `{receipt.get('device_acceptance','not_tested')}`")
limits=receipt.get("harness_limits",{})
print(f"- Navigation limits: `{limits.get('max_navigation_attempts',2)}` attempts, `{limits.get('max_recovery_attempts',1)}` recovery, `{limits.get('max_navigation_window_seconds_per_attempt',45)}s` window per attempt, `{limits.get('max_polls_per_attempt',15)}` polls")
frame=receipt.get("frame_lifecycle",{})
print("- Frame/helper observations: " + ", ".join(
    f"{key}=`{frame.get(key,'unknown')}`" for key in (
        "iframe_load_watch_attached","iframe_load_event_after_watch","embedded_helper_active_observed")))
for attempt in receipt.get("navigation_attempts",[]):
    print(f"- Navigation attempt {attempt.get('attempt_number','?')}: stop=`{attempt.get('stop_observation','unknown')}`, recovery=`{attempt.get('recovery_reason','unknown')}`, polls=`{attempt.get('poll_count','unknown')}`")
if not receipt.get("navigation_attempts"):
    print("- Navigation attempts: no attempt completed")
PY
    printf '%s\n' '- A green job means the bounded harness completed. It does not establish moving picture, audio output, or physical Bravia acceptance.'
    printf '%s\n' '- Machine-readable receipt: `zns-diagnostic-receipt.json`'
  } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  cat "$RECEIPT"
  final_status=$original_status
  if (( final_status == 0 )); then
    case "$classification" in
      SOURCE_NOT_OBSERVED|PLAYER_OBSERVED_NO_PROGRESS|PROGRESSION_OBSERVED) ;;
      *) final_status=1 ;;
    esac
  fi
  exit "$final_status"
}
trap finish EXIT

test -s "$APK" || { echo "Universal debug APK missing" >&2; exit 1; }

STAGE=emulator_boot
adb wait-for-device
BOOT=$(adb shell getprop sys.boot_completed | tr -d '\r')
ABI=$(adb shell getprop ro.product.cpu.abi | tr -d '\r')
FEATURES=$(adb shell pm list features)
[[ "$BOOT" == "1" && "$ABI" == "x86_64" ]] || { echo "Android TV emulator boot or ABI check failed" >&2; exit 1; }
grep -Fq "android.software.leanback" <<<"$FEATURES" || {
  echo "Android TV leanback feature check failed" >&2
  exit 1
}
export TV_EMULATOR_BOOT=yes

STAGE=apk_install
adb logcat -c
adb install -r "$APK" >/dev/null
export TV_APK_INSTALL=yes

STAGE=launch
if launch_output=$(adb shell am start -W -n "$ACTIVITY" -e url "$SOURCE_URL" 2>&1); then
  if grep -Eq '^Status:[[:space:]]*ok[[:space:]]*$' <<< "$launch_output"; then
    export TV_LAUNCH_STATUS=confirmed TV_APP_LAUNCH=yes
  else
    export TV_LAUNCH_STATUS=unconfirmed TV_APP_LAUNCH=unknown
  fi
else
  export TV_LAUNCH_STATUS=failed TV_APP_LAUNCH=no
fi
unset launch_output
[[ "$TV_LAUNCH_STATUS" == confirmed ]] || { echo "Activity launch outcome was not confirmed by am start -W" >&2; exit 1; }

STAGE=required_app_state
# Keep the initial launch frame, then checkpoint each bounded navigation attempt.
capture_screenshot launch
capture_screenshot attempt-1-before
if ! check_app_state LAUNCH; then
  if [[ "$TV_LAUNCH_PROCESS" == yes && "$TV_LAUNCH_FOREGROUND" == yes && "$TV_LAUNCH_FOCUS" == unknown ]]; then
    # Missing focus evidence is not evidence of lost focus. Collect one extra
    # passive observation, withhold remote keys, and retain an inconclusive result.
    TV_CONTINUATION_MODE=passive_focus_unknown
    STAGE=diagnostic_continuation
    sleep 8
    TV_CONTINUATION_WAIT=yes
    TV_CONTINUATION_KEYS_WITHHELD=yes
    capture_screenshot failure
    capture_app_state FAILURE
    TV_FAILURE_CAPTURED=yes
    export TV_CONTINUATION_MODE TV_CONTINUATION_WAIT TV_CONTINUATION_KEYS_WITHHELD TV_FAILURE_CAPTURED
    echo "Focus is unknown; captured one passive follow-up and withheld remote keys" >&2
    exit 1
  fi
  echo "Required app process/foreground/focus check failed after launch" >&2
  exit 1
fi

capture_player_observations
attempt1_before="$TV_CURRENT_ZNS_SNAPSHOT"
wait_for_navigation_phase
attempt1_polls="$TV_ATTEMPT_POLL_COUNT"
attempt1_stop="$TV_ATTEMPT_STOP_OBSERVATION"
capture_screenshot attempt-1-after
attempt1_after="$TV_CURRENT_ZNS_SNAPSHOT"
record_navigation_attempt 1 initial_navigation "$attempt1_stop" "$attempt1_polls" \
  "$attempt1_before" "$attempt1_after" "$TV_ATTEMPT1_BEFORE_SCREENSHOT" "$TV_ATTEMPT1_AFTER_SCREENSHOT"

retry_reason=$(retry_reason_for_current_observation)
if [[ -n "$retry_reason" ]]; then
  # onNewIntent loads this same explicitly selected official URL into the active GeckoSession.
  capture_screenshot attempt-2-before
  attempt2_before="$TV_CURRENT_ZNS_SNAPSHOT"
  adb logcat -c
  retry_started=no
  if retry_output=$(adb shell am start -W -n "$ACTIVITY" -e url "$SOURCE_URL" 2>&1) \
    && grep -Eq '^Status:[[:space:]]*ok[[:space:]]*$' <<< "$retry_output"; then
    retry_started=yes
  fi
  unset retry_output
  if [[ "$retry_started" == yes ]]; then
    wait_for_navigation_phase
    attempt2_polls="$TV_ATTEMPT_POLL_COUNT"
    attempt2_stop="$TV_ATTEMPT_STOP_OBSERVATION"
  else
    capture_player_observations
    attempt2_polls=0
    attempt2_stop=recovery_launch_not_confirmed
  fi
  capture_screenshot attempt-2-after
  attempt2_after="$TV_CURRENT_ZNS_SNAPSHOT"
  record_navigation_attempt 2 "$retry_reason" "$attempt2_stop" "$attempt2_polls" \
    "$attempt2_before" "$attempt2_after" "$TV_ATTEMPT2_BEFORE_SCREENSHOT" "$TV_ATTEMPT2_AFTER_SCREENSHOT"
fi

# Focus movement is not inferred from dispatched keys; process/activity/window are checked afterward.
STAGE=interaction_capture
adb shell input keyevent KEYCODE_DPAD_DOWN
adb shell input keyevent KEYCODE_DPAD_UP
export TV_DPAD_DISPATCH=yes
sleep 1
STAGE=evidence_capture
capture_screenshot dpad
STAGE=required_app_state
check_app_state DPAD || { echo "Required app process/foreground/focus check failed after D-pad" >&2; exit 1; }

STAGE=interaction_capture
adb shell input keyevent KEYCODE_BACK
export TV_BACK_DISPATCH=yes
sleep 2
STAGE=evidence_capture
capture_screenshot back
STAGE=required_app_state
check_app_state BACK || { echo "Required app process/foreground/focus check failed after Back" >&2; exit 1; }

STAGE=complete
