/**
 * Modern Graph Filters Component
 * Beautiful filtering and controls for the knowledge graph
 */

import { useState, useCallback } from "react";
import {
  Search,
  Filter,
  X,
  ChevronDown,
  LayoutGrid,
  Circle,
  Tags,
  SlidersHorizontal,
  Eye,
  EyeOff,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import {
  GraphNode,
  GraphEdge,
  GraphNodeType,
  LayoutAlgorithm,
} from "./KnowledgeGraph";

export interface GraphFilters {
  searchQuery: string;
  nodeTypes: GraphNodeType[];
  categories: string[];
  tags: string[];
  minConnections?: number;
  maxConnections?: number;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface GraphFilterControlsProps {
  filters: GraphFilters;
  onFiltersChange: (filters: GraphFilters) => void;
  availableCategories: string[];
  availableTags: string[];
  layout: LayoutAlgorithm;
  onLayoutChange: (layout: LayoutAlgorithm) => void;
  nodeCounts: Record<GraphNodeType, number>;
  linkDistance?: number;
  onLinkDistanceChange?: (value: number) => void;
  nodeScale?: number;
  onNodeScaleChange?: (value: number) => void;
}

const NODE_TYPE_CONFIG = {
  [GraphNodeType.Document]: {
    labelKey: "graph.documents",
    color: "bg-blue-500",
    borderColor: "border-blue-500",
    textColor: "text-blue-500",
    icon: "📄",
  },
  [GraphNodeType.Extract]: {
    labelKey: "graph.extracts",
    color: "bg-green-500",
    borderColor: "border-green-500",
    textColor: "text-green-500",
    icon: "💬",
  },
  [GraphNodeType.Flashcard]: {
    labelKey: "graph.flashcards",
    color: "bg-purple-500",
    borderColor: "border-purple-500",
    textColor: "text-purple-500",
    icon: "🧠",
  },
  [GraphNodeType.Category]: {
    labelKey: "graph.categories",
    color: "bg-amber-500",
    borderColor: "border-amber-500",
    textColor: "text-amber-500",
    icon: "📁",
  },
  [GraphNodeType.Tag]: {
    labelKey: "graph.tags",
    color: "bg-cyan-500",
    borderColor: "border-cyan-500",
    textColor: "text-cyan-500",
    icon: "🏷️",
  },
  [GraphNodeType.Rss]: {
    labelKey: "graph.rss",
    color: "bg-orange-500",
    borderColor: "border-orange-500",
    textColor: "text-orange-500",
    icon: "📡",
  },
};

export function GraphFilterControls({
  filters,
  onFiltersChange,
  availableCategories,
  availableTags,
  layout,
  onLayoutChange,
  nodeCounts,
  linkDistance,
  onLinkDistanceChange,
  nodeScale,
  onNodeScaleChange,
}: GraphFilterControlsProps) {
  const { t } = useI18n();
  const [activeSection, setActiveSection] = useState<string | null>("types");
  const [isExpanded, setIsExpanded] = useState(true);

  const updateSearchQuery = useCallback((query: string) => {
    onFiltersChange({ ...filters, searchQuery: query });
  }, [filters, onFiltersChange]);

  const toggleNodeType = useCallback((type: GraphNodeType) => {
    const newTypes = filters.nodeTypes.includes(type)
      ? filters.nodeTypes.filter((t) => t !== type)
      : [...filters.nodeTypes, type];
    onFiltersChange({ ...filters, nodeTypes: newTypes });
  }, [filters, onFiltersChange]);

  const toggleCategory = useCallback((category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter((c) => c !== category)
      : [...filters.categories, category];
    onFiltersChange({ ...filters, categories: newCategories });
  }, [filters, onFiltersChange]);

  const toggleTag = useCallback((tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter((t) => t !== tag)
      : [...filters.tags, tag];
    onFiltersChange({ ...filters, tags: newTags });
  }, [filters, onFiltersChange]);

  const selectAllTypes = useCallback(() => {
    onFiltersChange({ ...filters, nodeTypes: [] });
  }, [filters, onFiltersChange]);

  const clearAllTypes = useCallback(() => {
    onFiltersChange({ ...filters, nodeTypes: Object.values(GraphNodeType) });
  }, [filters, onFiltersChange]);

  const clearAll = useCallback(() => {
    onFiltersChange({
      searchQuery: "",
      nodeTypes: [],
      categories: [],
      tags: [],
    });
  }, [onFiltersChange]);

  const hasActiveFilters =
    filters.searchQuery ||
    filters.nodeTypes.length > 0 ||
    filters.categories.length > 0 ||
    filters.tags.length > 0;

  const activeFiltersCount =
    (filters.searchQuery ? 1 : 0) +
    filters.nodeTypes.length +
    filters.categories.length +
    filters.tags.length;

  return (
    <div className="flex flex-col h-full bg-card/95 backdrop-blur-xl border-r border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Filter className="w-4 h-4 text-primary" />
          </div>
          <div>
            <span className="font-semibold text-sm">{t("graph.filters")}</span>
            {activeFiltersCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              title={t("graph.clearAllFilters")}
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform ${isExpanded ? "" : "-rotate-90"}`}
            />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="flex-1 overflow-y-auto">
          {/* Search */}
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={filters.searchQuery}
                onChange={(e) => updateSearchQuery(e.target.value)}
                placeholder={t("graph.searchKnowledge")}
                className="w-full pl-10 pr-9 py-2.5 bg-muted border-0 rounded-xl text-sm focus:ring-2 focus:ring-primary/50 focus:bg-card transition-all"
              />
              {filters.searchQuery && (
                <button
                  onClick={() => updateSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Node Types */}
          <div className="border-b border-border">
            <button
              onClick={() => setActiveSection(activeSection === "types" ? null : "types")}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">{t("graph.nodeTypes")}</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform ${activeSection === "types" ? "" : "-rotate-90"}`}
              />
            </button>

            {activeSection === "types" && (
              <div className="px-4 pb-4">
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={selectAllTypes}
                    className="text-xs px-2 py-1 bg-muted hover:bg-muted/80 rounded-md transition-colors"
                  >
                    {t("graph.selectAll")}
                  </button>
                  <button
                    onClick={clearAllTypes}
                    className="text-xs px-2 py-1 bg-muted hover:bg-muted/80 rounded-md transition-colors"
                  >
                    {t("graph.clearAll")}
                  </button>
                </div>

                <div className="space-y-1">
                  {Object.values(GraphNodeType).map((type) => {
                    const config = NODE_TYPE_CONFIG[type];
                    const isSelected = !filters.nodeTypes.includes(type);
                    const count = nodeCounts[type] || 0;

                    return (
                      <button
                        key={type}
                        onClick={() => toggleNodeType(type)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all ${
                          isSelected
                            ? "bg-card border border-border shadow-sm"
                            : "hover:bg-muted/50 opacity-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center text-sm ${
                              isSelected ? config.color : "bg-muted"
                            }`}
                          >
                            {config.icon}
                          </div>
                          <span className="text-sm">{t(config.labelKey)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{count}</span>
                          {isSelected ? (
                            <Eye className="w-4 h-4 text-primary" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Layout */}
          <div className="border-b border-border">
            <button
              onClick={() => setActiveSection(activeSection === "layout" ? null : "layout")}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">{t("graph.layout")}</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform ${activeSection === "layout" ? "" : "-rotate-90"}`}
              />
            </button>

            {activeSection === "layout" && (
              <div className="px-4 pb-4">
                <select
                  value={layout}
                  onChange={(e) => onLayoutChange(e.target.value as LayoutAlgorithm)}
                  className="w-full px-3 py-2.5 bg-muted border-0 rounded-xl text-sm focus:ring-2 focus:ring-primary/50 transition-all"
                >
                  <option value={LayoutAlgorithm.Force}>{t("graph.layoutForceDirected")}</option>
                  <option value={LayoutAlgorithm.Circular}>{t("graph.layoutCircular")}</option>
                  <option value={LayoutAlgorithm.Hierarchical}>{t("graph.layoutHierarchical")}</option>
                  <option value={LayoutAlgorithm.Grid}>{t("graph.layoutGrid")}</option>
                </select>

                <div className="mt-4 space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{t("graph.nodeSize")}</span>
                      <span className="font-medium">{nodeScale !== undefined ? `${Math.round(nodeScale * 100)}%` : t("graph.auto")}</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.1"
                      value={nodeScale ?? 1}
                      onChange={(e) => onNodeScaleChange?.(Number(e.target.value))}
                      className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{t("graph.linkDistance")}</span>
                      <span className="font-medium">{linkDistance ?? 120}px</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="300"
                      value={linkDistance ?? 120}
                      onChange={(e) => onLinkDistanceChange?.(Number(e.target.value))}
                      className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Categories */}
          {availableCategories.length > 0 && (
            <div className="border-b border-border">
              <button
                onClick={() => setActiveSection(activeSection === "categories" ? null : "categories")}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Circle className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{t("graph.categories")}</span>
                  {filters.categories.length > 0 && (
                    <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded-md">
                      {filters.categories.length}
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform ${activeSection === "categories" ? "" : "-rotate-90"}`}
                />
              </button>

              {activeSection === "categories" && (
                <div className="px-4 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {availableCategories.map((category) => {
                      const isSelected = filters.categories.includes(category);
                      return (
                        <button
                          key={category}
                          onClick={() => toggleCategory(category)}
                          className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {category}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          {availableTags.length > 0 && (
            <div className="border-b border-border">
              <button
                onClick={() => setActiveSection(activeSection === "tags" ? null : "tags")}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Tags className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{t("graph.tags")}</span>
                  {filters.tags.length > 0 && (
                    <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded-md">
                      {filters.tags.length}
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform ${activeSection === "tags" ? "" : "-rotate-90"}`}
                />
              </button>

              {activeSection === "tags" && (
                <div className="px-4 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map((tag) => {
                      const isSelected = filters.tags.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                            isSelected
                              ? "bg-accent text-accent-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          #{tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer stats */}
      <div className="px-4 py-3 border-t border-border bg-muted/30">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("graph.totalNodes")}</span>
          <span className="font-medium text-foreground">
            {Object.values(nodeCounts).reduce((a, b) => a + b, 0)}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Apply filters to graph data
 */
export function applyGraphFilters(
  nodes: GraphNode[],
  edges: GraphEdge[],
  filters: GraphFilters
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  let filteredNodes = [...nodes];

  // Filter by search query
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    filteredNodes = filteredNodes.filter(
      (node) =>
        node.label.toLowerCase().includes(query) ||
        node.description?.toLowerCase().includes(query) ||
        node.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  }

  // Filter by node types (inverted - we show types NOT in the filter list)
  if (filters.nodeTypes.length > 0) {
    filteredNodes = filteredNodes.filter(
      (node) => !filters.nodeTypes.includes(node.type)
    );
  }

  // Filter by categories
  if (filters.categories.length > 0) {
    filteredNodes = filteredNodes.filter(
      (node) => node.category && filters.categories.includes(node.category)
    );
  }

  // Filter by tags
  if (filters.tags.length > 0) {
    filteredNodes = filteredNodes.filter((node) =>
      node.tags?.some((tag) => filters.tags.includes(tag))
    );
  }

  // Filter by connections
  if (filters.minConnections !== undefined || filters.maxConnections !== undefined) {
    filteredNodes = filteredNodes.filter((node) => {
      const connectionCount = edges.filter(
        (edge) => edge.source === node.id || edge.target === node.id
      ).length;

      if (filters.minConnections !== undefined && connectionCount < filters.minConnections) {
        return false;
      }
      if (filters.maxConnections !== undefined && connectionCount > filters.maxConnections) {
        return false;
      }
      return true;
    });
  }

  // Filter edges to only include connections between filtered nodes
  const nodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = edges.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
  );

  return { nodes: filteredNodes, edges: filteredEdges };
}

/**
 * Extract available categories and tags from nodes
 */
export function extractGraphMetadata(nodes: GraphNode[]): {
  categories: string[];
  tags: string[];
} {
  const categories = new Set<string>();
  const tags = new Set<string>();

  nodes.forEach((node) => {
    if (node.category) {
      categories.add(node.category);
    }
    node.tags?.forEach((tag) => tags.add(tag));
  });

  return {
    categories: Array.from(categories).sort(),
    tags: Array.from(tags).sort(),
  };
}

/**
 * Calculate graph statistics
 */
export function calculateGraphStatistics(
  nodes: GraphNode[],
  edges: GraphEdge[]
): {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<GraphNodeType, number>;
  averageConnections: number;
  isolatedNodes: number;
} {
  const nodesByType: Record<GraphNodeType, number> = {
    [GraphNodeType.Document]: 0,
    [GraphNodeType.Extract]: 0,
    [GraphNodeType.Flashcard]: 0,
    [GraphNodeType.Category]: 0,
    [GraphNodeType.Tag]: 0,
    [GraphNodeType.Rss]: 0,
  };

  nodes.forEach((node) => {
    nodesByType[node.type]++;
  });

  const connectionCounts = new Map<string, number>();
  nodes.forEach((node) => connectionCounts.set(node.id, 0));

  edges.forEach((edge) => {
    connectionCounts.set(edge.source, (connectionCounts.get(edge.source) || 0) + 1);
    connectionCounts.set(edge.target, (connectionCounts.get(edge.target) || 0) + 1);
  });

  const totalConnections = Array.from(connectionCounts.values()).reduce((a, b) => a + b, 0);
  const averageConnections = nodes.length > 0 ? totalConnections / nodes.length : 0;

  const isolatedNodes = Array.from(connectionCounts.values()).filter((c) => c === 0).length;

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    nodesByType,
    averageConnections,
    isolatedNodes,
  };
}
