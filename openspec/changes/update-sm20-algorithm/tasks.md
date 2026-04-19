## 1. Rust — FSRS Constants & Expert Functions

- [x] 1.1 Add `FSRS_PARAMS: [f64; 35]` constant array to `sm20.rs`
- [x] 1.2 Implement `fsrs_expert1(t, S)` — power-law forgetting
- [x] 1.3 Implement `fsrs_expert2(t, S)` — shifted power-decay
- [x] 1.4 Implement `fsrs_expert3(t, S)` — exponential forgetting
- [x] 1.5 Implement `fsrs_expert_mixture(t, S)` — weighted 3-expert average

## 2. Rust — FSRS Update Functions

- [x] 2.1 Implement `fsrs_difficulty_update(D, S, A, grade)`
- [x] 2.2 Implement `fsrs_lapse_stability(D, S, A)`
- [x] 2.3 Implement `fsrs_recall_stability(D, S, A, t, grade)`
- [x] 2.4 Implement `fsrs_review_kernel(S, D, t, grade)` returning `(f64, f64, f64, f64)`
- [x] 2.5 Implement `fsrs_init_item(grade, stability, flag)` returning `SM20State`

## 3. Rust — State Extension & Dispatch

- [x] 3.1 Add `algorithm_branch`, `retrov`, `s_factor`, `multiplier` fields to `SM20State` with backward-compatible defaults
- [x] 3.2 Update `Default` impl and `review()` function to dispatch based on `algorithm_branch`
- [x] 3.3 Update `preview()` to handle both branches

## 4. Rust — Tests

- [x] 4.1 Add unit tests for expert functions (expert1, expert2, expert3) pinned against Python reference
- [x] 4.2 Add unit tests for mixture, difficulty update, lapse/recall stability
- [x] 4.3 Add unit test for `fsrs_review_kernel` lapse and recall paths
- [x] 4.4 Add unit test for `fsrs_init_item` with various grades and flags
- [x] 4.5 Add backward-compatibility test: parse old SM20State JSON without new fields

## 5. TypeScript — FSRS Constants & Expert Functions

- [x] 5.1 Add `FSRS_PARAMS: readonly number[]` constant array to `sm20.ts`
- [x] 5.2 Implement `fsrsExpert1(t, S)` — power-law forgetting
- [x] 5.3 Implement `fsrsExpert2(t, S)` — shifted power-decay
- [x] 5.4 Implement `fsrsExpert3(t, S)` — exponential forgetting
- [x] 5.5 Implement `fsrsExpertMixture(t, S)` — weighted 3-expert average

## 6. TypeScript — FSRS Update Functions

- [x] 6.1 Implement `fsrsDifficultyUpdate(D, S, A, grade)`
- [x] 6.2 Implement `fsrsLapseStability(D, S, A)`
- [x] 6.3 Implement `fsrsRecallStability(D, S, A, t, grade)`
- [x] 6.4 Implement `fsrsReviewKernel(S, D, t, grade)` returning `[number, number, number, number]`
- [x] 6.5 Implement `fsrsInitItem(grade, stability, flag)` returning `SM20State`

## 7. TypeScript — State Extension & Dispatch

- [x] 7.1 Add `algorithm_branch`, `retrov`, `s_factor`, `multiplier` fields to `SM20State` interface with defaults
- [x] 7.2 Update `parseSm20State()` to default new fields for backward compatibility
- [x] 7.3 Update `sm20Review()` to dispatch based on `algorithm_branch`
- [x] 7.4 Update `sm20PreviewIntervals()` to handle both branches

## 8. TypeScript — Tests

- [x] 8.1 Add tests for expert functions pinned against Python reference output
- [x] 8.2 Add tests for mixture, difficulty update, lapse/recall stability
- [x] 8.3 Add test for `fsrsReviewKernel` lapse and recall paths
- [x] 8.4 Add backward-compatibility test: parse old state JSON without new fields
