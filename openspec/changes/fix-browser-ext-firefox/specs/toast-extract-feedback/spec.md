## MODIFIED Requirements

### Requirement: Extraction error shows error toast
If the extract creation fails, the system SHALL show an error toast notification instead of the success toast. This applies to all save pathways including browser extension context menu actions (save-page, save-link, create-extract).

#### Scenario: Failed extraction shows error toast
- **WHEN** an extract creation fails due to a backend error
- **THEN** an error toast appears with a descriptive error message

#### Scenario: Browser extension save-link failure shows error toast
- **WHEN** the browser extension "Save Link to Incrementum" context menu action fails
- **THEN** an error toast appears with a message indicating the save failed

#### Scenario: Browser extension save-page failure shows error toast
- **WHEN** the browser extension "Save to Incrementum" context menu action fails
- **THEN** an error toast appears with a message indicating the save failed
