# video-extracts Specification

## Purpose
Enable users to create timestamp-linked extracts from video content for spaced repetition review, supporting both manual creation and AI-assisted extraction via the Assistant. Video extracts integrate with the existing queue system and FSRS scheduling.

## ADDED Requirements

### Requirement: Video Extract Entity
The system SHALL provide a VideoExtract entity for storing timestamp-linked video segments with scheduling support.

#### Scenario: Creating a video extract with timestamp range
- **Given** a user is watching a YouTube video
- **When** the user selects a time range (e.g., 5:30-7:15) and creates an extract
- **Then** the system SHALL create a VideoExtract record with the document_id, start_time, end_time, title, and auto-populated transcript_text from the transcript segments within that range
- **And** the extract SHALL be assigned a unique ID
- **And** the date_created and date_modified SHALL be set to now

#### Scenario: Creating extract without transcript
- **Given** a video does not have an available transcript
- **When** the user creates a video extract
- **Then** the system SHALL create the extract with transcript_text set to null or empty
- **And** the extract SHALL still be valid and reviewable

#### Scenario: Extract validation
- **Given** a user attempts to create a video extract
- **When** the end_time is less than or equal to start_time
- **Then** the system SHALL reject the creation with an error message
- **When** the start_time is negative
- **Then** the system SHALL reject the creation with an error message
- **When** the duration exceeds 10 minutes (600 seconds)
- **Then** the system SHALL warn the user but allow creation if confirmed

### Requirement: Video Extract Scheduling
The system SHALL support FSRS-based scheduling for video extracts.

#### Scenario: Scheduling a video extract for review
- **Given** a video extract has been created
- **When** the extract is created with add_to_queue=true
- **Then** the system SHALL initialize the memory_state with default FSRS values
- **And** the next_review_date SHALL be set for the next day
- **And** the extract SHALL appear in the review queue

#### Scenario: Rating a video extract
- **Given** a video extract appears in the review queue
- **When** the user rates it (Again/Hard/Good/Easy)
- **Then** the system SHALL calculate the next review date using FSRS
- **And** the system SHALL update the memory_state (stability, difficulty)
- **And** the system SHALL increment review_count and reps
- **And** the system SHALL update last_review_date

#### Scenario: Extract not added to queue
- **Given** a user creates a video extract
- **When** the user sets add_to_queue=false or "watch-later" mode
- **Then** the extract SHALL be created with next_review_date set to null
- **And** the extract SHALL NOT appear in the review queue
- **And** the extract SHALL be viewable from the document's extract list

### Requirement: Transcript Text Population
The system SHALL automatically populate transcript_text from transcript segments.

#### Scenario: Populating transcript from segments
- **Given** a video has transcript segments available
- **When** a video extract is created with start_time=330 and end_time=435
- **Then** the system SHALL query all transcript segments where time >= 330 and time <= 435
- **And** the system SHALL concatenate the segment text in chronological order
- **And** the concatenated text SHALL be stored in transcript_text field

#### Scenario: Handling segment boundaries
- **Given** a video extract's start_time falls in the middle of a transcript segment
- **When** populating transcript_text
- **Then** the system SHALL include the full text of that segment
- **And** the system SHALL NOT attempt to trim the segment to the exact start_time

### Requirement: Video Extract CRUD Operations
The system SHALL provide create, read, update, and delete operations for video extracts.

#### Scenario: Retrieving extracts for a document
- **Given** a document has multiple video extracts
- **When** the user views the document
- **Then** the system SHALL display all video extracts ordered by start_time
- **And** each extract SHALL show title, time range, and transcript preview

#### Scenario: Updating an extract
- **Given** a video extract exists
- **When** the user edits the title, notes, or tags
- **Then** the system SHALL update the extract in the database
- **And** the date_modified SHALL be updated to now
- **And** timestamp ranges SHALL NOT be editable after creation (prevent breaking the extract)

#### Scenario: Deleting an extract
- **Given** a video extract exists
- **When** the user deletes the extract
- **Then** the system SHALL remove the extract from the database
- **And** the extract SHALL be removed from any queues
- **And** related review data SHALL be deleted

### Requirement: MCP Tool for Assistant
The system SHALL provide an MCP tool for the Assistant to extract video snippets.

