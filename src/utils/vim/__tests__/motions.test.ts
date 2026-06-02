import { describe, it, expect } from "vitest";
import {
  motionH, motionL, motionW, motionB, motionE,
  motion0, motionDollar, motionJ, motionK,
  motionGG, motionG, motionOpenBrace, motionCloseBrace,
} from "../motions";
import type { WordToken } from "../textModel";
import { groupTokensIntoLines } from "../lineGrouper";

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

// Line 0: tokens 0-2 at Y=100
// Line 1: tokens 3-5 at Y=140
// Line 2: tokens 6-7 at Y=180
function makeFixture() {
  const tokens: WordToken[] = [
    makeToken(0, "Hello", 100, 0),
    makeToken(1, "beautiful", 100, 60),
    makeToken(2, "world", 100, 140),
    makeToken(3, "foo", 140, 0),
    makeToken(4, "bar", 140, 60),
    makeToken(5, "baz", 140, 120),
    makeToken(6, "end", 180, 0),
    makeToken(7, "here", 180, 60),
  ];
  const lines = groupTokensIntoLines(tokens);
  return { tokens, lines };
}

// Paragraph fixture: line 0, gap, lines 1-2
function makeParagraphFixture() {
  const tokens: WordToken[] = [
    makeToken(0, "First", 100, 0),
    makeToken(1, "para", 100, 60),
    // GAP > 20px between line 0 (bottom=120) and line 1 (top=160)
    makeToken(2, "Second", 160, 0),
    makeToken(3, "para", 160, 60),
    makeToken(4, "line2", 180, 0),
  ];
  const lines = groupTokensIntoLines(tokens);
  return { tokens, lines };
}

describe("motionH", () => {
  it("moves to previous word", () => {
    const { tokens } = makeFixture();
    const r = motionH(tokens, 3, 0);
    expect(r.cursorIndex).toBe(2);
  });

  it("clamps at start", () => {
    const { tokens } = makeFixture();
    const r = motionH(tokens, 0, 0);
    expect(r.cursorIndex).toBe(0);
  });
});

describe("motionL", () => {
  it("moves to next word", () => {
    const { tokens } = makeFixture();
    const r = motionL(tokens, 0, 0);
    expect(r.cursorIndex).toBe(1);
  });

  it("clamps at end", () => {
    const { tokens } = makeFixture();
    const r = motionL(tokens, 7, 0);
    expect(r.cursorIndex).toBe(7);
  });
});

describe("motionW", () => {
  it("moves forward one word", () => {
    const { tokens } = makeFixture();
    const r = motionW(tokens, 0, 0);
    expect(r.cursorIndex).toBe(1);
  });
});

describe("motionB", () => {
  it("moves backward one word", () => {
    const { tokens } = makeFixture();
    const r = motionB(tokens, 5, 0);
    expect(r.cursorIndex).toBe(4);
  });

  it("clamps at start", () => {
    const { tokens } = makeFixture();
    const r = motionB(tokens, 0, 0);
    expect(r.cursorIndex).toBe(0);
  });
});

describe("motionE", () => {
  it("moves to end of next word", () => {
    const { tokens } = makeFixture();
    const r = motionE(tokens, 0, 0);
    expect(r.cursorIndex).toBe(1);
  });
});

describe("motion0", () => {
  it("moves to start of current line", () => {
    const { tokens, lines } = makeFixture();
    const r = motion0(tokens, 4, lines);
    expect(r.cursorIndex).toBe(3);
  });

  it("stays at start if already there", () => {
    const { tokens, lines } = makeFixture();
    const r = motion0(tokens, 0, lines);
    expect(r.cursorIndex).toBe(0);
  });
});

describe("motionDollar", () => {
  it("moves to end of current line", () => {
    const { tokens, lines } = makeFixture();
    const r = motionDollar(tokens, 3, lines);
    expect(r.cursorIndex).toBe(5);
  });
});

describe("motionJ", () => {
  it("moves down one line", () => {
    const { tokens, lines } = makeFixture();
    // At token 1 (line 0, x=60), move down → should hit token 4 (line 1, x=60)
    const r = motionJ(tokens, 1, 85, lines);
    expect(r.cursorIndex).toBe(4);
  });

  it("maintains desired column", () => {
    const { tokens, lines } = makeFixture();
    // At token 2 (x=140), desired col = 165
    // Move down to line 1 → closest to x=165 is token 5 (x=120, mid=145)
    const r = motionJ(tokens, 2, 165, lines);
    expect(r.cursorIndex).toBe(5);
  });

  it("clamps at last line", () => {
    const { tokens, lines } = makeFixture();
    const r = motionJ(tokens, 7, 30, lines);
    expect(r.cursorIndex).toBe(7);
  });
});

describe("motionK", () => {
  it("moves up one line", () => {
    const { tokens, lines } = makeFixture();
    // token 4 (bar) at x=60, desiredColumn=30 → closest on line 0 is token 0 (mid=25)
    const r = motionK(tokens, 4, 30, lines);
    expect(r.cursorIndex).toBe(0);
  });

  it("clamps at first line", () => {
    const { tokens, lines } = makeFixture();
    const r = motionK(tokens, 0, 30, lines);
    expect(r.cursorIndex).toBe(0);
  });
});

describe("motionGG", () => {
  it("jumps to first token", () => {
    const { tokens } = makeFixture();
    const r = motionGG(tokens);
    expect(r.cursorIndex).toBe(0);
  });
});

describe("motionG", () => {
  it("jumps to last token", () => {
    const { tokens } = makeFixture();
    const r = motionG(tokens);
    expect(r.cursorIndex).toBe(7);
  });
});

describe("motionOpenBrace", () => {
  it("jumps to previous paragraph", () => {
    const { tokens, lines } = makeParagraphFixture();
    // At token 3 (in second paragraph), { should go to start of second paragraph (token 2)
    const r = motionOpenBrace(tokens, 3, lines);
    expect(r.cursorIndex).toBe(2);
  });

  it("goes to first line when no paragraph gap above", () => {
    const { tokens, lines } = makeParagraphFixture();
    const r = motionOpenBrace(tokens, 0, lines);
    expect(r.cursorIndex).toBe(0);
  });
});

describe("motionCloseBrace", () => {
  it("jumps to next paragraph", () => {
    const { tokens, lines } = makeParagraphFixture();
    // At token 1 (first paragraph), } should go to start of second paragraph (token 2)
    const r = motionCloseBrace(tokens, 1, lines);
    expect(r.cursorIndex).toBe(2);
  });

  it("goes to last line when no paragraph gap below", () => {
    const { tokens, lines } = makeParagraphFixture();
    const r = motionCloseBrace(tokens, 4, lines);
    expect(r.cursorIndex).toBe(4);
  });
});
