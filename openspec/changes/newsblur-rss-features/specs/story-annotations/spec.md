## ADDED Requirements

### Requirement: Text highlighting on articles
The system SHALL allow users to select text within an article and save it as a highlighted annotation.

#### Scenario: Create a highlight
- **WHEN** user selects text within an article in the reader panel and clicks "Highlight" from the context menu or toolbar
- **THEN** the selected text is stored as a highlight annotation with its character offsets
- **AND** the highlighted text is visually marked with a highlight color in the reader
- **AND** a default highlight color (yellow) is applied

#### Scenario: Change highlight color
- **WHEN** user selects a different color from the highlight color picker before or after creating a highlight
- **THEN** the highlight annotation's color is updated
- **AND** the visual highlight in the reader reflects the new color

### Requirement: Multiple highlights per article
The system SHALL support multiple non-overlapping highlights on the same article.

#### Scenario: Two highlights on one article
- **WHEN** user creates a highlight on paragraph 1 and another highlight on paragraph 3 of the same article
- **THEN** both highlights are stored and rendered independently
- **AND** both appear in the annotations list for that article

#### Scenario: Prevent overlapping highlights
- **WHEN** user attempts to highlight text that overlaps with an existing highlight
- **THEN** the system merges the new selection with the existing highlight or prompts the user to choose

### Requirement: Private notes on articles
The system SHALL allow users to attach private notes to any article. Notes are free-form text stored with the article.

#### Scenario: Add a note to an article
- **WHEN** user clicks the "Add Note" button on an article and types a note
- **THEN** the note is saved and associated with the article
- **AND** a note indicator appears on the article in the story list

#### Scenario: Edit a note
- **WHEN** user clicks on an existing note to edit it
- **THEN** the note text is loaded into an editable field
- **AND** changes are saved when the user clicks "Save" or blurs the field

#### Scenario: Delete a note
- **WHEN** user clicks "Delete" on a note
- **THEN** the note is permanently removed from the article

### Requirement: Annotations panel
The system SHALL provide an annotations panel in the reader that lists all highlights and notes for the current article.

#### Scenario: View annotations panel
- **WHEN** user opens the annotations panel while reading an article
- **THEN** all highlights are listed with their text excerpt and color
- **AND** all notes are listed with their full text
- **AND** clicking a highlight in the panel scrolls the reader to that highlighted passage

### Requirement: Annotations on saved stories
The system SHALL automatically persist highlights and notes when an article is saved/starred. Annotations on non-saved articles MAY be kept in memory for the session.

#### Scenario: Annotations survive save
- **WHEN** user adds highlights and notes to an article, then stars it
- **THEN** all annotations are persisted to the database
- **AND** they are available when viewing the saved article in future sessions

#### Scenario: Session-only annotations
- **WHEN** user adds highlights to an article that is not saved/starred
- **THEN** annotations persist for the current session
- **AND** annotations are discarded when the session ends or the article is removed from view

### Requirement: Share story with comment
The system SHALL allow users to share an article with an optional personal comment. Shared stories are stored locally with their comments.

#### Scenario: Share with comment
- **WHEN** user clicks "Share" on an article and types a comment
- **THEN** the article and comment are saved as a shared entry
- **AND** the shared entry appears in a "Shared Stories" view

#### Scenario: Share without comment
- **WHEN** user clicks "Share" on an article without entering a comment
- **THEN** the article is shared without a comment
- **AND** it appears in the "Shared Stories" view with just the article metadata
