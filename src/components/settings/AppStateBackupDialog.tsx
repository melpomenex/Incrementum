/**
 * App State Backup Dialog
 *
 * Provides UI for exporting and importing complete app state including:
 * - Settings and preferences
 * - Documents with metadata and scheduling
 * - Extracts and learning items
 * - Collections
 * - Optional: document files
 */

import { useState, useCallback, useRef } from "react";
import { 
  Download, 
  Upload, 
  FileArchive, 
  Settings, 
  BookOpen, 
  Layers, 
  Database,
  Check,
  AlertCircle,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Calendar,
  Tag,
  FileText,
} from "lucide-react";
import { cn } from "../../utils";
import { isTauri } from "../../lib/tauri";
import type { ExportProgress } from "../../utils/appStateExport";
import { exportAppState, downloadExport, generateExportFilename, estimateExportSize } from "../../utils/appStateExport";
import type { ImportProgress, ImportResult, ImportOptions } from "../../utils/appStateImport";
import { importAppState, readExportFile, validateExportFile, previewExport } from "../../utils/appStateImport";
import type { AppStateExport } from "../../utils/appStateExport";
import { useDocumentStore } from "../../stores/documentStore";

type DialogMode = "menu" | "export" | "import" | "exporting" | "importing" | "success" | "error";

interface AppStateBackupDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AppStateBackupDialog({ isOpen, onClose }: AppStateBackupDialogProps) {
  const [mode, setMode] = useState<DialogMode>("menu");
  const [error, setError] = useState<string | null>(null);
  
