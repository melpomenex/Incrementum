import React, { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Clock,
  EyeOff,
  Filter,
  Info,
  Keyboard,
  LayoutList,
  Pause,
  Play,
  RotateCcw,
  Smartphone,
  Sparkles,
  Target,
  Trash2,
  Zap,
} from "lucide-react";
import { DynamicVirtualList } from "../common/VirtualList";
import { useQueueStore } from "../../stores/queueStore";
import { useSettingsStore } from "../../stores/settingsStore";
import type { QueueItem } from "../../types/queue";
import { ItemDetailsPopover, type ItemDetailsTarget } from "../common/ItemDetailsPopover";
import {
  PriorityPreset,
  buildSessionBlocks,
  applyFilters,
  formatMinutesRange,
  getFsrsMetrics,
  getFsrsSchedulingInfo,
  getPriorityScore,
  getPriorityVector,
  getQueueStatus,
  getReadingImpact,
  getStatusLabel,
  getTimeEstimateRange,
  type SessionCustomizationOptions,
} from "../../utils/reviewUx";
import {
  SessionCustomizeModal,
  DEFAULT_CUSTOMIZATION,
  type SessionCustomization,
} from "./SessionCustomizeModal";
import { postponeItem } from "../../api/queue";
import { dismissDocument } from "../../api/documents";
import { useToast } from "../common/Toast";
import { getSessionStats, clearQueueSession } from "../../lib/queueSession";
import { useI18n } from "../../lib/i18n";
import { ScheduleView } from "../schedule/ScheduleView";

type QueueMode = "reading" | "review" | "schedule";

interface ReviewQueueViewProps {
  onStartReview?: (itemId?: string) => void;
  onOpenDocument?: (item: QueueItem) => void;
  onOpenScrollMode?: () => void;
}

const PRESET_DESC_KEYS: Record<PriorityPreset, string> = {
  "maximize-retention": "queuePreset.maximizeRetentionDesc",
  "minimize-time": "queuePreset.minimizeTimeDesc",
  "aggressive-catchup": "queuePreset.aggressiveCatchUpDesc",
  exploratory: "queuePreset.exploratoryLearningDesc",
  "project-focused": "queuePreset.projectFocusedDesc",
};

