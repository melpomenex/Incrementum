## Context

The EPUB context menu was recently added (see `text-viewer-context-menu` change). It renders correctly on right-click, but actions like Extract and Highlight fail because `selectionContext` (the `EpubSelectionContext` with CFI range, chapter info, etc.) is null when the action runs.

**Root cause**: Two separate selection-reporting paths in EPUBViewer race:

1. `handleSelectionChange` (line 1511) — fires on `selectionchange`/`mouseup`/`touchend`, calls `onSelectionChange(text)` with **no context** (single argument, `context === undefined`)
2. `rendition.on("selected")` (line 801) — fires asynchronously via epubjs, calls `onSelectionChange(text, { type: "epub", cfiRange, ... })` with full context

In `updateSelection` (DocumentViewer line 936), when `context === undefined` and text exists, the code sets `selectionContext` to `null`. So if `handleSelectionChange` fires after `rendition.on("selected")`, it wipes the context. And on right-click (which fires `mousedown` → `contextmenu`, no `mouseup` until release), the `rendition.on("selected")` may not have fired yet at all.

The context menu's `selectedText` comes directly from `contents.window.getSelection()` in the `contextmenu` handler — so text is always correct. Only `selectionContext` is broken.

## Goals / Non-Goals

**Goals:**
- Ensure `selectionContext` is populated when EPUB context menu actions execute
- Extract and Highlight actions create extracts with correct page/location metadata
- Fix applies to both the right-click context menu and any other selection-dependent flows

**Non-Goals:**
- Changing the context menu UI or adding new menu items
- Modifying PDF selection handling
- Changing the MarkdownViewer context menu

## Decisions

### Decision 1: Store EPUB selection context in a ref and include it in the contextmenu event

**Approach**: Maintain a ref (`lastEpubSelectionContextRef`) in EPUBViewer that captures the latest `EpubSelectionContext` from `rendition.on("selected")`. When the `contextmenu` event fires, read from this ref and pass the context along with position/text via a new `onContextMenu` callback signature.

**Alternative considered**: Make `handleSelectionChange` also fire with context. Rejected because `selectionchange` fires on every keystroke/click and would require querying epubjs for CFI range each time — expensive and unreliable.

**Alternative considered**: Use `rendition.getRange()` synchronously in the `contextmenu` handler. This could work but `rendition.getRange(cfiRange)` requires a CFI range we'd need to compute from the DOM selection — epubjs doesn't expose a sync API for this.

**Best approach**: Add `selectionContext` to the `onContextMenu` callback payload. In the `contextmenu` handler inside EPUBViewer, read from the ref that `rendition.on("selected")` populates. This way, even if `handleSelectionChange` clobbers the React state, the context menu still has the correct context. DocumentViewer can then use this context directly when building menu items.

### Decision 2: Fix `updateSelection` to not null-out `selectionContext` on undefined context

**Current behavior** (line 936): `else if (context === undefined) { setSelectionContext(null) }` — this actively clears context.

**Fix**: Change to `else if (context === undefined) { /* preserve existing selectionContext */ }` — a no-op, so the context from `rendition.on("selected")` survives even if `handleSelectionChange` fires afterward.

This is the simpler fix and addresses the React state path. Combined with Decision 1 (passing context through the context menu directly), both paths are covered.

## Risks / Trade-offs

- **Stale context ref**: If user selects text A, then clears selection, then right-clicks on nothing — the ref still holds context from text A. Mitigated by: the `contextmenu` handler already checks `if (!text) return`, so no menu shows when there's no selection.
- **`updateSelection` no-op change**: Changing `context === undefined` to preserve context means other callers that rely on the null behavior could be affected. Mitigated by: this only affects non-PDF paths, and the only caller passing `undefined` is EPUBViewer's `handleSelectionChange`. PDF uses explicit context types.
- **`onContextMenu` API change**: Adding `selectionContext` to the callback is a breaking change for the interface. Mitigated by: making it optional in the type, so MarkdownViewer and other callers are unaffected.
