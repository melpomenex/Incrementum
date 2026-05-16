## ADDED Requirements

### Requirement: Error toast for failed saves
The browser extension SHALL show a toast notification when a save operation fails (e.g., network error, server error), using error styling (red color). The toast SHALL contain the error message or a generic failure message.

#### Scenario: 401 error shows error toast
- **WHEN** the extension sends a save request that fails with 401
- **THEN** an error toast appears on the page with a message indicating the save failed

#### Scenario: Network error shows error toast
- **WHEN** the extension sends a save request but the server is unreachable
- **THEN** an error toast appears indicating the connection failed

### Requirement: Fallback notification when tab context unavailable
When a context menu action cannot show an in-page toast (e.g., `tabId` is unavailable), the extension SHALL fall back to a native browser notification (`chrome.notifications.create`) to ensure the user receives feedback.

#### Scenario: Save link shows native notification when in-page toast unavailable
- **WHEN** user uses "Save Link to Incrementum" context menu AND `tabId` is not available for in-page toast
- **THEN** a native browser notification appears with the save result

#### Scenario: Save link shows in-page toast when tab context available
- **WHEN** user uses "Save Link to Incrementum" context menu AND `tabId` is available
- **THEN** an in-page toast appears on the source page with the save result
