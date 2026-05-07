## ADDED Requirements

### Requirement: tracing_subscriber MUST initialize before all setup work
`tracing_subscriber::fmt::init()` SHALL be called at the very beginning of `run()` before the Tauri builder chain and the `setup()` closure. All tracing calls during startup SHALL be captured.

#### Scenario: Startup error before database init
- **WHEN** an error occurs during early startup (e.g., before database initialization)
- **THEN** the error SHALL be logged via tracing, not silently discarded

### Requirement: Repository layer MUST NOT use unwrap on user-facing data paths
All `.unwrap()` calls in `repository.rs` and `document_repository.rs` that operate on data returned from the database SHALL be replaced with proper error propagation (`?` operator) or safe defaults (`.unwrap_or_default()`) with a warning log. Exceptions: `.unwrap()` on `Mutex` guards in setup code and `.unwrap()` on statically-known values.

#### Scenario: Unexpected NULL in database column
- **WHEN** a database query returns a NULL where a value was expected
- **THEN** the function SHALL return an error or a safe default, not panic

#### Scenario: Corrupt JSON in tags column
- **WHEN** `serde_json::from_str()` fails to parse the tags JSON
- **THEN** the function SHALL log a warning and return an empty vector, not panic

### Requirement: Silent error discards MUST log the error
All `let _ =` patterns that discard `Result` values SHALL be replaced with `if let Err(e) = ... { tracing::warn!("operation failed: {}", e); }` or equivalent.

#### Scenario: LLM streaming event failure
- **WHEN** a streaming event fails to send in the LLM command
- **THEN** the error SHALL be logged at warn level, not silently discarded

### Requirement: IncrementumError MUST serialize with type discrimination
The `Serialize` impl for `IncrementumError` SHALL produce a JSON object with `type` and `message` fields instead of a flat string. The `type` field SHALL match the enum variant name in snake_case.

#### Scenario: Frontend receives a NotFound error
- **WHEN** a Tauri command returns an `IncrementumError::NotFound`
- **THEN** the serialized error SHALL be `{"type":"not_found","message":"..."}` allowing programmatic handling

### Requirement: Non-essential startup work MUST be deferred
Cloud auth token loading, browser sync server initialization, and demo content checking SHALL be moved to `tokio::spawn` background tasks that run after the webview has started rendering.

#### Scenario: App startup
- **WHEN** the app starts
- **THEN** the webview SHALL render the loading UI immediately after database initialization
- **AND** cloud auth, browser sync, and demo content checks SHALL complete in the background

#### Scenario: Feature accessed before background task completes
- **WHEN** the user opens sync settings before cloud auth tokens have loaded
- **THEN** the UI SHALL await the background task completion and then display the loaded state
