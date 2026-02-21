/**
 * Obsidian-inspired Knowledge Graph
 * Beautiful, interactive 2D/3D graph visualization
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { GraphNodeType, type GraphNode, type GraphData } from "./KnowledgeGraph";
import {
  FileText,
  Quote,
  BrainCircuit,
  Tag,
  Folder,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Settings2,
} from "lucide-react";

export interface ObsidianGraphProps {
  data: GraphData;
  onNodeClick?: (node: GraphNode) => void;
  onNodeDoubleClick?: (node: GraphNode) => void;
  selectedNode?: string;
  highlightedNodes?: string[];
  enablePhysics?: boolean;
  showLabels?: boolean;
}

interface SimulationNode extends GraphNode {
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
}

// Node type configuration
const NODE_CONFIG = {
  [GraphNodeType.Document]: {
    icon: FileText,
    size: 24,
    color: "#3b82f6",
    label: "Document",
  },
  [GraphNodeType.Extract]: {
    icon: Quote,
    size: 16,
    color: "#22c55e",
    label: "Extract",
  },
  [GraphNodeType.Flashcard]: {
    icon: BrainCircuit,
    size: 12,
    color: "#a855f7",
    label: "Flashcard",
  },
  [GraphNodeType.Category]: {
    icon: Folder,
    size: 20,
    color: "#f59e0b",
    label: "Category",
  },
  [GraphNodeType.Tag]: {
    icon: Tag,
    size: 14,
    color: "#06b6d4",
    label: "Tag",
  },
};

// Edge type configuration
const EDGE_CONFIG = {
  reference: { color: "#3b82f6", width: 2, dash: [] as number[] },
  contains: { color: "#64748b", width: 1.5, dash: [5, 5] },
  related: { color: "#22c55e", width: 1, dash: [] as number[] },
  derived: { color: "#a855f7", width: 2, dash: [] as number[] },
  tagged: { color: "#06b6d4", width: 1, dash: [2, 4] },
};

export function ObsidianGraph({
  data,
  onNodeClick,
  onNodeDoubleClick,
  selectedNode,
  highlightedNodes = [],
  enablePhysics = true,
  showLabels = true,
}: ObsidianGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [physicsEnabled, setPhysicsEnabled] = useState(enablePhysics);
  const [showSettings, setShowSettings] = useState(false);
  const [localShowLabels, setLocalShowLabels] = useState(showLabels);
  const [linkDistance, setLinkDistance] = useState(120);
  const [repelForce, setRepelForce] = useState(300);

  // Initialize simulation nodes with random positions
  const simulationNodes = useMemo<SimulationNode[]>(() => {
    const width = canvasRef.current?.width || 800;
    const height = canvasRef.current?.height || 600;
    return data.nodes.map((node) => ({
      ...node,
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height / 2 + (Math.random() - 0.5) * 200,
      vx: 0,
      vy: 0,
    }));
  }, [data.nodes]);

  // Physics simulation
  useEffect(() => {
    if (!physicsEnabled) return;

    let animationId: number;
    let temperature = 1;

    const simulate = () => {
      if (temperature < 0.001) {
        setPhysicsEnabled(false);
        return;
      }

      const nodes = simulationNodes;
      const edges = data.edges;
      const width = canvasRef.current?.width || 800;
      const height = canvasRef.current?.height || 600;

      // Apply forces
      nodes.forEach((node) => {
        if (node.fx !== null && node.fy !== null) return;

        let fx = 0;
        let fy = 0;

        // Repulsion (Coulomb's law approximation)
        nodes.forEach((other) => {
          if (node === other) return;
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = repelForce / (dist * dist);
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        });

        // Attraction along edges (Hooke's law)
        edges.forEach((edge) => {
          const source = nodes.find((n) => n.id === edge.source);
          const target = nodes.find((n) => n.id === edge.target);
          if (!source || !target) return;

          if (source === node || target === node) {
            const other = source === node ? target : source;
            const dx = other.x - node.x;
            const dy = other.y - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = (dist - linkDistance) * 0.03;
            fx += (dx / dist) * force;
            fy += (dy / dist) * force;
          }
        });

        // Center gravity
        const centerX = width / 2;
        const centerY = height / 2;
        fx += (centerX - node.x) * 0.005;
        fy += (centerY - node.y) * 0.005;

        // Update velocity and position with damping
        node.vx = (node.vx + fx) * 0.8;
        node.vy = (node.vy + fy) * 0.8;
        node.x += node.vx * temperature;
        node.y += node.vy * temperature;
      });

      temperature *= 0.99;
      animationId = requestAnimationFrame(simulate);
    };

    simulate();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [simulationNodes, data.edges, physicsEnabled, linkDistance, repelForce]);

  // Draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;

    // Clear with fade effect for motion blur
    ctx.fillStyle = theme.colors.background;
    ctx.fillRect(0, 0, width, height);

    // Draw grid background
    drawGrid(ctx, width, height, transform, theme);

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    // Draw edges
    data.edges.forEach((edge) => {
      const source = simulationNodes.find((n) => n.id === edge.source);
      const target = simulationNodes.find((n) => n.id === edge.target);
      if (!source || !target) return;

      const config = EDGE_CONFIG[edge.type || "related"];
      const isHighlighted = selectedNode && (edge.source === selectedNode || edge.target === selectedNode);
      const isDimmed = selectedNode && !isHighlighted;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);

      // Curved edges for better aesthetics
      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2;
      const curvature = 20;
      ctx.quadraticCurveTo(midX + curvature, midY - curvature, target.x, target.y);

      ctx.strokeStyle = isHighlighted ? config.color : config.color + (isDimmed ? "20" : "60");
      ctx.lineWidth = isHighlighted ? config.width * 1.5 : config.width;
      ctx.setLineDash(config.dash);
      ctx.stroke();
      ctx.setLineDash([]);

      // Edge label
      if (localShowLabels && edge.label && transform.k > 0.7) {
        ctx.fillStyle = theme.colors.textSecondary;
        ctx.font = `10px ${theme.typography.fontFamily}`;
        ctx.textAlign = "center";
        ctx.fillText(edge.label, midX, midY - 5);
      }
    });

    // Draw nodes
    simulationNodes.forEach((node) => {
      const config = NODE_CONFIG[node.type];
      const isSelected = selectedNode === node.id;
      const isHovered = hoveredNode === node.id;
      const isHighlighted = highlightedNodes.includes(node.id);
      const isDimmed = selectedNode && !isSelected && !isHighlighted;

      const radius = config.size * (isSelected ? 1.3 : isHovered ? 1.2 : 1);
      const opacity = isDimmed ? 0.2 : 1;

      // Glow effect for selected/hovered nodes
      if (isSelected || isHovered) {
        const gradient = ctx.createRadialGradient(
          node.x, node.y, 0,
          node.x, node.y, radius * 2.5
        );
        gradient.addColorStop(0, config.color + "40");
        gradient.addColorStop(1, config.color + "00");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Node shadow
      ctx.beginPath();
      ctx.arc(node.x + 2, node.y + 2, radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fill();

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = config.color;
      ctx.globalAlpha = opacity;
      ctx.fill();

      // Inner highlight
      const gradient = ctx.createRadialGradient(
        node.x - radius * 0.3, node.y - radius * 0.3, 0,
        node.x, node.y, radius
      );
      gradient.addColorStop(0, "rgba(255,255,255,0.3)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fill();

      // Border for selected nodes
      if (isSelected) {
        ctx.strokeStyle = theme.colors.onBackground;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      // Icon
      if (transform.k > 0.6 || isSelected) {
        ctx.fillStyle = "#ffffff";
        ctx.font = `${radius}px ${theme.typography.fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        // Simple icon representation using text
        const iconChar = node.type === GraphNodeType.Document ? "📄" :
                        node.type === GraphNodeType.Extract ? "💬" :
                        node.type === GraphNodeType.Flashcard ? "🧠" :
                        node.type === GraphNodeType.Category ? "📁" : "🏷️";
        ctx.fillText(iconChar, node.x, node.y);
      }

      // Label
      if (localShowLabels || isSelected || isHovered) {
        ctx.fillStyle = isSelected ? theme.colors.onBackground : theme.colors.textSecondary;
        ctx.font = `${isSelected || isHovered ? "bold " : ""}12px ${theme.typography.fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.globalAlpha = opacity;
        
        // Truncate long labels
        let label = node.label;
        if (label.length > 25) label = label.substring(0, 22) + "...";
        
        ctx.fillText(label, node.x, node.y + radius + 8);
        ctx.globalAlpha = 1;
      }
    });

    ctx.restore();
  }, [simulationNodes, data.edges, transform, theme, selectedNode, highlightedNodes, hoveredNode, localShowLabels]);

  // Animation loop
  useEffect(() => {
    let animationId: number;

    const animate = () => {
      draw();
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [draw]);

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

  // Mouse handlers
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
      // Check for node hover
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = (e.clientX - rect.left - transform.x) / transform.k;
      const y = (e.clientY - rect.top - transform.y) / transform.k;

      let hovered: string | null = null;
      for (const node of simulationNodes) {
        const config = NODE_CONFIG[node.type];
        const dx = x - node.x;
        const dy = y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= config.size + 5) {
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
    if (hoveredNode && onNodeClick) {
      const node = simulationNodes.find((n) => n.id === hoveredNode);
      if (node) onNodeClick(node);
    }
  };

  const handleDoubleClick = () => {
    if (hoveredNode && onNodeDoubleClick) {
      const node = simulationNodes.find((n) => n.id === hoveredNode);
      if (node) onNodeDoubleClick(node);
    }
  };

  const fitToView = () => {
    if (simulationNodes.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    simulationNodes.forEach((node) => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x);
      maxY = Math.max(maxY, node.y);
    });

    const padding = 100;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    const scaleX = canvas.width / width;
    const scaleY = canvas.height / height;
    const newK = Math.min(scaleX, scaleY, 2);

    const newX = (canvas.width - (maxX + minX) * newK) / 2;
    const newY = (canvas.height - (maxY + minY) * newK) / 2;

    setTransform({ x: newX, y: newY, k: newK });
  };

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

      {/* Floating Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2">
        <button
          onClick={fitToView}
          className="w-10 h-10 flex items-center justify-center bg-card/90 backdrop-blur border border-border rounded-xl shadow-lg hover:bg-muted transition-all hover:scale-105"
          title="Fit to view"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
        <button
          onClick={() => setTransform((t) => ({ ...t, k: Math.min(5, t.k * 1.2) }))}
          className="w-10 h-10 flex items-center justify-center bg-card/90 backdrop-blur border border-border rounded-xl shadow-lg hover:bg-muted transition-all hover:scale-105"
          title="Zoom in"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={() => setTransform((t) => ({ ...t, k: Math.max(0.1, t.k * 0.8) }))}
          className="w-10 h-10 flex items-center justify-center bg-card/90 backdrop-blur border border-border rounded-xl shadow-lg hover:bg-muted transition-all hover:scale-105"
          title="Zoom out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`w-10 h-10 flex items-center justify-center bg-card/90 backdrop-blur border border-border rounded-xl shadow-lg hover:bg-muted transition-all hover:scale-105 ${showSettings ? "text-primary" : ""}`}
          title="Settings"
        >
          <Settings2 className="w-5 h-5" />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute bottom-6 right-20 w-64 bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Graph Settings</span>
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
              <span className="text-sm">Show labels</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={physicsEnabled}
                onChange={(e) => setPhysicsEnabled(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Physics simulation</span>
            </label>

            <div>
              <span className="text-sm text-muted-foreground">Link distance</span>
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
              <span className="text-sm text-muted-foreground">Repel force</span>
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
          {data.nodes.length} nodes · {data.edges.length} links
        </div>
        <div className="text-xs text-muted-foreground">
          Zoom: {Math.round(transform.k * 100)}%
        </div>
      </div>
    </div>
  );
}

// Draw grid background
function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  transform: { x: number; y: number; k: number },
  theme: { colors: { surfaceVariant: string; border: string } }
) {
  const gridSize = 50 * transform.k;
  const offsetX = transform.x % gridSize;
  const offsetY = transform.y % gridSize;

  ctx.strokeStyle = theme.colors.border + "20";
  ctx.lineWidth = 1;

  // Vertical lines
  for (let x = offsetX; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = offsetY; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}
