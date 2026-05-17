## ADDED Requirements

### Requirement: Collection switcher in sidebar
The system SHALL display a collection selector at the top of the application sidebar. The selector SHALL show the active collection name and allow switching between collections via a dropdown.

#### Scenario: View active collection
- **WHEN** the sidebar is visible
- **THEN** the collection switcher SHALL display the name of the currently active collection

#### Scenario: Switch active collection
- **WHEN** the user selects a different collection from the dropdown
- **THEN** the active collection SHALL update immediately, all visible data (documents, review queue, statistics) SHALL refresh to reflect the new collection

### Requirement: Create collection from sidebar
The system SHALL provide an option in the collection switcher to create a new collection. The user SHALL provide a name, and optionally an icon and color.

#### Scenario: Create collection with name only
- **WHEN** the user opens the "New Collection" dialog and enters "School" as the name
- **THEN** the collection SHALL be created and become the active collection

#### Scenario: Create collection with icon and color
- **WHEN** the user creates a collection with name "Work", icon "briefcase", and color "#3B82F6"
- **THEN** the collection SHALL be stored with those properties and displayed accordingly in the switcher

### Requirement: Manage collections settings
The system SHALL provide a collection management section within the Settings page where users can rename, change icon/color, and delete collections.

#### Scenario: Rename collection from settings
- **WHEN** the user renames "Work" to "Professional" in collection settings
- **THEN** the collection name SHALL update immediately in the sidebar switcher and all other UI locations

#### Scenario: Delete collection from settings
- **WHEN** the user deletes a non-default collection
- **THEN** the system SHALL show a confirmation dialog warning that items will move to "Personal". On confirm, the collection SHALL be deleted and all its items reassigned to "Personal"

#### Scenario: Attempt to delete default collection
- **WHEN** the user attempts to delete the "Personal" collection
- **THEN** the delete button SHALL be disabled or the system SHALL show an error message stating the default collection cannot be deleted

### Requirement: Collection state persistence
The active collection SHALL persist across app restarts. On launch, the system SHALL restore the last active collection.

#### Scenario: Restart app with previously active collection
- **WHEN** the user had "School" as the active collection when closing the app
- **THEN** on next launch, "School" SHALL be the active collection and its data SHALL be displayed

#### Scenario: Previously active collection was deleted
- **WHEN** the app launches and the last active collection no longer exists
- **THEN** the system SHALL fall back to the "Personal" collection
