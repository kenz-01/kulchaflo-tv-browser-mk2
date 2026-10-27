# CURRENT — TV architect compact working state (27 October 2026)

**Dated cache, not a live status source.** After merged handover PR #20, main was `37b8da13c97737e1ac5f7e04083d2acce16bd4c3`. Refresh current GitHub and read `docs/project-memory/CURRENT_STATE_2026-10-27.md` plus the paired handover.

- Manual helpers remain the working baseline, with distinct Facebook/YouTube subsystems. GeckoView is mainline; Media3 promotion is source-gated.
- Draft dependency chain: #16 (13 live-gap candidates) → #17 (19 known family routes) → #18 (17 unresolved passive diagnostics) → #19 (ZNS StreamcoMedia). These are **not automatically hardware accepted**. Old draft #1–#5 also remain unresolved.
- #18 narrow fixture/HGPTV route patch at `cef667f6` passed exact-head CI #40436180309. HGPTV canonical visitor destination is official `/watch-live/`; homepage is an allowed secondary passive diagnostic. The native browser/player itself has not been fixed.
- ZNS manual D-pad/OK led to browser picture, 1920x1080 fullscreen and working Back; finite 522.522-second duration does not prove linear live. #19 helper has prior passing checks but physical acceptance pending.
- MTV owner-observed smooth 1080p fullscreen *live* broadcast supersedes earlier inference from a `preview.mp4` log; latest supplied system capture lacked application events. Do not downgrade.
- HGPTV Dacast embed visible, A/V pending. **New 27 Oct finding:** human-check CTA displays on laptop and is clickable, but Bravia only spins and fails to render the CTA. Rendering/anti-bot compatibility hold; no challenge bypass.
- Telemicro 5 provisionally works. CBC/Bonce/Balchi source offline; Telesistema intermittent upstream. Preserve 32-bit ARM, low storage, installed build 5 and app log tag `KfMkIIGV:*` for evidence.

Every new job uses `docs/TV_ARCHITECT_DELIVERY_PLAYBOOK.md` and keeps passing CI separate from physical Sony acceptance.
