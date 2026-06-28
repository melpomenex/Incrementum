import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Sparkle,
  SpeakerHigh,
  SpeakerSlash,
  Upload,
  WarningCircle,
} from "@phosphor-icons/react";
import { useReviewStore, type ReviewDocumentItem, type ReviewSessionItem } from "../../stores/reviewStore";
import { ReviewCard } from "./ReviewCard";
import { ReviewDocumentCard } from "./ReviewDocumentCard";
import { RatingButtons } from "./RatingButtons";
import { ReviewProgress } from "./ReviewProgress";
import { ReviewComplete } from "./ReviewComplete";
import { ReviewTransparencyPanel } from "./ReviewTransparencyPanel";
import { QueueNavigationControls } from "../queue/QueueNavigationControls";
import { ReviewRating } from "../../api/review";
import { ReviewFeedback } from "./ReviewFeedback";
import { ReviewCardSkeleton } from "../common/Skeleton";
import { FSRSExplanationModal, useFSRSExplanation } from "../onboarding/FSRSExplanationModal";
import { useSwipeGesture, getSwipeIndicatorStyle, SWIPE_RATINGS } from "../../hooks/useSwipeGesture";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { useAudioReviewMode } from "../../hooks/useAudioReviewMode";
import { useSettingsStore } from "../../stores/settingsStore";
import { BreakReminderModal, useBreakReminder } from "./BreakReminderModal";
import { ZenReviewMode } from "./ZenReviewMode";
import { FSRSInspector, useFSRSInspector } from "./FSRSInspector";
import { useToast } from "../common/Toast";
import { bulkDeleteItems, bulkSuspendItems } from "../../api/queue";
import { invokeCommand, openFilePicker } from "../../lib/tauri";
import { importAnkiPackageFromPicker } from "../../utils/ankiImport";
import { useCollectionStore } from "../../stores/collectionStore";
import { useStudyDeckStore } from "../../stores/studyDeckStore";
import { renderAnkiHtmlWithLatex } from "../../utils/ankiLatex";
import { useI18n } from "../../lib/i18n";

interface ReviewSessionProps {
  onExit: () => void;
}

function inferAnkiDeckNames(imported: unknown[]): string[] {
  const names = new Set<string>();
  for (const item of imported) {
    if (!item || typeof item !== "object") continue;
    const tagsRaw = (item as { tags?: unknown }).tags;
    if (!Array.isArray(tagsRaw)) continue;
    const tags = tagsRaw.filter((t): t is string => typeof t === "string" && t.trim().length > 0);
    if (!tags.some((tag) => tag.toLowerCase() === "anki-import")) continue;
    const deckName = tags[tags.length - 1]?.trim();
    if (deckName && deckName.toLowerCase() !== "anki-import") {
      names.add(deckName);
    }
  }
  return Array.from(names);
}

function ensureAnkiStudyDecks(deckNames: string[]): string[] {
  return useStudyDeckStore.getState().ensureDecksExist(deckNames);
}

