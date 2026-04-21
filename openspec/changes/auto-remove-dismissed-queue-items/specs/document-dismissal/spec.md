## ADDED Requirements

### Requirement: Dismissed documents are excluded from queues

The system SHALL exclude dismissed documents from queue generation across queue-facing app surfaces while preserving the document record.

#### Scenario: Dismissed document is skipped during queue generation
- **GIVEN** a document has `is_dismissed = true`
- **WHEN** the backend generates queue items for any queue surface
- **THEN** that document SHALL NOT be included in the returned queue items

#### Scenario: Non-dismissed document remains queue-eligible
- **GIVEN** a document is not archived and has `is_dismissed = false`
- **WHEN** the backend generates queue items
- **THEN** the document SHALL remain eligible for queue inclusion under the normal scheduling rules

### Requirement: Dismissing from the app removes the document from the visible queue

When the user dismisses a document through an app button, the queue-facing UI SHALL update so the dismissed document no longer appears as an active queue item.

#### Scenario: User dismisses a queued document
- **GIVEN** a document is currently visible in a queue-facing view
- **WHEN** the user clicks the dismiss button for that document
- **THEN** the system SHALL persist `is_dismissed = true` for the document
- **AND** the visible queue SHALL refresh or update so the dismissed document is removed without requiring a manual reload

#### Scenario: Dismissed selected item is removed from active queue context
- **GIVEN** a queue-facing view has an active or selected document item
- **WHEN** the user dismisses that document
- **THEN** the dismissed document SHALL be removed from the active queue data
- **AND** the UI SHALL move focus or selection to the next valid queue state without error

### Requirement: Dismissal remains reversible and non-destructive

Dismissal SHALL remove a document from active queue scheduling without deleting it or archiving it.

#### Scenario: Dismissal does not archive the document
- **GIVEN** a user dismisses a document
- **WHEN** the dismissal is persisted
- **THEN** the document SHALL remain stored in the library
- **AND** the document SHALL NOT be marked archived solely because it was dismissed
