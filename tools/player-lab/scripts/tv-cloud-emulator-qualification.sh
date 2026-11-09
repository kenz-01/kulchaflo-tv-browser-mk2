#!/usr/bin/env bash
set -euo pipefail

# Qualify the CI emulator and launch the existing GeckoView TV shell.
# Deliberately avoid broadcaster URLs, live streams and user credentials.
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

# Fresh, anonymous emulator only. Do not use real accounts or broadcaster streams.
adb install -r "$APK" >/dev/null
adb shell am start -W -n "$ACTIVITY" -e url "https://example.com" >/dev/null
sleep 12

START_PID=$(adb shell pidof "$PACKAGE" | tr -d '\r' || true)
[[ -n "$START_PID" ]] || { echo "GeckoView activity process did not remain running" >&2; exit 1; }

# Exercise remote input routing, without attempting playback.
adb shell input keyevent KEYCODE_DPAD_DOWN
adb shell input keyevent KEYCODE_DPAD_UP
adb shell input keyevent KEYCODE_DPAD_CENTER
sleep 2
adb shell screencap -p /sdcard/kf-tv-qualification.png
adb pull /sdcard/kf-tv-qualification.png "$REPORT_DIR/qualification.png" >/dev/null
test -s "$REPORT_DIR/qualification.png"
adb shell input keyevent KEYCODE_BACK
sleep 2

# Safe receipt only; never upload unfiltered logcat from this public repository.
{
  echo "KULCHA FLO TV — CLOUD EMULATOR QUALIFICATION"
  echo "commit=$GITHUB_SHA"
  echo "image=android-tv API36 x86_64"
  echo "android_boot=$BOOT"
  echo "abi=$ABI"
  echo "display=$SIZE"
  echo "app_package=$PACKAGE"
  echo "app_process_started=yes"
  echo "remote_dpad_center_back_events_dispatched=yes"
  echo "screenshot_saved=yes"
  echo "test_page=https://example.com"
  echo "real_live_stream_verified=no"
  echo "audio_verified=no"
  echo "physical_sony_bravia_verified=no"
} > "$REPORT_DIR/qualification.txt"
cat "$REPORT_DIR/qualification.txt"
