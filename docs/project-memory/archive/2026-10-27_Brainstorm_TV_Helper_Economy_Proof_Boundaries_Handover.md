# Brainstorm handover — TV manual helper economy and evidence boundaries, 27 October 2026

**CHAT_TEXT_CAPTURE / SELECTIVE_PROMOTION.** This is not an operational PR timeline; see paired [continuation](2026-10-27_TV_Bravia_Helpers_Continuation_Handover.md). It captures durable understanding that emerged while moving from manually commissioned provider helpers to reused player-family implementation.

## 1. Proven helper families are templates, not blanket unlocks

The owner's manual ABS/Tego, TTT/Tego, Novus/Telearuba, CBN, GBN, Island TV, Compass and other broadcaster-specific implementations provide the preferred patterns: player-first browser-owned viewport, source-scoped autoplay, bounded start/unmute, pointer sleep and correctly handled Back. The cheapest route is reuse **per verified official player family**, not one giant full-site autoplay/native interception engine. No assumption that all 19 known-family targets or 17 unresolved research targets are working channels.

## 2. Source outages must not become code regressions

CBC was buffered while its official source was down; Balchi returned HLS 404; Bonce had app layout but broadcaster source down; Telesistema's Dailymotion could be played after D-pad movement but its official site was intermittently unreliable. Distinguish `SOURCE_OFFLINE`, `UPSTREAM_UNSTABLE`, `AUTOPLAY_DENIED`, `PLAYER_NOT_DETECTED`, `APP_BUG`, `PLAYBACK_VERIFIED` and `NOT_OBSERVED`. A green APK build verifies code compilation/testing, not live broadcast reception.

## 3. The existing browser is a first-class playback surface

ZNS StreamcoMedia actual fullscreen and Back worked through GeckoView. Blind Media3 promotion would risk breaking existing provider logic or redirecting a recording as a live stream. Genuine `playing` and successful remote/Back are stronger than a CSS applied/player iframe present message. The 522.522s ZNS media session is evidence of successful playback but **insufficient evidence of a continuous live TV programme**. The user later observed real MTV 1080p live fullscreen: preserve that, rather than force a downgraded stream because an older capture had only preview.mp4.

## 4. Security and publisher trust boundaries remain binding

HGPTV exposes a first-party page embedding Dacast, but an apparent challenge-labelled popup failed through a literal placeholder host. The appropriate path is normal official playback/authorised provider support; do not spoof, evade or automate an anti-bot challenge. Permission changes should be narrowly bound to a proven page AND trusted embed, never a wildcard CDN or unrelated iframe.

## 5. Observability is part of product execution, not clerical overhead

A substantial effort was wasted because Android logcat was filtered by bare `GvMedia`, while the real logger prefixes every tag with `KfMkIIGV:`. The future routine is capture full device logs privately, identify valid app events and exact source window, and fail closed on absent evidence. A script can return three compressed files without collecting even one source session; file existence is not acceptance. The full latest MTV log remains insufficient for GeckoView attribution despite graphics activity.

## 6. Canonical memory discipline for the TV repo

Adopt the Events project's two-layer model: dated operational continuation and selectively curated Brainstorm understanding, with archive manifest, chat index and durable decision ledger. GitHub PRs/checks retain transient code/status; canonical memory captures engineering rationale, user-observed hardware truth and supersessions. No raw ADB logs or account/browser tokens are ever archived in source control.

**Supersession note:** initial conclusion 'MTV only has preview.mp4' described the earlier capture but is superseded for current **user-observed** live 1080p fullscreen; independent log-level verification is still absent. HGPTV 'no player' is also narrower than manual-trial log evidence of a real managed Dacast iframe. Preserving both stages avoids false confidence and repeated speculative fixes.

No new cross-product architectural decision for Kulcha Flo Events is asserted; this is TV-app engineering and evidence discipline. The shared Events memory pack is a useful methodology reference, not a replacement for real TV repository code.
