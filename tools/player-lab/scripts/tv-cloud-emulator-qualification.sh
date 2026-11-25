#!/usr/bin/env bash
set -euo pipefail

# Neutral Android TV infrastructure check. It does not test a broadcaster or claim
# that D-pad input caused page navigation; each step records app/window state.
PACKAGE="com.kulchaflo.tv.mk2.gv"
ACTIVITY="$PACKAGE/.app.GeckoBrowserActivity"
APK="app-gv/build/outputs/apk/universal/debug/app-gv-universal-debug.apk"
REPORT_DIR="${TV_REPORT_DIR:-${RUNNER_TEMP:-/tmp}/tv-emulator-qualification}"
NAVIGATION_WAIT_SECONDS=30
APK_INSTALL_TIMEOUT_SECONDS=60
MAX_APP_STATE_POLLS=3
APP_STATE_POLL_INTERVAL_SECONDS=2
APP_STATE_CAPTURE_TIMEOUT_SECONDS=15
MAX_SCREENSHOT_BYTES=$((4 * 1024 * 1024))
if [[ "${TV_MAX_SCREENSHOT_BYTES:-}" =~ ^[0-9]+$ ]]; then MAX_SCREENSHOT_BYTES=$TV_MAX_SCREENSHOT_BYTES; fi
FAILURE_STAGE=preflight

mkdir -p "$REPORT_DIR"
BOOT_STATUS=unknown ABI_STATUS=unknown LEANBACK_STATUS=unknown
INSTALL_STATUS=unknown LAUNCH_STATUS=unknown NAVIGATION_STATUS=not_observed
NAVIGATION_CAPTURE_STATUS=incomplete
LAUNCH_PROCESS=unknown LAUNCH_FOREGROUND=unknown LAUNCH_FOCUS=unknown
LAUNCH_STATE_POLLS=0
DPAD_PROCESS=unknown DPAD_FOREGROUND=unknown DPAD_FOCUS=unknown
BACK_PROCESS=unknown BACK_FOREGROUND=unknown BACK_FOCUS=unknown
DPAD_DISPATCH=no BACK_DISPATCH=no
SCREENSHOT_INITIAL=missing SCREENSHOT_DPAD=missing SCREENSHOT_BACK=missing
FAILURE_OBSERVATION=qualification_not_completed
VIRTUAL_HARNESS_STATUS=FAIL

capture_screenshot() {
  local phase="$1" remote="$2" path="$REPORT_DIR/$1.png" size status=missing
  if timeout 8 adb shell screencap -p "$remote" >/dev/null 2>&1 \
    && timeout 8 adb pull "$remote" "$path" >/dev/null 2>&1 \
    && [[ -s "$path" ]]; then
    size=$(stat -c '%s' "$path" 2>/dev/null || printf '0')
    if [[ "$size" =~ ^[0-9]+$ ]] && (( size <= MAX_SCREENSHOT_BYTES )); then
      status=captured
    else
      rm -f "$path"
      status=oversize
    fi
  else
    rm -f "$path"
  fi
  case "$phase" in
    initial) SCREENSHOT_INITIAL=$status ;;
    after-dpad) SCREENSHOT_DPAD=$status ;;
    after-back) SCREENSHOT_BACK=$status ;;
  esac
}

