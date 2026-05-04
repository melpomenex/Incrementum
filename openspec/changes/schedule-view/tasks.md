## 1. Types & API Layer
- [x] 1.1 Add `ScheduleDayItem` extended type in `src/types/queue.ts` (due date, stability, difficulty, interval, retrievability, lapses, estimated time)
- [x] 1.2 Add `getWorkloadForecast(days?)` wrapper in `src/api/analytics.ts` calling `get_due_workload_forecast`
- [x] 1.3 Add `spreadItems(items, horizonDays)` utility in `src/lib/scheduleSpread.ts` — uses postpone engine in-memory for preview, returns projected distribution
- [x] 1.4 Add i18n keys for en.ts: `schedule.*` namespace (~45 keys)
- [x] 1.5 Add i18n keys for zh.ts: `schedule.*` namespace

## 2. ScheduleTimeline Component
- [x] 2.1 Create `src/components/schedule/ScheduleTimeline.tsx` — horizontal date strip, 14-day default, scroll-snap on mobile
- [x] 2.2 Color-code days by workload level using existing `getLevel()` logic
- [x] 2.3 Highlight today and selected day
- [x] 2.4 Show item count badge on each day

## 3. ScheduleSummary Component
- [x] 3.1 Create `src/components/schedule/ScheduleSummary.tsx` — horizontal stat cards
- [x] 3.2 Stats: total scheduled, due today, overdue, 7d avg, peak day+count

## 4. ScheduleItemRow Component
- [x] 4.1 Create `src/components/schedule/ScheduleItemRow.tsx` — type icon, title, metadata row (due, days-until, stability bar, difficulty, est. time, lapses)
- [x] 4.2 Quick action buttons: +1d, +3d, +7d postpone
- [x] 4.3 Mobile: expandable detail section on tap (quick actions hidden by default, shown in expanded state)

## 5. ScheduleItemList Component
- [x] 5.1 Create `src/components/schedule/ScheduleItemList.tsx` — grouped by date with sticky headers
- [x] 5.2 "All upcoming" default view + filter by selected timeline date
- [x] 5.3 Sort by priority within date groups
- [x] 5.4 Loading skeleton state

## 6. SpreadModal Component
- [x] 6.1 Create `src/components/schedule/SpreadModal.tsx` — source selection, horizon picker, daily limit input
- [x] 6.2 Create `src/components/schedule/SpreadPreviewChart.tsx` — Recharts BarChart with before/after bars
- [x] 6.3 Live preview updates when horizon/limit changes
- [x] 6.4 Confirm action: batch `postpone_item()` calls + refresh data
- [x] 6.5 Toast confirmation with spread stats
- [x] 6.6 Mobile: bottom-sheet variant with drag handle

## 7. ScheduleView (Desktop)
- [x] 7.1 Create `src/components/schedule/ScheduleView.tsx` — assembles Timeline + Summary + ItemList
- [x] 7.2 "Spread overloaded days" toolbar button
- [x] 7.3 Data fetching: workload forecast + queue items on mount
- [x] 7.4 Refresh after spread/reschedule actions

## 8. MobileScheduleView (PWA)
- [x] 8.1 Create `src/components/schedule/MobileScheduleView.tsx` — mobile wrapper
- [x] 8.2 Full-width timeline with scroll-snap
- [x] 8.3 Tap-to-expand item cards
- [x] 8.4 Bottom-sheet SpreadModal

## 9. Integration
- [x] 9.1 Add "Schedule" toggle in `QueueTab.tsx` — render ScheduleView for desktop (via ReviewQueueView mode)
- [x] 9.2 Add "Schedule" tab in `MobileQueueView.tsx`
- [x] 9.3 Add Schedule nav button in `ReviewQueueView.tsx` toolbar
- [x] 9.4 TypeScript compilation passes (`npx tsc --noEmit`)
- [x] 9.5 Verify mobile responsive layout at 375px viewport
