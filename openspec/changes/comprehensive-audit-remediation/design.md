## Context

Incrementum is a Tauri v2 desktop application with a React + TypeScript frontend, Rust backend, SQLite database, and an HTTP browser sync server. The app exposes 200+ Tauri commands, manages spaced repetition scheduling for potentially thousands of learning items, and integrates with cloud storage, AI providers, MCP servers, YouTube/OCR/transcription pipelines, and a browser extension via a local HTTP API.

The audit identified systemic issues across three dimensions:

**Security**: The browser sync server (80+ routes on `127.0.0.1:8766`) has permissive CORS and no authentication on most endpoints. Combined with SQL injection in several handlers, any website can execute arbitrary SQL against the user's database. Tauri commands accept unvalidated file paths and URLs, enabling arbitrary file read and SSRF. The `mcp_add_server` command spawns arbitrary processes. The CSP uses `unsafe-inline`, providing zero XSS protection.

**Data integrity**: Review submissions perform 4 sequential DB writes without a transaction. A crash between writes diverges scheduling state from the audit trail. Migrations run without pre-backup. Legacy imports perform hundreds of writes without transaction wrapping. The backup restore operates under an active connection pool.

**Performance**: The frontend has near-zero memoization (1 `React.memo` in 240K lines), broad store subscriptions (only 2 `useShallow` uses), a 2.3MB single-bundle JS (all dynamic imports inlined for Tauri), a 2535-line monolithic page component, 68 eagerly-loaded fonts, and a non-virtualized queue list.

## Goals / Non-Goals

**Goals:**
- Eliminate all critical and high-severity security vulnerabilities
- Ensure scheduling data integrity under crash conditions
- Reduce initial JS parse cost by 40-60% through code splitting
- Eliminate unnecessary React re-renders during study sessions
- Reduce startup latency by deferring non-essential work
- Make repository layer resilient to unexpected data
- Establish measurable performance benchmarks for regression detection

**Non-Goals:**
- Adding new user-facing features
- Restructuring the database schema
- Migrating from SQLite to another database
- Rewriting the browser sync server from Axum to another framework
- Changing the SM-2/SM-18/SM-20 scheduling algorithms
- Implementing automatic crash reporting or analytics
- Removing the `unsafe-inline` dev CSP (acceptable for development)
- Refactoring the entire command module structure (200+ commands remain)

## Decisions

### D1: Parameterize SQL queries with sqlx bind rather than a query builder

**Decision**: Replace all `format!()` SQL construction with `sqlx::query("...").bind(value)`.

**Rationale**: sqlx's bind API provides compile-time query checking (with `sqlx::query!` macro) and runtime parameterization. No new dependencies needed. The codebase already uses `sqlx` throughout — this is extending an existing pattern.

**Alternative considered**: sqlx `query!` macro for compile-time verification. Rejected because it requires a `DATABASE_URL` at compile time and makes dynamic query construction harder. Stick with runtime `.bind()` for flexibility.

### D2: API key authentication on all browser sync endpoints

**Decision**: Extend the existing `automation_api_key` mechanism to all endpoints. The browser extension already stores and sends this key for automation endpoints; extend it to all requests.

**Rationale**: The key infrastructure already exists (`get_automation_api_key`, `rotate_automation_api_key`, validation in middleware). Extending it is lower effort than implementing a new auth system. The browser extension needs a small update to include the key in all requests.

**Alternative considered**: Origin-based authentication. Rejected because any local web page can spoof headers and any browser extension has access to `127.0.0.1`. Key-based auth is stronger.

### D3: Restrict CORS to the browser extension origin only

**Decision**: Replace `CorsLayer::permissive()` with an explicit allowlist of the browser extension's `chrome-extension://` origins.

**Rationale**: The browser sync server exists specifically for the browser extension. No other origin needs access. The extension's origin can be found in its manifest. This eliminates CSRF from arbitrary websites.

### D4: Path validation via canonicalize + prefix check

**Decision**: For file read/write commands, validate by canonicalizing both the target path and an allowed base directory, then checking that the target starts with the base.

**Rationale**: `std::fs::canonicalize()` resolves symlinks and `..` components. A prefix check after canonicalization is simple and correct. The allowed base directory varies per command (app data dir for most, user-configured vault path for Obsidian export).

### D5: MCP server allowlist with user confirmation dialog

**Decision**: Maintain a hardcoded allowlist of known MCP server binary names (e.g., `npx`, `uvx`, `node`). For commands not on the allowlist, show a native confirmation dialog via `tauri_plugin_dialog`.

**Rationale**: Most MCP servers are invoked via package managers (`npx`, `uvx`). Allowing these by default covers the common case while blocking arbitrary binary execution. The confirmation dialog provides a safety net for custom servers.

### D6: Transaction-wrap review submissions

**Decision**: Wrap the 4 DB writes in `apply_review` in a single `pool.begin()` / `tx.commit()` block.

