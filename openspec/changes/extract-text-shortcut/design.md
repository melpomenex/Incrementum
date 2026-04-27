## Context

The app currently has multiple hardcoded or partially-wired extraction shortcuts:
- `Alt+X` — hardcoded in `useInlineExtraction.ts`, not customizable
- `Alt+Z` — hardcoded cloze, same file
- `edit.new-extract` (`Ctrl+Meta+E`) — exists in the shortcut store but has no handler in `SHORTCUT_ACTION_HANDLERS`

Users have asked for a single, intuitive shortcut (`Ctrl+E`, "E for Extract") that works app-wide across all document types. The existing keyboard shortcut system (`KeyboardShortcuts.tsx`) supports user customization via the Settings panel, but no extract action is wired into the dispatch system.

### Current Architecture

```
App.tsx (keydown + SHORTCUT_ACTION_HANDLERS)
  └─> useInlineExtraction.ts (Alt+X/Alt+Z — hardcoded, viewer-scoped)
  └─> DocumentViewer (owns selectedText + selectionContext, passed up by sub-viewers)
        ├─> PDFViewer    → onSelectionChange(text, PdfSelectionContext)
        ├─> EPUBViewer   → onSelectionChange(text, EpubSelectionContext)
        ├─> MarkdownViewer → onSelectionChange(text, TextSelectionContext)
        └─> YouTubeViewer → onSelectionChange(text) + time-based extract dialog
```

All sub-viewers report selection to `DocumentViewer.updateSelection()`, which normalizes into `selectedText` + `selectionContext`. Extraction then flows through `handleInlineExtract` (called by `useInlineExtraction` hook) or a dialog.

## Goals / Non-Goals

**Goals:**
- Add `edit.extract-text` shortcut (default `Ctrl+E`) to the customizable shortcut store
- Wire it to create extracts from the current text selection, working across PDF, EPUB, HTML, Markdown, and YouTube transcript modes
- Make it visible and configurable in Keyboard Shortcuts settings
- Decouple the global shortcut from viewer-specific logic using a custom `extract-text` DOM event

**Non-Goals:**
- Change `Alt+X`/`Alt+Z` behavior (preserved as-is)
- Change the extract creation backend (reuses existing `createExtract` pipeline)
- Add extraction for media types that don't support text selection (audio, images)
- Change `edit.new-extract` (remains unhandled; could be removed in a follow-up cleanup)

## Decisions

### Decision 1: Use a custom DOM event (`extract-text`) to decouple shortcut from viewers

**Chosen:** The `SHORTCUT_ACTION_HANDLERS` handler dispatches `window.dispatchEvent(new CustomEvent("extract-text"))`. DocumentViewer listens for this and calls its existing `handleInlineExtract`.

**Rationale:** The shortcut fires globally (handled in `App.tsx`), but the extraction logic lives inside `DocumentViewer`, which is not always mounted (e.g., user is on Dashboard). Using a DOM event avoids coupling `App.tsx` to viewer internals and follows the existing pattern used by other shortcuts (`start-review-session`, `import-document`).

**Alternative considered:** Pass a callback ref from DocumentViewer up to App. Rejected — requires lifting viewer state into the App shell, breaking the current component boundaries.

### Decision 2: DocumentViewer is the single event listener (not each sub-viewer)

**Chosen:** Only `DocumentViewer` listens for the `extract-text` event. Since it already holds `selectedText` and `selectionContext` state (fed by all sub-viewers via `onSelectionChange`), it can create the extract regardless of which viewer type is active.

**Rationale:** All sub-viewers already report selection to DocumentViewer. Having each listen independently would duplicate logic and risk race conditions. The only special case is YouTube, where the time-based extraction dialog needs a separate path — handled by a second listener on the YouTubeViewer component.

**Alternative considered:** Have each sub-viewer register its own listener. Rejected — increases surface area and each would need its own `createExtract` invocation logic.

### Decision 3: For YouTube, `extract-text` opens the time-based extract dialog

**Chosen:** YouTubeViewer listens for `extract-text` and calls `handleOpenCreateExtract()` (which sets the current playback time and opens the `CreateVideoExtractDialog`). DocumentViewer's listener does nothing when the active viewer is YouTube.

**Rationale:** YouTube transcripts don't have text selections in the traditional sense — extracts are anchored to time ranges. The user intent for "extract text" on a video is to capture the transcript segment at the current playback position. This is the only case where a sub-viewer needs its own event listener.

### Decision 4: Keep `edit.new-extract` in the store but don't wire it

**Chosen:** Leave the existing `edit.new-extract` shortcut as-is (no handler). A future cleanup could remove or repurpose it.

**Rationale:** This change is additive — adding a working shortcut should not break or rename existing ones. Users may have customized `edit.new-extract` and removing it unexpectedly would be a **BREAKING** change in shortcut configurations.

## Risks / Trade-offs

- **[Risk] Shortcut conflict**: `Ctrl+E` may conflict with other shortcuts (e.g., `edit.new-extract` is `Ctrl+Meta+E` which won't collide since it requires the Meta modifier too). → **Mitigation**: The shortcut system already has `findConflicts()` used in settings UI; `Ctrl+E` is distinct from all existing defaults.
- **[Risk] Event doesn't reach viewer**: If DocumentViewer is unmounted (user on Dashboard), pressing `Ctrl+E` silently does nothing. → **Mitigation**: This is acceptable — extracting text only makes sense when viewing a document. Could add a toast "No document open" in a follow-up.
- **[Risk] YouTube transcript not loaded**: Pressing `Ctrl+E` on a YouTube video with no transcript loaded. → **Mitigation**: The existing `handleOpenCreateExtract` already handles this gracefully (button disabled, no-op).
