## 1. Registry Intake UX

- [ ] 1.1 Audit existing image registry ingest behavior in flashcard studio and document which surfaces already accept file import or clipboard paste.
- [ ] 1.2 Add consistent `Ctrl+V` / `Cmd+V` image-ingest handling for eligible image-registry surfaces without breaking normal text paste behavior.
- [ ] 1.3 Add post-ingest success feedback with thumbnail-aware confirmation and a direct action to open the registry or continue using the imported image.
- [ ] 1.4 Ensure duplicate-image ingest feedback makes it clear the image was already in the registry and surfaces the existing asset.

## 2. Dedicated Registry Library

- [ ] 2.1 Add a dedicated image registry browsing surface reachable from the app UI.
- [ ] 2.2 Implement grid browsing with search, sort, preview, metadata display, and highlighted newly added assets.
- [ ] 2.3 Implement common registry actions: multi-select, delete for unreferenced items, and quick selection for flashcard use.
- [ ] 2.4 Show referenced/unreferenced state so users understand why an image can or cannot be deleted.

## 3. Flashcard Workflow Integration

- [ ] 3.1 Update flashcard creation flows to open the registry library from the picker without losing draft state.
- [ ] 3.2 Allow users to select one or more registry images from the library and return them to the active flashcard flow.
- [ ] 3.3 Ensure pasted or uploaded images can be used immediately in flashcard authoring after ingest.

## 4. Validation

- [ ] 4.1 Add frontend tests for image paste shortcut handling, success feedback, registry browsing, and selection return-to-authoring behavior.
- [ ] 4.2 Add backend coverage for any new search/sort/reference-status query behavior introduced for the library.
- [ ] 4.3 Manual: take a screenshot to clipboard, paste it in-app with `Ctrl+V` / `Cmd+V`, verify visible confirmation, find it in the registry, and use it in a flashcard.
- [ ] 4.4 Run `openspec validate improve-image-registry-ingest-and-library-ux --strict`.
