# Helper Proposals

`npm run propose-helper -- --report <offline-evidence-directory>` reads only a
local directory containing `helper-evidence.json`. It writes an unapproved JSON
proposal and Markdown review beneath `tools/player-lab/reports/helper-proposals`
by default. An explicit `--output-dir` may be outside the repository, or inside
the ignored `tools/player-lab/reports` tree only. Output below application,
source, test, fixture, or Git paths is rejected before allocation.

Recommendation categories:

- `direct-registry-policy`: evidence matches an already-supported runtime
  capability contract. The generated policy remains unapproved.
- `engine-extension-study`: evidence requires behavior not represented by the
  current engine. No policy is generated.
- `provider-specific-helper`: behavior is coherent but includes provider-only
  selection or orchestration semantics.
- `insufficient-evidence`: trusted matching or behavioral evidence is weak or
  conflicting.

Player-family detection never authorizes a policy by itself. A direct proposal
also needs exact trusted frame/referrer matching and a fully supported
capability contract. Human review must verify policy identity, matcher scope,
selectors, and the original runtime evidence before any Android change.

Evidence selectors preserve the provider's observed selector list after bounded
sanitization. Direct embedded-Vimeo policy eligibility is stricter: it requires
exactly `.vp-controls`, `.vp-sidedock`, and `.vp-title`. A non-Vimeo selector is
valid evidence but cannot enter a direct registry proposal.

Raw URLs, media URLs, query strings, fragments, credentials, token-like values,
cookies, Authorization values, email addresses, and local user-profile paths are
rejected from evidence and proposal output. Trusted matching remains structured
as hostname and path fields, never full URLs. Direct-policy support currently
remains embedded Vimeo only; other canonical Player Lab families are evidence,
not authorization.

ABS/Tego remains an engine-extension study because it needs stable playback
readiness, initial settling, bounded retries, throttled interaction, inline
visibility styles, and shared TTT reveal behavior. Island TV dual-player
selection remains provider-specific because its selected-player behavior is not
an existing generic capability.
