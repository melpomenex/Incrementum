import { Zap, LayoutGrid, Table2, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { cn } from "../../utils";

interface ScheduleToolbarProps {
  viewMode: "cards" | "table";
  onViewModeChange: (mode: "cards" | "table") => void;
  onSpread: () => void;
  isDashboardCollapsed: boolean;
  onToggleDashboard: () => void;
  selectedDate: string | null;
  onClearDate: () => void;
  isMobile?: boolean;
}

export function ScheduleToolbar({
  viewMode,
  onViewModeChange,
  onSpread,
  isDashboardCollapsed,
  onToggleDashboard,
  selectedDate,
  onClearDate,
  isMobile = false,
}: ScheduleToolbarProps) {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-bold text-foreground">
          {t("schedule.title")}
        </h1>

        {selectedDate && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary rounded-md text-[10px] font-medium animate-in fade-in slide-in-from-left-2">
            <Filter className="w-3 h-3" />
            {new Date(selectedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            <button
              onClick={onClearDate}
              className="ml-1 hover:text-primary/70 transition-colors"
            >
              ×
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* View Toggle (Desktop) */}
        {!isMobile && (
          <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5 mr-2">
            <button
              onClick={() => onViewModeChange("cards")}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium rounded transition-colors",
                viewMode === "cards"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="w-3 h-3" />
              {t("schedule.viewCards")}
            </button>
            <button
              onClick={() => onViewModeChange("table")}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium rounded transition-colors",
                viewMode === "table"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Table2 className="w-3 h-3" />
              {t("schedule.viewTable")}
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onSpread}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <Zap className="w-3 h-3" />
            {!isMobile && t("schedule.spreadOverloaded")}
          </button>

          <button
            onClick={onToggleDashboard}
            className={cn(
              "p-1.5 rounded-lg border border-border transition-colors hover:bg-muted text-muted-foreground",
              !isDashboardCollapsed && "bg-muted text-foreground"
            )}
            title={isDashboardCollapsed ? t("common.expand") : t("common.collapse")}
          >
            {isDashboardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
