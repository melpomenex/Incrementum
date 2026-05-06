## Context

Incrementum already has an Anki .apkg export (`src-tauri/src/anki.rs:908`, browser-side in `src/utils/ankiExport.ts`) but it:
- Treats all card types (flashcard, cloze, QA, basic) as basic Front/Back notes
- Skips image assets referenced by cards (media is always `{}`)
- Is only reachable via a right-click context menu in DeckManager
- Has no CSV fallback for users who prefer Anki's native text import

Decks are virtual — tag-based filter groups stored in localStorage (`src/stores/studyDeckStore.ts`). Cards live in the `learning_items` SQLite table and are linked to decks by tag matching.

## Goals / Non-Goals

**Goals:**
- Map each Incrementum card type to the correct Anki note model (Basic, Cloze)
- Embed image assets as media inside the .apkg
- Add visible export buttons in DeckManager toolbar and Import/Export settings
- Offer CSV/tab-separated export as a lighter alternative
- Support bulk export of all decks in one action

**Non-Goals:**
- Re-importing an exported .apkg back into Incrementum with perfect fidelity
- Exporting audio/video media (only images for now)
- Exporting scheduling/FSRS state to Anki's FSRS addon (already partially done)
- Changing the deck/tag model — decks remain tag-based

## Decisions

### 1. Card type → Anki model mapping

- **Basic/Flashcard/QA** → Anki "Basic" note model (Front/Back fields)
- **Cloze** → Anki "Cloze" note model with `{{c1::text}}` syntax derived from `cloze_text` + `cloze_ranges`

Anki has first-class support for cloze. We already store `cloze_text` and `cloze_ranges` on `LearningItem`. The Rust export will generate a second note model (id `2`) with Cloze type and `{{c1::...}}` syntax. QA cards use the same Basic model since Anki doesn't have a native QA type.

**Alternative considered:** Flatten all to Basic and lose cloze formatting — rejected because cloze is a core feature users expect to round-trip.

### 2. Media embedding

Read image assets from the `image_assets` table (or filesystem), number them sequentially (`0`, `1`, `2`...), write them into the ZIP, and build the `media` JSON mapping. Replace `src` references in card HTML with `<img src="N">`.

This mirrors the existing import logic in `src-tauri/src/anki.rs` which already reads media from .apkg files.

### 3. Export surface areas

Three entry points:
1. **DeckManager toolbar** — a visible "Export to Anki" button (not just context menu)
2. **Import/Export Settings** — a dedicated "Export deck to Anki" section with deck picker + format picker
3. **Command palette** — already has file-type actions; add an "Export current deck to Anki" command

### 4. CSV export

Simple tab-separated file: `Front\tBack\tTags` per line. Anki's "Import" dialog natively supports this. No media in CSV — just text. This is a new Rust command `export_deck_as_csv` that writes a .txt file.

**Alternative considered:** CSV with comma separator — rejected because Anki defaults to tab-separated for text import and commas conflict with card content.

### 5. Bulk export

New command `export_all_decks_as_apkg` that creates one .apkg per deck (named by deck tag) and zips them together. Or a single .apkg with multiple Anki decks. Choosing the single .apkg approach since Anki supports multiple decks natively.

## Risks / Trade-offs

- **Large decks with many images** → .apkg files could be large. Mitigation: show card count and estimated size before export.
- **Cloze range edge cases** → overlapping or empty ranges could produce malformed cloze syntax. Mitigation: validate ranges and fall back to basic note if invalid.
- **Tag-based deck membership** → if a card has tags matching multiple decks, it appears in each deck's export. This is correct behavior (matches Anki's model where cards belong to one deck).
- **Browser-side export parity** → the `buildAnkiApkg` frontend function won't support media/cloze initially. Focus on Rust backend for the full-featured export. Browser-side can remain a simpler fallback.
