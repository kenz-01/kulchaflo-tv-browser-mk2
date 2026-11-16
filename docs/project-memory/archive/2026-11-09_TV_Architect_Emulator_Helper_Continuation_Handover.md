# Kulcha Flo TV — operational continuation, 9 November 2026 (evening UK)

**Paired:** [TV Brainstorm](2026-11-09_Brainstorm_TV_One_Architect_Helper_Cloud_Proof_Handover.md), [current state](../CURRENT_STATE_2026-11-09.md). Dated source and chat capture; authoritative current GitHub main/heads, physical Bravia evidence, and latest owner instruction take priority. No raw screenshot or logs copied to this document.

## Owner objective and architectural coordination

Finish the existing GeckoView Android TV application rather than rebuild it: preserve manually successful live provider helpers, share narrowly evidenced playback-family techniques where safe, then test genuinely new provider families and make minor cosmetic fixes. The owner's Intel Mac does not provide a workable local emulator; Sony Bravia has been used for actual Android TV acceptance.

**Architect engine connection is real:** Existing ChatGPT `Kulcha Flo Architect Heartbeat` task `6ab6f2a9e2b08191b63c6f0a2579f3bd` was updated in place 9 Nov to coordinate Events and TV separate work queues hourly. No second schedule, privileged Events workflow/credentials, TV automated merge, WordPress access or direct Sony device access was added. This is architect *coordination*, not copying Events trusted CI controller into TV.

## Current repository and technical entry points

`kenz-01/kulchaflo-tv-browser-mk2`, public GitHub repository, `main` last observed `37b8da13c97737e1ac5f7e04083d2acce16bd4c3`. Start with `AGENTS.md`, `docs/PROVIDER_HELPER_BANK.md`, `docs/STREAM_HELPER_PLAYBOOK.md`, `app-gv/src/main/assets/gv_media_observer/content.js`, `app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt` and `tools/player-lab`. The Bravia flavour uses 32-bit ARMv7 `armeabi-v7a`; emulator-compatible universal flavour includes `x86_64`. Compilation in one ABI is not playback acceptance for the other.

The already-merged recovery foundation PR #15 is the starting implementation. Existing source/CI references and older historical helper-handover docs remain authoritative for accepted provider-specific behaviour.

## Manual working helper lock — draft PR #22

