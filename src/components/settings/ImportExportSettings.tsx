/**
 * Import/Export Settings Component
 */

import { useState, useEffect } from "react";
import { invokeCommand } from "../../lib/tauri";
import { Download, Upload, FileDown, FileUp, RefreshCw, PackageCheck, Database } from "lucide-react";
import { SettingsSection, SettingsRow } from "./SettingsPage";
import { useCollectionStore } from "../../stores/collectionStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { buildCollectionArchive, parseCollectionArchive, restoreBrowserArchive, restoreLocalStorage, shouldUseTauriImport } from "../../utils/collectionArchive";
import type { CollectionExportScope } from "../../types/archive";
import { AppStateBackupDialog } from "./AppStateBackupDialog";
import { exportMnemosyne } from "../../api/learning-items";
import { importPdfHighlightsAsExtracts, importPodcastAudioFile } from "../../api/documents";
import {
  getAutomationApiKey,
  getBrowserSyncConfig,
  rotateAutomationApiKey,
  setBrowserSyncConfig,
  syncFromLogseq,
  syncToLogseq,
  type ObsidianConfig,
} from "../../api/integrations";
import { getClipboardWatcherEnabled, setClipboardWatcherEnabled } from "../common/ClipboardQuickAddWatcher";
import { importReferenceItems, parseMendeleyItems, parseZoteroItems } from "../../utils/referenceImport";
import {
  activatePlugin,
  deactivatePlugin,
  grantPluginPermission,
  installPlugin,
  listInstalledPlugins,
  uninstallPlugin,
  type InstalledPlugin,
  type PluginManifest,
} from "../../lib/pluginHost";
import {
  attachDeckToGroup,
  buildPublicProfileData,
  cardsToCommunityDeckCards,
  createStudyGroup,
  getPublicProfileConfig,
  installCommunityDeck,
  listCommunityDecks,
  listStudyGroups,
  publishCommunityDeck,
  rateCommunityDeck,
  setPublicProfileConfig,
  updateGroupMemberStats,
  type PublicProfileConfig,
} from "../../utils/wave4Social";
import { getAllLearningItems, getDailyNoteLinks } from "../../api/learning-items";

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

/**
 * Import/Export Settings
 */
