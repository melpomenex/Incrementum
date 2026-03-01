## ADDED Requirements
### Requirement: Semantic Duplicate Detection
The system SHALL perform semantic duplicate checks on card creation/update and warn users when materially similar cards already exist.

#### Scenario: New card overlaps existing card semantically
- **WHEN** a user attempts to save a card with high semantic similarity to an existing card
- **THEN** the system displays a duplicate warning with links to candidate cards

### Requirement: Card Quality Analyzer
The system SHALL provide an AI-assisted card quality analyzer that evaluates cards for minimum-information compliance, ambiguity, and passive wording.

#### Scenario: User requests quality analysis
- **WHEN** a user runs card quality analysis
- **THEN** the system returns a quality score and actionable rewrite suggestions

### Requirement: Leech Detection and Management
The system SHALL detect leech cards based on configurable lapse thresholds and provide a dedicated leech dashboard with suggested remediation actions.

#### Scenario: Card crosses leech threshold
- **WHEN** a card exceeds the configured lapse threshold
- **THEN** the card is flagged as a leech
- **AND** the leech dashboard shows suggested actions such as rewrite, split, hinting, or suspend

### Requirement: Contextual Source Jump
The system SHALL support one-step navigation from a review card to the originating source passage when source anchors are available.

#### Scenario: User jumps to source from review
- **WHEN** a user triggers source jump while reviewing a card with a source anchor
- **THEN** the system opens the source document at the anchored passage

### Requirement: Conversational Review Mode
The system SHALL provide an AI conversational review mode where an AI tutor asks follow-up questions and produces a review quality assessment.

#### Scenario: User starts conversational review
- **WHEN** a user enters conversational mode for a card topic
- **THEN** the AI tutor asks at least one follow-up probing question
- **AND** the system returns a review assessment record

### Requirement: Import-Time Auto-Tagging
The system SHALL provide AI-assisted auto-tagging suggestions or automatic application during import workflows.

#### Scenario: User imports a document with auto-tagging enabled
- **WHEN** import analysis completes
- **THEN** the system proposes or applies tags based on content semantics

### Requirement: Local and Cloud AI Provider Support
The system SHALL support both local and cloud AI model providers for AI-assisted features with configurable routing and fallback policy.

#### Scenario: Preferred local provider unavailable
- **WHEN** an AI feature is configured with local-first routing and local model execution fails
- **THEN** the system applies configured fallback policy to a cloud provider
- **AND** records provider selection in feature telemetry/audit logs
