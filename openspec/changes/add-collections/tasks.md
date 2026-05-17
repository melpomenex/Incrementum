## 1. Database Schema & Migration

- [x] 1.1 Create migration file adding `collections` table (id TEXT PK, name TEXT NOT NULL, icon TEXT, color TEXT, created_at TEXT, updated_at TEXT)
- [x] 1.2 Add `collection_id TEXT NOT NULL` column and index to `documents`, `extracts`, `learning_items`, `review_sessions`, `review_results`, `annotations`, `categories`, `transcripts`, `transcript_segments`
- [x] 1.3 Seed default "Personal" collection in the migration and backfill all existing rows with its ID
- [x] 1.4 Add `is_default BOOLEAN NOT NULL DEFAULT 0` to `collections` table to prevent deletion of the default collection

## 2. Backend Models & Repository

- [x] 2.1 Update `Collection` model in `src-tauri/src/models/collection.rs` to match the new schema (add `is_default` field, remove `parent_id`, `collection_type`, `filter_query` for now)
- [x] 2.2 Add `collection_id` field to all relevant models: `Document`, `Extract`, `LearningItem`, `ReviewSession`, `ReviewResult`, `Annotation`, `Category`, `Transcript`, `TranscriptSegment`
- [x] 2.3 Implement `collection_id`-aware query helpers in `repository.rs` — a shared method or macro that injects `WHERE collection_id = ?` into queries on core tables
- [x] 2.4 Update all existing repository CRUD methods to accept and filter by `collection_id`

## 3. Backend Commands

- [x] 3.1 Implement `create_collection` command in `commands/collections.rs` — insert into DB, return created collection
- [x] 3.2 Implement `get_collections` command — return all collections ordered by name
- [x] 3.3 Implement `update_collection` command — rename, change icon/color
- [x] 3.4 Implement `delete_collection` command — reject if `is_default`, otherwise reassign all items to "Personal" and delete the row
- [x] 3.5 Implement `get_active_collection` / `set_active_collection` — persist active collection ID in `settings` table
- [x] 3.6 Implement `get_collection_due_count` — count due items for a given collection (for badges)
- [x] 3.7 Update all existing Tauri commands that read/write core entities to pass through `collection_id` from the active collection

## 4. Frontend Store & API Layer

- [x] 4.1 Rewrite `collectionStore` to load collections from the database on startup instead of localStorage
- [x] 4.2 Add actions: `createCollection`, `renameCollection`, `deleteCollection`, `switchCollection`, `loadCollections`
- [x] 4.3 Persist `activeCollectionId` to the database (via settings) instead of localStorage
- [x] 4.4 Verify existing `api/collections.ts` wrappers match the implemented backend commands — update signatures if needed
- [x] 4.5 Update all consuming stores (documentStore, extractStore, learningItemStore, reviewStore, analyticsStore) to include `collection_id` in their API calls

## 5. Collection Switcher UI

- [x] 5.1 Build `CollectionSwitcher` component — dropdown at the top of the sidebar showing active collection name
- [x] 5.2 Add "New Collection" option to the switcher with a creation dialog (name, optional icon/color)
- [x] 5.3 Integrate the switcher into `MainLayout` / sidebar
- [x] 5.4 Build collection management section in the Settings page (list, rename, delete with confirmation)
- [x] 5.5 Handle edge case: if active collection is deleted externally, fall back to "Personal"

## 6. Review & Analytics Scoping

- [x] 6.1 Update `reviewStore` to load due items scoped to `activeCollectionId` via the backend
- [x] 6.2 Update review session creation to record `collection_id`
- [x] 6.3 Update dashboard statistics queries to filter by active collection
- [x] 6.4 Update analytics page queries (retention, review counts, time spent) to filter by active collection
- [x] 6.5 Add due-count badges to the collection switcher for inactive collections with pending reviews

## 7. Testing & Validation

- [x] 7.1 Verify migration works on a database with existing data — all items end up in "Personal"
- [x] 7.2 Verify migration works on a fresh database — "Personal" collection is created
- [x] 7.3 Test collection CRUD: create, rename, delete (with item reassignment)
- [x] 7.4 Test review queue isolation — items from one collection don't appear in another
- [x] 7.5 Test statistics isolation — analytics only reflect the active collection
- [x] 7.6 Test persistence — active collection survives app restart
