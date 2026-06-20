# Kulcha Flo Provider Helper Bank — Draft from Current Helper Audit

Source audit: `kulchaflo_helper_audit.zip` uploaded 2026-06-20.  
This is a provider-by-provider bank of accepted or existing helper patterns found in the current app files and recent commit history.

## Commit context

Recent accepted helper history from `git_log_oneline_60.txt`:

```text
0532d1c Add GBN Dailymotion official embed handling
0e65e2d Add CVC9 Dailymotion player-first layout
7bf0aa4 Improve CVC9 Dailymotion consent handling
692b33e Add CVC9 Dailymotion watch-page fallback without native promotion
aa0353f Add CNC3 live player TV handling
1edbce4 Add CBN live player TV handling
57a2ca8 Fix CVM live Vimeo playback layout
40ebe57 Fix CaribVision logged-in player audio fullscreen and back behavior
45836f7 Fix Caribbean Hot TV live player startup and controls
0f40cb0 Fix CGTV live startup alignment and pointer sleep
600f0d5 Fix ABS and TTT live player navigation
d87cb13 Stabilize Facebook browser-native sound and fullscreen flow
8fbfa54 Disable unsafe Facebook fullscreen automation
2209a90 Improve YouTube Back responsiveness
...
2485651 Add Novus Telearuba shared-player channel support
8b6359f Stabilise TTT startup assist and wake telemetry
972005e Set ABS/Tego clean player-first baseline
42bfb8b Merge CVM Vimeo playback fixes
```

Current working tree at audit time was clean except untracked handover/WIP patch files.

---

## YouTube

**Type:** stable major-platform helper.

**Main code family:** Kotlin modules and helpers, not content.js-heavy.

**Key code families found:**

- `YouTubeUrlPolicy`
- `YouTubeJsSnippets`
- `YouTubePolicyConstants`
- media-session ready listener in `GvBrowserMediaController`
- YouTube consent helper
- native fullscreen target probe
- auto-fullscreen arm/retry/callback check
- quality helper probe
- chat guard/collapse
- Premium popup checks
- Back suppression/recovery
- DPAD/focus navigation policy

**Lessons to bank:**

YouTube is its own stable subsystem. Do not solve a generic player issue by modifying YouTube unless the issue is proven YouTube-specific. Back handling, focus policy, fullscreen overlay gating, and quality helpers are already separated.

---

## Facebook

**Type:** hostile/unstable browser-native player.

**Accepted strategy found:**

- default Firefox desktop UA
- unsafe active fullscreen automation disabled
- cookie consent autoclick allowed
- login modal close after attach
- bottom login rail cosmetic hide
- native scheme and registration dialog blocked/rerouted
- Facebook host normalized to desktop URL
- passive source-attach monitoring
- same-URL controlled re-entry with attempt/generation caps
- playback diagnostics and delayed/deferred handling

**Known historical hurdles:**

- source-not-attached
- blob readiness delay
- video present but no source
- controlled re-entry needed
- fullscreen automation unsafe
- transport wake/pointer visibility intermittent

**Lessons to bank:**

Facebook fixes must stay in the Facebook state machine. Do not borrow Facebook tap/fullscreen patterns for normal official-player pages.

---

## ABS TV / ABS Radio Antigua

**Type:** official page with Tego shared player.

**Route/context:**

- top page: `abstvradio.com/live-streaming`
- player host: `player.tegotv.com/player.php`
- profile/channel: ABS defaults to channel `10`
- return URL constant: Kulcha Flo ABS channel page

**Current helper families:**

- Tego profile detection from player URL
- iframe/channel detection
- Tego URL sanitisation
- page fullscreen-like iframe promotion
- top overlay cleanup
- frame overlay cleanup
- player-first active event
- startup reprobe delays
- fullscreen preflight/gate diagnostics
- optional native F/fullscreen flags currently disabled
- Back exit to Kulcha Flo return URL
- scoped autoplay permission

**Lessons to bank:**

Tego players need URL sanitation and chrome parameter stripping. ABS and TTT share the player technology but require different channel profiles and return URLs.

---

## TTT Live

**Type:** official page with Tego shared player.

**Route/context:**

- top page: `ttt.live/stream`
- player host: `player.tegotv.com/player.php`
- channel/profile: TTT channel `1`
- return URL constant: Kulcha Flo TTT channel page

**Current helper families:**

- TTT consent autoclick
- Tego channel=1 detection
- Tego URL sanitation
- startup state summarising
- extra startup reprobe delays
- readiness assist after delay
- autoplay watchdog
- native play request when startup is blocked
- transport reveal bridge
- safe pointer zone checks
- Back exit to return URL
- scoped autoplay permission

**Lessons to bank:**

TTT needed longer startup telemetry and readiness assistance than ABS. Use state snapshots and bounded reprobes rather than blind repeated taps.

