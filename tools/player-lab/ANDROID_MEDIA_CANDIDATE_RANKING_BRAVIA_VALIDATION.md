# Android media-candidate ranking: Sony Bravia validation

## Validation identity

- Branch: `player-helper-media-candidate-ranking-bravia-validation-phase1`
- Tested commit: `60a48381da97edb64f582fc95745f5225068e5b7`
- Baseline tag: `player-lab-checkpoint4j-b1-2026-07-27`
- APK SHA-256:
  `60e64f879d222bfde80a1d50a0a7ee201969421affba9d6e7b287d52f7bad2c6`
- Packaged `content.js` SHA-256:
  `244dc495f560941c816b9acb651621c59cd5026535467fd8b7dda2de62d4555b`
- Packaged `candidate-ranking.js` SHA-256:
  `f427a88b0c20d56e9ce850b91b54c35590c800cf5447156e313e19428877f9eb`
- APK signature: verified with APK Signature Scheme v2 and the established
  Android debug signer.

The sole connected target identified itself as a Sony BRAVIA 4K VH2 running
Android 12 at SDK level 31. Device serial and network address are intentionally
omitted.

## Installation

The existing Kulcha Flo installation was version 1.0, version code 1, and was
running before replacement. The first in-place installation attempt failed
with `INSTALL_FAILED_INSUFFICIENT_STORAGE`; 270 MB was available.

After explicit user approval, only the package-manager cache trim was run.
Available storage increased to 646 MB, the existing Kulcha Flo package remained
installed, and the single in-place retry succeeded. The app was then
force-stopped, launched cleanly, and confirmed as the resumed foreground
activity. Kulcha Flo was not uninstalled and its data was not cleared.

## MTM validation

### Attempt 1

- Three candidates were collected.
- Settlement completed with `retain-web-player`.
- Reasons included `decorative-direct-candidate-suppressed` and
  `same-frame-managed-player-present`.
- The decorative banner did not enter native playback.
- GeckoView remained visible.
- D-pad wake and Back worked.
- Stream playback was not attempted, so playback usability was not established
  by this attempt alone.

### Attempt 2

- The same three-candidate settlement and web-player retention occurred.
- The genuine Bradmax player was deliberately started.
- Video and audio worked normally.
- Bradmax web fullscreen worked.
- No banner takeover, native Media3 start, switching loop, crash, or ANR was
  observed.

### Attempt 3

- The banner's own play button was visible but was intentionally not selected.
- The user navigated to the genuine stream player and started it.
- Video, audio, and web fullscreen worked.
- One Back press returned from fullscreen to the web page.
- Two further Back presses exited normally.
- No stale native player, banner replay, repeated reset, crash, or ANR was
  observed.
- The bounded trace again recorded
  `decorative-direct-candidate-suppressed`,
  `same-frame-managed-player-present`, and later
  `visible-managed-player-without-direct-candidate`.

MTM therefore passed the ranking, managed-player retention, repeatability,
page lifecycle, D-pad, fullscreen, and Back checks across three entries.

## CVM regression

CVM playback, fullscreen, transport auto-hide, D-pad transport wake, and
navigation were physically reported as working perfectly. Bounded helper
diagnostics recorded transport installation, hiding, pointer-movement wake,
and interaction-idle hiding. No generic native promotion, crash, or ANR was
observed.

## Direct-media regression

CBC TV8 Barbados was selected from repository evidence, not its name. The
established CBC stability handover and prior Sony trace identify it as an
exact-HLS Media3 native-promotion path with an already-active guard, native
keep-alive, and Back behavior.

Physical results:

- Native Media3 promotion started correctly.
- Playback and fullscreen worked.
- Back exited the promoted player and restored the browser page.
- After a delay, the stream promoted again and re-entered fullscreen.

The bounded lifecycle trace confirmed:

1. Media3 backend creation, preparation, and playback start;
2. promoted-media exit with reason `back-pressed`;
3. a second Media3 backend creation, preparation, and playback start.

This fails the required duplicate/lifecycle regression. The desired behavior is
for Back to leave the provider flow and return to Kulcha Flo without a delayed
re-promotion.

## Privacy and limitations

Only bounded candidate decisions, reason codes, helper phases, Media3 lifecycle
states, crashes, and ANRs were reviewed. This document contains no device
serial, network address, raw provider or media URL, playlist path, query
string, cookie, token, credential, personal data, screenshot, or unfiltered
logcat.

No crash or ANR was observed. The unresolved issue is the CBC delayed
re-promotion after Back. It requires a separate B2-fix checkpoint focused on
native-promotion suppression and navigation semantics. No ranking threshold,
provider exclusion, Android source, or policy was changed during validation.

## Supplementary post-fix validation

MTV Guyana is reported to be online again and is queued as an additional
physical regression target only after the CBC Back/re-promotion fix passes.
CBC TV8 remains the required direct-media lifecycle test.

The MTV test must begin by observing bounded candidate decisions without
assuming a player family or route. It must establish whether the stream uses a
managed web player, a promotable direct source, or another existing helper
route. Physical validation must then cover live playback and audio, fullscreen,
candidate correctness, Back behavior, delayed re-promotion, and stale
fullscreen or native-player state.

MTV was not visited during this failed B2 checkpoint because its prerequisite
CBC fix has not yet occurred.

## Overall result

`regression-failure`

MTM passed repeatedly and CVM remained correct, but the established
direct-media provider failed the required Back/duplicate-promotion lifecycle
regression.
