## ADDED Requirements

### Requirement: Unified search dialog replaces Add and Discover modals
The PodcastManager component SHALL replace the separate "Add Podcast" (URL input) and "Discover Podcasts" (static list) dialogs with a single "Add Podcast" dialog containing a search input, live search results, and a collapsible URL entry fallback.

#### Scenario: Opening the Add Podcast dialog
- **WHEN** the user clicks the "+" button in the podcast header
- **THEN** the system shows the unified "Add Podcast" dialog with an empty search input, no results, and a "Paste URL" link/toggle for manual entry

#### Scenario: Search input triggers live search
- **WHEN** the user types a query of 2+ characters into the search input
- **THEN** the system debounces for 300ms, then calls `searchPodcasts(query)` and displays the results

#### Scenario: Typing clears previous results
- **WHEN** the user modifies the search query
- **THEN** the system cancels any in-flight request and shows a loading state until new results arrive

### Requirement: Search results displayed as rich cards
The dialog SHALL display search results in a responsive card grid (2 columns on medium+ screens, 1 column on small screens). Each card SHALL show: cover art thumbnail (with fallback placeholder), podcast title, author, truncated description (max 2 lines), episode count badge, and a "Subscribe" button.

#### Scenario: Results displayed after search
- **WHEN** search results are returned from the API
- **THEN** the dialog renders a card for each result with cover art, title, author, description, episode count, and subscribe button

#### Scenario: No results found
- **WHEN** the API returns an empty results array
- **THEN** the dialog shows a "No podcasts found" message with a suggestion to try different keywords

#### Scenario: Search error
- **WHEN** the search API call fails
- **THEN** the dialog shows an error message with a retry option

### Requirement: One-click subscribe from search results
Each search result card SHALL have a "Subscribe" button that subscribes to the podcast via the existing `subscribeToPodcast(feedUrl)` function, adds the feed to the sidebar, closes the dialog, and shows a success toast.

#### Scenario: Successful subscribe from search result
- **WHEN** the user clicks "Subscribe" on a search result card
- **THEN** the system calls `subscribeToPodcast(result.url)`, adds the new feed to the local feeds state, selects it, closes the dialog, and shows a success toast

#### Scenario: Already subscribed
- **WHEN** the user clicks "Subscribe" on a podcast they already subscribe to
- **THEN** the system shows an informational toast "Already subscribed to [title]" and does not create a duplicate

#### Scenario: Subscribe failure
- **WHEN** the subscribe call fails (e.g., invalid feed, network error)
- **THEN** the system shows an error toast and keeps the dialog open so the user can try again

### Requirement: URL entry fallback
The dialog SHALL include a collapsible "Paste URL" section that shows the original URL input field for users who know their RSS feed URL.

#### Scenario: Manual URL subscribe
- **WHEN** the user expands the "Paste URL" section, enters a valid RSS feed URL, and submits
- **THEN** the system calls `subscribeToPodcast(url)` with the same behavior as the original Add dialog

### Requirement: Remove separate Discover dialog
The system SHALL remove the "Discover Podcasts" dialog, the globe button in the header, and the `discoverPodcasts()` API function. The `parsePodcastFeed` client-side function and `showDiscover`/`discoverResults` state are also removed.

#### Scenario: Globe button removed
- **WHEN** the user views the podcast page header
- **THEN** only the "+" button remains; the globe/Discover button is no longer present
