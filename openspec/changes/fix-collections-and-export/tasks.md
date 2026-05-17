## 1. Fix Collection ID Assignment on Document Creation

- [x] 1.1 Trace all document creation paths in the Rust backend (`add_document`, `import_document`, URL import, file import) and identify where `collection_id` is set
- [x] 1.2 Add `collection_id` parameter to the Rust `add_document` command (and related import commands) so the frontend can specify the target collection
- [x] 1.3 Update the frontend API layer (`src/api/`) to pass `activeCollectionId` from `collectionStore` when calling document creation/import commands
- [x] 1.4 Verify that document import flows (PDF, URL, clipboard, Zotero/Mendeley) all respect the active collection ID
- [ ] 1.5 Test: create a new non-default collection, make it active, add a document, confirm `collection_id` matches the active collection

## 2. Verify Collection-Scoped Data Loading

- [x] 2.1 Audit all queue commands in `queue.rs` to confirm they filter by `collection_id` when one is provided (verify `get_queue`, `get_due_queue_items`, `get_next_queue_item`, `get_due_documents_only`)
- [x] 2.2 Audit analytics queries in `analytics.rs` to confirm dashboard stats scope by `collection_id`
- [x] 2.3 Verify the document list view scopes by active collection when rendering
- [ ] 2.4 Test: add documents to two different collections, switch between them, confirm only the correct documents appear in each

## 3. Clean Up Dead Migration 023 Artifacts

- [x] 3.1 Add a new migration that drops `document_collections` table if it exists
- [x] 3.2 In the same migration, drop unused columns (`parent_id`, `collection_type`, `filter_query`) from `collections` table if they exist
- [x] 3.3 Verify the migration is idempotent and does not affect existing data

## 4. Implement Per-Collection Export

- [x] 4.1 Extend the `CollectionArchiveManifest` type to support a `collection` archive type with collection metadata fields
- [x] 4.2 Extend the export payload to include `review_sessions`, `review_results`, and `categories` scoped to the collection
- [x] 4.3 Ensure learning items in the export include all FSRS fields (due_date, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review)
- [x] 4.4 Implement the Rust backend command `export_collection_archive` that queries all data for a given `collection_id` and streams the ZIP to a user-chosen file path
- [x] 4.5 Add progress reporting for the export (collecting, serializing, packaging, complete)
- [ ] 4.6 Test: export a collection with documents, extracts, learning items, and review history; verify the ZIP contains all expected data

## 5. Implement Collection Archive Import

- [x] 5.1 Implement the Rust backend command `import_collection_archive` that reads a ZIP, generates new UUIDs for the collection and all entities, and inserts them alongside existing data
- [x] 5.2 Implement ID remapping: build a mapping table (old ID → new UUID) for all entity types before inserting, preserving foreign key references (document → extract → learning_item → review_result)
- [x] 5.3 Handle duplicate collection names by appending a suffix (e.g., "Work (imported)")
- [x] 5.4 Write document source files from the archive to the local filesystem
- [x] 5.5 Run the import in a transaction — roll back on any failure
- [x] 5.6 After import, refresh the collection list and due counts in the frontend
- [ ] 5.7 Test: export a collection on machine A, import on machine B, verify all documents, extracts, learning items, review history, and FSRS state are preserved

## 6. Frontend UI for Collection Export/Import

- [x] 6.1 Add "Export Collection" option in the CollectionSwitcher or CollectionsPanel (per-collection action menu)
- [x] 6.2 Add "Import Collection" option in the Import/Export settings tab
- [x] 6.3 Wire up the export flow: collection selection → file picker → progress indicator → completion
- [x] 6.4 Wire up the import flow: file picker → validation → progress indicator → collection list refresh
- [ ] 6.5 Test end-to-end: export from one collection, import into a fresh app instance, verify the experience matches
