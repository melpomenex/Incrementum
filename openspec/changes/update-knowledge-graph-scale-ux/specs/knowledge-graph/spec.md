## MODIFIED Requirements

### Requirement: Graph Visualization
The system SHALL provide a Knowledge Graph view that visualizes documents, extracts, and learning items with level-of-detail rendering that adapts to zoom level.

#### Scenario: Open Knowledge Graph with few items (< 50 nodes)
- **WHEN** the user opens the Knowledge Graph view with fewer than 50 total nodes
- **THEN** all nodes render at full detail (icons, labels, glow effects)
- **AND** edges show document → extract and extract → learning item relationships

#### Scenario: Open Knowledge Graph with many items (200+ flashcards)
- **WHEN** the user opens the Knowledge Graph view with 200 or more flashcard nodes
- **THEN** the graph renders at low zoom level showing document cluster nodes with child count badges
- **AND** the user can zoom in to progressively reveal extract nodes and individual flashcard nodes
- **AND** the force simulation remains responsive (target: < 16ms per frame)

### Requirement: Interactive Navigation
The Knowledge Graph SHALL support navigation to items, including clustered nodes that expand on interaction.

#### Scenario: Navigate from graph
- **WHEN** the user clicks a document or extract node
- **THEN** the corresponding item opens in its viewer

#### Scenario: Click to expand cluster
- **WHEN** the user clicks a cluster node (document or extract) at a zoom level where children are hidden
- **THEN** the cluster expands with a 200ms ease-out animation to reveal its child nodes
- **AND** the graph zooms in to fit the expanded cluster

#### Scenario: Search with auto-zoom
- **WHEN** the user types a search query that matches at least one node
- **THEN** the graph auto-zooms to fit all matching nodes in the viewport
- **AND** non-matching nodes are dimmed (20% opacity)

## ADDED Requirements

### Requirement: Level-of-Detail Rendering
The Knowledge Graph SHALL render nodes with three tiers of visual detail based on zoom level.

#### Scenario: Low zoom level (zoom < 0.4)
- **WHEN** the user views the graph at zoom level below 0.4x
- **THEN** only document-level cluster nodes are visible as colored dots with count badges
- **AND** no labels, icons, or glow effects are rendered

#### Scenario: Medium zoom level (0.4 ≤ zoom < 1.0)
- **WHEN** the user views the graph at zoom level between 0.4x and 1.0x
- **THEN** document and extract nodes are visible with truncated labels
- **AND** flashcard nodes within expanded clusters are visible as small circles

#### Scenario: High zoom level (zoom ≥ 1.0)
- **WHEN** the user views the graph at zoom level of 1.0x or higher
- **THEN** all nodes render with full detail (icons, labels, glow effects, borders)

### Requirement: Hierarchical Node Clustering
The Knowledge Graph SHALL group flashcard nodes under their parent extract nodes, and extract nodes under their parent document nodes, into expandable clusters.

#### Scenario: Cluster collapse at low zoom
- **WHEN** the graph is zoomed out below 0.4x
- **THEN** flashcard nodes are collapsed into their parent extract clusters
- **AND** extract clusters are collapsed into their parent document clusters
- **AND** each cluster displays a badge showing the count of collapsed children

#### Scenario: Cluster expand on zoom
- **WHEN** the user zooms in past 0.4x
- **THEN** document clusters expand with a 200ms ease-out animation to show extract nodes
- **AND** extract clusters expand with a 200ms animation to show individual flashcard nodes when zoom passes 0.8x

### Requirement: Graph Minimap
The Knowledge Graph SHALL display a minimap in the bottom-right corner when the total node count exceeds 50.

#### Scenario: Minimap shows overview
- **WHEN** the graph contains more than 50 nodes and the minimap is enabled
- **THEN** a minimap is rendered in the bottom-right corner showing all nodes as small dots
- **AND** a rectangle indicates the current viewport extent

#### Scenario: Minimap toggle
- **WHEN** the user clicks the minimap toggle button in the graph toolbar
- **THEN** the minimap is hidden or shown accordingly
- **AND** the toggle state persists across the session

#### Scenario: Minimap navigation
- **WHEN** the user clicks or drags on the minimap
- **THEN** the main graph viewport pans and zooms to the selected area

### Requirement: Efficient Force Simulation
The Knowledge Graph SHALL use Barnes-Hut spatial approximation for force-directed layout to maintain performance with large node counts.

#### Scenario: Force layout with many nodes
- **WHEN** the graph contains 500 or more nodes
- **THEN** the force simulation uses Barnes-Hut approximation with theta parameter of 0.5
- **AND** each physics frame completes in under 16ms

### Requirement: Edge Proximity Blending
The Knowledge Graph SHALL reduce opacity of edges that are visually close together to reduce visual clutter.

#### Scenario: Dense edge region
- **WHEN** multiple edges overlap or pass within 3 pixels of each other
- **THEN** those edges render with reduced opacity (50% base opacity)
- **AND** individual edges (isolated by more than 3 pixels) render at full opacity
