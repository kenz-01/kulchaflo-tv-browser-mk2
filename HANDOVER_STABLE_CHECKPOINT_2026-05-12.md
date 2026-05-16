Stable checkpoint: 2026-05-12

Stable commit:
2485651 Add Novus Telearuba shared-player channel support

Verified working:
- ABS/Tego player-first, clean back exit
- TTT startup assist / player-first / back exit
- KulchaFlo CookieAdmin auto-accept
- Homepage edge-gated rail scrolling
- Novus/Telearuba shared player:
  - Telearuba channel 13
  - Nos Isla TV channel 23
  - Aruba.tv channel 49
  - correct channel selection
  - sound after play assist
  - player-first view
  - Back returns to KulchaFlo watch page without loop

Known notes:
- Novus autoplay may still require a user OK/play assist because browser policy can reject programmatic play.
- Novus startup can feel slightly long/clunky but is functional and stable.
- Repo is now pushed to GitHub remote origin/main.

Handoff summary:
- This checkpoint contains focused additions to the media observer (`app-gv/src/main/assets/gv_media_observer/content.js`) and the native activity (`app-gv/src/main/java/com/kulchaflo/tv/mk2/gv/app/GeckoBrowserActivity.kt`) to support intent-driven navigation and playback for the Novus Telearuba shared player used by three KulchaFlo channel pages. Changes are scoped and preserve existing behavior for ABS, TTT, CVM, YouTube, and Facebook surfaces.

Test discipline and quick verification steps (Bravia release):
1) Uninstall previous app:
   adb -s 192.168.0.16:5555 uninstall com.kulchaflo.tv.mk2.gv
2) Install Bravia release APK:
   adb -s 192.168.0.16:5555 install -r app-gv/build/outputs/apk/bravia/release/app-gv-bravia-release.apk
3) Launch with optional test URL extra:
   adb -s 192.168.0.16:5555 shell am start -n com.kulchaflo.tv.mk2.gv/.app.GeckoBrowserActivity -e url 'https://novus.telearuba.aw/?kf_channel=49&kf_return=https://kulchaflo.com/channels/aruba-tv-channel-49/'
4) Pull logcat after reproduction and clear logs:
   adb -s 192.168.0.16:5555 logcat -d -v time > /tmp/kf_novus_check.log
   adb -s 192.168.0.16:5555 logcat -c

Notes for reviewers:
- Keep fixes narrow and site-scoped — do not reopen Facebook or YouTube surfaces unless a regression is reported.
- The Novus flow intentionally rewrites Novus request URLs with `kf_channel` and `kf_return` query parameters and grants autoplay permissions in the native permission delegate where scoped.

