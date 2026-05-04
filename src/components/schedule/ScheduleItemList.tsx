import { useMemo } from "react";
import { useI18n } from "../../lib/i18n";
import { parseScheduleDate } from "../../lib/scheduleUtils";
import type { ScheduleDayItem } from "../../types/queue";
import { ScheduleItemRow } from "./ScheduleItemRow";
import { cn } from "../../utils";

interface ScheduleItemListProps {
  items: ScheduleDayItem[];
  selectedDate: string | null;
  onPostpone: (itemId: string, days: number, itemType?: string) => Promise<void>;
  onOpen?: (item: ScheduleDayItem) => void;
  onSuspend?: (itemId: string, itemType: string) => Promise<void>;
  onUnsuspend?: (itemId: string, itemType: string) => Promise<void>;
  onDelete?: (itemId: string, itemType: string) => Promise<void>;
  onDismiss?: (itemId: string) => Promise<void>;
  isLoading: boolean;
  isMobile?: boolean;
}

function formatSectionLabel(dateStr: string, t: (key: string, vars?: Record<string, string | number>) => string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = parseScheduleDate(dateStr);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);

  if (diff === 0) return t("schedule.today");
  if (diff === 1) return t("schedule.tomorrow");

  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.getDate();
  return `${month} ${day}`;
}

export function ScheduleItemList({
  items,
  selectedDate,
  onPostpone,
  onOpen,
  onSuspend,
  onUnsuspend,
  onDelete,
  onDismiss,
  isLoading,
  isMobile = false,
}: ScheduleItemListProps) {
  const { t } = useI18n();

  // Group items by date
  const grouped = useMemo(() => {
    const groups = new Map<string, ScheduleDayItem[]>();
    for (const item of items) {
      if (!item.dueDate) continue;
      const existing = groups.get(item.dueDate) ?? [];
      existing.push(item);
      groups.set(item.dueDate, existing);
    }

    // Sort dates chronologically
    const sortedKeys = Array.from(groups.keys()).sort();
    return sortedKeys.map((date) => ({
      date,
      items: groups.get(date)!.sort((a, b) => b.priority - a.priority),
    }));
  }, [items]);

  // Filter by selected date if set
  const visibleGroups = useMemo(() => {
    if (!selectedDate) return grouped;
    return grouped.filter((g) => g.date === selectedDate);
  }, [grouped, selectedDate]);

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="animate-pulse space-y-4 p-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="w-9 h-9 bg-muted rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <span className="text-2xl">📅</span>
        </div>
        <p className="text-muted-foreground">
          {t("schedule.noItemsScheduled")}
        </p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          {t("schedule.noItemsScheduledDesc")}
        </p>
      </div>
    );
  }

  if (visibleGroups.length === 0 && selectedDate) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <p>{t("schedule.selectDay")}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {visibleGroups.map((group) => (
        <div key={group.date}>
          {/* Sticky section header */}
          <div className="sticky top-0 z-10 px-4 py-2 bg-background/95 backdrop-blur-sm border-b border-border">
            <span className="text-xs font-semibold text-muted-foreground">
              {formatSectionLabel(group.date, t)}
            </span>
            <span className="text-xs text-muted-foreground ml-2">
              {t("schedule.itemsDue", { count: group.items.length })}
            </span>
          </div>

          {/* Items */}
          <div className="divide-y divide-border">
            {group.items.map((item) => (
              <ScheduleItemRow
                key={item.id}
                item={item}
                onPostpone={onPostpone}
                onOpen={onOpen}
                onSuspend={onSuspend}
                onUnsuspend={onUnsuspend}
                onDelete={onDelete}
                onDismiss={onDismiss}
                isMobile={isMobile}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
