## ADDED Requirements

### Requirement: Playback Position Restoration
The AudiobookViewer SHALL restore the last saved playback position for any audio content (documents or podcast episodes) upon loading.

#### Scenario: User opens a previously played podcast
- **WHEN** the user opens a podcast episode or audio document they have previously played
- **THEN** the player fetches the last saved position from the database
- **AND** the playback head is automatically moved to that position as soon as it becomes available, regardless of whether media metadata has already loaded.

### Requirement: Continuous Position Saving
The system SHALL save the playback position frequently enough and at critical lifecycle moments to prevent progress loss.

#### Scenario: User pauses playback
- **WHEN** the user clicks pause while listening to audio
- **THEN** the system SHALL immediately save the current timestamp to the database.

#### Scenario: User navigates away from the player
- **WHEN** the user navigates to another page or the AudiobookViewer component is unmounted
- **THEN** the system SHALL immediately save the current timestamp to the database.

### Requirement: Unified Persistence for Promoted Podcasts
Promoted podcast episodes (those inserted into the IR queue) SHALL have their position synchronized between the podcast tracking system and the document tracking system.

#### Scenario: User plays a promoted podcast in Scroll Mode
- **WHEN** the user listens to a podcast promoted to a document in Scroll Mode
- **THEN** both the `playback_position` in the `podcast_episodes` table and the entry in the `position` table SHALL be updated to ensure consistency across the app.
