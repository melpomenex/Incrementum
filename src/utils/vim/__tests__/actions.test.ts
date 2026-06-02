import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { VimCursorEngine } from "../VimCursorEngine";
import { useVimModeStore } from "../../../stores/vimModeStore";
import type { TextDocumentAdapter } from "../textModel";
import type { VimActionContext } from "../actions";
import { doExtract, doYank, doHighlight, doFlashcard, doExtractWithDialog } from "../actions";

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

describe("action dispatch (engine)", () => {
  let engine: VimCursorEngine;
  let container: HTMLDivElement;
  let actionLog: string[];

  beforeEach(() => {
    actionLog = [];
    const result = createTestAdapter("<p>hello world foo bar</p>");
    engine = new VimCursorEngine(result.adapter, (action) => actionLog.push(action));
    container = result.container;
  });

  afterEach(() => {
    engine.dispose();
    container.remove();
    useVimModeStore.getState().deactivate();
  });

  it("dispatches extract action on Enter in visual mode", () => {
    engine.activate("test-doc");
    engine.handleKeyDown(makeKeyDown("v"));
    engine.handleKeyDown(makeKeyDown("w"));
    engine.handleKeyDown(makeKeyDown("Enter"));
    expect(actionLog).toContain("extract");
  });

  it("dispatches extract-dialog action on E in visual mode", () => {
    engine.activate("test-doc");
    engine.handleKeyDown(makeKeyDown("v"));
    engine.handleKeyDown(makeKeyDown("w"));
    engine.handleKeyDown(makeKeyDown("e"));
    expect(actionLog).toContain("extract-dialog");
  });

  it("dispatches yank action on y in visual mode", () => {
    engine.activate("test-doc");
    engine.handleKeyDown(makeKeyDown("v"));
    engine.handleKeyDown(makeKeyDown("w"));
    engine.handleKeyDown(makeKeyDown("y"));
    expect(actionLog).toContain("yank");
  });

  it("dispatches highlight action on H in visual mode", () => {
    engine.activate("test-doc");
    engine.handleKeyDown(makeKeyDown("v"));
    engine.handleKeyDown(makeKeyDown("w"));
    engine.handleKeyDown(makeKeyDown("H", true));
    expect(actionLog).toContain("highlight");
  });

  it("dispatches flashcard action on F in visual mode", () => {
    engine.activate("test-doc");
    engine.handleKeyDown(makeKeyDown("v"));
    engine.handleKeyDown(makeKeyDown("w"));
    engine.handleKeyDown(makeKeyDown("F", true));
    expect(actionLog).toContain("flashcard");
  });
});

describe("action handlers", () => {
  function makeCtx(overrides: Partial<VimActionContext> = {}): VimActionContext & {
    extractCalls: unknown[];
    dialogText: string | null;
    flashcardCalls: unknown[];
    clearCalls: number;
  } {
    const extractCalls: unknown[] = [];
    const flashcardCalls: unknown[] = [];
    let dialogText: string | null = null;
    let clearCalls = 0;

    return {
      documentId: "doc1",
      getSelectedText: () => "hello world",
      getPageNumber: () => 1,
      getSelectionContext: () => null,
      createInstantExtract: async (params: unknown) => { extractCalls.push(params); return null; },
      openExtractDialog: (text: string) => { dialogText = text; },
      openFlashcardStudio: (params: unknown) => { flashcardCalls.push(params); },
      clearTextSelection: () => { clearCalls++; },
      extractCalls,
      get dialogText() { return dialogText; },
      flashcardCalls,
      get clearCalls() { return clearCalls; },
      ...overrides,
    };
  }

  it("doExtract calls createInstantExtract with correct params", async () => {
    const ctx = makeCtx();
    await doExtract(ctx);
    // Flush microtask queue
    await new Promise((r) => setTimeout(r, 0));
    expect(ctx.extractCalls).toHaveLength(1);
    expect(ctx.extractCalls[0]).toMatchObject({ documentId: "doc1", text: "hello world" });
    expect(ctx.clearCalls).toBe(1);
  });

  it("doYank writes to clipboard and clears", async () => {
    const ctx = makeCtx();
    await doYank(ctx);
    expect(ctx.clearCalls).toBe(1);
  });

  it("doHighlight passes color to createInstantExtract", async () => {
    const ctx = makeCtx();
    await doHighlight(ctx, "green");
    expect(ctx.extractCalls).toHaveLength(1);
    expect(ctx.extractCalls[0]).toMatchObject({ color: "green" });
  });

  it("doFlashcard opens studio with excerpt", () => {
    const ctx = makeCtx();
    doFlashcard(ctx);
    expect(ctx.flashcardCalls).toHaveLength(1);
    expect(ctx.flashcardCalls[0]).toMatchObject({ documentId: "doc1", excerpt: "hello world" });
  });

  it("doExtractWithDialog opens dialog", () => {
    const ctx = makeCtx();
    doExtractWithDialog(ctx);
    expect(ctx.dialogText).toBe("hello world");
  });

  it("doExtract does nothing with no selection", async () => {
    const ctx = makeCtx({ getSelectedText: () => "" });
    await doExtract(ctx);
    expect(ctx.extractCalls).toHaveLength(0);
    expect(ctx.clearCalls).toBe(0);
  });
});
