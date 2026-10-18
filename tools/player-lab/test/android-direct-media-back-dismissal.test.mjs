import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const activityUrl = new URL(
  '../../../app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt',
  import.meta.url,
);
const trackerUrl = new URL(
  '../../../app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/media/GvDirectMediaDismissalTracker.kt',
  import.meta.url,
);

test('promoted-media Back records dismissal before release and leaves the provider flow', async () => {
  const source = await readFile(activityUrl, 'utf8');
  const promotedBranch = source.slice(
    source.indexOf('if (promotedMediaPlayer.isPromoted())'),
    source.indexOf('if (maybeHandleAbsBackExit', source.indexOf('if (promotedMediaPlayer.isPromoted())')),
  );

  assert.ok(promotedBranch.indexOf('dismissActivePromotion') >= 0);
  assert.ok(promotedBranch.indexOf('promotedMediaPlayer.stop') > promotedBranch.indexOf('dismissActivePromotion'));
  assert.ok(promotedBranch.indexOf('navigateAfterPromotedMediaDismissal') > promotedBranch.indexOf('promotedMediaPlayer.stop'));
  assert.match(source, /activeTab\.session\.goBack\(\)/);
  assert.match(source, /tabController\.closeTab\(activeTab\.id\)/);
  assert.match(source, /activeTab\.session\.loadUri\(BuildConfig\.DEFAULT_START_URL\)/);
});

test('all native direct-media promotion paths record the active document generation', async () => {
  const source = await readFile(activityUrl, 'utf8');
  const playCalls = [...source.matchAll(/promotedMediaPlayer\.play\(observation\)/g)];
  const recordCalls = [...source.matchAll(/recordDirectMediaPromotion\(session, observation\.url\)|recordDirectMediaPromotion\(activeSession, observation\.url\)/g)];

  assert.equal(playCalls.length, 3);
  assert.equal(recordCalls.length, 3);
  for (const playCall of playCalls) {
    const preceding = source.slice(Math.max(0, playCall.index - 900), playCall.index);
    assert.match(preceding, /recordDirectMediaPromotion/);
  }
});

test('dismissed document evidence is gated before CBC and generic candidate processing', async () => {
  const source = await readFile(activityUrl, 'utf8');

  assert.match(
    source,
    /\(type == "media-evidence" \|\| type == "cbc-live-hls-ready"\)[\s\S]{0,160}directMediaPromotionSuppressedForSession\(session\)/,
  );
  assert.match(source, /suppress-user-dismissed-document/);
  assert.match(source, /retain-browser-after-user-back/);
  assert.match(source, /ignore-stale-promotion-evidence/);
  assert.doesNotMatch(source, /DIRECT_MEDIA_PROMOTION_SUPPRESSION_MS/);
  assert.doesNotMatch(source, /directMediaPromotionSuppressedUntilByUrl/);
});

test('dismissal state is hash-only, in-memory, and cleared only at lifecycle boundaries', async () => {
  const source = await readFile(trackerUrl, 'utf8');

  assert.match(source, /normalizedPageIdentitySha256: String/);
  assert.match(source, /promotedSourceSha256: String/);
  assert.match(source, /MessageDigest\.getInstance\("SHA-256"\)/);
  assert.match(source, /fun onLocationChanged/);
  assert.match(source, /fun closeSession/);
  assert.match(source, /dismissals\.remove\(session\)/);
  assert.doesNotMatch(source, /SharedPreferences|DataStore|writeFile|File\(/);
  assert.doesNotMatch(source, /val (?:pageUrl|mediaUrl|sourceUrl): String/);
});

test('tab closure clears direct-media dismissal state', async () => {
  const source = await readFile(activityUrl, 'utf8');
  const onTabClosed = source.slice(
    source.indexOf('override fun onTabClosed'),
    source.indexOf('private fun scheduleTransientLoadRetry'),
  );
  assert.match(onTabClosed, /directMediaDismissalTracker\.closeSession\(tab\.session\)/);
});
