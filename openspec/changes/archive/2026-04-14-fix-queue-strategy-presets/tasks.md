## 1. Remove Inert SmartQueue Settings

- [x] 1.1 Remove `smartQueue.mode` field from `src/types/settings.ts` (the settings interface)
- [x] 1.2 Remove `smartQueue.mode` default from `src/config/defaultSettings.ts`
- [x] 1.3 Remove `smartQueue.mode` from `src/stores/settingsStore.ts` (type, default, and any references)
- [x] 1.4 Remove `useFsrsScheduling` from `src/types/settings.ts`, `src/config/defaultSettings.ts`, and `src/stores/settingsStore.ts`
- [x] 1.5 Remove queue mode selection UI and FSRS toggle/info panel from `src/components/settings/SmartQueuesSettings.tsx`, keeping only autoRefresh and refreshInterval controls
- [x] 1.6 Remove unused i18n keys for queue mode labels, descriptions, FSRS scheduling labels, and FSRS info panel text from locale files
- [x] 1.7 Verify the SmartQueuesSettings component still renders correctly with only autoRefresh/refreshInterval

## 2. Persist Queue Strategy Preset

- [x] 2.1 Add `queueStrategyPreset: PriorityPreset` field to settings type in `src/types/settings.ts` with default `"maximize-retention"`
- [x] 2.2 Add `queueStrategyPreset: "maximize-retention"` default in `src/config/defaultSettings.ts`
- [x] 2.3 Add `queueStrategyPreset` to the settings store type, default, and any migration paths in `src/stores/settingsStore.ts`
- [x] 2.4 Update `ReviewQueueView.tsx` to read the preset from `settingsStore.getSetting("queueStrategyPreset")` instead of `useState`
- [x] 2.5 Update the preset dropdown's `onChange` to persist the selection via `settingsStore.setSetting("queueStrategyPreset", value)`
- [x] 2.6 Verify preset persists across navigation and app restart

## 3. Improve userIntent Priority Dimension

- [x] 3.1 Check that `QueueItem` type in `src/types/queue.ts` includes `priority_rating` (or the field name used by the backend for user-set importance)
- [x] 3.2 Update `getPriorityVector()` in `src/utils/reviewUx.ts`: replace the tag-only `userIntent` formula with `0.6 * ratingScore + 0.4 * tagScore`, where `ratingScore` maps `priority_rating` (1-5 → 10-90, default 50 for null) and `tagScore` is the existing tag-count formula
- [x] 3.3 Verify that "Exploratory" and "Project-Focused" presets now more effectively surface high-rated items

## 4. Add Preset Description UI

- [x] 4.1 Add i18n description keys for each preset (e.g., `queuePreset.maximizeRetentionDesc`, `queuePreset.minimizeTimeDesc`, etc.) in all locale files
- [x] 4.2 Add a description line below the preset dropdown in `ReviewQueueView.tsx` that displays `t(queuePreset.${preset}Desc)` as muted text
