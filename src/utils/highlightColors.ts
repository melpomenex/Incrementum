import { HIGHLIGHT_COLORS, type HighlightColor } from "../components/viewer/SelectionPopup";

const TEXT_HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: "rgba(255, 235, 59, 0.5)",
  green: "rgba(76, 175, 80, 0.4)",
  blue: "rgba(33, 150, 243, 0.4)",
  pink: "rgba(233, 30, 99, 0.24)",
  purple: "rgba(156, 39, 176, 0.24)",
  orange: "rgba(251, 146, 60, 0.32)",
  red: "rgba(248, 113, 113, 0.26)",
};

export function normalizeHighlightColor(color?: string | null): string {
  if (!color) return TEXT_HIGHLIGHT_COLORS.yellow;

  if (color in HIGHLIGHT_COLORS) {
    return HIGHLIGHT_COLORS[color as HighlightColor];
  }

  if (color in TEXT_HIGHLIGHT_COLORS) {
    return TEXT_HIGHLIGHT_COLORS[color];
  }

  return color;
}

export function normalizePdfHighlightColor(color?: string | null): HighlightColor {
  switch ((color ?? "").toLowerCase()) {
    case "green":
    case "#bbf7d0":
      return "green";
    case "blue":
    case "#bfdbfe":
      return "blue";
    case "pink":
    case "#fbcfe8":
    case "red":
    case "#fecaca":
      return "pink";
    case "purple":
    case "#e9d5ff":
      return "purple";
    case "orange":
    case "#fed7aa":
      return "yellow";
    case "yellow":
    case "#fef08a":
    default:
      return "yellow";
  }
}
