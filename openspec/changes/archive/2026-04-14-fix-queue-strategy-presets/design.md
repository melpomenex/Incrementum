## Context

The Queue view offers five strategy presets ("Maximize Retention", "Minimize Daily Time", "Aggressive Catch-Up", "Exploratory Learning", "Project-Focused") that control the sort order of queue items via a weighted priority vector system in `src/utils/reviewUx.ts`. The presets have real mathematical logic and immediately re-sort items when changed, but several issues limit their effectiveness:

1. **Not persisted**: The preset is ephemeral React state (`useState`), resetting to `"maximize-retention"` on every navigation
2. **Weak `userIntent` proxy**: Uses tag count only — items with no tags all score identically regardless of user-set priority ratings
3. **Dead SmartQueue settings**: `smartQueue.mode` ("normal"/"filtered"/"intelligent") and `useFsrsScheduling` are stored in settings but never consumed by any queue logic
4. **No preset descriptions**: Users see dropdown labels but no explanation of what each strategy actually optimizes

The Rust backend `QueueSelector` is independent and already works correctly — this change is frontend-only.

## Goals / Non-Goals

**Goals:**
- Persist the selected preset so it survives navigation and app restarts
- Improve the `userIntent` dimension to incorporate the backend's `priority_rating` field, giving weight to items the user explicitly marked as important
- Remove the inert `smartQueue.mode` and `useFsrsScheduling` settings (and their UI) since they have no effect and would confuse users who expect them to work
- Add a description tooltip/line below the dropdown so users understand what each preset does

**Non-Goals:**
- Modifying the Rust backend scheduling algorithm — the backend `QueueSelector` and FSRS scheduling work independently
- Changing the preset weight values — the existing weights are reasonable starting points
- Adding new presets or dimensions
- Changing the backend `priority` field computation

## Decisions

### 1. Persist preset in settingsStore

**Decision**: Add a `queueStrategyPreset` field to the existing `settingsStore` with default `"maximize-retention"`.

**Rationale**: The settings store already handles persisted user preferences, has migration support, and is the natural home for this kind of preference. Using `queueStore` would mix ephemeral queue state with user preferences.

**Alternative considered**: localStorage — rejected because it's outside the existing settings system and wouldn't sync with the store's `getSetting`/`setSetting` API.

### 2. Improve `userIntent` to use `priority_rating`

**Decision**: Change the `userIntent` computation from tag-count-only to a blend of tag count and `priority_rating`:
- `userIntent = 0.6 * ratingScore + 0.4 * tagScore`
- `ratingScore`: mapped from the backend's `priority_rating` (1-5 scale → 0-90 score range). Items with no rating default to 50 (neutral).
- `tagScore`: existing formula (`40 + tags.length * 8`, capped at 90, default 35 for no tags)

**Rationale**: `priority_rating` is an explicit user signal that an item matters to them. Tag count is a weak proxy — an item with 5 random tags isn't necessarily more "intended" than an item the user rated 5/5 importance with no tags. A 60/40 blend keeps tags as a secondary signal without losing them.

**Alternative considered**: Replace tag count entirely — rejected because tags do carry project/context intent, especially for the "Project-Focused" preset.

### 3. Remove dead SmartQueue settings

**Decision**: Remove `smartQueue.mode` from the settings type, store, and UI. Remove `useFsrsScheduling` from the settings type, store, and UI. Remove the entire `SmartQueuesSettings` component. Keep `autoRefresh` and `refreshInterval` since they are functional.

**Rationale**: These settings give users a false sense of control. A user who toggles "FSRS Scheduling" expects something to change — but nothing does. This is worse than not having the option. If these are wanted in the future, they can be re-added with actual implementations.

**Alternative considered**: Wire them up to real behavior — rejected because it's unclear what "normal"/"filtered"/"intelligent" modes should do, and FSRS scheduling is already always active on the backend. Designing and implementing these modes is a separate feature.

### 4. Add preset description below dropdown

**Decision**: Show a one-line description below the preset dropdown that changes when the selection changes. Use existing i18n keys (`queuePreset.<name>Desc`).

**Rationale**: A tooltip requires hover, which doesn't work on mobile/touch. A static description line below the dropdown is visible on all platforms and immediately tells the user what the current strategy does.

## Risks / Trade-offs

- **Removing settings is a user-visible change**: Users who toggled these settings will lose them. Mitigation: This is a cleanup of non-functional UI, so no behavior is lost. The settings only existed visually.
- **`priority_rating` may not be set on all items**: Many items may default to the neutral score of 50, making the blend less differentiating. Mitigation: 50 is intentionally neutral — it doesn't penalize unrated items, it just doesn't boost them. Items with explicit ratings will stand out.
- **Preset persistence means behavior changes across sessions**: A user who selects "Aggressive Catch-Up" will see that behavior every time they open the queue until they change it. This is the intended behavior, but may surprise users who expected the reset. Mitigation: The current default ("Maximize Retention") is the most common preference.
