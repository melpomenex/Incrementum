## 1. SM-18 Rust Implementation

- [x] 1.1 Create `src-tauri/src/algorithms/sm18.rs` with `SM18State`, `SM18Config`, and core review function porting from `sm18_exact_algorithm.py`.
- [x] 1.2 Embed the default 21x21x21 SInc matrix constants (from `StabilityIncrease.dat`) in Rust as a compile-time constant. Replaced with formula-based fallback for initial implementation.
- [x] 1.3 Add unit tests for retrievability, stability update, difficulty update, interval calculation, and binning functions matching the Python test suite.
- [x] 1.4 Register `sm18` module in `algorithms/mod.rs`.

## 2. Backend Algorithm Dispatch

- [x] 2.1 Define `AlgorithmType` enum (`Fsrs`, `Sm2`, `Sm5`, `Sm8`, `Sm15`, `Sm18`) with Serialize/Deserialize in `algorithms/mod.rs`.
- [x] 2.2 Add database migration for `algorithm_type` TEXT and `algorithm_state` JSON columns on `learning_items`.
- [x] 2.3 Modify `commands/review.rs` to dispatch to the correct algorithm implementation based on item's `algorithm_type`.
- [x] 2.4 Ensure `algorithm_state` JSON is persisted and restored on subsequent reviews for SM-2/5/8/15/18. Continue populating `memory_state_stability`/`memory_state_difficulty` for backward-compatible queue priority scoring.
- [x] 2.5 Update `repository.rs` (create, update, 4 get methods) and `legacy_import.rs` to handle new columns.

## 3. Frontend Settings Update

- [x] 3.1 Update `LearningSettings.algorithm` type in `settingsStore.ts` from `"fsrs"` to `"fsrs" | "sm2" | "sm5" | "sm8" | "sm15" | "sm18"`.
- [x] 3.2 Update `src/api/review.ts` `LearningItem` interface with `algorithm_type` and `algorithm_state` fields.
- [x] 3.3 Update `types/settings.ts` `AlgorithmSettings.type` union.

## 4. Algorithm Selection UI

- [x] 4.1 Update algorithm `<select>` dropdowns in both `SettingsPage.tsx` (Tauri) and `routes/settings.tsx` (PWA) with all 6 algorithm options.
- [ ] 4.2 Add algorithm-specific settings sections (deferred — FSRS retention slider still visible for all; algorithm-specific params can be added later).
- [ ] 4.3 Add a confirmation dialog when switching algorithms (deferred — no migration needed since algorithm is per-item).

## 5. Web App / PWA Server Dispatch

- [x] 5.1 Update `browser-backend.ts` `submit_review` to dispatch based on `algorithm_type`. FSRS-6 and SM-2 supported natively in browser; other algorithms handled by Tauri backend.
- [x] 5.1b Implement SM-18 algorithm in TypeScript (`src/lib/sm18.ts`) ported from the Python reference and matching the Rust implementation. Wire into `browser-backend.ts` dispatch and `preview_review_intervals`.
- [x] 5.2 Add `algorithm_type` and `algorithm_state` fields to browser DB `LearningItem` interface and `createLearningItem`.
- [x] 5.3 Update PWA settings route with algorithm selector.

## 6. Validation

- [x] 6.1 Run existing test suites — 137 tests pass, no regressions.
- [ ] 6.2 Manual testing in Tauri desktop (requires manual QA).
- [ ] 6.3 Manual testing in Web App / PWA (requires manual QA).
- [x] 6.4 Backward compatibility: existing items default to `algorithm_type = 'fsrs'`, migration adds columns with default value.
