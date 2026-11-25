#!/usr/bin/env python3
"""Extract fixed Telesistema and Gecko browser-media observations from logcat."""

import json
import os
import re
import selectors
import subprocess
import sys
import time
from urllib.parse import urlsplit

MAX_LOG_BYTES = 96 * 1024
MAX_SCAN_BYTES = 1024 * 1024
MAX_LINE_BYTES = 8192
CAPTURE_SECONDS = 8
APP_TAG = re.compile(r"\b[VDIWEF]\s+KfMkIIGV:(GvBrowserMedia|GvNav|GvMedia|GvInput|GvTabs):\s*(.*)$")
LEGACY_TAG = re.compile(r"\b[VDIWEF]/(GvBrowserMedia|GvNav|GvMedia|GvInput|GvTabs):\s*(.*)$")
EPOCH = re.compile(r"^(\d{10}(?:\.\d{1,9})?)\s+")
URL = re.compile(r"\burl=(https?://[^\s]+)")
POSITION = re.compile(r"^browser media position\b.*?\bposition=(\d+(?:\.\d+)?)\s+duration=(\d+(?:\.\d+)?)\s+rate=(-?\d+(?:\.\d+)?)\b")
ALIGNMENT = re.compile(r"^telesistema viewport alignment visibleBefore=(true|false) scrollChanged=(true|false)\b")


def official_route(message):
    match = URL.search(message)
    if not match:
        return False
    try:
        parsed = urlsplit(match.group(1).rstrip(".,;)]}"))
        return (
            parsed.scheme.lower() == "https"
            and (parsed.hostname or "").lower() == "telesistema11.com.do"
            and parsed.path.rstrip("/") == "/en-vivo"
            and parsed.username is None
            and parsed.password is None
            and parsed.port in (None, 443)
        )
    except ValueError:
        return False


def sanitize(text, capture_status="complete"):
    page_starts = []
    page_stops = []
    media_counts = {name: 0 for name in ("activated", "deactivated", "play", "pause", "stop", "metadata")}
    positions = []
    alignment_count = 0
    visible_values = set()
    scroll_values = set()
    for line in text.splitlines():
        timestamp_match = EPOCH.match(line)
        timestamp = None
        if timestamp_match:
            try:
                timestamp = float(timestamp_match.group(1))
            except ValueError:
                pass
        tag_match = APP_TAG.search(line) or LEGACY_TAG.search(line)
        if not tag_match:
            continue
        tag, message = tag_match.groups()
        if tag == "GvNav" and official_route(message):
            if re.search(r"\bpage start\b", message):
                page_starts.append(timestamp)
            elif re.search(r"\bpage stop\b.*\bsuccess=true\b", message):
                page_stops.append(timestamp)
        if tag == "GvBrowserMedia":
            if "browser media session activated" in message:
                media_counts["activated"] += 1
            elif "browser media session deactivated" in message:
                media_counts["deactivated"] += 1
            elif re.match(r"browser media play\b", message):
                media_counts["play"] += 1
            elif re.match(r"browser media pause\b", message):
                media_counts["pause"] += 1
            elif re.match(r"browser media stop\b", message):
                media_counts["stop"] += 1
            elif re.match(r"browser media metadata\b", message):
                media_counts["metadata"] += 1
            position_match = POSITION.match(message)
            if position_match:
                try:
                    position = float(position_match.group(1))
                    duration = float(position_match.group(2))
                    rate = float(position_match.group(3))
                except ValueError:
                    continue
                if all(map(lambda value: 0 <= value <= 86400, (position, duration))) and -16 <= rate <= 16:
                    positions.append((timestamp, position, rate))
        if tag == "GvMedia":
            alignment = ALIGNMENT.match(message)
            if alignment:
                alignment_count += 1
                visible_values.add(alignment.group(1))
                scroll_values.add(alignment.group(2))

    ordered_positions = [item for item in positions if item[1] >= 0]
    advanced = any(right[1] > left[1] + 0.25 for left, right in zip(ordered_positions, ordered_positions[1:]))
    last_position_bucket = int(ordered_positions[-1][1]) if ordered_positions else None
    first_page_start = next((value for value in page_starts if value is not None), None)
    first_media_time = next((value[0] for value in positions if value[0] is not None), None)
    latency_ms = None
    if first_page_start is not None and first_media_time is not None:
        delta = round((first_media_time - first_page_start) * 1000)
        if 0 <= delta <= 600000:
            latency_ms = delta
    complete = capture_status == "complete"
    bool_status = lambda yes: "yes" if yes else "no" if complete else "unknown"
    position_status = "yes" if advanced else "no" if positions and complete else "unknown"
    return {
        "capture_status": capture_status if capture_status in ("complete", "incomplete", "truncated") else "incomplete",
        "official_top_level_page_start_count": len(page_starts),
        "official_top_level_page_stop_count": len(page_stops),
        "browser_media": {
            "session_activated_count": media_counts["activated"],
            "session_deactivated_count": media_counts["deactivated"],
            "play_count": media_counts["play"],
            "pause_count": media_counts["pause"],
            "stop_count": media_counts["stop"],
            "metadata_observed": bool_status(media_counts["metadata"] > 0),
            "position_sample_count": len(positions),
            "position_advanced": position_status,
            "last_position_bucket_seconds": last_position_bucket,
            "time_to_first_position_ms": latency_ms,
        },
        "app_generated_telesistema_hover": {
            "viewport_alignment_event_count": alignment_count,
            "startup_hover_dispatch": "not_logged_by_current_app_build",
            "visible_before": next(iter(visible_values)) if len(visible_values) == 1 else "unknown",
            "scroll_changed": next(iter(scroll_values)) if len(scroll_values) == 1 else "unknown",
        },
        "embedded_frame_navigation": "not_observable_in_top_level_navigation_events",
        "audio_output": "not_tested",
        "moving_picture": "not_tested",
    }


