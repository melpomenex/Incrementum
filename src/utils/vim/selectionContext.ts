/**
 * Vim SelectionContext bridge.
 *
 * Builds a `SelectionContext` for a vim-triggered capture from the LIVE DOM
 * selection (set by `selectionManager.setSelection`). This avoids the stale
 * React-state problem where `selectedTextRef` / `selectionContext` had not
 * yet propagated when a vim action fired.
 *
 * For PDF, callers should pass a `buildPdfContext` function (typically the
 * PDFViewer's own `buildPdfSelectionContext`) so the high-fidelity per-page
 * viewport/PDF rects are reused. For EPUB and Markdown/HTML this helper
 * constructs the context directly from the DOM.
 */
import type {
  SelectionContext,
  PdfSelectionContext,
  EpubSelectionContext,
  TextSelectionContext,
} from "../../types/selection";

export type VimDocType = "pdf" | "epub" | "markdown" | "html";

export interface BuildSelectionContextArgs {
  /** Document that owns the selection (parent document or EPUB iframe doc). */
  doc: Document;
  docType: VimDocType;
  documentId: string;
  /** PDF: a function returning the canonical PDF context (page viewports). */
  buildPdfContext?: () => PdfSelectionContext | null;
  /** EPUB: the iframe window (used to read the selection). */
  epubIframeWindow?: Window | null;
  /** Markdown/HTML: the surface label. Defaults to "markdown". */
  textSurface?: "html" | "markdown" | "extract";
}

/**
 * Resolve a SelectionContext for the current selection. Returns null when no
 * non-collapsed selection exists.
 */
export function buildSelectionContext(
  args: BuildSelectionContextArgs,
): SelectionContext | null {
  const { doc, docType, documentId } = args;

  const sel = args.epubIframeWindow?.getSelection?.() ?? doc.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;

  const range = sel.getRangeAt(0);
  const text = sel.toString();
  if (!text.trim()) return null;

  switch (docType) {
    case "pdf":
      // Prefer the high-fidelity builder supplied by PDFViewer.
      if (args.buildPdfContext) {
        return args.buildPdfContext();
      }
      return null;

    case "epub": {
      // We don't have direct access to the epubjs rendition here, so produce
      // an EPUB context with the selected text and an empty CFI range. The
      // extract content is preserved; precise CFI re-highlighting requires
      // the rendition's `cfiFromRange` (a known limitation for vim captures).
      const ctx: EpubSelectionContext = {
        type: "epub",
        documentId,
        cfiRange: "",
        selectedText: text,
      };
      return ctx;
    }

    case "html":
    case "markdown": {
      const surface = args.textSurface ?? (docType === "html" ? "html" : "markdown");
      const blockPath = cssSelectorPath(range.startContainer);
      const blockText = blockTextContent(range.startContainer);
      const startOffset = offsetWithinBlock(blockText, range.startContainer, range.startOffset);
      const endOffset = offsetWithinBlock(blockText, range.endContainer, range.endOffset);
      const ctx: TextSelectionContext = {
        type: "text",
        surface,
        documentId,
        startOffset,
        endOffset,
        selectedText: text,
      };
      // Include the selector path for debugging / re-localization when present.
      (ctx as TextSelectionContext & { selectorPath?: string }).selectorPath = blockPath;
      return ctx;
    }
  }
}

/** Build a minimal CSS selector path for the containing block element. */
function cssSelectorPath(node: Node): string {
  let el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
  const parts: string[] = [];
  while (el && parts.length < 4) {
    const part = el.tagName.toLowerCase();
    const id = el.id;
    if (id) {
      parts.unshift(`#${id}`);
      break;
    }
    parts.unshift(part);
    el = el.parentElement;
  }
  return parts.join(" > ");
}

/** Concatenate the text content of the nearest block ancestor. */
function blockTextContent(node: Node): string {
  let el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
  while (el && !isBlockElement(el.tagName)) {
    el = el.parentElement;
  }
  return el?.textContent ?? "";
}

function isBlockElement(tag: string): boolean {
  const t = tag.toUpperCase();
  return (
    t === "P" || t === "DIV" || t === "LI" || t === "BLOCKQUOTE" ||
    t === "H1" || t === "H2" || t === "H3" || t === "H4" || t === "H5" || t === "H6" ||
    t === "SECTION" || t === "ARTICLE" || t === "TD" || t === "TH" || t === "PRE"
  );
}

/**
 * Approximate the character offset of (node, offset) within the block's
 * concatenated text content. Used for the TextSelectionContext offsets.
 */
function offsetWithinBlock(blockText: string, node: Node, offset: number): number {
  const snippet = node.nodeType === Node.TEXT_NODE
    ? (node as Text).data.slice(0, offset)
    : "";
  const idx = blockText.indexOf(snippet);
  return idx >= 0 ? idx + snippet.length : Math.min(offset, blockText.length);
}
