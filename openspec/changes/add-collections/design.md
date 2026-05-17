## Context

Incrementum is a Tauri v2 desktop app (Rust backend + React frontend) using a single SQLite database. Currently, all data lives in one flat namespace — documents, extracts, learning items, and review history share the same tables without any partitioning. The codebase already has three overlapping "collection" concepts:

1. **Frontend `collectionStore`** (localStorage): A simple `id` + `name` map with document-to-collection assignments. Used for filtering the review queue but never persisted to the database.
2. **Backend Rust models + commands**: `Collection`, `DocumentCollection`, and `SmartCollectionFilter` structs exist, plus command stubs in `commands/collections.rs` — all return TODO/hardcoded data.
3. **Study decks** (localStorage): Tag-based filters that narrow the review queue further.

None of these provides true data isolation. The repository layer (`repository.rs`, 174KB) has a single `Pool<Sqlite>` with zero collection-aware queries.

## Goals / Non-Goals

**Goals:**
- Add a `collections` table and `collection_id` foreign key to all core tables (documents, extracts, learning_items, review_sessions, review_results, annotations, categories, transcripts, transcript_segments).
- All existing data migrates into a default "Personal" collection — zero data loss.
- Users can create, rename, and delete collections from the UI.
- Review queues, statistics, and analytics are scoped to the active collection.
- Only one collection is active at a time; switching is instant.

**Non-Goals:**
- Smart/dynamic collections based on filter queries (leave the `SmartCollectionFilter` model for later).
- Hierarchical collections (`parent_id` on the collection model) — flat list only for now.
- Cross-collection search or merging.
- Per-collection database files (all collections share one SQLite file).
- Import/export of individual collections (existing archive system already does full-replacement).

## Decisions

### Decision 1: Single database with `collection_id` column (not per-collection DB files)

Add `collection_id TEXT NOT NULL` to every core table. All queries filter by the active collection.

**Alternatives considered:**
- *Per-collection SQLite files*: Cleaner isolation, but requires managing multiple connection pools, duplicating migrations, and complicating cross-collection operations (export, future merge). The app currently has one `Pool<Sqlite>` in a monolithic repository — switching to multi-pool is a large refactor with high risk.
- *Schema-per-collection within one DB*: SQLite doesn't support schemas natively; would need dynamic table creation per collection.

**Why single DB + column**: Simplest change. All existing code uses one pool. Adding a column + WHERE clause is far less invasive than reworking the connection layer. Indexes on `collection_id` keep queries fast.

### Decision 2: `collection_id` stored as TEXT (UUID), not INTEGER

The existing models use `String` IDs (UUIDs) everywhere. Using TEXT maintains consistency with the codebase conventions and avoids JOIN complications with mixed key types.

### Decision 3: Default collection seeded on migration

Migration creates a "Personal" collection and assigns all existing rows to it. This ensures backward compatibility — the app works identically after migration with no behavior change.

### Decision 4: Collection context stored in Zustand + synced to backend

Keep the `collectionStore` pattern but sync it to the database. On app startup, load collections from DB. On switch, update the store — all consuming stores already read `activeCollectionId` from the collection store.

### Decision 5: Collection switcher in the sidebar

Add a dropdown/selector at the top of the sidebar, above the navigation tabs. This is the most visible, least disruptive placement.

## Risks / Trade-offs

- **[Data integrity on delete]** Deleting a collection with items is destructive. → Mitigation: Require explicit confirmation. Offer option to move items to another collection before deleting. Do NOT cascade delete by default — instead reassign to "Personal".
- **[Migration performance]** Adding `collection_id` with a default to large tables could lock the DB. → Mitigation: SQLite ALTER TABLE ADD COLUMN is fast (it's metadata-only). Backfilling the default is just a single UPDATE per table.
- **[Forgotten WHERE clauses]** Any query that doesn't filter by `collection_id` leaks data across collections. → Mitigation: Add helper methods on the repository that inject `collection_id` filtering, and audit all existing queries.
- **[Review store already uses activeCollectionId]** The review store filters by `activeCollectionId` from the client-side store, but this only works for documents assigned via localStorage. → Mitigation: The new DB-backed approach replaces this entirely — queries go through the repository with collection filtering.
