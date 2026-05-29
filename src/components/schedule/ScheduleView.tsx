import { useState, useEffect, useCallback, useMemo } from "react";
import { useI18n } from "../../lib/i18n";
import { parseScheduleDate } from "../../lib/scheduleUtils";
import type { ScheduleDayItem, ForecastPoint } from "../../types/queue";
import { getWorkloadForecast } from "../../api/analytics";
import { getQueue, postponeItem, bulkSuspendItems, bulkUnsuspendItems, bulkDeleteItems } from "../../api/queue";
import { ScheduleDashboard } from "./ScheduleDashboard";
import { ScheduleToolbar } from "./ScheduleToolbar";
import { ScheduleItemList } from "./ScheduleItemList";
import { SpreadModal } from "./SpreadModal";
import { useToast } from "../common/Toast";
import { cn } from "../../utils";

interface ScheduleViewProps {
  isMobile?: boolean;
  onStartReview?: (itemId?: string) => void;
  onOpenDocument?: (documentId: string, title: string) => void;
}

function queueItemToScheduleDay(item: {
  id: string;
  documentId: string;
  documentTitle: string;
  documentFileType?: string;
  itemType: string;
  dueDate?: string;
  estimatedTime: number;
 stability?: number;
  difficulty?: number;
  interval?: number;
  retrievability?: number;
  priority: number;
  tags: string[];
  category?: string;
  progress: number;
  lapses?: number;
  reps?: number;
}): ScheduleDayItem | null {
  if (!item.dueDate) return null;
  return {
    id: item.id,
    documentId: item.documentId,
    documentTitle: item.documentTitle,
    documentFileType: item.documentFileType as ScheduleDayItem["documentFileType"],
    itemType: item.itemType as ScheduleDayItem["itemType"],
    dueDate: item.dueDate,
    estimatedTime: item.estimatedTime,
    stability: item.stability,
    difficulty: item.difficulty,
    interval: item.interval,
    retrievability: item.retrievability,
    priority: item.priority,
    tags: item.tags ?? [],
    category: item.category,
    progress: item.progress,
    lapses: item.lapses,
    reps: item.reps,
  };
}

