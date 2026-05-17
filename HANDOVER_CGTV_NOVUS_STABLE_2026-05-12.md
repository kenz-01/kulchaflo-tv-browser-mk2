HANDOVER: CGTV + NOVUS Stable (2026-05-12)

This document captures the current stable repository state after the Novus Telearuba and CGTV fixes. It is intended as a concise handover for future development and on-device validation.

1) Current repo state
- branch: main
- remote origin: https://github.com/kenz-01/kulchaflo-tv-browser-mk2.git
- latest relevant commits (newest first):
  - 9df0d87 Remove unused CGTV helper asset
  - 631f25b Complete CGTV native play-assist integration
  - c2350d4 Stabilise CGTV browser-player startup
  - 2485651 Add Novus Telearuba shared-player channel support

2) Novus Telearuba fix summary
- Surface: shared player hosted at novus.telearuba.aw
- Kulcha Flo channel mappings implemented:
  - Telearuba channel 13
  - Nos Isla TV channel 23
  - Aruba.tv channel 49
- Uses `kf_channel` and `kf_return` URL params to drive selection and return behavior.
- Selects the correct Novus channel button in the shared player and handles autoplay vs user-action play-assist flows.
- Applies a player-first view where appropriate while preserving safe navigation and Back behavior.
- Back exits cleanly to the originating Kulcha Flo watch page using a safer new-tab return path.
- Confirmed working and committed in commit `2485651`.

3) CGTV fix summary
- KulchaFlo CGTV channel: https://kulchaflo.com/channels/caribbean-gospel-tv/
- External watch page: caribbeangospel.tv (watch pages under `/watch`)
- Player wrapper used by site: bradm.ax
- Problem addressed: a wrong high-opacity splash/animation MP4 and unreliable native HLS promotion caused playback failures on native Media3 (TLS/certificate issues). Gecko/browser playback worked reliably.
- Policy: CGTV is now browser-first. Native Media3 promotion is disabled for CGTV unless a clean native HLS path (and TLS cert issues) is resolved.
- content.js behavior:
  - Scroll-aligns the `bradm.ax` iframe into a full-screen-like browser view when on CGTV watch pages.
  - Stability-gated play-assist: waits until the iframe top is correctly aligned (final CSS top between 0–20px and stable within ~3px) before emitting an active tap payload.
  - Emits device-independent `xRatio`/`yRatio` (center ratios) so Kotlin can convert to native viewport coordinates reliably across devices.
  - Rejects obvious splash/animation MP4s from being treated as the real player source.
- Kotlin/runtime behavior (in `GeckoBrowserActivity.kt`):
  - Handles `cgtv-play-assist`, `cgtv-page-fullscreen-like`, and `cgtv-transport-lock` messages from the observer.
  - Performs ratio-based native tap conversion and dispatch via the existing native tap path.
  - Schedules a CGTV-scoped fallback release (timeout) to clear play-assist if page-side `playing=true` does not arrive in time.
  - Restores pointer overlay and releases any transport-lock markers when playback is detected or on fallback timeout.
  - Suppresses promoted native player promotion for wrong-layer/splash animation or unsupported native HLS paths, keeping the flow browser-first.
  - Preserves Back behavior and pointer/navigation after launch.
- Confirmed working by user testing and committed across `c2350d4` (content side) and `631f25b` (Kotlin/runtime side).
- Unused helper `content_cgtv_play_assist.js` was removed in `9df0d87` because the active observer is `content.js` (manifest.json only loads content.js).

4) Important files to review
- `app-gv/src/main/assets/gv_media_observer/content.js`  (the active media observer; contains CGTV play-assist and other observers)
- `app-gv/src/main/assets/gv_media_observer/manifest.json` (registers the observer: loads `content.js`)
- `app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt` (Kotlin runtime handlers for CGTV messages and play-assist integration)

5) Validation commands that passed locally
- `node --check app-gv/src/main/assets/gv_media_observer/content.js`
- `git diff --check`
- `./gradlew :app-gv:assembleBraviaRelease --console=plain`

6) Warnings / future notes
- Do not re-enable native Media3 promotion for CGTV until the TLS/certificate issue affecting HLS native playback is resolved. Native promotion was specifically disabled because Gecko/browser playback is reliable while native HLS fails.
- Do not split the CGTV observer logic into a separate helper file unless `manifest.json` is updated to load it (otherwise the helper will be unused). The helper `content_cgtv_play_assist.js` was deliberately removed to avoid confusion.
- CGTV should remain browser-first unless a cleaner native stream path is found and validated on target devices.
- Novus Telearuba support should remain scoped to `novus.telearuba.aw` and the known channel slugs; avoid broadening without targeted tests.
- ABS/TTT/CVM/Facebook/YouTube flows are sensitive; do not modify those flows unless directly testing regressions with device captures and logcat analysis.

If you need a short test checklist for device validation (adb commands and log lines to inspect), I can add that as an appendix in a follow-up.

End of handover.

