import { useVimModeStore, type VimMode, type VimOperator } from "../../stores/vimModeStore";
import type { TextDocumentAdapter, WordToken } from "./textModel";
import { buildWordTokens } from "./textModel";
import { groupTokensIntoLines, findLineForToken, type LineGroup } from "./lineGrouper";
import {
  motionH, motionL, motionW, motionB, motionE,
  motionBigW, motionBigB, motionBigE,
  motion0, motionDollar, motionJ, motionK,
  motionGG, motionG, motionOpenBrace, motionCloseBrace,
  type MotionResult,
} from "./motions";
import { updateCaret, removeCaret, type CaretStyle } from "./caretOverlay";
import { setSelection, clearSelection, getSelectedText } from "./selectionManager";
import { selectTextObject, type TextObjectTarget } from "./textObjects";
import { applyOperator } from "./operators";

export type VimAction =
  | "extract"
  | "extract-dialog"
  | "yank"
  | "highlight"
  | "flashcard"
  | "chain-flashcard";

const SEQUENCE_TIMEOUT = 800;

export class VimCursorEngine {
  private adapter: TextDocumentAdapter;
  private tokens: WordToken[] = [];
  private lines: LineGroup[] = [];
  private caretElement: HTMLSpanElement | null = null;
  private onAction: ((action: VimAction) => void) | null = null;
  private sequenceTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  /** Action context used by operator-pending verbs. */
  private operatorContext: import("./actions").VimActionContext | null = null;

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
      // Escape cancels a pending operator or sequence before exiting modes.
      if (store.pendingOperator || store.pendingSequence) {
        this.clearSequence();
        store.setPendingOperator(null);
        this.renderCaret();
        return true;
      }
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

    // Operator-pending: the next key resolves the operator's range.
    // Applies in normal mode only; visual mode uses the single-key actions.
    if (mode === "normal" && store.pendingOperator) {
      return this.handleOperatorPendingKey(e, lowerKey, store);
    }

    // Enter operator-pending mode (normal mode only).
    if (
      mode === "normal" &&
      !store.pendingOperator &&
      (lowerKey === "d" || lowerKey === "c" || lowerKey === "y") &&
      !e.ctrlKey && !e.metaKey && !e.shiftKey
    ) {
      store.setPendingOperator(lowerKey as VimOperator);
      this.startSequenceTimer();
      this.renderCaret();
      return true;
    }

    // Visual mode entry
    if (mode === "normal" && lowerKey === "v" && !e.shiftKey) {
      store.setSelectionAnchor(store.cursorIndex);
      store.setMode("visual");
      this.updateVisualSelection();
      this.scrollToCursor();
      this.renderCaret();
      return true;
    }
    if (mode === "normal" && e.key === "V") {
      store.setSelectionAnchor(store.cursorIndex);
      store.setMode("visual-line");
      this.updateVisualSelection();
      this.scrollToCursor();
      this.renderCaret();
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
      this.clearSequence();
      this.applyMotion(motionG(this.tokens));
      return true;
    }

    // Text-object prefix: `a`/`i` followed by `w`/`s`/`p` (and `W`/`S`/`P`
    // which we normalize to lowercase since vim treats them identically).
    if ((lowerKey === "a" || lowerKey === "i") && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      // Text objects only apply in normal or visual mode.
      if (mode === "normal" || mode === "visual" || mode === "visual-line") {
        const prefix = lowerKey as "a" | "i";
        if (store.pendingSequence === prefix) {
          // Repeated prefix key — not a valid text object; cancel.
          this.clearSequence();
          return true;
        }
        store.setPendingSequence(prefix);
        this.startSequenceTimer();
        return true;
      }
    }
    // Second key of a text-object sequence.
    if ((store.pendingSequence === "a" || store.pendingSequence === "i") &&
        (lowerKey === "w" || lowerKey === "s" || lowerKey === "p")) {
      const target = (store.pendingSequence + lowerKey) as TextObjectTarget;
      this.clearSequence();
      this.applyTextObject(target, store);
      return true;
    }

