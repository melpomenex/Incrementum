## Context

Incrementum has a browser extension that sends page/link data to a local HTTP server (`browser_sync_server.rs`) running inside the Tauri app. When the extension saves a page, the server creates a document in the SQLite database but does **not** notify the Tauri frontend. The frontend document store only refreshes on explicit user actions (navigation, manual reload), so the newly saved document is invisible until the app is restarted.

Additionally, `handle_import_request` has a potential `unwrap()` panic on line 648: when `find_document_by_url` returns `Ok(Some(doc))`, the code calls `doc.unwrap()` inside the match — this works today because the `Some` is already unwrapped by the pattern, but the `.unwrap()` on the inner `Option<Document>` is redundant and fragile.

The app already has:
- A `listen<T>()` helper in `src/lib/tauri.ts` for subscribing to Tauri backend events
- A toast notification system (`useToast`, `useToastStore`) in `src/components/common/Toast.tsx`
- Existing Tauri event emission patterns (e.g., `transcription://download-progress`) using `app_handle.emit()`
- The `ServerState` struct in `browser_sync_server.rs` which holds `Arc<Repository>` and other shared state

## Goals / Non-Goals

**Goals:**
- Frontend immediately reflects documents saved via browser extension without restart
- User sees a toast notification when a page/link is saved successfully
- Fix the potential `unwrap()` panic in `handle_import_request`

**Non-Goals:**
- Changing the browser extension's behavior or UI
- Adding real-time sync / WebSocket for document updates
- Modifying the browser sync server's HTTP API contract
- PWA mode extension bridge changes (separate concern, already works via `extension-bridge.ts`)

## Decisions

### 1. Add `AppHandle` to `ServerState` and emit Tauri events

**Decision**: Store `AppHandle` in `ServerState` and call `app_handle.emit()` after successful document/extract creation.

**Rationale**: This follows the existing pattern used by the transcription module (`transcription/job_queue.rs` calls `app_handle.emit()`). The `AppHandle` is already available when `start_server()` is called from `lib.rs`. No new dependencies needed.

**Alternative considered**: Polling the database periodically — rejected because it adds latency and unnecessary DB load.

### 2. Event naming: `browser-sync://document-saved` and `browser-sync://extract-saved`

**Decision**: Use the `browser-sync://` prefix matching the existing `transcription://` convention. Payload is a JSON object with `document_id`, `title`, and `url`.

**Rationale**: Namespaced events prevent collisions and are consistent with the codebase's existing patterns.

### 3. Listen in `NewMainLayout.tsx` (top-level layout component)

**Decision**: Set up the event listener in the main layout component with a `useEffect` that subscribes on mount and unsubscribes on unmount. On receiving the event, call `documentStore.loadDocuments()` and show a toast via `useToastStore`.

**Rationale**: The layout is always mounted when the app is visible, making it the natural place for global event listeners. Using the zustand store directly (outside React) avoids hook dependency issues.

### 4. Fix `unwrap()` in `handle_import_request`

**Decision**: Replace `doc.unwrap().id` with proper pattern matching (`Ok(Some(doc)) => doc.id`) to eliminate the potential panic.

**Rationale**: The current code has `if let Some(doc) = existing { ... doc.unwrap().id }` — the `.unwrap()` is on the `Document` struct returned from `find_document_by_url`, but the `find_document_by_url` returns `Result<Option<Document>>`, so `existing` is already `Option<Document>`. The `unwrap()` is on the `Document` which can't be `None` at this point, but the code is confusing and fragile. Clean pattern matching is clearer.

## Risks / Trade-offs

- **Event spam**: If a user saves many pages rapidly, each triggers a `loadDocuments()` refresh and a toast. Mitigation: Debounce the document reload (e.g., 500ms) and cap visible toasts (already handled by `MAX_VISIBLE_TOASTS = 4`).
- **AppHandle lifetime**: The `AppHandle` must outlive the server. Since both are managed by Tauri's runtime, this is safe — the server shuts down before the app exits.
