## ADDED Requirements

### Requirement: Search podcasts by keyword
The system SHALL provide a `search_podcasts` command (Tauri IPC) and `/api/podcast/search` HTTP route that accepts a query string and returns an array of podcast search results from the RSS.com PodcastIndex API.

#### Scenario: Successful search returns results
- **WHEN** a user submits a search query "Joe Rogan"
- **THEN** the system POSTs `{"q": "Joe Rogan"}` to `https://apollo.rss.com/search/podcast-index/byterm` and returns a JSON array of `PodcastSearchResult` objects

#### Scenario: Empty query returns empty results
- **WHEN** a user submits an empty or whitespace-only query
- **THEN** the system returns an empty results array without making an API call

#### Scenario: API error returns error message
- **WHEN** the upstream API returns an HTTP error or is unreachable
- **THEN** the system returns a descriptive error that the frontend can display to the user

### Requirement: PodcastSearchResult data model
The system SHALL define a `PodcastSearchResult` struct/type with the following fields: `title` (string, required), `url` (string, required — the RSS feed URL), `author` (string, optional), `description` (string, optional), `imageUrl` (string, optional), `link` (string, optional — website URL), `episodeCount` (number, optional), `categories` (map of string→string, optional).

#### Scenario: All fields parsed from API response
- **WHEN** the upstream API returns a feed object with all fields populated
- **THEN** the system maps each field to the corresponding `PodcastSearchResult` property, including the categories map

#### Scenario: Partial fields handled gracefully
- **WHEN** the upstream API returns a feed object with only `title` and `url`
- **THEN** the system returns a valid `PodcastSearchResult` with optional fields set to null/undefined

### Requirement: HTTP API route for PWA/webapp
The browser sync server SHALL expose `GET /api/podcast/search?q=<query>` that calls the same upstream API and returns the same result shape as the Tauri command.

#### Scenario: PWA search via HTTP route
- **WHEN** the webapp sends `GET /api/podcast/search?q=tech`
- **THEN** the server queries the upstream API and returns a JSON response matching the `PodcastSearchResult` array schema

### Requirement: Frontend search API function
The frontend SHALL export a `searchPodcasts(query: string): Promise<PodcastSearchResult[]>` function following the three-tier pattern: Tauri IPC when native, HTTP fetch when the sync server is available, direct fetch (with CORS proxy fallback) otherwise.

#### Scenario: Native Tauri path
- **WHEN** `isTauri()` is true
- **THEN** the function invokes the `search_podcasts` Tauri command

#### Scenario: HTTP server path
- **WHEN** `shouldUseHttp()` is true
- **THEN** the function fetches from `${getApiBaseUrl()}/api/podcast/search?q=...`

#### Scenario: Browser-only fallback
- **WHEN** neither Tauri nor HTTP server is available
- **THEN** the function fetches directly from the upstream API, falling back to a CORS proxy if blocked
