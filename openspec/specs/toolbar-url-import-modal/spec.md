## ADDED Requirements

### Requirement: Toolbar opens WebArticleImportDialog on import URL
When the user triggers the "Import URL" action from the toolbar (button or `Ctrl+Shift+O`), the system SHALL open the `WebArticleImportDialog` modal instead of a browser `prompt()` dialog.

#### Scenario: Import URL via toolbar button
- **WHEN** user clicks the "Import URL" button in the toolbar
- **THEN** the `WebArticleImportDialog` modal opens with the URL input focused

#### Scenario: Import URL via keyboard shortcut
- **WHEN** user presses `Ctrl+Shift+O`
- **THEN** the `WebArticleImportDialog` modal opens with the URL input focused

### Requirement: Imported document opens in new tab from toolbar
After a successful URL import triggered from the toolbar, the system SHALL open the imported document in a new tab using `addTab()`.

#### Scenario: Successful import opens document
- **WHEN** user completes a URL import via the `WebArticleImportDialog` opened from the toolbar
- **THEN** the imported document is opened in a new tab

### Requirement: Dialog closes without side effects on cancel
If the user closes the `WebArticleImportDialog` without importing, the system SHALL close the modal with no side effects.

#### Scenario: User cancels import
- **WHEN** user closes the dialog without completing an import
- **THEN** the modal closes and the toolbar returns to its previous state

### Requirement: Toolbar no longer uses prompt() or alert()
The toolbar's "Import URL" handler SHALL NOT use browser `prompt()` or `alert()` dialogs.

#### Scenario: No native dialogs
- **WHEN** user triggers import URL from the toolbar
- **THEN** no browser `prompt()` or `alert()` is shown at any point in the flow
