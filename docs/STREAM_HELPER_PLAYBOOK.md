# Kulcha Flo TV Stream Helper Playbook — Draft from Current Helper Audit

Source audit: `kulchaflo_helper_audit.zip` uploaded 2026-06-20.  
Main files inspected: `GeckoBrowserActivity.kt`, `content.js`, `GvBrowserMediaController.kt`, `helper_grep_index.txt`, `git_log_oneline_60.txt`.

## 1. Core principle

Every helper starts with a route decision:

1. **Official page browser-first** — keep the broadcaster page and make its player TV-first.
2. **Official embed browser-first** — keep official page but target an embedded player iframe, usually Dailymotion, Vimeo, Tego, Bradmax, JWPlayer, Flowplayer, Video.js.
3. **Watch-page fallback** — only when official embed is blocked but an official/public watch page works.
4. **Exact native promotion** — only for known safe HLS streams such as CBC where direct native playback was accepted.
5. **Hostile player state machine** — Facebook-style flows where normal helper patterns are unreliable.

Do not add stream extraction, broad ad blocking, broad native promotion blocking, or generic tap loops. Every fix must be scoped to the provider, URL, player host, and current tab context.

---

## 2. Mandatory implementation checklist

Before writing a new helper:

- Classify the player type.
- Identify official route and fallback route.
- Identify player root/iframe/video selectors.
- Identify site chrome to hide.
- Decide whether playback is browser-first or native-promoted.
- Decide whether autoplay permission is needed.
- Decide whether a one-shot play tap is needed.
- Decide whether consent or popup guard is needed.
- Add provider-specific logs and markers.
- Validate source and bundled APK asset.
- Test fresh install and same-install relaunch.
- Commit provider as a separate rollback-safe commit.

---

## 3. Player-first rules

Player-first should only happen after a real player target has been found.

Allowed:

```text
content-provider-player-first-retry candidateCount=0
content-provider-player-first-no-target candidateCount=0
content-provider-player-first-applied candidateCount=1
```

Not allowed:

```text
content-provider-player-first-applied candidateCount=0
```

Standard target CSS:

```css
position: fixed !important;
inset: 0 !important;
left: 0 !important;
top: 0 !important;
width: 100vw !important;
height: 100vh !important;
z-index: 2147483647 !important;
background: #000 !important;
overflow: hidden !important;
margin: 0 !important;
padding: 0 !important;
transform: none !important;
```

Standard page CSS:

```css
html,
body {
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  background: #000 !important;
}
```

Hide page chrome only after player target is secured. Prefer hiding siblings outside the player ancestor path, plus obvious provider-specific chrome such as headers, navs, footers, grids, overlays, and live badges.

Avoid broad selectors like:

```text
[class*="ad"]
[class*="menu"]
[class*="header"]
```

unless tightly scoped to provider page and outside the player path.

---

## 4. Native promotion rules

Native promotion is useful only when the direct source is known safe and intended.

### Safe pattern

CBC exact HLS is allowed to native-promote only when the URL matches the known host/path. Native error falls back to browser and keeps page visible.

### Dangerous pattern

Dailymotion browser player can expose ad/media assets. Promoting those caused duplicate full-screen advert playback.

Bad signals:

```text
promote accepted ... adsappsvideostorage
promote accepted ... bingads
browser media play also active
```

Good Dailymotion fix:

```text
provider native promote skipped reason=dailymotion-browser-player
geckoView visible
browser media play continues
```

Native promotion blocks must be scoped by provider context, current/root URL, player URL, and specific video id where possible.

---

## 5. Synthetic tap rules

Synthetic taps are high-risk.

Default rule:

```text
No centre tap unless logs and screenshots prove it is needed.
```

Safe tap pattern:

- Detect a real visible control.
- Send one native tap to its centre.
- Rate-limit and session-limit it.
- Reset state on leaving provider context.
- Log exact provider, trigger, target kind, native coordinates, CSS coordinates, viewport, and reason.

Avoid:

```text
unbounded wake taps
blind centre taps on ad surfaces
consent tap bursts that leak to other providers
fullscreen taps after Back suppression
```

