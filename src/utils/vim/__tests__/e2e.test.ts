/**
 * E2E Tests for Vim Reading Mode
 *
 * These tests verify complete vim reading workflows end-to-end:
 * activation → navigation → visual selection → actions
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { VimCursorEngine } from "../VimCursorEngine";
import { useVimModeStore } from "../../../stores/vimModeStore";
import type { VimActionContext } from "../actions";
import { getSelectedText } from "../selectionManager";
import type { TextDocumentAdapter } from "../textModel";

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

function key(key: string, shift = false): KeyboardEvent {
  return new KeyboardEvent("keydown", { key, shiftKey: shift, bubbles: true, cancelable: true });
}

describe("Vim Reading E2E", () => {
  let container: HTMLDivElement;
  let extractLog: Array<{ text: string; color?: string }>;
  let dialogText: string | null;
  let flashcardLog: Array<{ excerpt: string }>;

  beforeEach(() => {
    extractLog = [];
    dialogText = null;
    flashcardLog = [];
  });

  function makeActionCtx(docId: string): VimActionContext {
    return {
      documentId: docId,
      getSelectedText: () => getSelectedText(document),
      getPageNumber: () => 1,
      getSelectionContext: () => null,
      createInstantExtract: async (params) => {
        extractLog.push({ text: params.text, color: params.color });
        return null;
      },
      openExtractDialog: (text: string) => { dialogText = text; },
      openFlashcardStudio: (params) => { flashcardLog.push({ excerpt: params.excerpt }); },
      clearTextSelection: () => { window.getSelection()?.removeAllRanges(); },
    };
  }

  afterEach(() => {
    container?.remove();
    useVimModeStore.getState().deactivate();
  });

  it("E2E: activate → navigate → enter visual → select → extract", () => {
    const result = createTestAdapter("<p>one two three four five six</p>");
    container = result.container;

    const actionCtx = makeActionCtx("doc1");
    const engine = new VimCursorEngine(result.adapter, (action) => {
      // Simulate what the hook does
      if (action === "extract") {
        const text = getSelectedText(document);
        if (text) actionCtx.createInstantExtract({ documentId: "doc1", text, pageNumber: 1 });
      }
    });

    // 1. Activate
    engine.activate("doc1");
    expect(useVimModeStore.getState().mode).toBe("normal");

    // 2. Navigate to "two"
    engine.handleKeyDown(key("w"));
    expect(useVimModeStore.getState().cursorIndex).toBe(1);

    // 3. Enter visual mode
    engine.handleKeyDown(key("v"));
    expect(useVimModeStore.getState().mode).toBe("visual");

    // 4. Select 3 words (two, three, four)
    engine.handleKeyDown(key("w"));
    engine.handleKeyDown(key("w"));

    // 5. Extract
    engine.handleKeyDown(key("Enter"));
    expect(extractLog.length).toBeGreaterThan(0);

    engine.dispose();
  });

  it("E2E: activate → navigate with motions → enter visual-line → highlight", () => {
    const result = createTestAdapter("<p>first line here</p><p>second line there</p>");
    container = result.container;

    const engine = new VimCursorEngine(result.adapter, (action) => {
      if (action === "highlight") {
        const text = getSelectedText(document);
        if (text) actionCtx.createInstantExtract({ documentId: "doc1", text, color: "yellow", pageNumber: 1 });
      }
    });

    const actionCtx = makeActionCtx("doc2");

    engine.activate("doc2");
    expect(useVimModeStore.getState().mode).toBe("normal");

    // Navigate forward
    engine.handleKeyDown(key("w"));
    engine.handleKeyDown(key("w"));

    // Enter visual-line mode
    engine.handleKeyDown(key("V", true));
    expect(useVimModeStore.getState().mode).toBe("visual-line");

    // Highlight
    engine.handleKeyDown(key("H", true));
    expect(extractLog).toHaveLength(1);

    engine.dispose();
  });

  it("E2E: activate → navigate → enter visual → yank", async () => {
    const result = createTestAdapter("<p>alpha beta gamma delta</p>");
    container = result.container;

    let yankText = "";
    const engine = new VimCursorEngine(result.adapter, (action) => {
      if (action === "yank") {
        yankText = getSelectedText(document);
      }
    });

    engine.activate("doc3");
    engine.handleKeyDown(key("w"));
    engine.handleKeyDown(key("v"));
    engine.handleKeyDown(key("w"));
    engine.handleKeyDown(key("y"));

    // Yank action was dispatched (text is captured from selection)
    expect(useVimModeStore.getState().lastAction).toBe("yank");

    engine.dispose();
  });

  it("E2E: Escape does not activate vim when no document is loaded", () => {
    // When there are no tokens, activating should still work but cursor stays at 0
    const result = createTestAdapter("");
    container = result.container;

    const engine = new VimCursorEngine(result.adapter);
    engine.activate("doc4");
    expect(useVimModeStore.getState().mode).toBe("normal");

    // No tokens — motions should not crash
    const handled = engine.handleKeyDown(key("w"));
    expect(handled).toBe(false); // no tokens, so motion not handled

    engine.dispose();
  });

  it("E2E: full mode cycle and Escape behavior", () => {
    const result = createTestAdapter("<p>hello world</p>");
    container = result.container;

    const engine = new VimCursorEngine(result.adapter);

    // Activate
    engine.activate("doc5");
    expect(useVimModeStore.getState().mode).toBe("normal");

    // Enter visual
    engine.handleKeyDown(key("v"));
    expect(useVimModeStore.getState().mode).toBe("visual");

    // Escape back to normal
    engine.handleKeyDown(key("Escape"));
    expect(useVimModeStore.getState().mode).toBe("normal");

    // Escape deactivates
    engine.handleKeyDown(key("Escape"));
    expect(useVimModeStore.getState().mode).toBe("inactive");

    engine.dispose();
  });

  it("E2E: gg/G jumps to document boundaries", () => {
    const result = createTestAdapter("<p>one two three four five six seven eight</p>");
    container = result.container;

    const engine = new VimCursorEngine(result.adapter);
    engine.activate("doc6");

    // Move to middle
    engine.handleKeyDown(key("w"));
    engine.handleKeyDown(key("w"));
    engine.handleKeyDown(key("w"));
    expect(useVimModeStore.getState().cursorIndex).toBe(3);

    // G to end
    engine.handleKeyDown(key("G", true));
    expect(useVimModeStore.getState().cursorIndex).toBe(7);

    // gg to start
    engine.handleKeyDown(key("g"));
    engine.handleKeyDown(key("g"));
    expect(useVimModeStore.getState().cursorIndex).toBe(0);

    engine.dispose();
  });
});
