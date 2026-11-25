#!/usr/bin/env bash
set -euo pipefail

PACKAGE="com.kulchaflo.tv.mk2.gv"
ACTIVITY="$PACKAGE/.app.GeckoBrowserActivity"
APK="app-gv/build/outputs/apk/universal/debug/app-gv-universal-debug.apk"
SOURCE_URL="https://telesistema11.com.do/en-vivo/"
REPORT_DIR="${TV_REPORT_DIR:-${RUNNER_TEMP:-/tmp}/tv-emulator-qualification/telesistema}"
export TV_REPORT_DIR="$REPORT_DIR"
MAX_STARTUP_SECONDS=45
MAX_POST_DPAD_SECONDS=16
POLL_SECONDS=2
MAX_SCREENSHOT_BYTES=$((1024 * 1024))
if [[ "${TV_MAX_SCREENSHOT_BYTES:-}" =~ ^[0-9]+$ ]]; then MAX_SCREENSHOT_BYTES=$TV_MAX_SCREENSHOT_BYTES; fi

mkdir -p "$REPORT_DIR"
export TV_TEST_PROFILE=telesistema
BOOT=unknown ABI=unknown LEANBACK=unknown INSTALL=unknown LAUNCH=unknown
DPAD_ACTION=not_sent BACK_ACTION=not_sent
INITIAL_SCREENSHOT=missing BEFORE_DPAD_SCREENSHOT=missing AFTER_DPAD_SCREENSHOT=missing AFTER_BACK_SCREENSHOT=missing
PASSIVE_SNAPSHOT='{}' AFTER_DPAD_SNAPSHOT='{}' AFTER_BACK_SNAPSHOT='{}'
STARTUP_WAIT_SECONDS=0 POST_DPAD_WAIT_SECONDS=0
FAILURE_STAGE=preflight

capture_screenshot() {
  local label="$1" remote="/sdcard/kf-telesistema-$1.png" path="$REPORT_DIR/telesistema-$1.png" size=0 status=missing
  if timeout 8 adb shell screencap -p "$remote" >/dev/null 2>&1 \
    && timeout 8 adb pull "$remote" "$path" >/dev/null 2>&1 && [[ -s "$path" ]]; then
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
  case "$label" in
    initial) INITIAL_SCREENSHOT=$status ;;
    before-dpad) BEFORE_DPAD_SCREENSHOT=$status ;;
    after-dpad) AFTER_DPAD_SCREENSHOT=$status ;;
    after-back) AFTER_BACK_SCREENSHOT=$status ;;
    *) return 1 ;;
  esac
}

capture_state() {
  local label="$1" file="$REPORT_DIR/app-state-$1.json"
  timeout 15 python3 tools/player-lab/scripts/tv-emulator-state.py capture > "$file" 2>/dev/null || true
  if [[ ! -s "$file" ]]; then printf '{}\n' > "$file"; fi
}

capture_snapshot() {
  local label="$1" destination="$REPORT_DIR/telesistema-$1.json" snapshot='{}'
  snapshot=$(timeout 9 python3 tools/player-lab/scripts/tv-telesistema-log-snapshot.py capture 2>/dev/null || true)
  [[ "$snapshot" == \{*\} ]] || snapshot='{}'
  printf '%s\n' "$snapshot" > "$destination"
  case "$label" in
    passive) PASSIVE_SNAPSHOT="$snapshot" ;;
    after-dpad) AFTER_DPAD_SNAPSHOT="$snapshot" ;;
    after-back) AFTER_BACK_SNAPSHOT="$snapshot" ;;
  esac
}

read_snapshot() {
  printf '%s' "$1" | python3 -c '
import json,sys
try:
 d=json.load(sys.stdin)
 b=d.get("browser_media",{})
 values=[d.get("capture_status","incomplete"),d.get("official_top_level_page_start_count",0),d.get("official_top_level_page_stop_count",0),b.get("session_activated_count",0),b.get("session_deactivated_count",0),b.get("play_count",0),b.get("position_sample_count",0),b.get("position_advanced","unknown"),b.get("time_to_first_position_ms"),b.get("last_position_bucket_seconds")]
 print("\t".join(str(x if x is not None else "unknown") for x in values))
except Exception:
 print("incomplete\t0\t0\t0\t0\t0\t0\tunknown\tunknown\tunknown")
' 2>/dev/null
}

