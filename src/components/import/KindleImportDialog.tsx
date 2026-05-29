/**
 * Kindle Clippings Import Dialog
 *
 * Modal dialog that previews Kindle clippings before importing.
 * Shows per-book breakdown with new/existing counts, sorted by new content.
 */

import { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Loader2,
  AlertCircle,
  Highlighter,
  StickyNote,
  Bookmark,
  AlertTriangle,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useCollectionStore } from "../../stores/collectionStore";
import type {
  KindlePreviewResult,
  KindleBookPreview,
  KindleImportResult,
} from "../../utils/kindleClippingsImport";
import {
  validateKindleClippings,
  importKindleClippings,
} from "../../utils/kindleClippingsImport";

type DialogState = "idle" | "validating" | "preview" | "importing" | "done" | "error";

interface KindleImportDialogProps {
  filePath: string | null;
  onClose: () => void;
  onImportComplete?: (result: KindleImportResult) => void;
}

export function KindleImportDialog({
  filePath,
  onClose,
  onImportComplete,
}: KindleImportDialogProps) {
  const { t } = useI18n();

  const [state, setState] = useState<DialogState>(filePath ? "validating" : "idle");
  const [preview, setPreview] = useState<KindlePreviewResult | null>(null);
  const [importResult, setImportResult] = useState<KindleImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsedBooks, setCollapsedBooks] = useState<Set<string>>(new Set());

  const doValidate = useCallback(async () => {
    if (!filePath) return;
    setState("validating");
    setError(null);
    try {
      const result = await validateKindleClippings(filePath);
      setPreview(result);
      setState("preview");
      // Auto-collapse fully-imported books
      const fullyImported = new Set<string>(
        result.books
          .filter((b) => b.newHighlights + b.newNotes === 0)
          .map((b) => b.title)
      );
      setCollapsedBooks(fullyImported);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }, [filePath]);

  useEffect(() => {
    if (filePath) doValidate();
  }, [filePath, doValidate]);

  const handleImport = useCallback(async () => {
    if (!filePath) return;
    setState("importing");
    setError(null);
    try {
      const collectionId = useCollectionStore.getState().activeCollectionId;
      const result = await importKindleClippings(filePath, collectionId);
      setImportResult(result);
      setState("done");
      onImportComplete?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }, [filePath, onImportComplete]);

  const toggleBookCollapse = useCallback((title: string) => {
    setCollapsedBooks((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }, []);

  const totalNew = preview?.totalNewExtracts ?? 0;
  const fullyImportedCount =
    preview?.books.filter((b) => b.newHighlights + b.newNotes === 0).length ?? 0;

  if (state === "idle") return null;

  if (state === "validating") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-card rounded-xl border border-border shadow-2xl p-8 max-w-md w-full mx-4 flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {t("kindleImport.validating")}
          </p>
        </div>
      </div>
    );
  }

  if (state === "importing") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-card rounded-xl border border-border shadow-2xl p-8 max-w-md w-full mx-4 flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {t("kindleImport.importing")}
          </p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-card rounded-xl border border-border shadow-2xl p-6 max-w-md w-full mx-4 space-y-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold text-foreground">{t("kindleImport.errorTitle")}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{error}</p>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-opacity"
            >
              {t("common.close")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state === "done" && importResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-card rounded-xl border border-border shadow-2xl p-6 max-w-md w-full mx-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30">
              <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{t("kindleImport.successTitle")}</h3>
              <p className="text-xs text-muted-foreground">
                {t("kindleImport.successSubtitle")}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-lg font-bold text-foreground">{importResult.newDocuments}</div>
              <div className="text-xs text-muted-foreground">{t("kindleImport.newBooks")}</div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-lg font-bold text-foreground">{importResult.newExtracts}</div>
              <div className="text-xs text-muted-foreground">{t("kindleImport.newExtracts")}</div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-lg font-bold text-foreground">{importResult.updatedDocuments}</div>
              <div className="text-xs text-muted-foreground">{t("kindleImport.updatedBooks")}</div>
            </div>
          </div>
          {importResult.warnings.length > 0 && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg space-y-1">
              {importResult.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">{w}</p>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-opacity"
            >
              {t("common.done")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // state === "preview"
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-xl border border-border shadow-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold text-foreground">{t("kindleImport.title")}</h3>
              <p className="text-xs text-muted-foreground">
                {preview?.books.length ?? 0} {t("kindleImport.booksFound")}
                {fullyImportedCount > 0 &&
                  ` · ${fullyImportedCount} ${t("kindleImport.alreadyUpToDate")}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Warnings */}
        {preview && preview.warnings.length > 0 && (
          <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg space-y-1">
            {preview.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 mt-0.5 shrink-0" />
                <span className="text-xs text-yellow-700 dark:text-yellow-400">{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* All caught up */}
        {totalNew === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30">
              <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {t("kindleImport.allCaughtUp")}
            </p>
            <p className="text-xs text-muted-foreground">
              {preview?.totalExistingExtracts ?? 0} {t("kindleImport.existingExtracts")}
            </p>
          </div>
        )}

        {/* Book list */}
        {totalNew > 0 && (
          <>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {preview?.books.map((book) => (
                <BookPreviewCard
                  key={book.title}
                  book={book}
                  collapsed={collapsedBooks.has(book.title)}
                  onToggle={() => toggleBookCollapse(book.title)}
                />
              ))}
            </div>

            {/* Import button */}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {totalNew} {t("kindleImport.newToImport")}
              </span>
              <button
                onClick={handleImport}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Download className="h-4 w-4" />
                {t("kindleImport.importN", { count: totalNew })}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BookPreviewCard({
  book,
  collapsed,
  onToggle,
}: {
  book: KindleBookPreview;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const totalNew = book.newHighlights + book.newNotes;
  const isFullyImported = totalNew === 0;

  return (
    <div
      className={`p-3 rounded-lg border transition-colors cursor-pointer ${
        isFullyImported
          ? "bg-muted/20 border-border/50"
          : "bg-muted/30 border-border hover:bg-muted/50"
      }`}
      onClick={onToggle}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">
              {book.title}
            </span>
            {book.isNewBook && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary rounded">
                NEW
              </span>
            )}
          </div>
          {book.author && (
            <p className="text-xs text-muted-foreground mt-0.5 ml-5.5 truncate">
              {book.author}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 ml-2 shrink-0">
          {!isFullyImported && (
            <div className="flex items-center gap-2 text-xs">
              {book.newHighlights > 0 && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <Highlighter className="h-3 w-3" />+{book.newHighlights}
                </span>
              )}
              {book.newNotes > 0 && (
                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  <StickyNote className="h-3 w-3" />+{book.newNotes}
                </span>
              )}
            </div>
          )}
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="mt-2 ml-5.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            <Highlighter className="inline h-3 w-3 mr-1 text-amber-500" />
            {t("kindleImport.highlights")}: {book.newHighlights} new / {book.existingHighlights} {t("kindleImport.existing")}
          </span>
          <span>
            <StickyNote className="inline h-3 w-3 mr-1 text-blue-500" />
            {t("kindleImport.notes")}: {book.newNotes} new / {book.existingNotes} {t("kindleImport.existing")}
          </span>
          {book.skippedBookmarks > 0 && (
            <span>
              <Bookmark className="inline h-3 w-3 mr-1 text-muted-foreground" />
              {book.skippedBookmarks} {t("kindleImport.bookmarksSkipped")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
