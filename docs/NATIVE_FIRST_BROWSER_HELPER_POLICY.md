# Native-first browser and helper policy

Kulcha Flo TV is a browser, not a replacement streaming platform. Start with the broadcaster's official page and let its own player use normal GeckoView behavior. Preserve publisher controls, links, sources, autoplay and mute choices, and playback lifecycle.

## Required review for an active workaround

Before changing a broadcaster-owned player, record:

1. What native browser behavior fails, supported by independent source or device evidence.
2. Why ordinary GeckoView behavior or a narrowly scoped permission cannot address it.
3. The smallest exact top-level route, frame origin, and player-family scope.
4. Explicit attempt, time, observer, and timer stop limits.
5. A regression test, a real-player acceptance result, and a rollback path.

Do not infer playback success from a build, unit test, page load, player discovery, or media-session event. Physical TV acceptance requires an actual moving picture, sound, fullscreen, remote navigation, and correct Back behavior.

Do not add unsolicited `play()`, clicks, source rewrites, iframe reloads, synthetic input, forced mute/unmute, app-managed fullscreen, or indefinite retry/observer work. Keep native media handling and navigation authoritative, permissions exact-route/origin scoped, diagnostics bounded and URL/token free, and one owner for each helper purpose. Retire workarounds when their evidenced purpose has been met.

## Current helper inventory

This is a source audit as of PR #30 head `3e85f4eb2ed6df2d3ca93b994c96f8f31eabda46`; it is not a physical acceptance record. Do not use the audit to justify changing a working channel without new evidence.

| Surface | Classification | Current source behavior and review status |
| --- | --- | --- |
| `candidate-ranking.js` | Native behavior / passive observation | Describes media candidates and settles repeated observations; does not control a broadcaster player. |
| `content.js` media collection | Native behavior / passive observation | Samples visible media metadata and reports candidate evidence. The activity separately protects Telesistema from direct-media promotion. |
| Dailymotion GBN, ColorVision, and CNC3 branches in `content.js` | Active DOM/layout intervention requiring review | Route and player-ID scoped player-first styles and chrome suppression; the predicates target `gbn.gd`/`x85vz1r`, ColorVision/`x7gy059`, or CNC3/`x9vba4u`, not the Telesistema page. Retain until each route has its own acceptance review. |
| CVM Vimeo branches in `content.js` | Minimal scoped assistance plus active review | Route-matched layout, quality preference, and transport autohide. Transport autohide is a CSS/UI intervention; quality changes are active player preference. |
| IslandTV Vimeo branch in `content.js` | Active DOM, frame, and navigation intervention requiring review | Selects an event frame, builds a player shell, may copy the selected official embed source, disables identified extra frames, and hides page chrome. |
| DBS TV branch in `content.js` | Active DOM and media intervention requiring review | Builds a shell around the identified player and makes a browser `play()` attempt; timers and observer are bounded. |
| CBN Virgin Islands branch in `content.js` | Active media, audio, and pointer intervention requiring review | Applies player-first layout, attempts playback and audio state changes, has a bounded muted fallback, and requests pointer sleep. |
| Compass TV JWPlayer branch in `content.js` | Active audio and layout intervention requiring review | Applies layout and retries unmute/volume changes; no evidence in this source review establishes that those actions are still required. |
| ABS Tego / TTT Tego branches in `content.js` | Active navigation, input, fullscreen, and playback assistance requiring review | Includes route-specific URL normalization, timed readiness probes, fullscreen layout/requests, transport reveal, and a TTT startup play assist path. |
| Novus Telearuba, CGTV, CHTV, and CaribVision branches in `content.js` | Active channel/player assistance requiring review | Route-specific channel selection, playback readiness/play assist, layout, or fullscreen handling. Keep their existing channel behavior; require current evidence before expanding or consolidating. |
| `zns-streamcomedia-helper.js` | Bounded source-scoped observer plus active layout intervention | Exact ZNS page/embed checks; observes player/media state with a capped discovery window, and applies top-level player-first CSS/`allowfullscreen`. It does not set the video source, call play, or change mute/volume. Preserve ZNS behavior in this Telesistema change. |
| `GeckoBrowserActivity.kt` Gecko permission and media paths | Native behavior plus narrowly scoped compatibility policy | GeckoView remains the player. Telesistema's Dailymotion autoplay permission remains tied to the official Telesistema page and Dailymotion request; direct media promotion remains excluded for that page. Other existing provider policies are unchanged. |
| Kotlin remote input, pointer, fullscreen, Facebook, and YouTube routes | Active interaction/consent assistance requiring route-specific review | App-managed remote mapping and platform/site assists remain in place for their established routes. Telesistema's generic compatibility wake pulse remains skipped; ordinary remote navigation is preserved. |
| Telesistema lazy-frame and first-interaction scripts | Redundant/obsolete; removed by this change | The lazy-frame script changed `loading`, could reassign a publisher-authored `src`, scrolled the iframe, and scheduled repeated attempts. The diagnostic script added observers/timers, but the available evidence does not establish a need for either script to produce the official page's playback. Neither is injected or replaced. |

## Prioritized simplification backlog

1. **Telesistema Bravia acceptance:** test the untouched official page with no remote input during startup. Only after natural playback works, check directional pointer reveal, first OK, continuity, and Back. If it still stalls, investigate GeckoView/Dailymotion compatibility without changing the page or iframe.
2. **Audio/autoplay intervention review:** for Compass TV and CBN Virgin Islands, establish with a real player test whether repeated unmute/play attempts are necessary and preserve user audio choice; remove the active intervention if native playback works.
3. **Iframe/source ownership review:** for IslandTV and DBS TV, compare the publisher's original page/frame behavior with the shell/source handling and retire duplication when unnecessary.
4. **Retry/observer retirement:** review the remaining route-specific timers and mutation observers after a route's real acceptance result; keep only bounded work that contributes to that result.
5. **Acceptance ledger:** record each helper's current evidence, owner, stop condition, and rollback when that channel is next tested. Do not mass-refactor validated channels in this PR.
