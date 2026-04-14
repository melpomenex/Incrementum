## ADDED Requirements

### Requirement: Mark article as unread
The system SHALL allow users to mark a read article as unread, restoring it to the unread count and unread-only views.

#### Scenario: Mark as unread
- **WHEN** user right-clicks a read article and selects "Mark as unread" or presses the unread shortcut
- **THEN** the article's `is_read` flag is set to false
- **AND** the feed's unread count is incremented
- **AND** the article appears in unread-only views

#### Scenario: Unread time limit
- **WHEN** an article was read more than 30 days ago
- **THEN** the system still allows marking it as unread
- **AND** the article reappears in the unread view

### Requirement: Cutoff-based mark as read
The system SHALL allow users to mark all stories older than or newer than a specific timestamp as read.

#### Scenario: Mark older than as read
- **WHEN** user selects "Mark stories older than 1 week as read" from the feed context menu
- **THEN** all articles in the feed published more than 7 days ago are marked as read
- **AND** the unread count is updated

#### Scenario: Mark newer than as read
- **WHEN** user selects "Mark stories newer than 3 days as read"
- **THEN** all articles published within the last 3 days are marked as read

### Requirement: Auto-mark-as-read timing per feed
The system SHALL support per-feed auto-mark-as-read timing. Articles older than the configured duration are automatically marked as read.

#### Scenario: Configure auto-mark timing for a feed
- **WHEN** user sets "Auto-mark as read after: 7 days" in feed settings
- **THEN** articles in that feed older than 7 days are automatically marked as read
- **AND** the automation runs during feed refresh cycles

#### Scenario: Auto-mark never
- **WHEN** user sets "Auto-mark as read after: Never" for a feed
- **THEN** articles in that feed are never automatically marked as read regardless of age

### Requirement: Auto-mark-as-read inheritance for folders
The system SHALL support auto-mark-as-read timing at the folder level, with feeds inheriting the folder setting unless overridden.

#### Scenario: Folder-level auto-mark timing
- **WHEN** user sets "Auto-mark as read after: 14 days" on a folder
- **THEN** all feeds in that folder without an explicit override inherit the 14-day setting
- **AND** feeds with their own explicit setting keep their custom timing

### Requirement: River of News mode
The system SHALL provide a "River of News" view that merges all feeds in a folder into a single chronological stream.

#### Scenario: Enable River of News
- **WHEN** user selects a folder and enables "River of News" mode
- **THEN** articles from all feeds in the folder are merged into a single list sorted by publish date (newest first)
- **AND** each article shows its source feed name
- **AND** the feed sidebar collapses to show only the folder

#### Scenario: River of News with intelligence
- **WHEN** River of News is active and the user has trained classifiers
- **THEN** intelligence indicators and focus filtering apply across all feeds in the merged stream

### Requirement: Read Stories view
The system SHALL provide a "Read Stories" view that allows browsing previously read articles.

#### Scenario: Browse read stories
- **WHEN** user selects "Read Stories" from the view filter
- **THEN** articles that have been marked as read are displayed in reverse chronological order
- **AND** each article shows when it was read

#### Scenario: Search read stories
- **WHEN** user enters a search query while in the Read Stories view
- **THEN** only read stories matching the search query are displayed
