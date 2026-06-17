import {
  CheckCircle,
  Clock,
  Flame,
  Timer,
  TrendUp,
} from "@phosphor-icons/react";
import { useI18n } from "../../lib/i18n";

interface ReviewProgressProps {
  currentIndex: number;
  totalCards: number;
  reviewsCompleted: number;
  correctCount: number;
  estimatedTimeRemaining?: number;
  streak?: {
    current_streak: number;
    longest_streak: number;
  } | null;
}

export function ReviewProgress({
  currentIndex,
  totalCards,
  reviewsCompleted,
  correctCount,
  estimatedTimeRemaining,
  streak,
}: ReviewProgressProps) {
  const { t } = useI18n();
  const remainingCards = totalCards - currentIndex;
  const accuracy = reviewsCompleted > 0
    ? Math.round((correctCount / reviewsCompleted) * 100)
    : 0;

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto mb-6 space-y-3">
      {/* Streak Display */}
      {streak && streak.current_streak > 0 && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-medium text-orange-500">
            {t("reviewProgress.dayStreak", { count: streak.current_streak })}
          </span>
          {streak.longest_streak > 1 && (
            <span className="text-xs text-muted-foreground">
              {t("reviewProgress.bestStreak", { count: streak.longest_streak })}
            </span>
          )}
        </div>
      )}

      {/* Progress Bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${totalCards > 0 ? (currentIndex / totalCards) * 100 : 0}%` }}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{t("reviewProgress.remainingLeft", { count: remainingCards })}</span>
          </div>
          {estimatedTimeRemaining !== undefined && remainingCards > 0 && (
            <div className="flex items-center gap-1" title={t("reviewProgress.estimatedTimeRemaining")}>
              <Timer className="w-4 h-4" />
              <span>{formatTime(estimatedTimeRemaining)}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            <span>{t("reviewProgress.completedDone", { count: reviewsCompleted })}</span>
          </div>
        </div>
        {reviewsCompleted > 0 && (
          <div className="flex items-center gap-1">
            <TrendUp className="w-4 h-4" />
            <span>{t("reviewProgress.correctRate", { count: accuracy })}</span>
          </div>
        )}
      </div>
    </div>
  );
}
