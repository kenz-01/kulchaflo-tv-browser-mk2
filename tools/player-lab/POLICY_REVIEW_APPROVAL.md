# Checkpoint 4H: Explicit Policy Review and Unapplied Diff

Checkpoint 4H separates evidence collection from human approval. Player Lab
observations establish target facts, engine certification establishes reusable
engine guarantees, and the helper recommendation classifies the safe policy
category. None of those artifacts records a human decision to propose Android
runtime work.

## Canonical authority chain

| Decision input | Canonical authority |
| --- | --- |
| Provider, target, family, matching and transport facts | Promoted `target-capability-observations.json`, validated against the 4G candidate and analysis |
| Candidate readiness, conflicts and unavailable fields | `target-observation-candidate.json` |
| Per-field candidate evidence | `target-observation-candidate.json` field provenance; `target-observation-provenance.json` remains its supplemental rendered artifact |
| Reusable engine contract | `engine-certification.json`, independently recertified against exact runtime bytes |
| Combined target and engine observations | `helper-capability-observations.json`, independently reproduced through 4F assembly |
| Assembly source separation | 4F assembly provenance; 4H independently enforces the same separation and binds the assembled artifact |
| Policy category | `helper-proposal.json`, independently reproduced from assembled observations through the 4E/4D bridge |
| Recommendation provenance | Existing helper-evidence and assembly provenance; 4H binds the recommendation’s exact bytes |
| Existing runtime policy | Strict, non-executing parse of `PLAYER_HELPER_REGISTRY` from exact `content.js` bytes |
| Policy ID, runtime family, idle class and style ID | Completed explicit reviewer approval only |

Every command hashes exact bytes before JSON parsing. Repository inputs receive
repository-relative IDs; external inputs receive deterministic hash-derived
IDs. Files merely sharing a directory are never treated as compatible.

## Two-stage offline workflow

`npm run prepare-policy-review` validates the entire evidence chain and writes a
pending `policy-review-template.json`. Pending is not approval and cannot
authorize a diff.

The reviewer may change only `decision`, `implementationChoices`, and
`acknowledgements`. Decisions are:

- `approved`: all bounded implementation choices and acknowledgements are required.
- `rejected`: implementation choices remain null and acknowledgements remain false.
- `changes-requested`: implementation choices remain null and acknowledgements remain false.

The reviewer approves evidence-backed target fields; they cannot replace
matching evidence, selectors, idle delay, identity, hashes, or recommendation
category. Implementation choices are explicitly reviewer-supplied and have
separate provenance.

`npm run generate-policy-diff` revalidates the complete current chain and the
completed review. Approved reviews produce a bounded proposed policy and one of:

- `add-policy` when neither the policy ID nor target identity exists;
- `update-policy` when exactly one compatible policy ID exists and bounded fields differ;
- `no-change` when normalized before and after policies are identical.

Deletion is not supported. Rejected and changes-requested decisions produce
only the verified decision and provenance records.

All diffs use `applicationStatus: not-applied`. Checkpoint 4H never edits
`content.js`; generated policy JSON is unapproved Android work until a separate
checkpoint explicitly applies, builds, and validates it.
