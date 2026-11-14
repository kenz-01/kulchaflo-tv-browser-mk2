# ZNS emulator diagnostic and evidence access

## Recovered first-run finding

The first source diagnostic, run `42909190649` on `2bc891bc4cde04cb6930bdc2c56fc192e4a5d1b2`, booted the Android TV API 36 x86_64 emulator, installed the universal GeckoView APK, and launched the app. Its first required state was process `yes`, foreground `yes`, and window focus `no`. The old parser assigned `no` whenever it failed to find the target package in filtered `dumpsys` output, so that receipt could not distinguish an actually focused other window from an absent or unparseable focus entry. The assertion stopped before D-pad/Back, screenshots, and the source observation; no ZNS playback failure was demonstrated.

The exit summary also placed Markdown backticks inside double-quoted shell strings. Bash treated the text inside them as command substitutions, producing `command not found` errors while writing the summary.

## Failure-time diagnostics

The ZNS harness now records `am start -W` as `confirmed`, `failed`, or `unconfirmed`. It captures the post-launch screenshot before the first app-state assertion, and captures D-pad/Back screenshots before their respective assertions. On any later failure, its EXIT handler makes one bounded best-effort capture of the current state, an additional failure screenshot, and the filtered `GvMedia` log snapshot before writing the receipt.

Android process, resumed-activity, and focused-window diagnostics are capped at 64 KiB per source and reduced in memory to fixed status values. The receipt contains no raw `pidof`, `dumpsys`, or logcat lines. Focus is `no` only when a recognized other Android component is present; a missing, truncated, ambiguous, or unparseable entry remains `unknown`. Screenshots are capped at 4 MiB each. Media phases, readiness, network state, error code, source-presence bit, rendered status, finite media events, and ZNS autoplay permission type/request/decision are allowlisted; URLs, error messages, and raw logs are not stored or uploaded. The permission observation does not change the permission decision. The official-frame phase and embedded-frame phase remain separate, and neither implies time progression.

The summary is written with `printf` format strings, so Markdown backticks remain literal. A required-state failure with an actual `no` remains `INFRA_FAILURE`; a missing focus parse is `INCONCLUSIVE` while retaining the precise failure stage and redacted parser status.

## Bounded navigation feedback

After launch, the ZNS profile captures an initial frame, then polls the bounded log snapshot for navigation, iframe, helper, and media state changes. Each page attempt has at most 15 polls, a 2-second interval, a 45-second navigation window, and a 6-second cap per log snapshot. The loop ends early on observed media-time advancement, a top-level navigation failure, or an embedded-player observation followed by five additional polls. It allows at most one recovery navigation, and only when navigation started or the official outer frame appeared but the scoped embedded helper did not. That recovery reuses the exact official ZNS URL through `onNewIntent`/`GeckoSession.loadUri`; it does not press Play or change mute or volume.

The parent helper reports when it attaches a one-shot `iframe` load listener and whether that event occurs afterward. The child helper reports execution only for the exact HTTPS StreamcoMedia route with a ZNS referrer, before looking for a visible video. These observations distinguish outer-frame presence, a subsequent iframe `load` event, scoped helper execution, and video-state observation. No observed `load` event after listener attachment does not prove the frame failed to load; a load may have occurred before the listener was attached, and cross-origin child state remains inaccessible.

Each attempt records sanitized before/after navigation and player observations in `zns-diagnostic-receipt.json`. Its four possible attempt screenshots are uploaded in the separate `tv-cloud-emulator-zns-navigation-attempts` artifact. The original `tv-cloud-emulator-zns` artifact retains its strict five-file root allowlist for the trusted relay. Both artifacts expire after one day. The receipt reports harness completion, whether an allowlisted media error code established a diagnostic category, actual media-time progression, and physical-TV acceptance separately. Physical-TV acceptance is always `not_tested` in this emulator workflow.

## Codex feedback cycle boundary

In a continuing Codex task, the local loop is: inspect the prior receipt, make a source change, run the Player Lab checks and Universal Debug build, create a draft PR, wait for review, dispatch the existing emulator workflow on that PR head, poll the run, download both artifacts, compare the receipt with the prior run, and make at most one justified correction/retest within that task's budget. The post-review budget is at most two hosted runs and one follow-up source correction; stop sooner when evidence establishes success or a dependency outside the app. The emulator workflow itself never receives a write token; only `contents: read` is granted, and the separate trusted-main relay remains unchanged.

The current Codex shell can read run metadata and retrieve existing Actions artifacts with `gh`, and it can stay active while a dispatched workflow is polled and completed. The available token authenticated as the repository owner, but its Actions write grant is not exposed by the read-only checks performed here. Dispatch was not attempted before review, so dispatch capability is unverified; an actual approved dispatch is the first safe way to confirm it. No persistent unattended agent or paid API is needed. If the approved task's token lacks Actions write access, the smallest missing capability is Actions write permission in the Codex shell session for this repository; artifact reads already work. It must stay out of runner jobs and carry no contents, PR, or issue write permission.

## Trusted-main evidence relay

`.github/workflows/tv-zns-evidence-relay.yml` listens only for completion of the known TV emulator workflow on `codex/**` refs. It runs separately on trusted `main`, checks out `main`, verifies the workflow ID/path, dispatch event, same-repository branch, run attempt, exact SHA, and a unique open draft PR whose head matches that SHA. It reads only that run's `tv-cloud-emulator-zns` artifact.

The relay job alone receives `actions: read`, `pull-requests: read`, and `issues: write` (plus `contents: read` for trusted script checkout). The candidate emulator workflow receives no issue/PR write token. The relay does not check out or execute PR code. It treats the artifact as hostile data, enforces archive/file/size bounds, rejects unsafe paths and duplicate JSON keys, validates the receipt schema, and emits only allowlisted scalar values in one deduplicated PR comment. It never includes raw logs, signed artifact URLs, arbitrary receipt text, or screenshot bytes. The comment labels the result as untrusted candidate-run diagnostics, not independent playback acceptance. A repeated `workflow_run` delivery for the same attempt is deduplicated by run ID; attempts after the first fail closed.

Because `workflow_run` workflows must exist on the default branch to run, this relay remains inert while this PR is draft/unmerged. It does not dispatch or retry an emulator job. No new emulator run was made for this change.

## Minimum Codex download-host allowlist for original evidence

GitHub API metadata is available through `api.github.com`, but original job logs and Actions ZIP artifacts redirect to separate hosts. The two recovered runs have used these exact download hosts:

- `results-receiver.actions.githubusercontent.com` — job log archive redirects.
- `productionresultssa19.blob.core.windows.net` — run `42909190649` artifact redirect.
- `productionresultssa31.blob.core.windows.net` — earlier recovered Actions artifact redirect.

For those existing receipts, these exact three host entries are the minimum observed additions needed for Codex to inspect the original logs and screenshots. Azure's `productionresultssaNN` shard can vary for future artifacts; add only the exact shard hostname observed in a new GitHub redirect. Do not use `*.blob.core.windows.net`. This is documentation only: it does not change the Codex environment allowlist. The trusted GitHub-hosted relay uses its own runner egress and does not require these hosts in Codex.

The emulator remains configured with `-noaudio`; neither time progression nor receipt data establishes visible moving picture, audible output, or physical Sony Bravia acceptance.
