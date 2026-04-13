/**
 * App State Export Utility
 *
 * Exports all application state to a JSON file for backup/restore/migration.
 * Includes settings, documents (metadata), extracts, learning items, collections,
 * and optionally the actual document files.
 */

import { useSettingsStore, type Settings } from "../stores/settingsStore";
import { useCollectionStore, type Collection } from "../stores/collectionStore";
import { useUIStore } from "../stores/uiStore";
import { useTabsStore } from "../stores/tabsStore";
import type { Document, Extract, LearningItem } from "../types/document";
import { isTauri } from "../lib/tauri";
import { getBrowserFile } from "../lib/browser-file-store";

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isLikelyNotFoundError(error: unknown): boolean {
  const msg = formatUnknownError(error);
  // Linux/macOS: "No such file or directory (os error 2)"
  // Windows: "The system cannot find the file specified"
  return (
    msg.includes("No such file or directory") ||
    msg.includes("os error 2") ||
    msg.includes("Document file not found") ||
    msg.startsWith("Not found:") ||
    msg.includes("cannot find the file specified")
  );
}

/**
 * App State Export Schema Version
 * Increment this when making breaking changes to the export format
 */
export const APP_STATE_EXPORT_VERSION = 1;

/**
 * File extension for Incrementum backup files
 */
export const INCREMENTUM_BACKUP_EXTENSION = ".incrementum";

/**
 * Export metadata for identification
 */
export interface ExportMetadata {
  /** Export format version */
  version: number;
  /** App name */
  app: string;
  /** Export timestamp */
  exportedAt: string;
  /** Export description/label */
  label?: string;
  /** Whether this export includes document files */
  includesFiles: boolean;
  /** Statistics about the export */
  stats: {
    documentCount: number;
    extractCount: number;
    learningItemCount: number;
    collectionCount: number;
    totalFileSize: number;
    skippedFileCount?: number;
  };
}

/**
 * Complete app state for export
 */
export interface AppStateExport {
  /** Export metadata */
  metadata: ExportMetadata;
  /** User settings */
  settings: Settings;
  /** Collections */
  collections: Collection[];
  /** Document assignments to collections */
  documentAssignments: Record<string, string>;
  /** Documents with all metadata and scheduling info */
  documents: Document[];
  /** Extracts for all documents */
  extracts: Extract[];
  /** Learning items (flashcards, etc.) */
  learningItems: LearningItem[];
  /** UI state (optional, less critical) */
  uiState?: {
    sidebarCollapsed: boolean;
    dockPanelCollapsed: boolean;
    theme: "light" | "dark";
  };
  /** Tab state */
  tabState?: {
    tabs: Array<{
      id: string;
      title: string;
      type: string;
      data?: Record<string, unknown>;
    }>;
    activeTabId: string | null;
  };
  /** Document files (optional, Base64 encoded) */
  files?: Record<string, {
    name: string;
    type: string;
    size: number;
    data: string; // Base64
  }>;
  /** File path mappings (original path -> document ID) */
  fileMappings?: Record<string, string>;
}

/**
 * Export options
 */
export interface ExportOptions {
  /** Label for this export */
  label?: string;
  /** Whether to include document files (makes export much larger) */
  includeFiles: boolean;
  /** Progress callback */
  onProgress?: (progress: ExportProgress) => void;
}

/**
 * Export progress
 */
export interface ExportProgress {
  /** Current phase */
  phase: "collecting" | "serializing" | "packaging" | "complete";
  /** Progress message */
  message: string;
  /** Progress percentage (0-100) */
  percent: number;
  /** Items processed so far */
  processed: number;
  /** Total items to process */
  total: number;
}

/**
 * Collect all app state for export
 */
