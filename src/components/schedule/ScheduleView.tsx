import { useState, useEffect, useCallback, useMemo } from "react";
import { Zap } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { parseScheduleDate } from "../../lib/scheduleUtils";
import type { ScheduleDayItem, ForecastPoint } from "../../types/queue";
import { getWorkloadForecast } from "../../api/analytics";
import { getQueue, postponeItem, bulkSuspendItems, bulkUnsuspendItems, bulkDeleteItems } from "../../api/queue";
import { ScheduleTimeline } from "./ScheduleTimeline";
import { ScheduleSummary } from "./ScheduleSummary";
import { ScheduleItemList } from "./ScheduleItemList";
import { SpreadModal } from "./SpreadModal";
import { useToast } from "../common/Toast";
import { cn } from "../../utils";

interface ScheduleViewProps {
  isMobile?: boolean;
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

export function ScheduleView({ isMobile = false }: ScheduleViewProps) {
  const { t } = useI18n();
  const toast = useToast();

  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleDayItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Spread modal state
  const [showSpread, setShowSpread] = useState(false);
  const [spreadSourceDate, setSpreadSourceDate] = useState<string>("");

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [forecastData, queueItems] = await Promise.all([
        getWorkloadForecast(90),
        getQueue(),
      ]);

      setForecast(forecastData.points);

      // Filter queue items to those with due dates (scheduled items)
      const scheduled = queueItems
        .map(queueItemToScheduleDay)
        .filter((i): i is ScheduleDayItem => i !== null);

      // Sort by due date, then priority
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

  // Handle postpone
  const handlePostpone = useCallback(
    async (itemId: string, days: number, itemType?: string) => {
      try {
        await postponeItem(itemId, days, itemType);
        toast.success(
          t("schedule.postponed", { count: days }),
        );
        await loadData();
      } catch {
        toast.error(t("schedule.postponeFailed"));
      }
    },
    [loadData, toast, t],
  );

  const handleOpen = useCallback(async (item: ScheduleDayItem) => {
    // Navigate to document or start review
    // For now just log — the parent component handles navigation
    console.log("[schedule] Open item:", item.id, item.itemType);
  }, []);

  const handleSuspend = useCallback(async (itemId: string, itemType: string) => {
    try {
      if (itemType === "learning-item") {
        await bulkSuspendItems([itemId]);
        toast.success(t("schedule.itemSuspended"));
      }
      await loadData();
    } catch {
      toast.error(t("schedule.actionFailed"));
    }
  }, [loadData, toast, t]);

  const handleUnsuspend = useCallback(async (itemId: string, itemType: string) => {
    try {
      if (itemType === "learning-item") {
        await bulkUnsuspendItems([itemId]);
        toast.success(t("schedule.itemUnsuspended"));
      }
      await loadData();
    } catch {
      toast.error(t("schedule.actionFailed"));
    }
  }, [loadData, toast, t]);

  const handleDelete = useCallback(async (itemId: string, itemType: string) => {
    try {
      await bulkDeleteItems([itemId]);
      toast.success(t("schedule.itemDeleted"));
      await loadData();
    } catch {
      toast.error(t("schedule.actionFailed"));
    }
  }, [loadData, toast, t]);

  const handleDismiss = useCallback(async (itemId: string) => {
    // Dismiss is archive/dismiss for documents — uses delete for now
    try {
      await bulkDeleteItems([itemId]);
      toast.success(t("schedule.itemDismissed"));
      await loadData();
    } catch {
      toast.error(t("schedule.actionFailed"));
    }
  }, [loadData, toast, t]);

  // Handle spread from toolbar
  const handleSpreadToolbar = useCallback(() => {
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

  // Handle spread from timeline date
  const handleSpreadDate = useCallback(
    (date: string) => {
      setSpreadSourceDate(date);
      setShowSpread(true);
    },
    [],
  );

  // Handle spread confirm
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
      {/* Header with toolbar */}
      <div className="px-4 py-3 border-b border-border bg-card space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-foreground">
            {t("schedule.title")}
          </h1>
          <button
            onClick={handleSpreadToolbar}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            {t("schedule.spreadOverloaded")}
          </button>
        </div>

        {/* Timeline */}
        <ScheduleTimeline
          forecast={forecast}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />

        {/* Summary stats */}
        <ScheduleSummary
          forecast={forecast}
          dueTodayCount={dueTodayCount}
          overdueCount={overdueCount}
        />
      </div>

      {/* Contextual spread button when a day is selected */}
      {selectedDate && (() => {
        const dayItems = getItemsForDate(selectedDate);
        if (dayItems.length < 5) return null;
        return (
          <div className="px-4 py-2 bg-primary/5 border-b border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {t("schedule.itemsDue", { count: dayItems.length })}
            </span>
            <button
              onClick={() => handleSpreadDate(selectedDate)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Zap className="w-3 h-3" />
              {t("schedule.spread")}
            </button>
          </div>
        );
      })()}

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
