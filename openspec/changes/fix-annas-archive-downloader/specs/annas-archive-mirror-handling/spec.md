## ADDED Requirements

### Requirement: Multi-Mirror Download Support
The system SHALL support downloading books from multiple mirrors identified through Anna's Archive, including its direct "Slow Download" links and external mirrors like LibGen and Z-Library.

#### Scenario: Download from direct Anna's Archive link
- **WHEN** a user selects a book and initiates a download
- **THEN** the system SHALL attempt to fetch the direct download link from the Anna's Archive detail page
- **AND** if the link is accessible without JavaScript challenges, the system SHALL start the download

#### Scenario: Fallback to LibGen mirror
- **WHEN** the direct Anna's Archive download link is blocked or requires manual intervention
- **THEN** the system SHALL attempt to use LibGen.li or LibGen.rs mirror links found on the detail page
- **AND** the system SHALL use the MD5 hash to construct a direct download URL for the selected LibGen mirror

#### Scenario: Progress tracking
- **WHEN** a download is in progress
- **THEN** the system SHALL report real-time progress updates (percentage, bytes downloaded) to the UI
