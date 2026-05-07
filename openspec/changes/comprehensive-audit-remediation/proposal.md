## Why

A comprehensive security, performance, and reliability audit of Incrementum identified 4 critical, 14 high, and 25 medium-severity issues across the Tauri backend, React frontend, and build pipeline. The most urgent are: SQL injection vulnerabilities reachable through the unauthenticated browser sync HTTP server (any website can attack the local app via CSRF), arbitrary file read and process spawning from the webview, and non-transactional review submissions that corrupt scheduling data on crash. The frontend has near-zero React memoization (1 instance of React.memo across 240K lines), broad Zustand store subscriptions without selectors (only 2 uses of useShallow), a 2.3MB single-bundle JS due to inlined dynamic imports, a 2535-line monolithic page component, and 68 eagerly-loaded font packages. The backend has 260+ `.unwrap()` calls that crash the app on unexpected data, a tracing subscriber initialized after all startup work (silently discarding all early logs), and 112 silent error discards. These issues must be fixed to protect user data integrity, scheduling correctness, and operational security.

## What Changes

- **SQL injection**: Replace all string-interpolated SQL queries with parameterized `sqlx::query().bind()` across `browser_sync_server.rs`, `commands/rss_features.rs`, `commands/rss.rs`, and `rss/repository.rs`
- **Browser sync server authentication**: Require API key on all HTTP endpoints (not just `/api/automation/*`); replace `CorsLayer::permissive()` with restrictive CORS
- **File path validation**: Add `canonicalize()` + prefix checks to `read_document_file`, `read_file_bytes`, `import_document`, and all Obsidian export paths
- **MCP command allowlisting**: Restrict `mcp_add_server` to approved executables; remove arbitrary `env` passthrough; add confirmation dialog
- **API key redaction**: `get_ai_config` returns provider config without actual key values; store API keys in OS keychain
- **SSRF protection**: Validate URL scheme (HTTPS only) and reject private IP ranges in `fetch_url_content` and `fetch_web_page_preview`
- **Review transaction wrapping**: Wrap all 4 review submission DB writes (`update_learning_item`, `create_review_result`, `update_study_statistics`, `update_review_session`) in a single transaction
- **Pre-migration backups**: Create `VACUUM INTO` snapshot before applying pending migrations
- **Transactional imports**: Wrap legacy import, Anki import, and StudyJSON import in single transactions
- **Backup restore safety**: Close sqlx pool before rusqlite page-level restore; create pre-restore snapshot; re-open pool after
- **Startup integrity check**: Add `PRAGMA integrity_check` on database open
- **CSP hardening**: Remove `unsafe-inline` from production `script-src`; implement nonce-based CSP; restrict `img-src` to known domains; add `frame-ancestors 'self'`
- **Page lazy loading**: Convert all 8 page imports to `React.lazy()`; remove `inlineDynamicImports: true` from Tauri build config
- **QueueScrollPage decomposition**: Break 2535-line component into 5-8 memoized sub-components
- **React.memo rollout**: Add `React.memo` to ReviewCard, FlashcardScrollItem, StatusPill, PriorityGlyph, DocumentCard, StatCard
- **Zustand selector cleanup**: Use `useShallow` for all multi-field store subscriptions
- **ReviewQueueView virtualization**: Apply `DynamicVirtualList` to queue list
- **Dynamic font loading**: Load only 3 user-selected fonts from settings instead of all 68
- **HTML rendering memoization**: Wrap `renderAnkiHtmlWithLatex()` and `renderMarkdown()` output in `useMemo`
- **Tracing init**: Move `tracing_subscriber::fmt::init()` to beginning of `run()` before builder chain
- **Repository unwrap mitigation**: Replace 260+ `.unwrap()` in repository layer with error propagation or `.unwrap_or_default()` + warning log
- **Silent error logging**: Add `tracing::warn!` before all `let _ =` error discards
- **Structured error serialization**: Serialize `IncrementumError` as `{ "type": "...", "message": "..." }` instead of flat string
- **Deferred startup**: Move cloud auth loading, browser sync server init, and demo content check to `tokio::spawn` background tasks
- **Performance benchmarks**: Add benchmark harness for scheduling computation, queue generation, and card rendering
- **Integration tests**: Add tests for review submission atomicity, import/export round-trips, and migration correctness

## Capabilities

### New Capabilities
- `tauri-command-validation`: Input validation, path sanitization, and SSRF protection for all Tauri commands that accept file paths, URLs, or user-controlled strings
- `browser-sync-auth`: Authentication and CORS hardening for the browser sync HTTP server
- `mcp-sandboxing`: Allowlisting, confirmation dialogs, and environment variable restrictions for MCP server commands
- `csp-hardening`: Nonce-based Content Security Policy replacing unsafe-inline, with domain-restricted img-src and frame-ancestors
- `review-atomicity`: Transaction-wrapped review submissions ensuring scheduling state and audit trail consistency
- `import-atomicity`: Transaction-wrapped import flows (legacy, Anki, StudyJSON) preventing partial imports
- `migration-safety`: Pre-migration database snapshots and startup integrity checks
- `backup-restore-safety`: Pool-safe backup restore with pre-restore snapshots and post-restore integrity verification
- `frontend-perf`: Page lazy loading, component memoization, virtualization, dynamic font loading, and Zustand selector optimization
- `backend-reliability`: Tracing initialization, repository error propagation, structured error serialization, and deferred startup work
- `test-observability`: Performance benchmarks and integration test coverage for critical paths

### Modified Capabilities
- `backup-core-operations`: Adding pre-restore snapshots, pool closing before restore, and post-restore integrity checks to the restore flow
- `oauth-token-persistence`: Extending keychain storage to also cover LLM API keys (currently stored in-memory only)

## Impact

- **Tauri backend**: Changes across ~15 command files, `browser_sync_server.rs`, `backup/manager.rs`, `database/migrations.rs`, `database/repository.rs`, `database/connection.rs`, `lib.rs`, and `error.rs
- **React frontend**: Changes to `App.tsx`, `QueueScrollPage.tsx` (major refactor), `ReviewQueueView.tsx`, `ReviewCard.tsx`, `FlashcardScrollItem.tsx`, all page components, all route components, store consumers
- **Build config**: `vite.config.ts`, `tauri.conf.json`, `capabilities/default.json`
- **Dependencies**: No new runtime dependencies; possible addition of `@fontsource/dynamic-loader` or equivalent for dynamic font loading
- **API compatibility**: `get_ai_config` response shape changes (api keys redacted) — **BREAKING** for any frontend code checking key presence directly
- **Browser sync server**: All endpoints now require API key — **BREAKING** for browser extension (must be updated to send key)
