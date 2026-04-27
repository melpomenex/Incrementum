## ADDED Requirements

### Requirement: HTML iframe scroll capture
The system SHALL capture the scroll position of the HTML viewer iframe during reading by listening to scroll events on the iframe's `contentWindow`. The captured position SHALL include `scrollTop`, `scrollLeft`, `scrollHeight`, `clientHeight`, and the computed `scrollPercent`.

#### Scenario: User scrolls an HTML document
- **WHEN** a user scrolls within an HTML document (standalone HTML or OCR-HTML mode)
- **THEN** the system captures the scroll position from the iframe's `contentWindow` on each scroll event (debounced at 500ms) and updates `lastScrollStateRef`

#### Scenario: Iframe contentWindow is inaccessible
- **WHEN** the iframe's `contentWindow` is null or throws on access
- **THEN** the system silently skips capture without errors

### Requirement: HTML scroll persistence via ViewState
The system SHALL persist HTML scroll position to the same ViewState storage mechanism used by PDF documents, using the document's preferred ViewState key. The persisted state SHALL include `scrollTop`, `scrollLeft`, `scrollPercent`, and `pageNumber` (defaulting to 1).

#### Scenario: Scroll position saved during reading
- **WHEN** a user scrolls an HTML document and the debounced timer fires
- **THEN** the system writes a ViewState entry with the captured scroll position to the primary ViewState key and the legacy ViewState key, using `readerPosition.ts`

#### Scenario: Scroll position saved on view mode switch
- **WHEN** a user switches from "View Document" to "View Extracts" or "View Learning Cards" while reading an HTML document
- **THEN** the system synchronously flushes the current scroll position to ViewState storage before unmounting the iframe

#### Scenario: Unified position API updated
- **WHEN** scroll position is persisted for an HTML document
- **THEN** the system also calls `saveDocumentPosition` with a `scrollPosition` via `getUnifiedPositionForDocument` (existing behavior for `docType === "html"`)

### Requirement: HTML scroll restoration on return to document
The system SHALL restore the saved scroll position when the user returns to "View Document" from extracts or cards view for an HTML document. The restoration SHALL scroll the iframe's `contentWindow` to the saved `scrollTop` and `scrollLeft` values.

#### Scenario: Return to document from extracts
- **WHEN** a user viewing an HTML document switches to "View Extracts" and then switches back to "View Document"
- **THEN** the system restores the iframe scroll position to the last saved `scrollTop` and `scrollLeft` within the iframe's `contentWindow`, after the iframe finishes loading

#### Scenario: Return to document from cards
- **WHEN** a user viewing an HTML document switches to "View Learning Cards" and then switches back to "View Document"
- **THEN** the system restores the iframe scroll position to the last saved position

#### Scenario: No saved position available
- **WHEN** a user opens an HTML document that has no previously saved scroll position
- **THEN** the document loads at the top (default behavior) with no restoration attempt

#### Scenario: Restoration with initial jump target
- **WHEN** a user returns to an HTML document AND there is an `initialJump` target (e.g., from a search hit or extract)
- **THEN** the system prioritizes scrolling to the `initialJump` target over restoring the saved scroll position

### Requirement: OCR-HTML mode scroll persistence
The system SHALL apply the same scroll capture, persistence, and restoration behavior to PDFs viewed in OCR-HTML mode (`pdfViewMode === "ocr-html"`).

#### Scenario: OCR-HTML document scroll capture
- **WHEN** a user reads a PDF in OCR-HTML mode and scrolls the content
- **THEN** the system captures and persists scroll position identically to standalone HTML documents

#### Scenario: OCR-HTML document scroll restoration
- **WHEN** a user switches away from an OCR-HTML document and returns
- **THEN** the system restores the scroll position in the iframe's `contentWindow`