export function ImportExportSettings({ onChange }: { onChange: () => void }) {
  const { collections, activeCollectionId, documentAssignments } = useCollectionStore();
  const { settings, updateSettingsCategory } = useSettingsStore();
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
  const [automationApiKey, setAutomationApiKey] = useState("");
  const [pluginManifestText, setPluginManifestText] = useState('{"id":"my-plugin","name":"My Plugin","version":"0.1.0","permissions":["cards:read"]}');
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
  const [logseqConfig, setLogseqConfig] = useState<ObsidianConfig>({
    vaultPath: "",
    notesFolder: "pages",
    attachmentsFolder: "assets",
    dataviewFolder: "pages",
  });
  const [communityDecks, setCommunityDecks] = useState(listCommunityDecks());
  const [studyGroups, setStudyGroups] = useState(listStudyGroups());
  const [publicProfile, setPublicProfile] = useState<PublicProfileConfig>(getPublicProfileConfig());
  const [communityDeckTitle, setCommunityDeckTitle] = useState("My Shared Deck");
  const [communityDeckDescription, setCommunityDeckDescription] = useState("Shared from Incrementum");
  const [studyGroupName, setStudyGroupName] = useState("Study Group");
  const [dailyNoteDate, setDailyNoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [dailyNoteLinks, setDailyNoteLinks] = useState<Array<Record<string, unknown>>>([]);

  // Load demo content status on mount
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
    setPlugins(listInstalledPlugins());
    getAutomationApiKey().then(setAutomationApiKey).catch(() => setAutomationApiKey(""));
    getBrowserSyncConfig()
      .then((config) => {
        if (config.apiKey) setAutomationApiKey(config.apiKey);
      })
      .catch(() => {});
    getDailyNoteLinks(new Date().toISOString().slice(0, 10))
      .then(setDailyNoteLinks)
      .catch(() => setDailyNoteLinks([]));
  }, []);

  const handleExport = async (format: "json" | "csv" | "incrementum") => {
    setIsProcessing(true);
    try {
      // Build export data based on options
      const exportData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        options: exportOptions,
        // Data would be populated by actual export function
      };

      const filename = `incrementum-export-${new Date().toISOString().split("T")[0]}.${format}`;

      // Create and download file
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
        documentAssignments,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      setArchiveStatus("Archive export created successfully.");
    } catch (error) {
      setArchiveStatus(`Archive export failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setArchiveInProgress(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      alert("Please select a file to import");
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
            alert("Archive import complete. Reload the app to finish restoring your data.");
          }

          restoreLocalStorage(parsed.payload.localStorage);
          onChange();
          return;
        } catch (error) {
          console.warn("Not a collection archive, falling back to legacy import.", error);
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

      // Validate import data
      if (!data.version) {
        throw new Error("Invalid import file format");
      }

      // Process import
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
    const result = await importPodcastAudioFile(filePath, podcastFile.name, podcastLanguage);
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

  const refreshPlugins = () => setPlugins(listInstalledPlugins());
  const refreshSocial = () => {
    setCommunityDecks(listCommunityDecks());
    setStudyGroups(listStudyGroups());
    setPublicProfile(getPublicProfileConfig());
  };

  return (
    <>
      <SettingsSection
        title="Complete App Backup"
        description="Backup or restore your entire app state including all documents, study progress, settings, and preferences"
      >
        <div className="space-y-4">
          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-medium mb-2 text-foreground">What&apos;s included</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• All documents with metadata and reading positions</li>
              <li>• Extracts and highlights</li>
              <li>• Flashcards with FSRS scheduling data</li>
              <li>• Collections and document assignments</li>
              <li>• All settings and preferences</li>
              <li>• Optional: Actual document files (PDFs, EPUBs, etc.)</li>
            </ul>
          </div>

          <button
            onClick={() => setShowAppStateDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <Database className="w-4 h-4" />
            Open Backup & Restore
          </button>
        </div>
      </SettingsSection>

      <AppStateBackupDialog
        isOpen={showAppStateDialog}
        onClose={() => setShowAppStateDialog(false)}
      />

      <SettingsSection
        title="Collection Archive (Recommended)"
        description="Create a portable backup that includes data, files, settings, and Anki .apkg"
      >
        <div className="space-y-4">
          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-medium mb-3 text-foreground">Scope</h4>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="archive-scope"
                  checked={archiveScope === "current"}
                  onChange={() => setArchiveScope("current")}
                />
                <span className="text-sm text-foreground">
                  Current collection ({collections.find((c) => c.id === activeCollectionId)?.name || "None"})
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="archive-scope"
                  checked={archiveScope === "all"}
                  onChange={() => setArchiveScope("all")}
                />
                <span className="text-sm text-foreground">All collections</span>
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
                <RefreshCw className="w-4 h-4 animate-spin" />
                Preparing archive...
              </>
            ) : (
              <>
                <PackageCheck className="w-4 h-4" />
                Export Collection Archive (.zip)
              </>
            )}
          </button>

          {archiveStatus && (
            <p className="text-xs text-muted-foreground">{archiveStatus}</p>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Export Data (Legacy Formats)"
        description="Choose what to include in your export"
      >
        <div className="space-y-4">
          {/* Export options */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-medium mb-3 text-foreground">Data to Export</h4>
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
                <span className="text-sm text-foreground">Documents</span>
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
                <span className="text-sm text-foreground">Extracts</span>
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
                <span className="text-sm text-foreground">Flashcards & Progress</span>
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
                <span className="text-sm text-foreground">Settings</span>
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
                <span className="text-sm text-foreground">Statistics & Analytics</span>
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
                <span className="text-sm text-foreground">Media Files (PDFs, images, etc.)</span>
              </label>
            </div>
          </div>

          {/* Export format selection */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">Format:</span>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport("json")}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Export as JSON
              </button>
              <button
                onClick={() => handleExport("csv")}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-md hover:bg-muted disabled:opacity-50"
              >
                <FileDown className="w-4 h-4" />
                Export as CSV
              </button>
              <button
                onClick={() => handleExport("incrementum")}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-md hover:bg-muted disabled:opacity-50"
              >
                <FileUp className="w-4 h-4" />
                Incrementum Package
              </button>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Import Data"
        description="Import data from a backup or other sources"
      >
        <div className="space-y-4">
          {/* File selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Select Import File</label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept=".json,.csv,.incrementum,.apkg,.zip,.7z"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="flex-1 text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-muted file:text-muted-foreground hover:file:bg-muted/80"
              />
              {importFile && (
                <button
                  onClick={() => setImportFile(null)}
                  className="p-2 hover:bg-muted rounded text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
            {importFile && (
              <p className="text-xs text-muted-foreground mt-1">
                Selected: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Import options */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-medium mb-3 text-foreground">Import Options</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded"
                />
                <span className="text-sm text-foreground">Skip duplicates (based on ID)</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded"
                />
                <span className="text-sm text-foreground">Merge with existing data</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded"
                />
                <span className="text-sm text-foreground">Create backup before import</span>
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
                <RefreshCw className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Import Data
              </>
            )}
          </button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Migrate from C++ Version"
        description="Import your data from the original C++ application"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Import your documents, extracts, flashcards, and progress from the C++ version of Incrementum.
          </p>

          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-medium mb-2 text-foreground">What will be imported:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• All documents with metadata</li>
              <li>• Extracts and highlights</li>
              <li>• Flashcards with scheduling data</li>
              <li>• Categories and tags</li>
              <li>• Review history and statistics</li>
              <li>• Application settings</li>
            </ul>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportFromCPlusPlus}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-md hover:bg-accent/90"
            >
              <RefreshCw className="w-4 h-4" />
              Start Migration
            </button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Scheduled Backups"
        description="Configure automatic backup settings"
      >
        <div className="space-y-1">
          <SettingsRow
            label="Auto Backup"
            description="Automatically create backups at regular intervals"
          >
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" onChange={onChange} defaultChecked />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </SettingsRow>

          <SettingsRow
            label="Backup Frequency"
            description="How often to create automatic backups"
          >
            <select
              className="px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
              onChange={onChange}
              defaultValue="daily"
            >
              <option value="hourly" className="text-foreground">Hourly</option>
              <option value="daily" className="text-foreground">Daily</option>
              <option value="weekly" className="text-foreground">Weekly</option>
              <option value="monthly" className="text-foreground">Monthly</option>
            </select>
          </SettingsRow>

          <SettingsRow
            label="Backup Location"
            description="Folder where backups are stored"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                defaultValue="./backups"
                onChange={onChange}
                className="w-48 px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button className="px-3 py-2 bg-background border border-border rounded-md hover:bg-muted text-foreground">
                Browse
              </button>
            </div>
          </SettingsRow>

          <SettingsRow
            label="Max Backups"
            description="Maximum number of backups to keep"
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
        title="Demo Content"
        description="Manage demo content for trying out the application"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Demo content is automatically imported on first run so you can try the application immediately.
          </p>

          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-medium mb-2 text-foreground">Demo Content Status</h4>
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
              <RefreshCw className="w-4 h-4" />
              Check Demo Content
            </button>
          </div>

          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-medium mb-2 text-foreground">Environment Variables</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li><code>DEMO_CONTENT_DIR</code> - Custom demo content directory path</li>
              <li><code>SKIP_DEMO_IMPORT=1</code> - Disable demo content auto-import</li>
            </ul>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Wave 3 Ingestion"
        description="Podcast import, PDF highlight extraction, clipboard watcher, and reference manager imports"
      >
        <div className="space-y-4">
          <div className="p-4 bg-muted/30 rounded-lg space-y-3">
            <h4 className="text-sm font-medium text-foreground">Podcast / Audio Import (Whisper)</h4>
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
                Import
              </button>
            </div>
          </div>

          <div className="p-4 bg-muted/30 rounded-lg space-y-3">
            <h4 className="text-sm font-medium text-foreground">Pre-highlighted PDF Extraction</h4>
            <div className="flex items-center gap-2">
              <input
                value={pdfHighlightDocumentId}
                onChange={(e) => setPdfHighlightDocumentId(e.target.value)}
                placeholder="Document ID"
                className="flex-1 px-2 py-1 border border-border rounded bg-background text-sm"
              />
              <button onClick={handleImportPdfHighlights} className="px-3 py-2 bg-primary text-primary-foreground rounded text-sm">
                Import Highlights
              </button>
            </div>
          </div>

          <div className="p-4 bg-muted/30 rounded-lg space-y-3">
            <h4 className="text-sm font-medium text-foreground">Clipboard Watcher Quick Add</h4>
            <label className="flex items-center gap-3 text-sm text-foreground">
              <input
                type="checkbox"
                checked={clipboardWatcherEnabled}
                onChange={(e) => {
                  setClipboardWatcherEnabledState(e.target.checked);
                  setClipboardWatcherEnabled(e.target.checked);
                }}
              />
              Enable clipboard watcher and quick-add popup
            </label>
          </div>

          <div className="p-4 bg-muted/30 rounded-lg space-y-3">
            <h4 className="text-sm font-medium text-foreground">Zotero / Mendeley Import</h4>
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
                Import
              </button>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Wave 3 Sync & Export"
        description="Logseq sync, card versioning export, and Mnemosyne portability"
      >
        <div className="space-y-4">
          <div className="p-4 bg-muted/30 rounded-lg space-y-3">
            <h4 className="text-sm font-medium text-foreground">Logseq Bidirectional Sync</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                value={logseqConfig.vaultPath}
                onChange={(e) => setLogseqConfig((current) => ({ ...current, vaultPath: e.target.value }))}
                placeholder="Vault path"
                className="px-2 py-1 border border-border rounded bg-background text-sm"
              />
              <input
                value={logseqConfig.notesFolder}
                onChange={(e) => setLogseqConfig((current) => ({ ...current, notesFolder: e.target.value }))}
                placeholder="Notes folder"
                className="px-2 py-1 border border-border rounded bg-background text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  const stats = await syncToLogseq(logseqConfig);
                  alert(`Synced to Logseq: ${stats.documents} docs, ${stats.extracts} extracts`);
                }}
                className="px-3 py-2 bg-primary text-primary-foreground rounded text-sm"
              >
                Sync To Logseq
              </button>
              <button
                onClick={async () => {
                  const stats = await syncFromLogseq(logseqConfig);
                  alert(`Synced from Logseq: ${stats.documents} docs, ${stats.extracts} extracts`);
                }}
                className="px-3 py-2 border border-border rounded text-sm text-foreground"
              >
                Sync From Logseq
              </button>
            </div>
          </div>

          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-medium text-foreground mb-2">Mnemosyne Export</h4>
            <button
              onClick={async () => {
                const path = await exportMnemosyne();
                alert(`Mnemosyne export created: ${path}`);
              }}
              className="px-3 py-2 bg-primary text-primary-foreground rounded text-sm"
            >
              Export Mnemosyne
            </button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Wave 3 Automation API"
        description="Authenticated local REST endpoints for external tools"
      >
        <div className="space-y-3">
          <div className="p-4 bg-muted/30 rounded-lg space-y-2">
            <div className="text-sm text-foreground">Automation API key</div>
            <code className="block text-xs break-all text-muted-foreground">{automationApiKey || "Not set"}</code>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  const key = await rotateAutomationApiKey();
                  setAutomationApiKey(key);
                  const config = await getBrowserSyncConfig();
                  await setBrowserSyncConfig({ ...config, apiKey: key });
                }}
                className="px-3 py-2 bg-primary text-primary-foreground rounded text-sm"
              >
                Rotate API Key
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              REST routes: <code>/api/automation/cards</code>, <code>/api/automation/reviews/due-count</code>, <code>/api/automation/reviews/submit</code>
            </p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Wave 3 Plugin Host"
        description="Install plugin manifests, grant permissions, and manage activation lifecycle"
      >
        <div className="space-y-3">
          <textarea
            value={pluginManifestText}
            onChange={(e) => setPluginManifestText(e.target.value)}
            className="w-full min-h-24 px-3 py-2 bg-background border border-border rounded-md text-xs font-mono"
          />
          <button
            onClick={() => {
              const manifest = JSON.parse(pluginManifestText) as PluginManifest;
              installPlugin(manifest);
              refreshPlugins();
            }}
            className="px-3 py-2 bg-primary text-primary-foreground rounded text-sm"
          >
            Install Plugin Manifest
          </button>
          <div className="space-y-2">
            {plugins.map((plugin) => (
              <div key={plugin.manifest.id} className="p-3 border border-border rounded-md bg-muted/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{plugin.manifest.name}</p>
                    <p className="text-xs text-muted-foreground">{plugin.manifest.id} · v{plugin.manifest.version}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {plugin.active ? (
                      <button
                        onClick={() => {
                          deactivatePlugin(plugin.manifest.id);
                          refreshPlugins();
                        }}
                        className="px-2 py-1 border border-border rounded text-xs"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          for (const permission of plugin.manifest.permissions) {
                            grantPluginPermission(plugin.manifest.id, permission);
                          }
                          activatePlugin(plugin.manifest.id);
                          refreshPlugins();
                        }}
                        className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs"
                      >
                        Activate
                      </button>
                    )}
                    <button
                      onClick={() => {
                        uninstallPlugin(plugin.manifest.id);
                        refreshPlugins();
                      }}
                      className="px-2 py-1 border border-destructive text-destructive rounded text-xs"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Permissions: {plugin.manifest.permissions.join(", ") || "none"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Wave 4 Community"
        description="Community marketplace, collaborative study groups, and public profile sharing"
      >
        <div className="space-y-4">
          <div className="p-4 bg-muted/30 rounded-lg space-y-3">
            <h4 className="text-sm font-medium text-foreground">Community Deck Marketplace</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                value={communityDeckTitle}
                onChange={(e) => setCommunityDeckTitle(e.target.value)}
                placeholder="Deck title"
                className="px-2 py-1 border border-border rounded bg-background text-sm"
              />
              <input
                value={communityDeckDescription}
                onChange={(e) => setCommunityDeckDescription(e.target.value)}
                placeholder="Deck description"
                className="px-2 py-1 border border-border rounded bg-background text-sm"
              />
            </div>
            <button
              onClick={async () => {
                const cards = await getAllLearningItems();
                const selected = cards.slice(0, 50);
                publishCommunityDeck({
                  title: communityDeckTitle,
                  description: communityDeckDescription,
                  cardCount: selected.length,
                  sourceUser: "local-user",
                  cards: cardsToCommunityDeckCards(selected),
                });
                refreshSocial();
              }}
              className="px-3 py-2 bg-primary text-primary-foreground rounded text-sm"
            >
              Publish Deck
            </button>
            <div className="space-y-2">
              {communityDecks.map((deck) => (
                <div key={deck.id} className="p-3 border border-border rounded bg-card">
                  <p className="text-sm font-medium text-foreground">{deck.title}</p>
                  <p className="text-xs text-muted-foreground">{deck.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {deck.cardCount} cards • rating {deck.ratingAverage.toFixed(1)} ({deck.ratingsCount})
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={async () => {
                        const imported = await installCommunityDeck(deck.id);
                        alert(`Installed ${imported} cards`);
                      }}
                      className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs"
                    >
                      Install
                    </button>
                    <button
                      onClick={() => {
                        rateCommunityDeck(deck.id, 5);
                        refreshSocial();
                      }}
                      className="px-2 py-1 border border-border rounded text-xs"
                    >
                      Rate 5★
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-muted/30 rounded-lg space-y-3">
            <h4 className="text-sm font-medium text-foreground">Collaborative Study Groups</h4>
            <div className="flex items-center gap-2">
              <input
                value={studyGroupName}
                onChange={(e) => setStudyGroupName(e.target.value)}
                className="flex-1 px-2 py-1 border border-border rounded bg-background text-sm"
                placeholder="Group name"
              />
              <button
                onClick={() => {
                  createStudyGroup(studyGroupName);
                  refreshSocial();
                }}
                className="px-3 py-2 bg-primary text-primary-foreground rounded text-sm"
              >
                Create Group
              </button>
            </div>
            {studyGroups.map((group) => (
              <div key={group.id} className="p-3 border border-border rounded bg-card">
                <p className="text-sm font-medium text-foreground">{group.name}</p>
                <p className="text-xs text-muted-foreground">
                  Decks: {group.deckIds.length} • Members: {Object.keys(group.memberStats).length}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => {
                      const firstDeck = communityDecks[0];
                      if (!firstDeck) return;
                      attachDeckToGroup(group.id, firstDeck.id);
                      refreshSocial();
                    }}
                    className="px-2 py-1 border border-border rounded text-xs"
                  >
                    Attach First Deck
                  </button>
                  <button
                    onClick={() => {
                      updateGroupMemberStats(group.id, "me", 120, 0.88);
                      refreshSocial();
                    }}
                    className="px-2 py-1 border border-border rounded text-xs"
                  >
                    Update Metrics
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-muted/30 rounded-lg space-y-3">
            <h4 className="text-sm font-medium text-foreground">Public Profile Sharing</h4>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={publicProfile.enabled}
                onChange={(e) => {
                  const next = { ...publicProfile, enabled: e.target.checked };
                  setPublicProfileConfig(next);
                  setPublicProfile(next);
                }}
              />
              Enable public profile
            </label>
            <input
              value={publicProfile.slug}
              onChange={(e) => {
                const next = { ...publicProfile, slug: e.target.value };
                setPublicProfileConfig(next);
                setPublicProfile(next);
              }}
              placeholder="profile slug"
              className="w-full px-2 py-1 border border-border rounded bg-background text-sm"
            />
            <div className="flex items-center gap-3 text-xs">
              {(["streak", "cardsLearned", "retentionRate", "reviewsToday"] as const).map((field) => (
                <label key={field} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={publicProfile.fields.includes(field)}
                    onChange={(e) => {
                      const fields = e.target.checked
                        ? Array.from(new Set([...publicProfile.fields, field]))
                        : publicProfile.fields.filter((entry) => entry !== field);
                      const next = { ...publicProfile, fields };
                      setPublicProfileConfig(next);
                      setPublicProfile(next);
                    }}
                  />
                  {field}
                </label>
              ))}
            </div>
            <pre className="text-xs bg-background border border-border rounded p-2 overflow-auto">
              {JSON.stringify(
                buildPublicProfileData(publicProfile, {
                  streak: 12,
                  cardsLearned: 340,
                  retentionRate: 0.91,
                  reviewsToday: 42,
                }),
                null,
                2
              )}
            </pre>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Wave 4 UX & Language"
        description="Focus/Zen review mode and multi-language interface"
      >
        <div className="space-y-3">
          <div className="p-4 bg-muted/30 rounded-lg space-y-2">
            <label className="text-sm text-foreground font-medium">Interface language</label>
            <select
              value={settings.general.language}
              onChange={(e) => updateSettingsCategory("general", { language: e.target.value })}
              className="w-full md:w-64 px-2 py-1 border border-border rounded bg-background text-sm"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="de">German</option>
            </select>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg space-y-2">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={settings.interface.reviewZenMode}
                onChange={(e) => updateSettingsCategory("interface", { reviewZenMode: e.target.checked })}
              />
              Enable Focus/Zen review mode
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={settings.interface.conversationalReviewEnabled}
                onChange={(e) =>
                  updateSettingsCategory("interface", { conversationalReviewEnabled: e.target.checked })
                }
              />
              Enable conversational review tutor
            </label>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Wave 4 Daily Notes"
        description="Daily note / Zettelkasten links for cards and extracts created today"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dailyNoteDate}
              onChange={(e) => setDailyNoteDate(e.target.value)}
              className="px-2 py-1 border border-border rounded bg-background text-sm"
            />
            <button
              onClick={async () => {
                const links = await getDailyNoteLinks(dailyNoteDate);
                setDailyNoteLinks(links);
              }}
              className="px-3 py-2 bg-primary text-primary-foreground rounded text-sm"
            >
              Load Daily Links
            </button>
          </div>
          <div className="space-y-2">
            {dailyNoteLinks.length === 0 ? (
              <p className="text-xs text-muted-foreground">No linked artifacts for this date.</p>
            ) : (
              dailyNoteLinks.map((entry, index) => (
                <div key={`${index}-${String(entry.id || "")}`} className="rounded border border-border p-2 text-xs">
                  <p className="text-foreground">
                    {String(entry.type || "item")} · {String(entry.id || "")}
                  </p>
                  <p className="text-muted-foreground">{String(entry.title || "")}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </SettingsSection>
    </>
  );
}
