## Context

The PDF viewer currently applies programmatic scroll restoration while content is still being laid out and virtualized. This competes with user-driven scroll input and can force viewport jumps. TOC navigation appears to trigger multiple destination/position updates during page load, causing visible load/unload churn and unstable final position.

## Goals / Non-Goals

**Goals:**
- Stabilize viewport behavior so user scroll input remains authoritative after direct interaction.
- Make TOC navigation deterministic by resolving a destination once and converging to that destination without extra jumps.
- Prevent virtualization and late render updates from overriding an already-stable viewport.
- Define measurable acceptance criteria for scroll and TOC stability.

**Non-Goals:**
- Redesigning the PDF UI/controls or TOC presentation.
- Changing PDF parsing engines or introducing a new document format pipeline.
- Tuning unrelated performance areas outside navigation/viewport state handling.

## Decisions

1. Introduce a navigation state machine with explicit modes: `idle`, `user-scroll`, and `programmatic-nav`.
- Rationale: Centralizes ownership of scroll position and removes race conditions between user input and internal restoration logic.
- Alternative considered: keep existing event handlers and add debounce/throttle guards only. Rejected because it reduces frequency but does not remove conflicting write paths.

2. Add a scroll ownership lockout window after user input.
- Rationale: After wheel/touch/drag/keyboard scroll, programmatic viewport writes are suppressed unless they are tied to an explicit user-triggered TOC navigation still in progress.
- Alternative considered: always allow programmatic writes and prefer latest timestamp. Rejected because render churn can still win over user intent.

3. Make TOC navigation a single-flight action keyed by navigation token.
- Rationale: Each TOC click creates one active navigation token; only events tied to the active token may update viewport. Late events from previous tokens are ignored.
- Alternative considered: cancel in-flight rendering. Rejected due to higher implementation risk in rendering pipeline; token gating is lower-risk and sufficient.

4. Anchor destination using page+offset and settle criteria.
- Rationale: Navigation completes only after destination page is rendered and viewport is within threshold of target offset for a short stable interval.
- Alternative considered: mark complete immediately after first scrollTo call. Rejected due to frequent post-render corrections that cause jumps.

## Risks / Trade-offs

- [Additional state complexity] -> Mitigation: keep a small explicit state machine with invariant checks and debug logging behind a flag.
- [Edge cases for very large PDFs] -> Mitigation: add integration tests with virtualization-heavy docs and stress scrolling.
- [Possible delay before final settle on TOC jump] -> Mitigation: bounded settle timeout with graceful fallback to nearest stable position.

## Migration Plan

1. Implement behind an internal feature flag for PDF navigation stability.
2. Add unit and integration coverage for scroll ownership and TOC single-flight behavior.
3. Enable by default after validation on representative PDFs.
4. Rollback strategy: disable feature flag to revert to legacy behavior if regressions are found.

## Open Questions

- Should keyboard page navigation be treated as `user-scroll` ownership or explicit programmatic navigation mode?
- What settle threshold (pixels/time window) produces best stability across zoom levels?
