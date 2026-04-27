## 1. Remove Legacy HoverRatingControls

- [x] 1.1 Remove HoverRatingControls import and rendering from `DocumentViewer.tsx` (line 24 import, lines 4831-4841 JSX block)
- [x] 1.2 Remove `disableHoverRating` prop from DocumentViewer props interface (line 203) and destructuring (line 250), and remove all code that sets/toggles it
- [x] 1.3 Delete `src/components/review/HoverRatingControls.tsx` entirely

## 2. Add Orb Rating Buttons to DocumentViewer

- [x] 2.1 Add orb-style rating button JSX to DocumentViewer — four color-coded `rounded-full` buttons (red/orange/blue/green) positioned at `absolute right-4 top-1/2 -translate-y-1/2 z-40`, following the QueueScrollPage pattern (lines 2337-2407)
- [x] 2.2 Add tooltip labels on each orb button matching the existing i18n keys (`queueScroll.again`, `queueScroll.hard`, etc.)
- [x] 2.3 Add dismiss orb button (slate color, EyeOff icon) below the rating orbs
- [x] 2.4 Conditionally show single "Mark as Read" orb for new documents instead of four rating orbs (matching `isNewDocument` logic from QueueScrollPage)

## 3. Wire Up Rating Handlers

- [x] 3.1 Add keyboard shortcut handling for keys 1-4 in DocumentViewer's existing `useEffect` keydown listener (around line 2427), calling the existing `handleRating` function
- [x] 3.2 Update `handleRating` to use `rateDocumentEngaging` instead of `rateDocument` for consistency with queue rating behavior
- [x] 3.3 Wire orb button `onClick` handlers to call `handleRating(1|2|3|4)` and `handleDismiss` respectively

## 4. Cleanup

- [x] 4.1 Verify no other imports or references to HoverRatingControls remain in the codebase
- [x] 4.2 Verify keyboard shortcuts 1-4 work in document viewer for rating
- [x] 4.3 Verify orb buttons appear for EPUB, Markdown, and HTML documents but not for PDF/YouTube/Audio
- [x] 4.4 Verify orb buttons do not conflict visually with DocumentMinimap
