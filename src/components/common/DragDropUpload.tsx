/**
 * Drag and Drop Upload Component
 *
 * Provides drag and drop file upload functionality for documents,
 * supporting PDF, EPUB, Markdown, TXT, HTML, and .apkg (Anki) files.
 * Also supports markdown bundles (directories with .md + images + metadata).
 */

import { useCallback, useState, useRef, useEffect } from "react";
import { Upload, FileText, BookOpen, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "../../utils";
import { isTauri } from "../../lib/tauri";
import { storeBrowserFile } from "../../lib/browser-file-store";
import { useI18n } from "../../lib/i18n";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { detectMarkdownBundle, type MarkdownBundle } from "../../utils/markdownBundleImport";

export type SupportedFileType =
  | "pdf"
  | "epub"
  | "md"
  | "txt"
  | "html"
  | "json"
  | "apkg"
  | "mp3"
  | "wav"
  | "m4a"
  | "aac"
  | "ogg"
  | "flac"
  | "opus"
  | "mp4"
  | "webm"
  | "mov"
  | "mkv"
  | "avi"
  | "m4v";

interface FileTypeInfo {
  extension: string;
  label: string;
  icon: React.ElementType;
  color: string;
}

const FILE_TYPE_MAP: Record<string, FileTypeInfo> = {
  pdf: { extension: "pdf", label: "PDF", icon: FileText, color: "text-red-500" },
  epub: { extension: "epub", label: "EPUB", icon: BookOpen, color: "text-green-500" },
  md: { extension: "md", label: "Markdown", icon: FileText, color: "text-blue-500" },
  txt: { extension: "txt", label: "Text", icon: FileText, color: "text-gray-500" },
  html: { extension: "html", label: "HTML", icon: FileText, color: "text-orange-500" },
  json: { extension: "json", label: "JSON", icon: FileText, color: "text-yellow-500" },
  apkg: { extension: "apkg", label: "Anki", icon: BookOpen, color: "text-blue-600" },
  mp3: { extension: "mp3", label: "Audio", icon: FileText, color: "text-purple-500" },
  mp4: { extension: "mp4", label: "Video", icon: FileText, color: "text-pink-500" },
};

const SUPPORTED_EXTENSIONS = [
  "pdf", "epub", "md", "markdown", "txt", "html", "htm", "json",
  "mp3", "wav", "m4a", "aac", "ogg", "flac", "opus",
  "mp4", "webm", "mov", "mkv", "avi", "m4v",
  "apkg"
];

interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
  virtualPath?: string;
}

interface DragDropUploadProps {
  onFilesImported?: (filePaths: string[]) => void;
  onAnkiPackage?: (filePath: string) => void;
  /** Called when a .json file is dropped that validates as a JSON deck */
  onStudyJsonDeck?: (filePath: string) => void;
  /** Called when a markdown bundle is detected (markdown + images + metadata) */
  onBundleDetected?: (bundle: MarkdownBundle, files: File[]) => void;
  className?: string;
  children?: React.ReactNode;
}

