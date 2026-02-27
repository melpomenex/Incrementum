## 1. Navigation State Ownership

- [x] 1.1 Audit existing PDF scroll restoration, TOC click, and virtualization callbacks to identify all viewport write paths.
- [x] 1.2 Implement a navigation state machine (`idle`, `user-scroll`, `programmatic-nav`) with explicit transition rules and ownership checks.
- [x] 1.3 Add user-input lockout handling so non-essential programmatic repositioning is suppressed after direct scroll input.

## 2. Deterministic TOC Navigation

- [x] 2.1 Implement single-flight TOC navigation tokens so only the active TOC action can update viewport position.
- [x] 2.2 Gate destination updates to page+offset target resolution and ignore late events from superseded navigations.
- [x] 2.3 Add destination settle criteria (threshold + timeout) and mark navigation complete only after stability conditions are met.

## 3. Rendering Integration and Safety Controls

- [x] 3.1 Update page render/virtualization integration so mount/unmount events do not force snap-back while user scroll ownership is active.
- [x] 3.2 Add debug/invariant logging for state transitions and rejected stale navigation events.
- [x] 3.3 Add or wire an internal feature flag to enable controlled rollout and rollback of the new PDF navigation behavior.

## 4. Verification

- [x] 4.1 Add unit tests for state transitions, ownership lockout, and stale token rejection.
- [x] 4.2 Add integration tests for TOC navigation stability and post-navigation scrolling continuity on virtualized PDFs.
- [ ] 4.3 Validate behavior manually on representative PDFs (long docs, dense TOCs, varied zoom levels) and document pass/fail results.
