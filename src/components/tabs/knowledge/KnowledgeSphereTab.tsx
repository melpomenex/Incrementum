/**
 * Knowledge Sphere Tab
 * Beautiful 3D globe visualization of your knowledge
 */

import { useEffect, useState } from "react";
import { ObsidianSphere } from "../../graph/ObsidianSphere";
import { GraphNodeType, type GraphNode, type GraphEdge } from "../../graph/KnowledgeGraph";
import { invokeCommand } from "../../../lib/tauri";
import { useCollectionStore } from "../../../stores/collectionStore";
import { Sparkles, RefreshCw, Info } from "lucide-react";

export function KnowledgeSphereTab() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const activeCollectionId = useCollectionStore((state) => state.activeCollectionId);

  const loadData = async () => {
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

      const graphNodes: GraphNode[] = [];
      const graphEdges: GraphEdge[] = [];

      // Add documents
      documents.filter((doc: any) => inActiveCollection(doc.id)).forEach((doc: any) => {
        graphNodes.push({
          id: `doc-${doc.id}`,
          type: GraphNodeType.Document,
          label: doc.title || "Untitled",
          x: 0,
          y: 0,
          color: "#3b82f6",
          category: doc.category,
        });
      });

      // Add extracts
      extracts.filter((extract: any) => inActiveCollection(extract.documentId)).forEach((extract: any) => {
        graphNodes.push({
          id: `extract-${extract.id}`,
          type: GraphNodeType.Extract,
          label: extract.content?.substring(0, 30) + "..." || "Extract",
          x: 0,
          y: 0,
          color: "#22c55e",
        });

        graphEdges.push({
          id: `edge-extract-${extract.id}`,
          source: `doc-${extract.documentId}`,
          target: `extract-${extract.id}`,
          type: "contains",
        });
      });

      // Add flashcards
      learningItems.filter((item: any) => inActiveCollection(item.documentId)).forEach((item: any) => {
        graphNodes.push({
          id: `card-${item.id}`,
          type: GraphNodeType.Flashcard,
          label: item.question?.substring(0, 20) + "..." || "Card",
          x: 0,
          y: 0,
          color: "#a855f7",
        });

        if (item.extractId) {
          graphEdges.push({
            id: `edge-card-${item.id}`,
            source: `extract-${item.extractId}`,
            target: `card-${item.id}`,
            type: "derived",
          });
        }
      });

      setNodes(graphNodes);
      setEdges(graphEdges);
    } catch (error) {
      console.error("Failed to load sphere data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeCollectionId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Knowledge Sphere</h2>
                <p className="text-sm text-muted-foreground">
                  3D visualization of your knowledge universe
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
              <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-muted-foreground">Loading knowledge sphere...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Knowledge Sphere</h2>
            <p className="text-sm text-muted-foreground">
              {nodes.length} nodes orbiting your knowledge universe
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-xl text-sm font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* 3D Sphere */}
      <div className="flex-1 relative">
        <ObsidianSphere nodes={nodes} edges={edges} showHeader={false} />

        {/* Quick stats overlay */}
        <div className="absolute bottom-6 left-6 bg-card/90 backdrop-blur border border-border rounded-xl shadow-lg p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">Documents:</span>
              <span className="font-medium">
                {nodes.filter((n) => n.type === GraphNodeType.Document).length}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-muted-foreground">Extracts:</span>
              <span className="font-medium">
                {nodes.filter((n) => n.type === GraphNodeType.Extract).length}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-muted-foreground">Flashcards:</span>
              <span className="font-medium">
                {nodes.filter((n) => n.type === GraphNodeType.Flashcard).length}
              </span>
            </div>
            <div className="pt-2 border-t border-border mt-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Connections:</span>
                <span className="font-medium">{edges.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Help tip */}
        <div className="absolute bottom-6 right-6 bg-card/90 backdrop-blur border border-border rounded-xl shadow-lg p-4 max-w-xs">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Navigation Tips</p>
              <ul className="space-y-1">
                <li>• Drag to rotate the sphere</li>
                <li>• Scroll to zoom in/out</li>
                <li>• Click a node to focus</li>
                <li>• Toggle grid & connections</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
