import { useState, useEffect, useMemo, useCallback } from "react";
import { X, Loader2 } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { parseScheduleDate } from "../../lib/scheduleUtils";
import type { ScheduleDayItem } from "../../types/queue";
import type { ForecastPoint } from "../../api/analytics";
import { computeSpreadProjection } from "../../lib/scheduleSpread";
import { SpreadPreviewChart } from "./SpreadPreviewChart";
import { cn } from "../../utils";

interface SpreadModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Items to spread */
  items: ScheduleDayItem[];
  /** Source date being spread (ISO string) */
  sourceDate: string;
  /** Current forecast for preview chart */
  forecast: ForecastPoint[];
  /** Called when user confirms the spread */
  onConfirm: (itemIds: string[], horizonDays: number) => Promise<void>;
  /** Toast callback */
  onToast: (message: string, description?: string) => void;
  isMobile?: boolean;
}

const HORIZON_OPTIONS = [7, 14, 30, 60, 90];

export function SpreadModal({
  isOpen,
  onClose,
  items,
  sourceDate,
  forecast,
  onConfirm,
  onToast,
  isMobile = false,
}: SpreadModalProps) {
  const { t } = useI18n();
  const [horizon, setHorizon] = useState(30);
  const [isSpreading, setIsSpreading] = useState(false);

  // Compute live preview
  const projection = useMemo(
    () => computeSpreadProjection(items, horizon),
    [items, horizon],
  );

  const learningItemCount = items.filter(
    (i) => i.itemType === "learning-item",
  ).length;
  const docCount = items.filter(
    (i) => i.itemType === "document",
  ).length;

  const handleConfirm = useCallback(async () => {
    const allItemIds = items.map((i) => i.id);

    if (allItemIds.length === 0) {
      return;
    }

    setIsSpreading(true);
    try {
      await onConfirm(allItemIds, horizon);
      const avg = Math.round(
        projection.stats.postponedCount / Math.min(horizon, 90),
      );
      onToast(
        t("schedule.spreadComplete", {
          count: allItemIds.length.toLocaleString(),
          days: horizon,
          avg: avg.toLocaleString(),
        }),
      );
      onClose();
    } catch (err) {
      onToast(
        t("schedule.postponeFailed"),
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setIsSpreading(false);
    }
  }, [items, horizon, projection, onConfirm, onToast, onClose, t]);

  // Reset horizon when source changes
  useEffect(() => {
    setHorizon(30);
  }, [sourceDate]);

  if (!isOpen) return null;

  const sourceLabel = parseScheduleDate(sourceDate)?.toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric" },
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal / Bottom sheet */}
      <div
        className={cn(
          "relative bg-background border border-border rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-xl animate-in slide-in-from-bottom-4 sm:zoom-in-95",
          isMobile ? "max-h-[85vh]" : "max-h-[80vh]",
        )}
      >
        {/* Drag handle (mobile) */}
        {isMobile && (
          <div className="flex justify-center pt-2 pb-0">
            <div className="w-8 h-1 bg-muted rounded-full" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("schedule.spreadTitle")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("schedule.spreadDescription", {
                source: sourceLabel,
                days: horizon,
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {/* Item count info */}
          <div className="flex gap-3 text-xs">
            <div className="px-2.5 py-1.5 bg-purple-500/10 rounded-lg">
              <span className="text-purple-600 dark:text-purple-400 font-medium">
                {learningItemCount} {t("schedule.learningBadge").toLowerCase()}s
              </span>
            </div>
            {docCount > 0 && (
              <div className="px-2.5 py-1.5 bg-blue-500/10 rounded-lg">
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  {docCount} {t("schedule.documentBadge").toLowerCase()}s
                </span>
              </div>
            )}
          </div>

          {/* Horizon picker */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              {t("schedule.horizon")}
            </label>
            <div className="flex flex-wrap gap-2">
              {HORIZON_OPTIONS.map((days) => (
                <button
                  key={days}
                  onClick={() => setHorizon(days)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    horizon === days
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  {t("schedule.days", { count: days })}
                </button>
              ))}
            </div>
          </div>

          {/* Preview chart */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              {t("schedule.preview")}
            </label>
            <SpreadPreviewChart
              beforeData={forecast}
              afterData={projection.dailyDistribution}
              sourceDate={sourceDate}
              horizonDays={horizon}
            />
          </div>

          {/* Stats */}
          {projection.stats.postponedCount > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">{t("schedule.preview")}: </span>
              ~
              {Math.round(
                projection.stats.postponedCount / horizon,
              )}
              {t("schedule.estTime", { count: "" }).replace("est.", "/day")}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            {t("schedule.cancel")}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSpreading || projection.stats.postponedCount === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSpreading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t("schedule.spreadConfirm", {
              count: projection.stats.postponedCount.toLocaleString(),
              days: horizon,
            })}
          </button>
        </div>
      </div>
    </div>
  );
}
