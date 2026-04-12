## Context
The Knowledge Graph renders all nodes (documents, extracts, flashcards) as individual circles on an HTML5 Canvas. With many flashcards, the graph becomes an unreadable mass of overlapping purple dots. The system uses no external graph library — all rendering and physics are custom Canvas 2D code.

Key constraints:
- Must remain custom Canvas 2D (no new external dependencies)
- Must preserve the existing Obsidian-inspired aesthetic (glow effects, curved edges, dark grid background)
- Must work in Tauri desktop and web PWA modes
- i18n: all new UI strings must be added to all 6 locale files (en, fr, de, es, ja, zh)

## Goals / Non-Goals
**Goals:**
- Graph remains readable and navigable with 200-500 flashcards
- Users can zoom out to see clusters, zoom in to see individual cards
- The force simulation stays responsive as node count grows
- Search results are visually highlighted and auto-framed in the viewport

**Non-Goals:**
- Advanced graph analytics (pathfinding, community detection algorithms)
- Switching to an external graph library (d3, cytoscape, etc.)
- 3D layout improvements (out of scope; sphere view has different scale characteristics)

## Decisions

### 1. Clustering Strategy: Hierarchical Collapse by Document → Extract → Flashcard
**Decision**: Flashcards are grouped under their parent extract, and extracts are grouped under their parent document. At low zoom (< 0.4x), only document nodes are visible with a count badge. At medium zoom (0.4-0.8x), extract nodes appear. At high zoom (> 0.8x), all flashcard nodes are visible.

**Why**: This follows the natural data hierarchy (document → extract → flashcard) and is intuitive to users. It dramatically reduces visible node count at low zoom levels — a user with 300 flashcards across 20 documents sees only 20 nodes when zoomed out.

**Alternatives considered**:
- Force-based clustering (community detection): More complex, non-deterministic, harder to understand
- Grid-based clustering: Doesn't respect the document/extract/flashcard hierarchy
- Manual grouping: Requires user effort, doesn't scale

### 2. Level-of-Detail: Three Tier Rendering
**Decision**: Three LOD tiers based on zoom level:
- **Low (zoom < 0.4)**: Colored dots (no labels, no icons, no glow). Clusters show count badges.
- **Medium (0.4 ≤ zoom < 1.0)**: Colored circles with labels (truncated). Extract clusters expandable on click.
- **High (zoom ≥ 1.0)**: Full rendering — icons, glow effects, full labels, all individual nodes.

**Why**: Matches how the brain processes large graphs — start with the big picture, drill into details.

### 3. Barnes-Hut Approximation for Force Simulation
**Decision**: Implement a quadtree-based Barnes-Hut algorithm for repulsion force calculation, reducing complexity from O(n²) to O(n log n).

**Why**: The current O(n²) repulsion loop iterates every node pair every frame. With 500 nodes, that's 250,000 iterations per frame. Barnes-Hut with θ=0.5 reduces this to ~5,000 while maintaining visually similar layouts.

**Alternatives considered**:
- Spatial hashing grid: Simpler but less adaptive to non-uniform distributions
- Web Workers: Moves computation off main thread but doesn't reduce the O(n²) work

### 4. Minimap: Toggleable Overview in Bottom-Right Corner
**Decision**: A 150×100px minimap in the bottom-right corner, toggled via a map icon button in the graph toolbar. Shown by default when total node count > 50, but the user can hide it. Rendered as a secondary canvas.

**Why**: Standard pattern in node editors (VS Code, Figma) that helps users maintain spatial orientation when zoomed in. Toggle gives users control over screen real estate.

### 5. Search-with-Zoom: Auto-Fit on Filter
**Decision**: When the user types in the search box and the filtered result set is non-empty, the graph automatically zooms to fit all matching nodes in the viewport. A "Reset view" button returns to the full graph.

**Why**: The current search filters nodes but doesn't help the user find them visually. Auto-fitting immediately shows where the matches are.

### 6. Edge Bundling: Alpha Blending by Proximity
**Decision**: Use a simple alpha-reduction technique where edges that are close together (within a pixel threshold) render with reduced opacity, creating a visual "bundle" effect without actual edge routing.

**Why**: Full edge bundling (force-directed edge bundling) is computationally expensive and complex. Alpha-blending by proximity is a cheap approximation that reduces visual noise significantly.

## Risks / Trade-offs
- **Clustering adds complexity to click/hover hit-testing**: Need to check zoom level and cluster state before dispatching events. Mitigation: use a single `resolveVisibleNode()` function that handles all cases.
- **Barnes-Hut changes the force layout slightly**: Graphs may settle into slightly different positions than before. Mitigation: θ parameter can be tuned; visual difference is minimal.
- **Minimap doubles draw calls**: A secondary canvas rendering all nodes adds overhead. Mitigation: minimap renders at a much lower framerate (every 10 frames) and without effects/glow.

## Open Questions
(Resolved)
- Cluster expand/collapse: **animated** (200ms ease-out transition)
- Minimap: **toggleable** via toolbar button, shown by default when > 50 nodes
