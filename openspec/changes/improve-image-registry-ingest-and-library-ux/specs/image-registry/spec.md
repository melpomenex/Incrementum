## MODIFIED Requirements

### Requirement: Users can ingest images into the registry from clipboard-first workflows
The system SHALL treat image clipboard paste as a primary ingestion path on image-registry-aware surfaces so users can save screenshots and other clipboard images into the registry with standard paste shortcuts.

#### Scenario: Paste clipboard image into the app while authoring
- **WHEN** a user has an image on the clipboard and presses `Ctrl+V` or `Cmd+V` while focused on a flashcard authoring surface that supports image registry intake
- **THEN** the system ingests the image into the registry
- **And** the image becomes immediately selectable for the current flashcard workflow

#### Scenario: Paste clipboard image into the dedicated registry library
- **WHEN** a user has an image on the clipboard and presses `Ctrl+V` or `Cmd+V` while focused on the dedicated image registry library
- **THEN** the system ingests the image into the registry
- **And** the newly added or deduplicated asset is brought into view in the library

#### Scenario: Preserve normal text paste behavior
- **WHEN** a user presses paste on an eligible surface but the clipboard payload does not contain supported image data
- **THEN** the system does not hijack normal text paste behavior
- **And** non-image paste handling continues as expected for the focused control

### Requirement: Registry intake gives immediate, trustworthy feedback
The system SHALL provide visible confirmation after successful import or paste so the user knows the image was stored and can continue their workflow without uncertainty.

#### Scenario: Show confirmation after new image ingest
- **WHEN** a user imports or pastes a new image into the registry
- **THEN** the system shows transient success feedback that includes the image count
- **And** the current surface visually identifies the stored asset, such as by selecting or highlighting it

#### Scenario: Show confirmation after duplicate ingest
- **WHEN** a user imports or pastes an image that already exists in the registry
- **THEN** the system tells the user the existing asset was reused
- **And** the existing asset is surfaced in the current registry or selection view

### Requirement: Users can browse and manage the image registry as a library
The system SHALL expose a dedicated image registry library where users can inspect and manage stored images outside the narrow context of flashcard authoring.

#### Scenario: Browse registry contents
- **WHEN** a user opens the image registry library
- **THEN** the system displays stored images in a browsable thumbnail view
- **And** the user can inspect filename, dimensions, file size, created time, and usage state for each image

#### Scenario: Find an image in the registry
- **WHEN** a user searches or sorts within the image registry library
- **THEN** the system filters or reorders the visible assets without modifying stored data
- **And** the user can find recently pasted or previously uploaded images efficiently

#### Scenario: Perform common registry actions
- **WHEN** a user selects one or more images in the image registry library
- **THEN** the system provides common actions appropriate to their state
- **And** those actions include preview, selection for flashcard use, and deletion only when safe

### Requirement: Flashcard creation can round-trip through the image registry library
The system SHALL let users enter the full registry library from flashcard creation, choose images, and return to authoring without losing their draft.

#### Scenario: Open registry from flashcard creation and return with selection
- **WHEN** a user opens the image registry library from flashcard creation, selects one or more images, and confirms the selection
- **THEN** the flashcard draft remains intact
- **And** the chosen image asset IDs are attached to the active flashcard workflow
