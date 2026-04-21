## ADDED Requirements

### Requirement: Manual segment action on documents
The system SHALL provide a "Segment" action on documents that have not yet been segmented, allowing users to trigger segmentation on demand.

#### Scenario: Segment an unsegmented document
- **WHEN** user clicks "Segment" on a document with no existing extracts
- **THEN** the system calls `auto_segment_and_create_extracts` with the document's ID and current segmentation settings
- **AND** a success notification shows the number of extracts created
- **AND** the user remains on the current view

#### Scenario: Segment action hidden on already-segmented documents
- **WHEN** a document already has extracts
- **THEN** the "Segment" action SHALL NOT be displayed in the document's action menu

#### Scenario: Manual segmentation uses current settings
- **WHEN** user triggers manual segmentation
- **THEN** the system SHALL use the segmentation settings from the settings store (method, target length, overlap)

### Requirement: Manual segmentation with error handling
When manual segmentation fails, the system SHALL handle the error gracefully without disrupting the user's current view.

#### Scenario: Segmentation fails
- **WHEN** user triggers manual segmentation and the segmentation command returns an error
- **THEN** the system SHALL display an error notification explaining the failure
- **AND** the user SHALL remain on the current view
- **AND** the "Segment" action SHALL remain available for retry
