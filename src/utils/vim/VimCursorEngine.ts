import { useVimModeStore, type VimMode } from "../../stores/vimModeStore";
import type { TextDocumentAdapter, WordToken } from "./textModel";
import { buildWordTokens } from "./textModel";
import { groupTokensIntoLines, findLineForToken, type LineGroup } from "./lineGrouper";
import {
  motionH, motionL, motionW, motionB, motionE,
  motion0, motionDollar, motionJ, motionK,
  motionGG, motionG, motionOpenBrace, motionCloseBrace,
  type MotionResult,
} from "./motions";
import { updateCaret, removeCaret, type CaretStyle } from "./caretOverlay";
import { setSelection, clearSelection } from "./selectionManager";

export type VimAction = "extract" | "extract-dialog" | "yank" | "highlight" | "flashcard";

const SEQUENCE_TIMEOUT = 800;

export class VimCursorEngine {
  private adapter: TextDocumentAdapter;
  private tokens: WordToken[] = [];
  private lines: LineGroup[] = [];
  private caretElement: HTMLSpanElement | null = null;
  private onAction: ((action: VimAction) => void) | null = null;
  private sequenceTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(adapter: TextDocumentAdapter, onAction?: (action: VimAction) => void) {
    this.adapter = adapter;
    this.onAction = onAction ?? null;
    this.rebuildModel();
  }

  rebuildModel(): void {
    this.tokens = buildWordTokens(this.adapter);
    this.lines = groupTokensIntoLines(this.tokens);

    const store = useVimModeStore.getState();
    if (store.mode !== "inactive" && this.tokens.length > 0) {
      const clamped = Math.min(store.cursorIndex, this.tokens.length - 1);
      store.moveCursor(clamped);
      this.renderCaret();
    }
  }

  handleKeyDown(e: KeyboardEvent): boolean {
    if (this.disposed) return false;

    const store = useVimModeStore.getState();
    const { mode } = store;

    // Escape handling
    if (e.key === "Escape") {
      if (mode === "normal") {
        this.deactivate();
        return true;
      }
      if (mode === "visual" || mode === "visual-line") {
        clearSelection(this.adapter.getDocument());
        store.setMode("normal");
        this.renderCaret();
        return true;
      }
      return false;
    }

    // Activation from inactive
    if (mode === "inactive") {
      // Activation is handled externally via the hook
      return false;
    }

    if (this.tokens.length === 0) return false;

    const lowerKey = e.key.toLowerCase();

    // Visual mode entry
    if (mode === "normal" && lowerKey === "v" && !e.shiftKey) {
      store.setSelectionAnchor(store.cursorIndex);
      store.setMode("visual");
      this.renderCaret();
      this.updateVisualSelection();
      return true;
    }
    if (mode === "normal" && e.key === "V") {
      store.setSelectionAnchor(store.cursorIndex);
      store.setMode("visual-line");
      this.renderCaret();
      this.updateVisualSelection();
      return true;
    }

    // Switch between visual/visual-line
    if (mode === "visual" && e.key === "V") {
      store.setMode("visual-line");
      this.renderCaret();
      this.updateVisualSelection();
      return true;
    }
    if (mode === "visual-line" && lowerKey === "v" && !e.shiftKey) {
      store.setMode("visual");
      this.renderCaret();
      this.updateVisualSelection();
      return true;
    }

    // G (shift+g) goes to document end — check before gg sequence
    if (e.key === "G" && e.shiftKey) {
      this.applyMotion(motionG(this.tokens));
      return true;
    }

    // Multi-key sequences (gg)
    if (lowerKey === "g" && !e.shiftKey) {
      if (store.pendingSequence === "g") {
        this.clearSequence();
        this.applyMotion(motionGG(this.tokens));
        return true;
      }
      store.setPendingSequence("g");
      this.startSequenceTimer();
      return true;
    }

    // Any other key clears pending sequence
    if (store.pendingSequence) {
      this.clearSequence();
    }

    // Actions in visual mode take priority over motions for conflicting keys
    if (mode === "visual" || mode === "visual-line") {
      const actionHandled = this.dispatchAction(e, lowerKey);
      if (actionHandled) return true;
    }

    // Motions
    const result = this.dispatchMotion(e, lowerKey, mode, store);
    if (result) return true;

    return false;
  }

