## 1. Category Taxonomy Data

- [x] 1.1 Define `ArxivDomain` and `ArxivCategory` interfaces in `src/api/arxiv.ts`
- [x] 1.2 Create `ARXIV_DOMAINS` constant with all ~155 categories grouped by domain (Computer Science, Economics, eess, Mathematics, Astrophysics, Condensed Matter, gr-qc, hep-ex, hep-lat, hep-ph, hep-th, math-ph, nlin, nucl-ex, nucl-th, Physics, quant-ph, q-bio, q-fin, Statistics)
- [x] 1.3 Replace inline `categoryMap` in `getCategoryDisplayName` with a lookup derived from `ARXIV_DOMAINS`
- [x] 1.4 Update `POPULAR_CATEGORIES` export to derive from `ARXIV_DOMAINS` (flatten all categories) for backward compatibility
- [x] 1.5 Export `ARXIV_DOMAINS` and new types

## 2. HTML Import Support

- [x] 2.1 Add `getArxivHtmlUrl(paperId: string): string` helper in `src/api/arxiv.ts`
- [x] 2.2 Add `format` parameter (`'pdf' | 'html'`) to the import flow in `src/utils/documentImport.ts` — when `'html'`, fetch from the HTML URL and set `fileType: 'html'`
- [x] 2.3 Thread format preference through `importFromArxiv()` in `src/stores/documentStore.ts`

## 3. Category Sidebar UI

- [x] 3.1 Replace flat `POPULAR_CATEGORIES.map()` sidebar in `ArxivImportDialog.tsx` with collapsible domain groups using `ARXIV_DOMAINS`
- [x] 3.2 Default state: Computer Science expanded, all others collapsed; first CS category (cs.AI) pre-selected
- [x] 3.3 Update `ArxivBrowser.tsx` category sidebar to use the same grouped layout

## 4. Import Button UI

- [x] 4.1 Add PDF/HTML format toggle to import buttons in `ArxivImportDialog.tsx` (detail panel and list item)
- [x] 4.2 Default toggle to PDF; pass selected format through to import handler
- [x] 4.3 Add same format toggle to `ArxivBrowser.tsx` import action
