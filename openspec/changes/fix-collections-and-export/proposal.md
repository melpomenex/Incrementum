## Why

Collections are broken — switching to a non-default collection shows the same documents as the default collection. New documents always land in the default collection regardless of the active collection. Two competing migration schemas exist (a partitioning approach in migration 007 with `collection_id` on every core table, and a junction-table approach in migration 023), but only the partitioning schema is used by the runtime code. The result: collections act as labels you can assign after the fact, not as isolated workspaces with their own documents, scheduling, and review data.

Users also need to export a complete collection (documents, files, extracts, learning items, review history, scheduling state) and import it on another machine, preserving the exact same experience.

## What Changes

- **Fix document creation to respect active collection**: When the user has a non-default collection active and imports/adds a document, it must be assigned to that collection's `collection_id` by default.
- **Fix queue and analytics to correctly scope by collection**: Ensure all queue commands, analytics queries, and dashboard stats properly filter by `collection_id` when a non-default collection is active.
- **Clean up conflicting migration 023**: The `document_collections` junction table and alternate `collections` schema from migration 023 conflict with the partitioning approach. Remove the unused schema.
- **Add per-collection export**: Allow exporting a single collection as a portable archive containing all its documents, files, extracts, learning items (with FSRS state), review history, and collection metadata.
- **Add collection import**: Allow importing a collection archive on a different machine, creating a new collection with all associated data and preserving scheduling/FSRS state.

## Capabilities

### New Capabilities
- `collection-export-import`: Per-collection export to a portable archive and import on another machine, preserving documents, files, extracts, learning items, FSRS scheduling state, and review history.

### Modified Capabilities
- `import-export-cleanup`: Existing export/import needs to correctly handle collection-scoped data and the active collection context.

## Impact

- **Rust backend** (`repository.rs`, `collections.rs`, `queue.rs`, `analytics.rs`): Fix document creation to use active `collection_id`; verify all queries scope correctly; remove dead migration 023 artifacts.
- **Frontend stores** (`collectionStore.ts`, `queueStore.ts`): Ensure `activeCollectionId` propagates to all document/import operations.
- **Frontend components** (`CollectionSwitcher.tsx`, `CollectionsPanel.tsx`): Verify collection switching triggers full data reload scoped to the new collection.
- **Export/import utilities** (`collectionArchive.ts`, `collection_archive.rs`): Extend to support per-collection export with full data fidelity, and import that creates a proper isolated collection.
- **Database migrations**: Add cleanup migration to drop unused `document_collections` table and alternate columns from migration 023.
