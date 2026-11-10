#!/usr/bin/env python3
"""Keep only bounded, allowlisted ZNS phase and player-state log observations."""

import json
import os
import re
import selectors
import subprocess
import sys
import time

MAX_LOG_BYTES = 64 * 1024
PHASES = (
    "zns-outer-player-first",
    "zns-embedded-observed",
    "zns-embedded-playing",
    "zns-video-time-advanced",
)
PHASE_SET = set(PHASES)
PHASE_PATTERN = re.compile(r"zns helper phase=([a-z0-9-]+) mode=browser-first")
STATE_PATTERN = re.compile(
    r"zns helper phase=zns-embedded-observed mode=browser-first "
    r"ready=([0-4]) paused=(true|false) muted=(true|false) "
    r"volume=(0(?:\.\d+)?|1(?:\.0+)?)"
)


def sanitize(text, capture_status="complete"):
    phases = []
    player_state = None
    for line in text.splitlines():
        phase_match = PHASE_PATTERN.search(line)
        if phase_match and phase_match.group(1) in PHASE_SET and phase_match.group(1) not in phases:
            phases.append(phase_match.group(1))
        state_match = STATE_PATTERN.search(line)
        if state_match:
            phases.append("zns-embedded-observed") if "zns-embedded-observed" not in phases else None
            player_state = {
                "ready": int(state_match.group(1)),
                "paused": state_match.group(2) == "true",
                "muted": state_match.group(3) == "true",
                "volume": float(state_match.group(4)),
            }
    phases = [phase for phase in PHASES if phase in phases]
    return {
        "capture_status": capture_status if capture_status in ("complete", "truncated", "incomplete") else "incomplete",
        "observation_phases": phases,
        "player_state": player_state,
        "video_time_advanced_observed": "yes" if "zns-video-time-advanced" in phases else "no",
    }


def capture_logcat():
    try:
        process = subprocess.Popen(
            ["adb", "logcat", "-d", "-s", "GvMedia:I"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
    except OSError:
        return sanitize("", "incomplete")

    output = bytearray()
    deadline = time.monotonic() + 6
    truncated = False
    with selectors.DefaultSelector() as selector:
        selector.register(process.stdout, selectors.EVENT_READ)
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0 or not selector.select(remaining):
                process.kill()
                process.wait()
                process.stdout.close()
                return sanitize(bytes(output).decode("utf-8", errors="replace"), "incomplete")
            chunk = os.read(process.stdout.fileno(), min(8192, MAX_LOG_BYTES + 1 - len(output)))
            if not chunk:
                break
            output.extend(chunk)
            if len(output) > MAX_LOG_BYTES:
                truncated = True
                process.kill()
                process.wait()
                break
    process.stdout.close()
    if truncated:
        return sanitize(bytes(output[:MAX_LOG_BYTES]).decode("utf-8", errors="replace"), "truncated")
    try:
        return_code = process.wait(timeout=max(0.1, deadline - time.monotonic()))
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()
        return sanitize(bytes(output).decode("utf-8", errors="replace"), "incomplete")
    status = "complete" if return_code == 0 else "incomplete"
    return sanitize(bytes(output).decode("utf-8", errors="replace"), status)


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
