## Why

PDF documents exhibit a "bouncing scroll" behavior on load and refresh where the viewport unexpectedly snaps or reverts to previous positions. This is caused by a race condition between the browser's native `history.scrollRestoration` feature and the application's PDF.js position restoration logic.

## Root Cause Analysis

The "bouncing" occurs due to the following sequence:

1. **Browser Attempts Restoration**: When loading a PDF, the browser remembers the previous scroll position (e.g., Y=5000px) and tries to scroll there immediately.
2. **Container Height is Zero**: PDF.js starts loading, but the container height is initially 0px because pages haven't rendered yet.
3. **First Bounce**: The browser tries to scroll to 5000, realizes the document is only 0px high, and clamps/bounces the scroll position back to 0.
4. **Second Bounce**: PDF.js finally renders pages, finds its own saved position in localStorage/backend, and suddenly jerks the viewport back to the target page.

By setting `history.scrollRestoration = 'manual'`, we tell the browser to stay out of scroll management and let the application handle positioning once the PDF is ready.

## What Changes

- Disable browser-native scroll restoration (`history.scrollRestoration = 'manual'`) during PDF viewer initialization.
- Ensure scroll-to-position commands execute only after the target page has rendered in the DOM (hook into `pagerendered`-like timing).
- Document the behavior and provide verification logging.

## Capabilities

### Modified Capabilities
- `pdf-navigation-stability`: Add explicit requirement for browser scroll restoration isolation.

### New Capabilities
- None.

## Impact

- Affected code: `src/components/viewer/PDFViewer.tsx` (initialization, scroll restoration logic)
- APIs/systems: Internal only, no external API changes
- User impact: PDFs will no longer "bounce" or jerk during load, refresh, or navigation
