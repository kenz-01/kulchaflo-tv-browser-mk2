#!/usr/bin/env python3
"""Relay a bounded, sanitized ZNS receipt from a completed workflow_run.

This script runs only from the protected default branch in the separate
workflow_run workflow. The source-run artifact is untrusted input; it is never
executed, extracted to disk, or copied verbatim into a PR comment.
"""

import io
import json
import os
import re
import stat
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile

REPOSITORY = "kenz-01/kulchaflo-tv-browser-mk2"
WORKFLOW_PATH = ".github/workflows/tv-cloud-emulator-qualification.yml"
ARTIFACT_NAME = "tv-cloud-emulator-zns"
RECEIPT_NAME = "zns-diagnostic-receipt.json"
MAX_API_BYTES = 1024 * 1024
MAX_ARCHIVE_BYTES = 24 * 1024 * 1024
MAX_RECEIPT_BYTES = 32 * 1024
MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024
MAX_ARCHIVE_FILES = 5
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
ALLOWED_FILES = {
    RECEIPT_NAME,
    "zns-after-launch.png",
    "zns-after-dpad.png",
    "zns-after-back.png",
    "zns-after-failure.png",
}
PHASES = (
    "zns-outer-player-first",
    "zns-embedded-observed",
    "zns-embedded-playing",
    "zns-video-time-advanced",
)
MEDIA_EVENTS = (
    "loadstart", "loadedmetadata", "loadeddata", "canplay", "play", "playing",
    "pause", "waiting", "stalled", "error", "abort", "emptied",
)
STATUSES = {"yes", "no", "unknown"}
DIAGNOSTICS = {
    "target_process", "process_absent", "unavailable", "unparseable", "output_truncated",
    "target_component", "other_component", "entry_missing", "entry_unparsed",
    "ambiguous_components", "too_many_entries", "command_unavailable",
    "input_target_window", "input_other_window", "focus_signal_conflict",
    "command_timeout",
}
FOCUS_SOURCES = {"window_manager", "input_dispatcher", "both", "conflict", "unknown"}
CLASSIFICATIONS = {
    "INFRA_FAILURE", "SOURCE_NOT_OBSERVED", "PLAYER_OBSERVED_NO_PROGRESS",
    "PROGRESSION_OBSERVED", "INCONCLUSIVE",
}
FAILURE_STAGES = {
    "preflight", "workflow_setup", "kvm_preflight", "apk_assembly", "emulator_boot",
    "apk_install", "launch", "required_app_state", "diagnostic_continuation", "interaction_capture",
    "evidence_capture", "log_capture", "emulator_step", "complete",
}
INFRA_STAGES = {
    "preflight", "workflow_setup", "kvm_preflight", "apk_assembly", "emulator_boot", "apk_install", "interaction_capture",
}
LAUNCH_OBSERVATIONS = (
    "browser_session_configured", "browser_view_attached", "zns_navigation_requested",
    "zns_navigation_started", "zns_navigation_completed", "zns_navigation_failed",
)


class RelayError(Exception):
    """A fixed, safe relay failure category; never carries response or URL text."""

    def __init__(self, code):
        super().__init__(code)
        self.code = code


def reject_duplicate_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate_key")
        result[key] = value
    return result


def reject_constant(_value):
    raise ValueError("invalid_json_constant")


def load_json(raw):
    return json.loads(
        raw.decode("utf-8"),
        object_pairs_hook=reject_duplicate_keys,
        parse_constant=reject_constant,
    )


def status(value):
    return value if isinstance(value, str) and value in STATUSES else "unknown"


def diagnostics(value, key):
    state = value if isinstance(value, dict) else {}
    result = state.get(key)
    return result if isinstance(result, str) and result in DIAGNOSTICS else "unavailable"


def focus_source(value):
    state = value if isinstance(value, dict) else {}
    result = state.get("focus_source")
    return result if isinstance(result, str) and result in FOCUS_SOURCES else "unknown"


def safe_checkpoint(value):
    state = value if isinstance(value, dict) else {}
    return {
        "process": status(state.get("process")),
        "activity_foreground": status(state.get("activity_foreground")),
        "window_focus": status(state.get("window_focus")),
    }


