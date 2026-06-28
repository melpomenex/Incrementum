/**
 * Enhanced Knowledge Graph Page
 * Beautiful, Obsidian-inspired graph visualization
 */

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { invokeCommand } from "../lib/tauri";
import { ObsidianGraph, type ObsidianGraphHandle } from "../components/graph/ObsidianGraph";
import { ObsidianSphere } from "../components/graph/ObsidianSphere";
import { GraphFilterControls, applyGraphFilters, extractGraphMetadata } from "../components/graph/GraphFilters";
import { NodeDetailView } from "../components/graph/NodeDetailView";
import { GraphNodeType, type GraphNode, type GraphEdge, type GraphData, LayoutAlgorithm } from "../components/graph/KnowledgeGraph";
import { getDocument, updateDocument } from "../api/documents";
import { updateExtract } from "../api/extracts";
import { useCollectionStore } from "../stores/collectionStore";
import { useTabsStore } from "../stores/tabsStore";
import { useReviewStore } from "../stores/reviewStore";
import { DocumentViewer, ReviewTab } from "../components/tabs/TabRegistry";
import { useToast } from "../components/common/Toast";
import { useI18n } from "../lib/i18n";
import {
  ArrowsOutSimple,
  Brain,
  ChatCircle,
  Download,
  Funnel,
  GitBranch,
  Graph,
  GridNine,
  MagnifyingGlass,
  Sparkle,
  TextT,
  X,
} from "@phosphor-icons/react";

type ViewMode = "graph" | "sphere";

