## 1. Refactor i18n module structure
- [x] 1.1 Create `src/lib/i18n/` directory structure: `index.ts` (re-exports) + `locales/en.ts`, `locales/zh.ts`, `locales/es.ts`, `locales/de.ts`, `locales/fr.ts`, `locales/ja.ts`
- [x] 1.2 Move existing dictionaries from `src/lib/i18n.ts` into their respective locale files
- [x] 1.3 Update `src/lib/i18n.ts` to re-export from the new structure (or convert to a barrel import) so all existing imports continue to work
- [x] 1.4 Update `src/lib/__tests__/i18n.test.ts` imports if needed

## 2. Unify language selector
- [x] 2.1 Replace the text input in `src/pages/SettingsPage.tsx` with a `<select>` dropdown using native language names (English, 中文, Español, Deutsch, Français, 日本語)
- [x] 2.2 Verify `src/components/settings/SettingsPage.tsx` already uses a dropdown — ensure it matches the same option list

## 3. Extract hardcoded strings — Core UI
- [x] 3.1 `src/components/layout/NewMainLayout.tsx` — extract any remaining hardcoded strings
- [x] 3.2 `src/components/layout/MainLayout.tsx` — extract command palette descriptions and other strings
- [x] 3.3 `src/components/Toolbar.tsx` — extract all button labels and tooltips (~18 strings)
- [x] 3.4 `src/components/common/EmptyState.tsx` — extract all empty-state messages (~30 strings)
- [x] 3.5 `src/components/common/ConfirmDialog.tsx` — extract default button text and messages (~5 strings)
- [x] 3.6 `src/components/common/CommandPalette.tsx` — extract placeholder and UI strings
- [x] 3.7 `src/components/common/VimiumNavigation.tsx` — extract placeholder and UI strings

## 4. Extract hardcoded strings — Pages
- [x] 4.1 `src/pages/SettingsPage.tsx` — extract all section titles, labels, descriptions (~65 strings)
- [x] 4.2 `src/pages/SearchPage.tsx` — extract search-related strings (~15 strings)
- [x] 4.3 `src/pages/ContinueReadingPage.tsx` — extract loading, empty, and button strings (~15 strings)
- [x] 4.4 `src/pages/AnalyticsPage.tsx` — extract date range labels and other strings (~12 strings)
- [x] 4.5 `src/pages/KnowledgeGraphPage.tsx` — extract graph UI and toast strings (~15 strings)
- [x] 4.6 `src/pages/IntegrationsPage.tsx` — extract integration descriptions and strings (~35 strings)
- [x] 4.7 `src/pages/AIWorkflowsPage.tsx` — extract workflow labels and descriptions (~20 strings)
- [x] 4.8 `src/pages/NotebookLMPage.tsx` — extract NotebookLM UI strings (~40 strings)
- [x] 4.9 `src/pages/QueueScrollPage.tsx` — extract toast messages and UI strings (~20 strings)
- [x] 4.10 `src/routes/dashboard.tsx` — extract dashboard stat labels and action descriptions (~30 strings)
- [x] 4.11 `src/routes/review.tsx` — extract any remaining hardcoded review strings

## 5. Extract hardcoded strings — Onboarding
- [x] 5.1 `src/components/onboarding/WelcomeScreen.tsx` — extract all welcome/onboarding copy (~25 strings)
- [x] 5.2 `src/components/onboarding/SignupPrompt.tsx` — extract signup copy (~8 strings)
- [x] 5.3 `src/components/onboarding/InteractiveTutorial.tsx` — extract tutorial steps (~12 strings)

## 6. Extract hardcoded strings — Settings components
- [x] 6.1 `src/components/settings/SettingsPage.tsx` — extract remaining hardcoded section titles, descriptions (~50 strings)
- [x] 6.2 `src/components/settings/DocumentsSettings.tsx` — extract document settings labels (~15 strings)
- [x] 6.3 `src/components/settings/AISettings.tsx` — extract AI settings labels (~10 strings)
- [x] 6.4 `src/components/settings/LLMProviderSettings.tsx` — extract provider descriptions (~8 strings)
- [x] 6.5 `src/components/settings/CloudStorageSettings.tsx` — extract storage settings (~12 strings)
- [x] 6.6 `src/components/settings/OCRSettings.tsx` — extract OCR settings (~8 strings)
- [x] 6.7 `src/components/settings/ImportExportSettings.tsx` — extract labels and alert messages (~25 strings)
- [x] 6.8 `src/components/settings/AppStateBackupDialog.tsx` — extract backup/restore UI (~15 strings)
- [x] 6.9 `src/components/settings/BackupRestorePanel.tsx` — extract backup labels (~6 strings)
- [x] 6.10 `src/components/settings/SyncSettings.tsx` — extract sync labels and confirm dialogs (~5 strings)
- [x] 6.11 `src/components/settings/SyncConflictDialog.tsx` — extract conflict resolution options (~8 strings)
- [x] 6.12 `src/components/settings/ThemePicker.tsx` — extract theme-related strings (~5 strings)
- [x] 6.13 `src/components/settings/TTSSettings.tsx` — extract TTS labels (~10 strings)
- [x] 6.14 `src/components/settings/LearningSettings.tsx` — extract learning settings labels (~10 strings)
- [x] 6.15 Remaining settings components — extract any remaining strings in HandbookSettings, IntegrationSettings, NotificationSettings, ThemeCustomizer, NotebookLMWorkspace, RSSQueueSettings

