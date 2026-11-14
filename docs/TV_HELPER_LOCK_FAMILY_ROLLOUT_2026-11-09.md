# TV app — lock the manually working helpers, then extend by family

**9 November 2026 · source and historical acceptance audit, not new physical-TV approval.**

## Executive decision

The working GeckoView browser-first and exact-native routes are valuable product assets. Protect **behavioral invariants**, not arbitrary entire file hashes. Source changes elsewhere in the 312 KB `content.js` or 925 KB Kotlin activity are allowed only when independent tests and scoped review show the working providers are unaffected.

The stable/manual mainline provider behaviors are in `tools/player-lab/config/manual-helper-family-locks.json` with a regression test that detects deletion of their source markers and unsafe expansion of the single reviewed runtime policy registry. This lock inventory is **not a runtime policy, automatic updater, new helper engine, or proof that all channels were physically retested today**.

Sources inspected: current `main` GeckoView `content.js`, `GeckoBrowserActivity.kt`, `docs/PROVIDER_HELPER_BANK.md`, `docs/STREAM_HELPER_PLAYBOOK.md`, `docs/player-helper-commissioning-inventory.md`, Player Lab family signatures/proposal/engine tests, and live PR heads #16–#19. The older manually verified handovers and the 27 October Sony Bravia evidence take precedence over a green compile.

## 1. Lock: accepted mainline provider behavior

| Behavioral family | Existing mainline helper | Lock / important exception |
| --- | --- | --- |
| Tego | ABS (channel 10), TTT (channel 1) | Same host, **different** selection and readiness/timing. Retain URL sanitisation, bounded wake, scoped autoplay and per-channel Back |
| Novus/Telearuba | three channel intents (13/23/49) | Identity from explicit channel intent; single selected source; no generic multi-player guessing |
| Bradmax | Caribbean Gospel TV | Browser-first, stability-gated alignment, do not promote splash/false HLS |
| Flowplayer | Caribbean Hot TV | Only verified live Flowplayer, not adjacent YouTube; Back suppresses restart |
| Exact HLS / native | CBC TV8 | Exact known HLS host/path before Media3; native error falls back to browser |
| Exact HLS / browser | CaribVision | Login/session retained; HLS evidence does **not** authorize broad Media3 promotion |
| Vimeo event | CVM TV | Official scoped player-first and the **single** reviewed CVM embedded Vimeo transport-autohide registry policy |
| Vimeo event, multi-embed | Island TV / Island TV+ | **Provider-specific** event selection and one-player shell, disable all other potential audio frames |
| Wix / JW-style | CBN Virgin Islands | Real player readiness and bounded provider-only start, not a universal centre tap |
| JWPlayer | Compass TV | Accepted `compass-jw-v4-minimal`: outer wrapper only, one tap, silent bounded unmute, no MutationObserver audio spam |
| Dailymotion embed | CNC3 | Browser-owned official iframe, no broad native promotion |
| Dailymotion watch fallback | CVC9 | Consent and accepted watch-page fallback **only for CVC9**, not for GBN |
| Dailymotion official embed | GBN | No blind consent/wake taps, no ad-media native promotion, avoid browser/native double playback |
| Video.js | DBS TV | Preserve exact-scoped existing shell and known source matching; not a licence for generic HLS |
| Dedicated major platforms | YouTube, Facebook | Preserve their established Kotlin/platform state machines separately; do not absorb into generic player families |

**What “lock” means:** any touched component requires exact-route source and Kotlin acceptance tests, a clean `app-gv` build and Player Lab suite, before/after fixture results, then a *device* verification only for the affected protected behaviour. A source marker test is a **regression tripwire**, not sufficient behavioral proof by itself. Do not redesign already working pages just because other providers share a library.

## 2. Reuse what is actually common

- **Safe common capabilities:** official origin/embedded-host/referrer identity; one positively identified visible player; finite retry budget; player-first outer wrapper; scoped permission to autoplay; avoid overlap/background audio; video playing before pointer sleep; Back suppression; guarded finite play/unmute; audit-grade diagnostics.
- **Never inherit provider-specific side effects:** CVC9 consent/wake handling into GBN; Island TV iframe elimination into CVM; CBC Media3 promotion for arbitrary Video.js/HLS; Novus channel selection on single-stream sites; CBN blind click onto ad surfaces; Facebook consent/session recovery onto ordinary broadcasts.
- **The actual reusable runtime policy is narrow:** `PLAYER_HELPER_REGISTRY` currently contains **one** exact-frame-and-referrer `cvm-tv-embedded-vimeo` transport-autohide policy. Player Lab proposes and certifies options but does not silently apply policies. Keep other source-family detection **diagnostic** until approved specific evidence exists.

### Existing next implementation batches (not accepted mainline)

