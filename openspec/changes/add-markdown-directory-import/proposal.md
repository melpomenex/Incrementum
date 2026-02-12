# Change: Add markdown directory import

## Why
Users frequently have collections of markdown notes exported from other tools (Obsidian, Notion, Logseq, etc.) that include associated images and metadata files. Currently, Incrementum can import individual `.md` files but doesn't handle the common bundle pattern of:

```
my-notes/
├── images/
│   ├── diagram.png
│   └── screenshot.jpg
├── My Notes.md
└── My Notes_metadata.json
```

Users want to drag-drop or import these bundles and have:
1. The markdown rendered beautifully (already works)
2. Images resolved correctly from the `images/` subfolder
3. Metadata (title, author, tags, etc.) extracted from the companion JSON file

## What Changes
- Detect and handle directory drops containing markdown + images + metadata
- Resolve relative image paths (`![](images/foo.png)`) to correct locations
- Parse companion `_metadata.json` files to extract document metadata
- Store images alongside documents for proper rendering
- Enhance MarkdownViewer to handle bundled resources

## Impact
- Affected specs: `specs/markdown-import/spec.md` (new capability)
- Affected code:
  - `DragDropUpload.tsx` - directory detection and processing
  - `MarkdownViewer.tsx` - image path resolution
  - `src-tauri/src/commands/file_drop.rs` - backend directory handling
  - `src-tauri/src/commands/document.rs` - metadata parsing
  - New: `src/utils/markdownBundleImport.ts` - bundle processing logic
- Builds on existing: `markdown` file type support, `renderMarkdown()` utility
