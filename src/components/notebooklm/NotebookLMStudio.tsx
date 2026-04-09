import { useState, useEffect } from "react";
import { useI18n } from "../../lib/i18n";
import {
  Wand2,
  Loader2,
  Check,
  AlertCircle,
  Download,
  Sparkles,
  Headphones,
  Video,
  FileText,
  Layers,
  BrainCircuit,
  Table,
  Map,
  RefreshCw,
  Upload,
  ChevronDown,
  ChevronUp,
  Eye,
} from "lucide-react";
import {
  notebooklmGenerateArtifact,
  notebooklmGetJobs,
  notebooklmPreviewFlashcards,
  notebooklmPreviewQuizImport,
  notebooklmSyncPreviewItems,
  notebooklmExportJobArtifact,
  type NotebookLMJob,
  type ImportPreviewItem,
} from "../../api/integrations";
import { ArtifactViewer, type ArtifactType } from "./artifacts";

interface NotebookLMStudioProps {
  notebookId: string;
  onSyncToIncrementum?: (items: ImportPreviewItem[]) => void;
  onViewArtifact?: (job: NotebookLMJob) => void;
}

const ARTIFACT_TYPES = [
  {
    id: "flashcards",
    labelKey: "notebooklmStudio.flashcards",
    descKey: "notebooklmStudio.flashcardsDesc",
    icon: Layers,
    color: "bg-blue-500",
    canImport: true,
  },
  {
    id: "quiz",
    labelKey: "notebooklmStudio.quiz",
    descKey: "notebooklmStudio.quizDesc",
    icon: BrainCircuit,
    color: "bg-purple-500",
    canImport: true,
  },
  {
    id: "audio",
    labelKey: "notebooklmStudio.audioOverview",
    descKey: "notebooklmStudio.audioOverviewDesc",
    icon: Headphones,
    color: "bg-emerald-500",
    canImport: false,
  },
  {
    id: "video",
    labelKey: "notebooklmStudio.videoOverview",
    descKey: "notebooklmStudio.videoOverviewDesc",
    icon: Video,
    color: "bg-pink-500",
    canImport: false,
  },
  {
    id: "report",
    labelKey: "notebooklmStudio.studyGuide",
    descKey: "notebooklmStudio.studyGuideDesc",
    icon: FileText,
    color: "bg-amber-500",
    canImport: false,
  },
  {
    id: "mind-map",
    labelKey: "notebooklmStudio.mindMap",
    descKey: "notebooklmStudio.mindMapDesc",
    icon: Map,
    color: "bg-cyan-500",
    canImport: false,
  },
  {
    id: "data-table",
    labelKey: "notebooklmStudio.dataTable",
    descKey: "notebooklmStudio.dataTableDesc",
    icon: Table,
    color: "bg-indigo-500",
    canImport: false,
  },
];

