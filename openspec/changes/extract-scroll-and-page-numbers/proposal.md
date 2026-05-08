## Why

In scroll mode, extracts from EPUB and PDF documents are displayed without meaningful page numbers. EPUB extracts never store a page number (EPUBs use CFI locations, not integer pages), and PDF extracts rely on the viewer's current page state which may not match the actual selection location. Users need page context on extract cards to locate the source material quickly when reviewing.

Additionally, when viewing extracts in scroll mode, the extract content is rendered in a fixed-height card (`max-h-[60vh]` with `overflow-y-auto`) but mouse wheel events are captured by the parent scroll handler, preventing the user from scrolling through long extract content.

## What Changes

- Allow scrolling within extract cards in scroll mode by preventing the parent wheel handler from advancing to the next/previous item when the user is scrolling within the extract content area
- Calculate and store a meaningful page number for EPUB extracts at creation time by converting the CFI range position to an approximate page number based on the document's spine/chapter structure
- Ensure PDF extract page numbers are reliably populated from the selection context's `pageNumber` field rather than relying on the viewer's current page state

## Capabilities

### New Capabilities
- `extract-scroll-interaction`: Proper scroll containment within extract cards in scroll mode — wheel events inside the extract content area scroll the content, not the queue
- `epub-page-number-mapping`: Calculate approximate page numbers for EPUB extracts by mapping CFI positions to spine-based page offsets at extraction time

### Modified Capabilities

## Impact

- **ExtractScrollItem.tsx**: Add scroll containment logic to prevent wheel events from bubbling when content is scrollable
- **QueueScrollPage.tsx**: Update wheel handler to recognize extract items as scrollable (similar to existing EPUB/PDF document handling)
- **EPUBViewer.tsx** / **useToastExtract.ts**: Capture and pass page number context when creating EPUB extracts
- **DocumentViewer.tsx**: Ensure PDF extract creation always uses the selection context's page number
- **Backend (Rust)**: Potentially a new utility to map CFI to approximate page number for EPUB documents
