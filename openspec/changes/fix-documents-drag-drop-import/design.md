## Context

`DragDropUpload.tsx` registers two sets of event listeners simultaneously: browser `window` listeners (`dragenter`, `dragleave`, `dragover`, `drop`) and Tauri native listeners (`tauri://drag-enter`, `tauri://drag-over`, `tauri://drag-leave`, `tauri://drop`). Both are always active regardless of environment.

In Tauri, both sets fire on every drop. The Tauri listener correctly extracts `paths: string[]` from the event payload and calls the parent callback directly. The browser listener calls `processFiles()` → `processUploadQueue()` which has a stale state bug and also fails to extract `.path` from Tauri's File objects.

In browser mode, `processUploadQueue` reads `uploadQueue` from the closure (stale state with `status: "pending"`), so `successfulUploads` is always empty and the parent callback never fires.

**Three bugs identified:**

1. **Stale state in `processUploadQueue`** (line 275): After calling `updateFileStatus` for each file (which uses `setUploadQueue(prev => ...)`), the code reads `uploadQueue` to collect successful uploads. But `uploadQueue` in the closure still holds the pre-update values, so all files show `status: "pending"` and the filter yields nothing.

2. **Dual listener conflict in Tauri**: Both browser and Tauri listeners fire on every drop. The browser path can fail silently (no `.path` on Tauri File objects), potentially interfering with the Tauri path or causing confusing console errors.

3. **No environment gating on browser listeners**: The browser `window` listeners are registered even in Tauri mode. In Tauri, the `drop` event's `dataTransfer.files` may be present but the `File` objects lack `.path`, causing the upload queue to fail with "Could not get file path" errors.

## Goals / Non-Goals

**Goals:**
- Fix drag & drop file import in both Tauri and browser modes
- Eliminate duplicate event processing in Tauri mode
- Ensure the upload queue correctly tracks and reports completed imports

**Non-Goals:**
- Adding new file type support
- Changing the drag & drop overlay UI
- Modifying the Tauri backend `handle_dropped_files` command (already correct)

## Decisions

**1. Gate browser listeners to non-Tauri mode only**
Register browser `window` listeners only when `!isTauri()`. In Tauri mode, only the `tauri://drag-*` listeners handle drops. This eliminates duplicate processing and avoids the issue of Tauri File objects lacking `.path`.

*Alternative considered*: Keep both listeners but add an `isTauri()` guard inside the browser `handleGlobalDrop` to skip processing. Rejected — still registers unnecessary listeners and the `dragenter`/`dragleave` counters interfere with the Tauri listeners' visual state.

**2. Fix `processUploadQueue` to track paths locally instead of reading stale state**
Instead of filtering `uploadQueue` (React state) for successful uploads, collect paths in a local array within `processUploadQueue` as files are processed. Pass the collected paths to `onFilesImported` directly.

*Alternative considered*: Use a `flushSync` or `useEffect` to wait for state updates. Rejected — adds complexity and unnecessary synchronous rendering. A local accumulator is simpler and more reliable.

**3. Keep upload panel UI for browser mode**
The upload panel (progress display) still uses `setUploadQueue`, which is fine for UI updates. Only the callback notification path needs the local accumulator fix.

## Risks / Trade-offs

- [Risk] Gating browser listeners in Tauri means the overlay UI drag state is controlled only by Tauri events → Mitigation: Tauri events (`drag-enter`, `drag-over`, `drag-leave`) already set the same state flags (`isDragging`, `isDragOver`), so the overlay behavior is preserved.
- [Risk] If Tauri drag events fail to register (e.g., setupTauriListeners throws), drag & drop stops working entirely in Tauri → Mitigation: The existing error logging at line 624 already catches this. Could add a fallback to browser listeners if Tauri setup fails.
