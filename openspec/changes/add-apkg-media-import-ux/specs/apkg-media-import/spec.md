## ADDED Requirements

### Requirement: APKG import SHALL ingest referenced media assets
The system SHALL ingest APKG media referenced by imported notes and cards during `.apkg` import.

#### Scenario: Referenced image media is present in package
- **WHEN** an imported note field references an image file present in the APKG media map
- **THEN** the importer MUST persist that image as a renderable asset and link it to the created learning item
- **And** the imported card MUST show the image in review mode

#### Scenario: Referenced audio media is present in package
- **WHEN** an imported note field references audio media present in the APKG package
- **THEN** the importer MUST preserve a renderable media reference in the learning item content
- **And** the imported card MUST keep the media reference accessible to the user

### Requirement: APKG import MUST normalize media references in field content
The system MUST transform APKG-local media references into Incrementum-renderable references in question/answer/cloze content.

#### Scenario: HTML img references are normalized
- **WHEN** a note field contains `<img src="...">` using APKG-local filenames
- **THEN** the importer MUST rewrite or resolve the reference to a renderable target
- **And** unresolved references MUST not break remaining text content

#### Scenario: Missing media files are handled gracefully
- **WHEN** a referenced media file is missing or unreadable
- **THEN** import MUST continue for the affected card text
- **And** the user-facing content MUST remain readable without broken rendering failures

### Requirement: Import behavior MUST be consistent across desktop and browser paths
The system SHALL apply equivalent APKG media-resolution behavior for both Rust/Tauri and browser import flows.

#### Scenario: Same deck imported in desktop and browser modes
- **WHEN** the same APKG deck is imported via desktop path and browser-bytes path
- **THEN** both imports MUST retain equivalent media visibility outcomes for learning items
