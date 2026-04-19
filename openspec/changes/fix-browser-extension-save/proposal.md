## Why

When a user saves a page or link via the browser extension context menu ("Save to Incrementum"), the document is created in the database by the Tauri backend (`browser_sync_server.rs`) but the frontend is never notified. This results in a blank/white screen because the app's document list is stale and doesn't reflect the newly created document. The user has to restart the app to see the saved document. Additionally, there is no toast notification on the Tauri app side to confirm the save succeeded.

## What Changes

- Emit a Tauri event from the browser sync server when a document is created, so the frontend can react (refresh the document list, show a toast)
- Listen for this event in the frontend and show a toast notification confirming the save
- Refresh the document store when a browser-sync document is created, so the documents list and any open views stay in sync
- Ensure the `find_document_by_url` query in `handle_import_request` correctly unwraps the `Option<Document>` (current code calls `doc.unwrap()` inside a match arm that may panic on `None`)

## Capabilities

### New Capabilities
- `browser-sync-notification`: Tauri event emission when documents are created via browser sync server, and frontend toast/listener integration

### Modified Capabilities
<!-- No existing spec-level requirement changes -->

## Impact

- `src-tauri/src/browser_sync_server.rs`: Add Tauri `AppHandle` to `ServerState`, emit events after document/extract creation, fix potential `unwrap()` panic
- `src/main.tsx` or layout component: Add listener for browser-sync document creation events
- `src/stores/documentStore.ts`: Trigger `loadDocuments()` when receiving sync events
- `src/components/common/Toast.tsx` or `useToast` hook: Show save confirmation toast
- No API changes, no database schema changes
