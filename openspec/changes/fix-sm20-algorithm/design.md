## Context

The SM-20 algorithm has two implementations: Rust (`src-tauri/src/algorithms/sm20.rs`) for the Tauri desktop backend and TypeScript (`src/lib/sm20.ts`) for the browser/PWA backend. Both were written from an earlier reverse-engineering effort and contain several deviations from the now-complete reference (`sm20_reference.py`), which was produced from a full 75-function Ghidra decompilation of `sm20.exe`.

The three algorithm formula versions (V2, V4, V6) share the same DSR model (Difficulty, Stability, Retrievability) and the same index-conversion pipeline. The current code only implements V2 and gets the index conversions wrong.

## Goals / Non-Goals

**Goals:**
- Make both Rust and TypeScript implementations produce identical intervals to the Python reference for V2
- Add V4 and V6 formula variants so the algorithm version byte is respected
- Add the Bayesian smoothing infrastructure (matrices + smoothing function) so it can be activated when review data accumulates
- Maintain backward compatibility: existing persisted `SM20State` values (stability, difficulty, repetition) must continue to work without migration

**Non-Goals:**
- Porting the full SM-20 optimizer or ML hyperparameter tuning pipeline
- Changing the app-level approximation layer (rating→quality mapping, success_multiplier, lapse logic, difficulty update formula) — these are reasonable design choices with no reference counterpart
- Changing any frontend components, API layer, or data model
- Implementing the matrix persistence layer (SQLite storage for the 21³ matrices) — that's a separate concern

## Decisions

### 1. Quantized index conversions SHALL replace raw float inputs

**Decision**: Difficulty and stability MUST go through the reference's index-quantization pipeline before entering the interval formula.

**Rationale**: The reference explicitly discretizes inputs: `difficulty_to_index(d)` maps [0,1] → integer [1,10], then `difficulty_to_fraction(idx)` = idx/20 yields [0.05, 0.5]. This is not an optimization — it's how the original software works. The 10 discrete difficulty levels are a core part of the algorithm's design. Similarly, stability goes through `stability_to_index` → `stability_to_transformed`, which quantizes to 20 discrete levels.

**Alternative considered**: Keep continuous inputs but clamp difficulty to [0, 0.5]. Rejected because this would still miss the discretization effect and produce non-integer-level boundaries.

### 2. Bayesian smoothing infrastructure SHALL be added but inactive by default

**Decision**: Add the 21³ interval/count matrices and the `bayesian_smooth` function, but start with zero-initialized matrices. The smoothing only activates when a cell's count > 0, so empty matrices produce identical results to no smoothing.

**Rationale**: This preserves backward compatibility while enabling the feature for users who accumulate review history. The reference's `compute_next_interval` already guards on `target_count > 0`.

**Alternative considered**: Skip Bayesian smoothing entirely. Rejected because it's the core innovation of SM-20 over SM-18, and the infrastructure cost is low (two 9261-element arrays).

### 3. V4 and V6 formulas SHALL be added as selectable variants

**Decision**: The `version` field in `SM20State` SHALL dispatch to V2 (current default), V4, or V6 interval formulas. Default remains version 2.

**Rationale**: The reference shows all three versions coexist in the same binary. The `compute_next_interval` function dispatches on the version byte. Not including them would leave the implementation incomplete.

**Alternative considered**: Only fix V2 and skip V4/V6. Rejected because V4 is the "SM-20 proper" formula and V6 is the FSRS-style variant — both are trivially small functions.

### 4. Rust and TypeScript SHALL share the same constants and formulas

**Decision**: Port all constants (V2, INIT, BAYES, ROUND_NARROW, ROUND_WIDE, STABILITY_POWER, UFACTOR) identically to both implementations. Each formula function SHALL produce bitwise-identical results (within f64 precision).

**Rationale**: Parity between desktop and browser backends is an existing project constraint. Deviations cause subtle bugs that are hard to diagnose.

### 5. Existing unit tests SHALL be updated, not replaced

**Decision**: Update the existing monotonic/interval-growth/lapse tests to work with the corrected formulas, and add new reference-value tests that pin specific inputs to expected outputs from the Python reference.

**Rationale**: Existing tests verify useful properties (monotonicity, lapse behavior). Reference-value tests catch regressions against the known-good implementation.

## Risks / Trade-offs

- **Interval schedule change for existing users** → Existing items will get different (correct) intervals on their next review. This is a correctness fix, not a regression. No migration needed because the algorithm is stateless with respect to past reviews (it only uses the current DSR values).
- **Quantized difficulty means fewer distinct difficulty levels** → Difficulty granularity drops from continuous [0,1] to 10 discrete levels. This matches the reference behavior and is intentional.
- **Bayesian matrices in memory** → Two 9261-element arrays (~73KB for f64 + 37KB for u32) per algorithm instance. Negligible memory cost.
- **V4/V6 formulas untested against real SM-20 data** → The formulas are structurally correct per the reference, but we have no real SM-20 review datasets to validate against. The risk is low since V2 remains the default.
