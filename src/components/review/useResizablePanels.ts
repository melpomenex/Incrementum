import { useState, useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "deck-manager-panel-widths";

interface PanelWidths {
  left: number;
  right: number;
}

interface PanelConstraints {
  min: number;
  default: number;
  max: number;
}

const DEFAULT_WIDTHS: PanelWidths = { left: 220, right: 260 };
const LEFT_CONSTRAINTS: PanelConstraints = { min: 140, default: 220, max: 350 };
const RIGHT_CONSTRAINTS: PanelConstraints = { min: 200, default: 260, max: 750 };
const MIN_CENTER = 200;

function loadWidths(): PanelWidths {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PanelWidths>;
      return {
        left: clamp(parsed.left ?? DEFAULT_WIDTHS.left, LEFT_CONSTRAINTS),
        right: clamp(parsed.right ?? DEFAULT_WIDTHS.right, RIGHT_CONSTRAINTS),
      };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_WIDTHS };
}

function saveWidths(widths: PanelWidths) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  } catch {
    // ignore
  }
}

function clamp(value: number, constraints: PanelConstraints): number {
  return Math.max(constraints.min, Math.min(constraints.max, value));
}

export function useResizablePanels() {
  const [widths, setWidths] = useState<PanelWidths>(loadWidths);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use refs to avoid stale closures in pointer event handlers
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  const dragRef = useRef<{
    startX: number;
    startLeft: number;
    startRight: number;
    panel: "left" | "right";
  } | null>(null);

  // Attach stable global listeners once
  useEffect(() => {
    const onPointerMove = (clientX: number) => {
      if (!dragRef.current) return;
      const { startX, startLeft, startRight, panel } = dragRef.current;
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.offsetWidth;
      const dx = clientX - startX;

      if (panel === "left") {
        const newLeft = clamp(startLeft + dx, LEFT_CONSTRAINTS);
        const maxLeft = containerWidth - MIN_CENTER - widthsRef.current.right;
        const final = Math.max(LEFT_CONSTRAINTS.min, Math.min(newLeft, maxLeft));
        setWidths((prev) => ({ ...prev, left: final }));
      } else {
        const newRight = clamp(startRight - dx, RIGHT_CONSTRAINTS);
        const maxRight = containerWidth - MIN_CENTER - widthsRef.current.left;
        const final = Math.max(RIGHT_CONSTRAINTS.min, Math.min(newRight, maxRight));
        setWidths((prev) => ({ ...prev, right: final }));
      }
    };

    const onPointerUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.body.style.pointerEvents = "";
      // Persist current widths to localStorage
      saveWidths(widthsRef.current);
    };

    const onMouseMove = (e: MouseEvent) => onPointerMove(e.clientX);
    const onMouseUp = () => onPointerUp();
    const onTouchMove = (e: TouchEvent) => {
      if (dragRef.current) {
        e.preventDefault();
        onPointerMove(e.touches[0].clientX);
      }
    };
    const onTouchEnd = () => onPointerUp();

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  const handlePointerDown = useCallback(
    (panel: "left" | "right", clientX: number) => {
      dragRef.current = {
        startX: clientX,
        startLeft: widthsRef.current.left,
        startRight: widthsRef.current.right,
        panel,
      };
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
      document.body.style.pointerEvents = "none";
    },
    []
  );

  // Reset to defaults
  const resetWidths = useCallback(() => {
    const defaults = { ...DEFAULT_WIDTHS };
    setWidths(defaults);
    saveWidths(defaults);
  }, []);

  return {
    widths,
    containerRef,
    handlePointerDown,
    resetWidths,
  };
}
