## ADDED Requirements

### Requirement: Extract browser tab in Flashcard Studio
The system SHALL provide an "Extracts" view mode tab in the FlashcardStudioModal header, alongside the existing Chat, Templates, and History tabs. When selected, the left panel SHALL display the extract browser instead of the chat interface.

#### Scenario: User opens the extract browser
- **WHEN** user clicks the "Extracts" tab in the header
- **THEN** the left panel switches to show the extract browser with extracts grouped by document

#### Scenario: User returns to chat from extract browser
- **WHEN** user clicks the "Chat" tab after viewing extracts
- **THEN** the left panel returns to the chat view with all previous messages preserved

### Requirement: Extracts grouped by document
The extract browser SHALL fetch all extracts via `getExtracts()` and group them by `document_id`. Each group SHALL display the document title as a collapsible section header with the document's extract count.

#### Scenario: Document with extracts is displayed
- **WHEN** the extract browser loads and a document has 5 extracts
- **THEN** the document section header shows the document title and "(5)" count badge

#### Scenario: Document section is collapsed by default for non-selected documents
- **WHEN** the extract browser loads and the user has selected Document A in the document selector
- **THEN** Document A's section is expanded and all other document sections are collapsed

#### Scenario: User expands a different document section
- **WHEN** user clicks a collapsed document section header
- **THEN** that section expands to show its extracts, and previously expanded sections remain expanded

### Requirement: Extract row display
Each extract row SHALL display a content snippet (first 120 characters of plain text), highlight color indicator (if set), page number (if available), and an action menu.

#### Scenario: Extract with highlight color and page number
- **WHEN** an extract has `highlight_color: "#ffeb3b"` and `page_number: 42`
- **THEN** the row shows a colored dot, the content snippet, and "p.42" label

#### Scenario: Extract without metadata
- **WHEN** an extract has no highlight color and no page number
- **THEN** the row shows only the content snippet with no extra indicators

### Requirement: Use extract as chat context
The system SHALL provide a "Use as Context" action on each extract. When triggered, the system SHALL set the `contextSelection` to `{ mode: "excerpt", excerpt: extract.content }`, auto-select the extract's document in the document selector, and switch to the Chat view.

#### Scenario: User uses an extract as context
- **WHEN** user clicks "Use as Context" on an extract from Document B
- **THEN** the document selector switches to Document B, the context is set to the extract's content, and the view switches to Chat with a system message indicating the extract is loaded as context

#### Scenario: User uses an extract while a different document is selected
- **WHEN** Document A is selected and user clicks "Use as Context" on an extract from Document B
- **THEN** the document selector switches to Document B and the context updates accordingly

### Requirement: One-click card generation from extract
The system SHALL provide a "Generate Cards" action on each extract row. When triggered, the system SHALL call `generateLearningItemsFromExtract(extractId)` and add the generated cards to the draft cards panel.

#### Scenario: User generates cards from a single extract
- **WHEN** user clicks "Generate Cards" on an extract
- **THEN** a loading indicator appears on that extract row, the backend generates cards, and the generated cards appear in the draft cards panel on the right

#### Scenario: Generation fails
- **WHEN** `generateLearningItemsFromExtract` returns an error
- **THEN** a toast notification shows the error message and the loading indicator is removed

### Requirement: Extract search and filtering
The extract browser SHALL provide a search input that filters extracts by content and document title. The system SHALL also provide a document-only filter dropdown to show extracts from a specific document.

#### Scenario: User searches extracts by content
- **WHEN** user types "photosynthesis" in the search input
- **THEN** only extracts whose content contains "photosynthesis" are shown, grouped by their respective documents

#### Scenario: User filters by document
- **WHEN** user selects "Biology 101" from the document filter dropdown
- **THEN** only extracts from "Biology 101" are shown

#### Scenario: Search with no results
- **WHEN** user searches for text that matches no extracts
- **THEN** an empty state message is shown with "No extracts found"

### Requirement: Extract browser extracted as separate component
The extract browser panel SHALL be implemented as a standalone component (`ExtractBrowserPanel`) in a separate file from FlashcardStudioModal, receiving extracts, documents, and callbacks as props.

#### Scenario: Component is importable and reusable
- **WHEN** the extract browser is implemented
- **THEN** it exists as a standalone React component that can be imported and rendered independently of FlashcardStudioModal
