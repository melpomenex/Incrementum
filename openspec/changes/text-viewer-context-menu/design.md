## Context

The app has three text-based document viewers that support text selection:

- **EPUBViewer**: Renders via epubjs in an iframe. Reports selections via `onSelectionChange` callback with `EpubSelectionContext` (CFI range). Has NO right-click handling.
- **MarkdownViewer**: Renders markdown as HTML in a div. Has a minimal right-click handler that only offers "Create Flashcard" (via `onCreateFlashcard`).
- **HTML/OCR viewer**: Renders in an iframe inside DocumentViewer. No right-click handling.

The existing `ContextMenu` component (`src/components/common/ContextMenu.tsx`) provides a full-featured context menu with submenus, keyboard navigation, icons, shortcuts, and separators. It is currently used only in review/card management, not in document viewers.

DocumentViewer already manages selection state and action callbacks (`createInstantExtract`, `openExtractDialog`, `handleDictionaryLookup`, `setFlashcardStudioSeed`). These just need to be wired to a context menu.

## Goals / Non-Goals

**Goals:**
- Provide a unified right-click context menu for selected text in EPUBViewer and MarkdownViewer
- Consolidate all available text actions into one discoverable interaction
- Reuse the existing `ContextMenu` component
- Handle iframe boundary for EPUBViewer (contextmenu events fire inside the epubjs iframe)

**Non-Goals:**
- PDF right-click menu (PDFViewer already has `SelectionPopup`)
- Adding new actions beyond what already exists (just surfacing existing ones)
- Replacing the floating extract button (it remains as an alternative trigger)
- Audiobook/video transcript context menus (separate viewers with different UX)

## Decisions

### 1. Render context menu in DocumentViewer, not in individual viewers

The context menu will be rendered at the `DocumentViewer` level, which already holds all the action callbacks and selection state. Individual viewers (EPUBViewer, MarkdownViewer) will report right-click events via a new `onContextMenu` prop, passing `{ x, y, selectedText }`.

**Why DocumentViewer**: All action handlers (`createInstantExtract`, `handleDictionaryLookup`, `setFlashcardStudioSeed`, etc.) live in DocumentViewer. Duplicating them in each viewer would create coupling and drift. The viewers should remain thin presentation layers.

**Alternative considered**: Render the menu inside each viewer. Rejected because it would require passing many action callbacks and state into each viewer component.

### 2. Use a hook-based approach for EPUBViewer iframe events

EPUBViewer renders inside an epubjs iframe. Right-click events fire inside the iframe's document, not the parent. We'll add a `contextmenu` event listener inside the iframe (same pattern used for `selectionchange` and `mouseup` in the existing `handleSelectionChange` function) that posts the event coordinates and selected text up to the parent via the `onContextMenu` callback.

**Why**: EPUBViewer already uses this pattern for selection events — it's proven and avoids cross-origin issues since the iframe is same-origin.

### 3. Menu items built dynamically based on selection state

The menu items will be computed on each right-click based on whether text is selected:
- **With selection**: Extract, Extract (dialog), Highlight (submenu), Copy, Dictionary Lookup, Create Flashcard
- **Without selection**: No menu shown (or minimal: Select All only)

**Why**: Showing all actions when nothing is selected would be confusing. Actions like "Copy" and "Extract" only make sense with selected text.

### 4. Highlight as a submenu with color options

The Highlight action will be a `ContextMenuItem` with `type: Submenu` containing 5 color options. Selecting a color creates an extract with that highlight color (same as the PDF SelectionPopup behavior).

**Why**: Matches the existing 5-color palette (yellow, green, blue, pink, purple) already used in PDF highlighting and the SelectionPopup.

## Risks / Trade-offs

- **[Risk] EPUB iframe context menu position mismatch** → The iframe may be scrolled/offset from the parent. Mitigation: Use `iframe.getBoundingClientRect()` to offset coordinates, same as existing selection coordinate handling.
- **[Risk] Context menu conflicts with native browser right-click** → We call `e.preventDefault()` to suppress the native menu when our custom menu is shown. This is standard practice and already done in MarkdownViewer.
- **[Risk] MarkdownViewer replacement breaks existing "Create Flashcard" right-click** → The new menu will include "Create Flashcard" as one of its items, so no functionality is lost.