  private dispatchMotion(e: KeyboardEvent, lowerKey: string, mode: VimMode, store: ReturnType<typeof useVimModeStore.getState>): boolean {
    let motionResult: MotionResult | null = null;
    let handled = false;

    if (lowerKey === "h" && !e.ctrlKey && !e.metaKey) {
      motionResult = motionH(this.tokens, store.cursorIndex, store.desiredColumn);
      handled = true;
    } else if (lowerKey === "l" && !e.ctrlKey && !e.metaKey) {
      motionResult = motionL(this.tokens, store.cursorIndex, store.desiredColumn);
      handled = true;
    } else if (lowerKey === "w") {
      motionResult = motionW(this.tokens, store.cursorIndex, store.desiredColumn);
      handled = true;
    } else if (lowerKey === "b") {
      motionResult = motionB(this.tokens, store.cursorIndex, store.desiredColumn);
      handled = true;
    } else if (lowerKey === "e") {
      motionResult = motionE(this.tokens, store.cursorIndex, store.desiredColumn);
      handled = true;
    } else if (lowerKey === "j" && !e.ctrlKey && !e.metaKey) {
      motionResult = motionJ(this.tokens, store.cursorIndex, store.desiredColumn, this.lines);
      handled = true;
    } else if (lowerKey === "k" && !e.ctrlKey && !e.metaKey) {
      motionResult = motionK(this.tokens, store.cursorIndex, store.desiredColumn, this.lines);
      handled = true;
    } else if (e.key === "0") {
      motionResult = motion0(this.tokens, store.cursorIndex, this.lines);
      handled = true;
    } else if (e.key === "$") {
      motionResult = motionDollar(this.tokens, store.cursorIndex, this.lines);
      handled = true;
    } else if (e.key === "{") {
      motionResult = motionOpenBrace(this.tokens, store.cursorIndex, this.lines);
      handled = true;
    } else if (e.key === "}") {
      motionResult = motionCloseBrace(this.tokens, store.cursorIndex, this.lines);
      handled = true;
    }

    if (handled && motionResult) {
      this.applyMotion(motionResult);
      return true;
    }

    return false;
  }

  private applyMotion(result: MotionResult): void {
    const store = useVimModeStore.getState();
    store.moveCursor(result.cursorIndex, result.desiredColumn);
    this.renderCaret();
    this.scrollToCursor();

    if (store.mode === "visual" || store.mode === "visual-line") {
      this.updateVisualSelection();
    }
  }

  private dispatchAction(e: KeyboardEvent, lowerKey: string): boolean {
    let action: VimAction | null = null;

    if (e.key === "Enter" || lowerKey === "e") {
      action = lowerKey === "e" ? "extract-dialog" : "extract";
    } else if (lowerKey === "y") {
      action = "yank";
    } else if (e.key === "H") {
      action = "highlight";
    } else if (e.key === "F") {
      action = "flashcard";
    }

    if (action) {
      useVimModeStore.getState().setLastAction(action);
      this.onAction?.(action);
      return true;
    }
    return false;
  }

  private updateVisualSelection(): void {
    const store = useVimModeStore.getState();
    if (store.mode === "visual") {
      setSelection(
        this.adapter.getDocument(),
        store.selectionAnchor,
        store.cursorIndex,
        this.tokens,
      );
    } else if (store.mode === "visual-line") {
      this.setLineSelection();
    }
  }

  private setLineSelection(): void {
    const store = useVimModeStore.getState();
    const anchorLine = findLineForToken(this.lines, store.selectionAnchor);
    const cursorLine = findLineForToken(this.lines, store.cursorIndex);
    if (!anchorLine || !cursorLine) return;

    const startLine = anchorLine.index <= cursorLine.index ? anchorLine : cursorLine;
    const endLine = anchorLine.index <= cursorLine.index ? cursorLine : anchorLine;

    const startToken = startLine.tokens[0];
    const endToken = endLine.tokens[endLine.tokens.length - 1];

    setSelection(this.adapter.getDocument(), startToken.index, endToken.index, this.tokens);
  }

  private renderCaret(): void {
    const store = useVimModeStore.getState();
    if (store.mode === "inactive" || this.tokens.length === 0) return;

    const token = this.tokens[store.cursorIndex];
    if (!token) return;

    // Fetch a live rect from the DOM so the caret is positioned at the
    // token's current screen location — the cached token.rect may be stale
    // after scrolling or reflow.
    const doc = this.adapter.getDocument();
    const range = doc.createRange();
    try {
      range.setStart(token.node, token.startOffset);
      range.setEnd(token.node, token.endOffset);
      token.rect = range.getBoundingClientRect();
    } catch {
      // Fall back to cached rect if the node is detached
    } finally {
      range.detach();
    }

    const style: CaretStyle = store.mode === "normal" ? "block" : "underline";
    const scrollContainer = doc === document ? this.adapter.getScrollContainer() : null;
    this.caretElement = updateCaret(
      this.caretElement,
      token,
      style,
      doc,
      scrollContainer,
    );
  }

