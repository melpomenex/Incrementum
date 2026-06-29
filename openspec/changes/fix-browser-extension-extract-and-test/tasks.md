## Tasks

- [x] Set up test infrastructure (package.json, Jest config, Chrome API mock)
- [x] Extract pure utility functions into `shared.js` for testability
- [x] Fix `sendToIncrementum` type heuristic in `background.js`
- [x] Fix `savePage` to set `type: 'page'` explicitly
- [x] Enhance `createExtractFromSelection` to request rich content from content script
- [x] Write tests for `sendToIncrementum` and HTTP layer
- [x] Write tests for `background.js` message handlers
- [x] Write tests for content script utility functions (text analysis, priority, FSRS)
- [x] Write tests for `popup.js` controller
- [x] Run all tests and fix any issues
- [ ] Verify extension loads correctly in browser after changes

## Task Details

### Task 1: Set up test infrastructure (package.json, Jest config, Chrome API mock)

Create `browser_extension/package.json`:
- Add `jest` as a dev dependency
- Add `@jest/globals` for test matchers
- Add `jsdom` for DOM simulation in content script tests
- Scripts: `"test"` runs jest, `"test:watch"` runs jest in watch mode

Create `browser_extension/jest.config.js`:
- `testEnvironment: 'node'` (default for background/popup tests)
- `setupFiles: ['./tests/setup.js']` to inject Chrome mock globally
- `testMatch: ['**/tests/**/*.test.js']`

Create `browser_extension/tests/__mocks__/chrome.js`:
- Mock `chrome.tabs`: `query()`, `sendMessage()`, `onUpdated`, `onActivated`
- Mock `chrome.storage.sync` and `chrome.storage.local`: in-memory Map-backed `get()`, `set()`, `remove()`
- Mock `chrome.runtime`: `sendMessage()`, `onMessage`, `onInstalled`, `id`
- Mock `chrome.contextMenus`: `create()`, `onClicked`
- Mock `chrome.commands`: `onCommand`
- Mock `chrome.notifications`: `create()`
- Mock `chrome.action`: `setBadgeText()`, `setBadgeBackgroundColor()`
- Mock `fetch`: configurable to return `{ ok: true/false, text(), json() }`
- Export the mock so tests can override specific behaviors per-test

Create `browser_extension/tests/setup.js`:
- Import and attach the Chrome mock to `globalThis.chrome`
- Provide `globalThis.fetch` mock with configurable responses
- Provide `jest.spyOn` utilities for common patterns

**Files:** `browser_extension/package.json`, `browser_extension/jest.config.js`, `browser_extension/tests/__mocks__/chrome.js`, `browser_extension/tests/setup.js`

---

### Task 2: Extract pure utility functions into `shared.js` for testability

Create `browser_extension/shared.js` containing the pure (no-DOM) functions extracted from `content.js`:

Extract from `content.js`:
- `normalizeArticleText(text)` — collapses whitespace, strips boilerplate
- `calculatePriority(text, options)` — priority scoring algorithm
- `computeFsrsData(textLength, language)` — FSRS spaced repetition initial values
- `analyzeText(text)` — word count, char count, sentiment, keyword extraction, language detection
- `estimateReadingTime(wordCount)` — reading time calculation
- Any other pure functions used by `analyzeSelection` and `getPageContent`

Update `content.js`:
- Import from `shared.js` using a `<script>` tag (add to `manifest.json` `content_scripts.js` before `content.js`)
- Replace inline function definitions with calls to the shared versions

Update `manifest.json`:
- Add `"shared.js"` to the `content_scripts[0].js` array, before `"content.js"`

**Files:** `browser_extension/shared.js`, `browser_extension/content.js`, `browser_extension/manifest.json`

---

### Task 3: Fix `sendToIncrementum` type heuristic in `background.js`

In `browser_extension/background.js`, in the `sendToIncrementum` function (~line 546):

