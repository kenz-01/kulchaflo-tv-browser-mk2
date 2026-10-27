# TV app — START HERE (27 October 2026)

Read [TV project memory](docs/project-memory/README.md), its [current state](docs/project-memory/CURRENT_STATE_2026-10-27.md) and the [continuation handover](docs/project-memory/archive/2026-10-27_TV_Bravia_Helpers_Continuation_Handover.md) before developing or commissioning another Bravia APK. Refresh exact live PR heads/checks; this documentation commit changes no app code. Existing `AGENTS.md` and TV helper contracts remain authoritative.

**Current task:** inspect full source logs for HGPTV Dacast real `/watch-live/` destination/security challenge, preserve MTV reported 1080p actual live playback without downgrade, physically test ZNS PR #19, and repair PR #18 failed diagnostic test without broad player changes.

## Current TV execution workflow

Use [TV Architect Delivery Playbook](docs/TV_ARCHITECT_DELIVERY_PLAYBOOK.md), [task cache](.ai/TASK.md) and [state cache](.ai/STATE.md) at every new job. It applies architect-direct implementation, exact-head CI, distinct physical acceptance and safe continuation to an independent task. See PR #18 fixture/HGPTV repair and the separate Bravia hold on ZNS and challenge-widget discrepancy on HGPTV.
