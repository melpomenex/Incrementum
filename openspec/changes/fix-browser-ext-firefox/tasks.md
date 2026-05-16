## 1. Fix Server-Side Auth Bypass

- [x] 1.1 Add `return next.run(request).await;` inside the `if request.uri().path() == "/" && request.method() == "POST"` block in `require_api_key` middleware (`src-tauri/src/browser_sync_server.rs` ~line 1392)
- [x] 1.2 Verify automation endpoints (`/api/automation/*`) still require API key when configured

## 2. Fix Extension Toast for Failed Saves

- [x] 2.1 Remove the `!success` guard from `sendInPageToast` in `background.js` (~line 742) so error toasts render
- [x] 2.2 Update `showSaveIndicator` in `content.js` (~line 260) to accept a `type` parameter (`success`/`error`) and apply red styling for errors
- [x] 2.3 Pass `success` flag through to `showSaveIndicator` via the `showSaveIndicator` message action so the content script knows whether to render success or error styling

## 3. Add Fallback Notification for Missing Tab Context

- [x] 3.1 Add a native notification fallback in `sendInPageToast` when `tabId` is falsy — use `chrome.notifications.create` with the result message
- [x] 3.2 Update `saveLink` in `background.js` to pass an error message on failure (not just success message)

## 4. Verification

- [x] 4.1 Build the Rust backend and confirm no compilation errors
- [ ] 4.2 Test browser extension saves work with and without API key configured
