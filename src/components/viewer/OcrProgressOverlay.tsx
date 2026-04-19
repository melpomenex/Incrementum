import type { SelectionRect } from "./OcrRegionSelector";

interface OcrProgressOverlayProps {
  selectionRect: SelectionRect;
  cssScale: number;
  progress: number;
  status: string;
}

export function OcrProgressOverlay({ selectionRect, cssScale, progress, status }: OcrProgressOverlayProps) {
  return (
    <div
      className="absolute bg-background/90 backdrop-blur-sm border border-border rounded-lg shadow-lg flex flex-col items-center justify-center gap-2 p-4"
      style={{
        left: selectionRect.x * cssScale,
        top: selectionRect.y * cssScale,
        width: Math.max(selectionRect.width * cssScale, 160),
        height: selectionRect.height * cssScale,
        zIndex: 25,
      }}
    >
      {/* Progress bar */}
      <div className="w-full max-w-[200px] bg-muted rounded-full h-2 overflow-hidden">
        <div
          className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.max(progress, 5)}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground text-center leading-tight">
        {status}
      </span>
      <span className="text-xs font-medium text-foreground">
        {progress}%
      </span>
    </div>
  );
}
