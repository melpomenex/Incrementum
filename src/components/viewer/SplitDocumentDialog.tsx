import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, Calendar, BookOpen, Clock, Settings, Scissors, Sparkles, AlertTriangle, Layers } from "lucide-react";
import type { Document } from "../../types/document";
import { useI18n } from "../../lib/i18n";

interface SplitDocumentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document;
  onSplitSuccess: (childIds: string[]) => void;
}

interface SplitPartUI {
  title: string;
  startPage?: number;
  endPage?: number;
  startSpineIndex?: number;
  endSpineIndex?: number;
  startPos?: number;
  endPos?: number;
  wordCount?: number;
  estimatedReadingTime: number;
}

export function SplitDocumentDialog({
  isOpen,
  onClose,
  document: doc,
  onSplitSuccess,
}: SplitDocumentDialogProps) {
  const { t } = useI18n();
  const [numChunks, setNumChunks] = useState(5);
  const [spacingDays, setSpacingDays] = useState(1);
  const [archiveParent, setArchiveParent] = useState(true);
  const [parts, setParts] = useState<SplitPartUI[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const docType = doc.fileType;
  // Use totalPages or fallback values
  const size = doc.totalPages || doc.metadata?.pageCount || 0;
  const textLength = doc.content?.length || 0;

  // Set initial default chunks based on size
  useEffect(() => {
    if (docType === "pdf" || docType === "epub") {
      const defaultChunks = size > 0 ? Math.min(Math.max(Math.ceil(size / 10), 2), 12) : 5;
      setNumChunks(defaultChunks);
    } else {
      const defaultChunks = textLength > 0 ? Math.min(Math.max(Math.ceil(textLength / 5000), 2), 10) : 5;
      setNumChunks(defaultChunks);
    }
  }, [size, textLength, docType]);

  // Recalculate preview parts whenever parameters change
  useEffect(() => {
    if (numChunks < 2) return;

    const generatedParts: SplitPartUI[] = [];
    const baseTitle = doc.title || "Document";

    if (docType === "pdf") {
      const totalPages = size || 100; // fallback if 0
      const pagesPerChunk = Math.max(1, Math.floor(totalPages / numChunks));

      for (let i = 0; i < numChunks; i++) {
        const startPage = i * pagesPerChunk + 1;
        // Last chunk gets all remaining pages
        const endPage = i === numChunks - 1 ? totalPages : (i + 1) * pagesPerChunk;
        
        const count = endPage - startPage + 1;
        const words = count * 250;
        const readingTime = Math.ceil(words / 200); // 200 WPM

        generatedParts.push({
          title: `${baseTitle} [Part ${i + 1}/${numChunks}]`,
          startPage,
          endPage,
          wordCount: words,
          estimatedReadingTime: readingTime,
        });
      }
    } else if (docType === "epub") {
      const totalSpine = size || 30; // fallback if 0
      const spinePerChunk = Math.max(1, Math.floor(totalSpine / numChunks));

      for (let i = 0; i < numChunks; i++) {
        const startSpineIndex = i * spinePerChunk;
        const endSpineIndex = i === numChunks - 1 ? totalSpine - 1 : (i + 1) * spinePerChunk - 1;

        const count = endSpineIndex - startSpineIndex + 1;
        const words = count * 1200; // typical spine item word length estimate
        const readingTime = Math.ceil(words / 200);

        generatedParts.push({
          title: `${baseTitle} [Part ${i + 1}/${numChunks}]`,
          startSpineIndex,
          endSpineIndex,
          wordCount: words,
          estimatedReadingTime: readingTime,
        });
      }
    } else if (docType === "markdown" || docType === "html") {
      const totalLen = textLength || 10000;
      const charsPerChunk = Math.max(100, Math.floor(totalLen / numChunks));

      for (let i = 0; i < numChunks; i++) {
        const startPos = i * charsPerChunk;
        const endPos = i === numChunks - 1 ? totalLen : (i + 1) * charsPerChunk;

        const words = Math.ceil((endPos - startPos) / 5);
        const readingTime = Math.ceil(words / 200);

        generatedParts.push({
          title: `${baseTitle} [Part ${i + 1}/${numChunks}]`,
          startPos,
          endPos,
          wordCount: words,
          estimatedReadingTime: readingTime,
        });
      }
    }

    setParts(generatedParts);
  }, [numChunks, doc, docType, size, textLength]);

  const handleTitleChange = (index: number, newTitle: string) => {
    const updated = [...parts];
    updated[index].title = newTitle;
    setParts(updated);
  };

  const getScheduledDateLabel = (chunkIndex: number) => {
    if (spacingDays === 0) return "Review: Today";
    const daysOffset = chunkIndex * spacingDays;
    if (daysOffset === 0) return "Review: Today";
    if (daysOffset === 1) return "Review: Tomorrow";
    
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return `Review: ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  };

  const handleSplitExecute = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      // Map frontend parts to backend Tauri SplitPartConfig
      const backendParts = parts.map((p) => ({
        title: p.title,
        startPage: p.startPage !== undefined ? p.startPage : null,
        endPage: p.endPage !== undefined ? p.endPage : null,
        startSpineIndex: p.startSpineIndex !== undefined ? p.startSpineIndex : null,
        endSpineIndex: p.endSpineIndex !== undefined ? p.endSpineIndex : null,
        startPos: p.startPos !== undefined ? p.startPos : null,
        endPos: p.endPos !== undefined ? p.endPos : null,
        estimatedReadingTime: p.estimatedReadingTime,
      }));

      const childIds = await invoke<string[]>("split_document", {
        documentId: doc.id,
        parts: backendParts,
        spacingDays,
        archiveParent,
      });

      onSplitSuccess(childIds);
      onClose();
    } catch (err) {
      console.error("Failed to split document:", err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop with frosted blur */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Premium Glass Panel Modal */}
      <div className="relative glass-panel-heavy w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col overflow-hidden animate-glass-scale-in border border-white/10 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/40 bg-card/40 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                Incremental Split
                <span className="text-xs font-normal text-muted-foreground px-2 py-0.5 rounded-full border border-border bg-background/50">
                  {docType.toUpperCase()}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[450px]">
                {doc.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all duration-200"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Configurations Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-card/25 border border-border/30 rounded-2xl p-5 backdrop-blur-sm">
            
            {/* Split Size Controls */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Number of Chunks
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="2"
                  max="20"
                  value={numChunks}
                  onChange={(e) => setNumChunks(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <span className="text-sm font-bold bg-background border border-border/50 rounded-lg px-2.5 py-1 min-w-[36px] text-center shadow-sm">
                  {numChunks}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {docType === "pdf" && `Avg. ~${Math.ceil(size / numChunks)} pages per chunk`}
                {docType === "epub" && `Avg. ~${Math.ceil(size / numChunks)} chapters per chunk`}
                {(docType === "markdown" || docType === "html") && `Avg. ~${Math.ceil(textLength / numChunks)} chars per chunk`}
              </p>
            </div>

            {/* FSRS Queue Spacing Controls */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                FSRS Queue Delay
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="7"
                  value={spacingDays}
                  onChange={(e) => setSpacingDays(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <span className="text-sm font-bold bg-background border border-border/50 rounded-lg px-2.5 py-1 min-w-[36px] text-center shadow-sm">
                  {spacingDays}d
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Space successive chunks in your learning queue by {spacingDays} day{spacingDays !== 1 ? "s" : ""}.
              </p>
            </div>

            {/* Parent Archive Option */}
            <div className="flex flex-col justify-center border-t md:border-t-0 md:border-l border-border/30 md:pl-6 pt-4 md:pt-0">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={archiveParent}
                  onChange={(e) => setArchiveParent(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary/45 cursor-pointer"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    Archive Parent Book
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                    Hide parent from reading list to focus on individual chunks.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-sm flex-shrink-0 animate-in fade-in duration-200">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold">Error Executing Split</h4>
                <p className="text-xs opacity-90 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Split Queue Preview Grid */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-500 animate-pulse" />
              Generated Review Queue Preview ({numChunks} Chunks)
            </h3>
            <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1 border border-border/20 rounded-2xl p-2 bg-black/10 backdrop-blur-inner">
              {parts.map((part, index) => (
                <div
                  key={index}
                  className="group flex items-center justify-between gap-4 p-3.5 rounded-xl border border-border/40 bg-card/65 hover:bg-card hover:border-border transition-all duration-200 shadow-sm"
                >
                  {/* Title and Badge */}
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-bold text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={part.title}
                      onChange={(e) => handleTitleChange(index, e.target.value)}
                      className="flex-1 bg-transparent hover:bg-muted/30 focus:bg-background border border-transparent focus:border-border rounded px-2 py-1 text-sm font-medium text-foreground focus:outline-none transition-all"
                      title="Rename chunk"
                    />
                  </div>

                  {/* Boundaries Metadata */}
                  <div className="flex items-center gap-4 text-xs flex-shrink-0 text-muted-foreground">
                    <div className="flex items-center gap-1.5 bg-background/50 border border-border/40 rounded-full px-2.5 py-1">
                      <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                      <span>
                        {docType === "pdf" && `Pages ${part.startPage}-${part.endPage}`}
                        {docType === "epub" && `Spine ${part.startSpineIndex}-${part.endSpineIndex}`}
                        {(docType === "markdown" || docType === "html") && `Chars ${part.startPos}-${part.endPos}`}
                      </span>
                    </div>

                    {/* Word / Reading Metric */}
                    <div className="hidden sm:flex items-center gap-1.5 bg-background/50 border border-border/40 rounded-full px-2.5 py-1">
                      <Clock className="w-3.5 h-3.5 text-yellow-500" />
                      <span>{part.estimatedReadingTime} min</span>
                    </div>

                    {/* FSRS Spaced Date */}
                    <div className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-1 font-semibold">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{getScheduledDateLabel(index)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-card/40 border-t border-border/40 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 text-sm font-semibold rounded-xl border border-border bg-background/50 hover:bg-muted hover:text-foreground text-muted-foreground transition-all duration-200 disabled:opacity-50 min-h-[44px]"
          >
            Cancel
          </button>
          <button
            onClick={handleSplitExecute}
            disabled={isSubmitting || parts.length < 2}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 transition-all duration-200 disabled:opacity-50 shadow-lg ring-1 ring-primary/20 min-h-[44px]"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Splitting...
              </>
            ) : (
              <>
                <Scissors className="w-4 h-4" />
                Generate Chunks
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
