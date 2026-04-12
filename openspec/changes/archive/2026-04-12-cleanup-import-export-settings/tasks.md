## 1. Remove Non-Functional Wave 3/4 Sections

- [x] 1.1 Remove "Wave 4 Community" section (marketplace, study groups, public profiles) and all associated state variables and imports from `ImportExportSettings.tsx`
- [x] 1.2 Remove "Wave 3 Plugin Host" section and all associated state variables and imports (`pluginManifestText`, `plugins`, `refreshPlugins`, etc.)
- [x] 1.3 Remove "Wave 3 Automation API" section and associated state (`automationApiKey`, `rotateAutomationApiKey`, etc.)
- [x] 1.4 Remove "Wave 4 UX & Language" section (language selector, zen mode, conversational review toggles)
- [x] 1.5 Remove "Wave 4 Daily Notes" section and associated state (`dailyNoteDate`, `dailyNoteLinks`, etc.)

## 2. Remove Wave 3 Sync & Export Section

- [x] 2.1 Remove "Wave 3 Sync & Export" section and associated state (`logseqConfig`, `syncToLogseq`, `syncFromLogseq`)
- [x] 2.2 Move Mnemosyne export button into the existing "Export Legacy" section as an additional format option alongside JSON/CSV/Incrementum Package

## 3. Relabel Wave 3 Ingestion

- [x] 3.1 Rename "Wave 3 Ingestion" section title to "Additional Imports" (or similar non-wave label)
- [x] 3.2 Remove the `t("importExport.wave3Ingestion")` i18n key usage; use a new key like `importExport.additionalImports`

## 4. Clean Up Imports and Unused Code

- [x] 4.1 Remove unused imports from `ImportExportSettings.tsx` (social store hooks, `wave4Social.ts` functions, `pluginHost.ts` functions, social type imports)
- [x] 4.2 Remove Wave-related i18n keys from locale files (`en.ts` and any other locale files): `wave3Ingestion`, `wave3IngestionDesc`, and any other Wave-specific keys used in this component

## 5. Verify

- [x] 5.1 Ensure the app builds and renders the Import/Export tab without errors
- [x] 5.2 Verify remaining sections (Complete Backup, Collection Archive, Export Legacy, Import Data, Migrate from C++, Scheduled Backups, Demo Content, Additional Imports) render correctly
