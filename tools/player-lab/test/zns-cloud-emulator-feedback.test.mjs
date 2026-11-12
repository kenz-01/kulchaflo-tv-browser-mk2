import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const script = readFileSync(resolve(process.cwd(), 'scripts/tv-zns-source-feedback.sh'), 'utf8');
const workflow = readFileSync(resolve(process.cwd(), '../../.github/workflows/tv-cloud-emulator-qualification.yml'), 'utf8');
const neutralQualification = readFileSync(resolve(process.cwd(), 'scripts/tv-cloud-emulator-qualification.sh'), 'utf8');
const classifier = readFileSync(resolve(process.cwd(), 'src/zns-feedback-outcome.mjs'), 'utf8');
const dispatcher = readFileSync(resolve(process.cwd(), 'scripts/tv-cloud-emulator-dispatch.sh'), 'utf8');
const stateParser = readFileSync(resolve(process.cwd(), 'scripts/tv-emulator-state.py'), 'utf8');
const logSnapshot = readFileSync(resolve(process.cwd(), 'scripts/tv-zns-log-snapshot.py'), 'utf8');
const relay = readFileSync(resolve(process.cwd(), 'scripts/tv-zns-evidence-relay.py'), 'utf8');
const relayWorkflow = readFileSync(resolve(process.cwd(), '../../.github/workflows/tv-zns-evidence-relay.yml'), 'utf8');

test('ZNS remains a separate explicitly selected manual profile on standard free runners', () => {
  assert.match(workflow, /workflow_dispatch:[\s\S]*test_profile:[\s\S]*type: choice[\s\S]*default: qualification[\s\S]*- qualification[\s\S]*- zns/);
  assert.match(workflow, /script: bash tools\/player-lab\/scripts\/tv-cloud-emulator-dispatch\.sh "\$TV_TEST_PROFILE"/);
  assert.match(dispatcher, /qualification\)[\s\S]*?exec bash tools\/player-lab\/scripts\/tv-cloud-emulator-qualification\.sh/);
  assert.match(dispatcher, /zns\)[\s\S]*?exec bash tools\/player-lab\/scripts\/tv-zns-source-feedback\.sh/);
  assert.doesNotMatch(workflow, /^\s*(pull_request|push|schedule):/m);
  assert.match(workflow, /runs-on:\s+ubuntu-latest/);
  assert.doesNotMatch(workflow, /larger runner|self-hosted|schedule:/i);
});

test('the neutral infrastructure qualification remains generic and does not navigate to a broadcaster', () => {
  assert.match(neutralQualification, /https:\/\/example\.com/);
  assert.match(neutralQualification, /selected_profile=qualification/);
  assert.doesNotMatch(neutralQualification, /znsbahamas|streamcomedia|KEYCODE_DPAD_CENTER/i);
  assert.match(dispatcher, /qualification\)/);
});

test('the ZNS profile uses only the official route and never dispatches play or center actions', () => {
  assert.match(script, /SOURCE_URL="https:\/\/znsbahamas\.com\/"/);
  assert.match(script, /am start -W -n "\$ACTIVITY" -e url "\$SOURCE_URL"/);
  assert.match(script, /sleep 25/);
  assert.match(script, /KEYCODE_DPAD_DOWN/);
  assert.match(script, /KEYCODE_DPAD_UP/);
  assert.doesNotMatch(script, /KEYCODE_DPAD_CENTER|example\.com|curl |wget |getopts|shift/i);
});

