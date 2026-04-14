## ADDED Requirements

### Requirement: Tag saved stories
The system SHALL allow users to assign one or more tags to saved/starred articles. Tags are free-form text labels created at save time.

#### Scenario: Save with tags
- **WHEN** user stars/saves an article and the tag input is visible
- **THEN** the user can type tag names (comma-separated or Enter to add) before or after saving
- **AND** tags are stored and associated with the article

#### Scenario: Add tags to existing saved story
- **WHEN** user opens the tag editor on an already-saved article
- **THEN** existing tags are displayed as removable pills
- **AND** user can add new tags by typing in the input field

#### Scenario: Remove a tag
- **WHEN** user clicks the remove button on a tag pill
- **THEN** the tag is dissociated from the article
- **AND** if this was the only article with that tag, the tag record is retained for potential future use

### Requirement: Tag auto-completion
The system SHALL provide auto-completion for tag input based on existing tags in the user's collection.

#### Scenario: Auto-complete tag input
- **WHEN** user begins typing a tag name
- **THEN** a dropdown shows matching existing tags filtered by the typed prefix
- **AND** user can select a tag from the dropdown or continue typing a new tag name

### Requirement: Filter saved stories by tag
The system SHALL allow filtering the saved stories view by one or more tags.

#### Scenario: Filter by single tag
- **WHEN** user clicks on a tag in the tag sidebar or filter bar
- **THEN** only saved stories with that tag are displayed

#### Scenario: Filter by multiple tags
- **WHEN** user selects multiple tags in the filter
- **THEN** only saved stories that have ALL selected tags are displayed (AND logic)

### Requirement: Tag as virtual feed
The system SHALL allow users to view a tag's saved stories as if it were a feed in the sidebar.

#### Scenario: View tag as feed
- **WHEN** user clicks on a tag in the sidebar tag list
- **THEN** the article list displays all saved stories with that tag in chronological order
- **AND** the tag acts as a filterable, searchable virtual feed

### Requirement: Search within tagged stories
The system SHALL support full-text search within saved stories, optionally scoped to a specific tag.

#### Scenario: Search within a tag
- **WHEN** user has a tag filter active and enters a search query
- **THEN** only saved stories matching both the tag and the search query are displayed

### Requirement: Tag management
The system SHALL provide a tag management view where users can rename and merge tags.

#### Scenario: Rename a tag
- **WHEN** user opens tag management and renames a tag from "AI" to "Artificial Intelligence"
- **THEN** all articles tagged "AI" are updated to "Artificial Intelligence"
- **AND** the old tag name is removed

#### Scenario: Merge tags
- **WHEN** user selects two tags and clicks "Merge"
- **THEN** all articles from both tags are consolidated under the target tag name
- **AND** the source tag is removed
