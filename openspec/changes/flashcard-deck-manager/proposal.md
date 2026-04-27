## Why

Users have no dedicated view to browse, scroll through, edit, and understand their flashcard decks at a glance. Currently, deck management is scattered across `ReviewHome` (pill buttons + stats grid), `ReviewDecksModal` (selection overlay), and `LearningCardsList` (per-document only). There is no unified surface where a user can see all decks, their cards at a glance, per-deck statistics (retention, maturity breakdown, workload forecast), and inline-edit cards — all in one scrollable, information-dense view.

## What Changes

- Add a new **Deck Manager** view: a full-screen, information-dense page where users can browse all decks, expand them to see their cards, edit cards inline, and view rich per-deck statistics.
- Cards within a deck are shown as compact, scrollable rows with key stats visible (state, interval, difficulty, due date, review count, lapses, tags) — no need to click into individual cards.
- Inline editing: click a card to expand an inline editor for question, answer, tags, and metadata — no modal round-trip.
- Per-deck stats panel showing: total cards, due today, retention rate, maturity breakdown (new/learning/mature), average difficulty, workload forecast sparkline, leech count.
- Visual state indicators (color-coded state badges, progress rings, heatmaps) for maximum information density.
- Sorting and filtering within each deck (by state, due date, difficulty, interval, lapses, tags).
- Bulk operations: select multiple cards to suspend, delete, retag, or move between decks.

## Capabilities

### New Capabilities
- `deck-manager-view`: Full-screen deck browsing with expandable card lists, inline stats, and rich visual indicators
- `deck-stats-panel`: Per-deck statistics dashboard with retention, maturity breakdown, workload forecast, and leech detection
- `inline-card-editor`: Inline editing of flashcard content (question, answer, tags, metadata) within the deck browser without modals

### Modified Capabilities
<!-- No existing specs are being modified at the requirements level -->

## Impact

- **New files**: `src/components/review/DeckManager.tsx` (main view), `src/components/review/DeckManagerCardRow.tsx`, `src/components/review/DeckStatsPanel.tsx`, `src/components/review/InlineCardEditor.tsx`
- **Existing stores**: `studyDeckStore.ts` may need additional computed stats; `reviewStore.ts` for navigation integration
- **Existing API**: `learning-items.ts` and `analytics.ts` are sufficient — all data is already queryable. May add a `getLearningItemsByTags` convenience endpoint for deck-scoped card fetching.
- **Navigation**: Route integration from `ReviewHome` — "Manage Decks" button or sidebar entry
- **No database changes**: Decks are virtual/tag-based; cards already have all needed fields
