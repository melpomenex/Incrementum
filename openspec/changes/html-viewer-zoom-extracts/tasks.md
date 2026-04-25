## 1. Settings Store

- [x] 1.1 Add `HTMLSettings` interface to settingsStore.ts (fontSize, fontFamily, lineHeight) matching EPUBSettings shape
- [x] 1.2 Add `htmlSettings` to `DocumentsSettings` interface and default values (fontSize=16, fontFamily="serif", lineHeight=1.6)
- [x] 1.3 Add migration/merge for `htmlSettings` in the persistence layer alongside existing `epubSettings` merge
- [x] 1.4 Add `updateHtmlSettings` action to settingsStore (uses same updateSettings pattern as EPUB — no separate action needed)

## 2. CSS Injection & Theming

- [x] 2.1 Create a function to generate HTML viewer CSS string (font size, line height, font family, theme colors for body/headings/links/code/tables)
- [x] 2.2 Add theme detection logic (read dark class from document.documentElement)
- [x] 2.3 Inject/update `<style id="html-viewer-styles">` into iframe document on load and on settings/theme change

## 3. Floating Settings Panel

- [x] 3.1 Add state for settings panel visibility (showHtmlSettings boolean)
- [x] 3.2 Add floating toggle button in top-right corner of HTML viewer section (same pattern as EPUB font settings button)
- [x] 3.3 Add expandable settings panel with font size A-/A+ controls, reset button, line height slider/buttons, font family selection (serif/sans-serif/monospace)
- [x] 3.4 Add i18n keys for new controls (reuse existing viewer.fontSize, viewer.increaseFontSize etc. where possible, add new keys for html-specific labels)

## 4. Keyboard Shortcuts & Scroll Zoom

- [x] 4.1 Add useEffect for keyboard handlers (Ctrl+/-/0) scoped to when docType === "html"
- [x] 4.2 Add wheel handler for Ctrl+scroll zoom on the HTML viewer container

## 5. Integration

- [x] 5.1 Wire settings changes to CSS injection — when htmlSettings or theme changes, update iframe styles
- [x] 5.2 Ensure iframe onLoad calls both scrollHtmlFrameToInitialHit and the new CSS injection
- [x] 5.3 Verify text selection still produces TextSelectionContext with surface "html" and the "Create Extract" button appears
- [x] 5.4 Verify extract highlights still render correctly via applyAnchoredTextHighlights inside the iframe
