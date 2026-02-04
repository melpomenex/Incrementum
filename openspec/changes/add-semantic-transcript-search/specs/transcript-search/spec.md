# transcript-search Specification

## Purpose
Enables users to semantically search across video transcripts to find relevant content even when exact keywords don't match, with support for filtering by speaker and jumping to specific timestamps.

## ADDED Requirements

### Requirement: Semantic Transcript Search
The system SHALL provide semantic search across video transcripts using vector embeddings.

#### Scenario: User searches with natural language query
- **GIVEN** the user has imported YouTube videos with transcripts
- **AND** the transcripts have been indexed for semantic search
- **WHEN** the user opens the command palette (Cmd/Ctrl+K)
- **AND** enables semantic search mode
- **AND** types a natural language query like "explain neural networks"
- **THEN** the system SHALL return transcript segments that match semantically
- **AND** results SHALL be ranked by relevance score
- **AND** each result SHALL show the transcript excerpt, video title, and timestamp

#### Scenario: User clicks search result to jump to timestamp
- **GIVEN** the user has performed a semantic transcript search
- **AND** results are displayed
- **WHEN** the user clicks on a search result
- **THEN** the system SHALL open the video in the viewer
- **AND** seek to the timestamp of the matching transcript segment
- **AND** highlight the matching segment in the transcript panel

#### Scenario: Search returns no results
- **GIVEN** the user performs a semantic search
- **WHEN** no transcript chunks match the query semantically
- **THEN** the system SHALL display a helpful message
- **AND** suggest trying different search terms
- **AND** optionally show keyword search results as fallback

### Requirement: Transcript Search in Command Palette
The system SHALL integrate semantic transcript search into the command palette.

#### Scenario: Toggle between keyword and semantic search
- **GIVEN** the user has the command palette open
- **WHEN** the user toggles the search mode
- **THEN** the system SHALL switch between keyword and semantic search
- **AND** display the current mode indicator
- **AND** preserve the search query when switching modes

#### Scenario: Filter search by speaker
- **GIVEN** the user is searching transcripts that include speaker attribution
- **WHEN** the user selects a speaker from the filter dropdown
- **THEN** the system SHALL filter results to only show segments by that speaker
- **AND** display the speaker name in each result
- **AND** allow clearing the speaker filter

#### Scenario: Semantic search with video scope
- **GIVEN** the user has multiple videos indexed
- **WHEN** the user performs a semantic search
- **THEN** the system SHALL search across all indexed transcripts by default
- **AND** allow scoping the search to specific videos
- **AND** display which video each result is from

### Requirement: Transcript Panel Semantic Search
The system SHALL provide semantic search within the transcript panel.

#### Scenario: Search within current video transcript
- **GIVEN** the user is viewing a video with transcript panel open
- **WHEN** the user enters a semantic search query in the transcript panel
- **THEN** the system SHALL search within the current video's transcript
- **AND** highlight matching segments in the transcript view
- **AND** display relevance scores for each match

#### Scenario: Find similar transcript segments
- **GIVEN** the user is viewing a video transcript
- **WHEN** the user right-clicks on a transcript segment
- **AND** selects "Find similar"
- **THEN** the system SHALL find semantically similar segments
- **AND** display them in the transcript panel
- **AND** allow clicking to jump to each match

### Requirement: Speaker Attribution Filtering
The system SHALL support filtering transcript search results by speaker when available.

#### Scenario: Display speaker labels in search results
- **GIVEN** a transcript includes speaker information
- **WHEN** the user performs a semantic search
- **THEN** each result SHALL display the speaker's name
- **AND** the speaker filter dropdown SHALL be populated with available speakers

#### Scenario: Filter results to single speaker
- **GIVEN** the transcript has multiple speakers
- **WHEN** the user selects a specific speaker from the filter
- **THEN** the system SHALL only show results from that speaker
- **AND** update the result count to reflect the filter

#### Scenario: Transcripts without speaker data
- **GIVEN** a video transcript does not include speaker attribution
- **WHEN** the user performs a search
- **THEN** the system SHALL display results without speaker labels
- **AND** the speaker filter SHALL be hidden or disabled
- **AND** display a message that speaker filtering is unavailable

### Requirement: Search Result Ranking
The system SHALL rank semantic search results by relevance.

#### Scenario: Display relevance scores
- **GIVEN** the user performs a semantic search
- **WHEN** results are returned
- **THEN** each result SHALL display a relevance score (0-100%)
- **AND** results SHALL be sorted by relevance (highest first)

#### Scenario: Optional re-ranking for quality
- **GIVEN** the user has re-ranking enabled in settings
- **WHEN** the user performs a semantic search
- **THEN** the system SHALL apply re-ranking to the initial results
- **AND** use either cross-encoder or LLM-based re-ranking based on settings
- **AND** display the re-ranked results

### Requirement: Search Performance
The system SHALL provide fast semantic search responses.

#### Scenario: Search completes within acceptable time
- **GIVEN** the user has up to 100 videos indexed
- **WHEN** the user performs a semantic search
- **THEN** results SHALL be displayed within 2 seconds
- **AND** a loading indicator SHALL be shown if processing takes longer

#### Scenario: Background embedding generation
- **GIVEN** a new video is imported
- **WHEN** the transcript is available
- **THEN** the system SHALL generate embeddings in the background
- **AND** notify the user when indexing is complete
- **AND** allow the user to continue using the app during indexing

### Requirement: Error Handling
The system SHALL handle semantic search errors gracefully.

#### Scenario: No embedding provider configured
- **GIVEN** the user attempts to perform a semantic search
- **WHEN** no embedding provider is configured
- **THEN** the system SHALL display a helpful message
- **AND** provide a link to settings to configure a provider
- **AND** offer to fall back to keyword search

#### Scenario: Embedding generation fails
- **GIVEN** the system is generating embeddings
- **WHEN** the embedding API fails
- **THEN** the system SHALL log the error
- **AND** retry with exponential backoff
- **AND** fall back to an alternative provider if configured
- **AND** notify the user if all providers fail
