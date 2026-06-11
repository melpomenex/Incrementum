## Why

Review sessions suffer from two problems that reduce learning efficiency: semantically similar items appearing back-to-back cause interference (weakening recall), and advanced material becoming available before foundational prerequisites are stable leads to wasted effort. Tag-Aware Scheduling (TAS) addresses both by reordering and gating the review queue using existing tag embeddings and user-defined prerequisites — without modifying the proven SM-20/FSRS interval algorithms.

## What Changes

- **New**: Two-phase TAS post-processing layer over the existing scheduler: prerequisite gating blocks items whose tag prerequisites are below a maturity threshold, and interference jitter spreads apart items sharing high-coherence tags.
- **New**: Tag model extensions: `prerequisites` (directed edges to other tags), `stabilityStats` (per-tag maturity tracking), and `maturityThreshold` field.
- **New**: Tauri commands: `build_tas_queue`, `set_tag_prerequisites`, `get_tag_maturity_stats`.
- **New**: Prerequisite editor UI in tag management: multi-select, dependency graph visualization, maturity progress bars.
- **New**: Queue indicators showing why items are blocked/delayed, with a "Force show" override.
- **New**: TAS config settings panel (on/off toggle, sliders for thresholds).
- **Modified**: Queue assembly pipeline — TAS runs as a post-processing step after SM-20/FSRS; the existing scheduler is unchanged.
- **Default**: TAS is opt-in; disabled by default. All existing behavior is preserved when TAS is off.

## Capabilities

### New Capabilities

- `tag-aware-scheduling`: Core TAS scheduling engine (Rust). Daily pre-computation of prerequisite gating and interference jitter, queue assembly logic, tag maturity computation on review completion, and the three Tauri commands exposing TAS state to the frontend.
- `tag-prerequisite-editor`: React UI for managing tag prerequisites — multi-select component in tag management view, directed dependency graph visualization, and per-tag maturity progress indicators.
- `tas-queue-ui`: React UI for queue-level TAS indicators — blocked/delayed badges on review items, "Force show" override, and the TAS configuration settings panel.

### Modified Capabilities

<!-- No existing specs require requirement-level changes. TAS is an additive layer. -->

## Impact

- **Rust**: `src-tauri/src/models/` — Tag model, new TAS config model. `src-tauri/src/` — new TAS scheduler module, three new Tauri commands. Integration hook into review completion path for maturity recomputation.
- **TypeScript**: `src/` — new `tasSlice` in Zustand, new components for prerequisite editor, queue badges, and settings. Queue view and tag management view gain new conditional UI sections.
- **SQLite**: Schema migration for new Tag columns (`prerequisites` JSON array, `maturity_threshold` REAL).
- **Dependencies**: No new external dependencies required. Reuses existing embedding pipeline for tag coherence, existing graph renderer for prerequisite visualization.
