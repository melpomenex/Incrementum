## ADDED Requirements

### Requirement: Learning items resolve to source context
The system SHALL expose a `get_card_source_context` command that accepts a learning-item id and returns the resolvable source context: `document_id`, `document_title`, `extract_id`, `extract_snippet` (first 200 characters of the source extract's plain-text content, ellipsized if longer), `page_number` (when present), and `source_url` (for web extracts). When the learning item has no linked extract or document, the command SHALL return `null`.

#### Scenario: Card with linked extract and document
- **WHEN** `get_card_source_context` is called for a learning item whose `extract_id` and `document_id` both resolve
- **THEN** the response SHALL include the document title, the extract snippet, and any page number / source URL present on the extract

#### Scenario: Standalone card with no source
- **WHEN** `get_card_source_context` is called for a learning item with no `extract_id` and no `document_id`
- **THEN** the command SHALL return `null`

### Requirement: Source context is displayed as a collapsible panel on review cards
The review card SHALL render a collapsible source-context panel below the question. When collapsed, it SHALL show a one-line summary ("From: *Document title*"). When expanded, it SHALL show the extract snippet. The panel SHALL be hidden entirely when no source resolves, so cards without sources show no empty placeholder.

#### Scenario: Card with source shows collapsed summary
- **WHEN** a card with a resolvable source is shown during review
- **THEN** a collapsed summary line reading "From: *Document title*" SHALL appear below the question

#### Scenario: User expands the panel to see the snippet
- **WHEN** the user clicks the collapsed summary
- **THEN** the panel SHALL expand to show the extract snippet

### Requirement: Source context can be disabled
A review preference `showSourceContext` (default `true`) SHALL control whether the source-context panel renders. When `false`, the panel SHALL not be rendered even when a source resolves.

#### Scenario: User disables source context
- **WHEN** `showSourceContext` is set to `false`
- **THEN** no source-context panel SHALL be rendered on review cards
