## ADDED Requirements

### Requirement: Fetch full article content from source URL

The system SHALL provide a mechanism to fetch the full HTML content of an article from its source URL when the RSS feed only provides a summary or excerpt.

#### Scenario: Manual fetch from reader view

- **WHEN** the user clicks a "Fetch Full Content" button in the article reader
- **THEN** the system SHALL fetch the HTML from the article's source URL
- **AND** extract the readable content
- **AND** display it in the reader view
- **AND** cache it locally for future access

#### Scenario: Auto-fetch for new feed items

- **WHEN** a new article is added to a feed configured with auto-fetch mode set to "always"
- **THEN** the system SHALL automatically fetch the full content in the background
- **AND** store it in the local cache

#### Scenario: Auto-fetch for favorited items only

- **WHEN** a user favorites/starred an article in a feed configured with auto-fetch mode set to "favorites"
- **THEN** the system SHALL automatically fetch the full content for that article

### Requirement: Cache full content locally

The system SHALL cache fetched full article content locally to enable offline reading and reduce repeated network requests.

#### Scenario: Store fetched content

- **WHEN** full content is successfully fetched and extracted
- **THEN** the system SHALL store it in the local database with a timestamp
- **AND** associate it with the corresponding RSS article

#### Scenario: Retrieve cached content

- **WHEN** a user opens an article that has cached full content
- **THEN** the system SHALL display the cached content immediately without network request
- **AND** show an indicator that the content is from cache

#### Scenario: Cache expiration and refresh

- **WHEN** cached content exceeds the configured retention period (default 30 days)
- **THEN** the system SHALL mark it as stale
- **AND** offer the user an option to refresh from source URL

### Requirement: Per-feed auto-fetch configuration

The system SHALL allow users to configure automatic full content fetching behavior per RSS feed.

#### Scenario: Configure feed auto-fetch mode

- **WHEN** a user opens feed settings
- **THEN** the system SHALL present three options: "always", "favorites", or "manual"
- **AND** save the preference for that feed

#### Scenario: Default to manual mode

- **WHEN** a new feed is subscribed
- **THEN** the system SHALL set the auto-fetch mode to "manual" by default
- **AND** not automatically fetch full content for any articles

### Requirement: Handle fetch failures gracefully

The system SHALL handle network errors, CORS issues, and extraction failures gracefully.

#### Scenario: Network failure fallback

- **WHEN** fetching full content fails due to network error
- **THEN** the system SHALL display the RSS feed content (summary) as fallback
- **AND** show an error message explaining the fetch failed
- **AND** provide a retry button

#### Scenario: CORS proxy fallback

- **WHEN** direct fetch fails in web mode due to CORS restrictions
- **THEN** the system SHALL attempt fetch through available CORS proxies
- **AND** use the first successful response

#### Scenario: Content extraction failure

- **WHEN** Readability extraction returns no meaningful content
- **THEN** the system SHALL fall back to displaying the original RSS content
- **AND** log the extraction failure for debugging
