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

## One-command source sweep on the Mac

After installing the acceptance APK from PR #18, download/clone this branch's
`tools/player-lab/scripts/bravia-unresolved-sweep.sh` and run it from Terminal:

```bash
bash tools/player-lab/scripts/bravia-unresolved-sweep.sh
```

The default runs three distinct sources: `hgptv`, `zns-tv` and
`mtv-guyana`, each with 28 seconds of untouched playback observation.
Provide channel IDs as arguments to choose others, or `--all` to
cycle through all 17 official URLs. The script only opens the existing app
with its supported URL extra, reads diagnostic logs, and stores them under
`~/Downloads/kf-bravia-logs/unresolved-sweep/<UTC stamp>/`.
It never uninstalls or changes a provider, deletes caches/logcat, or
uploads sensitive logs. The full 17-source sweep will take around
eight minutes and may require manual visual confirmation afterward.

## Public-source reconnaissance, 27 October 2026

Source routes were corrected in the Player Lab registry, the read-only
extension gate and the Mac sweep script after checking publisher links.

- **HGPTV Guyana:** official homepage `https://www.hgptv.com/`
  currently contains a Dacast embed (`iframe.dacast.com`).
- **ZNS Bahamas:** homepage `https://znsbahamas.com/`
  embeds `player.streamcomedia.com/HTML5/znstv/`.
- **Live99 TV:** broadcaster's `TV` link at `https://live99fm.com/`
  points to `https://media.streambrothers.com/public/8014`.
  Previously registered homepage is not the actual TV player page.
- **VIP Radio Live TV:** broadcaster navigation now points to
  `https://viponlineradio.com/live-tv/`, embedding
  `new.opencaster.com`. The previous `/vip-tv/` inventory route
  is superseded for this diagnostic pass.
- **TVCARiB:** homepage offers several distinct live channels (main,
  kids, gospel, Latino, cinema, music, radio). No arbitrary one-player
  selection; identify the actual requested channel first.
- **MTV Guyana:** current Wix live page doesn't expose a definite player
  in static HTML; retain as unknown until on-device reconnaissance.
- **Scorch TV:** the official page displays an active live section and
  on-demand content, with Mux-backed thumbnails; the **live player
  engine is not established** by thumbnails alone.

The new passive classifier recognises Dacast, StreamcoMedia, OpenCaster
and StreamBrothers **iframe hosts** when the browser sees them.
These are platform hints, not accepted playback or live availability.
Sources: publisher webpages at hgptv.com, znsbahamas.com,
live99fm.com (linked TV page), viponlineradio.com, tvcarib.com,
mtvgy.com, and scorchtv.com. No speculative embed URLs were inserted
into the application's playback system.
