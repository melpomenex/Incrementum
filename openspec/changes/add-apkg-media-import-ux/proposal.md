## Why

APKG imports currently bring in card text but do not reliably import bundled media files, so image/audio references often render as broken content in review. This blocks users from migrating real Anki decks and getting a high-quality study experience in Incrementum.

## What Changes

- Import `.apkg` media payloads (images and other referenced assets) together with notes/cards during both desktop and browser import paths.
- Resolve Anki media references in question/answer/cloze fields to renderable content in Incrementum.
- Attach imported image assets to learning items via `image_asset_ids` so review surfaces can render media in a clean, consistent gallery UX.
- Add robust fallback behavior when media is missing or unsupported so card text remains readable.

## Capabilities

### New Capabilities
- `apkg-media-import`: Import Anki package media and map note field references to renderable Incrementum learning-item content.

### Modified Capabilities
- `document-rating`: Review and flashcard rendering must display APKG-imported media references without breaking existing FSRS rating and navigation behavior.

## Impact

- Affected specs: new `apkg-media-import`; modified `document-rating`.
- Affected code: `src-tauri/src/anki.rs`, `src/utils/ankiParserBrowser.ts`, browser backend import bridge, and review UI rendering components.
- Data impact: imported images may be persisted into image registry and linked via `learning_items.image_asset_ids`.
