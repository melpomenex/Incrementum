/**
 * Obsidian-inspired Knowledge Graph
 * Beautiful, interactive 2D graph visualization with LOD, clustering, Barnes-Hut, minimap
 */

import { useEffect, useRef, useState, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../lib/i18n";
import { GraphNodeType, LayoutAlgorithm, type GraphNode, type GraphData } from "./KnowledgeGraph";
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Settings2,
  Map,
} from "lucide-react";

export interface ObsidianGraphProps {
  data: GraphData;
  onNodeClick?: (node: GraphNode) => void;
  onNodeDoubleClick?: (node: GraphNode) => void;
  selectedNode?: string;
  highlightedNodes?: string[];
  enablePhysics?: boolean;
  showLabels?: boolean;
  layout?: LayoutAlgorithm;
  linkDistance?: number;
  nodeScale?: number;
}

export interface ObsidianGraphHandle {
  fitToView: (nodes?: GraphNode[]) => void;
}

interface SimulationNode extends GraphNode {
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
  childCount?: number;
  expandedChildren?: GraphNode[];
}

// LOD tiers
const LOD = { LOW: 0.4, MED: 1.0 };

// Node type configuration
const NODE_CONFIG = {
  [GraphNodeType.Document]: {
    icon: "📄",
    size: 24,
    color: "#3b82f6",
    labelKey: "graph.document",
  },
  [GraphNodeType.Extract]: {
    icon: "💬",
    size: 16,
    color: "#22c55e",
    labelKey: "graph.extract",
  },
  [GraphNodeType.Flashcard]: {
    icon: "🧠",
    size: 12,
    color: "#a855f7",
    labelKey: "graph.flashcard",
  },
  [GraphNodeType.Category]: {
    icon: "📁",
    size: 20,
    color: "#f59e0b",
    labelKey: "graph.categorySingular",
  },
  [GraphNodeType.Tag]: {
    icon: "🏷️",
    size: 14,
    color: "#06b6d4",
    labelKey: "graph.tag",
  },
};

// Edge type configuration
const EDGE_CONFIG: Record<string, { color: string; width: number; dash: number[] }> = {
  reference: { color: "#3b82f6", width: 2, dash: [] },
  contains: { color: "#64748b", width: 1.5, dash: [5, 5] },
  related: { color: "#22c55e", width: 1, dash: [] },
  derived: { color: "#a855f7", width: 2, dash: [] },
  tagged: { color: "#06b6d4", width: 1, dash: [2, 4] },
};

// ── Barnes-Hut QuadTree ──────────────────────────────────────────

interface QuadTreeBody {
  x: number;
  y: number;
  mass?: number;
}

class QuadTree {
  x: number;
  y: number;
  w: number;
  h: number;
  mass = 0;
  cx = 0;
  cy = 0;
  children: (QuadTree | null)[] = [null, null, null, null];
  // Single body stored at this leaf (undefined when internal node)
  body: QuadTreeBody | undefined;

  constructor(x: number, y: number, w: number, h: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }

  insert(body: QuadTreeBody, depth = 0): void {
    if (depth > 40) return; // Safety: prevent infinite recursion on coincident points

    // Empty leaf — store body directly
    if (this.body === undefined && this.mass === 0) {
      this.body = body;
      this.cx = body.x;
      this.cy = body.y;
      this.mass = body.mass ?? 1;
      return;
    }

    // We have an existing body — need to subdivide and push both down
    if (this.body !== undefined) {
      this.subdivide();
      const oldBody = this.body;
      this.body = undefined; // This is now an internal node

      // Push old body into appropriate child
      const qi = this.quadrant(oldBody.x, oldBody.y);
      const bounds = this.quadBounds(qi);
      if (!this.children[qi]) {
        this.children[qi] = new QuadTree(bounds[0], bounds[1], bounds[2], bounds[3]);
      }
      this.children[qi]!.insert(oldBody, depth + 1);
    }

    // Push new body into appropriate child
    const qi2 = this.quadrant(body.x, body.y);
    const bounds2 = this.quadBounds(qi2);
    if (!this.children[qi2]) {
      this.children[qi2] = new QuadTree(bounds2[0], bounds2[1], bounds2[2], bounds2[3]);
    }
    this.children[qi2]!.insert(body, depth + 1);

    // Recalculate center of mass
    const bm = body.mass ?? 1;
    const totalMass = this.mass + bm;
    this.cx = (this.cx * this.mass + body.x * bm) / totalMass;
    this.cy = (this.cy * this.mass + body.y * bm) / totalMass;
    this.mass = totalMass;
  }

  private quadrant(x: number, y: number): number {
    const midX = this.x + this.w / 2;
    const midY = this.y + this.h / 2;
    return (y >= midY ? 2 : 0) + (x >= midX ? 1 : 0);
  }

  private quadBounds(i: number): [number, number, number, number] {
    const hw = this.w / 2;
    const hh = this.h / 2;
    const cols = i % 2;
    const rows = Math.floor(i / 2);
    return [this.x + cols * hw, this.y + rows * hh, hw, hh];
  }

  private subdivide(): void {
    for (let i = 0; i < 4; i++) {
      const bounds = this.quadBounds(i);
      this.children[i] = new QuadTree(bounds[0], bounds[1], bounds[2], bounds[3]);
    }
  }

