# Checkpoint 4I-A policy application preparation

Checkpoint 4I-A prepares an approved policy change; it does not apply one. Its
inputs are the secured Checkpoint 4H review decision, diff provenance, policy
diff, optional proposed policy, and the exact runtime source those artifacts
bind.

The command verifies the complete exact-byte chain before allocating output:

```text
npm run prepare-policy-application -- \
  --review-decision <policy-review-decision.json> \
  --diff-provenance <policy-diff-provenance.json> \
  --policy-diff <player-helper-policy-diff.json> \
  --proposed-policy <proposed-player-helper-policy.json> \
  --runtime-source <content.js> \
  --output-dir <approved-output-root>
```

`--proposed-policy` is optional only for `no-change`. All inputs are read
offline as regular non-symlink files after physical-path verification. The
application plan binds their exact SHA-256 values.

## Preparation is not application

The real Android `content.js` is read-only in 4I-A. The preparation engine has
no operation that writes, copies, renames, patches, builds, installs, or runs
that file. Outputs are staged only under an approved Player Lab output root,
and every plan retains `applicationStatus: not-applied`.

For `no-change`, the current registry policy must equal both `policyBefore` and
`policyAfter`, and the changed-field list must be empty. The before and
prepared hashes are identical, `writeRequired` is false, and no
`prepared-content.js` is emitted.

For `add-policy`, one deterministically rendered frozen policy is appended
without reordering or changing existing policies. For `update-policy`, exactly
one compatible policy block is replaced in its existing position. The
renderer has fixed fields, ordering, indentation, JSON string escaping, and
bounded runtime values; it cannot emit arbitrary JavaScript.

The manifest records exact before/prepared hashes and sizes, policy IDs and
counts, the bounded changed byte range, and confirmation that bytes outside
that range are unchanged. Prepared output is reparsed by the secured registry
parser before it is emitted.

Synthetic add/update fixtures are test evidence only and must never be applied
to the real Android runtime. Checkpoint 4I-B requires a genuine approved real
add/update diff before replacing Android source. Android building, installation,
and device validation remain separate later work.
