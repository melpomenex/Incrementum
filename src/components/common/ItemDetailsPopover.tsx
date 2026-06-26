import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleNotch,
  Eye,
  EyeSlash,
  Info,
  X,
} from "@phosphor-icons/react";
import { getDocument, dismissDocument } from "../../api/documents";
import { useToast } from "../common/Toast";
import { getExtract } from "../../api/extracts";
import { getLearningItem } from "../../api/learning-items";
import { getAlgorithmParams } from "../../api/algorithm";
import { previewReviewIntervals, formatInterval, type PreviewIntervals } from "../../api/review";
import { cn } from "../../utils";
import { useSettingsStore } from "../../stores/settingsStore";
import { useI18n } from "../../lib/i18n";

export type ItemDetailsTarget =
  | {
      type: "document";
      id: string;
      title: string;
      tags?: string[];
      category?: string;
    }
  | {
      type: "extract";
      id: string;
      title: string;
      tags?: string[];
      category?: string;
    }
  | {
      type: "learning-item";
      id: string;
      title: string;
      tags?: string[];
      category?: string;
    }
  | {
      type: "rss";
      title: string;
      source?: string;
      link?: string;
      category?: string;
    };

interface ItemDetailsData {
  stability?: number | null;
  difficulty?: number | null;
  retrievability?: number | null;
  nextIntervalDays?: number | null;
  dueDate?: string | null;
  reps?: number | null;
  lapses?: number | null;
  previewIntervals?: PreviewIntervals | null;
  raw?: Record<string, unknown> | null;
  isDismissed?: boolean;
  algorithmType?: string | null;
}

interface ItemDetailsPopoverProps {
  target: ItemDetailsTarget;
  renderTrigger: (props: { onClick: () => void; isOpen: boolean; }) => React.ReactNode;
  align?: "left" | "right";
  className?: string;
  onDismissStateChange?: (dismissed: boolean) => void;
}

const EMPTY_DETAILS: ItemDetailsData = {
  stability: null,
  difficulty: null,
  retrievability: null,
  nextIntervalDays: null,
  dueDate: null,
  reps: null,
  lapses: null,
  previewIntervals: null,
  raw: null,
  algorithmType: null,
};

function formatMaybeNumber(value?: number | null, suffix?: string): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  const formatted = Math.round(value * 100) / 100;
  return suffix ? `${formatted}${suffix}` : `${formatted}`;
}

function formatDate(value?: string | null): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString();
}

function getIntervalFromDueDate(value?: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = date.getTime() - Date.now();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return Math.round(diffDays * 10) / 10;
}

async function loadItemDetails(target: ItemDetailsTarget): Promise<ItemDetailsData> {
  if (target.type === "learning-item") {
    const [item, algorithm, previewIntervals] = await Promise.all([
      getLearningItem(target.id),
      getAlgorithmParams(target.id).catch(() => null),
      previewReviewIntervals(target.id).catch(() => null),
    ]);

    const stability = algorithm?.stability ?? item?.memory_state?.stability ?? null;
    const difficulty = algorithm?.difficulty ?? item?.memory_state?.difficulty ?? null;
    const nextIntervalDays = algorithm?.interval ?? null;

    return {
      stability,
      difficulty,
      retrievability: null,
      nextIntervalDays,
      dueDate: item?.due_date ?? null,
      reps: item?.review_count ?? null,
      lapses: item?.lapses ?? null,
      previewIntervals,
      raw: item ? { ...item } : null,
      algorithmType: item?.algorithm_type ?? null,
    };
  }

  if (target.type === "extract") {
    const extract = await getExtract(target.id);
    return {
      stability: extract?.memory_state?.stability ?? null,
      difficulty: extract?.memory_state?.difficulty ?? null,
      retrievability: null,
      nextIntervalDays: getIntervalFromDueDate(extract?.next_review_date ?? null),
      dueDate: extract?.next_review_date ?? null,
      reps: extract?.reps ?? null,
      lapses: null,
      previewIntervals: null,
      raw: extract ? { ...extract } : null,
    };
  }

  if (target.type === "document") {
    const document = await getDocument(target.id);
    return {
      stability: document?.stability ?? null,
      difficulty: document?.difficulty ?? null,
      retrievability: null,
      nextIntervalDays: getIntervalFromDueDate(document?.nextReadingDate ?? null),
      dueDate: document?.nextReadingDate ?? null,
      reps: document?.reps ?? document?.readingCount ?? null,
      lapses: null,
      previewIntervals: null,
      isDismissed: document?.isDismissed ?? false,
      raw: document ? { ...document } : null,
    };
  }

  return EMPTY_DETAILS;
}

