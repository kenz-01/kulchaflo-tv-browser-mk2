# KulchaFlo TV Browser MK2 - Full Handover (for ChatGPT Brainstorming)

## Project and Environment
- Project path: `/Users/kenz/Documents/backup-kulchaflo.com-3-14-2026 Working/public_html/kulchaflo-tv-browser-mk2`
- Primary module under active work: `app-gv` (GeckoView build)
- Main package: `com.kulchaflo.tv.mk2.gv`
- Primary TV test target over ADB: `192.168.0.16:5555` (Sony Bravia)
- Emulator also used earlier, but user repeatedly prioritised TV truth.

## Build Flavors Worked On and Why
- `app-gv:assembleBraviaRelease`:
  - This is the primary truth build for this effort.
  - Chosen because user confirmed Sony/Bravia behavior is the acceptance target.
  - Used for all final TV installs and consent/zoom validation loops.
- `app-gv` debug/compile tasks (spot checks only):
  - Used intermittently for fast compile confidence during iteration.
  - Not used as final acceptance build for TV behavior.
- Emulator path:
  - Used earlier only for quick checks.
  - Explicitly deprioritized once user requested parity with Bravia truth.

## TV ADB Testing Details (Operational)
- Preferred target serial: `192.168.0.16:5555`
- Typical reconnect command:
  - `adb connect 192.168.0.16:5555`
- Device verification:
  - `adb devices`
  - Expectation: `192.168.0.16:5555    device`
- Install discipline used in this chat:
  - Uninstall first each time:
    - `adb -s 192.168.0.16:5555 uninstall com.kulchaflo.tv.mk2.gv`
  - Reinstall current Bravia release:
    - `adb -s 192.168.0.16:5555 install -r app-gv/build/outputs/apk/bravia/release/app-gv-bravia-release.apk`
  - Launch:
    - `adb -s 192.168.0.16:5555 shell am start -n com.kulchaflo.tv.mk2.gv/.app.GeckoBrowserActivity`
- Log discipline used:
  - Pull: `adb -s 192.168.0.16:5555 logcat -d -v time -t <N>`
  - Clear immediately after: `adb -s 192.168.0.16:5555 logcat -c`

## User Constraints and Working Rules (explicitly requested)
- Bravia build is truth; emulator must match flavor/behavior.
- Always uninstall before install on TV.
- Pull logcat frequently.
- Clear logcat after reads to avoid accumulation.
- Keep APK small enough for TV storage (historical constraint from earlier in session).
- Navigation layer should wake on movement, not only center press.
- Pointer should auto-hide after a few seconds idle and wake on movement.
- YouTube/Facebook consent/cookie prompts should be handled automatically when possible.
- General site zoom should be smaller (user gave target scale 0.78 at one point), while avoiding ugly side strips and without repeated zoom-pop if possible.

## Big Picture Objective
Build a robust TV web app runtime where:
- KulchaFlo home UX remains visually correct on TV.
- External video sites (YouTube/Facebook/Vimeo) open and return reliably.
- Consent/cookie walls do not trap the user.
- Remote and pointer interactions remain predictable.

## Major Decisions Made During This Chat (chronological themes)
1. **Bravia flavor parity**
- Decision: Align emulator behavior with Bravia flavor; treat Bravia runtime as canonical.

2. **Install/test discipline**
- Decision: Uninstall before each install as requested.
- Decision: Use repeated tight loops of `install -> launch -> reproduce -> logcat pull -> clear`.

3. **Transport/navigation behavior**
- Decision: Improve transport wake/interaction behavior and pointer wake.
- Decision: Keep pointer auto-hide behavior active after idle timeout.

4. **Consent handling strategy**
- Decision: Move away from site-specific one-offs where possible, toward a unified consent compatibility script injected into pages.
- Decision: Consent detection should include both keyword surfaces and known consent hosts (especially YouTube consent hosts).
- Decision: Add fallback strategy when no consent button is found: context fallback, submit fallback, then redirect fallback.

