## Context

Incrementum currently has a minimal postpone feature: `postponeItem(id, days)` simply adds N days to a learning item's `due_date`. It has no awareness of the item's algorithm state (stability, difficulty, retrievability), works only on learning items (not documents), and has no batch/auto-postpone capability.

SuperMemo 20's postpone algorithm (reverse-engineered and documented in `postpone_algorithm.md`) provides a priority-weighted, algorithm-aware postponement system with eligibility checks, configurable thresholds, and interval randomization to prevent clustering. The app already implements SM-20's review algorithm in both TypeScript (`src/lib/sm20.ts`) and Rust (`src-tauri/src/algorithms/sm20.rs`), so adding the postpone algorithm follows the same pattern.

The existing architecture has clear layers: algorithm logic → API commands → Zustand stores → React components. Settings are stored via Zustand persist in localStorage. i18n supports 6 locales.

## Goals / Non-Goals

**Goals:**
- Implement the SM-20 postpone algorithm as a pure TypeScript function module (`src/lib/postpone.ts`)
- Support both items (flashcards/cloze/QA) and documents (treated as topics in the algorithm)
- Provide configurable postpone settings integrated into the existing `LearningSettings`
- Add postpone-all action to the queue with algorithm-aware eligibility filtering
- Add auto-postpone toggle that offers to postpone outstanding items daily
- Preserve existing single-item postpone UX while upgrading it to be algorithm-aware

**Non-Goals:**
- Per-branch/per-deck postpone configuration (SM-20's postpone.ini complexity) — we use a single global config
- Unpostpone (reversing a previous postpone) in this change
- Rust backend implementation of postpone — the computation stays in TypeScript for now, similar to how SM-18 is used in the frontend
- Modifying the SM-20 review algorithm itself

## Decisions

### 1. TypeScript-only algorithm implementation (not Rust)

**Decision**: Implement the postpone engine as a pure TypeScript module at `src/lib/postpone.ts`, called from the frontend store.

**Rationale**: The existing SM-20 review algorithm already has a TypeScript implementation (`src/lib/sm20.ts`) that is the primary path used by the frontend. The postpone computation is a pure function (takes item state + config, returns new interval). Keeping it in TypeScript avoids adding new IPC commands to the Rust backend and follows the established pattern. The Rust `postpone_item` command will still be used to persist the result.

**Alternative considered**: Rust implementation in `src-tauri/src/algorithms/postpone.rs` — rejected because it adds IPC round-trip overhead for a non-critical path and the frontend already has the algorithm state available.

### 2. Single global config vs. per-branch config

**Decision**: Use a single global postpone configuration stored in `settings.learning.postpone`.

**Rationale**: SM-20's `postpone.ini` supports per-branch settings, but incrementum doesn't have a hierarchical branch/category system matching SM-20's. A single config is simpler and covers the vast majority of use cases. Users who need deck-specific tuning can use the existing scoped FSRS overrides pattern if needed in the future.

**Alternative considered**: Per-deck postpone config — rejected as premature complexity.

### 3. Postpone config lives inside LearningSettings

**Decision**: Add a `postpone: PostponeSettings` field to the existing `LearningSettings` interface.

**Rationale**: Postpone is a learning/algorithm feature. It naturally groups with algorithm selection, FSRS params, and review limits. This avoids adding a new top-level settings section and keeps the settings UI organized.

### 4. Priority computation from existing item fields

**Decision**: Compute a priority value (0–100) from the item's existing state: `priority = clamp(100 - stability * difficulty_factor, 0, 100)` where items with lower stability and higher difficulty get higher priority (more urgency to review, thus larger postpone increases for well-established items).

**Rationale**: SM-20 has its own internal priority system. We derive a comparable metric from the fields already stored on learning items and documents (`stability`, `difficulty`, `reps`, `lapses`). This avoids adding new database columns.

**Alternative considered**: Adding a dedicated `priority` column — rejected because it would require a migration and duplicating information already derivable from existing fields.

### 5. Document postponement uses the topic path

**Decision**: Documents are treated as "topics" in the postpone algorithm, using `topic_min_increase`, `topic_max_increase`, `topic_cap`, `topic_floor` parameters.

**Rationale**: SM-20 distinguishes between items (discrete Q&A elements) and topics (reading material). Documents in incrementum map to topics — they have `nextReadingDate` instead of `dueDate`, and `stability`/`difficulty` from the engaging/incremental scheduler.

## Risks / Trade-offs

- **[Postpone hurts retention]** → Postponing items increases the interval beyond the algorithm's recommendation, which can cause temporary retention dips. Mitigation: priority-weighted increases mean well-established items (high stability) get larger increases while struggling items (low stability) get smaller increases. The algorithm explicitly skips items below priority and stability thresholds.

- **[No undo for postpone-all]** → Batch postponing many items is a significant action. Mitigation: show a confirmation dialog with the count of items to be postponed and the estimated new queue size before proceeding. Unpostpone can be added later.

- **[Randomization adds non-determinism]** → Interval randomization means results vary between runs. Mitigation: use the SM-20 randomization formula as documented, which produces a controlled distribution (±50% of increase). This is by design to prevent clustering.

- **[TypeScript-only limits future Rust algorithms]** → If FSRS is later used as the primary algorithm with a Rust-only implementation, the postpone engine would need to move to Rust too. Mitigation: the postpone module has a clean interface that can be ported to Rust when needed.
