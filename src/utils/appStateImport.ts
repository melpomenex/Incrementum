/**
 * App State Import Utility
 *
 * Imports application state from an export file.
 * Handles restoring documents, extracts, learning items, settings, and collections.
 * Supports importing document files if they were included in the export.
 */

import { useSettingsStore } from "../stores/settingsStore";
import { useCollectionStore } from "../stores/collectionStore";
import { useUIStore } from "../stores/uiStore";
import { useDocumentStore } from "../stores/documentStore";
import type { Document } from "../types/document";
import { isTauri } from "../lib/tauri";
import { storeBrowserFile } from "../lib/browser-file-store";
import type { AppStateExport, ExportMetadata } from "./appStateExport";
import { APP_STATE_EXPORT_VERSION } from "./appStateExport";

/**
 * Import options
 */
export interface ImportOptions {
  /** What to import */
  importSettings: boolean;
  importDocuments: boolean;
  importExtracts: boolean;
  importLearningItems: boolean;
  importCollections: boolean;
  importUIState: boolean;
  importFiles: boolean;
  /** Strategy for handling duplicates */
  duplicateStrategy: "skip" | "replace" | "merge";
  /** Progress callback */
  onProgress?: (progress: ImportProgress) => void;
}

/**
 * Import progress
 */
export interface ImportProgress {
  /** Current phase */
  phase: "validating" | "settings" | "files" | "documents" | "extracts" | "learningItems" | "collections" | "complete";
  /** Progress message */
  message: string;
  /** Progress percentage (0-100) */
  percent: number;
  /** Items processed so far */
  processed: number;
  /** Total items to process */
  total: number;
  /** Any warnings encountered */
  warnings?: string[];
}

/**
 * Import result
 */
export interface ImportResult {
  /** Whether import was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Statistics about what was imported */
  stats: {
    documentsImported: number;
    documentsSkipped: number;
    extractsImported: number;
    learningItemsImported: number;
    collectionsImported: number;
    filesRestored: number;
  };
  /** Warnings encountered during import */
  warnings: string[];
}

/**
 * Validate export file
 */
export function validateExportFile(data: unknown): { valid: boolean; error?: string; metadata?: ExportMetadata } {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Invalid export file format" };
  }

  const exportData = data as Partial<AppStateExport>;

  // Check metadata
  if (!exportData.metadata) {
    return { valid: false, error: "Missing export metadata" };
  }

  if (exportData.metadata.version !== APP_STATE_EXPORT_VERSION) {
    // Allow imports from older versions but warn
    if (exportData.metadata.version > APP_STATE_EXPORT_VERSION) {
      return { valid: false, error: `Export version ${exportData.metadata.version} is newer than supported version ${APP_STATE_EXPORT_VERSION}. Please update the app.` };
    }
  }

  if (exportData.metadata.app !== "Incrementum") {
    return { valid: false, error: "Invalid export file: not an Incrementum backup" };
  }

  return { valid: true, metadata: exportData.metadata };
}

/**
 * Read export file
 */
export async function readExportFile(file: File): Promise<AppStateExport> {
  let text = await file.text();
  
  // Strip header comments if present (format: // comment\n)
  if (text.startsWith("//")) {
    const lines = text.split("\n");
    const jsonStartIndex = lines.findIndex((line) => !line.startsWith("//") && line.trim() !== "");
    if (jsonStartIndex > 0) {
      text = lines.slice(jsonStartIndex).join("\n");
    }
  }
  
  try {
    const data = JSON.parse(text) as AppStateExport;
    return data;
  } catch {
    throw new Error("Failed to parse export file: invalid JSON");
  }
}

/**
 * Import app state from export
 */
