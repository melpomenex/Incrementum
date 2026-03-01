## ADDED Requirements
### Requirement: Local Network/P2P Sync Mode
The system SHALL support direct local network synchronization between trusted devices without requiring cloud credentials.

#### Scenario: Two devices sync on same network
- **WHEN** two authenticated local peers are on the same trusted network
- **THEN** the system performs direct sync using local transport
- **AND** applies conflict resolution policy consistent with cloud sync rules

### Requirement: Card Version History and Revert
The system SHALL maintain card revision history and allow users to inspect and revert to a prior revision.

#### Scenario: User reverts an undesirable edit
- **WHEN** a user opens card history and selects a prior revision
- **THEN** the selected revision becomes the current card content
- **AND** the revert action is appended as a new revision event

### Requirement: Mnemosyne Export
The system SHALL support exporting eligible deck/card data into Mnemosyne-compatible format.

#### Scenario: User exports to Mnemosyne
- **WHEN** a user triggers Mnemosyne export for selected content
- **THEN** the system generates an export artifact compatible with Mnemosyne import expectations

### Requirement: Printable Paper Flashcards
The system SHALL support generating printable PDF flashcard layouts from selected cards.

#### Scenario: User prints selected cards
- **WHEN** a user chooses print export for selected cards
- **THEN** the system generates a print-ready PDF with front/back card layout and pagination
