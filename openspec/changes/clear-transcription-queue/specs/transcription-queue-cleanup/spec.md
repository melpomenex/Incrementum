## ADDED Requirements

### Requirement: Clear queue entries by status
The system SHALL provide a `clear_transcription_queue` command that deletes queue entries matching a list of target statuses. Supported statuses: `failed`, `completed`, `cancelled`, `pending`, `processing`.

#### Scenario: Clear all failed entries
- **WHEN** the user clicks "Clear Failed" and there are entries with status `failed`
- **THEN** all failed entries are deleted from the queue and the queue view updates immediately

#### Scenario: Clear all completed entries
- **WHEN** the user clicks "Clear Completed" and there are entries with status `completed`
- **THEN** all completed entries are deleted from the queue and the queue view updates immediately

#### Scenario: Clear all entries
- **WHEN** the user clicks "Clear All"
- **THEN** all queue entries regardless of status are deleted; any active processing job is cancelled first

#### Scenario: Nothing to clear
- **WHEN** the user clicks a clear button and there are no entries matching the target status
- **THEN** no error is shown; the operation is a no-op

### Requirement: Remove individual queue entry
The system SHALL provide a `remove_transcription_entry` command that deletes a single queue entry by its ID.

#### Scenario: Remove a failed entry
- **WHEN** the user clicks remove on a specific failed queue entry
- **THEN** that entry is deleted and the queue view updates

#### Scenario: Remove a pending entry
- **WHEN** the user clicks remove on a pending entry
- **THEN** the entry is deleted; if it was queued in the auto-queue, it is also cancelled

### Requirement: Clear buttons in transcription settings UI
The AudioTranscriptionSettings queue section SHALL display action buttons for clearing the queue.

#### Scenario: Clear buttons visible when queue has entries
- **WHEN** the queue has at least one entry
- **THEN** "Clear Failed" (if any failed), "Clear Completed" (if any completed), and "Clear All" buttons are shown above the queue list

#### Scenario: No clear buttons when queue is empty
- **WHEN** the queue is empty
- **THEN** no clear buttons are shown
