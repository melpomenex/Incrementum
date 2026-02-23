## Context

Queue View currently emphasizes passive list display and quick navigation into content, but it does not define an explicit manual browse interaction model that is predictable across pointer and keyboard input. The app already has established UX/UI conventions for selected/focused states and content activation that this feature should reuse. The change must fit existing queue data and playback/open flows without introducing new backend contracts.

## Goals / Non-Goals

**Goals:**
- Define a consistent manual browsing interaction in Queue View for pointer and keyboard users.
- Keep selection/focus state explicit and visually aligned with existing app UX/UI patterns.
- Preserve browsing context when users enter and return from item detail/playback flows.
- Keep implementation scoped to frontend behavior and existing queue data contracts.

**Non-Goals:**
- Rework queue ranking/sorting logic.
- Introduce new backend APIs or queue schema changes.
- Redesign unrelated tabs or global navigation patterns.

## Decisions

1. Introduce an explicit "browse mode" interaction in Queue View
- Decision: Queue View maintains an active selection index/item for manual browsing.
- Rationale: Makes navigation predictable and testable, avoiding ambiguous hover-only behavior.
- Alternative considered: Rely only on hover/click with no persistent selection. Rejected because keyboard and context restoration become inconsistent.

2. Use unified interaction mapping for pointer and keyboard
- Decision: Pointer selection and keyboard navigation update the same underlying selection state.
- Rationale: Single state model reduces drift between input methods and simplifies accessibility and tests.
- Alternative considered: Separate pointer and keyboard state. Rejected due to complexity and inconsistent highlight behavior.

3. Reuse existing activation pathway for selected queue item
- Decision: Activating selected item (click/Enter) calls existing open/play flow rather than new route logic.
- Rationale: Minimizes risk and maintains current analytics/side-effects.
- Alternative considered: New activation handler stack. Rejected as unnecessary for this UX-level change.

4. Handle edge states as first-class UX states
- Decision: Specify empty/loading/bounds behavior directly in requirements and UI states.
- Rationale: Prevents undefined behavior in real-world queue transitions.
- Alternative considered: Leave edge behavior implicit. Rejected due to regression risk.

## Risks / Trade-offs

- [Risk] Selection state desynchronizes when queue data refreshes/reorders.
  → Mitigation: Reconcile selection by stable item id when possible; clamp index when list shrinks.

- [Risk] Keyboard shortcut conflicts with existing app/global shortcuts.
  → Mitigation: Scope browse keyboard handlers to Queue View focus context and use existing keybinding conventions.

- [Risk] Visual selection treatment diverges from existing UI language.
  → Mitigation: Reuse shared styling tokens/components for selected/focused row states.

- [Trade-off] Added UI state logic slightly increases Queue View complexity.
  → Mitigation: Keep selection reducer/helpers isolated and covered by targeted tests.

## Migration Plan

- Implement behind existing Queue View surface without feature flags unless QA identifies rollout risk.
- Validate pointer and keyboard browse flows in desktop and mobile form factors.
- Rollback path: revert Queue View interaction changes while retaining existing queue rendering.

## Open Questions

- Should manual browsing include page-jump behavior (e.g., Home/End, PageUp/PageDown) in first iteration?
- Should selection persist across app restart, or only within current session/navigation context?