check_app_state() {
  local state_file="$REPORT_DIR/app-state.json" parsed
  APP_PROCESS=unknown ACTIVITY_FOREGROUND=unknown WINDOW_FOCUSED=unknown
  timeout "$APP_STATE_CAPTURE_TIMEOUT_SECONDS" python3 tools/player-lab/scripts/tv-emulator-state.py capture > "$state_file" 2>/dev/null || true
  if [[ -s "$state_file" ]]; then
    parsed=$(python3 - "$state_file" <<'PY'
import json, sys
try:
  state = json.load(open(sys.argv[1], encoding="utf-8"))
except (OSError, ValueError):
  state = {}
for key in ("process", "activity_foreground", "window_focus"):
  value = state.get(key, "unknown")
  print(value if value in ("yes", "no", "unknown") else "unknown")
PY
    ) || parsed=$'unknown\nunknown\nunknown'
    mapfile -t state_values <<< "$parsed"
    APP_PROCESS="${state_values[0]:-unknown}"
    ACTIVITY_FOREGROUND="${state_values[1]:-unknown}"
    WINDOW_FOCUSED="${state_values[2]:-unknown}"
  fi
  [[ "$APP_PROCESS" == yes && "$ACTIVITY_FOREGROUND" == yes && "$WINDOW_FOCUSED" == yes ]]
}

wait_for_app_state() {
  local poll
  for ((poll=1; poll<=MAX_APP_STATE_POLLS; poll++)); do
    LAUNCH_STATE_POLLS=$poll
    if check_app_state; then return 0; fi
    if (( poll < MAX_APP_STATE_POLLS )); then sleep "$APP_STATE_POLL_INTERVAL_SECONDS"; fi
  done
  return 1
}

finalize() {
  local original_status=$?
  trap - EXIT
  if (( original_status == 0 )) && [[ "$NAVIGATION_STATUS" == completed \
      && "$SCREENSHOT_INITIAL" == captured && "$SCREENSHOT_DPAD" == captured \
      && "$SCREENSHOT_BACK" == captured ]]; then
    VIRTUAL_HARNESS_STATUS=PASS
    FAILURE_OBSERVATION=none
  elif [[ "$FAILURE_OBSERVATION" == qualification_not_completed ]]; then
    case "$FAILURE_STAGE" in
      emulator_boot) FAILURE_OBSERVATION=emulator_boot_or_adb_failed ;;
      apk_install) FAILURE_OBSERVATION=apk_install_failed ;;
      app_launch) FAILURE_OBSERVATION=app_launch_unconfirmed ;;
      launch_state) FAILURE_OBSERVATION=launch_app_state_check_failed ;;
      navigation) FAILURE_OBSERVATION="neutral_navigation_${NAVIGATION_STATUS}" ;;
      dpad_state) FAILURE_OBSERVATION=dpad_app_state_check_failed ;;
      back_state) FAILURE_OBSERVATION=back_app_state_check_failed ;;
      final_checks)
        if [[ "$NAVIGATION_STATUS" == failed ]]; then
          FAILURE_OBSERVATION=neutral_page_navigation_failed
        elif [[ "$NAVIGATION_STATUS" != completed ]]; then
          FAILURE_OBSERVATION=neutral_page_navigation_not_observed
        else
          FAILURE_OBSERVATION=required_screenshot_or_remote_action_missing
        fi
        ;;
      *) FAILURE_OBSERVATION=qualification_setup_failed ;;
    esac
  fi
  export QUAL_COMMIT="${GITHUB_SHA:-unknown}" QUAL_PROFILE_STATUS="$VIRTUAL_HARNESS_STATUS"
  export QUAL_BOOT="$BOOT_STATUS" QUAL_ABI="$ABI_STATUS" QUAL_LEANBACK="$LEANBACK_STATUS"
  export QUAL_INSTALL="$INSTALL_STATUS" QUAL_LAUNCH="$LAUNCH_STATUS" QUAL_NAV="$NAVIGATION_STATUS"
  export QUAL_NAV_CAPTURE="$NAVIGATION_CAPTURE_STATUS" QUAL_FAILURE="$FAILURE_OBSERVATION"
  export QUAL_FAILURE_STAGE="$FAILURE_STAGE"
  export QUAL_LP="$LAUNCH_PROCESS" QUAL_LF="$LAUNCH_FOREGROUND" QUAL_LW="$LAUNCH_FOCUS"
  export QUAL_LAUNCH_POLLS="$LAUNCH_STATE_POLLS" QUAL_MAX_LAUNCH_POLLS="$MAX_APP_STATE_POLLS"
  export QUAL_STATE_POLL_INTERVAL="$APP_STATE_POLL_INTERVAL_SECONDS" QUAL_STATE_CAPTURE_TIMEOUT="$APP_STATE_CAPTURE_TIMEOUT_SECONDS"
  export QUAL_DP="$DPAD_PROCESS" QUAL_DF="$DPAD_FOREGROUND" QUAL_DW="$DPAD_FOCUS"
  export QUAL_BP="$BACK_PROCESS" QUAL_BF="$BACK_FOREGROUND" QUAL_BW="$BACK_FOCUS"
  export QUAL_DPAD="$DPAD_DISPATCH" QUAL_BACK="$BACK_DISPATCH"
  export QUAL_SI="$SCREENSHOT_INITIAL" QUAL_SD="$SCREENSHOT_DPAD" QUAL_SB="$SCREENSHOT_BACK"
  python3 - "$REPORT_DIR/qualification.json" <<'PY'
