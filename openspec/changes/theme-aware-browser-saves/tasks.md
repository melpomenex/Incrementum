## 1. Browser Extension — Content Capture

- [x] 1.1 Update `captureStyledArticleHtml()` in `browser_extension/content.js` to split the `styleProps` array into structural and cosmetic properties, keeping only structural properties in the inline style capture
- [x] 1.2 Verify `captureSelectionHTML()` (used for extracts in extract mode) also uses structural-only style properties so extracts are theme-ready
- [x] 1.3 Test that image `src` attributes are preserved as absolute URLs after the style property changes
- [x] 1.4 Test that anchor `href` attributes are preserved as absolute URLs after the style property changes

## 2. DocumentViewer — Theme Override for Inline Styles

- [x] 2.1 Add a catch-all CSS reset in `injectHtmlViewerStyles()` that overrides cosmetic inline styles on all elements using `color: inherit !important; background-color: transparent !important; font-family: inherit !important; font-size: inherit !important` on `body *`
- [x] 2.2 Ensure `<body>` itself receives the theme's foreground color, background color, font family, font size, and line height as base values
- [x] 2.3 Verify that semantic elements (h2, h3, p, table, blockquote, code, img, a) still receive their specific theme-matched styles from the injected stylesheet
- [x] 2.4 Test with a previously saved document that has cosmetic inline styles (legacy content) to confirm theme overrides are applied correctly
- [x] 2.5 Test with a newly saved document (structural-only inlines) to confirm theme styles apply without conflicts
- [x] 2.6 Verify font size, line height, and font family controls in the viewer toolbar still work after the CSS changes

## 3. RichContentRenderer — Theme-Aware Rendering

- [x] 3.1 Update `createIframeDocument()` in `src/components/common/RichContentRenderer.tsx` to accept theme color parameters instead of using hardcoded colors
- [x] 3.2 In the `RichContentRenderer` component, read CSS custom properties from the parent document (`--color-background`, `--color-foreground`, `--color-primary`, `--color-muted`, `--color-muted-foreground`, `--color-border`) and pass them to `createIframeDocument()`
- [x] 3.3 Replace all hardcoded colors in `createIframeDocument()` with the theme-derived values (text color, background, link color, code background, table borders, blockquote border)
- [x] 3.4 Test extracts render correctly in both light and dark themes
- [x] 3.5 Test that the iframe background becomes transparent or matches the theme background (no white flash)

## 4. Integration Testing

- [x] 4.1 End-to-end test: save a page via browser extension, verify it renders with the active theme in DocumentViewer
- [x] 4.2 End-to-end test: save a link via browser extension, verify it renders with the active theme
- [x] 4.3 Test theme switching while viewing a saved document — verify colors update immediately
- [x] 4.4 Test that images display correctly with theme-matched borders in both light and dark themes
- [x] 4.5 Test that tables, blockquotes, code blocks, and links all use theme tokens in saved content
