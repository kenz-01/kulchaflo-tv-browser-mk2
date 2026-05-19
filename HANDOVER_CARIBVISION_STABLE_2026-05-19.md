# CaribVision Stable Checkpoint - 2026-05-19

## Current Repo State
- Branch: `main`
- Working tree at checkpoint creation: clean before adding this handover file
- Active module for acceptance: `app-gv`
- Acceptance build target: `./gradlew :app-gv:assembleBraviaRelease --console=plain`
- Bravia target package/activity: `com.kulchaflo.tv.mk2.gv` / `.app.GeckoBrowserActivity`

## Latest Relevant Commits
- `f207d0c` Complete CaribVision observer and fallback support
- `9e1ff1d` Stabilise CaribVision exact-HLS playback
- `76b178e` Add CGTV and Novus stable handover
- `9df0d87` Remove unused CGTV helper asset
- `631f25b` Complete CGTV native play-assist integration

## CaribVision Accepted Behavior
CaribVision is now accepted as stable on Bravia:
- Browser-first login/register is preserved (no login automation).
- Native promotion is allowed only for the exact official CaribVision live HLS.
- Repeated evidence for the same exact HLS no longer re-triggers `play()` when already active.
- Native keep-alive prevents false teardown from transient page eligibility loss.
- Back behavior remains clean.
- Fallback-to-browser path remains available on native failure.

## Exact HLS URL (Only Native-Promoted Target)
- `https://5dcabf026b188.streamlock.net/CaribVision/livestream/playlist.m3u8`

## Success Log Markers
Observed in `caribvision_perfect_run.log` during stable validation:
- `caribvision native promote allowed exact-hls sourceUrl=https://5dcabf026b188.streamlock.net/CaribVision/livestream/playlist.m3u8`
- `caribvision native promote skipped reason=already-active sourceUrl=https://5dcabf026b188.streamlock.net/CaribVision/livestream/playlist.m3u8`
- `caribvision native keep-alive reason=page-not-eligible currentUrl=https://app.caribvision.tv/dashboard sourceUrl=https://5dcabf026b188.streamlock.net/CaribVision/livestream/playlist.m3u8`
- `player started url=https://5dcabf026b188.streamlock.net/CaribVision/livestream/playlist.m3u8`
- No `promoted media exited reason=page-not-eligible` during the accepted pass.

## Test Note
- Repeated manual device tests were already completed through login/dashboard/native-play/Back cycles.

## Guardrail
- Do not continue tuning CaribVision unless a concrete regression appears.

## Related Stability Note
- Novus and CGTV are also stable from previous commits/checkpoints.
