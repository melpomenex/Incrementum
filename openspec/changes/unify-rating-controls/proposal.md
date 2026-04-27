## Why

The app has two competing rating UIs: orb-style circular buttons on the right side of the queue view (modern, always visible, clean) and legacy hover-triggered bar controls at the bottom of the document viewer (hidden until mouse proximity, inconsistent styling). The legacy hover controls create a disjointed UX and are unnecessary since the orb pattern already works well.

## What Changes

- **Remove** `HoverRatingControls` component and all its usages from `DocumentViewer`
- **Remove** the compact floating "Rate" pill button variant (mobile EPUB mode in `HoverRatingControls`)
- **Add** orb-style rating buttons to the `DocumentViewer` component, matching the existing `QueueScrollPage` pattern — positioned on the right side of the window, always visible for documents that have review history
- Keyboard shortcuts (1-4) continue to work as before, wired through the new orb buttons

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `document-rating`: Rating interaction moves from hover-bar to inline orb buttons in document viewer; keyboard shortcut behavior unchanged

## Impact

- `src/components/review/HoverRatingControls.tsx` — deleted
- `src/components/viewer/DocumentViewer.tsx` — remove HoverRatingControls import/rendering, add orb rating buttons
- `src/pages/QueueScrollPage.tsx` — reference for orb button pattern (may extract shared component)
- Existing `document-rating` spec needs updated scenarios to reflect the new UI trigger
