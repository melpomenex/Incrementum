## Why

When a user clicks a dashboard quick-action button (e.g., "Settings") and the target tab already exists, nothing happens. The `openTab` function in `DashboardTab.tsx` detects the existing tab and returns early without activating it. Users expect clicking a navigation button to always navigate them to the target, even if the tab is already open.

## What Changes

- Remove the early-return guard in `DashboardTab.tsx`'s `openTab` and `openSyncSettings` functions, allowing the existing `addTab` store method to handle re-activation correctly
- The store's `addTab` already finds existing tabs and sets them as active in their pane — the dashboard just needs to stop short-circuiting before calling it

## Capabilities

### New Capabilities

_None — this is a bug fix with no new capabilities._

### Modified Capabilities

_None — no spec-level requirement changes, just correcting existing behavior._

## Impact

- `src/components/tabs/DashboardTab.tsx` — the only file that needs to change
- No API or dependency changes
- No risk to existing tab state management — the `addTab` store method already handles the re-activation path correctly
