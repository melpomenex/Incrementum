## Context

The app has two URL import paths with vastly different UX:
- **Toolbar** (`Ctrl+Shift+O`): calls `prompt()` → `documentStore.importFromUrl()` → `alert()` on error. No preview, no tags, no metadata.
- **Documents view**: opens `WebArticleImportDialog` — a full modal with URL fetch, article preview, tag management, and rich metadata enrichment.

Both ultimately call the same store function. The toolbar path is a legacy minimal implementation.

## Goals / Non-Goals

**Goals:**
- Reuse `WebArticleImportDialog` from the toolbar so both entry points give the same rich import experience.
- Keep `Ctrl+Shift+O` shortcut working.
- Open the imported document in a new tab after successful import from the toolbar.

**Non-Goals:**
- Changing `WebArticleImportDialog` internals or adding new features to it.
- Unifying the other import paths (EnhancedFilePicker, GlobalSearch) — those have different scopes (multi-source, URL detection).
- Changing the documents view import flow.

## Decisions

**Reuse `WebArticleImportDialog` as-is rather than creating a wrapper.**
The dialog already accepts `onOpenDocument` as a callback prop. The toolbar just needs to render it and wire `addTab()` through that callback. No new shared component or context needed.

**Alternative considered:** Create a global URL import modal store/context that any component can trigger. Rejected — this is a single reuse site, so a store would be over-engineering.

**Imported document opens in a new tab via `addTab()`.**
The `onOpenDocument` callback in `WebArticleImportDialog` passes the created document. The toolbar already has `addTab()` available. Wire them together to match current toolbar behavior (open-in-tab after import).

## Risks / Trade-offs

- **Dialog may reference documents-view-specific state** (e.g., document list refresh). The `onOpenDocument` callback is the only side-effect hook, so this should be safe. Verify at implementation time.
- **Modal positioning** — the dialog renders as a portal overlay. Since it's the same component, styling should be consistent regardless of trigger location.
