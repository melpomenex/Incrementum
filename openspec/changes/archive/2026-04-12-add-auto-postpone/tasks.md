## 1. Postpone Engine (TypeScript)

- [x] 1.1 Create `src/lib/postpone.ts` with `PostponeConfig`, `PostponeResult`, and `PostponeStats` types matching the algorithm spec
- [x] 1.2 Implement `computePriority(item)` — derive priority 0–100 from stability and difficulty
- [x] 1.3 Implement `postponeElement(item, config)` — standard postpone with eligibility gates, ratio computation, priority weighting, and min/max clamping for items
- [x] 1.4 Implement topic/document path in `postponeElement` — use topic parameters and topic eligibility gates for documents
- [x] 1.5 Implement `simplePostpone(item, config)` — linear interpolation by priority without eligibility checks
- [x] 1.6 Implement `randomizeInterval(base, maxNoise)` — SM-20 noise distribution with sqrt decay, sign flip, and clamping
- [x] 1.7 Implement `postponeAll(items, config)` — batch postpone iterating all items, collecting stats (count, total increase, skipped), with item/topic dispatch
- [x] 1.8 Add unit tests for the postpone engine in `src/lib/__tests__/postpone.test.ts` — cover all scenarios from the spec (high/low priority, eligibility gates, simple mode, randomization, edge cases)

## 2. Settings Integration

- [x] 2.1 Define `PostponeSettings` interface in `src/stores/settingsStore.ts` with all fields: item/topic increase params, eligibility thresholds, randomize, autoPostponeEnabled, simpleMode, and defaults
- [x] 2.2 Add `postpone: PostponeSettings` field to `LearningSettings` interface
- [x] 2.3 Add `postpone` with defaults to `defaultSettings.learning` object
- [x] 2.4 Add settings migration logic if needed for existing users (handle missing `postpone` field in persisted settings)

## 3. Queue Store Updates

- [x] 3.1 Add `postponeItemAlgorithmAware(id)` action to `queueStore` — compute new interval via postpone engine, then call existing `postponeItem` API with computed days
- [x] 3.2 Add `postponeAll()` action to `queueStore` — filter eligible items, call `postponeAll` from engine, persist each result, reload queue, return stats
- [x] 3.3 Add `getAutoPostponePrompt()` derived state — check if auto-postpone is enabled and if there are overdue items in the queue

## 4. API Layer

- [x] 4.1 Add `postponeItem(id, days)` wrapper in `src/api/queue.ts` if not already present (verify existing)
- [x] 4.2 Verify `postponeItem` Tauri command in `src-tauri/src/commands/queue_bulk.rs` works correctly with the computed days value

## 5. UI: Single-Item Postpone

- [x] 5.1 Update `QueueContextMenu.tsx` — replace fixed-day postpone options with algorithm-aware postpone that shows computed result in a confirmation dialog
- [x] 5.2 Add confirmation dialog component showing computed interval increase and new interval
- [x] 5.3 Handle document type items in context menu (use topic path)

## 6. UI: Postpone-All

- [x] 6.1 Add "Postpone All" button to the queue toolbar (with icon, visible only when queue has items)
- [x] 6.2 Add confirmation dialog for postpone-all showing count of items to be postponed and count to be skipped
- [x] 6.3 Add summary display after postpone-all completes (items postponed, average increase, items skipped)
- [x] 6.4 Disable "Postpone All" button when queue is empty or no items are eligible

## 7. UI: Auto-Postpone Prompt

- [x] 7.1 Create auto-postpone prompt component — shown on queue load when autoPostponeEnabled and overdue items exist
- [x] 7.2 Wire auto-postpone prompt into the queue page/route — trigger on queue mount if conditions are met
- [x] 7.3 Handle "Postpone" and "Review Now" button actions in the prompt

## 8. UI: Postpone Settings Panel

- [x] 8.1 Create "Postpone" settings section in the learning settings page
- [x] 8.2 Add toggle controls for: auto-postpone, simple mode, randomization
- [x] 8.3 Add number inputs for: item/topic increase percentages, min/max increases, eligibility thresholds, floor/cap values
- [x] 8.4 Add validation (e.g., min must be <= max) and tooltips explaining each parameter
- [x] 8.5 Wire settings controls to `settingsStore.updateSettings()`

## 9. i18n

- [x] 9.1 Add all new English i18n keys to `src/lib/i18n/locales/en.ts` — postpone menu items, dialog text, settings labels, tooltips, summary messages
- [x] 9.2 Add translations to `zh.ts`, `es.ts`, `de.ts`, `fr.ts`, `ja.ts` for all new keys

## 10. Testing & Polish

- [ ] 10.1 End-to-end manual test: single item postpone from context menu, verify interval changes correctly
- [ ] 10.2 End-to-end manual test: postpone-all with mixed eligible/ineligible items, verify stats display
- [ ] 10.3 End-to-end manual test: auto-postpone prompt appears/disappears based on settings and overdue state
- [ ] 10.4 End-to-end manual test: postpone settings persist across app reload
