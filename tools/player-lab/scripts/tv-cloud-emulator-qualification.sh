#!/usr/bin/env bash
set -euo pipefail

# Neutral Android TV infrastructure check. It does not test a broadcaster or claim
# that D-pad input caused page navigation; each step records app/window state.
PACKAGE="com.kulchaflo.tv.mk2.gv"
ACTIVITY="$PACKAGE/.app.GeckoBrowserActivity"
APK="app-gv/build/outputs/apk/universal/debug/app-gv-universal-debug.apk"
REPORT_DIR="$RUNNER_TEMP/tv-emulator-qualification"

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

# Fresh anonymous emulator; keep this infrastructure check on the neutral page.
adb install -r "$APK" >/dev/null
adb shell am start -W -n "$ACTIVITY" -e url "https://example.com" >/dev/null
sleep 8
check_app_state after_launch
LAUNCH_PROCESS="$APP_PROCESS"
LAUNCH_FOREGROUND="$ACTIVITY_FOREGROUND"
LAUNCH_FOCUS="$WINDOW_FOCUSED"

# D-pad keys are dispatched, then foreground, focus, and process are observed again.
adb shell input keyevent KEYCODE_DPAD_DOWN
adb shell input keyevent KEYCODE_DPAD_UP
sleep 1
check_app_state after_dpad
DPAD_PROCESS="$APP_PROCESS"
DPAD_FOREGROUND="$ACTIVITY_FOREGROUND"
DPAD_FOCUS="$WINDOW_FOCUSED"
adb shell screencap -p /sdcard/kf-tv-qualification-after-dpad.png
adb pull /sdcard/kf-tv-qualification-after-dpad.png "$REPORT_DIR/after-dpad.png" >/dev/null
test -s "$REPORT_DIR/after-dpad.png"

# Back is followed by the same observable state checks and a second screenshot.
adb shell input keyevent KEYCODE_BACK
sleep 2
check_app_state after_back
BACK_PROCESS="$APP_PROCESS"
BACK_FOREGROUND="$ACTIVITY_FOREGROUND"
BACK_FOCUS="$WINDOW_FOCUSED"
adb shell screencap -p /sdcard/kf-tv-qualification-after-back.png
adb pull /sdcard/kf-tv-qualification-after-back.png "$REPORT_DIR/after-back.png" >/dev/null
test -s "$REPORT_DIR/after-back.png"

{
  echo "KULCHA FLO TV — NEUTRAL TV EMULATOR QUALIFICATION"
  echo "commit=$GITHUB_SHA"
  echo "image=android-tv API36 x86_64"
  echo "android_boot=$BOOT"
  echo "abi=$ABI"
  echo "display=$SIZE"
  echo "app_package=$PACKAGE"
  echo "requested_page=https://example.com"
  echo "app_process_after_launch=$LAUNCH_PROCESS"
  echo "activity_foreground_after_launch=$LAUNCH_FOREGROUND"
  echo "window_focus_after_launch=$LAUNCH_FOCUS"
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
  echo "broadcaster_playback_verified=no"
  echo "audio_verified=no"
  echo "physical_sony_bravia_verified=no"
} > "$REPORT_DIR/qualification.txt"
cat "$REPORT_DIR/qualification.txt"
