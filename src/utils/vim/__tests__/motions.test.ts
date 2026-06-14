import { describe, it, expect } from "vitest";
import {
  motionH, motionL, motionW, motionB, motionE,
  motionBigW, motionBigB, motionBigE,
  motion0, motionDollar, motionJ, motionK,
  motionGG, motionG, motionOpenBrace, motionCloseBrace,
} from "../motions";
import type { WordToken } from "../textModel";
import { groupTokensIntoLines } from "../lineGrouper";

function makeToken(index: number, text: string, top: number, left: number, width = 50, height = 20, node?: Text, startOffset = 0, endOffset = text.length): WordToken {
  return {
    index,
    text,
    node: node ?? (null as unknown as Text),
    startOffset,
    endOffset,
    rect: new DOMRect(left, top, width, height),
  };
}

/**
 * Build tokens that emulate how buildWordTokens now splits on word/punct
 * boundaries. Pass `|` as a text entry to insert a whitespace gap (new WORD
 * boundary) without emitting a token. Tokens before/after a `|` belong to
 * different WORDs.
 */
function makeWordAndPunctTokens(spec: Array<{ text: string; top?: number; left?: number } | "|">): WordToken[] {
  const FAKE_NODE = { nodeType: Node.TEXT_NODE } as unknown as Text;
  let offset = 0;
  let left = 0;
  let top = 100;
  const out: WordToken[] = [];
  let index = 0;
  for (const s of spec) {
    if (s === "|") {
      offset += 1; // whitespace gap → next token starts a new WORD
      left += 6;
      continue;
    }
    const startOffset = offset;
    offset += s.text.length;
    out.push({
      index,
      text: s.text,
      node: FAKE_NODE,
      startOffset,
      endOffset: offset,
      rect: new DOMRect(left, top, s.text.length * 10, 20),
      kind: (/^\w+$/.test(s.text) ? "word" : "punct") as "word" | "punct",
    });
    index++;
    left += s.text.length * 10 + 2;
    if (s.top !== undefined) { top = s.top; left = s.left ?? 0; }
  }
  return out;
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

// --- WORD vs word semantics (new) ---
// "foo, bar baz" tokenizes into [foo, ",", bar, baz] — 4 tokens but 3 WORDs.
describe("WORD vs word motions", () => {
  // foo, bar baz → tokens: foo(0) ,(1) bar(2) baz(3). `|` = whitespace gap.
  function makeMixedFixture() {
    const tokens = makeWordAndPunctTokens([
      { text: "foo" },
      { text: "," },
      "|",
      { text: "bar" },
      "|",
      { text: "baz" },
    ]);
    return tokens;
  }

  it("motionW stops on each word AND punctuation run (4 stops)", () => {
    const tokens = makeMixedFixture();
    // Starting at foo(0): w → , → bar → baz
    expect(motionW(tokens, 0, 0).cursorIndex).toBe(1); // foo → ,
    expect(motionW(tokens, 1, 0).cursorIndex).toBe(2); // , → bar
    expect(motionW(tokens, 2, 0).cursorIndex).toBe(3); // bar → baz
    expect(motionW(tokens, 3, 0).cursorIndex).toBe(3); // clamp at end
  });

  it("motionBigW skips punctuation runs (3 stops)", () => {
    const tokens = makeMixedFixture();
    // Starting at foo(0): W → bar → baz (skips the lone punct)
    expect(motionBigW(tokens, 0, 0).cursorIndex).toBe(2); // foo → bar
    expect(motionBigW(tokens, 2, 0).cursorIndex).toBe(3); // bar → baz
    expect(motionBigW(tokens, 3, 0).cursorIndex).toBe(3); // clamp
  });

  it("motionBigB moves to the previous WORD start", () => {
    const tokens = makeMixedFixture();
    expect(motionBigB(tokens, 3, 0).cursorIndex).toBe(2); // baz → bar
    expect(motionBigB(tokens, 2, 0).cursorIndex).toBe(0); // bar → foo (skips punct)
  });

  it("motionE lands on the next token (word or punct)", () => {
    const tokens = makeMixedFixture();
    expect(motionE(tokens, 0, 0).cursorIndex).toBe(1); // foo → ,
  });

  it("motionBigE lands on the last token of the current WORD", () => {
    const tokens = makeMixedFixture();
    // foo, is the first WORD; last token of it is the comma (index 1).
    expect(motionBigE(tokens, 0, 0).cursorIndex).toBe(1); // foo → , (end of WORD "foo,")
  });
});
