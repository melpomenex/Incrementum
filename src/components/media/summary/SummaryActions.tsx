import { useState, useCallback } from "react";
import { Copy, Check, Share2, Lightbulb, FileText } from "lucide-react";
import { cn } from "../../../utils";
import { useToast } from "../../common/Toast";

interface SummaryActionsProps {
  /** Summary content to act upon */
  content: string;
  /** Article title for context */
  articleTitle?: string;
  /** Article URL for sharing */
  articleUrl?: string;
  /** Callback to save as extract */
  onSaveAsExtract?: () => void;
  /** Callback to export as document */
  onExportAsDocument?: () => void;
}

/**
 * Summary Actions Component
 * Provides copy, share, save, and export actions for summaries
 */
export function SummaryActions({
  content,
  articleTitle,
  articleUrl,
  onSaveAsExtract,
  onExportAsDocument,
}: SummaryActionsProps) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  /** Copy summary to clipboard */
  const handleCopy = useCallback(async () => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = content;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);

        if (!successful) {
          throw new Error("Copy command failed");
        }
      }

      setCopied(true);
      toast.success("Copied", "Summary copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Copy failed", "Could not copy to clipboard");
    }
  }, [content, toast]);

  /** Share summary using Web Share API or fallback to clipboard */
  const handleShare = useCallback(async () => {
    const shareData = {
      title: articleTitle ? `${articleTitle} - Summary` : "Article Summary",
      text: content,
      url: articleUrl,
    };

    try {
      // Check if Web Share API is available
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        toast.success("Shared", "Summary shared successfully");
      } else {
        // Fallback: copy to clipboard with URL
        const textToCopy = articleUrl ? `${content}\n\nSource: ${articleUrl}` : content;

        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(textToCopy);
        } else {
          const textArea = document.createElement("textarea");
          textArea.value = textToCopy;
          textArea.style.position = "fixed";
          textArea.style.left = "-9999px";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);
        }

        toast.success("Copied for sharing", "Summary and URL copied to clipboard");
      }
    } catch (error) {
      // User cancelled share - not an error
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.error("Failed to share:", error);
      toast.error("Share failed", "Could not share summary");
    }
  }, [content, articleTitle, articleUrl, toast]);

  return (
    <div className="flex items-center gap-1">
      {/* Copy button */}
      <button
        onClick={handleCopy}
        className={cn(
          "p-1.5 rounded transition-colors",
          copied
            ? "text-green-600 bg-green-100 dark:bg-green-900/30"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
        title={copied ? "Copied!" : "Copy to clipboard"}
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>

      {/* Share button */}
      <button
        onClick={handleShare}
        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
        title="Share"
      >
        <Share2 className="w-4 h-4" />
      </button>

      {/* Save as Extract button */}
      {onSaveAsExtract && (
        <button
          onClick={onSaveAsExtract}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
          title="Save as Extract"
        >
          <Lightbulb className="w-4 h-4" />
        </button>
      )}

      {/* Export as Document button */}
      {onExportAsDocument && (
        <button
          onClick={onExportAsDocument}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
          title="Export as Document"
        >
          <FileText className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