write_receipt() {
  local original_status="$1"
  python3 - "$REPORT_DIR/telesistema-diagnostic-receipt.json" <<'PY'
import json, os, sys

def safe_status(value):
    return value if value in {"yes", "no", "unknown"} else "unknown"

def read_json(path):
    try:
        with open(path, encoding="utf-8") as stream:
            value = json.load(stream)
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        return {}

report_dir=os.environ["TV_REPORT_DIR"]
passive=read_json(os.path.join(report_dir,"telesistema-passive.json"))
after_dpad=read_json(os.path.join(report_dir,"telesistema-after-dpad.json"))
after_back=read_json(os.path.join(report_dir,"telesistema-after-back.json"))
before_media=passive.get("browser_media",{})
after_media=after_dpad.get("browser_media",{})
before_starts=passive.get("official_top_level_page_start_count",0)
after_starts=after_dpad.get("official_top_level_page_start_count",0)
def count(value):
    return value if isinstance(value,int) and not isinstance(value,bool) and 0 <= value <= 10000 else 0
deactivated_delta=count(after_media.get("session_deactivated_count"))-count(before_media.get("session_deactivated_count"))
activated_delta=count(after_media.get("session_activated_count"))-count(before_media.get("session_activated_count"))
play_delta=count(after_media.get("play_count"))-count(before_media.get("play_count"))
nav_delta=max(0,count(after_starts)-count(before_starts))
before_position=before_media.get("last_position_bucket_seconds")
after_position=after_media.get("last_position_bucket_seconds")
position_delta="unknown"
if isinstance(before_position,int) and isinstance(after_position,int):
    position_delta="yes" if after_position>before_position else "no"
report={
  "schema_version":1,
  "receipt_finalized":True,
  "commit":os.environ.get("GITHUB_SHA","unknown") if len(os.environ.get("GITHUB_SHA",""))==40 else "unknown",
  "selected_profile":"telesistema",
  "source":{"official_route":"requested","route_id":"telesistema11-official-en-vivo","url_capture":"disabled"},
  "system_image_target":os.environ.get("TV_SYSTEM_TARGET","unknown") if os.environ.get("TV_SYSTEM_TARGET") in {"android-tv","google-tv"} else "unknown",
  "harness_status":"PASS" if os.environ.get("TV_HARNESS_COMPLETED")=="yes" else "FAIL",
  "failure_stage":os.environ.get("TV_FAILURE_STAGE","unknown"),
  "infrastructure":{"emulator_boot":safe_status(os.environ.get("TV_BOOT")),"abi_x86_64":safe_status(os.environ.get("TV_ABI")),"leanback_feature":safe_status(os.environ.get("TV_LEANBACK")),"apk_install":safe_status(os.environ.get("TV_INSTALL")),"app_launch":safe_status(os.environ.get("TV_LAUNCH"))},
  "app_state":{name:read_json(os.path.join(report_dir,"app-state-"+name+".json")) for name in ("launch","before-dpad","after-dpad","after-back")},
  "actions":{"test_input":"adb KEYCODE_DPAD_RIGHT","test_input_sent":os.environ.get("TV_DPAD_ACTION","not_sent"),"back_sent":os.environ.get("TV_BACK_ACTION","not_sent"),"app_generated_hover_is_separate":True},
  "time_limits":{"passive_startup_seconds":45,"passive_startup_observed_seconds":int(os.environ.get("TV_STARTUP_WAIT_SECONDS","0")),"post_dpad_observation_seconds":16,"post_dpad_observed_seconds":int(os.environ.get("TV_POST_DPAD_WAIT_SECONDS","0")),"poll_interval_seconds":2,"maximum_screenshots_bytes_each":int(os.environ.get("TV_MAX_SCREENSHOT_BYTES","1048576")) if os.environ.get("TV_MAX_SCREENSHOT_BYTES","1048576").isdigit() else 1048576,"automatic_navigation_retries":0},
  "screenshots":{name:os.environ.get("TV_"+key,"missing") for name,key in (("after_launch","INITIAL_SCREENSHOT"),("before_test_dpad","BEFORE_DPAD_SCREENSHOT"),("after_test_dpad","AFTER_DPAD_SCREENSHOT"),("after_back","AFTER_BACK_SCREENSHOT"))},
  "passive_before_test_dpad":{
    "capture_status":passive.get("capture_status","incomplete"),
    "official_page_started":safe_status("yes" if count(passive.get("official_top_level_page_start_count"))>0 else "no" if passive.get("capture_status")=="complete" else "unknown"),
    "official_page_completed":safe_status("yes" if count(passive.get("official_top_level_page_stop_count"))>0 else "no" if passive.get("capture_status")=="complete" else "unknown"),
    "browser_media_session_activated":safe_status("yes" if count(before_media.get("session_activated_count"))>0 else "no" if passive.get("capture_status")=="complete" else "unknown"),
    "browser_media_play_observed":safe_status("yes" if count(before_media.get("play_count"))>0 else "no" if passive.get("capture_status")=="complete" else "unknown"),
    "browser_media_position_advanced":safe_status(before_media.get("position_advanced")),
    "time_to_first_position_ms":before_media.get("time_to_first_position_ms"),
    "app_generated_hover":passive.get("app_generated_telesistema_hover",{}),
  },
  "after_test_dpad":{"official_top_level_page_start_delta":nav_delta,"session_deactivation_delta":max(0,deactivated_delta),"session_activation_delta":max(0,activated_delta),"play_event_delta":max(0,play_delta),"position_advanced_during_capture":safe_status(after_media.get("position_advanced")),"position_bucket_advanced_since_passive_snapshot":position_delta,"app_generated_hover":after_dpad.get("app_generated_telesistema_hover",{})},
  "association_limit":"a temporal change after harness-issued D-pad input does not establish causation; embedded-frame navigation is not observed by the app-level top-level navigation logger",
  "moving_picture":"not_tested","audio_output":"not_tested","physical_bravia_acceptance":"not_tested",
  "source_cause":"not_established",
}
destination=os.path.join(report_dir,"telesistema-diagnostic-receipt.json")
with open(destination,"w",encoding="utf-8") as stream:
    json.dump(report,stream,indent=2)
    stream.write("\n")
summary=os.environ.get("GITHUB_STEP_SUMMARY")
if summary:
    with open(summary,"a",encoding="utf-8") as stream:
        stream.write("## Telesistema bounded virtual observation\n\n")
        stream.write(f"- Harness: `{report['harness_status']}`; selected image: `{report['system_image_target']}`\n")
        stream.write(f"- Before test D-pad: page completed `{report['passive_before_test_dpad']['official_page_completed']}`, media session play `{report['passive_before_test_dpad']['browser_media_play_observed']}`, browser media position advanced `{report['passive_before_test_dpad']['browser_media_position_advanced']}`\n")
        stream.write(f"- Test D-pad sent: `{report['actions']['test_input_sent']}`; additional top-level page starts afterward: `{nav_delta}`; media session deactivation delta: `{max(0,deactivated_delta)}`\n")
        stream.write("- These are browser media/session observations, not verified moving picture, audio, or physical TV acceptance. Sequence alone does not establish cause.\n")
PY
}

