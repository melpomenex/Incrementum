## 1. Foundation & Navigation

- [x] 1.1 Create `DeckManager.tsx` component scaffold — full-screen view with deck accordion layout, navigation header with back button to ReviewHome
- [x] 1.2 Add "Manage Decks" button to `ReviewHome.tsx` that navigates to the Deck Manager view
- [x] 1.3 Wire up routing/navigation — Deck Manager replaces ReviewHome content (follow existing pattern used by ReviewQueueView)

## 2. Deck Accordion & Card List

- [x] 1.4 Implement deck list rendering — fetch decks from `studyDeckStore`, render each as an expandable section with name, total card count, and due-today count
- [x] 1.5 Implement single-deck expansion — clicking a deck collapses any other expanded deck and lazy-loads cards matching the deck's tag filters
- [x] 1.6 Add virtualized card list using `@tanstack/react-virtual` (or existing virtualization) for the expanded deck's cards
- [x] 1.7 Implement card loading per deck — call `getAllLearningItems` (or `getLearningItems` scoped) and filter by deck tags client-side using existing `filterByDecks` utility

## 3. Card Row Component

- [x] 2.1 Create `DeckManagerCardRow.tsx` — compact single-line row showing state badge, truncated question (80 chars), interval, difficulty, due date, review count, lapses
- [x] 2.2 Implement color-coded state badges — blue (new), orange (learning), green (review), red (relearning) with text labels
- [x] 2.3 Add mini stat indicators — small inline visualizations for interval (days badge), difficulty (1-10 mini bar), and due date (relative time badge)
- [x] 2.4 Add selection checkbox to each row for bulk operations
- [x] 2.5 Add click handler to expand card into inline editor

## 4. Sorting & Filtering

- [x] 3.1 Add sort controls above the expanded card list — dropdown/buttons for: due date, state, difficulty, interval, review count, lapses (ascending/descending)
- [x] 3.2 Implement sorting logic — sort the filtered card array based on selected field and direction
- [x] 3.3 Add filter controls — state filter chips (new/learning/review/relearning), due-status filter (due today, overdue, not due), tag filter
- [x] 3.4 Implement filtering logic — combine active filters as AND conditions on the card list

## 5. Inline Card Editor

- [x] 4.1 Create `InlineCardEditor.tsx` — expandable panel below a card row with editable question, answer, and tags fields
- [x] 4.2 Implement optimistic save — update UI immediately on save, call `createLearningItem` API, rollback on error with toast notification
- [x] 4.3 Add card type-aware rendering — basic/QA shows question+answer fields; cloze shows cloze text with highlighted ranges; complex types (multiple-choice, image-occlusion) show read-only preview with "Edit in Studio" link
- [x] 4.4 Add suspend/unsuspend toggle with visual feedback (dimmed row when suspended)
- [x] 4.5 Handle tag changes that remove card from current deck — after save, if card no longer matches deck filters, animate it out of the list

## 6. Deck Stats Panel

- [x] 5.1 Create `DeckStatsPanel.tsx` — sidebar or header section for the expanded deck showing statistics
- [x] 5.2 Implement per-deck stats — total cards, due today, retention rate, average difficulty, using existing analytics APIs with tag-based filtering
- [x] 5.3 Add maturity breakdown — stacked bar or progress ring showing new/learning/young/mature counts (mature = interval >= 21 days)
- [x] 5.4 Add 7-day workload forecast sparkline — call `getWorkloadData` filtered by deck tags, render as mini chart
- [x] 5.5 Add leech detection — count cards with lapses >= 5, show with warning indicator, click to filter card list to leeches only
- [x] 5.6 Add FSRS aggregate indicators — average stability (days) and difficulty with color-coded health indicator (green/yellow/red)

## 7. Bulk Operations

- [x] 6.1 Add bulk action toolbar — appears when cards are selected via checkboxes, with Suspend/Unsuspend/Delete/Retag buttons
- [x] 6.2 Implement bulk suspend/unsuspend — update `is_suspended` for all selected cards via API
- [x] 6.3 Implement bulk delete — confirmation dialog, then delete selected cards from database
- [x] 6.4 Implement bulk retag — input for adding/removing tags across selected cards
- [x] 6.5 Clear selection after bulk operation completes

## 8. Polish & Integration

- [x] 7.1 Add empty states — no decks yet, empty deck (no matching cards), no search results
- [x] 7.2 Add loading skeletons for card list and stats panel while data is fetching
- [x] 7.3 Add keyboard navigation — Escape to collapse editor/deck, arrow keys to move between cards, Enter to expand
- [x] 7.4 Add search/filter bar at top — search cards across all decks by question text
- [ ] 7.5 Test with large datasets (1000+ cards) — verify virtualization performance and scroll smoothness
