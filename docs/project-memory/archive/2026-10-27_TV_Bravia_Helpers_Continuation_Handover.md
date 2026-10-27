# Kulcha Flo TV — continuation handover, 27 October 2026

**Capture status:** CHAT_TEXT_CAPTURE + direct source-code/GitHub/attached-ADB-log reconciliation. This is not a raw conversation transcript and raw logs are not copied into Git. Read [current state](../CURRENT_STATE_2026-10-27.md), [decision ledger](../DECISION_LEDGER.md), and current GitHub HEADs before acting.

## Owner's active instruction and objective

Drive the Android TV app forward using the manually implemented broadcaster helpers as working patterns. Economically reuse exact player-family structures; prioritise actual picture/sound, player-first/fullscreen, pointer sleep, remote and Back. Implement/review code yourself via GitHub; don't create repeated source-only reports or install speculative wide-scope policy changes. Sony Bravia (32-bit ARM) is canonical physical acceptance; preserve functional Facebook and YouTube behaviour. Do not claim green CI means a channel works.

## Repository, authoritative anchors and dependency chain

- Repo: `kenz-01/kulchaflo-tv-browser-mk2`.
- **Main** last verified `271a5b2fce016bfb1a4766225c77b8e90391618f`. Refresh.
- `AGENTS.md`; `docs/PROVIDER_HELPER_BANK.md`; `docs/player-helper-commissioning-inventory.md`; `app-gv/src/main/assets/gv_media_observer/content.js`; `known-family-helpers.js` and `unresolved-route-probe.js` on pending branches; `app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt`; `tools/player-lab/config/public-targets.json`; `.github/workflows/tv-ci.yml`.
- PR #15 previously merged recovery foundation; the following **draft, not merged** dependencies remain:
  1. [#16](https://github.com/kenz-01/kulchaflo-tv-browser-mk2/pull/16), `recovery/10-live-gap-provider-layers`, HEAD `1368fd6565c5e6d6bbcfceffe327cb97e6664643`: 13 historical live-gap helper candidates; physical acceptance incomplete.
  2. [#17](https://github.com/kenz-01/kulchaflo-tv-browser-mk2/pull/17), `player-helper-known-families-phase2`, HEAD `8c75afe6a250725e8406dce56bf164ed291bfc20`: 19 official routes / seven known families; 313/313 Player Lab on that revision, Telesistema broadcaster/site intermittent and lazy iframe fix unverified.
  3. [#18](https://github.com/kenz-01/kulchaflo-tv-browser-mk2/pull/18), `diagnostics/unresolved-17-bravia-probe`, HEAD `ad99f07e639155ee3a2efed51d50c3a2ab0125af`: passive instrumentation, scoped 17 routes, Mac sweep script, corrected real `KfMkIIGV:` log tags. Last HEAD CI #40428743333 failed **one passive-fixture-profile test (2 !== 1)**, 318/319 passed; earlier HEAD `a5bb2ccc` succeeded 319/319, but does NOT include corrected sweep. Reconcile and rerun; do not claim latest green.
  4. [#19](https://github.com/kenz-01/kulchaflo-tv-browser-mk2/pull/19), `helper/zns-streamcomedia-bravia-phase1`, HEAD `a8166a873b291c1d404aecf9292edaee45879b7f`: bounded browser-owned official ZNS StreamcoMedia helper, strict referrer and exact-url boundaries, scoped native permission and promotion excludes. **Exact-head** GitHub CI run #40431408983 SUCCESS. Physical ZNS helper acceptance still pending. This branch descends from #18 and #17/#16. Do not merge out of dependency order.

Historic draft PRs #1–#5 also remain open. They were not audited in this chat for relevance/supersession; inspect before closing or merging. Do not confuse branch/file commits with successful TV installation.

## Manual helper baseline

Existing *actually implemented* manual provider groups from source: ABS/Tego, TTT/Tego, Novus shared Telearuba 13/Nos Isla 23/Aruba TV 49, CGTV Bradmax, Caribbean Hot TV/Flowplayer, CaribVision, CBC Media3, CVM/Vimeo, Island TV/Vimeo, CBN Virgin Islands, CNC3/Dailymotion, CVC9/Dailymotion, GBN/Dailymotion, Compass/JWPlayer, DBS/St Lucia. Existing YouTube and Facebook player subsystems are separate and must be preserved. Existing native Media3 is not a blanket replacement for embedded browser playback.

## Physical Sony Bravia and delivery constraints

- TV ADB: `192.168.0.16:5555`, package `com.kulchaflo.tv.mk2.gv`, activity `.app.GeckoBrowserActivity`.
- CPU ABIs: `armeabi-v7a,armeabi` (32-bit only). **Do not switch to arm64.**
- Release APK ~149 MB, already `armeabi-v7a` and resource/code-shrunk. Device /data total 4.0 GB, initially 575 MB free; `pm trim-caches 1G` improved to 820 MB then uninstall/streamed install succeeded. For another installation: verify SHA via `BUILD_PROVENANCE.txt` and checksum BEFORE uninstalling; `adb uninstall`, `adb shell pm trim-caches 1G`, `adb install`, launch. Do not unnecessarily uninstall installed **build 5** during source-only investigations.
- Physical A/V, 1080p viability, fullscreen, remote and Back are per-channel gates. No Play Store/production release.
- `GvLogger.kt` writes **`KfMkIIGV:GvMedia`**, `KfMkIIGV:GvNav`, etc. Bare `GvMedia` `logcat -s` filters yielded bogus captures. Collect FULL `adb logcat -b all -d -v threadtime` to compressed private local file; never post raw ADB logs to public GitHub. New sweep on #18 starts a live unfiltered capture BEFORE navigation, requires at least two per-channel probe lines, and marks absence INCONCLUSIVE.
- User reports repeated chat/tool disconnects; all significant work must be persisted before transition.

## Bravia observed per-channel truth

**CBC TV8:** app detected official HLS and Media3 buffered without ready; user independently checked official broadcaster stream down. **Source offline; do not change established CBC helper** without fresh evidence.

**Telemicro 5:** latest on-TV trial worked; cursor/transport behaviour corrected, provisionally accepted.

**Bonce TV:** player presentation appeared acceptable but broadcaster stream currently down; audio/actual live playback not accepted. **Balchi TV:** official HLS failed HTTP 404, no fake player workaround.

**Telesistema 11:** manual cursor/D-pad movement made Dailymotion load; subsequent HD sound and fullscreen worked. Multiple revisions of exact-route lazy-frame wake/eager attributes in #17 passed CI, but final Bravia test inconclusive because broadcaster official website intermittent. Preserve pre/post auto-start distinction; don't mark either PASS or FAIL.

**ZNS Bahamas:** physical log `manual-trials-20261027-005333.log.gz` (PRIVATE on ChatGPT upload) shows the official top-level `znsbahamas.com/` iframe hosted by `player.streamcomedia.com`, 0 top-level videos, first-party audible/inaudible autoplay decisions 0. After real D-pad/OK input, Gecko browser media played about 00:47:10, fullscreen 1920×1080 about 00:47:27, Back exited at 00:47:48. Duration `522.522s`: MAY be recording/timeshift; not proof of continuous live. PR #19 attempts browser-first layout + bounded official frame play/unmute, strictly scoped permission, no fake stream/native Media3. **Needs actual TV playback test.**

**MTV Guyana:** older manual capture showed `stream.mtvgy.com/mtvguyana/preview.mp4` (duration ~0.04s) and fullscreen, which was not a live source. Later owner explicitly reported **actual live stream playing in 1080p fullscreen**; first seemed stuttering but was later observed smooth. This supersedes claim 'only preview available'. The user-uploaded `mtv-live-1080p.log.gz` has 90,319 lines of mainly kernel/system/gralloc traces through ~01:23, **ZERO `KfMkIIGV`, GeckoView, or MTV URLs**; graphics/codec activity cannot verify real HLS/source/quality. Do **not downgrade MTV quality**, auto-promote preview.mp4 or assert native 1080 proof. Need fresh full application-specific capture while playing.

**HGPTV Guyana:** original `hgptv.log.gz` is 60 old Sony/AndroidRuntime lines from 26 Oct 10:29, no HGPTV events; **not a valid capture**. However PRIVATE complete `manual-trials-20261027-005333.log.gz` has real 27 Oct HGPTV trials:
- `https://www.hgptv.com/` read-only probe: 00:48:01 and 00:48:02, visible Dacast iframe, `iframe.dacast.com`, 0 top-level videos; media-delegate recognised managed browser player, no eligible native candidate.
- First-party audible + inaudible autoplay permission requests for Dacast third-party origin retained `decision=0`; Dacast JS warned that autoplay requires user activation or mute.
- At **00:48:09**, a challenge-labelled new-tab navigation tried to open literal placeholder host `https://www.__site_host__/?utm_source=challenge...`, failed Gecko onLoadError `category=5 code=37` and failed two retries by 00:48:12. It is NOT proof of a specific legitimate anti-bot vendor; do not bypass/auto-solve challenge or trust placeholder URL.
- The owner also manually navigated from the Kulcha Flo HGPTV Channel card to official **`https://www.hgptv.com/watch-live/`** at 00:48:40. This page also embeds Dacast and generated first-party autoplay defaults `0`; media candidates were retained in browser, no confirmed playing.
- **Recon discrepancy:** #18 official probe registry for HGPTV currently uses homepage `https://www.hgptv.com/` only. Real visitor “Official Link” reached `/watch-live/`. Reconcile official page against WordPress/live visitor navigation and only then adjust probe/route; no security bypass.
- **Verdict: `PLAYER_DETECTED_DACAST; SOURCE/CHALLENGE_BLOCKED; A/V NOT ACCEPTED`.** Do not mark stream down merely because the challenge tab failed; homepage official iframe loads, but browser playback not proven.

## Next-chat execution order

1. Refresh main SHA, PR #16–#19 exact heads, current checks, documented user-reported TV observations; inspect `AGENTS.md`, present source modules, and this handover. Do NOT rely on this 27 Oct snapshot for live status.
2. Resolve #18 **passive-fixture-profile test 2!==1** regression/flakiness without broad code change; evaluate whether test was race-driven (previous same area passed) or deterministic. Re-run exact-head CI. Keep ZNS downstream synced if #18 changes.
3. Fix HGPTV official route mismatch between homepage diagnostic and actual first-party `/watch-live/`, ensuring safe host+path classification, but no challenge circumvention and no arbitrary Dacast URL rewrites.
4. ZNS #19 physical acceptance on **correct broadcast**, sound/fullscreen/Back with untouched remote, compare to manual path; any failure use full correctly tagged logcat; only then mark accepted/merge dependencies.
5. MTV: capture real *current playing* app-level logs with correct `KfMkIIGV:` tags and browser source/quality; preserve reported good 1080p fullscreen. Determine live playback identity vs prior preview.
6. Systematically work other 17 unknown-source channels using corrected sweep; implement only evidence-grounded exact-source family helpers, not blanket player policy.
7. Reconcile stale #1–#5 drafts carefully; no forced merge/closure. No code gets production release without user decision.

## Current/chat log sources (not in Git)

Private files: `hgptv.log.gz`, `zns-tv.log.gz`, `mtv-guyana.log.gz` (each invalid 60 old crash lines), `manual-trials-20261027-005333.log.gz` (true 74k-line app capture), `mtv-live-1080p.log.gz` (90k system/graphics logs without app events), earlier CBC/Telesistema sessions. These exact filenames are contextual references only, not guaranteed accessible in a new chat. **Never fabricate that a new chat can open them without uploads**; sanitized findings above preserve the conclusions.

## Handover authority and safety

Read `docs/project-memory/README.md` and `docs/project-memory/archive/` index. Operational status is exact GitHub live evidence; user physical trial is separate from CI. Preserve old claims as historical observations when superseded by later real device evidence. No raw log secret/token/session data in Git. Scope changes to ZNS/HGPTV/MTV only after source proof; accepted manual helpers plus Facebook/YouTube not regressed.
