import type { PdfSelectionContext } from "../../types/selection";

export interface PdfTextSelectionCapability {
  hasSelectableText: boolean;
  currentPageHasSelectableText: boolean | null;
  pagesWithSelectableText: number;
  analyzedPages: number;
  totalPages: number;
}

export function hasSelectableTextInLayer(layer: Element | null): boolean {
  if (!layer) return false;
  const spans = Array.from(layer.querySelectorAll("span"));
  return spans.some((span) => (span.textContent ?? "").trim().length > 0);
}

export function derivePdfTextSelectionCapability(
  pageAvailability: ReadonlyMap<number, boolean>,
  totalPages: number,
  currentPage: number,
): PdfTextSelectionCapability {
  const analyzedPages = pageAvailability.size;
  let pagesWithSelectableText = 0;
  for (const hasText of pageAvailability.values()) {
    if (hasText) pagesWithSelectableText += 1;
  }

  const hasSelectableText = pagesWithSelectableText > 0;
  const currentPageHasSelectableText = pageAvailability.has(currentPage)
    ? (pageAvailability.get(currentPage) ?? false)
    : null;

  return {
    hasSelectableText,
    currentPageHasSelectableText,
    pagesWithSelectableText,
    analyzedPages,
    totalPages,
  };
}

export function selectionAnchorsInTextLayers(selection: Selection, textLayers: HTMLElement[]): boolean {
  const { anchorNode, focusNode } = selection;
  if (!anchorNode || !focusNode) return false;

  const anchorInLayer = textLayers.some((layer) => layer === anchorNode || layer.contains(anchorNode));
  const focusInLayer = textLayers.some((layer) => layer === focusNode || layer.contains(focusNode));
  return anchorInLayer && focusInLayer;
}

export function selectionIntersectsTextLayers(selection: Selection, textLayers: HTMLElement[]): boolean {
  if (selection.rangeCount === 0) return false;
  for (let i = 0; i < selection.rangeCount; i += 1) {
    const range = selection.getRangeAt(i);
    for (const layer of textLayers) {
      try {
        if (range.intersectsNode(layer)) return true;
      } catch {
        // Ignore detached node errors.
      }
    }
  }
  return false;
}

export function isValidPdfSelection(
  text: string | null | undefined,
  context?: PdfSelectionContext | null,
): boolean {
  const trimmed = text?.trim() ?? "";
  return trimmed.length > 0 && Boolean(context && context.type === "pdf" && context.pages.length > 0);
}

export function getPdfExtractBlockReason(params: {
  selectedText: string;
  selectionContext?: PdfSelectionContext | null;
  capability?: PdfTextSelectionCapability | null;
}): "missing_selection" | "no_text_layer" | null {
  const hasValidSelection = isValidPdfSelection(params.selectedText, params.selectionContext);
  if (hasValidSelection) return null;
  if (params.capability?.currentPageHasSelectableText === false) return "no_text_layer";
  return "missing_selection";
}
