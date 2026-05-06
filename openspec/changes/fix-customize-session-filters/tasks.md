## 1. Export and prepare applyFilters

- [x] 1.1 Export `applyFilters` from `src/utils/reviewUx.ts` (change from module-private to named export)
- [x] 1.2 Export the `SessionCustomizationOptions` type if not already exported

## 2. Wire filters into visibleItems

- [x] 2.1 In `ReviewQueueView.tsx`, update the `visibleItems` useMemo to call `applyFilters` as a post-processing step after queue-mode, file-type, and search filtering, passing `sessionCustomization`-derived options
- [x] 2.2 Verify `selectableItems` memo still works correctly (it derives from `visibleItems`, so it should inherit filtering automatically)
- [x] 2.3 Verify `sessionBlocks` memo continues to work (it also derives from `visibleItems` — confirm no double-filtering occurs, or remove its duplicate filter call)

## 3. Unit tests for applyFilters

- [x] 3.1 Test tag filter: single tag selects matching items, multiple tags use OR logic, empty tag array passes all items
- [x] 3.2 Test category filter: single category, multiple categories (OR), empty passes all
- [x] 3.3 Test priority range filter: narrow range filters correctly, default range (0-100) passes all
- [x] 3.4 Test exclude suspended filter: enabled excludes suspended items, disabled includes them
- [x] 3.5 Test item type filter: documents-only, learning-items-only, extracts-only, all-enabled passes all
- [x] 3.6 Test filter composition: tag AND category, tag AND priority, all filters combined (AND logic)

## 4. Integration tests for visibleItems with session customization

- [x] 4.1 Test that changing tag selection in session customization updates `visibleItems` (render ReviewQueueView, open modal, select tag, verify filtered items)
- [x] 4.2 Test that changing category selection updates `visibleItems`
- [x] 4.3 Test that session customization filters compose with queue-mode filter (review mode + tag filter)
- [x] 4.4 Test that session customization filters compose with search query

## 5. Verify and clean up

- [x] 5.1 Run full test suite to confirm no regressions
- [x] 5.2 Manually verify: open Customize Session modal, select a tag, confirm queue list updates to show only matching items