5. **Zoom strategy**
- Decision: Tried per-page visual scaling and multiple tuning iterations (including side-strip tuning and hero text sizing).
- Decision: Tried engine-level constant zoom approach to avoid visible pop on page load.
- Reality: Engine-level config path caused release instability on TV (see runtime crash below), so visual scaling reverted to script-level compatibility at points.

6. **Runtime crash recovery**
- Decision: Harden Gecko runtime init path after seeing startup crash tied to config file + second runtime create.
- Decision: In release, avoid risky config-file path and prevent double-create crash pattern.

7. **Sony behavior comparison**
- Decision: Keep UA/desktop viewport strategy and unified system approach rather than hardcoding many site-specific custom routines.

## What Was Implemented (high-level)
### A) Runtime stability fix (critical)
File: `app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GvApplication.kt`
- Added safer fallback logic for Gecko runtime creation.
- Handled case where first runtime attempt partially initializes singleton and second attempt would crash with:
  - `Only one GeckoRuntime instance is allowed`
- Latest launch tests after this fix no longer show that fatal at startup.

### B) Unified consent + visual compatibility script
File: `app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt`
- Injected/maintained unified compatibility script with:
  - consent surface detection,
  - allow/deny label probing,
  - context fallback,
  - submit fallback,
  - stuck redirect fallback,
  - periodic poke/mutation/interaction sweeps,
  - logging payloads to app log (`compat-policy`).

### C) YouTube consent host logic
- Added consent host checks including `consent.youtube.com` and consent-google hosts.
- Added redirect fallback reading common URL params (`continue`, `redirect`, `next`, etc.).

### D) Transport and pointer behavior (iterative)
- Pointer wake/hide behavior tuned.
- Navigation wake expectations discussed and iteratively patched.

### E) Zoom and hero sizing (iterative)
- Scale target repeatedly tuned around user preference.
- Hero text container width adjusted to prevent too-wide or too-small states.

## Most Recent Changes (current head of work)
### 1) Consent redirect hardening to avoid Google sign-in trap
File: `GeckoBrowserActivity.kt` (inside unified compat JS)
- `readRedirectTarget()` now:
  - maps relative consent redirects to `https://www.youtube.com` when on consent host,
  - rejects non-http(s),
  - rejects `consent.youtube.com` targets,
  - when on consent host, allows redirect only to YouTube hosts (`youtube.com`, `www`, `m`, subdomains, `youtu.be`),
  - rejects likely sign-in/account paths (`/signin`, `/accounts`).

Intent: stop fallback redirect from sending user to Google sign-in instead of returning to YouTube content.

### 2) Visual zoom restored in compat layer (after user reported zoom disappeared)
File: `GeckoBrowserActivity.kt`
- Re-enabled scaling in `applyGlobalScale()` using transform-based scaling:
  - `scale` uses configured page scale,
  - body width compensation re-applied,
  - min-height adjusted to preserve scroll.
- Width compensation changed from `1.06` to `1.14` to reduce excessive side strips while keeping smaller visual scale.
- Current constants:
  - `GLOBAL_SITE_SCALE = 0.76`
  - `GLOBAL_WIDTH_COMPENSATION = 1.14`

### 3) Additional consent action filtering and host behavior
File: `GeckoBrowserActivity.kt`
- Added login-action guard so compat clicker skips buttons/controls that are likely auth actions:
  - examples filtered: `sign in`, `log in`, `create account`, `google account`.
- On consent hosts, consent policy now prefers deny/reject options first, then allow options.
- Added stronger deny label coverage (`reject all`, `continue without accepting`, `do not accept`).

### 4) Zoom fill-screen correction for right-strip/gap issue
File: `GeckoBrowserActivity.kt`
- Reworked scale layout math so zoom-out still fills horizontally:
  - width auto-expanded to at least `1 / scale`,
  - offset auto-centered from computed scaled width.
- Intent: avoid “content shifted left with right-side strip” while keeping smaller global zoom.

