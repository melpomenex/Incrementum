## ADDED Requirements
### Requirement: Plugin and Extension API System
The system SHALL provide a plugin/extension API with lifecycle hooks and explicit permission scopes.

#### Scenario: Plugin requests sensitive permission
- **WHEN** a plugin requests access to protected capabilities
- **THEN** the system prompts for permission grant before activation

### Requirement: Focus/Zen Review Mode
The system SHALL provide a focus mode that hides non-essential interface elements during review.

#### Scenario: User enables focus mode
- **WHEN** focus mode is enabled for review
- **THEN** review UI renders only core card interaction elements and essential controls

### Requirement: Multi-Language UI Support
The system SHALL provide internationalization infrastructure and support runtime language selection.

#### Scenario: User switches UI language
- **WHEN** a user selects a supported UI locale
- **THEN** navigational and review interface text updates to the selected locale without data loss

### Requirement: Card Prerequisite Chains
The system SHALL support prerequisite relationships so dependent cards are withheld until prerequisite maturity criteria are met.

#### Scenario: Dependent card blocked by prerequisite
- **WHEN** a dependent card's prerequisite is not yet mature
- **THEN** the scheduler excludes the dependent card from due review queues

### Requirement: Daily Note/Zettelkasten Linking
The system SHALL support linking imported content and created cards/extracts to daily note entries.

#### Scenario: User creates cards on a given day
- **WHEN** cards or extracts are created during a day
- **THEN** the system links those artifacts to that day's note context

### Requirement: Webhook and REST Automation API
The system SHALL expose authenticated webhook and REST endpoints for external tool integration, including card creation and due-count queries.

#### Scenario: External tool creates a card via API
- **WHEN** an authenticated external client submits a card creation request
- **THEN** the system creates the card and returns an identifier and scheduling metadata
