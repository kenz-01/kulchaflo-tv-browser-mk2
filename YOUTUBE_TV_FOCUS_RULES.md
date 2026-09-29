# YouTube TV Focus Navigation Rules

This file defines the target behavior for the GeckoView YouTube focus helper.
The helper should follow this model instead of ad hoc DOM-nearest selection.

## Baseline

- D-pad moves focus to a reachable item in the requested direction.
- Every visible actionable YouTube control in the active page zone must be reachable.
- Focus must be visually obvious.
- `CENTER` activates the focused item.
- `BACK` leaves transient modes before leaving the page.
- A thumbnail preview must stop when focus leaves that thumbnail.

## Page Model

The helper classifies visible YouTube elements into zones, then rows.

- `chrome`: search, voice search, app/menu controls. Only reachable from upper page rows, not from video grids.
- `channel-header`: channel action buttons such as subscribe, join, about links.
- `tabs`: Home, Videos, Shorts, Live, Playlists, Community, Channels, About.
- `chips`: filter chips such as Latest, Popular, Oldest, All.
- `video-grid`: channel and search result thumbnails, grouped into visual rows.
- `playlist-list`: playlist page video rows and watch-page playlist side-panel rows.
- `watch-controls`: player controls. These are only part of focus navigation when player controls are visible.

## Direction Rules

### Horizontal

- Inside a multi-item row, `LEFT` and `RIGHT` move to the adjacent item in that row.
- If there is no adjacent item in the same row, horizontal movement stops at the boundary.
- Horizontal movement from a video row must not jump to top-bar search, voice search, subscribe, or player controls.
- Horizontal movement between zones is only allowed for explicit adjacent panes, such as watch page player controls to playlist panel when controls are visible.

### Vertical

- `UP` and `DOWN` move between rows in the current zone, preserving the current column where possible.
- If the destination row has fewer items, choose the item whose center is nearest the previous item center.
- From a video grid row, `UP` moves to chips, then tabs, then channel header, then chrome.
- From tabs or chips, `DOWN` moves back toward the first visible content row.
- For single-column playlist rows, `UP` and `DOWN` move one video at a time.
- At the vertical boundary, scroll the page or list, then keep focus in the same logical zone.

## Activation Rules

- Video thumbnail or playlist row: navigate to the resolved watch URL.
- Tab: click the tab and keep focus in the tab row after navigation or content refresh.
- Chip: click the chip and keep focus in the chip row after content refresh.
- Search: focus the search field or activate its button only when the focus is already in `chrome`.
- Subscribe or channel action: click the button only when focus is in `channel-header`.

## Thumbnail Preview Rules

- Entering a video thumbnail may send hover/pointer events to start the preview.
- Leaving a video thumbnail must send pointer leave/mouse leave events to the old renderer.
- If preview video elements exist inside the old renderer, pause and reset them.
- Moving to another thumbnail must stop the previous thumbnail preview before starting the next one.

## Performance Rules

- Do not scan every `button[aria-label]` on every key press.
- Collect candidates by zone-specific selectors only.
- Cache the visible row model briefly and invalidate it after scroll, URL change, tab/chip activation, or page mutation.
- Restrict `getBoundingClientRect()` work to visible zone candidates.
- Log zone, row, item, target summary, and candidate counts for every focus move.

