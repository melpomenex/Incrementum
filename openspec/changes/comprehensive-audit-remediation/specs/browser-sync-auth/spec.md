## ADDED Requirements

### Requirement: All browser sync endpoints MUST require API key authentication
Every HTTP endpoint on the browser sync server SHALL validate the API key from the `X-API-Key` header or `api_key` query parameter. The existing `automation_api_key` validation logic SHALL be applied to all routes, not just `/api/automation/*`.

#### Scenario: Request with valid API key
- **WHEN** a request is made to any browser sync endpoint with a valid `X-API-Key` header
- **THEN** the request SHALL proceed normally

#### Scenario: Request without API key
- **WHEN** a request is made to any browser sync endpoint without an API key
- **THEN** the server SHALL return HTTP 401 Unauthorized

#### Scenario: Request with invalid API key
- **WHEN** a request is made with an incorrect API key
- **THEN** the server SHALL return HTTP 403 Forbidden

### Requirement: CORS policy MUST restrict origins to the browser extension
The browser sync server SHALL replace `CorsLayer::permissive()` with a restrictive CORS policy that only allows the browser extension's origin. The allowed origin list SHALL be configurable but default to the extension's `chrome-extension://` ID.

#### Scenario: Request from browser extension origin
- **WHEN** a cross-origin request is made from the browser extension's origin
- **THEN** the server SHALL include appropriate CORS headers in the response

#### Scenario: Request from arbitrary website
- **WHEN** a cross-origin request is made from `https://evil.com`
- **THEN** the server SHALL NOT include CORS headers, preventing the browser from reading the response

### Requirement: SQL queries in HTTP handlers MUST use parameterized bindings
All SQL queries in the browser sync server HTTP handlers (including `handle_update_folder` and RSS handlers) SHALL use parameterized `sqlx::query().bind()` instead of string interpolation via `format!()`.

#### Scenario: Folder update with malicious name
- **WHEN** a PUT request updates a folder with `name = "'; DROP TABLE rss_folders; --"`
- **THEN** the name SHALL be stored as a literal string (or rejected as invalid input), and no SQL SHALL be executed beyond the intended UPDATE
