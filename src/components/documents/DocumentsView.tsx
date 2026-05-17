import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  BookAudio,
  BookOpen,
  Check,
  Clock,
  Download,
  FileText,
  FileText as FileTextIcon,
  Filter,
  Globe,
  Layers,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
  Youtube,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Headphones,
} from "lucide-react";
import { useDocumentStore } from "../../stores/documentStore";
import { useCollectionStore } from "../../stores/collectionStore";
import { useStudyDeckStore } from "../../stores/studyDeckStore";
import { AnnaArchiveSearch } from "../import/AnnaArchiveSearch";
import { ArxivImportDialog } from "../import/ArxivImportDialog";
import { WebArticleImportDialog } from "../import/WebArticleImportDialog";
import { AudiobookImportDialog } from "../import/AudiobookImportDialog";
import { ImportProgressIndicator } from "../import/ImportProgressIndicator";
import { MarkdownBundlePreview } from "../import/MarkdownBundlePreview";
import type { ImportBundleOptions } from "../import/MarkdownBundlePreview";
import { EmptyDocuments, EmptySearch } from "../common/EmptyState";
import { ConfirmDialog, useConfirmDialog } from "../common/ConfirmDialog";
import { DocumentCardSkeleton, DocumentGridSkeleton } from "../common/Skeleton";
import { DragDropUpload } from "../common/DragDropUpload";
import type { MarkdownBundle } from "../../utils/markdownBundleImport";
import { useMarkdownBundleImport } from "../../hooks/useMarkdownBundleImport";
import type { Document } from "../../types/document";
import {
  DocumentSortDirection,
  DocumentSortKey,
  DocumentViewMode,
  SMART_SECTION_LABELS,
  formatRelativeTime,
  getLastTouched,
  getNextAction,
  getPriorityReason,
  getPrioritySignal,
  getPriorityTier,
  getProgressSegments,
  getSmartSection,
  matchesDocumentSearch,
  parseDocumentSearch,
  sortDocuments,
} from "../../utils/documentsView";
import {
  importYouTubeVideo,
  resolveDocumentCover,
  updateDocument as updateDocumentApi,
} from "../../api/documents";
import { getYouTubeThumbnail, extractYouTubeTimestamp } from "../../api/youtube";
import { getDeviceInfo } from "../../lib/pwa";
import { invokeCommand, isTauri, isMac } from "../../lib/tauri";
import { importAnkiPackage } from "../../utils/ankiImport";
import { useI18n } from "../../lib/i18n";
import { findCompanionDoc } from "../../utils/documentPairing";
import { useTranscriptionQueueStore } from "../../stores/transcriptionQueueStore";
import { enqueueAutoTranscription, getTranscriptionQueue } from "../../api/transcription";
import { useSettingsStore } from "../../stores/settingsStore";

const MODE_STORAGE_KEY = "documentsViewMode";
const SAVED_VIEWS_KEY = "documentsSavedViews";
const MAX_VISIBLE_TAGS = 3;

function extractYouTubeId(urlOrId: string): string {
  if (!urlOrId) return "";

  if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) {
    return urlOrId;
  }

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = urlOrId.match(pattern);
    if (match) return match[1];
  }

  return "";
}

function getDocumentCoverUrl(doc: Document): string | null {
  if (doc.coverImageUrl) return doc.coverImageUrl;
  if (doc.fileType === "youtube") {
    const videoId = extractYouTubeId(doc.filePath ?? "");
    return videoId ? getYouTubeThumbnail(videoId) : null;
  }
  return null;
}

function getCoverFallbackIcon(fileType: Document["fileType"]) {
  if (fileType === "youtube") return Youtube;
  if (fileType === "pdf") return FileText;
  if (fileType === "audio") return BookAudio;
  return BookOpen;
}

function coverFallbackGradient(fileType: Document["fileType"]): string {
  switch (fileType) {
    case "pdf": return "bg-gradient-to-br from-red-900/60 via-red-800/30 to-transparent";
    case "epub": return "bg-gradient-to-br from-blue-900/60 via-blue-800/30 to-transparent";
    case "youtube": return "bg-gradient-to-br from-red-950/60 via-red-900/30 to-transparent";
    case "audio": return "bg-gradient-to-br from-amber-900/60 via-amber-800/30 to-transparent";
    case "video": return "bg-gradient-to-br from-violet-900/60 via-violet-800/30 to-transparent";
    case "markdown": return "bg-gradient-to-br from-emerald-900/60 via-emerald-800/30 to-transparent";
    default: return "bg-gradient-to-br from-slate-900/60 via-slate-800/30 to-transparent";
  }
}

type SavedView = {
  id: string;
  name: string;
  query: string;
  sortKey: DocumentSortKey;
  sortDirection: DocumentSortDirection;
  mode: DocumentViewMode;
  showNextAction: boolean;
  fileTypeFilter: string;
};

const defaultSortByKey: Record<DocumentSortKey, DocumentSortDirection> = {
  priority: "desc",
  lastTouched: "desc",
  added: "desc",
  title: "asc",
  type: "asc",
  extracts: "desc",
  cards: "desc",
};

interface DocumentsViewProps {
  onOpenDocument?: (doc: Document) => void;
  onReadAlong?: (audioDoc: Document, epubDoc: Document) => void;
  enableYouTubeImport?: boolean;
}

