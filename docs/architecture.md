# Kulcha Flo TV Browser MkII

## Project Purpose
`kulchaflo-tv-browser-mk2` is a separate experimental Android TV browser shell project for `kulchaflo.com`.

It is intentionally independent from the existing `kulchaflo-tv-app` project. The original project remains untouched and should be treated as the known-good baseline while MkII is explored in parallel.

The MkII goal is practical:
- provide a smooth TV browser container for `kulchaflo.com`
- support a tabbed architecture from day one
- establish strong D-pad and Back-handling foundations
- establish a standard fullscreen playback path without adding a custom native media engine in v1

## Current Status
The current scaffold builds successfully.

Verified:
- `:app:compileDebugKotlin` succeeded
- `:app:assembleDebug` succeeded

Build/tooling notes:
- the project currently uses a conservative Android Gradle Plugin / Kotlin / Gradle combination that builds cleanly
- `compileSdk = 35` currently produces a non-blocking AGP warning
- the warning does not prevent compile or debug APK assembly

## Current Implemented Scaffold
### Activity shell
- `BrowserActivity` exists and is the app entry point.
- Status: implemented enough to compile and provide base behavior.
- It hosts the tab container, fullscreen container, and tabs overlay container.
- It also owns the branded first-load overlay used during startup/loading.
- It creates the first tab on launch using `BuildConfig.DEFAULT_START_URL`.

### Tabs
- `BrowserTab`, `TabRepository`, and `TabController` exist.
- Status: implemented enough to compile and provide base behavior.
- `TabController` supports:
  - `createTab(url, activate)`
  - `createPopupTab(activate)`
  - `closeTab(tabId)`
  - `activateTab(tabId)`
  - `getActiveTab()`
- Current behavior is in-memory only. No persistence exists yet.

### Web layer
- `KfWebView`, `KfWebViewFactory`, `KfWebViewClient`, `KfWebChromeClient`, `WebSessionState`, `WebCompatRegistry`, and `WebPermissionController` exist.
- Status:
  - `KfWebView`, factory, client, and chrome client are implemented enough to compile and provide base behavior
  - `WebSessionState`, `WebCompatRegistry`, and `WebPermissionController` are scaffolded extension points
- Current web behavior includes:
  - TV-friendly WebView settings
  - official WebView dark-mode preference hints via AndroidX WebKit capability checks
  - page lifecycle callbacks
  - title/progress callbacks
  - standard `WebChromeClient` fullscreen custom-view hooks
  - popup/new-window requests routed into new tabs through `WebView.WebViewTransport`

### Input layer
- `TvInputSupervisor`, `BackNavigationController`, `FocusRecoveryController`, `ImeHandoffController`, `PointerNavigationController`, and `KeyRoutingResult` exist.
- Status:
  - `BackNavigationController`, `FocusRecoveryController`, and `TvInputSupervisor` are implemented enough to provide base TV routing behavior
  - `ImeHandoffController` is now partially wired for IME visibility tracking and post-dismiss focus recovery
  - `PointerNavigationController` is implemented enough to provide a first-pass pointer mode over the active WebView
- Current Back priority is:
  - exit fullscreen
  - close tabs overlay
  - handle IME dismissal / recent IME-close handoff
  - active WebView `goBack()`
  - finish activity

### Fullscreen layer
- `FullscreenController`, `FullscreenHostView`, and `FullscreenState` exist.
- Status:
  - `FullscreenController` is implemented enough to compile and provide base behavior
  - `FullscreenHostView` and `FullscreenState` are lightweight scaffolds
- Current fullscreen behavior uses standard `WebChromeClient` custom-view entry/exit flow.

### Policy layer
- `UserAgentPolicy`, `BrowserPolicy`, `DomainPolicy`, and `MediaPolicy` exist.
- Status:
  - `UserAgentPolicy`, `BrowserPolicy`, and `MediaPolicy` are partially wired
  - `DomainPolicy` is scaffold/TODO only
- Current usage:
  - startup URL and platform snapshot are carried in `BrowserPolicy`
  - WebView creation applies `UserAgentPolicy`
  - media settings are influenced by `MediaPolicy`

### Platform layer
- `PlatformCapabilities`, `PlatformDetector`, `GenericOsdPolicy`, and `GenericVideoSurfacePolicy` exist.
- Status:
  - `PlatformDetector` and `PlatformCapabilities` are implemented enough to compile and provide base behavior
  - generic OSD/video-surface policies are scaffold/TODO only
- Current scope is limited to lightweight Android TV capability detection.

### Media diagnostics
- `PlaybackDiagnostics` and `PlaybackEventLogger` exist.
- Status: scaffolded but compile-safe.
- They provide a place to add structured playback logging without committing to a custom media engine.

