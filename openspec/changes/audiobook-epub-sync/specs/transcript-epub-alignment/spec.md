## ADDED Requirements

### Requirement: Align transcript segments to EPUB text positions
The system SHALL produce a mapping from each transcript segment (`startTime`, `endTime`, `text`) to an EPUB CFI position by fuzzy-matching the segment text against the EPUB's chapter content.

#### Scenario: Alignment runs for a linked audiobook-EPUB pair
- **WHEN** the split view opens for a linked pair that has no cached alignment
- **THEN** the system extracts text from each EPUB chapter
- **AND** fuzzy-matches each transcript segment to find the best CFI position
- **AND** stores the resulting `TranscriptSegment → CFI` mapping as cached alignment data

#### Scenario: Cached alignment is reused
- **WHEN** the split view opens for a pair that already has a cached alignment
- **THEN** the system loads the cached mapping without re-running alignment

### Requirement: Chapter-level matching by title
The system SHALL first match audiobook chapters to EPUB chapters by comparing chapter titles, establishing a coarse-grained mapping before segment-level alignment.

#### Scenario: Chapter titles match
- **WHEN** alignment runs and an audiobook chapter title matches an EPUB chapter title
- **THEN** all transcript segments within that chapter's time range are only searched against that EPUB chapter's content

#### Scenario: Chapter titles do not match
- **WHEN** alignment runs and an audiobook chapter title has no match in the EPUB TOC
- **THEN** the system searches transcript segments against all EPUB content sequentially

### Requirement: Alignment confidence reporting
The system SHALL report what percentage of transcript segments were successfully matched to EPUB positions.

#### Scenario: High match rate
- **WHEN** alignment completes with ≥70% of segments matched
- **THEN** the split view proceeds normally with synced scrolling

#### Scenario: Low match rate warning
- **WHEN** alignment completes with <50% of segments matched
- **THEN** the system displays a warning that the audiobook and EPUB may not correspond to the same edition
- **AND** offers chapter-level-only sync as a fallback

### Requirement: Alignment runs off main thread
The system SHALL perform alignment in a Web Worker to avoid blocking the UI.

#### Scenario: Large book alignment
- **WHEN** alignment is processing a book with many chapters or segments
- **THEN** the UI remains responsive and shows an alignment progress indicator
