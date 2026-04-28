## 1. Strip inline styles from imported HTML

- [x] 1.1 In `processHtmlContent()` (`src/utils/documentImport.ts`), add a step after event handler removal that iterates all elements and removes their `style` attribute
- [x] 1.2 Verify the stripping preserves HTML structure — only the `style` attribute is removed, no elements, classes, or other attributes are touched

## 2. Strengthen viewer CSS overrides

- [x] 2.1 In `injectHtmlViewerStyles()` (`src/components/viewer/DocumentViewer.tsx`), add `font-size`, `line-height`, and `font-family` with `!important` to the universal selector `*` rule (alongside the existing `color` and `background-color` overrides)
- [x] 2.2 Add explicit `font-size` rules for `h1`–`h6` using `em` units relative to the base font size (e.g., h1: 2em, h2: 1.5em, h3: 1.25em, h4: 1.1em, h5: 1em, h6: 0.9em)
- [x] 2.3 Add margin normalization for block elements (`p`, `h1`–`h6`, `ul`, `ol`, `li`, `blockquote`, `pre`, `table`, `figure`) with `!important` to override any source-site spacing

## 3. Test

- [ ] 3.1 Build and launch the app, import a web page via the browser extension, and verify it renders with consistent app typography, proper heading hierarchy, and reasonable spacing
