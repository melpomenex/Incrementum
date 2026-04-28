## ADDED Requirements

### Requirement: File existence validation at enqueue time
The `enqueue_all_untranscribed` command SHALL validate that each audio file path exists on disk before adding it to the transcription queue. Files that do not exist SHALL be skipped and included in a `skipped` list returned to the caller.

#### Scenario: All files exist
- **WHEN** "Transcribe All" is invoked and all untranscribed media files exist at their stored paths
- **THEN** all files are enqueued for transcription and the `skipped` list is empty

#### Scenario: Some files are missing
- **WHEN** "Transcribe All" is invoked and some audio files have been moved or deleted since import
- **THEN** existing files are enqueued normally; missing files are skipped and returned in the `skipped` list with their title and reason ("File not found: <path>")

#### Scenario: All files are missing
- **WHEN** "Transcribe All" is invoked and no audio files exist at their stored paths
- **THEN** no files are enqueued; the `skipped` list contains all files with their titles and reasons

### Requirement: Defensive file existence check at process time
The `auto_queue::process_entry` function SHALL check that the audio file exists before calling `prepare_audio`. If the file does not exist, the entry SHALL be marked as failed with a descriptive error message.

#### Scenario: File deleted between enqueue and process
- **WHEN** a transcription queue entry reaches the processing stage and the audio file no longer exists
- **THEN** the entry is marked as failed with the message "Audio file not found: <path>" and processing continues to the next entry

### Requirement: Frontend displays skipped files
The "Transcribe All" UI SHALL display a summary of any skipped files to the user after the enqueue operation completes.

#### Scenario: Some files skipped during Transcribe All
- **WHEN** the user clicks "Transcribe All" and some files were skipped
- **THEN** a notification or message is shown listing the skipped file names and the reason (e.g., "File not found")

#### Scenario: No files skipped
- **WHEN** the user clicks "Transcribe All" and all files were successfully enqueued
- **THEN** the existing success notification is shown with no skip information