### UI placeholders
- `TabStripView`, `TabChipView`, `TabsOverlayController`, `BrowserChromeController`, `PointerOverlayView`, and `UiState` exist.
- Status:
  - `TabsOverlayController`, `TabStripView`, `TabChipView`, `BrowserChromeController`, and `PointerOverlayView` are partially wired
  - `UiState` is a lightweight scaffold
- Current UI is intentionally minimal and dark. The activity theme defaults to night mode and the shell surfaces use dark TV-oriented colors.
 - The tabs overlay is now a visible TV strip with one focusable chip per tab. `MENU` opens the strip, `OK/CENTER` activates the focused tab, `MENU` or `DEL` on a focused chip requests tab close, and `Back` dismisses the overlay.
 - Ordinary browsing now prefers a visible pointer overlay over card-by-card focus stepping. D-pad moves the pointer, and `OK/CENTER` dispatches a click at the pointer location on the active WebView.

### Manifest and launcher setup
- Android TV launcher setup exists in the manifest.
- Status: implemented enough to run as a separate TV app.
- The app has:
  - leanback launcher intent filter
  - a branded TV banner drawable
  - internet permission
  - TV-friendly feature declarations
  - separate application ID so it can coexist with the original app

### Branding assets
- Android TV branding uses the actual front-page hero asset pair from the website theme:
  - `wp-content/themes/hello-elementor-child/assets/brand/kulchaflo-wordmark.svg`
  - `wp-content/themes/hello-elementor-child/assets/brand/waves.svg`
- These files are a matched pair exported from the same design and should be treated as aligned layers, not manually redesigned or re-spaced independently.
- The source SVGs were rasterized into:
  - `app/src/main/res/drawable-nodpi/kf_hero_wordmark.png`
  - `app/src/main/res/drawable-nodpi/kf_hero_waves.png`
- They are currently layered in:
  - `app/src/main/res/drawable/tv_banner.xml`
  - `app/src/main/res/drawable/kf_window_background.xml`
  - `app/src/main/res/drawable/kf_loading_brand.xml`
- Presentation policy:
  - the TV banner uses the matched pair layered together
  - startup/launch appearance uses the same matched pair
  - `BrowserActivity` keeps a first-load branded overlay visible until the first page finishes loading
  - the small launcher icon remains separate because the full wordmark-plus-wave pair is not readable enough at icon size
- Guardrail for future edits:
  - do not replace these with generic Android placeholders
  - do not manually redraw or re-space the wordmark/wave relationship unless the website hero branding itself changes
  - if branding changes, regenerate Android assets from the website source SVGs instead of editing the PNGs by hand

### Activity layout
- `activity_browser.xml` exists.
- Status: implemented enough to compile and provide base behavior.
- It includes:
  - main browser host container
  - fullscreen host container
  - hidden chrome placeholder
  - tabs overlay container

## Package Map
### `com.kulchaflo.tv.mk2.app`
Application and activity entry points.

### `com.kulchaflo.tv.mk2.tabs`
Tab model, tab storage, and tab lifecycle control.

### `com.kulchaflo.tv.mk2.web`
WebView construction, page callbacks, fullscreen hooks, compatibility stubs, and web permission stubs.

### `com.kulchaflo.tv.mk2.input`
TV remote key routing, Back handling, focus recovery, IME handoff, and pointer-style navigation.

### `com.kulchaflo.tv.mk2.ui.pointer`
Pointer overlay rendering for pointer-style WebView interaction.

### `com.kulchaflo.tv.mk2.fullscreen`
Standard fullscreen custom-view container and controller.

### `com.kulchaflo.tv.mk2.policy`
Configurable runtime policies for browser behavior, user agent, domains, and media.

### `com.kulchaflo.tv.mk2.platform`
Platform capability detection and future extension points.

### `com.kulchaflo.tv.mk2.platform.generic`
Generic no-op placeholders for OSD and video-surface policy.

### `com.kulchaflo.tv.mk2.media`
Playback diagnostics and logging scaffolding.

### `com.kulchaflo.tv.mk2.ui.tabs`
Tab-strip and tabs-overlay UI placeholders.

### `com.kulchaflo.tv.mk2.ui.chrome`
Minimal browser chrome coordination.

### `com.kulchaflo.tv.mk2.ui.state`
High-level UI state model placeholder.

### `com.kulchaflo.tv.mk2.util`
Shared small utilities such as logging, debouncing, and URL normalization.

## Runtime Flow
Current intended runtime flow in the scaffold:

1. App launch
- `BrowserActivity` starts from the leanback launcher.
- The activity inflates the main browser layout and detects basic platform capabilities.

2. First tab creation
- `BrowserActivity` builds the supporting controllers.
- If there is no restored state, it creates the first tab using `BuildConfig.DEFAULT_START_URL`.

