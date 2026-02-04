# interest-playlists Specification

## Purpose
Enables users to create and manage interest-based playlists from semantic transcript search results, allowing automatic curation of video content around specific topics or themes.

## ADDED Requirements

### Requirement: Create Interest Playlist
The system SHALL allow users to create playlists based on semantic search queries.

#### Scenario: Create playlist from search results
- **GIVEN** the user has performed a semantic transcript search
- **AND** received relevant results
- **WHEN** the user clicks "Save as Playlist"
- **AND** enters a playlist name (e.g., "Machine Learning Fundamentals")
- **THEN** the system SHALL create a new interest playlist
- **AND** save the search query with the playlist
- **AND** save the current search results as playlist items

#### Scenario: Playlist includes video segments
- **GIVEN** an interest playlist is created
- **WHEN** viewing the playlist contents
- **THEN** the system SHALL display each item with:
  - Video title and thumbnail
  - Transcript excerpt
  - Timestamp
  - Relevance score
- **AND** allow playing each segment directly

#### Scenario: Auto-generate playlist name from query
- **GIVEN** the user performs a semantic search
- **WHEN** creating a playlist
- **THEN** the system SHALL suggest a name based on the search query
- **AND** allow the user to edit the suggested name

### Requirement: Interest Playlist Storage
The system SHALL store interest playlists with their semantic query definitions.

#### Scenario: Save playlist with query
- **GIVEN** a playlist is created from a search
- **WHEN** the playlist is saved
- **THEN** the system SHALL store:
  - Playlist name and description
  - Original semantic search query
  - List of video segments (document ID, chunk ID, timestamp)
  - Creation timestamp

#### Scenario: Query-based playlist refresh
- **GIVEN** a playlist was created with a semantic query
- **WHEN** new videos are imported that match the query
- **AND** the user clicks "Refresh Playlist"
- **THEN** the system SHALL re-run the semantic search
- **AND** add new matching segments to the playlist
- **AND** notify the user of new additions

### Requirement: Interest Playlist Management
The system SHALL provide UI for managing interest playlists.

#### Scenario: List all interest playlists
- **GIVEN** the user has created multiple interest playlists
- **WHEN** viewing the playlists section
- **THEN** the system SHALL display all playlists with:
  - Playlist name
  - Number of segments
  - Last updated timestamp
  - Thumbnail from first video

#### Scenario: Rename interest playlist
- **GIVEN** an interest playlist exists
- **WHEN** the user selects "Rename"
- **AND** enters a new name
- **THEN** the system SHALL update the playlist name
- **AND** refresh the playlist list

#### Scenario: Delete interest playlist
- **GIVEN** an interest playlist exists
- **WHEN** the user selects "Delete"
- **AND** confirms the deletion
- **THEN** the system SHALL remove the playlist
- **AND** remove all playlist-item associations

#### Scenario: Edit playlist query
- **GIVEN** an interest playlist exists
- **WHEN** the user edits the underlying query
- **THEN** the system SHALL update the stored query
- **AND** offer to refresh results with the new query

### Requirement: Interest Playlist Playback
The system SHALL enable playback of playlist segments.

#### Scenario: Play playlist sequentially
- **GIVEN** the user opens an interest playlist
- **WHEN** the user clicks "Play All"
- **THEN** the system SHALL open the first video at the first segment's timestamp
- **AND** automatically advance to the next segment after each finishes
- **AND** continue through all playlist items

#### Scenario: Play individual segment
- **GIVEN** the user is viewing an interest playlist
- **WHEN** the user clicks on a specific segment
- **THEN** the system SHALL open the video at that segment's timestamp
- **AND** highlight the relevant transcript portion

#### Scenario: Shuffle playlist playback
- **GIVEN** the user is viewing an interest playlist
- **WHEN** the user enables "Shuffle" and clicks "Play All"
- **THEN** the system SHALL randomize the playback order
- **AND** play segments in the shuffled order

### Requirement: Dynamic Playlist Updates
The system SHALL support dynamic updating of playlists based on semantic queries.

#### Scenario: Auto-refresh on new video import
- **GIVEN** the user has interest playlists defined
- **WHEN** a new video is imported and indexed
- **AND** the video's content matches a playlist's query
- **THEN** the system SHALL offer to add matching segments to the playlist
- **AND** display a notification with the count of new matches

#### Scenario: Manual playlist refresh
- **GIVEN** the user has an interest playlist
- **WHEN** the user clicks "Refresh"
- **THEN** the system SHALL re-run the semantic query
- **AND** add any new matching segments
- **AND** optionally remove segments that no longer match

#### Scenario: Playlist refresh settings
- **GIVEN** the user has interest playlists
- **WHEN** configuring playlist settings
- **THEN** the user SHALL be able to:
  - Enable/disable auto-refresh
  - Set maximum segment count per playlist
  - Choose whether to remove non-matching segments on refresh

### Requirement: Interest Playlist Discovery
The system SHALL help users discover and organize interest playlists.

#### Scenario: Suggest playlists from search history
- **GIVEN** the user has performed several semantic searches
- **WHEN** viewing the playlists section
- **THEN** the system SHALL suggest creating playlists from recent searches
- **AND** display the search query and result count for each suggestion

#### Scenario: Combine multiple playlists
- **GIVEN** the user has multiple related playlists
- **WHEN** the user selects two or more playlists
- **AND** clicks "Combine"
- **THEN** the system SHALL create a new playlist with merged segments
- **AND** preserve relevance scores from each source

#### Scenario: Export playlist
- **GIVEN** the user has an interest playlist
- **WHEN** the user clicks "Export"
- **THEN** the system SHALL export the playlist as JSON
- **AND** include playlist metadata and segment references
- **AND** allow importing playlists on other devices

### Requirement: Interest Playlist Sharing
The system SHALL support sharing interest playlists between users.

#### Scenario: Share playlist via link
- **GIVEN** the user has an interest playlist
- **WHEN** the user clicks "Share"
- **THEN** the system SHALL generate a shareable link
- **AND** encode the playlist query and metadata
- **AND** allow other users to import the playlist

#### Scenario: Import shared playlist
- **GIVEN** another user has shared a playlist link
- **WHEN** the user opens the link
- **THEN** the system SHALL import the playlist definition
- **AND** run the semantic query against their library
- **AND** create a playlist with matching segments from their videos

### Requirement: Interest Playlist Analytics
The system SHALL provide analytics for interest playlists.

#### Scenario: Display playlist statistics
- **GIVEN** the user opens an interest playlist
- **WHEN** viewing the playlist details
- **THEN** the system SHALL display:
  - Total duration of all segments
  - Number of unique videos
  - Average relevance score
  - Date created and last modified

#### Scenario: Track playlist usage
- **GIVEN** the user has interest playlists
- **WHEN** the user plays segments from playlists
- **THEN** the system SHALL track:
  - Last played timestamp
  - Play count for each segment
  - Play count for the entire playlist
- **AND** display this information in the playlist view
