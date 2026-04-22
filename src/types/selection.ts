export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PdfRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PdfSelectionPage {
  pageNumber: number;
  viewportRects: ViewportRect[];
  pdfRects: PdfRect[];
}

/**
 * Token data for custom selection engine.
 * Used to store precise token identifiers for selection ranges.
 */
export interface PdfSelectionTokenData {
  startTokenId: string;
  endTokenId: string;
  tokenIds: string[];
}

export interface PdfSelectionContext {
  type: "pdf";
  documentId: string;
  fingerprint?: string | null;
  /** Selection source: 'native' uses DOM Selection API, 'custom' uses geometric selection */
  source?: "native" | "custom";
  pages: PdfSelectionPage[];
  /** Token identifiers for custom selection engine (only when source='custom') */
  tokenData?: PdfSelectionTokenData;
}

export interface EpubSelectionContext {
  type: "epub";
  documentId: string;
  cfiRange: string;
  selectedText: string;
}

export type TextSelectionSurface = "html" | "markdown" | "extract";

export interface TextSelectionContext {
  type: "text";
  surface: TextSelectionSurface;
  documentId: string;
  extractId?: string;
  startOffset: number;
  endOffset: number;
  selectedText: string;
}

export type SelectionContext = PdfSelectionContext | EpubSelectionContext | TextSelectionContext;