export async function exportAppState(options: ExportOptions): Promise<AppStateExport> {
  const { label, includeFiles, onProgress } = options;

  const updateProgress = (progress: ExportProgress) => {
    onProgress?.(progress);
  };

  // Phase 1: Collecting data
  updateProgress({
    phase: "collecting",
    message: "Collecting settings and preferences...",
    percent: 0,
    processed: 0,
    total: 5,
  });

  // Get all store states
  const settings = useSettingsStore.getState().settings;
  const collections = useCollectionStore.getState().collections;
  const documentAssignments = useCollectionStore.getState().documentAssignments;
  const uiState = {
    sidebarCollapsed: useUIStore.getState().sidebarCollapsed,
    dockPanelCollapsed: useUIStore.getState().dockPanelCollapsed,
    theme: useUIStore.getState().theme,
  };
  const tabState = {
    tabs: useTabsStore.getState().tabs.map((t) => ({
      id: t.id,
      title: t.title,
      type: t.type,
      data: t.data,
    })),
    activeTabId: (useTabsStore.getState().rootPane as any)?.activeTabId ?? null,
  };

  updateProgress({
    phase: "collecting",
    message: "Loading documents...",
    percent: 10,
    processed: 1,
    total: 5,
  });

  // Fetch all documents
  let documents: Document[] = [];
  try {
    if (isTauri()) {
      const { invokeCommand } = await import("../lib/tauri");
      documents = await invokeCommand<Document[]>("get_documents");
    } else {
      const { browserInvoke } = await import("../lib/browser-backend");
      documents = await browserInvoke<Document[]>("get_documents");
    }
  } catch (error) {
    console.error("Failed to fetch documents:", error);
  }

  updateProgress({
    phase: "collecting",
    message: "Loading extracts...",
    percent: 30,
    processed: 2,
    total: 5,
  });

  // Fetch all extracts
  let extracts: Extract[] = [];
  try {
    if (isTauri()) {
      const { invokeCommand } = await import("../lib/tauri");
      extracts = await invokeCommand<Extract[]>("get_extracts", { documentId: null });
    } else {
      const { browserInvoke } = await import("../lib/browser-backend");
      extracts = await browserInvoke<Extract[]>("get_extracts", { documentId: null });
    }
  } catch (error) {
    console.error("Failed to fetch extracts:", error);
  }

  updateProgress({
    phase: "collecting",
    message: "Loading learning items...",
    percent: 50,
    processed: 3,
    total: 5,
  });

  // Fetch all learning items
  let learningItems: LearningItem[] = [];
  try {
    if (isTauri()) {
      const { invokeCommand } = await import("../lib/tauri");
      learningItems = await invokeCommand<LearningItem[]>("get_all_learning_items");
    } else {
      const { browserInvoke } = await import("../lib/browser-backend");
      learningItems = await browserInvoke<LearningItem[]>("get_all_learning_items");
    }
  } catch (error) {
    console.error("Failed to fetch learning items:", error);
  }

  updateProgress({
    phase: "collecting",
    message: includeFiles ? "Packaging document files..." : "Finalizing...",
    percent: 70,
    processed: 4,
    total: 5,
  });

  // Collect document files if requested
  const files: Record<string, { name: string; type: string; size: number; data: string }> = {};
  const fileMappings: Record<string, string> = {};
  let totalFileSize = 0;
  const skippedFiles: { id: string; title: string; path: string; reason: string }[] = [];

  if (includeFiles) {
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      try {
        let fileData: string | null = null;
        let fileName = doc.filePath.split("/").pop() || doc.filePath;

        if (isTauri()) {
          // In Tauri, first check if file exists
          const { invokeCommand } = await import("../lib/tauri");
          try {
            fileData = await invokeCommand<string>("read_document_file", { filePath: doc.filePath });
          } catch (readError: any) {
            // Check if it's a "file not found" error
            if (isLikelyNotFoundError(readError)) {
              skippedFiles.push({
                id: doc.id,
                title: doc.title,
                path: doc.filePath,
                reason: "File not found on disk",
              });
              console.warn(`Skipping document "${doc.title}": file not found at ${doc.filePath}`);
            } else {
              throw readError; // Re-throw other errors
            }
          }
        } else {
          // In browser, check browser file store
          const browserFile = getBrowserFile(doc.filePath);
          if (browserFile) {
            const arrayBuffer = await browserFile.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            fileName = browserFile.name;
            // Convert to base64
            const binary = bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), "");
            fileData = btoa(binary);
          } else {
            skippedFiles.push({
              id: doc.id,
              title: doc.title,
              path: doc.filePath,
              reason: "File not in browser storage",
            });
            console.warn(`Skipping document "${doc.title}": file not in browser storage`);
          }
        }

        if (fileData) {
          const fileSize = fileData.length * 0.75; // Approximate base64 size
          files[doc.id] = {
            name: fileName,
            type: doc.fileType,
            size: fileSize,
            data: fileData,
          };
          fileMappings[doc.filePath] = doc.id;
          totalFileSize += fileSize;
        }

        // Update progress for file packaging
        if (i % 5 === 0) {
          updateProgress({
            phase: "packaging",
            message: `Packaging files (${i + 1}/${documents.length})...`,
            percent: 70 + Math.floor((i / documents.length) * 20),
            processed: i + 1,
            total: documents.length,
          });
        }
      } catch (error) {
        console.warn(`Failed to package file for document ${doc.id}:`, error);
        skippedFiles.push({
          id: doc.id,
          title: doc.title,
          path: doc.filePath,
          reason: formatUnknownError(error),
        });
      }
    }
    
    // Log summary of skipped files
    if (skippedFiles.length > 0) {
      console.warn(`Backup completed with ${skippedFiles.length} file(s) skipped:`);
      skippedFiles.forEach(f => console.warn(`  - "${f.title}": ${f.reason}`));
    }
  }

  updateProgress({
    phase: "serializing",
    message: "Creating export file...",
    percent: 95,
    processed: 5,
    total: 5,
  });

  // Build export object
  const exportData: AppStateExport = {
    metadata: {
      version: APP_STATE_EXPORT_VERSION,
      app: "Incrementum",
      exportedAt: new Date().toISOString(),
      label,
      includesFiles: includeFiles,
      stats: {
        documentCount: documents.length,
        extractCount: extracts.length,
        learningItemCount: learningItems.length,
        collectionCount: collections.length,
        totalFileSize,
        skippedFileCount: skippedFiles.length,
      },
    },
    settings,
    collections,
    documentAssignments,
    documents,
    extracts,
    learningItems,
    uiState,
    tabState,
  };

  // Only include files if requested and any were found
  if (includeFiles && Object.keys(files).length > 0) {
    exportData.files = files;
    exportData.fileMappings = fileMappings;
  }

  updateProgress({
    phase: "complete",
    message: "Export complete!",
    percent: 100,
    processed: 5,
    total: 5,
  });

  return exportData;
}

