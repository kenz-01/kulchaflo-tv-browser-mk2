#!/usr/bin/env python3
"""Capture bounded, redacted Android process/activity/window/input-focus state."""

import json
import os
import re
import selectors
import subprocess
import sys
import time

PACKAGE = "com.kulchaflo.tv.mk2.gv"
MAX_OUTPUT_BYTES = 64 * 1024
MAX_FIXTURE_BYTES = 256 * 1024
COMPONENT = re.compile(
    r"(?<![A-Za-z0-9_])([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*)/"
    r"([A-Za-z_$.][A-Za-z0-9_.$]*)"
)
FOCUSED_WINDOWS_HEADER = re.compile(r"^\s*FocusedWindows:\s*$")
INPUT_FOCUSED_WINDOW = re.compile(r"^\s*displayId\s*=\s*(\d+)\s*,\s*name='([^']*)'")


def bounded_text(value):
    if isinstance(value, str):
        encoded = value.encode("utf-8", errors="replace")
    elif isinstance(value, bytes):
        encoded = value
    else:
        return "", True
    truncated = len(encoded) > MAX_OUTPUT_BYTES
    return encoded[:MAX_OUTPUT_BYTES].decode("utf-8", errors="replace"), truncated


def process_status(stdout, returncode, error=None, truncated=False):
    if error or returncode is None:
        return "unknown", "unavailable"
    text, was_truncated = bounded_text(stdout)
    if truncated or was_truncated:
        return "unknown", "output_truncated"
    values = text.split()
    if returncode == 0 and values and all(value.isdigit() for value in values):
        return "yes", "target_process"
    if returncode == 1 and not values:
        return "no", "process_absent"
    return "unknown", "unparseable"


def component_status(stdout, marker, truncated=False, error=None):
    if error:
        return "unknown", "command_unavailable"
    text, was_truncated = bounded_text(stdout)
    if truncated or was_truncated:
        # A match in the retained prefix can prove presence, but absence in a
        # truncated dump cannot prove that another component owned the window.
        may_prove_presence = True
    else:
        may_prove_presence = False

    entries = [
        line for line in text.splitlines()
        if marker.search(line)
    ]
    if len(entries) > 32:
        return "unknown", "too_many_entries"
    if not entries:
        return "unknown", "output_truncated" if truncated or was_truncated else "entry_missing"

    outcomes = []
    unparsed = False
    for line in entries:
        match = COMPONENT.search(line)
        if not match:
            unparsed = True
            continue
        outcomes.append("yes" if match.group(1) == PACKAGE else "no")

    if "yes" in outcomes and "no" not in outcomes:
        return "yes", "target_component"
    if "yes" in outcomes and "no" in outcomes:
        return "unknown", "ambiguous_components"
    if unparsed:
        return "unknown", "entry_unparsed"
    if outcomes and not may_prove_presence:
        return "no", "other_component"
    return "unknown", "output_truncated"


def input_window_status(capture):
    """Read only InputDispatcher's focused window for the Android TV display."""
    capture = capture if isinstance(capture, dict) else {}
    if capture.get("error") or capture.get("returncode") is None or capture.get("returncode") != 0:
        return "unknown", "command_unavailable"

    text, was_truncated = bounded_text(capture.get("stdout", ""))
    # InputDispatcher can contain multiple focused-window entries; a partial
    # dump cannot rule out a later conflicting display-0 window. Fail closed.
    if capture.get("truncated") or was_truncated:
        return "unknown", "output_truncated"
    lines = text.splitlines()
    headers = [index for index, line in enumerate(lines) if FOCUSED_WINDOWS_HEADER.search(line)]
    if not headers:
        return "unknown", "entry_missing"
    if len(headers) != 1:
        return "unknown", "ambiguous_components"

    header = lines[headers[0]]
    section_indent = len(header) - len(header.lstrip())
    outcomes = []
    unparsed = False
    relevant_entries = 0
    for line in lines[headers[0] + 1:]:
        if not line.strip():
            continue
        indent = len(line) - len(line.lstrip())
        if indent <= section_indent:
            break
        if "displayId" not in line:
            continue
        match = INPUT_FOCUSED_WINDOW.search(line)
        if not match:
            if re.search(r"\bdisplayId\s*=\s*0\b", line):
                unparsed = True
            continue
        if int(match.group(1)) != 0:
            continue
        relevant_entries += 1
        if relevant_entries > 32:
            return "unknown", "too_many_entries"
        component = COMPONENT.search(match.group(2))
        if not component:
            unparsed = True
            continue
        outcomes.append("yes" if component.group(1) == PACKAGE else "no")

    if unparsed:
        return "unknown", "entry_unparsed"
    if len(outcomes) > 1:
        return "unknown", "ambiguous_components"
    if outcomes == ["yes"]:
        return "yes", "input_target_window"
    if outcomes == ["no"]:
        return "no", "input_other_window"
    return "unknown", "entry_missing"