import json, os, sys
receipt = {
  "schema_version": 1,
  "receipt_finalized": True,
  "commit": os.environ["QUAL_COMMIT"],
  "selected_profile": "qualification",
  "virtual_harness_status": os.environ["QUAL_PROFILE_STATUS"],
  "failure_stage": os.environ["QUAL_FAILURE_STAGE"],
  "infrastructure": {
    "android_tv_boot": os.environ["QUAL_BOOT"],
    "abi_x86_64": os.environ["QUAL_ABI"],
    "leanback_feature": os.environ["QUAL_LEANBACK"],
    "apk_install": os.environ["QUAL_INSTALL"],
    "app_launch": os.environ["QUAL_LAUNCH"],
  },
  "neutral_route": {
    "route": "https://example.com/",
    "navigation_status": os.environ["QUAL_NAV"],
    "navigation_log_capture": os.environ["QUAL_NAV_CAPTURE"],
  },
  "app_state": {
    "after_launch": {"process": os.environ["QUAL_LP"], "activity_foreground": os.environ["QUAL_LF"], "window_focus": os.environ["QUAL_LW"]},
    "launch_readiness": {"polls_used": int(os.environ["QUAL_LAUNCH_POLLS"]), "poll_limit": int(os.environ["QUAL_MAX_LAUNCH_POLLS"]), "poll_interval_seconds": int(os.environ["QUAL_STATE_POLL_INTERVAL"]), "capture_timeout_seconds": int(os.environ["QUAL_STATE_CAPTURE_TIMEOUT"]), "max_wait_seconds": int(os.environ["QUAL_MAX_LAUNCH_POLLS"]) * int(os.environ["QUAL_STATE_CAPTURE_TIMEOUT"]) + (int(os.environ["QUAL_MAX_LAUNCH_POLLS"]) - 1) * int(os.environ["QUAL_STATE_POLL_INTERVAL"])},
    "after_dpad": {"process": os.environ["QUAL_DP"], "activity_foreground": os.environ["QUAL_DF"], "window_focus": os.environ["QUAL_DW"]},
    "after_back": {"process": os.environ["QUAL_BP"], "activity_foreground": os.environ["QUAL_BF"], "window_focus": os.environ["QUAL_BW"]},
  },
  "actions": {"dpad_down_up_dispatched": os.environ["QUAL_DPAD"], "back_dispatched": os.environ["QUAL_BACK"]},
  "screenshots": {"initial": os.environ["QUAL_SI"], "after_dpad": os.environ["QUAL_SD"], "after_back": os.environ["QUAL_SB"]},
  "playback_progression": "not_tested",
  "audio_output": "not_tested",
  "physical_bravia_acceptance": "not_tested",
  "failure_observation": os.environ["QUAL_FAILURE"],
}
with open(sys.argv[1], "w", encoding="utf-8") as stream:
  json.dump(receipt, stream, indent=2)
  stream.write("\n")