3. WebView creation and load
- `TabController` asks `KfWebViewFactory` for a new `KfWebView`.
- The factory applies TV-friendly WebView settings and attaches `KfWebViewClient` and `KfWebChromeClient`.
- The active tab loads the configured start URL.

4. Page lifecycle hooks
- `KfWebViewClient` forwards page started / finished / visited-history updates back to the activity callback surface.
- `FocusRecoveryController.onPageFinished(...)` schedules a delayed focus restore to the active WebView.
- `KfWebChromeClient` forwards title and progress updates.

5. Popup / new-window path
- If the page requests a new window, `KfWebChromeClient.onCreateWindow(...)` calls back into `BrowserActivity`.
- `BrowserActivity` asks `TabController` to create a popup tab instead of constructing a WebView ad hoc.
- The new tab WebView is handed back to the Android WebView popup mechanism through `WebView.WebViewTransport`.
- User-gesture popup requests are activated immediately; non-user-gesture popup requests are currently created in the background.

6. Fullscreen path
- If the page requests fullscreen custom view, `KfWebChromeClient.onShowCustomView(...)` routes into `FullscreenController`.
- `FullscreenController` swaps the custom view into the fullscreen host container.
- Back handling exits fullscreen before other navigation rules.

7. D-pad / Back path
- `BrowserActivity.dispatchKeyEvent(...)` routes keys into `TvInputSupervisor`.
- `TvInputSupervisor` now applies explicit priority in this order:
  - fullscreen custom view
  - tabs overlay
  - IME handoff guard window
  - pointer-style navigation over the active WebView
  - active WebView focus restoration fallback
  - framework/WebView default delivery
- In ordinary browsing mode, D-pad directions move a virtual pointer over the active WebView instead of relying primarily on focus stepping.
- `PointerNavigationController` injects `ACTION_HOVER_ENTER` / `ACTION_HOVER_MOVE` mouse-style motion and `ACTION_DOWN` / `ACTION_UP` touch events at the current cursor coordinates so hover- and tap-driven web cards can react.
- `MENU` is the explicit tabs trigger. When the overlay is hidden it opens the tab strip; once the overlay is visible, focused tab chips handle `MENU`/`DEL` as a close request and `Back` closes the overlay first.
- During a short post-IME-dismiss handoff window, directional keys are consumed by the shell so they do not immediately fall back into page scrolling before WebView focus is restored.
- `BackNavigationController` handles fullscreen, tabs overlay, IME dismissal / recent IME-close handoff, WebView history, then activity finish.

## Deferred Work
The following are intentionally not built yet:
- persistent tab/session restore
- richer IME behavior and keyboard handoff edge cases
- deeper domain compatibility logic
- vendor-specific Sony/MediaTek hooks
- native media bridge
- decoder arbitration
- OSD plane integration
- vendor-specific video-surface routing

## Design Principles
- Chromium/WebView should own ordinary page rendering, DOM behavior, and ordinary focus behavior.
- App code should focus on TV control-plane behavior: startup focus, Back priority, fullscreen container management, tabs, and remote input routing.
- Vendor/device-specific hooks must stay isolated behind interfaces or policy classes.
- Dark appearance should prefer official app-theme and WebView APIs over injected CSS/JS workarounds.
- Do not rebuild Sony-style complexity until device testing proves there is a concrete need.

## Recommended Next Steps
- Strengthen `TvInputSupervisor` using real remote-testing behavior instead of placeholder routing.
- Add basic tab-strip interaction and state persistence.
- Refine popup/tab activation policy and add UI affordances for background-created popup tabs.
- Validate fullscreen behavior across:
  - YouTube
  - social video pages
  - live stream pages
  - embedded players with custom fullscreen behavior

## Build / Run Notes
- Project path:
  `/Users/kenz/Documents/backup-kulchaflo.com-3-14-2026 Working/public_html/kulchaflo-tv-browser-mk2`
- Debug APK path:
  `/Users/kenz/Documents/backup-kulchaflo.com-3-14-2026 Working/public_html/kulchaflo-tv-browser-mk2/app/build/outputs/apk/debug/app-debug.apk`
- The project needs a valid Android SDK path in `local.properties`.
- Current local setup uses:
  `sdk.dir=/Users/kenz/Library/Android/sdk`
- MkII and the original app can coexist on the same device because MkII uses a different application ID:
  `com.kulchaflo.tv.mk2`
- Real-device validation notes:
  - debug-only transition logs are emitted under `KfInputDebug`, `KfTabDebug`, `KfFocusDebug`, and `KfFullscreenDebug`
  - use `docs/device-test-checklist.md` for the first Sony Bravia validation pass
