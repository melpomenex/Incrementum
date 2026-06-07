## Why

When playing videos or audios in the TikTok-style queue scroll page, users must manually navigate to the next item when one finishes. Enabling an auto-proceed option enhances user experience, especially when reviewing a playlist of video/audio content. Additionally, inside the queue scroll page, right-clicking text to open the selection context menu (e.g. to highlight, add notes, or make flashcards) is broken because clicking on any context menu or submenu item clears the text selection and immediately unmounts the menu before the click action can fire.

## What Changes

- Add an "Auto-proceed" option toggle inside the Scroll Queue Settings panel.
- Update `YouTubeViewer`, `LocalVideoPlayer`, and `DocumentViewer` components to propagate audio/video ended events.
- Update `QueueScrollPage` to handle ended events and automatically advance to the next item when auto-proceed is enabled.
- Fix the click-outside text selection clearing logic in `DocumentViewer.tsx` by adding a guard for `.context-menu` to prevent premature unmounting of the right-click menu and submenus.

## Capabilities

### New Capabilities
- `queue-scroll-improvements`: Option to auto-proceed to the next item in the queue when media ends, and fixes for text selection context menu functionality within the queue.

### Modified Capabilities
<!-- None -->

## Impact

- `src/stores/settingsStore.ts`: Add `autoProceed` setting in `ScrollQueueSettings`.
- `src/components/queue/ScrollQueueSettings.tsx`: Add a toggle control for the new `autoProceed` setting.
- `src/pages/QueueScrollPage.tsx`: Hook up the ended event handler for the document viewer to advance the queue when auto-proceed is enabled.
- `src/components/viewer/YouTubeViewer.tsx`: Add `onEnded` callback and trigger it on video completion.
- `src/components/viewer/LocalVideoPlayer.tsx`: Add `onEnded` callback and trigger it on audio/video completion.
- `src/components/viewer/DocumentViewer.tsx`: Add `onEnded` callback, propagate it to video/audio viewer child components, and fix the click-outside handler to ignore `.context-menu` elements.
