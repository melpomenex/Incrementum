## Why

Users have no way to plan their study sessions or anticipate workload spikes. The existing analytics (heatmaps, schedule bar charts) show historical activity and a simple due-count forecast, but they don't provide a calendar-grade view of daily review load — how many items are due each day, how that compares to past days, and whether the user is building a sustainable schedule. SuperMemo's Workload tab addresses this but with dated UX (a dense multi-column table). Incrementum needs a modern, visually rich calendar that makes workload planning intuitive.

## What Changes

- Add a new **Workload Calendar** view accessible from the Analytics tab, showing a month-grid calendar where each day cell displays the number of due reviews
- Color-code days by workload intensity (green → amber → red) with configurable thresholds
- Show past days with actual review counts and future days with projected due counts
- Add month/week navigation with the ability to scroll through months
- Show summary statistics per month (total due, daily average, peak day)
- Allow clicking a day to drill into the items due on that date
- Add a workload trend line below the calendar showing the 30-day forecast

## Capabilities

### New Capabilities
- `workload-calendar`: Calendar grid view showing daily review workload (past actuals + future projections) with color-coded intensity, navigation, and drill-down
- `workload-data`: Backend data layer that aggregates per-day due item counts and historical review counts for the calendar view, including the forecast projection

### Modified Capabilities
<!-- No existing spec-level requirement changes needed -->

## Impact

- **Frontend**: New `WorkloadCalendar` component in `src/components/analytics/`, new `WorkloadCalendarPanel` in the Analytics tab
- **API layer**: New query in `src/api/analytics.ts` (or `algorithm.ts`) to fetch daily workload data for a date range
- **Rust backend**: New Tauri command to query `learning_items` grouped by `due_date` and `review_results` grouped by review date
- **Browser backend**: Corresponding IndexedDB query in `src/lib/browser-backend.ts`
- **i18n**: New translation keys for calendar labels, stats, and tooltips across all 6 locales
- **Dependencies**: No new external dependencies — built with existing Recharts for the trend line and custom Tailwind for the calendar grid
