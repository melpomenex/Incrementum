## Context

The tab system uses HTML5 drag-and-drop with a custom MIME type `application/x-incrementum-tab` set via `dataTransfer.setData()` in `TabBar.tsx:handleDragStart`. Simultaneously, `DragDropUpload.tsx` registers global `window` listeners for `dragenter`, `dragover`, `dragleave`, and `drop` to handle file imports.

The conflict: `handleGlobalDragEnter` (line 440-453) checks `dataTransfer.types` for file-like MIME types using `t.startsWith("application/")`. This matches `application/x-incrementum-tab`, causing the file upload overlay to appear during tab drags. Once the overlay appears, it intercepts the `drop` event, preventing the split-view handler in `SplitPaneContainer.tsx` from firing. The overlay then has no way to dismiss itself since no actual files were dropped.

There is an existing guard in `Tabs.tsx` (line 55) — a capture-phase `drop` listener that calls `preventDefault()`/`stopPropagation()` when `draggedTabId` is set and the target is outside `[data-tab-pane]`. However, this only prevents the drop from propagating; it doesn't prevent `handleGlobalDragEnter` from setting `isDragging=true` and showing the overlay.

## Goals / Non-Goals

**Goals:**
- Prevent the file drop overlay from appearing when a tab is being dragged
- Allow tab-to-split-view drag to work correctly on the Documents tab
- Minimal, focused fix with no behavioral changes to actual file dropping

**Non-Goals:**
- Refactoring the drag-and-drop architecture
- Changing how tab drag-to-split works
- Modifying the Tauri native drag-drop listeners (these use Tauri's event system and are unaffected)

## Decisions

**1. Filter by excluding the tab-drag MIME type in DragDropUpload**

Add `application/x-incrementum-tab` to the exclusion list in `handleGlobalDragEnter`. This is the most direct fix — the handler should only show the overlay for actual file drags, not internal tab drags.

Alternative considered: Using a global flag (e.g., a ref shared between Tabs and DragDropUpload). Rejected because it adds coupling between unrelated components. The MIME type check is self-contained and reliable.

Alternative considered: Checking for `e.target.closest('[data-tab-pane]')` inside DragDropUpload. Rejected because DragDropUpload is not aware of the tab system and shouldn't be.

**2. Also guard handleGlobalDragOver and handleGlobalDrop**

While `handleGlobalDragEnter` is the primary trigger, `handleGlobalDragOver` and `handleGlobalDrop` should also skip tab-drag events for defense-in-depth. This prevents the overlay from interacting with tab-drag events at any stage.

## Risks / Trade-offs

- **[Risk] Future custom MIME types may need similar exclusions** → Mitigation: Consider a more general approach, such as only matching known file types rather than broad prefixes. However, for now the single exclusion is sufficient and keeps the fix minimal.
- **[Risk] The overlay could still flash briefly before the MIME check** → Mitigation: The check runs synchronously in the event handler before any state update, so no flash should occur.
