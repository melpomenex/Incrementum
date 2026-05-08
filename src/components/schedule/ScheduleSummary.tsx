import { useMemo } from "react";
import { useI18n } from "../../lib/i18n";
import { parseScheduleDate } from "../../lib/scheduleUtils";
import type { ForecastPoint } from "../../api/analytics";
import { cn } from "../../utils";

interface ScheduleSummaryProps {
  forecast: ForecastPoint[];
  dueTodayCount: number;
  overdueCount: number;
  isCompact?: boolean;
}

export function ScheduleSummary({
  forecast,
  dueTodayCount,
  overdueCount,
  isCompact = false,
}: ScheduleSummaryProps) {
  const { t } = useI18n();

  const stats = useMemo(() => {
    const totalScheduled = forecast.reduce((s, d) => s + d.due_total, 0);
    const next7 = forecast.slice(0, 7);
    const avg7 = next7.length > 0 ? Math.round(totalScheduled / 7) : 0;

    // Find peak day in next 14 days
    const next14 = forecast.slice(0, 14);
    let peakDay: ForecastPoint | null = null;
    for (const d of next14) {
      if (!peakDay || d.due_total > peakDay.due_total) {
        peakDay = d;
      }
    }

    return { totalScheduled, avg7, peakDay };
  }, [forecast]);

  const formatPeakDate = (dateStr: string) => {
    const d = parseScheduleDate(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round(
      (d.getTime() - today.getTime()) / 86400000,
    );
    if (diff === 0) return t("schedule.today");
    if (diff === 1) return t("schedule.tomorrow");
    return t("schedule.inDays", { count: diff });
  };

  const items: Array<{ label: string; value: string; highlight?: boolean }> = [
    {
      label: t("schedule.totalScheduled"),
      value: stats.totalScheduled.toLocaleString(),
    },
    {
      label: t("schedule.dueToday"),
      value: dueTodayCount.toLocaleString(),
      highlight: dueTodayCount > 0,
    },
    {
      label: t("schedule.overdue"),
      value: overdueCount.toLocaleString(),
      highlight: overdueCount > 0,
    },
    {
      label: t("schedule.dailyAvg", { count: stats.avg7 }),
      value: `~${stats.avg7}/day`,
    },
    ...(stats.peakDay && stats.peakDay.due_total > 0
      ? [
          {
            label: "",
            value: t("schedule.peakDay", {
              date: formatPeakDate(stats.peakDay.date),
              count: stats.peakDay.due_total.toLocaleString(),
            }),
          },
        ]
      : []),
  ];

  return (
    <div className={cn(
      "flex gap-2 pb-1",
      isCompact ? "grid grid-cols-2 lg:grid-cols-2" : "overflow-x-auto scrollbar-hide"
    )}>
      {items.map((item, i) => (
        <div
          key={i}
          className={cn(
            "flex-shrink-0 px-3 py-2 rounded-lg bg-muted/50 min-w-0",
            isCompact && "py-1.5"
          )}
        >
          {item.label && (
            <div className="text-[10px] text-muted-foreground leading-tight truncate">
              {item.label}
            </div>
          )}
          <div
            className={cn(
              "text-sm font-semibold leading-tight truncate",
              !item.label ? "mt-0" : "mt-0.5",
              item.highlight ? "text-red-500 dark:text-red-400" : "text-foreground",
              isCompact && "text-xs"
            )}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
