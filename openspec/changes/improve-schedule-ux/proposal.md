## Why

The current Schedule view is visually cluttered and "scattered", with multiple layers of controls (header, timeline, summary, and toolbar) taking up significant vertical space. This results in a disjointed user experience where the primary content—the scheduled items—is pushed below the fold, requiring unnecessary scrolling and making the interface feel overwhelming.

## What Changes

- **Consolidated Schedule Dashboard**: Merged the workload timeline and summary stats into a single, cohesive dashboard component that provides a unified view of the upcoming workload.
- **Unified Schedule Toolbar**: Streamlined the various action buttons (Spread, View Toggle, Date Selection) into a consistent toolbar, reducing vertical layers.
- **Collapsible Analytics Section**: Added the ability to collapse the dashboard/analytics area to maximize space for the schedule list or table.
- **Improved Information Density**: Optimized layout spacing and typography to provide a cleaner, "less scattered" feel without losing data depth.

## Capabilities

### New Capabilities
- `schedule-dashboard`: A cohesive dashboard component that integrates the workload forecast and summary statistics into a unified visualization.
- `schedule-toolbar`: A streamlined toolbar providing unified access to view toggles, spreading functionality, and date filters.

### Modified Capabilities
- `schedule-view`: Updated layout requirements to support the consolidated dashboard and toolbar architecture.

## Impact

- **Frontend Components**: `ScheduleView.tsx`, `ScheduleTimeline.tsx`, `ScheduleSummary.tsx`, `ScheduleItemList.tsx`.
- **UX**: Improved visual hierarchy, reduced "scatter", and better space utilization on both desktop and mobile.
