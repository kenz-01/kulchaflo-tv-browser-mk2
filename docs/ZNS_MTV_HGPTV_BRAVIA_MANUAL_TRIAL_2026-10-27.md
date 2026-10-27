# Bravia manual trial — ZNS, MTV Guyana, HGPTV

Evidence: privately supplied `manual-trials-20261027-005333.log.gz`. Keep private logs out of GitHub; this file records only non-sensitive diagnostic facts.

## ZNS Bahamas — bounded StreamcoMedia implementation candidate

At **00:45:18, 00:45:20, 00:45:26, 00:45:32, and 00:45:42** the installed read-only observer detected one visible iframe from `player.streamcomedia.com` on `https://znsbahamas.com/`, with no top-level video. The existing player in the iframe later produced `browser media play` at **00:47:10.913** following a series of manual D-pad / OK navigation events, and browser fullscreen at **00:47:27.928** with video width 1920, height 1080. Back dispatched fullscreen exit at **00:47:48.104** and the embedded video returned to browser mode. ZNS first-party audible and inaudible autoplay requests at **00:45:16** both retained default decision **0**.

**Important:** the browser media session reported finite duration **522.522 seconds**. This may be a programme clip or time-shifted stream and does **not** establish continuous live TV. Confirm that the content really is ZNS live broadcast before accepting.

This candidate `zns-streamcomedia-helper.js` reuses manual player-first patterns for an exactly matched official iframe, retains GeckoView/browser ownership, applies a single bounded `video.play()` + unmute attempt only within the trusted StreamcoMedia iframe **when referred by the official ZNS homepage**, and narrowly permits audible/inaudible Gecko autoplay in that page context. The browser's native fullscreen/Back remains in charge; no synthetic OK sequence, iframe rewrite, guessed stream, direct Media3 promotion or unrelated provider permission.

Acceptance: no-touch picture, sound, actual *live* ZNS output, full TV viewport, cursor timeout, remote controls and Back. Fail-closed for zero/multiple players and disallowed origins. The autoplay attempt may be rejected by player/browser policies, which is logged without injecting user gestures.

## MTV Guyana — no live-stream implementation yet

At **00:44:08.436**, fullscreen media metadata reported 1920×1080 video with source `https://stream.mtvgy.com/mtvguyana/preview.mp4` and duration **0.04 seconds**. The user traversed the player with numerous D-pad/OK events. This is **not proof of an operational live broadcast**. Do not native-promote or auto-start this preview as live. Research whether the official live player actually exists and whether a first-party-supported playable live HLS route is available; do not take third-party IPTV claims as acceptance.

## HGPTV Guyana — security challenge blocker

The homepage `https://www.hgptv.com/` showed a Dacast iframe in observer samples at **00:48:01–00:48:17**. A separate challenge-associated navigation to `https://www.__site_host__/` failed around **00:48:09**, and the user observed a security/bot check. No successful embedded playback was recorded. Keep blocked for legitimate operator/site availability; do not bypass, spoof, or automate challenge solving.

## Dependency discipline

Based on draft PR #18 exact-head passive probes; this implementation is a separate draft and **not merged**. Neither #16 nor #17 nor #18 is fully Sony Bravia accepted. The existing Telemicro and manual broadcaster helpers are unchanged.
