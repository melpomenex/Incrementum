# extract-source-navigation Specification

## ADDED Requirements

### Requirement: Queue Extract Creation Preserves Reading Continuity
The system SHALL keep the user in the current reading context by default when they create an extract from a queue session.

#### Scenario: Scroll mode document extract keeps reader open
- **GIVEN** a user is reading a queued document in Scroll Mode
- **WHEN** they create an extract successfully
- **THEN** the document reader SHALL remain open at the current queue item
- **AND** the app SHALL show a success affordance that does not force navigation to the extracts view

#### Scenario: Queue web article extract keeps article open
- **GIVEN** a user is reading an imported web article from a queue session
- **WHEN** they create an extract successfully
- **THEN** the article reader/editor SHALL remain open
- **AND** the app SHALL offer an explicit way to inspect the created extract without interrupting reading by default

### Requirement: Queue-Created Extracts Preserve Source Resume Context
The system SHALL preserve enough source metadata for queue-created extracts to return the user to the originating reading flow.

#### Scenario: Extract stores resumable source context
- **GIVEN** a user creates an extract from a queue item
- **WHEN** the extract is saved
- **THEN** the system SHALL preserve the originating queue/session context
- **AND** preserve the source identifier and source-type-specific location metadata when available

### Requirement: Queue-Created Extract Views Provide Source Return Actions
When a user opens an extract that was created from a queue reading flow, the extract view SHALL expose clear actions to return to the originating source.

#### Scenario: Book extract shows back-to-book action
- **GIVEN** an extract was created from a queued book or document reader
- **WHEN** the user opens that extract
- **THEN** the extract view SHALL show a persistent `Back to book` or equivalent source-aware action
- **AND** SHALL show `Resume queue` when the originating queue context is still valid

#### Scenario: Article extract shows back-to-article action
- **GIVEN** an extract was created from a queued article-style reader
- **WHEN** the user opens that extract
- **THEN** the extract view SHALL show a persistent `Back to article` or equivalent source-aware action
- **AND** SHALL identify the source title

### Requirement: Return to Source Restores Best Available Position
Source return actions for queue-created extracts SHALL restore the best available reading position using a deterministic fallback order.

#### Scenario: Exact reader location is restored
- **GIVEN** a queue-created extract has valid source location metadata
- **WHEN** the user activates `Back to book` or `Back to article`
- **THEN** the app SHALL reopen the originating source at the saved location

#### Scenario: Fallback to source root when exact location is unavailable
- **GIVEN** a queue-created extract references an existing source item but the exact saved location can no longer be restored
- **WHEN** the user activates the source return action
- **THEN** the app SHALL open the originating source item at its nearest valid root view
- **AND** SHALL NOT strand the user on the extract view

#### Scenario: Missing source disables return action safely
- **GIVEN** a queue-created extract references a source item that no longer exists
- **WHEN** the extract view is shown
- **THEN** the app SHALL not render a broken active return button
- **AND** SHALL explain that the original source is unavailable