Change:
```js
type: data.type || (trimmedText ? 'extract' : 'page'),
```
To:
```js
type: data.type || 'page',
```

This removes the dangerous heuristic that treated any payload with text as an extract. The safe default is `'page'` (create a Document). Extracts must be explicitly typed by their callers.

**Files:** `browser_extension/background.js`

---

### Task 4: Fix `savePage` to set `type: 'page'` explicitly

In `browser_extension/background.js`, in the `savePage` function (~line 635):

Change:
```js
return await sendToIncrementum({
  url,
  title,
  text: pageContent,
  html_content: pageHtml,
  extracted_images: extractedImages
});
```
To:
```js
return await sendToIncrementum({
  url,
  title,
  text: pageContent,
  html_content: pageHtml,
  extracted_images: extractedImages,
  type: 'page'
});
```

Also add `type: 'page'` to the fallback call (~line 645):
```js
return await sendToIncrementum({ url, title, text: '', type: 'page' });
```

**Files:** `browser_extension/background.js`

---

### Task 5: Enhance `createExtractFromSelection` to request rich content from content script

In `browser_extension/background.js`, modify `createExtractFromSelection` (~line 650):

Before creating the payload, send an `analyzeSelection` message to the content script to get rich metadata:

```js
async function createExtractFromSelection(selectedText, tab) {
  const text = (selectedText || '').trim();
  if (!text) {
    return { success: false, error: 'No selection provided' };
  }

  // Request rich content analysis from the content script
  let htmlContent = undefined;
  let context = undefined;
  let analysis = undefined;
  let fsrsData = undefined;
  let priority = undefined;

  if (tab?.id) {
    try {
      const analysisResponse = await safeSendTabMessage(tab.id, {
        action: 'analyzeSelection',
        text: text
      });
      if (analysisResponse?.success) {
        htmlContent = analysisResponse.html_content;
        context = analysisResponse.context;
        analysis = analysisResponse.analysis;
        fsrsData = analysisResponse.fsrs_data;
        priority = analysisResponse.priority;
      }
    } catch (error) {
      console.warn('[DEBUG] Could not get selection analysis from content script:', error.message);
    }
  }

  const payload = {
    url: tab.url,
    title: tab.title,
    text,
    html_content: htmlContent,
    type: 'extract',
    context,
    tags: [],
    priority,
    analysis,
    fsrs_data: fsrsData
  };

  const result = await sendToIncrementum(payload);
  // ... rest of existing error handling unchanged
}
```

Also verify that `content.js`'s `analyzeSelection` handler returns all the fields (`html_content`, `context`, `analysis`, `fsrs_data`, `priority`). If it doesn't, update it to do so.

**Files:** `browser_extension/background.js`, possibly `browser_extension/content.js`

---

### Task 6: Write tests for `sendToIncrementum` and HTTP layer

Create `browser_extension/tests/sendToIncrementum.test.js`:

Test cases:
- Sends POST to correct endpoint (`http://127.0.0.1:8766/`)
- Request body contains all expected fields (url, title, text, html_content, type, source, timestamp, etc.)
- `type` defaults to `'page'` when not specified
- Returns `{ success: true }` when server responds 200
- Returns `{ success: false, error, retryable: true }` on 5xx responses
- Returns `{ success: false, error, retryable: true }` on network errors
- Triggers `flushQueuedExtractsIfPossible` on success (when `allowFlush !== false`)
- Does not flush when `allowFlush: false` is passed
- Handles `content` backward-compat field being set to same as `text`

**Files:** `browser_extension/tests/sendToIncrementum.test.js`

---

### Task 7: Write tests for `background.js` message handlers

Create `browser_extension/tests/background.test.js`:

Test cases for `savePage`:
- Sends `getPageContent` to content script when tab is found
- Creates payload with `type: 'page'` (not `'extract'`)
- Falls back to URL+title-only save when content script is unreachable
- Includes `html_content` and `extracted_images` from content script response

