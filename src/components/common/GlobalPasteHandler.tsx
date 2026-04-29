import { useEffect, useState, useCallback, useRef } from "react";
import { ClipboardPaste, X, Loader2, Save, Tag, FileText, Image as ImageIcon, AlertCircle } from "lucide-react";
import { createLearningItem } from "../../api/learning-items";
import { importDocument } from "../../api/documents";
import { isTauri } from "../../lib/tauri";
import { useI18n } from "../../lib/i18n";
import { useToast } from "./Toast";

/**
 * Determines whether a paste event should be intercepted.
 * Returns false for editable targets (inputs, textareas, contentEditable).
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  // Check for rich text editors (CodeMirror, ProseMirror, Monaco, etc.)
  if (target.closest(".cm-editor, .ProseMirror, .monaco-editor, [role=textbox], .ql-editor, .tiptap")) return true;
  return false;
}

/** Supported file types for library import via clipboard */
const SUPPORTED_FILE_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "application/epub+zip": "epub",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/html": "html",
  "application/json": "json",
  "application/octet-stream-apkg": "apkg",
};

/** File extensions we can import (fallback when MIME type is generic or missing) */
const SUPPORTED_EXTENSIONS = ["pdf", "epub", "txt", "md", "markdown", "html", "htm", "json", "apkg", "png", "jpg", "jpeg", "gif", "webp", "svg"];

interface PastedFile {
  blob: Blob;
  name: string;
  mimeType: string;
  /** Tauri-extended File objects may have a .path property */
  path?: string;
}

interface PastedContent {
  type: "text" | "files";
  text?: string;
  files?: PastedFile[];
}

/**
 * Lightweight modal for creating a learning item from pasted text.
 * Pre-fills the question field and lets the user edit before saving.
 */
