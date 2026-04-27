## ADDED Requirements

### Requirement: Transcript text is full-text searchable
The system SHALL ensure that transcript text stored in `documents.content` is indexed by the existing FTS5 `document_search` table and returned in search results.

#### Scenario: Transcript appears in search results
- **WHEN** a transcription job completes and the document `content` is updated with transcript text
- **THEN** the existing FTS5 trigger on the `documents` table inserts/updates the `document_search` entry
- **AND** searching for terms from the transcript returns the document in results

#### Scenario: Search result shows transcript excerpt
- **WHEN** a search query matches text within a transcript
- **THEN** the search result displays a snippet from the transcript with the matching term highlighted
- **AND** the result is labeled as a media document with transcript

### Requirement: Transcript text is extractable
The system SHALL make transcript text available for the existing text extraction workflow, allowing users to highlight, extract, and create flashcards from transcript content.

#### Scenario: User selects transcript text for extraction
- **WHEN** a user opens a media document with a completed transcript
- **AND** selects a portion of the transcript text
- **THEN** the selected text can be extracted using the existing extraction mechanism (Ctrl+E or extraction button)
- **AND** the extract is stored with the correct `document_id` and `page_number` referencing the transcript segment

#### Scenario: Transcript segments as extraction source
- **WHEN** a user views transcript segments in the media viewer
- **THEN** each segment with timestamp is a valid extraction target
- **AND** extracting from a segment includes the timestamp in the extract metadata

### Requirement: Transcript search matches navigate to timestamp
When a search result originates from a transcript, selecting the result SHALL navigate the user to the corresponding timestamp in the media player.

#### Scenario: Search result navigation to timestamp
- **WHEN** a user clicks a search result that matches a transcript segment
- **THEN** the media document opens in the viewer
- **AND** the media player seeks to the timestamp of the matched segment
- **AND** the matched text is highlighted in the transcript view
