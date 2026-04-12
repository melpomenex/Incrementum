## Context

Incrementum is a Tauri 2 desktop app (React 19 + TypeScript frontend, Rust/SQLite backend) with a dual-mode architecture that also runs as a browser PWA using IndexedDB. The app already has analytics infrastructure: `ReviewHeatmap` (GitHub-style contribution graph), `ScheduleVisualization` (30/60/90-day bar chart forecast), and `DateRangePicker`. The `analyticsStore` (Zustand) loads dashboard stats, memory stats, activity data, and category stats via Tauri commands.

The Rust backend exposes commands through `src-tauri/src/commands/` and queries data via a Repository pattern on SQLite. The browser fallback maps the same command names to IndexedDB queries via `browser-backend.ts`.

SuperMemo's Workload tab shows a dense multi-column table of daily repetitions across months with sum/average footers. The goal is to create something that conveys the same information but with modern, visually rich UX — a proper month-grid calendar with color-coded intensity and drill-down.

## Goals / Non-Goals

**Goals:**
- Provide a month-grid calendar where each day shows due review count with color-coded workload intensity
- Show past days (actual reviews completed) vs future days (projected due items)
- Allow navigation between months and a quick-jump to today
- Enable clicking a day to see the specific items due/reviewed
- Display per-month summary stats (total, daily average, peak day)
- Show a workload trend sparkline below the calendar
- Work in both Tauri desktop and browser PWA modes

**Non-Goals:**
- Editing due dates or rescheduling items from the calendar (separate feature)
- Weekly or daily planner time-blocking
- Calendar export or sharing
- Integration with external calendars (Google Calendar, etc.)

## Decisions

### 1. Component architecture: dedicated component within analytics, not a new top-level page

**Choice:** Add `WorkloadCalendar` as a panel section within the existing `AnalyticsTab`, not a new top-level route/tab.

**Rationale:** The workload calendar is an analytics concern. Users discover it naturally alongside the heatmap and schedule visualization. Adding it as a top-level tab would clutter the navigation for a feature used occasionally. The existing `AnalyticsTab` already composes multiple analytics panels (`ReviewHeatmap`, `ScheduleVisualization`, `ActivityChart`, etc.), so this follows the established pattern.

**Alternative considered:** New `CalendarTab` in the tab registry — rejected because the feature is too narrow to justify a top-level position.

### 2. Calendar grid: custom Tailwind component, not a third-party calendar library

**Choice:** Build the month grid as a custom React component using Tailwind CSS classes.

**Rationale:** The project uses zero external UI libraries (no shadcn, no Radix). A third-party calendar library (react-day-picker, @hello-pangea/dnd, etc.) would be the first UI library dependency and would clash with the existing hand-rolled component system. A month grid is straightforward: 7 columns (Sun-Sat), 5-6 rows, each cell is a clickable div with a count badge and background color. The custom approach also gives full control over the workload-specific rendering (color intensity, count badges, past/future distinction).

**Alternative considered:** react-day-picker — rejected to maintain consistency with the existing no-library approach.

### 3. Workload data: single new Tauri command returning daily aggregates for a date range

**Choice:** Create a single `get_workload_data` Tauri command that accepts a start date, end date, and returns an array of `{ date, due_count, reviewed_count, new_count }` objects — one per day in the range.

**Rationale:** A single query is simpler than making separate calls for due items and review history. The date-range approach lets the calendar fetch exactly the days it needs (e.g., one month + padding days from adjacent months for the grid). The query joins `learning_items` (grouped by `due_date`) with `review_results` (grouped by review timestamp) and uses LEFT JOIN so days with no activity still appear.

**Alternative considered:** Reusing `getDueWorkloadForecast` — rejected because it only returns future due counts and doesn't include historical review data.

### 4. Color coding: 5-level intensity scale mapped to configurable thresholds

**Choice:** Use a 5-level color scale (none, light, moderate, heavy, overload) with default thresholds at 0, 10, 25, 50, 100 items. Colors use the existing theme's semantic palette (green shades for low workload, amber for moderate, red for heavy).

**Rationale:** The existing `ReviewHeatmap` already uses a 5-level green scale. Extending this to include amber/red for high workload gives users an intuitive traffic-light system. Configurable thresholds accommodate users with different collection sizes (10 reviews/day is heavy for a small deck, light for a large one).

**Alternative considered:** Fixed thresholds — rejected because workload perception is relative to collection size.

### 5. Trend line: Recharts AreaChart below the calendar

**Choice:** Add a compact `AreaChart` (Recharts) below the calendar showing 30-day due forecast with actual reviews overlaid.

**Rationale:** The project already uses Recharts 3 for `ActivityChart` and `ScheduleVisualization`. An area chart is a natural complement to the calendar grid, showing the trend at a glance. The 30-day window matches the existing `ScheduleVisualization` forecast period.

### 6. Day drill-down: inline popover, not a separate page

**Choice:** Clicking a day opens a popover/tooltip listing the due items with their document and extract context.

**Rationale:** Keeps the user in context. The existing `DateRangePicker` and heatmap tooltips already use inline popover patterns. A popover is fast to open and close, suitable for quickly scanning what's due. For past days, show reviewed items; for future days, show items projected to be due.

## Risks / Trade-offs

- **[Large collections may have slow queries]** → The `get_workload_data` query aggregates over `learning_items` which can grow large. Mitigation: add a `WHERE due_date BETWEEN ? AND ?` filter and ensure the `due_date` index exists. The query only scans a single month's worth of data at a time.
- **[Browser mode IndexedDB performance]** → IndexedDB grouping queries are slower than SQL. Mitigation: the date range is small (1 month). If performance is an issue, the component can batch-fetch data in weekly chunks.
- **[Color thresholds may not suit all users]** → Default thresholds may be off for very small or very large collections. Mitigation: make thresholds configurable in a settings panel (future enhancement — for now, sensible defaults).
- **[Calendar grid layout on small screens]** → 7-column grids can be tight on narrow windows. Mitigation: make the component responsive — collapse day labels on narrow viewports and use smaller count badges.
