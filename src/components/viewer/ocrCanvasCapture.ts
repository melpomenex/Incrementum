import type { SelectionRect } from "./OcrRegionSelector";

/**
 * Capture a region of a canvas as a PNG data URL.
 * Clips the selection to actual canvas dimensions.
 */
export function captureCanvasRegion(
  canvas: HTMLCanvasElement,
  rect: SelectionRect
): string {
  // Clamp selection to canvas bounds
  const x = Math.max(0, Math.round(rect.x));
  const y = Math.max(0, Math.round(rect.y));
  const width = Math.min(Math.round(rect.width), canvas.width - x);
  const height = Math.min(Math.round(rect.height), canvas.height - y);

  if (width <= 0 || height <= 0) {
    throw new Error("Selection region is outside canvas bounds");
  }

  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;

  const ctx = offscreen.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to create offscreen canvas context");
  }

  ctx.drawImage(canvas, x, y, width, height, 0, 0, width, height);
  return offscreen.toDataURL("image/png");
}
