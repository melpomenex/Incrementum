## ADDED Requirements

### Requirement: Nested folder hierarchy
The system SHALL support nested folders up to 5 levels deep. Folders MUST be stored in SQLite with a parent-child relationship.

#### Scenario: Create nested folder
- **WHEN** user creates a new folder inside an existing folder (via drag-and-drop or context menu "New Subfolder")
- **THEN** a new folder is created with its `parent_id` set to the containing folder's ID
- **AND** the folder tree in the sidebar updates to show the nesting

#### Scenario: Display nested folders
- **WHEN** the sidebar renders folders
- **THEN** folders are displayed in a collapsible tree with visual indentation per level
- **AND** each level can be independently expanded or collapsed

#### Scenario: Maximum nesting depth
- **WHEN** user attempts to create a folder deeper than 5 levels
- **THEN** the system rejects the creation and displays a "Maximum folder depth reached" message

### Requirement: Move feeds between nested folders
The system SHALL allow moving feeds between any folder at any nesting level, including the root level.

#### Scenario: Move feed to nested folder
- **WHEN** user drags a feed from the root level and drops it into a nested folder
- **THEN** the feed's `folder_id` is updated to the target folder
- **AND** the feed disappears from its previous location and appears in the target folder

### Requirement: Move folders between folders
The system SHALL allow moving folders into other folders (making them subfolders) and moving subfolders to the root level.

#### Scenario: Move folder into another folder
- **WHEN** user drags folder A and drops it onto folder B
- **THEN** folder A becomes a child of folder B (folder A's `parent_id` is set to folder B's ID)
- **AND** all feeds and subfolders within folder A move with it

#### Scenario: Move subfolder to root
- **WHEN** user drags a subfolder out of its parent folder to the root level
- **THEN** the folder's `parent_id` is set to null
- **AND** the folder appears at the root level in the sidebar

### Requirement: Folder icons
The system SHALL support custom icons for folders. Icons MAY be emoji characters from a preset list or uploaded custom images.

#### Scenario: Set folder icon via emoji
- **WHEN** user right-clicks a folder and selects "Change Icon", then picks an emoji from the icon picker
- **THEN** the selected emoji is displayed next to the folder name in the sidebar
- **AND** the emoji is persisted in the folder's `icon` column

#### Scenario: Set folder icon via image upload
- **WHEN** user uploads a small image (max 64x64px) as a folder icon
- **THEN** the image is saved to the app's data directory and the path is stored in the folder's `icon` column
- **AND** the sidebar renders the uploaded image as the folder icon

### Requirement: Feed icons
The system SHALL display feed favicons in the sidebar. When a feed has no favicon, the system MUST allow the user to set a custom icon (emoji or uploaded image).

#### Scenario: Auto-detect feed favicon
- **WHEN** a feed is subscribed
- **THEN** the system attempts to fetch the favicon from the feed's website domain (`/favicon.ico` and HTML `<link rel="icon">`)
- **AND** the favicon is displayed in the sidebar next to the feed title

#### Scenario: Set custom feed icon
- **WHEN** a feed has no auto-detected favicon and user right-clicks the feed and selects "Set Custom Icon"
- **THEN** the user can pick an emoji or upload an image as the feed icon
- **AND** the custom icon replaces the missing favicon in the sidebar

### Requirement: Drag-and-drop reordering
The system SHALL support drag-and-drop reordering of feeds within a folder and folders within the same parent.

#### Scenario: Reorder feeds within a folder
- **WHEN** user drags a feed and drops it between two other feeds in the same folder
- **THEN** the `sort_order` values are updated to reflect the new position
- **AND** the sidebar immediately reflects the new order

#### Scenario: Reorder folders
- **WHEN** user drags a folder and drops it at a new position among its siblings
- **THEN** the folder's `sort_order` is updated
- **AND** all sibling folders' sort orders are adjusted accordingly

### Requirement: Disable feeds without unsubscribing
The system SHALL allow users to disable a feed, which pauses fetching and hides it from the sidebar, without deleting subscription data or articles.

#### Scenario: Disable a feed
- **WHEN** user right-clicks a feed and selects "Disable"
- **THEN** the feed's `is_active` flag is set to false
- **AND** the feed is hidden from the main sidebar
- **AND** the feed's articles remain in the database
- **AND** automatic feed refresh skips this feed

#### Scenario: Re-enable a feed
- **WHEN** user views disabled feeds and clicks "Enable" on a disabled feed
- **THEN** the feed's `is_active` flag is set to true
- **AND** the feed reappears in the sidebar at its previous position
- **AND** automatic feed refresh resumes for this feed

### Requirement: Feed statistics
The system SHALL display feed statistics including estimated publish frequency, total article count, average articles per week, and last fetch timestamp.

#### Scenario: View feed statistics
- **WHEN** user right-clicks a feed and selects "Statistics"
- **THEN** a dialog shows: total articles, articles per week (average), estimated update frequency (daily/weekly/etc.), last fetch time, date subscribed, unread count
