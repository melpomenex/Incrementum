import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Brain,
  Settings,
  Loader2,
  AlertCircle,
  Check,
  ChevronDown,
  RefreshCw,
  X,
} from "lucide-react";
import { NotebookLMSidebar } from "../components/notebooklm/NotebookLMSidebar";
import { NotebookLMChat } from "../components/notebooklm/NotebookLMChat";
import { NotebookLMStudio } from "../components/notebooklm/NotebookLMStudio";
import { NotebookLMLoginPanel } from "../components/notebooklm/NotebookLMLoginPanel";
import { ArtifactViewer, type ArtifactType } from "../components/notebooklm/artifacts";
import {
  notebooklmGetSettings,
  notebooklmSetSettings,
  notebooklmConnect,
  notebooklmDisconnect,
  notebooklmHealth,
  notebooklmListNotebooks,
  notebooklmCreateNotebook,
  notebooklmSelectNotebook,
  notebooklmGetJob,
  type NotebookSummary,
  type ImportPreviewItem,
  type NotebookLMJob,
} from "../api/integrations";
import { useSettingsStore } from "../stores/settingsStore";
import { useToast } from "../components/common/Toast";

type ConnectionState = "checking" | "connected" | "disconnected" | "error";

export function NotebookLMPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { settings, updateSettingsCategory } = useSettingsStore();
  
  const [connectionState, setConnectionState] = useState<ConnectionState>("checking");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [provider, setProvider] = useState<"mock" | "cli">("cli");
  const [notebooks, setNotebooks] = useState<NotebookSummary[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<NotebookSummary | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newNotebookTitle, setNewNotebookTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [viewingArtifact, setViewingArtifact] = useState<NotebookLMJob | null>(null);
  const [artifactContent, setArtifactContent] = useState<string | null>(null);

  // Check connection on mount
  useEffect(() => {
    checkConnection();
  }, []);

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`));
      }, ms);
      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  };

  const checkConnection = async () => {
    setConnectionState("checking");
    try {
      const health = await withTimeout(notebooklmHealth(), 12000, "NotebookLM health check");
      if (health.connected) {
        setConnectionState("connected");
        setConnectionMessage(health.message);

        try {
          const all = await withTimeout(
            notebooklmListNotebooks(),
            12000,
            "NotebookLM notebook list"
          );
          setNotebooks(all);

          // Select active notebook if available
          if (health.activeNotebookId) {
            const active = all.find((n) => n.id === health.activeNotebookId);
            if (active) {
              setSelectedNotebook(active);
            }
          } else if (all.length > 0) {
            setSelectedNotebook(all[0]);
          }
        } catch (listError: any) {
          setConnectionState("error");
          setConnectionMessage(
            listError?.message || "Connected, but failed to load notebooks"
          );
          setNotebooks([]);
          setSelectedNotebook(null);
        }
      } else {
        setConnectionState("disconnected");
        setConnectionMessage("Not connected to NotebookLM");
      }
    } catch (error: any) {
      setConnectionState("error");
      setConnectionMessage(error.message || "Failed to check connection");
    }
  };

  const [isCLIAvailable, setIsCLIAvailable] = useState<boolean | null>(null);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await notebooklmConnect({ provider });
      await notebooklmSetSettings({ enabled: true, provider });
      updateSettingsCategory("features", { notebooklmEnabled: true });
      await checkConnection();
    } catch (error: any) {
      setConnectionState("error");
      setConnectionMessage(error.message || "Failed to connect");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCLIAuthChange = (isAuthenticated: boolean) => {
    setIsCLIAvailable(isAuthenticated);
    if (isAuthenticated) {
      // Auto-connect when CLI becomes authenticated
      handleConnect();
    }
  };

  const handleDisconnect = async () => {
    try {
      await notebooklmDisconnect();
      setConnectionState("disconnected");
      setSelectedNotebook(null);
      setNotebooks([]);
    } catch (error: any) {
      console.error("Failed to disconnect:", error);
    }
  };

  const handleSelectNotebook = async (notebook: NotebookSummary) => {
    setSelectedNotebook(notebook);
    try {
      await notebooklmSelectNotebook(notebook.id);
    } catch (error) {
      console.error("Failed to select notebook:", error);
    }
  };

  const handleCreateNotebook = async () => {
    if (!newNotebookTitle.trim()) return;
    setIsCreating(true);
    try {
      const notebook = await notebooklmCreateNotebook(newNotebookTitle.trim());
      setNotebooks((prev) => [...prev, notebook]);
      setSelectedNotebook(notebook);
      await notebooklmSelectNotebook(notebook.id);
      setNewNotebookTitle("");
    } catch (error: any) {
      console.error("Failed to create notebook:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSyncToIncrementum = (items: ImportPreviewItem[]) => {
    toast.success(
      "Synced to Incrementum",
      `${items.length} item${items.length !== 1 ? "s" : ""} added to your queue for review.`
    );
  };

  const handleViewArtifact = async (job: NotebookLMJob) => {
    setViewingArtifact(job);
    
    // Debug logging
    console.log("Viewing artifact:", {
      type: job.artifactType,
      payload: job.payload,
      hasJsonContent: !!job.payload?.jsonContent,
      hasMediaUrl: !!job.payload?.mediaUrl,
      hasRawText: !!job.payload?.rawText,
    });
    
    // Get the content based on artifact type
    let content: string;
    
    // Check if this is a structured artifact type that needs jsonContent
    const structuredTypes = ["mind-map", "mind_map", "mindmap", "data-table", "data_table", "datatable"];
    const isStructuredArtifact = structuredTypes.includes(job.artifactType.toLowerCase());
    
    if (isStructuredArtifact) {
      // For structured artifacts like mind-maps and data-tables, prefer jsonContent.
      if (job.payload?.jsonContent !== null && job.payload?.jsonContent !== undefined) {
        content = JSON.stringify(job.payload.jsonContent, null, 2);
      } else {
        // Fallback: some providers may emit JSON into rawText.
        let recoveredJson: unknown = null;
        const raw = job.payload?.rawText?.trim();
        if (raw) {
          try {
            recoveredJson = JSON.parse(raw);
          } catch {
            const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
            if (fenced?.[1]) {
              try {
                recoveredJson = JSON.parse(fenced[1].trim());
              } catch {
                // keep null
              }
            }
          }
        }

        if (recoveredJson !== null) {
          content = JSON.stringify(recoveredJson, null, 2);
        } else {
          const isFailed = job.status === "failed" || job.status === "expired-auth";
          const message = isFailed
            ? (job.error || `This ${job.artifactType} job failed before producing structured output.`)
            : `This ${job.artifactType} did not include structured JSON output. Please regenerate it.`;
          content = JSON.stringify({
            error: isFailed ? "Artifact generation failed" : "Structured content unavailable",
            message,
            jsonContent: null,
            debug: {
              artifactType: job.artifactType,
              status: job.status,
              payloadKeys: job.payload ? Object.keys(job.payload) : [],
            }
          });
        }
      }
    } else if (job.payload?.mediaUrl) {
      // For media artifacts
      content = JSON.stringify({
        url: job.payload.mediaUrl,
        description: job.payload.rawText || `${job.artifactType} overview`,
      }, null, 2);
    } else if (job.payload?.rawText) {
      // For text-based artifacts like reports
      content = job.payload.rawText;
    } else {
      // Fallback
      content = JSON.stringify({
        flashcards: job.payload?.flashcards || [],
        quizItems: job.payload?.quizItems || [],
      }, null, 2);
    }
    
    setArtifactContent(content);
  };

  const handleAddArtifactToQueue = () => {
    toast.success("Added to Queue", "Content has been added to your review queue.");
    setViewingArtifact(null);
  };

  // Connection Overlay
  if (connectionState === "checking") {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Connecting to NotebookLM...</p>
        </div>
      </div>
    );
  }

  // Not Connected State
  if (connectionState === "disconnected" || connectionState === "error") {
    return (
      <div className="h-full flex flex-col bg-background">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">NotebookLM</h1>
          </div>
        </div>

        {/* Connection Form */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-card border border-border rounded-xl p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Connect to NotebookLM
              </h2>
              <p className="text-muted-foreground">
                Import sources, chat with your documents, and generate study materials.
              </p>
            </div>

            {connectionState === "error" && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{connectionMessage}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Provider
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as "mock" | "cli")}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="cli">CLI (notebooklm command)</option>
                  <option value="mock">Mock (for testing)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Requires the notebooklm-py CLI to be installed and authenticated.
                </p>
              </div>

              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect to NotebookLM"
                )}
              </button>

              <div className="text-center">
                <a
                  href="https://github.com/teng-lin/notebooklm-py"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Learn more about notebooklm-py →
                </a>
              </div>

              {/* CLI Login Panel */}
              {provider === "cli" && (
                <div className="mt-6 pt-6 border-t border-border">
                  <NotebookLMLoginPanel onAuthChange={handleCLIAuthChange} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main Connected UI
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">NotebookLM</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Check className="w-3 h-3 text-green-500" />
                Connected
              </span>
              <span>•</span>
              <span>{notebooks.length} notebook{notebooks.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Notebook Selector */}
          <div className="relative">
            <select
              value={selectedNotebook?.id || ""}
              onChange={(e) => {
                const notebook = notebooks.find((n) => n.id === e.target.value);
                if (notebook) handleSelectNotebook(notebook);
              }}
              className="appearance-none pl-3 pr-10 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-w-[200px]"
            >
              {notebooks.map((notebook) => (
                <option key={notebook.id} value={notebook.id}>
                  {notebook.title}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Provider:</span>
            <span className="text-sm font-medium text-foreground">{provider}</span>
          </div>
          <div className="flex-1" />
          <button
            onClick={checkConnection}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-background rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={handleDisconnect}
            className="px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
          >
            Disconnect
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {selectedNotebook ? (
          <>
            <NotebookLMSidebar
              notebookId={selectedNotebook.id}
              notebookTitle={selectedNotebook.title}
              onCreateNotebook={() => {
                const title = prompt("Enter notebook title:");
                if (title) {
                  setNewNotebookTitle(title);
                  handleCreateNotebook();
                }
              }}
            />
            <NotebookLMChat
              notebookId={selectedNotebook.id}
              notebookTitle={selectedNotebook.title}
            />
            <NotebookLMStudio
              notebookId={selectedNotebook.id}
              onSyncToIncrementum={handleSyncToIncrementum}
              onViewArtifact={handleViewArtifact}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                <Brain className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                No notebook selected
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create a new notebook to get started.
              </p>
              <button
                onClick={() => {
                  const title = prompt("Enter notebook title:") || "New Notebook";
                  setNewNotebookTitle(title);
                  handleCreateNotebook();
                }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Create Notebook
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Artifact Viewer Modal */}
      {viewingArtifact && artifactContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-4xl h-[80vh] bg-background rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-foreground">
                  {viewingArtifact.artifactType.charAt(0).toUpperCase() + viewingArtifact.artifactType.slice(1)}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {new Date(viewingArtifact.updatedAt).toLocaleDateString()}
                </span>
              </div>
              <button
                onClick={() => {
                  setViewingArtifact(null);
                  setArtifactContent(null);
                }}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ArtifactViewer
                type={viewingArtifact.artifactType as ArtifactType}
                content={artifactContent}
                title={`${viewingArtifact.artifactType} - ${selectedNotebook?.title || ""}`}
                notebookId={viewingArtifact.notebookId}
                artifactId={viewingArtifact.id}
                onAddToQueue={handleAddArtifactToQueue}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
