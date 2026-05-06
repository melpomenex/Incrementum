import { useRef, useCallback, useState } from "react";

interface ResizableSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftWidth?: number;
  minPanelWidth?: number;
  onLeftWidthChange?: (width: number) => void;
}

export function ResizableSplit({
  left,
  right,
  defaultLeftWidth = 50,
  minPanelWidth = 320,
  onLeftWidthChange,
}: ResizableSplitProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPercent, setLeftPercent] = useState(defaultLeftWidth);
  const dragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalWidth = rect.width;
      const minPercent = (minPanelWidth / totalWidth) * 100;
      const maxPercent = 100 - minPercent;
      const percent = ((e.clientX - rect.left) / totalWidth) * 100;
      const clamped = Math.max(minPercent, Math.min(maxPercent, percent));
      setLeftPercent(clamped);
      onLeftWidthChange?.(clamped);
    };

    const handleMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [minPanelWidth, onLeftWidthChange]);

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden">
      <div style={{ width: `${leftPercent}%` }} className="overflow-hidden">
        {left}
      </div>
      <div
        onMouseDown={handleMouseDown}
        className="w-1.5 flex-shrink-0 bg-border hover:bg-primary/30 cursor-col-resize transition-colors relative group"
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>
      <div style={{ width: `${100 - leftPercent}%` }} className="overflow-hidden">
        {right}
      </div>
    </div>
  );
}
