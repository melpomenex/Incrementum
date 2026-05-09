## Context

The browser extension captures web page content via `content.js` → `captureStyledArticleHtml()`. This function clones the DOM and inlines ~16 computed CSS properties per element, including cosmetic ones (color, background-color, font-family, font-size, etc.). The result is HTML that visually matches the original page — but ignores the user's app theme entirely.

The DocumentViewer already has `injectHtmlViewerStyles()` which reads theme CSS variables and injects theme-aware styles into the iframe. However, inline styles from the capture process have higher specificity than the injected `<style>` block, so theme colors lose.

RichContentRenderer (for extracts) uses hardcoded light-theme colors (`#1a1a1a`, `#f5f5f5`, `#0066cc`) and has no theme awareness at all.

## Goals / Non-Goals

**Goals:**
- Saved HTML content renders with the user's active theme colors, fonts, and spacing
- Images are preserved with correct sizing and borders
- Layout structure (flex, grid, spacing hierarchy) is best-effort preserved
- Existing saved content (with inline styles) continues to render correctly with theme applied
- Extracts rendered via RichContentRenderer also respect the active theme

**Non-Goals:**
- Pixel-perfect reproduction of the original page layout (best-effort only)
- Preserving original page animations, hover effects, or interactive elements
- Re-processing/re-saving previously saved content
- Changing the Rust backend storage format

## Decisions

### 1. Split style properties into structural vs cosmetic in content.js

**Decision**: In `captureStyledArticleHtml()`, only inline structural CSS properties. Remove cosmetic properties.

- **Structural** (keep): `display`, `flex-direction`, `flex-wrap`, `justify-content`, `align-items`, `grid-template-columns`, `grid-template-rows`, `margin-*`, `padding-*`, `width`, `max-width`, `min-width`, `border-collapse`, `list-style-type`, `white-space`, `overflow-x`
- **Cosmetic** (remove): `color`, `background-color`, `font-family`, `font-size`, `font-weight`, `font-style`, `line-height`, `text-align`, `text-decoration`, `text-transform`, `letter-spacing`

**Rationale**: Structural properties define layout (how elements are arranged). Cosmetic properties define appearance (colors, fonts) which should come from the theme. By removing cosmetic inlines, the injected `<style>` block's declarations apply without needing `!important` everywhere.

**Alternative considered**: Keep all inlines and use `!important` on every injected rule. Rejected because it's fragile — every new element type would need an `!important` override, and specificity wars make maintenance painful.

### 2. Enhance injectHtmlViewerStyles() with a catch-all reset for cosmetic inline styles

**Decision**: Add a broad CSS reset rule that strips inline cosmetic styles from all elements, then apply theme styles via CSS classes.

```css
body * {
  color: inherit !important;
  background-color: transparent !important;
  font-family: inherit !important;
  font-size: inherit !important;
}
body { color: ${fg}; font-family: ${ff}; font-size: ${fs.fontSize}px; }
```

**Rationale**: This handles both new captures (no cosmetic inlines) and legacy content (has cosmetic inlines) with a single approach. The `inherit` cascade means children naturally pick up theme colors set on `<body>`.

### 3. Make RichContentRenderer theme-aware

**Decision**: Pass theme colors into `createIframeDocument()` instead of using hardcoded values. Read CSS variables from the parent document and generate theme-matched styles.

**Rationale**: Extracts currently render with hardcoded light-theme colors regardless of the user's theme. This is the same pattern `injectHtmlViewerStyles()` uses — read CSS custom properties from parent and apply in iframe.

**Alternative considered**: Use `color-scheme` CSS property and let the browser handle it. Rejected because it doesn't give us precise control over theme tokens (primary, muted, border, etc.).

### 4. Preserve semantic HTML structure from capture

**Decision**: The content.js capture continues to preserve the full DOM structure (headings, paragraphs, lists, tables, images, links). Only the inlined style property set changes.

**Rationale**: The injected theme styles in DocumentViewer already target semantic elements (h2, h3, p, table, blockquote, img, etc.). Preserving the DOM structure without cosmetic inlines lets these rules apply cleanly.

## Risks / Trade-offs

- **Layout fidelity loss** → Some pages rely on font-size/weight for spacing (e.g., navigation menus). Removing these may collapse spacing. Mitigation: structural margin/padding properties are preserved, and the theme's line-height/font-size cascade fills in reasonable defaults.
- **Legacy content may look different** → Previously saved content with cosmetic inlines will now have those overridden by theme. This is the desired behavior, but users may notice the change. Mitigation: the change is an improvement (content matches theme), and there's no data loss.
- **Images from CORS-restricted sources** → Images with absolute URLs may still fail to load if the source server blocks cross-origin requests. This is an existing limitation, not introduced by this change.
