import { ChevronDown, ChevronUp } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import type { ForecastPoint } from "../../api/analytics";
import { ScheduleTimeline } from "./ScheduleTimeline";
import { ScheduleSummary } from "./ScheduleSummary";

interface ScheduleDashboardProps {
  forecast: ForecastPoint[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  dueTodayCount: number;
  overdueCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobile?: boolean;
}

export function ScheduleDashboard({
  forecast,
  selectedDate,
  onSelectDate,
  dueTodayCount,
  overdueCount,
  isCollapsed,
  onToggleCollapse,
  isMobile = false,
}: ScheduleDashboardProps) {
  const { t } = useI18n();

  if (isCollapsed) {
    return (
      <div className="px-4 py-1.5 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="font-semibold text-foreground">{dueTodayCount}</span> {t("schedule.dueToday")}
          </span>
          <span className="flex items-center gap-1">
            <span className="font-semibold text-red-500">{overdueCount}</span> {t("schedule.overdue")}
          </span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded hover:bg-muted transition-colors text-muted-foreground"
        >
          <ChevronDown className="w-3 h-3" />
          {t("common.expand")}
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-border bg-card animate-in slide-in-from-top duration-200 overflow-hidden">
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {t("schedule.analyticsOverview")}
          </h2>
          <button
            onClick={onToggleCollapse}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded hover:bg-muted transition-colors text-muted-foreground"
          >
            <ChevronUp className="w-3 h-3" />
            {t("common.collapse")}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8">
            <ScheduleTimeline
              forecast={forecast}
              selectedDate={selectedDate}
              onSelectDate={onSelectDate}
            />
          </div>
          <div className="lg:col-span-4 lg:border-l lg:border-border lg:pl-4">
            <ScheduleSummary
              forecast={forecast}
              dueTodayCount={dueTodayCount}
              overdueCount={overdueCount}
              isCompact={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
