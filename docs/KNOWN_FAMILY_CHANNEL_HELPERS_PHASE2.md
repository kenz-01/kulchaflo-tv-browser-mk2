# Known player-family helpers — phase 2

**Status:** source-only recovery candidate. No physical Sony Bravia or TCL acceptance yet.
**Dependency:** PR #16 (previous 13 live-gap channels). Keep this draft independent of the 17 unresolved-route/player channels.

## Implementation

Use the same narrow official-route, browser-first approach as the manually implemented
CVM, Island TV, GBN, Compass and DBS helpers. The single extension asset
`gv_media_observer/known-family-helpers.js` contains one exact-route table and
six reusable families with one HTML5 variant. It runs only in the official
top-level document and only when the expected real player is present.

- **YouTube wrappers (5):** Acento TV, Ahora TV, Antena 7, Energia TV,
  Prensa Latina TV. Reuse existing YouTube player handling; isolate a single
  trusted embed only. Do not script YouTube players.
- **Video.js (5):** ETV Guadeloupe, Bonce TV, Télé Péyi Guyane, XFM Aruba,
  Balchi TV. Positive `.video-js`/video evidence before player-first and
  one bounded playback/unmute assist.
- **JWPlayer (2):** TeleOnce and TV Direct 13 Curaçao. Positive JW wrapper
  plus player evidence; style outer ancestors, not JW descendants (Compass lesson).
- **Dailymotion (2):** Telesistema 11, Teleuniverso 29. Only single trusted
  Dailymotion iframe, no native promotion or synthetic ad taps (GBN/CVC9 lesson).
- **Vimeo (1):** Pointe TV Antigua. Single official Vimeo iframe only
  (Island TV multiple-embed lesson).
- **Hls.js (3):** Bonao TV, RTVD, Yuna Visión. Visible media-source evidence
  required, with fail-closed behaviour for multiple candidates.
- **Native HTML5 (1):** Adoram TV. Source/ready evidence first.

The active source for the 19 official routes is
`tools/player-lab/config/public-targets.json`. No invented stream URLs,
hidden iframe rewrites, native Media3 promotion, new Android permissions,
unbounded tap retries, dependency installs, extra workflows or paid agents.

Native GeckoView adds a matching exact-route safeguard in `isKnownFamilyLivePageUrl` so both extracted-stream observations and media candidates from these official pages retain browser ownership; all existing manual provider allowlists remain unchanged.

## Acceptance

Offline assertions check all 19 route boundaries, registry alignment, trusted
iframe hosts and source invariants. GitHub CI must pass:
`./gradlew :app-gv:test :app-gv:assembleBraviaRelease`,
`node --check` and all Player Lab tests.

**Physical-TV gate:** On the Bravia, test official route → one correct
player → starts with sound → full TV viewport → D-pad controls → Back exits
without relaunch, and acceptable source quality. Repeat on TCL as needed.
A route can still produce a documented NO-OP when the player changed, there
are multiple ambiguous players, or GeckoView blocks autoplay. Record those
failures and implement only a proven provider-specific refinement, not a
generic site-wide hack. In particular RTVD has multiple programmes, so no
automatic arbitrary channel choice is permitted.

Until physically validated, these are **candidate helpers**, not 19 accepted
working channels. No merge to main and no app-store publication.

## Physical Bravia trial, 19 October: focused follow-up

The user confirmed CBC TV8 is down on the broadcaster's own website; CBC helper remains unchanged.
Logcat showed Telemicro's Radiant player-first event but the cursor stayed in focus-navigation mode,
Bonce's autoplay request retained the default decision, and Telesistema's geo.dailymotion.com
request also retained the default decision. Telesistema's embedded player appeared around eight
seconds after opening the page. Balchi's actual source returned HTTP 404 and needs source recovery.

The follow-up patch adds: a Telemicro pointer-sleep event matching manual GBN/CBN behaviour;
narrow Bonce first-party and Telesistema/Dailymotion content autoplay permission;
Bonce-only single visible native-video fallback; retries extending to 15 seconds; and
one player-first or no-player diagnostic emitted through the existing GeckoView bridge.
No new native promotion, cross-site autoplay permission or CBC player changes. These remain
test candidates until a second physical Bravia acceptance pass.

## Bravia log 21 October — Telesistema lazy loading

The second log explicitly confirms that both Dailymotion autoplay permissions were granted
(`decision=1` at 01:32:15.618 and 01:32:15.623). At 01:32:15.340,
the existing D-pad document scroll located `iframe.entered.litespeed-loading`;
`geo.dailymotion.com` started loading at 01:32:15.548, with the
known-family player-first state emitted at 01:32:16.270. The site was
therefore **not waiting for an autoplay permission fix**; its official
iframe had not entered the viewport to trigger LiteSpeed lazy-loading.

The Telesistema-only helper now locates exactly one trusted Dailymotion
iframe in `src` or its lazy `data-*` attributes and calls
`scrollIntoView` **once** before the existing player-first attempt.
It never replaces the source URL, creates a new player, injects synthetic
pointer events or adds permission grants. When nothing uniquely matches,
it leaves the page alone. CI guards both the positive lazy-loading case
and multi-iframe/other-site NO-OP behaviour.

**Physical playback acceptance remains pending.** Telemicro's latest
on-TV result was good; Bonce was source-offline and CBC TV8 was source-offline.
