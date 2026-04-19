## Why

Further Ghidra decompilation of sm20.exe (2026-04-12) uncovered a second, independent algorithm system within SM-20: an FSRS-family 3-expert mixture model with 35 tunable parameters, gated by per-item flags. This branch is actively called from 6+ review pipeline locations and is NOT dead code. Our current Rust and TypeScript implementations only include the classic V2/V4/V6 dispatch — the FSRS-family branch is entirely missing.

## What Changes

- Add the 3-expert mixture model (power-law, shifted power-decay, exponential forgetting) to both Rust and TypeScript SM-20 implementations
- Add 35 FSRS parameters from the runtime memory block (PTR_DAT_01125c00)
- Add `fsrs_expert1`, `fsrs_expert2`, `fsrs_expert3` expert curve functions
- Add `fsrs_expert_mixture` weighted average (retrievability-like proxy A)
- Add `fsrs_difficulty_update` — difficulty adjustment based on grade and proxy signal A
- Add `fsrs_lapse_stability` — stability update for grade < 3
- Add `fsrs_recall_stability` — stability update for grade >= 3
- Add `fsrs_review_kernel` — main review entry point returning (S', D', interval, easiness)
- Add `fsrs_init_item` — new item initialization from initial grade
- Extend `SM20State` with fields needed for FSRS-family items (retrov, s_factor, multiplier, etc.)
- Wire FSRS-family branch into the review dispatcher alongside the existing classic path
- Add tests pinned against Python reference output for all new functions

## Capabilities

### New Capabilities
- `sm20-fsrs-branch`: 3-expert mixture model for SM-20 FSRS-family algorithm branch — experts, mixture, difficulty/stability updates, review kernel, item init

### Modified Capabilities

## Impact

- `src-tauri/src/algorithms/sm20.rs` — add ~350 lines: FSRS constants, 8 new functions, extended state struct, review dispatch
- `src/lib/sm20.ts` — mirror all Rust additions for PWA/browser parity
- `src-tauri/src/commands/review.rs` — update SM-20 review dispatch to select classic vs FSRS-family path based on per-item flags
- `src/lib/__tests__/sm20.test.ts` — new tests for FSRS-family functions
- `src-tauri/src/algorithms/sm20.rs` (tests) — new inline tests for FSRS-family functions
