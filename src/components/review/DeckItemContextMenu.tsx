import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Play,
  Edit3,
  Copy,
  Download,
  Ban,
  RotateCcw,
  Trash2,
  FileSpreadsheet,
  MoreVertical,
} from "lucide-react";
import { useStudyDeckStore } from "../../stores/studyDeckStore";
import { useToast } from "../common/Toast";
import { getAllLearningItems, exportDeckAsApkg, exportDeckAsCsv } from "../../api/learning-items";
import { bulkSuspendItems, bulkUnsuspendItems } from "../../api/queue";
import { matchesDeckTags } from "../../utils/studyDecks";
import { useI18n } from "../../lib/i18n";
import type { StudyDeck } from "../../types/study-decks";

interface DeckItemContextMenuProps {
  deck: StudyDeck;
  cardCount: number;
  x: number;
  y: number;
  onClose: () => void;
  onStartReview: (deckId: string) => void;
}

export function DeckItemContextMenu({
  deck,
  cardCount,
  x,
  y,
  onClose,
  onStartReview,
}: DeckItemContextMenuProps) {
  const { t } = useI18n();
  const toast = useToast();
  const menuRef = useRef<HTMLDivElement>(null);
  const { updateDeck, removeDeck, addDeck } = useStudyDeckStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(deck.name);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && e.target instanceof Node && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handleClick), 0);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    setShowDeleteConfirm(false);
    setIsRenaming(false);
    setRenameValue(deck.name);
  }, [deck.id]);

  const handleAction = useCallback(
    (action: () => void) => {
      action();
      onClose();
    },
    [onClose]
  );

  const getCardIdsForDeck = useCallback(async (): Promise<string[]> => {
    try {
      const allCards = await getAllLearningItems();
      return allCards.filter((c) => matchesDeckTags(c.tags, deck)).map((c) => c.id);
    } catch {
      return [];
    }
  }, [deck]);

  const handleSuspendAll = useCallback(async () => {
    const ids = await getCardIdsForDeck();
    if (ids.length === 0) { toast.error("No cards to suspend"); return; }
    try {
      await bulkSuspendItems(ids);
      toast.success(`Suspended ${ids.length} cards`);
    } catch { toast.error("Failed to suspend cards"); }
  }, [getCardIdsForDeck, toast]);

  const handleUnsuspendAll = useCallback(async () => {
    const ids = await getCardIdsForDeck();
    if (ids.length === 0) { toast.error("No cards to unsuspend"); return; }
    try {
      await bulkUnsuspendItems(ids);
      toast.success(`Unsuspended ${ids.length} cards`);
    } catch { toast.error("Failed to unsuspend cards"); }
  }, [getCardIdsForDeck, toast]);

  const handleExportApkg = useCallback(async () => {
    try {
      const path = await exportDeckAsApkg(deck.name, `${deck.name}.apkg`);
      toast.success(`Exported as ${path}`);
    } catch { toast.error("Failed to export .apkg"); }
  }, [deck.name, toast]);

  const handleExportCsv = useCallback(async () => {
    try {
      const path = await exportDeckAsCsv(deck.name, `${deck.name}.csv`);
      toast.success(`Exported as ${path}`);
    } catch { toast.error("Failed to export .csv"); }
  }, [deck.name, toast]);

  const handleDuplicate = useCallback(() => {
    addDeck(`${deck.name} (copy)`, [...deck.tagFilters]);
    toast.success(`Duplicated "${deck.name}"`);
  }, [deck, addDeck, toast]);

  const handleRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== deck.name) {
      updateDeck(deck.id, { name: trimmed });
      toast.success(`Renamed to "${trimmed}"`);
    }
    setIsRenaming(false);
  }, [deck.id, deck.name, renameValue, updateDeck, toast]);

  const handleDelete = useCallback(() => {
    removeDeck(deck.id);
    toast.success(`Deleted "${deck.name}"`);
  }, [deck.id, deck.name, removeDeck, toast]);

  const menuStyle = {
    left: Math.min(x, window.innerWidth - 240),
    top: Math.min(y, window.innerHeight - 400),
  };

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[120] min-w-[220px] bg-card border border-border rounded-lg shadow-lg py-1"
      style={menuStyle}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Study Now */}
      <button
        onClick={() => handleAction(() => onStartReview(deck.id))}
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted hover:text-foreground flex items-center gap-2"
      >
        <Play className="h-3.5 w-3.5 text-green-500" />
        Study Now
      </button>

      {/* Rename */}
      {isRenaming ? (
        <div className="px-3 py-1.5 flex items-center gap-1.5">
          <Edit3 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") setIsRenaming(false);
            }}
            onBlur={handleRename}
            autoFocus
            className="flex-1 min-w-0 px-1.5 py-0.5 rounded border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      ) : (
        <button
          onClick={() => { setIsRenaming(true); setRenameValue(deck.name); }}
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted hover:text-foreground flex items-center gap-2"
        >
          <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
          Rename
        </button>
      )}

      {/* Duplicate */}
      <button
        onClick={() => handleAction(handleDuplicate)}
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted hover:text-foreground flex items-center gap-2"
      >
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        Duplicate
      </button>

      <div className="my-1 border-t border-border" />

      {/* Export as .apkg */}
      <button
        onClick={() => handleAction(handleExportApkg)}
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted hover:text-foreground flex items-center gap-2"
      >
        <Download className="h-3.5 w-3.5 text-muted-foreground" />
        Export as .apkg
      </button>

      {/* Export as .csv */}
      <button
        onClick={() => handleAction(handleExportCsv)}
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted hover:text-foreground flex items-center gap-2"
      >
        <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" />
        Export as .csv
      </button>

      <div className="my-1 border-t border-border" />

      {/* Suspend All */}
      <button
        onClick={() => handleAction(handleSuspendAll)}
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted hover:text-foreground flex items-center gap-2"
      >
        <Ban className="h-3.5 w-3.5 text-yellow-500" />
        Suspend All Cards
        <span className="ml-auto text-xs text-muted-foreground">{cardCount}</span>
      </button>

      {/* Unsuspend All */}
      <button
        onClick={() => handleAction(handleUnsuspendAll)}
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted hover:text-foreground flex items-center gap-2"
      >
        <RotateCcw className="h-3.5 w-3.5 text-green-500" />
        Unsuspend All Cards
        <span className="ml-auto text-xs text-muted-foreground">{cardCount}</span>
      </button>

      <div className="my-1 border-t border-border" />

      {/* Delete */}
      {!showDeleteConfirm ? (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-destructive/10 text-destructive flex items-center gap-2"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete Deck
        </button>
      ) : (
        <div className="px-3 py-1.5 flex items-center gap-2">
          <span className="text-xs text-destructive flex-1">Delete "{deck.name}"?</span>
          <button
            onClick={() => handleAction(handleDelete)}
            className="text-xs px-2 py-0.5 rounded bg-destructive text-destructive-foreground"
          >
            Confirm
          </button>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="text-xs px-2 py-0.5 rounded border border-border"
          >
            Cancel
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