export async function importAppState(
  exportData: AppStateExport,
  options: ImportOptions
): Promise<ImportResult> {
  const {
    importSettings,
    importDocuments,
    importExtracts,
    importLearningItems,
    importCollections,
    importUIState,
    importFiles,
    duplicateStrategy,
    onProgress,
  } = options;

  const result: ImportResult = {
    success: true,
    stats: {
      documentsImported: 0,
      documentsSkipped: 0,
      extractsImported: 0,
      learningItemsImported: 0,
      collectionsImported: 0,
      filesRestored: 0,
    },
    warnings: [],
  };

  const updateProgress = (progress: ImportProgress) => {
    onProgress?.(progress);
  };

  // Phase 1: Validate
  updateProgress({
    phase: "validating",
    message: "Validating export file...",
    percent: 0,
    processed: 0,
    total: 6,
  });

  const validation = validateExportFile(exportData);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      stats: result.stats,
      warnings: result.warnings,
    };
  }

  // Check version compatibility
  if (exportData.metadata.version < APP_STATE_EXPORT_VERSION) {
    result.warnings.push(`Importing from older export format (v${exportData.metadata.version}). Some features may not be restored.`);
  }

  // Phase 2: Import Settings
  if (importSettings && exportData.settings) {
    updateProgress({
      phase: "settings",
      message: "Restoring settings...",
      percent: 5,
      processed: 0,
      total: 6,
    });

    try {
      useSettingsStore.getState().updateSettings(exportData.settings);
    } catch (error) {
      result.warnings.push(`Failed to restore some settings: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  // Phase 3: Import Collections (before documents so assignments work)
  let collectionIdMap: Record<string, string> = {}; // Maps old IDs to new IDs

  if (importCollections && exportData.collections) {
    updateProgress({
      phase: "collections",
      message: "Restoring collections...",
      percent: 10,
      processed: 1,
      total: 6,
    });

    const { collections, createCollection } = useCollectionStore.getState();
    const existingNames = new Set(collections.map((c) => c.name.toLowerCase()));

    for (const collection of exportData.collections) {
      try {
        // Check for duplicates by name
        if (existingNames.has(collection.name.toLowerCase()) && duplicateStrategy === "skip") {
          // Find existing collection with same name
          const existing = collections.find((c) => c.name.toLowerCase() === collection.name.toLowerCase());
          if (existing) {
            collectionIdMap[collection.id] = existing.id;
          }
          continue;
        }

        // Create new collection
        const newCollection = createCollection(collection.name);
        collectionIdMap[collection.id] = newCollection.id;
        result.stats.collectionsImported++;
      } catch {
        result.warnings.push(`Failed to import collection "${collection.name}"`);
      }
    }
  }

  // Phase 4: Restore Files (if included)
  const restoredFilePaths: Record<string, string> = {}; // Maps old file paths to new paths

  if (importFiles && exportData.files && exportData.fileMappings) {
    updateProgress({
      phase: "files",
      message: "Restoring document files...",
      percent: 20,
      processed: 2,
      total: 6,
    });

    const fileEntries = Object.entries(exportData.files);
    
    for (let i = 0; i < fileEntries.length; i++) {
      const [docId, fileData] = fileEntries[i];
      
      try {
        // Decode base64 data
        const binary = atob(fileData.data);
        const bytes = new Uint8Array(binary.length);
        for (let j = 0; j < binary.length; j++) {
          bytes[j] = binary.charCodeAt(j);
        }
        const blob = new Blob([bytes], { type: getMimeType(fileData.type) });
        const file = new File([blob], fileData.name, { type: getMimeType(fileData.type) });

        if (isTauri()) {
          // In Tauri, save to app data directory
          const [{ writeFile, BaseDirectory, appDataDir }, { join }] = await Promise.all([
            import("@tauri-apps/plugin-fs"),
            import("@tauri-apps/api/path"),
          ]);
          
          const appData = await appDataDir();
          const fileName = `restored_${Date.now()}_${fileData.name}`;
          const filePath = await join(appData, "documents", fileName);
          
          await writeFile(filePath, bytes, { baseDir: BaseDirectory.AppData });
          restoredFilePaths[docId] = filePath;
        } else {
          // In browser, store in virtual file store
          const virtualPath = storeBrowserFile(file);
          restoredFilePaths[docId] = virtualPath;
        }

        result.stats.filesRestored++;

        // Update progress
        if (i % 5 === 0) {
          updateProgress({
            phase: "files",
            message: `Restoring files (${i + 1}/${fileEntries.length})...`,
            percent: 20 + Math.floor((i / fileEntries.length) * 20),
            processed: i + 1,
            total: fileEntries.length,
          });
        }
      } catch {
        result.warnings.push(`Failed to restore file for document ${docId}: ${fileData.name}`);
      }
    }
  }

  // Phase 5: Import Documents
  const documentIdMap: Record<string, string> = {}; // Maps old IDs to new IDs

  if (importDocuments && exportData.documents) {
    updateProgress({
      phase: "documents",
      message: "Restoring documents...",
      percent: 40,
      processed: 3,
      total: 6,
    });

    const { documents } = useDocumentStore.getState();
    const { assignDocument } = useCollectionStore.getState();

    for (let i = 0; i < exportData.documents.length; i++) {
      const doc = exportData.documents[i];
      
      try {
        // Check for duplicates by content hash or file path
        const isDuplicate = documents.some(
          (d) => d.contentHash && d.contentHash === doc.contentHash
        );

        if (isDuplicate) {
          if (duplicateStrategy === "skip") {
            result.stats.documentsSkipped++;
            // Find the existing document ID for mapping
            const existing = documents.find((d) => d.contentHash === doc.contentHash);
            if (existing) {
              documentIdMap[doc.id] = existing.id;
            }
            continue;
          }
        }

        // Update file path if file was restored
        let newFilePath = doc.filePath;
        if (restoredFilePaths[doc.id]) {
          newFilePath = restoredFilePaths[doc.id];
        }

        // Create document via API
        let newDoc: Document;
        if (isTauri()) {
          const { invokeCommand } = await import("../lib/tauri");
          newDoc = await invokeCommand<Document>("create_document", {
            title: doc.title,
            filePath: newFilePath,
            fileType: doc.fileType,
          });
        } else {
          const { browserInvoke } = await import("../lib/browser-backend");
          newDoc = await browserInvoke<Document>("create_document", {
            title: doc.title,
            filePath: newFilePath,
            fileType: doc.fileType,
          });
        }

        // Update document with all metadata including scheduling
        const updates: Partial<Document> = {
          content: doc.content,
          contentHash: doc.contentHash,
          totalPages: doc.totalPages,
          currentPage: doc.currentPage,
          currentScrollPercent: doc.currentScrollPercent,
          currentCfi: doc.currentCfi,
          currentViewState: doc.currentViewState,
          positionJson: doc.positionJson,
          progressPercent: doc.progressPercent,
          category: doc.category,
          tags: doc.tags,
          dateAdded: doc.dateAdded,
          dateModified: doc.dateModified,
          dateLastReviewed: doc.dateLastReviewed,
          extractCount: doc.extractCount,
          learningItemCount: doc.learningItemCount,
          priorityRating: doc.priorityRating,
          prioritySlider: doc.prioritySlider,
          priorityScore: doc.priorityScore,
          isArchived: doc.isArchived,
          isFavorite: doc.isFavorite,
          metadata: doc.metadata,
          nextReadingDate: doc.nextReadingDate,
          readingCount: doc.readingCount,
          stability: doc.stability,
          difficulty: doc.difficulty,
          reps: doc.reps,
          totalTimeSpent: doc.totalTimeSpent,
        };

        if (isTauri()) {
          const { invokeCommand } = await import("../lib/tauri");
          await invokeCommand<Document>("update_document", { id: newDoc.id, updates });
        } else {
          const { browserInvoke } = await import("../lib/browser-backend");
          await browserInvoke<Document>("update_document", { id: newDoc.id, updates });
        }

        // Map old ID to new ID
        documentIdMap[doc.id] = newDoc.id;

        // Restore collection assignment
        const oldCollectionId = exportData.documentAssignments?.[doc.id];
        if (oldCollectionId) {
          const newCollectionId = collectionIdMap[oldCollectionId];
          if (newCollectionId) {
            assignDocument(newDoc.id, newCollectionId);
          }
        }

        result.stats.documentsImported++;

        // Update progress
        if (i % 5 === 0) {
          updateProgress({
            phase: "documents",
            message: `Restoring documents (${i + 1}/${exportData.documents.length})...`,
            percent: 40 + Math.floor((i / exportData.documents.length) * 20),
            processed: i + 1,
            total: exportData.documents.length,
          });
        }
      } catch (error) {
        result.warnings.push(`Failed to import document "${doc.title}": ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }
  }

  // Phase 6: Import Extracts
  if (importExtracts && exportData.extracts) {
    updateProgress({
      phase: "extracts",
      message: "Restoring extracts...",
      percent: 60,
      processed: 4,
      total: 6,
    });

    for (let i = 0; i < exportData.extracts.length; i++) {
      const extract = exportData.extracts[i];
      
      try {
        // Map to new document ID
        const newDocumentId = documentIdMap[extract.documentId];
        if (!newDocumentId) {
          // Document wasn't imported, skip extract
          continue;
        }

        const extractData = {
          ...extract,
          documentId: newDocumentId,
          id: undefined, // Let backend generate new ID
        };

        if (isTauri()) {
          const { invokeCommand } = await import("../lib/tauri");
          await invokeCommand("create_extract", { extract: extractData });
        } else {
          const { browserInvoke } = await import("../lib/browser-backend");
          await browserInvoke("create_extract", { extract: extractData });
        }

        result.stats.extractsImported++;

        // Update progress
        if (i % 10 === 0) {
          updateProgress({
            phase: "extracts",
            message: `Restoring extracts (${i + 1}/${exportData.extracts.length})...`,
            percent: 60 + Math.floor((i / exportData.extracts.length) * 15),
            processed: i + 1,
            total: exportData.extracts.length,
          });
        }
      } catch (error) {
        result.warnings.push(`Failed to import extract: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }
  }

  // Phase 7: Import Learning Items
  if (importLearningItems && exportData.learningItems) {
    updateProgress({
      phase: "learningItems",
      message: "Restoring learning items...",
      percent: 75,
      processed: 5,
      total: 6,
    });

    for (let i = 0; i < exportData.learningItems.length; i++) {
      const item = exportData.learningItems[i];
      
      try {
        // Map to new IDs
        const newDocumentId = item.documentId ? documentIdMap[item.documentId] : undefined;
        
        // Skip if associated document wasn't imported
        if (item.documentId && !newDocumentId) {
          continue;
        }

        const itemData = {
          ...item,
          documentId: newDocumentId,
          id: undefined, // Let backend generate new ID
        };

        if (isTauri()) {
          const { invokeCommand } = await import("../lib/tauri");
          await invokeCommand("create_learning_item", { item: itemData });
        } else {
          const { browserInvoke } = await import("../lib/browser-backend");
          await browserInvoke("create_learning_item", { item: itemData });
        }

        result.stats.learningItemsImported++;

        // Update progress
        if (i % 10 === 0) {
          updateProgress({
            phase: "learningItems",
            message: `Restoring learning items (${i + 1}/${exportData.learningItems.length})...`,
            percent: 75 + Math.floor((i / exportData.learningItems.length) * 20),
            processed: i + 1,
            total: exportData.learningItems.length,
          });
        }
      } catch (error) {
        result.warnings.push(`Failed to import learning item: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }
  }

  // Phase 8: Import UI State (optional, last)
  if (importUIState && exportData.uiState) {
    try {
      useUIStore.setState({
        sidebarCollapsed: exportData.uiState.sidebarCollapsed,
        dockPanelCollapsed: exportData.uiState.dockPanelCollapsed,
        theme: exportData.uiState.theme,
      });
    } catch {
      result.warnings.push("Failed to restore UI state");
    }
  }

  // Refresh document store
  try {
    await useDocumentStore.getState().loadDocuments();
  } catch {
    result.warnings.push("Failed to refresh document list after import");
  }

  updateProgress({
    phase: "complete",
    message: "Import complete!",
    percent: 100,
    processed: 6,
    total: 6,
    warnings: result.warnings,
  });

  return result;
}

/**
 * Get MIME type from file type
 */
function getMimeType(fileType: string): string {
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    epub: "application/epub+zip",
    markdown: "text/markdown",
    html: "text/html",
    audio: "audio/mpeg",
    video: "video/mp4",
  };
  return mimeTypes[fileType] || "application/octet-stream";
}

/**
 * Preview export file contents without importing
 */
export function previewExport(exportData: AppStateExport): {
  label?: string;
  exportedAt: string;
  includesFiles: boolean;
  stats: {
    documentCount: number;
    extractCount: number;
    learningItemCount: number;
    collectionCount: number;
  };
} {
  return {
    label: exportData.metadata.label,
    exportedAt: exportData.metadata.exportedAt,
    includesFiles: exportData.metadata.includesFiles,
    stats: exportData.metadata.stats,
  };
}
