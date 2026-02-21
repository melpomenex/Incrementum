## ADDED Requirements

### Requirement: Users can ingest images into the registry
The system SHALL allow users to add image assets to a local image registry from both file import and clipboard paste flows.

#### Scenario: Import image file successfully
- **WHEN** a user selects a supported image file from the import action
- **THEN** the system stores the image in persistent local storage with a stable asset ID
- **And** the registry view shows the new image entry with metadata

#### Scenario: Paste image from clipboard successfully
- **WHEN** a user triggers paste while the image registry is focused and the clipboard contains image data
- **THEN** the system stores the clipboard image as a new or deduplicated asset
- **And** the registry view confirms the image is available for reuse

#### Scenario: Reject unsupported image input
- **WHEN** a user imports or pastes data that is not a supported image MIME type or exceeds configured limits
- **THEN** the system SHALL reject ingestion
- **And** the user SHALL receive an actionable error message

### Requirement: Registry assets are deduplicated and addressable
The system MUST compute a content hash for ingested images to prevent duplicate storage and provide deterministic asset references.

#### Scenario: Duplicate image ingestion
- **WHEN** a user imports or pastes an image whose hash already exists in the registry
- **THEN** the system reuses the existing asset record
- **And** the system returns the existing stable asset ID instead of creating a duplicate

### Requirement: Users can browse and select registry images for flashcards
The system SHALL provide listing and selection capabilities so registry images can be attached to flashcard content.

#### Scenario: Select image during flashcard creation
- **WHEN** a user opens flashcard creation and chooses the image registry picker
- **THEN** the system displays available registry images
- **And** the selected image asset ID is attached to the flashcard payload

### Requirement: Image assets preserve integrity and retrieval behavior
The system MUST return retrievable image data for stored assets and protect references used by learning content.

#### Scenario: Render previously stored image
- **WHEN** a flashcard references a valid image asset ID
- **THEN** the system retrieves the associated image data and renders it in the flashcard UI

#### Scenario: Attempt to delete referenced image
- **WHEN** a user requests deletion of an image asset that is referenced by existing flashcards
- **THEN** the system SHALL prevent destructive deletion or perform a safe soft-delete strategy
- **And** the user SHALL receive guidance about dependent flashcards
