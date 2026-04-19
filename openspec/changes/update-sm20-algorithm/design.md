## Context

The SM-20 implementation currently includes only the "classic" algorithm path: V2/V4/V6 interval formulas with Bayesian smoothing, plus a simplified app-level review layer (rating_to_quality, success_multiplier, next_difficulty, lapse_interval). A second algorithm branch was discovered during continued Ghidra decompilation on 2026-04-12. This FSRS-family branch uses a 3-expert mixture model with 35 tunable parameters and is actively called from multiple review pipeline locations in the original sm20.exe.

Both implementations (Rust `sm20.rs` and TypeScript `sm20.ts`) are line-by-line translations of the Python reference and must remain in sync.

## Goals / Non-Goals

**Goals:**
- Add the complete FSRS-family algorithm branch to both Rust and TypeScript implementations
- Maintain 1:1 parity with the Python reference implementation (`sm20_reference.py`)
- Keep the existing classic path unchanged — FSRS-family is an additional dispatch, not a replacement
- Extend `SM20State` with FSRS-family fields while maintaining backward compatibility for existing items
- Add comprehensive tests pinned against reference output

**Non-Goals:**
- Implementing the full SM-20 review pipeline (6+ entry points) — we add the core kernel only
- ML-based hyperparameter optimization of the 35 FSRS parameters
- Exposing FSRS-family parameters to user-facing settings UI
- Changing the existing four-button review flow or UI

## Decisions

### 1. State extension via optional fields

**Decision**: Add new FSRS-family fields to `SM20State` as optional/nullable with defaults. Existing items without these fields will continue using the classic path.

**Rationale**: The FSRS-family branch is gated by per-item flags. Items created before this update have no flags, so they naturally fall into the classic path. No migration needed.

**Alternative considered**: Separate `FSRSState` struct — rejected because it would duplicate the dispatch logic and require separate serialization paths.

### 2. Dispatch by per-item flag, not global version byte

**Decision**: Add an `algorithm_branch` field to `SM20State` (0 = classic, 1 = FSRS-family). The classic V2/V4/V6 dispatch via `version` byte remains unchanged.

**Rationale**: The original sm20.exe uses `local_8d != 3 && local_8e == 1` for gating. We simplify this to a single discriminant. This mirrors the original binary's behavior: the FSRS-family branch is NOT dispatched by the global `DAT_0122e192` version byte.

### 3. Inline parameters as constants

**Decision**: Store the 35 FSRS parameters as a `const` array (Rust: `[f64; 35]`, TypeScript: `readonly number[]`), matching the Python reference's `FSRS_PARAMS_FLAT`.

**Rationale**: The parameters are extracted from runtime memory at a fixed address (PTR_DAT_01125c00). They may change after ML optimization, but that optimization is not yet implemented. Hard-coding matches the current reference.

### 4. Review kernel returns tuple

**Decision**: `fsrs_review_kernel` returns `(new_S, new_D, interval, easiness)` as a tuple/struct, matching the Python reference.

**Rationale**: The caller (review dispatcher) needs all four values. The easiness value is used for transparency/inspector UI.

## Risks / Trade-offs

- **[Expert 2 grows unbounded]** → The mixture output A can exceed 1.0. This is documented in the reference as intentional. No mitigation needed, but callers must not assume A ∈ [0, 1].
- **[35 parameters are point estimates]** → Parameters may need updating if ML optimization is implemented later. Mitigation: parameters are in a single const array, trivially updated.
- **[State backward compatibility]** → Old items lack `algorithm_branch` and FSRS-specific fields. Mitigation: default `algorithm_branch` to 0 (classic) in parse/deserialize paths.
