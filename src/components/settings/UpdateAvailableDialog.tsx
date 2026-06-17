/**
 * UpdateAvailableDialog — modal shown when a new version is available.
 */

import { useEffect, useRef } from "react";
import {
  ArrowSquareOut,
  Clock,
  Prohibit,
  X,
} from "@phosphor-icons/react";
import { cn } from "../../utils";
import { setSkippedVersion, type UpdateInfo } from "../../utils/updateChecker";

interface UpdateAvailableDialogProps {
  update: UpdateInfo;
  onClose: () => void;
}

/**
 * Minimal markdown → JSX for GitHub release notes.
 * Handles: ### headings, - bullets, **bold**, [links](url)
 */
function renderReleaseNotes(markdown: string) {
  const lines = markdown.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line.trim()) {
      continue; // skip blank lines
    }

    // ### Heading
    if (/^###\s+/.test(line)) {
      elements.push(
        <h4
          key={`h-${i}`}
          className="text-sm font-semibold text-foreground mt-3 mb-1"
        >
          {line.replace(/^###\s+/, "")}
        </h4>
      );
      continue;
    }

    // ## Heading
    if (/^##\s+/.test(line)) {
      elements.push(
        <h3
          key={`h2-${i}`}
          className="text-base font-semibold text-foreground mt-3 mb-1"
        >
          {line.replace(/^##\s+/, "")}
        </h3>
      );
      continue;
    }

    // - bullet
    if (/^[-*]\s+/.test(line)) {
      const content = inlineMarkdown(line.replace(/^[-*]\s+/, ""));
      elements.push(
        <li
          key={`li-${i}`}
          className="text-sm text-muted-foreground ml-4 list-disc"
        >
          {content}
        </li>
      );
      continue;
    }

    elements.push(
      <p key={`p-${i}`} className="text-sm text-muted-foreground">
        {inlineMarkdown(line)}
      </p>
    );
  }

  return elements;
}

/**
 * Inline markdown: **bold**, [text](url)
 */
function inlineMarkdown(text: string): React.ReactNode {
  // Split by **bold** and [text](url) patterns
  const parts: React.ReactNode[] = [];
  // eslint-disable-next-line prefer-regex-literals
  const regex = /(\*\*(.+?)\*|\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // **bold**
      parts.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {match[2]}
        </strong>
      );
    } else if (match[3] && match[4]) {
      // [text](url)
      parts.push(
        <a
          key={match.index}
          href={match[4]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:opacity-80"
        >
          {match[3]}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 0 ? text : parts;
}

export function UpdateAvailableDialog({
  update,
  onClose,
}: UpdateAvailableDialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  const handleUpdateNow = async () => {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(update.downloadUrl);
    } catch {
      window.open(update.downloadUrl, "_blank");
    }
  };

  const handleSkipVersion = () => {
    setSkippedVersion(update.latestVersion);
    onClose();
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            Update Available{" "}
            <span className="text-primary">
              v{update.latestVersion.replace(/^v/, "")}
            </span>
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Release notes */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {update.releaseNotes ? (
            <div className="space-y-1">
              {renderReleaseNotes(update.releaseNotes)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No release notes available.
            </p>
          )}
          {update.releaseDate && (
            <p className="text-xs text-muted-foreground/60 mt-3">
              Released{" "}
              {new Date(update.releaseDate).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            onClick={handleSkipVersion}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm",
              "text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            )}
          >
            <Prohibit className="w-3.5 h-3.5" />
            Skip This Version
          </button>
          <button
            onClick={onClose}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm",
              "text-foreground hover:bg-muted transition-colors"
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            Remind Me Later
          </button>
          <button
            onClick={handleUpdateNow}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium",
              "bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            )}
          >
            <ArrowSquareOut className="w-3.5 h-3.5" />
            Update Now
          </button>
        </div>
      </div>
    </div>
  );
}
