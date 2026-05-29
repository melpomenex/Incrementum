import React, { useState, useMemo, useCallback, useEffect } from "react";
import { X, Sliders, Sparkles, Play, Layers, Network, Info, Loader2 } from "lucide-react";
import { ObsidianGraph } from "../graph/ObsidianGraph";
import { GraphNodeType, type GraphNode, type GraphEdge } from "../graph/KnowledgeGraph";
import { buildSemanticGraph as buildSemanticGraphFromEngine, type EmbeddingStatus } from "../../utils/semanticEngine";
import { calculateItemSimilarity } from "../../utils/semanticRelations";
import type { QueueItem } from "../../types/queue";
import { cn } from "../../utils";
import type { EmbeddingConfig } from "../../utils/semanticEngine";
import { getUnreadItems } from "../../api/rss";

interface SemanticGraphPanelProps {
  isOpen: boolean;
  onClose: () => void;
  items: QueueItem[];
  focalTopic?: string;
  onStartSessionWithFilter: (filteredItems: QueueItem[]) => void;
  embeddingConfig?: EmbeddingConfig;
}

export function SemanticGraphPanel({
  isOpen,
  onClose,
  items,
  focalTopic = "",
  onStartSessionWithFilter,
  embeddingConfig,
}: SemanticGraphPanelProps) {
  const [threshold, setThreshold] = useState(30); // 30% default relatedness threshold
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });
  const [embeddingStatus, setEmbeddingStatus] = useState<EmbeddingStatus>("idle");
  const [includeRss, setIncludeRss] = useState(false);

  // Build the semantic graph asynchronously
  useEffect(() => {
    if (!isOpen) {
      setGraphData({ nodes: [], edges: [] });
      return;
    }

    let cancelled = false;
    setEmbeddingStatus("idle");

    const activeRssItems = includeRss ? getUnreadItems().map(x => x.item) : [];

    buildSemanticGraphFromEngine(
      items,
      threshold,
      focalTopic,
      embeddingConfig,
      (status) => {
        if (!cancelled) setEmbeddingStatus(status);
      },
      activeRssItems,
    ).then((result) => {
      if (!cancelled) setGraphData(result);
    });

    return () => { cancelled = true; };
  }, [items, threshold, focalTopic, isOpen, embeddingConfig, includeRss]);

  // Find the selected node details
  const selectedNodeDetails = useMemo(() => {
    if (!isOpen || !selectedNodeId) return null;
    const node = graphData.nodes.find((n) => n.id === selectedNodeId);
    if (!node) return null;

    const originalItem = node.metadata?.originalItem as QueueItem;
    if (!originalItem) return null;

    // Find other related nodes from graph edges
    const relatedItems: { item: QueueItem; score: number }[] = [];
    const connectedEdges = graphData.edges.filter(
      (e) => e.source === selectedNodeId || e.target === selectedNodeId
    );

    connectedEdges.forEach((edge) => {
      const neighborId = edge.source === selectedNodeId ? edge.target : edge.source;
      const neighborNode = graphData.nodes.find((n) => n.id === neighborId);
      const neighborItem = neighborNode?.metadata?.originalItem as QueueItem;
      if (neighborItem) {
        relatedItems.push({ item: neighborItem, score: edge.weight || 0 });
      }
    });

    // Sort by similarity descending
    relatedItems.sort((a, b) => b.score - a.score);

    return {
      node,
      originalItem,
      relatedItems,
    };
  }, [selectedNodeId, graphData.nodes, threshold, isOpen]);

  // Handle clicking a node
  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNodeId(node.id);
  }, []);

  // Study starting from this cluster
  const handleStudyCluster = () => {
    if (!selectedNodeDetails) return;
    const clusterItems = [
      selectedNodeDetails.originalItem,
      ...selectedNodeDetails.relatedItems.map((r) => r.item),
    ];
    onStartSessionWithFilter(clusterItems);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-md transition-all duration-300 pointer-events-auto">
      {/* Dynamic Visual Graph Canvas */}
      <div className="flex-1 h-full relative flex flex-col bg-cream/90 dark:bg-zinc-950/95 overflow-hidden">
        {/* Header bar */}
        <div className="h-16 px-6 border-b border-border bg-card/60 backdrop-blur-md flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-400/10 border border-blue-500/20 flex items-center justify-center">
              <Network className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Semantic Relationship Graph</h2>
              <p className="text-xs text-muted-foreground">
                {embeddingStatus === "embedding" ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Generating embeddings...
                  </span>
                ) : (
                  <>
                    Showing {graphData.nodes.length} items & {graphData.edges.length} connections
                    {focalTopic && ` matching "${focalTopic}"`}
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Include RSS items Toggle */}
            <label className="flex items-center gap-2.5 px-3 py-2 bg-muted/60 dark:bg-zinc-900/60 border border-border/80 rounded-xl shadow-sm cursor-pointer hover:bg-muted dark:hover:bg-zinc-900 transition-all duration-200 select-none">
              <input
                type="checkbox"
                checked={includeRss}
                onChange={(e) => setIncludeRss(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-zinc-700 text-orange-600 dark:text-orange-500 focus:ring-orange-500 cursor-pointer accent-orange-600 dark:accent-orange-500"
              />
              <span className="text-xs font-semibold text-foreground">Include RSS Items</span>
            </label>

            {/* Sliding Scale Controller */}
            <div className="flex items-center gap-3 px-4 py-2 bg-muted/60 dark:bg-zinc-900/60 border border-border/80 rounded-xl shadow-sm">
              <Sliders className="w-4 h-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Strictness Threshold</span>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="5"
                    max="90"
                    step="5"
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-32 h-1 bg-border rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-blue-500"
                  />
                  <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 min-w-[32px]">
                    {threshold}%
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-card border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Graph Display Area */}
        <div className="flex-1 relative overflow-hidden">
          {graphData.nodes.length > 0 ? (
            <ObsidianGraph
              data={graphData}
              onNodeClick={handleNodeClick}
              selectedNode={selectedNodeId || undefined}
              enablePhysics={true}
              showLabels={true}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-8">
              <div className="text-center max-w-sm glass-card p-8 rounded-2xl border border-border/60">
                <Sparkles className="w-12 h-12 text-muted-foreground/60 mx-auto mb-4" />
                <h3 className="text-base font-semibold text-foreground mb-2">No Semantic Clusters</h3>
                <p className="text-xs text-muted-foreground">
                  Try decreasing the strictness threshold or importing documents on similar topics to establish connections.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Node Details Inspector */}
      {selectedNodeDetails && (
        <div className="w-96 h-full bg-card/90 backdrop-blur-xl border-l border-border flex flex-col shadow-2xl z-20 animate-slideLeft">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              <h3 className="font-semibold text-foreground">Cluster Inspector</h3>
            </div>
            <button
              onClick={() => setSelectedNodeId(null)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Main Item details card */}
            <div className={cn(
              "glass-card p-4 rounded-xl border mb-2 transition-all duration-200",
              selectedNodeDetails.originalItem.itemType === "rss-article"
                ? "border-orange-500/20 bg-orange-500/5 dark:bg-orange-400/5"
                : "border-blue-500/20 bg-blue-500/5 dark:bg-blue-400/5"
            )}>
              <span className={cn(
                "inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold mb-2 border",
                selectedNodeDetails.originalItem.itemType === "rss-article"
                  ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20"
                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
              )}>
                {selectedNodeDetails.originalItem.itemType === "rss-article" ? "RSS Feed Item" : selectedNodeDetails.originalItem.itemType}
              </span>
              <h4 className="text-sm font-semibold text-foreground leading-snug">
                {selectedNodeDetails.originalItem.documentTitle}
              </h4>
              {selectedNodeDetails.originalItem.question && (
                <p className="text-xs text-foreground/80 mt-2 p-2 bg-card/60 rounded border border-border/40 font-serif italic">
                  "{selectedNodeDetails.originalItem.question}"
                </p>
              )}
              {selectedNodeDetails.originalItem.itemType === "rss-article" && (selectedNodeDetails.originalItem as any).rssItem?.description && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-3 italic">
                  "{(selectedNodeDetails.originalItem as any).rssItem.description}"
                </p>
              )}
              {selectedNodeDetails.originalItem.category && (
                <div className="text-[11px] text-muted-foreground mt-2">
                  Category: <span className="text-foreground/80 font-medium">{selectedNodeDetails.originalItem.category}</span>
                </div>
              )}
              {selectedNodeDetails.originalItem.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {selectedNodeDetails.originalItem.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-muted rounded-md text-[10px] text-muted-foreground border border-border/40"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Related items list */}
            <div className="space-y-3">
              <h5 className="text-xs font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
                Related Neighbors ({selectedNodeDetails.relatedItems.length})
              </h5>

              {selectedNodeDetails.relatedItems.length > 0 ? (
                <div className="space-y-2">
                  {selectedNodeDetails.relatedItems.map(({ item, score }) => {
                    const isRss = item.itemType === "rss-article";
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedNodeId(item.id)}
                        className={cn(
                          "p-3 border rounded-xl cursor-pointer transition-all duration-200 flex flex-col gap-1 hover:scale-[1.01]",
                          isRss
                            ? "bg-orange-500/5 hover:bg-orange-500/10 border-orange-500/20"
                            : "bg-muted/40 hover:bg-muted/80 border-border/60"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn(
                            "text-[10px] font-bold uppercase",
                            isRss ? "text-orange-500 dark:text-orange-400" : "text-muted-foreground"
                          )}>
                            {isRss ? "RSS" : item.itemType}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-blue-500 dark:text-blue-400">
                            {Math.round(score * 100)}% Match
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-foreground/90 line-clamp-2 leading-tight">
                          {item.documentTitle}
                        </span>
                        {item.question && (
                          <span className="text-[10px] text-muted-foreground italic line-clamp-1">
                            "{item.question}"
                          </span>
                        )}
                        {!item.question && isRss && (item as any).rssItem?.description && (
                          <span className="text-[10px] text-muted-foreground italic line-clamp-1">
                            "{(item as any).rssItem.description}"
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic py-2">
                  No other items meet the {threshold}% similarity strictness.
                </p>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="p-6 border-t border-border bg-muted/20">
            <button
              onClick={handleStudyCluster}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-xl shadow-lg flex items-center justify-center gap-2 font-medium text-sm transition-all hover:shadow-blue-500/20"
            >
              <Play className="w-4 h-4" />
              Study This Cluster ({selectedNodeDetails.relatedItems.length + 1} items)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
