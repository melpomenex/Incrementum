## 1. Data Model & Schema Migration

- [x] 1.1 Add `prerequisites` (TEXT NOT NULL DEFAULT '[]') and `maturity_threshold` (REAL NOT NULL DEFAULT 0.8) columns to tags table via SQLite migration
- [x] 1.2 Extend Rust Tag model with `prerequisites: Vec<String>`, `maturity_threshold: f64`, and `stability_stats: TagStabilityStats` fields
- [x] 1.3 Define `TASConfig` Rust struct and `TASSlice` TypeScript interface with defaults (enabled: false, interference enabled, prerequisites enabled, minSeparationHours: 4, coherenceThreshold: 0.75, maturityRatio: 0.7)
- [x] 1.4 Add ephemeral fields `interferenceDelayUntil` and `prerequisiteBlocked` to frontend Item/ScheduledItem types (not persisted)

## 2. Rust: Maturity Computation

- [x] 2.1 Implement `compute_maturity` helper: item is mature when SM-20/FSRS stability >= tag's `maturity_threshold`
- [x] 2.2 Implement `recompute_tag_stability_stats` function that iterates a tag's items and updates `itemCount`, `avgStability`, `matureCount`
- [x] 2.3 Hook maturity recomputation into the review completion path (call after each item review updates stability)
- [x] 2.4 Handle manual reschedule edge case: recompute stats when an item's stability is changed outside review flow

## 3. Rust: Prerequisite Gating & Commands

- [x] 3.1 Implement `detect_circular_prerequisite(tag_id, proposed_prereqs)` with DFS cycle detection
- [x] 3.2 Implement `set_tag_prerequisites` Tauri command: validate no cycle, update tag, persist to SQLite
- [x] 3.3 Implement `get_tag_maturity_stats` Tauri command: return itemCount, avgStability, matureCount, maturity ratio
- [x] 3.4 Implement prerequisite gating algorithm: for each due item, check all tag prerequisites against `maturityRatio`; set `prerequisiteBlocked`

## 4. Rust: Interference Jitter & Queue Assembly

- [x] 4.1 Implement interference jitter: for each unblocked due item (sorted by due time), check against last 10 scheduled items for shared tags exceeding `coherenceThreshold`; set `interferenceDelayUntil`
- [x] 4.2 Implement queue assembly: filter eligible items (not blocked, delay elapsed), sort by priority → due time → stability ascending
- [x] 4.3 Implement `build_tas_queue` Tauri command: orchestrate gating → jitter → assembly, return annotated queue
- [x] 4.4 Handle tag deletion: remove deleted tag ID from all other tags' `prerequisites` arrays

## 5. Frontend: TAS State Management

- [x] 5.1 Create `tasSlice.ts` Zustand store with config, todayQueue, blockedItems, and actions (buildQueue, setPrerequisites, updateConfig)
- [x] 5.2 Wire TAS config persistence into existing settings store so config survives app restart
- [x] 5.3 Connect `build_tas_queue` invocation to queue view initialization (call on session start)

## 6. Frontend: Tag Prerequisite Editor

- [x] 6.1 Build prerequisite multi-select component in tag management view (list all tags excluding current, show currently selected)
- [x] 6.2 Build directed dependency graph visualization using existing graph renderer with prerequisite-only filter
- [x] 6.3 Build per-tag maturity progress bar (matureCount / itemCount with percentage label; "N/A" for empty tags)
- [x] 6.4 Display circular dependency error feedback inline when save is rejected

## 7. Frontend: Queue UI Indicators

- [x] 7.1 Build prerequisite-blocked badge: "Waiting on `<tag>` maturity (XX%)" on sidebar items
- [x] 7.2 Build interference-delayed badge: "Delayed Xh to avoid interference with `<tag>`"
- [x] 7.3 Implement "Force show" button on blocked/delayed items that adds item to eligible queue for current session
- [x] 7.4 Add "TAS Active" indicator in queue header when TAS is enabled

## 8. Frontend: TAS Settings Panel

- [x] 8.1 Build TAS settings panel with master on/off toggle, interference subsystem toggle, prerequisites subsystem toggle
- [x] 8.2 Build sliders for minSeparationHours (0–24), coherenceThreshold (0.5–1.0), maturityRatio (0.5–1.0)
- [x] 8.3 Wire all settings to tasSlice and persist on change

## 9. Testing & Polish

- [x] 9.1 Add Rust unit tests for prerequisite gating (blocked, unblocked, multi-tag, no-tag, multiple prerequisites)
- [x] 9.2 Add Rust unit tests for interference jitter (high coherence delayed, low coherence ignored, window limit)
- [x] 9.3 Add Rust unit tests for circular dependency detection (simple cycle, self-reference, transitive cycle, valid graph)
- [x] 9.4 Manual smoke test on macOS: full TAS flow (configure prerequisites, build queue, verify blocking/delay badges, force show, complete review, verify maturity update)
