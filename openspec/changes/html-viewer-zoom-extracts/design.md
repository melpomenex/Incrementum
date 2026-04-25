## Context

The HTML viewer renders converted PDF content as a bare `<iframe srcDoc>` inside DocumentViewer.tsx (~line 4139). It has text selection and extract support via DOM event listeners, but no reading controls. The EPUB viewer (EPUBViewer.tsx) has a full control panel with font size, line height, font family, keyboard shortcuts, and settings persistence. This change brings the HTML viewer's reading experience to parity.

## Goals / Non-Goals

**Goals:**
- Font size, line height, and font family controls for the HTML iframe viewer
- Keyboard shortcuts (Ctrl+/-/0, Ctrl+scroll) matching EPUB viewer
- Floating settings panel (desktop) with expand/collapse toggle
- Persistent settings via settingsStore alongside existing `epubSettings`
- Dark/light theming applied to iframe content
- Reliable text selection → extract flow

**Non-Goals:**
- Table of contents for HTML (HTML docs from PDF conversion don't have structured TOC)
- Progress tracking (HTML docs don't have paginated locations)
- Mobile-specific chrome (tap zones, bottom bar) — mobile already renders the iframe full-screen
- Dedicated HTMLViewer component file — keep it inline in DocumentViewer to minimize refactoring

## Decisions

### 1. CSS injection via direct DOM manipulation (not postMessage)

Apply styles by injecting a `<style>` element into the iframe's document head on load and on settings change. This is simpler than postMessage and works because we control the `srcDoc` content. The iframe uses `sandbox="allow-same-origin"` so we have DOM access.

### 2. Shared settings shape with EPUB

Add `htmlSettings` to settingsStore with the same shape as `epubSettings` (fontSize, fontFamily, lineHeight). Keep them separate so EPUB and HTML reading preferences can differ independently. Defaults: fontSize=16, fontFamily="serif", lineHeight=1.6.

### 3. Inline implementation in DocumentViewer.tsx

Add the controls, keyboard handlers, and CSS injection logic directly in DocumentViewer.tsx around the existing HTML iframe section. Extract into a separate component only if it grows past ~200 lines. This avoids a premature refactor of the 4300-line file.

### 4. Theming via CSS custom properties

Inject CSS that maps the app's current theme (dark/light) to CSS custom properties inside the iframe. Use `document.documentElement.classList.contains("dark")` to detect theme and apply matching styles.

## Risks / Trade-offs

- **Iframe CSP restrictions** → The `sandbox="allow-same-origin"` attribute gives us DOM access. No risk here since we control the srcDoc content.
- **Performance on settings change** → Re-injecting styles on every font size change is fast (single DOM operation). No debounce needed.
- **Code bloat in DocumentViewer.tsx** → Acceptable for now. If HTML viewer grows significantly, extract to HTMLViewer.tsx component.
