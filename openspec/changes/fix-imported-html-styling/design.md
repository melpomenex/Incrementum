## Context

Browser extension page saves capture the source site's computed CSS styles and inline them onto every DOM element via `captureStyledArticleHtml()`. The viewer then renders this HTML in a sandboxed iframe and injects theme-aware CSS via `injectHtmlViewerStyles()`. The injected CSS applies typography settings (`font-size`, `line-height`, `font-family`) only to `body`, relying on CSS inheritance for child elements. However, inline `style` attributes on child elements override inherited values, so the source site's typography leaks through.

Additionally, the viewer's injected CSS has no heading size overrides and no element spacing normalization, so articles render with the source site's heading sizes and margins intact — often producing poor typography hierarchy and layout inside the app.

## Goals / Non-Goals

**Goals:**
- Ensure imported HTML articles use the app's typography settings (font size, line height, font family) consistently across all elements
- Provide proper heading hierarchy (h1–h6) for imported articles
- Normalize element spacing so source-site layout doesn't leak into the viewer
- Preserve intentional formatting: bold, italic, links, lists, code blocks, blockquotes, tables

**Non-Goals:**
- Modifying the browser extension itself
- Changing how HTML content is stored (model/schema stays the same)
- Pixel-perfect reproduction of source site appearance
- Fixing styling for file-imported HTML documents (which don't go through the extension path)

## Decisions

### 1. Strip inline styles in `processHtmlContent()` rather than only adding stronger overrides

**Choice:** Remove all inline `style` attributes from elements in `processHtmlContent()` (called for browser extension documents).

**Alternatives considered:**
- Add `font-size`, `line-height`, `font-family` to the `*` selector with `!important` — this works but leaves all other inline styles (margins, padding, display, etc.) intact, which still causes layout issues from the source site
- Strip inline styles in the extension's `captureStyledArticleHtml()` — this changes the extension and affects the data stored in the database for existing documents
- Use CSS `all: revert` on child elements — too aggressive, removes intentional formatting like `display: inline` on spans

**Rationale:** Stripping inline styles at the processing layer is the cleanest approach. The viewer already has comprehensive theme CSS that handles typography, colors, spacing, and element types. Removing inline styles lets the viewer's CSS take full control. This only affects rendering — the stored HTML is unchanged (styles are only stripped when processing for display).

### 2. Add heading size overrides and element spacing normalization to `injectHtmlViewerStyles()`

**Choice:** Add explicit `font-size` overrides for `h1`–`h6` (scaling relative to the base font size) and normalize margins/padding on common block elements.

**Rationale:** Without heading sizes, articles render with all text at the same size (the body font size). The heading sizes should be relative to the user's configured base font size so they scale appropriately.

## Risks / Trade-offs

- **Loss of intentional source-site styling** → Some articles may have meaningful layout that gets lost (e.g., multi-column layouts, special section styling). This is acceptable because the viewer is a reading environment, not a site reproduction tool.
- **Existing stored documents with inline styles** → Since we strip at display time (not storage time), existing documents benefit immediately without migration.
- **Performance** → Iterating all elements to strip styles adds negligible overhead during processing (DOMParser is already used).