GBN specifically must not regain the old synthetic tap paths:

```text
gbn autostart tap
gbn consent native tap
gbn consent follow-up
gbn player wake tap
gbn consent frame native tap burst
```

---

## 6. Consent handling rules

Consent should only be automated when it visibly blocks playback.

Pattern:

1. Confirm consent is visible in screenshot/logs.
2. Confirm provider context.
3. Try scoped DOM compatibility helper only in context.
4. Use native tap only when DOM click fails.
5. One-shot or bounded retries only.
6. Never let consent helpers leak across providers sharing the same third-party host.

CVC9 needed Dailymotion consent handling. GBN currently works without Dailymotion consent taps and should not inherit CVC9 behaviour.

---

## 7. Ad/popup navigation guard

Dailymotion ad surfaces can open hostile new sessions. Guards must be provider-scoped.

Known guarded paths:

```text
adclick.g.doubleclick.net/pcs/click
bing.com/api/v1/mediation/tracking
bing.com/aclick
rlink=...bing.com/aclick
```

Apply in:

```text
onLoadRequest
onNewSession
```

Never implement a global ad blocker.

---

## 8. Autoplay permission rule

Autoplay permission must be scoped to:

- provider top page/current root URL
- player iframe/source host
- audible/inaudible autoplay permission only

Accepted logs include:

```text
abs tego autoplay permission allow
ttt tego autoplay permission allow
novus telearuba autoplay permission allow
cgtv autoplay permission allow
chtv autoplay permission allow
caribvision autoplay permission allow
cvm vimeo autoplay permission allow
cnc3 dailymotion autoplay permission allow
cvc9 dailymotion watch-page autoplay permission allow
gbn dailymotion embed autoplay permission allow
```

---

## 9. Bundled asset verification

Every `content.js` change must verify the APK-bundled asset, not just source.

```bash
unzip -l app-gv/build/outputs/apk/bravia/release/app-gv-bravia-release.apk | rg "gv_media_observer|content.js"

unzip -p app-gv/build/outputs/apk/bravia/release/app-gv-bravia-release.apk assets/gv_media_observer/content.js | rg -n "provider-marker|content-provider|candidateCount"
```

For important player-first patches:

```bash
tmp=$(mktemp)
unzip -p app-gv/build/outputs/apk/bravia/release/app-gv-bravia-release.apk assets/gv_media_observer/content.js > "$tmp"
cmp -s "$tmp" app-gv/src/main/assets/gv_media_observer/content.js && echo "BUNDLED_SOURCE_MATCH=1"
rm -f "$tmp"
```

Use provider script markers such as:

```text
gbn-header-cover-v2
compass-jw-v1
```

---

## 10. Standard validation

```bash
git diff --check
node --check app-gv/src/main/assets/gv_media_observer/content.js
./gradlew :app-gv:compileBraviaReleaseKotlin --console=plain
./gradlew :app-gv:assembleBraviaRelease --console=plain
```

---

## 11. Standard ADB discipline

Use absolute ADB and the known Bravia serial:

```bash
ADB="$HOME/Library/Android/sdk/platform-tools/adb"
SERIAL="192.168.0.16:5555"
PKG="com.kulchaflo.tv.mk2.gv"
APK="app-gv/build/outputs/apk/bravia/release/app-gv-bravia-release.apk"
```

Avoid plain `adb`, parallel ADB, unnecessary `kill-server`, and clearing data unless testing fresh state.

---

## 12. Fresh vs same-install testing

Fresh install tests first-run cookies, consent, profile and cache.

Same-install relaunch tests second-run behaviour, duplicate playback, cached consent, and ad/no-ad variation.

For Dailymotion, ad/no-ad variation is normal. The failure is duplicate layers, adclick takeover, blocked playback, or visible page chrome.

---

## JWPlayer Compass TV caution / failed-pattern bank

Compass TV was a useful failure case for JWPlayer browser-first work. Bank the lessons below before trying another Compass pass.

### 1. Audio assist rule

