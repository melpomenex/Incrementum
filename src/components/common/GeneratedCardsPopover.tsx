import { useEffect, useRef, useState } from "react";
import {
  CircleNotch,
  Eye,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import { getLearningItemsByExtract, getItemTypeName, type LearningItem } from "../../api/learning-items";
import { cn } from "../../utils";
import { renderAnkiHtmlWithLatex, warmAnkiLatexNormalization } from "../../utils/ankiLatex";

interface GeneratedCardsPopoverProps {
  extractId: string;
  extractTitle: string;
  renderTrigger: (props: { onClick: () => void; isOpen: boolean; count?: number }) => React.ReactNode;
  align?: "left" | "right";
  className?: string;
  initialCount?: number;
}

function renderClozeText(item: LearningItem, isAnswerRevealed: boolean) {
  if (!item.cloze_text) {
    return <span dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(item.question) }} />;
  }

  if (item.cloze_ranges) {

  const text = item.cloze_text;
  const ranges = item.cloze_ranges;
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
    if (isAnswerRevealed) {
      parts.push(
        <span
          key={`cloze-${index}`}
          className="bg-green-500/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded font-semibold text-sm"
          dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(clozeContent) }}
        />
      );
    } else {
      parts.push(
        <span
          key={`cloze-${index}`}
          className="bg-primary/20 px-2 py-0.5 rounded mx-0.5 text-sm"
        >
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

  return <>{parts}</>;
  }

  // Fallback: parse {{cN::content}} or [[cN::content]] markers from cloze_text
  const rawClozePattern = /\{\{c(\d+)::(.+?)(?:::(.+?))?\}\}/g;
  if (rawClozePattern.test(item.cloze_text)) {
    rawClozePattern.lastIndex = 0;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    while ((match = rawClozePattern.exec(item.cloze_text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`t-${parts.length}`} dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(item.cloze_text.slice(lastIndex, match.index)) }} />
        );
      }
      const hint = match[3];
      if (isAnswerRevealed) {
        parts.push(
          <span key={`c-${parts.length}`} className="bg-green-500/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded font-semibold text-sm" dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(match[2]) }} />
        );
      } else {
        parts.push(
          <span key={`c-${parts.length}`} className="bg-primary/20 px-2 py-0.5 rounded mx-0.5 text-sm">
            {hint || "[...]"}
          </span>
        );
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < item.cloze_text.length) {
      parts.push(
        <span key={`t-end`} dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(item.cloze_text.slice(lastIndex)) }} />
      );
    }
    return <>{parts}</>;
  }

  const parts = item.cloze_text.split(/\[\[c(\d+)::(.*?)\]\]/g);
  return (
    <span>
      {parts.map((part, idx) => {
        if (idx % 3 === 1) return null;
        if (idx % 3 === 2) {
          if (isAnswerRevealed) {
            return (
              <span
                key={idx}
                className="bg-green-500/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded font-semibold text-sm"
                dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(part) }}
              />
            );
          }
          return (
            <span key={idx} className="bg-primary/20 px-2 py-0.5 rounded mx-0.5 text-sm">
              [...]
            </span>
          );
        }
        return <span key={idx} dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(part) }} />;
      })}
    </span>
  );
}

function getQuestionContent(item: LearningItem, isAnswerRevealed: boolean) {
  switch (item.item_type) {
    case "Cloze":
      return renderClozeText(item, isAnswerRevealed);
    case "Flashcard":
    case "Qa":
    case "Basic":
    default:
      return <span dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(item.question) }} />;
  }
}

interface CardPreviewProps {
  item: LearningItem;
  index: number;
}

function CardPreview({ item, index }: CardPreviewProps) {
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);

  const answerContent = item.item_type !== "Cloze" && item.answer ? (
    <span dangerouslySetInnerHTML={{ __html: renderAnkiHtmlWithLatex(item.answer) }} />
  ) : null;

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Card {index + 1}
        </span>
        <span className="px-2 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded text-xs font-medium">
          {getItemTypeName(item.item_type)}
        </span>
      </div>

      <div className="text-sm leading-relaxed text-foreground mb-2">
        {getQuestionContent(item, isAnswerRevealed)}
      </div>

      {answerContent && (
        <>
          {isAnswerRevealed ? (
            <div className="text-sm leading-relaxed text-green-600 dark:text-green-400 bg-green-500/5 border border-green-500/20 rounded p-2">
              {answerContent}
            </div>
          ) : (
            <button
              onClick={() => setIsAnswerRevealed(true)}
              className="w-full py-1.5 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors flex items-center justify-center gap-1.5"
            >
              <Eye className="w-3 h-3" />
              Show Answer
            </button>
          )}
        </>
      )}

      {item.item_type === "Cloze" && !isAnswerRevealed && (
        <button
          onClick={() => setIsAnswerRevealed(true)}
          className="w-full py-1.5 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors flex items-center justify-center gap-1.5"
        >
          <Eye className="w-3 h-3" />
          Reveal
        </button>
      )}
    </div>
  );
}

export function GeneratedCardsPopover({
  extractId,
  extractTitle,
  renderTrigger,
  align = "left",
  className,
  initialCount,
}: GeneratedCardsPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<LearningItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setIsLoading(true);
    setError(null);

    getLearningItemsByExtract(extractId)
      .then((data) => {
        if (!active) return;
        setItems(data);
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed to load generated cards", err);
        setError("Failed to load cards");
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, extractId]);

  useEffect(() => {
    for (const item of items) {
      warmAnkiLatexNormalization([item.question, item.answer, item.cloze_text]);
    }
  }, [items]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (event.target instanceof Node && wrapperRef.current.contains(event.target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <div ref={wrapperRef} className={cn("relative inline-flex", className)}>
      {renderTrigger({ onClick: handleToggle, isOpen, count: items.length || initialCount })}
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 mt-2 w-[420px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover text-popover-foreground shadow-xl max-h-[500px] flex flex-col",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkle className="h-4 w-4 text-primary" />
              Generated Cards
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close cards"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-4 py-3 border-b border-border shrink-0">
            <div className="text-xs text-muted-foreground truncate" title={extractTitle}>
              {extractTitle}
            </div>
          </div>

          <div className="px-4 py-3 overflow-y-auto flex-1 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CircleNotch className="h-4 w-4 animate-spin" />
                  Loading cards...
                </div>
              </div>
            ) : error ? (
              <div className="text-sm text-destructive py-4 text-center">{error}</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                No cards generated yet
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <CardPreview key={item.id} item={item} index={index} />
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground text-center shrink-0">
              {items.length} card{items.length !== 1 ? "s" : ""} generated
            </div>
          )}
        </div>
      )}
    </div>
  );
}