def resolve_focus(window_status, window_detail, input_status, input_detail):
    window_known = window_status in {"yes", "no"}
    input_known = input_status in {"yes", "no"}
    if window_known and input_known:
        if window_status != input_status:
            return "unknown", "focus_signal_conflict", "conflict"
        return window_status, window_detail, "both"
    if window_known:
        return window_status, window_detail, "window_manager"
    if input_known:
        return input_status, input_detail, "input_dispatcher"
    return "unknown", window_detail, "unknown"


def parse_capture(capture):
    capture = capture if isinstance(capture, dict) else {}
    pid = capture.get("pidof") if isinstance(capture.get("pidof"), dict) else {}
    activity = capture.get("activity") if isinstance(capture.get("activity"), dict) else {}
    window = capture.get("window") if isinstance(capture.get("window"), dict) else {}
    input_state = capture.get("input") if isinstance(capture.get("input"), dict) else {}

    process, pidof_detail = process_status(
        pid.get("stdout", ""), pid.get("returncode"), pid.get("error"), pid.get("truncated", False)
    )
    foreground, activity_detail = component_status(
        activity.get("stdout", ""), re.compile(r"(?:topResumedActivity|mResumedActivity)"),
        activity.get("truncated", False), activity.get("error")
    )
    # mFocusedApp and resumed-activity lines describe activity state. Only the
    # current window or InputDispatcher's focused window can verify input focus.
    window_focus, window_focus_detail = component_status(
        window.get("stdout", ""), re.compile(r"^\s*mCurrentFocus\s*="),
        window.get("truncated", False), window.get("error")
    )
    input_focus, input_focus_detail = input_window_status(input_state)
    focus, focus_detail, focus_source = resolve_focus(
        window_focus, window_focus_detail, input_focus, input_focus_detail
    )
    return {
        "process": process,
        "activity_foreground": foreground,
        "window_focus": focus,
        "diagnostics": {
            "pidof": pidof_detail,
            "activity_foreground": activity_detail,
            "window_focus": focus_detail,
            "window_manager_focus": window_focus_detail,
            "input_focus": input_focus_detail,
            "focus_source": focus_source,
        },
    }


def run_adb(args, timeout=8):
    try:
        process = subprocess.Popen(
            ["adb", *args], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL
        )
    except OSError:
        return {"stdout": "", "returncode": None, "error": "unavailable"}
    output = bytearray()
    deadline = time.monotonic() + timeout
    truncated = False
    with selectors.DefaultSelector() as selector:
        selector.register(process.stdout, selectors.EVENT_READ)
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                process.kill()
                process.wait()
                return {"stdout": bytes(output).decode("utf-8", errors="replace"), "returncode": None, "error": "timeout"}
            if not selector.select(remaining):
                process.kill()
                process.wait()
                return {"stdout": bytes(output).decode("utf-8", errors="replace"), "returncode": None, "error": "timeout"}
            chunk = os.read(process.stdout.fileno(), min(8192, MAX_OUTPUT_BYTES + 1 - len(output)))
            if not chunk:
                break
            output.extend(chunk)
            if len(output) > MAX_OUTPUT_BYTES:
                truncated = True
                process.kill()
                process.wait()
                break
    try:
        returncode = process.wait(timeout=max(0.1, deadline - time.monotonic()))
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()
        return {"stdout": bytes(output[:MAX_OUTPUT_BYTES]).decode("utf-8", errors="replace"), "returncode": None, "error": "timeout"}
    return {
        "stdout": bytes(output[:MAX_OUTPUT_BYTES]).decode("utf-8", errors="replace"),
        "returncode": returncode,
        "truncated": truncated,
    }


def capture_android_state():
    return parse_capture({
        "pidof": run_adb(["shell", "pidof", PACKAGE]),
        "activity": run_adb(["shell", "dumpsys", "activity", "activities"]),
        "window": run_adb(["shell", "dumpsys", "window", "windows"]),
        "input": run_adb(["shell", "dumpsys", "input"]),
    })


def read_fixture():
    raw = sys.stdin.buffer.read(MAX_FIXTURE_BYTES + 1)
    if len(raw) > MAX_FIXTURE_BYTES:
        raise ValueError("fixture_too_large")
    return json.loads(raw.decode("utf-8"))


def main():
    try:
        if sys.argv[1:] == ["--parse-json"]:
            output = parse_capture(read_fixture())
        elif sys.argv[1:] == ["capture"]:
            output = capture_android_state()
        else:
            print("usage: tv-emulator-state.py capture|--parse-json", file=sys.stderr)
            return 2
    except (ValueError, UnicodeError, json.JSONDecodeError):
        output = {
            "process": "unknown",
            "activity_foreground": "unknown",
            "window_focus": "unknown",
            "diagnostics": {
                "pidof": "unparseable",
                "activity_foreground": "unparseable",
                "window_focus": "unparseable",
                "window_manager_focus": "unparseable",
                "input_focus": "unparseable",
                "focus_source": "unknown",
            },
        }
    print(json.dumps(output, separators=(",", ":"), sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
