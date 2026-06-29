## Why

The browser extension has critical bugs in how it sends data to Incrementum:

**Bug 1 — `savePage` sends full page as an extract, not a document.** The `savePage()` function in `background.js` does not set `type` on the payload. The `sendToIncrementum()` function defaults `type` to `'extract'` when any `text` is present. This means "Save Current Tab" sends the **entire page text** as an Extract record instead of creating a Document. The server's `handle_extract_request` receives full-page-length text (tens of thousands of characters) and creates an oversized Extract with no meaningful selection boundary.

**Bug 2 — `createExtractFromSelection` strips HTML formatting.** The context-menu "Create Extract" handler (`createExtractFromSelection` in `background.js`) sends only `text` (plain text) with no `html_content`, no `context`, no `analysis`, and no `fsrs_data`. Extracts created this way lose all rich formatting and metadata that the content script is capable of capturing.

**Bug 3 — The `sendToIncrementum` type heuristic is wrong.** The fallback logic `type: data.type || (trimmedText ? 'extract' : 'page')` means any save with text content (including full pages) becomes an extract by default. This is backwards — the caller should always specify intent explicitly.

**No tests exist.** The extension has zero automated tests. All 3,700+ lines of JavaScript across `background.js`, `content.js`, `popup.js`, and `options.js` are completely untested. There is no test framework, no test runner, no test files, and no `package.json`.

## What Changes

- Fix `savePage()` to explicitly set `type: 'page'` so it creates a Document, not an Extract
- Fix `sendToIncrementum()` to require explicit `type` from callers instead of guessing
- Fix `createExtractFromSelection()` to request rich content from the content script (HTML, context, analysis, FSRS data) instead of sending bare plain text
- Add a test infrastructure (`package.json`, Jest config, test utilities) to the `browser_extension/` directory
- Write unit tests for `sendToIncrementum`, `savePage`, `saveLink`, `createExtractFromSelection`, the extract queue, and the extract payload builders
- Write unit tests for key content script functions: text normalization, selection capture, page content extraction, priority calculation, FSRS data computation
- Write integration-style tests for the full message routing in `background.js`

## Capabilities

### Modified Capabilities
- `browser-extension-extraction`: Fix extract flow so highlighted text is sent as a proper Extract with metadata, not as a full-page dump
- `browser-extension-page-save`: Fix page save so it creates a Document with full content, not an Extract

### New Capabilities
- `browser-extension-test-infrastructure`: Jest-based test harness with mock Chrome APIs, covering all extension modules

## Impact

- `browser_extension/background.js`: Fix `savePage`, `createExtractFromSelection`, and `sendToIncrementum` type routing
- `browser_extension/content.js`: Minor — ensure extract responses include all metadata fields
- `browser_extension/package.json`: New — Jest test framework and scripts
- `browser_extension/jest.config.js`: New — Jest configuration with path aliases and Chrome API mocks
- `browser_extension/tests/`: New — test files for background.js, content.js, and shared utilities
- `browser_extension/tests/__mocks__/`: New — Chrome API mocks (`chrome.ts` or `chrome.js`)
- No changes to the Incrementum server (`browser_sync_server.rs`) — the server API contract is correct
- No changes to `manifest.json` or the extension UI
