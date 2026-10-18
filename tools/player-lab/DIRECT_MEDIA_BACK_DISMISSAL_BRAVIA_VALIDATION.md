# Direct-media Back dismissal — Sony Bravia validation

## Tested identity

- Branch: `player-helper-direct-media-back-suppression-bravia-validation-phase1`
- Commit: `efeb96d1a2a71257299ad687e92754adb9a268ee`
- Baseline tag: `player-lab-checkpoint4j-b2-fix1-2026-07-27`
- APK SHA-256: `09677a25bc2f8e2203372e5bd4635bf0daf81fa1b03fb1337edeeb43ac8e09ad`
- APK signature: verified with APK Signature Scheme v2
- Device: Sony BRAVIA 4K VH2, Android 12, API 31
- Packaged `content.js` SHA-256: `244dc495f560941c816b9acb651621c59cd5026535467fd8b7dda2de62d4555b`
- Packaged `candidate-ranking.js` SHA-256: `f427a88b0c20d56e9ce850b91b54c35590c800cf5447156e313e19428877f9eb`

No device serial or network address is recorded.

## Installation

The first in-place replacement attempt failed with `INSTALL_FAILED_INSUFFICIENT_STORAGE`. The existing Kulcha Flo package remained installed and its data was not cleared. A previously authorised bounded package-cache trim increased available application storage from 559 MB to 653 MB. One retry of the exact verified APK then succeeded. No uninstall was performed.

The installed package was confirmed and the normal GeckoBrowserActivity launched successfully.

## CBC attempt 1

CBC was opened through the normal Kulcha Flo route. Bounded diagnostics established:

- candidate settlement reached the exact live-HLS promotion path;
- native Media3 was initialized;
- the first native player instance failed with `ERROR_CODE_DECODER_INIT_FAILED`;
- the application exposed its browser fallback;
- candidate evidence then caused a second Media3 initialization;
- the physical result was reported as the wrong player type, although opening and exiting worked.

This does not satisfy the required clean CBC initial promotion/playback result.

### Back dismissal

Back while promotion was active produced:

- `suppress-user-dismissed-document`;
- `retain-browser-after-user-back`;
- `ignore-stale-promotion-evidence`;
- one Media3 release;
- history navigation away from the provider document;
- a new top-level document generation.

The physical observer confirmed that exiting worked. Bounded logs for more than 30 seconds after Back contained no second post-dismissal Media3 initialization or start. The delayed re-promotion defect therefore did not reproduce in this attempt.

## Tests stopped after failure

The checkpoint requires stopping without patching when a physical failure occurs. Because CBC displayed the wrong player type and logged a decoder-initialization failure:

- explicit CBC reopen was not performed;
- a second CBC Back attempt was not performed;
- MTM was not revisited;
- CVM was not revisited;
- MTV Guyana route classification and supplementary validation were not performed.

The previously validated MTM and CVM results are not reclassified by this incomplete run, but they cannot be claimed as fresh results for this checkpoint.

## Stability and privacy

No Kulcha Flo crash, fatal exception, or ANR was observed in the bounded validation window. Logs were reviewed through URL-redacted filters. This document contains no raw media URL, query string, token, cookie, credential, device serial, network address, or complete logcat.

## Overall result

`regression-failure`

The generic Back dismissal and 30-second delayed re-promotion suppression behaved correctly, but CBC did not retain the expected clean native playback route. A separate fix checkpoint should investigate the CBC Media3 decoder-initialization failure and the fallback/re-initialization sequence without weakening document dismissal or adding a provider-specific Back exception.
