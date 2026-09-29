# Player-helper commissioning inventory

Snapshot: 2026-09-29. Current-main baseline: `a24f4c963420b6c0e7ccd723a32c3b77a33d2949` (PR #8). This inventory records the state visible on current `main` and the open draft PR heads; it does not merge, rebase, or certify those branches.

## Confirmed current baseline

The stable handovers in `main` document:

- **CBC TV8** — exact-HLS native promotion is limited to its known live source, with an already-active guard, browser fallback, and Bravia-tested Back/pointer behavior (`HANDOVER_CBC_STABLE_2026-05-19.md`).
- **CaribVision** — browser-first login/navigation; native promotion is limited to its exact accepted live HLS, with keep-alive and browser fallback (`HANDOVER_CARIBVISION_STABLE_2026-05-19.md`).
- **CGTV** — browser-first Bradmax playback; native HLS promotion remains disabled because of TLS/certificate failures. **Novus Telearuba** handling is scoped to its shared player and known channel routes (`HANDOVER_CGTV_NOVUS_STABLE_2026-05-12.md`).

These are the current documented stable contracts, not a claim that this is the complete list of supported providers. Preserve browser navigation first and promote only a proven `EXTRACTED_STREAM`; `PAGE_VIDEO` remains candidate-only. The handovers report physical Bravia validation for the listed stable flows.

## Open draft work

All five drafts still target the old base `060bf137c4f38e75765d9910b9d539e33230546f`, not current `main`. They remain drafts; none is accepted as current-main behavior.

| PR | Head / stated scope | Inventory status |
| --- | --- | --- |
| [#1](https://github.com/kenz-01/kulchaflo-tv-browser-mk2/pull/1) `1bcdd873a12ee8f8ae5a5ba61c16869cb82321a7` — Player Lab reconnaissance | Profiling/configuration and helper-gap research; its description says no runtime helper is intended. Research is useful input, not implementation acceptance. Latest-head targeted probes passed, while live-channel recon was cancelled. |
| [#2](https://github.com/kenz-01/kulchaflo-tv-browser-mk2/pull/2) `1b78f7f19a38eafc15d523ae32a87a1fdb19d199` — Radiant phase 1 | Telemicro 5, Digital 15, and Telecentro 13. The branch audit reports a browser-first bounded helper and automated profile/analyze/probe gates as green; Bravia validation is pending. No matching targeted-probe run was found for this head. |
| [#3](https://github.com/kenz-01/kulchaflo-tv-browser-mk2/pull/3) `398e56245e24eba1597983c4087d872d5e560376` — live gap batch | Its description combines the Radiant work with SVG-TV/Cloudflare Stream diagnostics, so Radiant overlaps #2. Its Bravia validation document lists 13 channels—much wider than the PR description—so this scope must be reconciled. No matching targeted-probe run was found for this head. |
| [#4](https://github.com/kenz-01/kulchaflo-tv-browser-mk2/pull/4) `97b94091a4b3b3e18dacfa293ab6878ea357b1c5` — ZIZ phase 1 | ZIZ Channel 5, Hls.js/custom player; stated as browser-first with bounded play assist, audio, and fullscreen behavior. Targeted probes passed at this head; physical Bravia validation is still pending. |
| [#5](https://github.com/kenz-01/kulchaflo-tv-browser-mk2/pull/5) `79d932247712a270e9db4a71551de7fa992bb0a1` — hosted Video.js phase 1 | Bizz TV and RHT TV; stated as a scoped Video.js helper retaining browser playback. Targeted probes passed at this head; physical Bravia validation is still pending. |

## Overlap and acceptance gaps

- **Radiant is duplicated:** #3 includes the three-provider Radiant slice from #2. Neither draft supersedes the other because both remain open and neither is merged. Do not implement or accept the same Radiant behavior twice.
- **Player-family reuse is not provider acceptance:** #4 and #5 target different player families/providers from the Radiant work. Keep any follow-up adapter scoped to the official route and actual player; family detection alone does not justify a generic helper.
- **Draft diffs are not narrow snapshots:** GitHub reports 169–174 changed files per draft against the old base, including substantial `app-gv` changes in `content.js` and `GeckoBrowserActivity.kt`. Review against current `main` before relying on any runtime diff; the PR descriptions alone do not establish that the broad diff is safe or current.
- **Physical evidence is outstanding:** the draft descriptions/audit mark Bravia checks pending or provide a checklist without a recorded pass. Player Lab/fixture checks are not evidence of playback, audio, fullscreen, remote controls, or Back behavior on a TV.

Before any runtime work, select one bounded provider task, compare its diff with current `main`, preserve the stable contracts above, and pass the deterministic `app-gv` test plus Bravia release build. Any TV-dependent acceptance still requires separate physical Bravia/TCL validation.
