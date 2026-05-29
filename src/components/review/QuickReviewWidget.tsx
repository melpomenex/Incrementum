/**
 * Quick Review Widget
 * Compact widget for quick reviews on dashboard or mobile home
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Brain,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  RotateCcw,
  Sparkles,
  Clock,
  Flame,
  Target,
  Volume2,
  VolumeX,
  Loader2,
  Maximize2,
} from "lucide-react";
import { useTTS } from "../../hooks/useTTS";
import { useI18n } from "../../lib/i18n";

interface QuickReviewCard {
  id: string;
  front: string;
  back: string;
  documentTitle?: string;
  difficulty?: "easy" | "medium" | "hard";
  interval?: number;
}

interface QuickReviewWidgetProps {
  cards: QuickReviewCard[];
  onRate: (cardId: string, rating: "again" | "hard" | "good" | "easy") => Promise<void>;
  onExpand?: () => void;
  maxCards?: number;
  autoPlay?: boolean;
  className?: string;
}

type Rating = "again" | "hard" | "good" | "easy";

const RATING_CONFIG: Record<Rating, { label: string; color: string; bgColor: string; icon: typeof Check }> = {
  again: { label: "again", color: "text-red-500", bgColor: "bg-red-500/20 hover:bg-red-500/30", icon: RotateCcw },
  hard: { label: "hard", color: "text-amber-500", bgColor: "bg-amber-500/20 hover:bg-amber-500/30", icon: X },
  good: { label: "good", color: "text-green-500", bgColor: "bg-green-500/20 hover:bg-green-500/30", icon: Check },
  easy: { label: "easy", color: "text-blue-500", bgColor: "bg-blue-500/20 hover:bg-blue-500/30", icon: Sparkles },
};

export function QuickReviewWidget({
  cards,
  onRate,
  onExpand,
  maxCards = 10,
  autoPlay = false,
  className = "",
}: QuickReviewWidgetProps) {
  const { t } = useI18n();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const { isSpeaking, speak, stop } = useTTS();

  // Limit cards to maxCards
  const reviewCards = useMemo(() => cards.slice(0, maxCards), [cards, maxCards]);
  const currentCard = reviewCards[currentIndex];
  const remainingCount = reviewCards.length - currentIndex;
  const progress = reviewCards.length > 0 ? (completedCount / reviewCards.length) * 100 : 0;

  // Auto-play TTS when card changes
  useEffect(() => {
    if (autoPlay && currentCard && !isFlipped) {
      speak(currentCard.front);
    }
    return () => stop();
  }, [currentCard, autoPlay, isFlipped, speak, stop]);

  const handleFlip = useCallback(() => {
    setIsFlipped(true);
    if (autoPlay && currentCard) {
      speak(currentCard.back);
    }
  }, [autoPlay, currentCard, speak]);

  const handleRate = useCallback(async (rating: Rating) => {
    if (!currentCard || isProcessing) return;

    setIsProcessing(true);
    try {
      await onRate(currentCard.id, rating);
      setCompletedCount((prev) => prev + 1);

      if (currentIndex < reviewCards.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        setIsFlipped(false);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [currentCard, isProcessing, onRate, currentIndex, reviewCards.length]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
    }
  }, [currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture shortcuts when user is typing
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      const target = e.target as HTMLElement;
      if (target.isContentEditable) {
        return;
      }

      if (!currentCard) return;

      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!isFlipped) handleFlip();
      }

      if (isFlipped) {
        switch (e.key) {
          case "1":
            handleRate("again");
            break;
          case "2":
            handleRate("hard");
            break;
          case "3":
            handleRate("good");
            break;
          case "4":
            handleRate("easy");
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentCard, isFlipped, handleFlip, handleRate]);

  if (reviewCards.length === 0) {
    return (
      <div className={`bg-card border border-border rounded-2xl p-6 ${className}`}>
        <div className="flex flex-col items-center justify-center text-center py-8">
          <div className="p-4 bg-green-500/10 rounded-full mb-4">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">{t("quickReview.allCaughtUp")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("quickReview.noCardsDue")}
          </p>
        </div>
      </div>
    );
  }

  if (currentIndex >= reviewCards.length || remainingCount === 0) {
    return (
      <div className={`bg-card border border-border rounded-2xl p-6 ${className}`}>
        <div className="flex flex-col items-center justify-center text-center py-8">
          <div className="p-4 bg-primary/10 rounded-full mb-4">
            <Target className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {t("quickReview.sessionComplete")}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t("quickReview.reviewedCards", { count: completedCount })}
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{t("quickReview.keepItUp")}</span>
            </div>
            <div className="flex items-center gap-1">
              <Flame className="w-4 h-4 text-orange-500" />
              <span>{t("quickReview.plusReviews", { count: completedCount })}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card border border-border rounded-2xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-xl">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("quickReview.title")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("quickReview.cardsRemaining", { count: remainingCount })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onExpand && (
            <button
              onClick={onExpand}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title={t("quickReview.openFullReview")}
            >
              <Maximize2 className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          <button
            onClick={() => isSpeaking ? stop() : speak(isFlipped ? currentCard.back : currentCard.front)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            title={isSpeaking ? t("common.stop") : t("quickReview.readAloud")}
          >
            {isSpeaking ? (
              <VolumeX className="w-4 h-4 text-primary" />
            ) : (
              <Volume2 className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Card */}
      <div className="p-4">
        <div
          onClick={() => !isFlipped && handleFlip()}
          className={`min-h-[120px] p-4 rounded-xl border transition-all cursor-pointer ${
            isFlipped
              ? "bg-primary/5 border-primary/20"
              : "bg-gradient-to-br from-card to-muted/50 border-border hover:border-primary/30"
          }`}
        >
          {/* Document source */}
          {currentCard.documentTitle && (
            <p className="text-xs text-muted-foreground mb-2 truncate">
              {currentCard.documentTitle}
            </p>
          )}

          {/* Content */}
          <p className="text-sm text-foreground leading-relaxed">
            {isFlipped ? currentCard.back : currentCard.front}
          </p>

          {/* Flip hint */}
          {!isFlipped && (
            <p className="text-xs text-muted-foreground mt-3 text-center">
              {t("quickReview.tapToReveal")}
            </p>
          )}
        </div>
      </div>

      {/* Rating buttons */}
      {isFlipped && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-4 gap-2">
            {(Object.entries(RATING_CONFIG) as [Rating, typeof RATING_CONFIG[Rating]][]).map(
              ([rating, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={rating}
                    onClick={() => handleRate(rating)}
                    disabled={isProcessing}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${config.bgColor} disabled:opacity-50`}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    )}
                    <span className={`text-xs font-medium ${config.color}`}>
                      {t(`review.${config.label}`)}
                    </span>
                  </button>
                );
              }
            )}
          </div>

          {/* Keyboard hints */}
          <div className="flex justify-center gap-4 mt-3">
            {(Object.entries(RATING_CONFIG) as [Rating, typeof RATING_CONFIG[Rating]][]).map(
              ([rating, config], index) => (
                <span key={rating} className="text-xs text-muted-foreground">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">{index + 1}</kbd>
                  {" "}{t(`review.${config.label}`)}
                </span>
              )
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      {!isFlipped && currentIndex > 0 && (
        <div className="px-4 pb-4">
          <button
            onClick={handlePrevious}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {t("quickReview.previousCard")}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Minimal inline quick review for dashboards
 */
interface InlineQuickReviewProps {
  dueCount: number;
  onStartReview: () => void;
  className?: string;
}

export function InlineQuickReview({
  dueCount,
  onStartReview,
  className = "",
}: InlineQuickReviewProps) {
  const { t } = useI18n();
  if (dueCount === 0) {
    return (
      <div
        className={`flex items-center gap-3 p-3 bg-green-500/10 rounded-xl ${className}`}
      >
        <div className="p-2 bg-green-500/20 rounded-lg">
          <Check className="w-4 h-4 text-green-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">{t("quickReview.allCaughtUp")}</p>
          <p className="text-xs text-muted-foreground">{t("quickReview.noReviewsDue")}</p>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onStartReview}
      className={`w-full flex items-center gap-3 p-3 bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors ${className}`}
    >
      <div className="p-2 bg-primary/20 rounded-lg">
        <Brain className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-medium text-foreground">
          {t("quickReview.cardsDue", { count: dueCount })}
        </p>
        <p className="text-xs text-muted-foreground">{t("quickReview.startQuickReview")}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </button>
  );
}

/**
 * Floating quick review button for mobile
 */
interface FloatingReviewButtonProps {
  dueCount: number;
  onClick: () => void;
  className?: string;
}

export function FloatingReviewButton({
  dueCount,
  onClick,
  className = "",
}: FloatingReviewButtonProps) {
  const { t } = useI18n();
  if (dueCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className={`fixed bottom-20 right-4 flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 z-40 ${className}`}
    >
      <Brain className="w-5 h-5" />
      <span className="font-medium">{t("review.title")}</span>
      <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-white/20 rounded-full text-xs font-bold">
        {dueCount}
      </span>
    </button>
  );
}

/**
 * Stats row for quick review widget
 */
interface QuickReviewStatsProps {
  reviewed: number;
  correct: number;
  streak: number;
  className?: string;
}

export function QuickReviewStats({
  reviewed,
  correct,
  streak,
  className = "",
}: QuickReviewStatsProps) {
  const { t } = useI18n();
  const accuracy = reviewed > 0 ? Math.round((correct / reviewed) * 100) : 0;

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="flex items-center gap-1.5">
        <Target className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{t("quickReview.reviewedShort", { count: reviewed })}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Check className="w-3.5 h-3.5 text-green-500" />
        <span className="text-xs text-muted-foreground">{t("quickReview.accuracyShort", { count: accuracy })}</span>
      </div>
      {streak > 0 && (
        <div className="flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-xs text-muted-foreground">{t("quickReview.streakShort", { count: streak })}</span>
        </div>
      )}
    </div>
  );
}

export default QuickReviewWidget;
