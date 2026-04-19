## Why

The ArXiv importer currently only exposes 10 categories in its sidebar (all CS/stat/math focused), while ArXiv hosts papers across ~155 categories spanning physics, math, computer science, quantitative biology, quantitative finance, economics, electrical engineering, and statistics. Users in physics, biology, finance, and other fields cannot browse by their relevant categories — they can only search by keyword, which is a poor substitute for topical browsing.

## What Changes

- Replace the hardcoded `POPULAR_CATEGORIES` array (10 items) with the complete ArXiv category taxonomy (~155 categories) organized into hierarchical groups by domain (Computer Science, Physics, Mathematics, etc.)
- Replace the hardcoded `categoryMap` in `getCategoryDisplayName` (11 entries) with a complete lookup covering all ArXiv categories with their full display names
- Redesign the category sidebar in `ArxivImportDialog` from a flat list to a collapsible/expandable grouped layout by domain, making the large category list navigable
- Apply the same grouping to `ArxivBrowser` for consistency
- Add HTML import option for ArXiv papers alongside the existing PDF download, using ArXiv's HTML endpoint (`https://arxiv.org/html/<id>`)

## Capabilities

### New Capabilities

- `arxiv-full-taxonomy`: Complete ArXiv category data covering all ~155 categories with IDs, display names, and domain grouping structure
- `arxiv-html-import`: Option to import ArXiv papers as HTML instead of PDF, for papers where an HTML version is available

### Modified Capabilities

## Impact

- **`src/api/arxiv.ts`**: Replace `POPULAR_CATEGORIES` and `categoryMap` with full taxonomy data; add domain grouping type exports; add `getArxivHtmlUrl()` helper
- **`src/components/import/ArxivImportDialog.tsx`**: Redesign category sidebar to use collapsible domain groups; add HTML/PDF download toggle on import buttons
- **`src/components/media/ArxivBrowser.tsx`**: Update category sidebar to match new grouped structure
- **`src/utils/documentImport.ts`**: Support importing ArXiv HTML content as an HTML document type alongside existing PDF import
- **`src/stores/documentStore.ts`**: Pass format preference through import flow
- No breaking changes to the API surface — `getCategoryDisplayName`, `getArxivCategoryPapers`, etc. remain the same