#### Scenario: Assistant extracts by description
- **Given** the user asks the Assistant to "extract the part about quantum entanglement"
- **When** the Assistant calls the extract_video_snippet tool with document_id and description
- **Then** the system SHALL search the transcript for matching keywords
- **Or** the system SHALL use AI to semantically match the description
- **And** the system SHALL identify the best matching time range
- **And** the system SHALL create a VideoExtract with that range
- **And** the system SHALL return the extract ID to the Assistant

#### Scenario: Assistant extracts with explicit timestamps
- **Given** the user asks the Assistant to "extract from 5:30 to 7:00"
- **When** the Assistant calls extract_video_snippet with start_time=330 and end_time=420
- **Then** the system SHALL skip transcript search
- **And** the system SHALL create the extract with the exact timestamps provided
- **And** the system SHALL auto-generate a title based on the document

#### Scenario: Assistant tool parameters
- **Given** the Assistant calls extract_video_snippet
- **When** the tool is called with add_to_queue=true (default)
- **Then** the extract SHALL be scheduled for review
- **When** the tool is called with add_to_queue=false
- **Then** the extract SHALL be created but not scheduled

### Requirement: Queue Integration
The system SHALL integrate video extracts into the review queue.

#### Scenario: Video extract in queue
- **Given** a video extract is due for review
- **When** the user views the review queue
- **Then** the item SHALL display with type="video-extract"
- **And** the item SHALL show the title, time range (e.g., "5:30-7:15"), and transcript preview
- **And** the item SHALL show a thumbnail if available

#### Scenario: Opening video extract from queue
- **Given** a video extract appears in the review queue
- **When** the user clicks on the extract
- **Then** the system SHALL open the video player for the associated document
- **And** the player SHALL seek to the extract's start_time
- **And** optionally highlight the relevant segment in the transcript panel

#### Scenario: Rating video extract from queue
- **Given** a video extract is being reviewed
- **When** the user selects a rating (Again/Hard/Good/Easy)
- **Then** the system SHALL call rate_video_extract with the rating
- **And** the extract SHALL be removed from the current queue view
- **And** the extract SHALL reappear according to its next_review_date

### Requirement: Video Extract Notes and Tags
The system SHALL support user notes and tags on video extracts.

#### Scenario: Adding notes to an extract
- **Given** a video extract exists
- **When** the user adds notes (e.g., "Key insight: observer effect")
- **Then** the notes SHALL be stored in the notes field
- **And** the notes SHALL be displayed when viewing the extract

#### Scenario: Tagging extracts
- **Given** a video extract exists
- **When** the user adds tags (e.g., ["quantum", "physics"])
- **Then** the tags SHALL be stored in the tags field
- **And** the tags SHALL be displayed when viewing the extract
- **And** the tags SHALL be searchable/filterable in the extract list

### Requirement: Extract Duration Limits
The system SHALL enforce reasonable duration limits on video extracts.

#### Scenario: Maximum duration enforcement
- **Given** a user attempts to create an extract with duration > 10 minutes
- **When** the create operation is called
- **Then** the system SHALL warn the user that the extract is longer than recommended
- **And** the system SHALL require confirmation before creating
- **And** if confirmed, the extract SHALL be created

#### Scenario: Duration warning threshold
- **Given** a user attempts to create an extract with duration > 5 minutes
- **When** the create operation is called
- **Then** the system SHALL show a warning: "Long extracts are less effective for spaced repetition. Consider splitting into smaller segments."
- **And** the system SHALL allow creation without additional confirmation

### Requirement: Extract Thumbnail
The system SHALL support optional thumbnail images for video extracts.

#### Scenario: Thumbnail from video
- **Given** a video extract is created
- **When** a thumbnail is available (from video frame capture)
- **Then** the thumbnail_url SHALL be stored with the extract
- **And** the thumbnail SHALL be displayed in the queue and extract list

#### Scenario: Extract without thumbnail
- **Given** a video extract is created
- **When** no thumbnail capture is available
- **Then** the extract SHALL be created without a thumbnail
- **And** the UI SHALL display a generic video icon instead

### Requirement: Extract Listing by Document
The system SHALL allow users to view all extracts for a specific video document.

#### Scenario: Viewing document extracts
- **Given** a user is viewing a video document
- **When** the user opens the extracts panel
- **Then** all video extracts for that document SHALL be displayed
- **And** extracts SHALL be ordered chronologically by start_time
- **And** each extract SHALL show title, time range, and preview

#### Scenario: Extract count indicator
- **Given** a document has video extracts
- **When** the document appears in a list view
- **Then** a badge SHALL display the count of video extracts
- **And** the badge SHALL differentiate from text extract count if applicable
