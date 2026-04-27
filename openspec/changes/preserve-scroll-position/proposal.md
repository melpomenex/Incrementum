## Why

When reading a PDF-converted-to-HTML document, switching to "View Extracts" and back to "View Document" loses the reader's scroll position. The HTML iframe is unmounted during view switches, and no scroll state is captured or restored for HTML documents. This disrupts the reading flow and forces users to manually find their place again.

## What Changes

- Capture scroll position from the HTML iframe's internal `contentWindow` during reading
- Persist the captured scroll position to the existing `readerPosition` storage layer (same as PDF)
- Restore scroll position when returning to "View Document" after visiting extracts or cards
- Extend the existing scroll capture/restore mechanism to work with HTML iframe documents

## Capabilities

### New Capabilities

- `html-scroll-persistence`: Capture, persist, and restore scroll position for HTML (iframe-based) documents when switching between view modes (document/extracts/cards).

### Modified Capabilities

## Impact

- **`src/components/viewer/DocumentViewer.tsx`**: Add scroll event listener on iframe `contentWindow`, extend `captureScrollState` to read iframe scroll, extend restoration logic to apply to HTML documents
- **`src/lib/readerPosition.ts`**: May need minor adjustments to support HTML scroll data format
- No API or dependency changes — uses existing localStorage + ViewState infrastructure
