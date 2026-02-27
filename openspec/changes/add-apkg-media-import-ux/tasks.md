## 1. APKG Media Parsing and Normalization

- [ ] 1.1 Extend desktop APKG parser to read media manifest entries and load referenced media bytes.
- [ ] 1.2 Extend browser APKG parser to read media manifest entries and expose referenced media for conversion.
- [ ] 1.3 Implement shared media-reference normalization for Anki field content (`<img>`, media markers, missing-file fallback handling).

## 2. Learning Item Persistence and Linking

- [ ] 2.1 Persist imported APKG images into the image registry during learning-item import.
- [ ] 2.2 Attach imported image asset IDs to created learning items without breaking existing duplicate-note and scheduling flows.
- [ ] 2.3 Preserve non-image media references in question/answer/cloze content as renderable references.

## 3. Review UX Rendering

- [ ] 3.1 Update review rendering to show APKG-imported media in a consistent layout and avoid duplicate visual rendering.
- [ ] 3.2 Ensure broken/missing media references fail gracefully while card text and controls remain usable.

## 4. Validation and Regression Coverage

- [ ] 4.1 Add targeted tests for APKG media parsing and reference normalization in desktop and browser import paths.
- [ ] 4.2 Add targeted tests for learning-item image attachment and review rendering behavior.
- [ ] 4.3 Run focused import/review validation and verify FSRS rating behavior is unchanged.
