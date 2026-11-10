import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const script = readFileSync(resolve(process.cwd(), 'scripts/tv-cloud-emulator-qualification.sh'), 'utf8');

test('the PR23 on-demand runner is fixed to the official ZNS source and bounded helper window', () => {
  assert.match(script, /SOURCE_URL="https:\/\/znsbahamas\.com\/"/);
  assert.match(script, /am start -W -n "\$ACTIVITY" -e url "\$SOURCE_URL"/);
  assert.match(script, /sleep 25/);
  assert.doesNotMatch(script, /(^|\s)(\$[0-9]+|getopts|shift)\b/m);
  assert.doesNotMatch(script, /example\.com|curl |wget |run-on:|schedule:/i);
});

test('the emulator receipt distinguishes helper signals from live playback and audio claims', () => {
  assert.match(script, /zns_helper_state=\$ZNS_STATE/);
  assert.match(script, /video_time_advanced_observed=\$TIME_ADVANCED/);
  assert.match(script, /real_live_stream_verified=no/);
  assert.match(script, /audio_verified=no/);
  assert.match(script, /physical_sony_bravia_verified=no/);
});

test('the public artifact contains a screenshot and allowlisted phases, never raw logcat', () => {
  assert.match(script, /screencap -p/);
  assert.match(script, /zns-outer-player-first\|zns-embedded-playing\|zns-embedded-start-attempt\|zns-embedded-play-rejected\|zns-video-time-advanced/);
  assert.match(script, /never upload raw logcat/);
  assert.doesNotMatch(script, /logcat -d[^|\n]*>\s*"?\$REPORT_DIR/);
});
