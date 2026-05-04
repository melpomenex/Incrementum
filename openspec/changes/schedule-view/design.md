# Design: Schedule View

## Architecture Overview

The Schedule View is a new presentation layer on top of existing queue and analytics data. It does **not** require new backend endpoints — it composes data from `get_due_workload_forecast`, `get_workload_data`, `getQueue`, and `postpone_item`.

```
ScheduleView (new)
├── ScheduleTimeline        — horizontal date strip
├── ScheduleSummary         — stats bar (total, due today, overdue, avg, peak)
├── ScheduleItemList        — grouped by date, with inline item rows
│   └── ScheduleItemRow     — individual item with metadata + quick actions
├── SpreadModal             — redistribution UI with preview chart
│   └── SpreadPreviewChart  — before/after bar chart (Recharts)
└── MobileScheduleView      — PWA wrapper with bottom-sheet SpreadModal
```

## Data Flow

```
get_due_workload_forecast(days=90)  →  timeline dots + summary stats
get_workload_data(start, end)       →  calendar heatmap colors
getQueue() / getDueQueueItems()     →  item list data
getQueueStats()                     →  summary numbers (due today, overdue)
postpone_item(id, days)             →  spread + quick reschedule actions
```

The view fetches forecast + queue data on mount. When the user spreads items or quick-reschedules, it calls `postpone_item` for each affected item, then refreshes the forecast and queue data.

## Component Details

### ScheduleTimeline
- Horizontal strip, 14 days visible by default, scrollable to 90
- Each cell: day-of-week label, date number, item count badge
- Color coded using existing `getLevel()` from WorkloadCalendar
- "Today" highlighted with ring/border
- Selected day has filled background
- On mobile: horizontal scroll with `scroll-snap-type: x mandatory`

### ScheduleSummary
- Horizontal stat cards in a flex row (wraps on narrow screens)
- Stats: Total scheduled, Due today, Overdue, 7d avg, Peak day + count
- Each stat card: label (muted), value (bold, large)

### ScheduleItemList
- Grouped by date with sticky section headers ("Today — 342 items", "May 6 — 87 items", etc.)
- "All upcoming" option selected by default; selecting a timeline date filters to that day
- Within each group, items sorted by priority descending
- Each ScheduleItemRow contains:
  - Left: type icon (BookOpen for docs, Layers for extracts, Brain for learning)
  - Center: title (2-line clamp), metadata row (due date, days-until, stability bar, difficulty, est. time, lapses)
  - Right: quick action buttons (+1d, +3d, +7d) — hidden on mobile (shown in expanded detail)

### SpreadModal
- Desktop: centered modal, max-w-xl
- Mobile: bottom sheet (slides up from bottom, drag handle)
- Controls:
  - Source: "All overdue" or selected date (pre-filled from context)
  - Horizon: radio buttons (7/14/30/60/90 days)
  - Daily limit: optional number input (default: auto-compute even distribution)
  - Preview: stacked bar chart (Recharts `BarChart`) showing before (red) vs after (blue) daily counts
  - Footer: Cancel + "Spread X items across Y days" confirm button
- Preview updates live as user changes horizon or limit

### MobileScheduleView
- Wraps ScheduleView components with mobile-specific layout:
  - Timeline uses full-width scrollable strip
  - Items are full-width cards with tap-to-expand details
  - Quick actions appear in expanded detail view (not always visible)
  - SpreadModal uses bottom-sheet pattern
  - Swipe left on item → postpone +1d; swipe right → expand

## Integration Points

### Queue Tab (`src/components/tabs/QueueTab.tsx`)
- Add "Schedule" as third option in the segmented control
- Desktop: horizontal pills in the header (Queue | Schedule | Review)
- Mobile: segmented control in the mobile header

### Postpone Engine (`src/lib/postpone.ts`)
- Spread uses `postponeElement()` with SM-20 config from settings
- For the preview, run `postponeAll()` on in-memory items (don't persist) to get the projected distribution
- On confirm, call `postpone_item()` for each item via the Tauri command

### Mobile Queue View (`src/components/mobile/MobileQueueView.tsx`)
- Add "Schedule" tab alongside "Reading" and "Review"
- Render `MobileScheduleView` when active

## Styling Approach
- All Tailwind, no new dependencies
- Recharts already in project for the preview chart
- Dark mode supported via existing theme system
- Responsive breakpoints: mobile (<640px) uses stacked layout, desktop uses multi-column

## Files Changed

| File | Action |
|------|--------|
| `src/components/schedule/ScheduleView.tsx` | NEW — main desktop component |
| `src/components/schedule/ScheduleTimeline.tsx` | NEW — date strip |
| `src/components/schedule/ScheduleSummary.tsx` | NEW — stats bar |
| `src/components/schedule/ScheduleItemList.tsx` | NEW — grouped item list |
| `src/components/schedule/ScheduleItemRow.tsx` | NEW — individual item row |
| `src/components/schedule/SpreadModal.tsx` | NEW — spread/redistribute modal |
| `src/components/schedule/SpreadPreviewChart.tsx` | NEW — before/after chart |
| `src/components/schedule/MobileScheduleView.tsx` | NEW — PWA wrapper |
| `src/components/tabs/QueueTab.tsx` | MODIFIED — add Schedule toggle |
| `src/components/mobile/MobileQueueView.tsx` | MODIFIED — add Schedule tab |
| `src/components/review/ReviewQueueView.tsx` | MODIFIED — add Schedule nav button |
| `src/lib/i18n/locales/en.ts` | MODIFIED — new schedule.* keys |
| `src/lib/i18n/locales/zh.ts` | MODIFIED — new schedule.* keys |
| `src/api/analytics.ts` | MODIFIED — add forecast API wrapper |
| `src/types/queue.ts` | MODIFIED — add ScheduleItem extended type |
