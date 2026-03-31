## Why

Incrementum has implementations of multiple spaced repetition algorithms (FSRS-6, SM-2/5/8/15, Incremental, Engaging) but the UI only exposes FSRS-5 and SM-2 as options, and the backend ignores the selection entirely -- flashcards always use FSRS-6. Users cannot choose SM-18, the latest SuperMemo algorithm, or any of the other implemented algorithms. We need to (1) implement SM-18 in the Rust backend and (2) wire the UI so users can actually select between algorithms.

## What Changes

- Implement the SM-18 algorithm in Rust, porting from the reverse-engineered Python reference at [melpomenex/sm18-re](https://github.com/melpomenex/sm18-re).
- Update the settings type to support all implemented algorithms as a discriminated union.
- Add a Tauri command for SM-18 reviews with proper state persistence.
- Update the Learning Settings UI with an algorithm selector dropdown that shows all available algorithms with descriptions.
- Wire the backend review path to dispatch to the selected algorithm instead of hardcoding FSRS-6.
- Ensure consistent behavior across Tauri desktop app and Web App / PWA.

## Capabilities

### New Capabilities
- `sm18-algorithm`: SM-18 spaced repetition algorithm implementation ported from the sm18-re reference.

### Modified Capabilities
- `document-rating`: The existing spec's rescheduling requirement must be updated to note that the algorithm used is configurable, not always FSRS.

## Impact

- **Backend**: New module `src-tauri/src/algorithms/sm18.rs`, modified `algorithms/mod.rs`, modified `commands/review.rs` to dispatch based on algorithm selection.
- **Frontend**: Updated `settingsStore.ts` (`LearningSettings.algorithm` type), updated `SettingsPage.tsx` algorithm dropdown, updated `reviewStore.ts` to pass algorithm context to review commands.
- **Database**: SM-18 state (stability, difficulty, lapses, grade-R mapping) can reuse existing `memory_state_stability` and `memory_state_difficulty` columns on `learning_items`, plus a new `algorithm_state` JSON column for SM-18-specific fields.
- **Web App**: Algorithm selection persisted in localStorage via settings store; server-side dispatch routes to the same algorithm implementations.