[PR #22](https://github.com/kenz-01/kulchaflo-tv-browser-mk2/pull/22), **draft, unmerged, AI_MANUAL_BOUNDARY**, exact head `da720e727f69f8133806ccfbe0b2bd5eb0d7f78f`. Adds source-only machine-readable 15 mainline helper group protection inventory, regression source/Android guard marker checks, dedicated rollout document, and invokes the test in *existing* deterministic TV CI; no app JavaScript/Kotlin runtime behaviour changed.

GitHub exact-head run [#42551858450](https://github.com/kenz-01/kulchaflo-tv-browser-mk2/actions/runs/42551858450) **SUCCESS**, including newly added manual helper lock test and Android compile/test. However a marker tripwire is not behavioral proof that every provider works now. No automatic merge.

Manual historically working families/groups include ABS & TTT Tego (different readiness/channel), three Novus/Telearuba profiles, Caribbean Gospel TV Bradmax, Caribbean Hot TV Flowplayer, CBC exact HLS/native, CaribVision auth/browser first, CVM embedded Vimeo, Island TV+ selected multi-embed Vimeo, CBN and Compass JW, CNC3/CVC9/GBN Dailymotion with different consent/watch behaviours, DBS exact Video.js. Preserve YouTube/Facebook separate mature runtime flows. Don't apply broad autoplay/media promotion, generic consent taps, secondary audio, blind centre taps, exact-HLS native promotion to other hosts.

## Unmerged helper family chain

- [#16](https://github.com/kenz-01/kulchaflo-tv-browser-mk2/pull/16): 13 historical live-gap provider helpers, includes 3 Radiant, Cloudflare SVG, hosted Video.js, WAPA Flowplayer, ZIZ, TV6 etc. Software tests do not count as Sony passes.
- [#17](https://github.com/kenz-01/kulchaflo-tv-browser-mk2/pull/17): 19 known-family official exact routes implemented in `known-family-helpers.js`, exact trusted media and single-player detection; no automatic approval for all 19, Telesistema 11 lazy embed/upstream hold.
- [#18](https://github.com/kenz-01/kulchaflo-tv-browser-mk2/pull/18): 17 unresolved *passive diagnostic routes*, NOT 17 playback helpers. Diagnostic `KfMkIIGV:` log-tag filtering, official route resolution, no speculative redirect to source.
- [#19](https://github.com/kenz-01/kulchaflo-tv-browser-mk2/pull/19): source-scoped StreamcoMedia ZNS browser helper; prior video playback/fullscreen/Back observation is not unequivocal continuous live proof.
- [#21](https://github.com/kenz-01/kulchaflo-tv-browser-mk2/pull/21): independent TV architect handover/playbook source, open.
- New proposed player-host leads: Dacast/HGPTV (real official /watch-live and human challenge, no bypass), OpenCaster/VIP Radio Aruba TV, StreamBrothers/Live99; keep ZNS/StreamcoMedia scoped. Preserve owner's actual MTV Guyana 1080p observation rather than downgrade to a preview.

## Cloud Android TV emulator is now actually qualified — draft PR #23

[PR #23](https://github.com/kenz-01/kulchaflo-tv-browser-mk2/pull/23), **draft, unmerged, AI_MANUAL_BOUNDARY**, head `46a69a248f35208f2c55524d9946fdd6ff3161b2`. Adds one bounded path-limited / manually dispatchable standard Ubuntu x86_64 Android TV API36 emulator qualification workflow and a smoke shell script, using the ReactiveCircus Android emulator action, normal SDK image provisioner, KVM and `tv_1080p` profile. The universal GeckoView debug APK launches an anonymous `https://example.com` page, runs Android TV/ABI/leanback/process checks, sends D-pad/OK/Back, captures screenshot and brief evidence receipt. No live TV stream, credentials or Sony installation.

Initial emulator run [#42672852363](https://github.com/kenz-01/kulchaflo-tv-browser-mk2/actions/runs/42672852363) **FAIL before emulator boot**, solely because premature preflight invoked unavailable `sdkmanager` on bare runner; never interpret that as Android player failure. Corrected workflow removed preflight and lets emulator action install Android tools/image.

Corrected GitHub Actions:
- [Android TV cloud qualification #42677219314](https://github.com/kenz-01/kulchaflo-tv-browser-mk2/actions/runs/42677219314): **SUCCESS** on exact head, including KVM, universal APK assembly, Android TV emulator boot, smoke script and artifact upload.
- [Normal TV deterministic CI #42677219152](https://github.com/kenz-01/kulchaflo-tv-browser-mk2/actions/runs/42677219152): **SUCCESS**, original `app-gv` compile/test and ARM Bravia release build unaffected.
- Evidence artifact ID `13701585916` name `tv-cloud-emulator-qualification`, 157,882 bytes, created 9 Nov 18:52 UTC, **expires 10 Nov 18:52 UTC**. Grab, visually inspect and separately preserve safe screenshot/receipt quickly; the artifact's existence and workflow success are known, but its contents were not independently inspected in this handover.

**Do not claim** audible TV sound, rights, actual live or fullscreen streamed content, DRM/geoblocking compatibility, provider source availability, hardware-decoding parity or physical Bravia acceptance. The smoke used `-noaudio` and `example.com`. Reuse this pipeline for real-network source-specific testing only after independent review and a properly bounded follow-up, not unrestricted polling or a new always-on CI loop.

## What is and isn't wired

Existing main TV workflows include `.github/workflows/tv-ci.yml` (PR/push/manual deterministic Android gate), `tv-recovery-artifact-worker.yml` (Issue #10 owner-authorised Copilot CLI recovery patch artifact; non-publishing), and `tv-copilot-cli-canary.yml` (manual test). The qualified emulator workflow is present **on PR #23 only**, not merged to main; no permanent trusted review-completion/auto-merge clone from Events. The shared hourly Architect knows how to choose TV work but must not infer a running standalone TV worker or automatic deployment.

## Required next actions

1. **Review PR #23 security/CI boundary**: standard Linux public runner only, read permissions, no package publishing, no scheduled/expensive matrix, no arbitrary site-crawl, proper paths/one-day retention, and no use of Event secrets/runner. Inspect expiring screenshot and text receipt for correct app UI and expected D-pad/Back behavior. If independently accepted, request appropriate owner permission to merge the held workflow; no self-bypass.
2. **Review PR #22 source safety and CI**, independently verify 15 historically protected groups and existing acceptance; only merge through normal TV review/owner boundary.
3. **Source-scoped genuine live tests:** keep #16/17 existing code, use a small representative official publisher case per player family, capture safe playback state, audibility evidence when possible, fullscreen, D-pad, Back and failure reason. Need network-enabled Android TV testing environment; some broadcaster domains may reject cloud data-centre IP/DRM. Stop on challenge, rights or source-offline, do not fabricate stream URLs.
4. Use actual test failures to fix Kotlin/JS in bounded Codex branches with Player Lab and fresh exact-head CI; do not work concurrently in the same files as other Codex worker PRs. Compare old helper branch deltas against main and avoid duplicating Radiant or broad registry.
5. Finish cosmetic adjustments in a separate small PR only after core families; final Bravia physical 32-bit ARM APK checks are required on a small representative affected family set. No owner Mac emulator, no automatic Sony uninstall/install or Play Store release.

## Parallel Events Codex reports — explicit cross-reference

Owner just supplied [Events PR #1443](https://github.com/kenz-01/kulchaflo-events-engine/pull/1443) completed bounded 22×3×19 Carnival inspector/comparator with focused PHP lint/tests PASS, but native STAGING/D108 absent, 1,250 unknown, Saint Lucia duplicate, Trinidad conflict, two St Pauls N/A, and **three malformed approved manifest entries** (catalog incomplete). [Events PR #1442](https://github.com/kenz-01/kulchaflo-events-engine/pull/1442) adds Channel/Show restricted inspector/offline reconciler, **7 Python PASS but PHP not run** due missing binary/full disk; GitHub protected gate SKIPPED, no runtime integration. Codex cited `a51e00e...`, current GitHub PR API cited `ee0063d29...` as head and the previous revision is an ancestor with identical inspected code blobs; validate new head. Neither Events PR is merged or runtime installed. The hourly Architect should progress source-only reviews in each repository independently and not transfer Events STAGING rights to the TV application.

## Invariants

No unreviewed held-PR merge; no automatic release; no privileged Events token/worker; no producer rights bypass or website challenge solving; no fake source URL; protect accepted manually working providers; no £/$ incremental paid overage, paid larger runners, extra scheduler or uncontrolled loops. The source PR may pass without proving picture/sound on Sony; report truthfully.