export function DragDropUpload({
  onFilesImported,
  onAnkiPackage,
  onStudyJsonDeck,
  onBundleDetected,
  className,
  children,
}: DragDropUploadProps) {
  const { t } = useI18n();
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadFile[]>([]);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Refs for Tauri listener cleanup (must be at component level for hooks rules)
  const unlistenFnsRef = useRef<(() => void)[]>([]);
  const isMountedRef = useRef(true);

  const safelyCleanupListener = useCallback((unlisten?: (() => void) | null) => {
    if (typeof unlisten !== "function") return;
    try {
      unlisten();
    } catch {
      // Ignore cleanup failures if the listener was already removed internally.
    }
  }, []);

  // Handle drag enter
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;

    // Check if files are being dragged
    if (e.dataTransfer?.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  // Handle drag leave
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;

    if (dragCounter.current === 0) {
      setIsDragging(false);
      setIsDragOver(false);
    }
  }, []);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  // Validate and process dropped files
  const processFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);

    // Check for markdown bundles first
    if (onBundleDetected) {
      const bundleResult = await detectMarkdownBundle(fileArray);
      if (bundleResult.isBundle && bundleResult.bundle) {
        console.log("[DragDropUpload] Markdown bundle detected:", bundleResult.bundle);
        onBundleDetected(bundleResult.bundle, fileArray);
        return;
      }
    }

    const newUploads: UploadFile[] = [];
    const validFiles: File[] = [];

    Array.from(files).forEach((file) => {
      const extension = file.name.split(".").pop()?.toLowerCase() || "";

      if (SUPPORTED_EXTENSIONS.includes(extension)) {
        validFiles.push(file);
        newUploads.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          name: file.name,
          size: file.size,
          type: extension,
          status: "pending",
          progress: 0,
        });
      }
    });

    if (newUploads.length > 0) {
      setUploadQueue((prev) => [...prev, ...newUploads]);
      setShowUploadPanel(true);

      // Process the files
      processUploadQueue(newUploads);
    }
  }, [onBundleDetected]);

  // Process upload queue
  const processUploadQueue = async (files: UploadFile[]) => {
    for (const uploadFile of files) {
      try {
        updateFileStatus(uploadFile.id, "uploading", 50);

        // Handle Anki packages separately
        if (uploadFile.type === "apkg") {
          if (isTauri()) {
            // In Tauri, use the native file path
            const filePath = (uploadFile.file as any).path;
            if (filePath) {
              updateFileStatus(uploadFile.id, "success", 100, filePath);
              onAnkiPackage?.(filePath);
            } else {
              throw new Error("Could not get file path");
            }
          } else {
            // Store in browser file store
            const virtualPath = storeBrowserFile(uploadFile.file);
            updateFileStatus(uploadFile.id, "success", 100, virtualPath);
            onAnkiPackage?.(virtualPath);
          }
          continue;
        }

        // Handle JSON deck files
        if (uploadFile.type === "json") {
          if (isTauri()) {
            const filePath = (uploadFile.file as any).path;
            if (filePath) {
              updateFileStatus(uploadFile.id, "success", 100, filePath);
              onStudyJsonDeck?.(filePath);
            } else {
              throw new Error("Could not get file path");
            }
          } else {
            const virtualPath = storeBrowserFile(uploadFile.file);
            updateFileStatus(uploadFile.id, "success", 100, virtualPath);
            onStudyJsonDeck?.(virtualPath);
          }
          continue;
        }

        // Handle regular documents
        if (isTauri()) {
          // In Tauri, use the native file path directly
          const filePath = (uploadFile.file as any).path;
          if (filePath) {
            updateFileStatus(uploadFile.id, "success", 100, filePath);
          } else {
            throw new Error("Could not get file path");
          }
        } else {
          // In browser, store in virtual file store
          const virtualPath = storeBrowserFile(uploadFile.file);
          updateFileStatus(uploadFile.id, "success", 100, virtualPath);
        }
      } catch (error) {
        console.error("Failed to process file:", uploadFile.name, error);
        updateFileStatus(
          uploadFile.id,
          "error",
          0,
          undefined,
          error instanceof Error ? error.message : t("dragDropUpload.importFailed")
        );
      }
    }

    // Notify parent of completed imports
    const successfulUploads = uploadQueue
      .filter((f) => f.status === "success" && f.virtualPath && f.type !== "apkg" && f.type !== "json")
      .map((f) => f.virtualPath!);

    if (successfulUploads.length > 0) {
      onFilesImported?.(successfulUploads);
    }
  };

  // Update file status in queue
  const updateFileStatus = (
    id: string,
    status: UploadFile["status"],
    progress: number,
    virtualPath?: string,
    error?: string
  ) => {
    setUploadQueue((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, status, progress, virtualPath, error } : f
      )
    );
  };

  // Recursively traverse directory to collect files
  const traverseDirectory = async (entry: FileSystemDirectoryEntry): Promise<File[]> => {
    const files: File[] = [];
    const reader = entry.createReader();
    
    const readEntries = async (): Promise<void> => {
      const entries = await new Promise<FileSystemEntry[]>((resolve) => {
        reader.readEntries(resolve);
      });
      
      if (entries.length === 0) return;
      
      for (const entry of entries) {
        if (entry.isFile) {
          const fileEntry = entry as FileSystemFileEntry;
          const file = await new Promise<File>((resolve) => {
            fileEntry.file(resolve);
          });
          files.push(file);
        } else if (entry.isDirectory) {
          const subFiles = await traverseDirectory(entry as FileSystemDirectoryEntry);
          files.push(...subFiles);
        }
      }
      
      // Continue reading if there are more entries
      await readEntries();
    };
    
    await readEntries();
    return files;
  };

  // Handle drop with folder support
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);
      setIsDragOver(false);

      const dt = e.dataTransfer;
      if (!dt) return;

      // In Tauri, use dt.files directly as webkitGetAsEntry doesn't work properly
      if (isTauri()) {
        const files = dt.files;
        if (files && files.length > 0) {
          processFiles(files);
        }
        return;
      }

      // In browser, check if we have items (for folder support) or just files
      if (dt.items && dt.items.length > 0) {
        const allFiles: File[] = [];
        
        // Convert DataTransferItemList to array and process
        const items = Array.from(dt.items);
        
        for (const item of items) {
          const entry = item.webkitGetAsEntry();
          if (!entry) continue;
          
          if (entry.isFile) {
            const file = item.getAsFile();
            if (file) allFiles.push(file);
          } else if (entry.isDirectory) {
            // Recursively traverse directory
            const dirFiles = await traverseDirectory(entry as FileSystemDirectoryEntry);
            allFiles.push(...dirFiles);
          }
        }
        
        if (allFiles.length > 0) {
          // Create a mock FileList-like object
          const fileList = {
            length: allFiles.length,
            item: (index: number) => allFiles[index],
            [Symbol.iterator]: function* () {
              for (let i = 0; i < allFiles.length; i++) {
                yield allFiles[i];
              }
            }
          } as FileList;
          Object.setPrototypeOf(fileList, FileList.prototype);
          
          // Override the length property
          Object.defineProperty(fileList, 'length', {
            value: allFiles.length,
            writable: false
          });
          
          // Add files as array-like properties
          allFiles.forEach((file, index) => {
            (fileList as any)[index] = file;
          });
          
          processFiles(fileList);
        }
      } else {
        // Fallback to regular files
        const files = dt.files;
        processFiles(files || null);
      }
    },
    [processFiles]
  );

  // Handle file input change
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      processFiles(e.target.files);
      e.target.value = ""; // Reset input
    },
    [processFiles]
  );

  // Handle click to upload
  const handleClickUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Remove file from queue
  const removeFromQueue = useCallback((id: string) => {
    setUploadQueue((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // Clear completed uploads
  const clearCompleted = useCallback(() => {
    setUploadQueue((prev) => prev.filter((f) => f.status !== "success"));
    if (uploadQueue.every((f) => f.status === "success")) {
      setShowUploadPanel(false);
      setUploadQueue([]);
    }
  }, [uploadQueue]);

  // Set up global drag and drop listeners
  useEffect(() => {
    // For browser mode - use HTML5 drag and drop
    const handleGlobalDragEnter = (e: globalThis.DragEvent) => {
      const types = e.dataTransfer?.types || [];
      console.log("[DragDropUpload] Global dragenter:", types);
      
      // Only show drop zone if files are being dragged
      const hasFiles = Array.from(types).some(t => 
        t === "Files" || t === "file" || t.startsWith("application/") || t.startsWith("image/") || t.startsWith("text/")
      );
      
      if (hasFiles || types.length === 0) {
        console.log("[DragDropUpload] Files detected (types:", types, "), showing overlay");
        setIsDragging(true);
      }
    };

    const handleGlobalDragLeave = (e: globalThis.DragEvent) => {
      console.log("[DragDropUpload] Global dragleave");
      e.preventDefault();
      e.stopPropagation();
    };

    const handleGlobalDragOver = (e: globalThis.DragEvent) => {
      console.log("[DragDropUpload] Global dragover");
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    };

    const handleGlobalDrop = async (e: globalThis.DragEvent) => {
      console.log("[DragDropUpload] Global drop:", e.dataTransfer?.files?.length, "files");
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);
      setIsDragOver(false);

      const dt = e.dataTransfer;
      if (!dt) return;

      // In browser, check if we have items (for folder support) or just files
      if (dt.items && dt.items.length > 0) {
        const allFiles: File[] = [];
        
        const items = Array.from(dt.items);
        
        for (const item of items) {
          const entry = item.webkitGetAsEntry();
          if (!entry) continue;
          
          if (entry.isFile) {
            const file = item.getAsFile();
            if (file) allFiles.push(file);
          } else if (entry.isDirectory) {
            const dirFiles = await traverseDirectory(entry as FileSystemDirectoryEntry);
            allFiles.push(...dirFiles);
          }
        }
        
        if (allFiles.length > 0) {
          const fileList = {
            length: allFiles.length,
            item: (index: number) => allFiles[index],
            [Symbol.iterator]: function* () {
              for (let i = 0; i < allFiles.length; i++) {
                yield allFiles[i];
              }
            }
          } as FileList;
          Object.setPrototypeOf(fileList, FileList.prototype);
          Object.defineProperty(fileList, 'length', { value: allFiles.length, writable: false });
          allFiles.forEach((file, index) => { (fileList as any)[index] = file; });
          processFiles(fileList);
        }
      } else {
        const files = dt.files;
        if (files && files.length > 0) {
          processFiles(files);
        }
      }
    };

    // Browser mode listeners
    window.addEventListener("dragenter", handleGlobalDragEnter);
    window.addEventListener("dragleave", handleGlobalDragLeave);
    window.addEventListener("dragover", handleGlobalDragOver);
    window.addEventListener("drop", handleGlobalDrop);

    // Tauri native drag-drop listeners (only in Tauri)
    // Note: unlistenFnsRef and isMountedRef are defined at component level to follow hooks rules
    // Clear any stale listeners from previous mounts before starting fresh
    isMountedRef.current = true;
    unlistenFnsRef.current = [];

    if (isTauri()) {
      const setupTauriListeners = async () => {
        try {
          const appWindow = getCurrentWindow();

          // Check if component is still mounted before setting up listeners
          if (!isMountedRef.current) return;

          const unlistenDragEnter = await appWindow.listen("tauri://drag-enter", () => {
            console.log("[DragDropUpload] Tauri drag-enter");
            setIsDragging(true);
          });
          if (!isMountedRef.current) {
            safelyCleanupListener(unlistenDragEnter);
            return;
          }
          if (typeof unlistenDragEnter === "function") {
            unlistenFnsRef.current.push(unlistenDragEnter);
          }

          const unlistenDragOver = await appWindow.listen("tauri://drag-over", () => {
            console.log("[DragDropUpload] Tauri drag-over");
            setIsDragOver(true);
          });
          if (!isMountedRef.current) {
            safelyCleanupListener(unlistenDragOver);
            return;
          }
          if (typeof unlistenDragOver === "function") {
            unlistenFnsRef.current.push(unlistenDragOver);
          }

          const unlistenDragLeave = await appWindow.listen("tauri://drag-leave", () => {
            console.log("[DragDropUpload] Tauri drag-leave");
            dragCounter.current = 0;
            setIsDragging(false);
            setIsDragOver(false);
          });
          if (!isMountedRef.current) {
            safelyCleanupListener(unlistenDragLeave);
            return;
          }
          if (typeof unlistenDragLeave === "function") {
            unlistenFnsRef.current.push(unlistenDragLeave);
          }

          const unlistenDrop = await appWindow.listen("tauri://drop", (event: any) => {
            console.log("[DragDropUpload] Tauri drop:", event.payload);
            dragCounter.current = 0;
            setIsDragging(false);
            setIsDragOver(false);

            // Tauri sends file paths in the payload
            const paths: string[] = event.payload?.paths || [];
            if (paths.length > 0) {
              console.log("[DragDropUpload] Tauri dropped files:", paths);
              // Route .json files to deck import, everything else to regular import
              const jsonPaths = paths.filter(p => p.toLowerCase().endsWith('.json'));
              const regularPaths = paths.filter(p => !p.toLowerCase().endsWith('.json'));
              if (regularPaths.length > 0) {
                onFilesImported?.(regularPaths);
              }
              for (const jsonPath of jsonPaths) {
                onStudyJsonDeck?.(jsonPath);
              }
            }
          });
          if (!isMountedRef.current) {
            safelyCleanupListener(unlistenDrop);
            return;
          }
          if (typeof unlistenDrop === "function") {
            unlistenFnsRef.current.push(unlistenDrop);
          }

          console.log("[DragDropUpload] Tauri drag-drop listeners registered");
        } catch (err) {
          console.error("[DragDropUpload] Failed to setup Tauri listeners:", err);
        }
      };

      setupTauriListeners();
    }

    return () => {
      isMountedRef.current = false;
      window.removeEventListener("dragenter", handleGlobalDragEnter);
      window.removeEventListener("dragleave", handleGlobalDragLeave);
      window.removeEventListener("dragover", handleGlobalDragOver);
      window.removeEventListener("drop", handleGlobalDrop);

      // Clean up all Tauri listeners that were actually registered
      // Capture the current array and clear the ref before calling unlisten
      // to prevent double-cleanup if the effect runs again
      const listenersToCleanup = [...unlistenFnsRef.current];
      unlistenFnsRef.current = [];

      listenersToCleanup.forEach((unlisten) => {
        safelyCleanupListener(unlisten);
      });
    };
  }, [processFiles, safelyCleanupListener, traverseDirectory, onFilesImported]);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get file icon and color
  const getFileIcon = (type: string) => {
    const info = FILE_TYPE_MAP[type] || FILE_TYPE_MAP["txt"];
    return info;
  };

  const pendingCount = uploadQueue.filter((f) => f.status === "pending" || f.status === "uploading").length;
  const successCount = uploadQueue.filter((f) => f.status === "success").length;

  // Debug: log drag state changes
  useEffect(() => {
    console.log("[DragDropUpload] Drag state changed - isDragging:", isDragging, "isDragOver:", isDragOver);
  }, [isDragging, isDragOver]);

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={SUPPORTED_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Drag overlay */}
      {isDragging && (
        <div
          className={cn(
            "fixed inset-0 z-[100] flex items-center justify-center transition-all duration-200",
            isDragOver ? "bg-primary/20" : "bg-background/80 backdrop-blur-sm"
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div
            className={cn(
              "flex flex-col items-center justify-center p-12 rounded-2xl border-2 border-dashed transition-all duration-200",
              isDragOver
                ? "border-primary bg-primary/10 scale-105"
                : "border-border bg-card"
            )}
          >
            <div
              className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-all duration-200",
                isDragOver ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              <Upload className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {isDragOver ? t("dragDropUpload.dropToImport") : t("dragDropUpload.dragFilesOrFoldersHere")}
            </h3>
            <p className="text-muted-foreground text-center max-w-md">
              {t("dragDropUpload.supportedTypes")}
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {["PDF", "EPUB", "MD", "APKG", "MP3", "MP4", "Folders"].map((type) => (
                <span
                  key={type}
                  className="px-3 py-1 text-xs font-medium bg-muted rounded-full text-muted-foreground"
                >
                  {type}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Upload panel */}
      {showUploadPanel && uploadQueue.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 w-96 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              <span className="font-medium">{t("dragDropUpload.fileImport")}</span>
              {pendingCount > 0 && (
                <span className="text-xs text-muted-foreground">{t("dragDropUpload.pendingCount", { count: pendingCount })}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {successCount > 0 && (
                <button
                  onClick={clearCompleted}
                  className="text-xs text-primary hover:underline px-2"
                >
                  {t("dragDropUpload.clearCompleted")}
                </button>
              )}
              <button
                onClick={() => setShowUploadPanel(false)}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* File list */}
          <div className="max-h-64 overflow-y-auto">
            {uploadQueue.map((file) => {
              const fileInfo = getFileIcon(file.type);
              const Icon = fileInfo.icon;

              return (
                <div
                  key={file.id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/50"
                >
                  <div className={cn("p-2 rounded-lg bg-muted", fileInfo.color)}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                      {file.status === "uploading" && ` • ${t("dragDropUpload.uploading")}`}
                      {file.status === "error" && file.error && (
                        <span className="text-destructive"> • {file.error}</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {file.status === "pending" && (
                      <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                    )}
                    {file.status === "uploading" && (
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    )}
                    {file.status === "success" && (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    )}
                    {file.status === "error" && (
                      <AlertCircle className="w-5 h-5 text-destructive" />
                    )}

                    {file.status !== "uploading" && (
                      <button
                        onClick={() => removeFromQueue(file.id)}
                        className="p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border bg-muted/30">
            <button
              onClick={handleClickUpload}
              className="w-full py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {t("dragDropUpload.addMoreFiles")}
            </button>
          </div>
        </div>
      )}

      {/* Wrap children */}
      <div className={className}>{children}</div>
    </>
  );
}

/**
 * Simple drop zone component for use within specific areas
 */
interface DropZoneProps {
  onFilesDropped: (files: File[]) => void;
  className?: string;
  children?: React.ReactNode;
}

export function DropZone({ onFilesDropped, className, children }: DropZoneProps) {
  const { t } = useI18n();
  const [isDragOver, setIsDragOver] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      const validFiles = files.filter((file) => {
        const extension = file.name.split(".").pop()?.toLowerCase() || "";
        return SUPPORTED_EXTENSIONS.includes(extension);
      });

      if (validFiles.length > 0) {
        onFilesDropped(validFiles);
      }
    },
    [onFilesDropped]
  );

  return (
    <div
      ref={dropRef}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        "relative transition-all duration-200",
        isDragOver && "ring-2 ring-primary ring-inset bg-primary/5",
        className
      )}
    >
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/10 backdrop-blur-sm z-10 rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-primary" />
            <span className="text-sm font-medium text-primary">{t("dragDropUpload.dropFilesToImport")}</span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
