## Why

In Scroll Mode (Optimal Session), two sets of rating orbs are rendered simultaneously when viewing a document: one set from `QueueScrollPage`'s side rating controls and another from `DocumentViewer`'s own orb rating buttons. This creates visual clutter and confusion. Only the set positioned alongside the assistant panel should remain.

## What Changes

- Remove the orb rating buttons from `DocumentViewer.tsx` (lines ~4911-4991) so they no longer render when `DocumentViewer` is embedded inside `QueueScrollPage`
- Ensure the side rating controls in `QueueScrollPage.tsx` (lines ~2334-2455) remain as the sole rating UI for documents in Scroll Mode
- Preserve DocumentViewer's rating orbs when it is used standalone (outside Scroll Mode)

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `document-rating`: Remove duplicate orb rendering in Scroll Mode — DocumentViewer must not show its own rating orbs when embedded in QueueScrollPage

## Impact

- `src/components/viewer/DocumentViewer.tsx` — conditional hiding of orb rating buttons
- `src/pages/QueueScrollPage.tsx` — no structural change, remains the authoritative rating location in Scroll Mode
