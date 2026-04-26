# MkII Device Test Checklist

Target device: Sony Bravia Android TV / Google TV

## Branding and launch
- Confirm the TV launcher icon is visible and readable.
- Confirm the Android TV banner uses Kulcha Flo branding correctly.
- Launch the app and confirm the branded startup/loading presentation appears before the first page finishes.
- Confirm the first-load branding dismisses once the initial page load completes.

## Tabs overlay
- Press `MENU` and confirm the tabs overlay opens.
- Confirm focus moves into the tab strip immediately.
- Move left and right through tabs with the D-pad.
- Press `OK/CENTER` on a background tab and confirm it becomes active.
- Open a popup/new-window flow and confirm the popup appears as a tab in the overlay.
- While the overlay is focused, press `MENU` or `DEL` on a non-last tab and confirm it closes.
- Press `BACK` while the overlay is open and confirm the overlay closes before page/activity back behavior runs.

## D-pad and focus
- Browse normally and confirm D-pad events stay with the active page instead of drifting into the shell.
- Load a new page and confirm focus recovers to the active WebView after load completion.
- Switch tabs and confirm focus returns to the active tab content after overlay dismissal.
- Enter and exit fullscreen content and confirm focus returns to the active WebView afterward.

## IME and keyboard handoff
- Focus a text field and confirm the TV keyboard appears.
- While the IME is visible, confirm D-pad does not immediately fall back into page scrolling.
- Dismiss the IME and confirm focus returns cleanly to the active WebView.
- Press `BACK` during text entry and confirm IME dismissal happens before page/activity back navigation.

## Fullscreen
- Enter fullscreen video and confirm the fullscreen host takes over correctly.
- Press `BACK` and confirm fullscreen exits before any other back action.
- Confirm the tabs overlay does not appear over fullscreen unless explicitly triggered.

## Back behavior
- Confirm `BACK` priority is:
  1. fullscreen exit
  2. tabs overlay close
  3. IME dismissal/handoff
  4. WebView history
  5. activity finish

## Dark appearance
- Confirm the shell remains dark across Kulcha Flo pages.
- Check YouTube pages for acceptable dark presentation.
- Check social/media pages for acceptable dark presentation.
- Note any pages where WebView dark preference behaves poorly or is ignored.

## Logcat tags
- `KfMkII:KfInputDebug`
- `KfMkII:KfTabDebug`
- `KfMkII:KfFocusDebug`
- `KfMkII:KfFullscreenDebug`
