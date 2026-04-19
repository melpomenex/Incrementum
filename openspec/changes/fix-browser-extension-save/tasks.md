## Tasks

- [x] Add `AppHandle` to `ServerState` and thread it through initialization
- [x] Fix `unwrap()` panic in `handle_import_request`
- [x] Emit `browser-sync://document-saved` event on document creation
- [x] Emit `browser-sync://extract-saved` event on extract creation
- [x] Listen for events and refresh document store in frontend
- [x] Show toast notification on browser sync save

## Task Details

### Task 1: Add `AppHandle` to `ServerState` and thread it through initialization

Modify `src-tauri/src/browser_sync_server.rs`:
- Add `app_handle: AppHandle` field to `ServerState` (derive `Clone` — `AppHandle` is `Clone`)
- Add `use tauri::{AppHandle, Manager, Emitter};` imports
- Update `start_server()` signature to accept `app_handle: AppHandle` and store it in `ServerState`
- Update `initialize_if_enabled()` signature to accept `app_handle: AppHandle` and pass it to `start_server()`
- Update call site in `src-tauri/src/lib.rs` (~line 262) to pass `app_handle` to `initialize_if_enabled()`

**Files:** `src-tauri/src/browser_sync_server.rs`, `src-tauri/src/lib.rs`

---

### Task 2: Fix `unwrap()` panic in `handle_import_request`

In `src-tauri/src/browser_sync_server.rs` around line 646, the code does:
```rust
if let Some(doc) = existing {
    // ...
    return Ok(ExtensionResponse {
        document_id: Some(doc.unwrap().id),
```
Where `existing` is `Option<Option<Document>>` (from `.ok()` on a `Result<Option<Document>>`). The outer `if let` gives `doc: Option<Document>`, and `.unwrap()` panics if it's `None`.

Replace with proper pattern matching:
```rust
if let Some(Some(doc)) = existing {
    return Ok(ExtensionResponse {
        document_id: Some(doc.id),
```

**Files:** `src-tauri/src/browser_sync_server.rs`

---

### Task 3: Emit `browser-sync://document-saved` event on document creation

In `src-tauri/src/browser_sync_server.rs`, add event emission in `handle_import_request()`:
- Define a serializable payload struct `DocumentSavedEvent { document_id: String, title: String, url: String }` with `#[derive(Clone, Serialize)]`
- After successfully creating a document (the `state.repo.create_document(...)` call), emit `state.app_handle.emit("browser-sync://document-saved", &payload)`
- Also emit the event when an existing document is found (same event, with existing doc's data) — per spec, existing-doc hits should also notify the frontend
- Do NOT emit on error/failure paths

**Files:** `src-tauri/src/browser_sync_server.rs`

---

### Task 4: Emit `browser-sync://extract-saved` event on extract creation

In `src-tauri/src/browser_sync_server.rs`, add event emission in `handle_extract_request()`:
- Define a serializable payload struct `ExtractSavedEvent { extract_id: String, document_id: String, url: String }` with `#[derive(Clone, Serialize)]`
- After successfully creating an extract (the `state.repo.create_extract(...)` call), emit `state.app_handle.emit("browser-sync://extract-saved", &payload)`
- Do NOT emit on error/failure paths

**Files:** `src-tauri/src/browser_sync_server.rs`

---

### Task 5: Listen for events and refresh document store in frontend

Create a module-level listener setup (following the `useTranscriptionStore.ts` pattern) — either inline in `src/stores/documentStore.ts` or as a new file imported there:
- Register a `listen` call for `browser-sync://document-saved` at module scope (only if `isTauri()`)
- On event receipt, call `useDocumentStore.getState().loadDocuments()` with a 500ms debounce (to handle rapid saves)
- Store cleanup function for app shutdown
- Also listen for `browser-sync://extract-saved` (may trigger extract list refresh if applicable, or no-op for now)

**Files:** `src/stores/documentStore.ts` (or new helper file)

---

### Task 6: Show toast notification on browser sync save

In the same listener setup from Task 5, after receiving `browser-sync://document-saved`:
- Call `useToastStore.getState().addToast()` with type `ToastType.Success`, title "Page saved to Incrementum", message = the document title from the event payload
- The existing toast system handles rate-limiting (max 4 visible toasts) and auto-dismiss (5s default)
- Import `useToastStore` and `ToastType` from `src/components/common/Toast.tsx`

**Files:** `src/stores/documentStore.ts` (or wherever the listener from Task 5 lives), `src/components/common/Toast.tsx`
