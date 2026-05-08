import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useI18n } from "../../lib/i18n";
import { parseScheduleDate } from "../../lib/scheduleUtils";
import type { ScheduleDayItem } from "../../types/queue";
import { ScheduleItemRow } from "./ScheduleItemRow";
import { ScheduleTable } from "./ScheduleTable";
import { cn } from "../../utils";
import { LayoutGrid, Table2 } from "lucide-react";

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
  viewMode?: "cards" | "table";
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

/** Flattened list item: either a date header or a schedule item */
type FlatItem =
  | { kind: "header"; date: string; count: number }
  | { kind: "item"; item: ScheduleDayItem };

/** Virtualized card list with date headers interleaved */
function VirtualizedCardList({
  flatItems,
  onPostpone,
  onOpen,
  onSuspend,
  onUnsuspend,
  onDelete,
  onDismiss,
  isMobile,
}: {
  flatItems: FlatItem[];
  onPostpone: (itemId: string, days: number, itemType?: string) => Promise<void>;
  onOpen?: (item: ScheduleDayItem) => void;
  onSuspend?: (itemId: string, itemType: string) => Promise<void>;
  onUnsuspend?: (itemId: string, itemType: string) => Promise<void>;
  onDelete?: (itemId: string, itemType: string) => Promise<void>;
  onDismiss?: (itemId: string) => Promise<void>;
  isMobile?: boolean;
}) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const itemHeightsRef = useRef<Map<number, number>>(new Map());
  const [_, forceUpdate] = useState({});

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateHeight = () => setContainerHeight(container.clientHeight);
    updateHeight();
    let rafId: number | null = null;
    const ro = new ResizeObserver(() => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateHeight);
    });
    ro.observe(container);
    return () => { ro.disconnect(); if (rafId) cancelAnimationFrame(rafId); };
  }, []);

  const defaultH = 80;
  const overscan = 5;
  const getItemHeight = (i: number) => itemHeightsRef.current.get(i) ?? (flatItems[i]?.kind === "header" ? 36 : defaultH);
  const getItemOffset = (i: number) => { let o = 0; for (let j = 0; j < i; j++) o += getItemHeight(j); return o; };
  const totalHeight = getItemOffset(flatItems.length);

  const findStart = () => {
    let off = 0;
    for (let i = 0; i < flatItems.length; i++) {
      off += getItemHeight(i);
      if (off > scrollTop) return Math.max(0, i - overscan);
    }
    return 0;
  };
  const findEnd = (start: number) => {
    let off = getItemOffset(start);
    for (let i = start; i < flatItems.length; i++) {
      off += getItemHeight(i);
      if (off > scrollTop + containerHeight + overscan * defaultH) return Math.min(flatItems.length, i + overscan);
    }
    return flatItems.length;
  };

  const startIdx = findStart();
  const endIdx = findEnd(startIdx);
  const visible = flatItems.slice(startIdx, endIdx);

  const measureRef = useCallback((index: number) => (el: HTMLElement | null) => {
    if (el) {
      const h = el.getBoundingClientRect().height;
      if (itemHeightsRef.current.get(index) !== h) {
        itemHeightsRef.current.set(index, h);
        forceUpdate({});
      }
    }
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => setScrollTop(e.currentTarget.scrollTop), []);

  return (
    <div ref={containerRef} className="flex-1 overflow-auto" onScroll={handleScroll} style={{ willChange: "transform" }}>
      <div style={{ height: totalHeight, position: "relative" }}>
        {visible.map((entry, vi) => {
          const ai = startIdx + vi;
          const top = getItemOffset(ai);
          const isHeader = entry.kind === "header";

          return (
            <div key={ai} ref={measureRef(ai)} style={{ position: "absolute", top, left: 0, right: 0 }}>
              {isHeader ? (
                <div className="px-4 py-2 bg-background/95 backdrop-blur-sm border-b border-border">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {formatSectionLabel(entry.date, t)}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {t("schedule.itemsDue", { count: entry.count })}
                  </span>
                </div>
              ) : (
                <ScheduleItemRow
                  item={entry.item}
                  onPostpone={onPostpone}
                  onOpen={onOpen}
                  onSuspend={onSuspend}
                  onUnsuspend={onUnsuspend}
                  onDelete={onDelete}
                  onDismiss={onDismiss}
                  isMobile={isMobile}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
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
  viewMode = "table",
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

    const sortedKeys = Array.from(groups.keys()).sort();
    return sortedKeys.map((date) => ({
      date,
      items: groups.get(date)!.sort((a, b) => b.priority - a.priority),
    }));
  }, [items]);

  // Filter by selected date
  const visibleGroups = useMemo(() => {
    if (!selectedDate) return grouped;
    const sel = selectedDate.slice(0, 10);
    return grouped.filter((g) => g.date.slice(0, 10) === sel);
  }, [grouped, selectedDate]);

  // Flatten groups for virtualized card list
  const flatItems = useMemo<FlatItem[]>(() => {
    const flat: FlatItem[] = [];
    for (const group of visibleGroups) {
      flat.push({ kind: "header", date: group.date, count: group.items.length });
      for (const item of group.items) {
        flat.push({ kind: "item", item });
      }
    }
    return flat;
  }, [visibleGroups]);

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
    <div className="flex-1 flex flex-col overflow-hidden">
      {viewMode === "table" ? (
        <ScheduleTable
          groups={visibleGroups}
          onPostpone={onPostpone}
          onOpen={onOpen}
          onSuspend={onSuspend}
          onUnsuspend={onUnsuspend}
          onDelete={onDelete}
          onDismiss={onDismiss}
        />
      ) : (
        <VirtualizedCardList
          flatItems={flatItems}
          onPostpone={onPostpone}
          onOpen={onOpen}
          onSuspend={onSuspend}
          onUnsuspend={onUnsuspend}
          onDelete={onDelete}
          onDismiss={onDismiss}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}
