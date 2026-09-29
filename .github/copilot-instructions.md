# GitHub Copilot instructions — Kulcha Flo TV

Work only to the issue/PR acceptance contract. Keep changes narrow.

The active product runtime is `app-gv` (GeckoView). Do not migrate work back into the historical WebView app unless explicitly required.

Preserve these invariants:
- browser navigation first;
- native Media3 promotion only for `EXTRACTED_STREAM`;
- `PAGE_VIDEO` is candidate-only;
- source/provider helpers are bounded adapters, not global browser hacks;
- no wrapper-wide fullscreen or autoplay workaround;
- physical-TV behaviour is not proven by CI/emulator results.

Before handing back a PR, run the relevant tests and the Bravia release build where the task affects Android runtime code. State clearly what still requires physical Bravia/TCL validation.

Do not alter release/store credentials, production services, or the separate Events-engine automation.