summary = os.environ.get("GITHUB_STEP_SUMMARY")
if summary:
  with open(summary, "a", encoding="utf-8") as stream:
    stream.write("## Neutral Android TV qualification\n\n")
    stream.write(f"- Virtual Android TV harness: `{receipt['virtual_harness_status']}`\n")
    stream.write(f"- Observation responsible for result: `{receipt['failure_observation']}`\n")
    stream.write(f"- Navigation to the neutral route: `{receipt['neutral_route']['navigation_status']}`\n")
    stream.write("- Broadcaster playback: `not tested`; physical Bravia acceptance: `not tested`\n")
PY
  {
    echo "KULCHA FLO TV — NEUTRAL TV EMULATOR QUALIFICATION"
    echo "commit=${GITHUB_SHA:-unknown}"
    echo "selected_profile=qualification"
    echo "virtual_harness_status=$VIRTUAL_HARNESS_STATUS"
    echo "failure_observation=$FAILURE_OBSERVATION"
    echo "failure_stage=$FAILURE_STAGE"
    echo "android_tv_boot=$BOOT_STATUS"
    echo "abi_x86_64=$ABI_STATUS"
    echo "leanback_feature=$LEANBACK_STATUS"
    echo "apk_install=$INSTALL_STATUS"
    echo "app_launch=$LAUNCH_STATUS"
    echo "neutral_navigation=$NAVIGATION_STATUS"
    echo "initial_screenshot=$SCREENSHOT_INITIAL"
    echo "dpad_down_up_dispatched=$DPAD_DISPATCH"
    echo "screenshot_after_dpad=$SCREENSHOT_DPAD"
    echo "back_key_dispatched=$BACK_DISPATCH"
    echo "screenshot_after_back=$SCREENSHOT_BACK"
    echo "playback_progression=not_tested"
    echo "audio_output=not_tested"
    echo "physical_bravia_acceptance=not_tested"
  } > "$REPORT_DIR/qualification.txt"
  cat "$REPORT_DIR/qualification.txt"
  cat "$REPORT_DIR/qualification.json"
  return "$original_status"
}
trap finalize EXIT

if [[ ! -s "$APK" ]]; then FAILURE_OBSERVATION=universal_debug_apk_missing; exit 1; fi
FAILURE_STAGE=emulator_boot
timeout 60 adb wait-for-device
BOOT=$(timeout 8 adb shell getprop sys.boot_completed | tr -d '\r')
ABI=$(timeout 8 adb shell getprop ro.product.cpu.abi | tr -d '\r')
FEATURES=$(timeout 8 adb shell pm list features)
SIZE=$(timeout 8 adb shell wm size | tr -d '\r')
[[ "$BOOT" == 1 ]] || { FAILURE_OBSERVATION=android_boot_not_completed; exit 1; }
BOOT_STATUS=yes
[[ "$ABI" == x86_64 ]] || { ABI_STATUS=no; FAILURE_OBSERVATION=unexpected_emulator_abi; exit 1; }
ABI_STATUS=yes
grep -Fq "android.software.leanback" <<<"$FEATURES" || { LEANBACK_STATUS=no; FAILURE_OBSERVATION=leanback_feature_missing; exit 1; }
LEANBACK_STATUS=yes

FAILURE_STAGE=apk_install
timeout 30 adb logcat -c
if timeout "$APK_INSTALL_TIMEOUT_SECONDS" adb install -r "$APK" >/dev/null; then
  INSTALL_STATUS=yes
else
  INSTALL_STATUS=no
  FAILURE_OBSERVATION=apk_install_failed
  exit 1
fi
FAILURE_STAGE=app_launch
if launch_output=$(timeout 15 adb shell am start -W -n "$ACTIVITY" -e url "https://example.com" 2>&1) \
  && grep -Eq '^Status:[[:space:]]*ok[[:space:]]*$' <<<"$launch_output"; then
  LAUNCH_STATUS=confirmed
