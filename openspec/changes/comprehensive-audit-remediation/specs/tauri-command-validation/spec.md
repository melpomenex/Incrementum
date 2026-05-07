## ADDED Requirements

### Requirement: SQL queries MUST use parameterized bindings
All SQL queries in the Tauri backend SHALL use `sqlx::query().bind()` parameterization. String interpolation via `format!()` SHALL NOT be used for any query that includes user-controlled values. This applies to all query sites in `browser_sync_server.rs`, `commands/rss_features.rs`, `commands/rss.rs`, `rss/repository.rs`, and any other file performing database queries.

#### Scenario: User-supplied feed ID in SQL query
- **WHEN** a Tauri command or HTTP handler receives a `feed_id` parameter
- **THEN** the feed_id SHALL be passed as a bound parameter to the SQL query, never concatenated into the query string

#### Scenario: User-supplied folder name in HTTP handler
- **WHEN** the browser sync server receives a PUT request to update a folder with a `name` field
- **THEN** the name SHALL be passed as a bound parameter, preventing SQL injection through crafted names

### Requirement: File path commands MUST validate against allowed directories
Tauri commands that accept filesystem paths (`read_document_file`, `read_file_bytes`, `import_document`) SHALL validate that the resolved canonical path falls within an allowed base directory. Paths containing `..` SHALL be rejected before canonicalization as an early defense.

#### Scenario: Attempt to read file outside app data directory
- **WHEN** `read_document_file` is called with a path to `/etc/passwd`
- **THEN** the command SHALL return an error and SHALL NOT read the file

#### Scenario: Path with traversal sequence
- **WHEN** `read_document_file` is called with a path containing `../../`
- **THEN** the command SHALL reject the path before canonicalization

#### Scenario: Valid path within app data directory
- **WHEN** `read_document_file` is called with a path to a file within the app's data directory
- **THEN** the command SHALL proceed normally and return the file contents

### Requirement: URL-fetching commands MUST validate scheme and block private addresses
Commands that fetch URLs (`fetch_url_content`, `fetch_web_page_preview`) SHALL only accept HTTPS scheme URLs. They SHALL reject URLs pointing to RFC 1918 private addresses, link-local addresses, loopback addresses, and cloud metadata endpoints.

#### Scenario: HTTPS URL fetch
- **WHEN** `fetch_url_content` is called with `https://example.com/article`
- **THEN** the command SHALL proceed with the fetch

#### Scenario: HTTP scheme rejected
- **WHEN** `fetch_url_content` is called with `http://example.com/article`
- **THEN** the command SHALL return an `InvalidInput` error

#### Scenario: Private IP address blocked
- **WHEN** `fetch_url_content` is called with `http://169.254.169.254/latest/meta-data/`
- **THEN** the command SHALL reject the URL without making a network request

### Requirement: Obsidian export paths MUST be validated
The `export_to_obsidian` and related commands SHALL validate that the vault path resolves to a real directory and does not escape expected boundaries. Paths SHALL be canonicalized before use.

#### Scenario: Valid vault path
- **WHEN** `export_to_obsidian` is called with a vault path that exists and is a directory
- **THEN** the export SHALL proceed normally

#### Scenario: Path traversal in vault path
- **WHEN** `export_to_obsidian` is called with a path containing `../../etc`
- **THEN** the command SHALL reject the path
