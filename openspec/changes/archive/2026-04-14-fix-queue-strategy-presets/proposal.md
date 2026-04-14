## Why

The Queue view's strategy dropdown ("Maximize Retention", "Minimize Daily Time", "Aggressive Catch-Up", "Exploratory Learning", "Project-Focused") has real mathematical logic behind it, but several design flaws and dead code make the presets less effective and harder to trust than they should be. The presets are not persisted across navigation, some priority dimensions use weak proxies (e.g., tag count for "user intent"), and the SmartQueue settings in the Settings page (`mode`, `useFsrsScheduling`) are completely inert — stored but never read by any logic.

## What Changes

- **Persist the selected preset** in `queueStore` (or `settingsStore`) so it survives page navigation and app restarts
- **Improve the `userIntent` priority dimension** to use actual user signals (priority_rating, project membership, manual pinning) instead of just tag count
- **Remove or wire up the inert `smartQueue.mode` and `smartQueue.useFsrsScheduling` settings** — either give them real behavior or remove them from the UI
- **Surface preset effects to the user** — show a brief description when hovering/selecting a preset so users understand what each strategy actually does
- **Add visual feedback** when changing presets (e.g., subtle reorder animation) so the user can see the effect immediately

## Capabilities

### New Capabilities
- `queue-strategy-persistence`: Persisting and restoring the selected queue strategy preset across sessions and navigation
- `priority-vector-improvements`: Improving the priority vector dimensions to use stronger signals instead of weak proxies
- `smart-queue-cleanup`: Either removing dead SmartQueue settings or wiring them to real behavior

### Modified Capabilities
<!-- No existing spec requirements change — these are all new or internal improvements -->

## Impact

- **Frontend**: `src/utils/reviewUx.ts` (priority vector computation, preset definitions), `src/components/review/ReviewQueueView.tsx` (preset state management, UI), `src/components/settings/SmartQueuesSettings.tsx` (dead settings)
- **State management**: `queueStore` or `settingsStore` for preset persistence
- **Backend**: No changes required — the Rust backend `QueueSelector` is independent and already works correctly
- **i18n**: New locale strings for preset descriptions
- **User data**: No schema changes — only adding a persisted preference
