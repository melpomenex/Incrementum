import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Link2, Mic } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useDocumentStore } from "../stores";
import { useStudyDeckStore } from "../stores/studyDeckStore";
import { EnhancedFilePicker } from "../components/documents/EnhancedFilePicker";
import type { ImportSource } from "../components/documents/EnhancedFilePicker";
import { TranscriptionButton } from "../components/transcription";
import { isTranscribableFileType } from "../components/transcription/TranscriptionQueueActions";
import type { Document } from "../types/document";
import { useI18n } from "../lib/i18n";
import { importSuperMemoPackage, convertSuperMemoCollectionToDocuments } from "../utils/supermemoImport";
import * as documentsApi from "../api/documents";
import { invokeCommand } from "../lib/tauri";
import { useCollectionStore } from "../stores/collectionStore";

export function Documents() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { documents, isLoading, isImporting, importProgress, error, loadDocuments, openFilePickerAndImport, importFromFiles, importFromUrl, importFromArxiv, addDocument, setError, setImporting, setImportProgress } = useDocumentStore(useShallow(state => ({
    documents: state.documents,
    isLoading: state.isLoading,
    isImporting: state.isImporting,
    importProgress: state.importProgress,
    error: state.error,
    loadDocuments: state.loadDocuments,
    openFilePickerAndImport: state.openFilePickerAndImport,
    importFromFiles: state.importFromFiles,
    importFromUrl: state.importFromUrl,
    importFromArxiv: state.importFromArxiv,
    addDocument: state.addDocument,
    setError: state.setError,
    setImporting: state.setImporting,
    setImportProgress: state.setImportProgress,
  })));
  const [isDragging, setIsDragging] = useState(false);
  const [showImportPicker, setShowImportPicker] = useState(false);
  const [, setInitialImportSource] = useState<'local' | 'url' | 'arxiv'>('local');

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleImportFromUrl = () => {
    setInitialImportSource('url');
    setShowImportPicker(true);
  };

  const handleImport = async () => {
    try {
      const imported = await openFilePickerAndImport();
      if (imported.length > 0) {
        // Documents are already added to state by the store
        console.log(`Imported ${imported.length} document(s)`);
        // Open the first imported document
        navigate(`/documents/${imported[0].id}`);
      }
    } catch (error) {
      console.error("Failed to import:", error);
    }
  };

  const handleImportFromPicker = async (source: ImportSource, data: any) => {
    console.log('[Documents] Import from picker:', source, data);
    try {
      let importedDoc = null;
      if (source === 'url') {
        console.log('[Documents] Calling importFromUrl with:', data.url);
        importedDoc = await importFromUrl(data.url);
        console.log('[Documents] importFromUrl completed');
      } else if (source === 'arxiv') {
        console.log('[Documents] Calling importFromArxiv with:', data.url);
        importedDoc = await importFromArxiv(data.url);
        console.log('[Documents] importFromArxiv completed');
      } else if (source === 'local') {
        // Separate .json files (deck import) from regular documents
        const filePaths: string[] = data.filePaths;
        const jsonPaths = filePaths.filter((p: string) => p.toLowerCase().endsWith('.json'));
        const regularPaths = filePaths.filter((p: string) => !p.toLowerCase().endsWith('.json'));

        // Import JSON decks
        if (jsonPaths.length > 0) {
          setImporting(true);
          setError(null);
          try {
            for (const jsonPath of jsonPaths) {
              const result = await invokeCommand<{ deck_name: string; document_id: string; cards_imported: number }>(
                "import_study_json_file",
                { filePath: jsonPath, collectionId: useCollectionStore.getState().activeCollectionId }
              );
              console.log(`Imported "${result.deck_name}": ${result.cards_imported} cards`);
              useStudyDeckStore.getState().ensureDecksExist([result.deck_name]);
            }
            await loadDocuments();
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to import JSON deck";
            setError(msg);
          } finally {
            setImporting(false);
          }
        }

        // Import regular documents
        if (regularPaths.length > 0) {
          const imported = await importFromFiles(regularPaths);
          if (imported.length > 0) {
            importedDoc = imported[0];
          }
        }
      } else if (source === 'supermemo') {
        setImporting(true);
        setError(null);
        try {
          const collection = await importSuperMemoPackage(data.filePath);
          if (collection.items.length === 0) {
            setError("No items found in the SuperMemo export.");
            setImporting(false);
            return;
          }

          const docEntries = await convertSuperMemoCollectionToDocuments(collection);
          setImportProgress(0, docEntries.length);

          let firstDoc: Document | null = null;
          for (let i = 0; i < docEntries.length; i++) {
            const entry = docEntries[i];
            setImportProgress(i + 1, docEntries.length, entry.title);
            try {
              const doc = await documentsApi.createDocument(
                entry.title,
                `supermemo://${collection.name}/${entry.title}`,
                entry.fileType,
              );
              addDocument(doc);
              if (!firstDoc) firstDoc = doc;
            } catch (err) {
              console.error(`Failed to create document for "${entry.title}":`, err);
            }
          }

          if (firstDoc) importedDoc = firstDoc;
          else setError("Failed to import any items from the SuperMemo collection.");
        } finally {
          setImporting(false);
          setImportProgress(0, 0);
        }
      } else if (source === 'json') {
        setImporting(true);
        setError(null);
        try {
          const result = await invokeCommand<{ deck_name: string; document_id: string; cards_imported: number; cards_skipped: number }>(
            "import_study_json_file",
            { filePath: data.filePath, collectionId: useCollectionStore.getState().activeCollectionId }
          );
          console.log(`Imported "${result.deck_name}": ${result.cards_imported} cards (${result.cards_skipped} duplicates skipped)`);
          useStudyDeckStore.getState().ensureDecksExist([result.deck_name]);
          await loadDocuments();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to import JSON deck";
          setError(msg);
        } finally {
          setImporting(false);
          setImportProgress(0, 0);
        }
      }

      setShowImportPicker(false);

      // Open the imported document
      if (importedDoc) {
        navigate(`/documents/${importedDoc.id}`);
      }
    } catch (error) {
      console.error("[Documents] Import error:", error);
      const msg = error instanceof Error ? error.message : "Import failed";
      setError(msg);
    }
  };


  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Convert FileList to file paths (in Tauri, we'd need to use the file system API)
    // The file.path property is available when files are dragged from the file system
    const filePaths = files
      .map(file => (file as any).path)
      .filter(path => path && typeof path === 'string');

    if (filePaths.length > 0) {
      try {
        const imported = await importFromFiles(filePaths);
        // Open the first imported document
        if (imported.length > 0) {
          navigate(`/documents/${imported[0].id}`);
        }
      } catch (error) {
        console.error("Failed to import dropped files:", error);
      }
    } else {
      console.warn("Drag and drop import: Unable to get file paths. This feature requires Tauri to be running in native mode.");
    }
  }, [importFromFiles, navigate]);

  return (
    <>
    <div
      className={`p-6 ${isDragging ? 'bg-primary/10' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("nav.documents")}</h1>
          <p className="text-muted-foreground">
            {t("documentsLegacy.browseManage")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleImportFromUrl}
            disabled={isImporting}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Link2 className="w-4 h-4" />
            {isImporting ? t("review.importing") : t("documentsLegacy.importFromUrl")}
          </button>
          <button
            onClick={handleImport}
            disabled={isImporting}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("documentsLegacy.importDocument")}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg">
          {error}
        </div>
      )}

      {isImporting && importProgress.total > 0 && (
        <div className="mb-4 p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">
              {importProgress.fileName
                ? t("documentsLegacy.importingFile", { name: importProgress.fileName })
                : t("documentsLegacy.importingDocuments")}
            </span>
            <span className="text-sm text-muted-foreground">
              {importProgress.current} / {importProgress.total}
            </span>
          </div>
          <div className="h-2 bg-muted-foreground/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-sm pointer-events-none">
          <div className="text-center p-8 bg-card border-2 border-primary rounded-lg shadow-lg">
            <div className="text-6xl mb-4">📄</div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {t("documentsLegacy.dropFiles")}
            </h3>
            <p className="text-muted-foreground">
              {t("documentsLegacy.releaseToImport")}
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">{t("documentsLegacy.loading")}</div>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📄</div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            {t("documentsLegacy.noDocuments")}
          </h3>
          <p className="text-muted-foreground mb-6">
            {t("documentsLegacy.importFirst")}
          </p>
          <button
            onClick={handleImport}
            disabled={isImporting}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImporting ? t("review.importing") : t("documentsLegacy.importFirstButton")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onClick={() => navigate(`/documents/${doc.id}`)}
            />
          ))}
        </div>
      )}
    </div>

    {showImportPicker && (
      <EnhancedFilePicker
        onImport={handleImportFromPicker}
        onCancel={() => setShowImportPicker(false)}
        isLoading={isImporting}
      />
    )}
  </>
  );
}

/**
 * Document Card Component
 * 
 * Displays a document with optional transcription action
 */
function DocumentCard({ doc, onClick }: { doc: Document; onClick: () => void }) {
  const { t } = useI18n();
  const [showTranscription, setShowTranscription] = useState(false);
  
  const isTranscribable = isTranscribableFileType(doc.fileType as any);
  
  const getFileTypeIcon = (fileType?: string) => {
    switch (fileType) {
      case "pdf": return "📕";
      case "epub": return "📖";
      case "markdown": return "📝";
      case "html": return "🌐";
      case "youtube": return "📺";
      case "video": return "🎬";
      case "audio": return "🎵";
      case "audiobook": return "🎧";
      default: return "📄";
    }
  };

  return (
    <div className="p-4 bg-card border border-border rounded-lg hover:shadow-md transition-shadow">
      {/* Clickable area */}
      <div 
        onClick={onClick}
        className="cursor-pointer"
      >
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-foreground line-clamp-2">
            {doc.title}
          </h3>
          <span className="text-xl">{getFileTypeIcon(doc.fileType)}</span>
        </div>

        {doc.category && (
          <div className="mb-2">
            <span className="inline-block px-2 py-1 text-xs bg-muted text-muted-foreground rounded">
              {doc.category}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t("documentsLegacy.extractCount", { count: doc.extractCount })}</span>
          <span>{t("documentsLegacy.cardCount", { count: doc.learningItemCount })}</span>
        </div>

        {doc.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {doc.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 text-xs bg-primary/10 text-primary rounded"
              >
                {tag}
              </span>
            ))}
            {doc.tags.length > 3 && (
              <span className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded">
                +{doc.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Transcription Action (separate from click area) */}
      {isTranscribable && (
        <div className="mt-3 pt-3 border-t border-border">
          {!showTranscription ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTranscription(true);
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            >
              <Mic className="w-4 h-4" />
              <span>{t("documentsLegacy.transcribe")}</span>
            </button>
          ) : (
            <div 
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2"
            >
              <TranscriptionButton
                documentId={doc.id}
                documentTitle={doc.title}
                size="sm"
                variant="outline"
                showStatus
              />
              <button
                onClick={() => setShowTranscription(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"
                title={t("queue.hideInspector")}
              >
                <span className="text-xs">✕</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div 
        onClick={onClick}
        className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground cursor-pointer"
      >
        <span>{t("documentsLegacy.addedOn", { date: new Date(doc.dateAdded).toLocaleDateString() })}</span>
        {doc.isFavorite && <span>⭐</span>}
      </div>
    </div>
  );
}