## 7. Extract hardcoded strings — Remaining components
- [x] 7.1 `src/components/viewer/DocumentViewer.tsx` — extract toast messages (~10 strings)
- [x] 7.2 `src/components/viewer/YouTubeViewer.tsx` — extract toast messages (~6 strings)
- [x] 7.3 `src/components/viewer/PriorityControl.tsx` — extract priority labels (~5 strings)
- [x] 7.4 `src/components/analytics/DateRangePicker.tsx` — extract date range options (~12 strings)
- [x] 7.5 `src/components/review/ReviewSession.tsx` — extract remaining hardcoded toasts
- [x] 7.6 `src/components/review/ReviewQueueView.tsx` — extract queue strings
- [x] 7.7 `src/components/review/FlashcardStudioModal.tsx` — extract modal strings
- [x] 7.8 `src/components/assistant/AssistantPanel.tsx` — extract tool descriptions (~10 strings)
- [x] 7.9 `src/components/notebooklm/NotebookLMStudio.tsx` — extract studio strings (~8 strings)
- [x] 7.10 `src/components/notebooklm/NotebookLMChat.tsx` — extract chat UI strings
- [x] 7.11 `src/components/tabs/DashboardTab.tsx` — extract action descriptions
- [x] 7.12 `src/components/tabs/WebBrowserTab.tsx` — extract toast messages
- [x] 7.13 `src/components/tabs/ScreenshotTab.tsx` — extract alert/confirm strings
- [x] 7.14 `src/components/extracts/CreateExtractDialog.tsx` — extract annotation labels
- [x] 7.15 `src/components/extracts/EditExtractDialog.tsx` — extract annotation labels
- [x] 7.16 `src/components/extracts/ExtractCreator.tsx` — extract placeholders
- [x] 7.17 `src/components/documents/DocumentsView.tsx` — extract confirm dialogs
- [x] 7.18 `src/components/queue/QueueContextMenu.tsx` — extract context menu strings
- [x] 7.19 `src/components/media/*.tsx` — extract toast/alert strings across MediaLibrary, RSSReader, YouTubePlaylistManager, PodcastManager, RSSScrollMode, RSSCustomizationPanel
- [x] 7.20 `src/components/learning/LearningCardsList.tsx` — extract learning UI strings
- [x] 7.21 `src/components/mobile/MobileQueueView.tsx` — extract mobile queue strings
- [x] 7.22 `src/components/mobile/MobileNavigation.tsx` — extract mobile nav strings
- [x] 7.23 `src/components/sync/OfflineSyncIndicator.tsx` — extract sync indicator strings
- [x] 7.24 `src/components/migration/DataMigrationUI.tsx` — extract migration confirm dialog
- [x] 7.25 `src/components/common/ClipboardQuickAddWatcher.tsx` — extract clipboard toast strings
- [x] 7.26 `src/App.tsx` — extract onboarding-related toast messages

## 8. Add translations for all locales
- [x] 8.1 Add Chinese (zh) translations for all new keys added in steps 3-7
- [x] 8.2 Add Spanish (es) translations for all new keys added in steps 3-7
- [x] 8.3 Add German (de) translations for all new keys added in steps 3-7
- [x] 8.4 Add French (fr) translations for all new keys added in steps 3-7
- [x] 8.5 Add Japanese (ja) translations for all new keys added in steps 3-7

## 9. Testing
- [x] 9.1 Add test that verifies every locale has entries for all keys defined in the English dictionary
- [x] 9.2 Verify existing i18n tests still pass after refactor
- [ ] 9.3 Manual smoke test: switch language in settings, verify nav/review/settings/onboarding render correctly in each locale

## Out of scope (not in original plan, but discovered)
- [x] `src/components/focus/FocusTimer.tsx` — hardcoded strings: Focus, Short Break, Long Break, Time for a break!, Ready to focus again?
- [x] `src/components/pwa/OfflineIndicator.tsx` — hardcoded strings: Downloading..., Available offline, Download for offline, Online only
