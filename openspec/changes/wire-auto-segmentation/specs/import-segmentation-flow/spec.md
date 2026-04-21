## ADDED Requirements

### Requirement: Auto-segment on import when enabled
When `autoProcessOnImport` is `true` in settings, the system SHALL automatically segment the imported document into extracts immediately after the import command returns successfully.

#### Scenario: Import with auto-segmentation enabled
- **WHEN** user imports a document and `autoProcessOnImport` is `true`
- **THEN** the system calls `auto_segment_and_create_extracts` with the document ID and segmentation settings
- **AND** the user is navigated to the document's extract list view after segmentation completes

#### Scenario: Import with auto-segmentation disabled
- **WHEN** user imports a document and `autoProcessOnImport` is `false`
- **THEN** the document is imported without segmentation
- **AND** the user remains on the current view

#### Scenario: Import with auto-segmentation enabled but error during segmentation
- **WHEN** user imports a document and `autoProcessOnImport` is `true` and segmentation fails
- **THEN** the document SHALL still be saved (import succeeds)
- **AND** a non-blocking error notification SHALL inform the user that segmentation failed
- **AND** the user can manually trigger segmentation later

### Requirement: Use per-format recommended segmentation defaults
When auto-segmentation triggers and the user has not customized segmentation settings (method, target length, overlap), the system SHALL use the backend's recommended defaults for the document's file type via `get_recommended_segmentation`.

#### Scenario: User with default settings imports an EPUB
- **WHEN** user imports an EPUB with auto-segmentation enabled and default segmentation settings
- **THEN** the system calls `get_recommended_segmentation("epub")`
- **AND** uses the returned settings (Paragraph method, 400 word target) for segmentation

#### Scenario: User has customized segmentation settings
- **WHEN** user imports any document with auto-segmentation enabled and has set custom segmentation method and target length in settings
- **THEN** the system SHALL use the user's custom settings, ignoring the per-format recommendations

### Requirement: Show segmentation progress during import
When auto-segmentation is triggered during import, the system SHALL display progress feedback to the user.

#### Scenario: Large document triggers progress indicator
- **WHEN** auto-segmentation begins and the preview estimate indicates more than 50 segments
- **THEN** the system SHALL display a progress indicator showing "Segmenting document..."
- **AND** the indicator SHALL resolve to a completion message with the extract count

#### Scenario: Small document segments quickly
- **WHEN** auto-segmentation begins and completes within 500ms
- **THEN** the system MAY skip the progress indicator and navigate directly

### Requirement: Navigate to extracts after auto-segmentation
When auto-segmentation completes during import, the system SHALL navigate the user to the newly created extracts for that document.

#### Scenario: Auto-segmentation completes successfully
- **WHEN** auto-segmentation finishes after import
- **THEN** the system SHALL navigate to the document detail view showing the generated extracts
- **AND** a success message SHALL indicate how many extracts were created

#### Scenario: Multi-file import with auto-segmentation
- **WHEN** user imports multiple files with auto-segmentation enabled
- **THEN** each document is segmented sequentially
- **AND** after all imports complete, the system navigates to the library view with a summary of total extracts created