function PasteTextEditor({
  initialText,
  onClose,
  onSave,
}: {
  initialText: string;
  onClose: () => void;
  onSave: (item: { question: string; answer: string; tags: string[] }) => Promise<void>;
}) {
  const { t } = useI18n();
  const [question, setQuestion] = useState(initialText);
  const [answer, setAnswer] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!question.trim()) return;
    setSaving(true);
    try {
      const tags = tagInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await onSave({ question, answer, tags });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <ClipboardPaste className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              {t("globalPaste.newFromClipboard")}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          {/* Question */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {t("globalPaste.question")}
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="min-h-[120px] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={t("globalPaste.questionPlaceholder")}
              autoFocus
            />
          </div>

          {/* Answer */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {t("globalPaste.answer")}
            </label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="min-h-[80px] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={t("globalPaste.answerPlaceholder")}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Tag className="h-3 w-3" />
              {t("globalPaste.tags")}
            </label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={t("globalPaste.tagsPlaceholder")}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={!question.trim() || saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {t("globalPaste.createCard")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Global paste handler.
 *
 * Intercepts Ctrl/Cmd+V when no editable element is focused:
 * - Text → opens a pre-filled card editor
 * - Supported files (PDF, images) → imports to library
 * - Unsupported content → error toast
 */
export function GlobalPasteHandler() {
  const { t } = useI18n();
  const toast = useToast();
  const [pastedContent, setPastedContent] = useState<PastedContent | null>(null);
  const processingRef = useRef(false);

  // Reset processing flag after a short delay to allow consecutive pastes
  const resetProcessing = useCallback(() => {
    setTimeout(() => {
      processingRef.current = false;
    }, 500);
  }, []);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Only Ctrl+V or Cmd+V
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "v") return;
      if (e.shiftKey || e.altKey) return; // Don't intercept Ctrl+Shift+V (paste plain text)
      if (isEditableTarget(e.target)) return;
      if (processingRef.current) return;

      // Don't prevent default yet — let the paste event handler do the work
      // This keydown handler just marks that we want to intercept
      processingRef.current = true;
    };

    const handlePaste = async (e: ClipboardEvent) => {
      // Only handle if we flagged it in keydown (non-editable target)
      if (!processingRef.current) return;
      if (isEditableTarget(e.target)) {
        processingRef.current = false;
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      try {
        // Check for files first
        const clipboardFiles = Array.from(e.clipboardData?.files ?? []);
        if (clipboardFiles.length > 0) {
          // Support files by MIME type OR by extension (Tauri often gives generic MIME types)
          const isSupported = (f: File) => {
            if (SUPPORTED_FILE_TYPES[f.type]) return true;
            const ext = f.name?.split(".").pop()?.toLowerCase() || "";
            return SUPPORTED_EXTENSIONS.includes(ext);
          };
          const supported = clipboardFiles.filter(isSupported);
          const unsupported = clipboardFiles.filter((f) => !isSupported(f));

          if (supported.length > 0) {
            setPastedContent({
              type: "files",
              files: supported.map((f) => ({
                blob: f,
                name: f.name || `clipboard-${Date.now()}.${SUPPORTED_FILE_TYPES[f.type] || "bin"}`,
                mimeType: f.type,
                path: (f as any).path || undefined,
              })),
            });
          }

          if (unsupported.length > 0) {
            const names = unsupported.map((f) => f.name || f.type).join(", ");
            toast.error(
              t("globalPaste.unsupportedFiles"),
              t("globalPaste.unsupportedFilesDesc", { files: names })
            );
          }

          resetProcessing();
          return;
        }

        // Try reading clipboard API for richer content (images in some browsers)
        if (navigator.clipboard?.read) {
          try {
            const items = await navigator.clipboard.read();
            const blobs: { blob: Blob; name: string; mimeType: string }[] = [];

            for (const item of items) {
              // Check for images
              const imageType = item.types.find((type) => type.startsWith("image/"));
              if (imageType) {
                const blob = await item.getType(imageType);
                const ext = SUPPORTED_FILE_TYPES[imageType] || "png";
                blobs.push({
                  blob,
                  name: `clipboard-image-${Date.now()}.${ext}`,
                  mimeType: imageType,
                });
              }
            }

            if (blobs.length > 0) {
              setPastedContent({ type: "files", files: blobs });
              resetProcessing();
              return;
            }
          } catch {
            // Clipboard read permission denied — fall through to text
          }
        }

        // Fall back to text
        const text = e.clipboardData?.getData("text/plain")?.trim();
        if (text && text.length > 0) {
          setPastedContent({ type: "text", text });
        } else {
          toast.error(t("globalPaste.noContent"), t("globalPaste.noContentDesc"));
        }
      } catch (err) {
        console.error("[GlobalPasteHandler] Error reading clipboard:", err);
        toast.error(t("common.error"), err instanceof Error ? err.message : undefined);
      } finally {
        resetProcessing();
      }
    };

    // Use capture phase so we get the event before any input handlers
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("paste", handlePaste, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("paste", handlePaste, true);
    };
  }, [t, toast, resetProcessing]);

  // Handle creating a card from pasted text
  const handleSaveCard = useCallback(
    async ({ question, answer, tags }: { question: string; answer: string; tags: string[] }) => {
      try {
        await createLearningItem({
          item_type: "basic",
          question,
          answer: answer || undefined,
          tags: tags.length > 0 ? tags : undefined,
          allow_duplicate: true,
        });
        toast.success(t("globalPaste.cardCreated"), t("globalPaste.cardCreatedDesc"));
        setPastedContent(null);
      } catch (err) {
        console.error("[GlobalPasteHandler] Failed to create card:", err);
        toast.error(t("common.error"), err instanceof Error ? err.message : undefined);
      }
    },
    [t, toast]
  );

  // Handle importing files from clipboard
  const handleImportFiles = useCallback(async () => {
    if (!pastedContent || pastedContent.type !== "files" || !pastedContent.files) return;

    const file = pastedContent.files[0];
    const ext = file.name?.split(".").pop()?.toLowerCase() || "";
    const isImage = file.mimeType.startsWith("image/");
    const isPdf = file.mimeType === "application/pdf" || ext === "pdf";

    if (isTauri()) {
      try {
        // If Tauri extended File with .path, use it directly — no need to write blob
        let filePath = file.path;

        if (!filePath) {
          // Fallback: write blob to temp dir
          const fs = await import("@tauri-apps/plugin-fs");
          const pathApi = await import("@tauri-apps/api/path");
          const tempPath = await pathApi.join(await pathApi.tempDir(), file.name);
          const arrayBuffer = await file.blob.arrayBuffer();
          await fs.writeFile(tempPath, new Uint8Array(arrayBuffer));
          filePath = tempPath;
        }

        if (isImage || isPdf || SUPPORTED_EXTENSIONS.includes(ext)) {
          await importDocument(filePath);
          toast.success(t("globalPaste.imported"), t("globalPaste.imageImportedDesc", { name: file.name }));
        } else {
          toast.error(t("globalPaste.unsupportedType"), t("globalPaste.unsupportedTypeDesc"));
        }
        setPastedContent(null);
      } catch (err) {
        console.error("[GlobalPasteHandler] Failed to import file:", err);
        toast.error(t("globalPaste.importFailed"), err instanceof Error ? err.message : undefined);
      }
    } else {
      // PWA/browser — save via download and notify user
      const url = URL.createObjectURL(file.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        t("globalPaste.imageDownloaded"),
        t("globalPaste.imageDownloadedDesc", { name: file.name })
      );
      setPastedContent(null);
    }
  }, [pastedContent, t, toast]);

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    setPastedContent(null);
  }, []);

  // No content to show
  if (!pastedContent) return null;

  // Text content → show editor modal
  if (pastedContent.type === "text" && pastedContent.text) {
    return (
      <PasteTextEditor
        initialText={pastedContent.text}
        onClose={handleDismiss}
        onSave={handleSaveCard}
      />
    );
  }

  // File content → show import confirmation
  if (pastedContent.type === "files" && pastedContent.files && pastedContent.files.length > 0) {
    const file = pastedContent.files[0];
    const isImage = file.mimeType.startsWith("image/");
    const isPdf = file.mimeType === "application/pdf";
    const ext = file.name?.split(".").pop()?.toLowerCase() || SUPPORTED_FILE_TYPES[file.mimeType] || "file";
    const sizeKB = Math.round(file.blob.size / 1024);
    const sizeLabel = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
    const canImport = isImage || isPdf || SUPPORTED_EXTENSIONS.includes(ext);

    return (
      <div className="fixed bottom-4 left-1/2 z-[140] -translate-x-1/2">
        <div className="w-[min(400px,calc(100vw-2rem))] rounded-xl border border-border bg-card p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              {(isImage || isPdf) ? (
              <ImageIcon className="h-5 w-5 text-primary" />
            ) : (
              <FileText className="h-5 w-5 text-blue-500" />
            )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {ext.toUpperCase()} · {sizeLabel}
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            {canImport && (
              <button
                onClick={() => void handleImportFiles()}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground hover:bg-primary/90"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                {isTauri() ? t("globalPaste.importToLibrary") : t("globalPaste.download")}
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
