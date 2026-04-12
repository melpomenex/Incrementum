## Why

The Import/Export settings tab has accumulated several sections labeled "Wave 3" and "Wave 4" that are either non-functional localStorage mocks, misleading aliases for existing features, or UX settings that don't belong in an Import/Export context. This clutters the settings page, confuses users, and exposes placeholder UI for features that don't work (community marketplace, study groups, plugin host, public profiles — all localStorage-backed stubs with no real backend).

## What Changes

- **Remove** the "Wave 4 Community" section entirely — community marketplace, study groups, and public profile sharing are all localStorage mocks with no real backend
- **Remove** the "Wave 3 Plugin Host" section entirely — plugin system is a localStorage stub with no real runtime or code execution
- **Remove** the "Wave 3 Sync & Export" section — Logseq sync is just an alias for Obsidian sync (no Logseq-specific logic), and Mnemosyne export should be relocated to the main Export section if kept
- **Relocate** genuinely useful features from removed sections:
  - **Mnemosyne Export** → move into the existing "Export Legacy" section as an additional format option
  - **Language selector** and **Zen mode toggle** → these are UI preferences, not import/export — remove from this tab (they likely already exist in General/Interface settings)
  - **Daily Notes** → this is a legitimate feature but belongs in a different tab (or can be accessed from the documents view, not import/export)
- **Relocate** Wave 3 Ingestion features that are real and useful:
  - Podcast/audio import, PDF highlight extraction, clipboard watcher, and Zotero/Mendeley import are functional — rename the section to remove the "Wave 3" label and integrate it with the main Import section
- **Remove** the "Wave 4 UX & Language" section — language and zen mode are interface settings, not import/export
- **Remove** the "Wave 4 Daily Notes" section — daily notes belong in a different context
- **Remove** the "Wave 3 Automation API" section — this belongs in a dedicated API/Integrations settings tab, not Import/Export

## Capabilities

### New Capabilities

None — this is a cleanup/refactor of existing UI.

### Modified Capabilities

None — no spec-level behavioral requirements change. This is a UI reorganization removing non-functional sections and relocating misplaced functional ones.

## Impact

- **Primary file**: `src/components/settings/ImportExportSettings.tsx` (1289 lines — significant reduction expected)
- **Removed imports**: Functions from `src/utils/wave4Social.ts`, `src/lib/pluginHost.ts`, social store hooks
- **Moved features**: Mnemosyne export button relocated within existing export section
- **i18n**: Remove Wave-related translation keys from locale files (`importExport.wave3Ingestion`, `importExport.wave3IngestionDesc`, etc.)
- **No backend changes**: All removals are frontend-only; no Tauri commands or Rust code affected
