## Why

When a user selects SuperMemo 18 as their algorithm, all review transparency UI still shows "FSRS Transparency" and uses FSRS-specific formulas (e.g., `R = exp(-t/S)`). SM18 has its own rich algorithm state (retrievability via `R = 0.9^(t/S)`, stability, difficulty on a 0-1 scale, BW deviation, SInc factor) but none of it is surfaced. Users who choose SM18 see misleading FSRS branding and stats that don't match the algorithm actually scheduling their cards.

FSRS labeling is already correct as "FSRS-6" throughout the app (confirmed: settings dropdowns, i18n strings, constants, inspector header). No relabeling work is needed.

## What Changes

- Make all transparency/stats components algorithm-aware so they show the correct algorithm name, formulas, and stats based on the active algorithm or per-card `algorithm_type`.
- Adapt the forget curve visualization to use SM18's formula (`R = 0.9^(t/S)`) when SM18 is active.
- Show SM18-specific stats (reps, lapses, BW deviation, SInc factor) alongside the common metrics (stability, difficulty, retrievability) when SM18 is active.
- Update hardcoded "FSRS" labels in transparency panels and the item details popover to dynamically reflect the active algorithm.

## Capabilities

### Modified Capabilities
- `document-rating`: Transparency UI (transparency panel, inspector, zen metadata, item details popover) must adapt display based on the card's algorithm type.

### New Capabilities
- `sm18-stats-display`: SM18-specific transparency stats and forget curve visualization.

## Impact

- **Frontend**: `ReviewTransparencyPanel.tsx`, `FSRSInspector.tsx`, `ZenReviewMode.tsx` (FSRSMetadata), `ItemDetailsPopover.tsx` — all gain algorithm-awareness.
- **No backend changes**: SM18 state is already persisted in `algorithm_state` as JSON; the existing `parseSm18State()` helper and `sm18Retrievability()` function provide everything needed.
- **No FSRS relabeling needed**: Already labeled "FSRS-6" everywhere.
