import { useState, useCallback, useMemo, useEffect } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Search,
  Trash2,
  Ban,
  Play,
  Tag,
  Layers,
  ArrowUpDown,
  X,
  Loader2,
  Inbox,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Download,
  GraduationCap,
  Flame,
  Clock,
  Brain,
  Target,
  CheckCircle2,
  Edit3,
  Calendar,
  Copy,
  Pause,
  Upload,
} from "lucide-react";
import { useStudyDeckStore } from "../../stores/studyDeckStore";
import { useReviewStore } from "../../stores/reviewStore";
import { useI18n } from "../../lib/i18n";
import { useToast } from "../common/Toast";
import { getAllLearningItems, createLearningItem, exportDeckAsApkg, type LearningItem } from "../../api/learning-items";
import { bulkSuspendItems, bulkUnsuspendItems, bulkDeleteItems } from "../../api/queue";
import { filterByDecks, matchesDeckTags } from "../../utils/studyDecks";
import { DynamicVirtualList } from "../common/VirtualList";
import { DeckManagerCardRow } from "./DeckManagerCardRow";
import { deleteLearningItem } from "../../lib/database";
// InlineCardEditor moved to CardPreviewPanel Edit tab
import { CardPreviewPanel } from "./CardPreviewPanel";
import { useResizablePanels } from "./useResizablePanels";
import { DeckStatsPanel } from "./DeckStatsPanel";
import type { StudyDeck } from "../../types/study-decks";

type SortField = "due_date" | "state" | "difficulty" | "interval" | "review_count" | "lapses";
type SortDir = "asc" | "desc";
type StateFilter = "" | "New" | "Learning" | "Review" | "Relearning" | "Suspended" | "Leeches";

interface DeckManagerProps {
  onBack: () => void;
  onStartReview?: () => Promise<void>;
  onEditInStudio?: (card: LearningItem) => void;
}

