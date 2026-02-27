## Context

The app already uses a command palette to locate and open documents, including keyboard navigation and selection behavior users rely on. The requested change extends that model so users can also jump to app sections (for example, Settings) without introducing a second navigation interaction.

Constraints:
- Existing document-opening behavior must remain unchanged.
- Section navigation must fit current palette keyboard controls and result rendering.
- Route/section identifiers must map cleanly to existing app navigation targets.

## Goals / Non-Goals

**Goals:**
- Add app section entries to command palette search results.
- Preserve and reuse current arrow-key and Enter selection behavior for all result types.
- Open selected section targets through existing app navigation mechanisms.
- Keep document result behavior and quality intact.

**Non-Goals:**
- Rebuilding palette architecture or replacing the existing search implementation.
- Introducing fuzzy-search libraries or new backend APIs.
- Changing the Information Architecture of app sections.

## Decisions

1. Represent palette results as typed entries (`document` and `section`) under one unified result list.
Rationale: A single list preserves current keyboard and highlighting logic while minimizing branching in UI behavior.
Alternative considered: Render section results in a separate group with separate focus model. Rejected due to increased keyboard complexity and higher regression risk.

2. Add a static section registry as the source of searchable app destinations.
Rationale: App sections are finite and deterministic; a registry keeps labels, aliases, and navigation targets explicit and testable.
Alternative considered: Derive sections dynamically from route tree metadata. Rejected for now because route metadata consistency is uncertain and would add coupling.

3. Route selection handling by result type in one activation path.
Rationale: Keeping one `onSelect` path with type-based dispatch reuses existing document flow and makes section opening behavior symmetric.
Alternative considered: Separate handlers at UI event level. Rejected because it duplicates keyboard/selection conditions.

4. Keep ranking conservative: exact/prefix matches for section aliases, without displacing strong document matches unexpectedly.
Rationale: Users already depend on document retrieval; section support should augment, not dominate, document workflows.
Alternative considered: Always pin section matches above documents. Rejected because it can degrade current document-first behavior for common terms.

## Risks / Trade-offs

- [Mixed result ranking may feel inconsistent for ambiguous terms] -> Mitigation: define deterministic scoring rules and add tests for ambiguous queries like "settings" and partial document title overlaps.
- [Route target drift if section registry gets stale] -> Mitigation: centralize registry near navigation constants and add test coverage for section-to-route mapping.
- [Keyboard behavior regressions] -> Mitigation: add focused tests around arrow navigation and Enter activation across both result types.

## Migration Plan

1. Introduce section registry and typed result model behind current palette search.
2. Extend query result assembly to merge section and document candidates.
3. Update selection activation to dispatch by result type.
4. Add or update tests for search matching, keyboard navigation, and open action behavior.
5. Release with no data migration; rollback by disabling section entries while keeping current document behavior untouched.

## Open Questions

- Which app sections beyond Settings should be included in the initial registry?
- Should section aliases include abbreviations (for example, "prefs" for Settings) in v1?
