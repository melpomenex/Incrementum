## 1. Scaffolding and State Management

- [x] 1.1 Lift `viewMode` ("cards" | "table") state from `ScheduleItemList` to `ScheduleView`.
- [x] 1.2 Implement `isDashboardCollapsed` state in `ScheduleView` with `localStorage` persistence.
- [x] 1.3 Add translation keys for new UI elements if necessary.

## 2. Component Consolidation

- [x] 2.1 Create `ScheduleDashboard.tsx` to integrate `ScheduleTimeline` and `ScheduleSummary`.
- [x] 2.2 Refactor `ScheduleTimeline.tsx` to accept custom classNames and fit the new dashboard layout.
- [x] 2.3 Refactor `ScheduleSummary.tsx` to support a more compact grid layout.

## 3. Layout Refactor

- [x] 3.1 Update `ScheduleView.tsx` to use a unified `ScheduleToolbar` for all primary actions.
- [x] 3.2 Implement the collapsible dashboard logic in `ScheduleView.tsx`.
- [x] 3.3 Update `ScheduleItemList.tsx` to receive `viewMode` as a prop and remove its internal toggle.

## 4. Visual Polish and Mobile

- [x] 4.1 Adjust vertical spacing and borders across all schedule components to reduce visual "scatter".
- [x] 4.2 Ensure responsive behavior for the consolidated dashboard on mobile devices.
- [x] 4.3 Verify all interactions: Date selection, View toggle, Spread modal trigger, and Dashboard collapse.