### 5) YouTube render fix for compat-loop spam
File: `GeckoBrowserActivity.kt`
- Reduced compat prompt spam that was firing continuously on YouTube mutation-heavy pages:
  - suppresses low-signal mutation reports (`clicked=false`, no redirect, no-candidate=0),
  - adds report throttling to avoid repeated prompt floods,
  - observer changed from `{attributes:true}` to child-list/subtree only.
- Intent: stop mutation-driven prompt storm from interfering with YouTube page rendering.

### 6) Consent auto-accept behavior (explicit)
File: `GeckoBrowserActivity.kt`
- Consent policy set to prioritize allow/accept flow again for automatic acceptance.
- Added login-action guard so auto-click does not choose auth buttons.
- Keep deny as fallback only when allow labels are unavailable.

### 7) Facebook fullscreen deeplink interception (transport control fix path)
File: `GeckoBrowserActivity.kt` (`NavigationDelegate.onLoadRequest`)
- Intercepts `fb://fullscreen_video/<id>` navigation requests.
- Blocks the deeplink and forces in-web fallback:
  - `https://www.facebook.com/watch/?v=<id>`
- Intent: avoid Facebook native fullscreen deeplink behavior that led to missing transport overlay / duplicate play UI and keep playback in the web player flow where app transport logic can attach.

## Current Deploy/Test Status (at handover moment)
- New Bravia release assembled successfully.
- Uninstall-first then reinstall completed successfully on TV.
- App launches successfully.
- Fresh post-install logcat confirms new script bundle active with:
  - `pageScale=0.78`
  - `widthCompensation=1.14`
  - updated redirect target filtering logic present.
- Logcat was cleared after pull per user preference.

## Latest Session Delta (after the section above)
- User confirmed: site size is now correct (“site size is now perfect”).
- New patch for YouTube non-render issue was implemented and built successfully (`assembleBraviaRelease`).
- Build includes mutation-spam suppression + auto-accept priority updates.
- User later confirmed that, across the following two weeks of work, YouTube was brought into a good/acceptable state.
- If needed for the next operator: treat YouTube as broadly solved unless a new regression is reported.
- Additional latest fix after that:
  - User reported Facebook manual consent and missing transport controls.
  - Logcat showed `fb://fullscreen_video/...` requests during Facebook playback flow.
  - Added deeplink block + watch URL fallback to keep Facebook video path in-web.
- Latest live-channel fix:
  - User reported CBCTV8 / CaribVision / ABS live pages were being reshaped by the broad unified compat layer and could auto-enter fullscreen.
  - Added a live-media surface guard so the unified compat script is skipped on live player pages such as CBC, CaribVision, ABS/Tego, and `player.tegotv.com`.
  - Added a short direct-media promotion suppression window after back so promoted live streams do not immediately reopen.
  - Added a fullscreen guard so live-media pages keep the system bars visible instead of taking over the viewport.
- Latest follow-up:
  - CBCTV8 still triggered duplicate playback because the app was still promoting live media from the page itself.
  - Added a live-media promotion guard so direct-media extraction and promotion are skipped on those surfaces entirely, leaving the page player in control.
- Latest startup recovery note:
  - User later reported a black screen on app launch.
  - The likely cause was the loading overlay being hidden too early during tab activation before Gecko had painted.
  - Kept the loading overlay visible through tab restore and launch so first paint can arrive before the app reveals the web view.
- Latest CaribVision note:
  - Logcat showed CaribVision on `app.caribvision.tv` still getting unified compat injection on `pointermove` and `native-poke`.
  - The live-surface matcher only blocked the bare apex host, so the subdomain was slipping through.
  - Expanded the live-surface host check to include CaribVision subdomains so the cursor and page layout stay under the site's own control.
- Latest CBCTV8 navigation note:
  - Logcat showed the CBCTV8 page on `kulchaflo.com/channels/...` still getting unified compat injection on `pointermove` and `native-poke`.
  - That meant the channel landing page itself was not being treated as a live-media surface.
  - Added the KulchaFlo `/channels/` path to the live-surface guard so those channel pages keep their own navigation behavior.