export function ScheduleView({ isMobile = false, onStartReview, onOpenDocument }: ScheduleViewProps) {
  const { t } = useI18n();
  const toast = useToast();

  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleDayItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"cards" | "table">(() => {
    const saved = localStorage.getItem("incrementum_schedule_view_mode");
    return (saved as "cards" | "table") || (isMobile ? "cards" : "table");
  });
  const [isDashboardCollapsed, setIsDashboardCollapsed] = useState(() => {
    return localStorage.getItem("incrementum_schedule_dashboard_collapsed") === "true";
  });

  // Spread modal state
  const [showSpread, setShowSpread] = useState(false);
  const [spreadSourceDate, setSpreadSourceDate] = useState<string>("");

  useEffect(() => {
    localStorage.setItem("incrementum_schedule_view_mode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem("incrementum_schedule_dashboard_collapsed", String(isDashboardCollapsed));
  }, [isDashboardCollapsed]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [forecastData, queueItems] = await Promise.all([
        getWorkloadForecast(90),
        getQueue(),
      ]);

      setForecast(forecastData.points);

      const scheduled = queueItems
        .map(queueItemToScheduleDay)
        .filter((i): i is ScheduleDayItem => i !== null);

      scheduled.sort((a, b) => {
        const dateDiff = a.dueDate.localeCompare(b.dueDate);
        if (dateDiff !== 0) return dateDiff;
        return b.priority - a.priority;
      });

      setScheduleItems(scheduled);
    } catch (err) {
      console.error("Failed to load schedule data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Lightweight reload — queue items only (no forecast)
  const reloadItems = useCallback(async () => {
    try {
      const queueItems = await getQueue();
      const scheduled = queueItems
        .map(queueItemToScheduleDay)
        .filter((i): i is ScheduleDayItem => i !== null);

      scheduled.sort((a, b) => {
        const dateDiff = a.dueDate.localeCompare(b.dueDate);
        if (dateDiff !== 0) return dateDiff;
        return b.priority - a.priority;
      });

      setScheduleItems(scheduled);
    } catch (err) {
      console.error("Failed to reload items:", err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute stats for summary
  const todayStr = new Date().toISOString().split("T")[0];
  const now = new Date();

  const dueTodayCount = useMemo(
    () =>
      scheduleItems.filter((i) => {
        if (!i.dueDate) return false;
        return (
          i.dueDate <= todayStr
        );
      }).length,
    [scheduleItems, todayStr],
  );

  const overdueCount = useMemo(
    () =>
      scheduleItems.filter((i) => {
        if (!i.dueDate) return false;
        return i.dueDate < todayStr;
      }).length,
    [scheduleItems, todayStr],
  );

  // Get items for a specific date (for spread)
  const getItemsForDate = useCallback(
    (date: string) => {
      const d = date.slice(0, 10);
      return scheduleItems.filter((i) => i.dueDate.slice(0, 10) === d);
    },
    [scheduleItems],
  );

  const handlePostpone = useCallback(
    async (itemId: string, days: number, itemType?: string) => {
      try {
        await postponeItem(itemId, days, itemType);
        toast.success(
          t("schedule.postponed", { count: days }),
        );
        await reloadItems();
      } catch {
        toast.error(t("schedule.postponeFailed"));
      }
    },
    [reloadItems, toast, t],
  );

  const handleOpen = useCallback(async (item: ScheduleDayItem) => {
    if (item.itemType === "learning-item") {
      onStartReview?.(item.id);
    } else {
      onOpenDocument?.(item.documentId, item.documentTitle);
    }
  }, [onStartReview, onOpenDocument]);

  const handleSuspend = useCallback(async (itemId: string, itemType: string) => {
    try {
      if (itemType === "learning-item") {
        await bulkSuspendItems([itemId]);
        toast.success(t("schedule.itemSuspended"));
      }
      await reloadItems();
    } catch {
      toast.error(t("schedule.actionFailed"));
    }
  }, [reloadItems, toast, t]);

  const handleUnsuspend = useCallback(async (itemId: string, itemType: string) => {
    try {
      if (itemType === "learning-item") {
        await bulkUnsuspendItems([itemId]);
        toast.success(t("schedule.itemUnsuspended"));
      }
      await reloadItems();
    } catch {
      toast.error(t("schedule.actionFailed"));
    }
  }, [reloadItems, toast, t]);

  const handleDelete = useCallback(async (itemId: string, itemType: string) => {
    try {
      await bulkDeleteItems([itemId]);
      toast.success(t("schedule.itemDeleted"));
      await reloadItems();
    } catch {
      toast.error(t("schedule.actionFailed"));
    }
  }, [reloadItems, toast, t]);

  const handleDismiss = useCallback(async (itemId: string) => {
    try {
      await bulkDeleteItems([itemId]);
      toast.success(t("schedule.itemDismissed"));
      await reloadItems();
    } catch {
      toast.error(t("schedule.actionFailed"));
    }
  }, [reloadItems, toast, t]);

  const handleSpreadToolbar = useCallback(() => {
    if (selectedDate) {
      setSpreadSourceDate(selectedDate);
      setShowSpread(true);
      return;
    }
    // Find the most overloaded day in next 14 days
    const next14 = forecast.slice(0, 14);
    let peak = next14[0];
    for (const d of next14) {
      if (d.due_total > (peak?.due_total ?? 0)) peak = d;
    }
    if (peak && peak.due_total > 0) {
      setSpreadSourceDate(peak.date);
      setShowSpread(true);
    }
  }, [forecast]);

  const handleSpreadDate = useCallback(
    (date: string) => {
      setSpreadSourceDate(date);
      setShowSpread(true);
    },
    [],
  );

  const handleSpreadConfirm = useCallback(
    async (itemIds: string[], horizonDays: number) => {
      const items = getItemsForDate(spreadSourceDate);
      const eligibleItems = items.filter((i) => itemIds.includes(i.id));

      // Spread items evenly across the horizon
      const perDay = Math.ceil(eligibleItems.length / horizonDays);
      const source = parseScheduleDate(spreadSourceDate);

      const batchSize = 20;
      for (let i = 0; i < eligibleItems.length; i += batchSize) {
        const batch = eligibleItems.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (item) => {
            const targetDay = Math.floor(i / perDay);
            const targetDate = new Date(
              source.getTime() + targetDay * 86400000,
            );
            const daysToAdd = Math.max(
              1,
              Math.ceil(
                (targetDate.getTime() - source.getTime()) / 86400000,
              ),
            );
            // Add some randomness to spread evenly
            const jitter = Math.floor(Math.random() * Math.min(perDay, 7));
            const totalDays = Math.min(daysToAdd + jitter, horizonDays);
            await postponeItem(item.id, totalDays, item.itemType);
          }),
        );
      }

      await loadData();
    },
    [spreadSourceDate, getItemsForDate, loadData],
  );

  return (
    <div className={cn("flex flex-col h-full bg-background", isMobile && "pb-safe")}>
      <ScheduleToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSpread={handleSpreadToolbar}
        isDashboardCollapsed={isDashboardCollapsed}
        onToggleDashboard={() => setIsDashboardCollapsed(!isDashboardCollapsed)}
        selectedDate={selectedDate}
        onClearDate={() => setSelectedDate(null)}
        isMobile={isMobile}
      />

      <ScheduleDashboard
        forecast={forecast}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        dueTodayCount={dueTodayCount}
        overdueCount={overdueCount}
        isCollapsed={isDashboardCollapsed}
        onToggleCollapse={() => setIsDashboardCollapsed(!isDashboardCollapsed)}
        isMobile={isMobile}
      />

      {/* Item list */}
      <ScheduleItemList
        items={scheduleItems}
        selectedDate={selectedDate}
        onPostpone={handlePostpone}
        onOpen={handleOpen}
        onSuspend={handleSuspend}
        onUnsuspend={handleUnsuspend}
        onDelete={handleDelete}
        onDismiss={handleDismiss}
        isLoading={isLoading}
        isMobile={isMobile}
        viewMode={viewMode}
      />

      {/* Spread modal */}
      <SpreadModal
        isOpen={showSpread}
        onClose={() => setShowSpread(false)}
        items={getItemsForDate(spreadSourceDate)}
        sourceDate={spreadSourceDate}
        forecast={forecast}
        onConfirm={handleSpreadConfirm}
        onToast={(msg, desc) => {
          if (desc) {
            toast.success(msg, desc);
          } else {
            toast.success(msg);
          }
        }}
        isMobile={isMobile}
      />
    </div>
  );
}
