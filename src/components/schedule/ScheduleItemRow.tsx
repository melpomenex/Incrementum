import { useState } from "react";
import { BookOpen, Layers, Brain, Clock, AlertTriangle } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import type { ScheduleDayItem } from "../../types/queue";
import { cn } from "../../utils";

interface ScheduleItemRowProps {
  item: ScheduleDayItem;
  onPostpone: (itemId: string, days: number, itemType?: string) => Promise<void>;
  isMobile?: boolean;
}

function getTypeIcon(type: ScheduleDayItem["itemType"]) {
  switch (type) {
    case "document":
      return BookOpen;
    case "extract":
      return Layers;
    case "learning-item":
      return Brain;
    default:
      return BookOpen;
  }
}

function getTypeBg(type: ScheduleDayItem["itemType"]) {
  switch (type) {
    case "document":
      return "bg-blue-500/10 text-blue-500";
    case "extract":
      return "bg-amber-500/10 text-amber-500";
    case "learning-item":
      return "bg-purple-500/10 text-purple-500";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function ScheduleItemRow({
  item,
  onPostpone,
  isMobile = false,
}: ScheduleItemRowProps) {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(isMobile ? false : true);
  const [postponing, setPostponing] = useState(false);

  const Icon = getTypeIcon(item.itemType);
  const iconBg = getTypeBg(item.itemType);

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dueDate = item.dueDate ? new Date(item.dueDate + "T00:00:00") : null;
  const daysDiff = dueDate
    ? Math.ceil((dueDate.getTime() - now.getTime()) / 86400000)
    : null;

  const daysLabel = (() => {
    if (daysDiff === null) return "";
    if (daysDiff < 0) return t("schedule.overdue");
    if (daysDiff === 0) return t("schedule.today");
    if (daysDiff === 1) return t("schedule.tomorrow");
    return t("schedule.inDays", { count: daysDiff });
  })();

  const handlePostpone = async (days: number) => {
    setPostponing(true);
    try {
      await onPostpone(item.id, days, item.itemType);
    } finally {
      setPostponing(false);
    }
  };

  const badgeKey = (() => {
    switch (item.itemType) {
      case "document":
        return t("schedule.documentBadge");
      case "extract":
        return t("schedule.extractBadge");
      case "learning-item":
        return t("schedule.learningBadge");
      default:
        return item.itemType;
    }
  })();

  return (
    <div
      className={cn(
        "group px-4 py-3 transition-colors hover:bg-muted/30",
        isMobile && "cursor-pointer",
      )}
      onClick={() => isMobile && setIsExpanded(!isExpanded)}
    >
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div
          className={cn(
            "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5",
            iconBg,
          )}
        >
          <Icon className="w-4 h-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
              {item.documentTitle || "Untitled"}
            </h3>

            {/* Quick actions — desktop always visible, mobile only when expanded */}
            {(!isMobile || isExpanded) && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {(item.itemType === "learning-item" || item.itemType === "document") && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePostpone(1);
                      }}
                      disabled={postponing}
                      className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      title={t("schedule.postpone1d")}
                    >
                      {t("schedule.postpone1d")}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePostpone(3);
                      }}
                      disabled={postponing}
                      className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      title={t("schedule.postpone3d")}
                    >
                      {t("schedule.postpone3d")}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePostpone(7);
                      }}
                      disabled={postponing}
                      className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      title={t("schedule.postpone7d")}
                    >
                      {t("schedule.postpone7d")}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {/* Type badge */}
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-muted text-muted-foreground">
              {badgeKey}
            </span>

            {/* Days until due */}
            {daysLabel && (
              <span
                className={cn(
                  "flex items-center gap-0.5 text-[10px] font-medium",
                  daysDiff !== null && daysDiff < 0
                    ? "text-red-500"
                    : daysDiff === 0
                      ? "text-amber-500"
                      : "text-muted-foreground",
                )}
              >
                <Clock className="w-3 h-3" />
                {daysLabel}
              </span>
            )}

            {/* Stability bar */}
            {item.stability !== undefined && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">
                  {t("schedule.stability")}
                </span>
                <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      item.stability > 30
                        ? "bg-green-500"
                        : item.stability > 10
                          ? "bg-amber-500"
                          : "bg-red-500",
                    )}
                    style={{ width: `${Math.min(100, item.stability)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {item.stability}%
                </span>
              </div>
            )}

            {/* Difficulty */}
            {item.difficulty !== undefined && (
              <span className="text-[10px] text-muted-foreground">
                D:{item.difficulty}
              </span>
            )}

            {/* Estimated time */}
            {item.estimatedTime > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {t("schedule.estTime", { count: item.estimatedTime })}
              </span>
            )}

            {/* Lapses */}
            {item.lapses !== undefined && item.lapses > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-red-500">
                <AlertTriangle className="w-3 h-3" />
                {t("schedule.lapses", { count: item.lapses })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
