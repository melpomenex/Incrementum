## ADDED Requirements

### Requirement: Browser sync endpoint bypasses API key auth
The `POST /` endpoint used by the browser extension SHALL bypass the `require_api_key` middleware regardless of whether an API key is configured. Automation API endpoints (`/api/automation/*`) SHALL continue to require a valid API key when configured.

#### Scenario: Extension saves page when API key is configured
- **WHEN** an automation API key is set in server state AND a browser extension sends `POST /` with page data
- **THEN** the request succeeds (200) and the page is saved without requiring an API key header

#### Scenario: Extension saves extract when no API key is configured
- **WHEN** no automation API key is set AND a browser extension sends `POST /` with extract data
- **THEN** the request succeeds (200) and the extract is saved

#### Scenario: Automation endpoint still requires API key
- **WHEN** an automation API key is set AND a request is sent to `/api/automation/cards` without the API key header
- **THEN** the request is rejected with 401 Unauthorized
