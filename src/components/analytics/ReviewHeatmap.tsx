/**
 * Review Activity Heatmap
 * GitHub-style contribution graph showing review activity
 */

import { useMemo, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

interface DayData {
  date: Date;
  count: number;
  retentionRate: number;
  dateStr: string;
}

interface ReviewHeatmapProps {
  data: Record<string, number | { count: number; retentionRate?: number }>; // date string (YYYY-MM-DD) -> count/retention
  months?: number;
  className?: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Color levels for the heatmap
const LEVEL_COLORS = [
  "bg-muted", // 0 contributions
  "bg-green-200 dark:bg-green-900/40", // 1-2
  "bg-green-300 dark:bg-green-700/50", // 3-5
  "bg-green-400 dark:bg-green-600/60", // 6-9
  "bg-green-500 dark:bg-green-500/70", // 10+
];

export function ReviewHeatmap({ data, months = 12, className = "" }: ReviewHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);
  const [startOffset, setStartOffset] = useState(0);

  const { weeks, monthLabels, totalCount, maxCount, avgCount, avgRetention } = useMemo(() => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - months + startOffset);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    // Adjust to start on Sunday
    while (startDate.getDay() !== 0) {
      startDate.setDate(startDate.getDate() - 1);
    }

    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);

    // Generate weeks
    const weeksData: DayData[][] = [];
    const monthsData: { label: string; columnIndex: number }[] = [];
    let currentDate = new Date(startDate);
    let currentWeek: DayData[] = [];
    let weekIndex = 0;
    let lastMonth = -1;
    let total = 0;
    let max = 0;
    let daysWithActivity = 0;
    let retentionSum = 0;
    let daysWithRetention = 0;

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      const dateStr = currentDate.toISOString().split("T")[0];
      const raw = data[dateStr];
      const count = typeof raw === "number" ? raw : raw?.count || 0;
      const retentionRate = typeof raw === "number" ? 0 : raw?.retentionRate || 0;

      const dayData: DayData = {
        date: new Date(currentDate),
        count,
        retentionRate,
        dateStr,
      };

      currentWeek.push(dayData);

      // Track months
      const month = currentDate.getMonth();
      if (month !== lastMonth && currentDate.getDate() <= 7) {
        monthsData.push({
          label: MONTHS[month],
          columnIndex: weekIndex,
        });
        lastMonth = month;
      }

      total += count;
      if (count > max) max = count;
      if (count > 0) daysWithActivity++;
      if (count > 0 && retentionRate > 0) {
        retentionSum += retentionRate;
        daysWithRetention++;
      }

      if (dayOfWeek === 6) {
        weeksData.push(currentWeek);
        currentWeek = [];
        weekIndex++;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Push remaining days
    if (currentWeek.length > 0) {
      weeksData.push(currentWeek);
    }

    return {
      weeks: weeksData,
      monthLabels: monthsData,
      totalCount: total,
      maxCount: max,
      avgCount: daysWithActivity > 0 ? total / daysWithActivity : 0,
      avgRetention: daysWithRetention > 0 ? retentionSum / daysWithRetention : 0,
    };
  }, [data, months, startOffset]);

  const getLevel = (count: number): number => {
    if (count === 0) return 0;
    if (count <= 2) return 1;
    if (count <= 5) return 2;
    if (count <= 9) return 3;
    return 4;
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const canScrollLeft = startOffset > 0;
  const canScrollRight = startOffset < 0;

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Review Activity</h3>
          <p className="text-sm text-muted-foreground">
            {totalCount} reviews in the last {months} months
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStartOffset((prev) => prev + 1)}
            disabled={!canScrollLeft}
            className="p-1.5 hover:bg-muted rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <CaretLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => setStartOffset((prev) => prev - 1)}
            disabled={!canScrollRight}
            className="p-1.5 hover:bg-muted rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <CaretRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Heatmap */}
      <div className="relative overflow-hidden">
        {/* Month labels */}
        <div className="flex mb-1 ml-8">
          {monthLabels.map((month, i) => (
            <div
              key={`${month.label}-${i}`}
              className="text-xs text-muted-foreground"
              style={{
                position: "absolute",
                left: `${8 + month.columnIndex * 14}px`,
              }}
            >
              {month.label}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex gap-0.5">
          {/* Day labels */}
          <div className="flex flex-col gap-0.5 mr-1 pt-6">
            {DAYS.map((day, i) => (
              <div
                key={day}
                className="h-3 text-[10px] text-muted-foreground flex items-center"
                style={{ visibility: i % 2 === 1 ? "visible" : "hidden" }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Weeks */}
          <div className="flex gap-0.5 pt-6 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-0.5">
                {week.map((day, dayIndex) => (
                  <div
                    key={dayIndex}
                    className={`w-3 h-3 rounded-sm ${LEVEL_COLORS[getLevel(day.count)]} cursor-pointer transition-all hover:ring-1 hover:ring-primary/50`}
                    onMouseEnter={() => setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Tooltip */}
        {hoveredDay && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover border border-border rounded-md shadow-lg text-xs whitespace-nowrap z-10">
            <div className="font-medium text-foreground">
              {hoveredDay.count} review{hoveredDay.count !== 1 ? "s" : ""}
            </div>
            {hoveredDay.retentionRate > 0 && (
              <div className="text-muted-foreground">
                Retention: {hoveredDay.retentionRate.toFixed(1)}%
              </div>
            )}
            <div className="text-muted-foreground">{formatDate(hoveredDay.date)}</div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-4">
        <span className="text-xs text-muted-foreground">Less</span>
        {LEVEL_COLORS.map((color, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-sm ${color}`}
          />
        ))}
        <span className="text-xs text-muted-foreground">More</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="text-center p-3 bg-muted/30 rounded-lg">
          <div className="text-2xl font-bold text-foreground">{totalCount}</div>
          <div className="text-xs text-muted-foreground">Total Reviews</div>
        </div>
        <div className="text-center p-3 bg-muted/30 rounded-lg">
          <div className="text-2xl font-bold text-foreground">{maxCount}</div>
          <div className="text-xs text-muted-foreground">Best Day</div>
        </div>
        <div className="text-center p-3 bg-muted/30 rounded-lg">
          <div className="text-2xl font-bold text-foreground">{avgCount.toFixed(1)}</div>
          <div className="text-xs text-muted-foreground">Daily Average</div>
        </div>
      </div>
      <div className="mt-3 text-xs text-muted-foreground text-right">
        Avg retention on active days: {avgRetention.toFixed(1)}%
      </div>
    </div>
  );
}

/**
 * Compact heatmap variant for dashboards
 */
export function ReviewHeatmapCompact({
  data,
  weeks = 20,
  className = "",
}: {
  data: Record<string, number | { count: number; retentionRate?: number }>;
  weeks?: number;
  className?: string;
}) {
  const grid = useMemo(() => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - weeks * 7);

    const result: DayData[][] = [];
    let currentDate = new Date(startDate);

    for (let w = 0; w < weeks; w++) {
      const week: DayData[] = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = currentDate.toISOString().split("T")[0];
        const raw = data[dateStr];
        const count = typeof raw === "number" ? raw : raw?.count || 0;
        week.push({
          date: new Date(currentDate),
          count,
          retentionRate: typeof raw === "number" ? 0 : raw?.retentionRate || 0,
          dateStr,
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      result.push(week);
    }

    return result;
  }, [data, weeks]);

  const getLevel = (count: number): number => {
    if (count === 0) return 0;
    if (count <= 2) return 1;
    if (count <= 5) return 2;
    if (count <= 9) return 3;
    return 4;
  };

  return (
    <div className={`${className}`}>
      <div className="flex gap-0.5">
        {grid.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-0.5">
            {week.map((day, dayIndex) => (
              <div
                key={dayIndex}
                className={`w-2.5 h-2.5 rounded-sm ${LEVEL_COLORS[getLevel(day.count)]}`}
                title={`${day.count} reviews on ${day.date.toLocaleDateString()}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ReviewHeatmap;
