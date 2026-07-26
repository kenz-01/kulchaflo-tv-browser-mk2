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

## Engine Certification And Assembly

Provider observations and engine guarantees are separate artifacts. A target
observation records only provider-scoped matching, enabled transport behavior,
idle delay, selectors, advanced requirements, and provider-specific behavior.
It cannot claim timer ownership, interaction reveal, pagehide cleanup, or
diagnostic safety.

`npm run certify-helper-engine` statically certifies the current transport
engine once. The certificate is bound to the SHA-256 of the repository-relative
`content.js` artifact. `npm run assemble-helper-observations -- --analysis
<directory> --target-observations <file> --engine-certification <file>` merges
only compatible target evidence with that certification. A source change makes
the certification stale and blocks assembly.

`recommend-helper` also accepts the target-observation and certification pair
to assemble evidence in memory before producing its existing unapproved review.
Future profiling may produce target observations automatically, but neither
certification nor assembly has an automatic Android policy-apply operation.

## Target Observation Candidates

`npm run derive-target-observations -- --analysis <analysis-directory>` creates
an offline `target-observation-candidate.json` and field-level provenance. It
can additionally consume a canonical Player Lab report, registered target
metadata, the exact-byte-bound approved runtime policy, structured
characterization, and a bounded reviewer input for an idle delay. Those sources
are loaded independently and reconciled field by field; one authority never
hides a disagreement from another. Analysis supplies identity and player
family. Trusted matching, stable selectors, enabled state, and idle policy come
only from registered metadata or the existing approved policy, except that the
bounded reviewer artifact may supply idle policy. Raw URLs are never matching
evidence.

Canonical reports are validated with the existing Player Lab report model.
Their arbitrary candidate controls do not establish transport-autohide
applicability or stable selectors. The legacy
`structured-profile-target-evidence` shape is an explicit test-support adapter,
not a production report schema. If the canonical report cannot prove its
analysis/run relationship through fields actually present in its schema, the
candidate records that binding as unavailable and cannot be promoted.

Idle delay is a policy choice, not a measured playback fact: it is accepted
only from the approved policy, registered metadata, or a bound reviewer input,
and reviewer input is labelled as such. Engine guarantees remain exclusive to
4F certification.
Candidates with missing, conflicting, provider-specific, or advanced behavior
are review artifacts only and are not promoted. A complete candidate may also
write `target-capability-observations.json`, still unapproved and never applied
to Android.

The approved CVM target is a special authoritative source: 4G extracts its
complete isolated policy from the exact current `content.js` bytes, validates
the matching and transport values, and reconciles them with any supplied
registered metadata or reviewer input. Consequently, “CVM missing idle” is not
a truthful fixture while that approved policy supplies `idleMs`. Missing idle
is modelled with a non-approved Vimeo-like target; its otherwise complete
evidence remains insufficient until a bound reviewer selects the idle policy.

Characterization inputs are not a second production registry. The bounded
ABS/Tego adapter is a sanitized representation of the existing structured 4E
characterization and preserves its seven advanced requirements, so its result
remains `engine-extension-study`. The bounded Island adapter preserves the
existing dual-player selection evidence and remains `provider-specific`, with
a downstream `provider-specific-helper` recommendation. Both adapters retain
exact-byte bindings and field provenance, reject unknown or unsafe content, and
cannot manufacture matching or transport facts absent from their basis.

Target candidates and promoted target observations never carry certified
engine guarantees or source-only policy implementation fields. Compatible 4F
assembly is the only layer that may add one-owned-timer, interaction-reveal,
pagehide-cleanup, and URL-free-diagnostic guarantees. Generation, promotion,
assembly, and recommendation remain offline review operations; none applies a
policy to Android automatically.
