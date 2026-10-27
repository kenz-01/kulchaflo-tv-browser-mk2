# 17 unresolved live channels — passive Bravia player reconnaissance

This is an **instrumented candidate**, not 17 functioning helpers or live streams.
Source inventory is `tools/player-lab/config/public-targets.json`; route parity
is checked in CI. Scope: the-islamic-network, sankhya-television, scorch-tv, tvcarib, jamaica-travel-channel, alcarrizos-tv, cdn-37, teleantillas, live-99-tv, bonaire-tv, zns-tv, vip-radio-aruba-tv, cubavision-internacional, telemundo-puerto-rico, tvc-st-kitts, hgptv, mtv-guyana.

On exact HTTPS top-level routes, the extension samples at 0.75, 3, 8, 15
and 25 seconds. Data: iframe/video counts and visibility, top-level playback
readiness/mute, iframe **hostnames only** and player family markers. Kotlin
independently checks the exact official URL before accepting the private
`GvMedia` diagnostics. It does not click, play, scroll, promote media,
change permissions, or transmit logs.

Bravia testing: `adb -s 192.168.0.16:5555 shell am start -n
com.kulchaflo.tv.mk2.gv/.app.GeckoBrowserActivity -e url
'https://www.hgptv.com/'` then after 27 seconds
`adb -s 192.168.0.16:5555 logcat -d -v threadtime | gzip -c >
"$HOME/Downloads/kf-bravia-logs/hgptv-probe.log.gz"`.
Keep logs private. Repeat selected sites and classify each as source offline,
player detected, unknown embed or redirect requiring route correction.

Do not confuse offline unit tests with physical Bravia acceptance. PRs #16
and #17 remain unmerged; Telesistema stays on broadcaster-instability hold.