export function KnowledgeGraphPage() {
  const { t } = useI18n();
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("graph");
  const [showFilters, setShowFilters] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const graphRef = useRef<ObsidianGraphHandle>(null);
  const searchFitTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { addTab } = useTabsStore();
  const toast = useToast();
  const activeCollectionId = useCollectionStore((state) => state.activeCollectionId);

  const [filters, setFilters] = useState({
    searchQuery: "",
    nodeTypes: [] as GraphNodeType[],
    categories: [] as string[],
    tags: [] as string[],
  });
  const [layout, setLayout] = useState(LayoutAlgorithm.Force);
  const [graphLinkDistance, setGraphLinkDistance] = useState(120);
  const [graphNodeScale, setGraphNodeScale] = useState(1);

  const loadGraphData = useCallback(async () => {
    setIsLoading(true);

    try {
      const documents = await invokeCommand<any[]>("get_documents", { collectionId: activeCollectionId ?? null });
      const extracts = await invokeCommand<any[]>("get_extracts", { documentId: null });
      const learningItems = await invokeCommand<any[]>("get_all_learning_items");

      const inActiveCollection = (documentId?: string | null) => {
        if (!activeCollectionId) return true;
        if (!documentId) return true;
        const doc = documents.find((d: any) => d.id === documentId);
        return doc ? doc.collectionId === activeCollectionId : true;
      };

      const nodes: GraphNode[] = [];
      const edges: GraphEdge[] = [];

      // Add document nodes
      documents.filter((doc: any) => inActiveCollection(doc.id)).forEach((doc: any) => {
        nodes.push({
          id: `doc-${doc.id}`,
          type: GraphNodeType.Document,
          label: doc.title || "Untitled Document",
          description: doc.description || `${doc.fileType?.toUpperCase() || "Unknown"} document`,
          x: Math.random() * 800 + 100,
          y: Math.random() * 600 + 100,
          radius: 24,
          category: doc.category,
          tags: doc.tags,
          metadata: { fileType: doc.fileType, createdAt: doc.createdAt },
          color: "#3b82f6",
        });
      });

      // Add extract nodes
      extracts.filter((extract: any) => inActiveCollection(extract.documentId)).forEach((extract: any) => {
        const content = extract.content || "";
        nodes.push({
          id: `extract-${extract.id}`,
          type: GraphNodeType.Extract,
          label: content.length > 40 ? content.substring(0, 37) + "..." : content,
          description: content,
          x: Math.random() * 800 + 100,
          y: Math.random() * 600 + 100,
          radius: 16,
          metadata: { documentId: extract.documentId, position: extract.position },
          color: "#22c55e",
        });

        edges.push({
          id: `edge-extract-${extract.id}`,
          source: `doc-${extract.documentId}`,
          target: `extract-${extract.id}`,
          type: "contains",
        });
      });

      // Add flashcard nodes
      learningItems.filter((item: any) => inActiveCollection(item.documentId)).forEach((item: any) => {
        const question = item.question || "";
        nodes.push({
          id: `card-${item.id}`,
          type: GraphNodeType.Flashcard,
          label: question.length > 30 ? question.substring(0, 27) + "..." : question || "Flashcard",
          description: question,
          x: Math.random() * 800 + 100,
          y: Math.random() * 600 + 100,
          radius: 12,
          metadata: { documentId: item.documentId, extractId: item.extractId, interval: item.interval },
          color: "#a855f7",
        });

        if (item.extractId) {
          edges.push({
            id: `edge-card-${item.id}`,
            source: `extract-${item.extractId}`,
            target: `card-${item.id}`,
            type: "derived",
          });
        } else if (item.documentId) {
          edges.push({
            id: `edge-card-doc-${item.id}`,
            source: `doc-${item.documentId}`,
            target: `card-${item.id}`,
            type: "derived",
          });
        }
      });

      setGraphData({ nodes, edges });
      
      // Smart default: if dataset is large (>500 nodes), exclude Flashcards by default to prevent a "hairball"
      if (nodes.length > 500) {
        setFilters((prev) => {
          if (prev.nodeTypes.length === 0) {
            return { ...prev, nodeTypes: [GraphNodeType.Flashcard] };
          }
          return prev;
        });
      }
    } catch (error) {
      console.error("Failed to load graph data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [activeCollectionId]);

  useEffect(() => {
    loadGraphData();
  }, [loadGraphData]);

  // Apply filters
  const filteredData = useMemo(() => {
    return applyGraphFilters(graphData.nodes, graphData.edges, filters);
  }, [graphData, filters]);

  // Search-with-zoom: auto-fit viewport when search results change
  useEffect(() => {
    if (searchFitTimeout.current) {
      clearTimeout(searchFitTimeout.current);
    }
    if (filters.searchQuery && filteredData.nodes.length > 0 && graphRef.current) {
      searchFitTimeout.current = setTimeout(() => {
        graphRef.current?.fitToView(filteredData.nodes);
      }, 300);
    }
    return () => {
      if (searchFitTimeout.current) clearTimeout(searchFitTimeout.current);
    };
  }, [filters.searchQuery, filteredData]);

  const { categories, tags } = useMemo(() => {
    return extractGraphMetadata(graphData.nodes);
  }, [graphData]);

  // Calculate statistics
  // Node counts by type
  const nodeCounts = useMemo(() => {
    const counts: Record<GraphNodeType, number> = {
      [GraphNodeType.Document]: 0,
      [GraphNodeType.Extract]: 0,
      [GraphNodeType.Flashcard]: 0,
      [GraphNodeType.Category]: 0,
      [GraphNodeType.Tag]: 0,
      [GraphNodeType.Rss]: 0,
    };
    graphData.nodes.forEach((node) => {
      counts[node.type]++;
    });
    return counts;
  }, [graphData]);

  const selectedNodeData = useMemo(() => {
    if (!selectedNode) return null;
    const node = graphData.nodes.find((n) => n.id === selectedNode);
    if (!node) return null;

    const connectedEdges = graphData.edges.filter(
      (e) => e.source === selectedNode || e.target === selectedNode
    );

    const relatedNodeIds = new Set<string>();
    connectedEdges.forEach((e) => {
      if (e.source === selectedNode) relatedNodeIds.add(e.target);
      else relatedNodeIds.add(e.source);
    });

    const relatedNodes = graphData.nodes.filter((n) => relatedNodeIds.has(n.id));

    return { node, relatedNodes, connectedEdges };
  }, [selectedNode, graphData]);

  // Handlers
  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node.id);
  }, []);

  const handleNodeDoubleClick = useCallback((node: GraphNode) => {
    switch (node.type) {
      case GraphNodeType.Document:
        addTab({
          title: node.label,
          icon: <TextT className="w-4 h-4 text-muted-foreground" />,
          type: "document-viewer",
          content: DocumentViewer,
          closable: true,
          data: { documentId: node.id.replace("doc-", "") },
        });
        break;
      case GraphNodeType.Extract:
        addTab({
          title: node.label.substring(0, 30),
          icon: <ChatCircle className="w-4 h-4 text-muted-foreground" />,
          type: "document-viewer",
          content: DocumentViewer,
          closable: true,
          data: {
            documentId: String(node.metadata?.documentId || "").replace("doc-", ""),
            initialViewMode: "extracts",
          },
        });
        break;
      case GraphNodeType.Flashcard:
        addTab({
          title: "Review",
          icon: <Brain className="w-4 h-4" />,
          type: "review",
          content: ReviewTab,
          closable: true,
        });
        void useReviewStore.getState().startReviewAtItem(node.id.replace("card-", ""));
        break;
    }
  }, [addTab]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
   
  const handleNodeEditFallback = useCallback((nodeId: string) => {
    const node = graphData.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    switch (node.type) {
      case GraphNodeType.Document:
        addTab({
          title: node.label,
          icon: <TextT className="w-4 h-4 text-muted-foreground" />,
          type: "document-viewer",
          content: DocumentViewer,
          closable: true,
          data: { documentId: node.id.replace("doc-", "") },
        });
        toast.info(t("knowledgeGraph.openedDocument"), t("knowledgeGraph.editDocumentHint"));
        break;
      case GraphNodeType.Extract:
        addTab({
          title: node.label.substring(0, 30),
          icon: <ChatCircle className="w-4 h-4 text-muted-foreground" />,
          type: "document-viewer",
          content: DocumentViewer,
          closable: true,
          data: {
            documentId: String(node.metadata?.documentId || "").replace("doc-", ""),
            initialViewMode: "extracts",
          },
        });
        toast.info(t("knowledgeGraph.openedExtracts"), t("knowledgeGraph.editExtractHint"));
        break;
      case GraphNodeType.Flashcard:
        addTab({
          title: "Review",
          icon: <Brain className="w-4 h-4" />,
          type: "review",
          content: ReviewTab,
          closable: true,
        });
        void useReviewStore.getState().startReviewAtItem(node.id.replace("card-", ""));
        toast.info(t("knowledgeGraph.openedReviewItem"), t("knowledgeGraph.editFlashcardHint"));
        break;
      default:
        break;
    }
  }, [addTab, graphData.nodes, toast]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
   
  const handleSaveNodeDetails = useCallback(async (
    nodeId: string,
    updates: {
      label?: string;
      description?: string;
      category?: string;
      tags?: string[];
    }
  ) => {
    const node = graphData.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    if (node.type === GraphNodeType.Document) {
      const documentId = node.id.replace("doc-", "");
      const doc = await getDocument(documentId);
      if (!doc) throw new Error("Document not found");

      await updateDocument(documentId, {
        ...doc,
        title: updates.label || doc.title,
        category: updates.category,
        tags: updates.tags ?? doc.tags,
      });
      await loadGraphData();
      toast.success(t("knowledgeGraph.documentUpdated"));
      return;
    }

    if (node.type === GraphNodeType.Extract) {
      const extractId = node.id.replace("extract-", "");
      await updateExtract({
        id: extractId,
        content: updates.description,
        category: updates.category,
        tags: updates.tags,
      });
      await loadGraphData();
      toast.success(t("knowledgeGraph.extractUpdated"));
      return;
    }

    handleNodeEditFallback(nodeId);
  }, [graphData.nodes, toast, handleNodeEditFallback, loadGraphData]);

  const exportGraph = async () => {
    try {
      const dataStr = JSON.stringify(graphData, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `knowledge-graph-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
    } catch (error) {
      console.error("Failed to export graph:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-muted-foreground">{t("knowledgeGraph.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-cream">
      {/* Header with glass styling */}
      <div className="h-16 glass-panel-light flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center">
              <Graph className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">{t("knowledgeGraph.title")}</h1>
              <p className="text-xs text-muted-foreground">
                {t("knowledgeGraph.visibleOfTotal", { visible: filteredData.nodes.length, total: graphData.nodes.length })}
              </p>
            </div>
          </div>

          {/* View mode toggle with glass styling */}
          <div className="flex items-center gap-1 p-1 glass-panel rounded-xl ml-4">
            <button
              onClick={() => setViewMode("graph")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                viewMode === "graph"
                  ? "glass-panel-heavy text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-glass-100"
              }`}
            >
              <GitBranch className="w-4 h-4" />
              {t("knowledgeGraph.graph")}
            </button>
            <button
              onClick={() => setViewMode("sphere")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                viewMode === "sphere"
                  ? "glass-panel-heavy text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-glass-100"
              }`}
            >
              <Sparkle className="w-4 h-4" />
              {t("knowledgeGraph.sphere")}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search with glass styling */}
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setFilters((f) => ({ ...f, searchQuery: e.target.value }));
              }}
              placeholder={t("knowledgeGraph.searchNodes")}
              className="w-64 pl-10 pr-9 py-2 glass-input rounded-xl text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setFilters((f) => ({ ...f, searchQuery: "" }));
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {searchQuery && (
              <button
                onClick={() => graphRef.current?.fitToView()}
                className="absolute -right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                title={t("graph.resetView")}
              >
                <ArrowsOutSimple className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Funnel toggle with glass styling */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all glass-button ${
              showFilters ? "bg-primary-400/20 text-primary-300" : ""
            }`}
          >
            <Funnel className="w-4 h-4" />
            {t("knowledgeGraph.filters")}
          </button>

          {/* Export with glass styling */}
          <button
            onClick={exportGraph}
            className="flex items-center gap-2 px-3 py-2 glass-button rounded-xl text-sm font-medium transition-colors"
            title={t("knowledgeGraph.exportGraph")}
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Filters Sidebar with glass styling */}
        {showFilters && (
          <div className="w-72 flex-shrink-0 sidebar-section">
            <GraphFilterControls
              filters={filters}
              onFiltersChange={setFilters}
              availableCategories={categories}
              availableTags={tags}
              layout={layout}
              onLayoutChange={setLayout}
              nodeCounts={nodeCounts}
              linkDistance={graphLinkDistance}
              onLinkDistanceChange={setGraphLinkDistance}
              nodeScale={graphNodeScale}
              onNodeScaleChange={setGraphNodeScale}
            />
          </div>
        )}

        {/* Graph/Sphere View */}
        <div className="flex-1 relative">
          {viewMode === "graph" ? (
            <ObsidianGraph
              ref={graphRef}
              data={filteredData}
              onNodeClick={handleNodeClick}
              onNodeDoubleClick={handleNodeDoubleClick}
              selectedNode={selectedNode || undefined}
              enablePhysics={true}
              showLabels={true}
              layout={layout}
              linkDistance={graphLinkDistance}
              nodeScale={graphNodeScale}
            />
          ) : (
            <ObsidianSphere
              nodes={filteredData.nodes}
              edges={filteredData.edges}
              onNodeClick={handleNodeClick}
            />
          )}

          {/* Empty state with glass styling */}
          {filteredData.nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center glass-card p-8 rounded-2xl animate-glass-scale-in">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full glass-panel flex items-center justify-center">
                  <GridNine className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">{t("knowledgeGraph.noNodes")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("knowledgeGraph.adjustFilters")}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Node Detail Panel */}
      {selectedNodeData && (
        <NodeDetailView
          node={selectedNodeData.node}
          relatedNodes={selectedNodeData.relatedNodes}
          connectedEdges={selectedNodeData.connectedEdges}
          onClose={() => setSelectedNode(null)}
          onNavigate={(nodeId) => {
            const node = graphData.nodes.find((n) => n.id === nodeId);
            if (node) {
              setSelectedNode(nodeId);
            }
          }}
          onEdit={handleNodeEditFallback}
          onSaveDetails={handleSaveNodeDetails}
        />
      )}
    </div>
  );
}
