# Kulcha Flo TV — current state at 27 October 2026

**Dated snapshot; not live release authority.** Last verified main `271a5b2fce016bfb1a4766225c77b8e90391618f`. See [27 Oct continuation](archive/2026-10-27_TV_Bravia_Helpers_Continuation_Handover.md) and live GitHub PR state. The TV project now has a self-contained Events-style memory pack. The latest physical Sony result, not green CI alone, controls provider acceptance.

## Baseline and implementation

- Built-in manually implemented broadcaster groups: ABS, TTT, Novus (3 profiles), CGTV, Caribbean Hot TV, CaribVision, CBC, CVM, Island TV (2 channels), CBN Virgin Islands, CNC3, CVC9, GBN, Compass, DBS; preserve YouTube and Facebook manual subsystems.
- Pending dependency chain #16 (13 provider candidates) → #17 (19 known family official routes) → #18 (17 unresolved passive probes) → #19 (ZNS exact provider). **All drafts/unmerged**. Historical PRs #1–#5 also open. Each PR head/CI in continuation.
- Latest #19 exact head `a8166a873b291c1d404aecf9292edaee45879b7f` PASS CI run `40431408983`, awaiting hardware test.
- Latest #18 exact head `ad99f07e639155ee3a2efed51d50c3a2ab0125af` FAIL 1 fixture test at run `40428743333`, despite earlier build `a5bb2ccc` 319/319 success; test flake vs deterministic cause unresolved.
- Current installed Sony build 5 from #18 earlier `a5bb2ccc...`, not #19; no remote APK install performed by assistant.

## Active truth table

| Provider | Observed | Status |
|---|---|---|
| Telemicro 5 | audio/picture/player/remote working in latest test | PROVISIONAL WORKING |
| CBC TV8 | official broadcaster source down; native HLS buffering | UPSTREAM OFFLINE |
| Bonce TV | good layout, broadcaster stream down | SOURCE OFFLINE / A/V PENDING |
| Balchi TV | HLS HTTP 404 | SOURCE OFFLINE |
| Telesistema 11 | user gesture needed for player load; HD+audio afterward; latest official site intermittent | UPSTREAM UNSTABLE / NO-TOUCH PENDING |
| ZNS Bahamas | manual browser playback and 1920×1080 fullscreen/Back; 522.522s finite media; candidate #19 built | PROVISIONAL MANUAL PLAY / TRUE LIVE UNCONFIRMED |
| MTV Guyana | user observed current live 1080p fullscreen smooth; prior preview.mp4 only in older log; newest log lacks application events | USER-OBSERVED LIVE 1080P / LOG VERIFICATION PENDING |
| HGPTV Guyana | Dacast iframe on homepage and /watch-live; autoplay requested 0; invalid challenge-labelled popup failed; no playback | PLAYER DETECTED / SECURITY-SITE BLOCK / A/V PENDING |

## Durable operational rules

- Bravia `armeabi-v7a` only; acceptance APK ~149 MB. Storage: uninstall old app first, `pm trim-caches 1G`, install/launch; **verify artifact provenance** before destructive uninstall. On-device acceptance is separate from CI; keep build 5 installed until appropriate gated test.
- Official-provider/browser page truth; no invented HLS sources, forced quality downgrade or security-challenge bypass. Exact-route permissions and provider authority.
- Real `GvLogger` tags are `KfMkIIGV:*`, not bare `GvMedia`. Full private logcat is necessary. Archived public Git documents should contain summaries only.
- The actual Kulcha Flo HGPTV visitor "Official Link" on 27 Oct opened `https://www.hgptv.com/watch-live/`, whereas #18 probe registry used `https://www.hgptv.com/`. Reconcile this route.

## Priority work

Check latest GitHub, repair #18 test gate, verify HGPTV route, physically accept ZNS, confirm MTV source and 1080p app events, then resume evidence-based provider-specific helper batching. Review stale draft PRs instead of accumulating indefinitely; do not merge/close them on guesswork.
