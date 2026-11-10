#!/usr/bin/env bash
set -euo pipefail

# Explicitly selected, on-demand observation of the official ZNS browser route.
# It never starts, unmutes, or raises the volume of a video element.
PACKAGE="com.kulchaflo.tv.mk2.gv"
ACTIVITY="$PACKAGE/.app.GeckoBrowserActivity"
APK="app-gv/build/outputs/apk/universal/debug/app-gv-universal-debug.apk"
REPORT_DIR="${RUNNER_TEMP:-/tmp}/tv-emulator-qualification"
RECEIPT="$REPORT_DIR/zns-diagnostic-receipt.json"
SOURCE_URL="https://znsbahamas.com/"
STAGE="preflight"

mkdir -p "$REPORT_DIR"
export TV_TEST_PROFILE=zns
export TV_ZNS_SOURCE_URL="$SOURCE_URL"
export TV_EMULATOR_BOOT=no
export TV_APK_INSTALL=unknown
export TV_APP_LAUNCH=unknown
export TV_LAUNCH_PROCESS=unknown TV_LAUNCH_FOREGROUND=unknown TV_LAUNCH_FOCUS=unknown
export TV_DPAD_PROCESS=unknown TV_DPAD_FOREGROUND=unknown TV_DPAD_FOCUS=unknown
export TV_BACK_PROCESS=unknown TV_BACK_FOREGROUND=unknown TV_BACK_FOCUS=unknown
export TV_SCREENSHOT_DPAD=missing TV_SCREENSHOT_BACK=missing
export TV_DPAD_DISPATCH=no TV_BACK_DISPATCH=no
export TV_LOG_CAPTURE=incomplete TV_ZNS_PHASES=
export TV_PLAYER_READY= TV_PLAYER_PAUSED= TV_PLAYER_MUTED= TV_PLAYER_VOLUME=
export TV_TIME_ADVANCED=no TV_FAILURE_STAGE=

finish() {
  local original_status=$? classification final_status
  trap - EXIT
  set +e
  if (( original_status != 0 )); then
    export TV_FAILURE_STAGE="$STAGE"
  fi
  node tools/player-lab/src/zns-feedback-outcome.mjs --from-env > "$RECEIPT"
  local classifier_status=$?
  if (( classifier_status != 0 )); then
    original_status=1
    printf '{"schema_version":1,"receipt_finalized":false,"classification":"INCONCLUSIVE","reason":"Receipt classifier failed.","live_stream_verified":false,"moving_picture_verified":false,"audio_output_verified":false,"physical_bravia_verified":false}\n' > "$RECEIPT"
  fi
  classification=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("classification", "INCONCLUSIVE"))' "$RECEIPT" 2>/dev/null)
  {
    echo "## ZNS diagnostic harness report"
    echo
    echo "- Classification: `$classification`"
    echo "- Commit: `${GITHUB_SHA:-unknown}`"
    echo "- Selected profile: `zns`"
    echo "- A green job means the bounded diagnostic harness completed; it does not verify live-stream playback, moving picture, audio output, or Bravia acceptance."
    echo "- Machine-readable receipt: `zns-diagnostic-receipt.json`"
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
adb shell am start -W -n "$ACTIVITY" -e url "$SOURCE_URL" >/dev/null
export TV_APP_LAUNCH=yes

check_app_state() {
  local label="$1" activity_lines focus_lines process=no focus=no activity=no
  local pid
  pid=$(adb shell pidof "$PACKAGE" 2>/dev/null | tr -d '\r' || true)
  if [[ -n "$pid" ]]; then process=yes; fi
  activity_lines=$(adb shell dumpsys activity activities 2>/dev/null | tr -d '\r' | grep -E 'topResumedActivity|mResumedActivity' || true)
  if grep -Fq "$PACKAGE" <<<"$activity_lines"; then activity=yes; fi
  focus_lines=$(adb shell dumpsys window windows 2>/dev/null | tr -d '\r' | grep -E 'mCurrentFocus|mFocusedApp' || true)
  if grep -Fq "$PACKAGE" <<<"$focus_lines"; then focus=yes; fi
  printf -v "TV_${label}_PROCESS" '%s' "$process"
  printf -v "TV_${label}_FOREGROUND" '%s' "$activity"
  printf -v "TV_${label}_FOCUS" '%s' "$focus"
  export "TV_${label}_PROCESS" "TV_${label}_FOREGROUND" "TV_${label}_FOCUS"
  [[ "$process" == yes && "$activity" == yes && "$focus" == yes ]]
}

STAGE=required_app_state
# Wait only for the bounded source helper observation/progression window.
sleep 25
check_app_state LAUNCH || { echo "Required app process/foreground/focus check failed after launch" >&2; exit 1; }

# Focus movement is not inferred from dispatched keys; process/activity/window are checked afterward.
adb shell input keyevent KEYCODE_DPAD_DOWN
adb shell input keyevent KEYCODE_DPAD_UP
export TV_DPAD_DISPATCH=yes
sleep 1
check_app_state DPAD || { echo "Required app process/foreground/focus check failed after D-pad" >&2; exit 1; }

STAGE=evidence_capture
adb shell screencap -p /sdcard/kf-zns-after-dpad.png
adb pull /sdcard/kf-zns-after-dpad.png "$REPORT_DIR/zns-after-dpad.png" >/dev/null
test -s "$REPORT_DIR/zns-after-dpad.png"
export TV_SCREENSHOT_DPAD=captured

STAGE=interaction_capture
adb shell input keyevent KEYCODE_BACK
export TV_BACK_DISPATCH=yes
sleep 2
STAGE=required_app_state
check_app_state BACK || { echo "Required app process/foreground/focus check failed after Back" >&2; exit 1; }

STAGE=evidence_capture
adb shell screencap -p /sdcard/kf-zns-after-back.png
adb pull /sdcard/kf-zns-after-back.png "$REPORT_DIR/zns-after-back.png" >/dev/null
test -s "$REPORT_DIR/zns-after-back.png"
export TV_SCREENSHOT_BACK=captured

# Keep the raw log in memory and emit only strict allowlisted phases and scalar player state.
STAGE=log_capture
LOG_OUTPUT=$(adb logcat -d -s GvMedia:I)
export TV_LOG_CAPTURE=complete
ZNS_PHASES=$(sed -nE \
  's/^.*zns helper phase=(zns-outer-player-first|zns-embedded-observed|zns-embedded-playing|zns-video-time-advanced) mode=browser-first ready=.*$/\1/p' <<<"$LOG_OUTPUT" | awk '!seen[$0]++' | paste -sd, -)
export TV_ZNS_PHASES="$ZNS_PHASES"
PLAYER_FIELDS=$(sed -nE \
  's/^.*zns helper phase=zns-embedded-observed mode=browser-first ready=([0-4]) paused=(true|false) muted=(true|false) volume=([01](\.[0-9]+)?).*$/\1 \2 \3 \4/p' <<<"$LOG_OUTPUT" | tail -n 1)
if [[ -n "$PLAYER_FIELDS" ]]; then
  read -r TV_PLAYER_READY TV_PLAYER_PAUSED TV_PLAYER_MUTED TV_PLAYER_VOLUME <<< "$PLAYER_FIELDS"
  export TV_PLAYER_READY TV_PLAYER_PAUSED TV_PLAYER_MUTED TV_PLAYER_VOLUME
fi
if grep -Fq "zns-video-time-advanced" <<<"$ZNS_PHASES"; then
  export TV_TIME_ADVANCED=yes
fi
unset LOG_OUTPUT PLAYER_FIELDS
STAGE=complete
