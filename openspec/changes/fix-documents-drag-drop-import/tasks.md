## 1. Fix event listener routing

- [ ] 1.1 Gate browser `window` listeners (`dragenter`, `dragleave`, `dragover`, `drop`) to only register when `!isTauri()`, preventing duplicate event handling in Tauri mode
- [ ] 1.2 Verify that Tauri drag state management (`isDragging`, `isDragOver`) still correctly drives the overlay UI without the browser listeners

## 2. Fix stale state bug in processUploadQueue

- [ ] 2.1 Replace the stale `uploadQueue` state read at the end of `processUploadQueue` with a local array that accumulates successful file paths as each file is processed
- [ ] 2.2 Call `onFilesImported` with the locally accumulated paths instead of the filtered stale state

## 3. Verification

- [ ] 3.1 Test drag & drop of a single PDF file in Tauri mode — verify it appears in the library
- [ ] 3.2 Test drag & drop of multiple files simultaneously in Tauri mode — verify all appear in the library
- [ ] 3.3 Test drag & drop in browser mode — verify upload panel shows progress and files are imported
- [ ] 3.4 Verify console has no errors during any drag & drop operation
