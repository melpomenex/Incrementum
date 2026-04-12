# Change: Improve Knowledge Graph UX at Scale

## Why
When users have many flashcards (100+), the Knowledge Graph becomes an unreadable "hairball" — hundreds of purple flashcard nodes are densely packed with overlapping labels, making it impossible to distinguish individual nodes or understand relationships. The custom O(n²) force simulation degrades, and there is no way to collapse, cluster, or navigate dense regions.

## What Changes
- **Add node clustering**: Automatically collapse flashcard nodes under their parent extract/document into expandable cluster nodes at low zoom levels
- **Add level-of-detail rendering**: Simplify node rendering at low zoom (small dots, no labels, no icons) and progressively reveal detail as the user zooms in
- **Add Barnes-Hut spatial indexing** to the force simulation for O(n log n) repulsion instead of O(n²)
- **Add a minimap** in the corner for orientation when zoomed into a large graph
- **Add search-with-zoom**: When filtering via search, auto-fit the view to show matching nodes
- **Add edge bundling** (simple alpha-based proximity blending) to reduce visual noise from crossing edges

## Impact
- Affected specs: `knowledge-graph`
- Affected code: `src/components/graph/ObsidianGraph.tsx`, `src/components/graph/KnowledgeGraphPage.tsx`, `src/components/graph/GraphFilters.tsx`
