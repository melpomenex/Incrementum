## Context

The ArXiv importer (`src/api/arxiv.ts`) currently hardcodes 10 categories in `POPULAR_CATEGORIES` and 11 entries in the `categoryMap` display name lookup. ArXiv's actual taxonomy contains ~155 categories across 8 top-level domains. The `ArxivImportDialog` renders these as a flat list in a 256px-wide sidebar. The backend already accepts any valid ArXiv category — no Rust changes needed.

## Goals / Non-Goals

**Goals:**
- Cover all ~155 ArXiv categories so users in any discipline can browse by topic
- Keep the category sidebar navigable despite the 15x increase in items
- Maintain existing API surface (`getCategoryDisplayName`, `getArxivCategoryPapers`, `POPULAR_CATEGORIES` export)

**Non-Goals:**
- Subcategory-aware search or filtering (the ArXiv API handles this)
- User-customizable category lists or favorites
- Caching the taxonomy from ArXiv's API at runtime (static data is sufficient)
- Converting PDF-only papers to HTML (only papers with an ArXiv HTML version are eligible)

## Decisions

### 1. Static hardcoded taxonomy vs. runtime fetch from ArXiv

**Choice**: Static hardcoded data in `arxiv.ts`.

**Rationale**: The ArXiv taxonomy changes very infrequently (maybe 1-2 new categories per year). Fetching at runtime adds latency, network dependency, and complexity for no real benefit. A static list is simple, fast, and always available. The current approach already uses static data — we're just expanding it.

**Alternative considered**: Fetching from `https://arxiv.org/category_taxonomy` at startup and parsing the HTML. Rejected because (a) it adds a network call to app startup, (b) the HTML format could change, (c) the taxonomy rarely changes so runtime fetching is wasted work.

### 2. Collapsible domain groups in the sidebar

**Choice**: Group categories by top-level domain (Computer Science, Mathematics, Physics, etc.) with collapsible sections. Each group header shows the domain name and count. Groups start collapsed except for Computer Science (the most popular).

**Rationale**: A flat list of 155 items is unusable. Grouping by domain matches how ArXiv itself organizes categories and matches user mental models (physicists think in physics subfields). Collapsing keeps the sidebar scannable.

**Alternative considered**: A searchable dropdown. Rejected because the current sidebar pattern works well for browsing and search is already available via the search bar.

### 3. Data structure: `ARXIV_DOMAINS` array with nested categories

**Choice**: A single `ARXIV_DOMAINS` constant that replaces `POPULAR_CATEGORIES`, structured as:

```typescript
interface ArxivDomain {
  id: string;       // e.g. "cs", "math", "physics"
  name: string;     // e.g. "Computer Science", "Mathematics"
  categories: Array<{
    id: string;     // e.g. "cs.AI", "math.CO"
    name: string;   // e.g. "Artificial Intelligence", "Combinatorics"
  }>;
}
```

**Rationale**: This structure naturally supports grouped rendering in the sidebar. The `categoryMap` lookup is derived by iterating this structure, so we only maintain one source of truth. We keep `POPULAR_CATEGORIES` as a backward-compatible export that flattens the first few domains.

### 4. Backward compatibility of `POPULAR_CATEGORIES` and `getCategoryDisplayName`

**Choice**: Keep `POPULAR_CATEGORIES` exported but regenerate it from `ARXIV_DOMAINS`. Replace the inline `categoryMap` in `getCategoryDisplayName` with a lookup built from `ARXIV_DOMAINS`.

**Rationale**: Other components (`ArxivBrowser`, etc.) may import these. Changing the export shape would be a breaking change for no benefit. Since `ArxivImportDialog` will use `ARXIV_DOMAINS` directly for the grouped sidebar, `POPULAR_CATEGORIES` becomes a convenience export.

### 5. HTML import for ArXiv papers

**Choice**: Add a format toggle (PDF/HTML) on each paper's import action. When "HTML" is selected, download from `https://arxiv.org/html/<id>` and import as an HTML document (`fileType: 'html'`). Default to PDF to preserve existing behavior.

**Rationale**: ArXiv now serves HTML versions of many papers (especially newer ones), which are often more readable and work better with Incrementum's document viewer than PDFs. The HTML endpoint is a standard ArXiv URL pattern. Not all papers have HTML versions — we should attempt the download and fall back gracefully if the paper is PDF-only.

**Alternative considered**: Auto-detecting whether HTML is available and only showing the option then. Rejected because (a) detection would require an extra HTTP request per paper, (b) the fallback behavior handles PDF-only papers cleanly, and (c) always showing the option keeps the UI simple.

### 6. HTML download flow

**Choice**: The HTML is fetched via `fetchUrlContent` (same as PDF), saved as an `.html` file, and imported into the document store with `fileType: 'html'`. The existing HTML document handling in Incrementum's viewer takes over from there.

**Rationale**: Reuses the existing download infrastructure. Incrementum already supports HTML documents, so no viewer changes are needed. The only difference from PDF import is the source URL and the resulting file type.

## Risks / Trade-offs

- **[Sidebar density]** With ~155 categories, even grouped, some domains (Physics) have 20+ subcategories → Mitigation: collapsible groups, default-collapsed for less common domains
- **[Maintenance]** Adding a new ArXiv category requires a code change → Mitigation: categories rarely change; the data structure makes additions trivial (one object literal)
- **[Bundle size]** ~155 category entries adds a few KB → Negligible; category names are short strings
- **[HTML not available]** Some older ArXiv papers lack HTML versions → Mitigation: attempt download, show error and suggest PDF fallback if HTML fetch fails
- **[HTML quality]** ArXiv HTML rendering varies (some papers have complex LaTeX→HTML conversion) → Mitigation: this is an ArXiv-level concern, not ours; users can always fall back to PDF
