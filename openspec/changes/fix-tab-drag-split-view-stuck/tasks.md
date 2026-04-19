## 1. Fix DragDropUpload tab-drag conflict

- [x] 1.1 Add a helper function `isTabDrag(types: string[]): boolean` to `DragDropUpload.tsx` that checks for `application/x-incrementum-tab` in the types array
- [x] 1.2 Update `handleGlobalDragEnter` to skip setting `isDragging=true` when `isTabDrag(types)` returns true
- [x] 1.3 Update `handleGlobalDragOver` to skip `setIsDragOver(true)` and early-return when `isTabDrag(types)` returns true
- [x] 1.4 Update `handleGlobalDrop` to skip file processing and reset state when `isTabDrag(types)` returns true

## 2. Verify fix

- [x] 2.1 Test tab drag-to-split-view on the Documents tab does not trigger the file upload overlay
- [x] 2.2 Test actual file dragging into the Documents tab still shows the overlay and imports files correctly
