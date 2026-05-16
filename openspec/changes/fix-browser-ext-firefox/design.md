## Context

The browser extension communicates with the Tauri app via HTTP POST to `http://127.0.0.1:8766/`. The server has an optional API key middleware (`require_api_key`) applied globally to all routes. The middleware has an incomplete bypass for the browser extension's `POST /` endpoint — the if-block matches the path but has no `return` statement, so requests fall through to the auth check and get 401 when any API key is configured.

On the extension side, `sendInPageToast` skips rendering when `success` is `false` or `tabId` is missing, meaning failed saves and certain context-menu flows produce zero user feedback.

## Goals / Non-Goals

**Goals:**
- Browser extension saves work on Firefox (and all browsers) regardless of whether an API key is configured
- Users always get visual feedback from context menu actions — success or failure
- Maintain the existing auth requirement for automation API endpoints (`/api/automation/*`)

**Non-Goals:**
- Adding authentication to the browser extension itself
- Changing the CORS policy
- Modifying the extension's offline queue behavior
- Redesigning the toast notification UI

## Decisions

### 1. Fix middleware bypass with early return for `POST /`

Add `return next.run(request).await;` inside the existing `if request.uri().path() == "/" && request.method() == "POST"` block in `require_api_key`.

**Alternative considered**: Move browser sync routes to a separate router without the middleware layer. Rejected because it requires restructuring the router and risks regressions on other endpoints.

### 2. Show error toasts for failed saves

Remove the `!success` guard from `sendInPageToast`. Instead, accept a `success` boolean that controls toast styling (green for success, red for error). The message parameter already supports custom text.

### 3. Fallback when tabId is unavailable for toast

When `tabId` is undefined (e.g., context menu fired in a context where tab isn't provided), fall back to `chrome.notifications.create()` for a native browser notification. This ensures the user always gets feedback.

## Risks / Trade-offs

- **Risk**: Exempting `POST /` from auth could theoretically allow unauthenticated local access → **Mitigation**: The server only listens on 127.0.0.1 and CORS restricts origins to extension schemes and localhost. This is the existing security model — no change in threat surface.
- **Risk**: Native notifications require the `notifications` permission (already declared in manifest) → **No issue**: Permission already granted.
