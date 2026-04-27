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
- Current validated surfaces: targeted Facebook video launch and YouTube watch launch on Bravia release.
- Do not reopen either surface unless a new regression is reported; keep fixes narrow and site-scoped.
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
- Working checkpoint, 2026-04-27 05:30 Bravia time: disabling Gecko's native cookie-banner auto handler removed the full-page white veil. The simple Facebook helper clicked cookie consent, dismissed the login prompt, hid the bottom login rail, and woke/clicked the real Facebook video player. Screenshot: `/tmp/kf_fb_video_wake.png`. Logcat: `/tmp/kf_fb_video_wake.log`.
- The successful log includes `cookieClicked=true`, `loginDismissed=true`, `bottomLoginBarHidden=true`, `videoCount=1`, `playButtonClicked=true`, followed by `browser media session activated`, `browser media play`, and fullscreen source `blob:https://www.facebook.com/...` at 1920x1080.
- A broad white-veil cleanup attempt caused Gecko script timeouts; it is no longer used. The current working approach is native-cookie-banner automation disabled plus a narrow Facebook helper for cookie CTA, login rail, and video wake.
- Direct Facebook launch now produced the working result above. Continue validating through the real KulchaFlo Watch flow as the remaining confirmation.

## YouTube Repro Notes
- Reported issue, 2026-04-27: YouTube watch URL could get stuck behind Google's "Before you continue to YouTube" consent dialog. Manual scroll moved the background page instead of reliably scrolling the dialog.
- Current fix in `GeckoBrowserActivity.kt`: YouTube/Google surfaces are granted storage, persistent storage, and autoplay permissions through the Gecko content permission delegate.
- A YouTube consent helper now runs on location change, page stop, and delayed follow-ups. It detects the Google/YouTube consent text, scrolls consent-like containers to the button row, and attempts the visible `Accept all`/`Reject all`/`I agree` action.
- The consent helper reports visible action coordinates back to Kotlin. Kotlin can send a real GeckoView mouse tap at those coordinates as a native fallback when DOM click handling is unreliable on TV.
- Verification, 2026-04-27 17:31 London time: installed Bravia release, launched `https://www.youtube.com/watch?v=FddO86Zk1lo?utm_source=KulchaFlo`, and captured `/tmp/kf_youtube_native_tap.png`. The watch page loaded with video visible and logcat showed `browser media play` plus metadata `Bob Marley: One Love`.

## Git Usage
- This repository was initialized so future sessions can recover context with `git log`, `git status`, and this file.
- Keep generated directories, local SDK config, APK outputs, and large reference archives out of Git.
- Commit coherent checkpoints after meaningful fixes or test-confirmed state changes.
