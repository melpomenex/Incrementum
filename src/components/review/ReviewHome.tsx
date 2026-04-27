import { useEffect, useMemo, useState } from "react";
import { BarChart3, Compass, FolderKanban, Layers, Plus, RefreshCw, Sparkles, Tag, Upload, Zap } from "lucide-react";
import { useDocumentStore } from "../../stores/documentStore";
import { useReviewStore } from "../../stores/reviewStore";
import { useStudyDeckStore } from "../../stores/studyDeckStore";
import { getDueItems, type LearningItem } from "../../api/review";
import { filterByDecks, matchesDeckTags, normalizeTagList } from "../../utils/studyDecks";
import type { StudyDeck } from "../../types/study-decks";
import { FlashcardStudioModal } from "./FlashcardStudioModal";
import { ReviewDecksModal } from "./ReviewDecksModal";
import { ReviewPreviewModal } from "./ReviewPreviewModal";
import { invokeCommand, openFilePicker } from "../../lib/tauri";
import { useToast } from "../common/Toast";
import { useI18n } from "../../lib/i18n";

interface ReviewHomeProps {
  onStartReview: () => Promise<void>;
  onOpenDeckManager?: () => void;
}

function toDateOnly(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function parseDueDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatMinutes(totalSeconds: number) {
  const totalMinutes = Math.max(1, Math.round(totalSeconds / 60));
  return `${totalMinutes} min`;
}

function inferAnkiDeckNames(imported: unknown[]): string[] {
  const names = new Set<string>();
  for (const item of imported) {
    if (!item || typeof item !== "object") continue;
    const tagsRaw = (item as { tags?: unknown }).tags;
    if (!Array.isArray(tagsRaw)) continue;
    const tags = tagsRaw.filter((t): t is string => typeof t === "string" && t.trim().length > 0);
    if (!tags.some((tag) => tag.toLowerCase() === "anki-import")) continue;
    const deckName = tags[tags.length - 1]?.trim();
    if (deckName && deckName.toLowerCase() !== "anki-import") {
      names.add(deckName);
    }
  }
  return Array.from(names);
}

export function ReviewHome({ onStartReview, onOpenDeckManager }: ReviewHomeProps) {
  const { documents, loadDocuments } = useDocumentStore();
  const { loadStreak, streak, streakLoading } = useReviewStore();
  const {
    decks,
    activeDeckIds,
    toggleDeckSelection,
    clearDeckSelection,
    addDeck,
    updateDeck,
    removeDeck,
    seedFromDocuments,
  } = useStudyDeckStore();

  const [dueItems, setDueItems] = useState<LearningItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckTags, setNewDeckTags] = useState("");
  const [isFlashcardStudioOpen, setIsFlashcardStudioOpen] = useState(false);
  const [isReviewPreviewOpen, setIsReviewPreviewOpen] = useState(false);
  const [isDecksModalOpen, setIsDecksModalOpen] = useState(false);
  const [isAnkiImporting, setIsAnkiImporting] = useState(false);
  const toast = useToast();
  const { t } = useI18n();

  const activeDeck = useMemo(
    () => {
      if (activeDeckIds.length === 1) return (decks || []).find((deck) => deck.id === activeDeckIds[0]) ?? null;
      if (activeDeckIds.length === 0) return null;
      return null; // multi-select: no single deck
    },
    [decks, activeDeckIds]
  );

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (documents.length > 0) {
      seedFromDocuments(documents);
    }
  }, [documents, seedFromDocuments]);

  const loadStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await getDueItems();
      setDueItems(items);
      await loadStreak();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("reviewHome.failedToLoadStats"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    const handler = () => setIsFlashcardStudioOpen(true);
    window.addEventListener("open-flashcard-studio", handler);
    return () => window.removeEventListener("open-flashcard-studio", handler);
  }, []);

  const activeDecks = useMemo(
    () => activeDeckIds.map((id) => (decks || []).find((d) => d.id === id)).filter((d): d is StudyDeck => d != null),
    [decks, activeDeckIds]
  );

  const scopedItems = useMemo(() => {
    if (activeDecks.length === 0) return dueItems;
    return filterByDecks(dueItems, activeDecks);
  }, [dueItems, activeDecks]);

  const today = toDateOnly(new Date());
  const dueToday = scopedItems.filter((item) => {
    const dueDate = parseDueDate(item.due_date);
    return dueDate ? toDateOnly(dueDate) <= today : true;
  });

  const newCount = scopedItems.filter((item) => item.state === "new").length;
  const learningCount = scopedItems.filter((item) => item.state === "learning" || item.state === "relearning").length;
  const reviewCount = scopedItems.filter((item) => item.state === "review").length;

  const estimatedSeconds = scopedItems.length * 30;

  const deckStats = useMemo(() => {
    return (decks || []).map((deck) => ({
      deck,
      count: dueItems.filter((item) => matchesDeckTags(item.tags ?? [], deck)).length,
    }));
  }, [decks, dueItems]);

  const handleAddDeck = () => {
    const name = newDeckName.trim();
    if (!name) return;
    const tags = normalizeTagList(newDeckTags.split(",").map((tag) => tag.trim()));
    addDeck(name, tags.length > 0 ? tags : [name]);
    setNewDeckName("");
    setNewDeckTags("");
  };

  const handleAddTag = (deck: StudyDeck, tag: string) => {
    const nextTags = normalizeTagList([...deck.tagFilters, tag]);
    updateDeck(deck.id, { tagFilters: nextTags });
  };

  const handleRemoveTag = (deck: StudyDeck, tag: string) => {
    const nextTags = deck.tagFilters.filter((t) => t !== tag);
    updateDeck(deck.id, { tagFilters: nextTags });
  };

  const handleImportDeck = async () => {
    if (isAnkiImporting) return;
    setIsAnkiImporting(true);
    try {
      const selected = await openFilePicker({
        title: t("reviewSession.importDeckDialogTitle"),
        multiple: false,
        filters: [{ name: t("reviewSession.deckFiles"), extensions: ["apkg", "json"] }],
      });
      if (!selected || selected.length === 0) return;

      const filePath = selected[0];
      const ext = filePath.toLowerCase().split(".").pop();

      if (ext === "json") {
        const result = await invokeCommand<{ deck_name: string; cards_imported: number }>(
          "import_study_json_file",
          { filePath }
        );
        const deckNames = [result.deck_name];
        const deckIds = useStudyDeckStore.getState().ensureDecksExist(deckNames);
        if (deckIds.length > 0) {
          clearDeckSelection();
          toggleDeckSelection(deckIds[0]);
        }
        await loadStats();
        toast.success(
          t("reviewSession.deckImportComplete"),
          t("reviewSession.deckImportSummary", { cards: result.cards_imported, decks: 1 })
        );
      } else {
        const imported = await invokeCommand<unknown[]>("import_anki_package_to_learning_items", {
          apkgPath: filePath,
        });
        const deckNames = inferAnkiDeckNames(imported);
        const deckIds = useStudyDeckStore.getState().ensureDecksExist(deckNames);
        if (deckIds.length > 0) {
          clearDeckSelection();
          toggleDeckSelection(deckIds[0]);
        }
        await loadStats();
        toast.success(
          t("reviewSession.ankiImportComplete"),
          t("reviewSession.ankiImportSummary", { cards: imported.length, decks: deckNames.length || 1 })
        );
      }
    } catch (error) {
      toast.error(
        t("reviewSession.ankiImportFailed"),
        error instanceof Error ? error.message : t("reviewSession.unknownImportError")
      );
    } finally {
      setIsAnkiImporting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{t("review.title")}</h1>
              <p className="text-muted-foreground">
                {t("review.subtitle")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsDecksModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                <Layers className="h-4 w-4" />
                {t("reviewHome.viewDecks")}
              </button>
              <button
                onClick={loadStats}
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                <RefreshCw className="h-4 w-4" />
                {t("common.refresh")}
              </button>
              <button
                onClick={() => setIsFlashcardStudioOpen(true)}
                className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary hover:bg-primary/15"
              >
                <Sparkles className="h-4 w-4" />
                {t("extracts.createFlashcards")}
              </button>
              <button
                onClick={handleImportDeck}
                disabled={isAnkiImporting}
                className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Upload className="h-4 w-4" />
                {isAnkiImporting ? t("review.importing") : t("review.importDeck")}
              </button>
              {onOpenDeckManager && (
                <button
                  onClick={onOpenDeckManager}
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted"
                >
                  <FolderKanban className="h-4 w-4" />
                  {t("review.deckManager.title")}
                </button>
              )}
              <button
                onClick={() => setIsReviewPreviewOpen(true)}
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                <Zap className="h-4 w-4" />
                {t("dashboard.startReview")}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("reviewHome.inSessionTools")} <kbd className="px-1 py-0.5 rounded bg-muted">Ctrl/⌘+I</kbd> {t("reviewHome.fsrsInspector")},{" "}
            <kbd className="px-1 py-0.5 rounded bg-muted">Ctrl/⌘+Shift+Z</kbd> {t("reviewHome.zenMode")}.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => clearDeckSelection()}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                activeDeckIds.length === 0
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {t("reviewHome.allDecks")}
            </button>
            {decks?.map((deck) => (
              <button
                key={deck.id}
                onClick={() => toggleDeckSelection(deck.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  activeDeckIds.includes(deck.id)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {deck.name}
              </button>
            ))}
          </div>

          {error && (
            <div className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {isLoading && (
            <div className="text-xs text-muted-foreground">{t("reviewHome.refreshingStats")}</div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                <span>{t("reviewHome.totalDue")}</span>
                <BarChart3 className="h-4 w-4" />
              </div>
              <div className="mt-2 text-3xl font-semibold text-foreground">{scopedItems.length}</div>
              <p className="mt-1 text-xs text-muted-foreground">{t("reviewHome.totalDueDesc")}</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                <span>{t("reviewHome.dueToday")}</span>
                <Compass className="h-4 w-4" />
              </div>
              <div className="mt-2 text-3xl font-semibold text-foreground">{dueToday.length}</div>
              <p className="mt-1 text-xs text-muted-foreground">{t("reviewHome.dueTodayDesc")}</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                <span>{t("reviewHome.newVsReview")}</span>
                <Layers className="h-4 w-4" />
              </div>
              <div className="mt-2 text-lg font-semibold text-foreground">
                {t("reviewHome.newVsReviewValue", { newCount, learningCount, reviewCount })}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t("reviewHome.newVsReviewDesc")}</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                <span>{t("reviewHome.estimatedTime")}</span>
                <Zap className="h-4 w-4" />
              </div>
              <div className="mt-2 text-3xl font-semibold text-foreground">{formatMinutes(estimatedSeconds)}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("reviewHome.streakSummary", {
                  streak: streakLoading ? "..." : streak?.current_streak ?? 0,
                  longest: streakLoading ? "..." : streak?.longest_streak ?? 0,
                })}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("reviewHome.totalReviews", { count: streakLoading ? "..." : streak?.total_reviews ?? 0 })}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">{t("reviewHome.decksTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("reviewHome.decksDesc")}</p>
              </div>
              <button
                onClick={() => clearDeckSelection()}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t("reviewHome.resetSelection")}
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {!decks || decks.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  {t("reviewHome.noDecks")}
                </div>
              )}
              {deckStats?.map(({ deck, count }) => (
                <button
                  key={deck.id}
                  onClick={() => toggleDeckSelection(deck.id)}
                  onDoubleClick={() => {
                    clearDeckSelection();
                    toggleDeckSelection(deck.id);
                    onStartReview();
                  }}
                  className={`flex flex-col gap-2 rounded-lg border px-4 py-3 text-left transition-colors ${
                    activeDeckIds.includes(deck.id)
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold text-foreground">{deck.name}</span>
                    <span className="text-xs text-muted-foreground">{t("reviewHome.countDue", { count })}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {deck.tagFilters.map((tag) => (
                      <span key={tag} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              <div>
                <h2 className="text-lg font-semibold text-foreground">{t("reviewHome.tagManagerTitle")}</h2>
                <p className="text-xs text-muted-foreground">
                  {t("reviewHome.tagManagerDesc")}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {!decks || decks.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("reviewHome.createDeckPrompt")}</p>
              )}
              {decks?.map((deck) => (
                <div key={deck.id} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-center justify-between">
                    <input
                      value={deck.name}
                      onChange={(e) => updateDeck(deck.id, { name: e.target.value })}
                      className="w-full bg-transparent text-sm font-semibold text-foreground outline-none"
                    />
                    <button
                      onClick={() => removeDeck(deck.id)}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      {t("reviewHome.remove")}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {deck.tagFilters.map((tag) => (
                      <button
                        key={`${deck.id}-${tag}`}
                        onClick={() => handleRemoveTag(deck, tag)}
                        className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title={t("reviewHome.removeTag")}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      placeholder={t("reviewHome.addTag")}
                      className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          const value = (event.target as HTMLInputElement).value.trim();
                          if (value.length > 0) {
                            handleAddTag(deck, value);
                            (event.target as HTMLInputElement).value = "";
                          }
                        }
                      }}
                    />
                    <button
                      onClick={(event) => {
                        const input = (event.currentTarget.previousElementSibling as HTMLInputElement | null);
                        if (!input) return;
                        const value = input.value.trim();
                        if (value.length === 0) return;
                        handleAddTag(deck, value);
                        input.value = "";
                      }}
                      className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                    >
                      {t("reviewHome.add")}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-dashed border-border p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Plus className="h-3 w-3" />
                {t("reviewHome.createNewDeck")}
              </div>
              <div className="mt-2 space-y-2">
                <input
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  placeholder={t("reviewHome.deckName")}
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                />
                <input
                  value={newDeckTags}
                  onChange={(e) => setNewDeckTags(e.target.value)}
                  placeholder={t("reviewHome.tagsCommaSeparated")}
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                />
                <button
                  onClick={handleAddDeck}
                  className="w-full rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90"
                >
                  {t("reviewHome.createDeck")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <FlashcardStudioModal
        isOpen={isFlashcardStudioOpen}
        onClose={() => setIsFlashcardStudioOpen(false)}
      />
      <ReviewPreviewModal
        isOpen={isReviewPreviewOpen}
        onClose={() => setIsReviewPreviewOpen(false)}
        onStartReview={onStartReview}
        totalCards={scopedItems.length}
        newCards={newCount}
        learningCards={learningCount}
        reviewCards={reviewCount}
        estimatedMinutes={Math.ceil(estimatedSeconds / 60)}
        deckName={activeDeck?.name}
      />
      <ReviewDecksModal
        isOpen={isDecksModalOpen}
        onClose={() => setIsDecksModalOpen(false)}
        decks={decks}
        deckStats={deckStats}
        activeDeckIds={activeDeckIds}
        onToggleDeck={toggleDeckSelection}
        onClearSelection={clearDeckSelection}
      />
    </div>
  );
}
