#!/usr/bin/env bash
set -u

REPORT_DIR="${TV_REPORT_DIR:-${RUNNER_TEMP:-/tmp}/tv-emulator-qualification}"
TARGET="${TV_SYSTEM_TARGET:-android-tv}"
APK="app-gv/build/outputs/apk/universal/debug/app-gv-universal-debug.apk"
MAX_SCREENSHOT_BYTES=$((1024 * 1024))
mkdir -p "$REPORT_DIR"
export TV_REPORT_DIR="$REPORT_DIR"

write_summary() {
  local neutral_status="$1" zns_status="$2" telesistema_status="$3" failure_stage="$4"
  python3 - "$REPORT_DIR/source-comparison-summary.json" "$neutral_status" "$zns_status" "$telesistema_status" "$failure_stage" <<'PY'
import json, os, sys

def read_json(path):
    try:
        with open(path,encoding="utf-8") as stream:
            result=json.load(stream)
        return result if isinstance(result,dict) else {}
    except (OSError,ValueError):
        return {}

root=os.environ["TV_REPORT_DIR"]
zns=read_json(os.path.join(root,"zns","zns-diagnostic-receipt.json"))
telesistema=read_json(os.path.join(root,"telesistema","telesistema-diagnostic-receipt.json"))
environment=read_json(os.path.join(root,"environment.json"))
neutral=read_json(os.path.join(root,"neutral","qualification.json"))
commit=os.environ.get("GITHUB_SHA","")
if len(commit)!=40: commit="unknown"
report={
  "schema_version":1,
  "receipt_finalized":True,
  "commit":commit,
  "selected_profile":"provider-comparison",
  "system_image":environment,
  "apk_sha256":environment.get("universal_apk_sha256","unknown"),
  "workflow_run_id":environment.get("workflow_run_id","unknown"),
  "workflow_run_attempt":environment.get("workflow_run_attempt","unknown"),
  "failure_stage":"complete" if sys.argv[5]=="complete" else sys.argv[5],
  "harness_status":"PASS" if sys.argv[5]=="complete" and environment.get("qualification_status")=="PASS" else "FAIL",
  "failure_observations":{
    "system_image":"none" if environment.get("qualification_status")=="PASS" else "selected_image_or_runtime_identity_check_failed",
    "neutral":neutral.get("failure_observation","none") if neutral.get("virtual_harness_status")!="PASS" else "none",
    "zns":zns.get("reason","diagnostic_receipt_missing") if sys.argv[3]!="0" else "none",
    "telesistema":telesistema.get("failure_stage","none") if sys.argv[4]!="0" else "none",
  },
  "neutral_qualification":{"virtual_harness_status":neutral.get("virtual_harness_status","FAIL"),"failure_observation":neutral.get("failure_observation","unknown"),"artifact_path":"neutral/qualification.json"},
  "sources":{
    "zns":{"harness_completed":zns.get("harness_completed",False),"classification":zns.get("classification","INCONCLUSIVE"),"diagnostic_success":zns.get("diagnostic_success",False),"playback_progression":zns.get("playback_progression","unknown"),"moving_picture":"not_tested","audio_output":"not_tested","physical_bravia_acceptance":"not_tested","artifact_path":"zns/zns-diagnostic-receipt.json"},
    "telesistema":{"harness_status":telesistema.get("harness_status","FAIL"),"passive_before_test_dpad":telesistema.get("passive_before_test_dpad",{}),"after_test_dpad":telesistema.get("after_test_dpad",{}),"moving_picture":"not_tested","audio_output":"not_tested","physical_bravia_acceptance":"not_tested","artifact_path":"telesistema/telesistema-diagnostic-receipt.json"},
  },
  "automatic_test_retries":0,
  "comparison_scope":"one universal APK, one neutral qualification and one cold bounded navigation per provider and image, with one explicitly labeled test D-pad right and Back in each Telesistema observation",
  "artifact_budget":{"retention_days":1,"maximum_screenshot_bytes_each":1048576,"maximum_screenshots_per_image":15,"maximum_uncompressed_evidence_bytes_per_image":15728640,"maximum_uncompressed_evidence_bytes_for_api36_pair_including_relay_duplicate":35651584},
  "comparison_caveats":["provider uptime and content differ by time and network","browser media position is not proof of rendered moving picture or audible sound","D-pad timing is recorded separately; temporal sequence does not establish causation","physical Bravia acceptance is not tested"],
}
destination=sys.argv[1]
with open(destination,"w",encoding="utf-8") as stream:
    json.dump(report,stream,indent=2)
    stream.write("\n")
summary=os.environ.get("GITHUB_STEP_SUMMARY")
if summary:
    with open(summary,"a",encoding="utf-8") as stream:
        stream.write("## TV provider comparison summary\n\n")
        stream.write(f"- Image target: `{environment.get('selected_system_image','unknown')}`; API `{environment.get('api','unknown')}`; ABI `{environment.get('abi','unknown')}`\n")
        stream.write(f"- Launcher: `{environment.get('home_launcher_package','unknown')}`\n")
        stream.write(f"- Exact commit/APK SHA-256: `{commit}` / `{report['apk_sha256']}`\n")
        stream.write(f"- Neutral: `{neutral.get('virtual_harness_status','FAIL')}`; ZNS `{zns.get('classification','INCONCLUSIVE')}`; Telesistema `{telesistema.get('harness_status','FAIL')}`\n")
        stream.write("- Virtual evidence does not establish picture, sound, or physical TV acceptance.\n")
PY
}

if [[ "$TARGET" != android-tv && "$TARGET" != google-tv ]]; then
  echo "Unsupported TV system image target" >&2
  exit 2
fi
if [[ ! -s "$APK" ]]; then
  echo "Universal emulator APK missing" >&2
  exit 1
fi

FAILURE_STAGE=environment_capture
python3 tools/player-lab/scripts/tv-emulator-environment.py capture \
  --target "$TARGET" --apk "$APK" --output "$REPORT_DIR/environment.json" || {
    write_summary 1 1 1 environment_capture
    exit 1
  }

export TV_MAX_SCREENSHOT_BYTES="$MAX_SCREENSHOT_BYTES"
export TV_ZNS_SINGLE_ATTEMPT=yes
FAILURE_STAGE=neutral_qualification
set +e
TV_REPORT_DIR="$REPORT_DIR/neutral" bash tools/player-lab/scripts/tv-cloud-emulator-qualification.sh
neutral_status=$?
FAILURE_STAGE=zns_observation
TV_REPORT_DIR="$REPORT_DIR/zns" bash tools/player-lab/scripts/tv-zns-source-feedback.sh
zns_status=$?
FAILURE_STAGE=telesistema_observation
TV_REPORT_DIR="$REPORT_DIR/telesistema" bash tools/player-lab/scripts/tv-telesistema-source-feedback.sh
telesistema_status=$?
set -e
FAILURE_STAGE=complete
if (( neutral_status != 0 )); then FAILURE_STAGE=neutral_qualification; fi
if (( zns_status != 0 )); then [[ "$FAILURE_STAGE" == complete ]] && FAILURE_STAGE=zns_observation || FAILURE_STAGE=multiple_observations; fi
if (( telesistema_status != 0 )); then [[ "$FAILURE_STAGE" == complete ]] && FAILURE_STAGE=telesistema_observation || FAILURE_STAGE=multiple_observations; fi
write_summary "$neutral_status" "$zns_status" "$telesistema_status" "$FAILURE_STAGE"
if [[ "$FAILURE_STAGE" != complete ]]; then exit 1; fi
