## Why

The SuperMemo .zip import feature is completely non-functional. The backend Rust module (`src-tauri/src/supermemo.rs`) containing the ZIP parsing and Tauri commands is dead code — it's never declared in `lib.rs` and its commands aren't registered in `tauri::generate_handler![]`. On the frontend, the `handleImportFromPicker` in `routes/documents.tsx` only handles `url`, `arxiv`, and `local` sources — the `supermemo` (and `anki`/`screenshot`) sources are silently dropped. Users who select "SuperMemo" in the import picker will see the file picker, select a .zip, and nothing happens.

## What Changes

- Register the `supermemo` module in `src-tauri/src/lib.rs` so it compiles
- Add `import_supermemo_package` and `validate_supermemo_package` to `tauri::generate_handler![]`
- Wire the `supermemo` source in the frontend `handleImportFromPicker` to actually call the import utility and create documents
- Replace the fragile string-based XML parsing with a proper XML parser (`quick-xml`)
- Add error handling and user feedback (toast/notification on success/failure)

## Capabilities

### New Capabilities
- `supermemo-import`: End-to-end SuperMemo .zip import — backend module registration, command handler wiring, frontend import flow, and proper XML parsing

### Modified Capabilities
(none — this is fixing a non-functional feature, not modifying existing spec-level behavior)

## Impact

- **Backend**: `src-tauri/src/lib.rs` (module + handler registration), `src-tauri/src/supermemo.rs` (XML parser swap to `quick-xml`), `Cargo.toml` (add `quick-xml` dependency)
- **Frontend**: `src/routes/documents.tsx` (add `supermemo` case to import handler), `src/utils/supermemoImport.ts` (already exists, will be used)
- **Dependencies**: Add `quick-xml` crate to `Cargo.toml`
- **Risk**: Low — activating dead code and wiring it to existing UI. No changes to working features.
