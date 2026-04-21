## Why

Dropping files onto the Documents Tab via drag & drop does not add them to the library. Users expect drag & drop to be the primary file import method, and it silently fails with no feedback.

## What Changes

- Fix stale React state bug in `processUploadQueue` where `successfulUploads` is always empty because state updates from `updateFileStatus` haven't been applied yet
- Eliminate duplicate event handling — both browser `window` drop listeners and Tauri `tauri://drop` listeners fire simultaneously in Tauri mode, causing double-processing and potential interference
- Fix the browser drop path where `processUploadQueue` fails silently for Tauri File objects that lack `.path` in the webview context
- Ensure the upload queue correctly reports completed file paths back to the parent component

## Capabilities

### New Capabilities

- `drag-drop-file-import`: Reliable drag & drop file import that works correctly in both Tauri and browser modes, with proper event routing and upload queue state management

### Modified Capabilities

## Impact

- `src/components/common/DragDropUpload.tsx` — Core drag & drop component (event listeners, processUploadQueue, state management)
- `src/components/documents/DocumentsView.tsx` — Consumer of DragDropUpload callbacks (may need minor adjustments)
- No backend/Rust changes required — the Tauri `tauri://drop` event payload is correct; the issue is in the frontend event routing
