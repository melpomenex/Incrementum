import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ArrowCounterClockwise,
  CaretRight,
  Clipboard,
  Copy,
  Eye,
  FolderOpen,
  Pencil,
  Prohibit,
  Sparkle,
  Star,
  Trash,
} from "@phosphor-icons/react";
import { useI18n } from "../../lib/i18n";
import type { LearningItem } from "../../api/learning-items";

interface CardContextMenuProps {
  card: LearningItem;
  x: number;
  y: number;
  onClose: () => void;
  onEditInStudio?: (card: LearningItem) => void;
  onPreview: (id: string) => void;
  onSuspend: (cardId: string) => void;
  onUnsuspend: (cardId: string) => void;
  onDelete: (cardId: string) => void;
  onDuplicate: (card: LearningItem) => void;
  onMoveToDeck?: (cardId: string, deckId: string) => void;
  decks?: { id: string; name: string }[];
}

export function CardContextMenu({
  card,
  x,
  y,
  onClose,
  onEditInStudio,
  onPreview,
  onSuspend,
  onUnsuspend,
  onDelete,
  onDuplicate,
  onMoveToDeck,
  decks,
}: CardContextMenuProps) {
  const { t } = useI18n();
  const menuRef = useRef<HTMLDivElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && e.target instanceof Node && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    // Slight delay to avoid closing from the same right-click that opened us
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 0);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Reset delete confirmation when card changes
  useEffect(() => {
    setShowDeleteConfirm(false);
    setOpenSubmenu(null);
  }, [card.id]);

  const handleAction = useCallback(
    (action: () => void) => {
      action();
      onClose();
    },
    [onClose]
  );

  const copyToClipboard = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Fallback
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
    },
    []
  );

  // Position menu to stay within viewport
  const menuStyle = {
    left: Math.min(x, window.innerWidth - 220),
    top: Math.min(y, window.innerHeight - 350),
  };

  const hasDecks = decks && decks.length > 0 && onMoveToDeck;
  const plainQuestion = card.question.replace(/<[^>]*>/g, "").trim();
  const plainAnswer = (card.answer ?? "").replace(/<[^>]*>/g, "").trim();

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[200px] bg-card border border-border rounded-lg shadow-lg py-1"
      style={menuStyle}
    >
      {/* Pencil */}
      {onEditInStudio && (
        <button
          onClick={() => handleAction(() => onEditInStudio(card))}
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted hover:text-foreground flex items-center gap-2"
        >
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          {t("cardContextMenu.edit")}
        </button>
      )}

      {/* Preview */}
      <button
        onClick={() => handleAction(() => onPreview(card.id))}
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted hover:text-foreground flex items-center gap-2"
      >
        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
        {t("cardContextMenu.preview")}
      </button>

      <div className="my-1 border-t border-border" />

      {/* Suspend / Unsuspend */}
      {card.is_suspended ? (
        <button
          onClick={() => handleAction(() => onUnsuspend(card.id))}
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted hover:text-foreground flex items-center gap-2"
        >
          <ArrowCounterClockwise className="h-3.5 w-3.5 text-green-500" />
          {t("cardContextMenu.unsuspend")}
        </button>
      ) : (
        <button
          onClick={() => handleAction(() => onSuspend(card.id))}
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted hover:text-foreground flex items-center gap-2"
        >
          <Prohibit className="h-3.5 w-3.5 text-yellow-500" />
          {t("cardContextMenu.suspend")}
        </button>
      )}

      {/* Move to Deck */}
      {hasDecks && (
        <div
          className="relative"
          onMouseEnter={() => setOpenSubmenu("moveToDeck")}
          onMouseLeave={() => setOpenSubmenu(null)}
        >
          <button
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted hover:text-foreground flex items-center gap-2"
          >
            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
            {t("cardContextMenu.moveToDeck")}
            <CaretRight className="h-3 w-3 text-muted-foreground ml-auto" />
          </button>
          {openSubmenu === "moveToDeck" && (
            <div
              className="absolute left-full top-0 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[160px]"
              style={{ left: "100%", marginLeft: 4 }}
            >
              {decks!.map((deck) => (
                <button
                  key={deck.id}
                  onClick={() =>
                    handleAction(() => onMoveToDeck!(card.id, deck.id))
                  }
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted hover:text-foreground truncate"
                >
                  {deck.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Set Priority */}
      <div
        className="relative"
        onMouseEnter={() => setOpenSubmenu("priority")}
        onMouseLeave={() => setOpenSubmenu(null)}
      >
        <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted hover:text-foreground flex items-center gap-2">
          <Star className="h-3.5 w-3.5 text-muted-foreground" />
          {t("cardContextMenu.setPriority")}
          <CaretRight className="h-3 w-3 text-muted-foreground ml-auto" />
        </button>
        {openSubmenu === "priority" && (
          <div
            className="absolute left-full top-0 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px]"
            style={{ left: "100%", marginLeft: 4 }}
          >
            {[1, 2, 3, 4, 5].map((p) => (
              <button
                key={p}
                onClick={() => handleAction(() => {
                  // Priority is stored as a tag for now since LearningItem doesn't have a priority field
                  // This is a no-op placeholder — the parent can handle the priority change
                  // via updating the card's tags or custom field
                })}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted hover:text-foreground flex items-center gap-2"
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={`h-3 w-3 ${i < p ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`}
                  />
                ))}
                <span className="ml-1 text-xs text-muted-foreground">{p}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="my-1 border-t border-border" />

      {/* Duplicate */}
      <button
        onClick={() => handleAction(() => onDuplicate(card))}
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted hover:text-foreground flex items-center gap-2"
      >
        <Sparkle className="h-3.5 w-3.5 text-muted-foreground" />
        {t("cardContextMenu.duplicate")}
      </button>

      {/* Copy Question */}
      <button
        onClick={() =>
          handleAction(() => copyToClipboard(plainQuestion))
        }
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted hover:text-foreground flex items-center gap-2"
        title={plainQuestion}
      >
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        {t("cardContextMenu.copyQuestion")}
      </button>

      {/* Copy Answer */}
      {plainAnswer && (
        <button
          onClick={() =>
            handleAction(() => copyToClipboard(plainAnswer))
          }
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted hover:text-foreground flex items-center gap-2"
          title={plainAnswer}
        >
          <Clipboard className="h-3.5 w-3.5 text-muted-foreground" />
          {t("cardContextMenu.copyAnswer")}
        </button>
      )}

      <div className="my-1 border-t border-border" />

      {/* Delete */}
      {!showDeleteConfirm ? (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-destructive/10 text-destructive flex items-center gap-2"
        >
          <Trash className="h-3.5 w-3.5" />
          {t("cardContextMenu.delete")}
        </button>
      ) : (
        <div className="px-3 py-1.5 flex items-center gap-2">
          <span className="text-xs text-destructive flex-1">
            {t("cardContextMenu.deleteConfirm")}
          </span>
          <button
            onClick={() => handleAction(() => onDelete(card.id))}
            className="text-xs px-2 py-0.5 rounded bg-destructive text-destructive-foreground"
          >
            {t("common.confirm")}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="text-xs px-2 py-0.5 rounded border border-border"
          >
            {t("common.cancel")}
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
