## Why

Switching tabs currently resets users to top-level entry points in some flows, which breaks continuity and forces repeated actions (for example, restarting review). Preserving exact in-progress state across tab switches is needed so navigation feels reliable and uninterrupted.

## What Changes

- Preserve each tab's current navigation/view state when the user switches away and returns.
- Restore in-progress contexts instead of defaulting to tab home screens (for example, active review session, nested settings menus, and other deep views).
- Ensure restoration behavior applies consistently across all primary tabs and their nested subviews.
- Define expected behavior for unavailable/invalid restoration targets (fallback to nearest valid view without crashing).

## Capabilities

### New Capabilities
- `tab-state-preservation`: Preserve and restore exact per-tab UI/navigation state across tab switches.

### Modified Capabilities
- None.

## Impact

- Affected UI navigation/state management for tab containers and tab-root views.
- Affected tab-level view models/stores that currently reinitialize on tab re-entry.
- Potentially affected persistence/serialization utilities for storing and restoring route/view context.
