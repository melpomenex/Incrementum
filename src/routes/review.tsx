import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useReviewStore } from "../stores/reviewStore";
import { ReviewCard } from "../components/review/ReviewCard";
import { RatingButtons } from "../components/review/RatingButtons";
import { ReviewProgress } from "../components/review/ReviewProgress";
import { ReviewComplete } from "../components/review/ReviewComplete";
import { ArrowCounterClockwise, ArrowSquareOut, WarningCircle } from "@phosphor-icons/react";
import { ReviewRating } from "../api/review";
import {
  evaluateTypedAnswer,
  evaluateOrdering,
  evaluateMatching,
  generateProgressiveHints,
  TypedAnswerMode,
} from "../utils/reviewInteractions";
import { gradeTypedAnswerSemantic } from "../utils/semanticGrading";
import { useSettingsStore } from "../stores/settingsStore";
import { useI18n } from "../lib/i18n";
import { requestTutorFollowUp, saveConversationalAssessment } from "../utils/conversationalReview";
import { addEnergyLog } from "../utils/energyTracker";
import { getReviewAccessibilityConfig } from "../utils/reviewAccessibility";

export function Review() {
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
    currentIndex,
    streak,
    reviewMode,
    canUndoLastReview,
    lastUndoError,
    getEstimatedTimeRemaining,
    loadQueue,
    showAnswer,
    submitRating,
    undoLastReview,
    setReviewMode,
    setPendingReviewMetadata,
    nextCard,
    resetSession,
  } = useReviewStore(useShallow(state => ({
    currentCard: state.currentCard,
    queue: state.queue,
    isLoading: state.isLoading,
    isAnswerShown: state.isAnswerShown,
    isSubmitting: state.isSubmitting,
    error: state.error,
    reviewsCompleted: state.reviewsCompleted,
    correctCount: state.correctCount,
    sessionStartTime: state.sessionStartTime,
    currentIndex: state.currentIndex,
    streak: state.streak,
    reviewMode: state.reviewMode,
    canUndoLastReview: state.canUndoLastReview,
    lastUndoError: state.lastUndoError,
    getEstimatedTimeRemaining: state.getEstimatedTimeRemaining,
    loadQueue: state.loadQueue,
    showAnswer: state.showAnswer,
    submitRating: state.submitRating,
    undoLastReview: state.undoLastReview,
    setReviewMode: state.setReviewMode,
    setPendingReviewMetadata: state.setPendingReviewMetadata,
    nextCard: state.nextCard,
    resetSession: state.resetSession,
  })));
  const [typedAnswer, setTypedAnswer] = useState("");
  const [typedFeedback, setTypedFeedback] = useState<{
    correct: boolean;
    similarity: number;
    provider?: "local" | "cloud" | "heuristic";
  } | null>(null);
  const [isCheckingSemantic, setIsCheckingSemantic] = useState(false);
  const [revealedHintCount, setRevealedHintCount] = useState(0);
  const [orderingSubmission, setOrderingSubmission] = useState<string[]>([]);
  const [orderingFeedback, setOrderingFeedback] = useState<{ correct: boolean; correctPositions: number; total: number } | null>(null);
  const [matchingSelections, setMatchingSelections] = useState<Record<string, string>>({});
  const [matchingFeedback, setMatchingFeedback] = useState<{ correct: boolean; correctPairs: number; totalPairs: number } | null>(null);
  const [handwritingCaptured, setHandwritingCaptured] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const settings = useSettingsStore((state) => state.settings);
  const { t } = useI18n();
  const [conversationInput, setConversationInput] = useState("");
  const [conversationResult, setConversationResult] = useState<{ question: string; score: number; feedback: string } | null>(null);
  const [isConversationLoading, setIsConversationLoading] = useState(false);
  const [energyLevel, setEnergyLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const isZenMode = settings.interface.reviewZenMode;
  const conversationalEnabled = settings.interface.conversationalReviewEnabled;
  const a11yConfig = getReviewAccessibilityConfig(isZenMode);

  const typedMode = useMemo(() => {
   
    const card = currentCard as any;
    if (!card || card.itemType === "document") return null;
    const metadataMode = card?.interaction_metadata?.typedMode as TypedAnswerMode | undefined;
    if (metadataMode) return metadataMode;
    const tags = (card.tags ?? []) as string[];
    if (tags.includes("typed:fuzzy")) return "fuzzy";
    if (tags.includes("typed:semantic")) return "semantic";
    if (tags.includes("typed:exact")) return "exact";
    return null;
  }, [currentCard]);
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const hintStages = useMemo(() => {
   
    const card = currentCard as any;
    if (!card || card.itemType === "document") return [];
    const fromMetadata = card?.interaction_metadata?.hints;
    if (Array.isArray(fromMetadata) && fromMetadata.length > 0) {
      return fromMetadata.map((v: unknown) => String(v));
    }
    return generateProgressiveHints(card.answer);
  }, [currentCard]);

  const acceptedAnswers = useMemo(() => {
   
    const card = currentCard as any;
    if (!card || card.itemType === "document") return [];
    const fromMetadata = card?.interaction_metadata?.acceptedAnswers;
    if (Array.isArray(fromMetadata) && fromMetadata.length > 0) {
      return fromMetadata.map((v: unknown) => String(v)).filter(Boolean);
    }
    const answer = String(card.answer ?? "").trim();
    if (!answer) return [];
    return answer.split("||").map((part: string) => part.trim()).filter(Boolean);
  }, [currentCard]);

  const interactionType = useMemo(() => {
   
    const card = currentCard as any;
    if (!card || card.itemType === "document") return null;
    const t = card?.interaction_metadata?.interactionType;
    if (t === "ordering" || t === "matching") return t;
    const tags = (card.tags ?? []) as string[];
    if (tags.includes("interaction:ordering")) return "ordering";
    if (tags.includes("interaction:matching")) return "matching";
    return null;
  }, [currentCard]);

  const orderingData = useMemo(() => {
   
    const card = currentCard as any;
    if (!card || interactionType !== "ordering") return { options: [], expected: [] };
    const options = Array.isArray(card?.interaction_metadata?.orderingItems)
      ? card.interaction_metadata.orderingItems.map((v: unknown) => String(v))
      : String(card.question ?? "")
          .split("||")
          .map((part) => part.trim())
          .filter(Boolean);
    const expected = Array.isArray(card?.interaction_metadata?.orderingAnswer)
      ? card.interaction_metadata.orderingAnswer.map((v: unknown) => String(v))
      : String(card.answer ?? "")
          .split("||")
          .map((part) => part.trim())
          .filter(Boolean);
    return { options, expected };
  }, [currentCard, interactionType]);

  const matchingData = useMemo(() => {
   
    const card = currentCard as any;
    if (!card || interactionType !== "matching") return { pairs: [] as Array<{ left: string; right: string }> };
    if (Array.isArray(card?.interaction_metadata?.matchingPairs)) {
      return {
        pairs: card.interaction_metadata.matchingPairs.map((pair: any) => ({
          left: String(pair.left),
          right: String(pair.right),
        })),
      };
    }
    const parsedPairs = String(card.answer ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [left, right] = line.split("=>").map((part) => part?.trim() ?? "");
        return { left, right };
      })
      .filter((pair) => pair.left && pair.right);
    return { pairs: parsedPairs };
  }, [currentCard, interactionType]);

  const supportsHandwriting = useMemo(() => {
   
    const card = currentCard as any;
    if (!card || card.itemType === "document") return false;
    if (card?.interaction_metadata?.handwritingEnabled) return true;
    const tags = (card.tags ?? []) as string[];
    return tags.includes("input:handwriting");
  }, [currentCard]);

  const handleRating = async (rating: ReviewRating) => {
    setPendingReviewMetadata({
      hintsUsed: revealedHintCount,
      typedMode: typedMode ?? undefined,
      typedCorrect: typedFeedback?.correct,
      typedSimilarity: typedFeedback?.similarity,
      typedProvider: typedFeedback?.provider,
      handwritingCaptured,
      interactionType: interactionType ?? undefined,
      interactionCorrect: orderingFeedback?.correct ?? matchingFeedback?.correct,
    });
    const beforeId = currentCard?.id;
    await submitRating(rating);
    if (!beforeId) return;

    const afterId = useReviewStore.getState().currentCard?.id;
    if (afterId === beforeId) {
      nextCard();
    }
  };

  const handleCheckTypedAnswer = async () => {
    if (!typedMode || acceptedAnswers.length === 0) return;
    if (typedMode === "semantic") {
   
      const card = currentCard as any;
      if (!card) return;
      setIsCheckingSemantic(true);
      try {
        const semantic = await gradeTypedAnswerSemantic({
          question: String(card.question ?? ""),
          expectedAnswer: acceptedAnswers[0] ?? "",
          userAnswer: typedAnswer,
          route: settings.ai.provider === "ollama" ? "local-first" : "cloud-first",
        });
        setTypedFeedback({
          correct: semantic.isCorrect,
          similarity: semantic.similarity,
          provider: semantic.provider,
        });
      } finally {
        setIsCheckingSemantic(false);
      }
      return;
    }
    const result = evaluateTypedAnswer(typedAnswer, acceptedAnswers, typedMode);
    setTypedFeedback({ correct: result.isCorrect, similarity: result.similarity, provider: "heuristic" });
  };

  useEffect(() => {
    loadQueue();
    return () => {
      resetSession();
    };
  }, []);

  useEffect(() => {
    setTypedAnswer("");
    setTypedFeedback(null);
    setIsCheckingSemantic(false);
    setRevealedHintCount(0);
    setOrderingSubmission([]);
    setOrderingFeedback(null);
    setMatchingSelections({});
    setMatchingFeedback(null);
    setHandwritingCaptured(false);
    setPendingReviewMetadata(null);
  }, [currentCard?.id, setPendingReviewMetadata]);

  useEffect(() => {
    if (interactionType === "ordering" && orderingData.options.length > 0) {
      setOrderingSubmission([...orderingData.options]);
    }
  }, [interactionType, orderingData.options]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("incrementum-reader-focus-mode-change", {
        detail: { active: isZenMode },
      })
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent("incrementum-reader-focus-mode-change", {
          detail: { active: false },
        })
      );
    };
  }, [isZenMode]);

  useEffect(() => {
    return () => {
      if (reviewsCompleted > 0) {
        addEnergyLog({
          energyLevel,
          retention: correctCount / Math.max(1, reviewsCompleted),
          reviewCount: reviewsCompleted,
        });
      }
    };
  }, [energyLevel, correctCount, reviewsCompleted]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Space to show answer
      if (e.key === " " && !isAnswerShown && currentCard) {
        e.preventDefault();
        showAnswer();
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
  }, [isAnswerShown, currentCard, isSubmitting, showAnswer, submitRating, nextCard]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-4xl mb-4">🔄</div>
          <div className="text-muted-foreground">{t("review.importing")}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <WarningCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {t("common.failed")}
          </h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={loadQueue}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
          >
            {t("common.retry")}
          </button>
        </div>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-2xl font-bold text-foreground mb-2">
            {t("emptyState.allCaughtUp")}
          </h3>
          <p className="text-muted-foreground mb-6">
            {t("review.emptyState")}
          </p>
        </div>
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <ReviewComplete
          reviewsCompleted={reviewsCompleted}
          correctCount={correctCount}
          sessionStartTime={sessionStartTime}
          streak={streak || undefined}
        />
      </div>
    );
  }

  const sourceAnchor = ((currentCard as any)?.source_anchor ?? null) as
    | { document_id?: string; extract_id?: string; page_number?: number }
    | null;
   
  const canJumpToSource = Boolean(sourceAnchor?.document_id || (currentCard as any)?.document_id || (currentCard as any)?.extract_id);

  return (
    <div
      role={a11yConfig.rootRole}
      aria-label={a11yConfig.rootAriaLabel}
      className={`h-full flex flex-col ${isZenMode ? "p-3 md:p-4" : "p-6"}`}
    >
      {/* Header */}
      {!isZenMode && <div className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("review.title")}</h1>
            <p className="text-muted-foreground">
          {t("review.subtitle")}
            </p>
          </div>
          <button
            onClick={() => void undoLastReview()}
            disabled={!canUndoLastReview || isSubmitting}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowCounterClockwise className="w-4 h-4" />
            {t("review.undo")}
          </button>
          <button
            onClick={() => {
              const detail = {
   
                documentId: sourceAnchor?.document_id ?? (currentCard as any)?.document_id,
   
                extractId: sourceAnchor?.extract_id ?? (currentCard as any)?.extract_id,
                pageNumber: sourceAnchor?.page_number,
              };
              window.dispatchEvent(new CustomEvent("incrementum:source-jump", { detail }));
            }}
            disabled={!canJumpToSource}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowSquareOut className="w-4 h-4" />
            {t("review.sourceJump")}
          </button>
        </div>
        <div className="mt-3 inline-flex rounded-md border border-border overflow-hidden">
          <button
            onClick={() => setReviewMode("normal")}
            className={`px-3 py-1.5 text-sm ${reviewMode === "normal" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted"}`}
          >
            {t("review.normal")}
          </button>
          <button
            onClick={() => setReviewMode("cram")}
            className={`px-3 py-1.5 text-sm ${reviewMode === "cram" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted"}`}
          >
            {t("review.cram")}
          </button>
        </div>
        {reviewMode === "cram" && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("reviewLegacy.cramNoSchedule")}
          </p>
        )}
        {lastUndoError && <p className="mt-2 text-xs text-destructive">{lastUndoError}</p>}
        <div className="mt-3 flex items-center gap-2">
          <label className="text-xs text-muted-foreground">{t("reviewLegacy.energy")}</label>
          <select
            value={energyLevel}
            onChange={(event) => setEnergyLevel(Number(event.target.value) as 1 | 2 | 3 | 4 | 5)}
            className="rounded border border-border bg-background px-2 py-1 text-xs"
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
            <option value={5}>5</option>
          </select>
        </div>
      </div>}

      {/* Progress */}
      {!isZenMode && <ReviewProgress
        currentIndex={currentIndex}
        totalCards={queue.length}
        reviewsCompleted={reviewsCompleted}
        correctCount={correctCount}
        estimatedTimeRemaining={getEstimatedTimeRemaining()}
        streak={streak}
      />}

      {/* Card and Ratings */}
      <div className="flex-1 flex flex-col justify-center">
        {isAnswerShown ? (
          <>
            {/* Card with answer shown */}
            <ReviewCard
   
              card={currentCard as any}
              showAnswer={true}
              onShowAnswer={() => {}}
            />

            {/* Rating Buttons */}
            <div className="mt-6">
              <RatingButtons
                onSelectRating={handleRating}
                disabled={isSubmitting}
                previewIntervals={null} // TODO: Add preview intervals
              />
            </div>
          </>
        ) : (
          <>
            {/* Card with answer hidden */}
            <ReviewCard
   
              card={currentCard as any}
              showAnswer={false}
              onShowAnswer={showAnswer}
            />
            {typedMode && (
              <div className="mt-4 rounded-lg border border-border bg-card p-4">
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t("review.answer")} ({typedMode})
                </label>
                <div className="flex gap-2">
                  <input
                    value={typedAnswer}
                    onChange={(e) => setTypedAnswer(e.target.value)}
                    placeholder={t("review.answer")}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                  <button
                    onClick={() => void handleCheckTypedAnswer()}
                    className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
                  >
                    {isCheckingSemantic ? t("common.loading") : t("common.confirm")}
                  </button>
                </div>
                {typedFeedback && (
                  <p className={`mt-2 text-sm ${typedFeedback.correct ? "text-green-500" : "text-orange-500"}`}>
                    {typedFeedback.correct ? t("reviewLegacy.looksCorrect") : t("reviewLegacy.notQuite")} {t("reviewLegacy.similarity")}{" "}
                    {Math.round(typedFeedback.similarity * 100)}%
                    {typedFeedback.provider ? ` (${typedFeedback.provider})` : ""}
                  </p>
                )}
              </div>
            )}
            {interactionType === "ordering" && orderingData.expected.length > 0 && (
              <div className="mt-4 rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-medium text-foreground mb-2">{t("reviewLegacy.ordering")}</p>
                <div className="space-y-2">
                  {orderingSubmission.map((item, index) => (
                    <div key={`${item}-${index}`} className="flex items-center gap-2">
                      <span className="w-6 text-xs text-muted-foreground">{index + 1}.</span>
                      <div className="flex-1 rounded bg-muted/60 px-3 py-2 text-sm text-foreground">{item}</div>
                      <button
                        onClick={() =>
                          setOrderingSubmission((current) => {
                            if (index === 0) return current;
                            const next = [...current];
                            [next[index - 1], next[index]] = [next[index], next[index - 1]];
                            return next;
                          })
                        }
                        className="rounded border border-border px-2 py-1 text-xs"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() =>
                          setOrderingSubmission((current) => {
                            if (index === current.length - 1) return current;
                            const next = [...current];
                            [next[index + 1], next[index]] = [next[index], next[index + 1]];
                            return next;
                          })
                        }
                        className="rounded border border-border px-2 py-1 text-xs"
                      >
                        ↓
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const result = evaluateOrdering(orderingSubmission, orderingData.expected);
                      setOrderingFeedback({
                        correct: result.isCorrect,
                        correctPositions: result.correctPositions,
                        total: result.total,
                      });
                    }}
                    className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
                  >
                    {t("reviewLegacy.checkOrder")}
                  </button>
                  {orderingFeedback && (
                    <p className={`text-sm ${orderingFeedback.correct ? "text-green-500" : "text-orange-500"}`}>
                      {orderingFeedback.correct
                        ? t("reviewLegacy.orderCorrect")
                        : t("reviewLegacy.positionsCorrect", { correct: orderingFeedback.correctPositions, total: orderingFeedback.total })}
                    </p>
                  )}
                </div>
              </div>
            )}
            {interactionType === "matching" && matchingData.pairs.length > 0 && (
              <div className="mt-4 rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-medium text-foreground mb-2">{t("reviewLegacy.matching")}</p>
                <div className="space-y-2">
                  {matchingData.pairs.map((pair) => (
                    <div key={pair.left} className="grid grid-cols-2 gap-2 items-center">
                      <div className="rounded bg-muted/60 px-3 py-2 text-sm text-foreground">{pair.left}</div>
                      <select
                        value={matchingSelections[pair.left] ?? ""}
                        onChange={(e) =>
                          setMatchingSelections((current) => ({
                            ...current,
                            [pair.left]: e.target.value,
                          }))
                        }
                        className="rounded border border-border bg-background px-2 py-2 text-sm"
                      >
                        <option value="">{t("reviewLegacy.selectMatch")}</option>
                        {matchingData.pairs.map((option) => (
                          <option key={`${pair.left}-${option.right}`} value={option.right}>
                            {option.right}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const submitted = matchingData.pairs.map((pair) => ({
                        left: pair.left,
                        right: matchingSelections[pair.left] ?? "",
                      }));
                      const result = evaluateMatching(submitted, matchingData.pairs);
                      setMatchingFeedback({
                        correct: result.isCorrect,
                        correctPairs: result.correctPairs,
                        totalPairs: result.totalPairs,
                      });
                    }}
                    className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
                  >
                    {t("reviewLegacy.checkMatches")}
                  </button>
                  {matchingFeedback && (
                    <p className={`text-sm ${matchingFeedback.correct ? "text-green-500" : "text-orange-500"}`}>
                      {matchingFeedback.correct
                        ? t("reviewLegacy.allMatchesCorrect")
                        : t("reviewLegacy.matchesCorrect", { correct: matchingFeedback.correctPairs, total: matchingFeedback.totalPairs })}
                    </p>
                  )}
                </div>
              </div>
            )}
            {supportsHandwriting && (
              <div className="mt-4 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{t("review.question")}</p>
                  <button
                    onClick={() => {
                      const canvas = canvasRef.current;
                      if (!canvas) return;
                      const ctx = canvas.getContext("2d");
                      if (!ctx) return;
                      ctx.clearRect(0, 0, canvas.width, canvas.height);
                      setHandwritingCaptured(false);
                    }}
                    className="rounded border border-border px-2 py-1 text-xs"
                  >
                    {t("common.clear")}
                  </button>
                </div>
                <canvas
                  ref={canvasRef}
                  width={720}
                  height={200}
                  className="mt-2 w-full rounded border border-border bg-background touch-none"
                  onPointerDown={(event) => {
                    const canvas = canvasRef.current;
                    if (!canvas) return;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return;
                    isDrawingRef.current = true;
                    ctx.strokeStyle = "#2563eb";
                    ctx.lineWidth = 2;
                    ctx.lineCap = "round";
                    const rect = canvas.getBoundingClientRect();
                    ctx.beginPath();
                    ctx.moveTo(event.clientX - rect.left, event.clientY - rect.top);
                    setHandwritingCaptured(true);
                  }}
                  onPointerMove={(event) => {
                    if (!isDrawingRef.current) return;
                    const canvas = canvasRef.current;
                    if (!canvas) return;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return;
                    const rect = canvas.getBoundingClientRect();
                    ctx.lineTo(event.clientX - rect.left, event.clientY - rect.top);
                    ctx.stroke();
                  }}
                  onPointerUp={() => {
                    isDrawingRef.current = false;
                  }}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {handwritingCaptured ? t("reviewLegacy.canvasCaptured") : t("reviewLegacy.writeBeforeReveal")}
                </p>
              </div>
            )}
            {hintStages.length > 0 && (
              <div className="mt-4 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{t("reviewLegacy.hints")}</p>
                  <button
                    onClick={() => setRevealedHintCount((count) => Math.min(count + 1, hintStages.length))}
                    disabled={revealedHintCount >= hintStages.length}
                    className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground disabled:opacity-50"
                  >
                    {t("reviewLegacy.revealHint", { count: Math.min(revealedHintCount + 1, hintStages.length) })}
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {hintStages.slice(0, revealedHintCount).map((hint, index) => (
                    <p key={`${index}-${hint}`} className="rounded bg-muted/60 px-3 py-2 text-sm text-foreground">
                      {t("reviewLegacy.hintNumber", { count: index + 1 })}: {hint}
                    </p>
                  ))}
                  {revealedHintCount === 0 && (
                    <p className="text-xs text-muted-foreground">{t("reviewLegacy.noHints")}</p>
                  )}
                </div>
              </div>
            )}
            {conversationalEnabled && (
              <div className="mt-4 rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-medium text-foreground mb-2">{t("reviewLegacy.conversationalReview")}</p>
                <div className="flex gap-2">
                  <input
                    value={conversationInput}
                    onChange={(event) => setConversationInput(event.target.value)}
                    placeholder={t("reviewLegacy.explainOwnWords")}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                  <button
                    disabled={!conversationInput.trim() || isConversationLoading}
                    onClick={async () => {
                      setIsConversationLoading(true);
                      try {
   
                        const topic = `${(currentCard as any)?.question || ""}\n${(currentCard as any)?.answer || ""}`;
                        const result = await requestTutorFollowUp(topic, conversationInput.trim());
                        setConversationResult(result);
                        saveConversationalAssessment({
                          id: crypto.randomUUID(),
   
                          itemId: String((currentCard as any)?.id || ""),
                          timestamp: new Date().toISOString(),
                          userResponse: conversationInput.trim(),
                          followUpQuestion: result.question,
                          score: result.score,
                          feedback: result.feedback,
                        });
                      } finally {
                        setIsConversationLoading(false);
                      }
                    }}
                    className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
                  >
                    {isConversationLoading ? t("reviewLegacy.thinking") : t("reviewLegacy.tutor")}
                  </button>
                </div>
                {conversationResult && (
                  <div className="mt-3 rounded bg-muted/60 p-3">
                    <p className="text-sm text-foreground">{t("reviewLegacy.followUp")}: {conversationResult.question}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("reviewLegacy.score")}: {conversationResult.score}/100 • {conversationResult.feedback}
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
