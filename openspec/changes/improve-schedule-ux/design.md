## Context

The current `ScheduleView` implementation in `src/components/schedule/` is highly modular but visually fragmented. The layout stacks several large components vertically:
1. Page Header (Title + Spread Button)
2. `ScheduleTimeline` (14-day workload strip)
3. `ScheduleSummary` (Stat cards)
4. `ScheduleItemList` (with its own internal View Toggle and Filter state)

This stacking results in significant vertical "scatter", pushing the actual list of items off-screen and requiring users to navigate multiple independent control areas.

## Goals / Non-Goals

**Goals:**
- Consolidate the "Analytics" (Timeline + Summary) into a single, cohesive `ScheduleDashboard` area.
- Unify all view-level controls (Spread, View Toggle, Date Filters) into a single, top-level `ScheduleToolbar`.
- Support collapsing the dashboard to maximize content space.
- Improve visual density and reduce redundant padding/borders.

**Non-Goals:**
- Changing the underlying FSRS scheduling algorithm.
- Modifying the `ScheduleTable` or `ScheduleItemRow` internal rendering logic (only their container/layout).
- Implementing new "Spread" logic (reuse existing `SpreadModal`).

## Decisions

### 1. Unified `ScheduleDashboard`
We will replace the separate `ScheduleTimeline` and `ScheduleSummary` with a single `ScheduleDashboard` component.
- **Rationale**: These two components always display together and serve the same purpose: giving the user an overview of their upcoming workload. Merging them allows for a more efficient layout (e.g., stats on the left, timeline on the right on wide screens).

### 2. Header-Level View Toggling
The `viewMode` ("Cards" vs "Table") state will be moved from `ScheduleItemList` to `ScheduleView`.
- **Rationale**: The view mode is a page-level preference. Moving it to the header makes it more discoverable and aligns with other pages (like Documents) where view toggles are in the primary toolbar.

### 3. Collapsible Analytics Area
The `ScheduleDashboard` will be wrapped in a collapsible container.
- **Rationale**: Users who are focusing on clearing their queue for a specific day don't always need to see the 14-day forecast. Collapsing it provides a "Focus Mode" for the schedule.

### 4. Component Refactoring
- `ScheduleView.tsx`: Will be the orchestrator of the unified layout.
- `ScheduleDashboard.tsx`: New component that composes timeline and summary.
- `ScheduleToolbar.tsx`: New component (or part of `ScheduleView`) that unifies all actions.

## Risks / Trade-offs

- **[Risk]** → Information overload in a single dashboard area.
- **[Mitigation]** → Use clear visual separation (e.g., a vertical divider or subtle background shift) between stats and the timeline. Use responsive breakpoints to stack them on smaller screens.

- **[Risk]** → Breaking existing `ScheduleView` functionality during refactor.
- **[Mitigation]** → Perform a surgical refactor, keeping the same props and callbacks for sub-components, just changing their layout and container.
