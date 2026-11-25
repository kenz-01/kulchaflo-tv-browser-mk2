#!/usr/bin/env python3
"""Capture a bounded, sanitized identity receipt for the selected TV image."""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ElementTree
from pathlib import Path

TARGETS = {"android-tv", "google-tv"}
PACKAGE_RE = re.compile(r"(?<![A-Za-z0-9_.])([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+)/([A-Za-z][A-Za-z0-9_.$]*)")
SAFE_VALUE_RE = re.compile(r"[A-Za-z0-9._/-]{1,120}")
FINGERPRINT_RE = re.compile(r"[A-Za-z0-9._:+/-]{1,180}")


def safe_text(value, limit=120):
    value = str(value or "").strip()
    return value[:limit] if SAFE_VALUE_RE.fullmatch(value[:limit]) else "unknown"


def sanitize_observations(target, commit, apk_sha256, props, features, home, sdk_package_present, sdk_package_version, sdk_license_id, sdk_license_accepted):
    api = safe_text(props.get("api"))
    abi = safe_text(props.get("abi"))
    device = safe_text(props.get("device"))
    fingerprint = str(props.get("build") or "").strip()
    build = fingerprint if FINGERPRINT_RE.fullmatch(fingerprint) else "unknown"
    leanback = "yes" if re.search(r"(?m)^feature:android\.software\.leanback\s*$", features) else "no"
    match = PACKAGE_RE.search(home or "")
    launcher_package = match.group(1) if match else "unknown"
    launcher_component = f"{match.group(1)}/{match.group(2)}" if match else "unknown"
    image_package = f"system-images/android-36/{target}/x86_64" if target in TARGETS else "unknown"
    expected_package_id = f"system-images;android-36;{target};x86_64" if target in TARGETS else ""
    package_present = "yes" if sdk_package_present is True and expected_package_id else "no"
    package_version = safe_text(sdk_package_version)
    license_id = safe_text(sdk_license_id)
    license_accepted = "yes" if sdk_license_accepted is True and license_id != "unknown" else "no"
    commit = commit.lower() if re.fullmatch(r"[0-9a-fA-F]{40}", str(commit or "")) else "unknown"
    apk_sha256 = apk_sha256.lower() if re.fullmatch(r"[0-9a-fA-F]{64}", str(apk_sha256 or "")) else "unknown"
    checks = {
        "selected_image_target": "yes" if target in TARGETS else "no",
        "sdk_package_installed": package_present,
        "sdk_license_accepted": license_accepted,
        "api_36": "yes" if api == "36" else "no",
        "abi_x86_64": "yes" if abi == "x86_64" else "no",
        "leanback_feature": leanback,
        "launcher_resolved": "yes" if match else "no",
        "apk_hash_available": "yes" if apk_sha256 != "unknown" else "no",
        "commit_available": "yes" if commit != "unknown" else "no",
    }
    return {
        "schema_version": 1,
        "selected_system_image": image_package,
        "sdk_package_id": expected_package_id or "unknown",
        "system_image_source": "Google Android SDK Manager installed package metadata",
        "system_image_license": license_id,
        "sdk_package_installed": package_present,
        "sdk_package_version": package_version,
        "sdk_license_accepted": license_accepted,
        "api": api,
        "abi": abi,
        "device": device,
        "build_fingerprint": build,
        "leanback_feature": leanback,
        "home_launcher_package": launcher_package,
        "home_launcher_component": launcher_component,
        "source_commit": commit,
        "workflow_run_id": safe_text(os.environ.get("GITHUB_RUN_ID")),
        "workflow_run_attempt": safe_text(os.environ.get("GITHUB_RUN_ATTEMPT")),
        "universal_apk_sha256": apk_sha256,
        "checks": checks,
        "qualification_status": "PASS" if all(value == "yes" for value in checks.values()) else "FAIL",
        "playback_acceptance": "not_tested",
        "physical_bravia_acceptance": "not_tested",
    }


def adb_value(*args):
    try:
        result = subprocess.run(
            ["adb", *args], check=False, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, timeout=8, text=True,
        )
    except (OSError, subprocess.TimeoutExpired):
        return ""
    return result.stdout[:32768]


def capture(target, apk_path, output):
    try:
        digest = hashlib.sha256(Path(apk_path).read_bytes()).hexdigest()
    except OSError:
        digest = "unknown"
    sdk_root = os.environ.get("ANDROID_SDK_ROOT") or os.environ.get("ANDROID_HOME") or ""
    package_path = Path(sdk_root) / "system-images" / "android-36" / target / "x86_64" / "package.xml"
    package_id = ""
    package_version = "unknown"
    license_id = "unknown"
    try:
        metadata = ElementTree.parse(package_path).getroot()
        local_package = next((element for element in metadata.iter() if element.tag.endswith("localPackage")), None)
        if local_package is not None:
            package_id = local_package.attrib.get("path", "")
            revision = next((element for element in local_package if element.tag.endswith("revision")), None)
            if revision is not None:
                parts = [next((child.text for child in revision if child.tag.endswith(name)), None) for name in ("major", "minor", "micro")]
                if parts[0] and parts[1] and parts[2]:
                    package_version = ".".join(parts)
            use = next((element for element in local_package.iter() if element.tag.endswith("uses-license")), None)
            if use is not None:
                license_id = use.attrib.get("ref", "unknown")
    except (OSError, ElementTree.ParseError):
        pass
    expected_package_id = f"system-images;android-36;{target};x86_64" if target in TARGETS else ""
    package_installed = package_path.is_file() and package_id == expected_package_id
    license_path = Path(sdk_root) / "licenses" / license_id if license_id != "unknown" else Path("/") / "nonexistent-license"
    try:
        license_accepted = license_path.is_file() and license_path.stat().st_size > 0
    except OSError:
        license_accepted = False
    report = sanitize_observations(
        target=target,
        commit=os.environ.get("GITHUB_SHA", "unknown"),
        apk_sha256=digest,
        props={
            "api": adb_value("shell", "getprop", "ro.build.version.sdk"),
            "abi": adb_value("shell", "getprop", "ro.product.cpu.abi"),
            "device": adb_value("shell", "getprop", "ro.product.device"),
            "build": adb_value("shell", "getprop", "ro.build.fingerprint"),
        },
        features=adb_value("shell", "pm", "list", "features"),
        home=adb_value("shell", "cmd", "package", "resolve-activity", "--brief", "-a", "android.intent.action.MAIN", "-c", "android.intent.category.HOME"),
        sdk_package_present=package_installed,
        sdk_package_version=package_version,
        sdk_license_id=license_id,
        sdk_license_accepted=license_accepted,
    )
    destination = Path(output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, sort_keys=True))
    return 0 if report["qualification_status"] == "PASS" else 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--parse", action="store_true")
    parser.add_argument("command", nargs="?", choices=("capture",))
    parser.add_argument("--target")
    parser.add_argument("--apk")
    parser.add_argument("--output")
    args = parser.parse_args()
    if args.command == "capture" and not args.parse and args.target and args.apk and args.output:
        return capture(args.target, args.apk, args.output)
    if not args.parse:
        parser.error("use capture --target TARGET --apk APK --output PATH, or --parse")
    try:
        fixture = json.load(sys.stdin)
        report = sanitize_observations(**fixture)
    except (ValueError, TypeError, json.JSONDecodeError):
        print("invalid_fixture", file=sys.stderr)
        return 2
    print(json.dumps(report, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
