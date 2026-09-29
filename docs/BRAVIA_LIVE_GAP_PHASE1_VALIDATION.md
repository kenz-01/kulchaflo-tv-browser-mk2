# Bravia Live Gap Phase 1 Validation

## Purpose

Physical Sony Bravia validation for the first helper-gap batch. This is the final acceptance gate after Player Lab simulation and CI.

## Candidate branch

`player-helper-live-gap-batch-phase1`

Build command:

```bash
./gradlew :app-gv:assembleBraviaRelease --console=plain
```

APK:

`app-gv/build/outputs/apk/bravia/release/app-gv-bravia-release.apk`

## Desired live-channel behaviour

A passing channel should:

1. Enter the official live player without manual website navigation.
2. Start live playback automatically where the provider/browser permits it.
3. Produce audible sound without requiring a mute toggle.
4. Fill the TV viewport immediately using true fullscreen or a clean player-first full-viewport presentation.
5. Prefer 1080p when the provider exposes a 1080 rendition and the player/device can sustain it; do not destabilise playback to force unavailable quality.
6. Keep programme video as the only audible/visible player.
7. Allow transport controls to be revealed when needed without leaving persistent webpage chrome.
8. Exit cleanly with Back to the Kulcha Flo browsing flow; Back must not immediately restart or re-promote the stream.

## Phase 1 changed channels

| Channel | Family | Expected phase-1 behaviour |
| --- | --- | --- |
| Telemicro 5 | Radiant | one bounded start assist, audio on, 1080 target, fullscreen/player-first |
| Digital 15 | Radiant | one bounded start assist, audio on, 1080 target, fullscreen/player-first |
| Telecentro 13 | Radiant | one bounded start assist, audio on, 1080 target, fullscreen/player-first |
| SVG-TV | Cloudflare Stream | official Cloudflare iframe selected, background YouTube hidden, autoplay enabled, full viewport |
| Bizz TV | Streamhoster + Video.js | existing live playback retained, audio restored, full viewport |
| RHT TV | Infomaniak + Video.js | existing live playback retained, audio restored, full viewport |
| Madras FM TV | Infomaniak + Video.js | bounded play/unmute, full viewport |
| Fusion TV | Infomaniak + Video.js | bounded play/unmute, full viewport |
| Identité Télé Caraïbes | pro-fhi | main 1080-capable hybrid live widget selected, secondary playlist suppressed, bounded play/unmute, full viewport |
| WAPA TV | Flowplayer | one bounded start assist if needed, audio on, exact player full viewport |
| WIPR | Video.js | one bounded start assist if needed, audio on, exact player full viewport; do not invent 1080 above source quality |
| ZIZ TV | Hls.js/custom player | existing playback retained, audio restored, exact player full viewport |
| TV6 | Dailymotion | exact x8dgt live iframe isolated, autoplay permitted, browser player full viewport; no native promotion |

## Per-channel pass record

Record only failures or deviations. A clean pass needs no detailed log.

- Picture started automatically: PASS / FAIL
- Audio on: PASS / FAIL
- Fullscreen/player-first: PASS / FAIL
- Observed quality acceptable / 1080 where available: PASS / FAIL
- No duplicate/background audio: PASS / FAIL
- Remote transport usable: PASS / FAIL
- Back exits cleanly: PASS / FAIL

## Safety constraints

- No generic HLS/native promotion is introduced by this batch.
- Existing accepted ABS, TTT, Novus, CGTV, Caribbean Hot TV, CaribVision, CBC, CVM, Island TV/Island TV+, CBN, CNC3, CVC9, GBN, Compass and DBS helpers must remain unchanged in behaviour.
- A browser-player helper is preferred over native Media3 unless an exact provider stream has already been proven safe.
- Do not add repeated blind taps, broad synthetic centre taps, or ad-media promotion in response to a failed physical check.
