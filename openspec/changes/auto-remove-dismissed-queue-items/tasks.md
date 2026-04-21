## 1. Queue eligibility

- [x] 1.1 Update backend queue construction to exclude documents whose `is_dismissed` flag is true.
- [x] 1.2 Verify dismissed documents are excluded consistently from queue-fetching commands used by queue-facing views.

## 2. Dismiss interaction

- [x] 2.1 Identify queue-facing UI components that expose document dismissal and ensure they call the dismiss action for documents.
- [x] 2.2 Update queue-facing client state so a successful dismiss immediately removes the document from the visible queue.
- [x] 2.3 Handle selected or active queue item dismissal by transitioning focus or selection to the next valid queue state.

## 3. Verification

- [x] 3.1 Add or update tests covering backend exclusion of dismissed documents from queue results.
- [x] 3.2 Add or update UI tests or manual verification coverage for dismissing a queued document and seeing it disappear immediately.
- [x] 3.3 Verify dismissal remains non-destructive: dismissed documents are not deleted or archived by this flow.
