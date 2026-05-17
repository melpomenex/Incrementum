## Why

Users currently have a single flat data space — all documents, extracts, learning items, and review history coexist without partitioning. This makes it impossible to maintain separate knowledge bases for different life contexts (e.g., School, Work, Leisure). The codebase already has three partially-overlapping "collection" concepts (a localStorage store, stubbed Rust models, and tag-based study decks), but none provides true data isolation. SuperMemo's collection model shows that segmenting data into independent silos is essential for focused review and clean statistics.

## What Changes

- Introduce a **collections** database table and wire it as a first-class data partition across all core entities (documents, extracts, learning items, review sessions, review results, annotations, categories).
- Add `collection_id` foreign key to all core tables with a default "Personal" collection to ensure backward compatibility.
- Implement the existing stubbed Rust collection commands (CRUD, listing, switching active collection).
- Build a **collection switcher UI** in the sidebar so users can create, rename, delete, and switch between collections.
- Migrate the existing localStorage-only `collectionStore` to sync with the database.
- Scope statistics, analytics, and review queues to the active collection.

## Capabilities

### New Capabilities
- `collection-data-model`: Database schema, migration, and repository layer for collections — adding `collection_id` to core tables, collection CRUD, and data isolation at the query level.
- `collection-switching-ui`: Sidebar collection picker, collection creation/management modal, and active collection state propagation across all views.
- `collection-scoped-review`: Filtering review queues, statistics, and analytics by the active collection so each collection has independent scheduling and metrics.

### Modified Capabilities
<!-- No existing spec-level behavior changes -->

## Impact

- **Database**: New migration adding `collections` table and `collection_id` column to documents, extracts, learning_items, review_sessions, review_results, annotations, categories, transcripts. All existing rows get assigned to a default "Personal" collection.
- **Backend (Rust)**: Repository layer needs collection-aware filtering on all queries. Existing stubbed collection commands need full implementation. Database connection logic remains single-SQLite.
- **Frontend (React/TypeScript)**: `collectionStore` rewritten to sync with backend. All stores consuming documents/extracts/learning items need to pass `collection_id`. Review store already has `activeCollectionId` filtering — needs wiring to real DB data. Analytics pages need scoping.
- **API layer**: Existing `collections.ts` API wrappers already exist; just need backend implementation to match.
- **No breaking changes**: Default "Personal" collection absorbs all existing data.
