/**
 * Import/Export Settings Component
 */

import { useState, useEffect } from "react";
import { invokeCommand, openFilePicker } from "../../lib/tauri";
import {
  ArrowsClockwise,
  Database,
  Download,
  FileArrowDown,
  FileArrowUp,
  Package,
  Upload,
} from "@phosphor-icons/react";
import { SettingsSection, SettingsRow } from "./SettingsPage";
import { useCollectionStore } from "../../stores/collectionStore";
import { useStudyDeckStore } from "../../stores/studyDeckStore";
import { buildCollectionArchive, parseCollectionArchive, restoreBrowserArchive, restoreLocalStorage, shouldUseTauriImport } from "../../utils/collectionArchive";
import type { CollectionExportScope } from "../../types/archive";
import { AppStateBackupDialog } from "./AppStateBackupDialog";
import { exportMnemosyne, exportDeckAsApkg, exportDeckAsCsv, exportAllDecksAsApkg } from "../../api/learning-items";
import { importPdfHighlightsAsExtracts, importPodcastAudioFile } from "../../api/documents";
import { getClipboardWatcherEnabled, setClipboardWatcherEnabled } from "../common/ClipboardQuickAddWatcher";
import { importReferenceItems, parseMendeleyItems, parseZoteroItems } from "../../utils/referenceImport";
import { useI18n } from "../../lib/i18n";
import { useSettingsStore } from "../../stores/settingsStore";
import { KindleImportDialog } from "../import/KindleImportDialog";

/**
 * Export options
 */
interface ExportOptions {
  includeDocuments: boolean;
  includeExtracts: boolean;
  includeFlashcards: boolean;
  includeSettings: boolean;
  includeStatistics: boolean;
  includeMedia: boolean;
}

function AnkiExportControls() {
  const { decks } = useStudyDeckStore();
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [exportFormat, setExportFormat] = useState<"apkg" | "csv">("apkg");
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

  const handleExport = async () => {
    const deck = decks.find((d) => d.id === selectedDeckId);
    if (!deck) return;
    setExportBusy(true);
    setExportStatus(null);
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const deckName = deck.name;
      const safeName = deckName.replace(/[^a-zA-Z0-9-_ ]/g, "_");

      if (exportFormat === "apkg") {
        const filePath = await save({
          title: `Export "${deckName}" as .apkg`,
          defaultPath: `${safeName}.apkg`,
          filters: [{ name: "Anki Package", extensions: ["apkg"] }],
        });
        if (!filePath) { setExportBusy(false); return; }
        const result = await exportDeckAsApkg(deckName, filePath);
        setExportStatus(result);
      } else {
        const filePath = await save({
          title: `Export "${deckName}" as text`,
          defaultPath: `${safeName}.txt`,
          filters: [{ name: "Text (Tab-separated)", extensions: ["txt"] }],
        });
        if (!filePath) { setExportBusy(false); return; }
        const result = await exportDeckAsCsv(deckName, filePath);
        setExportStatus(result);
      }
    } catch (err) {
      setExportStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExportBusy(false);
    }
  };

  const handleExportAll = async () => {
    setExportBusy(true);
    setExportStatus(null);
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const filePath = await save({
        title: "Export all decks as .apkg",
        defaultPath: "all-decks.apkg",
        filters: [{ name: "Anki Package", extensions: ["apkg"] }],
      });
      if (!filePath) { setExportBusy(false); return; }
      const result = await exportAllDecksAsApkg(filePath);
      setExportStatus(result);
    } catch (err) {
      setExportStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select
          value={selectedDeckId}
          onChange={(e) => { setSelectedDeckId(e.target.value); setExportStatus(null); }}
          className="flex-1 px-2 py-1.5 border border-border rounded bg-background text-sm"
        >
          <option value="">Select a deck...</option>
          {decks.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select
          value={exportFormat}
          onChange={(e) => setExportFormat(e.target.value as "apkg" | "csv")}
          className="px-2 py-1.5 border border-border rounded bg-background text-sm"
        >
          <option value="apkg">.apkg</option>
          <option value="csv">Tab-separated (.txt)</option>
        </select>
        <button
          onClick={() => void handleExport()}
          disabled={!selectedDeckId || exportBusy}
          className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm disabled:opacity-50"
        >
          Export
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => void handleExportAll()}
          disabled={exportBusy}
          className="px-3 py-1.5 border border-border rounded text-sm hover:bg-muted disabled:opacity-50"
        >
          Export All Decks (.apkg)
        </button>
      </div>
      {exportStatus && (
        <p className="text-xs text-muted-foreground">{exportStatus}</p>
      )}
    </div>
  );
}

