import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { VimCursorEngine } from "../VimCursorEngine";
import { useVimModeStore } from "../../../stores/vimModeStore";
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
  return new KeyboardEvent("keydown", {
    key,
    shiftKey: shift,
    bubbles: true,
    cancelable: true,
  });
}

describe("VimCursorEngine", () => {
  let engine: VimCursorEngine;
  let container: HTMLDivElement;

  beforeEach(() => {
    const result = createTestAdapter(
      "<p>one two three</p><p>four five six</p><p>seven eight</p>",
    );
    engine = new VimCursorEngine(result.adapter);
    container = result.container;
  });

  afterEach(() => {
    engine.dispose();
    container.remove();
    useVimModeStore.getState().deactivate();
  });

  describe("mode transitions", () => {
    it("activates into normal mode", () => {
      engine.activate("test-doc");
      expect(useVimModeStore.getState().mode).toBe("normal");
    });

    it("deactivates from normal mode on Escape", () => {
      engine.activate("test-doc");
      const handled = engine.handleKeyDown(makeKeyDown("Escape"));
      expect(handled).toBe(true);
      expect(useVimModeStore.getState().mode).toBe("inactive");
    });

    it("enters visual mode from normal with v", () => {
      engine.activate("test-doc");
      const handled = engine.handleKeyDown(makeKeyDown("v"));
      expect(handled).toBe(true);
      expect(useVimModeStore.getState().mode).toBe("visual");
    });

    it("enters visual-line mode from normal with V", () => {
      engine.activate("test-doc");
      const handled = engine.handleKeyDown(makeKeyDown("V", true));
      expect(handled).toBe(true);
      expect(useVimModeStore.getState().mode).toBe("visual-line");
    });

    it("exits visual mode to normal on Escape", () => {
      engine.activate("test-doc");
      engine.handleKeyDown(makeKeyDown("v"));
      expect(useVimModeStore.getState().mode).toBe("visual");
      engine.handleKeyDown(makeKeyDown("Escape"));
      expect(useVimModeStore.getState().mode).toBe("normal");
    });

    it("switches from visual to visual-line", () => {
      engine.activate("test-doc");
      engine.handleKeyDown(makeKeyDown("v"));
      engine.handleKeyDown(makeKeyDown("V", true));
      expect(useVimModeStore.getState().mode).toBe("visual-line");
    });

    it("switches from visual-line to visual", () => {
      engine.activate("test-doc");
      engine.handleKeyDown(makeKeyDown("V", true));
      engine.handleKeyDown(makeKeyDown("v"));
      expect(useVimModeStore.getState().mode).toBe("visual");
    });

    it("full cycle: inactive → normal → visual → normal → inactive", () => {
      expect(useVimModeStore.getState().mode).toBe("inactive");
      engine.activate("test-doc");
      expect(useVimModeStore.getState().mode).toBe("normal");
      engine.handleKeyDown(makeKeyDown("v"));
      expect(useVimModeStore.getState().mode).toBe("visual");
      engine.handleKeyDown(makeKeyDown("Escape"));
      expect(useVimModeStore.getState().mode).toBe("normal");
      engine.handleKeyDown(makeKeyDown("Escape"));
      expect(useVimModeStore.getState().mode).toBe("inactive");
    });
  });

  describe("motion dispatch", () => {
    it("w moves forward one word", () => {
      engine.activate("test-doc");
      const startIdx = useVimModeStore.getState().cursorIndex;
      engine.handleKeyDown(makeKeyDown("w"));
      expect(useVimModeStore.getState().cursorIndex).toBe(startIdx + 1);
    });

    it("b moves backward one word", () => {
      engine.activate("test-doc");
      engine.handleKeyDown(makeKeyDown("w"));
      engine.handleKeyDown(makeKeyDown("w"));
      engine.handleKeyDown(makeKeyDown("b"));
      expect(useVimModeStore.getState().cursorIndex).toBe(1);
    });

    it("j handled when tokens exist", () => {
      engine.activate("test-doc");
      // In jsdom, all tokens share Y=0 so j doesn't advance — that's expected
      // The motion is handled (returns true) which is the key assertion
      const handled = engine.handleKeyDown(makeKeyDown("j"));
      expect(handled).toBe(true);
    });

    it("0 moves to line start", () => {
      engine.activate("test-doc");
      engine.handleKeyDown(makeKeyDown("w"));
      engine.handleKeyDown(makeKeyDown("0"));
      // Should be at start of the line
      expect(useVimModeStore.getState().cursorIndex).toBe(0);
    });
  });

  describe("inactive mode", () => {
    it("ignores motions when inactive", () => {
      expect(useVimModeStore.getState().mode).toBe("inactive");
      const handled = engine.handleKeyDown(makeKeyDown("w"));
      expect(handled).toBe(false);
    });
  });
});
