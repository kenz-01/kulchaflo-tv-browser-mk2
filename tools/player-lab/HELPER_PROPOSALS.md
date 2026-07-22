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

## Analysis Bridge

`npm run prepare-helper-evidence -- --analysis <analysis-directory>` creates
`helper-evidence.json` and `helper-evidence-provenance.json` from local
structured artifacts. `npm run recommend-helper -- --analysis <analysis-directory>`
runs that bridge and then the existing unapproved proposal generator.

| Bridge evidence field | Source authority |
| --- | --- |
| provider ID, target ID, canonical player family | validated analyzer derivation from `analysis.json` |
| trusted frame/referrer matching | directly observed structured capability observation only |
| selectors, idle delay, timer/cleanup/interaction facts | directly observed structured capability observation only |
| advanced requirements and provider-specific behavior | directly observed structured capability observation only |
| missing or conflicting fields | bridge provenance and a safe downgrade to insufficient evidence |

The bridge never derives matching or capability facts from a player family,
filename, Markdown prose, diagnostic text, or helper function name. Missing
trusted matching necessarily produces insufficient evidence. Provenance records
which fields were observed, analyzer-derived, unavailable, or conflicting and
must be reviewed with the unapproved proposal. There is intentionally no apply
command.

`analysis.json` supplies validated provider, optional target, and canonical
player-family derivations. A direct policy additionally requires capability
observations bound to the exact `analysis.json` SHA-256 and directly observed
structured matching, selectors, delay, timer ownership, interaction, cleanup,
and diagnostic-safety facts. The bridge preserves incomplete observations in
provenance but downgrades them to insufficient evidence; it never fills missing
facts from the player family.

Current profiling and offline analysis do not necessarily collect every
structured capability observation automatically. Producing and binding those
observations from collection evidence is a future pipeline step. This bridge
creates review artifacts only: neither helper evidence nor an unapproved policy
is applied to Android runtime source.
