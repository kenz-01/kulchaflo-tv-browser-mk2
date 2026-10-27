# Kulcha Flo TV — durable engineering decision ledger

This **TV-local** ledger borrows the Events project memory discipline. IDs here are **TV-D** to avoid collision with the Events-wide D001–D126 decision sequence. Previously established practices are identified as recovered baselines, not invented new decisions.

## TV-D001 — Manual player helper patterns are first-class acceptance references (recovered baseline)

Use source-specific, exact-route browser/native contracts inspired by already tested ABS, TTT, Novus, CBN, GBN, Island TV, Compass, etc. Build shared techniques for verified families without a generic site-wide autoplay or stream interception policy. Keep YouTube/Facebook intact. **Why:** remote/fullscreen/audio differ per publisher; one global policy regresses good channels.

## TV-D002 — Bravia hardware acceptance is separate from tests/build (recovered and reinforced)

A passing CI, CSS applied, player detected or a working one-time clip is not full live-channel acceptance. Require genuine programme picture, sound, live/source identity, fullscreen, remote and Back. Document source-offline / upstream-unstable / not-observed explicitly. **Why:** CBC/Bonce/Balchi outages and Telesistema lazy-loading made earlier 'helper ready' claims too broad.

## TV-D003 — Exact site and embedded player trust boundaries (recovered; refined for ZNS)

GeckoView should own embedded playback unless approved source-specific Media3 promotion is established; limit permission grants to verified official top pages and known embeds. ZNS uses `znsbahamas.com` + `player.streamcomedia.com/HTML5/znstv` and limits play/unmute to trusted document referrer. Never promote a preview.mp4 or evade security checks. **Why:** observed browser fullscreen and Back work, but security and source provenance differ.

## TV-D004 — Constrain fallback by real evidence, preserve supersessions (newly explicit 27 Oct)

An old log showing MTV `preview.mp4` did not negate later owner-observed smooth 1080p fullscreen live video. A finite-duration ZNS playable item is not automatically continuous linear live; HGPTV's challenge-labelled placeholder host is not proof of a specific anti-bot vendor. Keep each observation at its date and verification level, and repair only supported failure modes. **Why:** avoids unnecessary quality downgrades, fake provider fixes and false 'accepted' statuses.

## TV-D005 — Private, exact-window application logcat is a prerequisite for Android claims (newly explicit 27 Oct)

Collect unfiltered ADB logcat in a bounded live window, identify actual `KfMkIIGV:*` tags and provider-specific probe records; if logs are missing or filtered incorrectly, say INCONCLUSIVE. Never check raw logs into public repositories. **Why:** an earlier ADB filter produced three near-identical 60-line Sony crash captures with zero app events and could have driven incorrect fixes.

## TV-D006 — Source/runtime truth over copied homepage in inventory (newly explicit 27 Oct)

Distinguish canonical WordPress Channel user destination, broadcaster official live route, iframe player host and public-target research registry. Reconcile evidence (e.g. HGPTV actual `/watch-live/` versus research `/`; Live99/StreamBrothers; VIP/Live TV) before writing new route policies. **Why:** scripts can accurately observe the wrong page and silently miss the real playback surface.

## Release boundary

STAGING/candidate build is never a production/store release. Do not merge #16→#19 prematurely or silently add wildcards; maintain exact head CI and real Sony acceptance. Existing PRs hold transient SHA and test facts; this ledger holds only durable rationale.

## TV-D007 — TV-local architect-direct delivery playbook (27 October 2026)

Adopt the Events repo's implement → exact-head test → verify → repair/hold → continue discipline, without its STAGING WordPress approvals, automations, runners, paid workers, auto-merge or review-controller machinery. All TV jobs must read `docs/TV_ARCHITECT_DELIVERY_PLAYBOOK.md` via the top of `AGENTS.md` and compact `.ai/TASK.md`/`.ai/STATE.md`. The TV hardware and source/security gates still control acceptance. **Why:** avoid repeated planning-only loops and context loss without weakening on-device evidence or publisher protections.

## TV-D008 — Security-challenge rendering is not stream or reputation proof (27 October 2026)

On HGPTV's first-party Dacast live page, a human-verification checkbox rendered and was clickable on the owner's laptop, while the Bravia displayed a spinner and no checkbox. **Superseded during the same 27 Oct session:** a subsequent screenshot showed a fake human-check pane commanding a pasted `curl`-to-`bash` Terminal execution, terminal HTTP 403 and concurrent new background-item notices (`runscv.sh`, `bash`). This is a **potential ClickFix malware-delivery incident**, not ordinary publisher challenge incompatibility. Exact system compromise is unknown. **HOLD all direct HGPTV browsing/automation** until independent incident response and site/origin safety are established. Never run/simulate the payload or solve the challenge. Mac CI/deployment and any accessible credentials are security-held pending trusted assessment. **Why:** security containment supersedes playback diagnosis.
