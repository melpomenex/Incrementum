## ADDED Requirements
### Requirement: Community Deck Marketplace
The system SHALL provide a community marketplace where users can browse, download, and rate shared decks.

#### Scenario: User installs a community deck
- **WHEN** a user selects a published community deck and confirms install
- **THEN** the deck is added to the user collection with source attribution metadata

### Requirement: Collaborative Study Groups
The system SHALL support shared decks for study groups and expose aggregate group performance metrics.

#### Scenario: Group studies shared deck
- **WHEN** multiple group members review cards in a shared deck
- **THEN** group-level aggregate performance metrics are updated and visible to authorized members

### Requirement: Public Profile and Stats Sharing
The system SHALL allow users to optionally publish a profile page with selected study statistics under explicit privacy controls.

#### Scenario: User enables public stats profile
- **WHEN** a user opts in to public profile sharing
- **THEN** the system publishes only the selected stats fields
- **AND** the user can disable sharing at any time
