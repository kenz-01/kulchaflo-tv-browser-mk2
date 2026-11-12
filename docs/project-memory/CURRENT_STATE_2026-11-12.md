# Kulcha Flo TV current state — 12 November 2026

> **Owner conversation video recovery, 12 Nov evening:** The linked Events [screen-recording decision recovery](https://github.com/kenz-01/kulchaflo-events-engine/blob/docs/handover-20261109-multirepo-architect-codex/docs/project-memory/archive/2026-11-12_Screen_Recording_Decision_Recovery.md) shows the owner explicitly approved only ONE historic manual ZNS emulator test under the £0 boundary (already represented by run #43088339285). This is not rolling authority for new dispatch. It also confirms TVJ's **iCanLive** and **1SpotMedia** should be preserved as distinct viewing destinations: the owner confirmed iCanLive worked via its external viewing destination, while 1SpotMedia remained untested. External website playback must not be misrepresented as GeckoView/Android TV app playback. Keep WATCH LIVE TV (legitimate destinations) distinct from LIVE NOW (verified current programming). Video is partial; use GitHub/source/runtime for fresh proof.


**Start here after the 9 Nov handover.** This dated state corrects stale PR #23/#25 merge instructions. Exact GitHub, accepted source and physical Sony Bravia observations remain higher authority than prose. The Events counterpart is `kenz-01/kulchaflo-events-engine/docs/project-memory/CURRENT_STATE_2026-11-12.md` on its handover draft branch.

## Three independent engineering lanes

One ChatGPT architect coordinates Carnival Codex, Channel Codex and **TV Codex** via the existing hourly heartbeat. TV owns only `kenz-01/kulchaflo-tv-browser-mk2`, GeckoView `app-gv`, existing player lab and source-scoped helper tests. No second scheduler, shared Events CI/credentials, paid runner or arbitrary provider/DRM workaround.

## Github source truth, checked 12 Nov ~03:40 UTC

- TV main `1a351a96fbce00f3c61bc8f26652119067919223`.
- PR **#23** neutral manual Android TV API36 x86_64 emulator framework **MERGED 10 Nov 19:50 UTC**; **#25** source-scoped ZNS diagnostic and Bash dispatcher **MERGED 10 Nov 23:53 UTC**. They are not awaiting their first merge. Their merge does not establish real playback.
- PR **#26** `bc2b84d0d9d9f6ec0415bf1119be8b7d42fe6762` **DRAFT**: only Android API36 window-focus diagnostics. When `mCurrentFocus` is unavailable, accept only one unambiguous InputDispatcher `FocusedWindows` display-0 app window; malformed/truncated/conflicting signals fail closed. Reported 35/35 focused fixtures, 331/331 Player Lab; deterministic CI #43139767573 SUCCESS. Fixture and CI pass do not establish new emulator or playback evidence. Architect PR comment #6813721081.
- PR **#22** manual accepted-helper locks still draft; provider family candidate PRs **#16–#19** remain held/independent. Preserve original 15 accepted helper families.

## Actual one-run evidence

Owner-authorised manual ZNS emulator run **#43088339285** on TV main: public standard GitHub runner, KVM/API36 boot/APK assembly, installation, app launch and foreground checks reached. Combined boot/test step failed on missing window-focus marker `entry_missing`; do not call it publisher playback failure. Artifact **#13887842891** recovered; two screenshots were visually the same dark grey loading/player-symbol view, not video progression. D-pad, Back and media-time progression steps did not produce accepted test observations. No confirmed picture motion, sound, fullscreen, remote navigation, DRM/codec behaviour or physical Sony Bravia acceptance.

## Next bounded task

Independently source-review #26 against its exact head and protected CI. Leave draft until normal review/owner gate; then integrate the diagnostic and dispatch **at most one authorised** manually selected ZNS test on the standard, free `ubuntu-latest` workflow, never paid larger runner or uncontrolled repeat. Recover sanitised receipt, screenshots, focus source, process and window/app state. If focus passes, observe ZNS real page/player and video time movement; if not, classify infrastructure/inconclusive without editing playback helpers. Only target proven source-specific issues. No automatic video.play(), mute/volume changes, bypass, LIVE release or physical Bravia install without separate consent.

Historical 9 Nov docs, which label #23 and #25 draft, describe a past state only. No TV PR merge, emulator dispatch, release or paid resource was initiated in writing this handover.