finish() {
  local original_status=$?
  trap - EXIT
  if [[ "$original_status" == 0 && "$DPAD_ACTION" == sent && "$BACK_ACTION" == sent ]]; then
    TV_HARNESS_COMPLETED=yes
  else
    TV_HARNESS_COMPLETED=no
    if [[ "$FAILURE_STAGE" == preflight && "$BOOT" == yes ]]; then FAILURE_STAGE=diagnostic; fi
  fi
  export TV_HARNESS_COMPLETED TV_FAILURE_STAGE="$FAILURE_STAGE" TV_BOOT="$BOOT" TV_ABI="$ABI" TV_LEANBACK="$LEANBACK"
  export TV_INSTALL="$INSTALL" TV_LAUNCH="$LAUNCH" TV_DPAD_ACTION="$DPAD_ACTION" TV_BACK_ACTION="$BACK_ACTION"
  export TV_STARTUP_WAIT_SECONDS="$STARTUP_WAIT_SECONDS" TV_POST_DPAD_WAIT_SECONDS="$POST_DPAD_WAIT_SECONDS"
  export TV_INITIAL_SCREENSHOT="$INITIAL_SCREENSHOT" TV_BEFORE_DPAD_SCREENSHOT="$BEFORE_DPAD_SCREENSHOT"
  export TV_AFTER_DPAD_SCREENSHOT="$AFTER_DPAD_SCREENSHOT" TV_AFTER_BACK_SCREENSHOT="$AFTER_BACK_SCREENSHOT"
  write_receipt "$original_status"
  cat "$REPORT_DIR/telesistema-diagnostic-receipt.json"
}
trap finish EXIT

