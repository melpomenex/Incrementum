## Why

The HTML viewer (used for PDF-to-HTML conversion) renders as a bare iframe with no reading controls. Users cannot zoom, adjust font size/line-height/font-family, or get a comfortable reading experience comparable to the EPUB viewer. Extracts partially work but lack the polished selection-to-highlight flow that EPUB provides.

## What Changes

- Add font size controls (A-/A+ buttons) with Ctrl+/- keyboard shortcuts and Ctrl+0 reset
- Add line height adjustment and font family selection (serif/sans-serif/monospace)
- Add Ctrl+scroll zoom support
- Add a floating settings panel (desktop) and settings sheet (mobile) matching EPUB viewer UX
- Persist HTML viewer reading settings via useSettingsStore
- Apply dark/light theme CSS dynamically to iframe content
- Ensure text selection reliably produces TextSelectionContext with anchored offsets and the "Create Extract" button appears
- Ensure extract highlights render correctly inside the iframe

## Capabilities

### New Capabilities
- `html-reader-controls`: Font size, line height, font family controls, keyboard shortcuts, and settings persistence for the HTML iframe viewer
- `html-viewer-theming`: Dynamic dark/light mode theming applied to iframe content

### Modified Capabilities

## Impact

- `src/components/viewer/DocumentViewer.tsx` — HTML iframe rendering section (~line 4139), settings state, keyboard handlers
- `src/components/viewer/EPUBViewer.tsx` — reference implementation for controls pattern
- `src/lib/stores/settingsStore.ts` — new `htmlSettings` section alongside existing `epubSettings`
- CSS injection into iframe via postMessage or direct DOM manipulation
