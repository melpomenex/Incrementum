## Context

FlashcardStudioModal is a 4018-line full-screen modal with a three-part layout: header bar (view tabs + provider selector), context bar (document/deck selectors), and a two-column main area (chat + draft cards). Context is currently sourced via the ContextControlPanel which supports full document, chapters, page ranges, excerpt text, or search-within-document — but has no awareness of existing extracts.

Extracts are already indexed per-document via `getExtracts(documentId)` and can be globally fetched via `getExtracts()`. The backend already supports `generateLearningItemsFromExtract(extractId)` for one-click card generation, and `getLearningItemsByExtract(extractId)` for checking existing cards.

The current card-creation flow requires users to navigate away from the studio to the document's extract view, which breaks the studio's purpose as a dedicated flashcard creation environment.

## Goals / Non-Goals

**Goals:**
- Surface extracts inside FlashcardStudioModal so users can pick source material without leaving the studio
- Group extracts by document for easy browsing
- Allow one-click card generation from selected extracts (using existing `generateLearningItemsFromExtract`)
- Allow selecting an extract as chat context (equivalent to the "excerpt" context mode)
- Show extract metadata: content snippet, highlight color, page number, existing card count
- Support multi-select for bulk operations

**Non-Goals:**
- Full extract editing in the studio (users can still do that in the document view)
- Replacing the existing ContextControlPanel — extracts are an additional context source
- Creating new backend API endpoints — all needed APIs already exist
- Modifying the extract review or extract inbox flows

## Decisions

### 1. Extract browser as a new view mode tab ("Extracts")

**Decision:** Add an "Extracts" tab alongside Chat, Templates, and History in the header view-mode switcher.

**Rationale:** This is the least disruptive to the existing layout. The extract browser needs significant screen space (document list + extract list + preview), so using the left panel is natural. Alternatives considered:
- Collapsible sidebar: would eat into the already narrow left panel and compete with the chat
- Dialog/popover: too constrained for browsing many extracts
- Replacing the context bar: extracts are context, but the current document/deck selectors serve a different purpose

### 2. Document-grouped extract list with collapsible sections

**Decision:** Fetch all extracts via `getExtracts()`, group them by `document_id`, and display in collapsible sections. Only the selected document's section is expanded by default.

**Rationale:** The studio already has a `selectedDocumentId` state. When a document is selected, we can auto-expand its extract section and collapse others. Users can still expand other documents' sections to pull extracts cross-document. Loading all extracts at once is cheap (typically < 200 per user) and avoids per-document loading spinners.

### 3. Extract context integration via existing ContextSelection mechanism

**Decision:** When an extract is selected as context, set `contextSelection` to `{ mode: "excerpt", excerpt: extract.content }` and auto-select the extract's document. This reuses the existing context pipeline.

**Rationale:** The chat system already reads `contextSelection` to build prompts. Setting mode to "excerpt" is exactly what happens when a user pastes text manually. No changes to the chat or LLM pipeline needed.

### 4. One-click generation as a separate action, not replacing the chat flow

**Decision:** Each extract row has a "Generate Cards" button that calls `generateLearningItemsFromExtract(extractId)` directly, saving cards to the backend. Results appear in the draft cards panel. Also a "Use as Context" button that sets the extract as chat context and switches to chat view.

**Rationale:** Two distinct workflows: (a) quick one-shot generation for obvious extracts, (b) chat-based refinement for complex material. Both should be one click away from the extract.

### 5. Extract browser state persisted alongside studio state

**Decision:** Store extract browser state (expanded documents, selected extracts, search query) as part of the existing `localStorage` persistence under `"flashcard-studio-state-v3"`.

**Rationale:** The studio already persists most state. Extract browser preferences should survive modal close/reopen without additional infrastructure.

## Risks / Trade-offs

- **Extracts API call on open** → Fetching all extracts when the studio opens adds one backend call. Mitigated by the fact that extracts are typically < 200 and the call is async/non-blocking. Could add lazy loading if this becomes an issue.
- **Large monolithic component** → FlashcardStudioModal is already 4018 lines. Adding the extract browser inline would make it worse. Mitigation: extract the `ExtractBrowserPanel` as a standalone sub-component in a separate file.
- **Context ambiguity** → If a user selects a document via DocumentSelector AND picks an extract from a different document, the context source could be confusing. Mitigation: auto-switch the document selector to match the extract's document when an extract is used as context.