---

## Novus Telearuba channels

**Type:** official multi-channel shared player.

**Route/context:**

- top page: `novus.telearuba.aw`
- intent query: `kf_channel`
- valid desired channels in current code: `13`, `23`, `49`
- optional return URL: `kf_return`

**Current helper families:**

- request URL rewrite into Novus intent URL
- profile capture by session
- channel button detection by visible text/aria/title
- channel select retries
- startup state snapshots
- autoplay/unmute attempts with max attempt limit
- NotAllowedError detection and play assist request
- playable-video telemetry
- player-first shell after playback or playable paused state
- page cleanup by hiding siblings outside selected visual target
- one-shot/native play assist via Kotlin state
- Back exit to stored return URL
- scoped autoplay permission

**Lessons to bank:**

Multi-channel sites need intent/state carried from Kulcha Flo into the shared player page. The helper must select the channel before treating the media as playable. Do not assume one page equals one stream.

---

## CGTV / Caribbean Gospel TV

**Type:** official page with Bradmax iframe.

**Route/context:**

- top page: `caribbeangospel.tv/watch`
- player frame host: `bradm.ax`

**Current helper families:**

- Bradmax iframe discovery
- scroll-align before play assist
- stability-gated two-measurement alignment
- page fullscreen-like alignment
- Bradmax video state collection inside iframe
- play assist with ratio coordinates
- browser-first handling
- native promotion disabled/skipped for CGTV candidate streams
- wrong-layer rejection for splash/animation/media false positives
- transport lock hide/release
- fullscreen control detection/polling/hook after playback
- pointer fallback release/reset
- scoped autoplay permission

**Lessons to bank:**

CGTV proved that player alignment must settle before native tap coordinates are trusted. It also proved not every media candidate should be promoted: splash MP4s and wrong-layer sources must be rejected.

---

## Caribbean Hot TV / Hot7-style helper

**Type:** official page with Flowplayer-style live player.

**Route/context:**

- host: `caribbeanhottv.com`
- player type: `.flowplayer` with live/data-item/HLS source detection

**Current helper families:**

- Flowplayer live detection excluding YouTube players
- data-item source parsing for HLS
- video state collection
- play control detection
- fullscreen control detection
- DOM click then native fallback
- rate-limited play assist and fullscreen assist
- Back suppresses auto-fullscreen for current URL
- transport reveal hover
- scoped autoplay permission

**Lessons to bank:**

Flowplayer helpers should distinguish live HLS Flowplayer from embedded YouTube/non-live widgets. Fullscreen assist must respect Back suppression.

---

## CaribVision

**Type:** official app page with exact HLS/browser helper and auth-aware flow.

**Route/context:**

- app page: `app.caribvision.tv`
- exact HLS host/path in constants:
  - host: `5dcabf026b188.streamlock.net`
  - path: `/CaribVision/livestream/playlist.m3u8`

**Current helper families:**

- exact HLS ready evidence from content.js
- Kotlin logs HLS ready but skips native promotion as browser-helper
- auth path detection
- visible password input / auth action detection
- exact source discovery
- player root scoring
- session state telemetry
- playback unmute
- play assist
- fullscreen assist
- audio control handling
- suppress fullscreen assist after Back
- native error fallback-to-browser if native had been attempted
- scoped autoplay permission

**Lessons to bank:**

CaribVision is login/session sensitive. Preserve browser context. Exact HLS evidence is useful, but current accepted helper skips native promotion and lets browser/player helper manage playback.

---

## CBC TV8 Barbados

**Type:** official page with Video.js/exact HLS native promotion.

**Route/context:**

- page: `cbc.bb/live`
- exact HLS host/path in constants:
  - host: `1740288887.rsc.cdn77.org`
  - path: `/1740288887/index.m3u8`

**Current helper families:**

- Video.js source discovery: `video-js[id^="videojs"]`
- emits exact HLS ready
- Kotlin checks page context and exact HLS URL
- native promotion allowed for exact HLS only
- native DPAD policy applied
- native error fallback-to-browser
- already-active guard
- keep-alive when page observation goes null
- Back suppresses direct media promotion temporarily

**Lessons to bank:**

CBC is the clean example of native promotion done safely: exact host/path only, never broad HLS matching.

---

## CVM Jamaica

**Type:** official page with Vimeo event embed.

**Route/context:**

- top pages: `cvmtv.com/live`, `/live/`, `/more-pages/cvm-live-stream`
- embed: Vimeo event embed

**Current helper families:**

- top page and Vimeo event/embed detection
- player-first layout for top/embed
- Vimeo Player API preference for 1080p
- Vimeo autoplay permission allow
- diagnostic machinery exists but `ENABLE_CVM_VIMEO_DIAGNOSTIC=false`
- Back handling returns to Kulcha Flo/CVM channel flow

