# Proposal: Exact command palette hit navigation

## Change ID
`add-exact-command-palette-hit-navigation`

## Summary
When a user opens the command palette and searches for a word or phrase, selecting a matching book, document, or transcript result should open that item at the exact matched location and visibly highlight the matched text or transcript segment.

## Problem Statement
The command palette already opens documents and, in some cases, passes coarse navigation hints such as PDF page number, HTML scroll percent, or YouTube timestamp. That is not enough for the workflow users expect from in-document search:

1. **Approximate jumps break trust**. Landing on the right page but not the actual sentence forces the user to search again manually.
2. **Different content types behave inconsistently**. Books, imported documents, and transcripts use different location models and highlight behavior.
3. **Current search metadata is lossy**. The search layer often reduces a concrete text match into an approximate location instead of preserving the exact anchor needed by the viewer.

### Current State
- `src/components/search/CommandCenter.tsx` computes search hits and already passes `highlightQuery` plus `initialJump` into document tabs.
- For PDFs, hits are derived from estimated page position based on text offset, not an exact within-page anchor.
- For EPUB and HTML content, hits may fall back to coarse scroll position instead of a stable text anchor.
- Transcript hits can seek to a timestamp and highlight a segment, but the exact-hit contract is not specified consistently across all result types.

## Proposed Solution
Define and implement an exact-hit navigation contract for command palette results. Every content-derived search hit should preserve a stable anchor to the matched text span, and viewers should use that anchor to open at the exact location and highlight that specific match.

### Key Features
1. **Exact search-hit anchors**: Search results carry exact location metadata, not just approximate page or scroll hints.
2. **Viewer-specific exact jumps**:
   - PDF: open the correct page and scroll to the matched text span in the text layer
   - EPUB: open the exact CFI or CFI range for the match
   - HTML/Markdown/Web import: scroll to the matched DOM/text anchor and highlight the exact range
   - YouTube transcript: seek to the matching segment timestamp and highlight that exact segment
3. **Visible post-jump confirmation**: The matched text remains highlighted after navigation so the user can immediately orient.
4. **Consistent command-palette behavior**: Mouse click and Enter-key activation both use the same exact-hit navigation path.

## Scope
### In Scope
- Command palette keyword search results backed by document or transcript content
- Exact-hit metadata shape shared between search and viewer layers
- Viewer behavior for PDF, EPUB, HTML/Markdown/Web imports, and YouTube transcripts
- Explicit fallback rules when an exact anchor cannot be resolved

### Out of Scope
- Semantic search ranking changes
- Redesigning the command palette UI
- Broad PDF rendering performance work except what is required to scroll to and reveal an exact hit
- New document indexing pipelines unrelated to search-hit anchoring

## Success Criteria
1. User opens command palette and types a term present in a PDF, EPUB, HTML document, markdown document, or YouTube transcript.
2. User selects the result.
3. The app opens the correct document or video at the exact matched location, not merely near it.
4. The matched text or transcript segment is visibly highlighted after the jump.

## Alternatives Considered
1. **Approximate page or scroll jumps**: Rejected because this is the current failure mode and still requires users to manually find the match.
2. **Highlight-only without exact jump**: Rejected because users may never see the highlight if the viewer opens away from the match.
3. **Exact navigation only for some formats**: Rejected because inconsistent behavior in the same command palette undermines user expectations.

## Dependencies
- Existing command palette result grouping and result activation flow
- Existing viewer support for `highlightQuery`, `initialJump`, and transcript segment highlighting
- Document-specific anchor generation or extraction support where currently missing

## Related Changes
- Complements `openspec/changes/command-palette-navigation/` by tightening “open the right place” into an exact-match guarantee.
- Refines the earlier `openspec/changes/update-search-result-jumps-and-pdf-scroll-performance/` draft by replacing approximate hit navigation with an exact-anchor requirement.
- Aligns with transcript result behavior described in `openspec/changes/add-semantic-transcript-search/specs/transcript-search/spec.md`.

## Open Questions
1. For OCR-derived PDFs, do we consider exact navigation satisfied when the text layer anchor resolves to the correct bounding box on the page, even if OCR tokenization differs from the original phrase?
2. For HTML imports that are later sanitized or re-rendered, should exact anchors prefer DOM selectors, text quotes, or both?
3. If an exact anchor cannot be resolved because the source content changed after indexing, should the viewer fall back to nearest-match search or fail visibly?
