## 1. Remove Hide Assistant Button

- [x] 1.1 Remove the "Hide Assistant" floating button JSX block from `QueueScrollPage.tsx` (lines ~2025-2048)
- [x] 1.2 Remove the `isAssistantVisible` state, `toggleAssistantVisibility` function, and localStorage persistence (`scroll-mode-assistant-visible` key) from `QueueScrollPage.tsx`
- [x] 1.3 Remove the conditional rendering gate on `isAssistantVisible` for the `AssistantPanel` in scroll mode — always render the assistant panel (user can collapse via the panel's built-in chevron)

## 2. Add Scroll Mode Toolbar

- [x] 2.1 Add a `scrollViewMode` state (`"document" | "extracts" | "cards"`) to `QueueScrollPage`, defaulting to `"document"`
- [x] 2.2 Add a `useEffect` to reset `scrollViewMode` to `"document"` whenever the current scroll item index changes
- [x] 2.3 Add toolbar JSX in the overlay controls section (top area, after the existing top bar), gated on `renderedItem.type === "document" || renderedItem.type === "rss"`, with auto-hide via `showControls`
- [x] 2.4 Implement the three view mode toggle buttons (FileText / List / Brain icons) in a grouped button set matching DocumentViewer's styling
- [x] 2.5 Implement the Create Extract button (Lightbulb icon) that opens `CreateExtractDialog` for the current document

## 3. Wire View Mode Rendering

- [x] 3.1 When `scrollViewMode === "extracts"` and item is document/RSS, render `<ExtractsList>` filtered to the current document in place of the document viewer area
- [x] 3.2 When `scrollViewMode === "cards"` and item is document/RSS, render `<LearningCardsList>` filtered to the current document in place of the document viewer area
- [x] 3.3 When `scrollViewMode === "document"`, render the existing document viewer as before

## 4. Cleanup

- [x] 4.1 Remove unused i18n keys (`queueScroll.hideAssistant`, `queueScroll.showAssistant`, `queueScroll.hideAssistantShort`, `queueScroll.showAssistantShort`)
- [x] 4.2 Verify no other code references the removed state or localStorage key
