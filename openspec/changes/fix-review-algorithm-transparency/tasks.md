## 1. Fix transparency panel and preview dispatch

- [x] 1.1 In `src/components/review/ReviewTransparencyPanel.tsx`, change the algorithm label to use `settings.learning.algorithm` (global setting) instead of `card.algorithm_type || settings.learning.algorithm`. This matches what `submitReview` actually sends — the global setting determines the next review's algorithm.
- [x] 1.2 In `src/components/review/ReviewTransparencyPanel.tsx`, detect SM18/SM20 state from `card.algorithm_state` content (not from the label algorithm) so reps/lapses/retrievability stats still display correctly for cards with stored SuperMemo state.
- [x] 1.3 In `src/stores/reviewStore.ts`, `loadPreviewIntervals` already passes `settings.learning.algorithm` (was already correct — no change needed since `submitReview` uses the same global setting).
