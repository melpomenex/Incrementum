import React, { useEffect, useMemo, useState } from "react";
import { LearningItem } from "../../api/review";
import { Brain, FileText, Volume2, VolumeX, Pause, Play } from "lucide-react";
import { useTTS } from "../../hooks/useTTS";
import { renderAnkiHtmlWithLatex, warmAnkiLatexNormalization } from "../../utils/ankiLatex";
import { getImageAssetById } from "../../api/image-registry";
import { useI18n } from "../../lib/i18n";
import type {
  ImageOcclusionRegion,
  LearningItemInteractionMetadata,
  MultipleChoiceOption,
} from "../../types/learningItemInteractions";

interface ReviewCardProps {
  card: LearningItem;
  showAnswer: boolean;
  onShowAnswer: () => void;
  onInteractionResultChange?: (result: {
    interactionType: "multiple-choice" | "image-occlusion";
    correct?: boolean;
    selectedOptionId?: string;
    selectedOptionText?: string;
  } | null) => void;
}

export const ReviewCard = React.memo(function ReviewCard({
  card,
  showAnswer,
  onShowAnswer,
  onInteractionResultChange,
}: ReviewCardProps) {
  const { speak, stop, isSpeaking, isPaused, pause, resume, isSupported } = useTTS();
  const { t } = useI18n();
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);

  useEffect(() => {
    warmAnkiLatexNormalization([card.question, card.answer, card.cloze_text]);
  }, [card.question, card.answer, card.cloze_text]);

  useEffect(() => {
    let isCancelled = false;
    const imageAssetIds = Array.isArray((card as any).image_asset_ids) ? (card as any).image_asset_ids as string[] : [];

    if (imageAssetIds.length === 0) {
      setImageUrls([]);
      return;
    }

    const load = async () => {
      const assets = await Promise.all(imageAssetIds.map((assetId) => getImageAssetById(assetId)));
      if (isCancelled) return;
      setImageUrls(
        assets
          .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset))
          .map((asset) => asset.data_url)
      );
    };

    void load();
    return () => {
      isCancelled = true;
    };
  }, [card.id, (card as any).image_asset_ids]);

  useEffect(() => {
    setSelectedChoiceId(null);
    onInteractionResultChange?.(null);
  }, [card.id, onInteractionResultChange]);

  // Helper to get item type - handles both snake_case and camelCase from different backends
  const getItemType = (): string => {
    const item = card as any;
    return item.item_type || item.itemType || "flashcard";
  };

  const getItemIcon = (itemType: string) => {
    switch (itemType?.toLowerCase()) {
      case "cloze":
        return "📝";
      case "qa":
        return "❓";
      case "flashcard":
        return "🎴";
      default:
        return "📚";
    }
  };

  const getItemTypeLabel = (itemType: string) => {
    switch (itemType?.toLowerCase()) {
      case "cloze":
        return "Cloze Deletion";
      case "qa":
        return "Question & Answer";
      case "flashcard":
        return "Flashcard";
      default:
        return "Learning Item";
    }
  };

  const itemType = getItemType();

  const getPlainText = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
  };

  const handleSpeak = (text: string) => {
    if (isSpeaking) {
      if (isPaused) {
        resume();
      } else {
        pause();
      }
    } else {
      speak(text);
    }
  };

  const handleStop = () => {
    stop();
  };

  const questionText = getPlainText(card.question);
  const answerText = card.answer ? getPlainText(card.answer) : "";
  const questionHtml = useMemo(() => renderAnkiHtmlWithLatex(card.question || ""), [card.question]);
  const answerHtml = useMemo(() => renderAnkiHtmlWithLatex(card.answer || ""), [card.answer]);
  const interactionMetadata = ((card as any)?.interaction_metadata ?? {}) as LearningItemInteractionMetadata;
  const audioQuestionUrl = interactionMetadata?.audioQuestionUrl || interactionMetadata?.audio_question_url;
  const audioAnswerUrl = interactionMetadata?.audioAnswerUrl || interactionMetadata?.audio_answer_url;

  const multipleChoiceOptions = useMemo(() => {
    const raw = interactionMetadata.multipleChoiceOptions;
    if (!Array.isArray(raw) || raw.length === 0) return [];

    return raw.map((entry, index): Required<Pick<MultipleChoiceOption, "text">> & MultipleChoiceOption => {
      if (typeof entry === "string") {
        return {
          id: `choice-${index + 1}`,
          text: entry,
          isCorrect: interactionMetadata.multipleChoiceCorrectOptionId === `choice-${index + 1}`,
        };
      }
      const id = entry.id || `choice-${index + 1}`;
      return {
        ...entry,
        id,
        text: entry.text,
        isCorrect:
          entry.isCorrect ??
          (interactionMetadata.multipleChoiceCorrectOptionId
            ? interactionMetadata.multipleChoiceCorrectOptionId === id
            : false),
      };
    });
  }, [interactionMetadata]);

  const imageOcclusionRegions = useMemo(() => {
    if (!Array.isArray(interactionMetadata.imageOcclusionRegions)) return [];
    return interactionMetadata.imageOcclusionRegions.filter((region): region is ImageOcclusionRegion => {
      return (
        typeof region?.x === "number" &&
        typeof region?.y === "number" &&
        typeof region?.width === "number" &&
        typeof region?.height === "number"
      );
    });
  }, [interactionMetadata.imageOcclusionRegions]);

  const isMultipleChoiceCard = multipleChoiceOptions.length > 0;
  const isImageOcclusionCard = imageOcclusionRegions.length > 0 && imageUrls.length > 0;

  useEffect(() => {
    if (isImageOcclusionCard) {
      onInteractionResultChange?.({ interactionType: "image-occlusion" });
    }
  }, [isImageOcclusionCard, onInteractionResultChange]);

  const normalizeMetric = (value: number) => (value <= 1 ? value * 100 : value);

  const handleSelectChoice = (option: Required<Pick<MultipleChoiceOption, "text">> & MultipleChoiceOption) => {
    setSelectedChoiceId(option.id || null);
    onInteractionResultChange?.({
      interactionType: "multiple-choice",
      correct: Boolean(option.isCorrect),
      selectedOptionId: option.id,
      selectedOptionText: option.text,
    });
    if (!showAnswer) {
      onShowAnswer();
    }
  };

  const renderQuestion = () => {
    if ((itemType === "cloze" || itemType === "Cloze") && card.cloze_text) {
      // Range-based cloze rendering (preferred when ranges are available)
      if (card.cloze_ranges && card.cloze_ranges.length > 0) {
        const text = card.cloze_text as string;
        const ranges = card.cloze_ranges as [number, number][];
        let lastIndex = 0;
        const parts: React.ReactNode[] = [];

        ranges.forEach(([start, end], index) => {
          if (start > lastIndex) {
            parts.push(
              <span
                key={`text-${index}`}
                dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(text.slice(lastIndex, start)) }}
              />
            );
          }
          const clozeContent = text.slice(start, end);
          if (showAnswer) {
            parts.push(
              <span
                key={`cloze-${index}`}
                className="bg-primary/20 px-1 rounded font-semibold"
                dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(clozeContent) }}
              />
            );
          } else {
            parts.push(
              <span key={`cloze-${index}`} className="bg-muted px-2 py-0.5 rounded text-foreground font-bold border border-border/50">
                [...]
              </span>
            );
          }
          lastIndex = end;
        });

        if (lastIndex < text.length) {
          parts.push(
            <span
              key="text-end"
              dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(text.slice(lastIndex)) }}
            />
          );
        }

        return (
          <div className="text-lg leading-relaxed text-foreground">
            {parts}
          </div>
        );
      }

      // Fallback: regex-based cloze rendering for {{cN::content}} or [[cN::content]] markers
      // (AI-generated cloze cards use {{c1::text}} syntax)
      const rawClozePattern = /\{\{c(\d+)::(.+?)(?:::(.+?))?\}\}/g;
      const hasRawCloze = rawClozePattern.test(card.cloze_text);
      // Reset regex lastIndex since test() advances it
      rawClozePattern.lastIndex = 0;

      if (hasRawCloze) {
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match;
        while ((match = rawClozePattern.exec(card.cloze_text)) !== null) {
          if (match.index > lastIndex) {
            parts.push(
              <span key={`t-${parts.length}`} dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(card.cloze_text.slice(lastIndex, match.index)) }} />
            );
          }
          if (showAnswer) {
            parts.push(
              <span key={`c-${parts.length}`} className="bg-primary/20 px-1 rounded font-semibold" dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(match[2]) }} />
            );
          } else {
            const hint = match[3];
            parts.push(
              <span key={`c-${parts.length}`} className="bg-muted px-2 py-0.5 rounded text-foreground font-bold border border-border/50">
                {hint || "[...]"}
              </span>
            );
          }
          lastIndex = match.index + match[0].length;
        }
        if (lastIndex < card.cloze_text.length) {
          parts.push(
            <span key={`t-end`} dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(card.cloze_text.slice(lastIndex)) }} />
          );
        }
        return (
          <div className="text-lg leading-relaxed text-foreground">
            {parts}
          </div>
        );
      }

      const parts = card.cloze_text.split(/\[\[c(\d+)::(.*?)\]\]/g);
      return (
        <div className="text-lg leading-relaxed text-foreground">
          {parts.map((part, idx) => {
            if (idx % 3 === 1) return null; // Skip the index
            if (idx % 3 === 2) {
              // This is the clozed content
              if (showAnswer) {
                return (
                  <span
                    key={idx}
                    className="bg-primary/20 px-1 rounded font-semibold"
                    dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(part) }}
                  />
                );
              }
              return (
                <span key={idx} className="bg-muted px-2 py-0.5 rounded text-foreground font-bold border border-border/50">
                  [...]
                </span>
              );
            }
            return <span key={idx} dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(part) }} />;
          })}
        </div>
      );
    }

    return (
      <div className="text-base md:text-lg leading-relaxed text-foreground">
        <span dangerouslySetInnerHTML={{ __html: questionHtml }} />
      </div>
    );
  };

  const renderMultipleChoice = () => {
    if (!isMultipleChoiceCard) return null;

    return (
      <div className="mt-5 space-y-3">
        <div className="text-sm uppercase tracking-wide text-foreground/80 font-medium">
          {t("review.chooseAnswer")}
        </div>
        <div className="grid gap-3">
          {multipleChoiceOptions.map((option) => {
            const isSelected = selectedChoiceId === option.id;
            const isCorrect = Boolean(option.isCorrect);
            const tone = showAnswer
              ? isCorrect
                ? "border-green-500/60 bg-green-500/10 text-foreground"
                : isSelected
                ? "border-red-500/60 bg-red-500/10 text-foreground"
                : "border-border bg-background text-foreground"
              : isSelected
              ? "border-blue-500/60 bg-blue-500/10 text-foreground"
              : "border-border bg-background text-foreground hover:bg-muted";

            return (
              <button
                key={option.id}
                type="button"
                disabled={showAnswer}
                onClick={() => handleSelectChoice(option)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${tone}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm md:text-base">{option.text}</span>
                  {showAnswer && isCorrect && (
                    <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                      {t("review.correctChoice")}
                    </span>
                  )}
                </div>
                {showAnswer && isSelected && option.feedback && (
                  <div className="mt-2 text-xs text-muted-foreground">{option.feedback}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderImageOcclusion = () => {
    if (!isImageOcclusionCard) return null;

    const imageIndex = Math.max(
      0,
      imageUrls.findIndex((_, index) => {
        const expectedAssetId = interactionMetadata.imageOcclusionAssetId;
        const cardAssetIds = Array.isArray((card as any).image_asset_ids) ? (card as any).image_asset_ids as string[] : [];
        return expectedAssetId ? cardAssetIds[index] === expectedAssetId : index === 0;
      })
    );

    return (
      <div className="mt-5">
        {interactionMetadata.imageOcclusionPrompt && (
          <div className="mb-3 text-sm text-muted-foreground">
            {interactionMetadata.imageOcclusionPrompt}
          </div>
        )}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/20">
          <img
            src={imageUrls[imageIndex]}
            alt={t("review.imageOcclusionAlt")}
            className="w-full object-contain"
          />
          {!showAnswer &&
            imageOcclusionRegions.map((region) => (
              <div
                key={region.id || `${region.x}-${region.y}-${region.width}-${region.height}`}
                className="absolute rounded-md border border-white/30 bg-slate-950/85 shadow-sm"
                style={{
                  left: `${normalizeMetric(region.x)}%`,
                  top: `${normalizeMetric(region.y)}%`,
                  width: `${normalizeMetric(region.width)}%`,
                  height: `${normalizeMetric(region.height)}%`,
                  backgroundColor: region.color || "rgba(15, 23, 42, 0.88)",
                }}
              />
            ))}
        </div>
      </div>
    );
  };

  const renderAnswer = () => {
    if (!showAnswer || !card.answer) return null;

    return (
      <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs md:text-sm uppercase tracking-wide text-foreground/80 font-medium">
            {t("review.answer")}
          </div>
          {/* TTS Button for Answer */}
          {isSupported && (
            <button
              onClick={() => handleSpeak(answerText)}
              className={`p-2 rounded-lg transition-colors ${
                isSpeaking
                  ? "bg-primary/20 text-primary"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
              title={isSpeaking ? (isPaused ? "Resume" : "Pause") : "Read answer aloud"}
              aria-label={isSpeaking ? (isPaused ? "Resume reading" : "Pause reading") : "Read answer aloud"}
            >
              {isSpeaking ? (
                isPaused ? (
                  <Play className="w-4 h-4" />
                ) : (
                  <Pause className="w-4 h-4" />
                )
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
        <div className="text-sm md:text-base leading-relaxed text-foreground">
          <span dangerouslySetInnerHTML={{ __html: answerHtml }} />
        </div>
        {isMultipleChoiceCard && interactionMetadata.multipleChoiceExplanation && (
          <div className="mt-3 text-sm text-muted-foreground">
            {interactionMetadata.multipleChoiceExplanation}
          </div>
        )}
        {audioAnswerUrl && (
          <div className="mt-3">
            <audio controls preload="none" src={audioAnswerUrl} className="w-full" />
          </div>
        )}
      </div>
    );
  };

  return (
    <article className="w-full max-w-2xl mx-auto px-2 md:px-0" aria-label={`${getItemTypeLabel(itemType)} card`}>
      {/* Card Type Badge */}
      <div className="flex items-center gap-2 mb-3 md:mb-4">
        <span className="text-xl md:text-2xl" aria-hidden="true">{getItemIcon(itemType)}</span>
        <span className="text-xs md:text-sm uppercase tracking-wide text-foreground/80 font-medium">
          {getItemTypeLabel(itemType)}
        </span>
        {card.tags.length > 0 && (
          <>
            <span className="text-foreground/60" aria-hidden="true">•</span>
            {card.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs bg-muted/60 text-foreground border border-border/50 rounded"
              >
                {tag}
              </span>
            ))}
          </>
        )}
        {/* TTS Controls for Question */}
        {isSupported && (
          <div className="ml-auto flex items-center gap-1">
            {isSpeaking && (
              <button
                onClick={handleStop}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Stop reading"
                aria-label="Stop reading"
              >
                <VolumeX className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => handleSpeak(questionText)}
              className={`p-1.5 rounded-lg transition-colors ${
                isSpeaking && !isPaused
                  ? "bg-primary/20 text-primary"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
              title={isSpeaking ? (isPaused ? "Resume" : "Pause") : "Read question aloud"}
              aria-label={isSpeaking ? (isPaused ? "Resume reading" : "Pause reading") : "Read question aloud"}
            >
              {isSpeaking ? (
                isPaused ? (
                  <Play className="w-4 h-4" />
                ) : (
                  <Pause className="w-4 h-4" />
                )
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Card Content with Animation */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm transition-all duration-300">
        {/* Question */}
        <div className="mb-2">
          <div className="text-sm uppercase tracking-wide text-foreground/80 mb-3 font-medium">
            {(itemType === "cloze" || itemType === "Cloze")
              ? t("review.completeSentence")
              : t("review.question")}
          </div>
          {renderQuestion()}
          {renderImageOcclusion()}
          {renderMultipleChoice()}
          {audioQuestionUrl && (
            <div className="mt-3">
              <audio controls preload="none" src={audioQuestionUrl} className="w-full" />
            </div>
          )}
        </div>

        {/* Answer (shown when revealed) with fade-in animation */}
        {showAnswer && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {renderAnswer()}

            {/* Card Stats */}
            <div className="mt-6 pt-4 border-t border-border">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Brain className="w-4 h-4" />
                    <span>Reviewed {card.review_count}x</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="w-4 h-4" />
                    <span>Interval: {card.interval}d</span>
                  </div>
                </div>
                {card.state === "new" && (
                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded text-xs">
                    New
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Show Answer Button */}
      {!showAnswer && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={onShowAnswer}
            className="px-8 py-3 min-h-[52px] bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-all hover:scale-105 active:scale-95 font-medium text-lg shadow-md focus-visible:ring-4 focus-visible:ring-blue-500/30 focus-visible:outline-none"
            aria-label="Show answer"
            autoFocus
          >
            {t("review.showAnswer")}
            <span className="sr-only">Press space to show</span>
          </button>
        </div>
      )}
    </article>
  );
});
