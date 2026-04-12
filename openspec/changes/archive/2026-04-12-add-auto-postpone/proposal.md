## Why

Users with large backlogs of overdue items need a way to systematically reduce their daily review load. The current postpone feature is limited to manually shifting individual learning items by a fixed number of days, with no algorithm awareness. SuperMemo 20's postpone system provides an intelligent, priority-weighted mechanism that considers item stability, difficulty, and retrievability when postponing — better-preserving learning outcomes than naive date shifting.

## What Changes

- Add an **algorithm-aware postpone engine** (TypeScript, mirroring the SM-20 postpone algorithm) that computes interval increases based on priority, stability, difficulty, elapsed days, and repetition count
- Replace the current naive `postponeItem` (just adds N days to due_date) with the new algorithm-aware version
- Add **postpone-all / auto-postpone** capability — postpone all eligible items in the queue at once, with eligibility gates (priority threshold, stability threshold, min elapsed days, min repetitions)
- Add **configurable postpone settings** in the learning settings panel (enable/disable auto-postpone, priority/stability thresholds, min/max interval increase, randomization toggle)
- Add postpone support for **documents** (not just learning items) — documents use the topic path in the algorithm
- Add **i18n keys** across all 6 locales for the new postpone UI and settings
- Track postpone **statistics** (total items postponed, total interval increase) for display to the user

## Capabilities

### New Capabilities

- `postpone-engine`: Core postpone algorithm — computing priority-weighted interval increases, eligibility checks, simple vs. standard postpone modes, and interval randomization
- `postpone-settings`: User-configurable postpone parameters — thresholds, min/max increases, randomization, auto-postpone toggle — stored in the existing settings store
- `postpone-ui`: UI for manual postpone (single item context menu, postpone-all button), auto-postpone prompt, and postpone statistics display

### Modified Capabilities

## Impact

- **Algorithm layer** (`src/lib/sm20.ts` or new `src/lib/postpone.ts`): New postpone computation functions
- **API layer** (`src/api/queue.ts`, `src-tauri/src/commands/queue_bulk.rs`): Updated postpone command to accept algorithm-aware parameters
- **Store layer** (`src/stores/queueStore.ts`, `src/stores/settingsStore.ts`): Postpone-all action, new settings fields
- **Component layer** (`src/components/queue/QueueContextMenu.tsx`, queue routes): Updated context menu, new postpone-all button
- **Settings UI**: New postpone section in learning settings
- **i18n** (`src/lib/i18n/locales/*.ts`): New keys for postpone UI and settings in all 6 locales
- **Types** (`src/types/document.ts`): Any new types needed for postpone configuration
