import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

const workflow = readFileSync(resolve(process.cwd(), '../../.github/workflows/tv-cloud-emulator-qualification.yml'), 'utf8');
const environment = readFileSync(resolve(process.cwd(), 'scripts/tv-emulator-environment.py'), 'utf8');
const comparison = readFileSync(resolve(process.cwd(), 'scripts/tv-provider-comparison.sh'), 'utf8');
const telesistemaScript = readFileSync(resolve(process.cwd(), 'scripts/tv-telesistema-source-feedback.sh'), 'utf8');
const telesistemaParser = resolve(process.cwd(), 'scripts/tv-telesistema-log-snapshot.py');

test('API 36 Google TV identity is separately selected and checked against runtime evidence', () => {
  const fixture = {
    target: 'google-tv',
    commit: '0123456789abcdef0123456789abcdef01234567',
    apk_sha256: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    props: {
      api: '36',
      abi: 'x86_64',
      device: 'sdk_gphone64_x86_64',
      build: 'google/sdk_gphone64_x86_64/aosp:36/ABCD/userdebug',
    },
    features: 'feature:android.software.leanback\n',
    home: 'com.google.android.apps.tv.launcherx/com.google.android.apps.tv.launcherx.MainActivity',
    sdk_package_present: true,
    sdk_package_version: '4.0.0',
    sdk_license_id: 'android-sdk-license',
    sdk_license_accepted: true,
  };
  const parsed = spawnSync('python3', [resolve(process.cwd(), 'scripts/tv-emulator-environment.py'), '--parse'], {
    input: JSON.stringify(fixture), encoding: 'utf8',
  });
  assert.equal(parsed.status, 0, parsed.stderr);
  const receipt = JSON.parse(parsed.stdout);
  assert.equal(receipt.qualification_status, 'PASS');
  assert.equal(receipt.sdk_package_installed, 'yes');
  assert.equal(receipt.sdk_package_version, '4.0.0');
  assert.equal(receipt.system_image_license, 'android-sdk-license');
  assert.equal(receipt.sdk_license_accepted, 'yes');
  assert.equal(receipt.selected_system_image, 'system-images/android-36/google-tv/x86_64');
  assert.equal(receipt.sdk_package_id, 'system-images;android-36;google-tv;x86_64');
  assert.equal(receipt.home_launcher_package, 'com.google.android.apps.tv.launcherx');
  assert.equal(receipt.api, '36');
  assert.equal(receipt.abi, 'x86_64');
  assert.equal(receipt.leanback_feature, 'yes');
  assert.equal(receipt.universal_apk_sha256, fixture.apk_sha256);
  assert.equal(receipt.playback_acceptance, 'not_tested');

  const invalid = spawnSync('python3', [resolve(process.cwd(), 'scripts/tv-emulator-environment.py'), '--parse'], {
    input: JSON.stringify({...fixture, props: {...fixture.props, api: '35'}}), encoding: 'utf8',
  });
  assert.equal(invalid.status, 0);
  assert.equal(JSON.parse(invalid.stdout).qualification_status, 'FAIL');
  const missingPackage = spawnSync('python3', [resolve(process.cwd(), 'scripts/tv-emulator-environment.py'), '--parse'], {
    input: JSON.stringify({...fixture, sdk_package_present: false, sdk_license_accepted: false}), encoding: 'utf8',
  });
  assert.equal(missingPackage.status, 0);
  assert.equal(JSON.parse(missingPackage.stdout).qualification_status, 'FAIL');
});

