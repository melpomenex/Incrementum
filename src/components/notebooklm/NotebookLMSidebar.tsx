import { useState, useEffect } from "react";
import {
  Plus,
  Globe,
  FileText,
  Youtube,
  Upload,

  RefreshCw,

  BookOpen,
  ChevronDown,
  ChevronRight,
  Link as LinkIcon,
  Check,
  Loader2,
} from "lucide-react";
import {
  notebooklmListSources,
  notebooklmAddSource,
  notebooklmRefreshSource,
  type SourceSummary,
} from "../../api/integrations";

interface NotebookLMSidebarProps {
  notebookId: string;
  notebookTitle: string;
  onSourceSelect?: (source: SourceSummary) => void;
  onCreateNotebook?: () => void;
}

export function NotebookLMSidebar({
  notebookId,
  notebookTitle,
  onSourceSelect,
  onCreateNotebook,
}: NotebookLMSidebarProps) {
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [_isLoading, setIsLoading] = useState(false);
  const [showAddSource, setShowAddSource] = useState(false);
  const [sourceType, setSourceType] = useState<"url" | "youtube" | "text" | "file">("url");
  const [sourceInput, setSourceInput] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  useEffect(() => {
    if (notebookId) {
      loadSources();
    }
  }, [notebookId]);

  const loadSources = async () => {
    setIsLoading(true);
    try {
      const data = await notebooklmListSources(notebookId);
      setSources(data);
    } catch (error) {
      console.error("Failed to load sources:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSource = async () => {
    if (!sourceInput.trim()) return;
    setIsAdding(true);
    try {
      await notebooklmAddSource({
        notebookId,
        kind: sourceType,
        content: sourceInput.trim(),
        title: sourceTitle.trim() || undefined,
      });
      setSourceInput("");
      setSourceTitle("");
      setShowAddSource(false);
      await loadSources();
    } catch (error) {
      console.error("Failed to add source:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRefreshSource = async (sourceId: string) => {
    try {
      await notebooklmRefreshSource(sourceId, notebookId);
      await loadSources();
    } catch (error) {
      console.error("Failed to refresh source:", error);
    }
  };

  const toggleSourceExpanded = (sourceId: string) => {
    const next = new Set(expandedSources);
    if (next.has(sourceId)) {
      next.delete(sourceId);
    } else {
      next.add(sourceId);
    }
    setExpandedSources(next);
  };

  const getSourceIcon = (kind: string) => {
    switch (kind) {
      case "youtube":
        return <Youtube className="w-4 h-4 text-red-500" />;
      case "url":
        return <Globe className="w-4 h-4 text-blue-500" />;
      case "file":
        return <Upload className="w-4 h-4 text-green-500" />;
      case "text":
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSourceTypeLabel = (kind: string) => {
    switch (kind) {
      case "youtube":
        return "YouTube";
      case "url":
        return "Website";
      case "file":
        return "File";
      case "text":
        return "Text";
      default:
        return kind;
    }
  };

  return (
    <div className="w-80 bg-card border-r border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <button
          onClick={onCreateNotebook}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New Notebook
        </button>
      </div>

      {/* Notebook Info */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="w-4 h-4" />
          <span>Current Notebook</span>
        </div>
        <h3 className="font-medium text-foreground mt-1 truncate" title={notebookTitle}>
          {notebookTitle}
        </h3>
        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
          <LinkIcon className="w-3 h-3" />
          <span>{sources.length} source{sources.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Sources Section */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-4 py-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">Sources</h4>
          <button
            onClick={() => setShowAddSource(!showAddSource)}
            className="p-1.5 hover:bg-muted rounded-md transition-colors"
            title="Add source"
          >
            <Plus className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Add Source Panel */}
        {showAddSource && (
          <div className="mx-3 mb-3 p-3 bg-muted rounded-lg border border-border">
            <div className="flex gap-1 mb-2">
              {(["url", "youtube", "text", "file"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setSourceType(type)}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                    sourceType === type
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  {getSourceTypeLabel(type)}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={sourceTitle}
              onChange={(e) => setSourceTitle(e.target.value)}
              placeholder="Title (optional)"
              className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-md mb-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <textarea
              value={sourceInput}
              onChange={(e) => setSourceInput(e.target.value)}
              placeholder={
                sourceType === "url"
                  ? "https://example.com"
                  : sourceType === "youtube"
                  ? "https://youtube.com/watch?v=..."
                  : sourceType === "file"
                  ? "/path/to/file.pdf"
                  : "Paste your text here..."
              }
              className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-md mb-2 min-h-[60px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddSource}
                disabled={isAdding || !sourceInput.trim()}
                className="flex-1 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isAdding ? (
                  <span className="flex items-center justify-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Adding...
                  </span>
                ) : (
                  "Add Source"
                )}
              </button>
              <button
                onClick={() => setShowAddSource(false)}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:bg-background rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Sources List */}
        <div className="flex-1 overflow-y-auto px-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-8 px-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                <FileText className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No sources yet. Add sources to start chatting.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {sources.map((source) => (
                <div key={source.id}>
                  <button
                    onClick={() => {
                      setSelectedSourceId(source.id);
                      onSourceSelect?.(source);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      selectedSourceId === source.id
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted border border-transparent"
                    }`}
                  >
                    {getSourceIcon(source.kind)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {source.title}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{getSourceTypeLabel(source.kind)}</span>
                        <span>•</span>
                        <span className={source.status === "ready" ? "text-green-600" : ""}>
                          {source.status === "ready" ? (
                            <span className="flex items-center gap-0.5">
                              <Check className="w-3 h-3" />
                              Ready
                            </span>
                          ) : (
                            source.status
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSourceExpanded(source.id);
                        }}
                        className="p-1 hover:bg-background rounded"
                      >
                        {expandedSources.has(source.id) ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </button>
                  
                  {/* Expanded Actions */}
                  {expandedSources.has(source.id) && (
                    <div className="mx-3 mb-2 px-3 py-2 bg-muted/50 rounded-lg flex items-center gap-1">
                      <button
                        onClick={() => handleRefreshSource(source.id)}
                        className="p-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-background rounded transition-colors flex items-center gap-1"
                        title="Refresh source"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Refresh
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
