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
    <div className="w-full max-w-2xl mx-auto">
      <div className="grid grid-cols-4 gap-1.5 md:gap-3">
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
                text-white rounded-lg transition-all
                hover:shadow-lg hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-1 md:flex-col md:gap-2
                px-1 py-2 md:px-4 md:py-3 md:min-h-[100px]
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
              <Icon className="w-4 h-4 md:w-6 md:h-6 flex-shrink-0" aria-hidden="true" />
              <span className="font-semibold text-xs md:text-base leading-tight">{rating.label}</span>
              {interval && (
                <span className="text-[10px] md:text-xs opacity-90 hidden md:block" aria-label={t("ratingButtons.nextReviewIn", { interval })}>{interval}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Keyboard shortcuts hint - hide on mobile */}
      <div className="mt-3 md:mt-4 text-center text-sm text-muted-foreground hidden md:block">
        {t("ratingButtons.press")} <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">1</kbd>
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs ml-1">2</kbd>
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs ml-1">3</kbd>
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs ml-1">4</kbd>
        {" "}{t("ratingButtons.toRate")}
      </div>
    </div>
  );
}
