import { CaretLeft, CaretRight, List } from "@phosphor-icons/react";
import { useI18n } from "../../lib/i18n";
import { cn } from "../../utils";

export interface QueueNavigationControlsProps {
  currentDocumentIndex?: number;
  totalDocuments?: number;
  hasMoreChunks?: boolean;
  onPreviousDocument: () => void;
  onNextDocument: () => void;
  onNextChunk: () => void;
  listButtonLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function QueueNavigationControls({
  currentDocumentIndex = 0,
  totalDocuments = 0,
  hasMoreChunks = false,
  onPreviousDocument,
  onNextDocument,
  onNextChunk,
  listButtonLabel,
  disabled = false,
  className,
}: QueueNavigationControlsProps) {
  const { t } = useI18n();
  const isAtFirstDocument = currentDocumentIndex <= 0;
  const isAtLastDocument = currentDocumentIndex >= totalDocuments - 1;
  const resolvedListButtonLabel = listButtonLabel ?? t("queueNav.nextChunk");

  return (
    <div
      className={cn(
        "flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
      style={{ zIndex: 40 }}
    >
      {/* Position Indicator */}
      {totalDocuments > 0 && (
        <span className="text-sm text-muted-foreground min-w-[60px] text-center">
          {currentDocumentIndex + 1} / {totalDocuments}
        </span>
      )}

      <div className="h-6 w-px bg-border" />

      {/* Previous Document */}
      <button
        onClick={onPreviousDocument}
        disabled={isAtFirstDocument || disabled}
        className="p-2 rounded-md hover:bg-muted transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        title={t("queueNav.previousDocument")}
      >
        <CaretLeft className="w-4 h-4" />
      </button>

      {/* Next Document */}
      <button
        onClick={onNextDocument}
        disabled={isAtLastDocument || disabled}
        className="p-2 rounded-md hover:bg-muted transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        title={t("queueNav.nextDocument")}
      >
        <CaretRight className="w-4 h-4" />
      </button>

      <div className="h-6 w-px bg-border" />

      {/* Next Chunk */}
      <button
        onClick={onNextChunk}
        disabled={!hasMoreChunks || disabled}
        className="p-2 rounded-md hover:bg-muted transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        title={resolvedListButtonLabel}
        aria-label={resolvedListButtonLabel}
      >
        <List className="w-4 h-4" />
      </button>
    </div>
  );
}