/**
 * Import/Export Settings
 */
export function ImportExportSettings({ onChange }: { onChange: () => void }) {
  const { t } = useI18n();
  const { settings } = useSettingsStore();
  const { collections, activeCollectionId } = useCollectionStore();
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeDocuments: true,
    includeExtracts: true,
    includeFlashcards: true,
    includeSettings: true,
    includeStatistics: false,
    includeMedia: false,
  });

  const [importFile, setImportFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [demoContentStatus, setDemoContentStatus] = useState<string>("Loading...");
  const [archiveScope, setArchiveScope] = useState<CollectionExportScope>("current");
  const [archiveInProgress, setArchiveInProgress] = useState(false);
  const [archiveStatus, setArchiveStatus] = useState<string | null>(null);
  const [showAppStateDialog, setShowAppStateDialog] = useState(false);
  const [podcastFile, setPodcastFile] = useState<File | null>(null);
  const [podcastLanguage, setPodcastLanguage] = useState("en");
  const [pdfHighlightDocumentId, setPdfHighlightDocumentId] = useState("");
  const [referenceSource, setReferenceSource] = useState<"zotero" | "mendeley">("zotero");
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [clipboardWatcherEnabled, setClipboardWatcherEnabledState] = useState(false);
  const [kindleFilePath, setKindleFilePath] = useState<string | null>(null);

  useEffect(() => {
    const loadDemoStatus = async () => {
      try {
        const status = await invokeCommand<string>("get_demo_content_status");
        setDemoContentStatus(status);
      } catch {
        setDemoContentStatus("Unable to load demo content status");
      }
    };
    loadDemoStatus();
    setClipboardWatcherEnabledState(getClipboardWatcherEnabled());
  }, []);

  const handleExport = async (format: "json" | "csv" | "incrementum") => {
    setIsProcessing(true);
    try {
      const exportData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        options: exportOptions,
        // Data would be populated by actual export function
      };

      const filename = `incrementum-export-${new Date().toISOString().split("T")[0]}.${format}`;

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: format === "csv" ? "text/csv" : "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      onChange();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleArchiveExport = async () => {
    setArchiveInProgress(true);
    setArchiveStatus(null);
    try {
      const { blob, filename } = await buildCollectionArchive({
        scope: archiveScope,
        activeCollectionId,
        collections,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      setArchiveStatus(t("importExport.archiveExportCreated"));
    } catch (error) {
      setArchiveStatus(t("importExport.archiveExportFailed", {
        error: error instanceof Error ? error.message : t("importExport.unknownError"),
      }));
    } finally {
      setArchiveInProgress(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      alert(t("importExport.selectFile"));
      return;
    }

    setIsProcessing(true);
    try {
      const fileName = importFile.name.toLowerCase();
      if (fileName.endsWith(".zip")) {
        try {
          const parsed = await parseCollectionArchive(importFile);

          if (shouldUseTauriImport(importFile)) {
            const filePath = (importFile as File & { path?: string }).path;
            if (!filePath) {
              throw new Error("Archive import requires a file path in Tauri.");
            }
            const result = await invokeCommand<string>("import_collection_archive", {
              archivePath: filePath,
            });
            alert(result);
          } else {
            await restoreBrowserArchive(parsed);
            alert(t("importExport.archiveCompleteReload"));
          }

          restoreLocalStorage(parsed.payload.localStorage);
          onChange();
          return;
        } catch (error) {
          console.warn("Not a collection archive, falling back to legacy import.", error);
        }
      }
      if (fileName.endsWith(".db")) {
        const filePath = (importFile as File & { path?: string }).path;
        if (filePath) {
          if (confirm("Are you sure you want to restore this database? The current database will be replaced, and the app will close/relaunch after restoring.")) {
            setIsProcessing(true);
            try {
              await invokeCommand("restore_local_db_backup", { backupPath: filePath });
              const { relaunch } = await import("@tauri-apps/plugin-process");
              await relaunch();
            } catch (err) {
              alert("Restore failed: " + (err instanceof Error ? err.message : String(err)));
            } finally {
              setIsProcessing(false);
            }
          }
          return;
        } else {
          alert("Database file restore is only supported on native desktop and mobile versions.");
          return;
        }
      }

      if (fileName.endsWith(".apkg")) {
        const filePath = (importFile as File & { path?: string }).path;
        if (filePath) {
          const imported = await invokeCommand<unknown[]>("import_anki_package_to_learning_items", {
            apkgPath: filePath,
          });
          alert(`Imported ${imported.length} Anki card(s) as learning items`);
          onChange();
          return;
        }

        const apkgBytes = new Uint8Array(await importFile.arrayBuffer());
        const imported = await invokeCommand<unknown[]>("import_anki_package_bytes_to_learning_items", {
          apkgBytes: Array.from(apkgBytes),
        });
        alert(`Imported ${imported.length} Anki card(s) as learning items`);
        onChange();
        return;
      }

      if (fileName.endsWith(".zip") || fileName.endsWith(".7z")) {
        const filePath = (importFile as File & { path?: string }).path;
        if (!filePath) {
          throw new Error("Import requires access to the archive file path.");
        }

        const summary = await invokeCommand<{
          documents: number;
          extracts: number;
          learningItems: number;
          reviewSessions: number;
          reviewResults: number;
        }>("import_legacy_archive", { archivePath: filePath });

        alert(
          `Legacy import complete:\n` +
          `Documents: ${summary.documents}\n` +
          `Extracts: ${summary.extracts}\n` +
          `Learning Items: ${summary.learningItems}\n` +
          `Review Sessions: ${summary.reviewSessions}\n` +
          `Review Results: ${summary.reviewResults}`
        );
        onChange();
        return;
      }

      const text = await importFile.text();
      const data = JSON.parse(text);

      if (!data.version) {
        throw new Error("Invalid import file format");
      }

      // This would trigger actual import logic
      alert(`Import would process:\n${JSON.stringify(data.options, null, 2)}`);

      onChange();
    } catch (error) {
      alert(`Import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportFromCPlusPlus = () => {
    // Launch C++ database reader
    alert("C++ database migration will be implemented in Phase 4.6");
  };

  const handlePodcastImport = async () => {
    if (!podcastFile) {
      alert("Select an .mp3 or .m4a file first.");
      return;
    }
    const filePath = (podcastFile as File & { path?: string }).path;
    if (!filePath) {
      alert("Desktop file path is required for local Whisper import.");
      return;
    }
    const result = await importPodcastAudioFile(
      filePath,
      podcastFile.name,
      podcastLanguage,
      settings.audioTranscription.preferredModelId,
      settings.audioTranscription.autoTranscription
    );
    alert(`Imported ${result.document.title} with ${result.transcript_segments} transcript segments.`);
    onChange();
  };

  const handleImportPdfHighlights = async () => {
    if (!pdfHighlightDocumentId.trim()) {
      alert("Enter a document ID.");
      return;
    }
    const count = await importPdfHighlightsAsExtracts(pdfHighlightDocumentId.trim());
    alert(`Imported ${count} highlight extract(s).`);
    onChange();
  };

  const handleReferenceImport = async () => {
    if (!referenceFile) {
      alert("Select a Zotero or Mendeley JSON export first.");
      return;
    }
    const text = await referenceFile.text();
    const payload = JSON.parse(text);
    const items = referenceSource === "zotero" ? parseZoteroItems(payload) : parseMendeleyItems(payload);
    const importedCount = await importReferenceItems(items);
    alert(`Imported ${importedCount} reference item(s) from ${referenceSource}.`);
    onChange();
  };

  const handleOpenKindleFile = async () => {
    const selected = await openFilePicker({
      title: "Select My Clippings.txt",
      multiple: false,
      filters: [{ name: "Kindle Clippings", extensions: ["txt"] }],
    });
    if (selected && selected.length > 0) {
      setKindleFilePath(selected[0]);
    }
  };

  const handleBackfillKindleImports = async () => {
    try {
      const result = await invokeCommand<{ documentsUpdated: number; learningItemsCreated: number; errors: string[] }>("backfill_kindle_imports");
      alert(`Backfill complete: ${result.learningItemsCreated} learning items created across ${result.documentsUpdated} documents.${result.errors.length > 0 ? `\n\n${result.errors.length} errors occurred.` : ""}`);
    } catch (err) {
      alert(`Backfill failed: ${err}`);
    }
  };

  return (
    <>
      <SettingsSection
        title={t("importExport.completeBackup")}
        description={t("importExport.completeBackupDesc")}
      >
        <div className="space-y-4">
          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-medium mb-2 text-foreground">{t("importExport.whatsIncluded")}</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• {t("importExport.allDocumentsWithPositions")}</li>
              <li>• {t("importExport.extractsHighlights")}</li>
              <li>• {t("importExport.flashcardsFsrsScheduling")}</li>
              <li>• {t("importExport.collectionsAssignments")}</li>
              <li>• {t("importExport.allSettingsPreferences")}</li>
              <li>• {t("importExport.optionalDocumentFiles")}</li>
            </ul>
          </div>

          <button
            onClick={() => setShowAppStateDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <Database className="w-4 h-4" />
            {t("importExport.openBackupRestore")}
          </button>
        </div>
      </SettingsSection>

      <AppStateBackupDialog
        isOpen={showAppStateDialog}
        onClose={() => setShowAppStateDialog(false)}
      />

      <SettingsSection
        title={t("importExport.collectionArchive")}
        description={t("importExport.collectionArchiveDesc")}
      >
        <div className="space-y-4">
          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-medium mb-3 text-foreground">{t("importExport.scope")}</h4>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="archive-scope"
                  checked={archiveScope === "current"}
                  onChange={() => setArchiveScope("current")}
                />
                <span className="text-sm text-foreground">
                  {t("importExport.currentCollection", {
                    name: collections.find((c) => c.id === activeCollectionId)?.name || t("importExport.none"),
                  })}
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="archive-scope"
                  checked={archiveScope === "all"}
                  onChange={() => setArchiveScope("all")}
                />
                <span className="text-sm text-foreground">{t("importExport.allCollections")}</span>
              </label>
            </div>
          </div>

          <button
            onClick={handleArchiveExport}
            disabled={archiveInProgress}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {archiveInProgress ? (
              <>
                <ArrowsClockwise className="w-4 h-4 animate-spin" />
                {t("importExport.preparingArchive")}
              </>
            ) : (
              <>
                <Package className="w-4 h-4" />
                {t("importExport.exportArchive")}
              </>
            )}
          </button>

          {archiveStatus && (
            <p className="text-xs text-muted-foreground">{archiveStatus}</p>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title={t("importExport.exportLegacy")}
        description={t("importExport.exportLegacyDesc")}
      >
        <div className="space-y-4">
          {/* Export options */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-medium mb-3 text-foreground">{t("importExport.dataToExport")}</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.includeDocuments}
                  onChange={(e) => {
                    setExportOptions({ ...exportOptions, includeDocuments: e.target.checked });
                    onChange();
                  }}
                  className="rounded"
                />
                <span className="text-sm text-foreground">{t("graph.documents")}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.includeExtracts}
                  onChange={(e) => {
                    setExportOptions({ ...exportOptions, includeExtracts: e.target.checked });
                    onChange();
                  }}
                  className="rounded"
                />
                <span className="text-sm text-foreground">{t("graph.extracts")}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.includeFlashcards}
                  onChange={(e) => {
                    setExportOptions({ ...exportOptions, includeFlashcards: e.target.checked });
                    onChange();
                  }}
                  className="rounded"
                />
                <span className="text-sm text-foreground">{t("importExport.flashcardsAndProgress")}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.includeSettings}
                  onChange={(e) => {
                    setExportOptions({ ...exportOptions, includeSettings: e.target.checked });
                    onChange();
                  }}
                  className="rounded"
                />
                <span className="text-sm text-foreground">{t("importExport.settings")}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.includeStatistics}
                  onChange={(e) => {
                    setExportOptions({ ...exportOptions, includeStatistics: e.target.checked });
                    onChange();
                  }}
                  className="rounded"
                />
                <span className="text-sm text-foreground">{t("importExport.statisticsAnalytics")}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.includeMedia}
                  onChange={(e) => {
                    setExportOptions({ ...exportOptions, includeMedia: e.target.checked });
                    onChange();
                  }}
                  className="rounded"
                />
                <span className="text-sm text-foreground">{t("importExport.mediaFiles")}</span>
              </label>
            </div>
          </div>

          {/* Export format selection */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">{t("importExport.format")}</span>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport("json")}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {t("importExport.exportJson")}
              </button>
              <button
                onClick={() => handleExport("csv")}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-md hover:bg-muted disabled:opacity-50"
              >
                <FileArrowDown className="w-4 h-4" />
                {t("importExport.exportCsv")}
              </button>
              <button
                onClick={() => handleExport("incrementum")}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-md hover:bg-muted disabled:opacity-50"
              >
                <FileArrowUp className="w-4 h-4" />
                {t("importExport.incrementumPackage")}
              </button>
              <button
                onClick={async () => {
                  const path = await exportMnemosyne();
                  alert(`Mnemosyne export created: ${path}`);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-md hover:bg-muted"
              >
                <Download className="w-4 h-4" />
                {t("importExport.exportMnemosyne")}
              </button>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title={t("importExport.importData")}
        description={t("importExport.importDataDesc")}
      >
        <div className="space-y-4">
          {/* File selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t("importExport.selectImportFile")}</label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept=".json,.csv,.incrementum,.apkg,.zip,.7z,.db,application/json,application/octet-stream,application/zip,application/x-7z-compressed,application/x-sqlite3,text/csv,text/plain"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="flex-1 text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-muted file:text-muted-foreground hover:file:bg-muted/80"
              />
              {importFile && (
                <button
                  onClick={() => setImportFile(null)}
                  className="p-2 hover:bg-muted rounded text-foreground"
                >
                  {t("importExport.clear")}
                </button>
              )}
            </div>
            {importFile && (
              <p className="text-xs text-muted-foreground mt-1">
                {t("importExport.selectedFile", {
                  name: importFile.name,
                  size: (importFile.size / 1024).toFixed(1),
                })}
              </p>
            )}
          </div>

          {/* Import options */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-medium mb-3 text-foreground">{t("importExport.importOptions")}</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded"
                />
                <span className="text-sm text-foreground">{t("importExport.skipDuplicates")}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded"
                />
                <span className="text-sm text-foreground">{t("importExport.mergeExisting")}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded"
                />
                <span className="text-sm text-foreground">{t("importExport.createBackupBeforeImport")}</span>
              </label>
            </div>
          </div>

          {/* Import button */}
          <button
            onClick={handleImport}
            disabled={!importFile || isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <ArrowsClockwise className="w-4 h-4 animate-spin" />
                {t("documentsView.importing")}
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                {t("importExport.importDataBtn")}
              </>
            )}
          </button>
        </div>
      </SettingsSection>

      <SettingsSection
        title={t("importExport.migrateFromCpp")}
        description={t("importExport.migrateFromCppDesc")}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("importExport.migrateDesc")}
          </p>

          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-medium mb-2 text-foreground">{t("importExport.whatWillBeImported")}</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• {t("importExport.allDocumentsMetadata")}</li>
              <li>• {t("importExport.extractsHighlights")}</li>
              <li>• {t("importExport.flashcardsScheduling")}</li>
              <li>• {t("importExport.categoriesTags")}</li>
              <li>• {t("importExport.reviewHistory")}</li>
              <li>• {t("importExport.appSettings")}</li>
            </ul>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportFromCPlusPlus}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-md hover:bg-accent/90"
            >
              <ArrowsClockwise className="w-4 h-4" />
              {t("importExport.startMigration")}
            </button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title={t("importExport.scheduledBackups")}
        description={t("importExport.scheduledBackupsDesc")}
      >
        <div className="space-y-1">
          <SettingsRow
            label={t("importExport.autoBackup")}
            description={t("importExport.autoBackupDesc")}
          >
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" onChange={onChange} defaultChecked />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </SettingsRow>

          <SettingsRow
            label={t("importExport.backupFrequency")}
            description={t("importExport.backupFrequencyDesc")}
          >
            <select
              className="px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
              onChange={onChange}
              defaultValue="daily"
            >
              <option value="hourly" className="text-foreground">{t("importExport.hourly")}</option>
              <option value="daily" className="text-foreground">{t("importExport.daily")}</option>
              <option value="weekly" className="text-foreground">{t("importExport.weekly")}</option>
              <option value="monthly" className="text-foreground">{t("importExport.monthly")}</option>
            </select>
          </SettingsRow>

          <SettingsRow
            label={t("importExport.backupLocation")}
            description={t("importExport.backupLocationDesc")}
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                defaultValue="./backups"
                onChange={onChange}
                className="w-48 px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button className="px-3 py-2 bg-background border border-border rounded-md hover:bg-muted text-foreground">
                {t("importExport.browse")}
              </button>
            </div>
          </SettingsRow>

          <SettingsRow
            label={t("importExport.maxBackups")}
            description={t("importExport.maxBackupsDesc")}
          >
            <input
              type="number"
              min="1"
              max="100"
              defaultValue="10"
              onChange={onChange}
              className="w-20 px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </SettingsRow>
        </div>
      </SettingsSection>

      <SettingsSection
        title={t("importExport.demoContent")}
        description={t("importExport.demoContentDesc")}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("importExport.demoContentAutoImport")}
          </p>

          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-medium mb-2 text-foreground">{t("importExport.demoContentStatus")}</h4>
            <p className="text-xs text-muted-foreground">
              {demoContentStatus}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                const result = await invokeCommand<string>("import_demo_content_manually");
                alert(result);
                // Refresh status
                const status = await invokeCommand<string>("get_demo_content_status");
                setDemoContentStatus(status);
                onChange();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-md hover:bg-accent/90"
            >
              <ArrowsClockwise className="w-4 h-4" />
              {t("importExport.checkDemoContent")}
            </button>
          </div>

          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-medium mb-2 text-foreground">{t("importExport.environmentVariables")}</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li><code>DEMO_CONTENT_DIR</code> - {t("importExport.demoContentDirHelp")}</li>
              <li><code>SKIP_DEMO_IMPORT=1</code> - {t("importExport.skipDemoImportHelp")}</li>
            </ul>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Export to Anki"
        description="Export your decks as Anki-compatible .apkg or tab-separated text files."
      >
        <div className="space-y-4">
          <div className="p-4 bg-muted/30 rounded-lg space-y-3">
            <h4 className="text-sm font-medium text-foreground">Deck</h4>
            <AnkiExportControls />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title={t("importExport.additionalImports")}
        description={t("importExport.additionalImportsDesc")}
      >
        <div className="space-y-4">
          <div className="p-4 bg-muted/30 rounded-lg space-y-3">
            <h4 className="text-sm font-medium text-foreground">{t("importExport.podcastImport")}</h4>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".mp3,.m4a"
                onChange={(e) => setPodcastFile(e.target.files?.[0] || null)}
                className="flex-1 text-sm"
              />
              <input
                value={podcastLanguage}
                onChange={(e) => setPodcastLanguage(e.target.value)}
                className="w-20 px-2 py-1 border border-border rounded bg-background text-sm"
                placeholder="en"
              />
              <button onClick={handlePodcastImport} className="px-3 py-2 bg-primary text-primary-foreground rounded text-sm">
                {t("documentsView.import")}
              </button>
            </div>
          </div>

          <div className="p-4 bg-muted/30 rounded-lg space-y-3">
            <h4 className="text-sm font-medium text-foreground">{t("importExport.pdfHighlightExtraction")}</h4>
            <div className="flex items-center gap-2">
              <input
                value={pdfHighlightDocumentId}
                onChange={(e) => setPdfHighlightDocumentId(e.target.value)}
                placeholder={t("importExport.documentId")}
                className="flex-1 px-2 py-1 border border-border rounded bg-background text-sm"
              />
              <button onClick={handleImportPdfHighlights} className="px-3 py-2 bg-primary text-primary-foreground rounded text-sm">
                {t("importExport.importHighlights")}
              </button>
            </div>
          </div>

          <div className="p-4 bg-muted/30 rounded-lg space-y-3">
            <h4 className="text-sm font-medium text-foreground">{t("importExport.clipboardWatcher")}</h4>
            <label className="flex items-center gap-3 text-sm text-foreground">
              <input
                type="checkbox"
                checked={clipboardWatcherEnabled}
                onChange={(e) => {
                  setClipboardWatcherEnabledState(e.target.checked);
                  setClipboardWatcherEnabled(e.target.checked);
                }}
              />
              {t("importExport.enableClipboardWatcher")}
            </label>
          </div>

          <div className="p-4 bg-muted/30 rounded-lg space-y-3">
            <h4 className="text-sm font-medium text-foreground">{t("importExport.zoteroMendeley")}</h4>
            <div className="flex items-center gap-2">
              <select
                value={referenceSource}
                onChange={(e) => setReferenceSource(e.target.value as "zotero" | "mendeley")}
                className="px-2 py-1 border border-border rounded bg-background text-sm"
              >
                <option value="zotero">Zotero JSON</option>
                <option value="mendeley">Mendeley JSON</option>
              </select>
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => setReferenceFile(e.target.files?.[0] || null)}
                className="flex-1 text-sm"
              />
              <button onClick={handleReferenceImport} className="px-3 py-2 bg-primary text-primary-foreground rounded text-sm">
                {t("documentsView.import")}
              </button>
            </div>
          </div>

          {/* Kindle Clippings Import */}
          <div className="p-4 bg-muted/30 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground">{t("importExport.kindleClippings")}</h4>
              <button
                onClick={handleBackfillKindleImports}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                {t("kindleImport.backfill")}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{t("importExport.kindleClippingsDesc")}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenKindleFile}
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground hover:bg-muted/50 transition-colors text-left"
              >
                {kindleFilePath ? kindleFilePath.split(/[\\/]/).pop() : t("kindleImport.selectFile")}
              </button>
            </div>
          </div>
        </div>
      </SettingsSection>

      {kindleFilePath && (
        <KindleImportDialog
          filePath={kindleFilePath}
          onClose={() => setKindleFilePath(null)}
        />
      )}
    </>
  );
}