test('the machine-readable receipt records exact identity, phases, app state, screenshots, and non-claims', () => {
  assert.match(script, /zns-diagnostic-receipt\.json/);
  assert.match(logSnapshot, /zns-outer-player-first/);
  assert.match(logSnapshot, /zns-embedded-observed/);
  assert.match(script, /check_app_state LAUNCH/);
  assert.match(script, /capture_screenshot dpad/);
  assert.match(script, /capture_screenshot back/);
  assert.match(script, /TV_SCREENSHOT_FAILURE/);
  assert.match(script, /TV_LAUNCH_STATUS=confirmed/);
  assert.match(script, /TV_DPAD_DISPATCH=yes/);
  assert.match(script, /TV_BACK_DISPATCH=yes/);
  assert.match(classifier, /file: 'zns-after-dpad\.png'/);
  assert.match(classifier, /file: 'zns-after-back\.png'/);
  assert.match(logSnapshot, /video_time_advanced_observed.*yes/);
  assert.match(script, /never starts, unmutes, or raises the volume/);
  assert.match(classifier, /live_stream_verified: false/);
  assert.match(classifier, /moving_picture_verified: false/);
  assert.match(classifier, /audio_output_verified: false/);
  assert.match(classifier, /physical_bravia_verified: false/);
  assert.match(script, /A green job means the bounded diagnostic harness completed/);
});

test('earliest and interaction screenshots are captured before assertions and again at failure', () => {
  assert.ok(script.indexOf('capture_screenshot launch') < script.indexOf('check_app_state LAUNCH'));
  assert.ok(script.indexOf('capture_screenshot dpad') < script.indexOf('check_app_state DPAD'));
  assert.ok(script.indexOf('capture_screenshot back') < script.indexOf('check_app_state BACK'));
  assert.match(script, /if \(\( original_status != 0 \)\); then[\s\S]*capture_app_state FAILURE[\s\S]*capture_screenshot failure/);
  assert.match(script, /MAX_SCREENSHOT_BYTES=\$\(\(4 \* 1024 \* 1024\)\)/);
});

test('Android and log diagnostics are bounded and reduce raw output to fixed allowlisted values', () => {
  assert.match(stateParser, /MAX_OUTPUT_BYTES = 64 \* 1024/);
  assert.match(stateParser, /other_component/);
  assert.match(stateParser, /entry_unparsed/);
  assert.match(stateParser, /output_truncated/);
  assert.match(stateParser, /dumpsys.*input|run_adb\(\["shell", "dumpsys", "input"\]\)/);
  assert.match(stateParser, /FocusedWindows/);
  assert.match(stateParser, /input_target_window/);
  assert.match(stateParser, /focus_signal_conflict/);
  assert.match(classifier, /window_manager_focus/);
  assert.match(classifier, /input_focus/);
  assert.match(classifier, /FOCUS_SOURCES/);
  assert.match(relay, /FOCUS_SOURCES/);
  assert.doesNotMatch(stateParser, /print\(.*stdout|"raw_dump"/);
  assert.match(logSnapshot, /MAX_LOG_BYTES = 64 \* 1024/);
  assert.match(logSnapshot, /PHASE_SET/);
  assert.doesNotMatch(logSnapshot, /raw_log|print\(text/);
  assert.match(script, /tv-zns-log-snapshot\.py capture/);
});

test('summary formatting cannot run Markdown backticks as command substitutions', () => {
  assert.match(script, /printf -- '- Classification: `%s`/);
  assert.match(script, /printf -- '- Commit: `%s`/);
  assert.doesNotMatch(script, /echo "[^\n]*`[^\n]*`/);
  assert.match(workflow, /TV_EMULATOR_STEP_OUTCOME/);
  assert.match(workflow, /failure_stage = "emulator_step"[\s\S]*classification = "INCONCLUSIVE"/);
});

test('privileged evidence relay uses a separate workflow_run token and never runs candidate code', () => {
  assert.match(relayWorkflow, /workflow_run:[\s\S]*types:\s*\[completed\]/);
  assert.match(relayWorkflow, /ref:\s+main/);
  assert.match(relayWorkflow, /actions:\s+read/);
  assert.match(relayWorkflow, /pull-requests:\s+read/);
  assert.match(relayWorkflow, /issues:\s+write/);
  assert.match(relay, /WORKFLOW_PATH =/);
  assert.match(relay, /safe_zip_receipt/);
  assert.match(relay, /MAX_RECEIPT_BYTES/);
  assert.match(relay, /comment_marker/);
  assert.match(relay, /untrusted test output/);
});
