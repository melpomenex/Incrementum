# markdown-import Specification

## ADDED Requirements

### Requirement: Markdown bundle detection
The system SHALL detect when a dropped directory or file set represents a markdown bundle.

#### Scenario: Directory with markdown and images
- **WHEN** a user drops a directory containing a `.md` file and an `images/` subfolder
- **THEN** the system identifies it as a markdown bundle
- **AND** offers bundle import options

#### Scenario: Markdown with companion metadata
- **WHEN** a user drops a `.md` file alongside a `_metadata.json` file
- **THEN** the system identifies it as a markdown bundle with metadata
- **AND** parses the metadata for import options

#### Scenario: Single markdown file
- **WHEN** a user drops only a `.md` file
- **THEN** the system uses existing single-file import (no change from current behavior)

#### Scenario: Mixed files (markdown + unrelated files)
- **WHEN** a user drops multiple files including markdown but no clear bundle pattern
- **THEN** the system imports only the markdown files individually

### Requirement: Metadata JSON parsing
The system SHALL parse companion `_metadata.json` files to extract document metadata.

#### Scenario: Valid metadata JSON
- **GIVEN** a markdown file with companion `filename_metadata.json`
- **WHEN** the bundle is imported
- **THEN** the system parses the JSON file
- **AND** extracts title, author, tags, dates, and other metadata
- **AND** applies metadata to the created document

#### Scenario: Invalid metadata JSON
- **GIVEN** a malformed `_metadata.json` file
- **WHEN** the bundle is imported
- **THEN** the system logs a warning
- **AND** proceeds with import using defaults from markdown filename

#### Scenario: Missing metadata file
- **GIVEN** a markdown file without companion metadata
- **WHEN** the bundle is imported
- **THEN** the system uses defaults (title from filename, no author, empty tags)

#### Scenario: Partial metadata
- **GIVEN** a metadata JSON with only some fields (e.g., only title)
- **WHEN** the bundle is imported
- **THEN** the system uses provided fields
- **AND** uses defaults for missing fields

### Requirement: Image path resolution
The system SHALL correctly resolve and display images referenced in markdown.

#### Scenario: Relative image path in subfolder
- **GIVEN** a markdown file with `![](images/diagram.png)`
- **WHEN** the bundle is imported with images in `images/` folder
- **THEN** the system stores the image
- **AND** rewrites the path to resolve correctly
- **AND** the image displays when viewing the document

#### Scenario: Relative image path with dot prefix
- **GIVEN** a markdown file with `![](./images/screenshot.jpg)`
- **WHEN** the bundle is imported
- **THEN** the system correctly resolves the path
- **AND** the image displays when viewing the document

#### Scenario: Multiple images
- **GIVEN** a markdown file referencing 10 images in various subfolders
- **WHEN** the bundle is imported
- **THEN** all images are stored
- **AND** all paths are rewritten correctly
- **AND** all images display in the document

#### Scenario: Missing referenced image
- **GIVEN** a markdown file with `![](images/missing.png)` but no such image in bundle
- **WHEN** the document is viewed
- **THEN** the system shows a placeholder or alt text
- **AND** logs a warning about missing image

### Requirement: Image storage
The system SHALL store bundle images for later retrieval.

#### Scenario: Store images during import
- **GIVEN** a markdown bundle with images
- **WHEN** the import completes
- **THEN** all images are stored in persistent storage
- **AND** images are accessible via API endpoint

#### Scenario: Large image handling
- **GIVEN** a bundle containing a 10MB PNG image
- **WHEN** the bundle is imported
- **THEN** the system stores the image without memory issues
- **AND** shows progress indication if import takes time

#### Scenario: Unicode image filename
- **GIVEN** a bundle with image named `スクリーンショット.png`
- **WHEN** the bundle is imported
- **THEN** the system stores the image with encoded filename
- **AND** the image displays correctly

### Requirement: Import preview dialog
The system SHALL show a preview of the bundle contents before import.

#### Scenario: Show bundle preview
- **GIVEN** a detected markdown bundle
- **WHEN** before import is confirmed
- **THEN** the system shows a preview dialog with:
  - Document title (from metadata or filename)
  - Author (if in metadata)
  - Tag suggestions (from metadata or auto-detected)
  - Image count
  - Estimated reading time
  - First few lines of content

#### Scenario: Edit import options
- **GIVEN** the bundle preview dialog
- **WHEN** the user wants to modify settings
- **THEN** the user can edit:
  - Document title
  - Tags (add/remove)
  - Category/collection assignment
  - Priority level

#### Scenario: Cancel import
- **GIVEN** the bundle preview dialog
- **WHEN** the user clicks cancel
- **THEN** the dialog closes
- **AND** no files are imported
- **AND** no data is stored

### Requirement: Beautiful markdown rendering
The system SHALL render imported markdown beautifully in the viewer.

#### Scenario: Render markdown with images
- **GIVEN** an imported markdown bundle with images
- **WHEN** the user opens the document
- **THEN** the MarkdownViewer renders:
  - Headers with proper sizing and spacing
  - Code blocks with syntax highlighting
  - Tables with clean borders
  - Blockquotes with accent styling
  - Images sized appropriately and centered
  - Links as clickable with visual indication

#### Scenario: Dark mode rendering
- **GIVEN** an imported markdown document
- **WHEN** the user views in dark mode
- **THEN** the markdown uses dark-aware styling
- **AND** images remain visible
- **AND** code blocks have dark background

#### Scenario: Long document with table of contents
- **GIVEN** a 5000+ word markdown document with headers
- **WHEN** the user opens the document
- **THEN** the system could offer a table of contents sidebar (optional enhancement)
- **AND** the document scrolls smoothly

### Requirement: Cross-platform compatibility
The system SHALL support markdown bundle import on both Tauri and browser platforms.

#### Scenario: Import in Tauri desktop app
- **GIVEN** a user on Tauri desktop
- **WHEN** they drag-drop a folder
- **THEN** the bundle is imported using native file system
- **AND** images are stored in app data directory

#### Scenario: Import in browser PWA
- **GIVEN** a user in a web browser
- **WHEN** they drag-drop a folder
- **THEN** the bundle is imported using FileSystem API
- **AND** images are stored in IndexedDB
- **AND** the experience is equivalent to desktop

#### Scenario: Import from file picker
- **GIVEN** a user clicks "Import" button
- **WHEN** they select a folder via file picker
- **THEN** the bundle detection and import proceeds identically

### Requirement: Progress indication
The system SHALL show progress during bundle import for large files.

#### Scenario: Import with multiple images
- **GIVEN** a bundle with 20 images totaling 50MB
- **WHEN** the user initiates import
- **THEN** the system shows a progress bar
- **AND** displays current file being processed
- **AND** allows cancellation mid-import

#### Scenario: Quick import (small bundle)
- **GIVEN** a bundle with 1 markdown file and 2 small images
- **WHEN** the user initiates import
- **THEN** the import completes quickly (< 1 second)
- **AND** minimal progress indication is shown (spinner only)
