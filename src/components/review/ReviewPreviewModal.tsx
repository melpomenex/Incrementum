/**
 * Review Preview Modal
 * Shows before starting a review session with card count and estimated time
 * Allows user to start or cancel
 * Includes time-boxed review options
 */

import { useState } from "react";
import {
  BookOpen,
  Brain,
  Check,
  Clock,
  Play,
  Stack,
  Target,
  Timer,
  TrendUp,
  X,
} from "@phosphor-icons/react";
import { useI18n } from "../../lib/i18n";

interface ReviewPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartReview: (timeLimitMinutes?: number) => void;
  totalCards: number;
  newCards: number;
  learningCards: number;
  reviewCards: number;
  estimatedMinutes: number;
  deckName?: string;
}

const TIME_BOX_OPTIONS = [
  { minutes: 5, label: "5 min", descriptionKey: "reviewPreview.quickSession" },
  { minutes: 10, label: "10 min", descriptionKey: "reviewPreview.shortFocus" },
  { minutes: 15, label: "15 min", descriptionKey: "reviewPreview.moderate" },
  { minutes: 20, label: "20 min", descriptionKey: "reviewPreview.deepDive" },
];

export function ReviewPreviewModal({
  isOpen,
  onClose,
  onStartReview,
  totalCards,
  newCards,
  learningCards,
  reviewCards,
  estimatedMinutes,
  deckName,
}: ReviewPreviewModalProps) {
  const { t } = useI18n();
  const [selectedTimeBox, setSelectedTimeBox] = useState<number | null>(null);
  const [showTimeBoxOptions, setShowTimeBoxOptions] = useState(false);

  if (!isOpen) return null;

  const hasCards = totalCards > 0;

  // Calculate cards that fit in selected time box
  const cardsPerMinute = 2; // Average 30 seconds per card
  const maxCardsForTimeBox = selectedTimeBox ? selectedTimeBox * cardsPerMinute : totalCards;
  const effectiveCards = selectedTimeBox ? Math.min(totalCards, maxCardsForTimeBox) : totalCards;

  const handleStartReview = () => {
    onStartReview(selectedTimeBox || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full animate-glass-scale-in">
        {/* Header */}
        <div className="relative p-6 text-center border-b border-border bg-gradient-to-b from-primary/5 to-transparent">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-muted rounded-full transition-colors"
            aria-label={t("reviewDecks.closeModal")}
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>

          <div className="w-16 h-16 bg-gradient-to-br from-primary/30 to-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            {hasCards ? (
              <Target className="w-8 h-8 text-primary" />
            ) : (
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            )}
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-1">
            {hasCards ? t("reviewPreview.readyTitle") : t("reviewPreview.noCardsDue")}
          </h2>
          <p className="text-muted-foreground">
            {deckName ? `${deckName} • ` : ""}
            {hasCards
              ? t("reviewPreview.waitingForYou")
              : t("reviewPreview.caughtUpForNow")}
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {hasCards ? (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-muted/30 rounded-xl p-4 text-center border border-border">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Stack className="w-4 h-4 text-primary" />
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">
                      {selectedTimeBox ? t("reviewPreview.willReview") : t("reviewHome.totalDue")}
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-foreground">
                    {selectedTimeBox ? `~${effectiveCards}` : totalCards}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedTimeBox ? t("reviewPreview.ofCards", { count: totalCards }) : t("reviewComplete.cards")}
                  </div>
                </div>

                <div className="bg-muted/30 rounded-xl p-4 text-center border border-border">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">
                      {t("reviewComplete.duration")}
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-foreground">
                    {selectedTimeBox ? selectedTimeBox : `~${estimatedMinutes}`}
                  </div>
                  <div className="text-xs text-muted-foreground">{t("reviewPreview.minutes")}</div>
                </div>
              </div>

              {/* Card Type Breakdown */}
              <div className="bg-muted/20 rounded-xl p-4 mb-4 border border-border">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                  {t("reviewPreview.cardTypes")}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2">
                    <div className="text-lg font-bold text-green-500">{newCards}</div>
                    <div className="text-xs text-muted-foreground">{t("analytics.new")}</div>
                  </div>
                  <div className="p-2">
                    <div className="text-lg font-bold text-amber-500">{learningCards}</div>
                    <div className="text-xs text-muted-foreground">{t("analytics.learning")}</div>
                  </div>
                  <div className="p-2">
                    <div className="text-lg font-bold text-blue-500">{reviewCards}</div>
                    <div className="text-xs text-muted-foreground">{t("review.title")}</div>
                  </div>
                </div>
              </div>

              {/* Time-boxed Review Options */}
              <div className="mb-4">
                <button
                  onClick={() => setShowTimeBoxOptions(!showTimeBoxOptions)}
                  className="w-full flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Timer className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">
                      {t("reviewPreview.timeBoxedReview")}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {selectedTimeBox ? `${selectedTimeBox} min` : t("reviewPreview.optional")}
                  </span>
                </button>

                {showTimeBoxOptions && (
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {TIME_BOX_OPTIONS.map((option) => (
                      <button
                        key={option.minutes}
                        onClick={() => {
                          if (selectedTimeBox === option.minutes) {
                            setSelectedTimeBox(null);
                          } else {
                            setSelectedTimeBox(option.minutes);
                          }
                        }}
                        className={`relative p-2 rounded-lg border transition-all ${
                          selectedTimeBox === option.minutes
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background hover:bg-muted/50"
                        }`}
                      >
                        {selectedTimeBox === option.minutes && (
                          <Check className="absolute top-1 right-1 w-3 h-3 text-primary" />
                        )}
                        <div className="text-sm font-semibold text-foreground">
                          {option.label}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {t(option.descriptionKey)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tips */}
              <div className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/10 rounded-lg">
                <Brain className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-sm text-foreground">
                  <strong>{t("reviewPreview.tip")}:</strong> {t("reviewPreview.tipBody")}{" "}
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">1-4</kbd> to rate quickly.
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendUp className="w-10 h-10 text-green-500" />
              </div>
              <p className="text-muted-foreground mb-4">
                {t("reviewPreview.completedAll")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("reviewPreview.createMoreFlashcards")}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 min-h-[44px] border border-border rounded-lg text-foreground hover:bg-muted transition-colors"
          >
            {t("common.cancel")}
          </button>
          {hasCards && (
            <button
              onClick={handleStartReview}
              className="flex-1 px-4 py-2.5 min-h-[44px] bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              {selectedTimeBox ? t("reviewPreview.reviewForMinutes", { count: selectedTimeBox }) : t("dashboard.startReview")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReviewPreviewModal;
