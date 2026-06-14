/**
 * Operator-pending verb tests.
 *
 * Verifies the engine-level dispatch for `d`/`c`/`y` operators combined with
 * motions, text objects, and repeated-operator (line-wise) forms. These tests
 * construct an engine + a mock VimActionContext and assert the dispatched
 * action + selection state.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { VimCursorEngine } from "../VimCursorEngine";
import { useVimModeStore } from "../../../stores/vimModeStore";
import { getSelectedText } from "../selectionManager";
import type { TextDocumentAdapter } from "../textModel";
import type { VimActionContext } from "../actions";

function createTestAdapter(html: string): { adapter: TextDocumentAdapter; container: HTMLDivElement } {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);

  return {
    adapter: {
      getTextNodes: () => {
        const textNodes: Text[] = [];
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
        let node: Text | null;
        while ((node = walker.nextNode() as Text | null)) {
          if (node.textContent && node.textContent.trim()) textNodes.push(node);
        }
        return textNodes;
      },
      getScrollContainer: () => container,
      getDocument: () => document,
      createOverlay: (host: Element) => {
        const span = document.createElement("span");
        host.appendChild(span);
        return span;
      },
      dispose: () => {},
    },
    container,
  };
}

function key(k: string, shift = false): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: k, shiftKey: shift, bubbles: true, cancelable: true });
}

describe("Operator-pending verbs", () => {
  let container: HTMLDivElement;
  let extractLog: Array<{ text: string }>;
  let dialogText: string | null;
  let yankText: string | null;

  beforeEach(() => {
    extractLog = [];
    dialogText = null;
    yankText = null;
  });

  function makeCtx(docId: string): VimActionContext {
    return {
      documentId: docId,
      getSelectedText: () => getSelectedText(document),
      getPageNumber: () => 1,
      getSelectionContext: () => null,
      createInstantExtract: async (p) => { extractLog.push({ text: p.text }); return { id: "ext-1" } as any; },
      openExtractDialog: (t: string) => { dialogText = t; },
      openFlashcardStudio: () => {},
      setLastExtractId: () => {},
      clearTextSelection: () => { window.getSelection()?.removeAllRanges(); },
    };
  }

  afterEach(() => {
    container?.remove();
    useVimModeStore.getState().deactivate();
  });

  it("`daw` extracts the around-word range instantly (no dialog)", () => {
    const result = createTestAdapter("<p>foo bar baz</p>");
    container = result.container;
    const ctx = makeCtx("doc1");
    const engine = new VimCursorEngine(result.adapter);
    engine.setOperatorContext(ctx);

    engine.activate("doc1");
    // Move to "bar" (index 1).
    engine.handleKeyDown(key("w"));
    expect(useVimModeStore.getState().cursorIndex).toBe(1);

    // daw
    engine.handleKeyDown(key("d"));
    expect(useVimModeStore.getState().pendingOperator).toBe("d");
    engine.handleKeyDown(key("a"));
    engine.handleKeyDown(key("w"));

    // An extract was created from the selection text (bar + baz, the around-word range).
    expect(extractLog.length).toBe(1);
    expect(extractLog[0].text).toContain("bar");
    expect(dialogText).toBeNull();
    // Returned to normal mode with operator cleared.
    expect(useVimModeStore.getState().pendingOperator).toBeNull();
    engine.dispose();
  });

  it("`cip` opens the extract dialog for the inner paragraph", () => {
    const result = createTestAdapter("<p>first paragraph here</p><p>second one</p>");
    container = result.container;
    const ctx = makeCtx("doc2");
    const engine = new VimCursorEngine(result.adapter);
    engine.setOperatorContext(ctx);

    engine.activate("doc2");
    engine.handleKeyDown(key("c"));
    expect(useVimModeStore.getState().pendingOperator).toBe("c");
    engine.handleKeyDown(key("i"));
    engine.handleKeyDown(key("p"));

    expect(dialogText).not.toBeNull();
    expect(dialogText).toContain("first");
    expect(extractLog.length).toBe(0);
    engine.dispose();
  });

  it("`yy` yanks the current line (no extract)", () => {
    const result = createTestAdapter("<p>alpha beta gamma</p>");
    container = result.container;
    const ctx = makeCtx("doc3");
    const engine = new VimCursorEngine(result.adapter);
    // Replace clipboard with a stub so doYank doesn't throw in jsdom.
    Object.assign(navigator, {
      clipboard: { writeText: async (t: string) => { yankText = t; } },
    });
    engine.setOperatorContext(ctx);

    engine.activate("doc3");
    engine.handleKeyDown(key("y"));
    expect(useVimModeStore.getState().pendingOperator).toBe("y");
    engine.handleKeyDown(key("y"));

    expect(yankText).not.toBeNull();
    expect(yankText).toContain("alpha");
    expect(extractLog.length).toBe(0);
    engine.dispose();
  });

  it("Escape cancels a pending operator", () => {
    const result = createTestAdapter("<p>one two three</p>");
    container = result.container;
    const ctx = makeCtx("doc4");
    const engine = new VimCursorEngine(result.adapter);
    engine.setOperatorContext(ctx);

    engine.activate("doc4");
    engine.handleKeyDown(key("d"));
    expect(useVimModeStore.getState().pendingOperator).toBe("d");
    engine.handleKeyDown(key("Escape"));
    expect(useVimModeStore.getState().pendingOperator).toBeNull();
    expect(useVimModeStore.getState().mode).toBe("normal");
    engine.dispose();
  });

  it("clearTransient clears a pending operator (tab switch)", () => {
    const result = createTestAdapter("<p>one two three</p>");
    container = result.container;
    const engine = new VimCursorEngine(result.adapter);
    engine.setOperatorContext(makeCtx("doc5"));

    engine.activate("doc5");
    engine.handleKeyDown(key("d"));
    expect(useVimModeStore.getState().pendingOperator).toBe("d");
    useVimModeStore.getState().clearTransient();
    expect(useVimModeStore.getState().pendingOperator).toBeNull();
    engine.dispose();
  });
});
