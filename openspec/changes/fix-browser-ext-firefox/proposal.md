## Why

The browser extension returns a 401 Unauthorized error on Firefox when users try to save content, making the extension completely non-functional. Additionally, when using the "Save Link to Incrementum" context menu action, no toast notification is shown — users get zero feedback on whether the operation succeeded or failed.

## What Changes

- **Fix the `require_api_key` middleware bypass** for `POST /` — the current if-block has no `return` statement, so browser extension requests fall through to the auth check and get rejected with 401 when an API key is configured.
- **Fix `sendInPageToast` to show error toasts** — currently returns early when `success` is false, so failed saves produce no user feedback at all.
- **Ensure toast shows for `save-link` context menu** on Firefox by handling the case where `tabId` may not be available and providing a fallback notification mechanism.

## Capabilities

### New Capabilities
- `browser-ext-auth-bypass`: Properly exempts browser extension requests (`POST /`) from the API key middleware so the extension works without credentials.
- `browser-ext-error-toast`: Shows toast feedback for all save outcomes (success, error, cached) from context menu actions including save-link.

### Modified Capabilities
- `toast-extract-feedback`: Extends the existing toast system to handle error states and context-menu-initiated saves, not just successful extracts.

## Impact

- **`src-tauri/src/browser_sync_server.rs`**: `require_api_key` middleware — add early return for `POST /` route.
- **`browser_extension/background.js`**: `sendInPageToast` — remove the `!success` guard and add error/failure message support; `saveLink` — handle missing tabId for toast fallback.
- **`browser_extension/content.js`**: `showSaveIndicator` — support error styling for failure toasts.
