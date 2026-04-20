import { useState, useRef, useCallback, useEffect } from "react";
import { X, Settings, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "../../../utils";
import type { SummaryLength, SummaryFocus, SummaryMode } from "../../../types/rssSummary";

interface ModernSummaryPanelProps {
  /** Whether the panel is currently open */
  isOpen: boolean;
  /** Content to display */
  content: string;
  /** Current summary mode */
  mode: SummaryMode;
  /** Current length setting */
  length: SummaryLength;
  /** Current focus setting */
  focus: SummaryFocus;
  /** Panel position */
  position: "left" | "right";
  /** Panel width in pixels */
  width: number;
  /** Whether content is loading */
  isLoading?: boolean;
  /** Loading progress (0-100) */
  loadingProgress?: number;
  /** Loading stage message */
  loadingStage?: string;
  /** Callback when panel is closed */
  onClose: () => void;
  /** Callback when mode changes */
  onModeChange: (mode: SummaryMode) => void;
  /** Callback when length changes */
  onLengthChange: (length: SummaryLength) => void;
  /** Callback when focus changes */
  onFocusChange: (focus: SummaryFocus) => void;
  /** Callback when position toggles */
  onPositionToggle: () => void;
  /** Callback when width changes (from resize) */
  onWidthChange: (width: number) => void;
  /** Callback to regenerate summary */
  onRegenerate: () => void;
  /** Optional footer actions */
  footerActions?: React.ReactNode;
  /** Whether to show controls */
  showControls?: boolean;
}

/**
 * Modern Summary Panel Component
 * Theme-aware, resizable, animated panel for displaying AI summaries
 */
export function ModernSummaryPanel({
  isOpen,
  content,
  mode,
  length,
  focus,
  position,
  width,
  isLoading = false,
  loadingProgress = 0,
  loadingStage = "",
  onClose,
  onModeChange,
  onLengthChange,
  onFocusChange,
  onPositionToggle,
  onWidthChange,
  onRegenerate,
  footerActions,
  showControls = true,
}: ModernSummaryPanelProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(width);

  // Handle resize start
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      resizeStartXRef.current = e.clientX;
      resizeStartWidthRef.current = width;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width]
  );

  // Handle resize during drag
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta =
        position === "right"
          ? resizeStartXRef.current - e.clientX // dragging left increases width
          : e.clientX - resizeStartXRef.current; // dragging right increases width
      const newWidth = Math.max(240, Math.min(600, resizeStartWidthRef.current + delta));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, position, onWidthChange]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "h" || e.key === "H") {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Panel transform based on position and open state
  const panelTransform = isOpen
    ? "translateX(0)"
    : position === "right"
      ? "translateX(100%)"
      : "translateX(-100%)";

  return (
    <>
      {/* Desktop/Mobile Side Panel */}
      <div
        ref={panelRef}
        className={cn(
          "fixed top-16 bottom-4 z-40 bg-background border border-border rounded-xl shadow-2xl",
          "flex flex-col overflow-hidden",
          "transition-transform duration-300 ease-out",
          // Mobile: bottom sheet style
          "max-md:fixed max-md:top-auto max-md:left-4 max-md:right-4 max-md:bottom-4",
          "max-md:h-[80vh] max-md:w-auto"
        )}
        style={{
          width: "100%",
          maxWidth:
            typeof window !== "undefined" && window.innerWidth < 768 ? "100%" : `${width}px`,
          [position]: typeof window !== "undefined" && window.innerWidth < 768 ? "auto" : "1rem",
          transform:
            typeof window !== "undefined" && window.innerWidth < 768
              ? isOpen
                ? "translateY(0)"
                : "translateY(100%)"
              : panelTransform,
          transitionDuration: isOpen ? "300ms" : "200ms",
          transitionTimingFunction: isOpen ? "ease-out" : "ease-in",
        }}
      >
        {/* Resize handle - desktop only */}
        <div
          className={cn(
            "absolute top-0 bottom-0 w-2 cursor-col-resize z-50 hover:bg-primary/20 transition-colors group hidden md:block",
            position === "left" ? "right-0" : "left-0"
          )}
          onMouseDown={handleResizeStart}
          title="Drag to resize"
        >
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-border group-hover:bg-primary/50",
              position === "left" ? "right-0.5" : "left-0.5"
            )}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">AI Summary</span>
            {mode === "terminal" && (
              <span className="text-xs text-muted-foreground">(Terminal)</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Mode toggle */}
            <button
              onClick={() => onModeChange(mode === "modern" ? "terminal" : "modern")}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
              title={`Switch to ${mode === "modern" ? "terminal" : "modern"} mode`}
            >
              <span className="text-xs font-mono">{mode === "modern" ? "T" : "M"}</span>
            </button>

            {/* Position toggle */}
            <button
              onClick={onPositionToggle}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors hidden md:flex"
              title="Toggle position"
            >
              {position === "left" ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>

            {/* Settings toggle */}
            {showControls && (
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  showSettings
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                title="Summary settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
              title="Close (H)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Collapsible Controls */}
        {showControls && (
          <div
            className={cn(
              "border-b border-border bg-muted/30 overflow-hidden transition-all duration-200",
              showSettings ? "max-h-32 opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="p-3 space-y-2">
              {/* Length selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-12">Length:</span>
                <div className="flex gap-1">
                  {(["brief", "medium", "detailed"] as SummaryLength[]).map((len) => (
                    <button
                      key={len}
                      onClick={() => onLengthChange(len)}
                      className={cn(
                        "px-2 py-1 text-xs rounded transition-colors capitalize",
                        length === len
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      )}
                    >
                      {len}
                    </button>
                  ))}
                </div>
              </div>

              {/* Focus selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-12">Focus:</span>
                <select
                  value={focus}
                  onChange={(e) => onFocusChange(e.target.value as SummaryFocus)}
                  className="flex-1 px-2 py-1 text-xs bg-background border border-border rounded"
                >
                  <option value="key-points">Key Points</option>
                  <option value="actionable">Actionable Items</option>
                  <option value="background">Background Context</option>
                </select>
              </div>

              {/* Regenerate button */}
              <button
                onClick={onRegenerate}
                disabled={isLoading}
                className="w-full px-3 py-1.5 text-xs bg-primary/10 text-primary hover:bg-primary/20 rounded transition-colors disabled:opacity-50"
              >
                {isLoading ? "Generating..." : "Regenerate with new settings"}
              </button>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="space-y-4">
              {/* Progress bar */}
              <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
              {/* Stage message */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                {loadingStage}
              </div>
            </div>
          ) : content ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {mode === "terminal" ? (
                <pre className="font-mono text-sm text-[#ffb000] bg-[#1a1a1a] p-3 rounded whitespace-pre-wrap">
                  {content}
                </pre>
              ) : (
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{content}</div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Sparkles className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No summary yet</p>
              <p className="text-xs">Click regenerate to create one</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {footerActions && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30 flex-shrink-0">
            {footerActions}
          </div>
        )}

        {/* Mobile drag handle */}
        <div className="md:hidden absolute top-0 left-0 right-0 flex justify-center pt-2 pb-1">
          <div className="w-8 h-1 bg-muted-foreground/30 rounded-full" />
        </div>
      </div>

      {/* Mobile backdrop */}
      {isOpen && <div className="md:hidden fixed inset-0 bg-black/50 z-30" onClick={onClose} />}
    </>
  );
}
