## Context

The dashboard (`DashboardTab.tsx`) has quick-action buttons (Settings, Review, etc.) that open tabs. The `openTab` and `openSyncSettings` functions check whether a tab of the target type already exists. If it does, they return early without activating it. The `addTab` store method in `tabsStore.ts` already handles this case correctly — it finds existing tabs, locates their pane, and sets them as active. The dashboard just bypasses this logic with its early-return guard.

## Goals / Non-Goals

**Goals:**
- Clicking a dashboard quick-action button always navigates the user to the target tab, regardless of whether it's already open
- Use the existing `addTab` store logic (which already handles re-activation) rather than duplicating it

**Non-Goals:**
- Changing the tab bar click behavior (that already works)
- Adding animations or visual feedback for re-navigation
- Modifying the store's `addTab` method

## Decisions

**Remove the early-return guard in `openTab` and `openSyncSettings`, delegating to the store's `addTab`.**
The store's `addTab` (tabsStore.ts lines 309-324) already checks for an existing tab by type and, if found, updates the pane's `activeTabId` to make it visible. The simplest fix is to let this existing logic handle all cases by removing the redundant `tabs.find()` check in the dashboard. This avoids duplicating the pane-finding and activation logic.

Alternative considered: calling `setActiveTab` directly from the dashboard when the tab exists. Rejected because it would require the dashboard to know the pane ID (which requires `findPaneContainingTabRecursive`), duplicating logic the store already provides.

## Risks / Trade-offs

- [Calling `addTab` for an existing tab triggers `saveTabs()` on every click] → This is harmless — the store already does this on every tab switch via `setActiveTab`. No extra I/O burden.
- [Removing the guard means the full `addTab` flow runs even for existing tabs] → This is a trivial cost (one array find + one tree traversal). No performance concern.
