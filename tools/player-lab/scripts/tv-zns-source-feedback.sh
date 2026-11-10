#!/usr/bin/env bash
set -euo pipefail

# Explicitly selected, on-demand observation of the official ZNS browser route.
# It never starts, unmutes, or raises the volume of a video element.
PACKAGE="com.kulchaflo.tv.mk2.gv"
ACTIVITY="$PACKAGE/.app.GeckoBrowserActivity"
APK="app-gv/build/outputs/apk/universal/debug/app-gv-universal-debug.apk"
REPORT_DIR="$RUNNER_TEMP/tv-emulator-qualification"
SOURCE_URL="https://znsbahamas.com/"

mkdir -p "$REPORT_DIR"
test -s "$APK" || { echo "Universal debug APK missing" >&2; exit 1; }

adb wait-for-device
BOOT=$(adb shell getprop sys.boot_completed | tr -d '\r')
ABI=$(adb shell getprop ro.product.cpu.abi | tr -d '\r')
FEATURES=$(adb shell pm list features)
SIZE=$(adb shell wm size | tr -d '\r')

[[ "$BOOT" == "1" ]] || { echo "Android emulator did not report completed boot" >&2; exit 1; }
[[ "$ABI" == "x86_64" ]] || { echo "Expected x86_64 Android TV, got $ABI" >&2; exit 1; }
grep -Fq "android.software.leanback" <<<"$FEATURES" || {
  echo "The emulator does not expose the Android TV leanback feature" >&2
  exit 1
}

check_app_state() {
  local activity_lines focus_lines
  APP_PROCESS="no"
  ACTIVITY_FOREGROUND="no"
  WINDOW_FOCUSED="no"

  if [[ -n "$(adb shell pidof "$PACKAGE" | tr -d '\r' || true)" ]]; then
    APP_PROCESS="yes"
  fi
  activity_lines=$(adb shell dumpsys activity activities | tr -d '\r' | grep -E 'topResumedActivity|mResumedActivity' || true)
  if grep -Fq "$PACKAGE" <<<"$activity_lines"; then
    ACTIVITY_FOREGROUND="yes"
  fi
  focus_lines=$(adb shell dumpsys window windows | tr -d '\r' | grep -E 'mCurrentFocus|mFocusedApp' || true)
  if grep -Fq "$PACKAGE" <<<"$focus_lines"; then
    WINDOW_FOCUSED="yes"
  fi

  [[ "$APP_PROCESS" == "yes" && "$ACTIVITY_FOREGROUND" == "yes" && "$WINDOW_FOCUSED" == "yes" ]] || {
    echo "GeckoView was not foregrounded and focused at the $1 checkpoint" >&2
    return 1
  }
}

adb logcat -c
adb install -r "$APK" >/dev/null
adb shell am start -W -n "$ACTIVITY" -e url "$SOURCE_URL" >/dev/null
# Wait for bounded helper discovery and, if the page itself plays, its one progression sample.
sleep 25
check_app_state after_launch
LAUNCH_PROCESS="$APP_PROCESS"
LAUNCH_FOREGROUND="$ACTIVITY_FOREGROUND"
LAUNCH_FOCUS="$WINDOW_FOCUSED"

# Focus movement is not inferred from dispatched keys; app/window state is checked afterward.
adb shell input keyevent KEYCODE_DPAD_DOWN
adb shell input keyevent KEYCODE_DPAD_UP
sleep 1
check_app_state after_dpad
DPAD_PROCESS="$APP_PROCESS"
DPAD_FOREGROUND="$ACTIVITY_FOREGROUND"
DPAD_FOCUS="$WINDOW_FOCUSED"
adb shell screencap -p /sdcard/kf-zns-after-dpad.png
adb pull /sdcard/kf-zns-after-dpad.png "$REPORT_DIR/zns-after-dpad.png" >/dev/null
test -s "$REPORT_DIR/zns-after-dpad.png"

adb shell input keyevent KEYCODE_BACK
sleep 2
check_app_state after_back
BACK_PROCESS="$APP_PROCESS"
BACK_FOREGROUND="$ACTIVITY_FOREGROUND"
BACK_FOCUS="$WINDOW_FOCUSED"
adb shell screencap -p /sdcard/kf-zns-after-back.png
adb pull /sdcard/kf-zns-after-back.png "$REPORT_DIR/zns-after-back.png" >/dev/null
test -s "$REPORT_DIR/zns-after-back.png"

# Capture only known phases and bounded scalar state; never upload unfiltered logcat.
ZNS_PHASES=$(adb logcat -d -s GvMedia:I | sed -nE \
  's/^.*zns helper phase=(zns-outer-player-first|zns-embedded-observed|zns-embedded-playing|zns-video-time-advanced) mode=browser-first ready=.*$/\1/p' | sort -u | paste -sd, -)
PLAYER_STATE=$(adb logcat -d -s GvMedia:I | sed -nE \
  's/^.*zns helper phase=zns-embedded-observed mode=browser-first ready=([0-4]) paused=(true|false) muted=(true|false) volume=(-1(\.0+)?|0(\.[0-9]+)?|1(\.0+)?).*$/ready=\1,paused=\2,muted=\3,volume=\4/p' | tail -n 1)
ZNS_STATE="not-observed"
[[ -n "$ZNS_PHASES" ]] && ZNS_STATE="observed"
TIME_ADVANCED="no"
grep -Fq "zns-video-time-advanced" <<<"$ZNS_PHASES" && TIME_ADVANCED="yes"

{
  echo "KULCHA FLO TV — ON-DEMAND ZNS SOURCE FEEDBACK"
  echo "commit=$GITHUB_SHA"
  echo "image=android-tv API36 x86_64"
  echo "android_boot=$BOOT"
  echo "abi=$ABI"
  echo "display=$SIZE"
  echo "app_package=$PACKAGE"
  echo "requested_source=https://znsbahamas.com/"
  echo "app_process_after_launch=$LAUNCH_PROCESS"
  echo "activity_foreground_after_launch=$LAUNCH_FOREGROUND"
  echo "window_focus_after_launch=$LAUNCH_FOCUS"
  echo "zns_helper_state=$ZNS_STATE"
  echo "zns_helper_phases=${ZNS_PHASES:-none}"
  echo "player_state=${PLAYER_STATE:-not-observed}"
  echo "video_time_advanced_observed=$TIME_ADVANCED"
  echo "dpad_down_up_dispatched=yes"
  echo "app_process_after_dpad=$DPAD_PROCESS"
  echo "activity_foreground_after_dpad=$DPAD_FOREGROUND"
  echo "window_focus_after_dpad=$DPAD_FOCUS"
  echo "screenshot_after_dpad=yes"
  echo "back_key_dispatched=yes"
  echo "app_process_after_back=$BACK_PROCESS"
  echo "activity_foreground_after_back=$BACK_FOREGROUND"
  echo "window_focus_after_back=$BACK_FOCUS"
  echo "screenshot_after_back=yes"
  echo "helper_initiated_playback=no"
  echo "live_stream_verified=no"
  echo "audio_output_verified=no"
  echo "physical_sony_bravia_verified=no"
} > "$REPORT_DIR/qualification.txt"
cat "$REPORT_DIR/qualification.txt"
