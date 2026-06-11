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
    background-color: rgba(239, 68, 68, 0.25) !important;
    border: 2px solid rgba(239, 68, 68, 0.85) !important;
    border-radius: 2px !important;
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
  scrollContainer?: HTMLElement | null,
): HTMLSpanElement {
  const el = existingElement ?? doc.createElement("span");
  el.id = OVERLAY_ID;
  el.className = style === "block" ? "vim-cursor" : "vim-cursor vim-cursor-visual";
  el.setAttribute("role", "cursor");
  el.setAttribute("aria-label", "reading position");

  // Inline styles as fallback (in case CSS injection fails)
  if (style === "block") {
    el.style.backgroundColor = "rgba(59, 130, 246, 0.3)";
    el.style.border = "none";
    el.style.borderRadius = "2px";
  } else {
    el.style.backgroundColor = "rgba(239, 68, 68, 0.25)";
    el.style.border = "2px solid rgba(239, 68, 68, 0.85)";
    el.style.borderRadius = "2px";
  }

  const isInIframe = doc !== document;

  let top = token.rect.top;
  let left = token.rect.left;

  if (isInIframe) {
    // Convert viewport-relative rect to document-relative coordinates
    const scrollEl = doc.scrollingElement ?? doc.documentElement ?? doc.body;
    top += scrollEl.scrollTop || 0;
    left += scrollEl.scrollLeft || 0;

    const body = doc.body;
    if (body) {
      const originalPosition = body.style.position;
      if (!originalPosition || originalPosition === "static") {
        body.style.position = "relative";
      }
    }
    injectCaretStyles(doc);
  } else if (scrollContainer) {
    // Non-iframe (PDF, Markdown): position relative to the scroll container
    const containerRect = scrollContainer.getBoundingClientRect();
    top = token.rect.top - containerRect.top + scrollContainer.scrollTop;
    left = token.rect.left - containerRect.left + scrollContainer.scrollLeft;

    const originalPosition = scrollContainer.style.position;
    if (!originalPosition || originalPosition === "static") {
      scrollContainer.style.position = "relative";
    }
  }

  el.style.position = "absolute";
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.style.width = `${token.rect.width}px`;
  el.style.height = `${token.rect.height}px`;
  el.style.pointerEvents = "none";
  el.style.zIndex = "10";

  // Append to scroll container for non-iframe, iframe body for iframe docs
  const parent = isInIframe ? doc.body : (scrollContainer ?? document.body);
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