export function ItemDetailsPopover({
  target,
  renderTrigger,
  align = "right",
  className,
  onDismissStateChange,
}: ItemDetailsPopoverProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [details, setDetails] = useState<ItemDetailsData>(EMPTY_DETAILS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [isUpdatingDismiss, setIsUpdatingDismiss] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const { settings } = useSettingsStore();

  const targetKey = useMemo(() => {
    if (target.type === "rss") return `rss:${target.title}`;
    return `${target.type}:${target.id}`;
  }, [target]);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setIsLoading(true);
    setError(null);

    loadItemDetails(target)
      .then((data) => {
        if (!active) return;
        setDetails(data);
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed to load item details", err);
        setError(t("itemDetails.failedToLoad"));
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, targetKey, target]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (event.target instanceof Node && wrapperRef.current.contains(event.target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setShowRaw(false);
    }
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleDismissToggle = async () => {
    if (target.type !== "document") return;
    
    setIsUpdatingDismiss(true);
    try {
      const newDismissedState = !details.isDismissed;
      await dismissDocument(target.id, newDismissedState);
      setDetails((prev) => ({ ...prev, isDismissed: newDismissedState }));
      onDismissStateChange?.(newDismissedState);
      toast.success(
        newDismissedState ? t("itemDetails.documentDismissed") : t("itemDetails.documentRestored"),
        newDismissedState 
          ? t("itemDetails.hiddenFromQueue")
          : t("itemDetails.appearsInQueue")
      );
    } catch (error) {
      console.error("Failed to update dismiss status:", error);
      toast.error(
        t("itemDetails.updateFailed"),
        error instanceof Error ? error.message : t("itemDetails.pleaseTryAgain")
      );
    } finally {
      setIsUpdatingDismiss(false);
    }
  };

  const tags = target.type === "rss" ? [] : target.tags ?? [];

  return (
    <div ref={wrapperRef} className={cn("relative inline-flex", className)}>
      {renderTrigger({ onClick: handleToggle, isOpen })}
      {isOpen && (
        <div
          className={cn(
            "fixed inset-x-4 bottom-4 max-w-lg mx-auto md:absolute md:inset-x-auto md:bottom-auto md:top-full md:mt-2 md:w-96 md:max-w-none md:mx-0 z-50 rounded-xl border border-border bg-background text-popover-foreground shadow-xl",
            align === "right" ? "md:right-0 md:left-auto" : "md:left-0 md:right-auto"
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Info className="h-4 w-4" />
              {t("queue.itemDetails")}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={t("itemDetails.closeDetails")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-4 py-3 space-y-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">{t("common.title")}</div>
              <div className="font-semibold text-foreground truncate">{target.title}</div>
              <div className="text-xs text-muted-foreground capitalize">{t(`itemDetails.type.${target.type.replace("-", "")}`)}</div>
              {target.type === "rss" && target.source && (
                <div className="text-xs text-muted-foreground">{t("itemDetails.source")}: {target.source}</div>
              )}
            </div>

            {(tags.length > 0 || target.category) && (
              <div className="space-y-1">
                {target.category && (
                  <div className="text-xs text-foreground/80">{t("itemDetails.category")}: {target.category}</div>
                )}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded bg-muted/60 text-xs text-foreground border border-border/50"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-border pt-3 space-y-2">
              <div className="text-xs text-muted-foreground">
                {t("itemDetails.scheduling")} / {
                  details.algorithmType === "sm18" || (details.algorithmType !== "fsrs" && settings.learning.algorithm === "sm18")
                    ? "SuperMemo 18"
                    : details.algorithmType === "sm20" || (details.algorithmType !== "fsrs" && settings.learning.algorithm === "sm20")
                    ? "SuperMemo 20"
                    : "FSRS-6"
                }
              </div>
              {isLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CircleNotch className="h-3.5 w-3.5 animate-spin" />
                  {t("itemDetails.loadingScheduling")}
                </div>
              ) : error ? (
                <div className="text-xs text-destructive">{error}</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">{t("itemDetails.stability")}</div>
                      <div className="font-semibold text-foreground">{formatMaybeNumber(details.stability)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">{t("itemDetails.difficulty")}</div>
                      <div className="font-semibold text-foreground">{formatMaybeNumber(details.difficulty)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">{t("itemDetails.retrievability")}</div>
                      <div className="font-semibold text-foreground">{formatMaybeNumber(details.retrievability)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">{t("itemDetails.nextInterval")}</div>
                      <div className="font-semibold text-foreground">
                        {details.nextIntervalDays === null || details.nextIntervalDays === undefined
                          ? t("itemDetails.notAvailable")
                          : t("itemDetails.daysValue", { count: details.nextIntervalDays })}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">{t("itemDetails.dueDate")}</div>
                      <div className="font-semibold text-foreground">{formatDate(details.dueDate)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">{t("itemDetails.reps")}</div>
                      <div className="font-semibold text-foreground">{formatMaybeNumber(details.reps)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">{t("itemDetails.lapses")}</div>
                      <div className="font-semibold text-foreground">{formatMaybeNumber(details.lapses)}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">{t("itemDetails.previewIntervals")}</div>
                    {details.previewIntervals ? (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {([
                          ["again", t("queue.again")],
                          ["hard", t("queue.hard")],
                          ["good", t("queue.good")],
                          ["easy", t("queue.easy")],
                        ] as const).map(([key, label]) => (
                          <div key={key} className="rounded-md bg-muted/60 p-2">
                            <div className="text-muted-foreground">{label}</div>
                            <div className="font-semibold text-foreground">
                              {formatInterval(details.previewIntervals[key])}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">{t("itemDetails.unavailable")}</div>
                    )}
                  </div>
                </>
              )}
            </div>

            {details.raw && (
              <div className="border-t border-border pt-3">
                <button
                  onClick={() => setShowRaw((prev) => !prev)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {showRaw ? t("itemDetails.hideRawData") : t("itemDetails.showRawData")}
                </button>
                {showRaw && (
                  <pre className="mt-2 max-h-40 overflow-auto rounded-md border border-border bg-background p-2 text-[10px] text-foreground">
{JSON.stringify(details.raw, null, 2)}
                  </pre>
                )}
              </div>
            )}

            {/* Dismiss/Undismiss button for documents */}
            {target.type === "document" && (
              <div className="border-t border-border pt-3">
                <button
                  onClick={handleDismissToggle}
                  disabled={isUpdatingDismiss}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    details.isDismissed
                      ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                      : "bg-slate-500/10 text-slate-600 hover:bg-slate-500/20"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isUpdatingDismiss ? (
                    <CircleNotch className="w-4 h-4 animate-spin" />
                  ) : details.isDismissed ? (
                    <>
                      <Eye className="w-4 h-4" />
                      {t("itemDetails.undismiss")}
                    </>
                  ) : (
                    <>
                      <EyeSlash className="w-4 h-4" />
                      {t("itemDetails.dismiss")}
                    </>
                  )}
                </button>
                <p className="mt-1 text-xs text-muted-foreground text-center">
                  {details.isDismissed
                    ? t("itemDetails.hiddenButSearchable")
                    : t("itemDetails.dismissedRemainSearchable")}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
