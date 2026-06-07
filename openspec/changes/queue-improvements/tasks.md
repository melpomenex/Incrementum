## 1. Store and Settings Configuration

- [x] 1.1 Add `autoProceed` setting in `ScrollQueueSettings` interface in `src/stores/settingsStore.ts`
- [x] 1.2 Initialize `autoProceed` to `false` in `defaultSettings.scrollQueue` inside `src/stores/settingsStore.ts`
- [x] 1.3 Add a toggle button for `autoProceed` in the Settings panel inside `src/components/queue/ScrollQueueSettings.tsx`

## 2. Media Player Ended Event Handlers

- [x] 2.1 Add `onEnded?: () => void` to `YouTubeViewerProps` and call it when the player ends (state 0) in `src/components/viewer/YouTubeViewer.tsx`
- [x] 2.2 Add `onEnded?: () => void` to `LocalVideoPlayerProps` and register `onEnded={onEnded}` on both `<audio>` and `<video>` tags in `src/components/viewer/LocalVideoPlayer.tsx`
- [x] 2.3 Add `onEnded?: () => void` to `DocumentViewerProps` and propagate it to `YouTubeViewer`, `LocalVideoPlayer`, and `AudiobookViewer` in `src/components/viewer/DocumentViewer.tsx`

## 3. Queue Auto-Proceed Logic

- [x] 3.1 Pass `autoProceed` to `ScrollQueueSettings` in `src/pages/QueueScrollPage.tsx`
- [x] 3.2 Add `onEnded` handler to `DocumentViewer` in `src/pages/QueueScrollPage.tsx` that calls `goToNext()` if `settings.scrollQueue.autoProceed` is enabled

## 4. Context Menu Click-Outside Fix

- [x] 4.1 Update `handleClickOutside` in `src/components/viewer/DocumentViewer.tsx` to return early if the target click lies within a `.context-menu` element

## 5. Context Menu Submenu Hover Fix

- [x] 5.1 Render submenu in ContextMenu nested inside the parent item container to prevent mouseleave closing the submenu when hovering over color options
- [x] 5.2 Fix EPUB context menu coordinate conversion offset when multiple chapter iframes are mounted in the DOM
- [x] 5.3 Fix EPUB reader highlight colors override where stylesheet !important flags were forcing all highlight colors to yellow
