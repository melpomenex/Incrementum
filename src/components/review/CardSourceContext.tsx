import { useEffect, useState } from "react";
import { CaretDown, CaretRight, BookOpen } from "@phosphor-icons/react";
import { getCardSourceContext, type CardSourceContext as SourceContextData } from "../../api/review";
import { useSettingsStore } from "../../stores/settingsStore";

interface CardSourceContextProps {
  itemId: string;
}

/**
 * Collapsible source-context panel rendered on review cards.
 *
 * Shows a one-line "From: <document>" summary by default, expandable to reveal
 * the source extract snippet. Hidden entirely when:
 *  - the user has disabled source context in settings, or
 *  - the card has no resolvable source.
 *
 * This implements the context-retention UX recommended by RemNote's design and
 * Andy Matuschak's writing on atomic-vs-contextual prompts.
 */
export function CardSourceContext({ itemId }: CardSourceContextProps) {
  const [context, setContext] = useState<SourceContextData | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const settings = useSettingsStore((state) => state.settings);
  const enabled =
    (settings as any)?.learning?.showSourceContext ?? true;

  useEffect(() => {
    let cancelled = false;
    setContext(null);
    setLoaded(false);
    setIsExpanded(false);

    if (!enabled) {
      setLoaded(true);
      return;
    }

    getCardSourceContext(itemId)
      .then((result) => {
        if (!cancelled) {
          setContext(result);
        }
      })
      .catch(() => {
        // Source resolution is best-effort; never block review on it.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [itemId, enabled]);

  if (!enabled || !loaded || !context) {
    return null;
  }

  const hasSnippet = Boolean(context.extract_snippet);
  const titleWithPage = context.page_number
    ? `${context.document_title} (p. ${context.page_number})`
    : context.document_title;

  return (
    <div className="mt-3 mb-1 rounded-lg border border-border/60 bg-muted/30">
      <button
        type="button"
        onClick={() => hasSnippet && setIsExpanded((v) => !v)}
        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground ${
          hasSnippet ? "hover:bg-muted/60 cursor-pointer" : "cursor-default"
        } transition-colors`}
        aria-expanded={isExpanded}
      >
        <BookOpen className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
        {hasSnippet ? (
          isExpanded ? (
            <CaretDown className="h-3 w-3 flex-shrink-0 opacity-70" />
          ) : (
            <CaretRight className="h-3 w-3 flex-shrink-0 opacity-70" />
          )
        ) : (
          <span className="w-3" />
        )}
        <span className="truncate">
          From: <span className="italic text-foreground/80">{titleWithPage}</span>
        </span>
        {context.source_url && (
          <a
            href={context.source_url}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
            className="ml-auto flex-shrink-0 text-[10px] underline opacity-70 hover:opacity-100"
          >
            source
          </a>
        )}
      </button>
      {isExpanded && hasSnippet && (
        <div className="border-t border-border/50 px-3 py-2 text-xs text-foreground/70 leading-relaxed">
          {context.extract_snippet}
        </div>
      )}
    </div>
  );
}
