## Why

Dismissal already exists as a document state in the app, but dismissed documents still flow through queue generation. That creates a mismatch between user intent and queue behavior: clicking dismiss should immediately get the item out of the user's active queue.

## What Changes

- Exclude dismissed documents from queue generation across the app's queue surfaces.
- Make the dismiss action update queue-facing state immediately after the user clicks the button.
- Preserve dismissal as a reversible document state rather than deleting or archiving the document.

## Capabilities

### New Capabilities
- `document-dismissal`: Covers dismissing a document from active study and removing dismissed documents from queue surfaces while keeping them recoverable in the library.

### Modified Capabilities

## Impact

- Affected backend queue-building logic in `src-tauri/src/commands/queue.rs`
- Affected dismissal command flow in `src-tauri/src/commands/document.rs`
- Affected frontend queue surfaces that expose a dismiss button and need to refresh after dismissal
- No new external dependencies or API families
