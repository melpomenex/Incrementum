export type WordTokenKind = "word" | "punct";

export interface WordToken {
  index: number;
  node: Text;
  startOffset: number;
  endOffset: number;
  text: string;
  rect: DOMRect;
  /**
   * Token classification for vim word motions.
   * - "word": alphanumeric/underscore run (`\w`)
   * - "punct": a run of non-whitespace, non-word characters
   * Whitespace is never emitted as a token; it is implicit between tokens.
   * Defaults to "word" for callers that construct tokens without a kind.
   */
  kind?: WordTokenKind;
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

      // Tokenize the non-whitespace run into kind-pure sub-tokens.
      // A "WORD" in vim is the entire whitespace-delimited run; lowercase
      // `w`/`b`/`e` stop at each kind boundary (word vs punct) inside it.
      while (i < text.length && !/\s/.test(text[i])) {
        const runStart = i;
        const isWordChar = /\w/.test(text[i]);
        while (
          i < text.length &&
          !/\s/.test(text[i]) &&
          /\w/.test(text[i]) === isWordChar
        ) {
          i++;
        }
        const runEnd = i;
        if (runEnd <= runStart) break;

        const wordText = text.slice(runStart, runEnd);
        let rect: DOMRect;

        try {
          range.setStart(node, runStart);
          range.setEnd(node, runEnd);
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
          startOffset: runStart,
          endOffset: runEnd,
          text: wordText,
          rect,
          kind: isWordChar ? "word" : "punct",
        });
        index++;
      }
    }
  }

  range.detach();
  return tokens;
}
