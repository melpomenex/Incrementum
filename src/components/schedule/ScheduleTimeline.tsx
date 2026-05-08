import { useRef, useEffect, useMemo } from "react";
import { useI18n } from "../../lib/i18n";
import { parseScheduleDate } from "../../lib/scheduleUtils";
import type { ForecastPoint } from "../../api/analytics";
import { cn } from "../../utils";

const LEVEL_BG = [
  "bg-muted/30",
  "bg-green-200 dark:bg-green-900/40",
  "bg-green-300 dark:bg-green-700/50",
  "bg-amber-300 dark:bg-amber-800/50",
  "bg-red-300 dark:bg-red-800/50",
];

const LEVEL_RING = [
  "",
  "ring-green-400 dark:ring-green-600",
  "ring-green-400 dark:ring-green-500",
  "ring-amber-400 dark:ring-amber-600",
  "ring-red-400 dark:ring-red-600",
];

function getLevel(count: number): number {
  if (count === 0) return 0;
  if (count <= 10) return 1;
  if (count <= 25) return 2;
  if (count <= 50) return 3;
  return 4;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface ScheduleTimelineProps {
  /** Forecast data from get_due_workload_forecast */
  forecast: ForecastPoint[];
  /** ISO date string of selected day, or null for "all" */
  selectedDate: string | null;
  /** Called when a date cell is tapped/clicked */
  onSelectDate: (date: string | null) => void;
  className?: string;
}

export function ScheduleTimeline({
  forecast,
  selectedDate,
  onSelectDate,
  className,
}: ScheduleTimelineProps) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayStr = new Date().toISOString().split("T")[0];

  // Build a map for fast lookup
  const forecastMap = useMemo(() => {
    const m = new Map<string, ForecastPoint>();
    for (const p of forecast) m.set(p.date, p);
    return m;
  }, [forecast]);

  // Use first 14 days for display, scrollable
  const visibleDays = useMemo(() => forecast.slice(0, 14), [forecast]);

  // Scroll "today" into view on mount
  useEffect(() => {
    if (scrollRef.current) {
      const todayCell = scrollRef.current.querySelector("[data-today]");
      if (todayCell) {
        todayCell.scrollIntoView({ inline: "center", behavior: "instant" });
      }
    }
  }, []);

  return (
    <div className={cn("relative", className)}>
      <div
        ref={scrollRef}
        className="flex gap-1 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
      >
        {/* "All" button */}
        <button
          onClick={() => onSelectDate(null)}
          className={cn(
            "flex-shrink-0 flex flex-col items-center justify-center w-14 h-16 rounded-lg snap-start transition-all",
            selectedDate === null
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/50 text-foreground hover:bg-muted",
          )}
        >
          <span className="text-[10px] font-medium leading-none">
            {t("schedule.allUpcoming")}
          </span>
        </button>

        {visibleDays.map((day) => {
          const date = parseScheduleDate(day.date);
          const isToday = day.date === todayStr;
          const isSelected = selectedDate === day.date;
          const level = getLevel(day.due_total);
          const dayLabel = DAY_LABELS[date.getDay()];
          const dateNum = date.getDate();

          return (
            <button
              key={day.date}
              data-today={isToday ? "true" : undefined}
              onClick={() => onSelectDate(isSelected ? null : day.date)}
              className={cn(
                "flex-shrink-0 flex flex-col items-center justify-center w-14 h-16 rounded-lg snap-start transition-all",
                isSelected
                  ? `${LEVEL_BG[level]} ring-2 ${LEVEL_RING[level]} shadow-sm`
                  : isToday
                    ? "bg-primary/10 ring-1 ring-primary/50"
                    : LEVEL_BG[level],
                "hover:brightness-110",
              )}
            >
              <span className="text-[10px] font-medium text-muted-foreground leading-none">
                {isToday ? t("schedule.today") : dayLabel}
              </span>
              <span
                className={cn(
                  "text-lg font-semibold leading-tight mt-0.5",
                  isSelected ? "text-foreground" : "text-foreground/90",
                )}
              >
                {dateNum}
              </span>
              {day.due_total > 0 && (
                <span
                  className={cn(
                    "text-[10px] font-medium leading-none mt-0.5",
                    level >= 3 ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
                  )}
                >
                  {day.due_total}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