    // Multi-key sequences (gg / gf)
    if (lowerKey === "g" && !e.shiftKey) {
      if (store.pendingSequence === "g") {
        this.clearSequence();
        this.applyMotion(motionGG(this.tokens));
        return true;
      }
      // `ag`/`ig` aren't valid; clear the text-object prefix and treat as fresh `g`.
      if (store.pendingSequence) this.clearSequence();
      store.setPendingSequence("g");
      this.startSequenceTimer();
      return true;
    }
    // `gf` chain action: open Flashcard Studio seeded from the last extract.
    if (lowerKey === "f" && store.pendingSequence === "g") {
      this.clearSequence();
      useVimModeStore.getState().setLastAction("chain-flashcard");
      this.onAction?.("chain-flashcard");
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
    } else if (e.key === "W" && e.shiftKey) {
      motionResult = motionBigW(this.tokens, store.cursorIndex, store.desiredColumn);
      handled = true;
    } else if (e.key === "B" && e.shiftKey) {
      motionResult = motionBigB(this.tokens, store.cursorIndex, store.desiredColumn);
      handled = true;
    } else if (e.key === "E" && e.shiftKey) {
      motionResult = motionBigE(this.tokens, store.cursorIndex, store.desiredColumn);
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

  /**
   * Dispatch the key after an operator (`d`/`c`/`y`) has been pressed.
   * The key may be a motion (w/b/e/h/l/j/k/0/$/{/}/W/B/E), a text-object
   * prefix (`a`/`i`), or a repeated operator (`dd`/`cc`/`yy` → line-wise).
   */
  private handleOperatorPendingKey(
    e: KeyboardEvent,
    lowerKey: string,
    store: ReturnType<typeof useVimModeStore.getState>,
  ): boolean {
    const operator = store.pendingOperator;
    if (!operator) return false;

    // Repeated operator → line-wise.
    if (lowerKey === operator && !e.shiftKey) {
      this.clearSequence();
      const line = findLineForToken(this.lines, store.cursorIndex);
      if (line) {
        const startIndex = line.tokens[0].index;
        const endIndex = line.tokens[line.tokens.length - 1].index;
        this.runOperatorOnRange(operator, startIndex, endIndex);
      }
      return true;
    }

    // Text-object prefix `a`/`i` — wait for the next key.
    if ((lowerKey === "a" || lowerKey === "i") && !e.shiftKey) {
      useVimModeStore.getState().setPendingSequence(lowerKey);
      // Keep the operator pending; the text-object second key resolves it.
      // Restart the timer so the combined sequence has a full window.
      this.startSequenceTimer();
      return true;
    }

    // Second key of an operator + text-object sequence (e.g. `daw`, `cip`).
    if (
      (store.pendingSequence === "a" || store.pendingSequence === "i") &&
      (lowerKey === "w" || lowerKey === "s" || lowerKey === "p")
    ) {
      const target = (store.pendingSequence + lowerKey) as TextObjectTarget;
      this.clearSequence();
      const result = selectTextObject(this.tokens, store.cursorIndex, target, this.lines);
      if (result) {
        const startIndex = Math.min(result.startIndex, result.endIndex);
        const endIndex = Math.max(result.startIndex, result.endIndex);
        this.runOperatorOnRange(operator, startIndex, endIndex);
      }
      return true;
    }

    // Any motion → compute target index, then operate on [cursor, target].
    const motionTarget = this.tryResolveMotionTarget(e, lowerKey, store);
    if (motionTarget !== null) {
      this.clearSequence();
      const startIndex = Math.min(store.cursorIndex, motionTarget);
      const endIndex = Math.max(store.cursorIndex, motionTarget);
      this.runOperatorOnRange(operator, startIndex, endIndex);
      return true;
    }

    // Unknown key — cancel the operator.
    this.clearSequence();
    return false;
  }

  /**
   * Try to resolve a motion to its target token index without moving the cursor.
   * Returns null when the key is not a motion.
   */
  private tryResolveMotionTarget(
    e: KeyboardEvent,
    lowerKey: string,
    store: ReturnType<typeof useVimModeStore.getState>,
  ): number | null {
    let result: MotionResult | null = null;
    if (lowerKey === "h" && !e.ctrlKey && !e.metaKey) {
      result = motionH(this.tokens, store.cursorIndex, store.desiredColumn);
    } else if (lowerKey === "l" && !e.ctrlKey && !e.metaKey) {
      result = motionL(this.tokens, store.cursorIndex, store.desiredColumn);
    } else if (lowerKey === "w") {
      result = motionW(this.tokens, store.cursorIndex, store.desiredColumn);
    } else if (lowerKey === "b") {
      result = motionB(this.tokens, store.cursorIndex, store.desiredColumn);
    } else if (lowerKey === "e") {
      result = motionE(this.tokens, store.cursorIndex, store.desiredColumn);
    } else if (e.key === "W" && e.shiftKey) {
      result = motionBigW(this.tokens, store.cursorIndex, store.desiredColumn);
    } else if (e.key === "B" && e.shiftKey) {
      result = motionBigB(this.tokens, store.cursorIndex, store.desiredColumn);
    } else if (e.key === "E" && e.shiftKey) {
      result = motionBigE(this.tokens, store.cursorIndex, store.desiredColumn);
    } else if (lowerKey === "j" && !e.ctrlKey && !e.metaKey) {
      result = motionJ(this.tokens, store.cursorIndex, store.desiredColumn, this.lines);
    } else if (lowerKey === "k" && !e.ctrlKey && !e.metaKey) {
      result = motionK(this.tokens, store.cursorIndex, store.desiredColumn, this.lines);
    } else if (e.key === "0") {
      result = motion0(this.tokens, store.cursorIndex, this.lines);
    } else if (e.key === "$") {
      result = motionDollar(this.tokens, store.cursorIndex, this.lines);
    } else if (e.key === "{") {
      result = motionOpenBrace(this.tokens, store.cursorIndex, this.lines);
    } else if (e.key === "}") {
      result = motionCloseBrace(this.tokens, store.cursorIndex, this.lines);
    }
    return result ? result.cursorIndex : null;
  }

  /**
   * Set a visual selection over the range, read the resulting text, and run
   * the operator against it. Leaves the cursor at the range start.
   */
  private runOperatorOnRange(operator: VimOperator, startIndex: number, endIndex: number): void {
    const doc = this.adapter.getDocument();
    setSelection(doc, startIndex, endIndex, this.tokens);
    const text = getSelectedText(doc);

    // Move cursor to the range start before dispatching.
    const store = useVimModeStore.getState();
    store.moveCursor(startIndex);
    this.renderCaret();

    const ctx = this.operatorContext;
    if (ctx) {
      void applyOperator(operator, text, ctx).then(() => {
        // After an operator completes, return to normal mode and clear selection.
        clearSelection(doc);
        useVimModeStore.getState().setMode("normal");
      });
    } else {
      // No action context — at least clear the selection.
      clearSelection(doc);
    }
  }

  /** Set the action context used by operators (wired from useVimReading). */
  setOperatorContext(ctx: import("./actions").VimActionContext | null): void {
    this.operatorContext = ctx;
  }

  private applyMotion(result: MotionResult): void {
    const store = useVimModeStore.getState();
    store.moveCursor(result.cursorIndex, result.desiredColumn);
    this.scrollToCursor();

    if (store.mode === "visual" || store.mode === "visual-line") {
      this.updateVisualSelection();
    }
    // Render caret LAST so it survives any React re-render triggered by
    // the selectionchange event from updateVisualSelection.
    this.renderCaret();
  }

  /**
   * Apply a text-object selection. Enters visual mode anchored at the
   * selection start so the caret sits at the selection end.
   */
  private applyTextObject(target: TextObjectTarget, store: ReturnType<typeof useVimModeStore.getState>): void {
    const result = selectTextObject(this.tokens, store.cursorIndex, target, this.lines);
    if (!result) return;

    const startIndex = Math.min(result.startIndex, result.endIndex);
    const endIndex = Math.max(result.startIndex, result.endIndex);

    // Enter visual mode (or stay in it) and select the token range.
    if (store.mode === "normal") {
      store.setSelectionAnchor(startIndex);
      store.setMode("visual");
    } else {
      // Already in visual/visual-line — re-anchor to the text-object range.
      store.setSelectionAnchor(startIndex);
    }
    store.moveCursor(endIndex);
    this.scrollToCursor();
    this.updateVisualSelection();
    this.renderCaret();
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

    // Safety net: React re-renders triggered by the selectionchange event
    // (fired asynchronously after setSelection) can remove our non-React
    // overlay from the DOM. Re-append on the next frame to survive this.
    if (this.caretElement && (store.mode === "visual" || store.mode === "visual-line")) {
      const el = this.caretElement;
      const expectedParent = scrollContainer ?? doc.body;
      requestAnimationFrame(() => {
        if (!this.disposed && el && el.parentNode !== expectedParent) {
          expectedParent.appendChild(el);
        }
      });
    }
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
      const store = useVimModeStore.getState();
      store.setPendingSequence("");
      if (store.pendingOperator) store.setPendingOperator(null);
      this.renderCaret();
    }, SEQUENCE_TIMEOUT);
  }

  private clearSequence(): void {
    if (this.sequenceTimer) {
      clearTimeout(this.sequenceTimer);
      this.sequenceTimer = null;
    }
    const store = useVimModeStore.getState();
    store.setPendingSequence("");
    if (store.pendingOperator) store.setPendingOperator(null);
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
