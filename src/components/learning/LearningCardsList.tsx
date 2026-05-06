import { useState, useEffect } from "react";
import { Brain, Eye, EyeOff, Trash2, Edit, RefreshCw, Save } from "lucide-react";
import {
  getLearningItems,
  type LearningItem,
  getItemTypeName,
  getItemStateName,
  getLearningItemVersions,
  getLearningItemPrerequisites,
  revertLearningItemVersion,
  setLearningItemPrerequisites,
  updateLearningItemContentWithVersion,
} from "../../api/learning-items";
import { useReviewStore } from "../../stores/reviewStore";
import { useTabsStore } from "../../stores/tabsStore";
import { useStudyDeckStore } from "../../stores/studyDeckStore";
import { ReviewTab } from "../tabs/TabRegistry";
import { cn } from "../../utils";
import { DynamicVirtualList } from "../common/VirtualList";
import { renderAnkiHtmlWithLatex, warmAnkiLatexNormalization } from "../../utils/ankiLatex";
import { analyzeCardQuality } from "../../utils/cardQuality";
import { printFlashcards } from "../../utils/printFlashcards";
import { useToast } from "../common/Toast";
import { useI18n } from "../../lib/i18n";
import { getDocument } from "../../api/documents";

interface LearningCardsListProps {
  documentId: string;
}

