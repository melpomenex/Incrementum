import { useRef, useCallback, useEffect, useState } from "react";
import { Scan, X } from "@phosphor-icons/react";
import { cn } from "../../utils";

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OcrRegionSelectorProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isActive: boolean;
  onRegionSelected: (rect: SelectionRect) => void;
  onCancel: () => void;
}

const MIN_SELECTION_CSS_PX = 15;

export function OcrRegionSelector({
  canvasRef,
  isActive,
  onRegionSelected,
  onCancel,
}: OcrRegionSelectorProps) {
  const [selection, setSelection] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Convert pointer event to CSS-pixel coordinates relative to the overlay (which covers the canvas)
  const getRelativePoint = useCallback(
    (e: React.PointerEvent): { x: number; y: number } | null => {
      const overlay = overlayRef.current;
      if (!overlay) return null;
      const rect = overlay.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    []
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const point = getRelativePoint(e);
      if (!point) return;

      startPointRef.current = point;
      setIsDragging(true);
      setSelection(null);
    },
    [getRelativePoint]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !startPointRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      const point = getRelativePoint(e);
      if (!point) return;

      const start = startPointRef.current;
      setSelection({
        x: Math.min(start.x, point.x),
        y: Math.min(start.y, point.y),
        w: Math.abs(point.x - start.x),
        h: Math.abs(point.y - start.y),
      });
    },
    [isDragging, getRelativePoint]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      e.stopPropagation();

      setIsDragging(false);
      startPointRef.current = null;

      // Discard tiny selections
      if (selection && (selection.w < MIN_SELECTION_CSS_PX || selection.h < MIN_SELECTION_CSS_PX)) {
        setSelection(null);
        return;
      }
    },
    [isDragging, selection]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setSelection(null);
        setIsDragging(false);
        startPointRef.current = null;
        onCancel();
      }
    },
    [onCancel]
  );

  useEffect(() => {
    if (!isActive) {
      setSelection(null);
      setIsDragging(false);
      startPointRef.current = null;
      return;
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, handleKeyDown]);

  if (!isActive) return null;

  const canvas = canvasRef.current;
  if (!canvas) return null;

  // Selection is in CSS pixels relative to the canvas/overlay.
  // Convert to canvas buffer pixels for the capture step.
  const canvasCssWidth = canvas.getBoundingClientRect().width;
  const cssScale = canvas.width / canvasCssWidth;

  const toCanvasRect = (sel: typeof selection): SelectionRect | null => {
    if (!sel) return null;
    return {
      x: sel.x * cssScale,
      y: sel.y * cssScale,
      width: sel.w * cssScale,
      height: sel.h * cssScale,
    };
  };

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0"
      style={{ zIndex: 50, cursor: "crosshair" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {selection && (
        <>
          {/* Dim outside selection */}
          <div
            className="absolute inset-0 bg-black/10 pointer-events-none"
          />

          {/* Selection rectangle */}
          <div
            className={cn(
              "absolute border-2 border-dashed border-blue-500 bg-blue-500/15 pointer-events-none",
              "shadow-[0_0_0_1px_rgba(59,130,246,0.3)]"
            )}
            style={{
              left: selection.x,
              top: selection.y,
              width: selection.w,
              height: selection.h,
            }}
          />

          {/* Floating action bar */}
          {!isDragging && (
            <div
              className="absolute flex items-center gap-2 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg px-3 py-2"
              style={{
                left: selection.x + selection.w / 2,
                top: selection.y + selection.h + 8,
                transform: "translateX(-50%)",
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  const canvasRect = toCanvasRect(selection);
                  if (canvasRect) onRegionSelected(canvasRect);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                <Scan className="w-3.5 h-3.5" />
                OCR this region
              </button>
              <button
                onClick={() => setSelection(null)}
                className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