export function ReviewSession({ onExit }: ReviewSessionProps) {
  const {
    currentCard,
    queue,
    isLoading,
    isAnswerShown,
    isSubmitting,
    error,
    reviewsCompleted,
    correctCount,
    sessionStartTime,
    averageTimePerCard,
    currentIndex,
    streak,
    previewIntervals,
    getEstimatedTimeRemaining,
    loadQueue,
    showAnswer,
    submitRating,
    nextCard,
    goToIndex,
  } = useReviewStore();
  const [isQueueListOpen, setIsQueueListOpen] = useState(false);
  const queueListRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [interactionResult, setInteractionResult] = useState<{
    interactionType: "multiple-choice" | "image-occlusion";
    correct?: boolean;
    selectedOptionId?: string;
    selectedOptionText?: string;
  } | null>(null);
  const { t } = useI18n();
  
  // Zen mode state
  const [isZenMode, setIsZenMode] = useState(false);
  const [isAnkiImporting, setIsAnkiImporting] = useState(false);
  
  // FSRS Inspector
  const { isOpen: isInspectorOpen, setIsOpen: setIsInspectorOpen } = useFSRSInspector();
  const toast = useToast();
  const haptic = useHapticFeedback();

  // FSRS explanation modal for first-time reviewers
  const { shouldShow: showFSRSExplanation, markShown: markFSRSShown } = useFSRSExplanation();

  // Swipe gestures for mobile/tablet (only when answer is shown and not submitting)
  const {
    ref: swipeRef,
    direction: swipeDirection,
    deltaX,
    deltaY,
  } = useSwipeGesture({
    onSwipeLeft: () => isAnswerShown && !isSubmitting && handleRating(1 as ReviewRating),
    onSwipeRight: () => isAnswerShown && !isSubmitting && handleRating(4 as ReviewRating),
    onSwipeUp: () => isAnswerShown && !isSubmitting && handleRating(3 as ReviewRating),
    onSwipeDown: () => isAnswerShown && !isSubmitting && handleRating(2 as ReviewRating),
    threshold: 80,
    preventDefaultTouch: true,
  });

  // Break reminder for long review sessions (30 minutes)
  const {
    showReminder: showBreakReminder,
    sessionMinutes: breakSessionMinutes,
    dismissReminder: dismissBreakReminder,
    continueAfterReminder: continueAfterBreakReminder,
  } = useBreakReminder(sessionStartTime, 30);

  const isDocumentItem = (item: ReviewSessionItem | null): item is ReviewDocumentItem =>
    !!item && (item as ReviewDocumentItem).itemType === "document";

  // Feedback state
  const [feedback, setFeedback] = useState<{
    type: "streak" | "milestone" | "complete" | "mastered" | null;
    value?: number;
  }>({ type: null });

  // Audio read-aloud review mode (hands-free TTS flow).
  const audioCard = !isDocumentItem(currentCard) ? currentCard : null;
  const audioQuestionText = audioCard
    ? (audioCard.cloze_text || audioCard.question || "").replace(/<[^>]*>/g, " ")
    : "";
  const audioAnswerText = audioCard
    ? (audioCard.answer || "").replace(/<[^>]*>/g, " ")
    : "";
  const audioReview = useAudioReviewMode({
    cardId: audioCard?.id ?? null,
    questionText: audioQuestionText,
    answerText: audioAnswerText,
    isAnswerShown,
    onFlip: () => showAnswer(),
    onAdvance: () => {
      const cfg = useSettingsStore.getState().settings.audioReviewMode;
      const rating = (cfg?.defaultRating ?? 3) as ReviewRating;
      void handleRating(rating);
    },
  });

  const handleRating = async (rating: ReviewRating) => {
    haptic.click();
    const beforeId = currentCard?.id;
    if (interactionResult) {
      useReviewStore.getState().setPendingReviewMetadata({
        hintsUsed: 0,
        interactionType: interactionResult.interactionType,
        interactionCorrect: interactionResult.correct,
      });
    }
    
    const currentStreak = streak;
    const willComplete = currentIndex >= queue.length - 1;
    
    await submitRating(rating);
    if (!beforeId) return;

    // Show feedback for milestones
    if (willComplete) {
      setFeedback({ type: "complete" });
      haptic.complete();
    } else if (currentStreak?.current_streak && currentStreak.current_streak > 0 && currentStreak.current_streak % 10 === 0) {
      setFeedback({ type: "streak", value: currentStreak.current_streak });
      haptic.streak();
    }

    const afterId = useReviewStore.getState().currentCard?.id;
    if (afterId === beforeId) {
      nextCard();
    }
  };

  const handleDeleteCurrent = async () => {
    if (!currentCard || isDocumentItem(currentCard)) {
      toast.info(t("queue.delete"), t("reviewSession.deleteOnlyLearning"));
      return;
    }
    try {
      await bulkDeleteItems([currentCard.id]);
      toast.success(t("reviewSession.cardDeleted"));
      await loadQueue();
    } catch (error) {
      toast.error(t("reviewSession.deleteFailed"), error instanceof Error ? error.message : t("reviewSession.unknownError"));
    }
  };

  const handleSuspendCurrent = async () => {
    if (!currentCard || isDocumentItem(currentCard)) {
      toast.info(t("queue.suspend"), t("reviewSession.suspendOnlyLearning"));
      return;
    }
    try {
      await bulkSuspendItems([currentCard.id]);
      toast.success(t("reviewSession.cardSuspended"));
      await loadQueue();
    } catch (error) {
      toast.error(t("reviewSession.suspendFailed"), error instanceof Error ? error.message : t("reviewSession.unknownError"));
    }
  };

  const handleImportDeck = async () => {
    if (isAnkiImporting) return;
    setIsAnkiImporting(true);
    try {
      const selected = await openFilePicker({
        title: t("reviewSession.importDeckDialogTitle"),
        multiple: false,
        filters: [{ name: t("reviewSession.deckFiles"), extensions: ["apkg", "json"] }],
      });
      if (!selected || selected.length === 0) return;

      const filePath = selected[0];
      const ext = filePath.toLowerCase().split(".").pop();

      if (ext === "json") {
        const result = await invokeCommand<{ deck_name: string; cards_imported: number }>(
          "import_study_json_file",
          { filePath, collectionId: useCollectionStore.getState().activeCollectionId }
        );
        const deckNames = [result.deck_name];
        const deckIds = ensureAnkiStudyDecks(deckNames);
        if (deckIds.length > 0) {
          useStudyDeckStore.getState().clearDeckSelection();
          useStudyDeckStore.getState().toggleDeckSelection(deckIds[0]);
        }
        await loadQueue();
        toast.success(
          t("reviewSession.deckImportComplete"),
          t("reviewSession.deckImportSummary", { cards: result.cards_imported, decks: 1 })
        );
      } else {
        const imported = await importAnkiPackageFromPicker(filePath);
        const deckNames = inferAnkiDeckNames(imported);
        const deckIds = ensureAnkiStudyDecks(deckNames);
        if (deckIds.length > 0) {
          useStudyDeckStore.getState().clearDeckSelection();
          useStudyDeckStore.getState().toggleDeckSelection(deckIds[0]);
        }
        await loadQueue();
        toast.success(
          t("reviewSession.ankiImportComplete"),
          t("reviewSession.ankiImportSummary", { cards: imported.length, decks: deckNames.length || 1 })
        );
      }
    } catch (error) {
      toast.error(
        t("reviewSession.ankiImportFailed"),
        error instanceof Error ? error.message : t("reviewSession.unknownImportError")
      );
    } finally {
      setIsAnkiImporting(false);
    }
  };

  useEffect(() => {
    setInteractionResult(null);
  }, [currentCard?.id]);

  useEffect(() => {
    if (!isQueueListOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (!queueListRef.current) return;
      if (e.target instanceof Node && queueListRef.current.contains(e.target)) {
        return;
      }
      setIsQueueListOpen(false);
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsQueueListOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isQueueListOpen]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (!containerRef.current?.contains(e.target as Node)) return;
      const mod = e.metaKey || e.ctrlKey;
      const lowerKey = e.key.toLowerCase();

      if (mod && lowerKey === "i") {
        e.preventDefault();
        setIsInspectorOpen((prev) => !prev);
        return;
      }
      if (mod && e.shiftKey && lowerKey === "z") {
        e.preventDefault();
        setIsZenMode((prev) => !prev);
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
        return;
      }

      // Space to show answer for learning items
      if (e.key === " " && !isAnswerShown && currentCard && !isDocumentItem(currentCard)) {
        e.preventDefault();
        showAnswer();
      }

      // Ctrl/Cmd + Enter to show answer
      if (mod && e.key === "Enter" && !isAnswerShown && currentCard && !isDocumentItem(currentCard)) {
        e.preventDefault();
        showAnswer();
        return;
      }

      // Ctrl/Cmd + 1/2/3/4 to rate without showing answer first
      if (mod && currentCard && !isSubmitting && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        handleRating(Number(e.key) as ReviewRating);
        return;
      }

      // Review actions that are currently placeholders in the session UI.
      if (mod && (lowerKey === "e" || lowerKey === "d" || lowerKey === "s" || lowerKey === "h")) {
        e.preventDefault();
        if (lowerKey === "e") toast.info(t("reviewSession.editUnavailable"));
        if (lowerKey === "d") void handleDeleteCurrent();
        if (lowerKey === "s") void handleSuspendCurrent();
        if (lowerKey === "h") toast.info(t("reviewSession.historyUnavailable"));
        return;
      }

      // Number keys for rating (only when answer is shown)
      if (isAnswerShown && currentCard && !isSubmitting) {
        if (e.key === "1") handleRating(1 as ReviewRating);
        if (e.key === "2") handleRating(2 as ReviewRating);
        if (e.key === "3") handleRating(3 as ReviewRating);
        if (e.key === "4") handleRating(4 as ReviewRating);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [
    isAnswerShown,
    currentCard,
    isSubmitting,
    showAnswer,
    submitRating,
    nextCard,
    onExit,
    toast,
    handleDeleteCurrent,
    handleSuspendCurrent,
  ]);

  if (isLoading) {
    return (
      <div ref={containerRef} className="flex items-center justify-center h-full p-8">
        <ReviewCardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div ref={containerRef} className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <WarningCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {t("reviewSession.errorLoading")}
          </h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={onExit}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
          >
            {t("review.backToHome")}
          </button>
        </div>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div ref={containerRef} className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-2xl font-bold text-foreground mb-2">
            {t("reviewSession.allCaughtUp")}
          </h3>
          <p className="text-muted-foreground mb-6">
            {t("review.emptyState")}
          </p>
          <button
            onClick={handleImportDeck}
            disabled={isAnkiImporting}
            className="mb-3 inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Upload className="h-4 w-4" />
            {isAnkiImporting ? t("review.importing") : t("review.importDeck")}
          </button>
          <br />
          <button
            onClick={onExit}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
          >
            {t("review.backToHome")}
          </button>
        </div>
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div ref={containerRef} className="flex flex-col items-center justify-center h-full p-6 gap-6">
        <ReviewComplete
          reviewsCompleted={reviewsCompleted}
          correctCount={correctCount}
          sessionStartTime={sessionStartTime}
          streak={streak || undefined}
        />
        <button
          onClick={onExit}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
        >
          {t("review.backToHome")}
        </button>
      </div>
    );
  }

  const estimatedSecondsRemaining = getEstimatedTimeRemaining();
  const perItemSeconds = averageTimePerCard > 0 ? averageTimePerCard : 30;
  const remainingItems = queue.length - currentIndex;
  const safeStopCount = Math.max(1, Math.min(remainingItems, Math.floor((20 * 60) / perItemSeconds)));
  const minMinutes = Math.max(1, Math.round((estimatedSecondsRemaining / 60) * 0.85));
  const maxMinutes = Math.max(1, Math.round((estimatedSecondsRemaining / 60) * 1.15));
  const isCurrentDocument = isDocumentItem(currentCard);

  if (isZenMode && !isLoading && queue.length > 0 && currentCard) {
    return (
      <ZenReviewMode onExit={() => setIsZenMode(false)} />
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto md:overflow-hidden flex flex-col p-4 md:p-6 pb-6">
      {/* Header */}
      <div className="mb-4 md:mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={onExit}
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground min-h-[44px] md:min-h-0"
          >
            <ArrowLeft className="h-4 w-4 md:h-3 md:w-3" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl md:text-3xl font-bold text-foreground">{t("review.title")}</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden md:block">
              {t("review.subtitle")}
            </p>
          </div>
        </div>

        {/* Mode Toggles & Queue Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsZenMode(!isZenMode)}
            className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
              isZenMode 
                ? "bg-primary/10 text-primary border border-primary/30" 
                : "border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
              title={isZenMode ? t("review.exitZen") : t("review.enterZen")}
          >
            <Sparkle className="w-3.5 h-3.5" />
            {t("reviewSession.zenShort")}
          </button>
          
          <button
            onClick={() => setIsInspectorOpen(!isInspectorOpen)}
            className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
              isInspectorOpen
                ? "bg-primary/10 text-primary border border-primary/30"
                : "border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            title={t("reviewSession.toggleInspector")}
          >
            <span className="font-mono text-[10px]">FSRS</span>
          </button>
          {audioReview.isSupported && (
            <button
              onClick={audioReview.toggle}
              className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                audioReview.isEnabled
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              title={audioReview.isEnabled ? "Disable audio review mode" : "Enable audio review mode (hands-free TTS)"}
            >
              {audioReview.isEnabled ? <SpeakerHigh className="w-3.5 h-3.5" /> : <SpeakerSlash className="w-3.5 h-3.5" />}
              Audio
            </button>
          )}
          <button
            onClick={handleImportDeck}
            disabled={isAnkiImporting}
            className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium bg-blue-500 text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
            title={t("reviewSession.importDeckTooltip")}
          >
            <Upload className="w-3.5 h-3.5" />
            {isAnkiImporting ? t("review.importing") : t("review.import")}
          </button>

          {queue.length > 0 && (
          <div className="relative">
            <QueueNavigationControls
              currentDocumentIndex={currentIndex}
              totalDocuments={queue.length}
              hasMoreChunks={queue.length > 0}
              onPreviousDocument={() => goToIndex(currentIndex - 1)}
              onNextDocument={() => goToIndex(currentIndex + 1)}
              onNextChunk={() => setIsQueueListOpen((prev) => !prev)}
              listButtonLabel={t("review.queue")}
              disabled={isSubmitting}
            />

            {isQueueListOpen && (
              <div
                ref={queueListRef}
                className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-lg shadow-lg z-50"
              >
                <div className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                  {t("review.queue")}
                </div>
                <div className="max-h-80 overflow-auto">
                  {queue.map((item, index) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        goToIndex(index);
                        setIsQueueListOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        index === currentIndex
                          ? "bg-muted text-foreground"
                          : "hover:bg-muted/60 text-foreground"
                      }`}
                    >
                      <div className="text-xs text-muted-foreground mb-1">
                        {index + 1} / {queue.length}
                      </div>
                      <div className="line-clamp-2">
                        {"documentTitle" in item ? (
                          item.documentTitle || t("reviewSession.untitledDocument")
                        ) : (
                          <span
                            dangerouslySetInnerHTML={{
                              __html: renderAnkiHtmlWithLatex(item.question || item.cloze_text || t("reviewSession.untitledCard")),
                            }}
                          />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 md:gap-6 flex-1 min-h-0">
        <div className="flex flex-col gap-4 md:gap-6 min-h-0">
          <div className="hidden md:flex bg-card border border-border rounded-lg p-4 flex-wrap gap-4 text-sm text-muted-foreground">
            <div>
              {t("review.timeRemaining")}: <span className="text-foreground font-semibold">{minMinutes}-{maxMinutes} min</span>
            </div>
            <div>
              {t("review.itemsRemaining")}: <span className="text-foreground font-semibold">{remainingItems}</span>
            </div>
            <div>
              {t("review.safeStopAfter")}: <span className="text-foreground font-semibold">{safeStopCount} {t("review.items")}</span>
            </div>
            <div>
              {t("review.sessionGoal")}: <span className="text-foreground font-semibold">{t("review.retentionMaintenance")}</span>
            </div>
          </div>

          {/* Progress */}
          <ReviewProgress
            currentIndex={currentIndex}
            totalCards={queue.length}
            reviewsCompleted={reviewsCompleted}
            correctCount={correctCount}
            estimatedTimeRemaining={getEstimatedTimeRemaining()}
            streak={streak}
          />

          {/* Card and Ratings */}
          <div ref={swipeRef} className="flex-1 flex flex-col min-h-0 relative touch-pan-y">
            {/* Swipe Indicator Overlay */}
            {swipeDirection && isAnswerShown && (
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 rounded-lg"
                style={getSwipeIndicatorStyle(swipeDirection, deltaX, deltaY)}
              >
                <div className="flex flex-col items-center">
                  <div className={`px-6 py-3 rounded-xl ${SWIPE_RATINGS[swipeDirection].color} text-white font-bold text-xl shadow-lg`}>
                    {SWIPE_RATINGS[swipeDirection].label}
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    {t("review.releaseToRate")}
                  </div>
                </div>
              </div>
            )}

            {isCurrentDocument ? (
              <>
                <div className="flex-1 flex items-center">
                  <ReviewDocumentCard item={currentCard as ReviewDocumentItem} />
                </div>

                <div className="flex-shrink-0 mt-4">
                  <RatingButtons
                    onSelectRating={handleRating}
                    disabled={isSubmitting}
                  />
                </div>
              </>
            ) : isAnswerShown ? (
              <>
                {/* Card with answer shown */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  <div className="min-h-full flex items-center">
                    <div className="w-full">
                  <ReviewCard
                    card={currentCard as Exclude<ReviewSessionItem, ReviewDocumentItem>}
                    showAnswer={true}
                    onShowAnswer={() => {}}
                    onInteractionResultChange={setInteractionResult}
                  />
                    </div>
                  </div>
                </div>

                {/* Rating Buttons */}
                <div className="flex-shrink-0 mt-4">
                  <RatingButtons
                    onSelectRating={handleRating}
                    disabled={isSubmitting}
                    previewIntervals={previewIntervals}
                  />
                  {/* Swipe hint for mobile */}
                  <div className="mt-3 text-center text-xs text-muted-foreground md:hidden">
                    <span className="inline-flex items-center gap-1">
                      {t("review.swipeHint")}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Card with answer hidden */}
                <div className="flex-1 flex items-center">
                  <ReviewCard
                    card={currentCard as Exclude<ReviewSessionItem, ReviewDocumentItem>}
                    showAnswer={false}
                    onShowAnswer={showAnswer}
                    onInteractionResultChange={setInteractionResult}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {!isCurrentDocument && (
            <ReviewTransparencyPanel
              card={currentCard as Exclude<ReviewSessionItem, ReviewDocumentItem>}
              previewIntervals={previewIntervals}
            />
          )}
          <div className="hidden md:block bg-card border border-border rounded-lg p-4 text-xs text-muted-foreground">
            {t("review.cutoffGuarantee", { count: safeStopCount })}
          </div>
        </div>
      </div>

      {/* Feedback Overlay */}
      <ReviewFeedback
        type={feedback.type}
        value={feedback.value}
        onClose={() => setFeedback({ type: null })}
      />

      {/* Audio review mode status pill */}
      {audioReview.isEnabled && audioReview.status !== "idle" && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-card border border-border shadow-lg flex items-center gap-2 text-sm">
          <SpeakerHigh className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-foreground">
            {audioReview.status === "speaking-question" && "Reading question…"}
            {audioReview.status === "awaiting-flip" && "Tap to reveal answer"}
            {audioReview.status === "speaking-answer" && "Reading answer…"}
            {audioReview.status === "advancing" && "Next card…"}
          </span>
          {audioReview.lastError && (
            <span className="text-xs text-destructive ml-2">{audioReview.lastError}</span>
          )}
        </div>
      )}

      {/* FSRS Explanation Modal for first-time reviewers */}
      <FSRSExplanationModal
        isOpen={showFSRSExplanation && !isLoading && queue.length > 0}
        onClose={markFSRSShown}
      />

      {/* Break Reminder Modal for long review sessions */}
      <BreakReminderModal
        isOpen={showBreakReminder}
        onClose={dismissBreakReminder}
        onContinue={continueAfterBreakReminder}
        sessionMinutes={breakSessionMinutes}
      />

      {/* FSRS Inspector Panel */}
      <FSRSInspector 
        card={currentCard as any}
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
      />
    </div>
  );
}
