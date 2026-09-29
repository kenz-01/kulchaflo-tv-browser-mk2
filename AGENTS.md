# Kulcha Flo TV development instructions

This repository is the Android TV runtime for Kulcha Flo.

## Development lane
- GitHub is the durable task and review handoff.
- Keep this repository's development lane independent from the Carnival/Events worker and its allowance.
- Prefer GitHub-hosted deterministic CI. Do not require the Events repository's self-hosted runner.
- Copilot may implement bounded TV tasks when explicitly assigned/requested through GitHub. Do not run an automatic all-push AI loop.
- Keep implementation and independent review distinct. A task is not accepted merely because code was generated.
- Physical Bravia/TCL validation is a separate evidence boundary when behaviour depends on actual TV hardware.
- Never mutate the user's legacy/dirty local TV checkout from automation.

## Architecture invariants
- Mainline runtime is GeckoView under app-gv; WebView app is historical unless a task explicitly concerns it.
- Build target for Bravia release validation: ./gradlew :app-gv:assembleBraviaRelease --console=plain
- Browser navigation remains authoritative.
- Only EXTRACTED_STREAM may be promoted to native Media3. PAGE_VIDEO remains a candidate, not automatic native promotion.
- Keep provider/player helpers bounded and source-aware. Do not introduce wrapper-wide fullscreen/autoplay hacks.
- Preserve generic runtime/player + adapter architecture.

## Acceptance
Every implementation PR must:
1. state the task/acceptance contract;
2. run deterministic CI on the exact head;
3. distinguish emulator/CI proof from physical-TV proof;
4. document any remaining hardware-validation boundary;
5. avoid unrelated refactors.

Production/store release or irreversible external actions always require explicit human approval.
