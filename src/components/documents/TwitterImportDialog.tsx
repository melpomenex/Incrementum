/**
 * TwitterImportDialog
 * Paste an x.com / twitter.com post URL to download its video, create a
 * Video document, and auto-queue transcription. Tauri-only.
 */

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Clipboard, Warning, XLogo } from "@phosphor-icons/react";
import type { Document } from "../../types/document";
import { importTwitterVideo } from "../../api/documents";
import { enqueueVideoTranscription } from "../../lib/videoTranscriptionQueue";
import { useCollectionStore } from "../../stores/collectionStore";
import { useDocumentStore } from "../../stores/documentStore";
import { useI18n } from "../../lib/i18n";
import { isTauri } from "../../lib/tauri";

interface TwitterImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDocument?: (doc: Document) => void;
}

const TWITTER_PATTERN = /(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/;

function isTwitterStatusURL(url: string): boolean {
  return TWITTER_PATTERN.test(url.trim());
}

export function TwitterImportDialog({ isOpen, onClose, onOpenDocument }: TwitterImportDialogProps) {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setUrl("");
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, loading, onClose]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text.trim());
    } catch {
      // Clipboard read may be blocked; ignore silently.
    }
  };

  const handleSubmit = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError(t("documentsView.pleaseEnterTwitterUrl"));
      return;
    }
    if (!isTwitterStatusURL(trimmed)) {
      setError(t("documentsView.pleaseEnterTwitterUrl"));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const collectionId = useCollectionStore.getState().activeCollectionId;
      const doc = await importTwitterVideo(trimmed, collectionId);

      // Auto-queue transcription so chat-with-video is ready automatically.
      if (doc.filePath) {
        enqueueVideoTranscription({
          documentId: doc.id,
          filePath: doc.filePath,
          documentTitle: doc.title,
        });
      }

      await useDocumentStore.getState().loadDocuments();
      onClose();
      onOpenDocument?.(doc);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import Twitter video");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const webMode = !isTauri();

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-lg w-full max-w-md p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <XLogo className="w-5 h-5" />
            <h2 className="text-lg font-semibold text-foreground">
              {t("documentsView.twitterImportTitle")}
            </h2>
          </div>
          <button
            onClick={() => !loading && onClose()}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {webMode ? (
          <p className="text-sm text-muted-foreground py-4">
            Twitter video import requires the desktop app.
          </p>
        ) : (
          <>
            {/* URL input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t("documentsView.pleaseEnterTwitterUrl")}
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !loading) handleSubmit();
                  }}
                  placeholder="https://x.com/user/status/123..."
                  disabled={loading}
                  autoFocus
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                />
                <button
                  onClick={handlePaste}
                  disabled={loading}
                  className="px-3 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors flex items-center gap-1 text-sm disabled:opacity-50"
                  title="Paste from clipboard"
                >
                  <Clipboard className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-3 flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
                <Warning className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" weight="fill" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Note */}
            <p className="mt-3 text-xs text-muted-foreground">
              {t("documentsView.twitterImportNote")}
            </p>

            {/* Footer */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => !loading && onClose()}
                disabled={loading}
                className="px-4 py-2 text-sm text-foreground hover:bg-muted rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm disabled:opacity-50 flex items-center gap-2"
              >
                {loading && (
                  <span className="w-3 h-3 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                )}
                {loading ? "Importing..." : t("documentsView.importTwitter")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
