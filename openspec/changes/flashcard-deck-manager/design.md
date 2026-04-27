## Context

The app has a mature spaced-repetition system with FSRS-6/SM-2 algorithms, tag-based virtual decks, and a full review pipeline. The gap is **deck management UX**: users cannot browse decks with their cards, see per-deck statistics at a glance, or edit cards inline. Currently, viewing cards per-document exists (`LearningCardsList`), but there is no unified deck-scoped browser.

Decks are virtual (tag-filters, not DB rows). Cards belong to decks via tag matching. All needed card fields (state, interval, difficulty, due date, lapses, memory state) already exist in the `learning_items` table and are queryable via existing Tauri commands.

## Goals / Non-Goals

**Goals:**
- Information-dense deck browser: show decks as expandable sections with compact card rows showing key stats at a glance
- Inline editing without modal round-trips
- Per-deck statistics (retention, maturity, workload, leeches) computed from existing analytics APIs
- Fast scrolling through large card collections (virtualization)
- Sorting and filtering within decks
- Bulk operations on selected cards

**Non-Goals:**
- New database tables or migrations — decks remain virtual/tag-based
- Changes to the review session flow or scheduling algorithms
- Card creation (handled by FlashcardStudioModal)
- Export/import functionality (already exists)
- Mobile-responsive layout (this is a Tauri desktop app)

## Decisions

### 1. Deck Manager as a new top-level view, not a modal

**Choice**: Full-screen view (like `ReviewQueueView`) navigated from `ReviewHome`.

**Rationale**: Modals constrain space and cannot show information density. A full view allows multi-deck expansion, sidebar stats, and large card lists. `ReviewDecksModal` remains for quick deck selection during reviews; this is for management/browsing.

**Alternative**: Expand `ReviewHome` with tabs. Rejected — `ReviewHome` is already dense with session controls and stats cards. Adding a deck browser would make it unwieldy.

### 2. Virtualized card list with `@tanstack/react-virtual`

**Choice**: Use TanStack Virtual for the card list within each deck.

**Rationale**: Users may have thousands of cards in a deck. Rendering all as DOM nodes would lag. TanStack Virtual is already likely available (common in the ecosystem) and handles dynamic row heights well — critical since cards can expand for inline editing.

**Alternative**: Pagination. Rejected — pagination breaks the "scroll through everything" UX and hides information density. Virtualized scrolling gives the feel of infinite scroll without the performance cost.

### 3. Card rows as compact stat-dense strips

**Choice**: Each card shown as a single-line row with: state badge (color-coded), truncated question preview, interval/difficulty mini-bars, due date, review count, and tag pills. Clicking expands for inline edit.

**Rationale**: Information density is the primary UX goal. Showing 15-20 cards per viewport lets users quickly scan a deck's health. Color-coded state badges (blue=new, orange=learning, green=review, red=relearning) provide instant visual pattern recognition.

### 4. Deck stats computed from existing APIs

**Choice**: Use `getDashboardStats`, `getMemoryStats`, `getReviewStatistics`, and `getWorkloadData` with tag-based filtering. No new backend commands.

**Rationale**: All the data already exists. The analytics layer already computes retention rates, maturity breakdowns, and workload forecasts. We just need to call them with the active deck's tag filters. This avoids any Rust changes.

**Alternative**: Add a dedicated `getDeckStats(tags[])` command. Could be a future optimization if the multiple-API-call approach is too slow, but premature now.

### 5. Inline editing with optimistic updates

**Choice**: Click a card row to expand an inline editor panel. Save triggers `createLearningItem` (upsert pattern) with optimistic UI update and rollback on error.

**Rationale**: Modal-based editing breaks flow. Inline editing lets users rapid-edit multiple cards. Optimistic updates keep the UI snappy. The existing `createLearningItem` API already handles updates (it's used for editing in FlashcardStudioModal).

### 6. File structure

New components in `src/components/review/`:
- `DeckManager.tsx` — main view with deck accordion and virtualized card lists
- `DeckManagerCardRow.tsx` — single card row with stat indicators and expand state
- `DeckStatsPanel.tsx` — sidebar/section with deck statistics and charts
- `InlineCardEditor.tsx` — expanded card editor (question, answer, tags, metadata)

No new stores needed — use `studyDeckStore` for deck data and call APIs directly for card fetching.

## Risks / Trade-offs

- **[Performance with many decks]** → Virtualization helps, but expanding multiple decks with thousands of cards could be slow. Mitigation: only virtualize the currently expanded deck; collapse others. Lazy-load cards per deck on expand.
- **[Stats API calls per deck]** → Fetching stats for every deck simultaneously could be expensive. Mitigation: compute stats for only the expanded/selected deck, cache results, and invalidate on card edits.
- **[Tag-based deck filtering is client-side]** → Large card collections mean loading all cards then filtering. Mitigation: add a Rust-side `getLearningItemsByTags(tags)` command if client-side filtering becomes a bottleneck. Start with client-side since `getAllLearningItems` already loads everything.
- **[Inline editor complexity]** → Cards have many types (basic, cloze, QA, image-occlusion). Mitigation: start with basic/QA inline editing (most common); cloze and image-occlusion fall back to opening FlashcardStudioModal for editing.
