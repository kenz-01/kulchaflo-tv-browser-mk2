import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const script = readFileSync(resolve(process.cwd(), 'scripts/tv-zns-source-feedback.sh'), 'utf8');
const workflow = readFileSync(resolve(process.cwd(), '../../.github/workflows/tv-cloud-emulator-qualification.yml'), 'utf8');

test('ZNS is a separate explicitly selected manual emulator profile', () => {
  assert.match(workflow, /workflow_dispatch:[\s\S]*test_profile:[\s\S]*type: choice[\s\S]*default: qualification[\s\S]*- qualification[\s\S]*- zns/);
  assert.match(workflow, /zns\) bash tools\/player-lab\/scripts\/tv-zns-source-feedback\.sh/);
  assert.match(workflow, /qualification\) bash tools\/player-lab\/scripts\/tv-cloud-emulator-qualification\.sh/);
  assert.doesNotMatch(workflow, /^\s*(pull_request|push|schedule):/m);
  assert.match(workflow, /runs-on:\s+ubuntu-latest/);
});

test('the ZNS run uses only the official route and never dispatches a play or center action', () => {
  assert.match(script, /SOURCE_URL="https:\/\/znsbahamas\.com\/"/);
  assert.match(script, /am start -W -n "\$ACTIVITY" -e url "\$SOURCE_URL"/);
  assert.match(script, /sleep 25/);
  assert.match(script, /KEYCODE_DPAD_DOWN/);
  assert.match(script, /KEYCODE_DPAD_UP/);
  assert.doesNotMatch(script, /KEYCODE_DPAD_CENTER|example\.com|curl |wget |getopts|shift/i);
});

test('the ZNS receipt records observed player state, progression, focus, and Back without audio claims', () => {
  assert.match(script, /ready=\(\[0-4\]\)/);
  assert.match(script, /muted=\(true\|false\)/);
  assert.match(script, /volume=\(/);
  assert.match(script, /video_time_advanced_observed=\$TIME_ADVANCED/);
  assert.match(script, /activity_foreground_after_back=\$BACK_FOREGROUND/);
  assert.match(script, /window_focus_after_back=\$BACK_FOCUS/);
  assert.match(script, /helper_initiated_playback=no/);
  assert.match(script, /live_stream_verified=no/);
  assert.match(script, /audio_output_verified=no/);
  assert.match(script, /physical_sony_bravia_verified=no/);
});

test('the ZNS artifact contains screenshots and allowlisted scalar logs only', () => {
  assert.match(script, /screencap -p/);
  assert.match(script, /zns-outer-player-first\|zns-embedded-observed\|zns-embedded-playing\|zns-video-time-advanced/);
  assert.match(script, /never upload unfiltered logcat/);
  assert.doesNotMatch(script, /logcat -d[^|\n]*>\s*"?\$REPORT_DIR/);
});
