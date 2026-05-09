## Why

When a user saves a page via the browser extension (right-click → "Save Link to Incrementum"), the captured HTML preserves the original page's inline computed styles — colors, fonts, backgrounds, spacing. This means saved content is rendered with the source website's visual identity rather than conforming to the user's chosen app theme. The result is a jarring visual disconnect: the rest of the app respects the theme, but saved articles look like they were pasted from a foreign website.

## What Changes

- **Browser extension content capture** will stop inlining cosmetic CSS properties (color, background, font-family, font-size, etc.) and instead capture structural/layout properties only (display, flex, grid, margin, padding, width, etc.)
- **Image preservation** remains intact — `<img>` elements with absolute URLs continue to be captured
- **The HTML viewer** (DocumentViewer iframe) will apply theme-aware styling using CSS custom properties from the active theme, replacing the current approach of injecting theme colors alongside pre-inlined styles
- **Layout preservation** is best-effort — structural CSS (flexbox, grid, spacing) is preserved while visual/thematic CSS is stripped and replaced with theme tokens
- **RichContentRenderer** (for extracts) applies the same theme-aware rendering so extracts also match the user's theme

## Capabilities

### New Capabilities
- `theme-styled-content-capture`: Defines how browser extension captures HTML — stripping cosmetic styles, preserving structural layout and images, and marking content as theme-ready
- `themed-html-rendering`: Defines how HTML content is rendered in iframes using the active theme's CSS custom properties, ensuring saved content visually matches the app's theme

### Modified Capabilities
<!-- No existing specs are being modified -->

## Impact

- **Browser extension**: `content.js` — `captureStyledArticleHtml()` changes from inlining all computed styles to inlining structural-only styles
- **Frontend**: `DocumentViewer.tsx` — `injectHtmlViewerStyles()` becomes the primary styling mechanism for saved HTML content
- **Frontend**: `RichContentRenderer.tsx` — rendering logic updated to apply theme styles to extract HTML
- **Backend**: No backend changes needed — HTML storage format stays the same, rendering changes are frontend-only
- **Existing saved content**: Content already saved with inline styles continues to work — the theme injection layer overrides inline styles using CSS specificity (`!important` or higher specificity selectors)
