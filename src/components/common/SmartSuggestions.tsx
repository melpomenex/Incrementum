/**
 * Smart Suggestions Component
 * Analyzes highlights/extracts and suggests actions like creating flashcards
 */

import { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  Zap,
  X,
  BookOpen,
  Target,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { getExtracts, type Extract } from "../../api/extracts";
import { useI18n } from "../../lib/i18n";

interface SmartSuggestion {
  id: string;
  type: "flashcards" | "review" | "tags" | "related";
  title: string;
  description: string;
  count: number;
  action: () => void;
  actionLabel: string;
  icon: typeof Sparkles;
  color: string;
  bgColor: string;
}

interface SmartSuggestionsProps {
  onCreateFlashcards?: (extracts: Extract[]) => void;
  onStartReview?: () => void;
  onAddTags?: () => void;
  onViewRelated?: () => void;
  className?: string;
}

export function SmartSuggestions({
  onCreateFlashcards,
  onStartReview,
  className = "",
}: SmartSuggestionsProps) {
  const { t } = useI18n();
  const [extracts, setExtracts] = useState<Extract[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadExtracts();
  }, []);

  const loadExtracts = async () => {
    setLoading(true);
    try {
      const allExtracts = await getExtracts("");
      // Filter extracts that don't have flashcards yet (no learning_items)
      // For now, show all recent extracts as suggestions
      const recentExtracts = allExtracts
        .filter((e) => !e.document_id) // Browser extracts
        .sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime())
        .slice(0, 10);
      setExtracts(recentExtracts);
    } catch (error) {
      console.error("Failed to load extracts:", error);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = useMemo<SmartSuggestion[]>(() => {
    const result: SmartSuggestion[] = [];

    // Suggestion 1: Create flashcards from unprocessed extracts
    const unprocessedCount = extracts.length;
    if (unprocessedCount > 0 && !dismissed.has("flashcards")) {
      result.push({
        id: "flashcards",
        type: "flashcards",
        title: t("smartSuggestions.createFlashcards"),
        description: t("smartSuggestions.extractsReady", { count: unprocessedCount }),
        count: unprocessedCount,
        action: async () => {
          if (onCreateFlashcards) {
            setIsCreating(true);
            try {
              onCreateFlashcards(extracts);
            } finally {
              setIsCreating(false);
            }
          }
        },
        actionLabel: isCreating ? t("smartSuggestions.creating") : t("smartSuggestions.createNow"),
        icon: Zap,
        color: "text-amber-500",
        bgColor: "bg-amber-500/10",
      });
    }

    // Suggestion 2: Review due cards
    if (!dismissed.has("review")) {
      result.push({
        id: "review",
        type: "review",
        title: t("smartSuggestions.reviewYourCards"),
        description: t("smartSuggestions.reviewDescription"),
        count: 0,
        action: () => onStartReview?.(),
        actionLabel: t("smartSuggestions.startReview"),
        icon: Target,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
      });
    }

    return result;
  }, [extracts, dismissed, onCreateFlashcards, onStartReview, isCreating]);

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
  };

  if (loading || suggestions.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {suggestions.map((suggestion) => {
        const Icon = suggestion.icon;
        return (
          <div
            key={suggestion.id}
            className={`relative p-4 ${suggestion.bgColor} border border-current/20 rounded-xl transition-all hover:shadow-md`}
          >
            <button
              onClick={() => handleDismiss(suggestion.id)}
              className="absolute top-2 right-2 p-1 hover:bg-black/10 rounded-full transition-colors"
              aria-label={t("smartSuggestions.dismissSuggestion")}
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>

            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${suggestion.bgColor}`}>
                <Icon className={`w-5 h-5 ${suggestion.color}`} />
              </div>

              <div className="flex-1 min-w-0 pr-6">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-foreground">{suggestion.title}</h4>
                  <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                    {t("smartSuggestions.suggested")}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{suggestion.description}</p>

                {suggestion.type === "flashcards" && extracts.length > 0 && (
                  <div className="mb-3">
                    <div className="flex flex-wrap gap-2">
                      {extracts.slice(0, 3).map((extract) => (
                        <div
                          key={extract.id}
                          className="flex items-center gap-1 px-2 py-1 bg-background border border-border rounded-md text-xs text-muted-foreground max-w-[200px]"
                        >
                          <BookOpen className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">
                            {extract.page_title || extract.content.slice(0, 30) + "..."}
                          </span>
                        </div>
                      ))}
                      {extracts.length > 3 && (
                        <span className="px-2 py-1 text-xs text-muted-foreground">
                          {t("smartSuggestions.moreCount", { count: extracts.length - 3 })}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={suggestion.action}
                  disabled={isCreating && suggestion.type === "flashcards"}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating && suggestion.type === "flashcards" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                  {suggestion.actionLabel}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Compact inline suggestion that appears next to extract lists
 */
interface InlineSuggestionProps {
  count: number;
  onAction: () => void;
  onDismiss?: () => void;
  type?: "flashcards" | "review";
}

export function InlineSuggestion({
  count,
  onAction,
  onDismiss,
  type = "flashcards",
}: InlineSuggestionProps) {
  const { t } = useI18n();
  if (count === 0) return null;

  const config = {
    flashcards: {
      icon: Zap,
      label: t("smartSuggestions.createFlashcards"),
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    review: {
      icon: Target,
      label: t("smartSuggestions.startReview"),
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
  };

  const { icon: Icon, label, color, bgColor } = config[type];

  return (
    <div
      className={`flex items-center justify-between p-3 ${bgColor} border border-current/20 rounded-lg`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-sm text-foreground">
          {type === "flashcards"
            ? t("smartSuggestions.extractsReadyCompact", { count })
            : t("smartSuggestions.cardsReadyCompact", { count })}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onAction}
          className={`px-3 py-1.5 text-sm font-medium ${color} hover:bg-black/10 rounded-md transition-colors`}
        >
          {label}
        </button>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 hover:bg-black/10 rounded transition-colors"
            aria-label={t("smartSuggestions.dismiss")}
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Smart suggestion banner for the top of pages
 */
interface SuggestionBannerProps {
  message: string;
  actionLabel: string;
  onAction: () => void;
  onDismiss?: () => void;
  icon?: typeof Sparkles;
  variant?: "info" | "success" | "warning";
}

export function SuggestionBanner({
  message,
  actionLabel,
  onAction,
  onDismiss,
  icon: Icon = Sparkles,
  variant = "info",
}: SuggestionBannerProps) {
  const { t } = useI18n();
  const variantStyles = {
    info: "bg-blue-500/10 border-blue-500/20 text-blue-600",
    success: "bg-green-500/10 border-green-500/20 text-green-600",
    warning: "bg-amber-500/10 border-amber-500/20 text-amber-600",
  };

  return (
    <div
      className={`flex items-center justify-between p-4 ${variantStyles[variant]} border rounded-xl`}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5" />
        <span className="text-sm font-medium">{message}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onAction}
          className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {actionLabel}
        </button>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1.5 hover:bg-black/10 rounded-lg transition-colors"
            aria-label={t("smartSuggestions.dismiss")}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default SmartSuggestions;
