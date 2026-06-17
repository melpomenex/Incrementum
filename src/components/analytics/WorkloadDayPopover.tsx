import { useState, useEffect } from "react";
import {
  BookOpen,
  CheckCircle,
  TextT,
  X,
  XCircle,
} from "@phosphor-icons/react";
import { useI18n } from "../../lib/i18n";
import { getWorkloadDayDetails, type WorkloadDayDetail } from "../../api/analytics";

function itemTypeIcon(type: string) {
  switch (type) {
    case "cloze": return "🃏";
    case "qa": return "❓";
    default: return "📝";
  }
}

function RatingIcon({ rating }: { rating: number | null }) {
  if (rating === null) return null;
  if (rating >= 3) return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
  return <XCircle className="h-3.5 w-3.5 text-red-500" />;
}

interface WorkloadDayPopoverProps {
  date: string;
  onClose: () => void;
}

export function WorkloadDayPopover({ date, onClose }: WorkloadDayPopoverProps) {
  const { t } = useI18n();
  const [details, setDetails] = useState<WorkloadDayDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const todayStr = new Date().toISOString().split("T")[0];
  const isPast = date < todayStr;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getWorkloadDayDetails(date).then((data) => {
      if (!cancelled) {
        setDetails(data);
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [date]);

  const { weekday, month, day } = (() => {
    const d = new Date(date + "T12:00:00");
    return {
      weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
      month: d.toLocaleDateString("en-US", { month: "short" }),
      day: d.getDate(),
    };
  })();

  return (
    <div className="rounded-lg border bg-background shadow-lg max-h-80 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {weekday}, {month} {day}
          </span>
          <span className="text-xs text-muted-foreground">
            ({isPast ? t("calendar.past") : t("calendar.projected")})
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-muted transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto max-h-60">
        {isLoading ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {t("calendar.loading")}
          </div>
        ) : details.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {isPast ? t("calendar.noReviews") : t("calendar.noItemsScheduled")}
          </div>
        ) : (
          <div className="divide-y">
            {details.map((item) => (
              <div key={item.item_id} className="px-3 py-2 hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-2">
                  <span className="text-sm mt-0.5 shrink-0">{itemTypeIcon(item.item_type)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs truncate">{item.question}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <TextT className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-[10px] text-muted-foreground truncate">
                        {item.document_title}
                      </span>
                    </div>
                  </div>
                  {isPast && <RatingIcon rating={item.review_rating} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer count */}
      {!isLoading && details.length > 0 && (
        <div className="px-3 py-1.5 border-t bg-muted/30 text-[10px] text-muted-foreground">
          {details.length} {isPast ? t("calendar.itemsReviewed") : t("calendar.itemsDue")}
        </div>
      )}
    </div>
  );
}
