import { useState, useMemo, useEffect, useRef } from "react";
import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  X,
} from "@phosphor-icons/react";
import { useI18n } from "../../lib/i18n";
import { getWorkloadData, type WorkloadDay } from "../../api/analytics";
import { WorkloadDayPopover } from "./WorkloadDayPopover";

const LEVEL_COLORS = [
  "bg-transparent",
  "bg-green-200 dark:bg-green-900/40",
  "bg-green-300 dark:bg-green-700/50",
  "bg-amber-300 dark:bg-amber-800/50",
  "bg-red-300 dark:bg-red-800/50",
];

const _LEVEL_COLORS_BORDER = [
  "",
  "border-green-300 dark:border-green-600/40",
  "border-green-400 dark:border-green-500/50",
  "border-amber-400 dark:border-amber-600/50",
  "border-red-400 dark:border-red-600/50",
];

function getLevel(count: number): number {
  if (count === 0) return 0;
  if (count <= 10) return 1;
  if (count <= 25) return 2;
  if (count <= 50) return 3;
  return 4;
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatMonth(year: number, month: number, t: (key: string) => string): string {
  const months = [
    t("calendar.january"), t("calendar.february"), t("calendar.march"),
    t("calendar.april"), t("calendar.may"), t("calendar.june"),
    t("calendar.july"), t("calendar.august"), t("calendar.september"),
    t("calendar.october"), t("calendar.november"), t("calendar.december"),
  ];
  return `${months[month]} ${year}`;
}

function buildMonthCells(year: number, month: number) {
  const firstDay = getFirstDayOfMonth(year, month);
  const daysInMonth = getDaysInMonth(year, month);
  const cells: Array<{ date: string; day: number; isCurrentMonth: boolean }> = [];

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevDays = getDaysInMonth(prevYear, prevMonth);
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ date: toDateStr(prevYear, prevMonth, prevDays - i), day: prevDays - i, isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: toDateStr(year, month, d), day: d, isCurrentMonth: true });
  }
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  let nd = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ date: toDateStr(nextYear, nextMonth, nd), day: nd, isCurrentMonth: false });
    nd++;
  }
  return cells;
}

