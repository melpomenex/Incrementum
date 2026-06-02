import type { WordToken } from "./textModel";

export type CaretStyle = "block" | "underline";

const OVERLAY_ID = "vim-cursor-overlay";
const CARET_STYLES_ID = "vim-caret-styles";

const CARET_CSS = `
  .vim-cursor {
    background-color: rgba(59, 130, 246, 0.3) !important;
    border-radius: 2px !important;
    pointer-events: none !important;
    z-index: 10 !important;
  }
  .vim-cursor-visual {
    background-color: transparent !important;
    border-bottom: 2px solid rgba(59, 130, 246, 0.8) !important;
    border-radius: 0 !important;
  }
`;

function injectCaretStyles(doc: Document): void {
  if (doc.getElementById(CARET_STYLES_ID)) return;
  const style = doc.createElement("style");
  style.id = CARET_STYLES_ID;
  style.textContent = CARET_CSS;
  doc.head?.appendChild(style);
}

export function updateCaret(
  existingElement: HTMLSpanElement | null,
  token: WordToken,
  style: CaretStyle,
  doc: Document,
): HTMLSpanElement {
  const el = existingElement ?? doc.createElement("span");
  el.id = OVERLAY_ID;
  el.className = style === "block" ? "vim-cursor" : "vim-cursor vim-cursor-visual";
  el.setAttribute("role", "cursor");
  el.setAttribute("aria-label", "reading position");

  // Inline styles as fallback (in case CSS injection fails)
  if (style === "block") {
    el.style.backgroundColor = "rgba(59, 130, 246, 0.3)";
    el.style.borderRadius = "2px";
  } else {
    el.style.backgroundColor = "transparent";
    el.style.borderBottom = "2px solid rgba(59, 130, 246, 0.8)";
  }

  const rect = token.rect;
  el.style.position = "absolute";
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.top}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
  el.style.pointerEvents = "none";
  el.style.zIndex = "10";

  const isInIframe = doc !== document;

  if (isInIframe) {
    // Ensure body has position:relative so absolute positioning works
    const body = doc.body;
    if (body) {
      const originalPosition = body.style.position;
      if (!originalPosition || originalPosition === "static") {
        body.style.position = "relative";
      }
    }
    // Inject caret CSS into iframe
    injectCaretStyles(doc);
  }

  // Append to the document
  const parent = isInIframe ? doc.body : document.body;
  if (parent && !el.parentNode) {
    parent.appendChild(el);
  }

  return el;
}

export function removeCaret(element: HTMLSpanElement | null, doc: Document): void {
  if (element?.parentNode) {
    element.remove();
  }
  // Clean up injected styles
  const styles = doc.getElementById(CARET_STYLES_ID);
  if (styles) styles.remove();
}
