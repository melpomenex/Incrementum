import { useState } from "react";
import {
  BookOpen, Layers, Brain, Clock, AlertTriangle,
  Zap, TrendingUp, Repeat, ChevronDown, ChevronRight,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { parseScheduleDate } from "../../lib/scheduleUtils";
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

function getTypeLabel(type: ScheduleDayItem["itemType"], t: (k: string) => string) {
  switch (type) {
    case "document":
      return t("schedule.documentBadge");
    case "extract":
      return t("schedule.extractBadge");
    case "learning-item":
      return t("schedule.learningBadge");
    default:
      return type;
  }
}

/** Format interval: fractional days → human-readable */
function formatInterval(days: number, t: (k: string, v?: Record<string, number>) => string): string {
  if (days < 1) {
    const hours = Math.round(days * 24);
    if (hours < 1) return "<1h";
    return t("schedule.intervalHours", { count: hours });
  }
  if (days < 30) {
    return t("schedule.intervalDays", { count: Math.round(days * 10) / 10 });
  }
  const weeks = Math.round(days / 7 * 10) / 10;
  return t("schedule.intervalWeeks", { count: weeks });
}

/** Color for stability (0–100+ mapped to progress bar) */
function stabilityColor(s: number): string {
  if (s >= 21) return "bg-green-500";
  if (s >= 7) return "bg-lime-500";
  if (s >= 3) return "bg-amber-500";
  return "bg-red-500";
}

/** Color for difficulty (1–10 mapped to dot) */
function difficultyDot(d: number): string {
  if (d <= 3) return "bg-green-400";
  if (d <= 5) return "bg-amber-400";
  if (d <= 7) return "bg-orange-400";
  return "bg-red-400";
}

/** Color for retrievability (0–100%) */
function retrievColor(r: number): string {
  if (r >= 90) return "text-green-500";
  if (r >= 70) return "text-amber-500";
  return "text-red-500";
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
  const hasAlgoData = item.stability !== undefined || item.difficulty !== undefined
    || item.interval !== undefined || item.reps !== undefined;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dueDate = parseScheduleDate(item.dueDate);
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

  const daysColor = (() => {
    if (daysDiff === null) return "text-muted-foreground";
    if (daysDiff < 0) return "text-red-500";
    if (daysDiff === 0) return "text-amber-500";
    if (daysDiff <= 3) return "text-yellow-600 dark:text-yellow-400";
    return "text-muted-foreground";
  })();

  const handlePostpone = async (days: number) => {
    setPostponing(true);
    try {
      await onPostpone(item.id, days, item.itemType);
    } finally {
      setPostponing(false);
    }
  };

  return (
    <div
      className={cn(
        "group rounded-lg border border-border/50 bg-card/50 transition-colors hover:bg-card",
        isMobile && "cursor-pointer",
        isExpanded && "border-border shadow-sm",
      )}
      onClick={() => isMobile && setIsExpanded(!isExpanded)}
    >
      {/* Header row */}
      <div className="px-3 py-2.5 sm:px-4">
        <div className="flex items-start gap-2.5 sm:gap-3">
          {/* Type icon */}
          <div
            className={cn(
              "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5",
              iconBg,
            )}
          >
            <Icon className="w-3.5 h-3.5" />
          </div>

          {/* Title + metadata */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-foreground line-clamp-1 leading-snug">
                {item.documentTitle || "Untitled"}
              </h3>

              {/* Expand toggle (desktop) */}
              {!isMobile && hasAlgoData && (
                <button
                  onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                  className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isExpanded
                    ? <ChevronDown className="w-3.5 h-3.5" />
                    : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            {/* Inline metadata line */}
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-muted/60 text-muted-foreground">
                {getTypeLabel(item.itemType, t)}
              </span>

              {daysLabel && (
                <span className={cn("flex items-center gap-0.5 text-[10px] font-medium", daysColor)}>
                  <Clock className="w-3 h-3" />
                  {daysLabel}
                </span>
              )}

              {item.estimatedTime > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  ~{item.estimatedTime}m
                </span>
              )}

              {item.interval !== undefined && item.interval > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Repeat className="w-3 h-3" />
                  {formatInterval(item.interval, t)}
                </span>
              )}

              {item.reps !== undefined && (
                <span className="text-[10px] text-muted-foreground">
                  ×{item.reps}
                </span>
              )}

              {item.lapses !== undefined && item.lapses > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-red-400">
                  <AlertTriangle className="w-3 h-3" />
                  {item.lapses}
                </span>
              )}

              {/* Stability mini-bar inline */}
              {item.stability !== undefined && item.stability > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-10 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", stabilityColor(item.stability))}
                      style={{ width: `${Math.min(100, (item.stability / 30) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{item.stability.toFixed(1)}</span>
                </div>
              )}

              {/* Difficulty dot inline */}
              {item.difficulty !== undefined && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <span className={cn("w-1.5 h-1.5 rounded-full", difficultyDot(item.difficulty))} />
                  D{item.difficulty}
                </span>
              )}
            </div>
          </div>

          {/* Postpone buttons */}
          {(!isMobile || isExpanded) && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {(item.itemType === "learning-item" || item.itemType === "document") && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePostpone(1); }}
                    disabled={postponing}
                    className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    +1d
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePostpone(3); }}
                    disabled={postponing}
                    className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    +3d
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePostpone(7); }}
                    disabled={postponing}
                    className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    +7d
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expanded algorithm details */}
      {isExpanded && hasAlgoData && (
        <div className="px-3 pb-3 sm:px-4 sm:pb-3 ml-[2.125rem] sm:ml-[2.75rem]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/50">
            {/* Stability */}
            {item.stability !== undefined && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {t("schedule.stability")}
                  </span>
                  <span className="text-[10px] font-mono text-foreground">
                    {item.stability.toFixed(2)}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", stabilityColor(item.stability))}
                    style={{ width: `${Math.min(100, (item.stability / 30) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Difficulty */}
            {item.difficulty !== undefined && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {t("schedule.difficulty")}
                  </span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((d) => (
                      <span
                        key={d}
                        className={cn(
                          "w-2 h-2 rounded-full transition-colors",
                          d <= Math.round(item.difficulty / 2)
                            ? difficultyDot(item.difficulty)
                            : "bg-muted",
                        )}
                      />
                    ))}
                    <span className="text-[10px] font-mono text-foreground ml-0.5">
                      {item.difficulty.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Interval */}
            {item.interval !== undefined && item.interval > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {t("schedule.interval")}
                  </span>
                  <span className="text-[10px] font-mono text-foreground">
                    {formatInterval(item.interval, t)}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-all"
                    style={{ width: `${Math.min(100, (item.interval / 60) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Reps / Lapses / Retrievability */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {item.reps !== undefined && (
                  <span className="flex items-center gap-0.5">
                    <Repeat className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] font-mono text-foreground">{item.reps}</span>
                  </span>
                )}
                {item.lapses !== undefined && item.lapses > 0 && (
                  <span className="flex items-center gap-0.5">
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                    <span className="text-[10px] font-mono text-red-400">{item.lapses}</span>
                  </span>
                )}
                {item.retrievability !== undefined && (
                  <span className={cn("text-[10px] font-mono", retrievColor(item.retrievability))}>
                    R:{Math.round(item.retrievability * 100)}%
                  </span>
                )}
              </div>
              {(item.tags.length > 0 || item.category) && (
                <div className="flex items-center gap-1 flex-wrap">
                  {item.category && (
                    <span className="px-1.5 py-0.5 text-[9px] rounded bg-accent/50 text-accent-foreground">
                      {item.category}
                    </span>
                  )}
                  {item.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="px-1.5 py-0.5 text-[9px] rounded bg-muted text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                  {item.tags.length > 3 && (
                    <span className="text-[9px] text-muted-foreground">+{item.tags.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
