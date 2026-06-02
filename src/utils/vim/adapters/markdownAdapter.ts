import type { TextDocumentAdapter } from "../textModel";

export class MarkdownAdapter implements TextDocumentAdapter {
  private contentRef: React.RefObject<HTMLElement | null>;
  private scrollContainer: HTMLElement | null;

  constructor(
    contentRef: React.RefObject<HTMLElement | null>,
    scrollContainer: HTMLElement | null,
  ) {
    this.contentRef = contentRef;
    this.scrollContainer = scrollContainer;
  }

  getTextNodes(): Text[] {
    const container = this.contentRef.current;
    if (!container) return [];

    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
    );
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (node.textContent && node.textContent.trim()) {
        textNodes.push(node);
      }
    }
    return textNodes;
  }

  getScrollContainer(): HTMLElement {
    return this.scrollContainer ?? this.contentRef.current ?? document.scrollingElement as HTMLElement;
  }

  getDocument(): Document {
    return document;
  }

  createOverlay(host: Element): HTMLSpanElement {
    const span = document.createElement("span");
    span.className = "vim-cursor";
    host.appendChild(span);
    return span;
  }

  dispose(): void {
    // Nothing to clean up for markdown adapter
  }
}
