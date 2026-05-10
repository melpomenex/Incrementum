## Why

EPUB and markdown viewers lack a right-click context menu for selected text. Users must rely on the floating extract button (bottom-right FAB) or keyboard shortcuts, which are undiscoverable. MarkdownViewer has a minimal right-click menu with only "Create Flashcard," while EPUBViewer has no right-click handling at all. A context menu would consolidate all text actions (extract, copy, highlight, dictionary lookup, flashcard) into a single, familiar interaction pattern.

## What Changes

- Add a unified right-click context menu component for text selection in EPUBViewer and MarkdownViewer
- Replace MarkdownViewer's existing single-action right-click menu with the new unified menu
- Add right-click handling to EPUBViewer (currently has none)
- The context menu will offer these actions when text is selected:
  - **Create Extract** (instant) — same as floating button click
  - **Create Extract (with dialog)** — same as Shift+click on floating button
  - **Highlight** — submenu with 5 color options (yellow, green, blue, pink, purple), creates a colored extract
  - **Copy** — copy selected text to clipboard
  - **Dictionary Lookup** — look up first word
  - **Create Flashcard** — open FlashcardStudioModal with pre-filled QA draft
- The menu will NOT appear for PDF documents (PDFViewer already has SelectionPopup)
- Leverage the existing `ContextMenu` component from `src/components/common/ContextMenu.tsx`

## Capabilities

### New Capabilities
- `text-selection-context-menu`: Right-click context menu for selected text in non-PDF document viewers (epub, markdown, html)

### Modified Capabilities
_None — no existing specs are being modified._

## Impact

- **`DocumentViewer.tsx`**: Will provide action callbacks and context menu state management; may need to pass additional props to EPUBViewer and MarkdownViewer
- **`EPUBViewer.tsx`**: Add `onContextMenu` handler and context menu rendering
- **`MarkdownViewer.tsx`**: Replace existing single-action right-click with unified context menu
- **`src/components/common/ContextMenu.tsx`**: Existing component will be reused (no changes expected)
- **`SelectionPopup.tsx`**: No changes — remains PDF-only
