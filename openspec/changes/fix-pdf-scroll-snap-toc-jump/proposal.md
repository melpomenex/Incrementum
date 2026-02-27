## Why

PDF reading is currently unstable: scrolling can snap back, and navigating from the table of contents can cause pages to load/unload unpredictably and jump to incorrect locations. This blocks reliable document reading and makes TOC navigation difficult to use.

## What Changes

- Define expected scroll-position stability during normal PDF reading so viewport position is not aggressively overridden after user scroll input.
- Define deterministic TOC navigation behavior so selecting a heading lands on the correct destination and remains stable as pages render.
- Define rendering-state constraints to prevent page virtualization or redraw events from causing visible navigation hops across unrelated pages.

## Capabilities

### New Capabilities
- `pdf-navigation-stability`: Stable in-document navigation behavior for PDFs, including user scroll continuity, TOC destination handling, and render-time position preservation.

### Modified Capabilities
- None.

## Impact

- Affected code: PDF viewer state management, scroll synchronization logic, TOC click handling, destination resolution, and virtualized page rendering coordination.
- APIs/systems: Internal document-view navigation and rendering pipeline (no external API contract changes expected).
- User impact: More predictable reading and in-document navigation for PDF files.
