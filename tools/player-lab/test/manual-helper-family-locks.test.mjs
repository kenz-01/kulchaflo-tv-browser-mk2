import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const locks = JSON.parse(read('tools/player-lab/config/manual-helper-family-locks.json'));
const content = read('app-gv/src/main/assets/gv_media_observer/content.js');
const kotlin = read('app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt');
const sourceFiles = new Map([
  ['app-gv/src/main/assets/gv_media_observer/content.js', content],
]);

function unique(items, label) {
  const keys = items.map((item) => item.id ?? item.family);
  assert.equal(new Set(keys).size, keys.length, label + ' identities are unique');
  for (const key of keys) assert.match(key, /^[a-z][a-z0-9-]{1,79}$/, label + ' identity');
}

test('manual helper locks are a source-only inventory, never playback acceptance or runtime policy', () => {
  assert.equal(locks.schema_version, 'kf_tv_manual_helper_family_lock_v1');
  assert.equal(locks.runtime_effects, 0);
  assert.equal(locks.auto_apply, false);
  assert.match(locks.authority, /NOT_FRESH_BRAVIA_ACCEPTANCE/);
  assert.equal(locks.accepted_mainline_contracts.length, 15);
  assert.equal(locks.pending_phase1_source_routes.length, 13);
  assert.equal(locks.pending_known_family_routes.length, 19);
  assert.equal(locks.passive_unknown_source_routes.length, 17);
  assert.equal(locks.new_family_evidence_frontier.length, 4);
});

test('mainline lock entries reference actual manual helper source without claiming new Bravia tests', () => {
  unique(locks.accepted_mainline_contracts, 'mainline provider');
  for (const entry of locks.accepted_mainline_contracts) {
    assert.equal(entry.lock_level, 'PRESERVE_EXISTING_MAINLINE_BEHAVIOR');
    assert.match(entry.physical_acceptance, /NO_FRESH_DEVICE_TEST/);
    assert.ok(entry.protected_behavior.length > 25, entry.id + ' has specific behavior to preserve');
    const source = sourceFiles.get(entry.source_path);
    assert.equal(typeof source, 'string', entry.id + ' has known source path');
    assert.ok(source.includes(entry.source_marker), entry.id + ' source marker must still exist');
  }
  for (const guard of [
    'isExactCbcLiveHlsUrl', 'isExactCaribVisionLiveHlsUrl',
    'isGbn', 'isCvc9', 'isCompass', 'isIsland', 'isDbs',
  ]) {
    assert.ok(kotlin.includes(guard), 'Kotlin provider route/promotion guard must remain: ' + guard);
  }
});

test('pending family batches are complete and never promoted by classification alone', () => {
  const phase1 = locks.pending_phase1_source_routes;
  const known = locks.pending_known_family_routes;
  const unknown = locks.passive_unknown_source_routes;
  unique(phase1, 'phase1 route');
  unique(known, 'known-family route');
  unique(unknown, 'passive unresolved route');
  const all = [...phase1, ...known, ...unknown].map((x) => x.id);
  assert.equal(new Set(all).size, all.length, 'no provider duplicated across pending independent batches');
  for (const entry of phase1) {
    assert.equal(entry.source_pr, 16);
    assert.equal(entry.state, 'DRAFT_GAP_HELPER_AWAITING_PHYSICAL_ACCEPTANCE');
  }
  for (const entry of known) {
    assert.equal(entry.source_pr, 17);
    assert.equal(entry.state, 'DRAFT_KNOWN_FAMILY_ROUTE_AWAITING_PHYSICAL_ACCEPTANCE');
  }
  for (const entry of unknown) {
    assert.equal(entry.source_pr, 18);
    assert.equal(entry.state, 'PASSIVE_PROBE_ONLY_NOT_PLAYBACK_ACCEPTED');
  }
  for (const entry of locks.new_family_evidence_frontier) {
    assert.equal(entry.may_auto_apply, false);
    assert.equal(entry.state, 'NEW_FAMILY_DIAGNOSTIC_CANDIDATE_ONLY');
  }
});

test('existing approved generic policy remains strictly single CVM Vimeo transport capability', () => {
  const start = content.indexOf('const PLAYER_HELPER_REGISTRY = Object.freeze([');
  const end = content.indexOf('const TRANSPORT_AUTOHIDE_INTERACTION_EVENTS', start);
  assert.ok(start >= 0 && end > start, 'exact existing bounded runtime registry exists');
  const registry = content.slice(start, end);
  assert.deepEqual([...registry.matchAll(/\bid:\s*"([^"]+)"/g)].map((m) => m[1]),
    ['cvm-tv-embedded-vimeo'], 'no proposed family is automatically installed');
  assert.ok(content.includes('function matchesPlayerHelperPolicy('), 'current trusted matcher remains');
  assert.ok(content.includes('function installTransportAutohideCapability('), 'approved timer engine remains');
  for (const feature of ['pagehide', 'referrerHosts', 'pathPrefix', 'pathSuffix']) {
    assert.ok(content.includes(feature), 'existing safety condition remains ' + feature);
  }
});