- Latest compat policy note:
  - User preference is now native-first, with compat reserved only for proven problem sites.
  - Unified compat now runs only on the KulchaFlo homepage consent surface and stays off for normal pages, channel pages, and pointer wake unless another site is intentionally added later.
- Latest Facebook attachment note:
  - Consent and login cleanup were working, but the video still did not attach.
  - The simple Facebook helper now gives the visible video surface a center-point tap fallback after it sees the player, so it can attach without broadening the rest of the media pipeline.
  - Added one delayed retry on the same visible video surface so intermittent late attachment can still recover without changing the broader flow.
- Current operator guidance:
  - The unresolved area is Facebook, not YouTube.
  - Prior work on Facebook became a loop of mitigations rather than a clean root-cause fix.
  - Facebook behavior should be approached as a structural compatibility problem spanning consent, login interstitials, transport attachment, host normalization, and deeplink/native escapes.

## Known Regressions/Flaky Areas Across Session
1. Facebook pages remain the primary unresolved surface.
2. Facebook issues have spanned cookie consent, logged-out/login overlays, mobile/desktop host drift, native/deeplink escapes, and missing or duplicate transport controls during playback.
3. Redirect fallback for YouTube previously over-redirected into sign-in; this was later restricted to YouTube hosts and is no longer the main active problem.
4. Visual scale and side strips trade off against hero sizing; user preference moved over time.
5. Mutation/pointer-driven compat sweeps can be noisy and may run often.

## What Is Working Better Now
- Startup crash (`Only one GeckoRuntime instance is allowed`) addressed.
- Latest build active on TV with restored smaller scale behavior path.
- Consent redirect logic now safer against non-YouTube destinations.
- User-reported outcome after subsequent iteration: YouTube is working fine.

## What Still Needs Validation By User (next live test)
1. Reproduce Facebook page/video flows on TV from a clean fresh launch.
2. Confirm whether cookie/login surfaces are still appearing and exactly which URL they appear on.
3. Confirm whether playback stays in-web after the `fb://fullscreen_video/...` interception.
4. Confirm whether transport controls attach correctly during Facebook video playback or whether duplicate/missing controls remain.
5. Confirm whether Facebook still drifts into mobile or logged-out dialog routes despite the normalization/reroute logic.
6. Confirm page scale still feels correct and the KulchaFlo home hero remains acceptable.

## Recommended Immediate Test Script (manual)
1. Launch app fresh on TV.
2. Open a Facebook page or video link from the site.
3. If a consent/login surface appears, note the exact visible text and resulting URL.
4. Start playback and observe whether the flow stays in web playback or tries to jump into a blocked/native path.
5. Test transport controls and note whether overlay/controls are missing, duplicated, or unresponsive.
6. Pull logcat immediately after reproduction and clear it afterward.
7. Note exact page URL where behavior fails (if any).

## Handy Commands Used Repeatedly
- Build:
  - `./gradlew :app-gv:assembleBraviaRelease --console=plain`
- Uninstall:
  - `adb -s 192.168.0.16:5555 uninstall com.kulchaflo.tv.mk2.gv`
- Install:
  - `adb -s 192.168.0.16:5555 install -r app-gv/build/outputs/apk/bravia/release/app-gv-bravia-release.apk`
- Launch:
  - `adb -s 192.168.0.16:5555 shell am start -n com.kulchaflo.tv.mk2.gv/.app.GeckoBrowserActivity`
- Pull logs:
  - `adb -s 192.168.0.16:5555 logcat -d -v time -t 300`
- Clear logs:
  - `adb -s 192.168.0.16:5555 logcat -c`

## Concise “Where We Are Now”
- Current build on TV includes:
  - startup crash fix,
  - consent redirect restrictions,
  - restored scale-out visual behavior (0.78 with width compensation 1.14).
- YouTube is considered working by the user after the later two-week iteration cycle.
- The next critical validation is Facebook-only: confirm whether the current mitigation stack actually makes Facebook page/video flows usable on Bravia, or whether a more fundamental strategy change is needed.
