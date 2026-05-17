## Context

Incrementum uses a partitioning-based collection system where every core table (`documents`, `extracts`, `learning_items`, `review_sessions`, `review_results`, `annotations`, `categories`) has a `collection_id` column defaulting to `DEFAULT_COLLECTION_ID` (`00000000-0000-0000-0000-000000000001`). Collections are switched via the `activeCollectionId` in the Zustand store, which propagates to queue and analytics queries.

Two problems exist:

1. **Collection isolation is broken**: Documents created/imported while a non-default collection is active still get `DEFAULT_COLLECTION_ID`. The `collection_id` assignment is not wired into the document creation and import paths.

2. **No portable collection export**: The existing `collectionArchive.ts` supports exporting data, but it packages everything as a flat archive. There is no per-collection export that produces a self-contained, importable file preserving FSRS scheduling state, review history, and all associated files.

There is also dead code from migration 023 that defined an alternate `document_collections` junction table and a different `collections` schema — this was never used at runtime and creates confusion.

## Goals / Non-Goals

**Goals:**
- Documents added/imported while a non-default collection is active SHALL be assigned that collection's ID by default
- Switching collections SHALL present only data belonging to that collection (documents, queue items, extracts, learning items, analytics)
- Users SHALL be able to export a single collection as a portable archive (documents, files, extracts, learning items with FSRS state, review history, categories, collection metadata)
- Users SHALL be able to import a collection archive on another machine, creating a new collection with all data intact and FSRS scheduling preserved
- Clean up dead migration 023 artifacts

**Non-Goals:**
- Smart collections (client-side filters) — these already work independently
- Nested/sub-collections (the `parent_id` column from migration 023 was never used)
- Cross-collection document sharing or moving documents between collections (existing `CollectionSelector` per-document reassignment already handles this)
- Syncing between machines (export/import is manual, not real-time sync)
- Changing the partitioning architecture to a junction-table approach

## Decisions

### Decision 1: Fix `collection_id` assignment at the point of document creation

**Choice**: Add `collection_id` parameter propagation from the active collection through to the Rust `add_document` command, so new documents default to the active collection.

**Alternative considered**: Post-creation reassignment via a trigger. Rejected because it creates a brief window where documents appear in the wrong collection and requires cleanup logic.

**Rationale**: The `collection_id` column already exists on all tables. The infrastructure for collection-scoped queries is already in the queue and analytics layers. The bug is simply that the frontend doesn't pass `activeCollectionId` when creating/importing documents.

### Decision 2: Extend the existing ZIP archive format for collection export

**Choice**: Reuse the `CollectionArchiveManifest` + ZIP format from `collectionArchive.ts`, adding fields for FSRS parameters, review history, and categories. The export scope `"current"` already exists — we ensure it captures all associated data.

**Alternative considered**: A new standalone format. Rejected because the ZIP + manifest architecture already supports scoped export, and introducing a second format creates confusion.

**Rationale**: The archive format already has versioning (`manifest.json` with `version` field) and a `scope` concept. We extend the payload to include review sessions/results and categories when exporting a single collection.

### Decision 3: Import creates a new collection with ID remapping

**Choice**: On import, generate a new collection ID and remap all `collection_id` references in the imported data to it. This prevents ID collisions with existing collections on the target machine.

**Alternative considered**: Preserve original IDs and error on collision. Rejected because it makes portability fragile — the user would need to manage conflicts manually.

**Rationale**: The import already runs in a transaction with `clear existing data` logic. For per-collection import, we skip the clear and instead insert alongside existing data with remapped IDs. Document IDs, extract IDs, and learning item IDs also need remapping to avoid collisions.

### Decision 4: Drop dead migration 023 artifacts in a cleanup migration

**Choice**: Add a new migration that drops the `document_collections` table and the unused columns from migration 023 (`parent_id`, `collection_type`, `filter_query`) if they exist.

**Alternative considered**: Leave them. Rejected because they confuse future development and the junction table is empty.

**Rationale**: The table was never populated or queried. A guarded `DROP TABLE IF EXISTS` is safe.

## Risks / Trade-offs

- **[ID remapping complexity]** → Mitigation: Use a deterministic mapping table during import. Map old IDs to new UUIDs in a single pass before inserting any rows. This preserves referential integrity across documents → extracts → learning_items → review_results.

- **[Large collections may produce large archives]** → Mitigation: Files are already compressed in the ZIP. For very large collections, the existing progress reporting in the export flow keeps the user informed.

- **[FSRS state portability]** → The FSRS parameters are global app settings, not per-collection. Exported learning items carry their individual scheduling state (due_date, stability, difficulty, etc.), which is sufficient for continuity. The receiving machine's global FSRS parameters may differ slightly, but this is acceptable — the scheduling will converge over reviews.

- **[Migration 023 cleanup could fail if schema diverged]** → Mitigation: Use `IF EXISTS` guards on all DROP statements.
