import { useEffect, useRef, useState } from "react";
import { useTranscriptionStore } from "../../stores/useTranscriptionStore";
import {
  CircleNotch,
  MagnifyingGlass,
  PlayCircle,
  Scroll,
} from "@phosphor-icons/react";
import { cn } from "../../utils";

interface TranscriptPanelProps {
  bookId: string;
  chapterId: string;
  currentTimeMs: number;
  onSeek: (ms: number) => void;
  isTranscribing?: boolean;
}

export function TranscriptPanel({
  bookId,
  chapterId,
  currentTimeMs,
  onSeek,
  isTranscribing,
}: TranscriptPanelProps) {
  const { activeSegments, loadTranscript } = useTranscriptionStore();
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeSegmentRef = useRef<HTMLDivElement>(null);
  const lastScrollTimeRef = useRef<number>(0);

  useEffect(() => {
    loadTranscript(bookId, chapterId);
  }, [bookId, chapterId, loadTranscript]);

  // Auto-scroll to active segment using container-relative scrolling
  // to avoid scrolling the entire page and affecting other elements.
  // Throttled to prevent rapid successive scrolls.
  useEffect(() => {
    if (!autoScroll || !activeSegmentRef.current || !scrollRef.current) return;
    
    // Throttle scrolls to once per 2 seconds
    const now = Date.now();
    if (now - lastScrollTimeRef.current < 2000) {
      return;
    }
    
    const container = scrollRef.current;
    const element = activeSegmentRef.current;
    
    // Calculate the element's position relative to the container
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    
    // Calculate relative position (accounting for container's scroll position)
    const relativeTop = elementRect.top - containerRect.top + container.scrollTop;
    const elementHeight = elementRect.height;
    const containerHeight = containerRect.height;
    
    // Calculate target scroll position to center the element
    const targetScrollTop = relativeTop - (containerHeight / 2) + (elementHeight / 2);
    
    // Only scroll if the element is outside the visible area (with some padding)
    const padding = 80;
    const isAbove = elementRect.top < containerRect.top + padding;
    const isBelow = elementRect.bottom > containerRect.bottom - padding;
    
    if (isAbove || isBelow) {
      lastScrollTimeRef.current = now;
      container.scrollTo({
        top: targetScrollTop,
        behavior: "smooth",
      });
    }
  }, [currentTimeMs, autoScroll]);

  const filteredSegments = activeSegments.filter((s) =>
    s.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scroll className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Transcript</h3>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-border"
            />
            Auto-scroll
          </label>
        </div>
      </div>

      {/* MagnifyingGlass */}
      <div className="p-2 border-b border-border relative">
        <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search transcript..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-1.5 bg-muted/50 border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Content */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 custom-scrollbar"
        data-transcript-scroll="true"
      >
        {isTranscribing && (
          <div className="flex items-center justify-center p-4 bg-primary/5 rounded-lg border border-primary/20">
            <CircleNotch className="w-4 h-4 text-primary animate-spin mr-2" />
            <span className="text-sm text-primary font-medium">Transcribing in background...</span>
          </div>
        )}

        {filteredSegments.length === 0 && !isTranscribing && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Scroll className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
            <p className="text-sm text-muted-foreground">No transcript available for this chapter.</p>
          </div>
        )}

        {filteredSegments.map((segment, index) => {
          const isActive = currentTimeMs >= segment.start_ms && currentTimeMs < segment.end_ms;
          
          return (
            <div
              key={index}
              ref={isActive ? activeSegmentRef : null}
              role="button"
              tabIndex={0}
              onClick={() => onSeek(segment.start_ms)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSeek(segment.start_ms); }}
              className={cn(
                "group p-3 rounded-lg transition-all cursor-pointer border border-transparent hover:border-border",
                isActive ? "bg-primary/10 border-primary/20 shadow-sm" : "hover:bg-muted/50"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={cn(
                  "text-[10px] font-mono",
                  isActive ? "text-primary font-bold" : "text-muted-foreground"
                )}>
                  {formatMs(segment.start_ms)}
                </span>
                <PlayCircle className={cn(
                  "w-3 h-3 transition-opacity",
                  isActive ? "text-primary opacity-100" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                )} />
              </div>
              <p className={cn(
                "text-sm leading-relaxed",
                isActive ? "text-foreground font-medium" : "text-muted-foreground"
              )}>
                {segment.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatMs(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
