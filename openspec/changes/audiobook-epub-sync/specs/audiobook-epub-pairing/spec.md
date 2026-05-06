## ADDED Requirements

### Requirement: Auto-detect audiobook-EPUB pairs
The system SHALL automatically detect when a document has a complementary format (audiobook ↔ EPUB) by fuzzy-matching document titles across the library.

#### Scenario: Audiobook has a matching EPUB
- **WHEN** user right-clicks an audiobook document in the library
- **AND** a fuzzy title search finds an EPUB document with a similarity score above the match threshold
- **THEN** the context menu displays a "Read Along with [matched EPUB title]" option

#### Scenario: EPUB has a matching audiobook
- **WHEN** user right-clicks an EPUB document in the library
- **AND** a fuzzy title search finds an audiobook document with a similarity score above the match threshold
- **THEN** the context menu displays a "Listen Along with [matched audiobook title]" option

#### Scenario: No matching format exists
- **WHEN** user right-clicks an audiobook or EPUB with no title match in the library
- **THEN** no "Read Along" / "Listen Along" option appears in the context menu

#### Scenario: Multiple potential matches
- **WHEN** multiple documents of the complementary type match the title with similar scores
- **THEN** the context menu shows the best match as the primary action
- **AND** if scores are within 10% of each other, shows a submenu listing the top matches for the user to pick

### Requirement: Context menu integration
The "Read Along" / "Listen Along" option SHALL appear in the existing right-click context menus on document cards (grid mode), document rows (list mode), and schedule items.

#### Scenario: Right-click in grid mode (LibraryCard)
- **WHEN** user right-clicks a LibraryCard that has a matching pair
- **THEN** the existing context menu includes the "Read Along" / "Listen Along" option, placed after the "Open" item

#### Scenario: Right-click in list mode
- **WHEN** user right-clicks a list row that has a matching pair
- **THEN** the context menu includes the "Read Along" / "Listen Along" option

### Requirement: Pair detection is instant
The title matching SHALL complete fast enough that the context menu appears without perceptible delay.

#### Scenario: Right-click on a library with 500 documents
- **WHEN** user right-clicks a document in a library of 500 documents
- **THEN** the pair detection and context menu rendering completes in under 100ms
