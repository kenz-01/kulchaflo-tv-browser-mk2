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

test('the infrastructure qualification stays neutral and records D-pad dispatch only', () => {
  assert.match(script, /-e url "https:\/\/example\.com"/);
  assert.doesNotMatch(script, /znsbahamas|dailymotion|streamcomedia|KEYCODE_DPAD_CENTER/);
  assert.match(script, /neutral_navigation=\$NAVIGATION_STATUS/);
  assert.doesNotMatch(script, /remote_navigation/);
  assert.match(script, /dpad_down_up_dispatched=\$DPAD_DISPATCH/);
});

test('foreground, window focus, Back, and post-action state are checked before success', () => {
  assert.equal((script.match(/\ncheck_app_state\n/g) ?? []).length, 3);
  assert.match(script, /LAUNCH_PROCESS=\$APP_PROCESS/);
  assert.match(script, /DPAD_PROCESS=\$APP_PROCESS/);
  assert.match(script, /BACK_PROCESS=\$APP_PROCESS/);
  assert.match(script, /topResumedActivity\|mResumedActivity/);
  assert.match(script, /mCurrentFocus\|mFocusedApp/);
  assert.match(script, /BACK_DISPATCH=yes/);
  assert.match(script, /screenshot_after_dpad=\$SCREENSHOT_DPAD/);
  assert.match(script, /screenshot_after_back=\$SCREENSHOT_BACK/);
  assert.match(script, /\[\[ "\$NAVIGATION_STATUS" == completed \]\]/);
  assert.match(script, /physical_bravia_acceptance=not_tested/);
});
