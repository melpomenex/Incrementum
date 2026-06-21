# Change: Review Forecast Simulator

## Why

The most-requested stats feature among committed spaced-repetition learners is a **what-if simulator**: "if I add 10 new cards per day for the next 30 days, what will my daily review load look like?" Anki's Forecast graph + Simulator add-on exist precisely for this. It is one of the strongest tools against the overdue-backlog death spiral, because users can *see* a pile-up coming and back off before it forms.

Incrementum already computes the **current** forecast (`get_due_workload_forecast`, `commands/algorithm.rs:584-632`) but has no **projected** forecast that accounts for future card additions. This change adds one.

## What Changes

### 1. Backend: `simulate_review_forecast` command
- Accepts `new_cards_per_day: f64`, `horizon_days: i32` (default 90), and `graduating_interval_days: f64` (default 1.0, used as the first-review→second-review gap).
- Builds the projection on top of the existing real forecast (`get_due_workload_forecast`) so the baseline reflects actual due items.
- For each day in the horizon, the simulator:
  1. Adds `new_cards_per_day` new cards (they become "due" the same day).
  2. Projects each new card's future reviews using a simplified FSRS interval growth model (graduating interval, then ×2.5 per "Good" rating, matching the extract scheduler's multiplier) — adding one projected re-review per interval crossing within the horizon.
  3. Returns `SimulatedForecastPoint { date, baseline_due, simulated_due, added_reviews }` so the UI can stack them.
- Returns `SimulatedForecast { points, total_baseline, total_simulated, total_new_reviews, peak_day, peak_count }`.

### 2. Frontend: simulator panel
- New `ForecastSimulator` component on the Analytics page.
- Slider for `new_cards_per_day` (0–50), horizon selector (30/60/90/180), recompute-on-change (debounced).
- Stacked bar chart: baseline (real) due items + projected added reviews per day.
- Callouts: "Peak day: <date> with N reviews" and "Total added reviews over horizon: N".

## Impact

### Affected Specs
- **review-forecast-simulator** — New spec for the simulator contract.

### Affected Code Areas
- `src-tauri/src/commands/algorithm.rs` — New `simulate_review_forecast` command (alongside existing `get_due_workload_forecast`).
- `src-tauri/src/lib.rs` — Register command.
- `src/api/algorithm.ts` — `simulateReviewForecast` wrapper + types.
- `src/components/analytics/ForecastSimulator.tsx` — New component (Recharts stacked bar).
- `src/pages/AnalyticsPage.tsx` — Mount the simulator.

### Non-goals
- No persistence of simulator parameters (transient what-if, not a setting).
- No per-deck simulation (whole-collection projection only this iteration).
- The interval-growth model is intentionally simplified (×2.5 per step) — it is a planning aid, not a FSRS replacement.
