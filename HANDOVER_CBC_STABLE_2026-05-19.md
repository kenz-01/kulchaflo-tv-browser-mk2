# HANDOVER: CBC TV8 stable (exact-HLS + promoted pointer)

Checkpoint label: CBC TV8 stable: exact-HLS native promotion + promoted pointer overlay

Repository root (absolute path):
/Users/kenz/Documents/backup-kulchaflo.com-3-14-2026 Working/public_html/kulchaflo-tv-browser-mk2

1) Current repo state
- Branch: main (HEAD -> main, origin/main)
- Recent commits (most recent first):
  - d9714b5 Stabilise CBC exact-HLS promoted pointer playback
  - 9141ab5 Add CaribVision stable handover
  - f207d0c Complete CaribVision observer and fallback support
  - 9e1ff1d Stabilise CaribVision exact-HLS playback
  - 76b178e Add CGTV and Novus stable handover

2) Summary
This checkpoint documents the CBC TV8 stability work: a tightly-scoped exact-HLS native promotion path and a promoted-pointer overlay (the existing Kulcha Flo PointerOverlayView reused above the promoted PlayerView). The flow is scoped to the official CBC live page and CDN HLS source, includes an already-active guard to avoid re-promotes, keeps native keep-alive behavior, falls back to the browser on player error, and preserves pointer/back/transport UX expectations.

Key behaviors validated on Bravia:
- Exact-HLS native promotion triggers only for the canonical CBC live URL (https://www.cbc.bb/live/ or equivalent). The promoted player starts the CDN77 HLS source: https://1740288887.rsc.cdn77.org/1740288887/index.m3u8
- Promoted pointer overlay is enabled in promoted mode; DPAD movement wakes pointer + PlayerView transport; OK interacts with PlayerView controls; pointer idles using normal timeout.
- Back exits promoted playback once, restores browser pointer and navigation, and a suppression window prevents immediate re-promote loops.
- Already-active guard prevents repeated promote/play when the promoted player is already streaming the exact HLS source.
- On player error, the promoted-player listener triggers a fallback-to-browser path.

3) Important files (absolute paths)
- /Users/kenz/Documents/backup-kulchaflo.com-3-14-2026 Working/public_html/kulchaflo-tv-browser-mk2/app-gv/src/main/assets/gv_media_observer/content.js
- /Users/kenz/Documents/backup-kulchaflo.com-3-14-2026 Working/public_html/kulchaflo-tv-browser-mk2/app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt
- /Users/kenz/Documents/backup-kulchaflo.com-3-14-2026 Working/public_html/kulchaflo-tv-browser-mk2/app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/media/GvPromotedMediaPlayer.kt

4) Device validation / commands (copy-paste)
Run from the repository root on your macOS zsh shell. Replace the device IP if different.

```bash
cd "/Users/kenz/Documents/backup-kulchaflo.com-3-14-2026 Working/public_html/kulchaflo-tv-browser-mk2"

# Build
./gradlew :app-gv:assembleBraviaRelease --console=plain

# Install & launch on Bravia
adb kill-server && adb start-server && adb connect 192.168.0.16:5555
adb -s 192.168.0.16:5555 uninstall com.kulchaflo.tv.mk2.gv
adb -s 192.168.0.16:5555 install -r app-gv/build/outputs/apk/bravia/release/app-gv-bravia-release.apk
adb -s 192.168.0.16:5555 logcat -c
adb -s 192.168.0.16:5555 shell am start -n com.kulchaflo.tv.mk2.gv/.app.GeckoBrowserActivity -e url 'https://www.cbc.bb/live/?utm_source=KulchaFlo'

# After 15–30s capture logs and screenshot
adb -s 192.168.0.16:5555 logcat -d -v time > /tmp/cbc_promoted_pointer_final.log
adb -s 192.168.0.16:5555 exec-out screencap -p > /tmp/cbc_promoted_pointer_final.png

# Search for validation markers
rg "cbc live hls ready|cbc native promote allowed exact-hls|player started url=https://1740288887.rsc.cdn77.org/1740288887/index.m3u8|cbc native promote skipped reason=already-active|cbc native keep-alive|promoted pointer mode enabled reason=cbc-exact-hls|pointer visible=true reason=promoted-pointer|promoted pointer moved|promoted pointer tap dispatched target=player-view|promoted media exited reason=back-pressed|cbc pointer restored reason=back" /tmp/cbc_promoted_pointer_final.log || true
```

5) Log markers to expect
- "cbc live hls ready" (content.js emitted readiness payload)
- "cbc native promote allowed exact-hls" (Kotlin allowed promotion)
- "player started url=https://1740288887.rsc.cdn77.org/1740288887/index.m3u8" (promoted player started)
- "cbc native promote skipped reason=already-active" (already-active guard applied on repeat promotes)
- "cbc native keep-alive" (promoted player keep-alive behavior)
- "promoted pointer mode enabled reason=cbc-exact-hls" (pointer overlay enabled)
- "pointer visible=true reason=promoted-pointer" / "promoted pointer moved" / "promoted pointer tap dispatched target=player-view" (pointer interactions)
- "promoted media exited reason=back-pressed" / "cbc pointer restored reason=back" (clean exit and restore)

6) Commit suggestion (run locally)
When validation passes and you want this handover committed, run:

```bash
git status --short
git add HANDOVER_CBC_STABLE_2026-05-19.md

git commit -m "Add CBC stable handover" -m "Checkpoint: CBC TV8 stable: exact-HLS native promotion + promoted pointer overlay.\n\nIncludes validation markers and the recommended device test steps. Do not modify other site-specific flows (CGTV, CaribVision, Novus, ABS, TTT)."

git log --oneline -5
git push origin main
```

7) Warnings & notes
- Keep the implementation tightly scoped to CBC live pages. Do not expand promote rules globally.
- Do not re-enable native promotion for other surfaces without testing TLS/CDN compatibility first.
- If you see repeated re-promote loops after Back, check the suppression window logic and the already-active guard.
- If promoted-player errors occur frequently, inspect the GvPromotedMediaPlayer listener logs to see whether fallback-to-browser is firing.


---

Created by automation for the current checkpoint on 2026-05-19.

