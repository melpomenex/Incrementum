## Context

The PDF viewer uses PDF.js to render documents and implements custom position persistence (localStorage + backend). However, the browser's native `scrollRestoration` feature can interfere with this, causing visible "bouncing" during document load.

### Stakeholders
- End users reading PDFs
- PDF viewer component (`PDFViewer.tsx`)

### Constraints
- Must not break existing position persistence
- Must work across browsers (Chrome, Firefox, Safari, WebKitGTK/Tauri)
- Must not interfere with hash-based navigation (`usePdfUrlState`)

## Goals / Non-Goals

### Goals
- Eliminate scroll position "bouncing" during PDF load and refresh
- Ensure application-controlled scroll restoration takes precedence over browser-native behavior
- Provide clear timing: scroll restoration only after target page is rendered

### Non-Goals
- Changing PDF.js internal `ViewHistory` behavior (not applicable to this custom integration)
- Modifying hash-based URL state management
- Adding new user-facing features

## Decisions

### Decision 1: Set `history.scrollRestoration = 'manual'` on Mount

**What**: Set `scrollRestoration` to `'manual'` when the PDF viewer mounts, restore previous value on unmount.

**Why**: This is the standard approach to prevent browser scroll interference. It's safe because the application handles all scroll restoration.

**Code location**: `PDFViewer.tsx` - new `useEffect` at initialization

```typescript
useEffect(() => {
  const previous = history.scrollRestoration;
  history.scrollRestoration = 'manual';
  console.log('[PDFViewer] Disabled browser scroll restoration');
  return () => {
    history.scrollRestoration = previous || 'auto';
  };
}, []);
```

### Decision 2: Wait for Page Render Before Position Restoration

**What**: The existing `attemptRestore` retry logic already waits for pages to have non-zero height. Enhance this with a dedicated check that the target page's canvas/text layer has rendered.

**Why**: Even with `scrollRestoration = 'manual'`, scrolling before the page has height causes clamping to 0.

**Current state**: The code already has retry logic with a 15-attempt limit at 200ms intervals. This is adequate, but we should add logging to verify timing.

### Decision 3: Verification Logging

**What**: Add console logs to verify the scroll restoration sequence is controlled by the app.

**Why**: Helps verify the fix during testing and provides debugging info.

```typescript
console.log('[PDFViewer] Scroll restoration sequence:', {
  scrollRestoration: history.scrollRestoration,
  targetPage,
  containerReady: container.scrollHeight > 0,
  pageHeight: pageEl?.offsetHeight,
});
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Browser compatibility | Feature is well-supported (all modern browsers since 2016) |
| Unmount cleanup may restore 'auto' too early | Only restore if no other viewer is active (low risk for single-viewer app) |
| Existing retry logic may not be enough | Add logging first to verify; increase retry limit if needed |

## Migration Plan

1. Add `scrollRestoration` management to `PDFViewer.tsx`
2. Add verification logging
3. Test across browsers (Chrome, Firefox, Safari, Tauri/WebKitGTK)
4. Remove debug logging after verification (or convert to debug-only flag)

## Open Questions

None - the solution is straightforward and well-established.