else
  LAUNCH_STATUS=unconfirmed
  FAILURE_OBSERVATION=app_launch_not_confirmed
  exit 1
fi
unset launch_output

# Capture the first app frame before waiting for a navigation event.
capture_screenshot initial /sdcard/kf-tv-qualification-initial.png
FAILURE_STAGE=launch_state
if ! wait_for_app_state; then
  LAUNCH_PROCESS=$APP_PROCESS
  LAUNCH_FOREGROUND=$ACTIVITY_FOREGROUND
  LAUNCH_FOCUS=$WINDOW_FOCUSED
  FAILURE_OBSERVATION=launch_app_state_check_failed
  exit 1
fi
LAUNCH_PROCESS=$APP_PROCESS
LAUNCH_FOREGROUND=$ACTIVITY_FOREGROUND
LAUNCH_FOCUS=$WINDOW_FOCUSED

# Observe a real GeckoView page-stop event for the fixed neutral route, with a
# 30-second cap; this adapts to navigation speed and never stores arbitrary URLs.
FAILURE_STAGE=navigation
if timeout "$((NAVIGATION_WAIT_SECONDS + 5))" python3 tools/player-lab/scripts/tv-neutral-navigation-snapshot.py capture \
  > "$REPORT_DIR/navigation-observation.json"; then
  NAVIGATION_STATUS=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("navigation_status","not_observed"))' "$REPORT_DIR/navigation-observation.json")
  NAVIGATION_CAPTURE_STATUS=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("capture_status","incomplete"))' "$REPORT_DIR/navigation-observation.json")
else
  NAVIGATION_CAPTURE_STATUS=incomplete
fi

FAILURE_STAGE=dpad_state
if timeout 5 adb shell input keyevent KEYCODE_DPAD_DOWN \
  && timeout 5 adb shell input keyevent KEYCODE_DPAD_UP; then
  DPAD_DISPATCH=yes
fi
sleep 1
check_app_state
DPAD_PROCESS=$APP_PROCESS
DPAD_FOREGROUND=$ACTIVITY_FOREGROUND
DPAD_FOCUS=$WINDOW_FOCUSED
capture_screenshot after-dpad /sdcard/kf-tv-qualification-after-dpad.png
if [[ "$APP_PROCESS" != yes || "$ACTIVITY_FOREGROUND" != yes || "$WINDOW_FOCUSED" != yes ]]; then
  FAILURE_STAGE=dpad_state
  FAILURE_OBSERVATION=dpad_app_state_check_failed
  exit 1
fi

if timeout 5 adb shell input keyevent KEYCODE_BACK; then BACK_DISPATCH=yes; fi
sleep 2
FAILURE_STAGE=back_state
check_app_state
BACK_PROCESS=$APP_PROCESS
BACK_FOREGROUND=$ACTIVITY_FOREGROUND
BACK_FOCUS=$WINDOW_FOCUSED
capture_screenshot after-back /sdcard/kf-tv-qualification-after-back.png
if [[ "$APP_PROCESS" != yes || "$ACTIVITY_FOREGROUND" != yes || "$WINDOW_FOCUSED" != yes ]]; then
  FAILURE_OBSERVATION=back_app_state_check_failed
  exit 1
fi

FAILURE_STAGE=final_checks
[[ "$DPAD_DISPATCH" == yes && "$BACK_DISPATCH" == yes ]] || exit 1
[[ "$NAVIGATION_STATUS" == completed ]] || exit 1
[[ "$SCREENSHOT_INITIAL" == captured && "$SCREENSHOT_DPAD" == captured && "$SCREENSHOT_BACK" == captured ]] || {
  FAILURE_OBSERVATION=required_screenshot_missing_or_oversize
  exit 1
}
VIRTUAL_HARNESS_STATUS=PASS
FAILURE_OBSERVATION=none
exit 0
