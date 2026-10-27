#!/usr/bin/env bash
# Kulcha Flo TV: passive Sony Bravia source reconnaissance (17 official routes).
# Does not remove applications, clear logcat, tap controls or upload logs.
set -euo pipefail

TV="${KF_TV:-192.168.0.16:5555}"
ROOT="${KF_LOG_DIR:-$HOME/Downloads/kf-bravia-logs/unresolved-sweep}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$ROOT/$STAMP"

command -v adb >/dev/null 2>&1 || { echo "Android adb is missing." >&2; exit 1; }
command -v gzip >/dev/null 2>&1 || { echo "gzip is missing." >&2; exit 1; }
adb connect "$TV" >/dev/null
if [[ "$(adb -s "$TV" get-state)" != "device" ]]; then
  echo "Bravia is not connected at $TV" >&2; exit 1
fi
if ! adb -s "$TV" shell pm path com.kulchaflo.tv.mk2.gv | grep -q 'package:'; then
  echo "Kulcha Flo TV is not installed. Install the PR #18 acceptance APK first." >&2; exit 1
fi

CHANNELS=(
  'the-islamic-network|https://theislamicnetwork.org/'
  'sankhya-television|https://www.sankhyatv.com/live'
  'scorch-tv|https://www.scorchtv.com/'
  'tvcarib|https://tvcarib.com/'
  'jamaica-travel-channel|https://jamaicatravelchannel.com/'
  'alcarrizos-tv|https://alcarrizostv.com/'
  'cdn-37|https://cdn.com.do/'
  'teleantillas|https://teleantillas.com.do/radio-page/'
  'live-99-tv|https://live99fm.com/'
  'bonaire-tv|https://www.bonaire.tv/'
  'zns-tv|https://znsbahamas.com/'
  'vip-radio-aruba-tv|https://www.viponlineradio.com/vip-tv/'
  'cubavision-internacional|https://teveo.cu/live/video/AKDdWvMTYzfsfnNJ'
  'telemundo-puerto-rico|https://www.telemundopr.com/noticias/puerto-rico/mira-aqui-nuestra-programacion-en-vivo-3/2019645/'
  'tvc-st-kitts|https://www.tvcplus.live/watch-live-tv'
  'hgptv|https://www.hgptv.com/'
  'mtv-guyana|https://www.mtvgy.com/live'
)
if (( $# == 0 )); then
  requested=(hgptv zns-tv mtv-guyana)
elif [[ "$1" == "--all" ]]; then
  requested=( )
else
  requested=( "$@" )
fi

mkdir -p "$DEST"
printf 'Bravia %s; evidence in %s\n' "$TV" "$DEST"
count=0
for entry in "${CHANNELS[@]}"; do
  id="${entry%%|*}"
  url="${entry#*|}"
  if (( ${#requested[@]} > 0 )); then
    match=0
    for wanted in "${requested[@]}"; do
      if [[ "$id" == "$wanted" ]]; then match=1; break; fi
    done
    if (( match == 0 )); then continue; fi
  fi
  echo "Opening official source $id; allow 28 seconds with no remote interaction"
  adb -s "$TV" shell am start -n com.kulchaflo.tv.mk2.gv/.app.GeckoBrowserActivity -e url "$url" >/dev/null
  sleep 28
  # Preserve the device log buffer and capture relevant tags locally.
  adb -s "$TV" logcat -d -v threadtime -s GvMedia:I GvNav:I GvExt:I AndroidRuntime:E '*:S' | gzip -c > "$DEST/$id.log.gz"
  echo "Saved $DEST/$id.log.gz"
  count=$((count + 1))
done
if (( count == 0 )); then
  echo "Unknown channel ID. Choose from the registered list or --all." >&2
  exit 2
fi
echo "Captured $count official channels; keep logs private and attach selected files in ChatGPT."
