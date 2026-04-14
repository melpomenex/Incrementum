## ADDED Requirements

### Requirement: Substack search
The system SHALL provide a `searchSubstack(query, cursor?)` function that queries Substack's public `/api/v1/top/search` endpoint and returns typed search results including posts, profiles, and comments with cursor-based pagination.

#### Scenario: Successful search returns mixed results
- **WHEN** user calls `searchSubstack("machine learning")`
- **THEN** the system returns a `SubstackSearchResponse` containing an array of `SubstackSearchItem` objects with type `post`, `comment`, or `profileSearchResults`, and an optional `nextCursor` for pagination

#### Scenario: Search with no results
- **WHEN** user calls `searchSubstack("xyznonexistent123")`
- **THEN** the system returns a `SubstackSearchResponse` with an empty items array

#### Scenario: Paginated search
- **WHEN** user calls `searchSubstack("AI", cursor)` with a cursor from a previous response
- **THEN** the system returns the next page of results with a new `nextCursor` if more pages exist

#### Scenario: Rate limiting
- **WHEN** more than 30 requests are made within 60 seconds
- **THEN** the system queues the excess requests and delays them until the rate limit window resets

### Requirement: Substack category browsing
The system SHALL provide a `getSubstackCategories()` function that fetches all available content categories from `/api/v1/categories`.

#### Scenario: Fetch categories
- **WHEN** user calls `getSubstackCategories()`
- **THEN** the system returns an array of `SubstackCategory` objects each containing id, name, slug, and optional emoji

#### Scenario: Browse category feed
- **WHEN** user calls `getSubstackCategoryFeed(categoryId, limit?, cursor?)`
- **THEN** the system returns a `SubstackFeedResponse` with posts from that category and optional pagination cursor

### Requirement: Publication detail fetching
The system SHALL provide a `getSubstackPublication(subdomain)` function that fetches homepage data for a specific publication.

#### Scenario: Fetch publication homepage
- **WHEN** user calls `getSubstackPublication("platformer")`
- **THEN** the system returns a `SubstackPublication` object containing name, description, author info, logo URL, subscriber count, and recent posts

#### Scenario: Publication not found
- **WHEN** user calls `getSubstackPublication("nonexistent-publication-xyz")`
- **THEN** the system throws a descriptive error

### Requirement: Dual-mode transport (Tauri + browser)
The API client SHALL use Rust Tauri commands in desktop mode and direct HTTP fetch in browser mode.

#### Scenario: Tauri desktop mode
- **WHEN** running in Tauri environment and `searchSubstack()` is called
- **THEN** the request is proxied through a Rust `#[tauri::command]` handler using `reqwest`

#### Scenario: Browser/PWA mode
- **WHEN** running in browser environment and `searchSubstack()` is called
- **THEN** the request is made directly via `fetch()` to `https://substack.com/api/v1/...`

#### Scenario: Browser CORS failure graceful degradation
- **WHEN** a browser-mode request fails due to CORS
- **THEN** the system returns a typed error indicating CORS failure with a human-readable message suggesting desktop app usage

### Requirement: RSS feed URL derivation
The system SHALL derive the RSS feed URL for any discovered Substack publication.

#### Scenario: Substack subdomain publication
- **WHEN** a search result contains a publication with subdomain "stratechery"
- **THEN** the derived RSS feed URL is "https://stratechery.substack.com/feed"

#### Scenario: Custom domain publication
- **WHEN** a search result contains a publication with customDomain "example.com" and no subdomain
- **THEN** the derived RSS feed URL is "https://example.com/feed"
