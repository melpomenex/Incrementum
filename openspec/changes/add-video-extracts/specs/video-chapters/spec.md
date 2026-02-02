# video-chapters Specification

## Purpose
Enable automatic and manual chapter detection for videos, helping users navigate long-form content and understand video structure at a glance.

## ADDED Requirements

### Requirement: YouTube Chapter Auto-Detection
The system SHALL automatically detect and import chapters from YouTube video metadata.

#### Scenario: Auto-detecting YouTube chapters
- **Given** a YouTube video document is opened
- **When** the video has chapter markers in its metadata
- **Then** the system SHALL fetch the video info via yt-dlp
- **And** the system SHALL parse the chapter field from the metadata
- **And** the system SHALL create VideoChapter records for each chapter
- **And** the chapters SHALL be displayed in the chapters panel

#### Scenario: Chapter metadata format
- **Given** YouTube returns chapter data in various formats
- **When** parsing chapters
- **Then** the system SHALL handle both JSON array format and HTTP-based chapter formats
- **And** the system SHALL parse title, start_time, and end_time for each chapter
- **And** the system SHALL assign sequential order values

#### Scenario: Existing chapters not overwritten
- **Given** a video already has manually created chapters
- **When** the user opens the video
- **Then** the system SHALL NOT overwrite existing chapters with YouTube metadata
- **And** the system SHALL display the existing chapters
- **And** an option SHALL be provided to "Refresh from YouTube" if user wants to override

### Requirement: Manual Chapter Creation
The system SHALL allow users to manually create and edit chapters.

#### Scenario: Creating a manual chapter
- **Given** a user is watching a video
- **When** the user clicks "Add Chapter" at current timestamp
- **Then** a dialog SHALL appear to enter chapter title
- **And** the start_time SHALL be pre-filled with current playback position
- **And** upon saving, the chapter SHALL be stored in the database
- **And** the chapters list SHALL update to show the new chapter

#### Scenario: Editing chapter times
- **Given** a manual chapter exists
- **When** the user edits the chapter
- **Then** the user SHALL be able to modify title, start_time, and end_time
- **And** validation SHALL ensure end_time > start_time
- **And** overlapping chapters SHALL be allowed (user discretion)

#### Scenario: Deleting a chapter
- **Given** a chapter exists
- **When** the user deletes the chapter
- **Then** the chapter SHALL be removed from the database
- **And** the chapters list SHALL update

### Requirement: Chapter Ordering and Overlap
The system SHALL handle chapter ordering and potential overlaps.

#### Scenario: Sequential chapter display
- **Given** multiple chapters exist for a video
- **When** the chapters are displayed
- **Then** they SHALL be ordered by their start_time
- **And** the order field SHALL be maintained for database consistency

#### Scenario: Overlapping chapters
- **Given** two chapters have overlapping time ranges
- **When** both are displayed
- **Then** both chapters SHALL be shown in the list
- **And** the current chapter indicator SHALL highlight all chapters that contain the current timestamp

#### Scenario: Chapter gaps
- **Given** chapters exist but don't cover the entire video
- **When** the user is in an uncovered time range
- **Then** no chapter SHALL be highlighted as current
- **And** playback SHALL continue normally

### Requirement: Chapter Navigation
The system SHALL allow users to navigate videos using chapters.

#### Scenario: Clicking chapter to seek
- **Given** the chapters panel is open
- **When** the user clicks on a chapter
- **Then** the video player SHALL seek to the chapter's start_time
- **And** playback SHALL remain paused (user must press play)

#### Scenario: Current chapter indicator
- **Given** a video is playing
- **When** the current time is within a chapter's time range
- **Then** that chapter SHALL be visually highlighted
- **And** the chapter title MAY be displayed in the player controls

#### Scenario: Chapter progress display
- **Given** a video is playing within a chapter
- **When** the chapter is displayed in the list
- **Then** a progress indicator SHALL show the percentage through the chapter
- **And** the progress SHALL be calculated as (current_time - start_time) / (end_time - start_time)

### Requirement: AI-Powered Chapter Detection
The system SHALL support optional AI-powered chapter detection from transcripts.

#### Scenario: On-demand AI chapter detection
- **Given** a video has a transcript but no metadata chapters
- **When** the user clicks "Auto-detect Chapters with AI"
- **Then** the system SHALL send the transcript to an LLM
- **And** the LLM SHALL be prompted to identify 5-10 minute segments where topics shift
- **And** the system SHALL parse the LLM response into chapter boundaries
- **And** the system SHALL save the detected chapters to the database
- **And** the chapters panel SHALL update to show the new chapters

#### Scenario: AI chapter detection prompt
- **Given** the LLM is called for chapter detection
- **When** constructing the prompt
- **Then** the system SHALL include the full transcript text
- **And** the system SHALL request chapter boundaries as timestamp ranges with titles
- **And** the system SHALL specify a target chapter length of 5-10 minutes
- **And** the system SHALL request 5-15 chapters depending on video length

#### Scenario: AI detection error handling
- **Given** the LLM fails to return valid chapter data
- **When** the response is parsed
- **Then** the system SHALL display an error message to the user
- **And** no chapters SHALL be created
- **And** the system MAY offer to retry or adjust parameters

#### Scenario: AI chapter confirmation
- **Given** AI chapter detection succeeds
- **When** chapters are detected
- **Then** the system SHALL display the detected chapters in a preview dialog
- **And** the user SHALL confirm before saving to database
- **And** the user SHALL be able to edit chapters before confirming

### Requirement: Chapter Persistence
The system SHALL persist chapters across application sessions.

#### Scenario: Chapters persist after app restart
- **Given** a video has manually created or AI-detected chapters
- **When** the user closes and reopens the application
- **Then** the chapters SHALL still be available
- **And** they SHALL display correctly in the chapters panel

#### Scenario: YouTube chapters cached
- **Given** a YouTube video's chapters were auto-detected
- **When** the user closes and reopens the video
- **Then** the cached chapters SHALL be displayed
- **And** no additional API call SHALL be made to YouTube

### Requirement: Chapter UI Controls
The system SHALL provide UI for viewing and managing chapters.

#### Scenario: Chapters panel tabs
- **Given** the video features panel is open
- **When** the user switches to the Chapters tab
- **Then** all chapters for the video SHALL be displayed
- **And** an "Add Chapter" button SHALL be visible
- **And** an "Auto-detect with AI" button SHALL be visible (if transcript available)

#### Scenario: Chapter display format
- **Given** a chapter is displayed in the list
- **When** rendering the chapter
- **Then** the chapter SHALL show its order number (1, 2, 3...)
- **And** the chapter SHALL show its title
- **And** the chapter SHALL show its time range in MM:SS format
- **And** if currently playing, a progress percentage SHALL be shown

#### Scenario: Empty chapters state
- **Given** a video has no chapters
- **When** the chapters tab is opened
- **Then** a message SHALL display "No chapters available"
- **And** options to add chapters manually or auto-detect SHALL be shown
