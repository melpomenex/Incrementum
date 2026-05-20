## Context

Incrementum currently has partial persistence: the tab layout (which tabs, split pane structure) is serialized to `localStorage` under `"incrementum-tabs"`, and per-document reader state (page, zoom, scroll) is saved per-document. However, the `loadTabs()` function is effectively a no-op — it logs data but doesn't restore tabs from storage. The `useUIStore` (sidebar state, current view, modals) is entirely ephemeral.

The legacy C++ codebase had a `general.restoreSession: true` setting flag, but this was never implemented in the React/Tauri rewrite.

## Goals / Non-Goals

**Goals:**
- Restore the full tab layout (open tabs, split pane tree, active tab per pane) on app launch
- Restore per-tab context: which document is open in each `document-viewer` tab, which podcast episode is playing, etc.
- Restore UI state: sidebar collapsed, active collection, current view
- Provide a user-accessible toggle (`restoreSession`) in General settings, defaulting to `on`
- Handle missing content gracefully (deleted documents, removed podcasts) by skipping those tabs

**Non-Goals:**
- Restoring transient modal state (toasts, command palette, open dialogs)
- Restoring exact media playback timestamps (already handled by `podcast-position-persistence` spec and per-document reader state)
- Cross-device session sync (sessions are local-only)
- Restoring browser/web-viewer state or scroll positions in RSS/newsletter feeds
- Versioning or named session snapshots (one session, overwritten on each save)

## Decisions

### 1. Extend existing tabs persistence rather than a separate session store

The tabs store already serializes `tabs[]` + `rootPane` to `localStorage`. Rather than introducing a separate `"incrementum-session"` key, we extend the existing format with per-tab `restoreData` and complete the `loadTabs()` implementation.

**Rationale**: Avoids synchronization issues between two storage keys. The tab layout IS the session skeleton — everything else (sidebar state, active collection) is small enough to include alongside.

**Alternative considered**: A separate session snapshot key. Rejected because it would require coordinating two write sources and risks drift.

### 2. Store per-tab restore data in tab's `data` field

Each `Tab` already has an optional `data?: Record<string, unknown>` field. For document-viewer tabs, this already carries `documentId`. We'll formalize this pattern: each tab type can store its restore context in `data` (e.g., `{ documentId: "..." }` for document viewers, `{ feedId: "..." }` for podcast tabs).

**Rationale**: No schema changes needed. The `data` field is already serialized by `saveTabs()`.

### 3. Save UI state alongside tabs in the same storage key

Add a `uiState` field to the serialized tabs data:
```json
{
  "tabs": [...],
  "rootPane": {...},
  "uiState": {
    "sidebarCollapsed": false,
    "currentView": "queue",
    "activeCollectionId": "..."
  }
}
```

**Rationale**: Keeps all session data in one place. UI state is tiny (3-4 fields), so there's no size concern.

### 4. Complete `loadTabs()` to actually restore state

The current `loadTabs()` logs but doesn't restore. We'll implement it to:
1. Parse stored data
2. Recreate tab objects (re-linking `content` components based on `type`)
3. Restore `rootPane` tree
4. Apply `uiState` to `useUIStore`
5. Skip tabs whose referenced content no longer exists

**Rationale**: This is the intended design that was never finished.

### 5. Save on `visibilitychange` (hidden) and `beforeunload`

Rather than requiring explicit user action, auto-save the session whenever the app goes to background or is closing. Also save on tab mutations (already done via `saveTabs()` calls throughout tabsStore).

**Rationale**: Covers Tauri window close, browser tab close, and mobile app backgrounding. `beforeunload` handles hard closes, `visibilitychange` handles backgrounding.

### 6. Gate restore on `restoreSession` setting

Add `restoreSession: boolean` to `GeneralSettings` in settingsStore (default: `true`). On startup, `loadTabs()` checks this setting. When `false`, it creates the default Dashboard + Queue tabs as it does today.

**Rationale**: Some users prefer a clean start. The default matches the expected behavior (most desktop apps restore state).

## Risks / Trade-offs

- **Stale tabs referencing deleted content** → The restore logic validates each tab's `data` against the DB/filesystem. Tabs referencing missing content are skipped, and if a pane ends up empty it's collapsed automatically.
- **Large localStorage payloads** → The serialized tabs are small (metadata only, no content). Current `saveTabs()` data is typically <10KB. Adding `uiState` adds negligible size.
- **Component re-linking on load** → Tabs store React component references (`content: ComponentType`). These can't be serialized. On load, we need a mapping from `TabType` to component. This mapping already exists implicitly in `MainLayout` — we'll extract it into a registry.
- **Race condition with async data loading** → Document store loads from IndexedDB asynchronously. Session restore must not assume documents are available immediately. We restore tab structure first, then let each tab's content component handle its own loading state (as they already do).