export function LearningCardsList({ documentId }: LearningCardsListProps) {
  const { t } = useI18n();
  const toast = useToast();
  const [cards, setCards] = useState<LearningItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAnswers, setShowAnswers] = useState<Record<string, boolean>>({});
  const [qualityByCard, setQualityByCard] = useState<Record<string, ReturnType<typeof analyzeCardQuality>>>({});
  const [prereqByCard, setPrereqByCard] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const loadCards = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getLearningItems(documentId);
        setCards(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load cards");
      } finally {
        setIsLoading(false);
      }
    };

    loadCards();
  }, [documentId]);

  useEffect(() => {
    const loadPrerequisites = async () => {
      const entries = await Promise.all(
        cards.map(async (card) => [card.id, await getLearningItemPrerequisites(card.id)] as const)
      );
      setPrereqByCard(Object.fromEntries(entries));
    };
    if (cards.length > 0) {
      void loadPrerequisites();
    }
  }, [cards]);

  useEffect(() => {
    for (const card of cards) {
      warmAnkiLatexNormalization([card.question, card.answer, card.cloze_text]);
    }
  }, [cards]);

  const toggleAnswer = (cardId: string) => {
    setShowAnswers(prev => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  const getCardTypeColor = (itemType: LearningItem["item_type"]) => {
    switch (itemType) {
      case "Cloze":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "Qa":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "Flashcard":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 2) return "text-green-500";
    if (difficulty <= 4) return "text-yellow-500";
    return "text-red-500";
  };

  const updateCardInState = (next: LearningItem) => {
    setCards((current) => current.map((card) => (card.id === next.id ? next : card)));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">{t("learningCards.loadingCards")}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg">
        {t("learningCards.failedLoadCards")}: {error}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-12">
        <Brain className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {t("learningCards.noCardsYet")}
        </h3>
        <p className="text-muted-foreground">
          {t("learningCards.generateCardsDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0">
        <h2 className="text-2xl font-bold text-foreground">
          {t("learningCards.cards", { count: cards.length })}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => printFlashcards(cards, `Flashcards (${cards.length})`)}
            className="px-3 py-1.5 text-sm border border-border text-foreground rounded-md hover:bg-muted transition-colors"
          >
            {t("learningCards.print")}
          </button>
          <button
            onClick={async () => {
              const doc = await getDocument(documentId);
              const docTitle = doc?.title || "New Deck";
              const deckName = prompt("Deck name", docTitle);
              if (!deckName || !deckName.trim()) return;
              const allTags = new Set<string>();
              for (const card of cards) {
                for (const tag of card.tags) {
                  allTags.add(tag);
                }
              }
              useStudyDeckStore.getState().addDeck(deckName.trim(), [...allTags], documentId);
              toast.success(`Deck "${deckName.trim()}" created with ${allTags.size} tag${allTags.size !== 1 ? "s" : ""}`);
            }}
            className="px-3 py-1.5 text-sm border border-border text-foreground rounded-md hover:bg-muted transition-colors flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            {t("learningCards.saveAsDeck")}
          </button>
          <button
            onClick={async () => {
              await useReviewStore.getState().studyDocumentCards(documentId);
              const { queue } = useReviewStore.getState();
              if (queue.length > 0) {
                useTabsStore.getState().addTab({
                  title: t("learningCards.studyNow"),
                  icon: "🧠",
                  type: "review",
                  content: ReviewTab,
                  closable: true,
                });
              }
            }}
            disabled={cards.length === 0}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {t("learningCards.studyNow")}
          </button>
        </div>
      </div>

      {/* Virtual Scrolled Cards List */}
      <DynamicVirtualList
        items={cards}
        renderItem={(card) => (
          <div className="p-4 mb-4 bg-card border border-border rounded-lg hover:shadow-md transition-shadow">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" />
                <span
                  className={cn(
                    "px-2 py-0.5 text-xs rounded border",
                    getCardTypeColor(card.item_type)
                  )}
                >
                  {getItemTypeName(card.item_type)}
                </span>
                <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded">
                  {getItemStateName(card.state)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    const nextQuestion = prompt("Edit question", card.question);
                    if (nextQuestion === null || !nextQuestion.trim()) return;
                    const nextAnswer = prompt("Edit answer", card.answer || "") ?? "";
                    const reason = prompt("Reason for edit (optional)") || undefined;
                    const updated = await updateLearningItemContentWithVersion(
                      card.id,
                      nextQuestion.trim(),
                      nextAnswer.trim(),
                      reason
                    );
                    updateCardInState(updated);
                    toast.success("Card updated");
                  }}
                  className="p-1.5 rounded hover:bg-muted transition-colors"
                  title={t("learningCards.editCard")}
                >
                  <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={async () => {
                    const versions = await getLearningItemVersions(card.id);
                    if (versions.length === 0) {
                      toast.info("No revision history for this card yet.");
                      return;
                    }
                    const choices = versions
                      .slice(0, 8)
                      .map((version, index) => {
                        const date = new Date(version.timestamp).toLocaleString();
                        const reason = version.reason ? ` - ${version.reason}` : "";
                        return `${index + 1}. ${date}${reason}`;
                      })
                      .join("\n");
                    const selection = prompt(
                      `Select revision number to revert:\n${choices}`,
                      "1"
                    );
                    if (!selection) return;
                    const selected = versions[Number(selection) - 1];
                    if (!selected) return;
                    const reverted = await revertLearningItemVersion(card.id, selected.version_id);
                    updateCardInState(reverted);
                    toast.success("Card reverted to selected revision");
                  }}
                  className="px-2 py-1 text-xs rounded border border-border text-foreground hover:bg-muted"
                  title={t("learningCards.versionHistory")}
                >
                  {t("learningCards.history")}
                </button>
                <button
                  onClick={async () => {
                    const current = prereqByCard[card.id] || [];
                    const nextValue = prompt(
                      t("learningCards.prerequisites"),
                      current.join(",")
                    );
                    if (nextValue === null) return;
                    const prerequisites = nextValue
                      .split(",")
                      .map((entry) => entry.trim())
                      .filter(Boolean);
                    await setLearningItemPrerequisites(card.id, prerequisites);
                    setPrereqByCard((state) => ({ ...state, [card.id]: prerequisites }));
                    toast.success("Prerequisites updated");
                  }}
                  className="px-2 py-1 text-xs rounded border border-border text-foreground hover:bg-muted"
                  title={t("learningCards.prerequisites")}
                >
                  {t("learningCards.prereq")}
                </button>
                <button
                  onClick={() =>
                    setQualityByCard((current) => ({
                      ...current,
                      [card.id]: analyzeCardQuality(card.question || "", card.answer || ""),
                    }))
                  }
                  className="px-2 py-1 text-xs rounded border border-border text-foreground hover:bg-muted"
                  title={t("learningCards.analyzeQuality")}
                >
                  {t("learningCards.analyze")}
                </button>
                <button
                  className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                  title={t("learningCards.deleteCard")}
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            </div>

            {/* Question */}
            <div className="mb-3">
              <div className="text-xs font-medium text-muted-foreground mb-1">
                {t("learningCards.question")}
              </div>
              <div 
                className="text-foreground" 
                dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(card.question) }} 
              />
            </div>

            {/* Answer */}
            {card.answer && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    {t("learningCards.answer")}
                  </div>
                  <button
                    onClick={() => toggleAnswer(card.id)}
                    className="text-xs text-primary hover:underline"
                  >
                    {showAnswers[card.id] ? (
                      <span className="flex items-center gap-1">
                        <EyeOff className="w-3 h-3" /> {t("learningCards.hide")}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {t("learningCards.show")}
                      </span>
                    )}
                  </button>
                </div>
                {showAnswers[card.id] ? (
                  <div 
                    className="text-foreground p-3 bg-muted rounded-md" 
                    dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(card.answer) }} 
                  />
                ) : (
                  <p className="text-muted-foreground italic text-sm">
                    {t("learningCards.answerHidden")}
                  </p>
                )}
              </div>
            )}

            {/* Stats Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-border text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>
                  Due: {new Date(card.due_date).toLocaleDateString()}
                </span>
                <span className={cn("font-medium", getDifficultyColor(card.difficulty))}>
                  Difficulty: {card.difficulty}/10
                </span>
                <span>Interval: {card.interval}d</span>
                {card.review_count > 0 && (
                  <span>Reviews: {card.review_count}</span>
                )}
              </div>

              {card.ease_factor != null && card.ease_factor !== 2.5 && (
                <span className="flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  EF: {card.ease_factor.toFixed(2)}
                </span>
              )}
            </div>

            {/* Tags */}
            {card.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {card.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {prereqByCard[card.id]?.length ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Prerequisites: {prereqByCard[card.id].join(", ")}
              </p>
            ) : null}

            {qualityByCard[card.id] && (
              <div className="mt-3 rounded border border-border bg-muted/40 p-3">
                <p className="text-xs font-medium text-foreground">
                  Quality score: {qualityByCard[card.id].score}/100
                </p>
                {qualityByCard[card.id].issues.length > 0 && (
                  <p className="mt-1 text-xs text-orange-500">
                    {qualityByCard[card.id].issues[0]}
                  </p>
                )}
                {qualityByCard[card.id].suggestions.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Suggestion: {qualityByCard[card.id].suggestions[0]}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        className="flex-1"
        estimateSize={280}
      />
    </div>
  );
}
