import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const script = readFileSync(resolve(process.cwd(), 'scripts/tv-zns-source-feedback.sh'), 'utf8');
const workflow = readFileSync(resolve(process.cwd(), '../../.github/workflows/tv-cloud-emulator-qualification.yml'), 'utf8');
const neutralQualification = readFileSync(resolve(process.cwd(), 'scripts/tv-cloud-emulator-qualification.sh'), 'utf8');
const classifier = readFileSync(resolve(process.cwd(), 'src/zns-feedback-outcome.mjs'), 'utf8');
const dispatcher = readFileSync(resolve(process.cwd(), 'scripts/tv-cloud-emulator-dispatch.sh'), 'utf8');

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
  assert.match(script, /zns-outer-player-first\|zns-embedded-observed\|zns-embedded-playing\|zns-video-time-advanced/);
  assert.match(script, /TV_LAUNCH_PROCESS/);
  assert.match(script, /TV_DPAD_FOCUS/);
  assert.match(script, /TV_BACK_FOREGROUND/);
  assert.match(script, /SCREENSHOT_DPAD=captured/);
  assert.match(script, /SCREENSHOT_BACK=captured/);
  assert.match(script, /TV_DPAD_DISPATCH=yes/);
  assert.match(script, /TV_BACK_DISPATCH=yes/);
  assert.match(classifier, /file: 'zns-after-dpad\.png'/);
  assert.match(classifier, /file: 'zns-after-back\.png'/);
  assert.match(script, /TV_TIME_ADVANCED=yes/);
  assert.match(script, /never starts, unmutes, or raises the volume/);
  assert.match(classifier, /live_stream_verified: false/);
  assert.match(classifier, /moving_picture_verified: false/);
  assert.match(classifier, /audio_output_verified: false/);
  assert.match(classifier, /physical_bravia_verified: false/);
  assert.match(script, /A green job means the bounded diagnostic harness completed/);
});

test('the source script keeps raw logcat in memory and extracts only allowlisted phases/scalars', () => {
  assert.match(script, /LOG_OUTPUT=\$\(adb logcat -d -s GvMedia:I\)/);
  assert.match(script, /ready=\(\[0-4\]\) paused=\(true\|false\) muted=\(true\|false\)/);
  assert.doesNotMatch(script, /logcat -d[^|\n]*>\s*"?\$REPORT_DIR/);
  assert.match(workflow, /Finalize ZNS receipt if prerequisites failed[\s\S]*if: always\(\)/);
});
