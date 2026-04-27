## Context

Queue scroll mode (`QueueScrollPage.tsx`) renders queue items (documents, RSS, flashcards, extracts) in a TikTok-style vertical scroller. Currently:

1. A "Hide Assistant" floating button sits at `fixed bottom-left z-[70]` with `bottom-20 md:bottom-6`. For audiobook-type items, this overlaps with audiobook playback controls (chapter navigation, play/pause). The `AssistantPanel` already has a collapse chevron at its top-right that achieves the same purpose — fully hiding the panel by removing it from the DOM is possible via that chevron's collapse state.

2. When viewing documents in scroll mode, they render with `embedded={true}`, which strips the entire `DocumentViewer` toolbar. Users lose access to extracts view, learning cards view, and the create-extract action. They must exit scroll mode to access these.

## Goals / Non-Goals

**Goals:**
- Eliminate the overlap between the "Hide Assistant" button and audiobook/content controls
- Provide access to extracts and learning items without leaving scroll mode
- Keep the UI minimal and non-intrusive in scroll mode's immersive experience

**Non-Goals:**
- Full DocumentViewer toolbar parity (search, zoom, page navigation, fullscreen, share, OCR toggle, edit palette are not needed in scroll mode)
- Changing how the assistant panel collapse works internally
- Modifying flashcard or extract review items (they already have their own UI)

## Decisions

### 1. Remove the "Hide Assistant" button entirely

**Rationale:** The button is redundant — the `AssistantPanel` has a built-in collapse/expand chevron. Removing it fixes the overlap issue with no loss of functionality. The `isAssistantVisible` state and `toggleAssistantVisibility` function in `QueueScrollPage` can also be removed, simplifying state management.

**Alternative considered:** Reposition the button. Rejected because repositioning just moves the overlap problem elsewhere, and the button is genuinely redundant.

### 2. Add a minimal floating toolbar for document/RSS items

**Rationale:** Rather than extracting/reusing the full `DocumentViewer` toolbar (which is tightly coupled to many DocumentViewer-specific features), add a lightweight overlay toolbar that appears at the top of document/RSS scroll items. This toolbar provides:

- **View mode toggle** (Document / Extracts / Learning Cards) — same icon pattern as DocumentViewer
- **Create Extract button** (Lightbulb icon)

The toolbar follows the same auto-hide behavior as existing scroll mode controls (fades with `showControls` after 3s idle).

**Implementation approach:** Add the toolbar inline in `QueueScrollPage` within the overlay controls section (around line 2184), gated on `renderedItem.type === "document" || renderedItem.type === "rss"`. The toolbar toggles a local `scrollViewMode` state (`"document" | "extracts" | "cards"`). When in extracts or cards mode, render `<ExtractsList>` or `<LearningCardsList>` filtered to the current document, replacing the document viewer area.

### 3. State management for view modes in scroll mode

**Rationale:** Use a `useState<"document" | "extracts" | "cards">` local to `QueueScrollPage`, reset to `"document"` when the scroll item changes. No persistence needed — view mode is transient per item.

## Risks / Trade-offs

- [Toolbar clutter] → Keep it minimal (3-4 buttons max) and auto-hide with existing `showControls` behavior
- [ExtractsList/LearningCardsList need document context] → Pass the current scroll item's document ID as a filter prop; these components already support filtered rendering
- [Embedded DocumentViewer still has no toolbar] → Correct; the new toolbar renders outside the embedded viewer in the scroll overlay, keeping the separation clean
