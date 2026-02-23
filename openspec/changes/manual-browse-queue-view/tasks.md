## 1. Queue Browse State Model

- [ ] 1.1 Identify Queue View components/store hooks that currently own selection, focus, and queue item list state.
- [ ] 1.2 Implement a unified manual-browse selection state (active item id/index) shared by pointer and keyboard interactions.
- [ ] 1.3 Add reconciliation logic for queue refresh/reorder to preserve selected item by id and clamp fallback by index when needed.

## 2. Queue View UI and Interaction Wiring

- [ ] 2.1 Update Queue View row rendering to show deterministic selected/focused styling using existing UI tokens/components.
- [ ] 2.2 Wire pointer-based selection so clicking/tapping a row updates the active browse selection and clears previous selection.
- [ ] 2.3 Add keyboard browse handlers in Queue View focus scope to move selection within valid bounds.
- [ ] 2.4 Implement empty/loading visual states that clearly represent no-selection behavior and match current app UX/UI conventions.

## 3. Selected Item Activation

- [ ] 3.1 Connect selected-item activation (e.g., Enter/click action) to the existing queue open/play pathway.
- [ ] 3.2 Ensure activation always targets the current manual browse selection and preserves return context to Queue View.

## 4. Robustness and Edge Cases

- [ ] 4.1 Prevent out-of-bounds navigation and verify first/last item behavior is stable under repeated input.
- [ ] 4.2 Handle live queue mutations (item removal/addition/reorder) without throwing errors or leaving invalid selection.
- [ ] 4.3 Validate interaction behavior for both desktop and mobile form factors where Queue View is supported.

## 5. Verification and Regression Coverage

- [ ] 5.1 Add/extend unit tests for selection reducer/helpers and queue update reconciliation behavior.
- [ ] 5.2 Add/extend UI/integration tests for pointer selection, keyboard navigation, bounds handling, activation, and empty queue state.
- [ ] 5.3 Run targeted regression checks to confirm unrelated queue ranking, data fetching, and playback flows are unchanged.
