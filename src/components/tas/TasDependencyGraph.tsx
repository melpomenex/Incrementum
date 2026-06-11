// Tag-Aware Scheduling — Prerequisite Dependency Graph

import React, { useMemo } from "react";
import { ObsidianGraph } from "../graph/ObsidianGraph";
import { GraphNodeType, type GraphNode, type GraphEdge } from "../graph/KnowledgeGraph";
import type { Tag } from "../../types/tas";

interface TasDependencyGraphProps {
  tags: Tag[];
  /** Optional: highlight a specific tag */
  selectedTagId?: string | null;
  /** Width/height of the canvas */
  width?: number;
  height?: number;
}

const TAG_COLORS: Record<number, string> = {
  0: "#6366f1", // indigo
  1: "#8b5cf6", // violet
  2: "#a855f7", // purple
  3: "#d946ef", // fuchsia
  4: "#ec4899", // pink
};

/**
 * Build a directed dependency graph from tag prerequisite relationships.
 *
 * Each tag becomes a GraphNode (type=Tag), and each prerequisite relationship
 * becomes a directed GraphEdge from prerequisite → dependent.
 */
function buildPrerequisiteGraph(
  tags: Tag[],
  selectedTagId?: string | null
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const tagMap = new Map<string, Tag>();
  for (const tag of tags) {
    tagMap.set(tag.id, tag);
  }

  // Only include tags that participate in prerequisite relationships
  const involved = new Set<string>();
  const edges: GraphEdge[] = [];

  for (const tag of tags) {
    for (const prereqId of tag.prerequisites) {
      if (tagMap.has(prereqId)) {
        involved.add(tag.id);
        involved.add(prereqId);
        edges.push({
          id: `${prereqId}->${tag.id}`,
          source: prereqId,
          target: tag.id,
          type: "related",
          weight: 1,
          label: "requires",
        });
      }
    }
  }

  // If no prerequisites exist, return empty graph
  if (involved.size === 0) {
    return { nodes: [], edges: [] };
  }

  // Build nodes for involved tags only
  const nodes: GraphNode[] = [];
  let colorIdx = 0;

  for (const tagId of involved) {
    const tag = tagMap.get(tagId);
    if (!tag) continue;

    const isSelected = tagId === selectedTagId;
    // Spread nodes in a rough circle based on index
    const angle = (2 * Math.PI * colorIdx) / involved.size;
    const radius = 150;

    nodes.push({
      id: tag.id,
      type: GraphNodeType.Tag,
      label: tag.name,
      description: `${tag.matureCount}/${tag.itemCount} mature`,
      x: Math.cos(angle) * radius + 200,
      y: Math.sin(angle) * radius + 200,
      radius: isSelected ? 14 : 10,
      color: TAG_COLORS[colorIdx % Object.keys(TAG_COLORS).length],
      tags: [tag.name],
      metadata: {
        matureCount: tag.matureCount,
        itemCount: tag.itemCount,
        maturityThreshold: tag.maturityThreshold,
        coherence: tag.coherence,
      },
    });

    colorIdx++;
  }

  return { nodes, edges };
}

const TasDependencyGraph: React.FC<TasDependencyGraphProps> = ({
  tags,
  selectedTagId,
  width = 400,
  height = 300,
}) => {
  const graphData = useMemo(
    () => buildPrerequisiteGraph(tags, selectedTagId),
    [tags, selectedTagId]
  );

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center border border-dashed border-border rounded-lg p-4 text-sm text-muted-foreground"
           style={{ width, height }}>
        No prerequisite relationships defined.
        <br />
        Add prerequisites to tags to see the dependency graph.
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden" style={{ width, height }}>
      <ObsidianGraph
        data={graphData}
        enablePhysics={true}
        showLabels={true}
        linkDistance={120}
        nodeScale={1}
      />
    </div>
  );
};

export default TasDependencyGraph;
