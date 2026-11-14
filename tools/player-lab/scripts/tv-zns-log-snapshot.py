#!/usr/bin/env python3
"""Keep only bounded, allowlisted ZNS phase and player-state log observations."""

import json
import os
import re
import selectors
import subprocess
import sys
import time
from urllib.parse import urlsplit

MAX_LOG_BYTES = 64 * 1024
MAX_LOG_SCAN_BYTES = 1024 * 1024
MAX_LOG_LINE_BYTES = 8192
LOG_CAPTURE_TIMEOUT_SECONDS = 8
PHASES = (
    "zns-outer-player-first",
    "zns-embedded-observed",
    "zns-embedded-playing",
    "zns-video-time-advanced",
)
PHASE_SET = set(PHASES)
MEDIA_EVENTS = (
    "loadstart", "loadedmetadata", "loadeddata", "canplay", "play", "playing",
    "pause", "waiting", "stalled", "error", "abort", "emptied",
)
LIFECYCLE_PHASES = {
    "zns-outer-frame-load-watch-attached": "iframe_load_watch_attached",
    "zns-outer-frame-load-observed": "iframe_load_event_after_watch",
    "zns-embedded-helper-active": "embedded_helper_active_observed",
}
PHASE_PATTERN = re.compile(r"^zns helper phase=([a-z0-9-]+) mode=browser-first")
STATE_PATTERN = re.compile(
    r"^zns helper phase=zns-embedded-observed mode=browser-first "
    r"ready=([0-4]) paused=(true|false) muted=(true|false) "
    r"volume=(0(?:\.\d+)?|1(?:\.0+)?)"
)
MEDIA_STATE_PATTERN = re.compile(
    r"\bnetworkState=([0-3]) mediaError=(-1|[0-4]) sourcePresent=(true|false) "
    r"rendered=(yes|no|unknown) autoplay=(true|false) controls=(true|false)"
)
MEDIA_SNAPSHOT_PREFIX = re.compile(
    r"^(?:zns helper phase=zns-embedded-observed mode=browser-first|"
    r"zns media event=(?:loadstart|loadedmetadata|loadeddata|canplay|play|playing|"
    r"pause|waiting|stalled|error|abort|emptied))\b"
)
MEDIA_EVENT_PATTERN = re.compile(r"^zns media event=([a-z]+)\b")
AUTOPLAY_PERMISSION_PATTERN = re.compile(
    r"^zns autoplay permission type=(audible|inaudible) "
    r"requested=(allow|deny|other) decision=(allow|deny|other)\b"
)
APP_LOG_TAG = re.compile(r"\b[VDIWEF]\s+KfMkIIGV:(GvMedia|GvNav|GvContent|GvTabs):\s*(.*)$")
LEGACY_APP_LOG_TAG = re.compile(r"\b[VDIWEF]/(GvMedia|GvNav|GvContent|GvTabs):\s*(.*)$")
URL_PATTERN = re.compile(r"\b(?:url|uri)=(https?://[^\s]+)")


def zns_root_url_in(message):
    match = URL_PATTERN.search(message)
    if not match:
        return False
    raw_url = match.group(1).rstrip(".,;)]}")
    try:
        parsed = urlsplit(raw_url)
        host = (parsed.hostname or "").lower().removeprefix("www.")
        return (
            parsed.scheme.lower() == "https"
            and host == "znsbahamas.com"
            and parsed.path.rstrip("/") in ("", "/")
            and parsed.username is None
            and parsed.password is None
            and parsed.port in (None, 443)
        )
    except ValueError:
        return False