const DAY_LABELS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** Mini sparkline from workload data */
function Sparkline({ data, height = 28 }: { data: WorkloadDay[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.reviewed_count, d.due_count)));
  const w = data.length;
  const points = data.map((d, i) => {
    const x = (i / (w - 1)) * 100;
    const y = height - ((d.due_count / max) * (height - 4)) - 2;
    return `${x},${y}`;
  });
  const pointsActual = data.map((d, i) => {
    const x = (i / (w - 1)) * 100;
    const y = height - ((d.reviewed_count / max) * (height - 4)) - 2;
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 100 ${height}`} className="w-full h-7 text-muted-foreground" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        points={points.join(" ")}
        opacity={0.3}
      />
      <polyline
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        points={pointsActual.join(" ")}
      />
    </svg>
  );
}

/** Full month grid shown inside the popover */
function MonthGrid({
  year,
  month,
  dataMap,
  todayStr,
  onSelectDay,
}: {
  year: number;
  month: number;
  dataMap: Map<string, WorkloadDay>;
  todayStr: string;
  onSelectDay: (date: string) => void;
}) {
  const { t } = useI18n();
  const cells = buildMonthCells(year, month);

  return (
    <div>
      <div className="grid grid-cols-7 gap-px mb-1">
        {DAY_LABELS_SHORT.map((l) => (
          <div key={l} className="text-center text-[10px] font-medium text-muted-foreground py-0.5">
            {t(`calendar.${l.toLowerCase()}`)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {cells.map(({ date, day, isCurrentMonth }) => {
          const d = dataMap.get(date);
          const isToday = date === todayStr;
          const isPast = date < todayStr;
          const count = isPast ? (d?.reviewed_count ?? 0) : (d?.due_count ?? 0);
          const level = getLevel(count);

          return (
            <button
              key={date}
              onClick={() => onSelectDay(date)}
              className={`
                relative flex flex-col items-center justify-center py-1 rounded
                text-xs transition-colors cursor-pointer hover:brightness-125
                ${!isCurrentMonth ? "opacity-30" : ""}
                ${LEVEL_COLORS[level]}
              `}
            >
              <span className={`leading-none ${isToday ? "underline font-bold text-primary" : ""}`}>
                {day}
              </span>
              {count > 0 && (
                <span className="text-[9px] leading-none font-medium mt-0.5">{count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WorkloadCalendar() {
  const { t } = useI18n();
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const [centerYear, setCenterYear] = useState(today.getFullYear());
  const [centerMonth, setCenterMonth] = useState(today.getMonth());
  const [workloadData, setWorkloadData] = useState<WorkloadDay[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState<{ year: number; month: number } | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 3-month range centered on centerMonth
  const { startDate, endDate, months } = useMemo(() => {
    const prev = centerMonth === 0 ? { year: centerYear - 1, month: 11 } : { year: centerYear, month: centerMonth - 1 };
    const curr = { year: centerYear, month: centerMonth };
    const next = centerMonth === 11 ? { year: centerYear + 1, month: 0 } : { year: centerYear, month: centerMonth + 1 };
    const start = toDateStr(prev.year, prev.month, 1);
    const endDays = getDaysInMonth(next.year, next.month);
    const end = toDateStr(next.year, next.month, endDays);
    return { startDate: start, endDate: end, months: [prev, curr, next] };
  }, [centerYear, centerMonth]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getWorkloadData(startDate, endDate).then((data) => {
      if (!cancelled) { setWorkloadData(data); setIsLoading(false); }
    }).catch(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  const dataMap = useMemo(() => {
    const map = new Map<string, WorkloadDay>();
    for (const d of workloadData) map.set(d.date, d);
    return map;
  }, [workloadData]);

  // Current month summary for compact header
  const summary = useMemo(() => {
    const daysInMonth = getDaysInMonth(centerYear, centerMonth);
    let totalReviews = 0;
    let totalDue = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const data = dataMap.get(toDateStr(centerYear, centerMonth, d));
      if (data) { totalReviews += data.reviewed_count; totalDue += data.due_count; }
    }
    return { totalReviews, totalDue };
  }, [centerYear, centerMonth, dataMap]);

  const currentMonthData = useMemo(() => {
    const daysInMonth = getDaysInMonth(centerYear, centerMonth);
    const result: WorkloadDay[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = toDateStr(centerYear, centerMonth, d);
      const data = dataMap.get(dateStr);
      result.push(data ?? { date: dateStr, due_count: 0, reviewed_count: 0, new_count: 0 });
    }
    return result;
  }, [centerYear, centerMonth, dataMap]);

  const navigatePrev = () => {
    if (centerMonth === 0) { setCenterMonth(11); setCenterYear((y) => y - 1); }
    else setCenterMonth((m) => m - 1);
  };

  const navigateNext = () => {
    if (centerMonth === 11) { setCenterMonth(0); setCenterYear((y) => y + 1); }
    else setCenterMonth((m) => m + 1);
  };

  const handleDaySelect = (date: string) => {
    setSelectedDay(date);
  };

  // Close expanded month when clicking outside
  useEffect(() => {
    if (!expandedMonth) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && e.target instanceof Node && !containerRef.current.contains(e.target)) {
        setExpandedMonth(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expandedMonth]);

  return (
    <div ref={containerRef} className="p-4 bg-card border border-border rounded-lg space-y-3">
      {/* Compact header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarBlank className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">{t("calendar.workloadCalendar")}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={navigatePrev} className="p-1 rounded hover:bg-muted transition-colors">
            <CaretLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setExpandedMonth({ year: centerYear, month: centerMonth })}
            className="px-2 py-0.5 text-xs font-medium rounded hover:bg-muted transition-colors min-w-[120px] text-center"
          >
            {formatMonth(centerYear, centerMonth, t)}
          </button>
          <button onClick={navigateNext} className="p-1 rounded hover:bg-muted transition-colors">
            <CaretRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Compact summary: stats + sparkline */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3 text-xs shrink-0">
          <div>
            <span className="text-muted-foreground">{t("calendar.totalReviewed")}</span>
            <span className="ml-1 font-semibold">{summary.totalReviews}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t("calendar.totalDue")}</span>
            <span className="ml-1 font-semibold">{summary.totalDue}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="h-7 bg-muted rounded animate-pulse" />
          ) : (
            <Sparkline data={currentMonthData} />
          )}
        </div>
      </div>

      {/* 3-month heatmap strip */}
      {isLoading ? (
        <div className="h-16 bg-muted rounded animate-pulse" />
      ) : (
        <div className="space-y-2">
          {months.map(({ year, month }) => {
            const cells = buildMonthCells(year, month);
            const weeks: Array<typeof cells> = [];
            for (let i = 0; i < cells.length; i += 7) {
              weeks.push(cells.slice(i, i + 7));
            }

            return (
              <div key={`${year}-${month}`} className="flex items-start gap-1.5">
                <span
                  className="text-[10px] font-medium text-muted-foreground w-10 pt-0.5 cursor-pointer hover:text-foreground transition-colors text-right shrink-0"
                  onClick={() => setExpandedMonth({ year, month })}
                >
                  {formatMonth(year, month, t).split(" ")[0].slice(0, 3)} {String(year).slice(2)}
                </span>
                <div className="flex gap-px flex-1 min-w-0 overflow-hidden">
                  {weeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-px">
                      {week.map(({ date, isCurrentMonth }) => {
                        const d = dataMap.get(date);
                        const isToday = date === todayStr;
                        const isPast = date < todayStr;
                        const count = isPast ? (d?.reviewed_count ?? 0) : (d?.due_count ?? 0);
                        const level = getLevel(count);
                        const isExpanding = expandedMonth?.year === year && expandedMonth?.month === month;

                        return (
                          <button
                            key={date}
                            onClick={() => {
                              if (isExpanding) handleDaySelect(date);
                              else setExpandedMonth({ year, month });
                            }}
                            title={`${date}: ${count}`}
                            className={`
                              w-2.5 h-2.5 rounded-sm transition-all cursor-pointer
                              ${LEVEL_COLORS[level]}
                              ${!isCurrentMonth ? "opacity-25" : ""}
                              ${isToday ? "ring-1 ring-primary ring-offset-0" : ""}
                              hover:scale-150 hover:z-10
                            `}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Legend */}
          <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
            <span>{t("calendar.legendLess")}</span>
            {[0, 1, 2, 3, 4].map((l) => (
              <div key={l} className={`w-2.5 h-2.5 rounded-sm ${LEVEL_COLORS[l]}`} />
            ))}
            <span>{t("calendar.legendMore")}</span>
          </div>
        </div>
      )}

      {/* Expanded month grid popover */}
      {expandedMonth && (
        <div className="relative mt-2 p-3 border rounded-lg bg-popover shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">{formatMonth(expandedMonth.year, expandedMonth.month, t)}</span>
            <button
              onClick={() => setExpandedMonth(null)}
              className="p-0.5 rounded hover:bg-muted transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <MonthGrid
            year={expandedMonth.year}
            month={expandedMonth.month}
            dataMap={dataMap}
            todayStr={todayStr}
            onSelectDay={handleDaySelect}
          />
        </div>
      )}

      {/* Day detail popover */}
      {selectedDay && (
        <WorkloadDayPopover date={selectedDay} onClose={() => setSelectedDay(null)} />
      )}
    </div>
  );
}
