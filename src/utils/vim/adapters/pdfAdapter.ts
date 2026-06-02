import type { TextDocumentAdapter } from "../textModel";

export class PdfAdapter implements TextDocumentAdapter {
  private textLayerRoots: (HTMLDivElement | null)[];
  private scrollContainer: HTMLElement;

  constructor(
    textLayerRoots: (HTMLDivElement | null)[],
    scrollContainer: HTMLElement,
  ) {
    this.textLayerRoots = textLayerRoots;
    this.scrollContainer = scrollContainer;
  }

  getTextNodes(): Text[] {
    const textNodes: Text[] = [];

    // Collect spans from all pages, sorted by visual position
    const spanData: Array<{ span: HTMLSpanElement; top: number; left: number; textNode: Text }> = [];

    for (const root of this.textLayerRoots) {
      if (!root) continue;
      const spans = root.querySelectorAll<HTMLSpanElement>("span:not(.endOfContent)");

      for (const span of Array.from(spans)) {
        const textNode = span.firstChild as Text | null;
        if (!textNode || !(textNode instanceof Text)) continue;
        if (!textNode.textContent?.trim()) continue;

        const rect = span.getBoundingClientRect();
        spanData.push({ span, top: rect.top, left: rect.left, textNode });
      }
    }

    // Sort by visual reading order: top-to-bottom, then left-to-right
    spanData.sort((a, b) => {
      const yDiff = a.top - b.top;
      if (Math.abs(yDiff) > 4) return yDiff;
      return a.left - b.left;
    });

    for (const item of spanData) {
      textNodes.push(item.textNode);
    }

    return textNodes;
  }

  getScrollContainer(): HTMLElement {
    return this.scrollContainer;
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
    // Nothing to clean up
  }
}
