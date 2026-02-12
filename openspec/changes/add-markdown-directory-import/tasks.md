## 1. Bundle detection and parsing
- [x] 1.1 Create `src/utils/markdownBundleImport.ts` with bundle detection logic
- [x] 1.2 Implement `detectMarkdownBundle(files: File[])` to identify bundle patterns
- [x] 1.3 Implement `parseMetadataJson(file: File)` for companion JSON parsing
- [x] 1.4 Add TypeScript types for metadata JSON schema (`MarkdownMetadata`)
- [x] 1.5 Implement `extractMarkdownFrontMatter(content: string)` for YAML frontmatter

## 2. Image handling
- [x] 2.1 Create `src/utils/imagePathResolver.ts` for path rewriting logic
- [x] 2.2 Implement `resolveRelativeImagePath(path: string, docId: string)` transformation
- [x] 2.3 Implement `collectBundleImages(files: File[], markdown: string)` to find all images
- [x] 2.4 Add `storeBundleImage(docId: string, imageName: string, blob: Blob)` API
- [x] 2.5 Add `getBundleImage(docId: string, imageName: string)` API endpoint

## 3. Backend support (Tauri)
- [ ] 3.1 Create `src-tauri/src/commands/markdown_bundle.rs` module
- [ ] 3.2 Implement `import_markdown_bundle` command for directory processing
- [ ] 3.3 Implement `store_bundle_image` command for image storage
- [ ] 3.4 Implement `get_bundle_image` command for image retrieval
- [ ] 3.5 Create `~/.incrementum/documents/{doc_id}/images/` storage structure
- [ ] 3.6 Register new commands in `lib.rs`

## 4. Browser storage (PWA)
- [x] 4.1 Create `src/lib/bundleImageStore.ts` for IndexedDB image storage
- [x] 4.2 Implement `storeImage(docId, imageName, blob)` using IndexedDB
- [x] 4.3 Implement `getImage(docId, imageName)` retrieval
- [x] 4.4 Implement `deleteBundleImages(docId)` for cleanup
- [x] 4.5 Create blob URL generation for image display

## 5. DragDropUpload integration
- [x] 5.1 Update `DragDropUpload.tsx` to detect bundle patterns
- [x] 5.2 Add `onBundleDetected` callback prop
- [x] 5.3 Handle directory drops with nested file traversal
- [x] 5.4 Pass detected bundles to new import flow

## 6. Import preview dialog
- [x] 6.1 Create `src/components/import/MarkdownBundlePreview.tsx` component
- [x] 6.2 Display extracted metadata (title, author, tags, image count)
- [x] 6.3 Add editable fields for title, tags, category
- [x] 6.4 Show content preview (first 500 chars)
- [x] 6.5 Add "Import" and "Cancel" actions
- [x] 6.6 Show image thumbnails if available

## 7. MarkdownViewer enhancement
- [x] 7.1 Update `MarkdownViewer.tsx` to handle bundle images
- [x] 7.2 Detect relative image paths in rendered content
- [x] 7.3 Rewrite paths to use `/api/documents/{docId}/images/{filename}`
- [x] 7.4 Add error handling for missing images (show placeholder)
- [x] 7.5 Ensure dark mode styling works with images

## 8. renderMarkdown utility updates
- [x] 8.1 Update `src/utils/markdown.ts` to accept `docId` parameter
- [x] 8.2 Modify image rendering to check for relative paths
- [x] 8.3 Rewrite relative paths to bundle image URLs
- [x] 8.4 Keep absolute URLs unchanged

## 9. Document type updates
- [x] 9.1 Add `bundleImages?: Record<string, string>` to `DocumentMetadata` type
- [x] 9.2 Add `hasBundleImages?: boolean` flag to Document type
- [x] 9.3 Update document creation to store image manifest in metadata

## 10. Progress indication
- [x] 10.1 Add progress state to bundle import flow (in useMarkdownBundleImport hook)
- [x] 10.2 Show progress bar for multi-image bundles
- [x] 10.3 Display current file being processed
- [ ] 10.4 Add cancel button during import
- [ ] 10.5 Handle partial import on cancellation

## 11. Testing
- [ ] 11.1 Unit tests for `detectMarkdownBundle()` with various file combinations
- [ ] 11.2 Unit tests for `parseMetadataJson()` valid/invalid cases
- [ ] 11.3 Unit tests for `resolveRelativeImagePath()` path transformations
- [ ] 11.4 Integration test: Import bundle, verify document created
- [ ] 11.5 Integration test: Open document, verify images render
- [ ] 11.6 E2E test: Drag-drop bundle in Tauri
- [ ] 11.7 E2E test: Drag-drop bundle in browser
- [ ] 11.8 Test: Missing image shows placeholder
- [ ] 11.9 Test: Unicode filenames handled correctly

## 12. Documentation and polish
- [ ] 12.1 Update import UI hints to mention bundle support
- [ ] 12.2 Add tooltip explaining bundle import
- [x] 12.3 Ensure accessibility labels on preview dialog
- [x] 12.4 Add loading animations during processing
- [ ] 12.5 Handle edge case: bundle already exists (duplicate detection)
