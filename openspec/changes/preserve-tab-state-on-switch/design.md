## Context

The app uses tab-based navigation where each tab can contain deep view state (for example, an active review flow or nested settings pages). Current behavior reinitializes some tab roots when users leave and return, causing lost in-progress context and repeated entry actions. The change must preserve per-tab state consistently while avoiding stale/invalid restores after app updates or data removal.

## Goals / Non-Goals

**Goals:**
- Preserve and restore each tab's exact in-session navigation/view state when switching tabs.
- Support deep states, including active in-progress flows and nested subviews.
- Define deterministic fallback when the saved target is no longer valid.
- Keep restoration behavior consistent across all primary tabs.

**Non-Goals:**
- Persist tab state across app reinstalls or long-term account/device sync.
- Redesign tab UX, navigation hierarchy, or review logic itself.
- Introduce analytics or telemetry changes beyond existing instrumentation.

## Decisions

1. Represent each tab's restore state as a serializable tab snapshot keyed by tab ID.
- Rationale: A normalized, serializable object can be stored centrally and restored uniformly.
- Alternative considered: Keep state only inside each tab component. Rejected because unmount/remount paths already lose local state and lead to inconsistent behavior.

2. Capture snapshot on tab deactivation and on key internal navigation transitions.
- Rationale: Deactivation capture guarantees cross-tab return fidelity; transition capture reduces loss if the app re-renders unexpectedly before deactivation.
- Alternative considered: Capture only on explicit user exits. Rejected because users often leave flows via tab switch, not explicit exits.

3. Restore by replaying route/view state through tab-specific restore handlers.
- Rationale: Handler-based restoration allows each tab to validate IDs/paths and map old state to current UI safely.
- Alternative considered: Generic route string push for all tabs. Rejected because complex tabs require structured validation and context hydration.

4. Add versioned snapshot schema with validity checks and fallback policy.
- Rationale: Schema versioning prevents crashes from stale snapshots and supports incremental evolution.
- Alternative considered: Unversioned ad hoc object. Rejected due to migration fragility and difficult debugging.

## Risks / Trade-offs

- [Risk] Snapshot payloads grow as tabs add state -> Mitigation: Keep snapshots minimal (view identity + required context IDs), avoid caching large data blobs.
- [Risk] Restoring removed entities (deleted deck/card/settings route) causes dead-end navigation -> Mitigation: Validate targets before restore and fallback to nearest valid tab root/subroot.
- [Risk] Behavior divergence across tabs due to custom handlers -> Mitigation: Define a shared restore contract and add cross-tab integration tests.
- [Risk] Extra state writes on navigation transitions -> Mitigation: Batch/coalesce writes and store in memory for session scope unless explicit persistence is required.

## Migration Plan

1. Introduce shared tab snapshot model and central tab-state store.
2. Implement per-tab capture + restore handlers behind a feature flag.
3. Enable for one high-impact flow (review) and verify no regression.
4. Roll out to remaining tabs and nested settings/menu flows.
5. Remove feature flag once cross-tab tests pass and manual QA signs off.

Rollback: Disable feature flag to return to existing tab initialization behavior.

## Open Questions

- Should tab snapshots survive full app restart, or only in-session tab switches for this phase?
- Which nested settings subviews require strict exact restore versus nearest-section restore?
- Do any tabs depend on transient runtime objects that need custom rehydration hooks?
