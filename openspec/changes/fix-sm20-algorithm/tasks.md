## 1. Index Conversions (Rust)

- [x] 1.1 Add `stability_pretransform(s: f64) -> f64` — NaN/Inf → 44530, (-1, 0.7) → 0.7, pass through otherwise
- [x] 1.2 Add `difficulty_to_index(d: f64) -> usize` — `floor(d*19)+1` clamped to [1,10], D<0 → 10
- [x] 1.3 Add `stability_to_index(s: f64) -> usize` — pre-transform → subtract 2 (clamp neg) → pow(1/STABILITY_POWER) → floor+1 → clamp [1,20]
- [x] 1.4 Add `stability_to_transformed(idx: usize) -> f64` — `(idx-1)^STABILITY_POWER + 2.0`
- [x] 1.5 Add `retrievability_to_index(r: f64) -> usize` — `floor(2^(r*20))` clamped to [0,20]
- [x] 1.6 Add `difficulty_to_fraction(d_idx: usize) -> f64` — `d_idx / 20.0`
- [x] 1.7 Add `repetition_to_fraction(r: u32) -> f64` — `(r-1) / 19.0`
- [x] 1.8 Replace `transformed_stability()` usage in `compute_interval_growth` with the two-step `stability_to_index` → `stability_to_transformed` pipeline
- [x] 1.9 Replace raw difficulty input in `compute_interval_growth` with quantized `difficulty_to_fraction(difficulty_to_index(d))`

## 2. Rounding & Constants (Rust)

- [x] 2.1 Add `apply_rounding(interval: f64, flags: i32) -> f64` — wide mode [0.8, 20.0] when flags>=4 or bit 1 set, narrow mode [0.5, 2.0] otherwise
- [x] 2.2 Add INIT constants dict (stability_scale_max=15.0, stability_scale_min=3.0, rep_power_offset=-0.08, rep_power_coeff=-0.35, base_sub=1.0, base_add=1.0, penalty_slope=-2.0, penalty_intercept=2.25, penalty_clamp=600.0)
- [x] 2.3 Add `interval_initial()` function using INIT constants (same structure as V2, but with INIT values, wide rounding, min 1.0)
- [x] 2.4 Add UFACTOR table (20 f64 values from reference)

## 3. V4 & V6 Formulas (Rust)

- [x] 3.1 Add `interval_v4(p1..p7: f64) -> f64` — `(p3*p5 + 1.0) * (p1*p7 + p2) + p4`
- [x] 3.2 Add `interval_v6(p1..p6: f64) -> f64` — `p4 + p1 * 2^clamp(p6) * 2^clamp(-p3*p5)` with exp2 clamped to [-38, 38]
- [x] 3.3 Add version dispatch in `compute_next_interval`: version=2→V2, version=4→V4, version=6→V6, fallback→V2

## 4. Bayesian Smoothing (Rust)

- [x] 4.1 Add `MATRIX_DIM=21`, `MATRIX_STRIDE_R=441`, `MATRIX_STRIDE_S=21` constants and `matrix_flat_index(r,s,d)` helper
- [x] 4.2 Add BAYES constants (prior_weight=500.0, target_weight_scale=10.0, neighbor_weight_denom=1000.0, cube_weight=3.0, neutral=1.0)
- [x] 4.3 Add `bayesian_smooth(r_idx, s_idx, d_idx, interval_matrix, count_matrix) -> f64` — 3×3×3 neighbor accumulation with sigmoid-weighted blending
- [x] 4.4 Add `record_review(stability, difficulty, repetition, interval_used, interval_matrix, count_matrix)` — incremental average update
- [x] 4.5 Wire Bayesian smoothing into `compute_next_interval`: apply only when matrices present AND target count > 0

## 5. Update review() and preview() (Rust)

- [x] 5.1 Update `review()` to use quantized index conversions for stability and difficulty before calling the formula
- [x] 5.2 Update `preview()` if needed (should work automatically if `review()` is updated)
- [x] 5.3 Ensure existing lapse path, success_multiplier, rating_to_quality, next_difficulty remain unchanged

## 6. Tests (Rust)

- [x] 6.1 Add tests for all index conversion functions matching reference scenarios
- [x] 6.2 Add tests for stability_pretransform edge cases (NaN, Inf, boundary values)
- [x] 6.3 Add reference-value tests pinning V2 formula inputs to expected outputs
- [x] 6.4 Add tests for V4 and V6 formulas
- [x] 6.5 Add tests for interval_initial with rounding
- [x] 6.6 Add tests for bayesian_smooth with empty matrices (returns prior) and populated matrices
- [x] 6.7 Update existing monotonic/interval-growth tests for corrected behavior

## 7. TypeScript Implementation

- [x] 7.1 Port all index conversion functions to `src/lib/sm20.ts`
- [x] 7.2 Port INIT constants, interval_initial, UFACTOR table
- [x] 7.3 Port V4 and V6 formulas
- [x] 7.4 Port Bayesian smoothing (matrices, bayesian_smooth, record_review)
- [x] 7.5 Port apply_rounding
- [x] 7.6 Update sm20Review to use quantized conversions
- [x] 7.7 Update existing TS tests and add matching reference-value tests

## 8. Verification

- [x] 8.1 Run `cargo test` in src-tauri — all Rust tests pass
- [x] 8.2 Run TypeScript test suite — all TS tests pass
- [x] 8.3 Cross-check: pick 5 representative (stability, difficulty, repetition) tuples, compute V2 interval in both Rust and TS, verify results match within 1e-10
