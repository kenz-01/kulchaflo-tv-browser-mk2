# KulchaFlo TV Browser MK2 Restart Context

## Current Project State
- Active module: `app-gv`
- Acceptance build: `./gradlew :app-gv:assembleBraviaRelease --console=plain`
- Target package: `com.kulchaflo.tv.mk2.gv`
- Main activity: `com.kulchaflo.tv.mk2.gv/.app.GeckoBrowserActivity`
- Bravia test target: `192.168.0.16:5555`
- Treat Bravia release behavior as canonical. Emulator/debug checks are secondary.

## Important Handover
- Full handover: `HANDOVER_CHATGPT_BRAINSTORMING_2026-04-12.md`
- Current unresolved surface: Facebook video/consent/transport behavior.
- YouTube was reported acceptable after later iteration. Do not reopen YouTube unless a new regression is reported.
- Current GeckoView build uses global visual scale constants in `app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt`.
- Gecko runtime fallback lives in `app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GvApplication.kt`.

## TV Test Discipline
- Uninstall before install:
  `adb -s 192.168.0.16:5555 uninstall com.kulchaflo.tv.mk2.gv`
- Install Bravia release:
  `adb -s 192.168.0.16:5555 install -r app-gv/build/outputs/apk/bravia/release/app-gv-bravia-release.apk`
- Launch:
  `adb -s 192.168.0.16:5555 shell am start -n com.kulchaflo.tv.mk2.gv/.app.GeckoBrowserActivity`
- Pull logcat after reproductions and clear it afterwards.

## Facebook Repro Notes
- Coordinate replay from the KulchaFlo search page is brittle; the same tap path can hit the wrong search card after a fresh install.
- The Bravia release now supports an explicit test URL extra:
  `adb -s 192.168.0.16:5555 shell am start -n com.kulchaflo.tv.mk2.gv/.app.GeckoBrowserActivity -e url 'https://example.com'`
- Exact Facebook URL used in the latest tests:
  `https://www.facebook.com/dubsteady/videos/studio-17-the-lost-reggae-tapes-part-1/427958844570838?utm_source=KulchaFlo`
- Latest observed unresolved site-driven failure: Facebook starts video behind a high-opacity white cookie/consent overlay, then the cookie card can appear after roughly 15 seconds and scroll to its lower action area.
- Latest capture, 2026-04-27 05:14 Bravia time: page loaded into a full-page white visual veil with no visible consent dialog. Screenshot: `/tmp/kf_fb_overlay_no_consent.png`. Logcat: `/tmp/kf_fb_overlay_no_consent.log`.
- In that capture the Facebook compat script ran repeatedly, but reported `cookieClicked=false`, `resolved=false`, `blockingOverlayHidden=false`, `dimRestored=false`, `overlays=none`, and `candidates=` while the screenshot showed the page visibly washed out. This points at a visual/loading layer that the current DOM overlay detector is not classifying.
- The same log had no `Script terminated by timeout` entries. It did include `GeckoViewPrompter.sys.mjs` `uncaught exception: undefined` after compat prompts, and Facebook-scoped content permissions were allowed at 05:13:28.
- A broad white-veil cleanup attempt caused Gecko script timeouts; it has been removed from the live sweep. The current approach is to click Facebook's cookie CTA by visible point/text instead.
- Direct Facebook launch did not reproduce the same cookie-card overlay in the last run; it landed on a dark Facebook text state. Continue validating through both direct launch and the real KulchaFlo Watch flow.

## Git Usage
- This repository was initialized so future sessions can recover context with `git log`, `git status`, and this file.
- Keep generated directories, local SDK config, APK outputs, and large reference archives out of Git.
- Commit coherent checkpoints after meaningful fixes or test-confirmed state changes.
