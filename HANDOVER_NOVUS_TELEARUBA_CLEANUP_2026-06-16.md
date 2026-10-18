# Novus / Telearuba-Family Cleanup Handover - 2026-06-16

## Project

- Workspace: `/Users/kenz/Documents/backup-kulchaflo.com-3-14-2026 Working/public_html/kulchaflo-tv-browser-mk2`
- Active module: `app-gv`
- Acceptance build: `./gradlew :app-gv:assembleBraviaRelease --console=plain`
- Target package: `com.kulchaflo.tv.mk2.gv`
- Main activity: `com.kulchaflo.tv.mk2.gv/.app.GeckoBrowserActivity`
- Bravia target: `192.168.0.16:5555`

## Current Dirty State

Do not reset. Do not commit unless explicitly approved.

Current uncommitted state:

```text
 M app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt
```

Current diff stat:

```text
GeckoBrowserActivity.kt | 149 +++++++++++++++------
1 file changed, 107 insertions(+), 42 deletions(-)
```

`app-gv/src/main/assets/gv_media_observer/content.js` is clean again after cleanup.

## What Was Cleaned Up

The failed Novus / Telearuba-family transport and layout experiments were removed:

- automatic Novus OK-wake pulse / tap logic
- synthetic transport wake tap
- copied DPAD / synthetic key transport pass-through
- pointer target bridge and DOM hit-test guard
- center click guard that blocked video/background clicks
- Novus input-event probe
- Novus layout snapshot diagnostics
- bottom margin / scroll offset layout nudges
- video focus / video state bridge that did not reveal transport
- related constants, maps, payload handlers, setup calls, and logs

The grep for failed experiment markers is now clean except for two unrelated generic browser-fullscreen reason strings:

```text
GeckoBrowserActivity.kt: wakeBrowserFullscreenPointer(reason = "ok-wake", ...)
GeckoBrowserActivity.kt: scheduleBrowserFullscreenPointerSleep(reason = "ok-wake")
```

Those are not Novus transport code and were left untouched.

## Preserved Novus Behavior

The remaining Kotlin patch keeps the proven/useful Novus baseline:

- Telearuba / Nos Isla TV / Aruba TV channel intent/profile handling
- Novus channel selection
- Novus playback/startup helper behavior
- Novus player-first/page cleanup once playback starts
- pointer sleep/wake eligibility for Novus
- Novus no-scroll behavior during pointer movement
- first Back exits straight to KulchaFlo
- Novus excluded from the `back-to-focus-mode` trap
- no `requestFullscreen`
- no native media promotion

Center/OK is no longer blocked by the failed guard and is back to the previous direct pointer click behavior.

## Validation Already Run

These commands passed after cleanup:

```bash
git diff --check
node --check app-gv/src/main/assets/gv_media_observer/content.js
./gradlew :app-gv:compileBraviaReleaseKotlin --console=plain
./gradlew :app-gv:assembleBraviaRelease --console=plain
```

Bravia release was deployed and launched against Aruba TV:

```bash
adb -s 192.168.0.16:5555 uninstall com.kulchaflo.tv.mk2.gv
adb -s 192.168.0.16:5555 install -r app-gv/build/outputs/apk/bravia/release/app-gv-bravia-release.apk
adb -s 192.168.0.16:5555 shell am start -n com.kulchaflo.tv.mk2.gv/.app.GeckoBrowserActivity -e url 'https://novus.telearuba.aw/?kf_channel=49&kf_return=https://kulchaflo.com/channels/aruba-tv-channel-49/'
```

Latest inspected logcat file:

```text
aruba_novus_cleanup_inspect_latest.log
```

## Latest Log Findings

Current Novus Aruba URL loaded with:

```text
https://novus.telearuba.aw/?kf_channel=49&kf_return=https://kulchaflo.com/channels/aruba-tv-channel-49/
```

Important log evidence:

- Channel selection worked:

```text
desiredChannel=49 clicked=true control=button.tv-tab.active
```

- Playback did start:

```text
state=playing mediaPresent=true playable=true paused=false readyState=4 size=1920x1080
```

- Player-first cleanup applied after playback:

```text
target=video#tvPlayer targetRect=0,0 1280x720
```

- Return URL captured:

```text
returnUrl=https://kulchaflo.com/channels/aruba-tv-channel-49/
```

- Earlier baseline run also showed Back exit:

```text
back consumed reason=exit-to-kulchaflo
```

No log evidence of:

- `center click skipped`
- `pointer target`
- `transport wake tap`
- `layout snapshot`
- `novus input event`
- `requestFullscreen`
- `FATAL EXCEPTION`
- `ANR`

## Important Context For Next Chat

The transport wake work is paused. Do not resume by adding another wake theory immediately.

Known failed approaches already tried and removed:

- native hover coordinates
- DOM mouse/pointer sweep helper
- DPAD fall-through to Gecko
- explicit `geckoView.dispatchKeyEvent` DPAD forwarding
- top-page DOM snapshot comparison
- video focus
- gated OK-wake pulse
- synthetic center/tap transport wake
- pointer target guard
- event-layer probe
- layout snapshot / scroll-height hacks

The transport wake problem remains unsolved, but the codebase has been cleaned back to a usable partial Novus baseline.

If transport work resumes later:

- Do not reintroduce the removed probes or OK-wake pulse without a clear new diagnosis.
- Do not block center/OK again.
- Do not change Back; Back currently exits to KulchaFlo correctly.
- Do not touch YouTube, Facebook, ABS, TTT, CGTV, CHTV, or CaribVision.
- Keep all future changes Novus/Telearuba-family scoped.

## Recommended First Steps In New Chat

Start with:

```bash
git status --short
git diff --stat
git diff --check
node --check app-gv/src/main/assets/gv_media_observer/content.js
./gradlew :app-gv:compileBraviaReleaseKotlin --console=plain
```

Then inspect only:

```bash
git diff -- app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt
```

Expected result: one dirty Kotlin file containing the preserved Novus Back/pointer/player-first cleanup baseline.

## Current Best Baseline Status

- Aruba TV channel selection: working in latest log
- Aruba TV playback: working in latest log
- Player-first alignment after playback: working in latest log
- Pointer sleep: logged working
- Back exit to KulchaFlo: logged working in baseline run
- Center/OK: no longer blocked by the failed guard
- Transport wake from DPAD movement: not fixed
- No commit has been made
