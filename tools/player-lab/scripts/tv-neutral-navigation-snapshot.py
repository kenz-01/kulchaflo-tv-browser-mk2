#!/usr/bin/env python3
"""Observe only bounded navigation events for the neutral example.com check."""

import json
import os
import re
import selectors
import subprocess
import sys
import time
from urllib.parse import urlsplit

MAX_CAPTURE_SECONDS = 30
MAX_SCAN_BYTES = 256 * 1024
MAX_LINE_BYTES = 8192
LOG_TAG = re.compile(r"\bKfMkIIGV:GvNav:\s*(.*)$")
URL_FIELD = re.compile(r"\b(?:url|uri)=(\S+)")


def is_neutral_url(raw):
    try:
        parsed = urlsplit(raw.rstrip(".,;)]}"))
        return (
            parsed.scheme.lower() == "https"
            and (parsed.hostname or "").lower() == "example.com"
            and parsed.path.rstrip("/") == ""
            and not parsed.query
            and not parsed.fragment
            and parsed.username is None
            and parsed.password is None
            and parsed.port in (None, 443)
        )
    except ValueError:
        return False


def scan(lines):
    started = False
    completed = False
    failed = False
    for line in lines:
        match = LOG_TAG.search(line)
        if not match:
            continue
        message = match.group(1)
        if not message.startswith(("page start ", "page stop ", "load error ")):
            continue
        url_match = URL_FIELD.search(message)
        if not url_match or not is_neutral_url(url_match.group(1)):
            continue
        if message.startswith("page start "):
            started = True
        elif message.startswith("page stop "):
            started = True
            if re.search(r"\bsuccess=true\b", message):
                completed = True
            elif re.search(r"\bsuccess=false\b", message):
                failed = True
        elif message.startswith("load error "):
            failed = True
    return {
        "navigation_started": started,
        "navigation_completed": completed,
        "navigation_failed": failed,
    }


def safe_report(observations, capture_status):
    if observations["navigation_completed"]:
        state = "completed"
    elif observations["navigation_failed"]:
        state = "failed"
    elif observations["navigation_started"]:
        state = "started"
    else:
        state = "not_observed"
    return {
        "capture_status": capture_status,
        "navigation_status": state,
        **observations,
        "route": "https://example.com/",
    }


def parse(raw):
    truncated = len(raw) > MAX_SCAN_BYTES
    text = raw[:MAX_SCAN_BYTES].decode("utf-8", errors="replace")
    lines = []
    for line in text.splitlines():
        if len(line) <= MAX_LINE_BYTES:
            lines.append(line)
    return safe_report(scan(lines), "truncated" if truncated else "complete")


def capture():
    try:
        pid = subprocess.run(
            ["adb", "shell", "pidof", "com.kulchaflo.tv.mk2.gv"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=3,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return safe_report(scan([]), "incomplete")
    pid_values = pid.stdout.decode("ascii", errors="ignore").strip().split()
    if pid.returncode != 0 or not pid_values or not re.fullmatch(r"\d{1,10}", pid_values[0]):
        return safe_report(scan([]), "incomplete")

    try:
        process = subprocess.Popen(
            ["adb", "logcat", "-v", "threadtime", "--pid", pid_values[0]],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
    except OSError:
        return safe_report(scan([]), "incomplete")

    deadline = time.monotonic() + MAX_CAPTURE_SECONDS
    observed_lines = []
    scanned_bytes = 0
    pending = bytearray()
    truncated = False
    discarding_long_line = False
    status = "timeout"

    def stop_process():
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=1)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()

    with selectors.DefaultSelector() as selector:
        selector.register(process.stdout, selectors.EVENT_READ)
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0 or not selector.select(remaining):
                status = "timeout"
                break
            chunk = os.read(process.stdout.fileno(), 8192)
            if not chunk:
                status = "complete" if process.poll() == 0 else "incomplete"
                break
            scanned_bytes += len(chunk)
            if scanned_bytes > MAX_SCAN_BYTES:
                truncated = True
                status = "truncated"
                break
            for byte in chunk:
                if byte == 10:
                    if not discarding_long_line:
                        line = bytes(pending).decode("utf-8", errors="replace")
                        if LOG_TAG.search(line):
                            observed_lines.append(line)
                    pending.clear()
                    discarding_long_line = False
                    continue
                if discarding_long_line:
                    continue
                pending.append(byte)
                if len(pending) > MAX_LINE_BYTES:
                    truncated = True
                    pending.clear()
                    discarding_long_line = True
            current = scan(observed_lines)
            if current["navigation_completed"] or current["navigation_failed"]:
                status = "complete"
                break
    stop_process()
    if pending and not discarding_long_line:
        line = bytes(pending).decode("utf-8", errors="replace")
        if LOG_TAG.search(line):
            observed_lines.append(line)
    if truncated and status not in ("complete", "incomplete"):
        status = "truncated"
    return safe_report(scan(observed_lines), status)


def main():
    if sys.argv[1:] == ["--parse"]:
        report = parse(sys.stdin.buffer.read(MAX_SCAN_BYTES + 1))
    elif sys.argv[1:] == ["capture"]:
        report = capture()
    else:
        print("usage: tv-neutral-navigation-snapshot.py capture|--parse", file=sys.stderr)
        return 2
    print(json.dumps(report, separators=(",", ":"), sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
