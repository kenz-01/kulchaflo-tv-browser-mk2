import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const script = readFileSync(resolve(process.cwd(), 'scripts/tv-cloud-emulator-qualification.sh'), 'utf8');
const workflow = readFileSync(resolve(process.cwd(), '../../.github/workflows/tv-cloud-emulator-qualification.yml'), 'utf8');

test('PR23 qualification is manually dispatched on a standard free GitHub-hosted runner', () => {
  assert.match(workflow, /on:\s+workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s*(pull_request|push|schedule):/m);
  assert.match(workflow, /runs-on:\s+ubuntu-latest/);
  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/);
});

test('the infrastructure qualification stays neutral and does not claim D-pad navigation', () => {
  assert.match(script, /-e url "https:\/\/example\.com"/);
  assert.doesNotMatch(script, /znsbahamas|dailymotion|streamcomedia|KEYCODE_DPAD_CENTER/);
  assert.doesNotMatch(script, /navigation_(success|verified)|remote_navigation/);
  assert.match(script, /dpad_down_up_dispatched=yes/);
});

test('foreground, window focus, Back, and post-action state are checked before success', () => {
  for (const checkpoint of ['after_launch', 'after_dpad', 'after_back']) {
    assert.match(script, new RegExp(`check_app_state ${checkpoint}`));
  }
  assert.match(script, /topResumedActivity\|mResumedActivity/);
  assert.match(script, /mCurrentFocus\|mFocusedApp/);
  assert.match(script, /activity_foreground_after_dpad=\$DPAD_FOREGROUND/);
  assert.match(script, /window_focus_after_dpad=\$DPAD_FOCUS/);
  assert.match(script, /back_key_dispatched=yes/);
  assert.match(script, /activity_foreground_after_back=\$BACK_FOREGROUND/);
  assert.match(script, /window_focus_after_back=\$BACK_FOCUS/);
  assert.match(script, /screenshot_after_dpad=yes/);
  assert.match(script, /screenshot_after_back=yes/);
});
