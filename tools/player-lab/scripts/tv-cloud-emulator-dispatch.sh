#!/usr/bin/env bash
set -euo pipefail

profile="${1:-}"
case "$profile" in
  qualification)
    exec bash tools/player-lab/scripts/tv-cloud-emulator-qualification.sh
    ;;
  zns)
    exec bash tools/player-lab/scripts/tv-zns-source-feedback.sh
    ;;
  *)
    printf 'Unsupported TV emulator profile: %s\n' "${profile:-<empty>}" >&2
    exit 2
    ;;
esac
