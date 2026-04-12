## 1. Barnes-Hut Force Simulation
- [x] 1.1 Implement QuadTree class with insert, subdivide, and query methods
- [x] 1.2 Implement Barnes-Hut repulsion calculation replacing O(n²) loop in ObsidianGraph
- [x] 1.3 Add theta parameter (default 0.5) and expose in settings panel as "Simulation precision"
- [x] 1.4 Verify force layout produces visually similar results to the original for small graphs (< 50 nodes)
- [x] 1.5 Benchmark: confirm < 16ms per frame with 500 nodes

## 2. Hierarchical Node Clustering
- [x] 2.1 Build parent-child index from edges (document → extract → flashcard) in `loadGraphData`
- [x] 2.2 Add `ClusterNode` type that wraps a parent node with collapsed children count
- [x] 2.3 Implement `resolveVisibleNodes(nodes, edges, zoomLevel)` that returns visible nodes based on zoom tier
- [x] 2.4 Render count badges on cluster nodes (small circle with number)
- [x] 2.5 Handle click-to-expand: on cluster click, animate expansion (200ms ease-out) and zoom in
- [x] 2.6 Animate zoom-triggered cluster expansion with 200ms ease-out transition
- [x] 2.7 Handle hover on clusters: show tooltip listing collapsed children types/counts

## 3. Level-of-Detail Rendering
- [x] 3.1 Define three LOD tiers: LOW (zoom < 0.4), MEDIUM (0.4–1.0), HIGH (≥ 1.0)
- [x] 3.2 Refactor `drawNode()` to accept LOD tier and skip effects/labels/icons at lower tiers
- [x] 3.3 Refactor `drawEdge()` to skip edge labels at LOW tier and reduce detail at MEDIUM tier
- [x] 3.4 Add smooth LOD transitions to avoid popping when crossing zoom thresholds

## 4. Minimap
- [x] 4.1 Create a secondary `<canvas>` element (150×100px) positioned in bottom-right corner
- [x] 4.2 Render minimap at reduced framerate (every 10th frame) with simple dot rendering
- [x] 4.3 Draw viewport rectangle on minimap based on current pan/zoom transform
- [x] 4.4 Add click-to-navigate: minimap click/drag updates main viewport pan/zoom
- [x] 4.5 Add minimap toggle button to graph toolbar (visible when > 50 nodes)
- [x] 4.6 Persist minimap toggle state in component state across session

## 5. Search-with-Zoom
- [x] 5.1 After filter application, calculate bounding box of all visible (matching) nodes
- [x] 5.2 Smoothly animate viewport to fit the bounding box with padding
- [x] 5.3 Add "Reset view" button that appears during active search and returns to full graph view
- [x] 5.4 Debounce zoom animation (300ms) to avoid jitter during typing

## 6. Edge Proximity Blending
- [x] 6.1 Add proximity-aware alpha calculation in edge rendering pass
- [x] 6.2 Group nearby edges (within 3px screen-space) and render with reduced opacity
- [x] 6.3 Benchmark: confirm no significant rendering performance impact

## 7. i18n
- [x] 7.1 Add new UI string keys to `en.ts` (minimap toggle, reset view, cluster labels, simulation precision)
- [x] 7.2 Translate new keys to `fr.ts`, `de.ts`, `es.ts`, `ja.ts`, `zh.ts`

## 8. Validation
- [x] 8.1 Manual test with 10 nodes (should look identical to current behavior)
- [x] 8.2 Manual test with 200+ flashcards (should show clusters, be navigable, stay responsive)
- [x] 8.3 Manual test: zoom in/out transitions are smooth with no visual popping
- [x] 8.4 Manual test: minimap click navigates correctly
- [x] 8.5 Manual test: search auto-zooms to results
