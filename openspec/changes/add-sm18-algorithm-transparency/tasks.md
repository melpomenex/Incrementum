# Tasks

## 1. Make ReviewTransparencyPanel algorithm-aware
- [x] Accept/read `card.algorithm_type` with settings fallback
- [x] Title dynamically shows "FSRS-6 Transparency" or "SuperMemo 18 Transparency"
- [x] For SM18 cards: parse `card.algorithm_state` via `parseSm18State()`, show SM18 difficulty (0-1), stability, retrievability, reps, lapses
- [x] For FSRS cards: keep existing behavior unchanged

## 2. Adapt FSRSInspector forget curve and labels for SM18
- [x] Branch `calculateForgetCurve` on algorithm type: FSRS uses `exp(-t/S)`, SM18 uses `0.9^(t/S)`
- [x] Header dynamically shows "FSRS-6 Inspector" or "SM18 Inspector"
- [x] Difficulty description adapts: "1-10 scale" for FSRS, "0-1 scale" for SM18
- [x] Stability description adapts: "Days until R ≈ 37%" for FSRS, "Days until R = 90%" for SM18
- [x] For SM18: show additional rows for Reps and Lapses

## 3. Adapt ZenReviewMode metadata overlay for SM18
- [x] Source S/R/D/I values from SM18 state when `algorithm_type = "sm18"` (with settings fallback)
- [x] Difficulty displayed on SM18 0-1 scale

## 4. Update ItemDetailsPopover algorithm label
- [x] Section header changes from "Scheduling / FSRS" to "Scheduling / FSRS-6" or "Scheduling / SuperMemo 18"
- [x] Falls back to settings when card `algorithm_type` is stale

## 5. Verify FSRS-6 labeling consistency
- [x] Confirmed all FSRS references already say "FSRS-6"

## 6. Fix browser backend to respect passed algorithm parameter
- [x] `submit_review` now uses `args.algorithm` parameter instead of reading stale `item.algorithm_type`
- [x] `preview_review_intervals` also uses `args.algorithm`
- [x] All algorithm handlers (FSRS, SM2, SM18) persist `algorithm_type` back to the item
- [x] Tauri backend `apply_review` now accepts and uses the `algorithm` parameter
- [x] All callers of `apply_review` updated with the new parameter

## 7. Hide FSRS-6 optimizer badge when SM18 is selected
- [x] FSRS retention slider, optimizer button/badge, and scoped overrides are hidden when algorithm != FSRS

## 8. Make transparency components fall back to settings
- [x] All four components (ReviewTransparencyPanel, FSRSInspector, ZenReviewMode, ItemDetailsPopover) use `card.algorithm_type || settings.learning.algorithm`
