import { ReviewRating, PreviewIntervals, formatInterval } from "../../api/review";
import { RotateCcw, ThumbsDown, ThumbsUp, Zap } from "lucide-react";
import { useI18n } from "../../lib/i18n";

interface RatingButtonsProps {
  onSelectRating: (rating: ReviewRating) => void;
  disabled?: boolean;
  previewIntervals?: PreviewIntervals | null;
}

export function RatingButtons({
  onSelectRating,
  disabled = false,
  previewIntervals,
}: RatingButtonsProps) {
  const { t } = useI18n();
  const ratings: {
    value: ReviewRating;
    label: string;
    icon: typeof RotateCcw;
    color: string;
    description: string;
  }[] = [
    {
      value: 1,
      label: t("review.again"),
      icon: RotateCcw,
      color: "bg-red-500 hover:bg-red-600",
      description: t("ratingButtons.againDescription"),
    },
    {
      value: 2,
      label: t("review.hard"),
      icon: ThumbsDown,
      color: "bg-orange-500 hover:bg-orange-600",
      description: t("ratingButtons.hardDescription"),
    },
    {
      value: 3,
      label: t("review.good"),
      icon: ThumbsUp,
      color: "bg-blue-500 hover:bg-blue-600",
      description: t("ratingButtons.goodDescription"),
    },
    {
      value: 4,
      label: t("review.easy"),
      icon: Zap,
      color: "bg-green-500 hover:bg-green-600",
      description: t("ratingButtons.easyDescription"),
    },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto px-2 md:px-0">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        {ratings.map((rating) => {
          const Icon = rating.icon;
          const interval = previewIntervals
            ? formatInterval(
                previewIntervals[
                  rating.value === 1
                    ? "again"
                    : rating.value === 2
                      ? "hard"
                      : rating.value === 3
                        ? "good"
                        : "easy"
                ]
              )
            : null;

          return (
            <button
              key={rating.value}
              onClick={() => onSelectRating(rating.value)}
              disabled={disabled}
              className={`
                ${rating.color}
                text-white rounded-lg p-3 md:p-4 transition-all
                hover:shadow-lg hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
                flex flex-col items-center gap-1 md:gap-2
                min-h-[60px] md:min-h-[100px] min-w-[80px]
                touch-manipulation
                focus-visible:ring-4 focus-visible:ring-white/50 focus-visible:outline-none
                focus-visible:scale-[1.02]
              `}
              title={t("ratingButtons.rateAsTitle", { label: rating.label, description: rating.description })}
              aria-label={
                interval
                  ? t("ratingButtons.rateAsWithInterval", {
                      label: rating.label,
                      description: rating.description,
                      interval,
                    })
                  : t("ratingButtons.rateAs", { label: rating.label, description: rating.description })
              }
            >
              <Icon className="w-5 h-5 md:w-6 md:h-6" aria-hidden="true" />
              <span className="font-semibold text-sm md:text-base">{rating.label}</span>
              {interval && (
                <span className="text-xs opacity-90" aria-label={t("ratingButtons.nextReviewIn", { interval })}>{interval}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Keyboard shortcuts hint - hide on mobile */}
      <div className="mt-4 text-center text-sm text-muted-foreground hidden md:block">
        {t("ratingButtons.press")} <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">1</kbd>
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs ml-1">2</kbd>
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs ml-1">3</kbd>
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs ml-1">4</kbd>
        {" "}{t("ratingButtons.toRate")}
      </div>
    </div>
  );
}