  private scrollToCursor(): void {
    if (this.tokens.length === 0) return;
    const store = useVimModeStore.getState();
    const token = this.tokens[store.cursorIndex];
    if (!token) return;

    const tokenRect = token.rect;
    const doc = this.adapter.getDocument();
    const win = doc.defaultView;
    const isInIframe = doc !== document;
    const tokenMid = (tokenRect.top + tokenRect.bottom) / 2;

    if (isInIframe && win) {
      const viewportHeight = win.innerHeight;
      const margin = viewportHeight * 0.2;
      if (tokenMid < margin || tokenMid > viewportHeight - margin) {
        const scrollEl = doc.scrollingElement ?? doc.documentElement ?? doc.body;
        const currentScroll = scrollEl.scrollTop;
        const targetScroll = currentScroll + tokenMid - viewportHeight / 2;
        scrollEl.scrollTo({ top: targetScroll, behavior: "smooth" });
      }
    } else {
      const scrollContainer = this.adapter.getScrollContainer();
      if (!scrollContainer) return;
      const containerRect = scrollContainer.getBoundingClientRect();
      const visibleHeight = containerRect.bottom - containerRect.top;
      const margin = visibleHeight * 0.2;
      if (tokenMid < containerRect.top + margin || tokenMid > containerRect.bottom - margin) {
        scrollContainer.scrollBy({ top: tokenMid - (containerRect.top + containerRect.bottom) / 2, behavior: "smooth" });
      }
    }
  }

  private startSequenceTimer(): void {
    if (this.sequenceTimer) clearTimeout(this.sequenceTimer);
    this.sequenceTimer = setTimeout(() => {
      useVimModeStore.getState().setPendingSequence("");
    }, SEQUENCE_TIMEOUT);
  }

  private clearSequence(): void {
    if (this.sequenceTimer) {
      clearTimeout(this.sequenceTimer);
      this.sequenceTimer = null;
    }
    useVimModeStore.getState().setPendingSequence("");
  }

  activate(docId: string): void {
    // Rebuild model to get fresh viewport-relative rects
    this.rebuildModel();

    useVimModeStore.getState().activate(docId);
    if (this.tokens.length > 0) {
      const visible = this.findFirstVisibleToken();
      useVimModeStore.getState().moveCursor(visible);
    }
    this.renderCaret();
  }

  deactivate(): void {
    const store = useVimModeStore.getState();
    if (store.mode === "visual" || store.mode === "visual-line") {
      clearSelection(this.adapter.getDocument());
    }
    removeCaret(this.caretElement, this.adapter.getDocument());
    this.caretElement = null;
    this.clearSequence();
    useVimModeStore.getState().deactivate();
  }

  private findFirstVisibleToken(): number {
    const doc = this.adapter.getDocument();
    const win = doc.defaultView;
    // Token rects are viewport-relative (y=0 is top of viewport).
    // For iframe content: viewport is the iframe window (0..innerHeight).
    // For main doc with a scroll container: we use the container's visible rect.
    const isInIframe = doc !== document;
    let viewportTop: number;
    let viewportBottom: number;

    if (isInIframe && win) {
      viewportTop = 50; // Small offset to skip partially-hidden top tokens
      viewportBottom = win.innerHeight - 50;
    } else {
      const scrollContainer = this.adapter.getScrollContainer();
      const containerRect = scrollContainer.getBoundingClientRect();
      viewportTop = containerRect.top;
      viewportBottom = containerRect.bottom;
    }

    for (let i = 0; i < this.tokens.length; i++) {
      const rect = this.tokens[i].rect;
      if (rect.bottom >= viewportTop && rect.top <= viewportBottom) {
        return i;
      }
    }
    return 0;
  }

  dispose(): void {
    this.disposed = true;
    this.clearSequence();
    removeCaret(this.caretElement, this.adapter.getDocument());
    this.caretElement = null;
    this.adapter.dispose();
  }

  getTokens(): WordToken[] {
    return this.tokens;
  }

  getLines(): LineGroup[] {
    return this.lines;
  }

  /** Recalculate cached rects from live DOM. Cheaper than full rebuild. */
  refreshRects(): void {
    const doc = this.adapter.getDocument();
    const range = doc.createRange();

    for (const token of this.tokens) {
      try {
        range.setStart(token.node, token.startOffset);
        range.setEnd(token.node, token.endOffset);
        token.rect = range.getBoundingClientRect();
      } catch {
        token.rect = new DOMRect(0, 0, 0, 0);
      }
    }

    range.detach();
    this.lines = groupTokensIntoLines(this.tokens);
  }
}