def safe_player(value):
    if not isinstance(value, dict):
        return None
    ready = value.get("ready")
    if not isinstance(ready, int) or isinstance(ready, bool) or ready not in range(5):
        return None
    if not isinstance(value.get("paused"), bool) or not isinstance(value.get("muted"), bool):
        return None
    volume = value.get("volume")
    if not isinstance(volume, (int, float)) or isinstance(volume, bool) or not 0 <= volume <= 1:
        return None
    return {"ready": ready, "paused": value["paused"], "muted": value["muted"], "volume": float(volume)}


def safe_media_diagnostics(value):
    state = value if isinstance(value, dict) else {}
    media_error = state.get("media_error_code")
    media_error = media_error if type(media_error) is int and media_error in (1, 2, 3, 4) else None
    network_state = state.get("network_state")
    network_state = network_state if type(network_state) is int and network_state in (0, 1, 2, 3) else None
    boolean = lambda item: item if isinstance(item, bool) else None
    rendered = state.get("rendered")
    rendered = rendered if isinstance(rendered, str) and rendered in STATUSES else "unknown"
    raw_events = state.get("events") if isinstance(state.get("events"), list) else []
    events = list(dict.fromkeys(event for event in raw_events if isinstance(event, str) and event in MEDIA_EVENTS))[:12]
    permissions = []
    raw_permissions = state.get("autoplay_permission_events")
    if isinstance(raw_permissions, list):
        for entry in raw_permissions[:8]:
            if not isinstance(entry, dict) or entry.get("type") not in ("audible", "inaudible"):
                continue
            label = lambda item: item if isinstance(item, str) and item in ("allow", "deny", "other") else "unknown"
            permissions.append({
                "type": entry["type"],
                "requested": label(entry.get("requested")),
                "decision": label(entry.get("decision")),
            })
    return {
        "observed": status(state.get("observed")),
        "network_state": network_state,
        "media_error_code": media_error,
        "error_observed": status(state.get("error_observed")),
        "source_present": boolean(state.get("source_present")),
        "rendered": rendered,
        "autoplay": boolean(state.get("autoplay")),
        "controls": boolean(state.get("controls")),
        "events_observed": status(state.get("events_observed")),
        "events": events,
        "autoplay_permission_observed": status(state.get("autoplay_permission_observed")),
        "autoplay_permission_events": permissions,
    }


def classify_sanitized(report):
    infrastructure = report["infrastructure"]
    checkpoints = report["app_state"]
    stage = report["failure_stage"]
    if stage in INFRA_STAGES or any(value == "no" for value in infrastructure.values()):
        return "INFRA_FAILURE"
    if stage == "launch" and infrastructure["app_launch"] == "no":
        return "INFRA_FAILURE"
    if any(value == "no" for state in checkpoints.values() for value in state.values()):
        return "INFRA_FAILURE"

    base_complete = (
        all(value == "yes" for state in checkpoints.values() for value in state.values())
        and all(value == "yes" for value in infrastructure.values())
        and report["screenshots"]["after_dpad"] == "captured"
        and report["screenshots"]["after_back"] == "captured"
        and report["actions"]["dpad_down_up_dispatched"] == "yes"
        and report["actions"]["back_dispatched"] == "yes"
        and report["diagnostic_continuation"]["mode"] != "passive_focus_unknown"
        and report["log_capture"] == "complete"
    )
    if not base_complete or not report["phases_valid"]:
        return "INCONCLUSIVE"
    phases = report["observation_phases"]
    player = report["player_state"]
    advanced = report["video_time_advanced_observed"] == "yes"
    phase_advanced = "zns-video-time-advanced" in phases
    if advanced != phase_advanced:
        return "INCONCLUSIVE"
    if not phases and player is None:
        return "SOURCE_NOT_OBSERVED"
    if "zns-embedded-observed" not in phases or player is None:
        return "INCONCLUSIVE"
    return "PROGRESSION_OBSERVED" if phase_advanced else "PLAYER_OBSERVED_NO_PROGRESS"


