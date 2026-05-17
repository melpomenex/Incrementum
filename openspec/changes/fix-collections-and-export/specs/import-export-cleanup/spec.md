## MODIFIED Requirements

### Requirement: Functional import features shall be grouped without wave labels
The Import/Export settings tab SHALL present all functional import features (podcast/audio import, PDF highlight extraction, clipboard watcher, Zotero/Mendeley import) without "Wave" roadmap labels. The tab SHALL also include per-collection export and import options.

#### Scenario: Additional import options are accessible
- **WHEN** user views the Import/Export tab
- **THEN** podcast import, PDF highlight extraction, clipboard watcher, and reference manager import SHALL be available under a section labeled "Additional Imports" or similar non-wave terminology

#### Scenario: Collection export option is available
- **WHEN** user views the Import/Export tab
- **THEN** a "Export Collection" option SHALL be available that allows selecting a specific collection to export

#### Scenario: Collection import option is available
- **WHEN** user views the Import/Export tab
- **THEN** an "Import Collection" option SHALL be available that accepts a `.incrementum-collection.zip` file
- **THEN** the import SHALL create a new collection with all associated data
