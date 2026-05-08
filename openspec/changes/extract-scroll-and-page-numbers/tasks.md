## 1. Extract Scroll Containment

- [x] 1.1 Add `data-extract-scroll="true"` attribute to the content container div (`overflow-y-auto`) in `ExtractScrollItem.tsx`
- [x] 1.2 In `QueueScrollPage.tsx` wheel handler, add extract items to the scrollable check: when the current item is an extract type, query for `[data-extract-scroll="true"]` and prevent auto-advance if the element can still scroll in the wheel direction
- [x] 1.3 In `QueueScrollPage.tsx` touch handler, apply the same scrollable check for extract items to prevent swipe navigation when content is scrollable
- [x] 1.4 Test: long extract content scrolls via mouse wheel without advancing queue; short extract content still advances queue normally

## 2. EPUB Page Number Calculation

- [x] 2.1 In `DocumentViewer.tsx`, store the latest `scrollPercent` from EPUB's `handleScrollPositionChange` in a ref (it's already received but not persisted for extract creation)
- [x] 2.2 At each EPUB extract creation call site (floating button, mobile button, CreateExtractDialog), when the document is an EPUB, compute `Math.ceil((scrollPercent / 100) * totalPages)` and pass it as `pageNumber` instead of the hardcoded `1`
- [x] 2.3 Ensure `totalPages` is available at the creation call site (it should be from `currentDocument.totalPages` which is populated from the database)

## 3. PDF Page Number Reliability

- [x] 3.1 Audit the three extract creation call sites in `DocumentViewer.tsx` and confirm they all read `selectionContext.pages[0]?.pageNumber` first, only falling back to the viewer's `pageNumber` state when the selection context lacks page info
- [x] 3.2 Remove the fallback to viewer's `pageNumber` for PDF selections if the selection context always has page info (verify with the custom PDF selection engine behavior)

## 4. Verification

- [x] 4.1 Test: create an extract from an EPUB at ~50% progress and verify the stored `page_number` is approximately half the spine count
- [x] 4.2 Test: create an extract from a PDF on page 42 and verify the stored `page_number` is 42
- [x] 4.3 Test: verify extract cards in scroll mode and extracts list display the page number correctly for both EPUB and PDF extracts