def sanitize_receipt(receipt, head_sha, run_id, attempt, conclusion):
    if not isinstance(receipt, dict):
        raise RelayError("receipt_not_object")
    if type(receipt.get("schema_version")) is not int or receipt.get("schema_version") != 1 or receipt.get("receipt_finalized") is not True:
        raise RelayError("receipt_not_finalized")
    if receipt.get("selected_profile") != "zns":
        raise RelayError("receipt_profile_mismatch")
    if not re.fullmatch(r"[a-fA-F0-9]{40}", str(head_sha)):
        raise RelayError("run_head_invalid")
    if receipt.get("commit") != head_sha:
        raise RelayError("receipt_head_mismatch")
    if not isinstance(run_id, int) or run_id <= 0 or not isinstance(attempt, int) or attempt != 1:
        raise RelayError("run_identity_invalid")
    if not isinstance(conclusion, str) or conclusion not in {"success", "failure", "cancelled", "timed_out", "neutral", "action_required"}:
        raise RelayError("run_conclusion_invalid")

    infrastructure_raw = receipt.get("infrastructure") if isinstance(receipt.get("infrastructure"), dict) else {}
    app_raw = receipt.get("app_state") if isinstance(receipt.get("app_state"), dict) else {}
    diag_raw = receipt.get("app_state_diagnostics") if isinstance(receipt.get("app_state_diagnostics"), dict) else {}
    checkpoints = {name: safe_checkpoint(app_raw.get(name)) for name in ("after_launch", "after_dpad", "after_back")}
    app_diagnostics = {
        name: {
            "pidof": diagnostics(diag_raw.get(name), "pidof"),
            "activity_foreground": diagnostics(diag_raw.get(name), "activity_foreground"),
            "window_focus": diagnostics(diag_raw.get(name), "window_focus"),
            "window_manager_focus": diagnostics(diag_raw.get(name), "window_manager_focus"),
            "input_focus": diagnostics(diag_raw.get(name), "input_focus"),
            "focus_source": focus_source(diag_raw.get(name)),
        }
        for name in ("after_launch", "after_dpad", "after_back", "after_failure")
    }
    shots_raw = receipt.get("screenshots") if isinstance(receipt.get("screenshots"), dict) else {}
    screenshots = {}
    for name in ("after_launch", "after_dpad", "after_back", "after_failure"):
        entry = shots_raw.get(name) if isinstance(shots_raw.get(name), dict) else {}
        shot_status = entry.get("status")
        screenshots[name] = shot_status if isinstance(shot_status, str) and shot_status in {"captured", "missing", "oversize"} else "missing"
    actions_raw = receipt.get("actions") if isinstance(receipt.get("actions"), dict) else {}
    phases_raw = receipt.get("observation_phases")
    phases_valid = isinstance(phases_raw, list) and all(phase in PHASES for phase in phases_raw)
    phases = [phase for phase in PHASES if phases_valid and phase in phases_raw]
    time_advanced = receipt.get("video_time_advanced_observed")
    time_advanced = time_advanced if isinstance(time_advanced, str) and time_advanced in {"yes", "no"} else "unknown"
    player = safe_player(receipt.get("player_state"))
    media_diagnostics = safe_media_diagnostics(receipt.get("media_diagnostics"))
    infra = {
        "emulator_boot": status(infrastructure_raw.get("emulator_boot")),
        "apk_install": status(infrastructure_raw.get("apk_install")),
        "app_launch": status(infrastructure_raw.get("app_launch")),
    }
    failure_stage = receipt.get("failure_stage")
    failure_stage = failure_stage if isinstance(failure_stage, str) and failure_stage in FAILURE_STAGES else "unknown"
    failure_state = safe_checkpoint(receipt.get("failure_state"))
    log_capture = receipt.get("log_capture")
    log_capture = log_capture if isinstance(log_capture, str) and log_capture in {"complete", "incomplete", "truncated"} else "incomplete"
    launch_raw = receipt.get("launch_observations") if isinstance(receipt.get("launch_observations"), dict) else {}
    launch_observations = {name: status(launch_raw.get(name)) for name in LAUNCH_OBSERVATIONS}
    continuation_raw = receipt.get("diagnostic_continuation")
    continuation_raw = continuation_raw if isinstance(continuation_raw, dict) else {}
    continuation_mode = continuation_raw.get("mode")
    continuation = {
        "mode": continuation_mode if continuation_mode in {"not_used", "passive_focus_unknown"} else "not_used",
        "additional_passive_observation": status(continuation_raw.get("additional_passive_observation")),
        "remote_keys_withheld": status(continuation_raw.get("remote_keys_withheld")),
    }
    official_frame_observed = receipt.get("official_frame_observed")
    official_frame_observed = status(official_frame_observed) if isinstance(official_frame_observed, str) and official_frame_observed in STATUSES else "yes" if "zns-outer-player-first" in phases else "no" if log_capture == "complete" else "unknown"
    embed_observed = receipt.get("embed_observed")
    embed_observed = status(embed_observed) if isinstance(embed_observed, str) and embed_observed in STATUSES else "yes" if "zns-embedded-observed" in phases else "no" if log_capture == "complete" else "unknown"

    report = {
        "schema_version": 1,
        "run_id": run_id,
        "run_attempt": attempt,
        "run_conclusion": conclusion,
        "head_sha": head_sha.lower(),
        "selected_profile": "zns",
        "source_observed": any(phase in phases for phase in ("zns-outer-player-first", "zns-embedded-observed")),
        "official_frame_observed": official_frame_observed,
        "embed_observed": embed_observed,
        "infrastructure": infra,
        "launch_status": receipt.get("launch_status") if isinstance(receipt.get("launch_status"), str) and receipt.get("launch_status") in {"confirmed", "failed", "unconfirmed"} else "unknown",
        "launch_observations": launch_observations,
        "diagnostic_continuation": continuation,
        "app_state": checkpoints,
        "app_state_diagnostics": app_diagnostics,
        "failure_state": failure_state,
        "failure_diagnostics": app_diagnostics["after_failure"],
        "screenshots": screenshots,
        "actions": {
            "dpad_down_up_dispatched": status(actions_raw.get("dpad_down_up_dispatched")),
            "back_dispatched": status(actions_raw.get("back_dispatched")),
        },
        "log_capture": log_capture,
        "observation_phases": phases,
        "phases_valid": phases_valid,
        "player_state": player,
        "media_diagnostics": media_diagnostics,
        "video_time_advanced_observed": time_advanced,
        "failure_stage": failure_stage,
        "helper_initiated_playback": False,
        "live_stream_verified": False,
        "moving_picture_verified": False,
        "audio_output_verified": False,
        "physical_bravia_verified": False,
    }
    report["classification"] = classify_sanitized(report)
    report["classification_consistent"] = receipt.get("classification") == report["classification"]
    encoded = json.dumps(report, separators=(",", ":"), sort_keys=True).encode("utf-8")
    if len(encoded) > 8 * 1024:
        raise RelayError("sanitized_receipt_too_large")
    return report


