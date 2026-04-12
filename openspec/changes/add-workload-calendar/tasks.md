## 1. Rust Backend — Workload Data Commands

- [x] 1.1 Add `WorkloadDay` struct to models (fields: `date`, `due_count`, `reviewed_count`, `new_count`)
- [x] 1.2 Add `WorkloadDayDetail` struct to models (fields: `item_id`, `question`, `answer`, `document_title`, `item_type`, `state`, optional `review_rating`)
- [x] 1.3 Implement `get_workload_data` command: SQL query joining `learning_items` (grouped by `due_date`) and `review_results` (grouped by review date), returning one entry per day in the date range
- [x] 1.4 Implement `get_workload_day_details` command: query items due on a specific date (future) or items reviewed on a specific date (past), join with `documents` table for `document_title`
- [x] 1.5 Register both commands in the Tauri command handler

## 2. Browser Backend — IndexedDB Fallback

- [x] 2.1 Implement `get_workload_data` in `browser-backend.ts`: query `learning_items` by `due_date` index and aggregate by day; query `review_results` by review timestamp and aggregate by day
- [x] 2.2 Implement `get_workload_day_details` in `browser-backend.ts`: query `learning_items` by `due_date` for future dates; query review results by date for past dates

## 3. TypeScript API Layer

- [x] 3.1 Define `WorkloadDay` and `WorkloadDayDetail` TypeScript interfaces in `src/types/`
- [x] 3.2 Add `getWorkloadData(startDate, endDate)` function in `src/api/analytics.ts` calling the Tauri/browser command
- [x] 3.3 Add `getWorkloadDayDetails(date)` function in `src/api/analytics.ts` calling the Tauri/browser command

## 4. Workload Calendar Component

- [x] 4.1 Create `WorkloadCalendar.tsx` in `src/components/analytics/` with month grid layout (7-column CSS grid, Sun–Sat headers)
- [x] 4.2 Implement day cell rendering with review count badge and 5-level color-coded background intensity
- [x] 4.3 Add month navigation (prev/next buttons) and "Today" jump button in the calendar header
- [x] 4.4 Fetch workload data via `getWorkloadData` when the visible month changes (with 1-day padding for adjacent month days in the grid)
- [x] 4.5 Highlight today's cell and distinguish past (actual) vs future (projected) cells visually

## 5. Day Drill-Down Popover

- [x] 5.1 Create `WorkloadDayPopover.tsx` component that opens on day cell click
- [x] 5.2 Fetch day details via `getWorkloadDayDetails` when a day is clicked
- [x] 5.3 Render item list with question preview, document title, item type icon, and (for past days) review result indicator
- [x] 5.4 Handle empty day state ("No items scheduled" / "No reviews completed")

## 6. Month Summary Statistics

- [x] 6.1 Compute `total_reviews`, `total_due`, `daily_average`, and `peak_day` from the daily workload data array
- [x] 6.2 Render summary stats bar above or below the calendar with the computed values

## 7. Workload Trend Chart

- [x] 7.1 Create `WorkloadTrendChart.tsx` in `src/components/analytics/` using Recharts `AreaChart`
- [x] 7.2 Plot two series: projected due items (future) and actual reviews completed (past) over 30 days
- [x] 7.3 Style the chart to match existing analytics charts (theme-aware colors, compact height)

## 8. Integration into Analytics Tab

- [x] 8.1 Import and render `WorkloadCalendar` with trend chart in `AnalyticsTab.tsx` as a new section
- [x] 8.2 Add i18n translation keys for all calendar labels, stats, and tooltips across all 6 locales (en, de, es, fr, ja, zh)