def sanitize(text, capture_status="complete"):
    phases = []
    player_state = None
    media_state = None
    media_events = set()
    autoplay_permissions = []
    observed = set()
    lifecycle = set()
    for line in text.splitlines():
        tag_match = APP_LOG_TAG.search(line) or LEGACY_APP_LOG_TAG.search(line)
        if not tag_match:
            continue
        tag, message = tag_match.groups()
        if tag == "GvMedia":
            phase_match = PHASE_PATTERN.match(message)
            if phase_match:
                phase = phase_match.group(1)
                if phase in PHASE_SET and phase not in phases:
                    phases.append(phase)
                if phase in LIFECYCLE_PHASES:
                    lifecycle.add(LIFECYCLE_PHASES[phase])
            state_match = STATE_PATTERN.match(message)
            if state_match:
                phases.append("zns-embedded-observed") if "zns-embedded-observed" not in phases else None
                player_state = {
                    "ready": int(state_match.group(1)),
                    "paused": state_match.group(2) == "true",
                    "muted": state_match.group(3) == "true",
                    "volume": float(state_match.group(4)),
                }
            media_match = MEDIA_STATE_PATTERN.search(message) if MEDIA_SNAPSHOT_PREFIX.match(message) else None
            if media_match:
                network_state, error_code, source_present, rendered, autoplay, controls = media_match.groups()
                media_error_code = int(error_code)
                media_state = {
                    "network_state": int(network_state),
                    "media_error_code": media_error_code if media_error_code in (1, 2, 3, 4) else None,
                    "error_observed": "yes" if media_error_code in (1, 2, 3, 4) else "no" if media_error_code == 0 else "unknown",
                    "source_present": source_present == "true",
                    "rendered": rendered,
                    "autoplay": autoplay == "true",
                    "controls": controls == "true",
                }
            event_match = MEDIA_EVENT_PATTERN.match(message)
            if event_match and event_match.group(1) in MEDIA_EVENTS:
                media_events.add(event_match.group(1))
            permission_match = AUTOPLAY_PERMISSION_PATTERN.match(message)
            if permission_match:
                permission = dict(zip(("type", "requested", "decision"), permission_match.groups()))
                if permission not in autoplay_permissions and len(autoplay_permissions) < 8:
                    autoplay_permissions.append(permission)
        if tag == "GvTabs":
            if "session configured " in message:
                observed.add("browser_session_configured")
            if "tab activated " in message:
                observed.add("browser_view_attached")
            if "tab created " in message and zns_root_url_in(message):
                observed.add("zns_navigation_requested")
        if tag == "GvNav":
            if "launch url loaded " in message and zns_root_url_in(message):
                observed.add("zns_navigation_requested")
            if "page start " in message and zns_root_url_in(message):
                observed.add("zns_navigation_requested")
                observed.add("zns_navigation_started")
            if "page stop " in message and zns_root_url_in(message):
                if re.search(r"\bsuccess=true\b", message):
                    observed.add("zns_navigation_completed")
                elif re.search(r"\bsuccess=false\b", message):
                    observed.add("zns_navigation_failed")
            if "load error " in message and zns_root_url_in(message):
                observed.add("zns_navigation_failed")
    phases = [phase for phase in PHASES if phase in phases]
    capture_complete = capture_status == "complete"
    lifecycle_observations = {
        name: ("yes" if name in lifecycle else "no") if capture_complete else ("yes" if name in lifecycle else "unknown")
        for name in LIFECYCLE_PHASES.values()
    }
    media_observed = "yes" if media_state is not None else "no" if capture_complete else "unknown"
    events_observed = "yes" if media_events else "no" if media_state is not None and capture_complete else "unknown"
    media_diagnostics = {
        "observed": media_observed,
        "network_state": media_state["network_state"] if media_state else None,
        "media_error_code": media_state["media_error_code"] if media_state else None,
        "error_observed": media_state["error_observed"] if media_state else "unknown",
        "source_present": media_state["source_present"] if media_state else None,
        "rendered": media_state["rendered"] if media_state else "unknown",
        "autoplay": media_state["autoplay"] if media_state else None,
        "controls": media_state["controls"] if media_state else None,
        "events_observed": events_observed,
        "events": [event for event in MEDIA_EVENTS if event in media_events],
        "autoplay_permission_observed": "yes" if autoplay_permissions else "no" if media_state is not None and capture_complete else "unknown",
        "autoplay_permission_events": autoplay_permissions,
    }
    launch_observations = {
        name: ("yes" if name in observed else "no")
        if capture_status == "complete" else ("yes" if name in observed else "unknown")
        for name in (
            "browser_session_configured",
            "browser_view_attached",
            "zns_navigation_requested",
            "zns_navigation_started",
            "zns_navigation_completed",
            "zns_navigation_failed",
        )
    }
    return {
        "capture_status": capture_status if capture_status in ("complete", "truncated", "incomplete") else "incomplete",
        "observation_phases": phases,
        "official_frame_observed": "yes" if "zns-outer-player-first" in phases else "no" if capture_complete else "unknown",
        "embed_observed": "yes" if "zns-embedded-observed" in phases else "no" if capture_complete else "unknown",
        "iframe_load_watch_attached": lifecycle_observations["iframe_load_watch_attached"],
        "iframe_load_event_after_watch": lifecycle_observations["iframe_load_event_after_watch"],
        "embedded_helper_active_observed": lifecycle_observations["embedded_helper_active_observed"],
        "player_state": player_state,
        "media_diagnostics": media_diagnostics,
        "video_time_advanced_observed": "yes" if "zns-video-time-advanced" in phases else "no",
        "launch_observations": launch_observations,
    }