Test cases for `saveLink`:
- Sends `type: 'page'` with empty text (server-side Readability fetches content)
- Uses link text as title when available, falls back to hostname

Test cases for `createExtractFromSelection`:
- Requests `analyzeSelection` from content script before creating payload
- Includes `html_content`, `context`, `analysis`, `fsrs_data`, `priority` when available
- Falls back to bare text when content script doesn't respond
- Sends `type: 'extract'` explicitly
- Queues extract locally on connection failure

Test cases for `saveExtract`/`saveExtractWithPriority`:
- Requires `text` and `url`, returns error if missing
- Includes all metadata fields in payload
- Shows in-page toast on success/failure

Test cases for message routing:
- `saveCurrentTab` calls `savePage` with active tab URL/title
- `saveAllTabs` iterates all non-internal tabs and calls `savePage` for each
- Unknown actions return error response

Test cases for pending extract queue:
- `queueExtractForSync` stores extract in `chrome.storage.local`
- `flushQueuedExtractsIfPossible` sends queued extracts when connection is restored
- Flush is not re-entrant (guarded by `flushInProgress`)

**Files:** `browser_extension/tests/background.test.js`

---

### Task 8: Write tests for content script utility functions

Create `browser_extension/tests/content.test.js`:

Test cases for `normalizeArticleText`:
- Collapses multiple whitespace/newlines
- Trims leading/trailing whitespace
- Preserves meaningful paragraph breaks
- Handles empty strings

Test cases for `analyzeText`:
- Returns correct word count and character count
- Detects language (English, Spanish, French, German) based on common words
- Returns sentiment score (positive, negative, neutral)
- Extracts meaningful keywords

Test cases for `calculatePriority`:
- Returns numeric priority (1-100)
- Higher priority for longer text
- Higher priority for text with URLs, numbers, emails
- Higher priority for text with important keywords (important, key, critical, etc.)
- Higher priority for technical indicators (code blocks, formulas)
- Higher priority for question/definition patterns
- Respects manual priority override if provided

Test cases for `computeFsrsData`:
- Returns object with `initial_difficulty`, `initial_stability`, `estimated_review_time`
- Stability scales with text length
- Difficulty defaults to 5.0 for unknown languages

Test cases for `estimateReadingTime`:
- 200 words per minute calculation
- Handles zero and negative inputs

**Files:** `browser_extension/tests/content.test.js`

---

### Task 9: Write tests for `popup.js` controller

Create `browser_extension/tests/popup.test.js`:

Test cases for `PopupController`:
- `getStatus` returns connection status
- `saveCurrentTab` sends correct message to background
- `toggleExtractMode` sends correct toggle message
- `quickExtract` sends selection to background
- `generateAISummary` sends correct AI request
- `testConnection` sends test message and handles response
- Statistics display updates correctly

Note: Since popup.js uses DOM APIs heavily, these tests will mock `document.querySelector`, `document.addEventListener`, etc. Focus on the message-sending logic, not the DOM manipulation.

**Files:** `browser_extension/tests/popup.test.js`

---

### Task 10: Run all tests and fix any issues

Run `npm test` in `browser_extension/`:
- Fix any import/mock issues
- Fix any function extraction issues from Task 2
- Ensure all tests pass
- Verify test output is clean (no warnings)

**Files:** Any files with test failures

---

### Task 11: Verify extension loads correctly in browser after changes

Manual verification:
- Load the extension in Firefox (about:debugging → Load Temporary Add-on)
- Verify no errors in browser console
- Test "Save Current Tab" → check Incrementum creates a Document (not Extract)
- Test "Quick Extract" on selected text → check Incrementum creates an Extract with HTML formatting
- Test "Create Extract" from context menu → check Incrementum creates an Extract with metadata
- Test "Save Link" → check Incrementum creates a Document
- Test "Save All Tabs" → check all tabs create Documents
- Verify extract mode toggle works
- Verify highlights persist

**Files:** No code changes expected; fix any regressions found