- If `videoMuted=false` and `videoVolume=1`, stop trying to unmute.
- Do not repeatedly publish `audio-unmute-attempt` or `audio-state` when the state is already correct.
- Prefer silent bounded unmute attempts.
- Diagnostic logging must be sparse and not tied to `MutationObserver` loops.

### 2. JW layout rule

- Do not blindly force `.jw-video`, `video`, `.jw-media`, `.jw-controls`, `.jw-display`, `.jw-controlbar` to `position:absolute/inset:0`.
- Broad absolute positioning can collapse video height to `0`.
- Start with a stable outer player-first wrapper.
- Only adjust the actual JW root/wrapper after it exists and has non-zero dimensions.
- Keep the v1 visual stability as the baseline before adding audio fixes.

### 3. Prompt bridge rule

- Do not flood the Gecko prompt bridge with repeated provider-state messages.
- Prompt spam can destabilize page settling even without `AndroidRuntime` or `FATAL` crashes.
- Retry loops should be bounded and should not publish every iteration unless debugging a temporary local test.

### 4. Applied guard rule

- Do not remove a `playerFirstApplied` guard unless layout reapply is separated from logging and audio side effects.
- Reapply CSS must not re-trigger play-control detection, audio assist logging, or prompt publishing repeatedly.

### 5. ADB discipline reminder

- Codex/Copilot must not use plain `adb`.
- Do not run `adb kill-server` or `adb start-server` unless the user explicitly authorizes an ADB reset.
- Use the project-approved absolute ADB path and serial if device testing is requested by the user only.
- Docs/source-only tasks must not run `adb`.

### 6. Compass future template

- First attempt should be minimal:
  - official page only
  - hide page chrome
  - target the JW wrapper
  - one-shot real play tap only if needed
  - one or two silent unmute attempts after trusted click/play
  - no native promotion block
  - no repeated audio logs
  - no `MutationObserver`-triggered audio
  - no broad JW CSS

### 7. Accepted Compass JWPlayer pattern

- Compass accepted commit: `ed8eb89 Add Compass TV JWPlayer helper`
- Keep marker: `compass-jw-v4-minimal`
- Use official page only.
- Apply fullscreen only to the stable outer wrapper.
- Remove wrapper border-radius, margin, padding, shadow, and page chrome.
- Do not force `video` or `.jw-video` to `absolute`, `inset: 0`, or `100vh`.
- Use one-shot native tap only when the play control is found.
- Use silent bounded audio bursts after:
  - `play-control-found`
  - trusted player interaction
  - JW `ready`, `play`, `firstFrame` events
  - video `loadedmetadata`, `canplay`, `play`, `playing`, `volumechange` events
- Audio retries should be silent and stop once `video.muted=false` and `video.volume>0` or JW reports unmuted volume.
- Do not publish audio state via `promptPayload`.
- Do not use `MutationObserver` for audio.
- Do not add native promotion unless logs prove it is needed.
- Test result: 10/10 runs reached browser media play with one tap per run and no native promotion or old-marker regressions.

---

## 13. New helper prompt template

```text
New live provider helper: [Provider]

Use GPT-5.4-mini medium.

Do not commit.
Do not run adb unless explicitly asked.

Accepted providers to protect:
- YouTube
- Facebook
- ABS TV
- TTT Live
- Novus Telearuba
- CGTV
- Caribbean Hot TV
- CaribVision
- CBC TV8
- CVM
- CBN
- CNC3
- CVC9
- GBN

New target:
- Official URL:
- Country:
- Player type:
- HTML evidence:
- Player selector:
- Embed/script URL:
- Visible play/fullscreen controls:
- Page chrome to hide:

Tasks:
1. Classify the provider against existing helper families.
2. Add provider-scoped URL helpers.
3. Add content.js player-first helper.
4. Add one-shot real-control play tap only if required.
5. Add scoped autoplay permission only if required.
6. Add native promotion guard only if logs prove duplicate/browser conflict.
7. Add consent/popup guard only if logs prove it.
8. Verify bundled APK asset.
9. Report exact files changed, validation, diff stat/status, no commit.
```