test -s "$APK" || { echo "Universal debug APK missing" >&2; exit 1; }

FAILURE_STAGE=emulator_boot
adb wait-for-device
[[ "$(adb shell getprop sys.boot_completed | tr -d '\r')" == "1" ]] || exit 1
BOOT=yes
[[ "$(adb shell getprop ro.product.cpu.abi | tr -d '\r')" == "x86_64" ]] || exit 1
ABI=yes
FEATURES=$(adb shell pm list features)
grep -Fq "android.software.leanback" <<< "$FEATURES" || exit 1
LEANBACK=yes

FAILURE_STAGE=apk_install
adb install -r "$APK" >/dev/null
INSTALL=yes
adb logcat -c

FAILURE_STAGE=launch
launch_output=$(adb shell am start -W -n "$ACTIVITY" -e url "$SOURCE_URL" 2>&1) || exit 1
if grep -Eq '^Status:[[:space:]]*ok[[:space:]]*$' <<< "$launch_output"; then LAUNCH=yes; else exit 1; fi
unset launch_output
capture_screenshot initial
capture_state launch

FAILURE_STAGE=passive_observation
started_at=$SECONDS
progress_at=0
while (( SECONDS - started_at < MAX_STARTUP_SECONDS )); do
  capture_snapshot passive
  fields=$(read_snapshot "$PASSIVE_SNAPSHOT")
  IFS=$'\t' read -r capture_status page_starts page_stops activated deactivated play_count position_samples position_advanced time_to_position last_position <<< "$fields"
  if [[ "$position_advanced" == yes ]]; then
    (( progress_at == 0 )) && progress_at=$SECONDS
    if (( position_samples >= 2 && SECONDS - progress_at >= 6 )); then break; fi
  fi
  if [[ "$position_advanced" != yes ]]; then progress_at=0; fi
  sleep "$POLL_SECONDS"
done
STARTUP_WAIT_SECONDS=$((SECONDS - started_at))
capture_snapshot passive
capture_screenshot before-dpad
capture_state before-dpad
[[ -s "$REPORT_DIR/telesistema-passive.json" ]] || exit 1

FAILURE_STAGE=test_dpad_observation
adb shell input keyevent KEYCODE_DPAD_RIGHT
DPAD_ACTION=sent
dpad_started=$SECONDS
while (( SECONDS - dpad_started < MAX_POST_DPAD_SECONDS )); do
  capture_snapshot after-dpad
  sleep "$POLL_SECONDS"
done
POST_DPAD_WAIT_SECONDS=$((SECONDS - dpad_started))
capture_snapshot after-dpad
capture_screenshot after-dpad
capture_state after-dpad

FAILURE_STAGE=back_observation
adb shell input keyevent KEYCODE_BACK
BACK_ACTION=sent
sleep 2
capture_snapshot after-back
capture_screenshot after-back
capture_state after-back

FAILURE_STAGE=complete