def safe_zip_receipt(archive_bytes):
    if len(archive_bytes) > MAX_ARCHIVE_BYTES:
        raise RelayError("artifact_archive_too_large")
    try:
        with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
            entries = archive.infolist()
            if not entries or len(entries) > MAX_ARCHIVE_FILES:
                raise RelayError("artifact_file_count_invalid")
            names = [entry.filename for entry in entries]
            if len(names) != len(set(names)) or RECEIPT_NAME not in names:
                raise RelayError("artifact_files_invalid")
            for entry in entries:
                if entry.filename not in ALLOWED_FILES or "/" in entry.filename or "\\" in entry.filename:
                    raise RelayError("artifact_path_invalid")
                mode = entry.external_attr >> 16
                if stat.S_ISLNK(mode) or entry.flag_bits & 0x1:
                    raise RelayError("artifact_entry_unsafe")
                limit = MAX_RECEIPT_BYTES if entry.filename == RECEIPT_NAME else MAX_SCREENSHOT_BYTES
                if entry.file_size < 0 or entry.file_size > limit:
                    raise RelayError("artifact_entry_too_large")
                if entry.compress_size > MAX_ARCHIVE_BYTES:
                    raise RelayError("artifact_entry_too_large")
            for entry in entries:
                if entry.filename.endswith(".png"):
                    with archive.open(entry) as image:
                        if image.read(len(PNG_SIGNATURE)) != PNG_SIGNATURE:
                            raise RelayError("artifact_screenshot_invalid")
            info = archive.getinfo(RECEIPT_NAME)
            with archive.open(info) as stream:
                raw = stream.read(MAX_RECEIPT_BYTES + 1)
            if len(raw) > MAX_RECEIPT_BYTES:
                raise RelayError("receipt_too_large")
            return load_json(raw)
    except RelayError:
        raise
    except (OSError, zipfile.BadZipFile, RuntimeError, ValueError, json.JSONDecodeError):
        raise RelayError("artifact_archive_invalid") from None


class StopRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, _request, _fp, _code, _message, _headers, _newurl):
        return None


def api_json(path, method="GET", body=None):
    token = os.environ.get("GITHUB_TOKEN", "")
    if not token:
        raise RelayError("api_token_unavailable")
    data = None if body is None else json.dumps(body, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(
        "https://api.github.com" + path,
        data=data,
        method=method,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "kulchaflo-tv-zns-evidence-relay",
            **({"Content-Type": "application/json"} if data is not None else {}),
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read(MAX_API_BYTES + 1)
    except (urllib.error.URLError, TimeoutError, OSError):
        raise RelayError("github_api_unavailable") from None
    if len(raw) > MAX_API_BYTES:
        raise RelayError("github_api_response_too_large")
    try:
        return load_json(raw)
    except (ValueError, UnicodeError, json.JSONDecodeError):
        raise RelayError("github_api_response_invalid") from None


def artifact_zip(url):
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {os.environ.get('GITHUB_TOKEN', '')}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "kulchaflo-tv-zns-evidence-relay",
        },
    )
    opener = urllib.request.build_opener(StopRedirect)
    try:
        opener.open(request, timeout=20)
        raise RelayError("artifact_redirect_missing")
    except urllib.error.HTTPError as response:
        if response.code not in {301, 302, 303, 307, 308}:
            raise RelayError("artifact_download_unavailable") from None
        location = response.headers.get("Location", "")
        response.close()
    except (urllib.error.URLError, TimeoutError, OSError):
        raise RelayError("artifact_download_unavailable") from None
    parsed = urllib.parse.urlsplit(location)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not re.fullmatch(r"productionresultssa[0-9]+\.blob\.core\.windows\.net", host):
        raise RelayError("artifact_redirect_host_invalid")
    if parsed.username or parsed.password or not parsed.path.startswith("/actions-results/"):
        raise RelayError("artifact_redirect_url_invalid")
    # The GitHub token is deliberately not sent to the signed Azure URL.
    try:
        blob_opener = urllib.request.build_opener(StopRedirect)
        with blob_opener.open(urllib.request.Request(location), timeout=30) as response:
            length = response.headers.get("Content-Length")
            if length and int(length) > MAX_ARCHIVE_BYTES:
                raise RelayError("artifact_archive_too_large")
            chunks = []
            total = 0
            while True:
                chunk = response.read(64 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_ARCHIVE_BYTES:
                    raise RelayError("artifact_archive_too_large")
                chunks.append(chunk)
            return b"".join(chunks)
    except RelayError:
        raise
    except (urllib.error.URLError, TimeoutError, OSError):
        raise RelayError("artifact_download_unavailable") from None


def validate_run_provenance(run, repo, workflow_id, workflow, branch):
    if repo != REPOSITORY:
        raise RelayError("repository_mismatch")
    if not isinstance(run, dict) or run.get("event") != "workflow_dispatch" or run.get("status") != "completed":
        raise RelayError("run_event_invalid")
    if not isinstance(workflow, dict):
        raise RelayError("workflow_provenance_mismatch")
    if run.get("workflow_id") != workflow_id or workflow.get("id") != workflow_id or workflow.get("path") != WORKFLOW_PATH or workflow.get("state") != "active":
        raise RelayError("workflow_provenance_mismatch")
    head_repository = run.get("head_repository")
    if not isinstance(head_repository, dict) or head_repository.get("full_name") != repo:
        raise RelayError("fork_run_not_relayed")
    if not re.fullmatch(r"[a-fA-F0-9]{40}", str(run.get("head_sha", ""))):
        raise RelayError("run_head_invalid")
    if not isinstance(branch, str) or run.get("head_branch") != branch or branch == "main" or not re.fullmatch(r"[A-Za-z0-9._/-]{1,100}", branch):
        raise RelayError("run_branch_invalid")
    if run.get("run_attempt") != 1:
        raise RelayError("run_attempt_invalid")


def matching_pr(repo, head_sha):
    items = api_json(f"/repos/{repo}/commits/{head_sha}/pulls?per_page=100")
    if not isinstance(items, list) or len(items) >= 100:
        raise RelayError("pull_request_lookup_invalid")
    matches = [
        item for item in items
        if isinstance(item, dict)
        and item.get("state") == "open"
        and item.get("draft") is True
        and item.get("head", {}).get("sha") == head_sha
        and (item.get("head", {}).get("repo") or {}).get("full_name") == repo
        and item.get("base", {}).get("ref") == "main"
    ]
    if len(matches) != 1:
        raise RelayError("matching_draft_pr_not_unique")
    return matches[0]


def comment_marker(run_id):
    return f"<!-- tv-zns-evidence run={run_id} attempt=1 -->"


def comment_exists(repo, issue_number, marker):
    for page in range(1, 6):
        items = api_json(f"/repos/{repo}/issues/{issue_number}/comments?per_page=100&page={page}")
        if not isinstance(items, list):
            raise RelayError("comment_lookup_invalid")
        if any(isinstance(item, dict) and marker in str(item.get("body", "")) for item in items):
            return True
        if len(items) < 100:
            return False
    raise RelayError("comment_history_limit")


def comment_body(report, marker):
    safe_json = json.dumps(report, indent=2, sort_keys=True)
    body = (
        marker
        + "\n## Sanitized ZNS emulator diagnostic\n\n"
        + "This is a bounded report from the candidate run. The receipt and observations are untrusted test output, not independent playback acceptance.\n\n"
        + f"- Run: `{report['run_id']}` (`{report['run_conclusion']}`)\n"
        + f"- Head: `{report['head_sha']}`\n"
        + f"- Classification: `{report['classification']}`\n"
        + f"- Failure stage: `{report['failure_stage']}`\n"
        + "- Live stream, visible moving picture, audio, and physical Bravia remain unverified.\n\n"
        + "```json\n"
        + safe_json
        + "\n```"
    )
    if len(body.encode("utf-8")) > 12 * 1024:
        raise RelayError("comment_body_too_large")
    return body


def run_relay():
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    run_id = int(os.environ.get("TV_RUN_ID", "0"))
    workflow_id = int(os.environ.get("TV_RUN_WORKFLOW_ID", "0"))
    attempt = int(os.environ.get("TV_RUN_ATTEMPT", "0"))
    head_sha = os.environ.get("TV_RUN_HEAD_SHA", "")
    branch = os.environ.get("TV_RUN_HEAD_BRANCH", "")
    if repo != REPOSITORY or run_id <= 0 or workflow_id <= 0:
        raise RelayError("workflow_event_identity_invalid")

    run = api_json(f"/repos/{repo}/actions/runs/{run_id}")
    if run.get("id") != run_id:
        raise RelayError("run_id_mismatch")
    actual_workflow_id = run.get("workflow_id")
    if actual_workflow_id != workflow_id or run.get("head_sha") != head_sha or run.get("head_branch") != branch or run.get("run_attempt") != attempt:
        raise RelayError("event_run_mismatch")
    workflow = api_json(f"/repos/{repo}/actions/workflows/{workflow_id}")
    validate_run_provenance(run, repo, workflow_id, workflow, branch)
    if not re.fullmatch(r"[a-fA-F0-9]{40}", head_sha):
        raise RelayError("run_head_invalid")
    pull = matching_pr(repo, head_sha)

    artifact_response = api_json(f"/repos/{repo}/actions/runs/{run_id}/artifacts?per_page=100")
    artifacts = artifact_response.get("artifacts") if isinstance(artifact_response, dict) else None
    if not isinstance(artifacts, list) or len(artifacts) >= 100:
        raise RelayError("artifact_lookup_invalid")
    matches = [item for item in artifacts if item.get("name") == ARTIFACT_NAME and item.get("expired") is False]
    if len(matches) != 1:
        raise RelayError("zns_artifact_missing_or_ambiguous")
    artifact = matches[0]
    size = artifact.get("size_in_bytes")
    artifact_id = artifact.get("id")
    if not isinstance(size, int) or size <= 0 or size > MAX_ARCHIVE_BYTES or not isinstance(artifact_id, int):
        raise RelayError("artifact_metadata_invalid")
    archive = artifact_zip(f"https://api.github.com/repos/{repo}/actions/artifacts/{artifact_id}/zip")
    receipt = safe_zip_receipt(archive)
    report = sanitize_receipt(receipt, head_sha, run_id, attempt, run.get("conclusion"))
    marker = comment_marker(run_id)
    if comment_exists(repo, pull.get("number"), marker):
        print(f"evidence_already_relayed run={run_id} pr={pull['number']}")
        return 0
    api_json(
        f"/repos/{repo}/issues/{pull['number']}/comments",
        method="POST",
        body={"body": comment_body(report, marker)},
    )
    print(f"sanitized_evidence_relayed run={run_id} pr={pull['number']}")
    return 0


def main():
    if sys.argv[1:] == ["--sanitize-json"]:
        try:
            raw = sys.stdin.buffer.read(MAX_RECEIPT_BYTES + 1)
            if len(raw) > MAX_RECEIPT_BYTES:
                raise RelayError("receipt_too_large")
            receipt = load_json(raw)
            sha = os.environ.get("TV_TEST_HEAD_SHA", "")
            run_id = int(os.environ.get("TV_TEST_RUN_ID", "1"))
            attempt = int(os.environ.get("TV_TEST_ATTEMPT", "1"))
            conclusion = os.environ.get("TV_TEST_CONCLUSION", "failure")
            print(json.dumps(sanitize_receipt(receipt, sha, run_id, attempt, conclusion), sort_keys=True))
            return 0
        except (RelayError, ValueError, UnicodeError, json.JSONDecodeError) as error:
            code = error.code if isinstance(error, RelayError) else "receipt_invalid"
            print(code, file=sys.stderr)
            return 2
    if sys.argv[1:] == ["--validate-run-json"]:
        try:
            raw = sys.stdin.buffer.read(MAX_API_BYTES + 1)
            if len(raw) > MAX_API_BYTES:
                raise RelayError("fixture_too_large")
            fixture = load_json(raw)
            run = fixture.get("run", {})
            workflow = fixture.get("workflow", {})
            repo = fixture.get("repo", "")
            workflow_id = fixture.get("workflow_id")
            branch = fixture.get("branch", "")
            validate_run_provenance(run, repo, workflow_id, workflow, branch)
            print(json.dumps({"valid": True, "head_sha": run["head_sha"]}))
            return 0
        except (RelayError, ValueError, UnicodeError, json.JSONDecodeError, AttributeError) as error:
            code = error.code if isinstance(error, RelayError) else "run_fixture_invalid"
            print(code, file=sys.stderr)
            return 2
    if len(sys.argv) == 3 and sys.argv[1] == "--sanitize-archive":
        try:
            with open(sys.argv[2], "rb") as stream:
                archive = stream.read(MAX_ARCHIVE_BYTES + 1)
            receipt = safe_zip_receipt(archive)
            sha = os.environ.get("TV_TEST_HEAD_SHA", "")
            report = sanitize_receipt(receipt, sha, 1, 1, "failure")
            print(json.dumps(report, sort_keys=True))
            return 0
        except (OSError, RelayError, ValueError, UnicodeError, json.JSONDecodeError) as error:
            code = error.code if isinstance(error, RelayError) else "artifact_invalid"
            print(code, file=sys.stderr)
            return 2
    try:
        return run_relay()
    except Exception:
        # Never echo API bodies, signed URLs, artifact paths, or untrusted content.
        print("zns_evidence_relay_failed", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