  /**
   * Compute repulsion force from this tree on a body using Barnes-Hut approximation.
   * Returns [fx, fy] — force components.
   */
  forceOn(body: QuadTreeBody, theta: number): [number, number] {
    const dx = body.x - this.cx;
    const dy = body.y - this.cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const size = Math.max(this.w, this.h);

    if (size / dist < theta || this.body !== undefined) {
      // Treat as a single body
      const f = (this.mass * repelConst) / (dist * dist);
      return [(dx / dist) * f, (dy / dist) * f];
    }

    let fx = 0;
    let fy = 0;
    for (const child of this.children) {
      if (!child || child.mass === 0) continue;
      const [cfx, cfy] = child.forceOn(body, theta);
      fx += cfx;
      fy += cfy;
    }
    return [fx, fy];
  }
}

// Repulsion constant — shared across the Barnes-Hut force calculation
let repelConst = 300;

// ── Build QuadTree from nodes ────────────────────────────────────

function buildQuadTree(nodes: { x: number; y: number }[]): QuadTree {
  if (nodes.length === 0) {
    return new QuadTree(0, 0, 1, 1);
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x > maxX) maxX = n.x;
    if (n.y > maxY) maxY = n.y;
  }

  const pad = 10;
  const tree = new QuadTree(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);
  for (const n of nodes) {
    tree.insert({ x: n.x, y: n.y, mass: 1 });
  }
  return tree;
}

// ── Edge adjacency index (for O(1) neighbor lookups) ─────────────

interface EdgeAdjacency {
  getNeighbors(nodeId: string): string[];
  getSource(edgeId: string): string;
  getTarget(edgeId: string): string;
}

function buildEdgeAdjacency(edges: { id: string; source: string; target: string }[]): EdgeAdjacency {
  const neighbors: Record<string, string[]> = {};
  const sourceMap: Record<string, string> = {};
  const targetMap: Record<string, string> = {};

  for (const edge of edges) {
    sourceMap[edge.id] = edge.source;
    targetMap[edge.id] = edge.target;
    if (!neighbors[edge.source]) neighbors[edge.source] = [];
    neighbors[edge.source].push(edge.target);
    if (!neighbors[edge.target]) neighbors[edge.target] = [];
    neighbors[edge.target].push(edge.source);
  }

  return {
    getNeighbors: (id) => neighbors[id] || [],
    getSource: (id) => sourceMap[id] || "",
    getTarget: (id) => targetMap[id] || "",
  };
}

// ── Cluster helpers ──────────────────────────────────────────────

interface ClusterIndex {
  childrenOf: Record<string, string[]>;       // parentId -> childIds
  parentOf: Record<string, string>;           // childId -> parentId
  totalDescendants: Record<string, number>;    // nodeId -> total descendants
}

function buildClusterIndex(edges: { source: string; target: string; type?: string }[], nodes: GraphNode[]): ClusterIndex {
  const childrenOf: Record<string, string[]> = {};
  const parentOf: Record<string, string> = {};

  for (const edge of edges) {
    if (edge.type === "contains" || edge.type === "derived") {
      if (!childrenOf[edge.source]) childrenOf[edge.source] = [];
      childrenOf[edge.source].push(edge.target);
      parentOf[edge.target] = edge.source;
    }
  }

  // Compute total descendants (recursive count)
  const totalDescendants: Record<string, number> = {};
  function countDesc(id: string): number {
    if (totalDescendants[id] !== undefined) return totalDescendants[id];
    const ch = childrenOf[id] || [];
    let total = ch.length;
    for (const c of ch) {
      total += countDesc(c);
    }
    totalDescendants[id] = total;
    return total;
  }

  for (const node of nodes) {
    countDesc(node.id);
  }

  return { childrenOf, parentOf, totalDescendants };
}

interface VisibleSet {
  nodes: Record<string, boolean>;
  isCluster: Record<string, number>;
}

function computeVisibleNodes(
  nodes: GraphNode[],
  clusterIndex: ClusterIndex,
  zoom: number,
  expandedClusters: Record<string, boolean>,
): VisibleSet {
  const visible: Record<string, boolean> = {};
  const isCluster: Record<string, number> = {};

  if (zoom < LOD.LOW) {
    // Show only documents (top-level), each as cluster
    for (const node of nodes) {
      if (node.type === GraphNodeType.Document) {
        visible[node.id] = true;
        const desc = clusterIndex.totalDescendants[node.id] || 0;
        const ch = clusterIndex.childrenOf[node.id];
        if (desc > 0 || (ch?.length ?? 0) > 0) {
          isCluster[node.id] = desc;
        }
      }
    }
  } else if (zoom < LOD.MED) {
    // Show documents + extracts; extracts with flashcards are clusters
    // Allow expanded documents to show children
    for (const node of nodes) {
      if (node.type === GraphNodeType.Document) {
        visible[node.id] = true;
        if (expandedClusters[node.id]) {
          const ch = clusterIndex.childrenOf[node.id] || [];
          for (const cid of ch) {
            const cn = nodes.find(n => n.id === cid);
            if (cn) {
              visible[cid] = true;
              const desc = clusterIndex.totalDescendants[cid] || 0;
              if (desc > 0) isCluster[cid] = desc;
            }
          }
        } else {
          const desc = clusterIndex.totalDescendants[node.id] || 0;
          if (desc > 0) isCluster[node.id] = desc;
        }
      }
    }
  } else {
    // High zoom: Show documents, extracts, categories, tags by default.
    // Flashcards are collapsed under their parent (Extract or Document) unless explicitly expanded.
    for (const node of nodes) {
      if (node.type === GraphNodeType.Document || node.type === GraphNodeType.Extract) {
        visible[node.id] = true;
        
        const ch = clusterIndex.childrenOf[node.id] || [];
        const leafChildren = ch.filter(cid => {
          const cn = nodes.find(n => n.id === cid);
          return cn && cn.type === GraphNodeType.Flashcard;
        });

        if (leafChildren.length > 0) {
          if (expandedClusters[node.id]) {
            for (const cid of leafChildren) {
              visible[cid] = true;
            }
          } else {
            isCluster[node.id] = leafChildren.length;
          }
        }
      } else if (node.type === GraphNodeType.Flashcard) {
        const parentId = clusterIndex.parentOf[node.id];
        if (parentId) {
          if (visible[parentId] && expandedClusters[parentId]) {
            visible[node.id] = true;
          }
        } else {
          visible[node.id] = true;
        }
      } else {
        visible[node.id] = true;
      }
    }
  }

  return { nodes: visible, isCluster };
}

