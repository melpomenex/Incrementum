## Context

The review store's `loadPreviewIntervals` action passes `settings.learning.algorithm` (the user's global setting) to the backend `preview_review_intervals` command. The Rust backend already correctly dispatches to FSRS/SM18/SM20 based on the algorithm string parameter, and the frontend `ReviewTransparencyPanel` already correctly labels the panel based on `card.algorithm_type`. The disconnect is that the preview data was computed using the wrong algorithm.

## Goals / Non-Goals

**Goals:**
- Preview intervals SHALL match the algorithm that actually schedules the card
- Card-level `algorithm_type` SHALL take priority over the global setting, consistent with the review submission path (`apply_review`)

**Non-Goals:**
- Changing the SM20 algorithm's interval computation — the "Hard = 6+ days" behavior is correct per the algorithm design (interval = stability * SInc * success_multiplier, where stability grows across repetitions)
- Adding new transparency features or visualizations
- Backend changes — the Rust `preview_review_intervals` already handles all three algorithms correctly

## Decisions

**Pass card's algorithm_type to preview API instead of global setting**

The `loadPreviewIntervals` action already has access to `currentCard`. We pass `currentCard.algorithm_type || settings.learning.algorithm` to `previewReviewIntervals()`, matching the precedence used by `apply_review` in the Rust backend and by `ReviewTransparencyPanel` for its header label.

Alternative considered: Have the backend determine the algorithm from the card's `algorithm_type` column directly. Rejected because the backend already accepts an optional algorithm parameter and the frontend already has the card data — this is a one-line fix with no API changes.

## Risks / Trade-offs

- [Cards with null `algorithm_type` default to global setting] → This is existing behavior and correct — cards created before per-card algorithm support should use the user's current preference.