**Lessons to bank:**

For Vimeo event players, prefer official embed and use player API only for quality preferences. Keep diagnostics disabled unless actively debugging.

---

## CBN Virgin Islands

**Type:** official page with embedded Wix/filesusr/JW-style player.

**Route/context:**

- page: `cbnvirginislands.com/cbn-tv`
- embed frame contains `cbnvirginislands-com.filesusr.com/html/`
- page player root currently targeted by id `comp-ke1v14ts`

**Current helper families:**

- player-first layout on official page root/iframe
- hide known extra node `#comp-lg70kcxq`
- JWPlayer state detection when available
- visible video playback detection
- kick JW player via `play(true)` and `play()`
- HTML video unmute/play fallback
- muted fallback with bounded retries
- visible play button fallback
- pointer sleep requested after layout/playback
- one native centre autostart tap from Kotlin if browser playback is not active
- Back returns to Kulcha Flo/default start URL

**Lessons to bank:**

CBN is an example where centre autostart exists but is provider-specific and guarded by browser media state. Do not copy this blindly to ad-driven players.

---

## CNC3 Trinidad & Tobago

**Type:** official page with Dailymotion embed.

**Route/context:**

- page: `cnc3.co.tt/live-stream`
- Dailymotion player: `geo.dailymotion.com/player/` with video id `x9vba4u`

**Current helper families:**

- official page player-first over Dailymotion iframe
- Dailymotion autoplay permission allow scoped to CNC3 context
- native promotion skipped for Dailymotion page player
- optional one-shot centre autostart tap if browser playback inactive
- Back handling inherited through page/history flow

**Lessons to bank:**

CNC3 is a simpler Dailymotion official-embed case than GBN. It uses browser player and skips native promotion.

---

## CVC9 / Color Visión

**Type:** Dailymotion watch-page fallback.

**Route/context:**

- official page: `colorvision.com.do/en-vivo`
- accepted fallback: `https://www.dailymotion.com/video/x7gy059`

**Current helper families:**

- onLoadRequest rewrites official Color Visión page to Dailymotion watch page
- launch URL also rewrites to watch page
- Dailymotion consent detection
- consent accept native tap burst/safety handling
- one-shot player wake after consent
- Dailymotion adclick blocked in load request and new session
- Dailymotion watch-page autoplay permission allow
- watch-page player-first layout and chrome suppression
- native promotion skipped for Dailymotion browser player
- Back exits to Kulcha Flo/default start URL

**Lessons to bank:**

CVC9 is the model for watch-page fallback when an official embed is blocked but a public Dailymotion watch page works. Keep CVC9 consent/adclick logic scoped so it does not leak to GBN or CNC3.

---

## GBN Grenada

**Type:** official page with Dailymotion embed, not watch-page fallback.

**Route/context:**

- official page: `gbn.gd/live-television`
- iframe/watch id: `x85vz1r`
- accepted player context: `geo.dailymotion.com/player.html?video=x85vz1r`
- Dailymotion watch page is unsuitable/private.

**Current helper families:**

- official page only
- broader official iframe detection including embed and `geo.dailymotion.com/player.html?video=x85vz1r`
- bounded wrapper selection
- page chrome/header suppression
- Dailymotion autoplay permission allow scoped to GBN context
- native promotion skipped for Dailymotion browser player
- ad asset skip for Bing/adsappsvideostorage
- ad navigation blocked in load request and new session
- GBN consent frame detector logs only; old consent/autostart/player wake taps removed

**Lessons to bank:**

GBN is the warning case for Dailymotion browser player duplication. Do not promote Dailymotion ad/player assets natively. Do not add blind centre taps. Ad/no-ad variation is normal; duplicate native/browser ad layers are not.

---

## Compass TV Cayman

**Type:** planned official page with JWPlayer.

**Known HTML evidence from user:**

- official page: `compasstv.ky`
- JW script: `cdn.jwplayer.com/players/HRQZA1oT-SkbOASt9.js`
- player container: `#videoPlayer-HRQZA1oT-SkbOASt9`
- wrapper: `.container.jw-player-container`, `.jw-player`, `.video-player`, `.live-feed-wrapper`
- custom play button: `.jw-player #play-btn`
- page chrome: `header.site-header`, utility/header menus, live TV badge, video grid, footer

**Recommended family:** official JWPlayer page helper.

**Do not start with:** Dailymotion consent, watch-page rewrite, or native promotion block.

**Likely implementation:**

- add provider URL helpers for `compasstv.ky/`
- content.js player-first on JW player wrapper
- hide Compass page chrome
- detect visible custom/JW play button
- Kotlin one-shot native tap to real play control only if needed
- scoped JW/autoplay permission if logs show it is required
- native promotion guard only if device logs show duplicate playback

