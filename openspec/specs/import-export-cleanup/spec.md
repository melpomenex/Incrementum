## ADDED Requirements

### Requirement: Import/Export settings shall not display non-functional sections
The Import/Export settings tab SHALL NOT render sections for features that have no functional backend. Specifically, the following sections SHALL be removed entirely from the rendered UI: Wave 4 Community (marketplace, study groups, public profiles), Wave 3 Plugin Host, Wave 3 Automation API, Wave 4 UX & Language, and Wave 4 Daily Notes.

#### Scenario: User opens Import/Export settings
- **WHEN** user navigates to the Import/Export tab in settings
- **THEN** no sections labeled "Wave 3" or "Wave 4" SHALL be visible
- **THEN** no UI for community marketplace, study groups, plugin host, or public profiles SHALL be rendered

### Requirement: Functional import features shall be grouped without wave labels
The Import/Export settings tab SHALL present all functional import features (podcast/audio import, PDF highlight extraction, clipboard watcher, Zotero/Mendeley import) without "Wave" roadmap labels.

#### Scenario: Additional import options are accessible
- **WHEN** user views the Import/Export tab
- **THEN** podcast import, PDF highlight extraction, clipboard watcher, and reference manager import SHALL be available under a section labeled "Additional Imports" or similar non-wave terminology

### Requirement: Mnemosyne export shall be accessible from the Export section
The Mnemosyne export function SHALL be available from the main export area rather than a separate Wave-labeled section.

#### Scenario: User exports to Mnemosyne format
- **WHEN** user views export options in Import/Export settings
- **THEN** a Mnemosyne export option SHALL be available alongside other export formats
- **WHEN** user clicks the Mnemosyne export option
- **THEN** the system SHALL invoke the existing Mnemosyne export backend command
