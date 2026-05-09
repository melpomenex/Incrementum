## ADDED Requirements

### Requirement: User can search podcast feeds by text query
The system SHALL provide a search input in the podcast feed sidebar that filters the visible feed list in real-time as the user types. The search SHALL match case-insensitively against each feed's title, author, and description fields. The search input SHALL display a search icon, a placeholder text, and a clear button when text is present.

#### Scenario: User types a query matching feed titles
- **WHEN** user types "science" in the search input
- **THEN** the feed list shows only feeds whose title, author, or description contains "science" (case-insensitive)

#### Scenario: User types a query matching feed authors
- **WHEN** user types "NPR" in the search input
- **THEN** the feed list shows feeds where the author field contains "NPR"

#### Scenario: User clears the search query
- **WHEN** user clicks the clear button or deletes all text in the search input
- **THEN** the feed list shows all subscribed feeds unfiltered

### Requirement: Search shows empty state when no feeds match
The system SHALL display a clear empty-state message when the search query matches no feeds, indicating that no results were found for the given query.

#### Scenario: Search query matches no feeds
- **WHEN** user types a query that matches no feed's title, author, or description
- **THEN** the feed list area shows an empty state message (e.g., "No podcasts found")

#### Scenario: Empty state clears when query changes
- **WHEN** user modifies the query to match at least one feed
- **THEN** the empty state is replaced with the matching feed list

### Requirement: Search preserves feed selection and context menus
The system SHALL preserve the ability to select a feed and access its context menu (right-click) while search filtering is active. If the currently selected feed is filtered out by the search, the selection SHALL be cleared and the episode panel SHALL show a prompt to select a feed.

#### Scenario: Selected feed remains visible during search
- **WHEN** user has feed "Tech Talk" selected and types a query matching "Tech Talk"
- **THEN** "Tech Talk" remains selected and its episodes are still displayed

#### Scenario: Selected feed is filtered out by search
- **WHEN** user has feed "Tech Talk" selected and types a query that does not match "Tech Talk"
- **THEN** the selection is cleared and the episode panel shows the default empty state

### Requirement: Search handles HTML in feed descriptions
The system SHALL strip HTML markup from feed descriptions before performing search matching, so that HTML tags do not cause false positive or false negative matches.

#### Scenario: Feed description contains HTML
- **WHEN** a feed has description `<p>Learn about <b>science</b></p>` and user types "science"
- **THEN** the feed appears in search results (matching on plain text content)

#### Scenario: Search query matches an HTML tag name
- **WHEN** a feed has description `<p>Hello world</p>` and user types "p"
- **THEN** the feed does NOT match based on the `<p>` tag — only plain text content is searched
