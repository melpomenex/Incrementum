## Context

Incrementum currently schedules reviews using SM-20/FSRS, which optimizes intervals but ignores semantic relationships between items. Two items about closely related topics can appear back-to-back, causing interference that weakens recall. Additionally, items tagged with advanced concepts can appear before the user has stabilized foundational prerequisites.

Tag-Aware Scheduling (TAS) adds a post-processing layer over the existing scheduler. It uses the existing embedding pipeline's tag coherence values and user-defined prerequisite edges to reorder and gate the queue. TAS is opt-in and toggleable — when disabled, the system behaves exactly as it does today.

## Goals / Non-Goals

**Goals:**
- Reduce semantic interference by separating high-coherence items in the review queue.
- Enforce prerequisite ordering so advanced material surfaces only after foundations are stable.
- Keep scheduling deterministic and fast — no LLM/embedding calls at scheduling time.
- Preserve SM-20/FSRS interval integrity — TAS mutates presentation order, not intervals.

**Non-Goals:**
- Auto-inference of prerequisites (users explicitly declare them; future LLM agent may assist).
- Replacing or modifying the SM-20/FSRS algorithm.
- Real-time coherence computation — uses existing pre-computed values.

## Decisions

### 1. TAS as a post-processing layer, not a scheduler modification

**Decision**: TAS runs over the already-computed SM-20/FSRS due set. It blocks and reorders items without touching intervals, due dates, or stability values.

**Rationale**: This preserves the integrity of the proven scheduling algorithms. TAS can be toggled on/off at any time with zero migration cost. When disabled, the queue is identical to the pre-TAS behavior.

**Alternatives considered**: Modifying the scheduler's scoring function to include interference and prerequisite terms. Rejected because it would couple TAS to scheduler internals, making it fragile across algorithm updates and hard to toggle.

### 2. Rust-side pre-computation via Tauri commands

**Decision**: The daily TAS computation (prerequisite gating, interference jitter, queue assembly) runs in Rust as a Tauri command. Tag maturity stats are recomputed in Rust on review completion.

**Rationale**: The computation needs direct access to the SQLite database for tag stats and item state. Running it in Rust avoids round-tripping large datasets to the frontend. The result is a lean `Vec<ScheduledItem>` returned to the frontend.

**Alternatives considered**: Computing in TypeScript on the frontend. Rejected because it would require loading all tag stats and items into memory on the JS side, which is slow for large libraries and duplicates data already in Rust memory.

### 3. Ephemeral fields, not persisted state

**Decision**: `interferenceDelayUntil` and `prerequisiteBlocked` are computed at queue-build time and stored only in ephemeral Zustand state. They are never written to SQLite.

**Rationale**: These values depend on the current queue composition and real-time tag maturity, which changes with every review. Persisting them would require invalidation logic. Ephemeral computation keeps the data model simple and ensures the values are always fresh.

### 4. Maturity recomputation on review completion, not on queue build

**Decision**: Tag stability statistics are updated when a review is completed (item stability changes). The queue build reads the pre-computed stats rather than recomputing them.

**Rationale**: Maturity depends on per-item stability, which only changes on review. Recomputing on queue build would be wasteful. The review-completion hook ensures stats are always current when the queue is built.

**Alternatives considered**: Nightly batch recomputation. Rejected because it introduces a time lag where a just-reviewed item wouldn't affect maturity until the next day.

### 5. Circular dependency detection at save time

**Decision**: `set_tag_prerequisites` validates the prerequisite graph for cycles before saving. If adding a prerequisite would create a cycle, the command rejects the change with an error.

**Rationale**: Detecting cycles at scheduling time would complicate the gating algorithm and produce confusing runtime behavior. Catching it at edit time gives the user immediate, clear feedback.

### 6. Reuse existing coherence and graph infrastructure

**Decision**: TAS reads tag coherence from the existing embedding pipeline (no new computation). The prerequisite graph visualization reuses the existing graph renderer with a filtered view.

**Rationale**: Avoids duplicating infrastructure. Coherence is already computed for the Knowledge Sphere; TAS is a consumer.

### 7. SQLite schema migration for tag extensions

**Decision**: Add `prerequisites` (JSON text array of tag IDs) and `maturity_threshold` (REAL, default 0.8) columns to the tags table. Use a simple migration, not a new table.

**Rationale**: These are small, tag-scoped fields. A JSON column for prerequisites avoids a join table for a typically small array. A migration script runs on app startup.

## Risks / Trade-offs

- **[Risk] Cold start: no coherence data for new tags** → Mitigation: Treat missing coherence as 0 — no interference jitter, no false positives. Gating still works because it uses maturity (stability-based), not coherence.
- **[Risk] Aggressive blocking frustrates users** → Mitigation: "Force show" override per item. If override rate is high, the user can adjust `maturityRatio` downward or disable prerequisite gating.
- **[Risk] Queue assembly O(n²) with interference window** → Mitigation: Window size fixed at 10 items. For typical queue sizes (<500 items), this is negligible. The window is a constant factor.
- **[Risk] Tag deletion orphaning prerequisites** → Mitigation: When a tag is deleted, remove it from all other tags' `prerequisites` arrays. A cleanup pass runs on tag deletion.
- **[Trade-off] Prerequisites are tag-level, not item-level** → This is simpler to manage but coarser. An item tagged with both `calculus.limits` and `calculus.derivatives` would have `derivatives` blocked by `limits` even if the specific item doesn't depend on limits. Users can work around this with more granular tags.

## Migration Plan

1. **Schema migration**: On app startup, run a migration that adds `prerequisites TEXT NOT NULL DEFAULT '[]'` and `maturity_threshold REAL NOT NULL DEFAULT 0.8` to the tags table. This is additive and backward-compatible — existing tags get empty prerequisites and the default threshold.
2. **No data migration needed**: Existing items and tags continue to work. TAS is disabled by default.
3. **Rollback**: If TAS is disabled, all behavior is identical to pre-TAS. The new columns can remain without effect. A future cleanup migration could drop them if TAS is permanently removed.
4. **Deployment**: The change ships as part of a regular release. No special deployment steps.

## Open Questions

- Should prerequisite gating consider *transitive* prerequisites (if A → B → C, does C require both B and A to be mature)? Current design: only direct prerequisites. Transitive can be added later.
- Should interference jitter use a decay function (closer items get more delay) instead of a fixed `minSeparationHours`? Current design: fixed delay. A decay function is a potential enhancement.
- Should the "Force show" action be tracked as a metric to auto-tune thresholds? Current design: manual tuning only.
