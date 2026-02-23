/**
 * Continue Reading Tab (Tauri + tabbed UI)
 *
 * Mirrors the web ContinueReadingPage, but opens documents in tabs instead of
 * navigating routes.
 */

import { useEffect, useMemo, useState, lazy } from "react";
import { getDocumentsWithProgress } from "../../api/position";
import {
  type DocumentWithProgress,
  getProgressGroup,
  PROGRESS_GROUPS,
  type ProgressGroup,
} from "../../types/position";
import { useTabsStore } from "../../stores";
import { useDocumentStore } from "../../stores/documentStore";

const DocumentViewer = lazy(() =>
  import("../viewer/DocumentViewerWrapper").then((m) => ({ default: m.DocumentViewer }))
);

interface GroupedDocuments {
  group: ProgressGroup;
  info: (typeof PROGRESS_GROUPS)[ProgressGroup];
  documents: DocumentWithProgress[];
}

function formatTimeAgo(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return `${Math.floor(seconds / 604800)}w ago`;
}

export function ContinueReadingTab() {
  const addTab = useTabsStore((state) => state.addTab);
  const documentsInStore = useDocumentStore((state) => state.documents);

  const [documents, setDocuments] = useState<DocumentWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const docs = await getDocumentsWithProgress(50);
        // Show all non-archived documents that are not completed
        // Include documents with no progress (not started) so users can start reading anything
        setDocuments(docs.filter((d) => d.progress < 100));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load documents");
        console.error("Failed to load continue reading:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const groups: GroupedDocuments[] = useMemo(() => {
    const grouped = documents.reduce<Record<ProgressGroup, DocumentWithProgress[]>>((acc, doc) => {
      const group = getProgressGroup(doc.progress);
      if (!acc[group]) acc[group] = [];
      acc[group].push(doc);
      return acc;
    }, {} as Record<ProgressGroup, DocumentWithProgress[]>);

    return Object.entries(grouped)
      .filter(([group]) => group !== "completed")
      .map(([group, docs]) => ({
        group: group as ProgressGroup,
        info: PROGRESS_GROUPS[group as ProgressGroup],
        documents: docs.sort((a, b) => b.date_modified - a.date_modified),
      }))
      .sort((a, b) => {
        const priority = { "not-started": 0, "just-started": 1, halfway: 2, "almost-done": 3 } as const;
        return priority[a.group] - priority[b.group];
      });
  }, [documents]);

  const openDocument = (doc: DocumentWithProgress) => {
    const full = documentsInStore.find((d) => d.id === doc.id);
    const fileType = full?.fileType;
    const icon = fileType === "pdf"
      ? "📕"
      : fileType === "epub"
        ? "📖"
        : fileType === "youtube"
          ? "📺"
          : "📄";

    addTab({
      title: doc.title,
      icon,
      type: "document-viewer",
      content: DocumentViewer,
      closable: true,
      data: { documentId: doc.id },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading continue reading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-destructive mb-4">Failed to load documents</div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <div className="text-6xl mb-4">📚</div>
        <div className="text-lg font-medium text-foreground">No items available</div>
        <div className="text-sm mt-2">Add documents or notes to see them here</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Continue Reading</h1>
        <p className="text-muted-foreground mt-1">Pick up where you left off</p>
      </div>

      {groups.map(({ group, info, documents }) => (
        documents.length > 0 ? (
          <div key={group} className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">{info.icon}</span>
              <h2 className="text-lg font-semibold text-foreground">{info.label}</h2>
              <span className="text-sm text-muted-foreground">({documents.length})</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => openDocument(doc)}
                  className="text-left p-4 bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow border border-border"
                >
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <h3 className="font-medium text-foreground line-clamp-2 flex-1">
                      {doc.title}
                    </h3>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimeAgo(doc.date_modified)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min(doc.progress, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {Math.round(doc.progress)}% complete
                      </span>
                      <span className="text-primary font-medium">Resume →</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null
      ))}
    </div>
  );
}

