## 1. Add image registry tab target

- [x] 1.1 Add `openImageRegistry` function in CommandCenter.tsx that calls `addTab()` with image registry tab config (title, icon, content component)
- [x] 1.2 Add `nav-image-registry` command to the `navigationCommands` array with `openImageRegistry` as its action and appropriate keywords
- [x] 1.3 Add `"go-image-registry"` to the exclusion list for `getDefaultCommands()` (line ~569) so only the `addTab`-based version appears

## 2. Stop excluding navigation commands from search results

- [x] 2.1 Remove the inline nav command exclusion list (lines 574-580: `nav-dashboard`, `nav-documents`, `nav-queue`, `nav-analytics`, `nav-settings`) from the `allCommands` filter so these commands appear as searchable results
- [x] 2.2 Verify that section results still appear as fallbacks for queries that don't match any command

## 3. Verify end-to-end navigation flow

- [ ] 3.1 Test: type "image" → Image Registry result appears → press Enter → image registry tab opens
- [ ] 3.2 Test: type "dashboard" → Go to Dashboard result appears → press Enter → dashboard tab opens
- [ ] 3.3 Test: type "review" → Start Review result appears → press Enter → review tab opens
- [ ] 3.4 Test: search for a document by title → press Enter → document viewer tab opens
- [ ] 3.5 Test: arrow key navigation + Enter produces same result as mouse click
