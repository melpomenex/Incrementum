## Why

The "Customize Session" modal exposes tag, category, priority range, and exclude-suspended filters, but these filters only affect the session block preview cards at the top of the queue view. The actual queue list below renders `visibleItems`, which does not apply any session customization filters — making tag/category/priority filtering appear non-functional to users.

## What Changes

- Make `visibleItems` in `ReviewQueueView` respect the session customization filters (tags, categories, priority range, exclude suspended) so the queue list reflects what the user configured
- Ensure `selectableItems` and manual browse also reflect the filtered set
- Add comprehensive tests for all session customization filters in `reviewUx.ts` (`applyFilters`) and `SessionCustomizeModal.tsx`
- Verify item type, tag, category, priority range, and exclude-suspended filters each work independently and in combination

## Capabilities

### New Capabilities
- `session-filter-application`: Ensures session customization filters (tags, categories, priority range, exclude suspended, item types) are applied to the visible queue, not just session block previews. Includes test coverage for each filter path.

### Modified Capabilities

## Impact

- `src/components/review/ReviewQueueView.tsx` — `visibleItems` memo needs to incorporate session customization filters
- `src/utils/reviewUx.ts` — `applyFilters` function (already exists, may need export or direct use in view)
- `src/components/review/SessionCustomizeModal.tsx` — no changes expected (already produces correct `SessionCustomization` state)
- `src/utils/__tests__/reviewUx.test.ts` — new tests for `applyFilters` tag/category/priority/suspended/item-type filtering
- `src/components/review/__tests__/ReviewQueueView.test.tsx` — new tests for customization modal → queue filtering integration