/**
 * Generate filename for export
 */
export function generateExportFilename(label?: string): string {
  const date = new Date().toISOString().split("T")[0];
  const time = new Date().toTimeString().split(":")[0];
  const labelPart = label ? `-${label.replace(/[^a-zA-Z0-9-_]/g, "_")}` : "";
  return `incrementum-backup${labelPart}-${date}-${time}${INCREMENTUM_BACKUP_EXTENSION}`;
}

/**
 * Download export as file
 */
export async function downloadExport(
  exportData: AppStateExport,
  filename?: string
): Promise<void> {
  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: "application/json" });

  if (isTauri()) {
    // In Tauri, use native file save dialog
    const [{ save }, { writeTextFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs"),
    ]);

    const savePath = await save({
      defaultPath: filename || generateExportFilename(exportData.metadata.label),
      filters: [
        { name: "Incrementum Backup", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (savePath) {
      // Add a header comment to identify the file
      const fileContent = `// Incrementum Backup File v${APP_STATE_EXPORT_VERSION}\n// Exported: ${new Date().toISOString()}\n// WARNING: This file contains your personal data. Keep it secure.\n\n${json}`;
      await writeTextFile(savePath, fileContent);
    }
  } else {
    // In browser, use download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || generateExportFilename(exportData.metadata.label);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

/**
 * Get export size estimate
 */
export function estimateExportSize(documents: Document[], includeFiles: boolean): string {
  // Base metadata size estimate (settings, collections, etc.)
  let sizeBytes = 100 * 1024; // ~100KB base

  // Add document metadata
  sizeBytes += documents.length * 2 * 1024; // ~2KB per document

  // Add file sizes if including files
  if (includeFiles) {
    // We can't know exact sizes without reading files, so estimate
    // Average document size ~5MB
    sizeBytes += documents.length * 5 * 1024 * 1024;
  }

  // Format size
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(0)} KB`;
  } else if (sizeBytes < 1024 * 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  } else {
    return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}
