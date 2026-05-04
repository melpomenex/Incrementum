/**
 * Mobile Queue View - Simplified for PWA
 * 
 * A streamlined mobile-optimized queue view that:
 * - Shows only essential information
 * - Collapses complex filters into a drawer
 * - Prioritizes quick actions (Start Reading, Scroll Mode)
 * - Uses cards optimized for touch
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  Play,
  Smartphone,
  Search,
  ChevronDown,
  Clock,
  BookOpen,
  Brain,
  CalendarDays,
  X,
  SlidersHorizontal,
  Archive,
  Calendar,
} from "lucide-react";
import { useQueueStore } from "../../stores/queueStore";
import type { QueueItem } from "../../types/queue";
import { useToast } from "../common/Toast";
import { cn } from "../../utils";
import { SwipeableItem } from "./SwipeableItem";
import { bulkSuspendItems, bulkUnsuspendItems, postponeItem } from "../../api/queue";
import { useI18n } from "../../lib/i18n";
import { MobileScheduleView } from "../schedule/MobileScheduleView";

interface MobileQueueViewProps {
  onStartReview?: (itemId?: string) => void;
  onOpenDocument?: (item: QueueItem) => void;
  onOpenScrollMode?: () => void;
}

type QuickFilter = "today" | "all" | "new";

export function MobileQueueView({
  onStartReview,
  onOpenDocument,
  onOpenScrollMode,
}: MobileQueueViewProps) {
  const {
    items,
    isLoading,
    loadQueue,
    loadDueDocumentsOnly,
    setQueueFilterMode,
  } = useQueueStore(
    useShallow((state) => ({
      items: state.items,
      isLoading: state.isLoading,
      loadQueue: state.loadQueue,
      loadDueDocumentsOnly: state.loadDueDocumentsOnly,
      setQueueFilterMode: state.setQueueFilterMode,
    }))
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<"reading" | "review" | "schedule">("reading");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("today");
  const { t } = useI18n();
  const toast = useToast();

  // Undo toast state
  const [undoState, setUndoState] = useState<{
    visible: boolean;
    action: "suspend" | "postpone";
    itemId: string;
    itemTitle: string;
    progress: number;
  } | null>(null);

  // Load initial data
  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Apply quick filter
  useEffect(() => {
    switch (quickFilter) {
      case "today":
        setQueueFilterMode("due-today");
        loadDueDocumentsOnly();
        break;
      case "all":
        setQueueFilterMode("all-items");
        loadQueue();
        break;
      case "new":
        setQueueFilterMode("new-only");
        loadQueue();
        break;
    }
  }, [quickFilter, setQueueFilterMode, loadDueDocumentsOnly, loadQueue]);

  // Filter items
  const filteredItems = useMemo(() => {
    let result = items.filter((item) => {
      if (activeTab === "review") {
        return item.itemType === "learning-item";
      }
      return item.itemType === "document";
    });

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) =>
        item.documentTitle.toLowerCase().includes(query) ||
        item.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Sort: due items first, then by priority
    return result.sort((a, b) => {
      const aDue = a.dueDate ? new Date(a.dueDate) <= new Date() : false;
      const bDue = b.dueDate ? new Date(b.dueDate) <= new Date() : false;
      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;
      return (b.priority ?? 0) - (a.priority ?? 0);
    });
  }, [items, activeTab, searchQuery]);

  const dueCount = useMemo(() => {
    return items.filter((item) => {
      if (item.itemType !== "document") return false;
      const due = item.dueDate ? new Date(item.dueDate) : null;
      return due && due <= new Date();
    }).length;
  }, [items]);

  const newCount = useMemo(() => {
    return items.filter((item) => 
      item.itemType === "document" && !item.dueDate
    ).length;
  }, [items]);

  const handleStartSession = () => {
    const firstDue = filteredItems[0];
    if (firstDue) {
      onOpenDocument?.(firstDue);
    } else {
      toast.info(t("mobileQueue.noItemsReady"), t("mobileQueue.noItemsReadyDesc"));
    }
  };

  const getDueBadge = (item: QueueItem) => {
    if (!item.dueDate) return null;
    const due = new Date(item.dueDate);
    const now = new Date();
    const daysDiff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff <= 0) return { label: t("mobileQueue.dueNow"), color: "bg-red-500" };
    if (daysDiff <= 3) return { label: t("mobileQueue.daysShort", { count: daysDiff }), color: "bg-orange-500" };
    return { label: t("mobileQueue.daysShort", { count: daysDiff }), color: "bg-blue-500" };
  };

  // Swipe handlers
  const handleSuspend = useCallback(async (item: QueueItem) => {
    try {
      await bulkSuspendItems([item.id]);
      toast.success(t("mobileQueue.itemSuspended"), t("mobileQueue.removedFromQueue"));
      loadQueue(); // Refresh the queue

      // Show undo toast
      setUndoState({
        visible: true,
        action: "suspend",
        itemId: item.id,
        itemTitle: item.documentTitle,
        progress: 100,
      });

      // Start progress animation
      const startTime = Date.now();
      const duration = 3000; // 3 seconds

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 100 - (elapsed / duration) * 100);

        setUndoState((prev) => prev ? { ...prev, progress: remaining } : null);

        if (elapsed < duration && undoState?.visible) {
          requestAnimationFrame(animate);
        } else if (undoState?.visible) {
          setUndoState((prev) => (prev ? { ...prev, visible: false } : null));
        }
      };

      requestAnimationFrame(animate);
    } catch (error) {
      toast.error(t("mobileQueue.failedToSuspend"), error instanceof Error ? error.message : t("reviewSession.unknownError"));
    }
  }, [loadQueue, toast, undoState?.visible]);

  const handlePostpone = useCallback(async (item: QueueItem) => {
    try {
      await postponeItem(item.id, 1); // Postpone by 1 day
      toast.success(t("mobileQueue.itemPostponed"), t("mobileQueue.rescheduledForTomorrow"));
      loadQueue(); // Refresh the queue

      // Show undo toast (for postpone, we'd need to store the original due date to undo)
      setUndoState({
        visible: true,
        action: "postpone",
        itemId: item.id,
        itemTitle: item.documentTitle,
        progress: 100,
      });

      // Start progress animation
      const startTime = Date.now();
      const duration = 3000;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 100 - (elapsed / duration) * 100);

        setUndoState((prev) => prev ? { ...prev, progress: remaining } : null);

        if (elapsed < duration && undoState?.visible) {
          requestAnimationFrame(animate);
        } else if (undoState?.visible) {
          setUndoState((prev) => (prev ? { ...prev, visible: false } : null));
        }
      };

      requestAnimationFrame(animate);
    } catch (error) {
      toast.error(t("mobileQueue.failedToPostpone"), error instanceof Error ? error.message : t("reviewSession.unknownError"));
    }
  }, [loadQueue, toast, undoState?.visible]);

  const handleUndo = useCallback(async () => {
    if (!undoState) return;

    try {
      if (undoState.action === "suspend") {
        await bulkUnsuspendItems([undoState.itemId]);
        toast.success(t("mobileQueue.itemRestored"), t("mobileQueue.backInQueue"));
      }
      // Postpone undo would require storing the original due date
      loadQueue();
    } catch (error) {
      toast.error(t("mobileQueue.failedToUndo"), error instanceof Error ? error.message : t("reviewSession.unknownError"));
    } finally {
      setUndoState(null);
    }
  }, [undoState, loadQueue, toast]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold text-foreground">
            {activeTab === "reading" ? t("mobileQueue.readingQueue") : activeTab === "schedule" ? t("schedule.title") : t("mobileQueue.review")}
          </h1>
          <div className="flex items-center gap-2">
            {activeTab === "reading" && (
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "p-2 rounded-full transition-colors",
                  showFilters ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                )}
                aria-label={t("mobileQueue.toggleFilters")}
              >
                <SlidersHorizontal className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-muted rounded-lg p-1">
          <button
            onClick={() => setActiveTab("reading")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all",
              activeTab === "reading"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            )}
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden xs:inline">{t("mobileQueue.reading")}</span>
            {dueCount > 0 && (
              <span className="px-1.5 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">
                {dueCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("schedule")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all",
              activeTab === "schedule"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            )}
          >
            <CalendarDays className="w-4 h-4" />
            <span className="hidden xs:inline">{t("schedule.title")}</span>
          </button>
          <button
            onClick={() => setActiveTab("review")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all",
              activeTab === "review"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            )}
          >
            <Brain className="w-4 h-4" />
            <span className="hidden xs:inline">{t("mobileQueue.review")}</span>
          </button>
        </div>
      </div>

      {activeTab === "schedule" ? (
        <MobileScheduleView />
      ) : (
      <>
      {/* Quick Filters (Reading only) */}
      {activeTab === "reading" && (
        <div className="px-4 py-2 border-b border-border bg-card/50">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setQuickFilter("today")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors",
                quickFilter === "today"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              )}
            >
              <Clock className="w-3.5 h-3.5" />
              {t("mobileQueue.dueToday")}
              {dueCount > 0 && <span className="ml-0.5">({dueCount})</span>}
            </button>
            <button
              onClick={() => setQuickFilter("new")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors",
                quickFilter === "new"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              )}
            >
              {t("mobileQueue.new")}
              {newCount > 0 && <span className="ml-0.5">({newCount})</span>}
            </button>
            <button
              onClick={() => setQuickFilter("all")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors",
                quickFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              )}
            >
              {t("mobileQueue.allItems")}
            </button>
          </div>
        </div>
      )}

      {/* Expanded Filters Panel */}
      {showFilters && activeTab === "reading" && (
        <div className="px-4 py-3 border-b border-border bg-card/50 animate-in slide-in-from-top-2">
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("mobileQueue.searchPlaceholder")}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Action Buttons */}
      <div className="px-4 py-3 border-b border-border bg-card/30">
        <div className="flex gap-2">
          <button
            onClick={handleStartSession}
            disabled={filteredItems.length === 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            <Play className="w-5 h-5" />
            {activeTab === "reading" ? t("mobileQueue.startReading") : t("mobileQueue.startReview")}
          </button>
          {activeTab === "reading" && onOpenScrollMode && (
            <button
              onClick={onOpenScrollMode}
              disabled={filteredItems.length === 0}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
            >
              <Smartphone className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mr-2" />
            {t("mobileQueue.loading")}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 px-6 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-2">
              {activeTab === "reading"
                ? t("mobileQueue.noDocumentsReady")
                : t("mobileQueue.noCardsDueReview")}
            </p>
            <p className="text-sm text-muted-foreground/70">
              {activeTab === "reading"
                ? t("mobileQueue.importToStart")
                : t("mobileQueue.allCaughtUp")}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredItems.map((item) => {
              const dueBadge = getDueBadge(item);
              return (
                <SwipeableItem
                  key={item.id}
                  leftAction={{
                    icon: <Calendar className="w-5 h-5" />,
                    label: t("mobileQueue.postpone"),
                    color: "#6366f1",
                    bgColor: "rgba(99, 102, 241, 0.15)",
                  }}
                  rightAction={{
                    icon: <Archive className="w-5 h-5" />,
                    label: t("mobileQueue.suspend"),
                    color: "#6366f1",
                    bgColor: "rgba(99, 102, 241, 0.15)",
                  }}
                  onSwipeLeft={() => handlePostpone(item)}
                  onSwipeRight={() => handleSuspend(item)}
                  className="border-b border-border last:border-b-0"
                >
                  <button
                    onClick={() =>
                      activeTab === "reading"
                        ? onOpenDocument?.(item)
                        : onStartReview?.(item.learningItemId ?? item.id)
                    }
                    className="w-full px-4 py-4 flex items-start gap-3 active:bg-muted/50 transition-colors text-left"
                  >
                    {/* Icon/Status */}
                    <div className="flex-shrink-0 mt-0.5">
                      {activeTab === "reading" ? (
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          dueBadge ? "bg-red-500/10" : "bg-muted"
                        )}>
                          <BookOpen className={cn(
                            "w-5 h-5",
                            dueBadge ? "text-red-500" : "text-muted-foreground"
                          )} />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <Brain className="w-5 h-5 text-purple-500" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-1">
                        {item.documentTitle}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {dueBadge && (
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-white font-medium",
                            dueBadge.color
                          )}>
                            {dueBadge.label}
                          </span>
                        )}
                        {item.category && (
                          <span className="bg-muted px-1.5 py-0.5 rounded">
                            {item.category}
                          </span>
                        )}
                        {item.documentFileType && (
                          <span className="uppercase">{item.documentFileType}</span>
                        )}
                      </div>
                    </div>

                    {/* Chevron */}
                    <ChevronDown className="w-5 h-5 text-muted-foreground -rotate-90 flex-shrink-0 mt-2" />
                  </button>
                </SwipeableItem>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats Footer */}
      <div className="px-4 py-2 border-t border-border bg-card/30 text-center text-xs text-muted-foreground">
        {t("mobileQueue.itemsReady", { count: filteredItems.length })}
      </div>

      {/* Undo Toast */}
      {undoState && undoState.visible && (
        <div
          className={cn(
            "undo-toast",
            undoState.visible && "visible"
          )}
        >
          <div
            className={cn(
              "undo-toast-icon",
              undoState.action === "suspend" ? "mark-read" : "favorite"
            )}
          >
            {undoState.action === "suspend" ? (
              <Archive className="w-full h-full" />
            ) : (
              <Calendar className="w-full h-full" />
            )}
          </div>
          <div className="undo-toast-message">
            <span>{undoState.itemTitle}</span>
            <span className="text-xs text-muted-foreground">
              {undoState.action === "suspend" ? ` ${t("mobileQueue.suspended")}` : ` ${t("mobileQueue.postponed")}`}
            </span>
          </div>
          <button onClick={handleUndo} className="undo-toast-action">
            {t("mobileQueue.undo")}
          </button>
          <div className="undo-toast-progress">
            <div
              className="undo-toast-progress-bar"
              style={{ width: `${undoState.progress}%` }}
            />
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}