## ADDED Requirements

### Requirement: Session snapshot is saved automatically
The system SHALL save a session snapshot to localStorage whenever the application is backgrounded, closed, or when the tab layout changes. The snapshot SHALL include: the full tab list, the root pane tree, per-tab restore data, sidebar collapsed state, current view, and active collection ID.

#### Scenario: User closes the app with a split-screen layout
- **WHEN** the user has a book open in the left pane and a podcast in the right pane, and closes the application
- **THEN** the system saves a session snapshot containing both tabs, their restore data (document ID, podcast feed/episode), the split pane structure with direction and sizes, and the sidebar state

#### Scenario: App is backgrounded on mobile
- **WHEN** the application visibility state changes to "hidden"
- **THEN** the system saves the current session snapshot

### Requirement: Session is restored on app launch
When the `restoreSession` setting is enabled (default), the system SHALL restore the full session state from the last saved snapshot on app launch, including tabs, split pane layout, active tab per pane, and UI state.

#### Scenario: User reopens app after closing with active documents
- **WHEN** the user reopens the application and `restoreSession` is `true`
- **THEN** the system restores all previously open tabs, their positions in the split pane layout, and the active tab selection in each pane

#### Scenario: Session restore is disabled
- **WHEN** the user has set `restoreSession` to `false` and launches the application
- **THEN** the system creates the default tabs (Dashboard + Queue) without restoring any previous session

#### Scenario: No saved session exists
- **WHEN** the user launches the application for the first time (no saved session in localStorage)
- **THEN** the system creates the default tabs (Dashboard + Queue)

### Requirement: Restore validates content references
The system SHALL validate that content referenced in the session snapshot still exists before restoring each tab. Tabs referencing deleted or unavailable content SHALL be skipped.

#### Scenario: Previously open document has been deleted
- **WHEN** the session snapshot contains a document-viewer tab for document ID "abc123" but that document no longer exists in the database
- **THEN** the system skips that tab and does not create it

#### Scenario: Previously open podcast feed has been removed
- **WHEN** the session snapshot contains a podcast tab for feed ID "xyz789" but that feed is no longer subscribed
- **THEN** the system skips that tab and does not create it

#### Scenario: Empty pane after validation
- **WHEN** all tabs in a pane reference deleted content, resulting in an empty pane
- **THEN** the system collapses that pane, merging its parent split into the remaining sibling

### Requirement: Tab restore data captures per-type context
Each tab SHALL store type-specific restore data in its `data` field that is sufficient to reconstruct the tab's content on reload. The system SHALL persist and restore this data as part of the session snapshot.

#### Scenario: Document viewer tab stores document reference
- **WHEN** a document-viewer tab is saved as part of the session snapshot
- **THEN** its `data` field contains `{ documentId: "<id>" }` identifying the document to reopen

#### Scenario: Podcast tab stores feed reference
- **WHEN** a podcast tab is saved as part of the session snapshot
- **THEN** its `data` field contains `{ feedId: "<id>" }` identifying the podcast feed to reopen

#### Scenario: Audiobook-EPUB sync tab stores both references
- **WHEN** an audiobook-epub-sync tab is saved as part of the session snapshot
- **THEN** its `data` field contains both the audiobook document ID and the EPUB document ID

### Requirement: UI state is restored alongside tabs
The system SHALL restore the following UI state from the session snapshot: sidebar collapsed state, current view name, and active collection ID.

#### Scenario: Sidebar was collapsed when app was closed
- **WHEN** the user had the sidebar collapsed when the app was closed
- **THEN** the sidebar is collapsed when the app is reopened

#### Scenario: A specific collection was active
- **WHEN** the user had collection "Science Papers" active when the app was closed
- **THEN** that collection is selected as active when the app is reopened

### Requirement: Session restore setting is available in General settings
The system SHALL provide a `restoreSession` toggle in the General settings section, defaulting to `true`. When toggled off, the application SHALL NOT restore previous session state on launch.

#### Scenario: User toggles off session restore
- **WHEN** the user navigates to Settings > General and disables "Restore session on startup"
- **THEN** subsequent app launches create default tabs without restoring previous state

#### Scenario: User re-enables session restore
- **WHEN** the user re-enables "Restore session on startup"
- **THEN** the next app launch restores the most recently saved session snapshot
