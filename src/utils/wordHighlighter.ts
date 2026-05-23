const HIGHLIGHT_CLASS = "tts-word-highlight";
const CHUNK_HIGHLIGHT_CLASS = "tts-chunk-highlight";

interface HighlightRange {
  node: Node;
  startOffset: number;
  endOffset: number;
}

export class WordHighlighter {
  private container: HTMLElement | null = null;
  private enabled = false;
  private useChunkLevel = false;
  private styleElement: HTMLStyleElement | null = null;
  private previousRanges: HighlightRange[] = [];

  init(container: HTMLElement, useChunkLevel = false): void {
    this.container = container;
    this.useChunkLevel = useChunkLevel;
    this.injectStyles();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setUseChunkLevel(chunkLevel: boolean): void {
    this.useChunkLevel = chunkLevel;
  }

  highlightWord(chunkText: string, wordOffset: number): void {
    if (!this.enabled || !this.container || !chunkText) return;
    this.clear();

    if (this.useChunkLevel) {
      this.highlightChunk(chunkText);
      return;
    }

    const words = chunkText.split(/\s+/).filter(Boolean);
    if (wordOffset >= words.length) return;

    const targetWord = words[wordOffset];
    if (!targetWord) return;

    const charOffset = chunkText.indexOf(targetWord, this.getCharOffsetForWord(chunkText, wordOffset));
    if (charOffset < 0) {
      this.highlightChunk(chunkText);
      return;
    }

    const ranges = this.findTextRanges(chunkText, charOffset, charOffset + targetWord.length);
    if (ranges.length === 0) {
      this.highlightChunk(chunkText);
      return;
    }

    this.applyHighlights(ranges, HIGHLIGHT_CLASS);
    this.previousRanges = ranges;
  }

  highlightChunk(chunkText: string): void {
    if (!this.enabled || !this.container || !chunkText) return;
    this.clear();

    const ranges = this.findTextRanges(chunkText, 0, chunkText.length);
    this.applyHighlights(ranges, CHUNK_HIGHLIGHT_CLASS);
    this.previousRanges = ranges;
  }

  clear(): void {
    if (!this.container) return;
    const doc = this.container.ownerDocument || document;
    this.container.querySelectorAll(`.${HIGHLIGHT_CLASS}, .${CHUNK_HIGHLIGHT_CLASS}`).forEach((el) => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(doc.createTextNode(el.textContent || ""), el);
        parent.normalize();
      }
    });
    this.previousRanges = [];
  }

  destroy(): void {
    this.clear();
    this.container = null;
    if (this.styleElement?.parentNode) {
      this.styleElement.parentNode.removeChild(this.styleElement);
    }
  }

  private getCharOffsetForWord(text: string, wordIndex: number): number {
    const words = text.split(/\s+/);
    let offset = 0;
    for (let i = 0; i < wordIndex && i < words.length; i++) {
      const idx = text.indexOf(words[i], offset);
      if (idx >= 0) offset = idx + words[i].length + 1;
    }
    return offset;
  }

  private findTextRanges(searchText: string, startChar: number, endChar: number): HighlightRange[] {
    if (!this.container) return [];

    const doc = this.container.ownerDocument || document;
    const textNodes: Text[] = [];
    const walker = doc.createTreeWalker(this.container, NodeFilter.SHOW_TEXT, null);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (node.textContent && node.textContent.trim()) {
        textNodes.push(node);
      }
    }

    const fullText = textNodes.map((n) => n.textContent || "").join("");
    const searchStart = this.findRelevantOffset(fullText, searchText);
    if (searchStart < 0) return [];

    const targetStart = searchStart + startChar;
    const targetEnd = searchStart + Math.min(endChar, searchText.length);

    const ranges: HighlightRange[] = [];
    let accumulated = 0;

    for (const textNode of textNodes) {
      const nodeText = textNode.textContent || "";
      const nodeStart = accumulated;
      const nodeEnd = accumulated + nodeText.length;

      if (nodeEnd > targetStart && nodeStart < targetEnd) {
        ranges.push({
          node: textNode,
          startOffset: Math.max(0, targetStart - nodeStart),
          endOffset: Math.min(nodeText.length, targetEnd - nodeStart),
        });
      }

      accumulated = nodeEnd;
      if (accumulated >= targetEnd) break;
    }

    return ranges;
  }

  private findRelevantOffset(fullText: string, searchText: string): number {
    const idx = fullText.indexOf(searchText);
    if (idx >= 0) return idx;

    const searchTrimmed = searchText.replace(/\s+/g, " ").trim();
    const firstWord = searchTrimmed.split(/\s+/)[0];
    if (!firstWord) return -1;
    return fullText.indexOf(firstWord);
  }

  private applyHighlights(ranges: HighlightRange[], className: string): void {
    let scrolled = false;
    for (const range of ranges) {
      try {
        const doc = range.node.ownerDocument || this.container?.ownerDocument || document;
        const span = doc.createElement("span");
        span.className = className;
        const textNode = range.node;
        const parent = textNode.parentNode;
        if (!parent) continue;

        const text = textNode.textContent || "";
        const before = text.slice(0, range.startOffset);
        const middle = text.slice(range.startOffset, range.endOffset);
        const after = text.slice(range.endOffset);

        span.textContent = middle;

        const fragment = doc.createDocumentFragment();
        if (before) fragment.appendChild(doc.createTextNode(before));
        fragment.appendChild(span);
        if (after) fragment.appendChild(doc.createTextNode(after));

        parent.replaceChild(fragment, textNode);
        parent.normalize();

        if (!scrolled) {
          const win = doc.defaultView;
          if (win && win !== win.parent) {
            // We are inside an iframe (like in the EPUB viewer)
            let iframeElement: HTMLIFrameElement | null = null;
            try {
              const parentDoc = win.parent.document;
              const iframes = parentDoc.querySelectorAll("iframe");
              for (const iframe of iframes) {
                if (iframe.contentWindow === win) {
                  iframeElement = iframe;
                  break;
                }
              }
            } catch (e) {
              console.warn("WordHighlighter: Failed to access parent document frame", e);
            }

            if (iframeElement) {
              const parentDoc = win.parent.document;

              // Helper to find the scrollable container in the parent document
              const findScrollableContainer = (el: HTMLElement): HTMLElement | null => {
                let current = el.parentElement;
                while (current) {
                  const style = win.parent.getComputedStyle(current);
                  const overflowY = style.overflowY;
                  const isScrollable =
                    overflowY === "auto" ||
                    overflowY === "scroll" ||
                    current.hasAttribute("data-document-scroll-container") ||
                    current.getAttribute("data-epub-viewer") === "true";
                  if (isScrollable && current.scrollHeight > current.clientHeight) {
                    return current;
                  }
                  current = current.parentElement;
                }
                const docScroll = parentDoc.querySelector("[data-document-scroll-container]");
                if (docScroll) return docScroll as HTMLElement;
                return null;
              };

              const scrollContainer = findScrollableContainer(iframeElement);
              if (scrollContainer) {
                // Calculate absolute offsetTop of span inside iframe
                let spanOffsetTop = 0;
                let currentEl: HTMLElement | null = span;
                while (currentEl) {
                  spanOffsetTop += currentEl.offsetTop;
                  currentEl = currentEl.offsetParent as HTMLElement | null;
                }

                // Calculate absolute offsetTop of iframe inside parent document
                let iframeOffsetTop = 0;
                let currentIframe: HTMLElement | null = iframeElement;
                while (currentIframe) {
                  iframeOffsetTop += currentIframe.offsetTop;
                  currentIframe = currentIframe.offsetParent as HTMLElement | null;
                }

                // Calculate absolute offsetTop of scrollContainer inside parent document
                let containerOffsetTop = 0;
                let currentContainer: HTMLElement | null = scrollContainer;
                while (currentContainer) {
                  containerOffsetTop += currentContainer.offsetTop;
                  currentContainer = currentContainer.offsetParent as HTMLElement | null;
                }

                const totalSpanTop = spanOffsetTop + iframeOffsetTop - containerOffsetTop;
                const containerHeight = scrollContainer.clientHeight || win.parent.innerHeight;
                const spanHeight = span.offsetHeight || 20;

                const targetScrollTop = totalSpanTop - containerHeight / 2 + spanHeight / 2;

                scrollContainer.scrollTo({
                  top: targetScrollTop,
                  behavior: "smooth",
                });
                scrolled = true;
              }
            }
          }

          // Fallback to standard scrollIntoView if not inside iframe or parent scroll failed
          if (!scrolled) {
            span.scrollIntoView({ behavior: "smooth", block: "center" });
            scrolled = true;
          }
        }
      } catch (err) {
        console.warn("WordHighlighter: Failed to apply highlight or scroll", err);
      }
    }
  }

  private injectStyles(): void {
    if (this.styleElement || !this.container) return;
    const doc = this.container.ownerDocument || document;
    this.styleElement = doc.createElement("style");
    this.styleElement.textContent = `
      .${HIGHLIGHT_CLASS} {
        background-color: rgba(59, 130, 246, 0.35) !important;
        border-radius: 2px !important;
        transition: background-color 0.1s ease !important;
      }
      .${CHUNK_HIGHLIGHT_CLASS} {
        background-color: rgba(59, 130, 246, 0.15) !important;
        border-radius: 2px !important;
      }
    `;
    doc.head?.appendChild(this.styleElement);
  }
}