export function NotebookLMStudio({ notebookId, onSyncToIncrementum, onViewArtifact }: NotebookLMStudioProps) {
  const { t } = useI18n();
  const [jobs, setJobs] = useState<NotebookLMJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generatingType, setGeneratingType] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<NotebookLMJob | null>(null);
  const [previewItems, setPreviewItems] = useState<ImportPreviewItem[]>([]);
  const [previewMode, setPreviewMode] = useState<"all" | "missed-only">("all");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [showJobs, setShowJobs] = useState(true);
  const [deckName, setDeckName] = useState("NotebookLM Imports");
  const [syncResult, setSyncResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);

  useEffect(() => {
    if (notebookId) {
      loadJobs();
    }
  }, [notebookId]);

  const loadJobs = async () => {
    setIsLoading(true);
    try {
      const data = await notebooklmGetJobs(20);
      setJobs(data);
    } catch (error) {
      console.error("Failed to load jobs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async (artifactType: string) => {
    if (!notebookId) return;
    setGeneratingType(artifactType);
    try {
      await notebooklmGenerateArtifact({
        notebookId,
        artifactType,
        retryCount: 1,
      });
      await loadJobs();
    } catch (error) {
      console.error("Failed to generate artifact:", error);
    } finally {
      setGeneratingType(null);
    }
  };

  const handleSelectJob = async (job: NotebookLMJob) => {
    setSelectedJob(job);
    // Flashcards and quiz can be imported
    const canImport = job.artifactType === "flashcards" || job.artifactType === "quiz";
    if (canImport) {
      setIsPreviewLoading(true);
      try {
        let preview: ImportPreviewItem[];
        if (job.artifactType === "quiz") {
          preview = await notebooklmPreviewQuizImport(job.id, previewMode);
        } else {
          preview = await notebooklmPreviewFlashcards(job.id);
        }
        setPreviewItems(preview);
      } catch (error) {
        console.error("Failed to load preview:", error);
        setPreviewItems([]);
      } finally {
        setIsPreviewLoading(false);
      }
    }
  };

  const handleExport = async (format: "json" | "markdown" | "html") => {
    if (!selectedJob) return;
    try {
      const result = await notebooklmExportJobArtifact(selectedJob.id, format);
      const blob = new Blob([result.content], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export:", error);
    }
  };

  const handleSync = async () => {
    if (previewItems.length === 0) return;
    try {
      const result = await notebooklmSyncPreviewItems({
        previewItems,
        deckName: deckName || "NotebookLM Imports",
        dedupe: true,
      });
      setSyncResult(result);
      onSyncToIncrementum?.(previewItems);
    } catch (error) {
      console.error("Failed to sync:", error);
    }
  };

  const updatePreviewItem = (index: number, field: "question" | "answer", value: string) => {
    const updated = [...previewItems];
    updated[index] = { ...updated[index], [field]: value };
    setPreviewItems(updated);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "succeeded":
        return <Check className="w-4 h-4 text-green-500" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "running":
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      default:
        return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
    }
  };

  const getArtifactTypeInfo = (type: string) => {
    return ARTIFACT_TYPES.find((t) => t.id === type) || {
      labelKey: type,
      descKey: "",
      icon: Sparkles,
      color: "bg-gray-500",
      canImport: false,
    };
  };

  const canViewArtifact = (job: NotebookLMJob) => {
    return ["audio", "video", "report", "mind-map", "data-table", "slide-deck", "infographic"].includes(job.artifactType);
  };

  return (
    <div className="w-96 bg-card border-l border-border flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Wand2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{t("notebooklmStudio.title")}</h3>
            <p className="text-xs text-muted-foreground">{t("notebooklmStudio.generateStudyMaterials")}</p>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Generate Section */}
        <div className="p-4">
          <h4 className="text-sm font-medium text-foreground mb-3">{t("notebooklmStudio.create")}</h4>
          <div className="grid grid-cols-2 gap-2">
            {ARTIFACT_TYPES.map((type) => {
              const Icon = type.icon;
              const isGenerating = generatingType === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => handleGenerate(type.id)}
                  disabled={isGenerating || !notebookId}
                  className="flex flex-col items-center gap-2 p-3 bg-background border border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50 text-left"
                >
                  <div className={`w-8 h-8 ${type.color} rounded-lg flex items-center justify-center`}>
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <Icon className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-foreground">{t(type.labelKey)}</p>
                    <p className="text-[10px] text-muted-foreground">{type.descKey ? t(type.descKey) : ""}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Jobs Section */}
        <div className="border-t border-border">
          <button
            onClick={() => setShowJobs(!showJobs)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{t("notebooklmStudio.recentJobs")}</span>
              {jobs.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-muted text-muted-foreground rounded-full">
                  {jobs.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  loadJobs();
                }}
                disabled={isLoading}
                className="p-1 hover:bg-background rounded transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${isLoading ? "animate-spin" : ""}`} />
              </button>
              {showJobs ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </button>

          {showJobs && (
            <div className="px-4 pb-4 space-y-2 max-h-48 overflow-y-auto">
              {jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("notebooklmStudio.noJobsYet")}
                </p>
              ) : (
                jobs.map((job) => {
                  const typeInfo = getArtifactTypeInfo(job.artifactType);
                  const Icon = typeInfo.icon;
                  const isSelected = selectedJob?.id === job.id;

                  return (
                    <div
                      key={job.id}
                      className={`w-full flex items-center gap-2 p-2.5 rounded-lg text-left transition-colors ${
                        isSelected
                          ? "bg-primary/10 border border-primary/20"
                          : "bg-background border border-border hover:border-primary/30"
                      }`}
                    >
                      <button
                        onClick={() => handleSelectJob(job)}
                        className="flex-1 flex items-center gap-2 min-w-0"
                      >
                        <div className={`w-8 h-8 ${typeInfo.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {t(typeInfo.labelKey)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(job.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </button>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(job.status)}
                        {canViewArtifact(job) && (
                          <button
                            onClick={() => onViewArtifact?.(job)}
                            className="p-1.5 hover:bg-background rounded-md transition-colors"
                            title={t("notebooklmStudio.viewArtifact")}
                          >
                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Preview Section */}
        {selectedJob && (
          <div className="border-t border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-foreground">{t("notebooklmStudio.preview")}</h4>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleExport("json")}
                  className="p-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                >
                  JSON
                </button>
                <button
                  onClick={() => handleExport("markdown")}
                  className="p-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                >
                  MD
                </button>
              </div>
            </div>

            {(selectedJob.artifactType === "flashcards" || selectedJob.artifactType === "quiz") ? (
              <>
                {isPreviewLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : previewItems.length > 0 ? (
                  <>
                    <div className="mb-3">
                      <input
                        type="text"
                        value={deckName}
                        onChange={(e) => setDeckName(e.target.value)}
                        placeholder={t("notebooklmStudio.deckNamePlaceholder")}
                        className="w-full px-2.5 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {previewItems.map((item, idx) => (
                        <div
                          key={`${item.sourceArtifactId}-${idx}`}
                          className="p-3 bg-background border border-border rounded-lg"
                        >
                          <input
                            value={item.question}
                            onChange={(e) => updatePreviewItem(idx, "question", e.target.value)}
                            className="w-full px-2 py-1 text-sm font-medium bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary/50 rounded"
                          />
                          <textarea
                            value={item.answer}
                            onChange={(e) => updatePreviewItem(idx, "answer", e.target.value)}
                            className="w-full px-2 py-1 text-sm text-muted-foreground bg-transparent border-none resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 rounded mt-1"
                            rows={2}
                          />
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleSync}
                      className="w-full mt-3 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      {t("notebooklmStudio.syncToIncrementum")}
                    </button>

                    {syncResult && (
                      <div className="mt-2 text-xs text-center text-green-600">
                        Created: {syncResult.created}, Updated: {syncResult.updated}, Skipped: {syncResult.skipped}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t("notebooklmStudio.noPreviewItems")}
                  </p>
                )}
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-2">
                  {t("notebooklmStudio.dedicatedViewer")}
                </p>
                <button
                  onClick={() => onViewArtifact?.(selectedJob)}
                  className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 mx-auto"
                >
                  <Eye className="w-4 h-4" />
                  {t("notebooklmStudio.viewArtifact")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
