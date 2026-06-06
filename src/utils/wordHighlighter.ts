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
  private lastTargetScrollTop: number | null = null;
  private lastUserScrollTime = 0;

  private userInteractionListener = () => {
    this.lastUserScrollTime = Date.now();
  };

  init(container: HTMLElement, useChunkLevel = false): void {
    this.container = container;
    this.useChunkLevel = useChunkLevel;
    this.injectStyles();
    this.setupInteractionListeners();
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
    this.lastTargetScrollTop = null;
  }

  destroy(): void {
    this.clear();
    this.removeInteractionListeners();
    this.container = null;
    if (this.styleElement?.parentNode) {
      this.styleElement.parentNode.removeChild(this.styleElement);
    }
    this.lastTargetScrollTop = null;
  }

  private setupInteractionListeners(): void {
    if (!this.container) return;
    const doc = this.container.ownerDocument || document;
    const win = doc.defaultView || window;

    const events = ["wheel", "touchmove", "pointerdown", "keydown"];
    events.forEach((event) => {
      win.addEventListener(event, this.userInteractionListener, { passive: true });
      doc.addEventListener(event, this.userInteractionListener, { passive: true });
    });
  }

  private removeInteractionListeners(): void {
    if (!this.container) return;
    const doc = this.container.ownerDocument || document;
    const win = doc.defaultView || window;

    const events = ["wheel", "touchmove", "pointerdown", "keydown"];
    events.forEach((event) => {
      win.removeEventListener(event, this.userInteractionListener);
      doc.removeEventListener(event, this.userInteractionListener);
    });
  }

  private findScrollableContainer(el: HTMLElement): HTMLElement | null {
    const doc = el.ownerDocument;
    const win = doc?.defaultView || window;

    let current = el.parentElement;
    while (current) {
      const style = win.getComputedStyle(current);
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

    if (win !== win.parent) {
      try {
        const parentDoc = win.parent.document;
        const iframes = parentDoc.querySelectorAll("iframe");
        let iframeElement: HTMLIFrameElement | null = null;
        for (const iframe of iframes) {
          if (iframe.contentWindow === win) {
            iframeElement = iframe;
            break;
          }
        }
        if (iframeElement) {
          let parentEl = iframeElement.parentElement;
          while (parentEl) {
            const style = win.parent.getComputedStyle(parentEl);
            const overflowY = style.overflowY;
            const isScrollable =
              overflowY === "auto" ||
              overflowY === "scroll" ||
              parentEl.hasAttribute("data-document-scroll-container") ||
              parentEl.getAttribute("data-epub-viewer") === "true";
            if (isScrollable && parentEl.scrollHeight > parentEl.clientHeight) {
              return parentEl;
            }
            parentEl = parentEl.parentElement;
          }
        }
      } catch (e) {
        console.warn("WordHighlighter: Failed to access parent document frame", e);
      }
    }

    if (doc) {
      const docScroll = doc.querySelector("[data-document-scroll-container]");
      if (docScroll) return docScroll as HTMLElement;
    }
    if (win !== win.parent) {
      try {
        const parentDoc = win.parent.document;
        const docScroll = parentDoc.querySelector("[data-document-scroll-container]");
        if (docScroll) return docScroll as HTMLElement;
      } catch {}
    }

    return null;
  }

  private getElementTopRelativeToContainer(el: HTMLElement, container: HTMLElement): number {
    let top = el.getBoundingClientRect().top;
    let currentWin: Window | null = el.ownerDocument?.defaultView || null;
    const targetWin = container.ownerDocument?.defaultView || window;

    while (currentWin && currentWin !== targetWin) {
      try {
        const parentDoc = currentWin.parent.document;
        const iframes = parentDoc.querySelectorAll("iframe");
        let foundIframe: HTMLIFrameElement | null = null;
        for (const iframe of iframes) {
          if (iframe.contentWindow === currentWin) {
            foundIframe = iframe;
            break;
          }
        }
        if (foundIframe) {
          top += foundIframe.getBoundingClientRect().top;
        } else {
          break;
        }
      } catch (e) {
        console.warn("WordHighlighter: Error traversing iframe hierarchy", e);
        break;
      }
      currentWin = currentWin.parent;
    }

    top -= container.getBoundingClientRect().top;
    return top;
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
          const scrollContainer = this.findScrollableContainer(span);
          if (scrollContainer) {
            const spanRect = span.getBoundingClientRect();
            const containerRect = scrollContainer.getBoundingClientRect();
            const containerHeight = scrollContainer.clientHeight || (doc.defaultView || window).innerHeight;
            const spanHeight = spanRect.height || 20;

            const relativeTop = this.getElementTopRelativeToContainer(span, scrollContainer);
            const currentScrollTop = scrollContainer.scrollTop;
            const targetScrollTop = currentScrollTop + relativeTop - containerHeight / 2 + spanHeight / 2;

            const maxScroll = Math.max(0, scrollContainer.scrollHeight - containerHeight);
            const clampedTarget = Math.max(0, Math.min(maxScroll, targetScrollTop));

            const isUserInteracting = Date.now() - this.lastUserScrollTime < 2000;
            const lineChanged = this.lastTargetScrollTop === null || Math.abs(clampedTarget - this.lastTargetScrollTop) > 8;
            const outOfViewport = relativeTop < 40 || relativeTop > containerHeight - 60;

            if (!isUserInteracting && (lineChanged || outOfViewport)) {
              scrollContainer.scrollTo({
                top: clampedTarget,
                behavior: "smooth",
              });
              this.lastTargetScrollTop = clampedTarget;
            }
            scrolled = true;
          } else {
            const isUserInteracting = Date.now() - this.lastUserScrollTime < 2000;
            if (!isUserInteracting) {
              span.scrollIntoView({ behavior: "smooth", block: "center" });
            }
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