interface ScreenEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  idx: number;
}

function computeEdgeOpacities(screenEdges: ScreenEdge[], threshold = 3): Float32Array {
  const opacities = new Float32Array(screenEdges.length);
  opacities.fill(1);

  // For each edge, count how many other edges pass within `threshold` pixels
  for (let i = 0; i < screenEdges.length; i++) {
    const a = screenEdges[i];
    let nearby = 0;
    for (let j = 0; j < screenEdges.length; j++) {
      if (i === j) continue;
      const b = screenEdges[j];
      // Quick bounding-box pre-check
      const minBX = Math.min(b.x1, b.x2) - threshold;
      const maxBX = Math.max(b.x1, b.x2) + threshold;
      const minBY = Math.min(b.y1, b.y2) - threshold;
      const maxBY = Math.max(b.y1, b.y2) + threshold;
      if (
        a.x1 < minBX && a.x2 < minBX ||
        a.x1 > maxBX && a.x2 > maxBX ||
        a.y1 < minBY && a.y2 < minBY ||
        a.y1 > maxBY && a.y2 > maxBY
      ) continue;

      // Point-to-segment distance for midpoints (cheap approximation)
      const mx = (a.x1 + a.x2) / 2;
      const my = (a.y1 + a.y2) / 2;
      const dist = pointToSegmentDist(mx, my, b.x1, b.y1, b.x2, b.y2);
      if (dist < threshold) nearby++;
    }
    // Blend: more nearby edges -> lower opacity, min 0.3
    if (nearby > 0) {
      opacities[i] = Math.max(0.3, 1 - nearby * 0.12);
    }
  }

  return opacities;
}

function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

// ── Easing ───────────────────────────────────────────────────────

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ── Component ────────────────────────────────────────────────────

