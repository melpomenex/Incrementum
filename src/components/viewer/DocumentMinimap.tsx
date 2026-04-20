/**
 * Document Minimap
 * 
 * VS Code-style minimap for documents showing reading progress.
 * Displays subtle color coding for read (gray), extracted (blue), and ignored chunks.
 * 
 * Features:
 * - Hyper-thin scrollbar on the right side
 * - Color-coded segments: read, extracted, ignored
 * - Click to navigate to position
 * - Hover to see preview
 */

import { useMemo, useRef, useState } from "react";
import { cn } from "../../utils";
import { useI18n } from "../../lib/i18n";

export interface MinimapSegment {
  start: number; // 0-1 percentage
  end: number;   // 0-1 percentage
  type: "read" | "extracted" | "ignored" | "unread";
  id?: string;
  label?: string;
}

interface DocumentMinimapProps {
  segments: MinimapSegment[];
  currentPosition?: number; // 0-1 percentage (initial only, updates via DOM)
  totalHeight?: number;
  className?: string;
  onSegmentClick?: (position: number) => void;
  onSegmentHover?: (segment: MinimapSegment | null) => void;
}

const SEGMENT_COLORS = {
  read: "bg-muted-foreground/30",
  extracted: "bg-blue-500/50",
  ignored: "bg-muted-foreground/10",
  unread: "bg-transparent",
};

const SEGMENT_COLORS_HOVER = {
  read: "bg-muted-foreground/40",
  extracted: "bg-blue-500/70",
  ignored: "bg-muted-foreground/20",
  unread: "bg-transparent",
};

export function DocumentMinimap({
  segments,
  currentPosition,
  totalHeight = 100,
  className,
  onSegmentClick,
  onSegmentHover,
}: DocumentMinimapProps) {
  const { t: _t } = useI18n();
  const minimapRef = useRef<HTMLDivElement>(null);
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Sort and merge segments to avoid overlaps
  const normalizedSegments = useMemo(() => {
    const sorted = [...segments].sort((a, b) => a.start - b.start);
    const merged: MinimapSegment[] = [];
    
    for (const segment of sorted) {
      const last = merged[merged.length - 1];
      if (last && last.end >= segment.start) {
        // Overlapping - extend if same type, otherwise prioritize extracted
        if (last.type === segment.type) {
          last.end = Math.max(last.end, segment.end);
        } else if (segment.type === "extracted") {
          merged.push(segment);
        }
      } else {
        merged.push({ ...segment });
      }
    }
    
    return merged;
  }, [segments]);

  // Calculate viewport position indicator
  const viewportHeight = 0.1; // 10% of document visible at a time
  const viewportTop = Math.max(0, Math.min(1 - viewportHeight, currentPosition - viewportHeight / 2));

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!minimapRef.current) return;
    const rect = minimapRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const position = y / rect.height;
    onSegmentClick?.(position);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!minimapRef.current) return;
    const rect = minimapRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const position = y / rect.height;
    
    // Find segment at position
    const segment = normalizedSegments.find(
      (s) => position >= s.start && position <= s.end
    );
    
    if (segment?.id !== hoveredSegment) {
      setHoveredSegment(segment?.id || null);
      onSegmentHover?.(segment || null);
    }
    
    if (isDragging) {
      onSegmentClick?.(position);
    }
  };

  const handleMouseLeave = () => {
    setHoveredSegment(null);
    setIsDragging(false);
    onSegmentHover?.(null);
  };

  return (
    <div
      ref={minimapRef}
      className={cn(
        "relative w-3 bg-muted/30 rounded-full cursor-pointer select-none",
        "hover:bg-muted/50 transition-colors",
        className
      )}
      style={{ height: `${totalHeight}px` }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={() => setIsDragging(true)}
      onMouseUp={() => setIsDragging(false)}
    >
      {/* Segments */}
      {normalizedSegments.map((segment, index) => {
        const isHovered = hoveredSegment === segment.id;
        const top = segment.start * 100;
        const height = (segment.end - segment.start) * 100;
        
        return (
          <div
            key={segment.id || index}
            className={cn(
              "absolute w-full rounded-full transition-colors",
              isHovered 
                ? SEGMENT_COLORS_HOVER[segment.type] 
                : SEGMENT_COLORS[segment.type]
            )}
            style={{
              top: `${top}%`,
              height: `${height}%`,
            }}
            title={segment.label}
          />
        );
      })}

      {/* Viewport indicator */}
      <div
        className="absolute w-full h-2 bg-primary/30 border border-primary/50 rounded-full pointer-events-none"
        style={{
          top: `${viewportTop * 100}%`,
        }}
      />

      {/* Current position indicator - data attribute for external DOM updates */}
      <div
        data-minimap-indicator
        className="absolute w-full h-0.5 bg-primary rounded-full pointer-events-none"
        style={{
          top: `${(currentPosition || 0) * 100}%`,
        }}
      />
    </div>
  );
}

// Hook to track document segments from extracts
export function useDocumentMinimap(
  documentId: string,
  extracts: Array<{ id: string; position?: number; createdAt: string }>,
  _totalPages?: number
) {
  const { t: _t } = useI18n();
  const segments = useMemo(() => {
    const segs: MinimapSegment[] = [];
    
    // Add extracted segments
    for (const extract of extracts) {
      if (extract.position !== undefined) {
        const pos = extract.position;
        segs.push({
          start: Math.max(0, pos - 0.02),
          end: Math.min(1, pos + 0.02),
          type: "extracted",
          id: extract.id,
          label: t("viewer.extracted"),
        });
      }
    }
    
    return segs;
  }, [extracts]);

  return { segments };
}

// Simplified version for compact display
export function CompactMinimap({
  segments,
  className,
}: {
  segments: MinimapSegment[];
  className?: string;
}) {
  return (
    <div className={cn("flex gap-px h-1.5 rounded-full overflow-hidden", className)}>
      {segments.map((segment, i) => (
        <div
          key={i}
          className={cn(
            "flex-1",
            SEGMENT_COLORS[segment.type]
          )}
        />
      ))}
    </div>
  );
}
