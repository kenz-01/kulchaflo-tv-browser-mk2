# TV Brainstorm — one Architect, reusable player families and cloud evidence (9 Nov 2026)

**Paired:** [TV technical continuation](2026-11-09_TV_Architect_Emulator_Helper_Continuation_Handover.md). This records owner decisions and durable lessons, not current installed-app claims.

## The user's completion priority

The current Android TV app is a valuable missing Kulcha Flo product, and is already close to finishing relative to rebuilding it. Focus on **live stream helpers** and minor cosmetics, with the Bravia as the physical acceptance reference. The first significant mistake to avoid is discarding manually achieved provider-specific successes simply because the channel list grew faster than the testing process.

## Family reuse is an optimisation, not blanket permission

A verified player family means we can reuse bounded, mechanically testable ideas: exact host/referrer, a uniquely visible original player, player-first layout that leaves player transport functional, finite retry or unmute, pointer sleep, and Back suppression. It does NOT prove that an entire new broadcaster shares another channel's legal source, autoplay consent, multi-player structure, underlying HLS/Media3 suitability or remote behaviour. Source validation is a precondition, not merely a fallback.

Examples: ABS and TTT share Tego but diverge in startup; CVM Vimeo and Island TV multi-event Vimeo need separate selection; CNC3, CVC9 and GBN differ radically in consent/ads despite Dailymotion; CBC's exact-HLS native routing is not a default Video.js feature; preserve sophisticated YouTube/Facebook separately. Lock proven provider behavior before changing an engine-wide matcher. A source-marker regression guards accidental removal, not every runtime behavioural regression.

## A cloud Android TV test is now possible

The previously unsuitable Intel Mac should no longer block **early emulator testing**. On 9 Nov a standard public-repo GitHub-hosted Ubuntu runner passed KVM, universal x86_64 Android TV emulator boot, GeckoView smoke and remote-input script. No extra paid runner was required for the pilot. This is a real environment unlock, but it was tested on `example.com` with audio disabled and cannot substitute for real original-provider live video or ARMv7 Bravia codec/remote/Back acceptance. The next efficient stage is a *bounded test-fix loop per one family*, not 49 network-dependent sites at once.

Treat cloud browser Work as **current broadcaster page/source research**; Codex as owner of code, Player Lab, and Android emulator tests. Codex must have access to real permitted networked pages to verify external streams. When cloud data-centre geoblocking/challenges/DRM interfere, preserve the blocked state instead of fabricating a pass or pursuing bypass. Real Bravia acceptance remains small but non-negotiable.

## Why the Architect Engine is multi-repo, not two engines

Owner authorized extending the already-hourly ChatGPT Architect Heartbeat to inspect *both* Events and TV. Architect directs multiple independent queues, prioritises work, checks protected tests and resumes blockers. It does not imply that Android TV GitHub now has the Events engine's privileged workflow-run completion/merge controller, and does not borrow Event PHP, STAGING credentials or D107 apply permission.

The potential efficiency gain is fewer owner interventions, faster learning from previous helper sources and reliable preservation of evidence between chats. Restrict each emulator run to deliberate source changes, avoid expensive default per-PR matrices, repeat only on real new evidence, keep privacy/safety and no additional spend.

## Proof standard for done

1. Old manually accepted providers still behave on Sony Bravia.
2. New helper reaches a genuinely current original publisher's live surface, shows moving program video + audio without doubled media, supports fullscreen/player-first and remote D-pad/Back; quality matches available source.
3. Failure is classified as app regression vs source outage vs geo/rights/challenge vs autoplay blocked vs codec problem. A green CI, iframe presence, or HTML title alone is never a playback pass.
4. Cosmetic change is independently checked at 720p/1080p and does not change provider handling.
5. Exact APK identity (source SHA + build) retained; no Play Store/production release without explicit owner decision.

The core goal is an actually enjoyable Caribbean channel-browsing device product alongside living website Hubs, not a larger matrix of theoretical working stream URLs.