export const ObsidianGraph = forwardRef<ObsidianGraphHandle, ObsidianGraphProps>(function ObsidianGraph({
  data,
  onNodeClick,
  onNodeDoubleClick,
  selectedNode,
  highlightedNodes = [],
  enablePhysics = true,
  showLabels = true,
  layout: layoutProp,
  linkDistance: linkDistanceProp,
  nodeScale = 1,
}, ref) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [physicsEnabled, setPhysicsEnabled] = useState(enablePhysics);
  const [showSettings, setShowSettings] = useState(false);
  const [localShowLabels, setLocalShowLabels] = useState(showLabels);
  const [linkDistance, setLinkDistance] = useState(linkDistanceProp ?? 120);
  const [repelForce, setRepelForce] = useState(300);
  const [showMinimap, setShowMinimap] = useState(true);
  const [expandedClusters, setExpandedClusters] = useState<Record<string, boolean>>({});
  const [_clusterAnimProgress, _setClusterAnimProgress] = useState(1); // 1 = fully settled

  const frameCountRef = useRef(0);
  const animatingTransformRef = useRef(false);
  const targetTransformRef = useRef<{ x: number; y: number; k: number } | null>(null);
  const _searchFitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build cluster index from data
  const clusterIndex = useMemo(() => buildClusterIndex(data.edges, data.nodes), [data.edges, data.nodes]);

  // Build edge adjacency
  const edgeAdj = useMemo(() => buildEdgeAdjacency(data.edges), [data.edges]);

  // Map from node id -> SimulationNode for O(1) lookup
  const nodeMapRef = useRef<Record<string, SimulationNode>>({});

  // Initialize simulation nodes with random positions
  const simulationNodes = useMemo<SimulationNode[]>(() => {
    const width = canvasRef.current?.width || 800;
    const height = canvasRef.current?.height || 600;
    const nodes = data.nodes.map((node) => ({
      ...node,
      x: node.x || (width / 2 + (Math.random() - 0.5) * 200),
      y: node.y || (height / 2 + (Math.random() - 0.5) * 200),
      vx: 0,
      vy: 0,
    }));
    const map: Record<string, SimulationNode> = {};
    for (const n of nodes) map[n.id] = n;
    nodeMapRef.current = map;
    return nodes;
  }, [data.nodes]);

  const spriteCacheRef = useRef<Record<string, HTMLCanvasElement>>({});

  // Clear sprite cache when scale or theme changes
  useEffect(() => {
    spriteCacheRef.current = {};
  }, [nodeScale, theme]);

  const getOrUpdateSprite = useCallback((
    type: GraphNodeType,
    state: "normal" | "hovered" | "selected" | "medium",
  ): HTMLCanvasElement => {
    const themeKey = theme.colors.background + "-" + theme.colors.onBackground;
    const key = `${type}-${state}-${themeKey}-${nodeScale}`;
    
    if (spriteCacheRef.current[key]) {
      return spriteCacheRef.current[key];
    }
    
    const config = NODE_CONFIG[type];
    const baseRadius = config.size * nodeScale;
    const isSelected = state === "selected";
    const isHovered = state === "hovered";
    const isMed = state === "medium";
    
    const multiplier = isSelected ? 1.3 : isHovered ? 1.2 : 1.0;
    const radius = baseRadius * multiplier;
    
    const hasGlow = (isSelected || isHovered);
    const maxRadius = hasGlow ? radius * 2.5 : radius;
    const canvasSize = Math.ceil(maxRadius * 2) + 6;
    
    const canvas = document.createElement("canvas");
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    
    const cx = canvasSize / 2;
    const cy = canvasSize / 2;
    
    // Draw glow
    if (hasGlow) {
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2.5);
      gradient.addColorStop(0, config.color + "40");
      gradient.addColorStop(1, config.color + "00");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    if (isMed) {
      // Shadow
      ctx.beginPath();
      ctx.arc(cx + 2, cy + 2, radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fill();

      // Circle
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = config.color;
      ctx.fill();
    } else {
      // High LOD (Normal, Hovered, Selected)
      // Shadow
      ctx.beginPath();
      ctx.arc(cx + 2, cy + 2, radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fill();

      // Node circle
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = config.color;
      ctx.fill();

      // Inner highlight
      const gradient = ctx.createRadialGradient(
        cx - radius * 0.3,
        cy - radius * 0.3,
        0,
        cx,
        cy,
        radius
      );
      gradient.addColorStop(0, "rgba(255,255,255,0.3)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fill();

      // Border for selected
      if (isSelected) {
        ctx.strokeStyle = theme.colors.onBackground;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Icon
      ctx.fillStyle = "#ffffff";
      ctx.font = `${radius * 0.9}px ${theme.typography.fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(config.icon, cx, cy);
    }
    
    spriteCacheRef.current[key] = canvas;
    return canvas;
  }, [nodeScale, theme]);

  const fitToView = useCallback((targetNodes?: GraphNode[]) => {
    const nodes = targetNodes || simulationNodes;
    if (nodes.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x);
      maxY = Math.max(maxY, node.y);
    }

    const padding = 100;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    const scaleX = canvas.width / width;
    const scaleY = canvas.height / height;
    const newK = Math.min(scaleX, scaleY, 2);

    const newX = (canvas.width - (maxX + minX) * newK) / 2;
    const newY = (canvas.height - (maxY + minY) * newK) / 2;

    targetTransformRef.current = { x: newX, y: newY, k: newK };
    animatingTransformRef.current = true;
  }, [simulationNodes]);

  // Sync linkDistance from prop
  useEffect(() => {
    if (linkDistanceProp !== undefined) {
      setLinkDistance(linkDistanceProp);
    }
  }, [linkDistanceProp]);

  // Apply non-force layouts directly to simulation nodes
  useEffect(() => {
    if (!layoutProp || layoutProp === LayoutAlgorithm.Force) return;

    const canvas = canvasRef.current;
    const width = canvas?.width || 800;
    const height = canvas?.height || 600;
    const nodes = simulationNodes;
    if (nodes.length === 0) return;

    // Disable physics for non-force layouts
    setPhysicsEnabled(false);

    switch (layoutProp) {
      case LayoutAlgorithm.Circular: {
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(centerX, centerY) * 0.8;
        const angleStep = (Math.PI * 2) / nodes.length;
        for (let i = 0; i < nodes.length; i++) {
          nodes[i].x = centerX + Math.cos(i * angleStep) * radius;
          nodes[i].y = centerY + Math.sin(i * angleStep) * radius;
          nodes[i].vx = 0;
          nodes[i].vy = 0;
        }
        break;
      }
      case LayoutAlgorithm.Hierarchical: {
        const levels: Record<number, SimulationNode[]> = {};
        for (const node of nodes) {
          const level = (node.type === GraphNodeType.Document ? 0 :
                        node.type === GraphNodeType.Extract ? 1 : 2);
          if (!levels[level]) levels[level] = [];
          levels[level].push(node);
        }
        let y = 50;
        for (const lvl of Object.keys(levels).sort()) {
          const levelNodes = levels[Number(lvl)];
          const xStep = width / (levelNodes.length + 1);
          for (let i = 0; i < levelNodes.length; i++) {
            levelNodes[i].x = xStep * (i + 1);
            levelNodes[i].y = y;
            levelNodes[i].vx = 0;
            levelNodes[i].vy = 0;
          }
          y += 120;
        }
        break;
      }
      case LayoutAlgorithm.Grid: {
        const gridSize = Math.ceil(Math.sqrt(nodes.length));
        const cellWidth = width / gridSize;
        const cellHeight = height / gridSize;
        for (let i = 0; i < nodes.length; i++) {
          const row = Math.floor(i / gridSize);
          const col = i % gridSize;
          nodes[i].x = cellWidth * (col + 0.5);
          nodes[i].y = cellHeight * (row + 0.5);
          nodes[i].vx = 0;
          nodes[i].vy = 0;
        }
        break;
      }
      case LayoutAlgorithm.Random: {
        for (const node of nodes) {
          node.x = Math.random() * width;
          node.y = Math.random() * height;
          node.vx = 0;
          node.vy = 0;
        }
        break;
      }
    }

    // Re-enable physics when switching back to force layout
    return () => {
      setPhysicsEnabled(true);
    };
  }, [layoutProp, simulationNodes]);

  // Expose fitToView for parent via imperative handle
  useImperativeHandle(ref, () => ({ fitToView }), [fitToView]);

  // Compute visible nodes based on zoom
  const visibleSet = useMemo(
    () => computeVisibleNodes(data.nodes, clusterIndex, transform.k, expandedClusters),
    [data.nodes, clusterIndex, transform.k, expandedClusters],
  );

  const visibleSetRef = useRef(visibleSet);
  useEffect(() => {
    visibleSetRef.current = visibleSet;
  }, [visibleSet]);

  // Physics simulation (Barnes-Hut)
  useEffect(() => {
    if (!physicsEnabled) return;

    let animationId: number;
    let temperature = 1;
    repelConst = repelForce;

    const simulate = () => {
      if (temperature < 0.001) {
        setPhysicsEnabled(false);
        return;
      }

      const nodes = simulationNodes;
      const nodeMap = nodeMapRef.current;
      const canvas = canvasRef.current;
      const width = canvas?.width || 800;
      const height = canvas?.height || 600;
      const currentVisible = visibleSetRef.current;

      // Filter down to only active (visible) nodes for force calculation
      const activeNodes = nodes.filter(n => currentVisible.nodes[n.id]);

      // Build quadtree for Barnes-Hut repulsion on active nodes only
      const tree = buildQuadTree(activeNodes);

      // Apply forces to active nodes only
      for (const node of activeNodes) {
        if (node.fx !== null && node.fy !== null) continue;

        // Barnes-Hut repulsion
        const [rfx, rfy] = tree.forceOn(node, 0.5);
        let fx = rfx;
        let fy = rfy;

        // Attraction along edges (use adjacency for O(1) neighbor lookup)
        const neighbors = edgeAdj.getNeighbors(node.id);
        for (const nId of neighbors) {
          if (!currentVisible.nodes[nId]) continue; // Skip inactive/hidden neighbors
          const other = nodeMap[nId];
          if (!other) continue;
          const dx = other.x - node.x;
          const dy = other.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - linkDistance) * 0.03;
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        }

        // Center gravity
        fx += (width / 2 - node.x) * 0.005;
        fy += (height / 2 - node.y) * 0.005;

        // Update velocity and position with damping
        node.vx = (node.vx + fx) * 0.8;
        node.vy = (node.vy + fy) * 0.8;
        node.x += node.vx * temperature;
        node.y += node.vy * temperature;
      }

      // Synchronize positions of collapsed/hidden nodes to their parent positions
      for (const node of nodes) {
        if (!currentVisible.nodes[node.id]) {
          const parentId = clusterIndex.parentOf[node.id];
          if (parentId) {
            const parent = nodeMap[parentId];
            if (parent) {
              node.x = parent.x;
              node.y = parent.y;
              node.vx = 0;
              node.vy = 0;
            }
          }
        }
      }

      temperature *= 0.99;
      animationId = requestAnimationFrame(simulate);
    };

    simulate();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [simulationNodes, physicsEnabled, linkDistance, repelForce, edgeAdj, clusterIndex]);

  // Draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    const zoom = transform.k;

    // Viewport bounds in graph space (with padding margin of 150 pixels)
    const margin = 150;
    const viewMinX = -transform.x / zoom - margin;
    const viewMinY = -transform.y / zoom - margin;
    const viewMaxX = (width - transform.x) / zoom + margin;
    const viewMaxY = (height - transform.y) / zoom + margin;

    const isNodeInViewport = (x: number, y: number) => {
      return x >= viewMinX && x <= viewMaxX && y >= viewMinY && y <= viewMaxY;
    };

    // Clear
    ctx.fillStyle = theme.colors.background;
    ctx.fillRect(0, 0, width, height);

    // Draw grid background
    drawGrid(ctx, width, height, transform, theme);

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(zoom, zoom);

    const nodeMap = nodeMapRef.current;

    // ── Draw edges with proximity blending ──
    const screenEdges: ScreenEdge[] = [];
    for (let i = 0; i < data.edges.length; i++) {
      const edge = data.edges[i];
      const source = nodeMap[edge.source];
      const target = nodeMap[edge.target];
      if (!source || !target) continue;
      if (!visibleSet.nodes[edge.source] || !visibleSet.nodes[edge.target]) continue;

      // Check if edge connects a visible cluster to its hidden children — skip those
      if (visibleSet.isCluster[edge.source] !== undefined && !visibleSet.nodes[edge.target]) continue;
      if (visibleSet.isCluster[edge.target] !== undefined && !visibleSet.nodes[edge.source]) continue;

      // Frustum culling: skip drawing offscreen edges
      if (!isNodeInViewport(source.x, source.y) && !isNodeInViewport(target.x, target.y)) continue;

      screenEdges.push({
        x1: source.x * zoom + transform.x,
        y1: source.y * zoom + transform.y,
        x2: target.x * zoom + transform.x,
        y2: target.y * zoom + transform.y,
        idx: i,
      });
    }

    // Compute edge opacities (only when zoom > LOD.LOW to save cycles at low zoom)
    const edgeOpacities = zoom > LOD.LOW && screenEdges.length > 1 && screenEdges.length < 500
      ? computeEdgeOpacities(screenEdges, 3 * zoom)
      : null;

    for (let si = 0; si < screenEdges.length; si++) {
      const { idx } = screenEdges[si];
      const edge = data.edges[idx];
      const source = nodeMap[edge.source]!;
      const target = nodeMap[edge.target]!;

      const config = EDGE_CONFIG[edge.type || "related"];
      const isHighlighted = selectedNode && (edge.source === selectedNode || edge.target === selectedNode);
      const isDimmed = selectedNode && !isHighlighted;
      const opacity = edgeOpacities ? edgeOpacities[si] : 1;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2;
      const curvature = 20;
      ctx.quadraticCurveTo(midX + curvature, midY - curvature, target.x, target.y);

      const baseAlpha = isHighlighted ? 1 : isDimmed ? 0.12 : 0.4;
      ctx.strokeStyle = config.color + (Math.round(baseAlpha * opacity * 255)).toString(16).padStart(2, "0");
      ctx.lineWidth = isHighlighted ? config.width * 1.5 : config.width;
      ctx.setLineDash(config.dash);
      ctx.stroke();
      ctx.setLineDash([]);

      // Edge label only at high zoom
      if (localShowLabels && edge.label && zoom > 0.7) {
        ctx.fillStyle = theme.colors.textSecondary;
        ctx.font = `10px ${theme.typography.fontFamily}`;
        ctx.textAlign = "center";
        ctx.fillText(edge.label, midX, midY - 5);
      }
    }

    // ── Draw nodes with LOD ──
    for (const node of simulationNodes) {
      if (!visibleSet.nodes[node.id]) continue;

      // Frustum culling: skip drawing offscreen nodes
      if (!isNodeInViewport(node.x, node.y)) continue;

      const config = NODE_CONFIG[node.type];
      if (!config) continue;
      const isSelected = selectedNode === node.id;
      const isHovered = hoveredNode === node.id;
      const isHighlighted = highlightedNodes.includes(node.id);
      const isDimmed = selectedNode && !isSelected && !isHighlighted;

      const radius = config.size * nodeScale * (isSelected ? 1.3 : isHovered ? 1.2 : 1);
      const opacity = isDimmed ? 0.2 : 1;
      const clusterCount = visibleSet.isCluster[node.id] || 0;
      const isLowZoom = zoom < LOD.LOW;
      const isMedZoom = zoom >= LOD.LOW && zoom < LOD.MED;

      ctx.globalAlpha = opacity;

      if (isLowZoom) {
        // LOW LOD: simple colored dot, slightly larger for clusters
        const r = clusterCount > 0 ? radius * 1.3 : radius * 0.7;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = config.color;
        ctx.fill();
      } else {
        // MEDIUM + HIGH LOD (cached sprite draw)
        let state: "normal" | "hovered" | "selected" | "medium" = "normal";
        if (isSelected) state = "selected";
        else if (isHovered) state = "hovered";
        else if (isMedZoom) state = "medium";

        const sprite = getOrUpdateSprite(node.type, state);
        ctx.drawImage(
          sprite,
          node.x - sprite.width / 2,
          node.y - sprite.height / 2
        );

        // Label
        if (localShowLabels || isSelected || isHovered) {
          ctx.fillStyle = isSelected ? theme.colors.onBackground : theme.colors.textSecondary;
          ctx.font = `${isSelected || isHovered ? "bold " : ""}12px ${theme.typography.fontFamily}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";

          let label = node.label;
          const maxLen = isMedZoom ? 20 : 25;
          if (label.length > maxLen) label = label.substring(0, maxLen - 3) + "...";
          ctx.fillText(label, node.x, node.y + radius + 8);
        }
      }

      // Cluster count badge — shown at LOW and MED zoom when node is a cluster
      if (clusterCount > 0) {
        const badgeR = isLowZoom ? 10 : 9;
        const badgeX = node.x + (isLowZoom ? radius * 1.0 : radius * 0.8);
        const badgeY = node.y - (isLowZoom ? radius * 1.0 : radius * 0.8);

        ctx.beginPath();
        ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
        ctx.fillStyle = theme.colors.onBackground;
        ctx.fill();
        ctx.strokeStyle = config.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = theme.colors.background;
        ctx.font = `bold ${isLowZoom ? 9 : 8}px ${theme.typography.fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const countLabel = clusterCount > 99 ? "99+" : String(clusterCount);
        ctx.fillText(countLabel, badgeX, badgeY);
      }

      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // ── Minimap ──
    frameCountRef.current++;
    if (showMinimap && data.nodes.length > 50 && frameCountRef.current % 10 === 0) {
      drawMinimap();
    }
  }, [
    simulationNodes, data.edges, data.nodes, transform, theme,
    selectedNode, highlightedNodes, hoveredNode, localShowLabels,
    visibleSet, showMinimap, edgeAdj, getOrUpdateSprite,
  ]);

  // ── Minimap rendering ──────────────────────────────────────────

  const drawMinimap = useCallback(() => {
    const miniCanvas = minimapRef.current;
    const mainCanvas = canvasRef.current;
    if (!miniCanvas || !mainCanvas) return;

    const mctx = miniCanvas.getContext("2d");
    if (!mctx) return;

    const mw = miniCanvas.width;
    const mh = miniCanvas.height;
    const { width: cw, height: ch } = mainCanvas;

    // Background
    mctx.fillStyle = theme.colors.background + "dd";
    mctx.fillRect(0, 0, mw, mh);

    if (simulationNodes.length === 0) return;

    // Compute bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of simulationNodes) {
      if (node.x < minX) minX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.x > maxX) maxX = node.x;
      if (node.y > maxY) maxY = node.y;
    }

    const pad = 20;
    const gw = maxX - minX + pad * 2;
    const gh = maxY - minY + pad * 2;
    const scale = Math.min(mw / gw, mh / gh);
    const ox = (mw - gw * scale) / 2 - minX * scale + pad * scale;
    const oy = (mh - gh * scale) / 2 - minY * scale + pad * scale;

    // Draw nodes as dots
    for (const node of simulationNodes) {
      if (!visibleSet.nodes[node.id]) continue;
      const config = NODE_CONFIG[node.type];
      if (!config) continue;
      mctx.beginPath();
      mctx.arc(node.x * scale + ox, node.y * scale + oy, 1.5, 0, Math.PI * 2);
      mctx.fillStyle = config.color;
      mctx.fill();
    }

    // Viewport rectangle
    const vx = (-transform.x / transform.k) * scale + ox;
    const vy = (-transform.y / transform.k) * scale + oy;
    const vw = (cw / transform.k) * scale;
    const vh = (ch / transform.k) * scale;

    mctx.strokeStyle = theme.colors.onBackground + "60";
    mctx.lineWidth = 1;
    mctx.strokeRect(vx, vy, vw, vh);
    mctx.fillStyle = theme.colors.onBackground + "10";
    mctx.fillRect(vx, vy, vw, vh);
  }, [simulationNodes, transform, theme, visibleSet]);

  // ── Animated transform (for search fit) ────────────────────────

  useEffect(() => {
    if (!animatingTransformRef.current || !targetTransformRef.current) return;

    const target = targetTransformRef.current;
    const start = { ...transform };
    const duration = 300;
    let startTime: number | null = null;

    let animId: number;
    const animate = (time: number) => {
      if (startTime === null) startTime = time;
      const elapsed = time - startTime;
      const t = Math.min(1, elapsed / duration);
      const e = easeOutCubic(t);

      setTransform({
        x: start.x + (target.x - start.x) * e,
        y: start.y + (target.y - start.y) * e,
        k: start.k + (target.k - start.k) * e,
      });

      if (t < 1) {
        animId = requestAnimationFrame(animate);
      } else {
        animatingTransformRef.current = false;
        targetTransformRef.current = null;
      }
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [transform]); // Re-run when transform updates during animation

  // Animation/Render loop (demand-driven)
  useEffect(() => {
    let animationId: number;

    const animate = () => {
      draw();
      
      // Only continue the continuous render loop if physics is running, dragging, or transform is animating
      const shouldKeepRunning = physicsEnabled || isDragging || animatingTransformRef.current;
      if (shouldKeepRunning) {
        animationId = requestAnimationFrame(animate);
      }
    };

    animate();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [draw, physicsEnabled, isDragging]);

  // Wake up physics simulation when clusters are expanded/collapsed or data changes
  useEffect(() => {
    setPhysicsEnabled(true);
  }, [expandedClusters, data]);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      draw();
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [draw]);

  // ── Mouse handlers ─────────────────────────────────────────────

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setTransform({
        ...transform,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    } else {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = (e.clientX - rect.left - transform.x) / transform.k;
      const y = (e.clientY - rect.top - transform.y) / transform.k;

      let hovered: string | null = null;
      for (const node of simulationNodes) {
        if (!visibleSet.nodes[node.id]) continue;
        const config = NODE_CONFIG[node.type];
        if (!config) continue;
        const dx = x - node.x;
        const dy = y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Slightly larger hit area for clusters
        const hitRadius = visibleSet.isCluster[node.id] !== undefined ? config.size * nodeScale * 1.5 + 5 : config.size * nodeScale + 5;
        if (dist <= hitRadius) {
          hovered = node.id;
          break;
        }
      }

      setHoveredNode(hovered);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newK = Math.max(0.1, Math.min(5, transform.k * zoomFactor));

    const newX = mouseX - (mouseX - transform.x) * (newK / transform.k);
    const newY = mouseY - (mouseY - transform.y) * (newK / transform.k);

    setTransform({ x: newX, y: newY, k: newK });
  };

  const handleClick = () => {
    if (!hoveredNode) return;

    const node = nodeMapRef.current[hoveredNode];
    if (!node) return;

    // Check if it's a cluster — expand it
    if (visibleSet.isCluster[node.id] !== undefined) {
      setExpandedClusters((prev) => ({
        ...prev,
        [node.id]: true,
      }));
      // Zoom in to the expanded area
      const children = clusterIndex.childrenOf[node.id] || [];
      const childNodes = children
        .map((id) => nodeMapRef.current[id])
        .filter(Boolean) as GraphNode[];
      if (childNodes.length > 0) {
        fitToView([node, ...childNodes]);
      }
      return;
    }

    if (onNodeClick) {
      onNodeClick(node);
    }
  };

  const handleDoubleClick = () => {
    if (!hoveredNode) return;
    const node = nodeMapRef.current[hoveredNode];
    if (!node) return;
    if (onNodeDoubleClick) {
      onNodeDoubleClick(node);
    }
  };

  // ── Minimap click/drag navigation ──────────────────────────────

  const handleMinimapClick = useCallback((e: React.MouseEvent) => {
    const miniCanvas = minimapRef.current;
    const mainCanvas = canvasRef.current;
    if (!miniCanvas || !mainCanvas || simulationNodes.length === 0) return;

    const rect = miniCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const mw = miniCanvas.width;
    const mh = miniCanvas.height;
    const { width: cw, height: ch } = mainCanvas;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of simulationNodes) {
      if (node.x < minX) minX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.x > maxX) maxX = node.x;
      if (node.y > maxY) maxY = node.y;
    }

    const pad = 20;
    const gw = maxX - minX + pad * 2;
    const gh = maxY - minY + pad * 2;
    const scale = Math.min(mw / gw, mh / gh);
    const ox = (mw - gw * scale) / 2 - minX * scale + pad * scale;
    const oy = (mh - gh * scale) / 2 - minY * scale + pad * scale;

    // Convert minimap click to graph coordinates
    const graphX = (mx - ox) / scale;
    const graphY = (my - oy) / scale;

    // Set transform to center on that point
    const newK = transform.k;
    const newX = cw / 2 - graphX * newK;
    const newY = ch / 2 - graphY * newK;

    targetTransformRef.current = { x: newX, y: newY, k: newK };
    animatingTransformRef.current = true;
  }, [simulationNodes, transform]);

  // ── Search fit handler (called from parent) ────────────────────

  // Reset view
  const resetView = useCallback(() => {
    fitToView(simulationNodes);
  }, [fitToView, simulationNodes]);

  // Auto-collapse clusters when zooming out
  useEffect(() => {
    if (transform.k < LOD.LOW) {
      // At low zoom, collapse everything
      setExpandedClusters({});
    } else if (transform.k >= LOD.MED) {
      // At high zoom, expand all extract clusters
      setExpandedClusters({});
    }
    // At medium zoom, keep user's manual expansion state
  }, [transform.k]);

  // Node count for minimap visibility
  const totalNodeCount = data.nodes.length;

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      />

      {/* Minimap */}
      {showMinimap && totalNodeCount > 50 && (
        <canvas
          ref={minimapRef}
          width={180}
          height={120}
          className="absolute bottom-6 left-6 rounded-lg border border-border shadow-lg cursor-pointer"
          style={{ background: theme.colors.background + "dd" }}
          onClick={handleMinimapClick}
          title={t("graph.minimap")}
        />
      )}

      {/* Floating Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2">
        <button
          onClick={resetView}
          className="w-10 h-10 flex items-center justify-center bg-card/90 backdrop-blur border border-border rounded-xl shadow-lg hover:bg-muted transition-all hover:scale-105"
          title={t("graph.fitToView")}
        >
          <Maximize2 className="w-5 h-5" />
        </button>
        <button
          onClick={() => setTransform((t) => ({ ...t, k: Math.min(5, t.k * 1.2) }))}
          className="w-10 h-10 flex items-center justify-center bg-card/90 backdrop-blur border border-border rounded-xl shadow-lg hover:bg-muted transition-all hover:scale-105"
          title={t("graph.zoomIn")}
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={() => setTransform((t) => ({ ...t, k: Math.max(0.1, t.k * 0.8) }))}
          className="w-10 h-10 flex items-center justify-center bg-card/90 backdrop-blur border border-border rounded-xl shadow-lg hover:bg-muted transition-all hover:scale-105"
          title={t("graph.zoomOut")}
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        {totalNodeCount > 50 && (
          <button
            onClick={() => setShowMinimap(!showMinimap)}
            className={`w-10 h-10 flex items-center justify-center bg-card/90 backdrop-blur border border-border rounded-xl shadow-lg hover:bg-muted transition-all hover:scale-105 ${showMinimap ? "text-primary" : ""}`}
            title={t("graph.minimap")}
          >
            <Map className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`w-10 h-10 flex items-center justify-center bg-card/90 backdrop-blur border border-border rounded-xl shadow-lg hover:bg-muted transition-all hover:scale-105 ${showSettings ? "text-primary" : ""}`}
          title={t("graph.settings")}
        >
          <Settings2 className="w-5 h-5" />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute bottom-6 right-20 w-64 bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">{t("graph.graphSettings")}</span>
            <button
              onClick={() => setShowSettings(false)}
              className="p-1 hover:bg-muted rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localShowLabels}
                onChange={(e) => setLocalShowLabels(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">{t("graph.showLabels")}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={physicsEnabled}
                onChange={(e) => setPhysicsEnabled(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">{t("graph.physicsSimulation")}</span>
            </label>

            <div>
              <span className="text-sm text-muted-foreground">{t("graph.linkDistance")}</span>
              <input
                type="range"
                min="50"
                max="300"
                value={linkDistance}
                onChange={(e) => setLinkDistance(Number(e.target.value))}
                className="w-full mt-1"
              />
            </div>

            <div>
              <span className="text-sm text-muted-foreground">{t("graph.repelForce")}</span>
              <input
                type="range"
                min="100"
                max="1000"
                value={repelForce}
                onChange={(e) => setRepelForce(Number(e.target.value))}
                className="w-full mt-1"
              />
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="absolute top-6 left-6 bg-card/80 backdrop-blur border border-border rounded-xl shadow-lg px-4 py-2">
        <div className="text-xs text-muted-foreground">
          {t("graph.nodesAndLinks", { nodes: data.nodes.length, links: data.edges.length })}
        </div>
        <div className="text-xs text-muted-foreground">
          {t("graph.zoomPercent", { count: Math.round(transform.k * 100) })}
        </div>
      </div>
    </div>
  );
});

// ── Grid drawing ─────────────────────────────────────────────────

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  transform: { x: number; y: number; k: number },
  theme: { colors: { surfaceVariant: string; border: string } },
) {
  const gridSize = 50 * transform.k;
  const offsetX = transform.x % gridSize;
  const offsetY = transform.y % gridSize;

  ctx.strokeStyle = theme.colors.border + "20";
  ctx.lineWidth = 1;

  for (let x = offsetX; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = offsetY; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}
