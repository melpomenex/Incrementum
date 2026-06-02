import type { TextDocumentAdapter } from "../textModel";

export class EpubAdapter implements TextDocumentAdapter {
  private iframeWindow: Window;
  private scrollContainer: HTMLElement | null;

  constructor(iframeWindow: Window, scrollContainer: HTMLElement | null) {
    this.iframeWindow = iframeWindow;
    this.scrollContainer = scrollContainer;
  }

  private getDoc(): Document {
    return this.iframeWindow.document;
  }

  getTextNodes(): Text[] {
    const doc = this.getDoc();
    const body = doc.body;
    if (!body) return [];

    const textNodes: Text[] = [];
    const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT, null);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (node.textContent && node.textContent.trim()) {
        textNodes.push(node);
      }
    }
    return textNodes;
  }

  getScrollContainer(): HTMLElement {
    if (this.scrollContainer) return this.scrollContainer;
    const doc = this.getDoc();
    return (doc.scrollingElement ?? doc.documentElement ?? doc.body) as HTMLElement;
  }

  getDocument(): Document {
    return this.getDoc();
  }

  createOverlay(host: Element): HTMLSpanElement {
    const doc = this.getDocument();
    const span = doc.createElement("span");
    span.className = "vim-cursor";
    host.appendChild(span);
    return span;
  }

  dispose(): void {
    // Nothing to clean up
  }
}
