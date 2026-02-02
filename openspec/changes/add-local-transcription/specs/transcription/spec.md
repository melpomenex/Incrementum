# Transcription Capabilities

## ADDED Requirements

### Requirement: Manage local Whisper models
The system MUST provide a mechanism to download, verify, and switch between different Whisper models.

#### Scenario: First-time setup
Given the user has not enabled transcription
When they navigate to the Transcription settings or click "Enable Transcripts"
Then they should see a prompt to download the default model (English Fast).
And clicking "Download" should show a progress bar.
And upon completion, the system should verify the model hash.

#### Scenario: Switching language profiles
Given the user has "English Fast" installed
When they switch the profile to "Multilingual Balanced"
Then the system should prompt to download the new model.
And the previous model should be kept (unless explicitly deleted).

### Requirement: Perform offline audio transcription
The system MUST be able to convert audio files and generate transcripts using the local engine without network access.

#### Scenario: Transcribing a chapter
Given a book with audio
When the user requests a transcript for a chapter
Then the system should check if a transcript already exists in the DB.
If not, it should add the chapter to the transcription queue.
And the status should update to "Pending" -> "Processing".

#### Scenario: Audio conversion
Given an MP3 or M4B audio file
When the transcription job starts
Then the system should first convert the file to 16kHz 16-bit Mono WAV (required by whisper.cpp) in a temporary location.
And this temporary file should be deleted after transcription completes.

#### Scenario: Offline capabilities
Given the models are downloaded
When the device is offline
Then transcription tasks should complete successfully without network access.

### Requirement: Display and sync transcripts with playback
The UI MUST present transcript text to the user and synchronize highlighting with audio playback.

#### Scenario: Viewing transcript
Given a completed transcript
When the user opens the Transcript view
Then they should see the text segments.
And clicking a segment should seek the audio player to that timestamp.

#### Scenario: Real-time sync
Given audio is playing
When the playback position changes
Then the currently active transcript segment should be visually highlighted.
And if "Auto-scroll" is enabled, the view should scroll to keep the segment visible.