| Source | Scope | State |
| --- | --- | --- |
| Draft PR #16 | 13 source-specific live gaps: Radiant 3, Cloudflare SVG TV, hosted Video.js 4, pro-fhi/Identité, WAPA Flowplayer, WIPR Video.js, ZIZ Hls.js, TV6 Dailymotion | Source tests previously passed; physical acceptance still required. Do not duplicate the original Radiant PR #2 |
| Draft PR #17 | 19 exact routes using YouTube (5), Video.js (5), JWPlayer (2), Dailymotion (2), Vimeo (1), Hls.js (3), HTML5 (1) | The `known-family-helpers.js` route table and one-player guard already exist in this draft; do not copy them into a new engine or merge untested. Telesistema 11 upstream-lazy iframe behavior remains especially sensitive |
| Draft PR #18 | 17 exact official routes with a five-snapshot `unresolved-route-probe.js` | **Passive diagnostics**, not 17 functioning helpers. Use actual app-tagged logcat (the `KfMkIIGV:*` prefix) and correct `/watch-live` visitor routes |
| Draft PR #19 | ZNS exact official StreamcoMedia browser helper | Green software tests and historical ZNS play/fullscreen/Back observation; continuous *live* source not yet proven on Sony |
| PR #21 | TV architect handover/playbook | Document-only, independent of runtime chain |

None of these is a license to bulk-merge 13 + 19 + 17 as a fleet of 49 working streams. In particular #18 is **observation only**. Rebase from current main and compare source deltas rather than trusting old PR base/synthetic merge.

## 3. New family discovery frontier — diagnostic first

Four concrete *player-host* leads warrant separate, evidence-led characterization:

| Proposed family | Target | Existing observed lead | First safe action |
| --- | --- | --- | --- |
| Dacast | HGPTV | First-party `/watch-live/` embeds Dacast; on-device human challenge/failed playback | Observe normal rendered player, current route, publisher permission and non-bypass failure; do not solve challenge or substitute streams |
| StreamcoMedia | ZNS Bahamas | Official iframe, #19 browser helper | Confirm real continuous live A/V, fullscreen, D-pad and Back before new shared helper |
| OpenCaster | VIP Radio Aruba TV | Publisher `/live-tv/` embeds OpenCaster | Verify original iframe/player and actual controls first |
| StreamBrothers | Live99 TV | Publisher links to StreamBrothers TV player path | Confirm publisher relationship, direct player readiness and page behaviour; no extraction |

**Do not prematurely elevate a host hint to a Player Lab registered family.** Additional unknowns remain in 17-route passive queue (e.g. TVCARiB multi-channel identity, Scorch/Mux thumbnail ≠ player proof, MTV 1080p user success needing app-tag logs). Provider-specific security/cross-origin constraints may require keeping a helper separate, not widening a shared class.

Once a genuinely new family is confirmed by two or more *compatible* independent providers, consider a reusable capability contract. A single exceptional provider should use a narrow adapter. Approval requires exact official route/frame ownership, reproducible playback state and one-provider fail-closed regression before expansion.

## 4. Ordered acceleration path

1. **Freeze and run tests for mainline helpers** (this source-only lock inventory and the existing provider tests). No native behavior changed. Keep accepted YouTube/Facebook unchanged.
2. **Evaluate pending #16 and #17 against locks**, accept individually passing known-family changes with a current-head unit/Player Lab + Bravia release build, emulator smoke run and the smallest necessary Sony verification; hold upstream outages as `SOURCE_OFFLINE`, not app defects.
3. **Use #18 diagnostics for unresolved player identity.** Its 17 targets are not helper implementations. Fix probe routes/log collection before making decisions; keep challenge/DRM/rights cases held.
4. **Complete #19 ZNS source truth** then investigate Dacast/HGPTV, OpenCaster/VIP and StreamBrothers/Live99 as distinct evidence candidates; never override MTV's observed working 1080p source with a historical preview.
5. **Cosmetic work last** in a separate small PR: startup/OSD focus, padding, pointer and responsive 720p/1080p screenshots. No autoplay/security policy edits in a cosmetic PR.
6. **One integrated acceptance APK** only after protected exact-head CI and independent diff review; test at least one representative for each *changed* family on physical Bravia. Continuous live, real sound, fullscreen, remote, Back, no duplicate audio, quality and fresh/same-install behavior decide completion.

## 5. Non-negotiable safety

No new autoplay blanket, renderer, alternative player engine, broad URL rewrites, unverified stream extraction, arbitrary native Media3 promotions, anti-bot/DRM bypass, automatic release or store upload. No re-use of the Events runner or expanded GitHub/AI spending. Use existing hosted test gates and $0 overage; do not run a costly always-on browser sweep. No package/build is real Sony playback acceptance. No destructive uninstall without artifact provenance and owner-coordinated testing.

**Boundary:** this PR contains a documentation/configuration **lock inventory plus a fail-on-deletion regression test only**. It does not install, enable or change any runtime helper.
