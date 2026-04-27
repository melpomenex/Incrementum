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
  Filter,
  X,
  Loader2,
  Inbox,
  FolderOpen,
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
type StateFilter = "" | "New" | "Learning" | "Review" | "Relearning";
type DueFilter = "" | "today" | "overdue" | "not-due";

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
  const [dueFilter, setDueFilter] = useState<DueFilter>("");
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

  const deckCardCounts = useMemo(() => {
    const now = new Date().toISOString().slice(0, 10);
    const map = new Map<string, { total: number; dueToday: number }>();
    for (const deck of decks) {
      const cards = getCardsForDeck(deck);
      map.set(deck.id, {
        total: cards.length,
        dueToday: cards.filter((c) => c.due_date.slice(0, 10) <= now).length,
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
      cards = cards.filter((c) => c.state === stateFilter);
    }

    if (dueFilter) {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      if (dueFilter === "today") {
        cards = cards.filter((c) => c.due_date.slice(0, 10) <= today);
      } else if (dueFilter === "overdue") {
        cards = cards.filter((c) => c.due_date.slice(0, 10) < today);
      } else if (dueFilter === "not-due") {
        cards = cards.filter((c) => c.due_date.slice(0, 10) > today);
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
    dueFilter,
    sortField,
    sortDir,
  ]);

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
    setStateFilter("" as StateFilter);
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

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("review.backToHome")}
        </button>
        <h2 className="text-lg font-semibold">
          {t("review.deckManager.title")}
        </h2>
        <span className="text-xs text-muted-foreground">
          {allCards.length} cards · {decks.length} decks
        </span>
      </div>

      {/* Search bar */}
      <div className="px-4 py-2 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("review.deckManager.searchPlaceholder")}
            className="w-full pl-9 pr-4 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
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
            {/* Deck list */}
            <div className="w-64 flex-shrink-0 border-r border-border overflow-y-auto">
              <div className="p-2 space-y-0.5">
                {decks.map((deck) => {
                  const counts = deckCardCounts.get(deck.id) ?? {
                    total: 0,
                    dueToday: 0,
                  };
                  const isExpanded = expandedDeckId === deck.id;

                  return (
                    <button
                      key={deck.id}
                      onClick={() =>
                        setExpandedDeckId(isExpanded ? null : deck.id)
                      }
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                        isExpanded
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted/50 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {deck.name}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                            <span>{counts.total} cards</span>
                            {counts.dueToday > 0 && (
                              <span className="text-primary">
                                {counts.dueToday} due
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5 ml-5.5">
                        {deck.tagFilters.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                          >
                            {tag}
                          </span>
                        ))}
                        {deck.tagFilters.length > 3 && (
                          <span className="text-[9px] text-muted-foreground">
                            +{deck.tagFilters.length - 3}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Card list area */}
            <div className="flex-1 flex flex-col min-w-0">
              {expandedDeck ? (
                <>
                  {/* Sort/Filter bar */}
                  <div className="px-3 py-2 border-b border-border/50 space-y-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(
                        [
                          ["due_date", "Due"],
                          ["state", "State"],
                          ["difficulty", "Diff"],
                          ["interval", "Int."],
                          ["review_count", "Reviews"],
                          ["lapses", "Lapses"],
                        ] as [SortField, string][]
                      ).map(([field, label]) => (
                        <button
                          key={field}
                          onClick={() => toggleSort(field)}
                          className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                            sortField === field
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/30"
                          }`}
                        >
                          {label}
                          {sortField === field &&
                            (sortDir === "asc" ? " ↑" : " ↓")}
                        </button>
                      ))}

                      <div className="ml-auto flex items-center gap-1.5">
                        <button
                          onClick={() => setShowFilters(!showFilters)}
                          className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                            showFilters || stateFilter || dueFilter
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/30"
                          }`}
                        >
                          <Filter className="h-3 w-3 inline mr-1" />
                          Filter
                        </button>
                        <button
                          onClick={handleSelectAll}
                          className="text-[10px] px-2 py-1 rounded-md border border-border text-muted-foreground hover:border-primary/30"
                        >
                          {selectedIds.size === expandedCards.length &&
                          expandedCards.length > 0
                            ? "Deselect all"
                            : "Select all"}
                        </button>
                      </div>
                    </div>

                    {showFilters && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(["New", "Learning", "Review", "Relearning"] as const).map(
                          (s) => (
                            <button
                              key={s}
                              onClick={() =>
                                setStateFilter(stateFilter === s ? "" : s)
                              }
                              className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                                stateFilter === s
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border text-muted-foreground hover:border-primary/30"
                              }`}
                            >
                              {s}
                            </button>
                          )
                        )}
                        <span className="text-border">|</span>
                        {(
                          [
                            ["today", "Due today"],
                            ["overdue", "Overdue"],
                            ["not-due", "Not due"],
                          ] as [DueFilter, string][]
                        ).map(([val, label]) => (
                          <button
                            key={val}
                            onClick={() =>
                              setDueFilter(dueFilter === val ? "" : val)
                            }
                            className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                              dueFilter === val
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/30"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bulk action toolbar */}
                  {selectedIds.size > 0 && (
                    <div className="px-3 py-2 border-b border-border/50 bg-primary/5 flex items-center gap-2">
                      <span className="text-xs text-primary font-medium">
                        {selectedIds.size} selected
                      </span>
                      <button
                        onClick={handleBulkSuspend}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border border-border hover:bg-muted"
                      >
                        <Ban className="h-3 w-3" /> Suspend
                      </button>
                      <button
                        onClick={handleBulkUnsuspend}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border border-border hover:bg-muted"
                      >
                        <Play className="h-3 w-3" /> Unsuspend
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                      <RetagPopover onRetag={handleBulkRetag} />
                    </div>
                  )}

                  {/* Delete confirmation */}
                  {showDeleteConfirm && (
                    <div className="px-3 py-2 border-b border-destructive/20 bg-destructive/5 flex items-center gap-3">
                      <span className="text-xs text-destructive">
                        Delete {selectedIds.size} cards? This cannot be undone.
                      </span>
                      <button
                        onClick={handleBulkDelete}
                        className="text-xs px-2 py-1 rounded bg-destructive text-destructive-foreground"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="text-xs px-2 py-1 rounded border border-border"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Card list */}
                  <div className="flex-1 overflow-hidden flex">
                    <div className="flex-1 overflow-y-auto">
                      {expandedCards.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                          <FolderOpen className="h-8 w-8" />
                          <p className="text-sm">
                            {searchQuery || stateFilter || dueFilter
                              ? "No cards match your filters"
                              : t("review.deckManager.emptyDeck")}
                          </p>
                        </div>
                      ) : (
                        <DynamicVirtualList
                          items={expandedCards}
                          estimateSize={44}
                          overscan={5}
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

                    {/* Stats sidebar */}
                    <div className="w-64 flex-shrink-0 border-l border-border overflow-y-auto p-3">
                      <DeckStatsPanel
                        cards={allDeckCards}
                        deckName={expandedDeck.name}
                        onLeechClick={handleLeechFilter}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                  <Layers className="h-10 w-10" />
                  <p className="text-sm">
                    {t("review.deckManager.selectDeck")}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
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
        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border border-border hover:bg-muted"
      >
        <Tag className="h-3 w-3" /> Retag
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        value={addTags}
        onChange={(e) => setAddTags(e.target.value)}
        placeholder="+tags"
        className="w-20 text-[10px] px-1.5 py-1 rounded border border-border bg-background"
        autoFocus
      />
      <input
        type="text"
        value={removeTags}
        onChange={(e) => setRemoveTags(e.target.value)}
        placeholder="-tags"
        className="w-20 text-[10px] px-1.5 py-1 rounded border border-border bg-background"
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
        className="text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground"
      >
        Apply
      </button>
      <button
        onClick={() => {
          setOpen(false);
          setAddTags("");
          setRemoveTags("");
        }}
        className="text-[10px] px-2 py-1 rounded border border-border"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
