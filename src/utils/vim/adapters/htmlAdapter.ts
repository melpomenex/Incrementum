import type { TextDocumentAdapter } from "../textModel";

export class HtmlAdapter implements TextDocumentAdapter {
  private iframeRef: React.RefObject<HTMLIFrameElement | null>;
  private scrollContainer: HTMLElement | null;

  constructor(
    iframeRef: React.RefObject<HTMLIFrameElement | null>,
    scrollContainer: HTMLElement | null,
  ) {
    this.iframeRef = iframeRef;
    this.scrollContainer = scrollContainer;
  }

  private getIframeDoc(): Document | null {
    const iframe = this.iframeRef.current;
    if (!iframe) return null;
    return iframe.contentDocument ?? iframe.contentWindow?.document ?? null;
  }

  getTextNodes(): Text[] {
    const doc = this.getIframeDoc();
    if (!doc?.body) return [];

    const textNodes: Text[] = [];
    const walker = doc.createTreeWalker(
      doc.body,
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
    const doc = this.getIframeDoc();
    if (doc) {
      return doc.scrollingElement as HTMLElement ?? doc.body;
    }
    return this.scrollContainer ?? document.scrollingElement as HTMLElement;
  }

  getDocument(): Document {
    return this.getIframeDoc() ?? document;
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