export function DocumentsView({ onOpenDocument, onReadAlong, enableYouTubeImport = true }: DocumentsViewProps) {
  const { t } = useI18n();
  const {
    documents,
    isLoading,
    isImporting,
    isSegmenting,
    importProgress,
    error,
    loadDocuments,
    openFilePickerAndImport,
    importFromFiles,
    updateDocument,
    deleteDocument,
    segmentDocument,
  } = useDocumentStore();
  const activeCollectionId = useCollectionStore((state) => state.activeCollectionId);
  const collections = useCollectionStore((state) => state.collections);
  const createCollection = useCollectionStore((state) => state.createCollection);

  const [mode, setMode] = useState<DocumentViewMode>(() => {
    if (typeof window === "undefined") return "grid";
    const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
    return stored === "list" ? "list" : "grid";
  });
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortKey, setSortKey] = useState<DocumentSortKey>("priority");
  const [sortDirection, setSortDirection] = useState<DocumentSortDirection>("desc");
  const [showNextAction, setShowNextAction] = useState(true);
  const [selectedFileType, setSelectedFileType] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [listCtxDoc, setListCtxDoc] = useState<{ doc: Document; pos: { x: number; y: number } } | null>(null);
  const listCtxRef = useRef<HTMLDivElement>(null);
  const [listPairPicker, setListPairPicker] = useState<Document | null>(null);
  const [listPairSearch, setListPairSearch] = useState("");

  // Confirmation dialog for destructive actions
  const confirmDialog = useConfirmDialog();

  const deviceInfo = getDeviceInfo();
  const isMobile = deviceInfo.isMobile || deviceInfo.isTablet;
  const [isInspectorOpen, setInspectorOpen] = useState(() => !isMobile);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const [showYouTubeImport, setShowYouTubeImport] = useState(false);
  const [showAnnaArchiveSearch, setShowAnnaArchiveSearch] = useState(false);
  const [showArxivImport, setShowArxivImport] = useState(false);
  const [showWebArticleImport, setShowWebArticleImport] = useState(false);
  const [showAudiobookImport, setShowAudiobookImport] = useState(false);
  const [showMarkdownBundlePreview, setShowMarkdownBundlePreview] = useState(false);
  const [detectedBundle, setDetectedBundle] = useState<MarkdownBundle | null>(null);
  const [, setBundleFiles] = useState<File[]>([]);
  const { importBundle } = useMarkdownBundleImport();
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [ytdlpAvailable, setYtdlpAvailable] = useState<boolean | null>(null);
  const [ytdlpInstalling, setYtdlpInstalling] = useState(false);
  const [ytdlpInstallMessage, setYtdlpInstallMessage] = useState<string | null>(null);

  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = window.localStorage.getItem(SAVED_VIEWS_KEY);
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored) as SavedView[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 100);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MODE_STORAGE_KEY, mode);
    }
  }, [mode]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(savedViews));
    }
  }, [savedViews]);

  useEffect(() => {
    if (!showYouTubeImport) return;
    setYtdlpInstallMessage(null);
    if (!isTauri()) {
      setYtdlpAvailable(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const available = await invokeCommand<boolean>("check_ytdlp");
        if (!cancelled) {
          setYtdlpAvailable(available);
          if (available) {
            setYtdlpInstallMessage(null);
          }
        }
      } catch {
        if (!cancelled) {
          setYtdlpAvailable(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showYouTubeImport]);

  const searchTokens = useMemo(() => parseDocumentSearch(debouncedSearch), [debouncedSearch]);

  // Get unique file types for filter dropdown
  const availableFileTypes = useMemo(() => {
    const types = new Set(documents.map((doc) => doc.fileType));
    return Array.from(types).sort();
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    let base = documents.filter((doc) => matchesDocumentSearch(doc, searchTokens));
    // Collection filtering is now handled by the backend (collection_id on documents)
    if (selectedFileType !== "all") {
      base = base.filter((doc) => doc.fileType === selectedFileType);
    }
    return base;
  }, [documents, searchTokens, selectedFileType]);

  const sortedDocuments = useMemo(() => {
    return sortDocuments(filteredDocuments, sortKey, sortDirection);
  }, [filteredDocuments, sortKey, sortDirection]);

  // Track which doc IDs we've already processed for cover resolution.
  // This prevents re-firing resolveDocumentCover on every sortedDocuments change.
  const processedDocIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isTauri() || mode !== "grid") return;

    const pendingDocs = sortedDocuments.filter((doc) => {
      if (doc.coverImageUrl || doc.coverImageSource === "fallback") return false;
      if (processedDocIdsRef.current.has(doc.id)) return false;
      return true;
    });

    if (pendingDocs.length === 0) return;

    pendingDocs.forEach((doc) => {
      processedDocIdsRef.current.add(doc.id);
      resolveDocumentCover(doc.id)
        .then((updated) => {
          if (!updated) return;
          // Only update if cover actually changed
          const current = useDocumentStore.getState().documents.find(d => d.id === doc.id);
          if (current?.coverImageUrl === updated.coverImageUrl) return;
          updateDocument(doc.id, {
            coverImageUrl: updated.coverImageUrl,
            coverImageSource: updated.coverImageSource,
          });
        })
        .catch((error) => {
          console.warn(`Failed to resolve cover for document ${doc.id}:`, error);
        });
    });
  }, [mode, sortedDocuments, updateDocument]);

  const sectionedDocuments = useMemo(() => {
    const sections: Record<string, Document[]> = {};
    for (const doc of sortedDocuments) {
      const section = getSmartSection(doc);
      if (!sections[section]) sections[section] = [];
      sections[section].push(doc);
    }
    return sections;
  }, [sortedDocuments]);

  useEffect(() => {
    const visibleIds = new Set(sortedDocuments.map((doc) => doc.id));
    setSelectedIds((prev) => new Set(Array.from(prev).filter((id) => visibleIds.has(id))));
    if (activeId && !visibleIds.has(activeId)) {
      setActiveId(sortedDocuments[0]?.id ?? null);
    }
  }, [sortedDocuments, activeId]);

  const handleImport = useCallback(async () => {
    try {
      const importedDocs = await openFilePickerAndImport();
      if (onOpenDocument && importedDocs.length > 0) {
        onOpenDocument(importedDocs[0]);
      }
    } catch (err) {
      console.error("Failed to import documents:", err);
    }
  }, [openFilePickerAndImport, onOpenDocument]);

  useEffect(() => {
    const handleImportShortcut = () => {
      void handleImport();
    };

    window.addEventListener("import-document", handleImportShortcut as EventListener);
    return () =>
      window.removeEventListener("import-document", handleImportShortcut as EventListener);
  }, [handleImport]);

  // Handle files from drag and drop upload component
  const handleDragDropFiles = useCallback(
    async (filePaths: string[]) => {
      if (filePaths.length === 0) return;
      try {
        const importedDocs = await importFromFiles(filePaths);
        if (onOpenDocument && importedDocs.length > 0) {
          onOpenDocument(importedDocs[0]);
        }
      } catch (err) {
        console.error("Failed to import dropped files:", err);
      }
    },
    [importFromFiles, onOpenDocument]
  );

  // Handle Anki package import
  const handleAnkiPackage = useCallback(
    async (filePath: string) => {
      try {
        const decks = await importAnkiPackage(filePath);
        console.log(`Imported ${decks.length} decks from Anki package`);
        // TODO: Show a dialog to let user select which decks to import
        // For now, just log success
        await loadDocuments();
      } catch (err) {
        console.error("Failed to import Anki package:", err);
      }
    },
    [loadDocuments]
  );

  // Handle JSON deck import
  const handleStudyJsonDeck = useCallback(
    async (filePath: string) => {
      try {
        const result = await invokeCommand<{ deck_name: string; cards_imported: number }>(
          "import_study_json_file",
          { filePath }
        );
        useStudyDeckStore.getState().ensureDecksExist([result.deck_name]);
        console.log("JSON deck imported successfully");
        await loadDocuments();
      } catch (err) {
        console.error("Failed to import JSON deck:", err);
      }
    },
    [loadDocuments]
  );

  // Handle markdown bundle detection
  const handleBundleDetected = useCallback((bundle: MarkdownBundle, files: File[]) => {
    console.log("[DocumentsView] Markdown bundle detected:", bundle);
    setDetectedBundle(bundle);
    setBundleFiles(files);
    setShowMarkdownBundlePreview(true);
  }, []);

  // Handle markdown bundle import
  const handleBundleImport = useCallback(
    async (options: ImportBundleOptions) => {
      if (!detectedBundle) return;

      try {
        const doc = await importBundle(detectedBundle, options);
        console.log("[DocumentsView] Bundle imported:", doc);
        await loadDocuments();
        setShowMarkdownBundlePreview(false);
        setDetectedBundle(null);
        setBundleFiles([]);

        if (onOpenDocument) {
          onOpenDocument(doc);
        }
      } catch (err) {
        console.error("[DocumentsView] Failed to import bundle:", err);
        throw err;
      }
    },
    [detectedBundle, importBundle, loadDocuments, onOpenDocument]
  );

  const handleYouTubeImport = async () => {
    if (!youtubeUrl.trim()) {
      setYoutubeError(t("documentsView.pleaseEnterYoutubeUrl"));
      return;
    }
    if (isTauri() && ytdlpAvailable === false) {
      setYoutubeError(t("documentsView.ytdlpNotInstalled"));
      return;
    }
    setYoutubeLoading(true);
    setYoutubeError(null);
    try {
      const document = await importYouTubeVideo(youtubeUrl.trim());

      // Extract timestamp from URL if present (e.g., ?t=933)
      const timestamp = extractYouTubeTimestamp(youtubeUrl.trim());
      if (timestamp !== null && timestamp > 0) {
        // Save the timestamp as the initial video position
        await updateDocumentApi(document.id, { currentPage: timestamp } as any);
      }

      await loadDocuments();
      setShowYouTubeImport(false);
      setYoutubeUrl("");
      if (onOpenDocument) {
        onOpenDocument(document);
      }
    } catch (err) {
      setYoutubeError(err instanceof Error ? err.message : "Failed to import YouTube video");
    } finally {
      setYoutubeLoading(false);
    }
  };

  const handleInstallYtdlp = async () => {
    setYtdlpInstalling(true);
    setYoutubeError(null);
    setYtdlpInstallMessage(null);
    try {
      const version = await invokeCommand<string>("setup_ytdlp_auto");
      setYtdlpAvailable(true);
      setYtdlpInstallMessage(`yt-dlp installed (${version}).`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to install yt-dlp";
      setYtdlpAvailable(false);
      setYoutubeError(message);
    } finally {
      setYtdlpInstalling(false);
    }
  };

  const handleSelectRow = (doc: Document, multiSelect: boolean) => {
    if (multiSelect) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(doc.id)) {
          next.delete(doc.id);
        } else {
          next.add(doc.id);
        }
        return next;
      });
    } else {
      setSelectedIds(new Set([doc.id]));
    }
    setActiveId(doc.id);
  };

  const handleBulkArchive = () => {
    if (selectedIds.size === 0) return;

    const selectedDocs = documents.filter((d) => selectedIds.has(d.id));
    const docTitles = selectedDocs.map((d) => d.title || "Untitled");

    confirmDialog.confirm({
      title: t("documentsView.archiveTitle"),
      message: t("documentsView.archiveMessage", { count: selectedIds.size }),
      variant: "warning",
      itemName: "document",
      itemCount: selectedIds.size,
      details: docTitles,
      onConfirm: () => {
        selectedIds.forEach((id) => {
          updateDocument(id, { isArchived: true });
        });
        setSelectedIds(new Set());
      },
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;

    const selectedDocs = documents.filter((d) => selectedIds.has(d.id));
    const docTitles = selectedDocs.map((d) => d.title || "Untitled");

    confirmDialog.confirm({
      title: t("documentsView.deleteTitle"),
      message: t("documentsView.deleteMessage", { count: selectedIds.size }),
      variant: "danger",
      itemName: "document",
      itemCount: selectedIds.size,
      details: docTitles,
      onConfirm: async () => {
        for (const id of selectedIds) {
          await deleteDocument(id);
        }
        setSelectedIds(new Set());
        setActiveId(null);
      },
    });
  };

  const handleDeleteDocument = (doc: Document) => {
    confirmDialog.confirm({
      title: t("documentsView.deleteTitle"),
      message: t("documentsView.deleteSingleMessage", { title: doc.title }),
      variant: "danger",
      itemName: "document",
      itemCount: 1,
      details: [doc.title || "Untitled"],
      onConfirm: async () => {
        await deleteDocument(doc.id);
        if (activeId === doc.id) {
          setActiveId(null);
        }
      },
    });
  };

  const handleTranscribe = async (doc: Document) => {
    if (!doc.filePath) return;
    const settings = useSettingsStore.getState().settings.audioTranscription;
    await enqueueAutoTranscription(
      doc.id,
      doc.filePath,
      settings.provider,
      settings.provider === "groq" ? "groq-whisper" : "distil-small.en",
      settings.language || "en",
    );
  };

  const handleBulkTag = () => {
    if (selectedIds.size === 0) return;
    const tag = window.prompt(t("documentsView.addTagPrompt"));
    if (!tag) return;
    selectedIds.forEach((id) => {
      const doc = documents.find((item) => item.id === id);
      if (!doc) return;
      const nextTags = new Set(doc.tags);
      nextTags.add(tag);
      updateDocument(id, { tags: Array.from(nextTags) });
    });
  };

  const handleBulkReprioritize = () => {
    if (selectedIds.size === 0) return;
    const value = window.prompt(t("documentsView.setPriorityPrompt"));
    if (!value) return;
    const nextRating = Number(value);
    if (Number.isNaN(nextRating)) return;
    selectedIds.forEach((id) => {
      updateDocument(id, { priorityRating: nextRating, priorityScore: nextRating * 20 });
    });
  };

  const handleBulkMoveCollection = async () => {
    if (selectedIds.size === 0) return;
    const names = collections.map((collection) => collection.name).join(", ");
    const targetName = window.prompt(t("documentsView.moveCollectionPrompt", { names }));
    if (!targetName) return;
    const existing = collections.find(
      (collection) => collection.name.toLowerCase() === targetName.toLowerCase()
    );
    const target = existing ?? await createCollection(targetName);
    // TODO: Update collection_id on selected documents via backend API
    setSelectedIds(new Set());
  };

  const handleSort = (key: DocumentSortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(key);
    setSortDirection(defaultSortByKey[key]);
  };

  const activeDocument = useMemo(
    () => sortedDocuments.find((doc) => doc.id === activeId) ?? null,
    [sortedDocuments, activeId]
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (event.key.toLowerCase() === "i") {
        event.preventDefault();
        setInspectorOpen((prev) => !prev);
        return;
      }

      if (mode === "list" && (event.key.toLowerCase() === "j" || event.key.toLowerCase() === "k")) {
        event.preventDefault();
        if (sortedDocuments.length === 0) return;
        const currentIndex = sortedDocuments.findIndex((doc) => doc.id === activeId);
        const delta = event.key.toLowerCase() === "j" ? 1 : -1;
        const nextIndex =
          currentIndex === -1
            ? 0
            : Math.min(sortedDocuments.length - 1, Math.max(0, currentIndex + delta));
        const nextDoc = sortedDocuments[nextIndex];
        setActiveId(nextDoc.id);
        setSelectedIds(new Set([nextDoc.id]));
        return;
      }

      if (event.key === "Enter") {
        const doc = activeDocument ?? sortedDocuments[0];
        if (doc && onOpenDocument) {
          onOpenDocument(doc);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeDocument, activeId, mode, onOpenDocument, sortedDocuments]);

  const handleSaveView = () => {
    const name = window.prompt(t("documentsView.nameViewPrompt"));
    if (!name) return;
    const view: SavedView = {
      id: `${Date.now()}`,
      name,
      query: searchInput,
      sortKey,
      sortDirection,
      mode,
      showNextAction,
      fileTypeFilter: selectedFileType,
    };
    setSavedViews((prev) => [...prev, view]);
    setActiveViewId(view.id);
  };

  const handleApplyView = (viewId: string) => {
    if (!viewId) {
      setActiveViewId(null);
      setSelectedFileType("all");
      return;
    }
    const view = savedViews.find((item) => item.id === viewId);
    if (!view) return;
    setSearchInput(view.query);
    setDebouncedSearch(view.query);
    setSortKey(view.sortKey);
    setSortDirection(view.sortDirection);
    setMode(view.mode);
    setShowNextAction(view.showNextAction);
    setSelectedFileType(view.fileTypeFilter ?? "all");
    setActiveViewId(view.id);
  };

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <DragDropUpload
      onFilesImported={handleDragDropFiles}
      onAnkiPackage={handleAnkiPackage}
      onStudyJsonDeck={handleStudyJsonDeck}
      onBundleDetected={handleBundleDetected}
      className="h-full"
    >
      <div className="h-full flex flex-col bg-cream">
        {/* Header */}
        <div className="border-b border-border bg-card p-3 sm:p-4">
          {/* Title and Import Actions - Single Row on Mobile */}
          <div className="flex items-start justify-between gap-3 mb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
                {t("documentsView.title")}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t("documentsView.headerSummary", { count: sortedDocuments.length })}
              </p>
            </div>

            {/* Desktop Import Buttons */}
            <div className="hidden sm:flex flex-wrap items-center gap-2 justify-end">
              {enableYouTubeImport && (
                <button
                  onClick={() => setShowYouTubeImport(true)}
                  className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors flex items-center gap-2 text-sm whitespace-nowrap"
                  title={t("documentsView.importYouTubeVideo")}
                >
                  <Youtube className="w-4 h-4" />
                  {t("documentsView.importYouTube")}
                </button>
              )}
              <button
                onClick={() => setShowArxivImport(true)}
                className="px-3 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors flex items-center gap-2 text-sm whitespace-nowrap"
                title={t("documentsView.importArxivTitle")}
              >
                <FileTextIcon className="w-4 h-4" />
                {t("documentsView.arxiv")}
              </button>
              <button
                onClick={() => setShowWebArticleImport(true)}
                className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center gap-2 text-sm whitespace-nowrap"
                title={t("documentsView.importWebArticles")}
              >
                <Globe className="w-4 h-4" />
                {t("documentsView.webArticle")}
              </button>
              <button
                onClick={() => setShowAudiobookImport(true)}
                className="px-3 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors flex items-center gap-2 text-sm whitespace-nowrap"
                title={t("documentsView.importAudiobooks")}
              >
                <BookAudio className="w-4 h-4" />
                {t("documentsView.audiobook")}
              </button>
              {false && isTauri() && (
                <button
                  onClick={() => setShowAnnaArchiveSearch(true)}
                  className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors flex items-center gap-2 text-sm whitespace-nowrap"
                  title={t("documentsView.annasArchiveTooltip")}
                >
                  <BookOpen className="w-4 h-4" />
                  {t("documentsView.annasArchive")}
                </button>
              )}
              <button
                onClick={handleImport}
                disabled={isImporting}
                data-tutorial="import-button"
                className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
              >
                {isImporting ? t("documentsView.importing") : t("documentsView.importDocument")}
              </button>
            </div>

            {/* Mobile Import Actions - Top Right */}
            <div className="flex sm:hidden items-center gap-1.5 flex-shrink-0">
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="px-3 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[44px] min-h-[44px]"
                aria-label={
                  isImporting ? t("documentsView.importing") : t("documentsView.importDocument")
                }
              >
                <Plus className="w-5 h-5" />
              </button>
              <MobileImportMenu
                enableYouTubeImport={enableYouTubeImport}
                onYouTubeClick={() => setShowYouTubeImport(true)}
                onArxivClick={() => setShowArxivImport(true)}
                onWebArticleClick={() => setShowWebArticleImport(true)}
                onAudiobookClick={() => setShowAudiobookImport(true)}
                onAnnaArchiveClick={() => setShowAnnaArchiveSearch(true)}
              />
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-0 order-1 sm:min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t("documentsView.searchPlaceholder")}
                className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
              />
            </div>

            {/* Mobile Controls Row - View Toggle + Views + Filter */}
            <div className="flex sm:hidden items-center gap-2 order-2">
              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
                <button
                  onClick={() => setMode("grid")}
                  className={`p-2 rounded-md transition-all ${
                    mode === "grid"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label={t("documentsView.gridView")}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setMode("list")}
                  className={`p-2 rounded-md transition-all ${
                    mode === "list"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label={t("documentsView.listView")}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Type Filter */}
              <div className="relative">
                <select
                  value={selectedFileType}
                  onChange={(event) => setSelectedFileType(event.target.value)}
                  className="pl-3 pr-8 py-2 bg-background border border-border rounded-lg text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="all">{t("documentsView.all")}</option>
                  {availableFileTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </div>

              {/* Saved Views */}
              <MobileSavedViewsMenu
                savedViews={savedViews}
                activeViewId={activeViewId}
                onApplyView={handleApplyView}
                onSaveView={handleSaveView}
              />
            </div>

            {/* Desktop Controls */}
            <div className="hidden sm:flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center gap-2 bg-muted/40 rounded-lg p-1">
                <button
                  onClick={() => setMode("grid")}
                  className={`px-2.5 py-1.5 rounded-md text-sm flex items-center gap-1.5 transition-all ${
                    mode === "grid"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  {t("documentsView.grid")}
                </button>
                <button
                  onClick={() => setMode("list")}
                  className={`px-2.5 py-1.5 rounded-md text-sm flex items-center gap-1.5 transition-all ${
                    mode === "list"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <List className="w-4 h-4" />
                  {t("documentsView.list")}
                </button>
              </div>

              <button
                onClick={() => setInspectorOpen((prev) => !prev)}
                className="px-3 py-2 bg-muted text-foreground rounded-lg text-sm hover:bg-muted/80 transition-colors"
              >
                {isInspectorOpen
                  ? t("documentsView.hideInspector")
                  : t("documentsView.showInspector")}
              </button>

              {/* Type Filter */}
              <div className="relative">
                <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <select
                  value={selectedFileType}
                  onChange={(event) => setSelectedFileType(event.target.value)}
                  className="pl-8 pr-7 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="all">{t("documentsView.allTypes")}</option>
                  {availableFileTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg
                    className="w-4 h-4 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>

              {/* Saved Views */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <select
                    value={activeViewId ?? ""}
                    onChange={(event) => handleApplyView(event.target.value)}
                    className="pl-3 pr-7 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">{t("documentsView.savedViews")}</option>
                    {savedViews.map((view) => (
                      <option key={view.id} value={view.id}>
                        {view.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg
                      className="w-4 h-4 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
                <button
                  onClick={handleSaveView}
                  className="px-3 py-2.5 bg-muted text-foreground rounded-lg text-sm hover:bg-muted/80 transition-colors"
                >
                  {t("documentsView.saveView")}
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-4 p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg">
            {error}
          </div>
        )}

        {isImporting && importProgress.total > 0 && (
          <div className="mx-4 mt-4">
            <ImportProgressIndicator
              fileName={importProgress.fileName}
              importType="unknown"
              current={importProgress.current}
              total={importProgress.total}
              status="processing"
              statusMessage={
                importProgress.fileName
                  ? t("documentsView.processingFile", { name: importProgress.fileName })
                  : t("documentsView.importingDocuments")
              }
            />
          </div>
        )}

        {selectedIds.size > 0 && (
          <div className="mx-4 mt-4 p-3 bg-primary/10 border border-primary/20 rounded-md flex items-center justify-between">
            <span className="text-sm text-primary">
              {t("documentsView.selectedCount", { count: selectedIds.size })}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkTag}
                className="px-3 py-1.5 bg-background border border-border rounded text-sm text-foreground hover:bg-muted"
              >
                {t("documentsView.tag")}
              </button>
              <button
                onClick={handleBulkMoveCollection}
                className="px-3 py-1.5 bg-background border border-border rounded text-sm text-foreground hover:bg-muted"
              >
                {t("documentsView.move")}
              </button>
              <button
                onClick={handleBulkReprioritize}
                className="px-3 py-1.5 bg-background border border-border rounded text-sm text-foreground hover:bg-muted"
              >
                {t("documentsView.reprioritize")}
              </button>
              <button
                onClick={handleBulkArchive}
                className="px-3 py-1.5 bg-muted text-foreground rounded text-sm hover:bg-muted/80"
              >
                {t("documentsView.archive")}
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded text-sm hover:opacity-90 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                {t("documentsView.delete")}
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden documents-layout">
          <div className="flex-1 overflow-auto p-4 documents-content">
            {isLoading ? (
              mode === "list" ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <DocumentCardSkeleton key={i} />
                  ))}
                </div>
              ) : (
                <DocumentGridSkeleton count={8} />
              )
            ) : sortedDocuments.length === 0 ? (
              debouncedSearch ? (
                <EmptySearch query={debouncedSearch} onClear={() => setSearchInput("")} />
              ) : (
                <EmptyDocuments onImport={handleImport} />
              )
            ) : mode === "list" ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-3">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleSort("priority")}
                      className="hover:text-foreground"
                    >
                      {t("documentsView.sortPriority")}
                    </button>
                    <button onClick={() => handleSort("title")} className="hover:text-foreground">
                      {t("documentsView.sortTitle")}
                    </button>
                    <button onClick={() => handleSort("added")} className="hover:text-foreground">
                      {t("documentsView.sortAdded")}
                    </button>
                    <button onClick={() => handleSort("type")} className="hover:text-foreground">
                      {t("documentsView.sortType")}
                    </button>
                    <button
                      onClick={() => handleSort("extracts")}
                      className="hover:text-foreground"
                    >
                      {t("documentsView.sortExtracts")}
                    </button>
                    <button onClick={() => handleSort("cards")} className="hover:text-foreground">
                      {t("documentsView.sortCards")}
                    </button>
                    <button
                      onClick={() => handleSort("lastTouched")}
                      className="hover:text-foreground"
                    >
                      {t("documentsView.sortLastTouched")}
                    </button>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={showNextAction}
                      onChange={(event) => setShowNextAction(event.target.checked)}
                    />
                    {t("documentsView.nextAction")}
                  </label>
                </div>

                <div className="space-y-2">
                  {sortedDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={(event) => {
                        if (isMobile) {
                          onOpenDocument?.(doc);
                          return;
                        }
                        handleSelectRow(doc, event.metaKey || event.ctrlKey);
                        if (event.detail > 1) {
                          onOpenDocument?.(doc);
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setListCtxDoc({ doc, pos: { x: e.clientX, y: e.clientY } });
                      }}
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                        selectedIds.has(doc.id)
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(doc.id)}
                          onChange={(event) => {
                            event.stopPropagation();
                            handleSelectRow(doc, true);
                          }}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <PriorityBadge doc={doc} />
                              <div className="min-w-0">
                                <div className="font-semibold text-foreground truncate">
                                  {doc.title}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {getPriorityReason(doc)}
                                </div>
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatRelativeTime(getLastTouched(doc))}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="px-2 py-0.5 rounded bg-muted/60 text-muted-foreground">
                              {doc.fileType}
                            </span>
                            {(doc.fileType === 'audio' || doc.fileType === 'video') && (() => {
                              const store = useTranscriptionQueueStore.getState();
                              const entry = store.getEntryForDocument(doc.id);
                              if (!entry || entry.status === 'completed') return null;
                              const progress = entry.status === 'processing' ? store.activeProgress : 0;
                              const isPreparing = entry.status === 'processing' && store.activePhase === 'preparing';
                              return (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                  entry.status === 'processing' ? 'bg-blue-500/20 text-blue-600' :
                                  entry.status === 'failed' ? 'bg-red-500/20 text-red-600' :
                                  'bg-amber-500/20 text-amber-600'
                                }`}>
                                  {isPreparing ? '⏳ Preparing...' :
                                   entry.status === 'processing' ? `⏳ ${progress}%` :
                                   entry.status === 'failed' ? '✗ Failed' :
                                   '⏎ Pending'}
                                </span>
                              );
                            })()}
                            <ProgressBar doc={doc} />
                            {showNextAction && (
                              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">
                                {getNextAction(doc)}
                              </span>
                            )}
                            <TagsInline tags={doc.tags} />
                          </div>
                          {isMobile && (
                            <div className="mt-3">
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onOpenDocument?.(doc);
                                }}
                                className="px-3 py-2 bg-primary text-primary-foreground rounded text-xs mobile-density-tap"
                              >
                                {t("documentsView.openRead")}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <LibraryDashboard
                documents={sortedDocuments}
                filteredDocuments={filteredDocuments}
                selectedFileType={selectedFileType}
                setSelectedFileType={setSelectedFileType}
                selectedIds={selectedIds}
                onOpenDocument={onOpenDocument}
                onSelectRow={handleSelectRow}
                onDelete={handleDeleteDocument}
                onUpdate={updateDocument}
                onTranscribe={handleTranscribe}
                onReadAlong={onReadAlong}
                isMobile={isMobile}
              />
            )}
          </div>

          {/* List mode context menu (rendered via portal) */}
          {listCtxDoc && createPortal(
            <Fragment>
              <div className="fixed inset-0 z-[9998]" onContextMenu={(e) => { e.preventDefault(); setListCtxDoc(null); }} onClick={() => setListCtxDoc(null)} />
              <div ref={listCtxRef} className="fixed z-[9999] bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[200px]" style={{ left: listCtxDoc.pos.x, top: listCtxDoc.pos.y }}>
                <button
                  className="flex items-center gap-2.5 w-full text-left px-3 py-1.5 text-sm hover:bg-muted text-foreground"
                  onClick={() => { setListCtxDoc(null); onOpenDocument?.(listCtxDoc.doc); }}
                >
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  Open
                </button>
                {(() => {
                  const companions = onReadAlong ? findCompanionDoc(listCtxDoc.doc, documents) : [];
                  const best = companions[0];
                  if (!best) return null;
                  const audioDoc = listCtxDoc.doc.fileType === "audio" ? listCtxDoc.doc : best.doc;
                  const epubDoc = listCtxDoc.doc.fileType === "epub" ? listCtxDoc.doc : best.doc;
                  return (
                    <button
                      className="flex items-center gap-2.5 w-full text-left px-3 py-1.5 text-sm hover:bg-muted text-foreground"
                      onClick={() => { setListCtxDoc(null); onReadAlong?.(audioDoc, epubDoc); }}
                    >
                      {listCtxDoc.doc.fileType === "audio"
                        ? <Columns2 className="h-3.5 w-3.5 text-blue-500" />
                        : <Headphones className="h-3.5 w-3.5 text-blue-500" />}
                      {listCtxDoc.doc.fileType === "audio"
                        ? `Read Along with ${best.doc.title}`
                        : `Listen Along with ${best.doc.title}`}
                    </button>
                  );
                })()}
                {onReadAlong && (listCtxDoc.doc.fileType === "audio" || listCtxDoc.doc.fileType === "epub") && (
                  <button
                    className="flex items-center gap-2.5 w-full text-left px-3 py-1.5 text-sm hover:bg-muted text-foreground"
                    onClick={() => { setListCtxDoc(null); setListPairPicker(listCtxDoc.doc); }}
                  >
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                    Pair with...
                  </button>
                )}
                <div className="h-px bg-border my-1" />
                <button
                  className="flex items-center gap-2.5 w-full text-left px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                  onClick={() => { setListCtxDoc(null); handleDeleteDocument(listCtxDoc.doc); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </Fragment>,
            document.body
          )}

          {/* List mode pair picker */}
          {listPairPicker && (() => {
            const targetType = listPairPicker.fileType === "audio" ? "epub" : "audio";
            const candidates = documents.filter(
              d => d.id !== listPairPicker.id && d.fileType === targetType && !d.isArchived
            );
            const filtered = listPairSearch
              ? candidates.filter(d => d.title.toLowerCase().includes(listPairSearch.toLowerCase()))
              : candidates;
            const typeLabel = targetType === "epub" ? "EPUB" : "audiobook";
            return createPortal(
              <Fragment>
                <div className="fixed inset-0 z-[9998]" onClick={() => { setListPairPicker(null); setListPairSearch(""); }} />
                <div className="fixed z-[9999] bg-popover border border-border rounded-lg shadow-xl w-[320px] max-h-[400px] flex flex-col"
                  style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>
                  <div className="p-3 border-b border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Pair with {typeLabel}</span>
                      <button onClick={() => { setListPairPicker(null); setListPairSearch(""); }} className="text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search..."
                      value={listPairSearch}
                      onChange={(e) => setListPairSearch(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-md"
                    />
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {filtered.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No {typeLabel}s found</p>
                    ) : filtered.map(d => (
                      <button
                        key={d.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2"
                        onClick={() => {
                          setListPairPicker(null);
                          setListPairSearch("");
                          const audioDoc = listPairPicker.fileType === "audio" ? listPairPicker : d;
                          const epubDoc = listPairPicker.fileType === "epub" ? listPairPicker : d;
                          onReadAlong?.(audioDoc, epubDoc);
                        }}
                      >
                        <BookOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{d.title}</span>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">{d.fileType}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </Fragment>,
              document.body
            );
          })()}

          {isInspectorOpen && (
            <aside className="w-80 border-l border-border bg-card p-4 overflow-auto documents-inspector">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">
                  {t("documentsView.inspector")}
                </h2>
                <button
                  onClick={() => setInspectorOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {!activeDocument ? (
                <div className="text-sm text-muted-foreground">
                  {t("documentsView.selectDocumentDetails")}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      {t("documentsView.sortTitle")}
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {activeDocument.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {activeDocument.fileType}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <PriorityBadge doc={activeDocument} />
                    <span className="text-xs text-muted-foreground">
                      {getPriorityReason(activeDocument)}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div>
                      {t("documentsView.added")}: {formatRelativeTime(activeDocument.dateAdded)}
                    </div>
                    <div>
                      {t("documentsView.lastTouched")}:{" "}
                      {formatRelativeTime(getLastTouched(activeDocument))}
                    </div>
                    <div>
                      {t("documentsView.created")}:{" "}
                      {formatRelativeTime(activeDocument.metadata?.createdAt)}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {t("documentsView.readingProgress")}
                    </div>
                    <DocumentProgressIndicator doc={activeDocument} />
                    <div className="mt-3">
                      <div className="text-xs text-muted-foreground mb-2">
                        {t("documentsView.learningProgress")}
                      </div>
                      <ProgressBar doc={activeDocument} />
                      <div className="text-xs text-muted-foreground mt-2">
                        {t("documentsView.extractsCards", {
                          extracts: activeDocument.extractCount,
                          cards: activeDocument.learningItemCount,
                        })}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-2">{t("graph.tags")}</div>
                    <div className="flex flex-wrap gap-2">
                      {activeDocument.tags.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {t("documentsView.noTags")}
                        </span>
                      ) : (
                        activeDocument.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 text-xs bg-primary/10 text-primary rounded"
                          >
                            {tag}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {t("documentsView.actions")}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => onOpenDocument?.(activeDocument)}
                        className="px-3 py-2 bg-primary text-primary-foreground rounded text-sm"
                      >
                        {t("documentsView.openRead")}
                      </button>
                      <button
                        onClick={() => onOpenDocument?.(activeDocument)}
                        className="px-3 py-2 bg-background border border-border rounded text-sm text-foreground"
                      >
                        {t("documentsView.extract")}
                      </button>
                      {activeDocument.extractCount === 0 && (
                        <button
                          onClick={async () => {
                            if (!segmentDocument) return;
                            await segmentDocument(activeDocument.id, activeDocument.fileType);
                          }}
                          disabled={isSegmenting}
                          className="px-3 py-2 bg-background border border-border rounded text-sm text-foreground disabled:opacity-50"
                        >
                          {isSegmenting ? "Segmenting..." : "Segment"}
                        </button>
                      )}
                      <button
                        onClick={() =>
                          updateDocument(activeDocument.id, {
                            priorityRating: (activeDocument.priorityRating ?? 0) + 1,
                            priorityScore: (activeDocument.priorityScore ?? 0) + 10,
                          })
                        }
                        className="px-3 py-2 bg-background border border-border rounded text-sm text-foreground"
                      >
                        Reprioritize
                      </button>
                      <button
                        onClick={() => updateDocument(activeDocument.id, { isArchived: true })}
                        className="px-3 py-2 bg-muted text-foreground rounded text-sm hover:bg-muted/80"
                      >
                        Archive
                      </button>
                      <button
                        onClick={() => handleDeleteDocument(activeDocument)}
                        className="px-3 py-2 bg-destructive text-destructive-foreground rounded text-sm hover:opacity-90 flex items-center justify-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {t("documentsView.relatedItems")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("documentsView.noRelatedItems")}
                    </div>
                  </div>
                </div>
              )}
            </aside>
          )}
        </div>

        {enableYouTubeImport && showYouTubeImport && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-lg w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Youtube className="w-5 h-5 text-red-500" />
                  <h2 className="text-lg font-semibold text-foreground">
                    {t("documentsView.youtubeImportTitle")}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setShowYouTubeImport(false);
                    setYoutubeUrl("");
                    setYoutubeError(null);
                  }}
                  className="p-1 text-muted-foreground hover:text-foreground rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t("documentsView.youtubeUrlLabel")}
                  </label>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(event) => setYoutubeUrl(event.target.value)}
                    placeholder={t("documentsView.youtubeUrlPlaceholder")}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={youtubeLoading}
                  />
                </div>

                {youtubeError && (
                  <div className="p-3 bg-destructive/10 border border-destructive text-destructive rounded-lg text-sm">
                    {youtubeError}
                  </div>
                )}

                {ytdlpAvailable === false && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5" />
                      <div className="text-sm">
                        <div>{t("documentsView.ytDlpMissing")}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            onClick={handleInstallYtdlp}
                            disabled={!isTauri() || ytdlpInstalling}
                            className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded-md hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                          >
                            {ytdlpInstalling ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                            {ytdlpInstalling
                              ? t("documentsView.installing")
                              : t("documentsView.installYtdlp")}
                          </button>
                          <a
                            href="https://github.com/yt-dlp/yt-dlp#installation"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-sm"
                          >
                            {t("documentsView.manualInstallGuide")}
                          </a>
                        </div>
                        {!isTauri() && (
                          <div className="mt-2 text-xs text-destructive/80">
                            {t("documentsView.oneClickInstallDesktop")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {ytdlpInstallMessage && (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-500 text-sm">
                    <Check className="w-4 h-4" />
                    <span>{ytdlpInstallMessage}</span>
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  {t("documentsView.ytdlpRequiredNote")}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowYouTubeImport(false);
                      setYoutubeUrl("");
                      setYoutubeError(null);
                    }}
                    disabled={youtubeLoading}
                    className="px-4 py-2 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                  >
                    {t("documentsView.cancel")}
                  </button>
                  <button
                    onClick={handleYouTubeImport}
                    disabled={youtubeLoading}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                  >
                    {youtubeLoading ? t("documentsView.importing") : t("documentsView.import")}
                    <Link2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showAnnaArchiveSearch && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-lg w-full max-w-4xl max-h-[90vh] overflow-auto">
              <AnnaArchiveSearch
                onImportComplete={async (path) => {
                  // After download, trigger document import from the downloaded path
                  try {
                    const imported = await importFromFiles([path]);
                    if (onOpenDocument && imported.length > 0) {
                      onOpenDocument(imported[0]);
                    }
                  } catch (error) {
                    console.error("Failed to import downloaded book:", error);
                  }
                  setShowAnnaArchiveSearch(false);
                }}
                onClose={() => setShowAnnaArchiveSearch(false)}
              />
            </div>
          </div>
        )}

        {/* ArXiv Import Dialog */}
        <ArxivImportDialog
          isOpen={showArxivImport}
          onClose={() => setShowArxivImport(false)}
          onOpenDocument={onOpenDocument}
        />

        {/* Web Article Import Dialog */}
        <WebArticleImportDialog
          isOpen={showWebArticleImport}
          onClose={() => setShowWebArticleImport(false)}
          onOpenDocument={onOpenDocument}
        />

        {/* Audiobook Import Dialog */}
        <AudiobookImportDialog
          isOpen={showAudiobookImport}
          onClose={() => setShowAudiobookImport(false)}
          onOpenDocument={onOpenDocument}
        />

        {/* Markdown Bundle Preview */}
        {detectedBundle && (
          <MarkdownBundlePreview
            bundle={detectedBundle}
            isOpen={showMarkdownBundlePreview}
            onClose={() => {
              setShowMarkdownBundlePreview(false);
              setDetectedBundle(null);
              setBundleFiles([]);
            }}
            onImport={handleBundleImport}
          />
        )}

        {/* Confirmation Dialog for bulk operations */}
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={confirmDialog.close}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          message={confirmDialog.message}
          variant={confirmDialog.variant}
          details={confirmDialog.details}
          itemName={confirmDialog.itemName}
          itemCount={confirmDialog.itemCount}
        />
      </div>
    </DragDropUpload>
  );
}

function PriorityBadge({ doc }: { doc: Document }) {
  const tier = getPriorityTier(doc);
  const signal = getPrioritySignal(doc);
  const tierStyles =
    tier === "high"
      ? "bg-red-500/15 text-red-600"
      : tier === "medium"
        ? "bg-amber-500/15 text-amber-600"
        : "bg-emerald-500/15 text-emerald-600";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${tierStyles}`}>{signal}</span>
  );
}

function ProgressBar({ doc }: { doc: Document }) {
  const { extracts, cards, total, extractRatio, cardRatio } = getProgressSegments(doc);
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-24 bg-muted/60 rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-primary/70"
          style={{ width: `${extractRatio * 100}%` }}
        />
        {total > 0 && (
          <div
            className="absolute top-0 h-full bg-foreground/30"
            style={{ width: `${cardRatio * 100}%`, left: `${extractRatio * 100}%` }}
          />
        )}
      </div>
      <span className="text-[11px] text-muted-foreground">
        {extracts} / {cards}
      </span>
    </div>
  );
}

function DocumentProgressIndicator({ doc }: { doc: Document }) {
  const { t } = useI18n();
  const progressPercent = doc.progressPercent ?? 0;
  const currentPage = doc.currentPage ?? 1;
  const totalPages = doc.totalPages ?? 0;

  // Try to get position from positionJson if available
  let positionText = "";
  let hasPosition = false;

  if ((doc as any).positionJson) {
    try {
      const positionJson = (doc as any).positionJson;
      const position = typeof positionJson === "string" ? JSON.parse(positionJson) : positionJson;
      if (position) {
        hasPosition = true;
        switch (position.type) {
          case "page":
            positionText = t("documentsView.pagePosition", { page: position.page });
            break;
          case "scroll":
            positionText = t("documentsView.percentThrough", {
              percent: Math.round(position.percent),
            });
            break;
          case "cfi":
            positionText = t("documentsView.epubLocationSaved");
            break;
          case "time": {
            const minutes = Math.floor(position.seconds / 60);
            const seconds = Math.floor(position.seconds % 60);
            const secondsPadded = seconds.toString().padStart(2, "0");
            positionText = t("documentsView.videoPosition", { minutes, seconds: secondsPadded });
            break;
          }
          default:
            positionText = t("documentsView.positionSaved");
        }
      }
    } catch {
      // Failed to parse position, fall back to legacy fields
    }
  }

  // Legacy fallback if no positionJson found
  if (!hasPosition) {
    if (totalPages > 0) {
      positionText = t("documentsView.pageOfTotal", { current: currentPage, total: totalPages });
    } else if (progressPercent > 0) {
      positionText = t("documentsView.percentThrough", { percent: Math.round(progressPercent) });
    } else {
      positionText = t("documentsView.notStarted");
    }
  }

  // Get the display progress percent
  const displayProgress =
    progressPercent > 0
      ? progressPercent
      : totalPages > 0
        ? ((currentPage - 1) / totalPages) * 100
        : 0;

  return (
    <div className="space-y-2">
      {/* Progress bar with percentage */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, displayProgress))}%` }}
          />
        </div>
        <span className="text-xs font-medium text-foreground min-w-[40px] text-right">
          {Math.round(displayProgress)}%
        </span>
      </div>

      {/* Position text */}
      <div className="text-xs text-muted-foreground">{positionText}</div>

      {/* Additional status indicators */}
      <div className="flex items-center gap-2 mt-2">
        {displayProgress > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[10px] font-medium">
            {t("documentsView.readingStatus")}
          </span>
        )}
        {doc.dateLastReviewed && (
          <span className="text-[10px] text-muted-foreground">
            {t("documentsView.lastReviewed", { time: formatRelativeTime(doc.dateLastReviewed) })}
          </span>
        )}
      </div>
    </div>
  );
}

function TagsInline({ tags }: { tags: string[] }) {
  const { t } = useI18n();
  if (!tags || tags.length === 0) {
    return <span className="text-xs text-muted-foreground">{t("documentsView.noTags")}</span>;
  }
  const visible = tags.slice(0, MAX_VISIBLE_TAGS);
  const remaining = tags.length - visible.length;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((tag) => (
        <span key={tag} className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded">
          {tag}
        </span>
      ))}
      {remaining > 0 && (
        <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded">
          +{remaining}
        </span>
      )}
    </div>
  );
}

/*
 * LibraryDashboard — the redesigned grid view with stats, filter chips,
 * and horizontal card rows for "Continue Where You Left Off" & "Recently Added".
 */
interface LibraryDashboardProps {
  documents: Document[];
  filteredDocuments: Document[];
  selectedFileType: string;
  setSelectedFileType: (type: string) => void;
  selectedIds: Set<string>;
  onOpenDocument?: (doc: Document) => void;
  onSelectRow: (doc: Document, multi: boolean) => void;
  onDelete: (doc: Document) => void;
  onUpdate: (id: string, updates: Partial<Document>) => void;
  onTranscribe?: (doc: Document) => void;
  onReadAlong?: (audioDoc: Document, epubDoc: Document) => void;
  isMobile: boolean;
}

function LibraryDashboard({
  documents,
  filteredDocuments,
  selectedFileType,
  setSelectedFileType,
  selectedIds,
  onOpenDocument,
  onSelectRow,
  onDelete,
  onUpdate,
  onTranscribe,
  onReadAlong,
  isMobile,
}: LibraryDashboardProps) {
  const rowRef1 = useRef<HTMLDivElement>(null);
  const rowRef2 = useRef<HTMLDivElement>(null);

  // Stats
  const totalItems = documents.length;
  const inProgress = documents.filter(
    (d) => (d.progressPercent ?? 0) > 0 || d.extractCount > 0 || d.learningItemCount > 0
  ).length;
  const unprocessed = documents.filter(
    (d) => d.extractCount === 0 && d.learningItemCount === 0 && (d.progressPercent ?? 0) === 0
  ).length;
  const highlights = documents.reduce((sum, d) => sum + d.extractCount, 0);
  const readyToReview = documents.filter((d) => d.learningItemCount > 0).length;

  // Sections
  const continueDocs = useMemo(
    () =>
      filteredDocuments
        .filter((d) => (d.progressPercent ?? 0) > 0 || d.extractCount > 0)
        .sort((a, b) => {
          const timeDiff = new Date(getLastTouched(b)).getTime() - new Date(getLastTouched(a)).getTime();
          if (timeDiff !== 0) return timeDiff;
          // Stable secondary sort by ID to prevent layout thrashing
          return a.id.localeCompare(b.id);
        })
        .slice(0, 12),
    [filteredDocuments]
  );

  const recentDocs = useMemo(
    () =>
      [...filteredDocuments]
        .sort((a, b) => {
          const timeDiff = new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
          if (timeDiff !== 0) return timeDiff;
          return a.id.localeCompare(b.id);
        })
        .slice(0, 12),
    [filteredDocuments]
  );

  // Filter chips
  const allTypes = useMemo(() => {
    const types = new Set(documents.map((d) => d.fileType));
    return Array.from(types).sort();
  }, [documents]);

  const scrollRow = (ref: React.RefObject<HTMLDivElement | null>, dir: "left" | "right") => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir === "left" ? -320 : 320, behavior: "smooth" });
  };

  const stats = [
    { label: "Total Items", value: totalItems, icon: <Layers className="w-4 h-4" /> },
    { label: "In Progress", value: inProgress, icon: <Loader2 className="w-4 h-4" /> },
    { label: "Unprocessed", value: unprocessed, icon: <FileText className="w-4 h-4" /> },
    { label: "Highlights", value: highlights, icon: <Sparkles className="w-4 h-4" /> },
    { label: "Ready to Review", value: readyToReview, icon: <BookOpen className="w-4 h-4" /> },
  ];

  const statColors = ["text-foreground", "text-blue-500", "text-amber-500", "text-emerald-500", "text-purple-500"];

  return (
    <div className="space-y-5 pb-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="bg-card border border-border rounded-xl p-3 flex items-center gap-3"
          >
            <div className={"p-2 rounded-lg bg-muted/60 text-muted-foreground"}>
              {s.icon}
            </div>
            <div className="flex flex-col">
              <span className={`text-xl font-bold ${statColors[i]}`}>{s.value}</span>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedFileType("all")}
          className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            selectedFileType === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          All
        </button>
        {allTypes.map((type) => (
          <button
            key={type}
            onClick={() => setSelectedFileType(type)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selectedFileType === type
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Continue Where You Left Off */}
      <HorizontalSection
        title="Continue Where You Left Off"
        docs={continueDocs}
        selectedIds={selectedIds}
        onOpenDocument={onOpenDocument}
        onSelectRow={onSelectRow}
        onDelete={onDelete}
        onUpdate={onUpdate}
        onTranscribe={onTranscribe}
        onReadAlong={onReadAlong}
        isMobile={isMobile}
        scrollRef={rowRef1}
        onScrollLeft={() => scrollRow(rowRef1, "left")}
        onScrollRight={() => scrollRow(rowRef1, "right")}
      />

      {/* Recently Added */}
      <HorizontalSection
        title="Recently Added"
        docs={recentDocs}
        selectedIds={selectedIds}
        onOpenDocument={onOpenDocument}
        onSelectRow={onSelectRow}
        onDelete={onDelete}
        onUpdate={onUpdate}
        onTranscribe={onTranscribe}
        onReadAlong={onReadAlong}
        isMobile={isMobile}
        scrollRef={rowRef2}
        onScrollLeft={() => scrollRow(rowRef2, "left")}
        onScrollRight={() => scrollRow(rowRef2, "right")}
      />
    </div>
  );
}

/* Horizontal card row */
interface HorizontalSectionProps {
  title: string;
  docs: Document[];
  selectedIds: Set<string>;
  onOpenDocument?: (doc: Document) => void;
  onSelectRow: (doc: Document, multi: boolean) => void;
  onDelete: (doc: Document) => void;
  onUpdate: (id: string, updates: Partial<Document>) => void;
  onTranscribe?: (doc: Document) => void;
  onReadAlong?: (audioDoc: Document, epubDoc: Document) => void;
  isMobile: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScrollLeft: () => void;
  onScrollRight: () => void;
}

function HorizontalSection({
  title,
  docs,
  selectedIds,
  onOpenDocument,
  onSelectRow,
  onDelete,
  onUpdate,
  onTranscribe,
  onReadAlong,
  isMobile,
  scrollRef,
  onScrollLeft,
  onScrollRight,
}: HorizontalSectionProps) {
  // Convert vertical wheel scrolling to horizontal scroll
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    // Only hijack vertical scrolls; let horizontal scroll-through work normally.
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      e.currentTarget.scrollLeft += e.deltaY;
    }
  }, []);

  if (docs.length === 0) return null;
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={onScrollLeft}
            className="p-1.5 rounded-md bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={onScrollRight}
            className="p-1.5 rounded-md bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory"
      >
        {docs.map((doc) => (
          <LibraryCard
            key={doc.id}
            doc={doc}
            selected={selectedIds.has(doc.id)}
            onSelect={(multi) => onSelectRow(doc, multi)}
            onOpen={() => onOpenDocument?.(doc)}
            onDelete={onDelete}
            onUpdate={onUpdate}
            onTranscribe={onTranscribe ? () => onTranscribe(doc) : undefined}
            onReadAlong={onReadAlong}
            isMobile={isMobile}
          />
        ))}
      </div>
    </section>
  );
}

/* Wider horizontal document card with right-click context menu */
function LibraryCard({
  doc,
  selected,
  onSelect,
  onOpen,
  onDelete,
  onUpdate,
  onTranscribe,
  onReadAlong,
  isMobile,
}: {
  doc: Document;
  selected: boolean;
  onSelect: (multi: boolean) => void;
  onOpen: () => void;
  onDelete: (doc: Document) => void;
  onUpdate: (id: string, updates: Partial<Document>) => void;
  onTranscribe?: () => void;
  onReadAlong?: (audioDoc: Document, epubDoc: Document) => void;
  isMobile: boolean;
}) {
  const coverUrl = getDocumentCoverUrl(doc);
  const CoverIcon = getCoverFallbackIcon(doc.fileType);
  const progress = doc.progressPercent ?? 0;
  const [ctxPos, setCtxPos] = useState<{ x: number; y: number } | null>(null);
  const [showPairPicker, setShowPairPicker] = useState(false);
  const [pairSearch, setPairSearch] = useState("");

  const typeColors: Record<string, string> = {
    pdf: "bg-red-500/15 text-red-400",
    epub: "bg-blue-500/15 text-blue-400",
    youtube: "bg-red-600/15 text-red-500",
    audio: "bg-amber-500/15 text-amber-400",
    video: "bg-violet-500/15 text-violet-400",
    markdown: "bg-emerald-500/15 text-emerald-400",
    html: "bg-cyan-500/15 text-cyan-400",
    other: "bg-muted text-muted-foreground",
  };
  const typeColor = typeColors[doc.fileType] ?? typeColors.other;

  // Close context menu on click outside (but not on the menu itself)
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ctxPos) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setCtxPos(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ctxPos]);

  const menuItems: Array<{
    label: string;
    icon: React.ReactNode;
    color?: string;
    divider?: boolean;
    action: () => void;
  }> = useMemo(() => {
    const allDocs = useDocumentStore.getState().documents;
    const companions = onReadAlong ? findCompanionDoc(doc, allDocs) : [];
    const bestCompanion = companions[0] ?? null;

    return [
    {
      label: "Open",
      icon: <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />,
      action: () => onOpen(),
    },
    ...(bestCompanion ? [{
      label: doc.fileType === "audio"
        ? `Read Along with ${bestCompanion.doc.title}`
        : `Listen Along with ${bestCompanion.doc.title}`,
      icon: doc.fileType === "audio"
        ? <Columns2 className="h-3.5 w-3.5 text-blue-500" />
        : <Headphones className="h-3.5 w-3.5 text-blue-500" />,
      action: () => {
        const audioDoc = doc.fileType === "audio" ? doc : bestCompanion.doc;
        const epubDoc = doc.fileType === "epub" ? doc : bestCompanion.doc;
        onReadAlong?.(audioDoc, epubDoc);
      },
    } as { label: string; icon: React.ReactNode; color?: string; divider?: boolean; action: () => void }] : []),
    ...((doc.fileType === "audio" || doc.fileType === "epub") && onReadAlong ? [{
      label: "Pair with...",
      icon: <Link2 className="h-3.5 w-3.5 text-muted-foreground" />,
      action: () => { setCtxPos(null); setShowPairPicker(true); },
    } as { label: string; icon: React.ReactNode; color?: string; divider?: boolean; action: () => void }] : []),
    {
      label: doc.isFavorite ? "Remove from Favorites" : "Add to Favorites",
      icon: <Sparkles className={"h-3.5 w-3.5 " + (doc.isFavorite ? "text-amber-500" : "text-muted-foreground")} />,
      action: () => onUpdate(doc.id, { isFavorite: !doc.isFavorite }),
    },
    {
      label: "Add Tag",
      icon: <Plus className="h-3.5 w-3.5 text-muted-foreground" />,
      action: () => {
        const tag = window.prompt("Add tag:");
        if (!tag) return;
        const next = new Set(doc.tags);
        next.add(tag);
        onUpdate(doc.id, { tags: Array.from(next) });
      },
    },
    { label: "", icon: null, divider: true, action: () => {} },
    ...(doc.fileType === "audio" || doc.fileType === "video" ? [{
      label: "Transcribe",
      icon: <BookAudio className="h-3.5 w-3.5 text-blue-500" />,
      action: () => onTranscribe?.(),
    } as { label: string; icon: React.ReactNode; color?: string; divider?: boolean; action: () => void }] : []),
    { label: "", icon: null, divider: true, action: () => {} },
    {
      label: doc.isArchived ? "Unarchive" : "Archive",
      icon: <FileText className={"h-3.5 w-3.5 " + (doc.isArchived ? "text-emerald-500" : "text-muted-foreground")} />,
      action: () => onUpdate(doc.id, { isArchived: !doc.isArchived }),
    },
    { label: "", icon: null, divider: true, action: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="h-3.5 w-3.5" />,
      color: "text-destructive",
      action: () => onDelete(doc),
    },
  ]; }, [doc, onOpen, onDelete, onUpdate, onReadAlong]);

  return (
    <div className="relative">
      <div
        onClick={(event) => {
          if (isMobile) { onOpen(); return; }
          onSelect(event.metaKey || event.ctrlKey);
          if (event.detail > 1) onOpen();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setCtxPos({ x: e.clientX, y: e.clientY });
        }}
        className={"snap-start flex-shrink-0 w-[280px] sm:w-[320px] rounded-xl border bg-card cursor-pointer transition-all hover:shadow-lg hover:shadow-black/10 hover:-translate-y-0.5 group " + (selected ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-border/80")}
      >
        {/* Cover */}
        <div className="relative h-[160px] sm:h-[180px] overflow-hidden rounded-t-xl bg-muted/40">
          {coverUrl ? (
            <img src={coverUrl} alt={doc.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center gap-2">
              <div className={"absolute inset-0 " + coverFallbackGradient(doc.fileType)} />
              <CoverIcon className="w-12 h-12 text-white/70 relative z-10" />
              <span className="text-xs font-medium text-white/50 uppercase tracking-wide relative z-10">{doc.fileType}</span>
            </div>
          )}
          <span className={"absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[11px] font-semibold backdrop-blur-sm " + typeColor}>{doc.fileType}</span>
          {progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
              <div className="h-full bg-primary/80 transition-all" style={{ width: progress + "%" }} />
            </div>
          )}
          {!isMobile && (
            <input type="checkbox" checked={selected} onChange={(e) => { e.stopPropagation(); onSelect(true); }} onClick={(e) => e.stopPropagation()} className="absolute top-2.5 right-2.5 w-4 h-4 rounded bg-background/80 backdrop-blur-sm border-border" />
          )}
        </div>

        {/* Info */}
        <div className="p-3 flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-tight">{doc.title}</h3>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatRelativeTime(getLastTouched(doc))}</span>
            {doc.extractCount > 0 && <span>{doc.extractCount} highlights</span>}
            {doc.learningItemCount > 0 && <span>{doc.learningItemCount} cards</span>}
          </div>
          {(doc.extractCount > 0 || doc.learningItemCount > 0) && <ProgressBar doc={doc} />}
          {doc.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {doc.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-primary/10 text-primary/80 rounded">{tag}</span>
              ))}
              {doc.tags.length > 2 && (
                <span className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded">+{doc.tags.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Context Menu (rendered via portal) */}
      {ctxPos && createPortal(
        <Fragment>
          <div className="fixed inset-0 z-[9998]" onContextMenu={(e) => { e.preventDefault(); setCtxPos(null); }} />
          <div ref={menuRef} className="fixed z-[9999] bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[200px]" style={{ left: ctxPos.x, top: ctxPos.y }}>
            {menuItems.map((item, i) =>
              item.divider ? (
                <div key={i} className="h-px bg-border my-1" />
              ) : (
                <button
                  key={i}
                  onClick={() => { setCtxPos(null); item.action(); }}
                  className={"flex items-center gap-2.5 w-full text-left px-3 py-1.5 text-sm transition-colors " + (item.color ? "hover:bg-destructive/10 " + item.color : "hover:bg-muted text-foreground")}
                >
                  {item.icon}
                  {item.label}
                </button>
              )
            )}
          </div>
        </Fragment>,
        document.body
      )}

      {/* Pair Picker */}
      {showPairPicker && (() => {
        const targetType = doc.fileType === "audio" ? "epub" : "audio";
        const allDocs = useDocumentStore.getState().documents;
        const candidates = allDocs.filter(
          d => d.id !== doc.id && d.fileType === targetType && !d.isArchived
        );
        const filtered = pairSearch
          ? candidates.filter(d => d.title.toLowerCase().includes(pairSearch.toLowerCase()))
          : candidates;
        const typeLabel = targetType === "epub" ? "EPUB" : "audiobook";
        return createPortal(
          <Fragment>
            <div className="fixed inset-0 z-[9998]" onClick={() => { setShowPairPicker(false); setPairSearch(""); }} />
            <div className="fixed z-[9999] bg-popover border border-border rounded-lg shadow-xl w-[320px] max-h-[400px] flex flex-col"
              style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>
              <div className="p-3 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Pair with {typeLabel}</span>
                  <button onClick={() => { setShowPairPicker(false); setPairSearch(""); }} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input
                  autoFocus
                  type="text"
                  placeholder="Search..."
                  value={pairSearch}
                  onChange={(e) => setPairSearch(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-md"
                />
              </div>
              <div className="overflow-y-auto flex-1">
                {filtered.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No {typeLabel}s found</p>
                ) : filtered.map(d => (
                  <button
                    key={d.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2"
                    onClick={() => {
                      setShowPairPicker(false);
                      setPairSearch("");
                      const audioDoc = doc.fileType === "audio" ? doc : d;
                      const epubDoc = doc.fileType === "epub" ? doc : d;
                      onReadAlong?.(audioDoc, epubDoc);
                    }}
                  >
                    <BookOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{d.title}</span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{d.fileType}</span>
                  </button>
                ))}
              </div>
            </div>
          </Fragment>,
          document.body
        );
      })()}
    </div>
  );
}

/**
 * Mobile Import Menu
 *
 * A compact dropdown menu for mobile devices that consolidates all import options.
 * Reduces visual clutter while keeping all functionality accessible.
 */
interface MobileImportMenuProps {
  enableYouTubeImport?: boolean;
  onYouTubeClick: () => void;
  onArxivClick: () => void;
  onWebArticleClick: () => void;
  onAudiobookClick: () => void;
  onAnnaArchiveClick: () => void;
}

function MobileImportMenu({
  enableYouTubeImport,
  onYouTubeClick,
  onArxivClick,
  onWebArticleClick,
  onAudiobookClick,
  onAnnaArchiveClick,
}: MobileImportMenuProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && event.target instanceof Node && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2.5 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="More import options"
        aria-expanded={isOpen}
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-card border border-border rounded-xl shadow-lg z-50 py-1.5 animate-in fade-in slide-in-from-top-1">
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t("documentsView.importFrom")}
          </div>

          {enableYouTubeImport && (
            <button
              onClick={() => handleAction(onYouTubeClick)}
              className="w-full px-3 py-2.5 flex items-center gap-3 text-sm text-foreground hover:bg-muted/60 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <Youtube className="w-4 h-4 text-red-500" />
              </div>
              <span>{t("documentsView.importYouTube")}</span>
            </button>
          )}

          <button
            onClick={() => handleAction(onArxivClick)}
            className="w-full px-3 py-2.5 flex items-center gap-3 text-sm text-foreground hover:bg-muted/60 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
              <FileTextIcon className="w-4 h-4 text-orange-500" />
            </div>
            <span>{t("documentsView.arxiv")}</span>
          </button>

          <button
            onClick={() => handleAction(onWebArticleClick)}
            className="w-full px-3 py-2.5 flex items-center gap-3 text-sm text-foreground hover:bg-muted/60 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Globe className="w-4 h-4 text-blue-500" />
            </div>
            <span>{t("documentsView.webArticle")}</span>
          </button>

          <button
            onClick={() => handleAction(onAudiobookClick)}
            className="w-full px-3 py-2.5 flex items-center gap-3 text-sm text-foreground hover:bg-muted/60 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <BookAudio className="w-4 h-4 text-amber-600" />
            </div>
            <span>{t("documentsView.audiobook")}</span>
          </button>

          {false && isTauri() && (
            <>
              <div className="my-1 border-t border-border" />
              <button
                onClick={() => handleAction(onAnnaArchiveClick)}
                className="w-full px-3 py-2.5 flex items-center gap-3 text-sm text-foreground hover:bg-muted/60 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-4 h-4 text-purple-500" />
                </div>
                <span>{t("documentsView.annasArchive")}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Mobile Saved Views Menu
 *
 * A compact dropdown for saved views on mobile devices.
 * Consolidates view selection and save functionality.
 */
interface MobileSavedViewsMenuProps {
  savedViews: SavedView[];
  activeViewId: string | null;
  onApplyView: (viewId: string) => void;
  onSaveView: () => void;
}

function MobileSavedViewsMenu({
  savedViews,
  activeViewId,
  onApplyView,
  onSaveView,
}: MobileSavedViewsMenuProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeView = savedViews.find((v) => v.id === activeViewId);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && event.target instanceof Node && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative flex-1" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between gap-2 transition-colors min-h-[44px] ${
          activeView
            ? "bg-primary/10 text-primary border border-primary/20"
            : "bg-background border border-border text-foreground hover:bg-muted/60"
        }`}
        aria-label={t("documentsView.savedViews")}
        aria-expanded={isOpen}
      >
        <span className="truncate">{activeView?.name ?? t("documentsView.savedViews")}</span>
        <svg
          className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-xl shadow-lg z-50 py-1.5 animate-in fade-in slide-in-from-top-1">
          <button
            onClick={() => {
              onSaveView();
              setIsOpen(false);
            }}
            className="w-full px-3 py-2.5 flex items-center gap-3 text-sm text-primary hover:bg-primary/5 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Plus className="w-4 h-4" />
            </div>
            <span className="font-medium">{t("documentsView.saveCurrentView")}</span>
          </button>

          {savedViews.length > 0 && <div className="my-1 border-t border-border" />}

          <div className="max-h-48 overflow-y-auto">
            {savedViews.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                {t("documentsView.noSavedViews")}
              </div>
            ) : (
              savedViews.map((view) => (
                <button
                  key={view.id}
                  onClick={() => {
                    onApplyView(view.id);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2.5 flex items-center gap-3 text-sm transition-colors ${
                    activeViewId === view.id
                      ? "bg-primary/5 text-primary"
                      : "text-foreground hover:bg-muted/60"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      activeViewId === view.id ? "bg-primary/10" : "bg-muted"
                    }`}
                  >
                    {view.mode === "grid" ? (
                      <LayoutGrid
                        className={`w-4 h-4 ${activeViewId === view.id ? "text-primary" : "text-muted-foreground"}`}
                      />
                    ) : (
                      <List
                        className={`w-4 h-4 ${activeViewId === view.id ? "text-primary" : "text-muted-foreground"}`}
                      />
                    )}
                  </div>
                  <span className="truncate">{view.name}</span>
                  {activeViewId === view.id && <Check className="w-4 h-4 ml-auto flex-shrink-0" />}
                </button>
              ))
            )}
          </div>

          {savedViews.length > 0 && (
            <>
              <div className="my-1 border-t border-border" />
              <button
                onClick={() => {
                  onApplyView("");
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                {t("documentsView.resetToDefault")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
