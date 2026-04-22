import { useState, useEffect, useMemo, useRef } from "react";
import { Trash2, Edit, Tag, Calendar, FileText, Sparkles, Loader2, CheckSquare, Square, X, Eye, PencilLine, PanelsTopLeft } from "lucide-react";
import { getExtracts, updateExtract, type Extract } from "../../api/extracts";
import { generateLearningItemsFromExtract } from "../../api/learning-items";
import { bulkGenerateCards } from "../../api/extract-bulk";
import { useUndoableOperations } from "../../api/undoable";
import { cn } from "../../utils";
import { EditExtractDialog } from "./EditExtractDialog";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { GeneratedCardsPopover } from "../common/GeneratedCardsPopover";
import { RichContentRenderer } from "../common/RichContentRenderer";
import { useI18n } from "../../lib/i18n";
import { FlashcardStudioModal } from "../review/FlashcardStudioModal";
import { EditableContentPalette } from "../common/EditableContentPalette";
import { CreateExtractDialog } from "./CreateExtractDialog";
import { applyAnchoredTextHighlights, buildTextSelectionContext, type AnchoredTextHighlight } from "../../utils/textHighlights";
import type { TextSelectionContext } from "../../types/selection";
import { normalizeHighlightColor } from "../../utils/highlightColors";
import type { ExtractSourceContext } from "../../types/extractNavigation";

interface ExtractsListProps {
  documentId: string;
  focusedExtractId?: string;
  sourceContext?: ExtractSourceContext;
  onBackToSource?: () => void;
  onResumeQueue?: () => void;
}

interface ExtractTextContentProps {
  extract: Extract;
  highlights: AnchoredTextHighlight[];
  onSelection: (payload: { extractId: string; text: string; context: TextSelectionContext; color?: string }) => void;
}

function ExtractTextContent({ extract, highlights, onSelection }: ExtractTextContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const signature = `${extract.id}:${extract.content}`;

  useEffect(() => {
    applyAnchoredTextHighlights({
      root: contentRef.current,
      highlights,
      signature,
    });
  }, [highlights, signature]);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;

    const publishSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return;
      }
      const context = buildTextSelectionContext({
        root,
        range: selection.getRangeAt(0),
        documentId: extract.document_id,
        surface: "extract",
        extractId: extract.id,
      });
      if (!context) return;
      onSelection({ extractId: extract.id, text: context.selectedText, context, color: extract.highlight_color });
    };

    root.addEventListener("mouseup", publishSelection);
    root.addEventListener("keyup", publishSelection);
    return () => {
      root.removeEventListener("mouseup", publishSelection);
      root.removeEventListener("keyup", publishSelection);
    };
  }, [extract.document_id, extract.highlight_color, extract.id, onSelection]);

  return (
    <div
      ref={contentRef}
      className="text-foreground whitespace-pre-wrap"
      dangerouslySetInnerHTML={{ __html: extract.content }}
    />
  );
}

