import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  ArrowCounterClockwise,
  Download,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Plus,
} from "@phosphor-icons/react";

export interface MindMapNode {
  id: string;
  text: string;
  children?: MindMapNode[];
  level?: number;
}

interface MindMapViewerProps {
  data: MindMapNode;
  onAddToQueue?: (nodes: MindMapNode[]) => void;
  title?: string;
}

export function MindMapViewer({ data, onAddToQueue, title }: MindMapViewerProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setScale((s) => Math.min(s * 1.2, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s / 1.2, 0.3));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === containerRef.current || (e.target as HTMLElement).closest(".mindmap-canvas")) {
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      }
    },
    [position]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mouseup", handleMouseUp);
      return () => window.removeEventListener("mouseup", handleMouseUp);
    }
  }, [isDragging, handleMouseUp]);

  const toggleNodeSelection = (nodeId: string) => {
    const next = new Set(selectedNodes);
    if (next.has(nodeId)) {
      next.delete(nodeId);
    } else {
      next.add(nodeId);
    }
    setSelectedNodes(next);
  };

  const renderNode = (
    node: MindMapNode,
    x: number,
    y: number,
    level: number = 0
  ): React.JSX.Element => {
    const nodeWidth = Math.max(120, node.text.length * 8 + 20);
    const nodeHeight = 40;
    const verticalSpacing = 60;
    const horizontalSpacing = 200;

    const isSelected = selectedNodes.has(node.id);
    const colors = [
      "bg-emerald-500",
      "bg-blue-500",
      "bg-purple-500",
      "bg-amber-500",
      "bg-pink-500",
      "bg-cyan-500",
    ];
    const bgColor = colors[level % colors.length];

    let childElements: React.JSX.Element[] = [];
    let childY = y - ((node.children?.length || 0) * verticalSpacing) / 2;

    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        const childX = x + horizontalSpacing;
        childElements.push(
          <g key={`line-${child.id}`}>
            <line
              x1={x + nodeWidth}
              y1={y + nodeHeight / 2}
              x2={childX}
              y2={childY + nodeHeight / 2}
              stroke="#94a3b8"
              strokeWidth={2}
              opacity={0.5}
            />
          </g>
        );
        childElements.push(renderNode(child, childX, childY, level + 1));
        childY += verticalSpacing;
      });
    }

    return (
      <g key={node.id} className="mindmap-node">
        <foreignObject
          x={x}
          y={y}
          width={nodeWidth}
          height={nodeHeight}
          onClick={(e) => {
            e.stopPropagation();
            toggleNodeSelection(node.id);
          }}
          className="cursor-pointer"
        >
          <div
            className={`
              w-full h-full rounded-lg shadow-md flex items-center justify-center px-3
              text-white text-sm font-medium text-center
              transition-all duration-200 hover:shadow-lg
              ${bgColor}
              ${isSelected ? "ring-2 ring-white ring-offset-2 ring-offset-background" : ""}
            `}
            title={node.text}
          >
            <span className="truncate">{node.text}</span>
          </div>
        </foreignObject>
        {childElements}
      </g>
    );
  };

  const extractAllNodes = (node: MindMapNode): MindMapNode[] => {
    const nodes = [node];
    if (node.children) {
      node.children.forEach((child) => {
        nodes.push(...extractAllNodes(child));
      });
    }
    return nodes;
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mindmap-${title || "export"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleAddSelectedToQueue = () => {
    if (!onAddToQueue || selectedNodes.size === 0) return;
    const allNodes = extractAllNodes(data);
    const selected = allNodes.filter((n) => selectedNodes.has(n.id));
    onAddToQueue(selected);
    setSelectedNodes(new Set());
  };

  const allNodes = extractAllNodes(data);
  const canvasWidth = 2000;
  const canvasHeight = 1500;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {title || "Mind Map"}
          </span>
          <span className="text-xs text-muted-foreground">
            ({allNodes.length} nodes)
          </span>
          {selectedNodes.size > 0 && (
            <span className="text-xs text-primary">
              • {selectedNodes.size} selected
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            title="Zoom out"
          >
            <MagnifyingGlassMinus className="w-4 h-4" />
          </button>
          <span className="text-sm text-muted-foreground min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            title="Zoom in"
          >
            <MagnifyingGlassPlus className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-border mx-2" />
          <button
            onClick={handleReset}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            title="Reset view"
          >
            <ArrowCounterClockwise className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportJSON}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            title="Export JSON"
          >
            <Download className="w-4 h-4" />
          </button>
          {onAddToQueue && selectedNodes.size > 0 && (
            <>
              <div className="w-px h-6 bg-border mx-2" />
              <button
                onClick={handleAddSelectedToQueue}
                className="px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add {selectedNodes.size} to Queue
              </button>
            </>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing mindmap-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        role="application"
        aria-label="Mind map canvas"
      >
        <svg
          width={canvasWidth}
          height={canvasHeight}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: "0 0",
          }}
          className="mindmap-svg"
        >
          <g transform={`translate(100, ${canvasHeight / 2})`}>
            {renderNode(data, 0, 0, 0)}
          </g>
        </svg>
      </div>

      {/* Instructions */}
      <div className="px-4 py-2 border-t border-border bg-muted/50 text-xs text-muted-foreground">
        Drag to pan • Scroll to zoom • Click nodes to select • Click "Add to Queue" to create review items
      </div>
    </div>
  );
}

// Simple mind map parser from various formats
export function parseMindMapData(raw: unknown): MindMapNode | null {
  if (!raw) return null;

  const rawAny = raw as any;

  // If already in our format
  if (rawAny.id && rawAny.text) {
    return rawAny as MindMapNode;
  }

  // If it's a NotebookLM mindmap format
  if (rawAny.nodes && Array.isArray(rawAny.nodes)) {
    const buildTree = (nodeId: string): MindMapNode => {
      const node = rawAny.nodes.find((n: any) => n.id === nodeId);
      if (!node) return { id: nodeId, text: "Unknown" };

      const children = rawAny.edges
        ?.filter((e: any) => e.source === nodeId)
        .map((e: any) => buildTree(e.target));

      return {
        id: nodeId,
        text: node.label || node.text || node.name || "Untitled",
        children: children?.length > 0 ? children : undefined,
      };
    };

    const rootNode = (rawAny.nodes as Array<Record<string, unknown>>).find((n) => n.type === "root" || n.isRoot);
    if (rootNode) {
      return buildTree(rootNode.id as string);
    }
  }

  if (rawAny.name || rawAny.title || rawAny.topic) {
    const parseNode = (obj: any): MindMapNode => ({
      id: obj.id || Math.random().toString(36).slice(2),
      text: obj.name || obj.title || obj.topic || obj.text || "Untitled",
      children: obj.children?.map(parseNode),
    });
    return parseNode(rawAny);
  }

  return null;
}
