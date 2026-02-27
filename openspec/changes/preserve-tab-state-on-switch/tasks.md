## 1. Tab Snapshot Foundation

- [x] 1.1 Define a versioned tab snapshot model keyed by primary tab ID (view key + minimal context identifiers).
- [x] 1.2 Add a centralized tab-state store/service to save and retrieve per-tab snapshots for the active session.
- [x] 1.3 Add shared validation and fallback helpers that resolve invalid snapshots to valid tab entry points.

## 2. Capture and Restore Integration

- [x] 2.1 Wire tab deactivation hooks to capture the current tab snapshot before switching away.
- [x] 2.2 Add transition-level snapshot updates for deep in-tab navigation changes (review state, nested settings routes, etc.).
- [x] 2.3 Implement tab-specific restore handlers that replay saved state when a tab is reselected.
- [x] 2.4 Ensure restore handlers use validation/fallback logic when referenced state is unavailable.

## 3. High-Impact Flow Rollout

- [x] 3.1 Implement and verify exact restore for active Review flows so returning users do not need to press Start Review again.
- [x] 3.2 Implement and verify exact restore for nested Settings menus/subpages.
- [x] 3.3 Roll out restore support for remaining primary tabs to guarantee independent per-tab context restoration.

## 4. Verification and Guardrails

- [x] 4.1 Add integration tests covering review resume, nested settings resume, and alternating between multiple tabs with independent state.
- [x] 4.2 Add regression tests for invalid snapshot targets to confirm safe fallback behavior and no crashes.
- [ ] 4.3 Run manual QA pass across all primary tabs for repeated switch-away/switch-back behavior and document results.