export function ReviewQueueView({ onStartReview, onOpenDocument, onOpenScrollMode }: ReviewQueueViewProps) {
  const { locale, t } = useI18n();
  const {
    items,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    loadQueue,
    loadStats,
    setSelected,
    selectAll,
    clearSelection,
    bulkSuspend,
    bulkUnsuspend,
    bulkDelete,
    bulkOperationLoading,
    bulkOperationResult,
    clearBulkResult,
    queueFilterMode,
    setQueueFilterMode,
    loadDueDocumentsOnly,
    loadDueQueueItems,
  } = useQueueStore(
    useShallow((state) => ({
      items: state.items,
      isLoading: state.isLoading,
      error: state.error,
      searchQuery: state.searchQuery,
      setSearchQuery: state.setSearchQuery,
      loadQueue: state.loadQueue,
      loadStats: state.loadStats,
      setSelected: state.setSelected,
      selectAll: state.selectAll,
      clearSelection: state.clearSelection,
      bulkSuspend: state.bulkSuspend,
      bulkUnsuspend: state.bulkUnsuspend,
      bulkDelete: state.bulkDelete,
      bulkOperationLoading: state.bulkOperationLoading,
      bulkOperationResult: state.bulkOperationResult,
      clearBulkResult: state.clearBulkResult,
      queueFilterMode: state.queueFilterMode,
      setQueueFilterMode: state.setQueueFilterMode,
      loadDueDocumentsOnly: state.loadDueDocumentsOnly,
      loadDueQueueItems: state.loadDueQueueItems,
    }))
  );
  // Subscribe to selectedIds separately to avoid creating new Set reference in selector
  const selectedIds = useQueueStore((state) => state.selectedIds);
  const [queueMode, setQueueMode] = useState<QueueMode>("reading");
  const [preset, setPreset] = useState<PriorityPreset>(
    useSettingsStore.getState().settings.smartQueue.queueStrategyPreset as PriorityPreset
  );
  const updateSettingsCategory = useSettingsStore((s) => s.updateSettingsCategory);
  const handleSetPreset = (value: PriorityPreset) => {
    setPreset(value);
    updateSettingsCategory("smartQueue", { queueStrategyPreset: value });
  };
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isManualBrowseActive, setManualBrowseActive] = useState(false);
  const [isInspectorOpen, setInspectorOpen] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [isCustomizeModalOpen, setCustomizeModalOpen] = useState(false);
  const [sessionCustomization, setSessionCustomization] = useState<SessionCustomization>(() => {
    const saved = useSettingsStore.getState().settings.smartQueue.sessionItemTypes;
    if (saved) {
      return {
        ...DEFAULT_CUSTOMIZATION,
        itemTypes: {
          documents: saved.documents ?? DEFAULT_CUSTOMIZATION.itemTypes.documents,
          extracts: saved.extracts ?? DEFAULT_CUSTOMIZATION.itemTypes.extracts,
          learningItems: saved.learningItems ?? DEFAULT_CUSTOMIZATION.itemTypes.learningItems,
        },
      };
    }
    return DEFAULT_CUSTOMIZATION;
  });
  const [selectedFileType, setSelectedFileType] = useState<string>("all");
  const searchRef = useRef<HTMLInputElement>(null);
  const queueListRef = useRef<HTMLDivElement>(null);
  const selectedIndexRef = useRef(0);
  const lastSelectedLearningIdRef = useRef<string | null>(null);
  const toast = useToast();

  // Context menu state
  const [ctxItem, setCtxItem] = useState<QueueItem | null>(null);
  const [ctxPos, setCtxPos] = useState<{ x: number; y: number } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click (using contains check to avoid race with menu clicks)
  useEffect(() => {
    if (!ctxPos) return;
    const handler = (e: MouseEvent) => {
      if (ctxMenuRef.current && ctxMenuRef.current.contains(e.target as Node)) return;
      setCtxPos(null);
      setCtxItem(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ctxPos]);

  // Session stats for smart queue
  const [sessionStats, setSessionStats] = useState(() => getSessionStats());
  
  const handleClearSession = () => {
    clearQueueSession();
    setSessionStats(getSessionStats());
    // Reload queue to show all items again
    loadQueue();
    toast.success(t("queue.sessionCleared"), t("queue.allItemsAvailableAgain"));
  };

  // Debug: Check if scroll mode is available
  useEffect(() => {
    console.log("ReviewQueueView state:", { queueMode, onOpenScrollMode: !!onOpenScrollMode });
  }, [queueMode, onOpenScrollMode]);

  useEffect(() => {
    if (queueMode === "review") {
      loadDueQueueItems();
      loadStats();
      return;
    }

    // Reading queue: load based on current filter mode
    switch (queueFilterMode) {
      case "due-today":
        loadDueDocumentsOnly();
        break;
      case "due-all":
        loadDueQueueItems();
        break;
      case "all-items":
      case "new-only":
      default:
        loadQueue();
        break;
    }
    loadStats();
  }, [queueMode, queueFilterMode, loadQueue, loadDueDocumentsOnly, loadDueQueueItems, loadStats]);

  function getLearningHint(item: QueueItem) {
    if (item.itemType !== "learning-item") return null;
    const raw = item.clozeText || item.question || "";
    if (!raw) return null;
    const noCloze = raw.replace(/\[\[c\d+::(.*?)\]\]/g, "$1");
    const withoutHtml = noCloze.replace(/<[^>]*>/g, " ");
    const trimmed = withoutHtml.replace(/\s+/g, " ").trim();
    if (!trimmed) return null;
    const maxLength = 80;
    return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;
  }

  // Get unique file types for filter dropdown
  const availableFileTypes = useMemo(() => {
    const types = new Set(items.map((item) => item.documentFileType).filter(Boolean));
    return Array.from(types).sort();
  }, [items]);

  const visibleItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    let queueItems = items.filter((item) => {
      if (queueMode === "review") {
        return item.itemType === "learning-item";
      }
      // Reading mode: only show imported documents (books/articles/RSS), not extracts or learning items
      return item.itemType === "document";
    });
    
    // Apply file type filter
    if (selectedFileType !== "all") {
      queueItems = queueItems.filter((item) => item.documentFileType === selectedFileType);
    }
    
    const searchedItems = normalizedQuery
      ? queueItems.filter((item) => {
        const hint = getLearningHint(item) ?? "";
        const haystack = [item.documentTitle, item.category, hint, ...(item.tags ?? [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      : queueItems;

    const customizationOptions: SessionCustomizationOptions = {
      maxItems: sessionCustomization.maxItems,
      filters: sessionCustomization.filters,
      itemTypes: sessionCustomization.itemTypes,
      priorityPreset: preset,
    };
    const filtered = applyFilters(searchedItems, customizationOptions);
    return [...filtered].sort((a, b) => getPriorityScore(b, preset) - getPriorityScore(a, preset));
  }, [items, queueMode, preset, searchQuery, selectedFileType, sessionCustomization]);

  const selectableItems = useMemo(
    () => visibleItems.filter((item) => item.itemType === "learning-item"),
    [visibleItems]
  );

  const allSelected = selectableItems.length > 0 && selectableItems.every((item) => selectedIds.has(item.id));

  const sessionBlocks = useMemo(() => {
    const options: SessionCustomizationOptions = {
      maxItems: sessionCustomization.maxItems,
      blockTimeBudgets: sessionCustomization.blockTimeBudgets,
    };
    return buildSessionBlocks(visibleItems, options);
  }, [visibleItems, sessionCustomization.maxItems, sessionCustomization.blockTimeBudgets]);
  const selectedItem = useMemo(
    () => visibleItems.find((item) => item.id === selectedId) ?? null,
    [visibleItems, selectedId]
  );
  const selectedBrowseIndex = useMemo(
    () => visibleItems.findIndex((item) => item.id === selectedId),
    [visibleItems, selectedId]
  );

  const getDaysUntilDue = (item: QueueItem) => {
    if (!item.dueDate) return 0;
    const due = new Date(item.dueDate);
    if (Number.isNaN(due.getTime())) return 0;
    const now = Date.now();
    return Math.round((due.getTime() - now) / (1000 * 60 * 60 * 24));
  };

  const refreshQueue = async () => {
    if (queueMode === "review") {
      await loadDueQueueItems();
    } else {
      switch (queueFilterMode) {
        case "due-today":
          await loadDueDocumentsOnly();
          break;
        case "due-all":
          await loadDueQueueItems();
          break;
        case "all-items":
        case "new-only":
        default:
          await loadQueue();
          break;
      }
    }
    await loadStats();
  };

  const applyScheduleShift = async (label: string, deltaDays: number) => {
    if (!selectedItem) return;
    if (selectedItem.itemType !== "learning-item") {
      toast.info(label, t("queue.learningItemsOnly"));
      return;
    }
    try {
      await postponeItem(selectedItem.id, deltaDays);
      toast.success(label, t("queue.reviewScheduleUpdated"));
      await refreshQueue();
    } catch (error) {
      toast.error(label, error instanceof Error ? error.message : t("queue.failedToUpdateSchedule"));
    }
  };

  const handleCompressIntervals = async () => {
    if (!selectedItem) return;
    const daysUntil = Math.abs(getDaysUntilDue(selectedItem));
    const deltaDays = -Math.max(1, Math.round(daysUntil * 0.5));
    await applyScheduleShift(t("queue.compressIntervals"), deltaDays);
  };

  const handleRescheduleIntelligently = async () => {
    if (!selectedItem) return;
    const deltaDays = -getDaysUntilDue(selectedItem);
    await applyScheduleShift(t("queue.rescheduleIntelligently"), deltaDays);
  };

  const handleDowngradeFrequency = async () => {
    if (!selectedItem) return;
    const daysUntil = Math.max(1, getDaysUntilDue(selectedItem));
    const deltaDays = Math.max(1, Math.round(daysUntil * 0.5));
    await applyScheduleShift(t("queue.downgradeFrequency"), deltaDays);
  };

  // Context menu action handlers
  const handleCtxStudyNow = (item: QueueItem) => {
    setCtxPos(null);
    setCtxItem(null);
    if (item.itemType === "learning-item") {
      onStartReview?.(item.learningItemId ?? item.id);
    } else {
      onOpenDocument?.(item);
    }
  };

  const handleCtxSuspend = async (item: QueueItem) => {
    setCtxPos(null);
    setCtxItem(null);
    if (item.itemType !== "learning-item") return;
    try {
      const { bulkSuspendItems } = await import("../../api/queue");
      const result = await bulkSuspendItems([item.id]);
      if (result.failed.length === 0) {
        toast.success(t("queue.suspended"), t("queue.scheduleUpdated"));
      } else {
        toast.error(t("queue.operationFailed"), result.errors.join(", "));
      }
      await refreshQueue();
    } catch (error) {
      toast.error(t("queue.operationFailed"), error instanceof Error ? error.message : "Unknown error");
    }
  };

  const handleCtxPostpone = async (item: QueueItem, days: number) => {
    setCtxPos(null);
    setCtxItem(null);
    try {
      await postponeItem(item.id, days);
      toast.success(t("queue.postponed"), t("queue.reviewScheduleUpdated", { days }));
      await refreshQueue();
    } catch (error) {
      toast.error(t("queue.operationFailed"), error instanceof Error ? error.message : "Unknown error");
    }
  };

  const handleCtxDelete = async (item: QueueItem) => {
    setCtxPos(null);
    setCtxItem(null);
    if (item.itemType !== "learning-item") return;
    try {
      const { bulkDeleteItems } = await import("../../api/queue");
      const result = await bulkDeleteItems([item.id]);
      if (result.failed.length === 0) {
        toast.success(t("queue.deleted"), t("queue.itemRemoved"));
      } else {
        toast.error(t("queue.operationFailed"), result.errors.join(", "));
      }
      await refreshQueue();
    } catch (error) {
      toast.error(t("queue.operationFailed"), error instanceof Error ? error.message : "Unknown error");
    }
  };

  const handleDismissDocument = async (item: QueueItem) => {
    if (item.itemType !== "document") {
      toast.info(t("queueScroll.dismissNotAvailable"), t("queueScroll.onlyDocuments"));
      return;
    }

    try {
      await dismissDocument(item.documentId, true);
      toast.success(t("queueScroll.documentDismissed"), t("queueScroll.documentDismissedDesc"));
      await refreshQueue();
    } catch (error) {
      console.error("Failed to dismiss document:", error);
      toast.error(
        t("queueScroll.dismissFailed"),
        error instanceof Error ? error.message : t("queueScroll.pleaseTryAgain")
      );
    }
  };

  const moveBrowseSelection = (delta: number) => {
    if (visibleItems.length === 0) return;
    const currentIndex = visibleItems.findIndex((item) => item.id === selectedId);
    const baseIndex = currentIndex === -1 ? selectedIndexRef.current : currentIndex;
    const nextIndex = Math.min(visibleItems.length - 1, Math.max(0, baseIndex + delta));
    selectedIndexRef.current = nextIndex;
    setSelectedId(visibleItems[nextIndex].id);
  };

  const jumpBrowseSelection = (to: "start" | "end") => {
    if (visibleItems.length === 0) return;
    const nextIndex = to === "start" ? 0 : visibleItems.length - 1;
    selectedIndexRef.current = nextIndex;
    setSelectedId(visibleItems[nextIndex].id);
  };

  const activateSelectedItem = () => {
    if (!selectedItem) return;
    if (selectedItem.itemType === "learning-item") {
      onStartReview?.(selectedItem.learningItemId ?? selectedItem.id);
      return;
    }
    onOpenDocument?.(selectedItem);
  };

  useEffect(() => {
    if (selectedBrowseIndex >= 0) {
      selectedIndexRef.current = selectedBrowseIndex;
    }
  }, [selectedBrowseIndex]);

  useEffect(() => {
    if (visibleItems.length === 0) {
      selectedIndexRef.current = 0;
      if (selectedId !== null) {
        setSelectedId(null);
      }
      return;
    }

    if (!selectedId) {
      const initialIndex = Math.min(selectedIndexRef.current, visibleItems.length - 1);
      setSelectedId(visibleItems[Math.max(0, initialIndex)].id);
      return;
    }

    const currentIndex = visibleItems.findIndex((item) => item.id === selectedId);
    if (currentIndex === -1) {
      const fallbackIndex = Math.min(selectedIndexRef.current, visibleItems.length - 1);
      setSelectedId(visibleItems[Math.max(0, fallbackIndex)].id);
    }
  }, [selectedId, visibleItems]);

  useEffect(() => {
    if (!selectedId) return;
    const selectedRow = queueListRef.current?.querySelector<HTMLElement>(`[data-queue-item-id="${selectedId}"]`);
    if (selectedRow && typeof selectedRow.scrollIntoView === "function") {
      selectedRow.scrollIntoView({ block: "nearest" });
    }
  }, [selectedId]);

  useEffect(() => {
    const handleStartReviewShortcut = () => {
      const selectedLearningId =
        selectedItem?.itemType === "learning-item"
          ? (selectedItem.learningItemId ?? selectedItem.id)
          : undefined;
      onStartReview?.(selectedLearningId);
    };

    window.addEventListener("start-review-session", handleStartReviewShortcut as EventListener);
    return () =>
      window.removeEventListener("start-review-session", handleStartReviewShortcut as EventListener);
  }, [onStartReview, selectedItem?.id, selectedItem?.learningItemId]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        if (allSelected) {
          clearSelection();
        } else {
          selectAll();
        }
        return;
      }
      if (event.key === "Delete" && selectedIds.size > 0) {
        event.preventDefault();
        void bulkDelete();
        return;
      }
      if (event.key.toLowerCase() === "i") {
        event.preventDefault();
        setInspectorOpen((prev) => !prev);
        return;
      }
      if (isManualBrowseActive && event.key === "Escape") {
        event.preventDefault();
        setManualBrowseActive(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    selectedIds.size,
    allSelected,
    clearSelection,
    selectAll,
    bulkDelete,
    isManualBrowseActive,
  ]);

  const handleQueueListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!isManualBrowseActive) return;

    if (event.key === "ArrowDown" || event.key.toLowerCase() === "j") {
      event.preventDefault();
      moveBrowseSelection(1);
      return;
    }
    if (event.key === "ArrowUp" || event.key.toLowerCase() === "k") {
      event.preventDefault();
      moveBrowseSelection(-1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      jumpBrowseSelection("start");
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      jumpBrowseSelection("end");
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      activateSelectedItem();
    }
  };

  const handleLearningItemSelection = (itemId: string, checked: boolean, shiftKey: boolean) => {
    if (!shiftKey || !lastSelectedLearningIdRef.current) {
      setSelected(itemId, checked);
      lastSelectedLearningIdRef.current = itemId;
      return;
    }

    const currentIndex = selectableItems.findIndex((item) => item.id === itemId);
    const previousIndex = selectableItems.findIndex((item) => item.id === lastSelectedLearningIdRef.current);
    if (currentIndex === -1 || previousIndex === -1) {
      setSelected(itemId, checked);
      lastSelectedLearningIdRef.current = itemId;
      return;
    }

    const start = Math.min(currentIndex, previousIndex);
    const end = Math.max(currentIndex, previousIndex);
    for (let i = start; i <= end; i += 1) {
      setSelected(selectableItems[i].id, checked);
    }
    lastSelectedLearningIdRef.current = itemId;
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleStartOptimalSession = () => {
    if (queueMode !== "reading") {
      setQueueMode("reading");
    }
    if (onOpenScrollMode) {
      onOpenScrollMode();
      return;
    }
    onStartReview?.();
  };

  const handleToggleSelectAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAll();
    }
  };

  const handleBulkSuspend = async () => {
    await bulkSuspend();
  };

  const handleBulkUnsuspend = async () => {
    await bulkUnsuspend();
  };

  const handleBulkDelete = async () => {
    await bulkDelete();
  };

  const buildDetailsTarget = (item: QueueItem): ItemDetailsTarget => {
    if (item.itemType === "learning-item") {
      return {
        type: "learning-item",
        id: item.learningItemId ?? item.id,
        title: item.documentTitle,
        tags: item.tags,
        category: item.category,
      };
    }
    if (item.itemType === "extract") {
      return {
        type: "extract",
        id: item.extractId ?? item.id,
        title: item.documentTitle,
        tags: item.tags,
        category: item.category,
      };
    }
    return {
      type: "document",
      id: item.documentId,
      title: item.documentTitle,
      tags: item.tags,
      category: item.category,
    };
  };

  return (
    <div className="h-full flex flex-col bg-cream pb-20 md:pb-0">
      <div className="border-b border-border bg-card p-3 md:p-4">
        <div className="flex flex-col md:flex-row md:flex-wrap items-start md:items-center justify-between gap-3">
          <div className="w-full md:w-auto">
            <h1 className="text-xl md:text-2xl font-semibold text-foreground">
              {queueMode === "reading" ? t("nav.queue") : queueMode === "schedule" ? t("schedule.title") : t("review.title")}
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden md:block">
              {queueMode === "reading"
                ? t("queue.readingSubtitle")
                : queueMode === "schedule"
                  ? ""
                  : t("queue.reviewSubtitle")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={handleStartOptimalSession}
              className="flex-1 md:flex-none px-3 md:px-4 py-2 md:py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 flex items-center justify-center gap-2 min-h-[44px] text-sm md:text-base"
            >
              <Play className="w-4 h-4" />
              <span className="hidden sm:inline">{t("queue.startOptimalSession")}</span>
              <span className="sm:hidden">{t("common.start")}</span>
            </button>
            {queueMode === "reading" && onOpenScrollMode && (
              <button
                onClick={onOpenScrollMode}
                className="flex-1 md:flex-none px-3 md:px-4 py-2 md:py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-md hover:opacity-90 flex items-center justify-center gap-2 min-h-[44px] text-sm md:text-base"
                title={t("queue.scrollModeTooltip")}
              >
                <Smartphone className="w-4 h-4" />
                {t("queue.scrollMode")}
              </button>
            )}
            <button
              onClick={() => setCustomizeModalOpen(true)}
              className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80"
            >
              {t("queue.customizeSession")}
            </button>
            <button
              onClick={() => {
                setManualBrowseActive((prev) => {
                  const next = !prev;
                  if (next) {
                    if (visibleItems.length > 0 && !selectedId) {
                      setSelectedId(visibleItems[0].id);
                    }
                    queueListRef.current?.focus();
                  }
                  return next;
                });
              }}
              aria-pressed={isManualBrowseActive}
              className={`px-4 py-2 border border-border rounded-md text-foreground transition-colors ${
                isManualBrowseActive ? "bg-primary/10 border-primary/40" : "bg-background hover:bg-muted/60"
              }`}
            >
              {t("queue.manualBrowse")}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-muted/60 rounded-md p-1">
            <button
              onClick={() => setQueueMode("reading")}
              className={`px-3 py-1 text-sm rounded ${queueMode === "reading" ? "bg-background shadow text-foreground" : "text-muted-foreground"
                }`}
            >
              {t("dashboard.readingQueue")}
            </button>
            <button
              onClick={() => setQueueMode("schedule")}
              className={`px-3 py-1 text-sm rounded ${queueMode === "schedule" ? "bg-background shadow text-foreground" : "text-muted-foreground"
                }`}
            >
              {t("schedule.title")}
            </button>
            <button
              onClick={() => setQueueMode("review")}
              className={`px-3 py-1 text-sm rounded ${queueMode === "review" ? "bg-background shadow text-foreground" : "text-muted-foreground"
                }`}
            >
              {t("review.queue")}
            </button>
          </div>
          <div className="flex-1 min-w-[220px] relative">
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("queue.searchPlaceholder")}
              className="w-full pl-4 pr-10 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          </div>
          {queueMode === "reading" && (
            <div className="flex items-center gap-1 bg-muted/60 rounded-md p-1">
              <button
                onClick={() => setQueueFilterMode("due-today")}
                className={`px-3 py-1 text-xs rounded flex items-center gap-1.5 ${queueFilterMode === "due-today" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                title={t("queue.filterDueTodayDesc")}
              >
                <Clock className="w-3 h-3" />
                {t("queue.filterDueToday")}
              </button>
              <button
                onClick={() => setQueueFilterMode("all-items")}
                className={`px-3 py-1 text-xs rounded flex items-center gap-1.5 ${queueFilterMode === "all-items" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                title={t("queue.filterAllItemsDesc")}
              >
                <LayoutList className="w-3 h-3" />
                {t("queue.filterAllItems")}
              </button>
              <button
                onClick={() => setQueueFilterMode("new-only")}
                className={`px-3 py-1 text-xs rounded flex items-center gap-1.5 ${queueFilterMode === "new-only" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                title={t("queue.filterNewOnlyDesc")}
              >
                <Sparkles className="w-3 h-3" />
                {t("queue.filterNewOnly")}
              </button>
              <button
                onClick={() => setQueueFilterMode("due-all")}
                className={`px-3 py-1 text-xs rounded flex items-center gap-1.5 ${queueFilterMode === "due-all" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                title={t("queue.filterDueAllDesc")}
              >
                <Target className="w-3 h-3" />
                {t("queue.filterDueAll")}
              </button>
            </div>
          )}
          
          {/* Session Status - Shows if smart filtering is active */}
          {sessionStats.totalViewed > 0 && queueMode === "reading" && queueFilterMode === "due-today" && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-md">
              <span className="text-xs text-amber-700">
                {t("queue.viewedThisSession", { count: sessionStats.totalViewed })}
                {sessionStats.unratedCount > 0 && ` (${t("queue.unratedCount", { count: sessionStats.unratedCount })})`}
              </span>
              <button
                onClick={handleClearSession}
                className="p-1 hover:bg-amber-500/20 rounded transition-colors"
                title={t("queue.clearSession")}
              >
                <RotateCcw className="w-3 h-3 text-amber-700" />
              </button>
            </div>
          )}
          
          {/* File Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={selectedFileType}
              onChange={(event) => setSelectedFileType(event.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-md text-sm"
            >
              <option value="all">{t("mediaLibrary.allTypes")}</option>
              {availableFileTypes.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <select
            value={preset}
            onChange={(event) => handleSetPreset(event.target.value as PriorityPreset)}
            className="px-3 py-2 bg-background border border-border rounded-md text-sm"
          >
            <option value="maximize-retention">{t("queuePreset.maximizeRetention")}</option>
            <option value="minimize-time">{t("queuePreset.minimizeTime")}</option>
            <option value="aggressive-catchup">{t("queuePreset.aggressiveCatchUp")}</option>
            <option value="exploratory">{t("queuePreset.exploratoryLearning")}</option>
            <option value="project-focused">{t("queuePreset.projectFocused")}</option>
          </select>
          <p className="text-xs text-muted-foreground max-w-[200px]">
            {t(PRESET_DESC_KEYS[preset])}
          </p>
          <button
            onClick={() => setInspectorOpen((prev) => !prev)}
            className="px-3 py-2 bg-muted text-foreground rounded-md text-sm hover:bg-muted/80"
          >
            {isInspectorOpen ? t("queue.hideInspector") : t("queue.showInspector")}
          </button>
        </div>
      </div>

      {queueMode === "schedule" ? (
        <ScheduleView />
      ) : (
      <>
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg">
              {error}
            </div>
          )}

          {bulkOperationResult && (
            <div className="p-3 bg-muted border border-border rounded-lg text-sm text-foreground flex items-center justify-between">
              <span>
                {t("queue.bulkUpdateResult", {
                  succeeded: bulkOperationResult.succeeded.length,
                  failed: bulkOperationResult.failed.length,
                })}
              </span>
              <button
                onClick={clearBulkResult}
                className="px-2 py-1 text-xs bg-background border border-border rounded"
              >
                {t("queue.dismiss")}
              </button>
            </div>
          )}

          {selectedIds.size > 0 && (
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between">
              <span className="text-sm text-primary">
                {t("queue.selectedCount", { count: selectedIds.size })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkSuspend}
                  disabled={bulkOperationLoading}
                  className="px-3 py-1.5 bg-background border border-border rounded text-sm"
                >
                  {t("queue.suspend")}
                </button>
                <button
                  onClick={handleBulkUnsuspend}
                  disabled={bulkOperationLoading}
                  className="px-3 py-1.5 bg-background border border-border rounded text-sm"
                >
                  {t("queue.unsuspend")}
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkOperationLoading}
                  className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded text-sm"
                >
                  {t("queue.delete")}
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">{t("queue.loading")}</div>
          ) : visibleItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {queueMode === "reading"
                ? t("queue.emptyReading")
                : t("queue.emptyReview")}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {sessionBlocks?.map((block) => (
                  <div key={block.id} className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-sm font-semibold text-foreground">{block.title}</h2>
                      <span className="text-xs text-muted-foreground">
                        {block.timeBudgetMinutes} min
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mb-3">
                      {t("queue.safeStopAfterItem", { count: block.safeStopCount })}
                    </div>
                    <div className="space-y-2">
                      {block.items?.slice(0, 3).map((item) => (
                        <div key={item.id} className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="text-foreground">•</span>
                          <span className="line-clamp-1">{item.documentTitle}</span>
                        </div>
                      ))}
                      {(block.items?.length ?? 0) > 3 && (
                        <div className="text-xs text-muted-foreground">
                          {t("queue.moreCount", { count: (block.items?.length ?? 0) - 3 })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>
                  {t("queue.sessionEstimatePerItem", {
                    estimate: visibleItems?.[0] ? formatMinutesRange(getTimeEstimateRange(visibleItems[0])) : t("reviewComplete.notAvailable"),
                  })}
                </span>
                <span>•</span>
                <span>{isManualBrowseActive ? t("queue.manualBrowseHintActive") : t("queue.manualBrowseHintInactive")}</span>
              </div>

              {isManualBrowseActive && (
                <div className="p-3 border border-primary/20 bg-primary/5 rounded-lg flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {t("queue.browsingPosition", {
                      position: visibleItems.length === 0 ? 0 : Math.max(1, selectedBrowseIndex + 1),
                      total: visibleItems.length,
                    })}
                  </span>
                  <button
                    onClick={() => moveBrowseSelection(-1)}
                    disabled={visibleItems.length === 0 || selectedBrowseIndex <= 0}
                    className="px-3 py-1.5 bg-background border border-border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("common.previous")}
                  </button>
                  <button
                    onClick={() => moveBrowseSelection(1)}
                    disabled={visibleItems.length === 0 || selectedBrowseIndex === -1 || selectedBrowseIndex >= visibleItems.length - 1}
                    className="px-3 py-1.5 bg-background border border-border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("common.next")}
                  </button>
                  <button
                    onClick={activateSelectedItem}
                    disabled={!selectedItem}
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("queue.openSelected")}
                  </button>
                </div>
              )}

              <div
                ref={queueListRef}
                className="space-y-3"
                tabIndex={isManualBrowseActive ? 0 : -1}
                onKeyDown={handleQueueListKeyDown}
                aria-label={t("queue.queueItemsList")}
              >
                {selectableItems.length > 0 && queueMode === "review" && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={allSelected} onChange={handleToggleSelectAll} />
                      {t("queue.selectAllLearningItems")}
                    </label>
                  </div>
                )}
                {visibleItems?.length > 20 ? (
                  <DynamicVirtualList
                    items={visibleItems}
                    renderItem={(item) => {
                      const isExpanded = expandedIds.has(item.id);
                      const status = getQueueStatus(item);
                      const priorityVector = getPriorityVector(item);
                      const estimateRange = getTimeEstimateRange(item);
                      const learningHint = getLearningHint(item);
                      return (
                        <div
                          key={item.id}
                          data-queue-item-id={item.id}
                          aria-selected={item.id === selectedId}
                          className={`border rounded-lg bg-card transition-colors ${item.id === selectedId ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                            }`}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedId(item.id);
                            setCtxItem(item);
                            setCtxPos({ x: e.clientX, y: e.clientY });
                          }}
                        >
                          <div
                            onClick={(event) => {
                              setSelectedId(item.id);
                              if (item.itemType !== "learning-item") return;

                              const isModifierMulti = event.metaKey || event.ctrlKey;
                              if (event.shiftKey || isModifierMulti) {
                                handleLearningItemSelection(
                                  item.id,
                                  !selectedIds.has(item.id),
                                  event.shiftKey
                                );
                              }
                            }}
                            onDoubleClick={(event) => {
                              event.stopPropagation();
                              if (item.itemType === "learning-item") {
                                onStartReview?.(item.learningItemId ?? item.id);
                                return;
                              }
                              onOpenDocument?.(item);
                            }}
                            className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {item.itemType === "learning-item" && (
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(item.id)}
                                  onChange={(event) => {
                                    event.stopPropagation();
                                    handleLearningItemSelection(
                                      item.id,
                                      !selectedIds.has(item.id),
                                      !!(event.nativeEvent as MouseEvent).shiftKey
                                    );
                                  }}
                                />
                              )}
                              <StatusPill status={status} />
                              {item.itemType === "document" && (() => {
                                const fsrsInfo = getFsrsSchedulingInfo(item);
                                return (
                                  <span
                                    className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-300"
                                    title={t("queue.nextReviewTitle", {
                                      date: fsrsInfo.nextReviewDate
                                        ? fsrsInfo.nextReviewDate.toLocaleDateString(locale)
                                        : t("queue.notScheduled"),
                                    })}
                                  >
                                    <Clock className="w-3 h-3 inline mr-1" />
                                    {fsrsInfo.statusLabel}
                                  </span>
                                );
                              })()}
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-foreground line-clamp-1">
                                  {item.documentTitle}
                                  {item.itemType === "learning-item" && learningHint && (
                                    <span className="font-normal text-muted-foreground">
                                      {" "}
                                      — {learningHint}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatMinutesRange(estimateRange)} • {t("queue.priorityWithValue", { value: getPriorityScore(item, preset) })}
                                </div>
                                <TimeConfidenceBar min={estimateRange.min} max={estimateRange.max} />
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <PriorityGlyph vector={priorityVector} />

                              {/* Dismiss Button - Only for documents */}
                              {item.itemType === "document" && (
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleDismissDocument(item);
                                  }}
                                  className="group relative w-8 h-8 rounded-full bg-slate-500 hover:bg-slate-600 flex items-center justify-center transition-all shadow-sm hover:shadow-md hover:scale-105"
                                  title={t("queueScroll.dismissTitle")}
                                >
                                  <EyeOff className="w-4 h-4 text-white" />
                                  <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                                    {t("queue.dismiss")}
                                  </span>
                                </button>
                              )}

                              <ItemDetailsPopover
                                target={buildDetailsTarget(item)}
                                onDismissStateChange={(dismissed) => {
                                  if (dismissed) {
                                    void refreshQueue();
                                  }
                                }}
                                renderTrigger={({ onClick, isOpen }) => (
                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onClick();
                                    }}
                                    className={`p-2 rounded-md border border-border bg-background hover:bg-muted/60 ${isOpen ? "text-foreground" : "text-muted-foreground"
                                      }`}
                                    title={t("queue.itemDetails")}
                                  >
                                    <Info className="w-4 h-4" />
                                  </button>
                                )}
                              />
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleExpanded(item.id);
                                }}
                                className="p-2 bg-muted rounded-md text-muted-foreground hover:text-foreground"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground space-y-2">
                              <div className="flex items-center gap-3">
                                <Sparkles className="w-4 h-4" />
                                <span>
                                  {t("queue.fsrsSummary", {
                                    stability: getFsrsMetrics(item).stability,
                                    difficulty: getFsrsMetrics(item).difficulty,
                                    retrievability: Math.round(getFsrsMetrics(item).retrievability * 100),
                                  })}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <Target className="w-4 h-4" />
                                <span>
                                  {t("queue.nextIntervalImpact", {
                                    days: getFsrsMetrics(item).nextIntervalDays,
                                    impact: getReadingImpact(item),
                                  })}
                                </span>
                              </div>
                              {status === "drifted" && (
                                <div className="flex items-center gap-3 text-muted-foreground">
                                  <AlertTriangle className="w-4 h-4" />
                                  <span>
                                    {t("queue.driftedStateMessage")}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    }}
                    estimateSize={80}
                    overscan={5}
                  />
                ) : (
                  visibleItems?.map((item) => {
                    const isExpanded = expandedIds.has(item.id);
                    const status = getQueueStatus(item);
                    const priorityVector = getPriorityVector(item);
                    const estimateRange = getTimeEstimateRange(item);
                    const learningHint = getLearningHint(item);
                    return (
                      <div
                        key={item.id}
                        data-queue-item-id={item.id}
                        aria-selected={item.id === selectedId}
                        className={`border rounded-lg bg-card transition-colors ${item.id === selectedId ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                          }`}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedId(item.id);
                          setCtxItem(item);
                          setCtxPos({ x: e.clientX, y: e.clientY });
                        }}
                      >
                        <div
                          onClick={(event) => {
                            setSelectedId(item.id);
                            if (item.itemType !== "learning-item") return;

                            const isModifierMulti = event.metaKey || event.ctrlKey;
                            if (event.shiftKey || isModifierMulti) {
                              handleLearningItemSelection(
                                item.id,
                                !selectedIds.has(item.id),
                                event.shiftKey
                              );
                            }
                          }}
                          onDoubleClick={(event) => {
                            event.stopPropagation();
                            if (item.itemType === "learning-item") {
                              onStartReview?.(item.learningItemId ?? item.id);
                              return;
                            }
                            onOpenDocument?.(item);
                          }}
                          className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {item.itemType === "learning-item" && (
                              <input
                                type="checkbox"
                                checked={selectedIds.has(item.id)}
                                onChange={(event) => {
                                  event.stopPropagation();
                                  handleLearningItemSelection(
                                    item.id,
                                    !selectedIds.has(item.id),
                                    !!(event.nativeEvent as MouseEvent).shiftKey
                                  );
                                }}
                              />
                            )}
                            <StatusPill status={status} />
                            {item.itemType === "document" && (() => {
                              const fsrsInfo = getFsrsSchedulingInfo(item);
                              return (
                                <span
                                  className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-300"
                                  title={t("queue.nextReviewTitle", {
                                    date: fsrsInfo.nextReviewDate
                                      ? fsrsInfo.nextReviewDate.toLocaleDateString(locale)
                                      : t("queue.notScheduled"),
                                  })}
                                >
                                  <Clock className="w-3 h-3 inline mr-1" />
                                  {fsrsInfo.statusLabel}
                                </span>
                              );
                            })()}
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-foreground line-clamp-1">
                                {item.documentTitle}
                                {item.itemType === "learning-item" && learningHint && (
                                  <span className="font-normal text-muted-foreground">
                                    {" "}
                                    — {learningHint}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatMinutesRange(estimateRange)} • {t("queue.priorityWithValue", { value: getPriorityScore(item, preset) })}
                              </div>
                              <TimeConfidenceBar min={estimateRange.min} max={estimateRange.max} />
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <PriorityGlyph vector={priorityVector} />

                            {/* Dismiss Button - Only for documents */}
                            {item.itemType === "document" && (
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleDismissDocument(item);
                                }}
                                className="group relative w-8 h-8 rounded-full bg-slate-500 hover:bg-slate-600 flex items-center justify-center transition-all shadow-sm hover:shadow-md hover:scale-105"
                                title={t("queueScroll.dismissTitle")}
                              >
                                <EyeOff className="w-4 h-4 text-white" />
                                <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                                  {t("queue.dismiss")}
                                </span>
                              </button>
                            )}

                            <ItemDetailsPopover
                              target={buildDetailsTarget(item)}
                              onDismissStateChange={(dismissed) => {
                                if (dismissed) {
                                  void refreshQueue();
                                }
                              }}
                              renderTrigger={({ onClick, isOpen }) => (
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onClick();
                                  }}
                                  className={`p-2 rounded-md border border-border bg-background hover:bg-muted/60 ${isOpen ? "text-foreground" : "text-muted-foreground"
                                    }`}
                                  title={t("queue.itemDetails")}
                                >
                                  <Info className="w-4 h-4" />
                                </button>
                              )}
                            />
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleExpanded(item.id);
                              }}
                              className="p-2 bg-muted rounded-md text-muted-foreground hover:text-foreground"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground space-y-2">
                            <div className="flex items-center gap-3">
                              <Sparkles className="w-4 h-4" />
                              <span>
                                {t("queue.fsrsSummary", {
                                  stability: getFsrsMetrics(item).stability,
                                  difficulty: getFsrsMetrics(item).difficulty,
                                  retrievability: Math.round(getFsrsMetrics(item).retrievability * 100),
                                })}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Target className="w-4 h-4" />
                              <span>
                                {t("queue.nextIntervalImpact", {
                                  days: getFsrsMetrics(item).nextIntervalDays,
                                  impact: getReadingImpact(item),
                                })}
                              </span>
                            </div>
                            {status === "drifted" && (
                              <div className="flex items-center gap-3 text-muted-foreground">
                                <AlertTriangle className="w-4 h-4" />
                                <span>
                                  {t("queue.driftedStateMessage")}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {isInspectorOpen && (
          <aside className="w-80 border-l border-border bg-card p-4 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">{t("queue.inspector")}</h2>
              <button
                onClick={() => setInspectorOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <LayoutList className="w-4 h-4" />
              </button>
            </div>
            {!selectedItem ? (
              <div className="text-sm text-muted-foreground">{t("queue.selectItemToInspect")}</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">{t("common.title")}</div>
                  <div className="text-sm font-semibold text-foreground">{selectedItem.documentTitle}</div>
                  <div className="text-xs text-muted-foreground mt-1">{selectedItem.itemType}</div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">{t("queue.schedulingRationale")}</div>
                  <div className="text-xs text-muted-foreground">
                    {t("queue.prioritySummary", {
                      value: getPriorityScore(selectedItem, preset),
                      status: getStatusLabel(getQueueStatus(selectedItem)),
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">{t("queue.fsrsSnapshot")}</div>
                  <div className="text-xs text-muted-foreground">
                    {t("queue.fsrsSummary", {
                      stability: getFsrsMetrics(selectedItem).stability,
                      difficulty: getFsrsMetrics(selectedItem).difficulty,
                      retrievability: Math.round(getFsrsMetrics(selectedItem).retrievability * 100),
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">{t("queue.nextInterval")}</div>
                  <div className="text-sm font-semibold text-foreground">
                    {t("queue.nextIntervalDays", { days: getFsrsMetrics(selectedItem).nextIntervalDays })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">{t("queue.conversionPathway")}</div>
                  <div className="text-xs text-muted-foreground">
                    {t("queue.conversionPathwayValue")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("queue.impactWithValue", { impact: getReadingImpact(selectedItem) })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">{t("queue.recoveryActions")}</div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleCompressIntervals}
                      disabled={!selectedItem || selectedItem.itemType !== "learning-item"}
                      className="px-3 py-2 bg-background border border-border rounded text-sm text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t("queue.compressIntervals")}
                    </button>
                    <button
                      onClick={handleRescheduleIntelligently}
                      disabled={!selectedItem || selectedItem.itemType !== "learning-item"}
                      className="px-3 py-2 bg-background border border-border rounded text-sm text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t("queue.rescheduleIntelligently")}
                    </button>
                    <button
                      onClick={handleDowngradeFrequency}
                      disabled={!selectedItem || selectedItem.itemType !== "learning-item"}
                      className="px-3 py-2 bg-background border border-border rounded text-sm text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t("queue.downgradeFrequency")}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => setShowAdvanced((prev) => !prev)}
                    className="px-3 py-2 bg-muted rounded text-sm flex items-center gap-2 text-foreground"
                  >
                    <Keyboard className="w-4 h-4" />
                    {showAdvanced ? t("queue.hideAdvanced") : t("queue.showAdvanced")}
                  </button>
                  {showAdvanced && (
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div>{t("queue.rawFsrsValues")}</div>
                      <div>{t("queue.overrideScheduling")}</div>
                      <button
                        onClick={() => setShowRawJson((prev) => !prev)}
                        className="px-3 py-1 bg-background border border-border rounded"
                      >
                        {showRawJson ? t("queue.hideJson") : t("queue.showJson")}
                      </button>
                      {showRawJson && (
                        <pre className="text-[10px] whitespace-pre-wrap bg-background border border-border rounded p-2">
                          {JSON.stringify(selectedItem, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Right-click Context Menu */}
      {ctxPos && ctxItem && (
        <>
          <div className="fixed inset-0 z-[9998]" onContextMenu={(e) => { e.preventDefault(); setCtxPos(null); setCtxItem(null); }} />
          <div
            ref={ctxMenuRef}
            className="fixed z-[9999] bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[220px] animate-in fade-in-0 zoom-in-95 duration-100"
            style={{ left: ctxPos.x, top: ctxPos.y }}
          >
            {/* Study / Open */}
            <button
              className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/80 flex items-center gap-2"
              onClick={() => handleCtxStudyNow(ctxItem)}
            >
              <Play className="w-4 h-4 text-emerald-500" />
              {ctxItem.itemType === "learning-item" ? t("queue.studyNow") : t("queue.openDocument")}
            </button>

            {ctxItem.itemType === "learning-item" && (
              <>
                <div className="h-px bg-border my-1" />

                {/* Suspend */}
                <button
                  className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/80 flex items-center gap-2"
                  onClick={() => void handleCtxSuspend(ctxItem)}
                >
                  <Pause className="w-4 h-4 text-amber-500" />
                  {t("queue.suspend")}
                </button>

                {/* Postpone submenu */}
                <div className="h-px bg-border my-1" />
                <div className="px-3 py-1 text-xs text-muted-foreground font-medium">{t("queue.postpone")}</div>
                {[1, 3, 7].map((days) => (
                  <button
                    key={days}
                    className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/80 flex items-center gap-2"
                    onClick={() => void handleCtxPostpone(ctxItem, days)}
                  >
                    <CalendarClock className="w-4 h-4 text-blue-400" />
                    +{days} {days === 1 ? t("queue.day") : t("queue.days")}
                  </button>
                ))}

                <div className="h-px bg-border my-1" />

                {/* Compress intervals */}
                <button
                  className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/80 flex items-center gap-2"
                  onClick={async () => {
                    setCtxPos(null); setCtxItem(null);
                    setSelectedId(ctxItem.id);
                    // Temporarily set selectedItem so inspector handlers work
                    await applyScheduleShift(t("queue.compressIntervals"), -Math.max(1, Math.round(Math.abs(getDaysUntilDue(ctxItem)) * 0.5)));
                  }}
                >
                  <Zap className="w-4 h-4 text-orange-400" />
                  {t("queue.compressIntervals")}
                </button>

                {/* Reschedule to now */}
                <button
                  className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/80 flex items-center gap-2"
                  onClick={async () => {
                    setCtxPos(null); setCtxItem(null);
                    setSelectedId(ctxItem.id);
                    await applyScheduleShift(t("queue.rescheduleIntelligently"), -getDaysUntilDue(ctxItem));
                  }}
                >
                  <RotateCcw className="w-4 h-4 text-purple-400" />
                  {t("queue.rescheduleIntelligently")}
                </button>

                <div className="h-px bg-border my-1" />

                {/* Delete */}
                <button
                  className="w-full px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2"
                  onClick={() => void handleCtxDelete(ctxItem)}
                >
                  <Trash2 className="w-4 h-4" />
                  {t("queue.delete")}
                </button>
              </>
            )}

            {ctxItem.itemType === "document" && (
              <>
                <div className="h-px bg-border my-1" />

                {/* Dismiss */}
                <button
                  className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/80 flex items-center gap-2"
                  onClick={() => { setCtxPos(null); setCtxItem(null); void handleDismissDocument(ctxItem); }}
                >
                  <EyeOff className="w-4 h-4 text-slate-400" />
                  {t("queue.dismiss")}
                </button>

                {/* Delete */}
                <button
                  className="w-full px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2"
                  onClick={() => {
                    setCtxPos(null); setCtxItem(null);
                    toast.info(t("queue.delete"), t("queueScroll.onlyDocuments"));
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  {t("queue.delete")}
                </button>
              </>
            )}
          </div>
        </>
      )}

      <SessionCustomizeModal
        isOpen={isCustomizeModalOpen}
        onClose={() => setCustomizeModalOpen(false)}
        customization={sessionCustomization}
        onChange={(next) => {
          setSessionCustomization(next);
          // Persist item type preferences to settings
          updateSettingsCategory("smartQueue", {
            sessionItemTypes: { ...next.itemTypes },
          });
        }}
        onApply={() => setCustomizeModalOpen(false)}
        availableTags={Array.from(new Set(items.flatMap((item) => item.tags || [])))}
        availableCategories={Array.from(new Set(items.map((item) => item.category).filter(Boolean)))}
      />
      </>
      )}
    </div>
  );
}

const PriorityGlyph = React.memo(function PriorityGlyph({ vector }: { vector: ReturnType<typeof getPriorityVector> }) {
  const tooltip = `Retention ${vector.retentionRisk} • Load ${vector.cognitiveLoad} • Time ${vector.timeEfficiency} • Intent ${vector.userIntent} • Overdue ${vector.overduePenalty}`;
  return (
    <div className="flex items-center gap-1" title={tooltip}>
      <div className="h-2 w-20 bg-muted/60 rounded-full overflow-hidden flex">
        <div className="h-full bg-red-500/50" style={{ width: `${vector.retentionRisk / 5}%` }} />
        <div className="h-full bg-amber-500/50" style={{ width: `${vector.cognitiveLoad / 5}%` }} />
        <div className="h-full bg-emerald-500/50" style={{ width: `${vector.timeEfficiency / 5}%` }} />
        <div className="h-full bg-blue-500/50" style={{ width: `${vector.userIntent / 5}%` }} />
        <div className="h-full bg-slate-500/50" style={{ width: `${vector.overduePenalty / 5}%` }} />
      </div>
    </div>
  );
});

const StatusPill = React.memo(function StatusPill({ status }: { status: ReturnType<typeof getQueueStatus> }) {
  const label = getStatusLabel(status);
  const styles =
    status === "drifted"
      ? "bg-slate-500/15 text-slate-200 dark:text-slate-300"
      : status === "due-overdue"
        ? "bg-red-500/15 text-red-600 dark:text-red-300"
        : status === "due"
          ? "bg-orange-500/15 text-orange-600 dark:text-orange-300"
          : status === "scheduled"
            ? "bg-blue-500/15 text-blue-600 dark:text-blue-300"
            : status === "review"
              ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300"
              : status === "learning"
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${styles}`}>{label}</span>
  );
});

function TimeConfidenceBar({ min, max }: { min: number; max: number }) {
  const width = Math.min(100, Math.max(10, Math.round((min / Math.max(max, 1)) * 100)));
  return (
    <div className="mt-1 h-1.5 w-24 bg-muted/60 rounded-full overflow-hidden">
      <div className="h-full bg-primary/50" style={{ width: `${width}%` }} />
    </div>
  );
}
