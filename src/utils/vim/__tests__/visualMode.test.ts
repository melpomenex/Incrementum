import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { VimCursorEngine } from "../VimCursorEngine";
import { useVimModeStore } from "../../../stores/vimModeStore";
import { getSelectedText, clearSelection } from "../selectionManager";
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

function makeKeyDown(key: string, shift = false): KeyboardEvent {
  return new KeyboardEvent("keydown", { key, shiftKey: shift, bubbles: true, cancelable: true });
}

describe("Visual mode", () => {
  let engine: VimCursorEngine;
  let container: HTMLDivElement;

  beforeEach(() => {
    const result = createTestAdapter("<p>one two three four five</p>");
    engine = new VimCursorEngine(result.adapter);
    container = result.container;
  });

  afterEach(() => {
    engine.dispose();
    container.remove();
    useVimModeStore.getState().deactivate();
  });

  it("enters visual mode and sets anchor", () => {
    engine.activate("test-doc");
    engine.handleKeyDown(makeKeyDown("v"));
    const store = useVimModeStore.getState();
    expect(store.mode).toBe("visual");
    expect(store.selectionAnchor).toBe(store.cursorIndex);
  });

  it("extends selection with w", () => {
    engine.activate("test-doc");
    engine.handleKeyDown(makeKeyDown("v"));
    engine.handleKeyDown(makeKeyDown("w"));
    engine.handleKeyDown(makeKeyDown("w"));

    const store = useVimModeStore.getState();
    expect(store.cursorIndex).toBe(2);
    // Selection should span from anchor (0) to cursor (2)
    const text = getSelectedText(document);
    expect(text.length).toBeGreaterThan(0);
  });

  it("selection extends backward with b", () => {
    engine.activate("test-doc");
    // Move to word 3
    engine.handleKeyDown(makeKeyDown("w"));
    engine.handleKeyDown(makeKeyDown("w"));
    engine.handleKeyDown(makeKeyDown("w"));
    // Enter visual and go back
    engine.handleKeyDown(makeKeyDown("v"));
    engine.handleKeyDown(makeKeyDown("b"));

    const store = useVimModeStore.getState();
    expect(store.cursorIndex).toBe(2);
    expect(store.selectionAnchor).toBe(3);
  });

  it("clears selection on Escape", () => {
    engine.activate("test-doc");
    engine.handleKeyDown(makeKeyDown("v"));
    engine.handleKeyDown(makeKeyDown("w"));
    engine.handleKeyDown(makeKeyDown("Escape"));

    const store = useVimModeStore.getState();
    expect(store.mode).toBe("normal");
    const text = getSelectedText(document);
    expect(text).toBe("");
  });

  it("switches from visual to visual-line with V", () => {
    engine.activate("test-doc");
    engine.handleKeyDown(makeKeyDown("v"));
    engine.handleKeyDown(makeKeyDown("V", true));
    expect(useVimModeStore.getState().mode).toBe("visual-line");
  });
});

describe("Visual Line mode", () => {
  let engine: VimCursorEngine;
  let container: HTMLDivElement;

  beforeEach(() => {
    const result = createTestAdapter("<p>line one here</p><p>line two here</p>");
    engine = new VimCursorEngine(result.adapter);
    container = result.container;
  });

  afterEach(() => {
    engine.dispose();
    container.remove();
    useVimModeStore.getState().deactivate();
  });

  it("enters visual-line mode with V", () => {
    engine.activate("test-doc");
    engine.handleKeyDown(makeKeyDown("V", true));
    expect(useVimModeStore.getState().mode).toBe("visual-line");
  });

  it("switches to visual mode with v", () => {
    engine.activate("test-doc");
    engine.handleKeyDown(makeKeyDown("V", true));
    engine.handleKeyDown(makeKeyDown("v"));
    expect(useVimModeStore.getState().mode).toBe("visual");
  });

  it("exits to normal on Escape", () => {
    engine.activate("test-doc");
    engine.handleKeyDown(makeKeyDown("V", true));
    engine.handleKeyDown(makeKeyDown("Escape"));
    expect(useVimModeStore.getState().mode).toBe("normal");
  });
});
