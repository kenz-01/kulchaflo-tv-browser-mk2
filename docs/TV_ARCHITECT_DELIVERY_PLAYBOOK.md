# TV architect delivery playbook — 27 October 2026

**Required for every TV development job.** Read `AGENTS.md`, `.ai/TASK.md`, `.ai/STATE.md`, `TV_APP_HANDOVER_START_HERE.md`, current contracts and live GitHub state. This adapts the useful Events architect-direct **select → implement → exact-head verify → physically accept/hold → continue** approach without importing WordPress STAGING controls or the Events runner/schedulers.

## Repeatable job loop

1. **Refresh:** inspect `main`, relevant exact PR heads, merge bases, CI runs, comments, dependency chain and physical Bravia evidence. Dated SHA handovers are history, not current authority.
2. **Choose eligible task:** prioritise a reproducible failing test, documented runtime defect or verified source-family gap. If a provider is offline, a hardware test unavailable, or a security challenge blocks playback, log the real hold and advance independent code instead of producing another source-only report.
3. **Implement:** ChatGPT is coding/repair author and independent reviewer through bounded GitHub branches/PRs. Reuse established manual provider helpers. Guard exact official host, path, iframe origin and trust/referrer; no guessed URLs or generic autoplay/fullscreen/native extraction. Preserve YouTube, Facebook and accepted manual helpers.
4. **Check:** inspect diffs, targeted offline tests and `:app-gv:test` plus `:app-gv:assembleBraviaRelease` and Player Lab CI where applicable. Verify CI against the **current exact head**, not older passing runs. Host-script-only fixes should not trigger unnecessary device rebuild/reinstall.
5. **Physically accept or hold:** Sony Bravia's `armeabi-v7a` behaviour is authoritative for real live source, picture/sound, quality, fullscreen, remote, pointer idle and Back. Passing CI or an iframe merely appearing is **not** a device PASS. Use statuses `PHYSICAL_PENDING`, `OFFLINE`, `UPSTREAM_UNSTABLE`, `CHALLENGE_RENDER_HOLD` and `INCONCLUSIVE`.
6. **Advance dependencies:** recheck parent and child exact heads before porting fixes. Merge only after review, exact-head CI, dependency safety and the required physical acceptance; unaccepted helpers stay draft. Move to the next independent eligible task before ending a job.
7. **Persist:** short-lived SHAs, checks and acceptance evidence belong in PR/issue comments. Active state/task goes to `.ai/STATE.md` and `.ai/TASK.md`. New durable rules go in the TV Decision Ledger, and materially new handovers follow the paired operational/Brainstorm archive protocol. Never commit raw ADB logs, sessions, tokens or user browsing data.

## Non-negotiable boundaries

- GeckoView/browser-first playback; only verified `EXTRACTED_STREAM` may be considered for Media3 native promotion. A `PAGE_VIDEO` or `preview.mp4` is not proof of live stream playback.
- Publisher consent, CAPTCHA/anti-bot pages, DRM and security barriers are respected. Investigating why a real visible verification control fails to render on TV is legitimate; simulating completion, spoofing tokens or bypassing a challenge is not.
- No new AI worker, watchdog, recurring schedule, paid model calls, Actions overage or use of the Events Mac/STAGING runner. Production/Play Store publication and destructive credential changes require separate owner approval.
- Before installing a different Bravia build verify exact commit/checksum `BUILD_PROVENANCE.txt`, ABI and free space. Preserve the installed low-storage TV build until a test genuinely requires replacement.

## Reporting contract

Separate code changes committed, exact-head checks, hardware-observed playback, upstream/security holds, merged main, and store release. Never conflate one of these with another.
