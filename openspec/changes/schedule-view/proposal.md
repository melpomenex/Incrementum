# Proposal: Schedule View

## Intent

Users with large queues (e.g., 2955 items due on one day) have no way to see their upcoming study schedule at a glance or redistribute that load. The existing Queue shows what's due *today* but lacks temporal context — when each item is scheduled, how many days until it's due, FSRS memory metrics, and most critically, the ability to **spread** an overwhelming day's load across future days.

SuperMemo handles this with its "Postpone" and incremental reading scheduling system: items get redistributed across a future horizon so the user sees a manageable daily load instead of an avalanche. Incrementum already has a postpone engine (`src/lib/postpone.ts`) modeled after SM-20, but the UI only exposes "Postpone All" as a bulk action — there's no visual schedule, no per-day spreading control, and no way to preview the result before committing.

## Scope

### In scope
- New **Schedule** view in the Queue tab (desktop) and as a top-level mobile view
- Day-by-day schedule showing due items grouped by date with rich metadata
- Calendar heatmap showing workload distribution over time (ties into existing `WorkloadCalendar` data)
- **Spread** action: select a date range and redistribute items across it, with live preview of resulting daily load
- Rich per-item info: due date, interval, stability, difficulty, retrievability, estimated review time, lapse count, item type badge, document source
- Mobile-responsive PWA layout (bottom sheet for details, swipe actions for postpone/reschedule)
- Integration with existing postpone engine for algorithm-aware redistribution
- i18n keys for en/zh locales

### Out of scope
- Drag-and-drop reordering of items between days (follow-up feature)
- Recurring schedule templates (follow-up feature)
- Email/notification integration for schedule reminders (follow-up feature)
- Backend changes — using existing `get_due_workload_forecast`, `get_workload_data`, `postpone_item`, and `get_queue` APIs
- Modifying the existing WorkloadCalendar in Analytics (that's a separate view for historical data)

## Approach

Build a new `ScheduleView` component that combines a timeline/calendar with a detailed item list. The view has two modes:

1. **Timeline mode** — A horizontal date strip with dots/bars showing daily load. Tap/click a day to see items due that day. Color-coded by intensity (reuse existing `getLevel()` logic from WorkloadCalendar).

2. **List mode** — A flat list of all upcoming items sorted by due date, with date section headers. Each item row shows: title, type badge (doc/extract/learning), due date, days-until-due, stability/difficulty bars, estimated time, and quick actions (postpone +1d, open, dismiss).

The **Spread** action is accessible from the toolbar when items are selected or from a "Spread overloaded days" prompt. It opens a modal where the user picks a target horizon (7/14/30/60/90 days) and sees a preview bar chart of the before/after daily distribution. Uses the existing postpone engine for the actual rescheduling.

Mobile: Schedule appears as a tab in the mobile queue view. Timeline is a horizontally scrollable strip. Item cards are full-width touch targets. Details expand on tap (no popover).
