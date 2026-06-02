import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { updateCaret, removeCaret } from "../caretOverlay";
import type { WordToken } from "../textModel";

function makeToken(index: number, text: string, top: number, left: number, width = 50, height = 20): WordToken {
  return {
    index,
    text,
    node: null as unknown as Text,
    startOffset: 0,
    endOffset: text.length,
    rect: new DOMRect(left, top, width, height),
  };
}

describe("caretOverlay", () => {
  afterEach(() => {
    // Clean up any leftover overlay
    document.getElementById("vim-cursor-overlay")?.remove();
  });

  it("creates a positioned overlay element", () => {
    const token = makeToken(0, "hello", 100, 50, 40, 20);
    const el = updateCaret(null, token, "block", document);
    expect(el.className).toBe("vim-cursor");
    expect(el.style.left).toBe("50px");
    expect(el.style.top).toBe("100px");
    expect(el.style.width).toBe("40px");
    expect(el.style.height).toBe("20px");
  });

  it("uses underline style for visual mode", () => {
    const token = makeToken(0, "hello", 100, 50);
    const el = updateCaret(null, token, "underline", document);
    expect(el.className).toContain("vim-cursor-visual");
  });

  it("reuses existing element when provided", () => {
    const token1 = makeToken(0, "hello", 100, 50);
    const el1 = updateCaret(null, token1, "block", document);
    const token2 = makeToken(1, "world", 120, 50);
    const el2 = updateCaret(el1, token2, "block", document);
    expect(el2).toBe(el1);
    expect(el2.style.top).toBe("120px");
  });

  it("removes caret overlay from DOM", () => {
    const token = makeToken(0, "hello", 100, 50);
    const el = updateCaret(null, token, "block", document);
    expect(el.parentNode).toBeTruthy();
    removeCaret(el, document);
    expect(el.parentNode).toBeNull();
  });

  it("removeCaret handles null gracefully", () => {
    expect(() => removeCaret(null, document)).not.toThrow();
  });
});
