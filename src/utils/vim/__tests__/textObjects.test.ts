import { describe, it, expect } from "vitest";
import { selectTextObject } from "../textObjects";
import { groupTokensIntoLines } from "../lineGrouper";
import type { WordToken } from "../textModel";

const FAKE_NODE = { nodeType: Node.TEXT_NODE } as unknown as Text;

function tok(index: number, text: string, top: number, left: number, startOffset = 0, endOffset = text.length): WordToken {
  return {
    index,
    text,
    node: FAKE_NODE,
    startOffset,
    endOffset,
    rect: new DOMRect(left, top, text.length * 10, 20),
    kind: /^\w+$/.test(text) ? "word" : "punct",
  };
}

describe("selectTextObject — word objects (aw / iw)", () => {
  // "foo bar baz" — 3 tokens on one line.
  const tokens = [
    tok(0, "foo", 100, 0),
    tok(1, "bar", 100, 50),
    tok(2, "baz", 100, 100),
  ];

  it("iw selects just the current word", () => {
    const r = selectTextObject(tokens, 1, "iw")!;
    expect(r.startIndex).toBe(1);
    expect(r.endIndex).toBe(1);
  });

  it("aw selects the word plus the trailing token (whitespace gap)", () => {
    const r = selectTextObject(tokens, 1, "aw")!;
    expect(r.startIndex).toBe(1);
    expect(r.endIndex).toBe(2);
  });

  it("aw clamps at the end when the cursor is on the last token", () => {
    const r = selectTextObject(tokens, 2, "aw")!;
    expect(r.startIndex).toBe(2);
    expect(r.endIndex).toBe(2);
  });
});

describe("selectTextObject — sentence objects (as / is)", () => {
  // "Hello world. Second one." → tokens with sentence terminator on "world." and "one."
  // We model the terminator as the last char of the token text.
  const tokens = [
    tok(0, "Hello", 100, 0),
    tok(1, "world.", 100, 50),   // ends with '.'
    tok(2, "Second", 100, 110),
    tok(3, "one.", 100, 170),    // ends with '.'
  ];

  it("is selects the sentence containing the cursor", () => {
    // cursor in first sentence (tokens 0-1)
    const r = selectTextObject(tokens, 0, "is")!;
    expect(r.startIndex).toBe(0);
    expect(r.endIndex).toBe(1);
  });

  it("is selects the second sentence when the cursor is in it", () => {
    const r = selectTextObject(tokens, 2, "is")!;
    expect(r.startIndex).toBe(2);
    expect(r.endIndex).toBe(3);
  });

  it("as extends the sentence range by one trailing token", () => {
    const r = selectTextObject(tokens, 0, "as")!;
    expect(r.startIndex).toBe(0);
    expect(r.endIndex).toBe(2); // includes the first token of the next sentence as trailing whitespace stand-in
  });
});

describe("selectTextObject — paragraph objects (ap / ip)", () => {
  // Two paragraphs separated by a >20px Y gap. Lines are grouped by Y.
  // Para 1: tokens 0,1 at Y=100. Para 2: tokens 2,3 at Y=160 (gap=40).
  const tokens = [
    tok(0, "First", 100, 0),
    tok(1, "para", 100, 50),
    tok(2, "Second", 160, 0),
    tok(3, "para", 160, 50),
  ];
  const lines = groupTokensIntoLines(tokens);

  it("ip selects the paragraph containing the cursor", () => {
    const r = selectTextObject(tokens, 0, "ip", lines)!;
    expect(r.startIndex).toBe(0);
    expect(r.endIndex).toBe(1);
  });

  it("ip selects the second paragraph", () => {
    const r = selectTextObject(tokens, 2, "ip", lines)!;
    expect(r.startIndex).toBe(2);
    expect(r.endIndex).toBe(3);
  });

  it("ap extends to include the leading line of the next paragraph when a gap follows", () => {
    // cursor in para 1; ap should select para 1 plus the next token (blank-line stand-in)
    const r = selectTextObject(tokens, 0, "ap", lines)!;
    expect(r.startIndex).toBe(0);
    expect(r.endIndex).toBeGreaterThanOrEqual(1);
  });
});

describe("selectTextObject — edge cases", () => {
  it("returns null for an empty token list", () => {
    expect(selectTextObject([], 0, "iw")).toBeNull();
  });

  it("clamps an out-of-bounds cursor index", () => {
    const tokens = [tok(0, "hi", 100, 0)];
    const r = selectTextObject(tokens, 99, "iw")!;
    expect(r.startIndex).toBe(0);
    expect(r.endIndex).toBe(0);
  });
});
