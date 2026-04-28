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
} from "lucide-react";
import { useStudyDeckStore } from "../../stores/studyDeckStore";
import { useI18n } from "../../lib/i18n";
import { useToast } from "../common/Toast";
import { getAllLearningItems, type LearningItem } from "../../api/learning-items";
import { bulkSuspendItems, bulkUnsuspendItems, bulkDeleteItems } from "../../api/queue";
import { filterByDecks, matchesDeckTags } from "../../utils/studyDecks";
import { DynamicVirtualList } from "../common/VirtualList";
import { DeckManagerCardRow } from "./DeckManagerCardRow";
import { InlineCardEditor } from "./InlineCardEditor";
import { DeckStatsPanel } from "./DeckStatsPanel";
import type { StudyDeck } from "../../types/study-decks";

type SortField = "due_date" | "state" | "difficulty" | "interval" | "review_count" | "lapses";
type SortDir = "asc" | "desc";
type StateFilter = "" | "New" | "Learning" | "Review" | "Relearning" | "Suspended" | "Leeches";

interface DeckManagerProps {
  onBack: () => void;
  onEditInStudio?: (card: LearningItem) => void;
}

export function DeckManager({ onBack, onEditInStudio }: DeckManagerProps) {
  const { t } = useI18n();
  const toast = useToast();
  const { decks } = useStudyDeckStore();

  const [allCards, setAllCards] = useState<LearningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDeckId, setExpandedDeckId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [sortField, setSortField] = useState<SortField>("due_date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [stateFilter, setStateFilter] = useState<StateFilter>("");
  const [showFilters, setShowFilters] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAllLearningItems()
      .then((cards) => {
        if (!cancelled) {
          setAllCards(Array.isArray(cards) ? cards : []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Failed to load cards");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

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
        dueToday: cards.filter((c) => !c.is_suspended && c.due_date.slice(0, 10) <= now).length,
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
          cmp = a.due_date.localeCompare(b.due_date);
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
      setExpandedCardId((prev) => (prev === id ? null : id));
    },
    []
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
        if (expandedCardId) {
          setExpandedCardId(null);
        } else if (expandedDeckId) {
          setExpandedDeckId(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expandedCardId, expandedDeckId]);

  const allDeckCards = expandedDeck ? getCardsForDeck(expandedDeck) : [];

  // Inline stats for the active deck
  const inlineStats = useMemo(() => {
    if (!expandedDeck) return null;
    const cards = getCardsForDeck(expandedDeck);
    const now = new Date().toISOString().slice(0, 10);
    const dueToday = cards.filter((c) => !c.is_suspended && c.due_date.slice(0, 10) <= now).length;
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
        <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
          {allCards.length} cards · {decks.length} decks
        </span>
      </div>

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
          <div className="flex h-full">
            {/* LEFT SIDEBAR - Deck tree */}
            <div className="w-[220px] flex-shrink-0 border-r border-border overflow-y-auto">
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
                          <div className="text-sm font-medium truncate">{deck.name}</div>
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

            {/* CENTER - Card table area */}
            <div className="flex-1 flex flex-col min-w-0">
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
                  <div className="px-3 py-1.5 border-b border-border/50 space-y-1.5 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 max-w-xs">
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

                      {/* Filter chips with counts */}
                      <div className="flex items-center gap-1 flex-wrap">
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

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                        <button className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:border-primary/30 hover:text-foreground">
                          <Plus className="h-3 w-3" /> New Card
                        </button>
                        <button className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:border-primary/30 hover:text-foreground">
                          <Download className="h-3 w-3" /> Import
                        </button>
                        <button className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-primary text-primary-foreground">
                          <GraduationCap className="h-3 w-3" /> Study Now
                        </button>
                      </div>
                    </div>

                    {/* Sort + select all row */}
                    <div className="flex items-center gap-1">
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
                      <div className="ml-auto flex items-center gap-1">
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
                      <span className="text-[10px] text-destructive">
                        Delete {selectedIds.size} cards? This cannot be undone.
                      </span>
                      <button
                        onClick={handleBulkDelete}
                        className="text-[10px] px-2 py-0.5 rounded bg-destructive text-destructive-foreground"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="text-[10px] px-2 py-0.5 rounded border border-border"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Column headers */}
                  <div className="flex items-center gap-2 px-3 py-1 border-b border-border/50 text-xs font-medium text-muted-foreground uppercase tracking-wider flex-shrink-0 select-none">
                    <div className="w-4 flex-shrink-0" />
                    <div className="w-[180px] flex-shrink-0">Card</div>
                    <div className="w-12 flex-shrink-0">Type</div>
                    <div className="w-16 flex-shrink-0 cursor-pointer hover:text-foreground" onClick={() => toggleSort("due_date")}>
                      Due {sortField === "due_date" && (sortDir === "asc" ? "↑" : "↓")}
                    </div>
                    <div className="w-20 flex-shrink-0 cursor-pointer hover:text-foreground" onClick={() => toggleSort("difficulty")}>
                      Difficulty {sortField === "difficulty" && (sortDir === "asc" ? "↑" : "↓")}
                    </div>
                    <div className="w-14 flex-shrink-0 cursor-pointer hover:text-foreground" onClick={() => toggleSort("interval")}>
                      Stability {sortField === "interval" && (sortDir === "asc" ? "↑" : "↓")}
                    </div>
                    <div className="flex-1 min-w-0">Tags</div>
                    <div className="w-20 flex-shrink-0 cursor-pointer hover:text-foreground" onClick={() => toggleSort("review_count")}>
                      Last Review
                    </div>
                    <div className="w-5 flex-shrink-0" />
                  </div>

                  {/* Card list with VirtualList */}
                  <div className="flex-1 overflow-y-auto">
                    {expandedCards.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                        <FolderOpen className="h-8 w-8" />
                        <p className="text-xs">
                          {searchQuery || stateFilter
                            ? "No cards match your filters"
                            : t("review.deckManager.emptyDeck")}
                        </p>
                      </div>
                    ) : (
                      <DynamicVirtualList
                        items={expandedCards}
                        estimateSize={44}
                        overscan={10}
                        renderItem={(card) => {
                          const isExpanded = expandedCardId === card.id;
                          return (
                            <div key={card.id}>
                              <DeckManagerCardRow
                                card={card}
                                isSelected={selectedIds.has(card.id)}
                                isExpanded={isExpanded}
                                onToggleSelect={handleToggleSelect}
                                onExpand={handleExpandCard}
                              />
                              {isExpanded && (
                                <InlineCardEditor
                                  card={card}
                                  onClose={() => setExpandedCardId(null)}
                                  onSave={handleCardSave}
                                  onEditInStudio={onEditInStudio}
                                />
                              )}
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

            {/* RIGHT SIDEBAR - Deck details + stats */}
            {expandedDeck && (
              <div className="w-[280px] flex-shrink-0 border-l border-border overflow-y-auto">
                <DeckStatsPanel
                  cards={allDeckCards}
                  deck={expandedDeck}
                  onLeechClick={handleLeechFilter}
                />
              </div>
            )}
          </div>
        )}
      </div>
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
        className="w-16 text-[10px] px-1 py-0.5 rounded border border-border bg-background"
        autoFocus
      />
      <input
        type="text"
        value={removeTags}
        onChange={(e) => setRemoveTags(e.target.value)}
        placeholder="-tags"
        className="w-16 text-[10px] px-1 py-0.5 rounded border border-border bg-background"
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
        className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground"
      >
        Apply
      </button>
      <button
        onClick={() => {
          setOpen(false);
          setAddTags("");
          setRemoveTags("");
        }}
        className="text-[10px] px-1 py-0.5 rounded border border-border"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}
