## Context

The browser extension consists of three JS files communicating via `chrome.runtime.sendMessage`:
- `background.js` (848 lines) — service worker; routes messages, sends data to Incrementum via HTTP POST
- `content.js` (2156 lines) — injected into all pages; captures text, selections, HTML, analysis
- `popup.js` (682 lines) — popup UI; sends commands to background/content

The server API (`browser_sync_server.rs`) routes on `type`:
- `"page"` / `"link"` / `""` → `handle_import_request` → creates **Document**
- `"extract"` → `handle_extract_request` → creates **Extract**

The server expects: `url`, `title`, `text` (plain text), `html_content` (styled HTML, optional), `extracted_images`, `type`, `source`, `context`, `tags`, `priority`, `analysis`, `fsrs_data`.

## Goals / Non-Goals

**Goals:**
- "Save Current Tab" creates a Document with full page content (text + HTML + images)
- "Quick Extract" / "Create Extract" / Extract Mode selection creates an Extract with selected text, rich HTML, context, analysis, FSRS data, and priority
- `sendToIncrementum` stops guessing `type` — callers must be explicit
- The extension has a working test harness with coverage of all message handlers and key content script functions
- Tests run via `npm test` from `browser_extension/`

**Non-Goals:**
- Changing the server-side API contract (it's correct as-is)
- Changing the extension UI or popup layout
- Adding new features beyond fixing what's broken
- E2E tests that load the extension in a real browser (too complex for this change)
- Testing the options page (low-risk, isolated settings UI)

## Decisions

### 1. Fix `savePage` to explicitly set `type: 'page'`

**Decision**: Add `type: 'page'` to the payload in `savePage()`.

**Rationale**: Currently `savePage()` omits `type`, causing `sendToIncrementum()` to default to `'extract'` when page text is present. The server then routes to `handle_extract_request` which creates an Extract record instead of a Document. The fix is a single field addition.

### 2. Remove the type heuristic from `sendToIncrementum`

**Decision**: Change `sendToIncrementum()` to use `data.type || 'page'` as the default instead of `data.type || (trimmedText ? 'extract' : 'page')`.

**Rationale**: The heuristic was an attempt to auto-detect intent, but it's backwards — it assumes "has text = extract" when the reality is that page saves always have text. Every caller knows what it's sending; the function should not guess. Callers that want to send extracts must set `type: 'extract'` explicitly. The new default of `'page'` is safer — it means a missing type creates a Document (which is the most common user action).

### 3. Enhance `createExtractFromSelection` to get rich content from content script

**Decision**: Before creating the extract payload, `createExtractFromSelection` should send `analyzeSelection` to the content script to get HTML, context, analysis, FSRS data, and priority. It then includes all of these in the payload sent to Incrementum.

**Rationale**: Currently `createExtractFromSelection` only sends bare `{ url, title, text, type: 'extract' }`. The content script already has functions (`captureSelectionHTML`, `analyzeSelection`, smart priority calculation, FSRS data computation) but they're only used by the `saveExtract`/`saveExtractWithPriority` handlers (which are called from the content script's own extract mode). The context-menu "Create Extract" shortcut bypasses all of this. By requesting the analysis from the content script first, we get a full-featured extract matching what the extract mode produces.

**Fallback**: If the content script doesn't respond (e.g., tab is a `chrome://` page), fall back to bare text extraction (current behavior) with a warning in the console.

### 4. Test framework: Jest with custom Chrome API mocks

**Decision**: Use Jest as the test runner with a comprehensive `chrome` API mock that simulates `chrome.tabs`, `chrome.storage`, `chrome.runtime`, `chrome.contextMenus`, `chrome.commands`, `chrome.notifications`, and `chrome.action`.

**Rationale**: Jest is the standard for JavaScript testing, has built-in mocking, and works without bundling. The Chrome extension APIs need mocking since they're not available in Node.js. A shared mock module (`tests/__mocks__/chrome.js`) provides realistic behavior:
- `chrome.tabs.sendMessage` returns configurable responses
- `chrome.storage.sync/local` backed by in-memory Maps
- `chrome.runtime.sendMessage` captured for verification
- `fetch` mocked to return configurable responses (simulating server responses)

**Alternative considered**: Vitest — rejected because it requires ESM and the extension uses plain JS with no bundler. Jest works with plain JS out of the box.

### 5. Test structure: mirror source file layout

**Decision**:
```
browser_extension/
├── tests/
│   ├── __mocks__/
│   │   └── chrome.js          # Full Chrome API mock
│   ├── setup.js               # Jest global setup (inject chrome mock)
│   ├── background.test.js     # Tests for background.js handlers
│   ├── content.test.js        # Tests for content.js utility functions
│   ├── popup.test.js          # Tests for popup.js UI controller
│   └── sendToIncrementum.test.js  # Focused tests for the HTTP layer
├── package.json
└── jest.config.js
```

**Rationale**: Plain JS files in a `tests/` directory keep it simple. The chrome mock is shared across all test files via Jest's `setupFiles` config. Each test file tests one source module.

### 6. Extract utility functions from content.js for testability

**Decision**: The content script functions that compute analysis, priority, and FSRS data (`calculatePriority`, `computeFsrsData`, `analyzeText`, `normalizeArticleText`, `captureSelectionHTML`) should be tested by extracting them into a shared test scope. Since the content script runs in a browser context (not Node.js), we test these by having the test file copy/re-require the function definitions.

**Rationale**: Moving functions into separate modules would require a build system (webpack/rollup). Since the extension has no bundler and no `package.json`, restructuring the source files is out of scope. Instead, we use `eval`-based or function-copy approaches to test pure functions in Node.js. For simpler cases, we can extract the pure logic into a shared file (`shared.js`) that both `content.js` and the tests import.

**Revised approach**: Create a `shared.js` file with the pure utility functions (text analysis, priority calculation, FSRS data). Import it in `content.js` and test it directly from Node.js. This avoids eval hacks and makes the code better.

## Risks / Trade-offs

- **Shared JS file adds a new script tag**: The `shared.js` must be declared in `manifest.json`'s `content_scripts.js` array before `content.js`. This is a minor manifest change but affects load order.
- **Content script tests can't fully simulate DOM**: Tests for DOM-dependent functions (selection capture, highlight wrapping) need a JSDOM environment. We'll use JSDOM for these tests but accept that some browser-specific behaviors (computed styles, selection ranges) can't be perfectly simulated.
- **Mock fidelity**: The Chrome API mock won't perfectly replicate browser behavior. Tests verify logic and message flow, not real extension loading. This is standard practice for extension testing.