test('Telesistema log parsing reports only route-scoped counts and playback-time progression', () => {
  const raw = [
    '1764000000.000 123 123 I KfMkIIGV:GvNav: page start tabId=abc url=https://telesistema11.com.do/en-vivo/?token=private',
    '1764000000.001 123 123 I KfMkIIGV:GvMedia: telesistema viewport alignment visibleBefore=false scrollChanged=true',
    '1764000000.010 123 123 I KfMkIIGV:GvBrowserMedia: browser media session activated tabId=abc',
    '1764000001.000 123 123 I KfMkIIGV:GvBrowserMedia: browser media metadata tabId=abc title=private-title artist=private-artist',
    '1764000001.100 123 123 I KfMkIIGV:GvBrowserMedia: browser media position tabId=abc position=0.0 duration=900.0 rate=1.0',
    '1764000003.100 123 123 I KfMkIIGV:GvBrowserMedia: browser media position tabId=abc position=2.0 duration=900.0 rate=1.0',
    '1764000004.000 123 123 I KfMkIIGV:GvNav: page start tabId=abc url=https://www.dailymotion.com/video/x123?secret=private',
  ].join('\n');
  const parsed = spawnSync('python3', [telesistemaParser, '--parse'], {input: raw, encoding: 'utf8'});
  assert.equal(parsed.status, 0, parsed.stderr);
  const receipt = JSON.parse(parsed.stdout);
  assert.equal(receipt.official_top_level_page_start_count, 1);
  assert.equal(receipt.browser_media.session_activated_count, 1);
  assert.equal(receipt.browser_media.position_sample_count, 2);
  assert.equal(receipt.browser_media.position_advanced, 'yes');
  assert.equal(receipt.browser_media.time_to_first_position_ms, 1100);
  assert.equal(receipt.app_generated_telesistema_hover.viewport_alignment_event_count, 1);
  assert.equal(receipt.app_generated_telesistema_hover.startup_hover_dispatch, 'not_logged_by_current_app_build');
  assert.equal(receipt.app_generated_telesistema_hover.visible_before, 'false');
  assert.equal(receipt.app_generated_telesistema_hover.scroll_changed, 'true');
  assert.equal(receipt.embedded_frame_navigation, 'not_observable_in_top_level_navigation_events');
  assert.doesNotMatch(parsed.stdout, /token=private|secret=private|private-title|private-artist|telesistema11\.com\.do/);
  assert.doesNotMatch(parsed.stdout, /pointer_hover_event_count/);
});

test('comparison uses the existing manual, bounded read-only runner and the same universal APK', () => {
  assert.match(workflow, /default:\s+qualification/);
  assert.match(workflow, /default:\s+android-tv/);
  assert.match(workflow, /- provider-comparison/);
  assert.match(workflow, /- google-tv/);
  assert.match(workflow, /- compare-api36/);
  assert.match(workflow, /target: android-tv/);
  assert.match(workflow, /target: google-tv/);
  assert.match(workflow, /api-level: 36/);
  assert.match(workflow, /arch: x86_64/);
  assert.match(workflow, /profile: tv_1080p/);
  assert.match(workflow, /:app-gv:assembleUniversalDebug/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /timeout-minutes: 45/);
  assert.match(workflow, /retention-days: \$\{\{ inputs\.test_profile == 'provider-comparison' && 1 \|\| 7 \}\}/);
  assert.match(workflow, /!cancelled\(\).*steps\.kvm\.outcome == 'success'/);
  assert.doesNotMatch(workflow, /^\s*(pull_request|push|schedule):/m);
  assert.doesNotMatch(workflow, /matrix:/i);
  assert.match(environment, /system-images\/android-36\/{target}\/x86_64/);
  assert.match(comparison, /TV_ZNS_SINGLE_ATTEMPT=yes/);
  assert.match(comparison, /tv-zns-source-feedback\.sh/);
  assert.match(comparison, /tv-telesistema-source-feedback\.sh/);
  assert.match(comparison, /tv-cloud-emulator-qualification\.sh/);
  assert.match(comparison, /neutral_qualification/);
  assert.match(comparison, /universal_apk_sha256/);
  assert.match(comparison, /automatic_test_retries/);
  assert.match(comparison, /maximum_uncompressed_evidence_bytes_for_api36_pair_including_relay_duplicate/);
  assert.match(telesistemaScript, /SOURCE_URL="https:\/\/telesistema11\.com\.do\/en-vivo\/"/);
  assert.match(telesistemaScript, /KEYCODE_DPAD_RIGHT/);
  assert.match(telesistemaScript, /TV_MAX_SCREENSHOT_BYTES/);
  assert.doesNotMatch(telesistemaScript, /KEYCODE_DPAD_CENTER|KEYCODE_MEDIA_PLAY|\.click\(|\.play\(|requestFullscreen|loadUri\("javascript:/i);
});
