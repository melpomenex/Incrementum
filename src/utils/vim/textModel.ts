export interface WordToken {
  index: number;
  node: Text;
  startOffset: number;
  endOffset: number;
  text: string;
  rect: DOMRect;
}

export interface TextDocumentAdapter {
  getTextNodes(): Text[];
  getScrollContainer(): HTMLElement;
  getDocument(): Document;
  createOverlay(host: Element): HTMLSpanElement;
  dispose(): void;
}

export function buildWordTokens(adapter: TextDocumentAdapter): WordToken[] {
  const textNodes = adapter.getTextNodes();
  const tokens: WordToken[] = [];
  let index = 0;

  const range = adapter.getDocument().createRange();

  for (const node of textNodes) {
    const text = node.textContent ?? "";
    if (!text.trim()) continue;

    let i = 0;
    while (i < text.length) {
      // Skip whitespace
      while (i < text.length && /\s/.test(text[i])) i++;
      if (i >= text.length) break;

      // Find end of word (non-whitespace run)
      const wordStart = i;
      while (i < text.length && !/\s/.test(text[i])) i++;
      const wordEnd = i;

      if (wordEnd <= wordStart) break;

      const wordText = text.slice(wordStart, wordEnd);
      let rect: DOMRect;

      try {
        range.setStart(node, wordStart);
        range.setEnd(node, wordEnd);
        rect = range.getBoundingClientRect();
      } catch {
        // Fallback if range fails (detached node, etc.)
        rect = new DOMRect(0, 0, 0, 0);
      }

      // Skip hidden elements (zero-size with a non-zero parent — real hidden elements
      // have rects with 0 size even though their parent has layout; jsdom always gives 0)
      if (rect.width === 0 && rect.height === 0) {
        const parent = node.parentElement;
        if (parent) {
          const parentRect = parent.getBoundingClientRect();
          if (parentRect.width > 0 || parentRect.height > 0) continue;
        }
        // In jsdom or when parent is also 0, keep the token (no layout engine available)
      }

      tokens.push({
        index,
        node,
        startOffset: wordStart,
        endOffset: wordEnd,
        text: wordText,
        rect,
      });
      index++;
    }
  }

  range.detach();
  return tokens;
}
