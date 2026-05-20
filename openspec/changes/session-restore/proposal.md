## Why

When users close Incrementum and reopen it, they lose their active context — which documents were open, playback positions in podcasts/audiobooks, sidebar state, and active view. The app already persists the tab layout and per-document reader positions, but these aren't coordinated into a full session restore. Users with complex split-screen setups (e.g., a book alongside a podcast) must manually reconstruct their workspace every time.

## What Changes

- Add a **session snapshot** that captures the full UI state on app close/shutdown, including: active documents per tab, media playback positions, sidebar collapsed state, and the current view context
- Add a **`restoreSession` setting** (default: `on`) in the general settings to let users toggle this behavior
- On app startup, when `restoreSession` is enabled, restore all persisted state to return users to their exact prior workspace
- Gracefully handle cases where referenced content no longer exists (deleted documents, unsubscribed podcasts) by falling back to safe defaults

## Capabilities

### New Capabilities
- `session-snapshot`: Captures and restores the complete application session state across restarts, including active documents, playback positions, UI layout, and view context

### Modified Capabilities
<!-- No existing specs need requirement changes -->

## Impact

- **Stores**: `useSettingsStore` (new `restoreSession` setting in general), `useUIStore` (persistence of ephemeral state), `useTabsStore` (enhanced tab data with per-tab restore context)
- **Startup**: `MainLayout` initialization sequence will need to check for and apply a saved session snapshot
- **Storage**: A new localStorage key (e.g., `"incrementum-session"`) for the session snapshot, or extension of the existing tabs persistence
- **Shutdown**: App close/unmount hooks to trigger the snapshot save
- **Settings UI**: A new toggle in the General settings section