**Rationale**: SQLite WAL mode transactions add <1ms for these small writes (actually faster than 4 separate commits). This is the single most important correctness fix. The `restore_learning_item_state` command already exists as a manual undo — atomic transactions make this unnecessary in practice.

**Alternative considered**: Write-ahead log with manual replay. Rejected because SQLite already provides this; we just need to use it.

### D7: Pre-migration VACUUM INTO snapshot

**Decision**: Before running pending migrations, create a backup with `VACUUM INTO '<db>.pre-migration-<timestamp>'`. Skip if no pending migrations exist.

**Rationale**: `VACUUM INTO` produces a compact, self-contained backup file. It's a single SQL statement. The cost is proportional to DB size but only runs when migrations are pending (typically once per app version). Skip for additive-only migrations (no DROP TABLE, no column removal) to reduce overhead.

### D8: Remove inlineDynamicImports for Tauri

**Decision**: Remove `inlineDynamicImports: true` from `vite.config.ts` for Tauri builds. Use `base: "./"` (already set) and `manualChunks` (already configured for PWA) for code splitting.

**Rationale**: The `inlineDynamicImports` flag was added as a CORS workaround for Tauri's custom protocol. Testing shows that `base: "./"` with relative asset paths resolves the CORS issue without needing to inline everything. This enables `React.lazy()` to actually produce separate chunks.

**Risk**: If relative paths don't work in some Tauri protocol scenario, this will need to be reverted. Mitigate by testing on all 3 platforms before shipping.

### D9: Dynamic font loading via Vite dynamic import

**Decision**: Replace the static 68-font CSS import with a runtime utility that dynamically loads only the 3 selected fonts using `import()` expressions based on the settings store.

**Rationale**: The settings store already tracks the user's font choices (sans, serif, mono). Loading only 3 fonts at startup eliminates parsing ~65 unused `@font-face` blocks. Vite handles dynamic CSS imports natively.

**Alternative considered**: Generate a custom CSS file at build time. Rejected because font choices are runtime user preferences, not build-time constants.

### D10: Tracing initialization at run() entry

**Decision**: Move `tracing_subscriber::fmt::init()` to the very beginning of `run()`, before the Tauri builder chain.

**Rationale**: The current placement (line 525, inside `block_on` setup) means all tracing calls during startup are silently discarded. Moving it to the top enables structured logging for database init, migrations, and all other setup work.

### D11: Structured error serialization with type discrimination

**Decision**: Serialize `IncrementumError` as `{"type":"NotFound","message":"..."}` instead of a flat string. Add a `#[serde(rename_all = "snake_case")]` derive.

**Rationale**: The frontend currently cannot programmatically distinguish error types. A structured response enables proper error handling (retry for timeouts, specific messages for not-found, etc.). This is a small change to `error.rs` serialization with a larger frontend benefit.

### D12: Deferred non-essential startup work

**Decision**: Move cloud auth token loading, browser sync server initialization, and demo content checking to `tokio::spawn` tasks that run after the webview has started rendering.

**Rationale**: These tasks add latency to startup but are not needed for the initial UI. Cloud auth tokens are only needed when the user opens sync settings. The browser sync server is only needed if the extension is enabled. Demo content only runs on first launch. Moving them to background tasks makes the first paint faster.

**Risk**: If a user immediately navigates to a sync-related feature, the tokens may not be loaded yet. Mitigate by showing a loading state and awaiting the background task's completion.

## Risks / Trade-offs

- **[inlineDynamicImports removal]** → May cause CORS issues on some platforms. Mitigate by testing on Linux/Windows/macOS before release. Keep a quick-revert path (single config change).
- **[API key required on all sync endpoints]** → Breaking change for browser extension. Mitigate by coordinating extension update release with this change. The extension already has the key; it just needs to send it on every request.
- **[get_ai_config redaction]** → Breaking change for any code checking key presence. Mitigate by adding a `hasApiKey` boolean field and masking key display (last 4 chars).
- **[Transaction wrapping review submissions]** → Adds a single transaction commit overhead. Mitigate: SQLite WAL transaction commit is <1ms for these small writes. Actually faster than 4 separate commits.
- **[CSP nonce implementation]** → Requires a Tauri protocol handler or custom build step to inject nonces. Mitigate: use hash-based CSP for YouTube embed scripts; nonce for the main bundle.
- **[Dynamic font loading]** → Flash of unstyled text on startup if font loading is slow. Mitigate: use `font-display: swap` (already the fontsource default) and set fallback font families.
- **[MCP allowlist]** → May break custom MCP server configurations. Mitigate: confirmation dialog fallback for non-allowlisted commands.
- **[Deferred startup tasks]** → Features that depend on background tasks may not be immediately available. Mitigate: await the task's JoinHandle when the feature is accessed, with a loading indicator.