  // Export state
  const [exportLabel, setExportLabel] = useState("");
  const [includeFiles, setIncludeFiles] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  
  // Import state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [exportPreview, setExportPreview] = useState<ReturnType<typeof previewExport> | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    importSettings: true,
    importDocuments: true,
    importExtracts: true,
    importLearningItems: true,
    importCollections: true,
    importUIState: false,
    importFiles: true,
    duplicateStrategy: "skip",
  });
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documents = useDocumentStore((state) => state.documents);

  const handleStartExport = useCallback(async () => {
    setMode("exporting");
    setError(null);
    
    try {
      const exportData = await exportAppState({
        label: exportLabel || undefined,
        includeFiles,
        onProgress: setExportProgress,
      });
      
      await downloadExport(exportData);
      setMode("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
      setMode("error");
    }
  }, [exportLabel, includeFiles]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSelectedFile(file);
    setError(null);
    
    try {
      const exportData = await readExportFile(file);
      const validation = validateExportFile(exportData);
      
      if (!validation.valid) {
        setError(validation.error || "Invalid export file");
        setMode("error");
        return;
      }
      
      setExportPreview(previewExport(exportData));
      
      // Auto-enable file import if files are included
      if (validation.metadata?.includesFiles) {
        setImportOptions((prev) => ({ ...prev, importFiles: true }));
      }
      
      setMode("import");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
      setMode("error");
    }
  }, []);

  const handleStartImport = useCallback(async () => {
    if (!selectedFile) return;
    
    setMode("importing");
    setError(null);
    
    try {
      const exportData = await readExportFile(selectedFile);
      
      const result = await importAppState(exportData, {
        ...importOptions,
        onProgress: setImportProgress,
      });
      
      setImportResult(result);
      
      if (result.success) {
        setMode("success");
      } else {
        setError(result.error || "Import failed");
        setMode("error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setMode("error");
    }
  }, [selectedFile, importOptions]);

  const resetDialog = useCallback(() => {
    setMode("menu");
    setError(null);
    setExportLabel("");
    setIncludeFiles(false);
    setExportProgress(null);
    setSelectedFile(null);
    setExportPreview(null);
    setImportProgress(null);
    setImportResult(null);
    setImportOptions({
      importSettings: true,
      importDocuments: true,
      importExtracts: true,
      importLearningItems: true,
      importCollections: true,
      importUIState: false,
      importFiles: true,
      duplicateStrategy: "skip",
    });
    setShowAdvancedOptions(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleClose = useCallback(() => {
    resetDialog();
    onClose();
  }, [onClose, resetDialog]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Backup & Restore</h2>
              <p className="text-sm text-muted-foreground">
                Export or import your complete app state
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {mode === "menu" && (
            <div className="space-y-6">
              {/* Export Option */}
              <button
                onClick={() => setMode("export")}
                className="w-full p-4 border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors">
                    <Download className="w-6 h-6 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1">Export Backup</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Save all your data including documents, extracts, learning items, 
                      settings, and study progress to a file.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs px-2 py-1 bg-muted rounded-full text-muted-foreground">
                        {documents.length} documents
                      </span>
                      <span className="text-xs px-2 py-1 bg-muted rounded-full text-muted-foreground">
                        All settings
                      </span>
                      <span className="text-xs px-2 py-1 bg-muted rounded-full text-muted-foreground">
                        Study progress
                      </span>
                    </div>
                  </div>
                </div>
              </button>

              {/* Import Option */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-4 border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-green-500/10 rounded-xl group-hover:bg-green-500/20 transition-colors">
                    <Upload className="w-6 h-6 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1">Import Backup</h3>
                    <p className="text-sm text-muted-foreground">
                      Restore your data from a previously exported backup file. 
                      Your study scheduling and progress will be preserved.
                    </p>
                  </div>
                </div>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".incrementum,.json,application/json"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Info */}
              <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <strong>Note:</strong> Export files include metadata and scheduling info. 
                  Document files are optional and significantly increase file size.
                </p>
              </div>
            </div>
          )}

          {mode === "export" && (
            <div className="space-y-6">
              {/* Export Label */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Backup Label <span className="text-muted-foreground">(optional)</span>
                </label>
                <input
                  type="text"
                  value={exportLabel}
                  onChange={(e) => setExportLabel(e.target.value)}
                  placeholder="e.g., Before reformatting PC"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This will be included in the filename for easy identification
                </p>
              </div>

              {/* Include Files Toggle */}
              <div className="p-4 border border-border rounded-lg">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeFiles}
                    onChange={(e) => setIncludeFiles(e.target.checked)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium">Include document files</div>
                    <p className="text-sm text-muted-foreground">
                      Also save the actual PDFs, EPUBs, etc. Makes the backup much larger 
                      but allows complete restoration without re-uploading files.
                    </p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Estimated size: <strong>{estimateExportSize(documents, includeFiles)}</strong>
                    </div>
                  </div>
                </label>
              </div>

              {/* What's Included */}
              <div className="space-y-2">
                <div className="text-sm font-medium">What's included:</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Settings className="w-4 h-4" />
                    All settings & preferences
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <BookOpen className="w-4 h-4" />
                    Documents & metadata
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="w-4 h-4" />
                    Extracts & highlights
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Layers className="w-4 h-4" />
                    Learning items & scheduling
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Tag className="w-4 h-4" />
                    Collections & tags
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <HardDrive className="w-4 h-4" />
                    {includeFiles ? "Document files (included)" : "Document files (not included)"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {mode === "exporting" && exportProgress && (
            <div className="py-8 text-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
              <div>
                <div className="font-medium">{exportProgress.message}</div>
                <div className="text-sm text-muted-foreground">
                  {exportProgress.processed} / {exportProgress.total}
                </div>
              </div>
              <div className="w-full max-w-xs mx-auto h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${exportProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          {mode === "import" && exportPreview && (
            <div className="space-y-6">
              {/* Preview */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Backup Label</span>
                  <span className="font-medium">{exportPreview.label || "Unlabeled"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Exported</span>
                  <span className="font-medium">
                    {new Date(exportPreview.exportedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Includes Files</span>
                  <span className={exportPreview.includesFiles ? "text-green-500" : "text-muted-foreground"}>
                    {exportPreview.includesFiles ? "Yes" : "No"}
                  </span>
                </div>
                <div className="border-t border-border pt-3 mt-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-muted-foreground" />
                      {exportPreview.stats.documentCount} documents
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      {exportPreview.stats.extractCount} extracts
                    </div>
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-muted-foreground" />
                      {exportPreview.stats.learningItemCount} learning items
                    </div>
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-muted-foreground" />
                      {exportPreview.stats.collectionCount} collections
                    </div>
                  </div>
                </div>
              </div>

              {/* Advanced Options */}
              <div>
                <button
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                >
                  {showAdvancedOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Import Options
                </button>
                
                {showAdvancedOptions && (
                  <div className="mt-3 space-y-3 p-4 border border-border rounded-lg">
                    {/* Import toggles */}
                    {[
                      { key: "importSettings", label: "Settings", icon: Settings },
                      { key: "importDocuments", label: "Documents", icon: BookOpen },
                      { key: "importExtracts", label: "Extracts", icon: FileText },
                      { key: "importLearningItems", label: "Learning Items", icon: Layers },
                      { key: "importCollections", label: "Collections", icon: Tag },
                      ...(exportPreview.includesFiles ? [{ key: "importFiles", label: "Document Files", icon: HardDrive }] : []),
                    ].map(({ key, label, icon: Icon }) => (
                      <label key={key} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={importOptions[key as keyof ImportOptions] as boolean}
                          onChange={(e) =>
                            setImportOptions((prev) => ({ ...prev, [key]: e.target.checked }))
                          }
                        />
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}

                    {/* Duplicate strategy */}
                    <div className="pt-3 border-t border-border">
                      <label className="text-sm font-medium mb-2 block">
                        Duplicate Handling
                      </label>
                      <select
                        value={importOptions.duplicateStrategy}
                        onChange={(e) =>
                          setImportOptions((prev) => ({
                            ...prev,
                            duplicateStrategy: e.target.value as ImportOptions["duplicateStrategy"],
                          }))
                        }
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                      >
                        <option value="skip">Skip duplicates</option>
                        <option value="replace">Replace existing</option>
                        <option value="merge">Merge (create new copies)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Warning */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-600">
                <AlertCircle className="w-4 h-4 inline mr-2" />
                Importing will add data to your current library. Duplicate handling 
                settings apply when items with the same content already exist.
              </div>
            </div>
          )}

          {mode === "importing" && importProgress && (
            <div className="py-8 text-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
              <div>
                <div className="font-medium">{importProgress.message}</div>
                <div className="text-sm text-muted-foreground">
                  {importProgress.processed} / {importProgress.total}
                </div>
              </div>
              <div className="w-full max-w-xs mx-auto h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${importProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          {mode === "success" && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <div>
                <div className="font-medium text-lg">
                  {importResult ? "Import Complete!" : "Export Complete!"}
                </div>
                <p className="text-sm text-muted-foreground">
                  {importResult
                    ? `Successfully imported ${importResult.stats.documentsImported} documents, ${importResult.stats.extractsImported} extracts, and ${importResult.stats.learningItemsImported} learning items.`
                    : "Your backup has been saved."}
                </p>
              </div>
              {importResult && importResult.warnings.length > 0 && (
                <div className="text-left p-4 bg-amber-500/10 rounded-lg max-h-40 overflow-y-auto">
                  <div className="text-sm font-medium text-amber-600 mb-2">Warnings:</div>
                  <ul className="text-xs text-amber-600 space-y-1">
                    {importResult.warnings.map((w, i) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {mode === "error" && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <div>
                <div className="font-medium text-lg">Operation Failed</div>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          {mode === "menu" && (
            <button
              onClick={handleClose}
              className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              Close
            </button>
          )}

          {mode === "export" && (
            <>
              <button
                onClick={() => setMode("menu")}
                className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleStartExport}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export Backup
              </button>
            </>
          )}

          {mode === "import" && (
            <>
              <button
                onClick={() => {
                  setMode("menu");
                  setSelectedFile(null);
                  setExportPreview(null);
                }}
                className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleStartImport}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Import Backup
              </button>
            </>
          )}

          {(mode === "success" || mode === "error") && (
            <button
              onClick={resetDialog}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              {mode === "success" ? "Done" : "Try Again"}
            </button>
          )}

          {(mode === "exporting" || mode === "importing") && (
            <button
              disabled
              className="px-4 py-2 bg-muted text-muted-foreground rounded-lg cursor-not-allowed"
            >
              Processing...
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
