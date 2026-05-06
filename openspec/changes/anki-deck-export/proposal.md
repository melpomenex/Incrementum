## Why

Users build decks from document extracts but the existing Anki export is hidden in the DeckManager context menu, skips images/media, collapses all card types (cloze, QA) into basic front/back, and offers no lightweight format like CSV. This makes the export unreliable for round-tripping content into Anki and hard to discover.

## What Changes

- Surface deck-to-Anki export from more locations: DeckManager toolbar, document detail view, and the Import/Export settings page
- Map Incrementum card types to proper Anki note models: Basic (Front/Back), Cloze (with `{{c1::}}` syntax), and QA
- Include image assets referenced by exported cards as media files inside the .apkg
- Add a CSV/text export option (tab-separated) as a lighter alternative that Anki also imports natively
- Add a bulk "Export all decks" option for migrating everything to Anki at once

## Capabilities

### New Capabilities
- `anki-deck-export`: Discoverable, card-type-aware Anki .apkg and CSV export for user-created decks with media support

### Modified Capabilities

## Impact

- **Rust backend** (`src-tauri/src/anki.rs`): Extend `export_deck_as_apkg` to support multiple note models, embed media files, and add CSV export path
- **Frontend** (`src/components/review/DeckManager.tsx`): Add visible export button(s) in the toolbar, not just context menu
- **Frontend** (`src/components/settings/ImportExportSettings.tsx`): Add deck-to-Anki export section
- **Frontend** (`src/utils/ankiExport.ts`): Update browser-side builder to handle cloze/QA types and media
- **Database**: Read-only — no schema changes needed
