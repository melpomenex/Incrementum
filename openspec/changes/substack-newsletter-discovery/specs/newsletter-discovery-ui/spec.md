## ADDED Requirements

### Requirement: Live search input
The Newsletter Directory SHALL provide a search input that queries the Substack API in real-time as the user types (debounced 500ms).

#### Scenario: User types search query
- **WHEN** user types "AI" in the search bar and pauses for 500ms
- **THEN** the system displays a loading indicator and queries `searchSubstack("AI")`
- **THEN** search results replace the static directory listing

#### Scenario: Clear search returns to directory
- **WHEN** user clears the search input
- **THEN** the system displays the default curated directory entries

#### Scenario: Search error handling
- **WHEN** the Substack search request fails (network error, CORS, rate limit)
- **THEN** the system displays an error message inline with a retry button

### Requirement: Search results display
The system SHALL display Substack search results as newsletter cards showing publication name, author, description, and subscribe action.

#### Scenario: Post-type search result
- **WHEN** search returns items of type "post"
- **THEN** each result shows the post title, publication name, author, a truncated description, and a "Subscribe" button that subscribes to the publication (not just the post)

#### Scenario: Profile-type search result
- **WHEN** search returns items of type "profileSearchResults"
- **THEN** each profile shows the author name, handle, bio, photo, and a "Subscribe" button

#### Scenario: Subscribe from search result
- **WHEN** user clicks "Subscribe" on a search result
- **THEN** the system derives the RSS feed URL for the publication, constructs a Feed object, and calls `subscribeToFeedAuto(feed)`
- **THEN** the button changes to "Subscribed" with a checkmark

### Requirement: Category browsing from Substack categories
The system SHALL allow browsing newsletters by Substack content categories.

#### Scenario: Category tab selection
- **WHEN** user selects a category (e.g., "Technology")
- **THEN** the system fetches the category feed from Substack and displays publication results

#### Scenario: Category combined with search
- **WHEN** user has a category selected and types a search query
- **THEN** the system prioritizes the search query (Substack's search endpoint) over category browsing

### Requirement: Publication preview
The system SHALL allow users to preview a publication before subscribing by showing recent posts and metadata.

#### Scenario: Preview modal
- **WHEN** user clicks on a search result or curated entry
- **THEN** the system opens a preview modal showing the publication description, author info, subscriber count (if available), and up to 5 recent post titles with dates

#### Scenario: Subscribe from preview
- **WHEN** user clicks "Subscribe" in the preview modal
- **THEN** the system subscribes to the publication's RSS feed and closes the modal

### Requirement: Integration with existing subscription state
The system SHALL reflect existing RSS subscriptions in the directory UI.

#### Scenario: Already-subscribed publication
- **WHEN** the user views search results or curated entries and a publication is already in their subscribed feeds (matched by feed URL)
- **THEN** the "Subscribe" button is replaced with a "Subscribed" badge

#### Scenario: Subscription status loads on mount
- **WHEN** the Newsletter Directory tab is opened
- **THEN** the system fetches the user's subscribed feeds and cross-references them with displayed results

### Requirement: Editor's Picks section
The system SHALL retain the existing curated newsletter directory as a prominent "Editor's Picks" section above live search results.

#### Scenario: Default view shows curated picks
- **WHEN** the Newsletter Directory tab is opened with no search query
- **THEN** the system displays the curated newsletter entries from `newsletterDirectory.ts` with a "Editor's Picks" heading

#### Scenario: Live results appear below picks
- **WHEN** user performs a Substack search
- **THEN** the system shows "Editor's Picks" at the top (collapsed/scrollable) followed by "Search Results" below
