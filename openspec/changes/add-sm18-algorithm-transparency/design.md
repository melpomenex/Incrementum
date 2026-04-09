## Design

### Current State

Four UI surfaces show algorithm stats, all hardcoded for FSRS:

| Component | Hardcoded Label | Forget Curve Formula | Data Source |
|-----------|----------------|---------------------|-------------|
| `ReviewTransparencyPanel.tsx` | "FSRS Transparency" | None (just interval preview) | `card.memory_state` |
| `FSRSInspector.tsx` | "FSRS Inspector" | `R = exp(-t/S)` (FSRS) | `card.memory_state` |
| `ZenReviewMode.tsx` → `FSRSMetadata` | Comments only | None (just S/R/D/I overlay) | `card.memory_state` |
| `ItemDetailsPopover.tsx` | "Scheduling / FSRS" | None | `getAlgorithmParams()` + `previewReviewIntervals()` |

### Approach: Algorithm-Aware Components

Each component gains access to the current card's `algorithm_type` field (already present on `LearningItem`). Based on this, it:

1. **Selects the correct algorithm name** for display ("FSRS-6" or "SuperMemo 18").
2. **Parses the correct state** — FSRS uses `card.memory_state` (stability, difficulty, retrievability); SM18 uses `card.algorithm_state` (parsed via existing `parseSm18State()`).
3. **Uses the correct forget curve formula** — FSRS: `R = exp(-t/S)`, SM18: `R = 0.9^(t/S)`.

### Data Flow

```
card.algorithm_type
  ├── "fsrs" → read card.memory_state, use FSRS formula
  └── "sm18" → parse card.algorithm_state via parseSm18State(), use SM18 formula
```

For SM18, the existing `sm18Retrievability(stability, elapsedDays)` function provides the correct formula. Elapsed days come from `card.algorithm_state.elapsed` (or computed from `card.last_review_date`).

### SM18-Specific Stats

SM18 produces additional metrics not available in FSRS:
- **Reps** (`state.repetition`) — count since last lapse
- **Lapses** (`state.lapses`) — total times forgotten
- **BW deviation** (`result.bw`) — B-W metric for difficulty update (available after review)
- **SInc factor** (`result.sinc`) — stability increase factor used (available after review)

The SM18 transparency panel shows these alongside the common metrics (stability, difficulty, retrievability).

### Forget Curve Difference

The two algorithms model forgetting differently:
- **FSRS-6**: `R = exp(-t/S)` — exponential decay where S is the days until R drops to ~37%
- **SM18**: `R = 0.9^(t/S)` — exponential decay where S is the days until R drops to 90% (by definition)

The `FSRSInspector`'s `calculateForgetCurve` function must branch on algorithm type to use the correct formula.

### Component Changes

**`ReviewTransparencyPanel.tsx`**
- Accept `algorithmType` or read `card.algorithm_type`
- Title: "FSRS-6 Transparency" or "SuperMemo 18 Transparency"
- For SM18: parse `card.algorithm_state`, show SM18 difficulty (0-1 scale), stability, retrievability
- Add SM18-specific stats (reps, lapses) when SM18 is active

**`FSRSInspector.tsx`**
- Rename internal references to be algorithm-agnostic (or keep filename, update labels)
- Header: "Algorithm Inspector" or "FSRS-6 Inspector" / "SM18 Inspector"
- Forget curve: use correct formula based on algorithm
- Parameter descriptions adapt: SM18 difficulty is 0-1 (not 1-10), SM18 stability definition differs
- Add SM18-specific fields (reps, lapses) when active

**`ZenReviewMode.tsx` → `FSRSMetadata`**
- Rename to `AlgorithmMetadata` (or keep as-is since it's internal)
- Source data from correct state based on algorithm_type
- No visible label change needed (just S/R/D/I overlay)

**`ItemDetailsPopover.tsx`**
- Section header: "Scheduling / FSRS-6" or "Scheduling / SM18" based on item's algorithm
- Stats adapt accordingly (difficulty scale differs: FSRS 1-10 vs SM18 0-1)
