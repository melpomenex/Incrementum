## Why

When a user drags a tab to split-view, the `DragDropUpload` component's global `dragenter` handler incorrectly detects the tab drag as a file drop (because `dataTransfer.types` contains `"application/x-incrementum-tab"` which matches the `t.startsWith("application/")` check). This triggers the file drop overlay, which then intercepts the `drop` event, preventing the split-view drop handler from firing. The app gets stuck showing the upload overlay with no way to dismiss it, forcing a restart.

## What Changes

- Fix the `handleGlobalDragEnter` check in `DragDropUpload.tsx` to exclude the tab-drag MIME type (`application/x-incrementum-tab`) from triggering the file drop overlay
- Ensure `dragover`/`drop` handlers in `DragDropUpload` also ignore tab-drag events

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None (this is a bug fix — no spec-level behavior changes).

## Impact

- `src/components/common/DragDropUpload.tsx` — global drag event handlers need to filter out tab-drag MIME types
- `src/components/common/Tabs/Tabs.tsx` — existing capture-phase drop listener provides partial protection but doesn't prevent the overlay from appearing
