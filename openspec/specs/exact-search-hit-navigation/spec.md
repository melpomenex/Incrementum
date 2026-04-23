# exact-search-hit-navigation Specification

## ADDED Requirements

### Requirement: Command palette content hits carry exact anchors
When the command palette returns a result because the query matched document or transcript content, the result SHALL include an exact anchor for the matched span in addition to any coarse page, section, or timestamp location.

#### Scenario: PDF result includes an exact text anchor
- **GIVEN** a PDF contains the searched word or phrase
- **WHEN** the command palette returns that PDF as a content match
- **THEN** the result SHALL include the page number of the match
- **AND** the result SHALL include enough anchor data to resolve the exact matched text span on that page

#### Scenario: EPUB result includes an exact book anchor
- **GIVEN** an EPUB contains the searched word or phrase
- **WHEN** the command palette returns that EPUB as a content match
- **THEN** the result SHALL include a CFI, CFI range, or equivalent exact text anchor for the matched span

#### Scenario: Transcript result includes an exact segment anchor
- **GIVEN** a transcript contains the searched word or phrase
- **WHEN** the command palette returns that transcript as a content match
- **THEN** the result SHALL include the exact transcript segment identifier and timestamp for the match

### Requirement: Selecting a content hit opens at the exact match
Selecting a content-backed search result from the command palette SHALL open the destination at the exact matched location, not merely near it.

#### Scenario: Book result opens to the exact paragraph
- **GIVEN** a user searches for a phrase contained in an EPUB book
- **WHEN** the user activates the result from the command palette
- **THEN** the EPUB viewer SHALL open at the exact matched paragraph or span
- **AND** the viewer MAY resolve the final position from a stored CFI or from an exact text quote match at open time

#### Scenario: Document result opens to the exact matched text
- **GIVEN** a user searches for a phrase contained in a PDF, HTML document, or markdown document
- **WHEN** the user activates the result from the command palette
- **THEN** the viewer SHALL scroll to the exact matched text span

#### Scenario: Transcript result opens to the exact spoken segment
- **GIVEN** a user searches for a phrase contained in a video transcript
- **WHEN** the user activates the result from the command palette
- **THEN** the viewer SHALL seek to the timestamp of the exact matching transcript segment

### Requirement: Exact-hit highlighting is visible after navigation
After the viewer opens from a command-palette content hit, the exact matched text or transcript segment SHALL be visibly highlighted.

#### Scenario: Document highlight confirms the jump
- **GIVEN** a document was opened from a command-palette content match
- **WHEN** the viewer finishes navigating
- **THEN** the matched text span SHALL be visibly highlighted

#### Scenario: Transcript highlight confirms the jump
- **GIVEN** a transcript-backed result was opened from the command palette
- **WHEN** the viewer seeks to the matching timestamp
- **THEN** the matching transcript segment SHALL be visibly highlighted

### Requirement: Keyboard and mouse activation use the same exact-hit behavior
Activating a content-backed result by pressing Enter or by clicking SHALL use the same exact-hit navigation and highlighting behavior.

#### Scenario: Enter key activation
- **GIVEN** a content-backed result is selected in the command palette
- **WHEN** the user presses Enter
- **THEN** the system SHALL open the item at the exact matched location
- **AND** highlight the matched text or segment

#### Scenario: Mouse activation
- **GIVEN** a content-backed result is visible in the command palette
- **WHEN** the user clicks the result
- **THEN** the system SHALL open the item at the exact matched location
- **AND** highlight the matched text or segment

### Requirement: Exact-hit resolution degrades predictably
If an exact anchor can no longer be resolved because the underlying content changed after indexing, the system SHALL degrade in a predictable order instead of silently opening an unrelated location.

#### Scenario: Exact anchor fails after content drift
- **GIVEN** a stored exact anchor no longer resolves in the current document content
- **WHEN** the user activates the result
- **THEN** the viewer SHALL attempt to resolve the stored text quote or nearest equivalent match
- **AND** only fall back to a coarse page, section, or timestamp jump if no exact or near-exact match can be found
