## 1. Settings & Configuration

- [x] 1.1 Add `restoreSession: boolean` (default `true`) to `GeneralSettings` interface in `src/stores/settingsStore.ts`
- [x] 1.2 Add `restoreSession: true` to the default settings object in `settingsStore.ts`
- [x] 1.3 Add the `restoreSession` toggle to the General settings UI panel in `src/components/settings/`

## 2. Tab Content Registry

- [x] 2.1 Create a `tabContentRegistry` map that maps each `TabType` string to its React component (extract the implicit mapping currently in `MainLayout` / `Tabs.tsx`)
- [x] 2.2 Add a helper function `rehydrateTab(serialized: SerializedTab): Tab` that uses the registry to reconstruct a full tab from serialized data

## 3. Enhanced Tab Persistence

- [x] 3.1 Extend the `saveTabs()` data format to include a `uiState` field: `{ tabs, rootPane, uiState: { sidebarCollapsed, currentView, activeCollectionId } }`
- [x] 3.2 Update `saveTabs()` to read `sidebarCollapsed` and `currentView` from `useUIStore` and `activeCollectionId` from `useCollectionStore`
- [x] 3.3 Ensure all tab types store relevant restore data in their `data` field (verify `document-viewer` stores `documentId`, `podcast` stores `feedId`, etc.)

## 4. Session Restore Logic

- [x] 4.1 Implement `loadTabs()` in `tabsStore.ts` to parse the stored JSON, rehydrate tabs using the content registry, and set `tabs` + `rootPane` state
- [x] 4.2 Add content validation: before restoring each tab, check that referenced content exists (query document DB for `documentId`, podcast store for `feedId`, etc.); skip tabs with missing content
- [x] 4.3 Add pane cleanup: after validation, if a `TabPane` has zero valid tabs, collapse its parent `SplitPane` (merge into sibling)
- [x] 4.4 Restore `uiState` fields: apply `sidebarCollapsed`, `currentView`, and `activeCollectionId` to `useUIStore` and `useCollectionStore`
- [x] 4.5 Gate the entire restore on `useSettingsStore.getState().general.restoreSession` — when `false`, do nothing (let MainLayout create defaults)

## 5. Auto-Save Triggers

- [x] 5.1 Add a `visibilitychange` listener in `MainLayout` (or a dedicated hook) that calls `saveTabs()` when `document.visibilityState` becomes `"hidden"`
- [x] 5.2 Add a `beforeunload` listener that calls `saveTabs()` synchronously
- [x] 5.3 Clean up listeners on unmount

## 6. MainLayout Integration

- [x] 6.1 Update the tab initialization `useEffect` in `MainLayout.tsx` to rely on `loadTabs()` for restoration instead of always creating defaults
- [x] 6.2 Ensure `loadDocuments()` is called before or concurrently with tab restoration so document validation works (or handle the async case gracefully)

## 7. Localization

- [x] 7.1 Add the `restoreSession` setting label and description to all locale files (`en.ts`, `de.ts`, `es.ts`, `fr.ts`, `ja.ts`, `zh.ts`)
