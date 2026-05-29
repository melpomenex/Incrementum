import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Layers, Search, X, MoreVertical } from "lucide-react";
import type { StudyDeck } from "../../types/study-decks";
import { useI18n } from "../../lib/i18n";
import { DeckItemContextMenu } from "./DeckItemContextMenu";

interface ReviewDecksModalProps {
  isOpen: boolean;
  onClose: () => void;
  decks: StudyDeck[];
  deckStats: Array<{
    deck: StudyDeck;
    count: number;
  }>;
  activeDeckIds: string[];
  onToggleDeck: (deckId: string | null) => void;
  onClearSelection: () => void;
  onStartReview?: (deckId: string) => void;
}

export function ReviewDecksModal({
  isOpen,
  onClose,
  decks,
  deckStats,
  activeDeckIds,
  onToggleDeck,
  onClearSelection,
  onStartReview,
}: ReviewDecksModalProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    deckId: string;
    x: number;
    y: number;
  } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) setQuery("");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  const totalDueCount = useMemo(
    () => deckStats.reduce((sum, item) => sum + item.count, 0),
    [deckStats]
  );

  const filteredDeckStats = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return deckStats;
    return deckStats.filter(({ deck }) => {
      if (deck.name.toLowerCase().includes(normalized)) return true;
      return deck.tagFilters.some((tag) => tag.toLowerCase().includes(normalized));
    });
  }, [deckStats, query]);

  const openContextMenu = (deckId: string, x: number, y: number) => {
    setContextMenu({ deckId, x, y });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleDeckContextMenu = (
    e: React.MouseEvent,
    deckId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu(deckId, e.clientX, e.clientY);
  };

  const handleDeckTouchStart = (
    e: React.TouchEvent,
    deckId: string
  ) => {
    longPressTimer.current = setTimeout(() => {
      const touch = e.touches[0];
      openContextMenu(deckId, touch.clientX, touch.clientY);
    }, 500);
  };

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleMoreButtonClick = (
    e: React.MouseEvent,
    deckId: string
  ) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openContextMenu(deckId, rect.right - 220, rect.bottom);
  };

  // Resolve the deck for the active context menu
  const contextDeckInfo = contextMenu
    ? deckStats.find((s) => s.deck.id === contextMenu.deckId)
    : undefined;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        className="relative w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl animate-glass-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-decks-modal-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <div>
            <h2 id="review-decks-modal-title" className="text-2xl font-bold text-foreground">
              {t("reviewDecks.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("reviewDecks.availableCount", { count: decks.length })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t("reviewDecks.closeModal")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("reviewDecks.searchPlaceholder")}
              autoFocus
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {/* All Decks row */}
            <button
              onClick={() => {
                onClearSelection();
                onClose();
              }}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                activeDeckIds.length === 0
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:bg-muted/70"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-foreground">{t("reviewHome.allDecks")}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{t("reviewHome.countDue", { count: totalDueCount })}</span>
                  {activeDeckIds.length === 0 && <Check className="h-4 w-4 text-primary" />}
                </div>
              </div>
            </button>

            {filteredDeckStats.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {t("reviewDecks.noMatches")}
              </div>
            )}

            {filteredDeckStats.map(({ deck, count }) => {
              const isActive = activeDeckIds.includes(deck.id);
              return (
                <div
                  key={deck.id}
                  className={`group relative w-full rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                    isActive
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:bg-muted/70"
                  }`}
                  onClick={() => onToggleDeck(deck.id)}
                  onContextMenu={(e) => handleDeckContextMenu(e, deck.id)}
                  onTouchStart={(e) => handleDeckTouchStart(e, deck.id)}
                  onTouchEnd={clearLongPress}
                  onTouchMove={clearLongPress}
                >
                  <button
                    onClick={(e) => handleMoreButtonClick(e, deck.id)}
                    className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-muted transition-colors"
                  >
                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                  </button>

                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-foreground">{deck.name}</span>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{t("reviewHome.countDue", { count })}</span>
                      {isActive && <Check className="h-4 w-4 text-primary" />}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {deck.tagFilters.length > 0 ? (
                      deck.tagFilters.map((tag) => (
                        <span
                          key={`${deck.id}-${tag}`}
                          className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">{t("reviewDecks.noTagFilters")}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Context menu rendered outside modal tree */}
      {contextMenu && contextDeckInfo && (
        <DeckItemContextMenu
          deck={contextDeckInfo.deck}
          cardCount={contextDeckInfo.count}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          onStartReview={(deckId) => {
            closeContextMenu();
            onClose();
            onStartReview?.(deckId);
          }}
        />
      )}
    </div>
  );
}
