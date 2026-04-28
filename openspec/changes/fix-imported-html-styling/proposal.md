## Why

When saving a web page via the browser extension context menu ("Save to Incrementum"), the imported article renders poorly in the document viewer. The browser extension's `captureStyledArticleHtml()` inlines computed CSS styles (font-size, line-height, margins, padding, etc.) from the source site onto every DOM element. These inline styles conflict with the viewer's injected theme CSS because the viewer only applies font metrics (`font-size`, `line-height`, `font-family`) to `body`, not to child elements. Inline styles on individual `<p>`, `<h1>`, `<div>`, etc. elements override the inherited values from `body`, preserving the source site's layout quirks inside the app's viewer — resulting in excessive line heights, inconsistent font sizes, cramped/narrow columns, and poor readability.

## What Changes

- Strip inlined presentation styles from extension-captured HTML in `processHtmlContent()` before it enters the iframe, so the viewer's injected theme CSS takes full control
- Override `font-size`, `line-height`, and `font-family` on the universal selector (`*`) in `injectHtmlViewerStyles()` using `!important` to guarantee the app's typography settings win over any residual inline styles
- Add heading size differentiation (`h1`–`h6`) to the injected CSS so articles have proper typographic hierarchy
- Normalize common element spacing (margins/padding) in the injected CSS to prevent source-site layout leaking into the viewer

## Capabilities

### New Capabilities

None — this is a styling/UX fix within existing import and viewer code.

### Modified Capabilities

None — no spec-level behavior changes. The import flow and document model remain the same; only the CSS styling pipeline changes.

## Impact

- `src/utils/documentImport.ts` — `processHtmlContent()` gains inline style stripping
- `src/components/viewer/DocumentViewer.tsx` — `injectHtmlViewerStyles()` gets stronger overrides and heading/spacing normalization
- No API or model changes
- No changes to the browser extension itself
