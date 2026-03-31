## Algorithm Architecture

### Current State

The app has two parallel paths with no dynamic dispatch:

1. **Learning items (flashcards/extracts)**: Always FSRS-6 via `fsrs::FSRS` crate in `commands/review.rs`.
2. **Documents/videos**: Always `IncrementalScheduler` in `commands/algorithm.rs`.

The `learning.algorithm` setting exists in the UI but is hardcoded to `"fsrs"` in the type and ignored by the backend.

### Proposed Architecture

#### 1. SM-18 Implementation (`algorithms/sm18.rs`)

Port the core formulas from `sm18_exact_algorithm.py`:

- **State**: `SM18State { stability, difficulty, interval, elapsed, repetition, lapses }` (Serialize/Deserialize for DB persistence).
- **Config**: `SM18Config` with embedded default SInc matrix constants (no sm8opt.dat dependency at runtime -- use the 21x21x21 `StabilityIncrease.dat` defaults baked in).
- **Core review function**: `review(state, grade, elapsed_days, desired_retention) -> SM18ReviewResult`.
- **Key formulas** (from reverse engineering report):
  - Retrievability: `R = 0.9^(t/S)`
  - Stability update (success): `S_new = S * SInc` where SInc comes from the default matrix.
  - Stability update (failure): `S_new = max(S * 0.87 / (1 + 0.1 * lapses), 0.5)`
  - Difficulty update: Trailing average with `f = max(0.10, 0.80 - (rep-1) * 0.06)`
  - Interval: `S * ln(1-FI) / ln(0.9)`

The `sm8opt.dat` personalized optimization tables will be excluded from the initial implementation. They require real collection data to be meaningful and add significant complexity. We can add optimization support as a follow-up change.

#### 2. Algorithm Enum and Dispatch

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlgorithmType {
    Fsrs,
    Sm2,
    Sm5,
    Sm8,
    Sm15,
    Sm18,
}
```

The review command in `commands/review.rs` will match on the algorithm type and dispatch:

- `Fsrs` -> existing `fsrs::FSRS` logic (unchanged)
- `Sm2` -> `supermemo::SM2Algorithm::next_state()`
- `Sm5` -> `supermemo::SM5Algorithm::next_state()`
- `Sm8` -> `supermemo::SM8Algorithm::next_state()`
- `Sm15` -> `supermemo::SM15Algorithm::next_state()`
- `Sm18` -> new `sm18::SM18Algorithm::review()`

#### 3. State Storage

Each algorithm has different state shape. We store algorithm-specific state in a JSON column:

- **FSRS**: Already stored in `memory_state_stability` + `memory_state_difficulty` columns.
- **SM-2**: `{ ease_factor, interval, repetitions }` -- fits in existing stability/difficulty columns with encoding.
- **SM-5**: `{ ease_factor, interval, repetitions, modifier }`.
- **SM-8**: `{ ease_factor, interval, repetitions, lapses }`.
- **SM-15**: `{ stability, difficulty }` -- reuses existing columns directly.
- **SM-18**: `{ stability, difficulty, interval, repetition, lapses }`.

**Approach**: Add an `algorithm_type` TEXT column to `learning_items` and a `algorithm_state` JSON column. For backward compatibility, items without `algorithm_type` are treated as FSRS. The `algorithm_state` JSON stores the full algorithm-specific state, while `memory_state_stability` and `memory_state_difficulty` continue to be populated for the priority scoring and queue selection logic (using stability/difficulty as common currency).

#### 4. Frontend Settings

```typescript
export type AlgorithmType = "fsrs" | "sm2" | "sm5" | "sm8" | "sm15" | "sm18";

export interface LearningSettings {
  algorithm: AlgorithmType;  // Was: "fsrs"
  // ... rest unchanged
}
```

The settings migration on rehydrate already handles missing fields via spread defaults, so existing users will seamlessly get `"fsrs"` as their algorithm.

#### 5. UI Algorithm Selector

Replace the current `<select>` in `SettingsPage.tsx` with a richer selector showing:
- Algorithm name and version
- One-line description
- Whether it supports personalized optimization
- A warning when switching that existing scheduling data will use the old algorithm (no migration)

#### 6. Cross-Platform

- **Tauri**: Algorithm dispatch in Rust commands. Settings stored in `learning_items.algorithm_type`.
- **Web App / PWA**: Algorithm type sent from frontend settings store to server API. Server-side dispatch mirrors Tauri logic.
- Both platforms read the same `algorithm_type` column from their respective databases.

### Trade-offs

1. **No SM-18 optimization (sm8opt.dat)** initially -- the default SInc matrix works well enough for new users. Personalized optimization requires sufficient review history and can be added later.

2. **No algorithm migration** -- switching algorithms does not retroactively recompute schedules. Existing items keep their current scheduling state. New reviews after the switch use the new algorithm. This avoids data loss and complexity.

3. **SM-2/5/8/15 already implemented** -- we just need to wire them up. No new algorithm code for these.