export function ExtractsList({
  documentId,
  focusedExtractId,
  sourceContext,
  onBackToSource,
  onResumeQueue,
}: ExtractsListProps) {
  const [extracts, setExtracts] = useState<Extract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [generatedCounts, setGeneratedCounts] = useState<Record<string, number>>({});

  // Undoable operations hook
  const { bulkDeleteExtracts: bulkDeleteExtractsWithUndo } = useUndoableOperations();

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false);
  const [bulkOperationResult, setBulkOperationResult] = useState<{
    succeeded: string[];
    failed: string[];
    errors: string[];
  } | null>(null);

  // Dialog states
  const [editingExtract, setEditingExtract] = useState<Extract | null>(null);
  const [paletteExtract, setPaletteExtract] = useState<Extract | null>(null);
  const [deletingExtract, setDeletingExtract] = useState<Extract | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isManualStudioOpen, setIsManualStudioOpen] = useState(false);
  const [pendingExtractSelection, setPendingExtractSelection] = useState<{
    extractId: string;
    text: string;
    context: TextSelectionContext;
    initialHighlightColor?: string;
  } | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [manualStudioSeed, setManualStudioSeed] = useState<{
    key: string;
    documentId: string;
    excerpt: string;
    draftCardType: "qa";
    resetDraftCards: true;
    autoEditDraft: true;
  } | null>(null);
  const { t } = useI18n();

  const extractHighlightsByParent = useMemo(() => {
    const map = new Map<string, AnchoredTextHighlight[]>();
    for (const extract of extracts) {
      const context = extract.selection_context as TextSelectionContext | undefined;
      if (!context || context.type !== "text" || context.surface !== "extract" || !context.extractId) {
        continue;
      }
      const current = map.get(context.extractId) ?? [];
      current.push({
        id: extract.id,
        startOffset: context.startOffset,
        endOffset: context.endOffset,
        color: extract.highlight_color,
        title: extract.content,
      });
      map.set(context.extractId, current);
    }
    return map;
  }, [extracts]);

  useEffect(() => {
    const loadExtracts = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getExtracts(documentId);
        setExtracts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("extracts.failedToLoad"));
      } finally {
        setIsLoading(false);
      }
    };

    loadExtracts();
  }, [documentId]);

  useEffect(() => {
    if (!focusedExtractId || extracts.length === 0) return;
    const target = document.getElementById(`extract-card-${focusedExtractId}`);
    if (!target) return;
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [extracts.length, focusedExtractId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleGenerateCards = async (extractId: string) => {
    setGeneratingIds(prev => new Set(prev).add(extractId));
    try {
      const items = await generateLearningItemsFromExtract(extractId);
      setGeneratedCounts(prev => ({ ...prev, [extractId]: items.length }));
      console.log(`Generated ${items.length} learning items from extract ${extractId}`);
    } catch (error) {
      console.error("Failed to generate learning items:", error);
    } finally {
      setGeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(extractId);
        return next;
      });
    }
  };

  const handleCreateCard = (extract: Extract) => {
    setManualStudioSeed({
      key: `${extract.id}-${Date.now()}`,
      documentId: extract.document_id,
      excerpt: extract.content,
      draftCardType: "qa",
      resetDraftCards: true,
      autoEditDraft: true,
    });
    setIsManualStudioOpen(true);
  };

  const handleEdit = (extract: Extract) => {
    setEditingExtract(extract);
    setIsEditDialogOpen(true);
  };

  const handlePalette = (extract: Extract) => {
    setPaletteExtract(extract);
  };

  const handleDelete = (extract: Extract) => {
    setDeletingExtract(extract);
    setIsDeleteDialogOpen(true);
  };

  const handleExtractUpdated = (updated: Extract) => {
    setExtracts(extracts.map((e) => (e.id === updated.id ? updated : e)));
  };

  const handleExtractSelection = (payload: { extractId: string; text: string; context: TextSelectionContext; color?: string }) => {
    setPendingExtractSelection({
      extractId: payload.extractId,
      text: payload.text,
      context: payload.context,
      initialHighlightColor: payload.color || "#fef08a",
    });
  };

  const handleExtractDeleted = (deletedId: string) => {
    setExtracts(extracts.filter((e) => e.id !== deletedId));
    // Also remove from generated counts
    setGeneratedCounts((prev) => {
      const next = { ...prev };
      delete next[deletedId];
      return next;
    });
  };

  // Selection handlers
  const setSelected = (id: string, selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(extracts.map(e => e.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Bulk operation handlers
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkOperationLoading(true);
    setBulkOperationResult(null);

    try {
      const idsToDelete = Array.from(selectedIds);

      // Use undoable delete operation - this will show a toast with undo button
      await bulkDeleteExtractsWithUndo(idsToDelete, () => {
        // onSuccess callback: update local state
        setExtracts(extracts.filter(e => !idsToDelete.includes(e.id)));
        // Also remove from generated counts
        setGeneratedCounts(prev => {
          const next = { ...prev };
          idsToDelete.forEach(id => delete next[id]);
          return next;
        });
        // Clear selection after operation
        setSelectedIds(new Set());
        setBulkOperationResult({
          succeeded: idsToDelete,
          failed: [],
          errors: [],
        });
      });
    } catch (error) {
      console.error("Failed to delete extracts:", error);
      setBulkOperationResult({
        succeeded: [],
        failed: Array.from(selectedIds),
        errors: [error instanceof Error ? error.message : "Unknown error"],
      });
    } finally {
      setBulkOperationLoading(false);
    }
  };

  const handleBulkGenerateCards = async () => {
    if (selectedIds.size === 0) return;
    setBulkOperationLoading(true);
    setBulkOperationResult(null);

    try {
      const result = await bulkGenerateCards(Array.from(selectedIds));
      setBulkOperationResult(result);

      // Update generated counts for successfully processed extracts
      if (result.succeeded.length > 0) {
        setGeneratedCounts(prev => {
          const next = { ...prev };
          result.succeeded.forEach(id => {
            next[id] = (next[id] || 0) + 1; // Assume 1 card per extract for now
          });
          return next;
        });
      }

      // Clear selection after operation
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Failed to generate cards:", error);
    } finally {
      setBulkOperationLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">{t("extracts.loading")}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg">
        {t("extracts.failedToLoad")}: {error}
      </div>
    );
  }

  if (extracts.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {t("extracts.noExtractsYet")}
        </h3>
        <p className="text-muted-foreground">
          {t("extracts.createFirstExtract")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sourceContext && (onBackToSource || onResumeQueue) && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">
                Back to {sourceContext.sourceKind === "book" ? "book" : sourceContext.sourceKind === "article" ? "article" : "source"}
              </div>
              <div className="text-sm text-muted-foreground">{sourceContext.sourceTitle}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onBackToSource && (
                <button
                  onClick={onBackToSource}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {sourceContext.sourceKind === "book" ? "Back to book" : sourceContext.sourceKind === "article" ? "Back to article" : "Back to source"}
                </button>
              )}
              {onResumeQueue && (
                <button
                  onClick={onResumeQueue}
                  className="rounded-md bg-muted px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted/80"
                >
                  Resume queue
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">
          {t("extracts.title")} ({extracts.length})
        </h2>
      </div>

      {/* Bulk Operation Result */}
      {bulkOperationResult && (
        <div className={`p-4 border rounded-lg ${
          bulkOperationResult.failed.length === 0
            ? "bg-green-500/10 border-green-500 text-green-500"
            : "bg-yellow-500/10 border-yellow-500 text-yellow-500"
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {bulkOperationResult.succeeded.length} succeeded
                {bulkOperationResult.failed.length > 0 && (
                  <>, {bulkOperationResult.failed.length} failed</>
                )}
              </p>
              {bulkOperationResult.failed.length > 0 && (
                <div className="text-sm mt-1">
                  {bulkOperationResult.errors.join(", ")}
                </div>
              )}
            </div>
            <button
              onClick={() => setBulkOperationResult(null)}
              className="p-1 hover:bg-black/10 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 p-3 bg-card border border-border rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {selectedIds.size} {t("extracts.extractSelected", { count: selectedIds.size })}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkGenerateCards}
                disabled={bulkOperationLoading}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5 text-sm"
              >
                {bulkOperationLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {t("common.processing")}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    {t("extracts.generateCards")}
                  </>
                )}
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkOperationLoading}
                className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5 text-sm"
              >
                {bulkOperationLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {t("extracts.deleting")}
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    {t("common.delete")}
                  </>
                )}
              </button>
              <button
                onClick={clearSelection}
                className="px-3 py-1.5 bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-colors"
              >
                {t("common.clear")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select All Header */}
      <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
        <button
          onClick={selectedIds.size === extracts.length ? clearSelection : selectAll}
          className="p-2 hover:bg-muted rounded transition-colors"
          title={selectedIds.size === extracts.length ? t("extracts.deselectAll") : t("extracts.selectAll")}
        >
          {selectedIds.size === extracts.length ? (
            <CheckSquare className="w-4 h-4 text-primary" />
          ) : (
            <Square className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        <span className="text-sm text-muted-foreground">
          {selectedIds.size === extracts.length ? t("extracts.allSelected") : t("extracts.selectAll")}
        </span>
      </div>

      <div className="grid gap-4">
        {extracts.map((extract) => (
          <div
            key={extract.id}
            id={`extract-card-${extract.id}`}
            className={cn(
              "p-4 bg-card border border-border rounded-lg hover:shadow-md transition-shadow",
              selectedIds.has(extract.id) && "ring-2 ring-primary",
              focusedExtractId === extract.id && "ring-2 ring-blue-500 ring-offset-2 ring-offset-background"
            )}
          >
            {/* Checkbox */}
            <button
              onClick={() => setSelected(extract.id, !selectedIds.has(extract.id))}
              className="float-left mr-3 mt-1"
              title={selectedIds.has(extract.id) ? t("extracts.deselect") : t("extracts.select")}
            >
              {selectedIds.has(extract.id) ? (
                <CheckSquare className="w-5 h-5 text-primary" />
              ) : (
                <Square className="w-5 h-5 text-muted-foreground" />
              )}
            </button>

            {/* Color bar */}
            {extract.highlight_color && (
              <div
                className="mb-3 h-1 w-full rounded-t-lg"
                style={{ backgroundColor: normalizeHighlightColor(extract.highlight_color) }}
              />
            )}

            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                {extract.category && (
                  <span className="inline-block px-2 py-1 text-xs bg-primary/10 text-primary rounded">
                    {extract.category}
                  </span>
                )}
                {extract.html_content && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-500/10 text-blue-500 rounded" title={t("extracts.richContent")}>
                    <Eye className="w-3 h-3" />
                    {t("extracts.rich")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePalette(extract)}
                  className="p-1.5 rounded hover:bg-muted transition-colors"
                  title="Open extract palette"
                >
                  <PanelsTopLeft className="w-4 h-4 text-muted-foreground" />
                </button>
                <button
                  onClick={() => handleEdit(extract)}
                  className="p-1.5 rounded hover:bg-muted transition-colors"
                  title={t("extracts.editExtract")}
                >
                  <Edit className="w-4 h-4 text-muted-foreground" />
                </button>
                <button
                  onClick={() => handleDelete(extract)}
                  className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                  title={t("extracts.deleteExtract")}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            </div>

            {/* Content with Rich HTML support */}
            <div className="mb-3">
              {extract.html_content ? (
                <RichContentRenderer
                  content={extract.content}
                  htmlContent={extract.html_content}
                  sourceUrl={extract.source_url}
                  mode="full"
                  maxHeight="250px"
                />
              ) : (
                <ExtractTextContent
                  extract={extract}
                  highlights={extractHighlightsByParent.get(extract.id) ?? []}
                  onSelection={handleExtractSelection}
                />
              )}
            </div>

            {pendingExtractSelection?.extractId === extract.id && (
              <div className="mb-3 flex items-center gap-2">
                <button
                  onClick={() => {
                    setPendingExtractSelection((prev) => prev ? { ...prev, initialHighlightColor: "#fef08a" } : prev);
                    setIsCreateDialogOpen(true);
                  }}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground"
                >
                  Highlight selection
                </button>
                <button
                  onClick={() => {
                    setPendingExtractSelection((prev) => prev ? { ...prev, initialHighlightColor: undefined } : prev);
                    setIsCreateDialogOpen(true);
                  }}
                  className="rounded-md bg-muted px-3 py-1.5 text-xs text-foreground"
                >
                  Create extract
                </button>
                <button
                  onClick={() => setPendingExtractSelection(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Notes */}
            {extract.notes && (
              <div className="mb-3 p-3 bg-muted rounded-md">
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  {t("extracts.notes")}
                </div>
                <p className="text-sm text-foreground">{extract.notes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                {extract.page_number && (
                  <span>{t("extracts.page")} {extract.page_number}</span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(extract.date_created)}
                </span>
              </div>

              {/* Tags */}
              {(extract.tags?.length ?? 0) > 0 && (
                <div className="flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  <div className="flex gap-1">
                    {(extract.tags ?? []).map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-0.5 bg-primary/10 text-primary rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Progressive Disclosure */}
            {extract.max_disclosure_level > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {t("extracts.disclosureLevel")}:
                  </span>
                  <div className="flex gap-1">
                    {Array.from({ length: extract.max_disclosure_level }).map(
                      (_, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-6 h-1.5 rounded-full",
                            i < extract.progressive_disclosure_level
                              ? "bg-primary"
                              : "bg-muted"
                          )}
                        />
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Learning Items Section */}
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between gap-2">
                <GeneratedCardsPopover
                  extractId={extract.id}
                  extractTitle={extract.content.slice(0, 100)}
                  initialCount={generatedCounts[extract.id]}
                  renderTrigger={({ onClick, isOpen: _isOpen, count }) => (
                    <button
                      onClick={onClick}
                      className={cn(
                        "text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1",
                        count && "cursor-pointer hover:underline"
                      )}
                    >
                      {count ? (
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-primary" />
                          {count} {t("extracts.cardsGenerated", { count })}
                        </span>
                      ) : (
                        <span>{t("extracts.noCardsGenerated")}</span>
                      )}
                    </button>
                  )}
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCreateCard(extract)}
                    className="px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1.5 bg-muted text-foreground hover:bg-muted/80"
                  >
                    <PencilLine className="w-3 h-3" />
                    {t("extracts.createCardBtn")}
                  </button>
                  <button
                    onClick={() => handleGenerateCards(extract.id)}
                    disabled={generatingIds.has(extract.id)}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1.5",
                      generatingIds.has(extract.id)
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-primary/10 text-primary hover:bg-primary/20"
                    )}
                  >
                    {generatingIds.has(extract.id) ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {t("extracts.generating")}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" />
                        {t("extracts.generateCards")}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dialogs */}
      {editingExtract && (
        <EditExtractDialog
          extract={editingExtract}
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false);
            setEditingExtract(null);
          }}
          onUpdate={handleExtractUpdated}
        />
      )}

      <DeleteConfirmDialog
        extract={deletingExtract}
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setDeletingExtract(null);
        }}
        onDelete={handleExtractDeleted}
      />
      <FlashcardStudioModal
        isOpen={isManualStudioOpen}
        onClose={() => setIsManualStudioOpen(false)}
        seed={manualStudioSeed}
      />
      {paletteExtract && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <EditableContentPalette
            title={paletteExtract.page_title || paletteExtract.content.slice(0, 80) || "Extract"}
            badge="Extract Palette"
            content={paletteExtract.content}
            notes={paletteExtract.notes ?? ""}
            contentKind="markdown"
            sourceUrl={paletteExtract.source_url}
            placeholder="Refine the extract text here..."
            notesPlaceholder="Add context, questions, or your own gloss..."
            emptyPreviewMessage="The extract preview will appear here."
            onClose={() => setPaletteExtract(null)}
            onSave={async ({ content, notes }) => {
              const updated = await updateExtract({
                id: paletteExtract.id,
                content,
                note: notes,
              });
              setExtracts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
              setPaletteExtract(updated);
            }}
          />
        </div>
      )}
      {pendingExtractSelection && (
        <CreateExtractDialog
          documentId={documentId}
          selectedText={pendingExtractSelection.text}
          selectionContext={pendingExtractSelection.context}
          initialHighlightColor={pendingExtractSelection.initialHighlightColor}
          isOpen={isCreateDialogOpen}
          onClose={() => {
            setIsCreateDialogOpen(false);
            setPendingExtractSelection(null);
          }}
          onCreate={(extract) => {
            setExtracts((prev) => [...prev, extract]);
            setIsCreateDialogOpen(false);
            setPendingExtractSelection(null);
          }}
        />
      )}
    </div>
  );
}
