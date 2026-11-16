import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const playerLab = process.cwd();

function createSandbox(navigation = 'complete') {
  const root = mkdtempSync(join(tmpdir(), 'kf-neutral-tv-harness-'));
  const scriptDir = join(root, 'tools/player-lab/scripts');
  const apk = join(root, 'app-gv/build/outputs/apk/universal/debug/app-gv-universal-debug.apk');
  const bin = join(root, 'bin');
  const reportDir = join(root, 'runner-temp');
  mkdirSync(scriptDir, {recursive: true});
  mkdirSync(join(root, 'app-gv/build/outputs/apk/universal/debug'), {recursive: true});
  mkdirSync(bin, {recursive: true});
  writeFileSync(join(scriptDir, 'tv-cloud-emulator-qualification.sh'), readFileSync(join(playerLab, 'scripts/tv-cloud-emulator-qualification.sh')));
  writeFileSync(join(scriptDir, 'tv-neutral-navigation-snapshot.py'), readFileSync(join(playerLab, 'scripts/tv-neutral-navigation-snapshot.py')));
  writeFileSync(apk, 'test-only APK placeholder');
  const adb = `#!/usr/bin/env bash
set -eu
case "$1" in
  wait-for-device) exit 0 ;;
  install)
    if [[ "\${TV_FAKE_INSTALL_FAILURE:-no}" == yes ]]; then exit 1; fi
    exit 0
    ;;
  logcat)
    if [[ "\${2:-}" == "-c" ]]; then exit 0; fi
    if [[ "\${TV_FAKE_NAVIGATION:-complete}" == "complete" ]]; then
      printf '%s\\n' '11-16 12:00:00.002 1234 1234 I KfMkIIGV:GvNav: page start tabId=abc url=https://example.com/'
      printf '%s\\n' '11-16 12:00:00.003 1234 1234 I KfMkIIGV:GvNav: page stop tabId=abc success=true url=https://example.com/'
    fi
    exit 0
    ;;
  pull) printf '\\211PNG\\r\\n\\032\\n' > "$3"; exit 0 ;;
  shell)
    shift
    case "$1" in
      getprop) [[ "$2" == sys.boot_completed ]] && printf '1\\r\\n' || printf 'x86_64\\r\\n' ;;
      pm) printf 'feature:android.software.leanback\\n' ;;
      wm) printf 'Physical size: 1920x1080\\n' ;;
      am) printf 'Status: ok\\n' ;;
      pidof) printf '1234\\n' ;;
      dumpsys)
        if [[ "$2" == activity ]]; then printf 'topResumedActivity=ActivityRecord{package=com.kulchaflo.tv.mk2.gv}\\n';
        else printf 'mCurrentFocus=Window{package=com.kulchaflo.tv.mk2.gv}\\n'; fi
        ;;
      screencap|input) exit 0 ;;
    esac
    ;;
esac
exit 0
`;
  writeFileSync(join(bin, 'adb'), adb);
  writeFileSync(join(bin, 'sleep'), '#!/bin/sh\nexit 0\n');
  chmodSync(join(bin, 'adb'), 0o755);
  chmodSync(join(bin, 'sleep'), 0o755);
  return {root, scriptPath: join(scriptDir, 'tv-cloud-emulator-qualification.sh'), bin, reportDir};
}

function runHarness(navigation, installFailure = false) {
  const sandbox = createSandbox(navigation);
  const summary = join(sandbox.root, 'step-summary.md');
  const result = spawnSync('/usr/bin/bash', [sandbox.scriptPath], {
    cwd: sandbox.root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${sandbox.bin}:${process.env.PATH}`,
      RUNNER_TEMP: sandbox.reportDir,
      GITHUB_STEP_SUMMARY: summary,
      GITHUB_SHA: 'c'.repeat(40),
      TV_FAKE_NAVIGATION: navigation,
      TV_FAKE_INSTALL_FAILURE: installFailure ? 'yes' : 'no',
    },
  });
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(join(sandbox.reportDir, 'tv-emulator-qualification/qualification.json'), 'utf8'));
  } catch {
    receipt = null;
  }
  const summaryText = readFileSync(summary, 'utf8');
  rmSync(sandbox.root, {recursive: true, force: true});
  return {result, receipt, summaryText};
}

test('neutral harness reports virtual PASS only after navigation, app focus, actions, and screenshots', () => {
  const {result, receipt, summaryText} = runHarness('complete');
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  assert.equal(receipt.virtual_harness_status, 'PASS');
  assert.equal(receipt.neutral_route.navigation_status, 'completed');
  assert.equal(receipt.screenshots.initial, 'captured');
  assert.equal(receipt.screenshots.after_dpad, 'captured');
  assert.equal(receipt.screenshots.after_back, 'captured');
  assert.deepEqual(receipt.actions, {dpad_down_up_dispatched: 'yes', back_dispatched: 'yes'});
  assert.equal(receipt.playback_progression, 'not_tested');
  assert.equal(receipt.physical_bravia_acceptance, 'not_tested');
  assert.match(summaryText, /Virtual Android TV harness: `PASS`/);
});

test('neutral harness fails with exact bounded reason when page completion is absent', () => {
  const {result, receipt, summaryText} = runHarness('missing');
  assert.equal(result.status, 1, result.stderr);
  assert.equal(receipt.virtual_harness_status, 'FAIL');
  assert.equal(receipt.neutral_route.navigation_status, 'not_observed');
  assert.equal(receipt.failure_observation, 'neutral_page_navigation_not_observed');
  assert.equal(receipt.physical_bravia_acceptance, 'not_tested');
  assert.match(summaryText, /neutral_page_navigation_not_observed/);
});

test('neutral harness preserves an earlier APK installation failure reason', () => {
  const {result, receipt} = runHarness('complete', true);
  assert.equal(result.status, 1, result.stderr);
  assert.equal(receipt.failure_stage, 'apk_install');
  assert.equal(receipt.failure_observation, 'apk_install_failed');
  assert.equal(receipt.infrastructure.apk_install, 'no');
});
