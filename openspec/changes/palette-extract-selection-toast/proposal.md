## Why

When using EPUB (or any document type) in Palette mode, selecting text does not surface the extract button — users lose the ability to create highlights/extracts without leaving palette mode. Additionally, the toast notification that should confirm extract creation (via the bottom-right extract button in normal document view) does not appear, breaking the feedback loop defined in the `toast-extract-feedback` spec.

## What Changes

- Add text-selection detection inside `EditableContentPalette` that propagates selected text up to `DocumentViewer`, enabling the existing floating extract button and instant-highlight flow to work in palette mode.
- Wire the `SelectionPopup` (or equivalent inline extract trigger) to appear on text selection within palette mode, matching the PDF viewer experience.
- Fix the toast notification so that creating an extract via the bottom-right button in any view mode shows the success/error toast as specified.

## Capabilities

### New Capabilities
- `palette-mode-extract`: Enables text selection–driven extract creation (floating extract button + instant highlight) when viewing documents in Palette mode.

### Modified Capabilities
- `toast-extract-feedback`: Fix the toast notification so it reliably appears when an extract is created from the floating extract button in the document viewer.

## Impact

- `EditableContentPalette.tsx` — add selection event listeners and callback props
- `DocumentViewer.tsx` — wire selection from palette mode into existing extract flow
- `useToastExtract.ts` or extract creation path in `DocumentViewer.tsx` — fix toast not showing
- `SelectionPopup.tsx` — may need reuse in palette mode context
