## 1. Extract Browser Component

- [x] 1.1 Create `src/components/review/ExtractBrowserPanel.tsx` with props interface for extracts, documents, selectedDocumentId, and callbacks (onUseAsContext, onGenerateCards)
- [x] 1.2 Implement extract fetching: accept `extracts` and `documents` as props, group extracts by `document_id` into collapsible sections
- [x] 1.3 Implement document section headers showing document title and extract count badge, with expand/collapse toggle (auto-expand selected document's section)
- [x] 1.4 Implement extract rows: content snippet (first 120 chars), highlight color dot, page number label, and action buttons

## 2. Extract Actions

- [x] 2.1 Implement "Use as Context" action: call `onUseAsContext(extract)` callback that sets `contextSelection` to `{ mode: "excerpt", excerpt: extract.content }`, switches document selector to extract's document, and switches view to "chat"
- [x] 2.2 Implement "Generate Cards" action: call `onGenerateCards(extractId)` which invokes `generateLearningItemsFromExtract`, shows loading state on the row, and adds results to draft cards panel
- [x] 2.3 Add toast error handling for failed card generation

## 3. Search and Filtering

- [x] 3.1 Add search input to the extract browser header that filters extracts by content text (case-insensitive substring match)
- [x] 3.2 Add document filter dropdown that limits visible extracts to a single document
- [x] 3.3 Show empty state ("No extracts found") when search/filter yields no results

## 4. Studio Integration

- [x] 4.1 Add "Extracts" tab to the ViewMode type and the header tab switcher in FlashcardStudioModal
- [x] 4.2 Load all extracts when the studio modal opens (use existing `getExtracts()` from `src/api/extracts.ts`)
- [x] 4.3 Render `ExtractBrowserPanel` in the left panel when `viewMode === "extracts"`, passing the fetched extracts, documents, selectedDocumentId, and wired callbacks
- [x] 4.4 Wire `onUseAsContext` callback to update `selectedDocumentId`, `contextSelection`, and `viewMode` state
- [x] 4.5 Wire `onGenerateCards` callback to call `generateLearningItemsFromExtract` and append results to `draftCards` state
- [x] 4.6 Add i18n keys for new UI strings (tab label, action buttons, empty states, toast messages)

## 5. Polish

- [x] 5.1 Auto-switch document selector when an extract from a different document is used as context
- [x] 5.2 Add loading spinner state while extracts are being fetched on first open
- [x] 5.3 Persist extract browser state (expanded sections, search query) alongside existing studio localStorage state
