## Context

Incrementum already has partial LaTeX rendering support in markdown-driven surfaces, but imported Anki flashcards still fail for several real-world syntaxes and edge cases. The current path from APKG import to review rendering is split across parsing, normalization, storage, and UI rendering layers, and inconsistent assumptions across those layers cause compatibility gaps.

Primary constraint: imported card content must remain reviewable even when expressions are malformed or renderer-incompatible. Secondary constraints are rendering safety (no script execution), predictable performance in review sessions, and consistency between desktop and mobile review surfaces.

## Goals / Non-Goals

**Goals:**
- Ensure LaTeX syntax seen in Anki flashcards is preserved and rendered consistently in Incrementum review surfaces.
- Standardize a single normalization contract between APKG import and renderer components.
- Define deterministic fallback behavior for malformed or unsupported LaTeX so cards never become unreadable.
- Add compatibility fixtures and automated tests to prevent regressions.

**Non-Goals:**
- Achieving byte-for-byte rendering parity with every Anki add-on.
- Adding a full TeX distribution or arbitrary package execution.
- Reworking non-flashcard markdown rendering behavior outside this capability.

## Decisions

### 1. Add a dedicated Anki LaTeX normalization stage before rendering
- Decision: introduce a normalization stage in the flashcard content pipeline that detects Anki-relevant wrappers and delimiters and emits a canonical math token stream for rendering.
- Rationale: compatibility issues are primarily caused by inconsistent parsing assumptions between import and UI layers; canonicalization removes this ambiguity.
- Alternatives considered:
  - Parse only in the UI renderer: rejected because behavior diverges across surfaces and duplicates parsing logic.
  - Rewrite imported card text destructively into markdown-only delimiters: rejected because it loses source fidelity and complicates debugging.

### 2. Preserve original flashcard source while storing normalized render metadata
- Decision: keep original imported content unchanged and store normalization output as derived metadata used by renderers.
- Rationale: preserving source supports re-processing when parser rules evolve and avoids migration risk from destructive transforms.
- Alternatives considered:
  - Persist only transformed content: rejected due to irreversible conversion and upgrade fragility.

### 3. Use existing safe math renderer with strict failure fallback
- Decision: route normalized math expressions through the existing safe renderer path; on failure, display source math text with explicit non-fatal fallback styling/telemetry marker.
- Rationale: prevents blank cards or hard failures during review while maintaining observability.
- Alternatives considered:
  - Throw rendering errors: rejected because it interrupts study flow.
  - Silently drop bad expressions: rejected because it hides data loss.

### 4. Validate compatibility via fixture-driven regression tests
- Decision: add representative APKG/HTML fixture cases for common Anki syntaxes and malformed inputs, with expected normalized tokens and rendered output snapshots.
- Rationale: broad LaTeX surface area is best protected by curated corpus tests, not only unit-level parser checks.
- Alternatives considered:
  - Rely on manual QA only: rejected as too brittle and incomplete.

## Risks / Trade-offs

- [Parser over-matching non-math text] -> Mitigation: delimiter-aware tokenization with escaping rules and negative cases in fixtures.
- [Performance overhead from normalization at render time] -> Mitigation: normalize at import/update time where possible and memoize render tokens.
- [Renderer incompatibility for rare TeX commands] -> Mitigation: guaranteed fallback to source text plus telemetry counters to prioritize follow-up support.
- [Cross-surface behavior drift] -> Mitigation: shared normalization contract and integration tests spanning all review surfaces.

## Migration Plan

1. Introduce normalization module behind a feature flag and run it for newly imported decks.
2. Backfill normalization metadata for existing cards on-demand (first review/open) to avoid blocking migrations.
3. Enable fixture-based compatibility tests in CI and require passing before rollout.
4. Enable by default after validation; keep a rollback switch that disables normalization metadata consumption and falls back to current behavior.

## Open Questions

- Should unsupported TeX commands be surfaced with user-visible warnings or only internal telemetry?
- Which exact Anki wrapper variants from legacy decks must be mandatory in v1 vs best-effort?
- Do we need a one-time background backfill for very large libraries, or is lazy migration sufficient?
