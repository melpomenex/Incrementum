# Design: Markdown Directory Import

## Overview

This feature enables importing markdown "bundles" - directories containing a markdown file, associated images, and optional metadata JSON. This is a common pattern for exports from note-taking apps.

## Directory Structure Patterns

### Pattern 1: Flat bundle (single file + metadata)
```
Essentials of Theoretical Computer Science.md
Essentials of Theoretical Computer Science_metadata.json
```

### Pattern 2: Directory with images
```
my-notes/
├── images/
│   ├── diagram.png
│   └── screenshot.jpg
├── My Notes.md
└── My Notes_metadata.json
```

### Pattern 3: Pure markdown (existing support)
```
document.md
```

## Architecture

### Frontend (TypeScript)

```
src/utils/markdownBundleImport.ts
├── detectMarkdownBundle(fileList) - detect if dropped files form a bundle
├── parseMetadataJson(jsonFile) - parse companion _metadata.json
├── resolveImagePaths(markdown, imageMap) - rewrite relative image paths
└── createBundleDocument(files) - create Document from bundle
```

### Backend (Rust)

```
src-tauri/src/commands/markdown_bundle.rs
├── import_markdown_bundle(dir_path) - import directory as bundle
├── store_bundle_images(images, doc_id) - store images for document
└── get_bundle_image(doc_id, image_name) - retrieve stored image
```

### Storage Strategy

**Option A: Embedded Base64 (Simple)**
- Convert images to base64 and embed in document metadata
- Pros: Single database entry, no external files
- Cons: Large documents, no caching

**Option B: Companion Storage (Recommended)**
- Store images in a dedicated folder: `~/.incrementum/documents/{doc_id}/images/`
- Store relative paths in metadata
- Pros: Efficient storage, browser caching, supports all image formats
- Cons: More file management

**Option C: Database BLOB**
- Store images as BLOBs in separate `document_images` table
- Pros: Transactional integrity, backup-friendly
- Cons: Database bloat for large images

**Decision: Option B** - Matches existing file-based architecture and supports browser caching.

## Image Path Resolution

Markdown typically uses relative paths:
```markdown
![Diagram](images/diagram.png)
![](./images/screenshot.jpg)
![](../assets/image.png)
```

After import, these need to resolve to:
```markdown
![Diagram](/api/documents/{doc_id}/images/diagram.png)
```

The `renderMarkdown()` utility will be enhanced to:
1. Detect image references
2. Check if path starts with `http` or `/api` (already absolute)
3. If relative, rewrite to `/api/documents/{doc_id}/images/{filename}`

## Metadata JSON Schema

Common fields from note-taking app exports:
```json
{
  "title": "Essentials of Theoretical Computer Science",
  "author": "Dino Mandrioli, ...",
  "tags": ["computer-science", "theory"],
  "created": "2024-01-15T10:30:00Z",
  "modified": "2024-02-12T00:40:00Z",
  "source": "Obsidian",
  "wordCount": 85000,
  "readingTime": 340
}
```

Fields mapped to Document:
- `title` → `Document.title`
- `author` → `Document.metadata.author`
- `tags` → `Document.tags`
- `created` → `Document.dateAdded`
- `modified` → `Document.dateModified`
- `source` → `Document.metadata.source`
- `wordCount` → `Document.metadata.wordCount`

## Browser vs Tauri Considerations

### Tauri (Desktop)
- Native file system access
- Can copy images to storage directory
- Direct path resolution

### Browser (PWA)
- Use FileSystem API for directory reads
- Store images in IndexedDB
- Use blob URLs for rendering

## User Flow

1. **Drag-drop directory/file**
   - User drags a folder or set of files onto the app
   - System detects markdown bundle pattern

2. **Preview dialog**
   - Shows parsed metadata (title, author, tags)
   - Shows image count
   - Allows tag/category editing

3. **Import confirmation**
   - User clicks "Import"
   - Images are copied to storage
   - Markdown paths are rewritten
   - Document created with metadata

4. **Viewing**
   - User opens document
   - MarkdownViewer renders content
   - Images load from storage via API

## Edge Cases

1. **Missing images**: Image referenced in markdown but not in bundle
   - Solution: Show placeholder, log warning

2. **Orphan images**: Images in folder not referenced in markdown
   - Solution: Store anyway, user can reference later

3. **Conflicting metadata**: Metadata JSON and markdown frontmatter both present
   - Solution: Merge with JSON taking precedence

4. **Large bundles**: Many/large images
   - Solution: Show progress bar during import

5. **Special characters in filenames**: Unicode, spaces
   - Solution: URL-encode image paths in storage

## Testing Strategy

1. Unit tests for:
   - `detectMarkdownBundle()` with various file combinations
   - `parseMetadataJson()` with valid/invalid JSON
   - `resolveImagePaths()` with various path formats

2. Integration tests:
   - Import bundle, verify document created
   - Open document, verify images render
   - Verify metadata applied correctly

3. E2E tests:
   - Drag-drop bundle in browser
   - Drag-drop bundle in Tauri
   - Verify full workflow