def capture_logcat():
    try:
        pid_result = subprocess.run(
            ["adb", "shell", "pidof", "com.kulchaflo.tv.mk2.gv"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=3,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return sanitize("", "incomplete")
    pid_text = pid_result.stdout.decode("ascii", errors="ignore").strip().split()
    if pid_result.returncode != 0 or not pid_text or not re.fullmatch(r"\d{1,10}", pid_text[0]):
        return sanitize("", "incomplete")
    try:
        process = subprocess.Popen(
            # Read the retained app log from the earlier logcat clear. A
            # fixed tail count could silently discard the initial navigation
            # lines while still looking like a complete capture.
            ["adb", "logcat", "-d", "--pid", pid_text[0]],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
    except OSError:
        return sanitize("", "incomplete")

    deadline = time.monotonic() + LOG_CAPTURE_TIMEOUT_SECONDS
    truncated = False
    scanned_bytes = 0
    pending = bytearray()
    discarding_long_line = False
    selected_lines = []
    selected_bytes = 0

    def retain_selected_line(line):
        nonlocal selected_bytes, truncated
        encoded_size = len(line.encode("utf-8", errors="replace")) + 1
        if selected_bytes + encoded_size > MAX_LOG_BYTES:
            truncated = True
            return
        selected_lines.append(line)
        selected_bytes += encoded_size

    with selectors.DefaultSelector() as selector:
        selector.register(process.stdout, selectors.EVENT_READ)
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0 or not selector.select(remaining):
                process.kill()
                process.wait()
                process.stdout.close()
                return sanitize("\n".join(selected_lines), "incomplete")
            chunk = os.read(process.stdout.fileno(), 8192)
            if not chunk:
                break
            scanned_bytes += len(chunk)
            if scanned_bytes > MAX_LOG_SCAN_BYTES:
                truncated = True
                process.kill()
                process.wait()
                break
            for byte in chunk:
                if byte == 10:
                    if not discarding_long_line:
                        line = bytes(pending).decode("utf-8", errors="replace")
                        if APP_LOG_TAG.search(line) or LEGACY_APP_LOG_TAG.search(line):
                            retain_selected_line(line)
                    pending.clear()
                    discarding_long_line = False
                    continue
                if discarding_long_line:
                    continue
                pending.append(byte)
                if len(pending) > MAX_LOG_LINE_BYTES:
                    truncated = True
                    pending.clear()
                    discarding_long_line = True
    if pending and not discarding_long_line:
        line = bytes(pending).decode("utf-8", errors="replace")
        if APP_LOG_TAG.search(line) or LEGACY_APP_LOG_TAG.search(line):
            retain_selected_line(line)
    process.stdout.close()
    if truncated:
        return sanitize("\n".join(selected_lines), "truncated")
    try:
        return_code = process.wait(timeout=max(0.1, deadline - time.monotonic()))
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()
        return sanitize("\n".join(selected_lines), "incomplete")
    status = "complete" if return_code == 0 else "incomplete"
    return sanitize("\n".join(selected_lines), status)


def main():
    if sys.argv[1:] == ["--parse"]:
        raw = sys.stdin.buffer.read(MAX_LOG_BYTES + 1)
        too_large = len(raw) > MAX_LOG_BYTES
        report = sanitize(raw[:MAX_LOG_BYTES].decode("utf-8", errors="replace"), "truncated" if too_large else "complete")
    elif sys.argv[1:] == ["capture"]:
        report = capture_logcat()
    else:
        print("usage: tv-zns-log-snapshot.py capture|--parse", file=sys.stderr)
        return 2
    print(json.dumps(report, separators=(",", ":"), sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
