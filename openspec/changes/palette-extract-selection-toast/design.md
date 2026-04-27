## Context

The app has two document viewing paradigms:
- **Normal view**: The dedicated viewer (PDFViewer, EPUBViewer, HTMLViewer, MarkdownViewer). Text selection is detected per-viewer and surfaces a floating extract button at bottom-right via `activeExtractSelection`.
- **Palette mode**: `EditableContentPalette` replaces the viewer for editing content. It has no selection detection or extract integration.

The extract button condition (`activeExtractSelection && viewMode === "document"`) already gates on `viewMode === "document"`, which is correct — palette mode also uses `viewMode === "document"`, so the gate is not the blocker. The real gap is that `EditableContentPalette` never calls `onSelectionChange` to populate `selectedText`/`activeExtractSelection`.

For the toast issue: the floating extract button at line 4852 calls `createInstantExtract` directly, which internally calls `toast.success`. The toast system (`Toast.tsx`) is mounted at the app root. Investigation shows the toast call path is correct — the issue may be a timing/Zustand state issue or the toast container being hidden by the viewer's z-index stack.

## Goals / Non-Goals

**Goals:**
- Detect text selection inside `EditableContentPalette` and propagate it to `DocumentViewer` so the floating extract button appears.
- Ensure the toast notification shows reliably when creating an extract from the floating extract button in any view mode.
- Reuse the existing extract creation flow (no parallel path).

**Non-Goals:**
- Adding the `SelectionPopup` (highlight/copy/note toolbar) to palette mode — only the extract button is needed.
- Changing how palette mode renders or edits content.
- Adding new toast types or changing the toast system architecture.

## Decisions

### 1. Selection propagation via `onSelectionChange` callback
**Decision**: Add an `onSelectionChange` callback prop to `EditableContentPalette` that fires on `selectionchange` events in the preview pane. `DocumentViewer` passes its existing `updateSelection` handler.

**Rationale**: This matches the pattern used by EPUBViewer, HTMLViewer, and MarkdownViewer. The parent already manages `selectedText` state and derives `activeExtractSelection` from it. No new state or wiring needed — just plumb the callback.

**Alternative**: Use a shared context/store for selection. Rejected because it adds indirection for a parent-child communication that already works via props.

### 2. Selection detection in the preview pane only
**Decision**: Listen for `selectionchange` on the palette's preview content area only, not the editor pane.

**Rationale**: Users select text to extract from the rendered preview, not the raw markdown/HTML source. The preview is where content is visually readable.

### 3. Toast visibility fix — z-index and mount point
**Decision**: Ensure the `Toast` container is mounted at a z-index above the viewer's stacking context, or move the toast mount point outside the viewer's scrollable container.

**Rationale**: The viewer uses multiple z-index layers (z-[70] for extract button, z-50 for toasts per Toast.tsx). If toasts are mounted inside a container with `overflow: hidden` or a lower stacking context, they won't be visible. The fix is to ensure the toast container at z-50 is above or outside the viewer overlay.

## Risks / Trade-offs

- **Selection in editable pane**: Listening on both editor and preview could cause confusing behavior. Mitigation: only listen on preview pane.
- **Palette mode selection vs. editor focus**: In `write` mode, the editor has focus and browser selection is for editing, not extracting. Mitigation: only enable extract selection in `preview` and `split` modes, targeting the preview pane.
- **Toast z-index**: Changing the mount point could affect toast visibility in other views. Mitigation: test across PDF, EPUB, HTML, and Markdown views after the fix.
