import { describe, it, expect, beforeEach } from "vitest";
import { buildWordTokens, type TextDocumentAdapter, type WordToken } from "../textModel";

function createAdapter(html: string): { adapter: TextDocumentAdapter; container: HTMLDivElement } {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);

  const adapter: TextDocumentAdapter = {
    getTextNodes: () => {
      const textNodes: Text[] = [];
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        if (node.textContent && node.textContent.trim()) {
          textNodes.push(node);
        }
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
  };

  return { adapter, container };
}

describe("buildWordTokens", () => {
  let cleanup: HTMLDivElement[] = [];

  beforeEach(() => {
    cleanup.forEach((el) => el.remove());
    cleanup = [];
  });

  function build(html: string) {
    const { adapter, container } = createAdapter(html);
    cleanup.push(container);
    return buildWordTokens(adapter);
  }

  it("tokenizes a simple paragraph", () => {
    const tokens = build("<p>Hello world</p>");
    expect(tokens).toHaveLength(2);
    expect(tokens[0].text).toBe("Hello");
    expect(tokens[1].text).toBe("world");
    expect(tokens[0].index).toBe(0);
    expect(tokens[1].index).toBe(1);
  });

  it("preserves node and offset references", () => {
    const tokens = build("<p>foo bar</p>");
    expect(tokens[0].node.nodeType).toBe(Node.TEXT_NODE);
    expect(tokens[0].startOffset).toBe(0);
    expect(tokens[0].endOffset).toBe(3);
    expect(tokens[1].startOffset).toBe(4);
    expect(tokens[1].endOffset).toBe(7);
  });

  it("handles multiple text nodes across elements", () => {
    const tokens = build("<p>Hello</p><p>World</p>");
    expect(tokens).toHaveLength(2);
    expect(tokens[0].text).toBe("Hello");
    expect(tokens[1].text).toBe("World");
    // Different text nodes
    expect(tokens[0].node).not.toBe(tokens[1].node);
  });

  it("skips whitespace-only nodes", () => {
    const tokens = build("<p>  </p><p>word</p>");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].text).toBe("word");
  });

  it("handles inline elements", () => {
    const tokens = build("<p>Hello <strong>bold</strong> end</p>");
    expect(tokens.map((t) => t.text)).toEqual(["Hello", "bold", "end"]);
  });

  it("computes bounding rects for each token", () => {
    const tokens = build("<p>Hello world</p>");
    for (const token of tokens) {
      expect(token.rect).toBeDefined();
      expect(token.rect).toBeInstanceOf(DOMRect);
    }
  });

  it("returns empty array for empty container", () => {
    const tokens = build("<p></p>");
    expect(tokens).toHaveLength(0);
  });

  it("handles multi-word text node", () => {
    const tokens = build("<p>one two three four</p>");
    expect(tokens).toHaveLength(4);
    expect(tokens.map((t) => t.text)).toEqual(["one", "two", "three", "four"]);
  });
});
