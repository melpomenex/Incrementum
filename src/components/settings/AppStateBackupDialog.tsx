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
  Tag,
  FileText,
} from "lucide-react";
import type { ExportProgress } from "../../utils/appStateExport";
import { exportAppState, downloadExport, estimateExportSize } from "../../utils/appStateExport";
import type { ImportProgress, ImportResult, ImportOptions } from "../../utils/appStateImport";
import { importAppState, readExportFile, validateExportFile, previewExport } from "../../utils/appStateImport";
import { useDocumentStore } from "../../stores/documentStore";
import { useI18n } from "../../lib/i18n";

type DialogMode = "menu" | "export" | "import" | "exporting" | "importing" | "success" | "error";

interface AppStateBackupDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AppStateBackupDialog({ isOpen, onClose }: AppStateBackupDialogProps) {
  const { t } = useI18n();
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
      setError(err instanceof Error ? err.message : t("backup.exportFailed"));
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
        setError(validation.error || t("backup.invalidExportFile"));
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
      setError(err instanceof Error ? err.message : t("backup.failedReadFile"));
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
        setError(result.error || t("backup.importFailed"));
        setMode("error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("backup.importFailed"));
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
              <h2 className="text-lg font-semibold">{t("backup.title")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("backup.subtitle")}
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
                    <h3 className="font-semibold text-foreground mb-1">{t("backup.exportBackup")}</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {t("backup.exportBackupDesc")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs px-2 py-1 bg-muted rounded-full text-muted-foreground">
                        {documents.length} {t("backup.documents").toLowerCase()}
                      </span>
                      <span className="text-xs px-2 py-1 bg-muted rounded-full text-muted-foreground">
                        {t("backup.allSettings")}
                      </span>
                      <span className="text-xs px-2 py-1 bg-muted rounded-full text-muted-foreground">
                        {t("backup.studyProgress")}
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
                    <h3 className="font-semibold text-foreground mb-1">{t("backup.importBackup")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t("backup.importBackupDesc")}
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
                  <strong>{t("backup.note")}</strong> {t("backup.exportFilesNote")}
                </p>
              </div>
            </div>
          )}

          {mode === "export" && (
            <div className="space-y-6">
              {/* Export Label */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("backup.backupLabel")} <span className="text-muted-foreground">{t("backup.optional")}</span>
                </label>
                <input
                  type="text"
                  value={exportLabel}
                  onChange={(e) => setExportLabel(e.target.value)}
                  placeholder={t("backup.backupLabelPlaceholder")}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("backup.backupLabelHint")}
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
                    <div className="font-medium">{t("backup.includeDocFiles")}</div>
                    <p className="text-sm text-muted-foreground">
                      {t("backup.includeDocumentFilesDesc")}
                    </p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {t("backup.estimatedSize")} <strong>{estimateExportSize(documents, includeFiles)}</strong>
                    </div>
                  </div>
                </label>
              </div>

              {/* What's Included */}
              <div className="space-y-2">
                <div className="text-sm font-medium">{t("backup.whatsIncluded")}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Settings className="w-4 h-4" />
                    {t("backup.allSettingsAndPrefs")}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <BookOpen className="w-4 h-4" />
                    {t("backup.documentsAndMetadata")}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="w-4 h-4" />
                    {t("backup.extractsAndHighlights")}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Layers className="w-4 h-4" />
                    {t("backup.learningItemsAndScheduling")}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Tag className="w-4 h-4" />
                    {t("backup.collectionsAndTags")}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <HardDrive className="w-4 h-4" />
                    {includeFiles ? t("backup.docFilesIncluded") : t("backup.docFilesNotIncluded")}
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
                  <span className="text-sm text-muted-foreground">{t("backup.backupLabel")}</span>
                  <span className="font-medium">{exportPreview.label || t("backup.unlabeled")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t("backup.exported")}</span>
                  <span className="font-medium">
                    {new Date(exportPreview.exportedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t("backup.includesFiles")}</span>
                  <span className={exportPreview.includesFiles ? "text-green-500" : "text-muted-foreground"}>
                    {exportPreview.includesFiles ? t("backup.yes") : t("backup.no")}
                  </span>
                </div>
                <div className="border-t border-border pt-3 mt-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-muted-foreground" />
                      {exportPreview.stats.documentCount} {t("backup.documents").toLowerCase()}
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      {exportPreview.stats.extractCount} {t("backup.extracts").toLowerCase()}
                    </div>
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-muted-foreground" />
                      {exportPreview.stats.learningItemCount} {t("backup.learningItems").toLowerCase()}
                    </div>
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-muted-foreground" />
                      {exportPreview.stats.collectionCount} {t("backup.collections").toLowerCase()}
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
                  {t("backup.importOptions")}
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
                        {t("backup.duplicateHandling")}
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
                        <option value="skip">{t("backup.skipDuplicates")}</option>
                        <option value="replace">{t("backup.replaceExisting")}</option>
                        <option value="merge">{t("backup.mergeCreateNew")}</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Warning */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-600">
                <AlertCircle className="w-4 h-4 inline mr-2" />
                {t("backup.importWarning")}
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
                  {importResult ? t("backup.importComplete") : t("backup.exportComplete")}
                </div>
                <p className="text-sm text-muted-foreground">
                  {importResult
                    ? t("backup.importCompleteDesc", { documents: importResult.stats.documentsImported, extracts: importResult.stats.extractsImported, learningItems: importResult.stats.learningItemsImported })
                    : t("backup.yourBackupSaved")}
                </p>
              </div>
              {importResult && importResult.warnings.length > 0 && (
                <div className="text-left p-4 bg-amber-500/10 rounded-lg max-h-40 overflow-y-auto">
                  <div className="text-sm font-medium text-amber-600 mb-2">{t("backup.warnings")}</div>
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
                <div className="font-medium text-lg">{t("backup.operationFailed")}</div>
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
              {t("common.close")}
            </button>
          )}

          {mode === "export" && (
            <>
              <button
                onClick={() => setMode("menu")}
                className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("common.back")}
              </button>
              <button
                onClick={handleStartExport}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {t("backup.exportBackup")}
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
                {t("common.back")}
              </button>
              <button
                onClick={handleStartImport}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {t("backup.importBackup")}
              </button>
            </>
          )}

          {(mode === "success" || mode === "error") && (
            <button
              onClick={resetDialog}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              {mode === "success" ? t("common.done") : t("backup.tryAgain")}
            </button>
          )}

          {(mode === "exporting" || mode === "importing") && (
            <button
              disabled
              className="px-4 py-2 bg-muted text-muted-foreground rounded-lg cursor-not-allowed"
            >
              {t("backup.processing")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
