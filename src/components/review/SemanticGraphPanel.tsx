import { useState, useMemo, useCallback, useEffect } from "react";
import {
  CaretDown,
  Check,
  CircleNotch,
  Eye,
  Folder,
  Funnel,
  Graph,
  Info,
  MagnifyingGlass,
  Play,
  Radio,
  Rss,
  Sliders,
  Sparkle,
  Stack,
  Star,
  X,
} from "@phosphor-icons/react";
import { ObsidianGraph } from "../graph/ObsidianGraph";
import { type GraphNode, type GraphEdge, GraphNodeType } from "../graph/KnowledgeGraph";
import { buildSemanticGraph as buildSemanticGraphFromEngine, type EmbeddingStatus, type EmbeddingConfig } from "../../utils/semanticEngine";
import { calculateItemSimilarity, scoreFocalTopic } from "../../utils/semanticRelations";
import type { QueueItem } from "../../types/queue";
import { cn } from "../../utils";
import { getUnreadItems, getFavoriteItems, getSubscribedFeeds, getFeedFolders, getSubscribedFeedsAuto, type Feed, type FeedItem, type FeedFolder } from "../../api/rss";
import { getFoldersAuto } from "../../api/rss-folders";
import { useRssStudyStore } from "../../stores/rssStudyStore";

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
  
  const rssStudy = useRssStudyStore();
  const [showRssSelector, setShowRssSelector] = useState(false);
  const [activeSelectorTab, setActiveSelectorTab] = useState<"quick" | "feeds" | "articles">("quick");
  const [rssSearchQuery, setRssSearchQuery] = useState("");

  const [clusterSearchQuery, setClusterSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ node: GraphNode; score: number; neighborCount: number }>>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Cluster search logic using scoreFocalTopic
  const handleClusterSearch = useCallback((query: string) => {
    setClusterSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const matches: Array<{ node: GraphNode; score: number; neighborCount: number }> = [];
    const normalizedQuery = query.toLowerCase().trim();

    graphData.nodes.forEach((node) => {
      const originalItem = node.metadata?.originalItem as QueueItem;
      if (!originalItem) return;

      const score = scoreFocalTopic(originalItem, normalizedQuery);
      if (score > 0) {
        // Count neighbors at the current threshold
        const neighborCount = graphData.edges.filter(
          (e) => e.source === node.id || e.target === node.id
        ).length;

        matches.push({ node, score, neighborCount });
      }
    });

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);
    setSearchResults(matches.slice(0, 8));
  }, [graphData.nodes, graphData.edges]);

  // Recalculate search results if threshold / graph edges change, so that neighbor counts are always up-to-date!
  useEffect(() => {
    if (clusterSearchQuery) {
      handleClusterSearch(clusterSearchQuery);
    }
  }, [graphData.edges, threshold]);

  // Launch study session directly for a node's cluster
  const handleStudyClusterDirect = useCallback((nodeId: string) => {
    const node = graphData.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const originalItem = node.metadata?.originalItem as QueueItem;
    if (!originalItem) return;
    
    const relatedItems: QueueItem[] = [];
    const connectedEdges = graphData.edges.filter(
      (e) => e.source === nodeId || e.target === nodeId
    );
    connectedEdges.forEach((edge) => {
      const neighborId = edge.source === nodeId ? edge.target : edge.source;
      const neighborNode = graphData.nodes.find((n) => n.id === neighborId);
      const neighborItem = neighborNode?.metadata?.originalItem as QueueItem;
      if (neighborItem) {
        relatedItems.push(neighborItem);
      }
    });

    onStartSessionWithFilter([originalItem, ...relatedItems]);
    onClose();
  }, [graphData.nodes, graphData.edges, onStartSessionWithFilter, onClose]);

  const [loadedFeeds, setLoadedFeeds] = useState<Feed[]>([]);
  const [loadedFolders, setLoadedFolders] = useState<FeedFolder[]>([]);
  const [isLoadingRss, setIsLoadingRss] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setIsLoadingRss(true);

    Promise.all([
      getSubscribedFeedsAuto(),
      getFoldersAuto().catch(() => []),
    ])
      .then(([feeds, folders]) => {
        if (!cancelled) {
          setLoadedFeeds(feeds);
          const mappedFolders: FeedFolder[] = folders.map((f: any) => ({
            id: f.id,
            name: f.name,
            feeds: f.feed_ids || f.feeds || [],
          }));
          setLoadedFolders(mappedFolders);
          setIsLoadingRss(false);
        }
      })
      .catch((err) => {
        console.error("[SemanticGraphPanel] Failed to load async feeds/folders:", err);
        if (!cancelled) setIsLoadingRss(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const hasSelections =
        rssStudy.selectedRssItems.length > 0 ||
        rssStudy.selectedFeeds.length > 0 ||
        rssStudy.selectedFolders.length > 0 ||
        rssStudy.includeAllUnread ||
        rssStudy.includeFavorites;

      if (!hasSelections) {
        console.log("[SemanticGraphPanel] Auto-defaulting includeAllUnread to true since no batch RSS selections exist.");
        rssStudy.setIncludeAllUnread(true);
      }
    }
  }, [isOpen]);

  const unreadItems = useMemo(() => {
    const results: Array<{ feed: Feed; item: FeedItem }> = [];
    loadedFeeds.forEach((feed) => {
      feed.items.forEach((item) => {
        if (!item.read) {
          results.push({ feed, item });
        }
      });
    });
    results.sort((a, b) => new Date(b.item.pubDate).getTime() - new Date(a.item.pubDate).getTime());
    return results;
  }, [loadedFeeds]);

  const favoriteItems = useMemo(() => {
    const results: Array<{ feed: Feed; item: FeedItem }> = [];
    loadedFeeds.forEach((feed) => {
      feed.items.forEach((item) => {
        if (item.favorite) {
          results.push({ feed, item });
        }
      });
    });
    return results;
  }, [loadedFeeds]);

  useEffect(() => {
    if (!isOpen) {
      setGraphData({ nodes: [], edges: [] });
      return;
    }

    let cancelled = false;
    setEmbeddingStatus("idle");

    console.log("[SemanticGraphPanel] useEffect buildSemanticGraph called:", {
      itemsCount: items.length,
      threshold,
      focalTopic,
      includeAllUnread: rssStudy.includeAllUnread,
      includeFavorites: rssStudy.includeFavorites,
      unreadItemsCount: unreadItems.length,
      favoriteItemsCount: favoriteItems.length,
      loadedFeedsCount: loadedFeeds.length,
    });

    let activeRssItems: FeedItem[] = [];

    if (rssStudy.includeAllUnread) {
      activeRssItems = unreadItems.map((x) => x.item);
    } else if (rssStudy.includeFavorites) {
      activeRssItems = favoriteItems.map((x) => x.item);
    } else {
      const activeFeedIds = new Set(rssStudy.selectedFeeds);
      
      rssStudy.selectedFolders.forEach((folderId) => {
        const folder = loadedFolders.find((f) => f.id === folderId);
        if (folder) {
          folder.feeds.forEach((feedId) => activeFeedIds.add(feedId));
        }
      });

      if (activeFeedIds.size > 0) {
        loadedFeeds.forEach((feed) => {
          if (activeFeedIds.has(feed.id)) {
            feed.items.forEach((item) => {
              if (!item.read) {
                activeRssItems.push(item);
              }
            });
          }
        });
      }

      rssStudy.selectedRssItems.forEach((item) => {
        if (!activeRssItems.some((i) => i.id === item.id)) {
          activeRssItems.push(item);
        }
      });
    }

    console.log("[SemanticGraphPanel] activeRssItems to build graph:", activeRssItems.map(i => i.title));

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
      console.log("[SemanticGraphPanel] Graph built successfully! Result:", {
        nodesCount: result.nodes.length,
        edgesCount: result.edges.length,
        nodeTypes: result.nodes.map(n => `${n.label} (${n.type})`),
      });
      if (!cancelled) setGraphData(result);
    });

    return () => { cancelled = true; };
  }, [
    items,
    threshold,
    focalTopic,
    isOpen,
    embeddingConfig,
    rssStudy.selectedRssItems,
    rssStudy.selectedFeeds,
    rssStudy.selectedFolders,
    rssStudy.includeAllUnread,
    rssStudy.includeFavorites,
    loadedFeeds,
    loadedFolders,
    unreadItems,
    favoriteItems
  ]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm transition-all duration-300 pointer-events-auto">
      {/* Dynamic Visual Graph Canvas */}
      <div className="flex-1 h-full relative flex flex-col bg-background dark:bg-zinc-950 overflow-hidden">
        {/* Header bar */}
        <div className="h-16 px-6 border-b border-border bg-card flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-400/10 border border-blue-500/20 flex items-center justify-center">
              <Graph className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Semantic Relationship Graph</h2>
              <p className="text-xs text-muted-foreground">
                {embeddingStatus === "embedding" ? (
                  <span className="flex items-center gap-1.5">
                    <CircleNotch className="w-3 h-3 animate-spin" />
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

          {/* Cluster MagnifyingGlass Input Bar */}
          <div className="relative z-30 flex-1 max-w-xs mx-4">
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={clusterSearchQuery}
                onChange={(e) => handleClusterSearch(e.target.value)}
                onFocus={() => setShowSearchDropdown(true)}
                placeholder="Search & study a cluster..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-muted/60 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-foreground"
              />
              {clusterSearchQuery && (
                <button
                  onClick={() => {
                    setClusterSearchQuery("");
                    setSearchResults([]);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs font-bold"
                >
                  ×
                </button>
              )}
            </div>

            {/* MagnifyingGlass Results Dropdown */}
            {showSearchDropdown && searchResults.length > 0 && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowSearchDropdown(false)} 
                />
                <div className="absolute left-1/2 -translate-x-1/2 w-[320px] mt-2 bg-card border border-border rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto p-2 space-y-1 animate-slideDown">
                  {searchResults.map(({ node, score, neighborCount }) => {
                    const isRss = node.type === GraphNodeType.Rss;
                    return (
                      <div
                        key={node.id}
                        className="flex items-center justify-between p-2 hover:bg-muted rounded-lg transition-colors cursor-pointer group"
                        onClick={() => {
                          setSelectedNodeId(node.id);
                          setShowSearchDropdown(false);
                        }}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={cn(
                              "text-[8px] font-bold uppercase px-1 py-0.5 rounded border leading-none",
                              isRss 
                                ? "bg-orange-500/10 text-orange-600 border-orange-500/20" 
                                : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                            )}>
                              {isRss ? "RSS" : "EPUB"}
                            </span>
                            <span className="text-[9px] text-muted-foreground font-mono">
                              Match: {Math.round(score * 100)}%
                            </span>
                          </div>
                          <p className="text-[11px] font-semibold text-foreground truncate leading-tight">
                            {node.label}
                          </p>
                          <p className="text-[9px] text-muted-foreground font-medium">
                            Cluster size: <span className="text-blue-500 font-bold">{neighborCount + 1}</span> item(s) at {threshold}%
                          </p>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStudyClusterDirect(node.id);
                          }}
                          title={`Study this cluster of ${neighborCount + 1} items`}
                          className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow hover:scale-105 transition-all opacity-80 group-hover:opacity-100 flex items-center justify-center"
                        >
                          <Play className="w-3 h-3 fill-white" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Manage RSS Sources Selector */}
            <div className="relative">
              <button
                onClick={() => setShowRssSelector(!showRssSelector)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 border rounded-xl shadow-sm transition-all duration-200 select-none font-semibold text-xs",
                  showRssSelector
                    ? "bg-orange-500 text-white border-orange-600 shadow-orange-500/20"
                    : "bg-muted/60 dark:bg-zinc-900/60 border-border/80 text-foreground hover:bg-muted dark:hover:bg-zinc-900"
                )}
              >
                <Rss className="w-4 h-4" />
                <span>RSS Sources</span>
                <CaretDown className={cn("w-3.5 h-3.5 transition-transform duration-200", showRssSelector && "rotate-180")} />
              </button>

              {showRssSelector && (
                <div className="absolute right-0 mt-2 w-96 max-h-[480px] bg-card/95 backdrop-blur-xl border border-border/80 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-slideDown">
                  {/* Selector Tabs */}
                  <div className="flex border-b border-border/50 bg-muted/40 p-1">
                    {(["quick", "feeds", "articles"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveSelectorTab(tab)}
                        className={cn(
                          "flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all",
                          activeSelectorTab === tab
                            ? "bg-card text-orange-600 dark:text-orange-400 shadow-sm border border-border/40"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {tab === "quick" ? "Filters" : tab === "feeds" ? "Feeds" : "Articles"}
                      </button>
                    ))}
                  </div>

                  {/* Tab Contents */}
                  <div className="flex-1 overflow-y-auto p-4 min-h-[250px] max-h-[350px] space-y-4">
                    {activeSelectorTab === "quick" && (
                      <div className="space-y-3 py-2">
                        <label className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer select-none">
                          <div className="flex items-center gap-2.5">
                            <Eye className="w-4 h-4 text-orange-500" />
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-foreground">Include All Unread</span>
                              <span className="text-[10px] text-muted-foreground">Adds all unread feed items to the graph</span>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={rssStudy.includeAllUnread}
                            onChange={(e) => {
                              rssStudy.setIncludeAllUnread(e.target.checked);
                              if (e.target.checked) rssStudy.setIncludeFavorites(false);
                            }}
                            className="w-4 h-4 rounded border-gray-300 dark:border-zinc-700 text-orange-600 dark:text-orange-500 focus:ring-orange-500 cursor-pointer accent-orange-600 dark:accent-orange-500"
                          />
                        </label>

                        <label className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer select-none">
                          <div className="flex items-center gap-2.5">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-foreground">Starred / Favorites Only</span>
                              <span className="text-[10px] text-muted-foreground">Only show starred feed articles</span>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={rssStudy.includeFavorites}
                            onChange={(e) => {
                              rssStudy.setIncludeFavorites(e.target.checked);
                              if (e.target.checked) rssStudy.setIncludeAllUnread(false);
                            }}
                            className="w-4 h-4 rounded border-gray-300 dark:border-zinc-700 text-orange-600 dark:text-orange-500 focus:ring-orange-500 cursor-pointer accent-orange-600 dark:accent-orange-500"
                          />
                        </label>
                      </div>
                    )}

                    {activeSelectorTab === "feeds" && (
                      <div className="space-y-4">
                        {/* Folders */}
                        {loadedFolders.map((folder) => {
                          const isFolderSelected = rssStudy.selectedFolders.includes(folder.id);
                          return (
                            <div key={folder.id} className="space-y-1.5">
                              <label className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted/40 transition-colors cursor-pointer select-none font-semibold text-[11px] text-foreground uppercase tracking-wider">
                                <input
                                  type="checkbox"
                                  checked={isFolderSelected}
                                  onChange={() => rssStudy.toggleFolderInBatch(folder.id)}
                                  className="w-3.5 h-3.5 rounded border-gray-300 dark:border-zinc-700 text-orange-600 focus:ring-orange-500 accent-orange-600 dark:accent-orange-500"
                                />
                                <Folder className="w-3.5 h-3.5 text-blue-500" />
                                <span>{folder.name}</span>
                              </label>
                              
                              <div className="pl-6 space-y-1 border-l border-border/60 ml-2.5">
                                {folder.feeds.map((feedId) => {
                                  const feed = loadedFeeds.find((f) => f.id === feedId);
                                  if (!feed) return null;
                                  const isSelected = rssStudy.selectedFeeds.includes(feedId) || isFolderSelected;
                                  return (
                                    <label key={feedId} className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-muted/40 transition-colors cursor-pointer select-none text-xs text-foreground/80 font-normal">
                                      <div className="flex items-center gap-2 truncate">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          disabled={isFolderSelected}
                                          onChange={() => rssStudy.toggleFeedInBatch(feedId)}
                                          className="w-3.5 h-3.5 rounded border-gray-300 dark:border-zinc-700 text-orange-600 focus:ring-orange-500 accent-orange-600 dark:accent-orange-500"
                                        />
                                        <span className="truncate">{feed.title}</span>
                                      </div>
                                      <span className="text-[10px] font-mono text-muted-foreground font-semibold bg-muted px-1.5 py-0.5 rounded-full">
                                        {feed.unreadCount}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}

                        {/* Flat feeds without folder */}
                        {(() => {
                          const folderFeeds = new Set(loadedFolders.flatMap((f) => f.feeds));
                          const standaloneFeeds = loadedFeeds.filter((f) => !folderFeeds.has(f.id));
                          if (standaloneFeeds.length === 0) return null;
                          return (
                            <div className="space-y-1.5">
                              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block px-1">Standalone Feeds</span>
                              <div className="space-y-1 pl-1">
                                {standaloneFeeds.map((feed) => {
                                  const isSelected = rssStudy.selectedFeeds.includes(feed.id);
                                  return (
                                    <label key={feed.id} className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-muted/40 transition-colors cursor-pointer select-none text-xs text-foreground/80 font-normal">
                                      <div className="flex items-center gap-2 truncate">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => rssStudy.toggleFeedInBatch(feed.id)}
                                          className="w-3.5 h-3.5 rounded border-gray-300 dark:border-zinc-700 text-orange-600 focus:ring-orange-500 accent-orange-600 dark:accent-orange-500"
                                        />
                                        <span className="truncate">{feed.title}</span>
                                      </div>
                                      <span className="text-[10px] font-mono text-muted-foreground font-semibold bg-muted px-1.5 py-0.5 rounded-full">
                                        {feed.unreadCount}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {activeSelectorTab === "articles" && (
                      <div className="space-y-3 flex flex-col h-full">
                        {/* MagnifyingGlass articles */}
                        <div className="relative">
                          <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <input
                            type="text"
                            value={rssSearchQuery}
                            onChange={(e) => setRssSearchQuery(e.target.value)}
                            placeholder="Search recent articles..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/40 border border-border/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                          />
                        </div>

                        {/* Recent MagnifyingGlass Results */}
                        <div className="flex-1 overflow-y-auto space-y-1 max-h-[160px] border-b border-border/40 pb-2">
                          {(() => {
                            const query = rssSearchQuery.toLowerCase().trim();
                            const matches = unreadItems.filter((item) => {
                              if (!query) return true;
                              return (
                                item.item.title.toLowerCase().includes(query) ||
                                (item.item.description || "").toLowerCase().includes(query)
                              );
                            }).slice(0, 15);

                            if (matches.length === 0) {
                              return <p className="text-[11px] text-muted-foreground italic text-center py-4">No matching articles</p>;
                            }

                            return matches.map(({ item }) => {
                              const isChecked = rssStudy.selectedRssItems.some((i) => i.id === item.id);
                              return (
                                <label key={item.id} className="flex items-start gap-2.5 p-2 hover:bg-muted/50 rounded-xl cursor-pointer select-none text-xs leading-tight transition-colors font-normal">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) rssStudy.removeRssItemFromBatch(item.id);
                                      else rssStudy.addRssItemToBatch(item);
                                    }}
                                    className="w-3.5 h-3.5 rounded mt-0.5 border-gray-300 dark:border-zinc-700 text-orange-600 focus:ring-orange-500 accent-orange-600 dark:accent-orange-500"
                                  />
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-semibold text-foreground truncate">{item.title}</span>
                                    <span className="text-[9px] text-muted-foreground line-clamp-1 mt-0.5">{item.description}</span>
                                  </div>
                                </label>
                              );
                            });
                          })()}
                        </div>

                        {/* Selected batch items */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] uppercase font-bold text-muted-foreground tracking-wider px-1">
                            <span>Selected Batch ({rssStudy.selectedRssItems.length})</span>
                            {rssStudy.selectedRssItems.length > 0 && (
                              <button onClick={() => rssStudy.clearBatch()} className="text-red-500 hover:text-red-600 font-semibold lowercase">clear all</button>
                            )}
                          </div>

                          <div className="max-h-[110px] overflow-y-auto space-y-1.5">
                            {rssStudy.selectedRssItems.length === 0 ? (
                              <p className="text-[11px] text-muted-foreground italic text-center py-2">No custom articles added to study batch yet.</p>
                            ) : (
                              rssStudy.selectedRssItems.map((item) => (
                                <div key={item.id} className="flex items-center justify-between gap-3 p-1.5 px-2.5 bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/20 rounded-lg text-[11px]">
                                  <span className="font-semibold truncate text-foreground flex-1 pr-2">{item.title}</span>
                                  <button onClick={() => rssStudy.removeRssItemFromBatch(item.id)} className="text-muted-foreground hover:text-red-500 transition-colors font-bold text-xs">×</button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="p-3 bg-muted/40 border-t border-border/50 flex justify-between items-center text-[10px] text-muted-foreground font-medium px-4">
                    <span>Embedding-based Semantic MagnifyingGlass ready</span>
                    <button onClick={() => setShowRssSelector(false)} className="text-orange-600 dark:text-orange-400 font-bold uppercase tracking-wider hover:underline">Done</button>
                  </div>
                </div>
              )}
            </div>

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

        {/* Active RSS Source Pills */}
        {(() => {
          const pills: Array<{ label: string; onRemove: () => void; id: string }> = [];
          if (rssStudy.includeAllUnread) {
            pills.push({ id: "all-unread", label: "All Unread Items", onRemove: () => rssStudy.setIncludeAllUnread(false) });
          } else if (rssStudy.includeFavorites) {
            pills.push({ id: "all-favorites", label: "Starred / Favorites", onRemove: () => rssStudy.setIncludeFavorites(false) });
          } else {
            rssStudy.selectedFolders.forEach((folderId) => {
              const folder = loadedFolders.find((f) => f.id === folderId);
              if (folder) {
                pills.push({ id: `folder-${folderId}`, label: `Folder: ${folder.name}`, onRemove: () => rssStudy.toggleFolderInBatch(folderId) });
              }
            });
            rssStudy.selectedFeeds.forEach((feedId) => {
              const isFolderSelected = loadedFolders.some(folder => 
                rssStudy.selectedFolders.includes(folder.id) && folder.feeds.includes(feedId)
              );
              if (isFolderSelected) return;

              const feed = loadedFeeds.find((f) => f.id === feedId);
              if (feed) {
                pills.push({ id: `feed-${feedId}`, label: `Feed: ${feed.title}`, onRemove: () => rssStudy.toggleFeedInBatch(feedId) });
              }
            });
            if (rssStudy.selectedRssItems.length > 0) {
              pills.push({
                id: "custom-batch",
                label: `${rssStudy.selectedRssItems.length} custom articles`,
                onRemove: () => rssStudy.clearBatch(),
              });
            }
          }

          if (pills.length === 0) return null;

          return (
            <div className="px-6 py-2.5 border-b border-border bg-card flex flex-wrap items-center gap-2 z-10 select-none">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mr-1">Active Sources:</span>
              {pills.map((pill) => (
                <div key={pill.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 rounded-full text-xs font-semibold shadow-sm transition-all hover:scale-[1.01]">
                  <span>{pill.label}</span>
                  <button onClick={pill.onRemove} className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:bg-orange-500/20 text-orange-700 dark:text-orange-300 font-bold transition-all text-[11px] leading-none mb-[1px]">×</button>
                </div>
              ))}
              <button onClick={() => rssStudy.clearBatch()} className="text-[10px] font-semibold text-red-500 hover:text-red-600 transition-colors uppercase tracking-wider px-2 py-0.5 hover:bg-red-500/5 rounded-md">Clear All</button>
            </div>
          );
        })()}

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
                <Sparkle className="w-12 h-12 text-muted-foreground/60 mx-auto mb-4" />
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
        <div className="w-96 h-full bg-card border-l border-border flex flex-col shadow-2xl z-20 animate-slideLeft">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Stack className="w-4 h-4 text-blue-500 dark:text-blue-400" />
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