export function DeckManager({ onBack, onStartReview, onEditInStudio }: DeckManagerProps) {
  const { t } = useI18n();
  const toast = useToast();
  const { decks, updateDeck, removeDeck, addDeck } = useStudyDeckStore();

  const [allCards, setAllCards] = useState<LearningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDeckId, setExpandedDeckId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const [sortField, setSortField] = useState<SortField>("due_date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [stateFilter, setStateFilter] = useState<StateFilter>("");
  const [showFilters, setShowFilters] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ deckId: string; x: number; y: number } | null>(null);
  const [renamingDeckId, setRenamingDeckId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [previewCardId, setPreviewCardId] = useState<string | null>(null);
  const [rightPanelView, setRightPanelView] = useState<"preview" | "stats">("preview");
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [mobileCardOpen, setMobileCardOpen] = useState(false);
  const { widths, containerRef, handlePointerDown } = useResizablePanels();

  // Re-check on resize
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Load all learning items (extracted for reuse after card creation)
  const loadAllItems = useCallback(async () => {
    setLoading(true);
    try {
      const cards = await getAllLearningItems();
      setAllCards(Array.isArray(cards) ? cards : []);
    } catch {
      toast.error("Failed to load cards");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAllItems();
  }, [loadAllItems]);

  // On mobile, auto-select first deck when cards load and none is selected
  useEffect(() => {
    if (isMobile && !loading && decks.length > 0 && !expandedDeckId) {
      setExpandedDeckId(decks[0].id);
    }
  }, [isMobile, loading, decks, expandedDeckId]);

  const getCardsForDeck = useCallback(
    (deck: StudyDeck): LearningItem[] => {
      return allCards.filter((card) => matchesDeckTags(card.tags, deck));
    },
    [allCards]
  );

  // Compute counts per deck
  const deckCardCounts = useMemo(() => {
    const now = new Date().toISOString().slice(0, 10);
    const map = new Map<string, { total: number; dueToday: number; suspended: number; leeches: number; newCards: number; learning: number; review: number; relearning: number }>();
    for (const deck of decks) {
      const cards = getCardsForDeck(deck);
      map.set(deck.id, {
        total: cards.length,
        dueToday: cards.filter((c) => !c.is_suspended && c.due_date?.slice(0, 10) <= now).length,
        suspended: cards.filter((c) => c.is_suspended).length,
        leeches: cards.filter((c) => c.lapses >= 5).length,
        newCards: cards.filter((c) => c.state === "New").length,
        learning: cards.filter((c) => c.state === "Learning").length,
        review: cards.filter((c) => c.state === "Review").length,
        relearning: cards.filter((c) => c.state === "Relearning").length,
      });
    }
    return map;
  }, [decks, getCardsForDeck]);

  const expandedDeck = decks.find((d) => d.id === expandedDeckId) ?? null;
  const expandedCards = useMemo(() => {
    if (!expandedDeck) return [];
    let cards = getCardsForDeck(expandedDeck);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      cards = cards.filter(
        (c) =>
          c.question.toLowerCase().includes(q) ||
          c.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    if (stateFilter) {
      if (stateFilter === "Suspended") {
        cards = cards.filter((c) => c.is_suspended);
      } else if (stateFilter === "Leeches") {
        cards = cards.filter((c) => c.lapses >= 5);
      } else {
        cards = cards.filter((c) => c.state === stateFilter as LearningItem["state"]);
      }
    }

    const stateOrder: Record<string, number> = {
      New: 0,
      Learning: 1,
      Relearning: 2,
      Review: 3,
    };
    cards.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "due_date":
          cmp = (a.due_date ?? "").localeCompare(b.due_date ?? "");
          break;
        case "state":
          cmp = (stateOrder[a.state] ?? 0) - (stateOrder[b.state] ?? 0);
          break;
        case "difficulty":
          cmp = a.difficulty - b.difficulty;
          break;
        case "interval":
          cmp = a.interval - b.interval;
          break;
        case "review_count":
          cmp = a.review_count - b.review_count;
          break;
        case "lapses":
          cmp = a.lapses - b.lapses;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return cards;
  }, [
    expandedDeck,
    getCardsForDeck,
    searchQuery,
    stateFilter,
    sortField,
    sortDir,
  ]);

  const previewCard = previewCardId
    ? expandedCards.find((c) => c.id === previewCardId) ?? null
    : null;

  // State filter counts for the active deck
  const stateFilterCounts = useMemo(() => {
    if (!expandedDeck) return { all: 0, "New": 0, "Learning": 0, "Review": 0, "Suspended": 0, "Leeches": 0 };
    const cards = getCardsForDeck(expandedDeck);
    return {
      all: cards.length,
      "New": cards.filter((c) => c.state === "New").length,
      "Learning": cards.filter((c) => c.state === "Learning" || c.state === "Relearning").length,
      "Review": cards.filter((c) => c.state === "Review").length,
      "Suspended": cards.filter((c) => c.is_suspended).length,
      "Leeches": cards.filter((c) => c.lapses >= 5).length,
    };
  }, [expandedDeck, getCardsForDeck]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === expandedCards.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(expandedCards.map((c) => c.id)));
    }
  }, [selectedIds.size, expandedCards]);

  const handleExpandCard = useCallback(
    (id: string) => {
      setPreviewCardId((prev) => (prev === id ? null : id));
      if (isMobile) setMobileCardOpen(true);
    },
    [isMobile]
  );

  const handleCardSave = useCallback(
    (updated: LearningItem) => {
      setAllCards((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
    },
    []
  );

  const handleBulkSuspend = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await bulkSuspendItems(ids);
      setAllCards((prev) =>
        prev.map((c) => (ids.includes(c.id) ? { ...c, is_suspended: true } : c))
      );
      toast.success(`Suspended ${ids.length} cards`);
      setSelectedIds(new Set());
    } catch {
      toast.error("Failed to suspend cards");
    }
  }, [selectedIds, toast]);

  const handleBulkUnsuspend = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await bulkUnsuspendItems(ids);
      setAllCards((prev) =>
        prev.map((c) =>
          ids.includes(c.id) ? { ...c, is_suspended: false } : c
        )
      );
      toast.success(`Unsuspended ${ids.length} cards`);
      setSelectedIds(new Set());
    } catch {
      toast.error("Failed to unsuspend cards");
    }
  }, [selectedIds, toast]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await bulkDeleteItems(ids);
      setAllCards((prev) => prev.filter((c) => !ids.includes(c.id)));
      toast.success(`Deleted ${ids.length} cards`);
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
    } catch {
      toast.error("Failed to delete cards");
    }
  }, [selectedIds, toast]);

  const handleBulkRetag = useCallback(
    async (tagsToAdd: string[], tagsToRemove: string[]) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      setAllCards((prev) =>
        prev.map((c) => {
          if (!ids.includes(c.id)) return c;
          let newTags = [...c.tags];
          for (const tag of tagsToAdd) {
            if (!newTags.includes(tag)) newTags.push(tag);
          }
          newTags = newTags.filter((t) => !tagsToRemove.includes(t));
          return { ...c, tags: newTags };
        })
      );
      setSelectedIds(new Set());
      toast.success(`Retagged ${ids.length} cards`);
    },
    [selectedIds, toast]
  );

  const handleLeechFilter = useCallback(() => {
    setStateFilter("Leeches");
    setSortField("lapses");
    setSortDir("desc");
  }, []);

  // Create a new empty card for the current deck
  const handleNewCard = useCallback(async () => {
    if (!expandedDeck) return;
    try {
      const newCard = await createLearningItem({
        item_type: "basic",
        question: "",
        answer: "",
        tags: expandedDeck.tagFilters.length > 0 ? expandedDeck.tagFilters : undefined,
        allow_duplicate: true,
      });
      toast.success(t("review.deckManager.newCardCreated"), t("review.deckManager.editCardInPanel"));
      // Select the new card and open edit tab
      setPreviewCardId(newCard.id);
      setRightPanelView("preview");
      // Reload to pick up the new card in the deck
      await loadAllItems();
    } catch (error) {
      console.error("Failed to create card:", error);
      toast.error(t("common.error"), error instanceof Error ? error.message : "Failed to create card");
    }
  }, [expandedDeck, toast, t, loadAllItems]);

  // Start review with better error feedback
  const handleStudyNow = useCallback(async () => {
    if (!expandedDeck || !onStartReview) return;
    try {
      const store = useStudyDeckStore.getState();
      store.clearDeckSelection();
      store.toggleDeckSelection(expandedDeck.id);
      await onStartReview();
    } catch (error) {
      console.error("Failed to start review:", error);
      toast.error(t("common.error"), error instanceof Error ? error.message : "Failed to start review");
    }
  }, [expandedDeck, onStartReview, toast, t]);

  // Context menu handlers for deck right-click
  const handleDeckContextMenu = useCallback((e: React.MouseEvent, deckId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ deckId, x: e.clientX, y: e.clientY });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleDeckRename = useCallback((deckId: string) => {
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return;
    setRenamingDeckId(deckId);
    setRenameValue(deck.name);
    setContextMenu(null);
  }, [decks]);

  const commitRename = useCallback(() => {
    if (renamingDeckId && renameValue.trim()) {
      updateDeck(renamingDeckId, { name: renameValue.trim() });
    }
    setRenamingDeckId(null);
    setRenameValue("");
  }, [renamingDeckId, renameValue, updateDeck]);

  const handleDeckDuplicate = useCallback((deckId: string) => {
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return;
    addDeck(`${deck.name} (copy)`, deck.tagFilters);
    setContextMenu(null);
    toast.success(`Duplicated deck "${deck.name}"`);
  }, [decks, addDeck, toast]);

  const handleDeckDelete = useCallback((deckId: string) => {
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return;
    setContextMenu(null);
    if (confirm(`Delete deck "${deck.name}"? This will NOT delete the cards in this deck - they just won't be filtered by it anymore.`)) {
      removeDeck(deckId);
      if (expandedDeckId === deckId) setExpandedDeckId(null);
      toast.success(`Deleted deck "${deck.name}"`);
    }
  }, [decks, removeDeck, expandedDeckId, toast]);

  const handleDeckStudy = useCallback(async (deckId: string) => {
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return;
    setContextMenu(null);
    // Select this deck in the study deck store
    const store = useStudyDeckStore.getState();
    store.clearDeckSelection();
    store.toggleDeckSelection(deckId);
    // Start review session
    if (onStartReview) {
      await onStartReview();
    }
  }, [decks, onStartReview]);

  const handleDeckSuspendAll = useCallback(async (deckId: string) => {
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return;
    const cards = allCards.filter((c) => matchesDeckTags(c.tags, deck) && !c.is_suspended);
    if (cards.length === 0) { toast.info("No active cards to suspend"); setContextMenu(null); return; }
    try {
      await bulkSuspendItems(cards.map((c) => c.id));
      setAllCards((prev) => prev.map((c) => cards.some((tc) => tc.id === c.id) ? { ...c, is_suspended: true } : c));
      toast.success(`Suspended ${cards.length} cards`);
    } catch { toast.error("Failed to suspend cards"); }
    setContextMenu(null);
  }, [decks, allCards, toast]);

  const handleDeckUnsuspendAll = useCallback(async (deckId: string) => {
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return;
    const cards = allCards.filter((c) => matchesDeckTags(c.tags, deck) && c.is_suspended);
    if (cards.length === 0) { toast.info("No suspended cards to unsuspend"); setContextMenu(null); return; }
    try {
      await bulkUnsuspendItems(cards.map((c) => c.id));
      setAllCards((prev) => prev.map((c) => cards.some((tc) => tc.id === c.id) ? { ...c, is_suspended: false } : c));
      toast.success(`Unsuspended ${cards.length} cards`);
    } catch { toast.error("Failed to unsuspend cards"); }
    setContextMenu(null);
  }, [decks, allCards, toast]);

  const handleDeckExport = useCallback(async (deckId: string) => {
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return;
    const cards = allCards.filter((c) => matchesDeckTags(c.tags, deck));
    if (cards.length === 0) { toast.info("No cards to export"); setContextMenu(null); return; }
    const exportData = cards.map((c) => ({
      question: c.question,
      answer: c.answer,
      tags: c.tags,
      state: c.state,
      difficulty: c.difficulty,
      interval: c.interval,
      ease_factor: c.ease_factor,
      review_count: c.review_count,
      lapses: c.lapses,
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${deck.name.replace(/[^a-zA-Z0-9-_ ]/g, "_")}-export.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${cards.length} cards`);
    setContextMenu(null);
  }, [decks, allCards, toast]);

  const handleDeckExportApkg = useCallback(async (deckId: string) => {
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return;
    setContextMenu(null);
    try {
      // Use Tauri file dialog to pick save location
      const { save } = await import("@tauri-apps/plugin-dialog");
      const filePath = await save({
        title: `Export "${deck.name}" as .apkg`,
        defaultPath: `${deck.name.replace(/[^a-zA-Z0-9-_ ]/g, "_")}.apkg`,
        filters: [{ name: "Anki Package", extensions: ["apkg"] }],
      });
      if (!filePath) return;
      toast.info("Exporting as .apkg...");
      const result = await exportDeckAsApkg(deck.name, filePath);
      toast.success(result);
    } catch (err) {
      toast.error(`Export failed: ${err}`);
    }
  }, [decks, toast]);

  // --- Single card action handlers (for context menu) ---

  const handleCardSuspend = useCallback(async (cardId: string) => {
    try {
      await bulkSuspendItems([cardId]);
      setAllCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, is_suspended: true } : c))
      );
      toast.success(t("review.deckManager.suspended"));
    } catch {
      toast.error("Failed to suspend card");
    }
  }, [toast, t]);

  const handleCardUnsuspend = useCallback(async (cardId: string) => {
    try {
      await bulkUnsuspendItems([cardId]);
      setAllCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, is_suspended: false } : c))
      );
      toast.success(t("review.deckManager.unsuspended"));
    } catch {
      toast.error("Failed to unsuspend card");
    }
  }, [toast, t]);

  const handleCardDelete = useCallback(async (cardId: string) => {
    try {
      await bulkDeleteItems([cardId]);
      await deleteLearningItem(cardId);
      setAllCards((prev) => prev.filter((c) => c.id !== cardId));
      if (previewCardId === cardId) setPreviewCardId(null);
      toast.success("Card deleted");
    } catch {
      toast.error("Failed to delete card");
    }
  }, [toast, previewCardId]);

  const handleCardDuplicate = useCallback(async (card: LearningItem) => {
    try {
      const newCard = await createLearningItem({
        item_type: card.item_type,
        question: card.question,
        answer: card.answer,
        cloze_text: card.cloze_text,
        tags: card.tags,
        allow_duplicate: true,
      });
      await loadAllItems();
      toast.success("Card duplicated");
      setPreviewCardId(newCard.id);
    } catch {
      toast.error("Failed to duplicate card");
    }
  }, [toast, loadAllItems]);

  const handleCardMoveToDeck = useCallback(async (cardId: string, deckId: string) => {
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return;
    // Replace card tags with the target deck's tag filters
    setAllCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, tags: [...deck.tagFilters] } : c
      )
    );
    // Persist the tag change via database
    try {
      const { updateLearningItem } = await import("../../lib/database");
      await updateLearningItem(cardId, { tags: [...deck.tagFilters] });
      toast.success(`Moved card to "${deck.name}"`);
    } catch {
      toast.error("Failed to move card");
      await loadAllItems(); // Reload to undo optimistic update
    }
  }, [decks, toast, loadAllItems]);

  const deckOptions = useMemo(
    () => decks.map((d) => ({ id: d.id, name: d.name })),
    [decks]
  );

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("asc");
      }
    },
    [sortField]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (contextMenu) { setContextMenu(null); return; }
        if (renamingDeckId) { setRenamingDeckId(null); setRenameValue(""); return; }
        if (previewCardId) {
          setPreviewCardId(null);
        } else if (expandedDeckId) {
          setExpandedDeckId(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewCardId, expandedDeckId]);

  const allDeckCards = expandedDeck ? getCardsForDeck(expandedDeck) : [];

  // Inline stats for the active deck
  const inlineStats = useMemo(() => {
    if (!expandedDeck) return null;
    const cards = getCardsForDeck(expandedDeck);
    const now = new Date().toISOString().slice(0, 10);
    const dueToday = cards.filter((c) => !c.is_suspended && c.due_date?.slice(0, 10) <= now).length;
    const newCards = cards.filter((c) => c.state === "New").length;
    const learningCards = cards.filter((c) => c.state === "Learning" || c.state === "Relearning").length;
    const reviewCards = cards.filter((c) => c.state === "Review");
    const matureCards = reviewCards.filter((c) => c.interval >= 21).length;
    const reviewedCards = cards.filter((c) => c.review_count > 0);
    const retentionRate =
      reviewedCards.length > 0
        ? reviewedCards.reduce((sum, c) => {
            const lapseRate = c.review_count > 0 ? c.lapses / c.review_count : 0;
            return sum + (1 - lapseRate);
          }, 0) / reviewedCards.length
        : 0;
    return { total: cards.length, dueToday, newCards, learningCards, matureCards, retentionRate };
  }, [expandedDeck, getCardsForDeck]);

  const sortLabels: [SortField, string][] = [
    ["due_date", "Due"],
    ["state", "State"],
    ["difficulty", "Diff"],
    ["interval", "Int."],
    ["review_count", "Reviews"],
    ["lapses", "Lapses"],
  ];

  const filterChips: { key: StateFilter | "Suspended" | "Leeches"; label: string }[] = [
    { key: "", label: "All" },
    { key: "New", label: "New" },
    { key: "Learning", label: "Learning" },
    { key: "Review", label: "Review" },
    { key: "Suspended", label: "Suspended" },
    { key: "Leeches", label: "Leeches" },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Compact header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("review.backToHome")}
        </button>
        <span className="text-border">·</span>
        <h2 className="text-base font-semibold">{t("review.deckManager.title")}</h2>
        <span className={"text-[10px] text-muted-foreground ml-auto tabular-nums"}>
          {allCards.length} cards · {decks.length} decks
        </span>
      </div>

      {/* Mobile deck picker */}
      {isMobile && decks.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border flex-shrink-0">
          <select
            value={expandedDeckId ?? ""}
            onChange={(e) => setExpandedDeckId(e.target.value || null)}
            className="flex-1 text-sm bg-muted/60 border border-border rounded-md px-2 py-1.5 text-foreground"
          >
            <option value="">Select a deck…</option>
            {decks.map((deck) => {
              const counts = deckCardCounts.get(deck.id);
              return (
                <option key={deck.id} value={deck.id}>
                  {deck.name} ({counts?.total ?? 0})
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Mobile card preview overlay */}
      {isMobile && mobileCardOpen && previewCard && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center border-b border-border px-3 py-2 flex-shrink-0">
            <button
              onClick={() => setMobileCardOpen(false)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => setRightPanelView(rightPanelView === "preview" ? "stats" : "preview")}
                className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground"
              >
                {rightPanelView === "preview" ? "Stats" : "Card"}
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            {rightPanelView === "preview" ? (
              <CardPreviewPanel
                card={previewCard}
                onCardUpdate={handleCardSave}
                onEditInStudio={onEditInStudio}
              />
            ) : (
              <div className="overflow-y-auto h-full">
                <DeckStatsPanel
                  cards={allDeckCards}
                  deck={expandedDeck}
                  onLeechClick={handleLeechFilter}
                  onStudyNow={onStartReview ? handleStudyNow : undefined}
                  onNewCard={handleNewCard}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main 3-column layout */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : decks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <Inbox className="h-10 w-10" />
            <p className="text-sm">{t("review.deckManager.noDecks")}</p>
          </div>
        ) : (
          <div className="flex h-full" ref={containerRef}>
            {/* LEFT SIDEBAR - Deck tree */}
            <div
              className="hidden md:flex flex-shrink-0 border-r border-border overflow-y-auto"
              style={{ width: widths.left }}
            >
              <div className="p-1.5 space-y-0.5">
                {decks.map((deck) => {
                  const counts = deckCardCounts.get(deck.id);
                  const isExpanded = expandedDeckId === deck.id;

                  return (
                    <button
                      key={deck.id}
                      onClick={() =>
                        setExpandedDeckId(isExpanded ? null : deck.id)
                      }
                      onContextMenu={(e) => handleDeckContextMenu(e, deck.id)}
                      className={`w-full text-left px-2 py-1.5 rounded transition-colors ${
                        isExpanded
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted/50 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3 text-primary flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                            {renamingDeckId === deck.id ? (
                              <input
                                autoFocus
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onBlur={commitRename}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") commitRename();
                                  if (e.key === "Escape") { setRenamingDeckId(null); setRenameValue(""); }
                                }}
                                className="text-sm font-medium bg-background border border-primary rounded px-1 py-0 w-full focus:outline-none"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <div className="text-sm font-medium truncate">{deck.name}</div>
                            )}
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                            <span className="tabular-nums">{counts?.total ?? 0}</span>
                            {counts && counts.dueToday > 0 && (
                              <span className="text-primary tabular-nums font-medium">
                                {counts.dueToday} due
                              </span>
                            )}
                            {counts && counts.suspended > 0 && (
                              <span className="text-yellow-600 tabular-nums">
                                {counts.suspended} susp.
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Left drag handle */}
            <div
              onMouseDown={(e) => { e.preventDefault(); handlePointerDown("left", e.clientX); }}
              onTouchStart={(e) => { handlePointerDown("left", e.touches[0].clientX); }}
              className="hidden md:block w-1 hover:w-1.5 flex-shrink-0 cursor-col-resize transition-[width] duration-100 z-10 relative group"
              style={{ pointerEvents: "auto" }}
            >
              <div className="absolute inset-0 bg-border group-hover:bg-primary/50 transition-colors" />
            </div>

            {/* CENTER - Card table area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {expandedDeck ? (
                <>
                  {/* Deck header with name */}
                  <div className="px-3 py-1.5 border-b border-border/50 flex items-center gap-2 flex-shrink-0">
                    <h3 className="text-base font-semibold">{expandedDeck.name}</h3>
                    <Edit3 className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                      {expandedCards.length} shown
                    </span>
                  </div>

                  {/* Inline stats row */}
                  {inlineStats && (
                    <div className="px-3 py-1.5 border-b border-border/50 flex items-center gap-3 flex-shrink-0 overflow-x-auto">
                      <StatPill
                        icon={<Layers className="h-3 w-3" />}
                        label="TOTAL CARDS"
                        value={inlineStats.total}
                      />
                      <StatPill
                        icon={<Clock className="h-3 w-3" />}
                        label="DUE TODAY"
                        value={inlineStats.dueToday}
                        highlight={inlineStats.dueToday > 0}
                      />
                      <StatPill
                        icon={<Plus className="h-3 w-3" />}
                        label="NEW"
                        value={inlineStats.newCards}
                        color="text-blue-500"
                      />
                      <StatPill
                        icon={<Flame className="h-3 w-3" />}
                        label="LEARNING"
                        value={inlineStats.learningCards}
                        color="text-orange-500"
                      />
                      <StatPill
                        icon={<CheckCircle2 className="h-3 w-3" />}
                        label="MATURE"
                        value={inlineStats.matureCards}
                        color="text-green-500"
                      />
                      <StatPill
                        icon={<Target className="h-3 w-3" />}
                        label="RETENTION"
                        value={`${Math.round(inlineStats.retentionRate * 100)}%`}
                        color={inlineStats.retentionRate >= 0.85 ? "text-green-500" : inlineStats.retentionRate >= 0.7 ? "text-yellow-500" : "text-red-500"}
                      />
                    </div>
                  )}

                  {/* Search + filter chips + actions */}
                  <div className={"px-3 py-1.5 border-b border-border/50 space-y-1.5 flex-shrink-0"}>
                    <div className={"flex items-center gap-2 " + (isMobile ? "flex-wrap" : "")}>
                      <div className={"relative " + (isMobile ? "flex-1" : "flex-1 max-w-xs")}>
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={t("review.deckManager.searchPlaceholder")}
                          className="w-full pl-7 pr-6 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className={"flex items-center gap-1 " + (isMobile ? "" : "ml-auto flex-shrink-0")}>
                        <button
                          onClick={() => void handleNewCard()}
                          disabled={!expandedDeck}
                          className="flex items-center gap-1 text-xs px-3 py-1 rounded border border-border text-muted-foreground hover:border-primary/30 hover:text-foreground disabled:opacity-40"
                        >
                          <Plus className="h-3 w-3" /> {!isMobile && "New Card"}
                        </button>
                        <button className="flex items-center gap-1 text-xs px-3 py-1 rounded border border-border text-muted-foreground hover:border-primary/30 hover:text-foreground">
                          <Download className="h-3 w-3" /> {!isMobile && "Import"}
                        </button>
                        <button
                          onClick={() => void handleStudyNow()}
                          disabled={!expandedDeck}
                          className="flex items-center gap-1 text-xs px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-40"
                        >
                          <GraduationCap className="h-3 w-3" /> {!isMobile && "Study Now"}
                        </button>
                      </div>
                    </div>

                    {/* Filter chips */}
                    <div className={"flex items-center gap-1 " + (isMobile ? "flex-wrap" : "")}>
                      {filterChips.map(({ key, label }) => {
                          const count = key === "" ? stateFilterCounts.all
                            : key === "Suspended" ? stateFilterCounts.Suspended
                            : key === "Leeches" ? stateFilterCounts.Leeches
                            : key === "Learning" ? stateFilterCounts.Learning
                            : (stateFilterCounts as Record<string, number>)[key] ?? 0;
                          const isActive = stateFilter === key;
                          return (
                            <button
                              key={key || "all"}
                              onClick={() => setStateFilter(isActive ? "" : (key as StateFilter))}
                              className={`text-xs px-2 py-0.5 rounded border transition-colors tabular-nums whitespace-nowrap ${
                                isActive
                                  ? "border-primary bg-primary/10 text-primary"
                                  : count > 0
                                    ? "border-border text-foreground hover:border-primary/30"
                                    : "border-border/50 text-muted-foreground/50"
                              }`}
                            >
                              {label} ({count})
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sort + select all row */}
                    <div className={"flex items-center gap-1 " + (isMobile ? "flex-wrap" : "")}>
                      <ArrowUpDown className="h-2.5 w-2.5 text-muted-foreground mr-0.5" />
                      {sortLabels.map(([field, label]) => (
                        <button
                          key={field}
                          onClick={() => toggleSort(field)}
                          className={`text-xs px-2 py-0.5 rounded transition-colors ${
                            sortField === field
                              ? "border border-primary bg-primary/10 text-primary"
                              : "hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          {label}
                          {sortField === field &&
                            (sortDir === "asc" ? " ↑" : " ↓")}
                        </button>
                      ))}
                      <div className={isMobile ? "flex items-center gap-1 mt-1" : "ml-auto flex items-center gap-1"}>
                        <button
                          onClick={handleSelectAll}
                          className="text-xs px-2 py-0.5 rounded hover:bg-muted text-muted-foreground"
                        >
                          {selectedIds.size === expandedCards.length && expandedCards.length > 0
                            ? "Deselect all"
                            : "Select all"}
                        </button>
                      </div>
                    </div>

                  {/* Bulk action toolbar */}
                  {selectedIds.size > 0 && (
                    <div className="px-3 py-1 border-b border-border/50 bg-primary/5 flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs text-primary font-medium tabular-nums">
                        {selectedIds.size} selected
                      </span>
                      <button
                        onClick={handleBulkSuspend}
                        className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-border hover:bg-muted"
                      >
                        <Ban className="h-2.5 w-2.5" /> Suspend
                      </button>
                      <button
                        onClick={handleBulkUnsuspend}
                        className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-border hover:bg-muted"
                      >
                        <Play className="h-2.5 w-2.5" /> Unsuspend
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-destructive/30 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-2.5 w-2.5" /> Delete
                      </button>
                      <RetagPopover onRetag={handleBulkRetag} />
                    </div>
                  )}

                  {/* Delete confirmation */}
                  {showDeleteConfirm && (
                    <div className="px-3 py-1.5 border-b border-destructive/20 bg-destructive/5 flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-destructive">
                        Delete {selectedIds.size} cards? This cannot be undone.
                      </span>
                      <button
                        onClick={handleBulkDelete}
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

                  {/* Column headers */}
                  <div className="flex items-center gap-2 px-3 py-1 border-b border-border/50 text-xs font-medium text-muted-foreground uppercase tracking-wider flex-shrink-0 select-none overflow-hidden">
                    <div className="w-4 flex-shrink-0" />
                    <div className={"flex-shrink-0 " + (isMobile ? "flex-1 min-w-0" : "w-[180px] lg:w-[200px]")}>Card</div>
                    {!isMobile && <div className="w-12 flex-shrink-0 hidden xl:block">Type</div>}
                    {!isMobile && (
                      <div className="w-16 flex-shrink-0 cursor-pointer hover:text-foreground" onClick={() => toggleSort("due_date")}>
                        Due {sortField === "due_date" && (sortDir === "asc" ? "↑" : "↓")}
                      </div>
                    )}
                    {!isMobile && (
                      <div className="w-20 flex-shrink-0 hidden md:block cursor-pointer hover:text-foreground" onClick={() => toggleSort("difficulty")}>
                        Difficulty {sortField === "difficulty" && (sortDir === "asc" ? "↑" : "↓")}
                      </div>
                    )}
                    {!isMobile && (
                      <div className="w-14 flex-shrink-0 hidden xl:block cursor-pointer hover:text-foreground" onClick={() => toggleSort("interval")}>
                        Stability {sortField === "interval" && (sortDir === "asc" ? "↑" : "↓")}
                      </div>
                    )}
                    {!isMobile && <div className="flex-1 min-w-0 hidden lg:block">Tags</div>}
                    {!isMobile && (
                      <div className="w-20 flex-shrink-0 hidden xl:block cursor-pointer hover:text-foreground" onClick={() => toggleSort("review_count")}>
                        Last Review
                      </div>
                    )}
                    {!isMobile && <div className="w-5 flex-shrink-0" />}
                  </div>

                  {/* Card list */}
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {expandedCards.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                        <FolderOpen className="h-8 w-8" />
                        <p className="text-xs">
                          {searchQuery || stateFilter
                            ? "No cards match your filters"
                            : t("review.deckManager.emptyDeck")}
                        </p>
                      </div>
                    ) : isMobile ? (
                      /* Simple scrollable list on mobile — VirtualList needs precise container height */
                      <div className="divide-y divide-border/30">
                        {expandedCards.map((card) => (
                          <DeckManagerCardRow
                            key={card.id}
                            card={card}
                            isSelected={selectedIds.has(card.id)}
                            isExpanded={previewCardId === card.id}
                            onToggleSelect={handleToggleSelect}
                            onExpand={handleExpandCard}
                            isMobile={isMobile}
                            onEditInStudio={onEditInStudio}
                            onSuspend={handleCardSuspend}
                            onUnsuspend={handleCardUnsuspend}
                            onDelete={handleCardDelete}
                            onDuplicate={handleCardDuplicate}
                            onMoveToDeck={handleCardMoveToDeck}
                            decks={deckOptions}
                          />
                        ))}
                      </div>
                    ) : (
                      <DynamicVirtualList
                        items={expandedCards}
                        estimateSize={44}
                        overscan={10}
                        renderItem={(card) => {
                          const isExpanded = previewCardId === card.id;
                          return (
                            <div key={card.id}>
                              <DeckManagerCardRow
                                card={card}
                                isSelected={selectedIds.has(card.id)}
                                isExpanded={isExpanded}
                                onToggleSelect={handleToggleSelect}
                                onExpand={handleExpandCard}
                                isMobile={isMobile}
                                onEditInStudio={onEditInStudio}
                                onSuspend={handleCardSuspend}
                                onUnsuspend={handleCardUnsuspend}
                                onDelete={handleCardDelete}
                                onDuplicate={handleCardDuplicate}
                                onMoveToDeck={handleCardMoveToDeck}
                                decks={deckOptions}
                              />
                            </div>
                          );
                        }}
                      />
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                  <Layers className="h-10 w-10" />
                  <p className="text-sm">{t("review.deckManager.selectDeck")}</p>
                </div>
              )}
            </div>

            {/* Right drag handle */}
            {expandedDeck && !isMobile && (
              <div
                onMouseDown={(e) => { e.preventDefault(); handlePointerDown("right", e.clientX); }}
                onTouchStart={(e) => { handlePointerDown("right", e.touches[0].clientX); }}
                className="hidden lg:block w-1 hover:w-1.5 flex-shrink-0 cursor-col-resize transition-[width] duration-100 z-10 relative group"
                style={{ pointerEvents: "auto" }}
              >
                <div className="absolute inset-0 bg-border group-hover:bg-primary/50 transition-colors" />
              </div>
            )}

            {/* RIGHT SIDEBAR - Card preview or deck stats */}
            {expandedDeck && !isMobile && (
              <div
                className="hidden lg:flex flex-col h-full border-l border-border flex-shrink-0"
                style={{ width: widths.right }}
              >
                {/* Panel toggle */}
                <div className="flex items-center border-b border-border px-2 flex-shrink-0">
                  <button
                    onClick={() => setRightPanelView("preview")}
                    className={`text-xs px-2 py-1.5 transition-colors ${
                      rightPanelView === "preview"
                        ? "text-primary font-medium border-b-2 border-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Card
                  </button>
                  <button
                    onClick={() => setRightPanelView("stats")}
                    className={`text-xs px-2 py-1.5 transition-colors ${
                      rightPanelView === "stats"
                        ? "text-primary font-medium border-b-2 border-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Stats
                  </button>
                </div>
                {rightPanelView === "preview" ? (
                  <CardPreviewPanel
                    card={previewCard}
                    onCardUpdate={handleCardSave}
                    onEditInStudio={onEditInStudio}
                  />
                ) : (
                  <div className="flex-1 overflow-y-auto">
                    <DeckStatsPanel
                      cards={allDeckCards}
                      deck={expandedDeck}
                      onLeechClick={handleLeechFilter}
                      onStudyNow={onStartReview ? handleStudyNow : undefined}
                      onNewCard={handleNewCard}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Deck context menu */}
      {contextMenu && (() => {
        const ctxDeck = decks.find((d) => d.id === contextMenu.deckId);
        if (!ctxDeck) return null;
        const ctxCounts = deckCardCounts.get(contextMenu.deckId);
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
            <div
              className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[180px]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <button
                onClick={() => handleDeckStudy(contextMenu.deckId)}
                className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                Study Deck
                {ctxCounts && ctxCounts.dueToday > 0 && (
                  <span className="ml-auto text-xs text-primary tabular-nums">{ctxCounts.dueToday} due</span>
                )}
              </button>
              <button
                onClick={() => handleDeckRename(contextMenu.deckId)}
                className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                Rename
              </button>
              <button
                onClick={() => handleDeckDuplicate(contextMenu.deckId)}
                className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                Duplicate
              </button>
              <button
                onClick={() => handleDeckExport(contextMenu.deckId)}
                className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                Export as JSON
              </button>
              <button
                onClick={() => handleDeckExportApkg(contextMenu.deckId)}
                className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                <Download className="h-3.5 w-3.5 text-muted-foreground" />
                Export as .apkg
              </button>
              <div className="h-px bg-border my-1" />
              <button
                onClick={() => handleDeckSuspendAll(contextMenu.deckId)}
                className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                <Pause className="h-3.5 w-3.5 text-yellow-500" />
                Suspend All Cards
              </button>
              <button
                onClick={() => handleDeckUnsuspendAll(contextMenu.deckId)}
                className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                <Play className="h-3.5 w-3.5 text-green-500" />
                Unsuspend All Cards
              </button>
              <div className="h-px bg-border my-1" />
              <button
                onClick={() => handleDeckDelete(contextMenu.deckId)}
                className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm hover:bg-destructive/10 text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Deck
              </button>
            </div>
          </>
        );
      })()}
    </div>
  );
}

function StatPill({ icon, label, value, color, highlight }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <div className="text-[10px] text-muted-foreground leading-none">{label}</div>
        <div className={`text-sm font-semibold tabular-nums leading-tight ${color ?? (highlight ? "text-primary" : "text-foreground")}`}>
          {value}
        </div>
      </div>
    </div>
  );
}

function RetagPopover({
  onRetag,
}: {
  onRetag: (add: string[], remove: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [addTags, setAddTags] = useState("");
  const [removeTags, setRemoveTags] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-border hover:bg-muted"
      >
        <Tag className="h-2.5 w-2.5" /> Retag
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        value={addTags}
        onChange={(e) => setAddTags(e.target.value)}
        placeholder="+tags"
        className="w-16 text-xs px-1 py-0.5 rounded border border-border bg-background"
        autoFocus
      />
      <input
        type="text"
        value={removeTags}
        onChange={(e) => setRemoveTags(e.target.value)}
        placeholder="-tags"
        className="w-16 text-xs px-1 py-0.5 rounded border border-border bg-background"
      />
      <button
        onClick={() => {
          const add = addTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
          const remove = removeTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
          if (add.length || remove.length) {
            onRetag(add, remove);
          }
          setOpen(false);
          setAddTags("");
          setRemoveTags("");
        }}
        className="text-xs px-1.5 py-0.5 rounded bg-primary text-primary-foreground"
      >
        Apply
      </button>
      <button
        onClick={() => {
          setOpen(false);
          setAddTags("");
          setRemoveTags("");
        }}
        className="text-xs px-1 py-0.5 rounded border border-border"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

