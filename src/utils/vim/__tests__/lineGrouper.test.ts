import { describe, it, expect } from "vitest";
import { groupTokensIntoLines, findLineForToken, findClosestTokenOnLine, type LineGroup } from "../lineGrouper";
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

describe("groupTokensIntoLines", () => {
  it("groups tokens on the same Y line", () => {
    const tokens = [
      makeToken(0, "Hello", 100, 0),
      makeToken(1, "world", 100, 60),
      makeToken(2, "foo", 100, 120),
    ];
    const lines = groupTokensIntoLines(tokens);
    expect(lines).toHaveLength(1);
    expect(lines[0].tokens).toHaveLength(3);
  });

  it("splits tokens on different Y lines", () => {
    const tokens = [
      makeToken(0, "Hello", 100, 0),
      makeToken(1, "world", 100, 60),
      makeToken(2, "foo", 140, 0),
      makeToken(3, "bar", 140, 60),
    ];
    const lines = groupTokensIntoLines(tokens);
    expect(lines).toHaveLength(2);
    expect(lines[0].tokens.map((t) => t.text)).toEqual(["Hello", "world"]);
    expect(lines[1].tokens.map((t) => t.text)).toEqual(["foo", "bar"]);
  });

  it("handles tokens within Y threshold (4px)", () => {
    const tokens = [
      makeToken(0, "Hello", 100, 0),
      makeToken(1, "world", 103, 60),
    ];
    const lines = groupTokensIntoLines(tokens);
    expect(lines).toHaveLength(1);
  });

  it("splits tokens beyond Y threshold", () => {
    const tokens = [
      makeToken(0, "Hello", 100, 0),
      makeToken(1, "world", 108, 60),
    ];
    const lines = groupTokensIntoLines(tokens);
    expect(lines).toHaveLength(2);
  });

  it("returns empty array for no tokens", () => {
    const lines = groupTokensIntoLines([]);
    expect(lines).toHaveLength(0);
  });

  it("computes line top and bottom", () => {
    const tokens = [
      makeToken(0, "Hello", 100, 0, 50, 20),
      makeToken(1, "world", 102, 60, 50, 18),
    ];
    const lines = groupTokensIntoLines(tokens);
    expect(lines[0].top).toBe(100);
    expect(lines[0].bottom).toBe(120);
  });
});

describe("findLineForToken", () => {
  const tokens = [
    makeToken(0, "Hello", 100, 0),
    makeToken(1, "world", 100, 60),
    makeToken(2, "foo", 140, 0),
  ];
  const lines = groupTokensIntoLines(tokens);

  it("finds the line for a token in the first line", () => {
    const line = findLineForToken(lines, 0);
    expect(line).not.toBeNull();
    expect(line!.tokens).toHaveLength(2);
  });

  it("finds the line for a token in the second line", () => {
    const line = findLineForToken(lines, 2);
    expect(line).not.toBeNull();
    expect(line!.tokens).toHaveLength(1);
  });

  it("returns null for out-of-range token", () => {
    const line = findLineForToken(lines, 99);
    expect(line).toBeNull();
  });
});

describe("findClosestTokenOnLine", () => {
  const tokens = [
    makeToken(0, "Hello", 100, 0, 50, 20),
    makeToken(1, "world", 100, 80, 50, 20),
    makeToken(2, "foo", 100, 160, 50, 20),
  ];
  const lines = groupTokensIntoLines(tokens);

  it("finds closest token to desired X position", () => {
    const line = lines[0];
    const token = findClosestTokenOnLine(line, 25);
    expect(token.text).toBe("Hello");

    const token2 = findClosestTokenOnLine(line, 100);
    expect(token2.text).toBe("world");

    const token3 = findClosestTokenOnLine(line, 180);
    expect(token3.text).toBe("foo");
  });
});
