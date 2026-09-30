# TV AI recovery control-plane audit — 30 September 2026

## Accepted facts

- GitHub-hosted Copilot CLI invocation using the repository's short-lived GitHub token and `copilot-requests: write` was commissioned successfully.
- PR #12 introduced a read-only recovery artifact worker. Its commissioning merge did not produce an observable recovery run, so a workflow-file push is not accepted as a durable wake mechanism.
- Issue #10 remains the only active recovery contract.

## Steady-state transition

1. Owner/trusted control plane posts `TV_RECOVERY_RUN issue=10` on Issue #10.
2. `tv-recovery-artifact-worker.yml` runs on the issue-comment event with repository read access only.
3. Copilot CLI reconciles existing lineage in an ephemeral checkout and exports a binary patch plus status as an Actions artifact.
4. The artifact is independently inspected against Issue #10 and exact base SHA.
5. Trusted GitHub authority publishes only an accepted candidate; normal deterministic TV CI runs on the resulting PR head.
6. One bounded independent final-head review follows. At most one coherent repair generation is allowed before escalation.
7. Physical-TV evidence remains a separate boundary. Release/store/production remains explicit human authority.

## Fail-closed conditions

Stop rather than substitute another provider when Copilot quota is exhausted, the artifact is missing/ambiguous, exact base identity changed, the patch crosses the Issue #10 contract, or physical/product/release authority is required.

## Recovery truth

The recovery is reconciliation, not reimplementation. Anchor on `8422ebc9e0ad9cc7f23dc0b2fb5d5aa95744a137`, preserve legitimate descendant helper work, and exclude the later unvalidated AGP/Gradle edits. Historical PRs #1–#5 are evidence/lineage assets and must not be merged wholesale.