def capture_logcat():
    try:
        pid_result = subprocess.run(["adb", "shell", "pidof", "com.kulchaflo.tv.mk2.gv"], check=False, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=3, text=True)
    except (OSError, subprocess.TimeoutExpired):
        return sanitize("", "incomplete")
    pids = pid_result.stdout.strip().split()
    if pid_result.returncode != 0 or not pids or not re.fullmatch(r"\d{1,10}", pids[0]):
        return sanitize("", "incomplete")
    try:
        process = subprocess.Popen(["adb", "logcat", "-d", "-v", "epoch", "--pid", pids[0]], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    except OSError:
        return sanitize("", "incomplete")
    deadline = time.monotonic() + CAPTURE_SECONDS
    scanned = 0
    truncated = False
    pending = bytearray()
    selected = []
    with selectors.DefaultSelector() as selector:
        selector.register(process.stdout, selectors.EVENT_READ)
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0 or not selector.select(remaining):
                process.kill()
                process.wait()
                return sanitize("\n".join(selected), "incomplete")
            chunk = os.read(process.stdout.fileno(), 8192)
            if not chunk:
                break
            scanned += len(chunk)
            if scanned > MAX_SCAN_BYTES:
                truncated = True
                process.kill()
                process.wait()
                break
            for byte in chunk:
                if byte == 10:
                    line = bytes(pending).decode("utf-8", errors="replace")
                    if (APP_TAG.search(line) or LEGACY_TAG.search(line)) and len(pending) <= MAX_LINE_BYTES:
                        selected.append(line)
                    pending.clear()
                elif len(pending) < MAX_LINE_BYTES:
                    pending.append(byte)
                else:
                    pending.clear()
                    truncated = True
    try:
        code = process.wait(timeout=max(0.1, deadline - time.monotonic()))
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()
        return sanitize("\n".join(selected), "incomplete")
    status = "complete" if code == 0 and not truncated else "truncated" if truncated else "incomplete"
    return sanitize("\n".join(selected), status)


def main():
    if sys.argv[1:] == ["--parse"]:
        raw = sys.stdin.buffer.read(MAX_LOG_BYTES + 1)
        oversized = len(raw) > MAX_LOG_BYTES
        report = sanitize(raw[:MAX_LOG_BYTES].decode("utf-8", errors="replace"), "truncated" if oversized else "complete")
    elif sys.argv[1:] == ["capture"]:
        report = capture_logcat()
    else:
        print("usage: tv-telesistema-log-snapshot.py capture|--parse", file=sys.stderr)
        return 2
    print(json.dumps(report, separators=(",", ":"), sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
