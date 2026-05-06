## Context

The ReviewQueueView has two parallel data paths:
1. `visibleItems` — the actual queue list rendered to the user, filtered only by queue mode (review/reading), file type, and search query
2. `sessionBlocks` — preview cards at the top, filtered by `applyFilters()` from `reviewUx.ts` using `sessionCustomization`

The Customize Session modal writes tag/category/priority filters into `sessionCustomization` state, but only `sessionBlocks` reads these. The main queue list ignores them entirely, making filters appear broken.

## Goals / Non-Goals

**Goals:**
- Apply session customization filters (tags, categories, priority range, exclude suspended) to `visibleItems` so the queue list reflects user selections
- Export or reuse `applyFilters` from `reviewUx.ts` in the `visibleItems` memo
- Add unit tests for each filter dimension in `applyFilters`
- Add integration tests verifying the modal → visibleItems flow

**Non-Goals:**
- Redesigning the session block system or block time budgets
- Changes to the modal UI itself
- Persisting tag/category/priority selections across sessions (item types already persist)
- Changing the backend queue loading logic

## Decisions

### 1. Apply filters in `visibleItems` memo rather than in the store

**Decision**: Apply session customization filters in the `visibleItems` useMemo in ReviewQueueView, after existing queue-mode/file-type/search filtering.

**Rationale**: The filters are session-scoped and UI-driven — they should not affect the raw store data. The `applyFilters` function from `reviewUx.ts` already implements the exact logic needed. We export it and call it as a post-processing step in the memo.

**Alternative considered**: Filtering in `queueStore.applyFilters`. Rejected because the store's `applyFilters` operates on `SearchFilters` (collection, archived, dismissed, search query) — a different abstraction. Mixing session customization into it would couple unrelated concerns.

### 2. Export `applyFilters` from `reviewUx.ts`

**Decision**: Change the module-private `applyFilters` function to be exported.

**Rationale**: It already implements all the filter logic (item types, tags, categories, priority range, exclude suspended). Reusing it avoids duplication and keeps the filtering contract in one place.

### 3. Filter ordering: queue-mode → file-type → search → session-customization

**Decision**: Apply session customization filters as the last step in `visibleItems`, after queue mode, file type, and search filtering.

**Rationale**: Queue mode and file type are structural constraints (what types of items can appear). Search is a user's text query. Session customization is a higher-level filter that should narrow the already-scoped set. This preserves existing behavior while adding the missing filter layer.

## Risks / Trade-offs

- **Empty queue after filtering**: If a user selects tags/categories that match nothing, the queue will show empty. This is correct behavior (the filters are working) but should show a helpful message. → Use existing empty state message; no special case needed.
- **Performance**: `applyFilters` runs on every render where `visibleItems` dependencies change. It iterates the items array with `.filter()` chains. With typical queue sizes (<1000 items), this is negligible. → No optimization needed.
- **Test coverage of module-private function**: `applyFilters` was previously untested. Exporting it makes it directly testable. This is a net positive for maintainability.
